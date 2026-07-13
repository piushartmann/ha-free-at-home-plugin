import Entity from "../entity.js";
import type { ConnectionContext } from "../utils.js";
import type { HassEntity } from 'home-assistant-js-websocket';
import { BinarySensorChannel } from '@busch-jaeger/free-at-home';

export default class BinarySensorEntity extends Entity {
    declare fhEntity: BinarySensorChannel;

    async createFH(ctx: ConnectionContext): Promise<void> {
        this.fhEntity = await ctx.freeAtHome.createBinarySensor(this.nativeId, this.name);

        this.fhEntity.setAutoKeepAlive(true);
        this.fhEntity.isAutoConfirm = true;
    }

    async update(hassEntity: HassEntity): Promise<void> {
        const newState = hassEntity.state as "on" | "off" | "unavailable";
        if (this.state !== newState) {
            console.log(`Entity ${this.id} state changed from ${this.state} to ${newState}`);
            this.state = newState;
            
            this.fhEntity.setOnOff(this.state === 'on');
        }
    }
}