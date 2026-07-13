import { RPC } from "@busch-jaeger/free-at-home";
import homeassistant from "./homeassistant.js";
import { BasicParameter } from '@busch-jaeger/free-at-home/lib/addon/models/BasicParameter';
import { Parameter } from '@busch-jaeger/free-at-home/lib/addon/models/Parameter';

const hassConnectedRpc = new RPC.RpcWebsocket("de.piushartmann.homeassistant");

// Register RPC method to get parameter configuration
hassConnectedRpc.addMethod("getParameterConfig", async (parameters: any): Promise<Parameter> => {
    switch (parameters?.type) {
        case "connectionState":
            return await connectionState(parameters);
        default:
            throw new Error(`Unknown RPC parameter type: ${parameters?.type}`);
    }
});

async function connectionState(parameters: any): Promise<Parameter> {
    const hassToken = parameters["hassToken"].trim() as string || "";
    const hassUrl = parameters["hassUrl"].trim() as string || "";

    const isValid = await homeassistant.testCredentials(hassUrl, hassToken);
    console.log(`Home Assistant credentials valid: ${isValid}`);

    return {
        "name": "State: Connected",
        "name@de": "Status: Verbunden",
        "type": "text",
        "visible": isValid,
        "rpcCallOn": "everyChange",
        "rpc": "getParameterConfig"
    } as BasicParameter;
}
