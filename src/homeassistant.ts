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

class HomeAssistant {

    connection: Connection = undefined as unknown as Connection;
    private managedEntities: Entity[] = [];
    private unsubscribeManagedEntityChanges: (() => void) | undefined = undefined;

    async testCredentials(url: string, token: string): Promise<boolean> {
        try {
            (await this.getConnection(url, token)).close();
            return true;
        } catch (err) {
            console.error("Error checking Home Assistant credentials:", err);
            return false;
        }
    }

    private async getConnection(url: string, token: string): Promise<Connection> {
        if (!url) {
            throw new Error("hassURL is required");
        }

        if (!token) {
            throw new Error("hassToken is required");
        }

        const normalizedUrl = url.replace(/\/$/, "");
        const auth: Auth = createLongLivedTokenAuth(normalizedUrl, token);

        const wnd = globalThis as any;
        wnd.WebSocket = wnd.WebSocket || WebSocket;

        const connection = await createConnection({
            auth,
            setupRetry: 5,
        });
        return connection;
    }

    async connect(url: string, token: string): Promise<void> {
        const connection = await this.getConnection(url, token).catch((err) => {
            console.error("Error connecting to Home Assistant:", err);
            throw err;
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

        this.connection = connection;
    }

    /**
     * @param connection The Home Assistant connection.
     * @param label The label to filter entities by.
     * @return A list of entity IDs that have the specified label.
     */
    private async getEntitiesByLabel(label: string): Promise<HassEntity[]> {
        if (!this.connection) {
            throw new Error("Home Assistant connection is not established.");
        }
        try {
            let label_result: any = await this.connection.sendMessagePromise({
                type: "extract_from_target",
                target: {
                    label_id: label
                }
            });
            label_result.referenced_entities = label_result.referenced_entities || [];
            // Expand ids to full entities
            let states = await getStates(this.connection);
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
    async refreshLabels(ctx: ConnectionContext, label: string): Promise<void> {
        const entities: HassEntity[] = await this.getEntitiesByLabel(label);

        // Subscribe to new entities
        for (const entity of entities) {
            if (this.managedEntities.some((e) => e.id === entity.entity_id)) {
                continue;
            }
            const managedEntity = Entity.create(entity, ctx);
            if (!managedEntity) {
                continue;
            }
            this.managedEntities.push(managedEntity);
        }

        // Update existing entities (remove if no longer exists)
        for (const managedEntity of this.managedEntities) {
            const hassEntity = entities.find((e) => e.entity_id === managedEntity.id);
            if (!hassEntity) {
                console.warn(`Managed entity ${managedEntity.id} no longer exists in Home Assistant, removing from managed list.`);
                this.managedEntities = this.managedEntities.filter((e) => e.id !== managedEntity.id);
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
    async subscribeManagedEntityChanges(): Promise<void> {
        if (!this.connection) {
            throw new Error("Home Assistant connection is not established.");
        }

        if (this.unsubscribeManagedEntityChanges) {
            console.log("Unsubscribing from previous managed entity changes");
            this.unsubscribeManagedEntityChanges();
        }
        console.log("Subscribing to managed entity changes");

        // Subscribe to all entity updates
        this.unsubscribeManagedEntityChanges = subscribeEntities(this.connection, (hassEntities: HassEntities) => {
            // Check each managed entity for changes
            for (const managedEntity of this.managedEntities) {
                const hassEntity = hassEntities[managedEntity.id];

                if (hassEntity) {
                    managedEntity.update(hassEntity).catch((err) => {
                        console.error(`Error updating Home Assistant entity for ${managedEntity.id}:`, err);
                    });
                }
            }
        });
    }
}

export default new HomeAssistant();