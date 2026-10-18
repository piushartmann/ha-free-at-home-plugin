import Entity from "../entity.js";
import type { ConnectionContext } from "../utils.js";
import type { HassEntity } from 'home-assistant-js-websocket';
import type { FreeAtHome } from '@busch-jaeger/free-at-home';

type SmartPlugChannels = Awaited<ReturnType<FreeAtHome['createSmartPlugDevice']>>;

/**
 * A switch that reports its power consumption, mapped to a free@home smart plug.
 * The consumption comes from a separate power sensor on the same Home Assistant device.
 */
export default class SmartPlugEntity extends Entity {
    declare fhEntity: SmartPlugChannels['actuator'];
    private meter?: SmartPlugChannels['sensor'];
    private powerSensorId?: string;
    private power?: number;

    constructor(entity: HassEntity, ctx: ConnectionContext) {
        super(entity, ctx);
        const powerSensor = ctx.powerSensorFor?.(entity.entity_id);
        this.powerSensorId = powerSensor?.entity_id;
        this.power = this.toWatts(powerSensor?.state);
    }

    async createFreeAtHomeEntities(ctx: ConnectionContext): Promise<void> {
        const channels = await ctx.freeAtHome.createSmartPlugDevice(this.nativeId, this.name);
        this.fhEntity = channels.actuator;

        // free@home does not always report the meter channel right after the device was created,
        // and the library never adds channels afterwards. Without it only switching is available.
        if ((channels.sensor as unknown as { channel?: unknown })?.channel !== undefined) {
            this.meter = channels.sensor;
            this.meter.setAutoKeepAlive(true);
            this.meter.isAutoConfirm = true;
            this.sendPower(this.power);
        } else {
            console.warn(`Smart plug ${this.id} has no meter channel, power consumption is not reported.`);
        }

        this.fhEntity.on('isOnChanged', (value: boolean) => {
            console.log(`Smart plug ${this.id} changed to ${value}`);

            const message: any = {
                type: "call_service",
                domain: this.id.split(".")[0],
                service: value ? "turn_on" : "turn_off",
                target: {
                    entity_id: this.id
                }
            };

            ctx.hassConnection.sendMessagePromise(message).catch((err) => {
                console.error("Error sending smart plug state update for", this.id, ":", err);
            });
        });
    }

    relatedIds(): string[] {
        return this.powerSensorId ? [this.powerSensorId] : [];
    }

    updateRelated(hassEntity: HassEntity): void {
        const power = this.toWatts(hassEntity.state);
        if (power === undefined || power === this.power) {
            return;
        }
        this.power = power;
        this.sendPower(power);
    }

    /**
     * Publishes the power consumption, and stops reporting it once the meter channel turned out to be unusable.
     * @param power the consumption in watts, or undefined if it is unknown
     */
    private sendPower(power?: number): void {
        if (this.meter === undefined || power === undefined) {
            return;
        }
        try {
            Promise.resolve(this.meter.setCurrentConsumedPower(power)).catch((err) => this.meterFailed(err));
        } catch (err) {
            this.meterFailed(err);
        }
    }

    private meterFailed(err: unknown): void {
        console.error(`Error sending power consumption to free@home for ${this.id}, disabling the meter:`, err);
        this.meter = undefined;
    }

    stateChanged(hassEntity: HassEntity): boolean {
        return this.state !== hassEntity.state;
    }

    updateFreeAtHomeEntities(hassEntity: HassEntity): void {
        this.state = hassEntity.state;
        this.fhEntity.setOn(this.state === 'on');
    }

    private toWatts(state?: string): number | undefined {
        if (state === undefined) {
            return undefined;
        }
        const value = Number.parseFloat(state);
        return Number.isFinite(value) ? value : undefined;
    }
}
