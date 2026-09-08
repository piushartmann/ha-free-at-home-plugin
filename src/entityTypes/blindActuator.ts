import Entity from "../entity.js";
import type { ConnectionContext } from "../utils.js";
import type { HassEntity } from "home-assistant-js-websocket";
import { FreeAtHomeBlindActuatorChannel } from "@busch-jaeger/free-at-home";

export default class BlindActuatorEntity extends Entity {
    declare fhEntity: FreeAtHomeBlindActuatorChannel;

    position?: number;
    targetPosition?: number;

    readonly targetTolerance = 2;

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

        this.fhEntity.on(
            "relativeValueChanged",
            async (value: number) => {
                const homeAssistantPosition = 100 - value;

                this.targetPosition = homeAssistantPosition;

                console.log(
                    `Blinds ${this.id} position changed from free@home ${value} % to Home Assistant ${homeAssistantPosition} %`
                );

                console.log(
                    `Blinds ${this.id} waiting for Home Assistant target position ${homeAssistantPosition} %`
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
                        this.targetPosition = undefined;

                        console.error(
                            "Error sending blind position update for",
                            this.id,
                            ":",
                            err
                        );
                    });
            }
        );

        this.fhEntity.on(
            "stopMovement",
            async () => {
                console.log(
                    `Blinds ${this.id} stop movement command received`
                );

                this.targetPosition = undefined;

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

    stateChanged(hassEntity: HassEntity): boolean {
        const newPosition =
            hassEntity.attributes?.current_position as
                number | undefined;

        return (
            this.state !== hassEntity.state ||
            this.position !== newPosition
        );
    }

    updateFreeAtHomeEntities(hassEntity: HassEntity): void {
        this.state = hassEntity.state;

        this.position =
            hassEntity.attributes?.current_position as
                number | undefined;

        if (this.position === undefined) {
            return;
        }

        if (this.targetPosition !== undefined) {
            const difference = Math.abs(
                this.position - this.targetPosition
            );

            if (difference > this.targetTolerance) {
                console.log(
                    `Blinds ${this.id} suppressing intermediate Home Assistant position ${this.position} % while waiting for target ${this.targetPosition} %`
                );

                return;
            }

            console.log(
                `Blinds ${this.id} reached target position: Home Assistant ${this.position} % (target ${this.targetPosition} %)`
            );

            this.targetPosition = undefined;
        }

        const freeAtHomePosition = 100 - this.position;

        console.log(
            `Publishing BlindActuatorChannel ${this.id} position: Home Assistant ${this.position} % -> free@home ${freeAtHomePosition} %`
        );

        this.fhEntity.delegatePositionChanged(
            freeAtHomePosition
        );
    }
}
