import { FreeAtHome, AddOn } from '@busch-jaeger/free-at-home';
import { Connection } from 'home-assistant-js-websocket';

import * as homeassistant from './homeassistant';

import * as utils from './utils';
import './rpc';
import type { ConnectionContext } from './utils.js';


export const freeAtHome = new FreeAtHome();
freeAtHome.activateSignalHandling();
freeAtHome.setEnableLogging(true);

const metaData = AddOn.readMetaData();
const addOn = new AddOn.AddOn(metaData.id);

let hassConnection: Connection;
let refreshIntervalId: NodeJS.Timeout;
let unsubscribeManagedEntityChanges: () => void;

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
    hassConnection = await homeassistant.connect(hassURL, hassToken);
    connectionContext.hassConnection = hassConnection;
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

  if (unsubscribeManagedEntityChanges) {
    console.log("Unsubscribing from previous managed entity changes");
    unsubscribeManagedEntityChanges();
  }
  console.log("Subscribing to managed entity changes");
  unsubscribeManagedEntityChanges = await homeassistant.subscribeManagedEntityChanges(hassConnection);
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