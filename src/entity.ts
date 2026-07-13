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
        const BlindActuatorEntity = require('./entityTypes/blindActuator.js').default;
        const AirTemperatureEntity = require('./entityTypes/airTemperature.js').default;
        const BinarySensorEntity = require('./entityTypes/binarySensor.js').default;

        // Determine the entity type from the entity ID prefix
        // Entity IDs follow the format: "domain.entity_name"
        const domain = entity.entity_id.split('.')[0];

        switch (domain) {
            case 'light':
                if (entity.attributes?.brightness == undefined)
                    return new OnOffEntity(entity, ctx);
                else
                    return new DimActuatorEntity(entity, ctx);
            case 'cover':
                return new BlindActuatorEntity(entity, ctx);
            case 'switch':
                return new OnOffEntity(entity, ctx);
            case 'binary_sensor':
                return new BinarySensorEntity(entity, ctx);
            case 'sensor':
                switch (entity.attributes?.device_class) {
                    case 'temperature':
                        return new AirTemperatureEntity(entity, ctx);
                    default:
                        console.warn(`Unsupported sensor device_class: ${entity.attributes?.device_class} for entity ${entity.entity_id}, skipping.`);
                        return undefined;
                }

            default:
                console.warn(`Unsupported entity domain: ${domain} for entity ${entity.entity_id}, skipping.`);
                return undefined;
        }
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
        this.createFreeAtHomeEntities(ctx).catch((err) => {
            console.error(`Error creating Free@Home entity for ${this.id}:`, err);
        }).then(() => {
            console.log(`Free@Home entity created for ${this.id}`);
            this.fhEntity.setAutoKeepAlive(true);
            this.fhEntity.isAutoConfirm = true;
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