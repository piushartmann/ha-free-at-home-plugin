import { FreeAtHome, AddOn } from '@busch-jaeger/free-at-home';
import { Connection } from 'home-assistant-js-websocket';
import { updateAddon, setInitialDownloadedVersion } from './updater.js';

import './rpc';
import homeassistant from './homeassistant';
import type { ConnectionContext, Configuration } from './utils.js';
import { Interval } from './utils.js';

const MIN_UPDATE_INTERVAL_SECONDS = 60;
const MAX_TIMER_DELAY_MS = 2_147_483_647;

export const freeAtHome = new FreeAtHome();
freeAtHome.activateSignalHandling();
freeAtHome.setEnableLogging(true);

const metaData = AddOn.readMetaData();
const addOn = new AddOn.AddOn(metaData.id);
setInitialDownloadedVersion(metaData.version)

let refreshInterval: Interval;
let updateInterval: Interval;

const connectionContext: ConnectionContext = {
    freeAtHome,
    hassConnection: undefined as unknown as Connection
};

interface Settings {
    hassURL: string,
    hassToken: string,
    label: string,
    labelRefreshInterval: number,
    lookForUpdates: boolean,
    updateRefreshInterval: number
}

async function getHassConnection(hassURL: string, hassToken: string) {
    if (await homeassistant.testCredentials(hassURL, hassToken)) {
        console.log("Home Assistant credentials set successfully.");
        await homeassistant.connect(hassURL, hassToken);
        return homeassistant.connection;
    }
    throw Error('Home Assistant credentials invalid')
}

async function main(settings: Settings) {

    console.log("Starting main() with parameters:", {
        settings
    });

    if (settings.lookForUpdates) {
        const updateDelay = Math.min(
            Math.max(settings.updateRefreshInterval, MIN_UPDATE_INTERVAL_SECONDS) * 1000,
            MAX_TIMER_DELAY_MS
        );
        updateInterval = new Interval(async () => {
            updateAddon(addOn).catch((error) => {
                console.error("Error during update:", error);
            });
        }, updateDelay)
    }

    try {
        connectionContext.hassConnection = await getHassConnection(settings.hassURL, settings.hassToken)
    }
    catch (err) {
        console.error("Error connecting to Home Assistant:", err);
        updateInterval?.clear();
        return;
    }

    refreshInterval = new Interval(async () => {
        await homeassistant.refreshLabels(connectionContext, settings.label).catch((error) => {
            console.error("Error refreshing labels:", error);
        });
    }, settings.labelRefreshInterval * 1000)

    await homeassistant.subscribeManagedEntityChanges();
}

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception thrown:', err);
});

// Listen for configuration changes
addOn.on("configurationChanged", async (configuration: Configuration) => {
    const settings: Settings = {
        hassURL: configuration.authentication?.items?.["hassUrl"]?.trim() || "",
        hassToken: configuration.authentication?.items?.["hassToken"]?.trim() || "",
        label: configuration.general?.items?.["label"]?.trim() || "busch_jaeger",
        labelRefreshInterval: configuration.general?.items?.["labelRefreshInterval"] as number || 60,
        lookForUpdates: configuration.general?.items?.["lookForUpdates"] as boolean || false,
        updateRefreshInterval: configuration.general?.items?.["updateRefreshInterval"] as number || 86400
    };
    console.log("Configuration changed, updating main()");

    refreshInterval?.clear()
    updateInterval?.clear()

    await homeassistant.destroy().catch((error) => {
        console.error("Error destroying Home Assistant connection:", error);
    });
    connectionContext.hassConnection = undefined as unknown as Connection

    main(settings).catch((error) => {
        console.error("Error in main():", error);
    });
});

addOn.connectToConfiguration();