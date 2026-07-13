import Entity from "../entity.js";
import type { ConnectionContext } from "../utils.js";
import type { HassEntity } from 'home-assistant-js-websocket';
import type { FreeAtHomeOnOffChannel } from '@busch-jaeger/free-at-home';

export default class OnOffEntity extends Entity {
    declare fhEntity: FreeAtHomeOnOffChannel;

    async createFH(ctx: ConnectionContext): Promise<void> {
        this.fhEntity = await ctx.freeAtHome.createSwitchingActuatorDevice(this.nativeId, this.name);

        this.fhEntity.on('isOnChanged', (value: boolean) => {
            console.log(`On/Off ${this.id} changed to ${value}`);
            console.time(`Update Home Assistant entity ${this.id} state`);

            const serviceDomain = this.id.split(".")[0];
            const service = value ? "turn_on" : "turn_off";
            let serviceData: any = {
                type: "call_service",
                domain: serviceDomain,
                service: service,
                target: {
                    entity_id: this.id
                }
            };

            ctx.hassConnection.sendMessagePromise(serviceData).catch((err) => {
                console.error("Error sending state update for", this.id, ":", err);
            });
        });

        this.fhEntity.setAutoKeepAlive(true);
        this.fhEntity.isAutoConfirm = true;
    }

    async update(hassEntity: HassEntity): Promise<void> {
        const newState = hassEntity.state as "on" | "off" | "unavailable";
        if (this.state !== newState) {
            console.log(`Entity ${this.id} state changed from ${this.state} to ${newState}`);
            this.state = newState;
            this.fhEntity.setOn(this.state === 'on');
        }
    }
}