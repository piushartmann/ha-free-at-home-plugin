import WebSocket from "ws";
import {
    Auth,
    Connection,
    createConnection,
    createLongLivedTokenAuth,
    subscribeEntities,
    getStates,
    HassEntities,
    HassEntity
} from "home-assistant-js-websocket";

import { supportedTypes } from "./entityHandlers.js";

export interface Entity {
    id: string;
    name?: string;
    type: supportedTypes;
    state: string;
    position?: number;
    brightness?: number;
}

export async function checkCredentials(
    hassURL: string,
    hassToken: string): Promise<boolean> {
    try {
        const connection = await connect(hassURL, hassToken);
        connection.close();
        return true;
    } catch (err) {
        console.error("Error checking Home Assistant credentials:", err);
        return false;
    }
}

var managedEntities: Entity[] = [];
export { managedEntities };

/**
* Connects to the Home Assistant WebSocket API using a long-lived token.
*/
export async function connect(
    hassURL: string,
    hassToken: string,
    hassVerifySsl: boolean = true
): Promise<Connection> {
    if (!hassURL) {
        throw new Error("hassURL is required");
    }

    if (!hassToken) {
        throw new Error("hassToken is required");
    }

    const normalizedUrl = hassURL.replace(/\/$/, "");
    const auth: Auth = createLongLivedTokenAuth(normalizedUrl, hassToken);

    // Make ws available to the library so it can perform the auth handshake itself.
    const wnd = globalThis as any;
    wnd.WebSocket = wnd.WebSocket || WebSocket;

    const connection = await createConnection({
        auth,
        setupRetry: 5
    });

    // Surface connection lifecycle in logs to debug connection drops.
    connection.addEventListener?.("ready", () => {
        console.log("Home Assistant connection ready.");
    });
    connection.addEventListener?.("disconnected", () => {
        console.error("Home Assistant connection lost (disconnected event).");
    });
    connection.addEventListener?.("reconnect-error", (err: any) => {
        console.error("Home Assistant reconnect error:", err);
    });

    return connection;
}

/**
 * @param connection The Home Assistant connection.
 * @param label The label to filter entities by.
 * @return A list of entity IDs that have the specified label.
 */
export async function getEntitiesByLabel(
    connection: Connection,
    label: string
): Promise<HassEntity[]> {
    try {
        let label_result: any = await connection.sendMessagePromise({
            type: "extract_from_target",
            target: {
                label_id: label
            }
        });
        label_result.referenced_entities = label_result.referenced_entities || [];
        // Expand ids to full entities
        let states = await getStates(connection);
        let result_entities = states.filter((entity) =>
            label_result.referenced_entities.includes(entity.entity_id)
        );
        return result_entities;

    } catch (err: any) {
        if (err?.code === "ERR_CONNECTION_LOST") {
            console.error(
                "Lost Home Assistant connection while reading states. Check URL/token/network or allow self-signed certs via HASS_ALLOW_SELF_SIGNED=1."
            );
        }
        throw err;
    }
}

/**
 * Refresh the list of managed entities based on the specified label.
 * This functions is called periodically to update the list of entities in case new entities have been added with the label. (default: 60s)
 * @param connection The Home Assistant connection.
 * @param label The label id to filter entities by.
 */
export async function refreshLabels(connection: Connection, label: string, refreshAllDevices?: () => Promise<void>): Promise<void> {
    const entities: HassEntity[] = await getEntitiesByLabel(connection, label);

    const old_managedEntities = [...managedEntities];
    // Clear the managed entities list
    managedEntities = [];

    // Subscribe to new entities
    for (const entity of entities) {
        // Determine the entity type from the entity ID prefix
        // Entity IDs follow the format: "domain.entity_name"
        const domain = entity.entity_id.split(".")[0];
        let type: supportedTypes = "on_off";

        switch (domain) {
            case "light":
                if (entity.attributes?.brightness !== undefined)
                    type = "dim_light";
                else
                    type = "on_off";
                break;
            case "cover":
                type = "blinds";
                break;
            case "switch":
                type = "on_off";
                break;
            case "binary_sensor":
                type = "binary_sensor";
                break;
            case "sensor":
                switch (entity.attributes?.device_class) {
                    case "temperature":
                        type = "air_temperature";
                        break;
                    default:
                        console.warn(`Unsupported sensor device_class: ${entity.attributes?.device_class} for entity ${entity.entity_id}, skipping.`);
                        continue;
                }
                break;

            default:
                console.warn(`Unsupported entity domain: ${domain} for entity ${entity.entity_id}, skipping.`);
                continue;
        }

        const managesEntity: Entity = {
            id: entity.entity_id,
            name: entity.attributes?.friendly_name,
            type: type,
            state: entity.state,
            brightness: entity.attributes?.brightness as number | undefined,
            position: entity.attributes?.current_position as number | undefined,
        };
        managedEntities.push(managesEntity);
    }

    // If the set of managed entities has changed, refresh all devices
    const oldIds = old_managedEntities.map(e => e.id).sort();
    const newIds = managedEntities.map(e => e.id).sort();
    const setsAreEqual = oldIds.length === newIds.length && oldIds.every((value, index) => value === newIds[index]);
    if (!setsAreEqual && refreshAllDevices) {
        console.log("Managed entities have changed, refreshing all devices.");
        await refreshAllDevices();
    }
}

/**
 * Subscribe to changes in managed entities and run a callback whenever their state or attributes change.
 * @param connection The Home Assistant connection.
 * @param callback Function to call whenever a managed entity's state or attributes change. 
 *                  Receives the updated entity as a parameter.
 * @return An unsubscribe function to stop listening for changes.
 */
export async function subscribeManagedEntityChanges(
    connection: Connection,
    callback: (entity: Entity) => void
): Promise<() => void> {
    // Subscribe to all entity updates
    return subscribeEntities(connection, (hassEntities: HassEntities) => {
        // Check each managed entity for changes
        for (const managedEntity of managedEntities) {
            const hassEntity = hassEntities[managedEntity.id];

            if (hassEntity) {
                // Update the managed entity with the new state
                const newState = hassEntity.state as "on" | "off" | "unavailable";

                // Extract brightness if available
                let brightness = hassEntity.attributes?.brightness as number | undefined;

                if (!managedEntity.type) {
                    console.error("Managed entity has no type, skipping:", managedEntity);
                    continue;
                }

                // Check if any relevant state or attributes have changed
                if (
                    managedEntity.state !== newState ||
                    managedEntity.brightness !== brightness
                ) {
                    console.log(`Entity ${managedEntity.id} state changed from ${managedEntity.state} to ${newState}`);
                    console.log(`Brightness changed from ${managedEntity.brightness} to ${brightness}`);

                    // Update the managed entity
                    managedEntity.state = newState;
                    managedEntity.brightness = brightness;

                    console.log(`Calling callback for entity ${managedEntity.id}`);
                    callback(managedEntity);
                }
            }
        }
    });
}