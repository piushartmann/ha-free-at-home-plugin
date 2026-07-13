import Entity from "../entity.js";
import type { ConnectionContext } from "../utils.js";
import type { HassEntity } from 'home-assistant-js-websocket';
import { BinarySensorChannel } from '@busch-jaeger/free-at-home';

export default class BinarySensorEntity extends Entity {
    declare fhEntity: BinarySensorChannel;

    async createFreeAtHomeEntities(ctx: ConnectionContext): Promise<void> {
        this.fhEntity = await ctx.freeAtHome.createBinarySensor(this.nativeId, this.name);
    }

    stateChanged(hassEntity: HassEntity): boolean {
        return this.state !== hassEntity.state;
    }

    updateFreeAtHomeEntities(hassEntity: HassEntity): void {
        this.state = hassEntity.state;

        this.fhEntity.setOnOff(this.state === 'on');
    }
}