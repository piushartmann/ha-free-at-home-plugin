import { ManagedEntity, EntityContext, supportedTypes } from "../entityHandlers.js";
import { FreeAtHomeDimActuatorChannel } from '@busch-jaeger/free-at-home';
import * as homeassistant from "../homeassistant.js";

export default class DimActuatorEntity implements ManagedEntity {
    type: supportedTypes = "dim_light";

    async create(ctx: EntityContext, id: string, name?: string): Promise<FreeAtHomeDimActuatorChannel> {
        return await ctx.freeAtHome.createDimActuatorDevice(id, name || id);
    }

    async setCallbacks(ctx: EntityContext, fhEntity: FreeAtHomeDimActuatorChannel, haEntity: homeassistant.Entity): Promise<void> {
        fhEntity.on('isOnChanged', (value: boolean) => {
            console.log(`Dim light ${haEntity.id} changed to ${value}`);
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

        fhEntity.on('absoluteValueChanged', (value: number) => {
            console.log(`Dim light ${haEntity.id} brightness changed to ${value}`);
            console.time(`Update Home Assistant entity ${haEntity.id} brightness`);

            if (value == 1){
                value = 0;
            }

            const serviceDomain = haEntity.id.split(".")[0];
            let serviceData: any = {
                type: "call_service",
                domain: serviceDomain,
                service: "turn_on",
                target: {
                    entity_id: haEntity.id
                },
                service_data: {
                    brightness_pct: value,
                }
            };

            ctx.hassConnection.sendMessagePromise(serviceData).catch((err) => {
                console.error("Error sending blind state update for", haEntity.id, ":", err);
            });
        });
    }

    async update(ctx: EntityContext, fhEntity: FreeAtHomeDimActuatorChannel, haEntity: homeassistant.Entity): Promise<void> {
        fhEntity.setOnOff(haEntity.state === 'on');
        if (haEntity.brightness !== undefined) {
            const brightnessPct = Math.max(0, Math.min(100, Math.round(haEntity.brightness / 2.55)));
            fhEntity.setValue(brightnessPct);
        }
    }
}