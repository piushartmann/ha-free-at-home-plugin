import Entity from "../entity.js";
import type { ConnectionContext } from "../utils.js";
import type { HassEntity } from 'home-assistant-js-websocket';
import type { FreeAtHomeDimActuatorChannel } from '@busch-jaeger/free-at-home';

export default class DimActuatorEntity extends Entity {
    declare fhEntity: FreeAtHomeDimActuatorChannel;
    brightness?: number;

    constructor(entity: HassEntity, ctx: ConnectionContext) {
        super(entity, ctx);
        this.brightness = entity.attributes?.brightness as number | undefined
    }

    async createFH(ctx: ConnectionContext): Promise<void> {
        this.fhEntity = await ctx.freeAtHome.createDimActuatorDevice(this.nativeId, this.name);
        this.fhEntity.on('isOnChanged', (value: boolean) => {
            console.log(`Dim light ${this.id} changed to ${value}`);
            console.time(`Update Home Assistant entity ${this.id} state`);

            this.state = value ? "on" : "off";

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
                console.error("Error sending blind state update for", this.id, ":", err);
            });
        });

        this.fhEntity.on('absoluteValueChanged', (value: number) => {
            console.log(`Dim light ${this.id} brightness changed to ${value}`);
            console.time(`Update Home Assistant entity ${this.id} brightness`);

            if (value == 1) {
                value = 0;
            }

            const serviceDomain = this.id.split(".")[0];
            let serviceData: any = {
                type: "call_service",
                domain: serviceDomain,
                service: "turn_on",
                target: {
                    entity_id: this.id
                },
                service_data: {
                    brightness_pct: value,
                }
            };

            ctx.hassConnection.sendMessagePromise(serviceData).catch((err) => {
                console.error("Error sending dim state update for", this.id, ":", err);
            });
        });

        this.fhEntity.setAutoKeepAlive(true);
        this.fhEntity.isAutoConfirm = true;
    }

    async update(hassEntity: HassEntity): Promise<void> {
        const newState = hassEntity.state as "on" | "off" | "unavailable";
        const newBrightness = hassEntity.attributes?.brightness as number | undefined;
        if (this.state !== newState || this.brightness !== newBrightness) {
            console.log(`Entity ${this.id} state changed from ${this.state} to ${newState}, brightness changed from ${this.brightness} to ${newBrightness}`);
            this.state = newState;
            this.brightness = newBrightness;

            this.fhEntity.setOnOff(this.state === 'on');
            if (this.brightness !== undefined) {
                const brightnessPct = Math.max(1, Math.min(100, Math.round(this.brightness / 2.55)));
                this.fhEntity.setValue(brightnessPct);
            }
        }
    }
}