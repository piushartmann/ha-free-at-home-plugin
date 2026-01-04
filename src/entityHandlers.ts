import {
    FreeAtHome,
    FreeAtHomeBlindActuatorChannel,
    FreeAtHomeDimActuatorChannel,
    FreeAtHomeOnOffChannel,
    AirTemperatureChannel,
    BinarySensorChannel
} from '@busch-jaeger/free-at-home';
import { Connection } from 'home-assistant-js-websocket';
import * as homeassistant from './homeassistant';
import * as utils from './utils';

import OnOffEntity from './entityTypes/onOff';
import DimActuatorEntity from './entityTypes/dimActuator';
import BlindActuatorEntity from './entityTypes/blindActuator';
import AirTemperatureEntity from './entityTypes/airTemperature';
import BinarySensorEntity from './entityTypes/binarySensor';

export type supportedTypes = "on_off" | "dim_light" | "blinds" | "air_temperature" | "binary_sensor";

export type supportedEntity =
    | FreeAtHomeBlindActuatorChannel
    | FreeAtHomeDimActuatorChannel
    | FreeAtHomeOnOffChannel
    | AirTemperatureChannel
    | BinarySensorChannel;

export function getManagedEntityForType(type: supportedTypes): ManagedEntity {
    switch (type) {
        case "on_off":
            return new OnOffEntity();
        case "dim_light":
            return new DimActuatorEntity();
        case "blinds":
            return new BlindActuatorEntity();
        case "air_temperature":
            return new AirTemperatureEntity();
        case "binary_sensor":
            return new BinarySensorEntity();
        default:
            throw new Error(`Unsupported entity type: ${type}`);
    }
}

export interface EntityContext {
    freeAtHome: FreeAtHome;
    hassConnection: Connection;
    fhManagedEntities: supportedEntity[];
}

export interface ManagedEntity {
    type: supportedTypes;
    create(ctx: EntityContext, id: string, name: string): Promise<supportedEntity>;
    update(ctx: EntityContext, fhEntity: supportedEntity, haEntity: homeassistant.Entity): Promise<void>;
    setCallbacks(ctx: EntityContext, fhEntity: supportedEntity, haEntity: homeassistant.Entity): void;
}

/**
 * Updates all managed Free@Home entities based on their corresponding Home Assistant entities.
 * This function is called when the label refresh interval elapses or when the configuration changes.
 * @param ctx The entity context containing Free@Home and Home Assistant connection info.
 */
export async function updateAllDeviceStates(ctx: EntityContext) {
    console.log('Updating all device states from Home Assistant');
    for (const entity of homeassistant.managedEntities) {
        await updateDeviceState(ctx, entity);
    }
}

/**
 * Updates the state of a Free@Home entity based on a Home Assistant entity. If the Free@Home entity does not exist, it is created.
 * This function is called when an individual Home Assistant entity state changes or during a full refresh.
 * @param ctx The entity context containing Free@Home and Home Assistant connection info.
 * @param entity The Home Assistant entity providing the new state.
 */
export async function updateDeviceState(ctx: EntityContext, entity: homeassistant.Entity) {
    if (!entity || !entity.id || !entity.type) {
        console.error('Invalid entity received:', entity);
        return;
    }

    if (!entity.state) {
        console.error('Entity missing state:', entity);
        return;
    }

    const { fhManagedEntities } = ctx;
    const fhEntity = fhManagedEntities.find((e) => e.channel.device.nativeId === utils.entityIdToNativeId(entity.id));
    if (!fhEntity) {
        await createFHEntity(ctx, entity)
            .then((newEntity) => {
                if (!newEntity) {
                    console.error('Failed to create Free@Home entity for:', entity);
                    console.log(newEntity);
                    return;
                }
                fhManagedEntities.push(newEntity);
                setFHEntityState(ctx, newEntity, entity);
            })
            .catch((error) => {
                console.error('Error creating Free@Home entity:', error);
            });
    } else {
        setFHEntityState(ctx, fhEntity, entity);
    }
}

/**
 * Creates a new Free@Home entity based on a Home Assistant entity.
 * This function is called when a Home Assistant entity is detected that does not yet have a corresponding Free@Home entity.
 * @param ctx The entity context containing Free@Home and Home Assistant connection info.
 * @param entity The Home Assistant entity to create a Free@Home entity for.
 * @returns The created Free@Home managed entity.
 */
async function createFHEntity(ctx: EntityContext, entity: homeassistant.Entity): Promise<supportedEntity | null> {
    console.log(`Creating FreeAtHome entity for ${entity.id} of type ${entity.type}`);

    let device: supportedEntity | null = null;
    const nativeId = utils.entityIdToNativeId(entity.id);
    console.log(`Native ID for ${entity.id} is ${nativeId}`);
    try {
        const deviceInstance = getManagedEntityForType(entity.type);
        device = await deviceInstance.create(ctx, nativeId, entity.name || entity.id);
        deviceInstance.setCallbacks(ctx, device, entity);

        device.setAutoKeepAlive(true);
        device.isAutoConfirm = true;
    } catch (err) {
        console.error(`Error creating Free@Home device for entity ${entity.id}:`, err);
        throw err;
    }

    return device;
}

/**
 * This function sets the state of a Free@Home entity when receiving updates from Home Assistant.
 * This function is called when a Home Assistant entity state changes or during a full refresh.
 * @param ctx The entity context containing Free@Home and Home Assistant connection info. Unused here but may be useful in future.
 * @param fhEntity The Free@Home managed entity to update.
 * @param entity The Home Assistant entity providing the new state.
 */
function setFHEntityState(
    ctx: EntityContext,
    fhEntity: supportedEntity,
    entity: homeassistant.Entity
) {
    console.log(`Setting FreeAtHome entity ${entity.id} state to ${entity.state}`);

    try {
        const deviceInstance = getManagedEntityForType(entity.type);
        deviceInstance.update(ctx, fhEntity, entity);
    } catch (error) {
        console.error(`Error setting state for Free@Home entity ${entity.id}:`, error);
    }
}
