import Entity from "../entity.js";
import type { ConnectionContext } from "../utils.js";
import type { HassEntity } from 'home-assistant-js-websocket';
import type { FreeAtHome } from '@busch-jaeger/free-at-home';

type FreeAtHomeRGBChannel = Awaited<ReturnType<FreeAtHome['createRGBWDevice']>>;

const COLOR_MODES = ['hs', 'xy', 'rgb', 'rgbw', 'rgbww'];
const DEFAULT_MIN_KELVIN = 2000;
const DEFAULT_MAX_KELVIN = 6535;

/**
 * A light with color temperature and/or color support, mapped to a free@home RGBW channel.
 * free@home reports color temperature in percent (0 = warmest, 100 = coldest) and HSV as values between 0 and 1.
 */
export default class ColorLightEntity extends Entity {
    declare fhEntity: FreeAtHomeRGBChannel;
    brightness?: number;
    colorMode?: string;
    colorTempKelvin?: number;
    hsColor?: [number, number];
    private minKelvin = DEFAULT_MIN_KELVIN;
    private maxKelvin = DEFAULT_MAX_KELVIN;
    private supportsColor = false;

    constructor(entity: HassEntity, ctx: ConnectionContext) {
        super(entity, ctx);
        this.readAttributes(entity);
    }

    async createFreeAtHomeEntities(ctx: ConnectionContext): Promise<void> {
        // Separate native ID, so lights previously created as switch or dimmer do not clash with the new device type
        this.fhEntity = await ctx.freeAtHome.createRGBWDevice(`${this.nativeId}rgbw`, this.name);

        // The display name passed to createRGBWDevice is not always applied, so it is set explicitly
        this.report('deviceName', () => this.fhEntity.setDeviceName(this.name));

        this.fhEntity.on('isOnChanged', (value: boolean) => {
            console.log(`Color light ${this.id} changed to ${value}`);
            this.state = value ? "on" : "off";
            this.callService(ctx, value ? "turn_on" : "turn_off");
        });

        this.fhEntity.on('brightnessChanged', (value: number) => {
            console.log(`Color light ${this.id} brightness changed to ${value}`);
            if (value <= 0)
                this.callService(ctx, "turn_off");
            else
                this.callService(ctx, "turn_on", { brightness_pct: value });
        });

        this.fhEntity.on('colorTemperatureChanged', (value: number) => {
            const kelvin = this.percentToKelvin(value);
            console.log(`Color light ${this.id} color temperature changed to ${value}% (${kelvin}K)`);
            this.callService(ctx, "turn_on", { color_temp_kelvin: kelvin });
        });

        this.fhEntity.on('hsvChanged', (h: number, s: number, v: number) => {
            console.log(`Color light ${this.id} hsv changed to ${h}, ${s}, ${v}`);

            const brightnessPct = Math.round(v * 100);
            if (brightnessPct <= 0) {
                this.callService(ctx, "turn_off");
                return;
            }

            // The value component carries the brightness, so it is applied even for lights without color support
            const serviceData: any = { brightness_pct: brightnessPct };
            if (this.supportsColor)
                serviceData.hs_color = [Math.round(h * 360), Math.round(s * 100)];
            else
                console.warn(`Color light ${this.id} does not support color, applying brightness only.`);

            this.callService(ctx, "turn_on", serviceData);
        });
    }

    stateChanged(hassEntity: HassEntity): boolean {
        const attributes = hassEntity.attributes ?? {};
        return this.state !== hassEntity.state
            || this.brightness !== (attributes.brightness ?? undefined)
            || this.colorMode !== (attributes.color_mode ?? undefined)
            || this.colorTempKelvin !== (attributes.color_temp_kelvin ?? undefined)
            || JSON.stringify(this.hsColor) !== JSON.stringify(attributes.hs_color ?? undefined);
    }

    updateFreeAtHomeEntities(hassEntity: HassEntity): void {
        this.state = hassEntity.state;
        this.readAttributes(hassEntity);

        this.report('on', () => this.fhEntity.setOn(this.state === 'on'));
        if (this.state !== 'on')
            return;

        const brightnessPct = this.toBrightnessPct(this.brightness);

        if (this.colorMode === 'color_temp' && this.colorTempKelvin !== undefined) {
            this.report('colorMode', () => this.fhEntity.setColorMode('ct'));
            this.report('colorTemperature', () => this.fhEntity.setColorTemperature(this.kelvinToPercent(this.colorTempKelvin!)));
            this.report('brightness', () => this.fhEntity.setBrightness(brightnessPct));
        } else if (this.colorMode !== undefined && COLOR_MODES.includes(this.colorMode) && this.hsColor !== undefined) {
            this.report('colorMode', () => this.fhEntity.setColorMode('hsv'));
            // setHSV also publishes the brightness, so no separate brightness update is needed here
            this.report('hsv', () => this.fhEntity.setHSV(this.hsColor![0] / 360, this.hsColor![1] / 100, brightnessPct / 100));
        } else {
            this.report('colorMode', () => this.fhEntity.setColorMode('dim'));
            this.report('brightness', () => this.fhEntity.setBrightness(brightnessPct));
        }
    }

    /**
     * Runs a free@home update and logs failures instead of letting them reject unhandled, so a datapoint
     * missing on the channel does not stop the remaining updates.
     */
    private report(what: string, update: () => Promise<void> | void): void {
        try {
            Promise.resolve(update()).catch((err) => {
                console.error(`Error sending ${what} to free@home for ${this.id}:`, err);
            });
        } catch (err) {
            console.error(`Error sending ${what} to free@home for ${this.id}:`, err);
        }
    }

    private readAttributes(entity: HassEntity): void {
        const attributes = entity.attributes ?? {};
        this.brightness = (attributes.brightness ?? undefined) as number | undefined;
        this.colorMode = (attributes.color_mode ?? undefined) as string | undefined;
        this.colorTempKelvin = (attributes.color_temp_kelvin ?? undefined) as number | undefined;
        this.hsColor = (attributes.hs_color ?? undefined) as [number, number] | undefined;
        this.minKelvin = (attributes.min_color_temp_kelvin as number | undefined) ?? DEFAULT_MIN_KELVIN;
        this.maxKelvin = (attributes.max_color_temp_kelvin as number | undefined) ?? DEFAULT_MAX_KELVIN;
        const modes = attributes.supported_color_modes as string[] | undefined;
        this.supportsColor = Array.isArray(modes) && modes.some((mode) => COLOR_MODES.includes(mode));
    }

    private toBrightnessPct(brightness?: number): number {
        if (brightness === undefined)
            return 100;
        return Math.max(1, Math.min(100, Math.round(brightness / 2.55)));
    }

    private percentToKelvin(percent: number): number {
        const clamped = Math.max(0, Math.min(100, percent));
        return Math.round(this.minKelvin + (this.maxKelvin - this.minKelvin) * clamped / 100);
    }

    private kelvinToPercent(kelvin: number): number {
        if (this.maxKelvin <= this.minKelvin)
            return 0;
        const percent = (kelvin - this.minKelvin) / (this.maxKelvin - this.minKelvin) * 100;
        return Math.max(0, Math.min(100, Math.round(percent)));
    }

    private callService(ctx: ConnectionContext, service: string, serviceData?: any): void {
        const message: any = {
            type: "call_service",
            domain: this.id.split(".")[0],
            service: service,
            target: {
                entity_id: this.id
            }
        };
        if (serviceData)
            message.service_data = serviceData;

        ctx.hassConnection.sendMessagePromise(message).catch((err) => {
            console.error("Error sending color light update for", this.id, ":", err);
        });
    }
}
