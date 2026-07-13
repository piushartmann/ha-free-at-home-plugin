Home Assistant Addon for Busch Jaeger Free@Home
===

This add-on for the Busch Jaeger SysAP integrates Home Assistant entities into the Free@Home ecosystem. So you can control your Home Assistant devices with the Free@Home smart home system and their smart light switches.

## Supported Home Assistant Domains

- switch
- light (on/off and dimmable but no color control)
- binary_sensor
- sensor (temperature only)
- cover (not fully tested yet)

## How to Use
This Addon is a personal experimental project.
Even though I haven't encountered any problems during testing I strongly advice you to create and download a full Backup to another device, in case you have to reset the SysAP.

This Addon is only recommended to be used by experienced users.

Before installing the Addon read the [disclaimer](#disclaimer)

### Prerequisites
- A Home Assistant instance running and accessible.
- A Busch-Jaeger SysAP 2.0 with Free@Home firmware version 2.4.0 or higher.

### Install the Add-on on your SysAP
1. Download the latest release from the [releases](https://github.com/piushartmann/ha-free-at-home-plugin/releases) page.
2. Upload the downloaded file to your Busch-Jaeger SysAP by navigating to Settings and clicking the 'Upload' button in the Addons section.

### Configuration
- `Home Assistant URL`: This is the URL where your Home Assistant instance is accessible. Note that you can't use mDNS URLs like `http://homeassistant.local:8123`; you have to use the direct IP address or a resolvable domain name.
- `Long-Lived Access Token`: To generate a Long-Lived Access Token, navigate to your Home Assistant [User Profile](https://my.home-assistant.io/redirect/profile) and under 'Security' scroll down to 'Long-Lived Access Tokens' and create a new token. Copy this token and paste it into the add-on's configuration.
- `Label`: The add-on uses a Home Assistant label to identify which entities should be integrated into Free@Home. Create a new label in Home Assistant (e.g., `Busch Jaeger`) and paste its ID into the add-on's configuration. (The label ID is not the same as the name but lowercase and with underscores instead of spaces. You can see all label IDs in Home Assistant under Developer Tools -> Templates -> and paste `{{ labels() }}` into the template editor.)
- `Label Refresh Interval`: This setting defines how often the add-on should refresh the list of entities from Home Assistant. The default is 60 seconds (1 minute).

After providing the correct values into the authentication group you should see a `State: Connected` message if the connection to Home Assistant was successful.
Save the configuration to apply the settings and start the add-on.
After that your Home Assistant entities should slowly appear in your Free@Home system. Be patient; depending on the number of entities it can take some time until all entities are created.

To use the npm script you can make a .env file with the following content:
```
export FREEATHOME_BASE_URL='<your SysAP URL>'
export FREEATHOME_API_USERNAME='<your SysAP username (usually "Installer")>'
export FREEATHOME_API_PASSWORD='<your SysAP password>'
```

### Updating
If there is a new version of the add-on available on GitHub you can update it by downloading the latest release and uploading it to your SysAP like described in the installation section. Then you can just press the update button in the add-on settings to update it. Your configuration will be kept during the update.
When updating it will seem like all your devices are slowly disappearing and reappearing. This is normal behavior during the update process and will take some time, but your configuration of the devices will be kept.

## Troubleshooting
If you encounter issues with the add-on, you can download the log messages from the add-ons settings page. Check the logs for any error messages that might indicate what went wrong. If you need further assistance, you can open an issue on the [GitHub repository](https://github.com/piushartmann/ha-free-at-home-plugin/issues). Be aware that there could potentially be private information like device names or your Home Assistant URL in the logs, so review them before sharing. (The Long-Lived Access Token is never logged.)

## Disclaimer

DISCLAIMER. THIS SOFTWARE IS PROVIDED 'AS IS' AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT ARE DISCLAIMED. THIS SOFTWARE IS NOT INTENDED NOR AUTHORIZED FOR USE IN SYSTEMS OR APPLICATIONS WHERE FAILURE OF THE SOFTWARE MAY CAUSE PERSONAL INJURY OR DEATH.

LIMITATION OF LIABILITY. IN NO EVENT WILL MYSELF BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. YOU AGREE TO INDEMNIFY AND HOLD MYSELF HARMLESS AGAINST ANY CLAIMS AND EXPENSES RESULTING FROM YOUR USE OR UNAUTHORIZED USE OF THE SOFTWARE.