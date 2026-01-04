import { ManagedEntity, EntityContext, supportedTypes } from "../entityHandlers.js";
import { AirTemperatureChannel } from '@busch-jaeger/free-at-home';
import * as homeassistant from "../homeassistant.js";

export default class OnOffEntity implements ManagedEntity {
    type: supportedTypes = "air_temperature";

    async create(ctx: EntityContext, id: string, name?: string): Promise<AirTemperatureChannel> {
        return await ctx.freeAtHome.createAirQualityTemperatureDevice(id, name || id);
    }

    async update(ctx: EntityContext, fhEntity: AirTemperatureChannel, haEntity: homeassistant.Entity): Promise<void> {
        fhEntity.setTemperature(haEntity.state);
    }

    async setCallbacks(ctx: EntityContext, fhEntity: AirTemperatureChannel, haEntity: homeassistant.Entity): Promise<void> {
        // Air temperature sensors are read-only; no callbacks to set
    }
}