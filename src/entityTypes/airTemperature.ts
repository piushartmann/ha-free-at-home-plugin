import Entity from "../entity.js";
import type { ConnectionContext } from "../utils.js";
import type { HassEntity } from 'home-assistant-js-websocket';
import { AirTemperatureChannel } from '@busch-jaeger/free-at-home';

export default class AirTemperatureEntity extends Entity {
    declare fhEntity: AirTemperatureChannel;

    async createFreeAtHomeEntities(ctx: ConnectionContext): Promise<void> {
        this.fhEntity = await ctx.freeAtHome.createAirQualityTemperatureDevice(this.nativeId, this.name);
    }

    stateChanged(hassEntity: HassEntity): boolean {
        return this.state !== hassEntity.state;
    }

    updateFreeAtHomeEntities(hassEntity: HassEntity): void {
            this.state = hassEntity.state;
            
            this.fhEntity.setTemperature(this.state);
    }
}