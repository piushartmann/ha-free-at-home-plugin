import { HassEntity } from 'home-assistant-js-websocket';

import { entityIdToNativeId, ConnectionContext } from './utils.js';
import { Channel } from '@busch-jaeger/free-at-home/lib/fhapi/models/Channel.js';

export default abstract class Entity {
    id: string;
    name: string;
    protected nativeId: string;
    protected state: string;
    protected fhEntity: any;

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

    constructor(entity: HassEntity, ctx: ConnectionContext) {
        this.id = entity.entity_id;
        this.nativeId = entityIdToNativeId(entity.entity_id);
        this.name = entity.attributes?.friendly_name || entity.entity_id;
        this.state = entity.state;
        this.createFH(ctx).catch((err) => {
            console.error(`Error creating Free@Home entity for ${this.id}:`, err);
        });
    }

    protected abstract createFH(ctx: ConnectionContext): Promise<void>;

    abstract update(hassEntity: HassEntity): Promise<void>;
}