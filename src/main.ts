import { FreeAtHome, AddOn } from '@busch-jaeger/free-at-home';
import { Connection } from 'home-assistant-js-websocket';

import homeassistant from './homeassistant';

import * as utils from './utils';
import './rpc';
import type { ConnectionContext } from './utils.js';


export const freeAtHome = new FreeAtHome();
freeAtHome.activateSignalHandling();
freeAtHome.setEnableLogging(true);

const metaData = AddOn.readMetaData();
const addOn = new AddOn.AddOn(metaData.id);

let refreshIntervalId: NodeJS.Timeout;

const connectionContext: ConnectionContext = {
    freeAtHome,
    hassConnection: undefined as unknown as Connection
};

async function main(hassURL: string, hassToken: string, label: string = "bush_jaeger", labelRefreshInterval: number = 60) {
    console.log("Starting main() with parameters:", {
        hassURL,
        hassToken: hassToken ? "****" : "",
        label,
        labelRefreshInterval
    });

    if (refreshIntervalId) {
        clearInterval(refreshIntervalId);
    }

    try {
        if (await homeassistant.testCredentials(hassURL, hassToken)) {
            console.log("Home Assistant credentials set successfully.");
            await homeassistant.connect(hassURL, hassToken);
            connectionContext.hassConnection = homeassistant.connection;
        }
    }
    catch (err) {
        console.error("Error connecting to Home Assistant:", err);
        return;
    }

    await homeassistant.refreshLabels(connectionContext, label).catch((error) => {
        console.error("Error refreshing labels:", error);
    });

    refreshIntervalId = setInterval(async () => {
        await homeassistant.refreshLabels(connectionContext, label).catch((error) => {
            console.error("Error refreshing labels:", error);
        });
    }, labelRefreshInterval * 1000);

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
addOn.on("configurationChanged", (configuration: utils.Configuration) => {
    const hassUrl = configuration.authentication?.items?.["hassUrl"].trim() as string || "";
    const hassToken = configuration.authentication?.items?.["hassToken"].trim() as string || "";
    const label = configuration.general?.items?.["label"].trim() as string || "virtual_bush_jaeger";
    const labelRefreshInterval = configuration.general?.items?.["labelRefreshInterval"] as number || 60;
    console.log("Configuration changed, updating main()");

    main(hassUrl, hassToken, label, labelRefreshInterval).catch((error) => {
        console.error("Error in main():", error);
    });
});

addOn.connectToConfiguration();