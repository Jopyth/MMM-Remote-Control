# Monitor Control

Configure monitor on/off commands for different display systems.

## Overview

The default monitor commands use `vcgencmd`, which only works on older Raspberry Pi OS versions (Buster, Bullseye). **Raspberry Pi OS Bookworm (2023) and newer use Wayland by default**, where `vcgencmd display_power` no longer works.

Choose the right setup for your system below.

Check your display server:

```bash
echo $XDG_SESSION_TYPE  # Shows 'wayland' or 'x11'
```

## Commands by Display System

### vcgencmd (Default - Raspberry Pi OS Buster/Bullseye)

The built-in default. Works on Raspberry Pi OS Buster and Bullseye where `vcgencmd` is pre-installed:

```js
customCommand: {
    monitorOnCommand: 'vcgencmd display_power 1',
    monitorOffCommand: 'vcgencmd display_power 0',
    monitorStatusCommand: 'vcgencmd display_power -1'
}
```

> **Note:** `vcgencmd display_power` does **not** work on Raspberry Pi OS Bookworm and newer. Use one of the Wayland options below instead.

---

### Wayland (Raspberry Pi OS Bookworm+)

For systems using Wayland (default since Raspberry Pi OS Bookworm). Two tools are available — `wlopm` is recommended:

#### wlopm (Recommended)

`wlopm` is purpose-built for display power management on Wayland. It uses the Wayland power management protocol to turn the display hardware off without affecting the window layout. The display wakes up with its previous settings intact — no `--mode` or `--transform` needed on the on command.

Install `wlopm`:

```bash
sudo apt install wlopm
```

Find your output name:

```bash
wlopm
```

```js
customCommand: {
    monitorOnCommand: 'wlopm --on HDMI-A-1',
    monitorOffCommand: 'wlopm --off HDMI-A-1',
    monitorStatusCommand: 'wlopm | grep -q "HDMI-A-1 on" && echo "true" || echo "false"'
}
```

> **Note:** `wlopm` is available via `apt` on Raspberry Pi OS Bookworm, Raspberry Pi OS Trixie, and Debian 13 (Trixie). It is **not** in plain Debian 12 (Bookworm) repositories. It does not require `WAYLAND_DISPLAY` to be set explicitly.

#### wlr-randr

Unlike `wlopm`, `wlr-randr` removes the output from the compositor layout when turning the display off. This means you may need to specify `--mode` and `--transform` on the on command to restore the previous settings.

Install `wlr-randr` first:

```bash
sudo apt install wlr-randr
```

Find your output name (might be `HDMI-A-2`, `HDMI-1`, etc.):

```bash
wlr-randr
```

```js
customCommand: {
    monitorOnCommand: 'wlr-randr --output HDMI-A-1 --on',
    monitorOffCommand: 'wlr-randr --output HDMI-A-1 --off',
    monitorStatusCommand: 'wlr-randr | grep -q "Enabled: yes" && echo "true" || echo "false"'
}
```

> **Note:** MagicMirror/Electron does not inherit `WAYLAND_DISPLAY` from the environment. Without it, `wlr-randr` silently falls back to guessing the Wayland socket, which can cause the display to flicker back on after a few seconds. If you see this behavior, set `WAYLAND_DISPLAY` explicitly. Find the socket name by running `ls /run/user/1000/` and looking for a file named `wayland-0` or `wayland-1`.

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
sudo apt install cec-utils
```

---

### GNOME/Mutter

For systems running MagicMirror on a full GNOME desktop (not typical for Raspberry Pi):

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
wlopm          # if installed
wlr-randr      # alternative
```

**X11:**

```bash
xrandr -d :0
```

### 5. Multi-monitor setups

Raspberry Pi 4/5 have multiple HDMI outputs. Make sure to specify the correct one (e.g., `HDMI-A-1` vs `HDMI-A-2`).

### 6. Display comes back on after a few seconds

If the display turns off but comes back on after ~6 seconds on Wayland:

- **Check `WAYLAND_DISPLAY`**: MagicMirror/Electron does not inherit this variable. Without it, `wlr-randr` falls back to guessing the Wayland socket, causing unreliable power state. Set it explicitly (e.g., `WAYLAND_DISPLAY=wayland-1`) or switch to `wlopm`.
- **Check compositor idle settings**: Your Wayland compositor (e.g., Wayfire) may have its own screen power management that overrides the command. Look for a `dpms_timeout` or `[idle]` section in `~/.config/wayfire.ini`.
- **Check monitor auto-scan**: Some displays have an "auto input scan" feature that re-activates the display when it detects a signal loss. Disable it in the monitor's OSD settings.

### 7. Permissions

Some commands may require additional permissions or group membership (e.g., `video` group for CEC).

### 8. Get help

For more solutions and community help, see [Issue #288](https://github.com/Jopyth/MMM-Remote-Control/issues/288).
