import {Remote} from "./remote.mjs";

/**
 * Config editor methods for MMM-Remote-Control.
 * Covers the module configuration popup, GUI builders, saving and restoring.
 */
Object.assign(
  Remote,
  {

    recreateConfigElement (key, previousType, newType) {

      const input = document.getElementById(key);
      let oldGUI = input.parentNode;
      if (previousType === "array" || previousType === "object") {

        oldGUI = input;

      }
      const path = key.split("/"),
        name = path.at(-1);

      let current = this.currentConfig;
      for (let index = 1; index < path.length - 1; index++) {

        current = current[path[index]];

      }
      const initialValue = this.values[this.types.indexOf(newType)],
        newGUI = this.createObjectGUI(
          key,
          name,
          initialValue
        );
      oldGUI.replaceWith(newGUI);

    },

    createTypeEditSelection (key, parent, type, oldElement) {

      const previousType = oldElement.children[1].innerHTML.slice(1).toLowerCase(),
        select = document.createElement("select");
      for (const typeOption of this.types) {

        const option = document.createElement("option");
        option.innerHTML = typeOption;
        option.value = typeOption;
        if (typeOption === type) {

          option.selected = true;

        }
        select.append(option);

      }
      select.addEventListener(
        "change",
        () => {

          const newType = select.options[select.selectedIndex].innerHTML.toLowerCase();
          if (previousType === newType) {

            select.replaceWith(oldElement);

          } else {

            this.recreateConfigElement(
              key,
              previousType,
              newType
            );

          }

        },
        false
      );
      select.addEventListener(
        "blur",
        () => {

          select.replaceWith(oldElement);

        },
        false
      );
      return select;

    },

    createConfigLabel (key, name, type, forcedType, symbol = "fa-tag") {

      if (name.at(0) === "#") {

        symbol = "fa-hashtag";
        name = name.slice(1);

      }
      const label = document.createElement("label");
      label.htmlFor = key;
      label.className = "config-label";
      const desc = Remote.createSymbolText(
        `fa fa-fw ${symbol}`,
        name,
        false,
        "span"
      );
      desc.className = "label-name";
      label.append(desc);

      if (!forcedType) {

        const typeLabel = Remote.createSymbolText(
          "fa fa-fw fa-pencil",
          type,
          (event) => {

            const thisElement = event.currentTarget;
            label.replaceChild(
              this.createTypeEditSelection(
                key,
                label,
                type,
                thisElement
              ),
              thisElement
            );

          },
          "span"
        );
        typeLabel.classList.add("module-remove");
        label.append(typeLabel);

        const remove = Remote.createSymbolText(
          "fa fa-fw fa-times-circle",
          this.translate("REMOVE"),
          (event) => {

            const thisElement = event.currentTarget,
              elementToRemove = type === "array" || type === "object"
                ? thisElement.parentNode.parentNode
                : thisElement.parentNode;
            elementToRemove.remove();

          },
          "span"
        );
        remove.classList.add("module-remove");
        label.append(remove);

      }
      return label;

    },

    createConfigInput (key, value, omitValue, element = "input") {

      const input = document.createElement(element);
      input.className = "config-input";
      if (!omitValue) {

        input.value = value;

      }
      input.id = key;
      input.addEventListener(
        "focus",
        (event) => {

          const label = event.currentTarget.parentNode;
          label.classList.add("highlight");

        },
        false
      );
      input.addEventListener(
        "blur",
        (event) => {

          const label = event.currentTarget.parentNode;
          label.classList.remove("highlight");

        },
        false
      );

      return input;

    },

    createVisualCheckbox (key, wrapper, input, className) {

      const visualCheckbox = document.createElement("span");
      visualCheckbox.className = `visual-checkbox fa fa-fw ${className}`;
      wrapper.append(visualCheckbox);

    },

    createConfigElement (type) {

      const makeDisabledInput = (typeName) => (key, name, value, type, forcedType) => {

        const label = this.createConfigLabel(
            key,
            name,
            type,
            forcedType
          ),
          input = this.createConfigInput(
            key,
            value
          );
        input.type = "text";
        input.disabled = "disabled";
        input.classList.add(
          "disabled",
          typeName
        );
        input.placeholder = typeName;
        label.append(input);
        return label;

      };
      return {
        "string": (key, name, value, type, forcedType) => {

          const label = this.createConfigLabel(
              key,
              name,
              type,
              forcedType
            ),
            input = this.createConfigInput(
              key,
              value
            );
          input.type = "text";
          label.append(input);
          if (key === "<root>/header") {

            input.placeholder = this.translate("NO_HEADER");

          }
          return label;

        },
        "number": (key, name, value, type, forcedType) => {

          const label = this.createConfigLabel(
              key,
              name,
              type,
              forcedType
            ),
            input = this.createConfigInput(
              key,
              value
            );
          input.type = "number";
          if (value % 1 !== 0) {

            input.step = 0.01;

          }
          label.append(input);
          return label;

        },
        "boolean": (key, name, value, type, forcedType) => {

          const label = this.createConfigLabel(
              key,
              name,
              type,
              forcedType
            ),

            input = this.createConfigInput(
              key,
              value,
              true
            );
          input.type = "checkbox";
          label.append(input);
          if (value) {

            input.checked = true;

          }

          this.createVisualCheckbox(
            key,
            label,
            input,
            "fa-check-square-o",
            false
          );
          this.createVisualCheckbox(
            key,
            label,
            input,
            "fa-square-o",
            true
          );
          return label;

        },
        "undefined": makeDisabledInput("undefined"),
        "null": makeDisabledInput("null"),
        "position": (key, name, value, type, forcedType) => {

          const label = this.createConfigLabel(
              key,
              name,
              type,
              forcedType
            ),
            select = this.createConfigInput(
              key,
              value,
              false,
              "select"
            );
          select.className = "config-input";
          select.id = key;
          for (const position of this.validPositions) {

            const option = document.createElement("option");
            option.value = position;
            option.innerHTML = position
              ? this.formatPosition(position)
              : this.translate("NO_POSITION");
            if (position === value) {

              option.selected = true;

            }
            select.append(option);

          }
          label.append(select);
          return label;

        }
      }[type];

    },

    getTypeAsString (dataToEdit, path) {

      let type = typeof dataToEdit;
      if (path === "<root>/position") {

        type = "position";

      }
      if (this.createConfigElement(type)) {

        return type;

      }
      if (Array.isArray(dataToEdit)) {

        return "array";

      }
      if (dataToEdit === null) {

        return "null";

      }
      if (dataToEdit === undefined) {

        return "undefined";

      }
      return "object";

    },

    hasForcedType (path) {

      let forcedType = false;
      if ((path.match(/\//g) || []).length === 1) {

        // Disable type editing in root layer
        forcedType = true;

      }
      return forcedType;

    },

    createObjectGUI (path, name, dataToEdit) {

      const type = this.getTypeAsString(
          dataToEdit,
          path
        ),
        forcedType = this.hasForcedType(path),
        leafElement = this.createConfigElement(type);
      if (leafElement) {

        // Recursion stop
        return leafElement(
          path,
          name,
          dataToEdit,
          type,
          forcedType
        );

      }

      // Object and array
      const wrapper = document.createElement("div");
      wrapper.id = path;
      wrapper.className = `indent config-input ${type}`;
      if (type === "array") {

        // Array
        const add = this.createSymbolText(
          "fa fa-fw fa-plus",
          this.translate("ADD_ENTRY")
        );
        add.classList.add(
          "bottom-spacing",
          "button"
        );
        wrapper.append(this.createConfigLabel(
          path,
          name,
          type,
          forcedType,
          "fa-list-ol"
        ));
        wrapper.append(add);
        for (const [index, item] of dataToEdit.entries()) {

          const newName = `#${index}`;
          wrapper.append(this.createObjectGUI(
            `${path}/${newName}`,
            newName,
            item
          ));

        }
        add.addEventListener(
          "click",
          () => {

            const lastIndex = dataToEdit.length - 1,
              lastType = this.getTypeAsString(
                `${path}/#${lastIndex}`,
                dataToEdit[lastIndex]
              );
            dataToEdit.push(this.values[this.types.indexOf(lastType)]);
            const nextName = `#${lastIndex + 1}`;
            wrapper.append(this.createObjectGUI(
              `${path}/${nextName}`,
              nextName,
              dataToEdit.at(-1)
            ));

          },
          false
        );
        return wrapper;

      }

      // Object
      if (path !== "<root>") {

        wrapper.append(this.createConfigLabel(
          path,
          name,
          type,
          forcedType,
          "fa-list-ul"
        ));

        const addElement = this.createConfigLabel(
          `${path}/<add>`,
          this.translate("ADD_ENTRY"),
          type,
          true,
          "fa-plus"
        );
        addElement.classList.add("bottom-spacing");
        const inputWrapper = document.createElement("div");
        inputWrapper.className = "add-input-wrapper";
        const input = this.createConfigInput(
          `${path}/<add>`,
          ""
        );
        input.type = "text";
        input.placeholder = this.translate("NEW_ENTRY_NAME");
        addElement.append(inputWrapper);
        inputWrapper.append(input);
        const addFunction = () => {

            const existingKey = Object.keys(dataToEdit)[0],
              lastType = this.getTypeAsString(
                `${path}/${existingKey}`,
                dataToEdit[existingKey]
              ),
              key = input.value.trim();

            if (!key || document.getElementById(`${path}/${key}`)) {

              input.classList.add("input-error");
              return;

            }

            input.classList.remove("input-error");
            dataToEdit[key] = this.values[this.types.indexOf(lastType)];
            const newElement = this.createObjectGUI(
              `${path}/${key}`,
              key,
              dataToEdit[key]
            );
            addElement.after(newElement);
            input.value = "";

          },
          symbol = document.createElement("span");
        symbol.className = "fa fa-fw fa-plus-square button";
        symbol.addEventListener(
          "click",
          addFunction,
          false
        );
        inputWrapper.append(symbol);
        input.addEventListener(
          "keydown",
          (event) => {

            if (event.key === "Enter") {

              event.preventDefault();
              addFunction();

            }

          }
        );
        wrapper.append(addElement);

      }
      let keys = Object.keys(dataToEdit);
      if (path === "<root>") {

        keys = [
          "module",
          "disabled",
          "position",
          "header",
          "config"
        ];

      }
      for (const key of keys) {

        if (Object.hasOwn(
          dataToEdit,
          key
        )) {

          wrapper.append(this.createObjectGUI(
            `${path}/${key}`,
            key,
            dataToEdit[key]
          ));

        }

      }
      if (path === "<root>") {

        // Additional css classes on root element
        wrapper.className = "flex-fill small";

      }
      return wrapper;

    },

    appendConfigMenu (index, wrapper) {

      const menuDiv = document.createElement("div");
      menuDiv.className = "fixed-size sub-menu";

      const help = this.createSymbolText(
        "fa fa-fw fa-question-circle",
        this.translate("HELP"),
        () => {

          window.open(
            `config-help.html?module=${this.currentConfig.module}`,
            "_blank"
          );

        }
      );
      menuDiv.append(help);
      const undo = this.createSymbolText(
        "fa fa-fw fa-undo",
        this.translate("RESET"),
        () => {

          this.createConfigPopup(index);

        }
      );
      menuDiv.append(undo);
      const save = this.createSymbolText(
        "fa fa-fw fa-save",
        this.translate("SAVE"),
        () => {

          this.savedData.config.modules[index] = this.getModuleConfigFromUI();
          this.changedModules.push(index);
          const parent = document.getElementById(`edit-module-${index}`).parentNode;
          if (parent.children.length === 2) {

            parent.insertBefore(
              this.createChangedWarning(),
              parent.children[1]
            );

          }
          this.closePopup();

        }
      );
      menuDiv.append(save);

      wrapper.append(menuDiv);

    },

    setValue (parent, name, value) {

      if (name.includes("#")) {

        parent.push(value);

      } else {

        parent[name] = value;

      }

    },

    navigate (parent, name) {

      if (name.includes("#")) {

        return parent.at(-1);

      }
      return parent[name];

    },

    getModuleConfigFromUI () {

      const rootElement = {},
        elements = [...document.querySelectorAll(".config-input")];
      for (const element of elements) {

        const path = element.id,
          splitPath = path.split("/");
        let parent = rootElement;
        for (let k = 1; k < splitPath.length - 1; k++) {

          parent = this.navigate(
            parent,
            splitPath[k]
          );

        }
        const name = splitPath.at(-1);
        if (element.classList.contains("null")) {

          this.setValue(
            parent,
            name,
            null
          );
          continue;

        }
        if (element.classList.contains("undefined")) {

          this.setValue(
            parent,
            name,
            undefined
          );
          continue;

        }
        if (element.classList.contains("array")) {

          this.setValue(
            parent,
            name,
            []
          );
          continue;

        }
        if (element.classList.contains("object")) {

          this.setValue(
            parent,
            name,
            {}
          );
          continue;

        }

        let {value} = element;
        if (name === "<add>" || path === "<root>/position" && value === "") {

          continue;

        }
        if (element.type === "checkbox") {

          value = element.checked;

        }
        if (element.type === "number") {

          value = Number.parseFloat(value);

        }
        this.setValue(
          parent,
          name,
          value
        );

      }
      return rootElement;

    },

    createConfigPopup (index) {

      if (typeof index === "string") {

        index = Number.parseInt(index);

      }

      const moduleData = this.savedData.config.modules,
        data = moduleData[index];

      this.currentConfig = data;
      if (!("header" in this.currentConfig)) {

        this.currentConfig.header = "";

      }
      if (!("position" in this.currentConfig)) {

        this.currentConfig.position = "";

      }

      const wrapper = this.getPopupContent();

      wrapper.insertAdjacentHTML(
        "beforeend",
        `
      <div class="bright title medium">${data.module}</div>
      <div class="subtitle xsmall dimmed">${data.module} (#${index + 1})</div>
    `
      );

      this.appendConfigMenu(
        index,
        wrapper
      );

      wrapper.append(this.createObjectGUI(
        "<root>",
        "",
        this.currentConfig
      ));

      // Disable input for module name
      const moduleInput = document.querySelector("#<root>/module");
      moduleInput.disabled = true;
      moduleInput.classList.add("disabled");

      this.showPopup();

    },

    createChangedWarning () {

      const changed = Remote.createSymbolText(
        "fa fa-fw fa-warning",
        this.translate("UNSAVED_CHANGES"),
        () => {

          const saveButton = document.querySelector("#save-config");
          if (!saveButton.classList.contains("highlight")) {

            saveButton.classList.add("highlight");

          }

        },
        "span"
      );
      changed.classList.add("module-remove");
      return changed;

    },

    appendModuleEditElements (wrapper, moduleData) {

      for (const [index, data] of moduleData.entries()) {

        wrapper.insertAdjacentHTML(
          "beforeend",
          `
        <div class="module-line" data-module-index="${index}">
          <div class="module-name">${data.module}</div>
          <div class="module-buttons"></div>
        </div>
      `
        );
        const buttonsContainer = wrapper.lastElementChild.querySelector(".module-buttons");

        this.getModuleUrl(data.module).then((url) => {

          if (url) {

            const repoButton = this.createSymbolText(
              "fa fa-fw fa-github",
              this.translate("REPOSITORY"),
              () => {

                window.open(
                  url,
                  "_blank"
                );

              },
              "span"
            );
            repoButton.className = "button";
            buttonsContainer.insertBefore(
              repoButton,
              buttonsContainer.firstChild
            );

          }

        });

        const editButton = this.createSymbolText(
          "fa fa-fw fa-pencil",
          this.translate("EDIT"),
          (event) => {

            const index_ = event.currentTarget.closest(".module-line").dataset.moduleIndex;
            this.createConfigPopup(index_);

          },
          "span"
        );
        editButton.id = `edit-module-${index}`;
        buttonsContainer.append(editButton);

        if (this.changedModules.includes(index)) {

          buttonsContainer.append(this.createChangedWarning());

        }

        const remove = Remote.createSymbolText(
          "fa fa-fw fa-times-circle",
          this.translate("REMOVE"),
          (event) => {

            const line = event.currentTarget.closest(".module-line");
            this.deletedModules.push(Number.parseInt(line.dataset.moduleIndex));
            line.remove();

          },
          "span"
        );
        remove.classList.add("module-remove");
        buttonsContainer.append(remove);

      }

    },

    async loadConfigModules () {

      this.changedModules = [];

      try {

        const {"data": configData} = await this.loadList(
            "config-modules",
            "config"
          ),
          parent = document.querySelector("#config-modules-results"),
          moduleData = configData.modules;
        if (this.addModule) {

          const name = this.addModule;
          // We came here from adding a module
          try {

            const response = await this.get(
                "get",
                `data=defaultConfig&module=${name}`
              ),
              newData = JSON.parse(response);
            moduleData.push({"module": name, "config": newData.data});
            const index = moduleData.length - 1;
            this.changedModules.push(index);
            this.appendModuleEditElements(
              parent,
              moduleData
            );
            this.createConfigPopup(index);

          } catch (error) {

            console.error(
              "Error loading default config:",
              error
            );

          }
          this.addModule = "";

        } else {

          this.appendModuleEditElements(
            parent,
            moduleData
          );

        }

      } catch (error) {

        console.error(
          "Error loading config modules:",
          error
        );

      }

    },

    restoreConfigMenu () {

      if (this.saving) {

        return;

      }
      const restoreButton = document.querySelector("#restore-config");
      restoreButton.classList.remove("highlight");
      this.setStatus("loading");
      this.getData("saves");

    },

    handleRestoreConfigMenu (result) {

      if (result.success) {

        const dates = {};
        for (const index in result.data) {

          dates[new Date(result.data[index])] = () => {

            this.restoreConfig(result.data[index]);

          };

        }
        this.offerOptions(
          this.translate("RESTORE"),
          dates
        );

      } else {

        this.setStatus("error");

      }

    },

    restoreConfig (date) {

      // Prevent saving before current saving is finished
      if (this.saving) {

        return;

      }
      this.saving = true;
      this.setStatus("loading");

      this.sendSocketNotification(
        "UNDO_CONFIG",
        date
      );

    },

    saveConfig () {

      // Prevent saving before current saving is finished
      if (this.saving) {

        return;

      }
      const saveButton = document.querySelector("#save-config");
      saveButton.classList.remove("highlight");
      this.saving = true;
      this.setStatus("loading");
      const configData = this.savedData.config;
      configData.modules = configData.modules.filter((_, index) => !this.deletedModules.includes(index));
      this.deletedModules = [];
      this.sendSocketNotification(
        "NEW_CONFIG",
        configData
      );

    },

    handleSaveConfig (result) {

      if (result.success) {

        this.offerReload(this.translate("DONE"));

      } else {

        this.setStatus("error");

      }
      this.saving = false;
      this.loadConfigModules();

    }

  }
);
