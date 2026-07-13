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

import Entity from "./entity.js";
import { ConnectionContext } from "./utils.js";

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
    hassToken: string
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
        setupRetry: 5,
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
        let result_entities = states.filter((entity: HassEntity) =>
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
 * @param ctx The Home Assistant connection.
 * @param label The label id to filter entities by.
 */
export async function refreshLabels(ctx: ConnectionContext, label: string): Promise<void> {
    const entities: HassEntity[] = await getEntitiesByLabel(ctx.hassConnection, label);

    // Subscribe to new entities
    for (const entity of entities) {
        if (managedEntities.some((e) => e.id === entity.entity_id)) {
            continue;
        }
        const managedEntity = Entity.create(entity, ctx);
        if (!managedEntity) {
            continue;
        }
        managedEntities.push(managedEntity);
    }

    // Update existing entities (remove if no longer exists)
    for (const managedEntity of managedEntities) {
        const hassEntity = entities.find((e) => e.entity_id === managedEntity.id);
        if (!hassEntity) {
            console.warn(`Managed entity ${managedEntity.id} no longer exists in Home Assistant, removing from managed list.`);
            managedEntities = managedEntities.filter((e) => e.id !== managedEntity.id);
            continue;
        }
        managedEntity.update(hassEntity).catch((err) => {
            console.error(`Error updating Home Assistant entity for ${managedEntity.id}:`, err);
        });
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
    connection: Connection
): Promise<() => void> {
    // Subscribe to all entity updates
    return subscribeEntities(connection, (hassEntities: HassEntities) => {
        // Check each managed entity for changes
        for (const managedEntity of managedEntities) {
            const hassEntity = hassEntities[managedEntity.id];

            if (hassEntity) {
                managedEntity.update(hassEntity).catch((err) => {
                    console.error(`Error updating Home Assistant entity for ${managedEntity.id}:`, err);
                });
            }
        }
    });
}