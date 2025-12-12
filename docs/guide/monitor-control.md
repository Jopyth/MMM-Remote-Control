# Monitor Control

Configure monitor on/off commands for different display systems.

## Overview

The default monitor commands use `vcgencmd`, which works on older Raspberry Pi OS versions. However, **Raspberry Pi OS Bookworm (2023) and newer use Wayland by default**, where `vcgencmd display_power` no longer works.

Check your display server:

```bash
echo $XDG_SESSION_TYPE  # Shows 'wayland' or 'x11'
```

## Commands by Display System

### Legacy vcgencmd (Default)

Works on Raspberry Pi OS Buster/Bullseye with X11.

**Default commands** (no configuration needed):

```js
customCommand: {
    monitorOnCommand: 'vcgencmd display_power 1',
    monitorOffCommand: 'vcgencmd display_power 0',
    monitorStatusCommand: 'vcgencmd display_power -1'
}
```

> **Note:** `vcgencmd display_power` has been deprecated and may not work on Raspberry Pi OS Bookworm and newer.

---

### Wayland (Raspberry Pi OS Bookworm+)

For systems using Wayland (default since Raspberry Pi OS Bookworm):

```js
customCommand: {
    monitorOnCommand: 'wlr-randr --output HDMI-A-1 --on',
    monitorOffCommand: 'wlr-randr --output HDMI-A-1 --off',
    monitorStatusCommand: 'wlr-randr | grep -q "Enabled: yes" && echo "true" || echo "false"'
}
```

Install `wlr-randr`:

```bash
sudo apt-get install wlr-randr
```

Find your output name:

```bash
wlr-randr
```

If `wlr-randr` doesn't work, try setting the `WAYLAND_DISPLAY` environment variable:

```js
customCommand: {
    monitorOnCommand: 'WAYLAND_DISPLAY="wayland-1" wlr-randr --output HDMI-A-1 --on',
    monitorOffCommand: 'WAYLAND_DISPLAY="wayland-1" wlr-randr --output HDMI-A-1 --off',
    monitorStatusCommand: 'WAYLAND_DISPLAY="wayland-1" wlr-randr | grep -q "Enabled: yes" && echo "true" || echo "false"'
}
```

---

### X11 / Xorg

For systems using X11 (older Raspberry Pi OS or desktop Linux):

```js
customCommand: {
    monitorOnCommand: 'xrandr --output HDMI-1 --auto',
    monitorOffCommand: 'xrandr --output HDMI-1 --off',
    monitorStatusCommand: 'xrandr | grep "HDMI-1 connected" | grep -q " [0-9]" && echo "true" || echo "false"'
}
```

With explicit display (if above doesn't work):

```js
customCommand: {
    monitorOnCommand: 'xrandr -d :0 --output HDMI-1 --auto',
    monitorOffCommand: 'xrandr -d :0 --output HDMI-1 --off',
    monitorStatusCommand: 'xrandr -d :0 --listmonitors | grep -v "Monitors: 0" && echo "true" || echo "false"'
}
```

Find your output name:

```bash
xrandr | grep " connected"
```

Common output names: `HDMI-1`, `HDMI-2`, `DP-1`, `eDP-1`

---

### CEC (HDMI-CEC capable displays)

For displays that support HDMI-CEC control:

```js
customCommand: {
    monitorOnCommand: 'echo "on 0" | cec-client -s -d 1',
    monitorOffCommand: 'echo "standby 0" | cec-client -s -d 1',
    monitorStatusCommand: 'echo "pow 0" | cec-client -s -d 1 | grep -q "power status: on" && echo "true" || echo "false"'
}
```

Install `cec-client`:

```bash
sudo apt-get install cec-utils
```

---

### DPMS (Generic Linux)

For generic Linux systems with DPMS support:

```js
customCommand: {
    monitorOnCommand: 'xset dpms force on',
    monitorOffCommand: 'xset dpms force off',
    monitorStatusCommand: 'xset q | grep -q "Monitor is On" && echo "true" || echo "false"'
}
```

---

### GNOME/Mutter (Debian 13 Trixie+)

For systems using GNOME/Mutter display server:

```js
customCommand: {
    monitorOnCommand: 'busctl --user set-property org.gnome.Mutter.DisplayConfig /org/gnome/Mutter/DisplayConfig org.gnome.Mutter.DisplayConfig PowerSaveMode i 0',
    monitorOffCommand: 'busctl --user set-property org.gnome.Mutter.DisplayConfig /org/gnome/Mutter/DisplayConfig org.gnome.Mutter.DisplayConfig PowerSaveMode i 1',
    monitorStatusCommand: 'busctl --user get-property org.gnome.Mutter.DisplayConfig /org/gnome/Mutter/DisplayConfig org.gnome.Mutter.DisplayConfig PowerSaveMode | grep -q "i 0" && echo "true" || echo "false"'
}
```

---

## Troubleshooting

### 1. Verify your display server

```bash
echo $XDG_SESSION_TYPE  # Should show 'wayland' or 'x11'
```

### 2. Switch display server (Raspberry Pi)

```bash
sudo raspi-config
# Navigate to: Advanced Options -> Wayland -> Select X11 or Wayland -> Reboot
```

### 3. Test commands manually

Run the command directly in the terminal to ensure it works before adding it to the config.

### 4. Check output names

Display output names vary by system:

**Wayland:**

```bash
wlr-randr
```

**X11:**

```bash
xrandr -d :0
```

### 5. Multi-monitor setups

Raspberry Pi 4/5 have multiple HDMI outputs. Make sure to specify the correct one (e.g., `HDMI-A-1` vs `HDMI-A-2`).

### 6. Permissions

Some commands may require additional permissions or group membership (e.g., `video` group for CEC).

### 7. Get help

For more solutions and community help, see [Issue #288](https://github.com/Jopyth/MMM-Remote-Control/issues/288).
