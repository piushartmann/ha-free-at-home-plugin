import { FreeAtHome } from '@busch-jaeger/free-at-home';
import { Connection } from 'home-assistant-js-websocket';
import { Notification } from '@busch-jaeger/free-at-home/lib/fhapi';
import { AddOn } from '@busch-jaeger/free-at-home';
import { freeAtHome } from './main.js';

export interface ConnectionContext {
    freeAtHome: FreeAtHome;
    hassConnection: Connection;
}

export async function postNotification(
    title: string,
    message: string,
    type: ("styleInfo" | "styleWarn" | "styleAlert" | "modal" | "fixed" | "hideIfAnswered")[] | undefined = ["styleInfo"]
): Promise<Record<string, any>> {
    const notification: Notification = {
        formatVersion: 1,
        topicId: "de.piushartmann.homeassistant",
        timeoutMinutes: 0,
        retention: 10,
        displayHints: type,
        terminals: ["push-notification", "ui"],
        content: {
            utf8: {
                de: {
                    title: title,
                    body: message,
                }
            }
        }
    };

    return await freeAtHome.postNotification(notification);
}

/**
 * Converts a Home Assistant entity ID to a Free@Home native ID by removing non-alphanumeric characters.
 * @param entityId The Home Assistant entity ID.
 * @returns The corresponding Free@Home native ID.
 */
export function entityIdToNativeId(entityId: string): string {
    return entityId.replace(/[^a-zA-Z0-9]/g, "");
}

/**
 * Configuration interface for this Home Assistant Addon.
 */
export interface Configuration extends AddOn.Configuration {
    authentication: {
        items: {
            hassUrl: string;
            hassToken: string;
            hassConnectedState: string;
        }
    };
    general: {
        items: {
            label: string;
            labelRefreshInterval: number;
        }
    };
}