# Magic Mirror Module: Remote Control

This module for the [Magic Mirror²](https://github.com/MichMich/MagicMirror) allows you to quickly shutdown your mirror through a web browser.
The website should work fine on any device (desktop, smart phone, tablet, ...).
Since we all want our [SD cards to live a long and prosper life](http://raspberrypi.stackexchange.com/a/383) we properly shut down before pulling the power plug everytime, am I right?
Additionally you can hide and show modules on your mirror.

![The Main Menu](.github/main.png)
![The Power Menu](.github/power.png)
![Hide and Show a Module](.github/hide_show_module.gif)

## Installation

- (1) Clone this repository in your `MagicMirror/modules` folder:
```bash
git clone https://github.com/Jopyth/MMM-Remote-Control.git
```

- (2) Add the module to your `config/config.js` file, if you add a `position`, it will display the URL to the remote on the mirror.
```javascript
{
    module: 'MMM-Remote-Control'
    // uncomment the following line to show the URL of the remote control on the mirror
    // , position: 'bottom_left'
    // you can hide this module afterwards from the remote control itself
},
```

- (3) Access the remote interface on [http://ip.of.your.mirror:8080/remote.html](http://ip.of.your.mirror:8080/remote.html).

- (4) If you are not running with `sudo` rights, the shutdown does not work (it *should* work for everyone who did not change anything on this matter).

## Update

Update this module by navigating into its folder on the command line and executing this command: `git pull`.

## License

The MIT License (MIT)
=====================

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
