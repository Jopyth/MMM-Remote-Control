# Frequently Asked Questions

## System Issues

### RPi not shutting down? Getting "Interactive Authorization" error

You need passwordless sudo for shutdown commands. See [this guide](https://askubuntu.com/questions/168879/shutdown-from-terminal-without-entering-password).

### MagicMirror instance isn't restarting

You probably don't have PM2 installed, or the process name is different.

1. Check if PM2 is running: `pm2 list`
2. If your process name isn't `mm`, add to config:
   ```js
   config: {
       pm2ProcessName: 'MagicMirror',  // your process name
   }
   ```

See [MagicMirror Docs](https://docs.magicmirror.builders/configuration/autostart.html) for PM2 setup.

---

## Monitor Control

### My monitor isn't turning off

1. Check your display server: `echo $XDG_SESSION_TYPE`
2. Configure the correct commands for your system. See [Monitor Control](monitor-control.md).
3. Test commands manually in the terminal before adding to config.

**Important:** If `monitorStatusCommand` doesn't work correctly, the toggle function won't work!

---

## API Issues

### I can't change anything on my mirror!

This is likely because:

1. **No API key set** and `secureEndpoints: true` (default) is blocking dangerous actions
2. **Solution:** Either set an `apiKey` in your config, or set `secureEndpoints: false` (not recommended)

```js
config: {
    apiKey: 'your-secret-key',
    // or
    secureEndpoints: false,  // Not recommended!
}
```

---

## Startup Issues

### MagicMirror shows black screen or won't start

Usually a syntax error in your config file or custom menu JSON.

1. Validate your `config.js`: Copy contents to [JSONLint](https://jsonlint.com/) (remove the `var config =` and trailing `;`)
2. Validate your custom menu JSON at [JSON Formatter](https://jsonformatter.curiousconcept.com/)
3. Check the terminal for error messages

---

## Installation Issues

### The installation does strange things

Make sure you're using the [standard MagicMirror installation](https://docs.magicmirror.builders/getting-started/installation.html#manual-installation).

Non-standard installations may have different paths or configurations. If you're having issues, [open an issue](https://github.com/Jopyth/MMM-Remote-Control/issues/new) with details about your setup.

---

## Debugging

### How do I see the logs?

**If running manually:**

```bash
cd ~/MagicMirror
npm start
```

Logs appear in the terminal.

**If using PM2:**

```bash
pm2 logs mm        # or your process name
pm2 logs mm --lines 100   # last 100 lines
```

**Browser console:**
Press F12 in the MagicMirror window to open DevTools.

---

## Still stuck?

1. Search [existing issues](https://github.com/Jopyth/MMM-Remote-Control/issues)
2. Check the [MagicMirror Forum](https://forum.magicmirror.builders/)
3. [Open a new issue](https://github.com/Jopyth/MMM-Remote-Control/issues/new) with:
   - Your `config.js` (remove sensitive data)
   - Error messages from logs
   - Steps to reproduce the problem
