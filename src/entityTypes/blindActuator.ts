import { ManagedEntity, EntityContext, supportedEntity, supportedTypes } from "../entityHandlers.js";
import { FreeAtHomeBlindActuatorChannel } from '@busch-jaeger/free-at-home';
import * as homeassistant from "../homeassistant.js";

export default class BlindActuatorEntity implements ManagedEntity {
    type: supportedTypes = "blinds";

    async create(ctx: EntityContext, id: string, name?: string): Promise<FreeAtHomeBlindActuatorChannel> {
        return await ctx.freeAtHome.createBlindDevice(id, name || id);
    }

    async update(ctx: EntityContext, fhEntity: FreeAtHomeBlindActuatorChannel, haEntity: homeassistant.Entity): Promise<void> {
        console.log(`Setting BlindActuatorChannel position to ${haEntity.position}`);
        fhEntity.position = haEntity.position !== undefined ? haEntity.position : 0;
    }

    async setCallbacks(ctx: EntityContext, fhEntity: FreeAtHomeBlindActuatorChannel, haEntity: homeassistant.Entity): Promise<void> {
        fhEntity.on('relativeValueChanged', async (value: number) => {
            console.log(`Blinds ${haEntity.id} position changed to ${value}`);
            console.time(`Update Home Assistant entity ${haEntity.id} position`);

            const serviceData = {
                type: "call_service",
                domain: "cover",
                service: "set_cover_position",
                target: {
                    entity_id: haEntity.id
                },
                service_data: {
                    position: value
                }
            };
            
            ctx.hassConnection.sendMessagePromise(serviceData).catch((err) => {
                console.error("Error sending blind state update for", haEntity.id, ":", err);
            })
        });
    }
}