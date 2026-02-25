import {Remote} from "./remote.mjs";
import {marked} from "marked";

/**
 * Module management methods for MMM-Remote-Control.
 * Covers module visibility toggling, installing, updating, and class management.
 */
Object.assign(
  Remote,
  {

    showModule (id, force) {

      if (force) {

        this.action("SHOW", {"force": true, "module": id});

      } else {

        this.action("SHOW", {"module": id});

      }

    },

    hideModule (id) {

      this.action("HIDE", {"module": id});

    },

    install (url, index) {

      const downloadButton = document.querySelector("#download-button"),
        icon = downloadButton.querySelector("span:first-child"),
        text = downloadButton.querySelector("span:last-child");

      if (icon) {

        icon.classList.remove("fa-download");
        icon.classList.add(
          "fa-spinner",
          "fa-pulse"
        );

      }

      if (text) {

        text.innerHTML = ` ${this.translate("DOWNLOADING")}`;

      }

      this.action("INSTALL", {url, index});

    },

    handleInstall (result) {

      if (result.success) {

        const bgElement = document.getElementById(`install-module-${result.index}`);
        bgElement.firstChild.className = "fa fa-fw fa-check-circle";
        this.savedData.moduleAvailable[result.index].installed = true;
        this.createAddingPopup(result.index);

      }

    },

    getVisibilityStatus (data) {

      let status = "toggled-on";
      const modules = [];
      if (data.hidden) {

        status = "toggled-off";
        for (const lockString of data.lockStrings) {

          if (lockString.includes("MMM-Remote-Control")) {

            continue;

          }
          modules.push(lockString);
          if (modules.length === 1) {

            status += " external-locked";

          }

        }

      }
      return {status, "modules": modules.join(", ")};

    },

    /**
     * Determines the status of a class based on visible/hidden modules
     * @param {object} classData - Class data with show/hide/toggle arrays
     * @returns {object} Status object with status and details
     */
    getClassStatus (classData) {

      if (!classData || !this.savedData.modules) {

        return {"status": "unknown", "details": ""};

      }

      // Create map for fast module access
      const moduleMap = {};
      for (const module of this.savedData.modules) {

        moduleMap[module.name] = module;
        moduleMap[module.identifier] = module;

      }

      let hiddenCount = 0,
        totalCount = 0,
        visibleCount = 0;

      // Check show modules
      if (classData.show) {

        const showModules = Array.isArray(classData.show)
          ? classData.show
          : [classData.show];
        for (const moduleName of showModules) {

          const module = moduleMap[moduleName];
          if (module) {

            totalCount++;
            if (module.hidden) {

              hiddenCount++;

            } else {

              visibleCount++;

            }

          }

        }

      }

      // Check hide modules
      if (classData.hide) {

        const hideModules = Array.isArray(classData.hide)
          ? classData.hide
          : [classData.hide];
        for (const moduleName of hideModules) {

          const module = moduleMap[moduleName];
          if (module) {

            totalCount++;
            if (module.hidden) {

              hiddenCount++;

            } else {

              visibleCount++;

            }

          }

        }

      }

      // Check toggle modules (we just show if they're visible/hidden)
      if (classData.toggle) {

        const toggleModules = Array.isArray(classData.toggle)
          ? classData.toggle
          : [classData.toggle];
        for (const moduleName of toggleModules) {

          const module = moduleMap[moduleName];
          if (module) {

            totalCount++;
            if (module.hidden) {

              hiddenCount++;

            } else {

              visibleCount++;

            }

          }

        }

      }

      // Determine status
      let status = "class-mixed";
      if (totalCount === 0) {

        status = "class-empty";

      } else if (hiddenCount === 0 && visibleCount > 0) {

        status = "class-active";

      } else if (visibleCount === 0 && hiddenCount > 0) {

        status = "class-inactive";

      }

      return {
        status,
        "details": `${visibleCount}/${totalCount}`,
        visibleCount,
        hiddenCount,
        totalCount
      };

    },

    async loadVisibleModules () {

      try {

        const {"data": moduleData} = await this.loadList(
            "visible-modules",
            "modules"
          ),
          parent = document.querySelector("#visible-modules-results");
        for (const module of moduleData) {

          if (!module.position) {

            // Skip invisible modules
            continue;

          }
          const visibilityStatus = this.getVisibilityStatus(module),
            label = "header" in module
              ? ` ${module.name} (${module.header})`
              : ` ${module.name}`;
          parent.insertAdjacentHTML(
            "beforeend",
            `
          <div class="button module-line ${visibilityStatus.status}" id="${module.identifier}">
            <span class="stack fa-fw">
              <span class="fa fa-fw fa-toggle-on outer-label fa-stack-1x"></span>
              <span class="fa fa-fw fa-toggle-off outer-label fa-stack-1x"></span>
              <span class="fa fa-fw fa-lock inner-small-label fa-stack-1x"></span>
            </span>
            <span class="text">${label}</span>
          </div>
        `
          );
          this.makeToggleButton(
            parent.lastElementChild,
            visibilityStatus
          );

        }

      } catch (error) {

        console.error(
          "Error loading visible modules:",
          error
        );

      }

    },

    loadBrightness () {

      this.getData("brightness");

    },

    loadTemp () {

      this.getData("temp");

    },

    loadZoom () {

      this.getData("zoom");

    },

    loadBackgroundColor () {

      this.getData("backgroundColor");

    },

    loadFontColor () {

      this.getData("fontColor");

    },

    makeToggleButton (moduleBox, visibilityStatus) {

      moduleBox.addEventListener(
        "click",
        (event) => {

          if (event.currentTarget.classList.contains("toggled-off")) {

            if (event.currentTarget.classList.contains("external-locked")) {

              const wrapper = document.createElement("div");
              wrapper.innerHTML = `<span>${this.translate("LOCKSTRING_WARNING").replace(
                "LIST_OF_MODULES",
                visibilityStatus.modules
              )}</span>`;

              const ok = this.createSymbolText(
                "fa fa-check-circle",
                this.translate("OK"),
                () => {

                  this.setStatus("none");

                }
              );
              wrapper.append(ok);

              const force = this.createSymbolText(
                "fa fa-warning",
                this.translate("FORCE_SHOW"),
                () => {

                  event.currentTarget.classList.remove(
                    "external-locked",
                    "toggled-off"
                  );
                  event.currentTarget.classList.add("toggled-on");
                  this.showModule(
                    event.currentTarget.id,
                    true
                  );
                  this.setStatus("none");

                }
              );
              wrapper.append(force);

              this.setStatus(
                "error",
                false,
                wrapper
              );

            } else {

              event.currentTarget.classList.remove("toggled-off");
              event.currentTarget.classList.add("toggled-on");
              this.showModule(event.currentTarget.id);

            }

          } else {

            event.currentTarget.classList.remove("toggled-on");
            event.currentTarget.classList.add("toggled-off");
            this.hideModule(event.currentTarget.id);

          }

        }
      );

    },

    loadInstalledModulesCache () {

      if (this.installedModulesCachePromise) {

        return this.installedModulesCachePromise;

      }

      this.installedModulesCachePromise = new Promise((resolve) => {

        const handleResponse = (result) => {

          this.installedModulesCache = result.success && result.data
            ? result.data
            : [];
          resolve();

        };

        // Temporarily store the resolver
        this.installedModulesCacheResolver = handleResponse;
        this.getData("moduleInstalled");

      });

      return this.installedModulesCachePromise;

    },

    async getModuleUrl (moduleName) {

      try {

        if (!this.installedModulesCache) {

          await this.loadInstalledModulesCache();

        }
        const module = this.installedModulesCache.find((m) => m.name === moduleName);
        return module?.url || "";

      } catch (error) {

        console.error(
          "Error loading module URL:",
          error
        );
        return "";

      }

    },

    async loadClasses () {

      try {

        // Always reload module data to get fresh status
        const {"data": moduleData} = await this.loadList(
          "visible-modules",
          "modules"
        );
        this.savedData.modules = moduleData;
        const {"data": classes} = await this.loadList(
          "classes",
          "classes"
        );

        for (const index in classes) {

          const node = document.createElement("div");
          node.id = "classes-before-result";
          node.hidden = true;
          document.querySelector("#classes-results").append(node);

          const content = {
              "id": index,
              "text": index,
              "icon": "dot-circle-o",
              "type": "item",
              "action": "MANAGE_CLASSES",
              "content": {
                "payload": {
                  "classes": index
                }
              },
              "classData": classes[index] // Store class data for status checking
            },

            existingButton = document.getElementById(`${content.id}-button`);
          if (existingButton) {

            existingButton.remove();

          }

          this.createMenuElement(
            content,
            "classes",
            node
          );

        }

      } catch (error) {

        console.error(
          "Error loading classes:",
          error
        );

      }

    },

    addClassStatusBadge (item, classData) {

      const classStatus = this.getClassStatus(classData),
        statusBadge = document.createElement("span");
      statusBadge.className = `class-status-badge ${classStatus.status}`;
      statusBadge.textContent = classStatus.details;
      statusBadge.title = `${classStatus.visibleCount} visible, ${classStatus.hiddenCount} hidden`;
      item.append(statusBadge);
      item.classList.add(classStatus.status);

    },

    createAddingPopup (index) {

      if (typeof index === "string") {

        index = Number.parseInt(index);

      }

      const data = this.savedData.moduleAvailable[index],
        wrapper = this.getPopupContent();

      wrapper.insertAdjacentHTML(
        "beforeend",
        `
      <div class="bright title">${data.name}</div>
      <div class="subtitle small">${this.translate("BY")} ${data.maintainer}</div>
      <div class="small flex-fill">${data.description}</div>
    `
      );

      const footer = document.createElement("div");
      footer.className = "fixed-size sub-menu";

      if (data.installed) {

        const add = this.createSymbolText(
          "fa fa-fw fa-plus",
          this.translate("ADD_THIS"),
          () => {

            this.closePopup();
            this.addModule = data.name;
            globalThis.location.hash = "settings-menu";

          }
        );
        footer.append(add);

      }

      if (data.installed) {

        footer.append(this.createSymbolText(
          "fa fa-fw fa-check-circle",
          this.translate("INSTALLED")
        ));

      } else {

        const download = this.createSymbolText(
          "fa fa-fw fa-download",
          this.translate("DOWNLOAD"),
          () => {

            this.install(
              data.url,
              index
            );

          }
        );
        download.id = "download-button";
        footer.append(download);

      }

      const githubElement = this.createSymbolText(
        "fa fa-fw fa-github",
        this.translate("CODE_LINK"),
        () => {

          window.open(
            data.url,
            "_blank"
          );

        }
      );
      footer.append(githubElement);
      wrapper.append(footer);
      this.showPopup();

    },

    async loadModulesToAdd () {

      try {

        const {"data": modules} = await this.loadList(
            "add-module",
            "moduleAvailable"
          ),
          parent = document.querySelector("#add-module-results");
        for (const [index, module] of modules.entries()) {

          parent.insertAdjacentHTML(
            "beforeend",
            `
          <div class="module-line">
            <div class="module-info">
              <div class="module-name">${module.name}</div>
              ${module.description
                ? `<div class="module-description">${module.description}</div>`
                : ""}
            </div>
            <div class="module-buttons"></div>
          </div>
        `
          );
          const buttonsContainer = parent.lastElementChild.querySelector(".module-buttons");

          if (module.url) {

            const repoButton = this.createSymbolText(
              "fa fa-fw fa-github",
              "Repository",
              () => {

                window.open(
                  module.url,
                  "_blank"
                );

              },
              "span"
            );
            repoButton.className = "button";
            buttonsContainer.append(repoButton);

          }

          const symbol = module.installed
              ? "fa fa-fw fa-check-circle"
              : "fa fa-fw fa-cloud",
            buttonText = module.installed
              ? "Installed"
              : "Install",
            installButton = this.createSymbolText(
              symbol,
              buttonText,
              (event) => {

                const index_ = event.currentTarget.id.replace(
                  "install-module-",
                  ""
                );
                this.createAddingPopup(index_);

              },
              "span"
            );
          installButton.className = "button";
          installButton.id = `install-module-${index}`;
          buttonsContainer.append(installButton);

        }

      } catch (error) {

        console.error(
          "Error loading modules to add:",
          error
        );

      }

    },

    offerRestart (message) {

      const wrapper = document.createElement("div");
      wrapper.innerHTML = `<span>${message}</span>`;
      const restart = this.createSymbolText(
        "fa fa-fw fa-recycle",
        this.translate("RESTARTMM"),
        this.buttons["restart-mm-button"]
      );
      restart.children[1].classList.add("text");
      wrapper.append(restart);
      this.setStatus(
        "success",
        false,
        wrapper
      );

    },

    offerReload (message) {

      const wrapper = document.createElement("div");
      wrapper.innerHTML = `<span>${message}</span>`;
      const restart = this.createSymbolText(
        "fa fa-fw fa-recycle",
        this.translate("RESTARTMM"),
        this.buttons["restart-mm-button"]
      );
      restart.children[1].classList.add("text");
      wrapper.append(restart);
      const reload = this.createSymbolText(
        "fa fa-fw fa-globe",
        this.translate("REFRESHMM"),
        this.buttons["refresh-mm-button"]
      );
      reload.children[1].classList.add("text");
      wrapper.append(reload);
      this.setStatus(
        "success",
        false,
        wrapper
      );

    },

    offerOptions (message, data) {

      const wrapper = document.createElement("div");
      wrapper.innerHTML = `<span>${message}</span>`;
      for (const b in data) {

        const button = this.createSymbolText(
          "fa fa-fw fa-recycle",
          b,
          data[b]
        );
        button.children[1].classList.add("text");
        wrapper.append(button);

      }
      this.setStatus(
        "success",
        false,
        wrapper
      );

    },

    updateModule (module) {

      this.action("UPDATE", {module});

    },

    handleMmUpdate (result) {

      if (globalThis.location.hash.slice(1) == "update-menu") {

        const updateButton = document.querySelector("#update-mm-button");
        if (result) {

          updateButton?.classList.remove("hidden");
          updateButton?.classList.add("bright");

        } else {

          updateButton?.classList.add("hidden");
          updateButton?.classList.remove("bright");

        }

      }

    },

    async loadModulesToUpdate () {

      this.getData("mmUpdateAvailable");

      try {

        const {"data": modules} = await this.loadList(
            "update-module",
            "moduleInstalled"
          ),
          parent = document.querySelector("#update-module-results");

        // MagicMirror² row
        parent.insertAdjacentHTML(
          "beforeend",
          `
        <div class="module-line mm-update-line" id="mm-update-container">
          <div class="module-name">MagicMirror²</div>
          <div class="module-buttons"></div>
        </div>
      `
        );
        const mmButtons = parent.lastElementChild.querySelector(".module-buttons"),

          mmUpdateButton = this.createSymbolText(
            "fa fa-fw fa-toggle-up",
            "Update",
            () => {

              this.updateModule();

            }
          );
        mmUpdateButton.id = "update-mm-button";
        mmUpdateButton.className = "button hidden";
        mmButtons.append(mmUpdateButton);

        const mmChangelogButton = this.createSymbolText(
          "fa fa-fw fa-file-text-o",
          "Changelog",
          () => {

            window.open(
              "https://github.com/MagicMirrorOrg/MagicMirror/releases",
              "_blank"
            );

          }
        );
        mmChangelogButton.className = "button";
        mmButtons.append(mmChangelogButton);

        // Module rows
        for (const module of modules) {

          parent.insertAdjacentHTML(
            "beforeend",
            `
          <div class="module-line">
            <div class="module-name">${module.name}</div>
            <div class="module-buttons"></div>
          </div>
        `
          );
          const buttonsContainer = parent.lastElementChild.querySelector(".module-buttons");

          if (module.updateAvailable) {

            const updateButton = this.createSymbolText(
              "fa fa-fw fa-toggle-up",
              "Update",
              (event) => {

                const moduleName = event.currentTarget.id.replace(
                  "update-module-",
                  ""
                );
                this.updateModule(moduleName);

              }
            );
            updateButton.className = "button bright";
            updateButton.id = `update-module-${module.name}`;
            buttonsContainer.append(updateButton);

          }

          if (module.hasChangelog) {

            const changelogButton = this.createSymbolText(
              "fa fa-fw fa-file-text-o",
              "Changelog",
              (event) => {

                event.stopPropagation();
                this.showChangelog(module.name);

              }
            );
            changelogButton.className = "button";
            buttonsContainer.append(changelogButton);

          }

        }

      } catch (error) {

        console.error(
          "Error loading modules to update:",
          error
        );

      }

    },

    showChangelog (moduleName) {

      this.setStatus("loading");
      this.action("GET_CHANGELOG", {"module": moduleName});

    },

    handleShowChangelog (result) {

      if (result.success && result.changelog) {

        const wrapper = document.createElement("div");
        wrapper.innerHTML = `<h3>${result.module || "Changelog"}</h3><div id='changelog'>${marked.parse(result.changelog)}</div>`;
        this.setStatus(
          "success",
          false,
          wrapper
        );

      } else {

        this.setStatus(
          "error",
          "Changelog not found"
        );

      }

    }

  }
);
