import {Remote} from "./remote.mjs";

/**
 * UI utility methods for MMM-Remote-Control.
 * Covers translation, DOM helpers, status display, and link management.
 */
Object.assign(
  Remote,
  {

    translate (pattern) {

      return this.translations[pattern];

    },

    filter (pattern) {

      let filterInstalled = false;
      if (pattern.includes("installed")) {

        filterInstalled = true;
        pattern = pattern.replace("installed", "");

      }
      pattern = pattern.trim();

      const regex = new RegExp(
          pattern,
          "i"
        ),
        searchIn = ["maintainer", "description", "name"],

        data = this.savedData.moduleAvailable;
      if (!Array.isArray(data)) {

        return;

      }
      for (const [index, currentData] of data.entries()) {

        const id = `install-module-${index}`,
          element = document.getElementById(id)?.closest(".module-line");
        if (!element) {

          continue;

        }
        if (!pattern) {

          // Cleared search input, show all
          element.classList.remove("hidden");
          continue;

        }

        let match = filterInstalled && currentData.installed;

        for (const key of searchIn) {

          if (match || currentData[key]?.match(regex)) {

            match = true;
            break;

          }

        }
        element.classList.toggle(
          "hidden",
          !match
        );

      }

    },

    updateSliderThumbColor (slider, type) {

      const value = Number.parseInt(
          slider.value,
          10
        ),
        min = Number.parseInt(
          slider.min,
          10
        ),
        max = Number.parseInt(
          slider.max,
          10
        ),
        percent = (value - min) / (max - min);

      let thumbColor, trackGradient;
      switch (type) {

        case "brightness": {

          // Brightness: dark gray to bright white (neutral, no color)
          const brightness = Math.round(50 + percent * 205);
          thumbColor = `rgb(${brightness}, ${brightness}, ${brightness})`;
          // Track gradient: dark gray (left) to bright white (right)
          trackGradient = "linear-gradient(to right, rgb(50, 50, 50), rgb(255, 255, 255))";
          break;

        }
        case "temp": {

          /*
           * Color temperature: warm (orange) to cool (blue)
           * Low values (140) = warm, High values (500) = cool
           * Invert: start with cool (low slider %), end with warm (high slider %)
           */
          const warmB = 41,
            warmG = 147,
            warmR = 255, // Warm orange
            coolB = 246,
            coolG = 181,
            coolR = 100, // Cool blue
            r = Math.round(coolR + (warmR - coolR) * percent),
            g = Math.round(coolG + (warmG - coolG) * percent),
            b = Math.round(coolB + (warmB - coolB) * percent);
          thumbColor = `rgb(${r}, ${g}, ${b})`;
          // Track gradient: cool blue (left) to warm orange (right)
          trackGradient = `linear-gradient(to right, rgb(${coolR}, ${coolG}, ${coolB}), rgb(${warmR}, ${warmG}, ${warmB}))`;
          break;

        }
        case "zoom": {

          // Zoom: small (dim blue) to large (bright blue)
          const smallB = 180,
            smallG = 120,
            smallR = 100,
            largeB = 255,
            largeG = 220,
            largeR = 180,
            r = Math.round(smallR + (largeR - smallR) * percent),
            g = Math.round(smallG + (largeG - smallG) * percent),
            b = Math.round(smallB + (largeB - smallB) * percent);
          thumbColor = `rgb(${r}, ${g}, ${b})`;
          trackGradient = `linear-gradient(to right, rgb(${smallR}, ${smallG}, ${smallB}), rgb(${largeR}, ${largeG}, ${largeB}))`;
          break;

        }

      }

      if (thumbColor) {

        slider.style.setProperty(
          "--thumb-color",
          thumbColor
        );

      }
      if (trackGradient) {

        slider.style.setProperty(
          "--track-gradient",
          trackGradient
        );

      }

    },

    closePopup () {

      const popupContainer = document.querySelector("#popup-container"),
        popupContents = document.querySelector("#popup-contents");
      popupContainer?.classList.add("hidden");
      if (popupContents) {

        popupContents.innerHTML = "";

      }

    },

    showPopup () {

      const popupContainer = document.querySelector("#popup-container");
      popupContainer?.classList.remove("hidden");

    },

    getPopupContent (clear = true) {

      if (clear) {

        this.closePopup();

      }
      return document.querySelector("#popup-contents");

    },

    setStatus (status, message, customContent) {

      if (this.autoHideTimer !== undefined) {

        clearTimeout(this.autoHideTimer);

      }

      // Simple status update
      if (status === "success" && !message && !customContent) {

        const successPopup = document.querySelector("#success-popup");
        successPopup.classList.remove("hidden");
        this.autoHideTimer = setTimeout(
          () => {

            successPopup.classList.add("hidden");

          },
          this.autoHideDelay
        );
        return;

      }

      const parent = document.querySelector("#result-contents");
      parent.replaceChildren();

      if (status === "none") {

        document.querySelector("#result-overlay")?.classList.add("hidden");
        document.querySelector("#result")?.classList.add("hidden");
        return;

      }

      if (customContent) {

        parent.append(customContent);
        document.querySelector("#result-overlay")?.classList.remove("hidden");
        document.querySelector("#result")?.classList.remove("hidden");
        return;

      }

      let onClick,
        symbol,
        text;
      if (status === "loading") {

        symbol = "fa-spinner fa-pulse";
        text = this.translate("LOADING");
        onClick = false;

      }
      if (status === "error") {

        symbol = "fa-exclamation-circle";
        text = this.translate("ERROR");
        onClick = () => {

          this.setStatus("none");

        };
        // Only auto-hide errors if autoHideDelayError > 0, otherwise user must click to dismiss
        if (this.autoHideDelayError > 0) {

          this.autoHideTimer = setTimeout(
            () => {

              this.setStatus("none");

            },
            this.autoHideDelayError
          );

        }

      }
      if (status === "info") {

        symbol = "fa-info-circle";
        text = this.translate("INFO");
        onClick = () => {

          this.setStatus("none");

        };
        // Info messages (like restart/stop) should be displayed longer
        if (this.autoHideDelayInfo > 0) {

          this.autoHideTimer = setTimeout(
            () => {

              this.setStatus("none");

            },
            this.autoHideDelayInfo
          );

        }

      }
      if (status === "success") {

        symbol = "fa-check-circle";
        text = this.translate("DONE");
        onClick = () => {

          this.setStatus("none");

        };
        this.autoHideTimer = setTimeout(
          () => {

            this.setStatus("none");

          },
          this.autoHideDelay
        );

      }
      if (message) {

        text = typeof message === "object"
          ? JSON.stringify(
            message,
            undefined,
            3
          )
          : message;

      }
      parent.append(this.createSymbolText(
        `fa fa-fw ${symbol}`,
        text,
        onClick
      ));

      document.querySelector("#result-overlay")?.classList.remove("hidden");
      document.querySelector("#result")?.classList.remove("hidden");

    },

    formatPosition (string) {

      return string.replaceAll(
        "_",
        " "
      ).replaceAll(
        /\w\S*/g,
        (txt) => txt.at(0).toUpperCase() + txt.slice(1).toLowerCase()
      );

    },

    openLink (url) {

      return () => window.open(
        url,
        "_blank"
      );

    },

    loadLinks () {

      const parent = document.querySelector("#links-container-nav");
      if (!parent) {

        return;

      }
      parent.replaceChildren();

      const items = [
        {"icon": "fa-book", "text": this.translate("API_DOCS"), "url": `${globalThis.location.origin}/api/docs/`},
        {"icon": "fa-globe", "text": this.translate("WEBSITE"), "url": "https://magicmirror.builders/"},
        {"icon": "fa-comments", "text": this.translate("FORUM"), "url": "https://forum.magicmirror.builders/"},
        {"icon": "fa-github", "text": this.translate("REPOSITORY"), "url": "https://github.com/Jopyth/MMM-Remote-Control"}
      ];

      for (const {icon, text, url} of items) {

        parent.append(this.createSymbolText(
          `fa fa-fw ${icon}`,
          text,
          this.openLink(url)
        ));

      }

    },

    createSymbolText (symbol, text, eventListener, element) {

      if (element === undefined) {

        element = "div";

      }
      const wrapper = document.createElement(element);
      if (eventListener) {

        wrapper.className = "button";
        wrapper.addEventListener(
          "click",
          eventListener,
          false
        );

      }
      wrapper.innerHTML = `<span class="${symbol}"></span><span class="symbol-text-padding">${text}</span>`;
      return wrapper;

    }

  }
);
