# Custom Commands

Create your own shell commands to execute on your mirror.

> ⚠️ **Security Warning:** Custom commands execute shell commands on your system. Only add commands you trust.

## Reserved Commands

These commands override the default system commands:

```js
config: {
    customCommand: {
        shutdownCommand: 'sudo shutdown -h now',
        rebootCommand: 'sudo reboot',
        monitorOnCommand: "wlopm --on '*'",
        monitorOffCommand: "wlopm --off '*'",
        monitorStatusCommand: "command -v wlopm > /dev/null 2>&1 || exit 1; wlopm | grep -q ' on$' && echo 'true' || echo 'false'",
    },
},
```

| Command                | Description                                              |
| ---------------------- | -------------------------------------------------------- |
| `shutdownCommand`      | Shutdown the system                                      |
| `rebootCommand`        | Reboot the system                                        |
| `monitorOnCommand`     | Turn the display on                                      |
| `monitorOffCommand`    | Turn the display off                                     |
| `monitorStatusCommand` | Check display status (must return `"true"` or `"false"`) |

For detailed monitor control options (Wayland, X11, CEC, etc.), see [Monitor Control](monitor-control.md).

## Custom Commands via API

Since v2.3.0, you can define custom commands that can be triggered via the API:

```js
config: {
    customCommand: {
        myCustomCommand: 'echo "Hello World"',
        takeScreenshot: 'scrot /tmp/screenshot.png',
    },
},
```

Then call via API:

```bash
curl http://your-mirror:8080/api/command/myCustomCommand
```

## Examples

### Different shutdown for desktop Linux

```js
customCommand: {
    shutdownCommand: 'systemctl poweroff',
    rebootCommand: 'systemctl reboot',
}
```

### Restart MagicMirror via systemd

```js
customCommand: {
    restartCommand: 'sudo systemctl restart magicmirror',
}
```
