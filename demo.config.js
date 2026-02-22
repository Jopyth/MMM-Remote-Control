const config = {
  address: "0.0.0.0",
  ipWhitelist: [],
  logLevel: ["INFO", "LOG", "WARN", "ERROR", "DEBUG"],
  modules: [
    {
      module: "alert"
    },
    {
      module: "clock",
      position: "top_left",
      config: {
        displaySeconds: false,
        showPeriod: true,
        showDate: true
      }
    },
    {
      module: "weather",
      position: "top_right",
      config: {
        weatherProvider: "openmeteo",
        type: "current",
        location: "Berlin",
        locationID: "2950159",
        lat: 52.52,
        lon: 13.41
      }
    },
    {
      module: "weather",
      position: "top_right",
      config: {
        weatherProvider: "openmeteo",
        type: "forecast",
        location: "Berlin",
        locationID: "2950159",
        lat: 52.52,
        lon: 13.41
      }
    },
    {
      module: "calendar",
      position: "top_left",
      header: "Upcoming Events",
      config: {
        calendars: [
          {
            url: "https://calendar.google.com/calendar/ical/en.german%23holiday%40group.v.calendar.google.com/public/basic.ics",
            symbol: "calendar"
          }
        ]
      }
    },
    {
      module: "newsfeed",
      position: "bottom_bar",
      config: {
        feeds: [
          {
            title: "New York Times",
            url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml"
          }
        ],
        showSourceTitle: true,
        showPublishDate: true,
        updateInterval: 300_000
      }
    },
    {
      module: "compliments",
      position: "lower_third",
      config: {
        compliments: {
          morning: [
            "Good morning!",
            "Have a great day!",
            "You look great today!"
          ],
          afternoon: [
            "Hello!",
            "You look nice!",
            "Looking good today!"
          ],
          evening: [
            "Good evening!",
            "Have a nice evening!",
            "You look relaxed!"
          ]
        }
      }
    },
    {
      module: "MMM-Remote-Control",
      position: "bottom_right",
      config: {
        showModuleApiMenu: true,
        secureEndpoints: false,
        customMenu: "custom_menu.example.json",
        classes: {
          "Toggle Weather": {
            toggle: ["weather"]
          },
          "Toggle Calendar": {
            toggle: ["calendar"]
          },
          "Toggle News": {
            toggle: ["newsfeed"]
          },
          "Night Mode": {
            hide: ["weather", "calendar", "newsfeed", "compliments"]
          },
          "Morning Mode": {
            show: ["clock", "weather", "calendar", "compliments"],
            hide: ["newsfeed"]
          }
        }
      }
    }
  ]
};

/** ************* DO NOT EDIT THE LINE BELOW */
if (typeof module !== "undefined") {
  module.exports = config;
}
