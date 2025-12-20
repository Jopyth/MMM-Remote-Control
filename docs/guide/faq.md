# Frequently Asked Questions

## System Issues

### Shutdown or Reboot not working? "System requires password" error

Your system requires a password for shutdown/reboot commands. To fix this:

1. Open the sudoers file (safely):

   ```bash
   sudo visudo
   ```

2. Add this line at the end (replace `pi` with your username):

   ```bash
   pi ALL=(ALL) NOPASSWD: /sbin/shutdown
   ```

3. Save and exit (Ctrl+X, then Y, then Enter)

Now shutdown and reboot should work without password prompts.

See also: [Ubuntu guide on passwordless shutdown](https://askubuntu.com/questions/168879/shutdown-from-terminal-without-entering-password)

### MagicMirror instance isn't restarting

The restart function depends on your process manager setup.

1. In Desktop mode (with Electron), restart uses `app.relaunch()` and `app.quit()`
2. In Server mode, the process exits cleanly and your process manager (systemd, PM2, Docker, etc.) should restart it
3. Make sure your process manager is configured to restart on clean exit (exit code 0)

For example, with systemd set `Restart=on-success`, or with PM2 use the default auto-restart behavior.

See [MagicMirror Docs](https://docs.magicmirror.builders/configuration/autostart.html) for setup instructions.

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
