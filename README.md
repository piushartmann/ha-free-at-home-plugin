Home Assistant Addon for Busch-Jaeger Free@Home
===

This Addon for the Busch Jaeger SysAP integrates Home Assistant Entities into the Free@Home Ecosystem. So you can control your Home Assistant Devices with the Free@Home Smart home system and their Smart Light Switches.

## Supported Home Assistant Domains

- switch
- light (on/off and dimmable but no color control)
- binary_sensor
- sensor (temperature only)
- cover (not fully tested yet)

## How to use

### Prerequisites
- A Home Assistant instance running and accessible.
- A Busch-Jaeger SysAP 2.0 with Free@Home firmware version 2.4.0 or higher.

### Install the Addon on your SysAP
1. Download the latest release from the [releases](https://github.com/piushartmann/ha-free-at-home-plugin/releases) page.
2. Upload the downloaded file to your Busch-Jaeger SysAP by navigating to Settings and clicking the 'Upload' button in the Addons section.

### Configuration
The Addon requires the following configuration parameters:
- `Home Assistant URL`: This is the URL where your Home Assistant instance is accessible. Note that you cant use mDNS urls like `http://homeassistant.local:8123`, you have to use the direct IP address or a resolvable domain name.
- `Long-Lived Access Token`: To generate a Long-Lived Access Token, navigate to your Home Assistant [User Profile](https://my.home-assistant.io/redirect/profile) and under 'Security' scroll down to 'Long-Lived Access Tokens' and create a new token. Copy this token and paste it into the Addon's configuration.
- `Label`: The Addon uses a Home Assistant label to identify which entities should be integrated into Free@Home. Create a new Label in Home Assistant (e.g., `Busch Jaeger`) and paste its id into the Addon's configuration. (The label id is not the same as the name but lowercase and with underscores instead of spaces. You can see all label ids in Home Assistant under Developer Tools -> Templates -> and paste `{{ labels() }}` into the template editor.)
- `Label Refresh Interval`: This setting defines how often the Addon should refresh the list of entities from Home Assistant. The default is 60 seconds (1 minute).

After inputting the correct values into the authentication group you should see a State: Connected Message, if the connection to Home Assistant was successful.
Save the configuration to apply the settings and start the Addon.
After that your Home Assistant entities should slowly appear in your Free@Home system. Be patient, depending on the number of entities it can take some time until all entities are created.

### Updating
If there is a new version of the Addon available on Github you can update it by downloading the latest release and uploading it to your SysAP like described in the installation section. Then you can just press the update button in the Addon settings to update it. Your configuration will be kept during the update.

## Troubleshooting
If you encounter issues with the Addon, you can download the log messages from the Addons settings page. Check the logs for any error messages that might indicate what went wrong. If you need further assistance, you can open an issue on the [GitHub repository](https://github.com/piushartmann/ha-free-at-home-plugin/issues). Be aware that there could potentially be private information like device names or your Home Assistant URL in the logs, so review them before sharing. (The Long-Lived Access Token is never logged.)

## Development
You can follow the documentation of Busch-Jaeger [here](https://busch-jaeger.github.io/free-at-home-addon-development-kit-documentation-preview/) to set up your environment for testing and debugging the Addon on a SysAP. I also found the docs in thier [node-free-at-home](https://github.com/Busch-Jaeger/node-free-at-home) repository newer and more helpful then the ones in thier dedicated documentation repository. But I have to say that the documentation in general is not that good and really old in some parts. I had to do some reverse engineering to figure out how some parts work.