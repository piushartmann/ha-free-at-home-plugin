import { ManagedEntity, EntityContext, supportedTypes } from "../entityHandlers.js";
import { BinarySensorChannel } from '@busch-jaeger/free-at-home';
import * as homeassistant from "../homeassistant.js";

export default class OnOffEntity implements ManagedEntity {
    type: supportedTypes = "on_off";

    async create(ctx: EntityContext, id: string, name?: string): Promise<BinarySensorChannel> {
        return await ctx.freeAtHome.createBinarySensor(id, name || id);
    }

    async update(ctx: EntityContext, fhEntity: BinarySensorChannel, haEntity: homeassistant.Entity): Promise<void> {
        fhEntity.setOnOff(haEntity.state === 'on');
    }

    async setCallbacks(ctx: EntityContext, fhEntity: BinarySensorChannel, haEntity: homeassistant.Entity): Promise<void> {
        // Binary sensors are read-only; no callbacks to set
    }
}