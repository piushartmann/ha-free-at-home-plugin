import Entity from "../entity.js";
import type { ConnectionContext } from "../utils.js";
import type { HassEntity } from 'home-assistant-js-websocket';
import type { FreeAtHome } from '@busch-jaeger/free-at-home';

type FreeAtHomeRoomTemperatureControllerChannel = Awaited<ReturnType<FreeAtHome['createRoomTemperatureControllerDevice']>>;

const DEFAULT_SET_POINT = 21;

/**
 * A Home Assistant climate entity, mapped to a free@home room temperature controller.
 * free@home only reports set point changes back, so the operating mode is controlled from Home Assistant.
 */
export default class ClimateEntity extends Entity {
    declare fhEntity: FreeAtHomeRoomTemperatureControllerChannel;
    currentTemperature?: number;
    targetTemperature?: number;

    constructor(entity: HassEntity, ctx: ConnectionContext) {
        super(entity, ctx);
        this.readAttributes(entity);
    }

    async createFreeAtHomeEntities(ctx: ConnectionContext): Promise<void> {
        this.fhEntity = await ctx.freeAtHome.createRoomTemperatureControllerDevice(this.nativeId, this.name);

        await this.fhEntity.start(this.targetTemperature ?? DEFAULT_SET_POINT);

        this.fhEntity.on('onSetPointTemperatureChanged', (value: number) => {
            console.log(`Climate ${this.id} set point changed to ${value}`);
            this.targetTemperature = value;

            const message: any = {
                type: "call_service",
                domain: "climate",
                service: "set_temperature",
                target: {
                    entity_id: this.id
                },
                service_data: {
                    temperature: value
                }
            };

            ctx.hassConnection.sendMessagePromise(message).catch((err) => {
                console.error("Error sending climate set point update for", this.id, ":", err);
            });
        });
    }

    stateChanged(hassEntity: HassEntity): boolean {
        const attributes = hassEntity.attributes ?? {};
        return this.state !== hassEntity.state
            || this.currentTemperature !== (attributes.current_temperature ?? undefined)
            || this.targetTemperature !== (attributes.temperature ?? undefined);
    }

    updateFreeAtHomeEntities(hassEntity: HassEntity): void {
        this.state = hassEntity.state;
        this.readAttributes(hassEntity);

        if (this.currentTemperature !== undefined)
            this.fhEntity.sendMeasuredTemperature(this.currentTemperature);

        if (this.targetTemperature !== undefined)
            this.fhEntity.sendSetPointTemperature(this.targetTemperature);
    }

    private readAttributes(entity: HassEntity): void {
        const attributes = entity.attributes ?? {};
        this.currentTemperature = (attributes.current_temperature ?? undefined) as number | undefined;
        this.targetTemperature = (attributes.temperature ?? undefined) as number | undefined;
    }
}
