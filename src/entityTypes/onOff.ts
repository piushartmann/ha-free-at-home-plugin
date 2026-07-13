import Entity from "../entity.js";
import type { ConnectionContext } from "../utils.js";
import type { HassEntity } from 'home-assistant-js-websocket';
import type { FreeAtHomeOnOffChannel } from '@busch-jaeger/free-at-home';

export default class OnOffEntity extends Entity {
    declare fhEntity: FreeAtHomeOnOffChannel;

    async createFreeAtHomeEntities(ctx: ConnectionContext): Promise<void> {
        this.fhEntity = await ctx.freeAtHome.createSwitchingActuatorDevice(this.nativeId, this.name);

        this.fhEntity.on('isOnChanged', (value: boolean) => {
            console.log(`On/Off ${this.id} changed to ${value}`);

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
    }

    stateChanged(hassEntity: HassEntity): boolean {
        return this.state !== hassEntity.state;
    }

    updateFreeAtHomeEntities(hassEntity: HassEntity): void {
        this.state = hassEntity.state;
        this.fhEntity.setOn(this.state === 'on');
    }
}