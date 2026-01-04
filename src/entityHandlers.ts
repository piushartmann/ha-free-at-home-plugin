import {
    FreeAtHome,
    FreeAtHomeSwitchSensorChannel,
    FreeAtHomeBlindActuatorChannel,
    FreeAtHomeDimActuatorChannel,
    FreeAtHomeOnOffChannel
} from '@busch-jaeger/free-at-home';
import { Connection } from 'home-assistant-js-websocket';
import * as homeassistant from './homeassistant';
import * as utils from './utils';

export type ManagedEntity =
    | FreeAtHomeSwitchSensorChannel
    | FreeAtHomeBlindActuatorChannel
    | FreeAtHomeDimActuatorChannel
    | FreeAtHomeOnOffChannel;

export interface EntityContext {
    freeAtHome: FreeAtHome;
    hassConnection: Connection;
    fhManagedEntities: ManagedEntity[];
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
async function createFHEntity(ctx: EntityContext, entity: homeassistant.Entity) {
    console.log(`Creating FreeAtHome entity for ${entity.id} of type ${entity.type}`);

    let device: ManagedEntity | null = null;
    const nativeId = utils.entityIdToNativeId(entity.id);
    console.log(`Native ID for ${entity.id} is ${nativeId}`);
    try {
        switch (entity.type) {
            case 'switch':
                device = (await ctx.freeAtHome.createSwitchingActuatorDevice(nativeId, entity.name || entity.id)) as FreeAtHomeOnOffChannel;
                break;
            case 'light':
                device = (await ctx.freeAtHome.createSwitchingActuatorDevice(nativeId, entity.name || entity.id)) as FreeAtHomeOnOffChannel;
                break;
            case 'dim_light':
                device = (await ctx.freeAtHome.createDimActuatorDevice(nativeId, entity.name || entity.id)) as FreeAtHomeDimActuatorChannel;
                break;
            case 'blinds':
                device = (await ctx.freeAtHome.createBlindDevice(nativeId, entity.name || entity.id)) as FreeAtHomeBlindActuatorChannel;
                break;
            case 'binary_input':
                device = (await ctx.freeAtHome.createSwitchSensorDevice(nativeId, entity.name || entity.id)) as FreeAtHomeSwitchSensorChannel;
                break;
            default:
                throw new Error(`Unsupported entity type: ${entity.type}`);
        }
        device.setAutoKeepAlive(true);
        device.isAutoConfirm = true;
    } catch (err) {
        console.error(`Error creating Free@Home device for entity ${entity.id}:`, err);
        throw err;
    }

    return setDeviceCallbacks(ctx, entity, device);
}

/**
 * This function sets up callbacks for a Free@Home device to update Home Assistant when the device state changes.
 * This function is called once when a Free@Home entity is created.
 * @param ctx The entity context containing Free@Home and Home Assistant connection info.
 * @param entity The Home Assistant entity providing the new state.
 * @param device The Free@Home managed entity to update.
 * @returns The Free@Home managed entity with callbacks set.
 */
function setDeviceCallbacks(ctx: EntityContext, entity: homeassistant.Entity, device: ManagedEntity) {
    try {
        switch (entity.type) {
            case 'switch':
                (device as FreeAtHomeOnOffChannel).on('isOnChanged', (value: boolean) => {
                    console.log(`Switch ${entity.id} changed to ${value}`);
                    console.time(`Update Home Assistant entity ${entity.id} state`);

                    homeassistant
                        .updateLightState(ctx.hassConnection, entity.id, value ? 'on' : 'off')
                        .catch((err) => {
                            console.error(`Error updating Home Assistant entity ${entity.id} state:`, err);
                        })
                        .then(() => {
                            console.timeEnd(`Update Home Assistant entity ${entity.id} state`);
                        });
                });
                break;
            case 'light':
                (device as FreeAtHomeOnOffChannel).on('isOnChanged', (value: boolean) => {
                    console.log(`Light ${entity.id} changed to ${value}`);
                    console.time(`Update Home Assistant entity ${entity.id} state`);

                    homeassistant
                        .updateLightState(ctx.hassConnection, entity.id, value ? 'on' : 'off')
                        .catch((err) => {
                            console.error(`Error updating Home Assistant entity ${entity.id} state:`, err);
                        })
                        .then(() => {
                            console.timeEnd(`Update Home Assistant entity ${entity.id} state`);
                        });
                });
                break;
            case 'dim_light':
                (device as FreeAtHomeDimActuatorChannel).on('isOnChanged', (value: boolean) => {
                    console.log(`Dim light ${entity.id} changed to ${value}`);
                    console.time(`Update Home Assistant entity ${entity.id} state`);

                    homeassistant
                        .updateLightState(ctx.hassConnection, entity.id, value ? 'on' : 'off')
                        .catch((err) => {
                            console.error(`Error updating Home Assistant entity ${entity.id} state:`, err);
                        })
                        .then(() => {
                            console.timeEnd(`Update Home Assistant entity ${entity.id} state`);
                        });
                });
                (device as FreeAtHomeDimActuatorChannel).on('absoluteValueChanged', (value: number) => {
                    console.log(`Dim light ${entity.id} brightness changed to ${value}`);
                    console.time(`Update Home Assistant entity ${entity.id} brightness`);

                    const brightness = Math.max(0, Math.min(255, Math.round(value * 2.55)));
                    homeassistant
                        .updateLightState(ctx.hassConnection, entity.id, 'on', brightness)
                        .catch((err) => {
                            console.error(`Error updating Home Assistant entity ${entity.id} brightness:`, err);
                        })
                        .then(() => {
                            console.timeEnd(`Update Home Assistant entity ${entity.id} brightness`);
                        });
                });
                break;
            case 'blinds':
                (device as FreeAtHomeBlindActuatorChannel).on('relativeValueChanged', (value: number) => {
                    console.log(`Blinds ${entity.id} position changed to ${value}`);
                    console.time(`Update Home Assistant entity ${entity.id} position`);

                    homeassistant
                        .updateBlindState(ctx.hassConnection, entity.id, value)
                        .catch((err) => {
                            console.error(`Error updating Home Assistant entity ${entity.id} position:`, err);
                        })
                        .then(() => {
                            console.timeEnd(`Update Home Assistant entity ${entity.id} position`);
                        });
                });
                break;
            case 'binary_input':
                break;
            default:
                throw new Error(`Unsupported entity type: ${entity.type}`);
        }
    } catch (err) {
        console.error(`Error setting up event listeners for FreeAtHome entity ${entity.id}:`, err);
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
    fhEntity: ManagedEntity,
    entity: homeassistant.Entity
) {
    console.log(`Setting FreeAtHome entity ${entity.id} state to ${entity.state}`);

    try {
        switch (entity.type) {
            case 'switch':
                (fhEntity as FreeAtHomeOnOffChannel).setOn(entity.state === 'on');
                break;
            case 'light':
                (fhEntity as FreeAtHomeOnOffChannel).setOn(entity.state === 'on');
                break;
            case 'dim_light':
                (fhEntity as FreeAtHomeDimActuatorChannel).setOnOff(entity.state === 'on');
                if (entity.brightness !== undefined) {
                    const brightnessPct = Math.max(0, Math.min(100, Math.round(entity.brightness / 2.55)));
                    (fhEntity as FreeAtHomeDimActuatorChannel).setValue(brightnessPct);
                }
                break;
            case 'blinds':
                console.log(`Setting BlindActuatorChannel position to ${entity.position}`);
                (fhEntity as FreeAtHomeBlindActuatorChannel).position = entity.position !== undefined ? entity.position : 0;
                break;
            case 'binary_input':
                // TODO: Handle binary input
                break;
            default:
                console.warn(`Unsupported Free@Home entity type for ${entity.id}`);
        }
    } catch (error) {
        console.error(`Error setting state for Free@Home entity ${entity.id}:`, error);
    }
}
