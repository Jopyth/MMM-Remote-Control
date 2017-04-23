# Magic Mirror Module: Remote Control

This module for the [Magic Mirror²](https://github.com/MichMich/MagicMirror) allows you to quickly shutdown your mirror through a web browser.
The website should work fine on any device (desktop, smart phone, tablet, ...).
Since we all want our [SD cards to live a long and prosper life](http://raspberrypi.stackexchange.com/a/383) we properly shut down before pulling the power plug everytime, am I right?
Additionally you can hide and show modules on your mirror and do other cool stuff.

![The Main Menu](.github/main.png)
![The Power Menu](.github/power.png)
![Hide and Show a Module](.github/hide_show_module.gif)

## Installation

### Quick install

If you followed the default installation instructions for the [Magic Mirror²](https://github.com/MichMich/MagicMirror) project, you should be able to use the automatic installer.
The following command will download the installer and execute it:
```bash
bash -c "$(curl -s https://raw.githubusercontent.com/Jopyth/MMM-Remote-Control/master/installer.sh)"
```

### Manual install

- (1) Clone this repository in your `modules` folder, and install dependencies:
```bash
cd ~/MagicMirror/modules # adapt directory if you are using a different one
git clone https://github.com/Jopyth/MMM-Remote-Control.git
cd MMM-Remote-Control
npm install
```

- (2) Add the module to your `config/config.js` file, if you add a `position`, it will display the URL to the remote on the mirror.
```js
{
    module: 'MMM-Remote-Control'
    // uncomment the following line to show the URL of the remote control on the mirror
    // , position: 'bottom_left'
    // you can hide this module afterwards from the remote control itself
},
```

- (3) Add the IP addresses of devices you want to use to access the Remote Control to the `ipWhiteList` in your `config.js`.

- (4) Restart your Magic Mirror² (i.e. `pm2 restart mm`).

- (5) Access the remote interface on [http://192.168.xxx.xxx:8080/remote.html](http://192.168.xxx.xxx:8080/remote.html) (replace with IP address of your RaspberryPi).

Note: If your user does not have `sudo` rights, the shutdown does not work (it *should* work for everyone who did not change anything on this matter).

### Update

Update this module by navigating into its folder on the command line and using `git pull`:

```bash
cd ~/MagicMirror/modules/MMM-Remote-Control # adapt directory if you are using a different one
git pull
npm install # install (new) dependencies
```

Alternatively you can run the `installer.sh` script again:
```bash
~/MagicMirror/modules/MMM-Remote-Control/installer.sh
```

### Select version manually

You can check out specific versions in the following way.
First look at which versions are available:
```bash
cd MagicMirror/modules/MMM-Remote-Control # or wherever you installed the Mirror and the module
git fetch # fetch all tags
git tags # display them
```

The output should look similar to this:
```
v1.0.0
v1.1.0
v1.1.1
v1.1.2
```
Then you can checkout that version with, for example `git checkout v1.0.0`, or use `git checkout master` to checkout the most recent version.

## Known limitations

Whenever you change the order of modules in `config.js` or add/remove modules, the indices of the modules change.
Therefore the hidden/shown status of modules might not be correctly applied.
If this happens, simply reconfigure and save it again.

## Call methods from other modules

You can call any of the methods provided in the UI directly through a GET request, or a module notification.
For example you can use [MMM-ModuleScheduler](https://forum.magicmirror.builders/topic/691/mmm-modulescheduler) to automatically shutdown your RasberryPi at a certain time, or integrate it with home automation systems.

### Examples

- Example for a GET request to trigger a RaspberryPi restart:
```
http://192.168.xxx.xxx:8080/remote?action=RESTART
```

- Example for a notification schedule for [MMM-ModuleScheduler](https://forum.magicmirror.builders/topic/691/mmm-modulescheduler) to automatically switch your monitor on and off with :
```javascript
notification_schedule: [
    {notification: 'REMOTE_ACTION', schedule: '30 9 * * *', payload: {action: 'MONITOROFF'}},
    {notification: 'REMOTE_ACTION', schedule: '30 18 * * *', payload: {action: 'MONITORON'}}
]
```

- Example to trigger a RaspberryPi restart in your module:
```
this.sendNotification('REMOTE_ACTION', {action: 'RESTART'});
```

### List of actions

| action | description |
| ------------- | ------------- |
| SHUTDOWN | Shutdown your RaspberryPi |
| REBOOT | Restart your RaspberryPi |
| RESTART | Restart your MagicMirror |
| MONITORON | Switch your display on |
| MONITOROFF | Switch your display off |
| SAVE | Save the current configuration (show and hide status of modules, and brightness), will be applied after the mirror starts |
| BRIGHTNESS | Change mirror brightness, with the new value specified by `value`. `100` equals the default, possible range is between `10` and `200`. |
| HIDE | Hide a module, with the identifier specified by `module` (see `MODULE_DATA` action). |
| SHOW | Show a module, with the identifier specified by `module` (see `MODULE_DATA` action). |
| MODULE_DATA | Returns a JSON format of the data displayed in the UI, including all valid identifiers for the `HIDE` and `SHOW` action. |
| REFRESH | Refresh mirror page |
| SHOW_ALERT | Show Default Alert/Notification |
| HIDE_ALERT | Hide Default Alert/Notification |
| UPDATE | Update MagicMirror and any of it's modules |
| NOTIFICATION | Send a notification to all modules (see [Notification Request](#notification-request)). |

### Format of module data response

The response will be in the JSON format, here is an example:

```json
{
"moduleData":[
    {"hidden":false,"name":"alert","identifier":"module_0_alert"},
    {"hidden":true,"name":"clock","identifier":"module_1_clock","position":"bottom_right"},
    {"hidden":false,"name":"currentweather","identifier":"module_2_currentweather","position":"top_right"}
],
"brightness":40,
"settingsVersion":1
}
```

### Notification Request

To send a notification to all modules, send the following GET-parameters.

| key | value |
| --- | ----- |
| action | `NOTIFICATION`<br>**Required** |
| notification | The notification to send, e.g. `ARTICLE_MORE_DETAILS`, `SHOW_ALERT` or `HIDE_ALERT`.<br>**Required** |
| payload | A stringified JSON object with the payload for the notification.<br>**Optional** if absent, an empty payload (`{}`) is assumed. |

Examples:

```
?action=NOTIFICATION&notification=ARTICLE_MORE_DETAILS

?action=NOTIFICATION&notification=SHOW_ALERT&payload={%22title%22:%22Alert%22,%22message%22:%22This%20is%an%20alert.%22}
(Payload is URL-encoded form of {"title":"Alert","message":"This is an alert."})

?action=NOTIFICATION&notification=HIDE_ALERT
```

## License

### The MIT License (MIT)

Copyright © 2016 Joseph Bethge

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the “Software”), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

**The software is provided “as is”, without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with the software or the use or other dealings in the software.**
