import { ManagedEntity, EntityContext, supportedTypes } from "../entityHandlers.js";
import { FreeAtHomeOnOffChannel } from '@busch-jaeger/free-at-home';
import * as homeassistant from "../homeassistant.js";

export default class OnOffEntity implements ManagedEntity {
    type: supportedTypes = "on_off";

    async create(ctx: EntityContext, id: string, name?: string): Promise<FreeAtHomeOnOffChannel> {
        return await ctx.freeAtHome.createSwitchingActuatorDevice(id, name || id);
    }

    async update(ctx: EntityContext, fhEntity: FreeAtHomeOnOffChannel, haEntity: homeassistant.Entity): Promise<void> {
        fhEntity.setOn(haEntity.state === 'on');
    }

    async setCallbacks(ctx: EntityContext, fhEntity: FreeAtHomeOnOffChannel, haEntity: homeassistant.Entity): Promise<void> {
        fhEntity.on('isOnChanged', (value: boolean) => {
            console.log(`On/Off ${haEntity.id} changed to ${value}`);
            console.time(`Update Home Assistant entity ${haEntity.id} state`);

            const serviceDomain = haEntity.id.split(".")[0];
            const service = value ? "turn_on" : "turn_off";
            let serviceData: any = {
                type: "call_service",
                domain: serviceDomain,
                service: service,
                target: {
                    entity_id: haEntity.id
                }
            };

            ctx.hassConnection.sendMessagePromise(serviceData).catch((err) => {
                console.error("Error sending blind state update for", haEntity.id, ":", err);
            });
        });
    }
}