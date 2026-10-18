import { HassEntity } from 'home-assistant-js-websocket';

import { entityIdToNativeId, ConnectionContext } from './utils.js';

export default abstract class Entity {
    id: string;
    name: string;
    protected nativeId: string;
    protected state: string;
    protected fhEntity: any;

    /**
     * A factory method to create the appropriate Entity subclass based on the Home Assistant entity
     * @param entity the home assistant entity
     * @param ctx the connection context containing the Free@Home and Home Assistant connections.
     * @returns An instance of the appropriate Entity subclass, or undefined if the entity type is unsupported.
     */
    static create(entity: HassEntity, ctx: ConnectionContext): Entity | undefined {
        // Lazy load entity types to avoid circular dependencies
        const OnOffEntity = require('./entityTypes/onOff.js').default;
        const DimActuatorEntity = require('./entityTypes/dimActuator.js').default;
        const ColorLightEntity = require('./entityTypes/colorLight.js').default;
        const BlindActuatorEntity = require('./entityTypes/blindActuator.js').default;
        const AirTemperatureEntity = require('./entityTypes/airTemperature.js').default;
        const BinarySensorEntity = require('./entityTypes/binarySensor.js').default;
        const FanEntity = require('./entityTypes/fan.js').default;
        const ButtonEntity = require('./entityTypes/button.js').default;
        const ClimateEntity = require('./entityTypes/climate.js').default;
        const SmartPlugEntity = require('./entityTypes/smartPlug.js').default;

        // Determine the entity type from the entity ID prefix
        // Entity IDs follow the format: "domain.entity_name"
        const domain = entity.entity_id.split('.')[0];

        switch (domain) {
            case 'light':
                if (Entity.isColorLight(entity))
                    return new ColorLightEntity(entity, ctx);
                else if (Entity.isDimmableLight(entity))
                    return new DimActuatorEntity(entity, ctx);
                else
                    return new OnOffEntity(entity, ctx);
            case 'fan':
                return new FanEntity(entity, ctx);
            case 'button':
            case 'input_button':
            case 'scene':
            case 'script':
            case 'automation':
                return new ButtonEntity(entity, ctx);
            case 'climate':
                return new ClimateEntity(entity, ctx);
            case 'cover':
                return new BlindActuatorEntity(entity, ctx);
            case 'switch':
                // An outlet, or any switch that measures its power consumption, becomes a smart plug
                if (entity.attributes?.device_class === 'outlet' || ctx.powerSensorFor?.(entity.entity_id))
                    return new SmartPlugEntity(entity, ctx);
                else
                    return new OnOffEntity(entity, ctx);
            case 'input_boolean':
                return new OnOffEntity(entity, ctx);
            case 'binary_sensor':
                return new BinarySensorEntity(entity, ctx);
            case 'sensor':
                switch (entity.attributes?.device_class) {
                    case 'temperature':
                        return new AirTemperatureEntity(entity, ctx);
                    default:
                        Entity.warnOnce(entity.entity_id, `Unsupported sensor device_class: ${entity.attributes?.device_class} for entity ${entity.entity_id}, skipping.`);
                        return undefined;
                }

            default:
                Entity.warnOnce(entity.entity_id, `Unsupported entity domain: ${domain} for entity ${entity.entity_id}, skipping.`);
                return undefined;
        }
    }

    /**
     * Color modes that imply brightness support. Home Assistant only reports "brightness" for lights
     * without color support; color lights (e.g. ["color_temp", "xy"]) support brightness implicitly.
     */
    private static readonly DIMMABLE_COLOR_MODES = ['brightness', 'color_temp', 'hs', 'xy', 'rgb', 'rgbw', 'rgbww', 'white'];

    /**
     * Entities already reported as unsupported. The entity list is refreshed periodically, so without
     * this the same warning would be written on every refresh.
     */
    private static readonly warnedEntityIds = new Set<string>();

    /**
     * Writes a warning for an entity only the first time it occurs.
     * @param entityId the entity the warning is about
     * @param message the warning to write
     */
    private static warnOnce(entityId: string, message: string): void {
        if (Entity.warnedEntityIds.has(entityId))
            return;
        Entity.warnedEntityIds.add(entityId);
        console.warn(message);
    }

    /**
     * Color modes that are represented by a free@home RGBW channel (color temperature and/or color).
     */
    private static readonly COLOR_LIGHT_MODES = ['color_temp', 'hs', 'xy', 'rgb', 'rgbw', 'rgbww'];

    /**
     * Determines whether a light supports color temperature or color.
     * @param entity the home assistant light entity
     */
    private static isColorLight(entity: HassEntity): boolean {
        const modes = entity.attributes?.supported_color_modes as string[] | undefined;
        return Array.isArray(modes) && modes.some((mode) => Entity.COLOR_LIGHT_MODES.includes(mode));
    }

    /**
     * Determines whether a light supports brightness. The brightness attribute is absent while a light
     * is off, so supported_color_modes is checked first.
     * @param entity the home assistant light entity
     */
    private static isDimmableLight(entity: HassEntity): boolean {
        const modes = entity.attributes?.supported_color_modes as string[] | undefined;
        if (Array.isArray(modes) && modes.some((mode) => Entity.DIMMABLE_COLOR_MODES.includes(mode)))
            return true;
        return entity.attributes?.brightness != undefined;
    }

    /**
     *
     * @param entity The Homeassistant that this entity represents
     * @param ctx The Connection Context
     */
    constructor(entity: HassEntity, ctx: ConnectionContext) {
        this.id = entity.entity_id;
        this.nativeId = entityIdToNativeId(entity.entity_id);
        this.name = entity.attributes?.friendly_name || entity.entity_id;
        this.state = entity.state;
        this.createFreeAtHomeEntities(ctx).then(() => {
            console.log(`Free@Home entity created for ${this.id} as ${this.constructor.name}`);
            this.fhEntity.setAutoKeepAlive(true);
            this.fhEntity.isAutoConfirm = true;
        }).catch((err) => {
            console.error(`Error creating Free@Home entity for ${this.id}:`, err);
        });
    }

    /**
     * Update is called when entity changes state in Home Assistant.
     * @param hassEntity The new state of the entity in Home Assistant.
     * @returns A promise that resolves when the update is complete.
     */
    update(hassEntity: HassEntity): void {
        if (this.stateChanged(hassEntity)) {
            console.log(`Entity ${this.id} state changed from ${this.state} to ${hassEntity.state}`);
            this.updateFreeAtHomeEntities(hassEntity);
        }
    }

    /**
     * Additional Home Assistant entities this entity reads from, such as the power sensor of a smart plug.
     * @returns The entity IDs to watch besides the entity itself.
     */
    relatedIds(): string[] {
        return [];
    }

    /**
     * Called when one of the entities from relatedIds() changed in Home Assistant.
     * @param hassEntity The new state of the related entity.
     */
    updateRelated(hassEntity: HassEntity): void {
    }

    /**
     * Gets called in the constructor to create the VirtualDevice in Free@Home.
     * @param ctx the connection context containing the Free@Home and Home Assistant connections.
     * @returns A promise that resolves when the Free@Home entity is created.
     */
    protected abstract createFreeAtHomeEntities(ctx: ConnectionContext): Promise<void>;

    /**
     * A method to determine if the state of the Home Assistant entity has changed since the last update, to update the Free@Home entity accordingly.
     * @param hassEntity The new state of the entity in Home Assistant.
     * @returns true if the state has changed, false otherwise.
     */
    protected abstract stateChanged(hassEntity: HassEntity): boolean;

    /**
     * Update the Free@Home entity based on the new state of the Home Assistant entity.
     * @param hassEntity The new state of the entity in Home Assistant.
     */
    protected abstract updateFreeAtHomeEntities(hassEntity: HassEntity): void;
}