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
         * Für die Steuerung bleibt die vorhandene Umrechnung bestehen.
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
     * Der HA-Wert wird 1:1 veröffentlicht:
     *
     * HA 0 %   -> free@home 0 %
     * HA 20 %  -> free@home 20 %
     * HA 80 %  -> free@home 80 %
     * HA 100 % -> free@home 100 %
     *
     * Damit entspricht die Positionsanzeige in free@home
     * der Anzeige in Home Assistant / Apple Home.
     */
    updateFreeAtHomeEntities(hassEntity: HassEntity): void {
        this.state = hassEntity.state;

        this.position =
            hassEntity.attributes?.current_position as
                number | undefined;

        if (this.position === undefined) {
            return;
        }

        const freeAtHomePosition = this.position;

        console.log(
            `Publishing BlindActuatorChannel position ${freeAtHomePosition}`
        );

        this.fhEntity.delegatePositionChanged(
            freeAtHomePosition
        );
    }
}
