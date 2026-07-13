import Entity from "../entity.js";
import type { ConnectionContext } from "../utils.js";
import type { HassEntity } from 'home-assistant-js-websocket';
import { FreeAtHomeBlindActuatorChannel } from '@busch-jaeger/free-at-home';

export default class BlindActuatorEntity extends Entity {
    declare fhEntity: FreeAtHomeBlindActuatorChannel;
    position?: number;

    constructor(entity: HassEntity, ctx: ConnectionContext) {
        super(entity, ctx);
        this.position = entity.attributes?.current_position as number | undefined
    }

    async createFreeAtHomeEntities(ctx: ConnectionContext): Promise<void> {
        this.fhEntity = await ctx.freeAtHome.createBlindDevice(this.nativeId, this.name);
        
        this.fhEntity.on('relativeValueChanged', async (value: number) => {
            console.log(`Blinds ${this.id} position changed to ${value}`);

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

            ctx.hassConnection.sendMessagePromise(serviceData).catch((err) => {
                console.error("Error sending blind state update for", this.id, ":", err);
            })
        });

        this.fhEntity.on('stopMovement', async () => {
            console.log(`Blinds ${this.id} stop movement command received`);
            console.time(`Update Home Assistant entity ${this.id} stop movement`);
            const serviceData = {
                type: "call_service",
                domain: "cover",
                service: "stop_cover",
                target: {
                    entity_id: this.id
                }
            };

            ctx.hassConnection.sendMessagePromise(serviceData).catch((err) => {
                console.warn("Error sending blind stop command for", this.id, ":", err);
            });
        });
    }

    stateChanged(hassEntity: HassEntity): boolean {
        return this.state !== hassEntity.state || this.position !== hassEntity.attributes?.current_position as number | undefined;
    }

    updateFreeAtHomeEntities(hassEntity: HassEntity): void {
            this.state = hassEntity.state;
            this.position = hassEntity.attributes?.current_position as number | undefined;

            console.log(`Setting BlindActuatorChannel position to ${this.position}`);
            this.fhEntity.position = this.position !== undefined ? this.position : 0;
    }
}