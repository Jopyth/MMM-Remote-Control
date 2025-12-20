# Examples

Integration examples with other MagicMirror modules.

## MMM-ModuleScheduler

Automatically control your mirror on a schedule.

### Monitor On/Off Schedule

```js
notification_schedule: [
  {
    notification: "REMOTE_ACTION",
    schedule: "30 7 * * *",
    payload: { action: "MONITORON" }
  },
  {
    notification: "REMOTE_ACTION",
    schedule: "30 23 * * *",
    payload: { action: "MONITOROFF" }
  }
];
```

### Brightness Schedule

```js
notification_schedule: [
  // Bright during day
  {
    notification: "REMOTE_ACTION",
    schedule: "0 8 * * *",
    payload: { action: "BRIGHTNESS", value: 100 }
  },
  // Dim at night
  {
    notification: "REMOTE_ACTION",
    schedule: "0 22 * * *",
    payload: { action: "BRIGHTNESS", value: 30 }
  }
];
```

### Show/Hide Modules on Schedule

```js
notification_schedule: [
  // Show weather in the morning
  {
    notification: "REMOTE_ACTION",
    schedule: "0 7 * * *",
    payload: { action: "SHOW", module: "weather" }
  },
  // Hide weather at night
  {
    notification: "REMOTE_ACTION",
    schedule: "0 22 * * *",
    payload: { action: "HIDE", module: "weather" }
  }
];
```

---

## MMM-Navigate

Control your mirror with a rotary encoder or buttons.

```js
Action: [
  { notification: "REMOTE_ACTION", payload: { action: "MONITORON" } },
  { notification: "REMOTE_ACTION", payload: { action: "MONITOROFF" } },
  {
    notification: "REMOTE_ACTION",
    payload: { action: "BRIGHTNESS", value: 50 }
  },
  {
    notification: "REMOTE_ACTION",
    payload: { action: "BRIGHTNESS", value: 100 }
  },
  { notification: "REMOTE_ACTION", payload: { action: "REFRESH" } },
  { notification: "REMOTE_ACTION", payload: { action: "RESTART" } }
];
```

---

## MMM-PIR-Sensor / MMM-Motion-Detection

Turn monitor on/off based on presence.

In your motion detection module, send:

```js
// When motion detected
this.sendNotification("REMOTE_ACTION", { action: "MONITORON" });

// When no motion for X minutes
this.sendNotification("REMOTE_ACTION", { action: "MONITOROFF" });
```

---

## Home Assistant

Control your mirror from Home Assistant using REST commands.

### configuration.yaml

```yaml
rest_command:
  mirror_on:
    url: "http://YOUR_MIRROR_IP:8080/api/monitor/on?apiKey=YOUR_API_KEY"
  mirror_off:
    url: "http://YOUR_MIRROR_IP:8080/api/monitor/off?apiKey=YOUR_API_KEY"
  mirror_brightness:
    url: "http://YOUR_MIRROR_IP:8080/api/brightness/{{ brightness }}?apiKey=YOUR_API_KEY"
  mirror_refresh:
    url: "http://YOUR_MIRROR_IP:8080/api/refresh?apiKey=YOUR_API_KEY"
```

### Automation Example

```yaml
automation:
  - alias: "Mirror off at night"
    trigger:
      platform: time
      at: "23:00:00"
    action:
      service: rest_command.mirror_off

  - alias: "Mirror on in morning"
    trigger:
      platform: time
      at: "07:00:00"
    action:
      service: rest_command.mirror_on
```

---

## From Your Own Module

Send notifications from any MagicMirror module:

```js
// Turn monitor off
this.sendNotification("REMOTE_ACTION", { action: "MONITOROFF" });

// Show an alert
this.sendNotification("REMOTE_ACTION", {
  action: "NOTIFICATION",
  notification: "SHOW_ALERT",
  payload: { message: "Hello!", timer: 3000 }
});

// Hide a specific module
this.sendNotification("REMOTE_ACTION", {
  action: "HIDE",
  module: "calendar"
});

// Delayed action (turn off in 60 seconds)
this.sendNotification("REMOTE_ACTION", {
  action: "DELAYED",
  timeout: 60,
  query: { action: "MONITOROFF" }
});
```

---

## cURL Examples

Control your mirror from the command line or scripts:

```bash
# Monitor control
curl http://mirror:8080/api/monitor/on
curl http://mirror:8080/api/monitor/off
curl http://mirror:8080/api/monitor/toggle

# Brightness
curl http://mirror:8080/api/brightness/50

# Module control
curl http://mirror:8080/api/module/calendar/hide
curl http://mirror:8080/api/module/calendar/show

# Show alert
curl "http://mirror:8080/api/module/alert/showalert?message=Hello&timer=3000"

# Refresh / Restart
curl http://mirror:8080/api/refresh
curl http://mirror:8080/api/restart
```

With API key:

```bash
curl "http://mirror:8080/api/monitor/off?apiKey=YOUR_API_KEY"
```
