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
         * free@home:
         * 0 %   = offen / oben
         * 100 % = geschlossen / unten
         *
         * Home Assistant:
         * 0 %   = geschlossen
         * 100 % = offen
         *
         * Deshalb wird die Position invertiert.
         */
        this.fhEntity.on(
            "relativeValueChanged",
            async (value: number) => {
                const homeAssistantPosition = 100 - value;

                console.log(
                    `Blinds ${this.id} position changed from free@home ${value} % to Home Assistant ${homeAssistantPosition} %`
                );

                const serviceData = {
                    type: "call_service",
                    domain: "cover",
                    service: "set_cover_position",
                    target: {
                        entity_id: this.id
                    },
                    service_data: {
                        position: homeAssistantPosition
                    }
                };

                ctx.hassConnection
                    .sendMessagePromise(serviceData)
                    .catch((err) => {
                        console.error(
                            "Error sending blind position update for",
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
        const newPosition =
            hassEntity.attributes?.current_position as
                number | undefined;

        return (
            this.state !== hassEntity.state ||
            this.position !== newPosition
        );
    }

    /*
     * Home Assistant -> free@home
     *
     * Auch in dieser Richtung wird invertiert:
     *
     * HA 0 %   -> free@home 100 %
     * HA 20 %  -> free@home 80 %
     * HA 80 %  -> free@home 20 %
     * HA 100 % -> free@home 0 %
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
            `Publishing BlindActuatorChannel position: Home Assistant ${this.position} % -> free@home ${freeAtHomePosition} %`
        );

        this.fhEntity.delegatePositionChanged(
            freeAtHomePosition
        );
    }
}
