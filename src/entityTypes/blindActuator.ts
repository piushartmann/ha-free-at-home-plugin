import Entity from "../entity.js";
import type { ConnectionContext } from "../utils.js";
import type { HassEntity } from "home-assistant-js-websocket";
import { FreeAtHomeBlindActuatorChannel } from "@busch-jaeger/free-at-home";

export default class BlindActuatorEntity extends Entity {
    declare fhEntity: FreeAtHomeBlindActuatorChannel;
    position?: number;

    constructor(entity: HassEntity, ctx: ConnectionContext) {
        super(entity, ctx);

        this.position =
            entity.attributes?.current_position as number | undefined;
    }

    async createFreeAtHomeEntities(
        ctx: ConnectionContext
    ): Promise<void> {
        this.fhEntity =
            await ctx.freeAtHome.createBlindDevice(
                this.nativeId,
                this.name
            );

        /*
         * free@home -> Home Assistant
         *
         * free@home BlindActuator:
         *   0   = offen
         *   100 = geschlossen
         *
         * Home Assistant cover:
         *   0   = geschlossen
         *   100 = offen
         */
        this.fhEntity.on(
            "relativeValueChanged",
            async (value: number) => {
                console.log(
                    `Blinds ${this.id} position changed to ${value}`
                );

                const serviceData = {
                    type: "call_service",
                    domain: "cover",
                    service: "set_cover_position",
                    target: {
                        entity_id: this.id
                    },
                    service_data: {
                        position: 100 - value
                    }
                };

                ctx.hassConnection
                    .sendMessagePromise(serviceData)
                    .catch((err) => {
                        console.error(
                            "Error sending blind state update for",
                            this.id,
                            ":",
                            err
                        );
                    });
            }
        );

        /*
         * Stop-Befehl free@home -> Home Assistant
         */
        this.fhEntity.on(
            "stopMovement",
            async () => {
                console.log(
                    `Blinds ${this.id} stop movement command received`
                );

                const serviceData = {
                    type: "call_service",
                    domain: "cover",
                    service: "stop_cover",
                    target: {
                        entity_id: this.id
                    }
                };

                ctx.hassConnection
                    .sendMessagePromise(serviceData)
                    .catch((err) => {
                        console.warn(
                            "Error sending blind stop command for",
                            this.id,
                            ":",
                            err
                        );
                    });
            }
        );
    }

    /*
     * Prüft sowohl den HA-State als auch die aktuelle Position.
     */
    stateChanged(hassEntity: HassEntity): boolean {
        return (
            this.state !== hassEntity.state ||
            this.position !==
                hassEntity.attributes?.current_position as
                    number | undefined
        );
    }

    /*
     * Home Assistant -> free@home
     *
     * HA current_position:
     *   0   = geschlossen
     *   100 = offen
     *
     * free@home BlindActuator:
     *   100 = geschlossen
     *   0   = offen
     *
     * Deshalb muss auch hier die Position invertiert werden.
     */
    updateFreeAtHomeEntities(hassEntity: HassEntity): void {
        this.state = hassEntity.state;

        this.position =
            hassEntity.attributes?.current_position as
                number | undefined;

        if (this.position === undefined) {
            return;
        }

        const freeAtHomePosition = 100 - this.position;

        console.log(
            `Publishing BlindActuatorChannel position ${freeAtHomePosition} (HA: ${this.position})`
        );

        this.fhEntity.delegatePositionChanged(
            freeAtHomePosition
        );
    }
}
