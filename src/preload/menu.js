const { ipcRenderer } = require("electron");
const fs = require("fs");
const path = require("path");
const { version } = require("../../package.json");

class Menu {
  constructor() {
    this.settings = ipcRenderer.sendSync("get-settings");
    this.menuCSS = fs.readFileSync(
      path.join(__dirname, "../assets/css/menu.css"),
      "utf8"
    );
    this.menuHTML = fs.readFileSync(
      path.join(__dirname, "../assets/html/menu.html"),
      "utf8"
    );
    this.menu = this.createMenu();
    this.localStorage = window.localStorage;
    this.menuToggle = this.menu.querySelector(".menu");
    this.tabToContentMap = {
      ui: this.menu.querySelector("#ui-options"),
      game: this.menu.querySelector("#game-options"),
      performance: this.menu.querySelector("#performance-options"),
      client: this.menu.querySelector("#client-options"),
      scripts: this.menu.querySelector("#scripts-options"),
      about: this.menu.querySelector("#about-client"),
      assets: this.menu.querySelector("#assets-options"),
      news: this.menu.querySelector("#news-options"),
    };
  }

  createMenu() {
    const menu = document.createElement("div");
    menu.innerHTML = this.menuHTML;
    menu.id = "juice-menu";
    menu.style.cssText = "z-index: 99999999; position: fixed;";
    const menuCSS = document.createElement("style");
    menuCSS.innerHTML = this.menuCSS;
    menu.prepend(menuCSS);
    document.body.appendChild(menu);
    return menu;
  }

  init() {
    this.setVersion();
    this.setUser();
    this.setKeybind();
    this.setTheme();
    this.applyWatermark();
    this.handleKeyEvents();
    this.initMenu();
    this.handleMenuKeybindChange();
    this.handleMenuInputChanges();
    this.handleMenuSelectChanges();
    this.handleTabChanges();
    this.handleDropdowns();
    this.handleSearch();
    this.handleButtons();
    this.handleCustomTheme();
    this.handleDragAndPosition();
    this.handleAboutLinks();
    this.initAssets();
    this.initNews();
    this.localStorage.getItem("juice-menu-tab")
      ? this.handleTabChange(
          this.menu.querySelector(
            `[data-tab="${this.localStorage.getItem("juice-menu-tab")}"]`
          )
        )
      : this.handleTabChange(this.menu.querySelector(".juice.tab"));
  }

  setVersion() {
    this.menu.querySelectorAll(".ver").forEach((element) => {
      element.innerText = `v${version}`;
    });
  }

  setUser() {
    const user = JSON.parse(this.localStorage.getItem("current-user"));
    if (user) {
      this.menu.querySelector(".user").innerText = `${user.name}#${user.shortId}`;
    }
  }

  setKeybind() {
    this.menu.querySelector(
      ".keybind"
    ).innerText = `Press ${this.settings.menu_keybind} to toggle menu`;
    if (!this.localStorage.getItem("juice-menu")) {
      this.localStorage.setItem(
        "juice-menu",
        this.menuToggle.getAttribute("data-active")
      );
    } else {
      this.menuToggle.setAttribute(
        "data-active",
        this.localStorage.getItem("juice-menu")
      );
    }
  }

  setTheme() {
    const menuEl = this.menu.querySelector(".menu");
    menuEl.setAttribute("data-theme", this.settings.menu_theme);

    const customPanel = this.menu.querySelector("#custom-theme-options");
    if (customPanel) {
      customPanel.style.display =
        this.settings.menu_theme === "custom" ? "flex" : "none";
    }

    this.applyCustomTheme();
    this.applyMenuOpacity();
  }

  applyMenuOpacity() {
    const menuEl = this.menu.querySelector(".menu");
    if (!menuEl) return;
    const raw = parseInt(this.settings.menu_opacity, 10);
    const alpha = (isNaN(raw) ? 100 : raw) / 100;
    menuEl.style.setProperty("--menu-bg-alpha", alpha);
  }

  applyCustomTheme() {
    const menuEl = this.menu.querySelector(".menu");
    if (!menuEl) return;

    if (this.settings.menu_theme !== "custom") {
      const props = [
        "font-family",
        "--dark",
        "--light",
        "--orange",
        "--green",
        "--blue",
        "--red",
        "--hover-dark",
        "--hover-light",
        "--border",
        "--border-active",
        "--shadow",
        "--opacity-half",
        "--opacity-quarter",
      ];
      for (const p of props) menuEl.style.removeProperty(p);
      if (this._customThemeStyleEl) {
        this._customThemeStyleEl.innerHTML = "";
      }
      return;
    }

    const hexToRgb = (hex) => {
      const v = (hex || "#000000").replace("#", "");
      return [
        parseInt(v.substring(0, 2), 16) || 0,
        parseInt(v.substring(2, 4), 16) || 0,
        parseInt(v.substring(4, 6), 16) || 0,
      ];
    };

    const [br, bg, bb] = hexToRgb(this.settings.custom_theme_bg);
    const [tr, tg, tb] = hexToRgb(this.settings.custom_theme_text);
    const [ar, ag, ab] = hexToRgb(this.settings.custom_theme_accent);
    const [borderR, borderG, borderB] = hexToRgb(
      this.settings.custom_theme_border
    );
    const [dr, dg, db] = hexToRgb(this.settings.custom_theme_danger);

    const lerp = (a, b, t) => Math.round(a + (b - a) * t);
    const hr = lerp(br, tr, 0.06);
    const hg = lerp(bg, tg, 0.06);
    const hb = lerp(bb, tb, 0.06);

    menuEl.style.setProperty("--dark", `${br}, ${bg}, ${bb}`);
    menuEl.style.setProperty("--light", `${tr}, ${tg}, ${tb}`);
    menuEl.style.setProperty("--orange", `${ar}, ${ag}, ${ab}`);
    menuEl.style.setProperty("--green", `${ar}, ${ag}, ${ab}`);
    menuEl.style.setProperty("--blue", `${ar}, ${ag}, ${ab}`);
    menuEl.style.setProperty("--red", `${dr}, ${dg}, ${db}`);
    menuEl.style.setProperty("--hover-dark", `${hr}, ${hg}, ${hb}`);
    menuEl.style.setProperty("--hover-light", `${tr}, ${tg}, ${tb}, 0.05`);
    menuEl.style.setProperty(
      "--border",
      `${borderR}, ${borderG}, ${borderB}, 0.15`
    );
    menuEl.style.setProperty(
      "--border-active",
      `${borderR}, ${borderG}, ${borderB}, 0.25`
    );
    menuEl.style.setProperty("--opacity-half", `${tr}, ${tg}, ${tb}, 0.5`);
    menuEl.style.setProperty("--opacity-quarter", `${tr}, ${tg}, ${tb}, 0.25`);

    const fontFamily = this.resolveCustomFontFamily();
    menuEl.style.fontFamily = `"${fontFamily}", sans-serif`;
    this.refreshCustomFontStyle(fontFamily);
  }

  resolveCustomFontFamily() {
    const FONTS = {
      satoshi: "Satoshi",
      inter: "Inter",
      poppins: "Poppins",
      montserrat: "Montserrat",
      "jetbrains-mono": "JetBrains Mono",
      "press-start-2p": "Press Start 2P",
      forza: "Forza",
    };
    const key = this.settings.custom_theme_font;
    if (key === "custom") {
      const customPath = this.settings.custom_theme_custom_font;
      if (customPath) {
        return path.basename(customPath).replace(/\.[^.]+$/, "");
      }
      return "Satoshi";
    }
    return FONTS[key] || "Satoshi";
  }

  refreshCustomFontStyle(fontFamily) {
    if (!this._customThemeStyleEl) {
      this._customThemeStyleEl = document.createElement("style");
      this._customThemeStyleEl.id = "juice-custom-theme-style";
      document.head.appendChild(this._customThemeStyleEl);
    }

    let css = "";
    const customPath = this.settings.custom_theme_custom_font;
    if (customPath) {
      const uploadedFamily = path
        .basename(customPath)
        .replace(/\.[^.]+$/, "");
      const url = "file:///" + customPath.replace(/\\/g, "/");
      css += `@font-face { font-family: "${uploadedFamily}"; src: url("${url}"); }\n`;
    }

    css += `.menu[data-theme="custom"], .menu[data-theme="custom"] input, .menu[data-theme="custom"] textarea, .menu[data-theme="custom"] select, .menu[data-theme="custom"] button, .menu[data-theme="custom"] .change-keybind { font-family: "${fontFamily}", sans-serif !important; }\n`;

    this._customThemeStyleEl.innerHTML = css;
  }

  handleCustomTheme() {
    const statusEl = this.menu.querySelector("#custom-font-status");
    const removeBtn = this.menu.querySelector("#remove-custom-font");
    const uploadBtn = this.menu.querySelector("#upload-custom-font");
    if (!uploadBtn) return;

    const refreshStatus = () => {
      const p = this.settings.custom_theme_custom_font;
      if (p) {
        statusEl.innerText = path.basename(p);
        removeBtn.style.display = "";
      } else {
        statusEl.innerText = "None uploaded";
        removeBtn.style.display = "none";
      }
    };

    refreshStatus();

    uploadBtn.addEventListener("click", async () => {
      const result = await ipcRenderer.invoke("upload-custom-font");
      if (!result) return;
      this.settings.custom_theme_custom_font = result;
      ipcRenderer.send("update-setting", "custom_theme_custom_font", result);
      refreshStatus();
      this.applyCustomTheme();
    });

    removeBtn.addEventListener("click", async () => {
      await ipcRenderer.invoke(
        "remove-custom-font",
        this.settings.custom_theme_custom_font
      );
      this.settings.custom_theme_custom_font = "";
      ipcRenderer.send("update-setting", "custom_theme_custom_font", "");
      refreshStatus();
      this.applyCustomTheme();
    });
  }

  handleDragAndPosition() {
    const wrapper = this.menu;
    const menuEl = this.menu.querySelector(".menu");
    const header = this.menu.querySelector(".menu-header");
    if (!menuEl) return;

    const getMenuSize = () => {
      const w =
        menuEl.offsetWidth ||
        parseInt(getComputedStyle(menuEl).width, 10) ||
        1100;
      const h =
        menuEl.offsetHeight ||
        parseInt(getComputedStyle(menuEl).height, 10) ||
        720;
      return { w, h };
    };

    let positioned = false;
    try {
      const savedPos = JSON.parse(
        this.localStorage.getItem("juice-menu-pos") || "null"
      );
      if (savedPos) {
        const { w, h } = getMenuSize();
        const maxLeft = Math.max(0, window.innerWidth - w);
        const maxTop = Math.max(0, window.innerHeight - h);
        wrapper.style.left =
          Math.max(0, Math.min(maxLeft, savedPos.left)) + "px";
        wrapper.style.top =
          Math.max(0, Math.min(maxTop, savedPos.top)) + "px";
        positioned = true;
      }
    } catch {}

    if (!positioned) {
      const { w, h } = getMenuSize();
      wrapper.style.left = Math.max(0, (window.innerWidth - w) / 2) + "px";
      wrapper.style.top = Math.max(0, (window.innerHeight - h) / 2) + "px";
    }

    if (!header) return;
    header.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();

      const startX = e.clientX;
      const startY = e.clientY;
      const startLeft = parseInt(wrapper.style.left, 10) || 0;
      const startTop = parseInt(wrapper.style.top, 10) || 0;

      const onMove = (ev) => {
        wrapper.style.left = startLeft + (ev.clientX - startX) + "px";
        wrapper.style.top = startTop + (ev.clientY - startY) + "px";
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        this.localStorage.setItem(
          "juice-menu-pos",
          JSON.stringify({
            left: parseInt(wrapper.style.left, 10) || 0,
            top: parseInt(wrapper.style.top, 10) || 0,
          })
        );
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  applyWatermark() {
    const id = "juice-watermark-style";
    const existing = document.getElementById(id);
    if (existing) existing.remove();

    if (this.settings.hide_smudgy_watermark) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = `
        #app > div.interface.text-2 > div.background::before {
          content: "" !important;
          display: none !important;
        }
      `;
      document.head.appendChild(style);
      return;
    }

    const text = this.settings.watermark_text || "Smu.__.dgy";
    const color = this.settings.watermark_color || "";
    const size = this.settings.watermark_size || "6.9";

    const escapedText = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const rules = [`content: "${escapedText}" !important`];
    if (color) rules.push(`color: ${color} !important`);
    if (size) rules.push(`font-size: ${size}rem !important`);

    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      #app > div.interface.text-2 > div.background::before {
        ${rules.join(";\n        ")};
      }
    `;
    document.head.appendChild(style);
  }

  handleKeyEvents() {
    document.addEventListener("keydown", (e) => {
      if (e.code === this.settings.menu_keybind) {
        const isActive = this.menuToggle.getAttribute("data-active") === "true";
        if (!isActive) {
          document.exitPointerLock();
        }
        this.menuToggle.setAttribute("data-active", !isActive);
        this.localStorage.setItem("juice-menu", !isActive);
      }
    });
  }

  initMenu() {
    const inputs = this.menu.querySelectorAll("input[data-setting]");
    const textareas = this.menu.querySelectorAll("textarea[data-setting]");
    const selects = this.menu.querySelectorAll("select[data-setting]");

    const settingDefaults = {
      endgame_message_enabled: false,
      endgame_message_text: "Good Game",
      simple_invite_btns: false,
      always_show_ingame_menu: false,
    };

    inputs.forEach((input) => {
      const setting = input.dataset.setting;
      const type = input.type;
      const value = this.settings[setting] ?? settingDefaults[setting];
      if (type === "checkbox") {
        input.checked = value ?? false;
      } else {
        input.value = value ?? "";
      }
    });

    selects.forEach((select) => {
      const setting = select.dataset.setting;
      const value = this.settings[setting];
      select.value = value;
    });

    textareas.forEach((textarea) => {
      const setting = textarea.dataset.setting;
      const value = this.settings[setting];
      textarea.value = value;
    });

    const serverZoom = this.settings["server_zoom"] ?? 1;
    this.applyServerZoom(serverZoom);

    if (this.settings["endgame_message_enabled"]) {
      this.injectEndGameMessageScript();
    }

    if (this.settings["simple_invite_btns"]) {
      this.injectSimpleInviteBtns();
    }

    if (this.settings["always_show_ingame_menu"]) {
      this.injectAlwaysShowIngameMenu();
    }
  }

  applyServerZoom(value) {
    let styleEl = document.getElementById("juice-server-zoom");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "juice-server-zoom";
      document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = `.right-interface, .play-content, .players-lobby, .heads[data-v-00ce7b25], .logo, .playerholderelement { zoom: ${value}; }`;
  }

  // ── Always Show In-Game Menu ──────────────────────────────────────────────

  injectAlwaysShowIngameMenu() {
    if (document.getElementById("juice-always-show-ingame-menu")) return;
    const link = document.createElement("link");
    link.id = "juice-always-show-ingame-menu";
    link.rel = "stylesheet";
    link.href = "https://irrvlo.xyz/aosb.css";
    document.head.appendChild(link);
  }

  removeAlwaysShowIngameMenu() {
    const el = document.getElementById("juice-always-show-ingame-menu");
    if (el) el.remove();
  }

  // ─────────────────────────────────────────────────────────────────────────

  handleMenuKeybindChange() {
    const changeKeybindButton = this.menu.querySelector(".change-keybind");
    changeKeybindButton.innerText = this.settings.menu_keybind;
    changeKeybindButton.addEventListener("click", () => {
      changeKeybindButton.innerText = "Press any key";
      const listener = (e) => {
        this.settings.menu_keybind = e.code;
        changeKeybindButton.innerText = e.code;
        ipcRenderer.send("update-setting", "menu_keybind", e.code);

        const event = new CustomEvent("juice-settings-changed", {
          detail: { setting: "menu_keybind", value: e.code },
        });
        document.dispatchEvent(event);

        this.menu.querySelector(
          ".keybind"
        ).innerText = `Press ${this.settings.menu_keybind} to toggle menu`;
        document.removeEventListener("keydown", listener);
      };
      document.addEventListener("keydown", listener);
    });
  }

  handleMenuInputChange(input) {
    const setting = input.dataset.setting;
    const type = input.type;
    const value = type === "checkbox" ? input.checked : input.value;
    this.settings[setting] = value;
    ipcRenderer.send("update-setting", setting, value);

    const event = new CustomEvent("juice-settings-changed", {
      detail: { setting: setting, value: value },
    });
    document.dispatchEvent(event);

    if (setting === "server_zoom") {
      this.applyServerZoom(value);
    }

    if (setting === "simple_invite_btns") {
      if (value) {
        this.injectSimpleInviteBtns();
      } else {
        this.removeSimpleInviteBtns();
      }
    }

    if (setting === "always_show_ingame_menu") {
      if (value) {
        this.injectAlwaysShowIngameMenu();
      } else {
        this.removeAlwaysShowIngameMenu();
      }
    }

    if (setting === "endgame_message_enabled") {
      if (value) {
        this.injectEndGameMessageScript();
      } else {
        const existing = document.getElementById("juice-endgame-script");
        if (existing) existing.remove();
      }
    }

    if (
      setting === "hide_smudgy_watermark" ||
      setting === "watermark_text" ||
      setting === "watermark_color" ||
      setting === "watermark_size"
    ) {
      this.applyWatermark();
    }

    if (setting === "menu_opacity") {
      this.applyMenuOpacity();
    }

    if (setting && setting.startsWith("custom_theme_")) {
      this.applyCustomTheme();
    }
  }

  handleMenuInputChanges() {
    const inputs = this.menu.querySelectorAll("input[data-setting]");
    const textareas = this.menu.querySelectorAll("textarea[data-setting]");

    inputs.forEach((input) => {
      const eventType =
        input.type === "range" || input.type === "color" ? "input" : "change";
      input.addEventListener(eventType, () => this.handleMenuInputChange(input));
    });

    textareas.forEach((textarea) => {
      textarea.addEventListener("change", () =>
        this.handleMenuInputChange(textarea)
      );
    });
  }

  handleMenuSelectChange(select) {
    const setting = select.dataset.setting;
    const value = select.value;
    this.settings[setting] = value;
    ipcRenderer.send("update-setting", setting, value);

    const event = new CustomEvent("juice-settings-changed", {
      detail: { setting: setting, value: value },
    });

    if (setting === "menu_theme") {
      this.setTheme();
    }

    if (setting && setting.startsWith("custom_theme_")) {
      this.applyCustomTheme();
    }

    document.dispatchEvent(event);
  }

  handleMenuSelectChanges() {
    const selects = this.menu.querySelectorAll("select[data-setting]");
    selects.forEach((select) => {
      select.addEventListener("change", () =>
        this.handleMenuSelectChange(select)
      );
    });
  }

  handleTabChanges() {
    const tabs = this.menu.querySelectorAll(".juice.tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => this.handleTabChange(tab));
    });
  }

  handleTabChange(tab) {
    const tabs = this.menu.querySelectorAll(".juice.tab");
    const tabName = tab.dataset.tab;

    this.localStorage.setItem("juice-menu-tab", tabName);

    const contents = this.menu.querySelectorAll(".juice.options");
    tabs.forEach((tab) => {
      tab.classList.remove("active");
    });
    contents.forEach((content) => {
      content.classList.remove("active");
    });
    tab.classList.add("active");
    this.tabToContentMap[tab.dataset.tab].classList.add("active");

    // Show/hide assets subtabs in sidebar
    const subtabs = this.menu.querySelector("#assets-subtabs");
    if (subtabs) {
      subtabs.style.display = tabName === "assets" ? "flex" : "none";
    }
  }

  handleDropdowns() {
    const dropdowns = this.menu.querySelectorAll(".dropdown");
    dropdowns.forEach((dropdown) => {
      const dropdownTop = dropdown.querySelector(".dropdown .top");
      dropdownTop.addEventListener("click", () => {
        dropdown.classList.toggle("active");
      });
    });
  }

  handleSearch() {
    const searchInput = this.menu.querySelector(".juice.search");
    const settings = this.menu.querySelectorAll(".option:not(.custom)");
    searchInput.addEventListener("input", () => {
      const searchValue = searchInput.value.toLowerCase();
      settings.forEach((setting) => {
        setting.style.display = setting.textContent
          .toLowerCase()
          .includes(searchValue)
          ? "flex"
          : "none";

        const parent = setting.parentElement;
        if (parent.classList.contains("option-group")) {
          const children = parent.children;
          const visibleChildren = Array.from(children).filter(
            (child) => child.style.display === "flex"
          );
          parent.style.display = visibleChildren.length ? "flex" : "none";
        }
      });
    });
  }

  handleAboutLinks() {
    const aboutPanel = this.menu.querySelector("#about-client");
    if (!aboutPanel) return;
    aboutPanel.addEventListener("click", (e) => {
      const link = e.target.closest("a");
      if (!link) return;
      e.preventDefault();
      e.stopPropagation();
      ipcRenderer.send("open-external", link.href);
    });
  }

  handleButtons() {
    const openSwapperFolder = this.menu.querySelector("#open-swapper-folder");
    openSwapperFolder.addEventListener("click", () => {
      ipcRenderer.send("open-swapper-folder");
    });

    const openScriptsFolder = this.menu.querySelector("#open-scripts-folder");
    openScriptsFolder.addEventListener("click", () => {
      ipcRenderer.send("open-scripts-folder");
    });

    const openSoundsFolder = this.menu.querySelector("#open-sounds-folder");
    openSoundsFolder.addEventListener("click", () => {
      ipcRenderer.send("open-sounds-folder");
    });

    const importSettings = this.menu.querySelector("#import-settings");
    importSettings.addEventListener("click", () => {
      const modal = this.createModal(
        "Import settings",
        "Paste your settings here to import them"
      );

      const bottom = modal.querySelector(".bottom");

      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "Paste settings here";
      bottom.appendChild(input);

      const confirm = document.createElement("button");
      confirm.innerText = "Confirm";
      confirm.classList.add("juice-button");
      confirm.addEventListener("click", () => {
        try {
          if (!input.value) return;

          const settings = JSON.parse(input.value);
          for (const key in settings) {
            this.settings[key] = settings[key];
            ipcRenderer.send("update-setting", key, settings[key]);

            const event = new CustomEvent("juice-settings-changed", {
              detail: { setting: key, value: settings[key] },
            });
            document.dispatchEvent(event);

            this.initMenu();
          }
          modal.remove();
        } catch (error) {
          console.error("Error importing settings:", error);
        }
      });

      bottom.appendChild(confirm);

      this.menu.querySelector(".menu").appendChild(modal);
    });

    const exportSettings = this.menu.querySelector("#export-settings");
    exportSettings.addEventListener("click", () => {
      const modal = this.createModal(
        "Export settings",
        "Copy your settings here to export them"
      );

      const bottom = modal.querySelector(".bottom");

      const textarea = document.createElement("textarea");
      textarea.value = JSON.stringify(this.settings, null, 2);
      bottom.appendChild(textarea);

      const copy = document.createElement("button");
      copy.innerText = "Copy";
      copy.classList.add("juice-button");
      copy.addEventListener("click", () => {
        navigator.clipboard.writeText(textarea.value);
      });

      bottom.appendChild(copy);

      this.menu.querySelector(".menu").appendChild(modal);
    });

    let clickCounter = 0;
    const resetJuiceSettings = this.menu.querySelector("#reset-juice-settings");
    resetJuiceSettings.addEventListener("click", () => {
      clickCounter++;
      if (clickCounter === 1) {
        resetJuiceSettings.style.background = "rgba(var(--red), 0.25)";
        const text = resetJuiceSettings.querySelector(".text");
        text.innerText = "Are you sure?";

        const description = resetJuiceSettings.querySelector(".description");
        description.innerText =
          "This will restart the client and reset all settings. Click again to confirm";
      } else if (clickCounter === 2) {
        ipcRenderer.send("reset-juice-settings");
      }
    });

    const remoteToStaticLinks = this.menu.querySelector(
      "#remote-to-static-links"
    );
    remoteToStaticLinks.addEventListener("click", async () => {
      const localStorageKeys = [
        "SETTINGS___SETTING/CROSSHAIR___SETTING/STATIC_URL___SETTING",
        "SETTINGS___SETTING/SNIPER___SETTING/SCOPE_URL___SETTING",
        "SETTINGS___SETTING/BLOCKS___SETTING/TEXTURE_URL___SETTING",
        "SETTINGS___SETTING/SKYBOX___SETTING/TEXTURE_IMG1___SETTING",
        "SETTINGS___SETTING/SKYBOX___SETTING/TEXTURE_IMG2___SETTING",
        "SETTINGS___SETTING/SKYBOX___SETTING/TEXTURE_IMG3___SETTING",
        "SETTINGS___SETTING/SKYBOX___SETTING/TEXTURE_IMG4___SETTING",
        "SETTINGS___SETTING/SKYBOX___SETTING/TEXTURE_IMG5___SETTING",
        "SETTINGS___SETTING/SKYBOX___SETTING/TEXTURE_IMG6___SETTING",
      ];

      const juiceKeys = ["css_link", "hitmarker_link", "killicon_link"];

      const encodeImage = async (url) => {
        if (!url || url === "") return "";

        try {
          const response = await fetch(url);
          if (!response.ok)
            throw new Error(`Invalid response: ${response.status}`);
          const blob = await response.blob();
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        } catch (error) {
          console.error(`Error fetching or converting ${url}:`, error);
        }
      };

      for (const key of localStorageKeys) {
        const url = localStorage.getItem(key).replace(/"/g, "");
        const data = await encodeImage(url);
        localStorage.setItem(key, data);
      }

      for (const key of juiceKeys) {
        const url = this.settings[key];
        const data = await encodeImage(url);
        this.settings[key] = data;
        ipcRenderer.send("update-setting", key, data);

        const event = new CustomEvent("juice-settings-changed", {
          detail: { setting: key, value: this.settings[key] },
        });
        document.dispatchEvent(event);

        this.initMenu();
      }
    });
  }

  injectSimpleInviteBtns() {
    if (this._simpleInviteActive) return;

    const originalInviteBtn = document.querySelector('.invite-btn');
    if (!originalInviteBtn) return;

    const privateBtn = document.querySelector('#create-btn');
    if (!privateBtn) return;

    const hiddenSelectors = ['.invite-btn', '.invite-right', '.invite-left1', '.invite-left2'];
    const hiddenElements = [];
    hiddenSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        hiddenElements.push({ el, prevDisplay: el.style.display });
        el.style.display = 'none';
      });
    });

    const newInviteBtn = document.createElement('button');
    for (let attr of privateBtn.attributes) {
      newInviteBtn.setAttribute(attr.name, attr.value);
    }
    newInviteBtn.id = 'new-invite-btn';

    const computedStyle = window.getComputedStyle(privateBtn);
    newInviteBtn.style.margin = computedStyle.margin;
    newInviteBtn.style.padding = computedStyle.padding;
    newInviteBtn.style.position = 'relative';
    newInviteBtn.style.display = computedStyle.display;
    newInviteBtn.style.alignItems = computedStyle.alignItems;
    newInviteBtn.style.justifyContent = computedStyle.justifyContent;
    newInviteBtn.style.gap = computedStyle.gap;
    newInviteBtn.style.height = computedStyle.height;
    newInviteBtn.style.boxSizing = computedStyle.boxSizing;

    const privateWidth = privateBtn.offsetWidth;
    newInviteBtn.style.width = (privateWidth * 2) + 'px';
    newInviteBtn.style.minWidth = (privateWidth * 2) + 'px';
    newInviteBtn.style.transform = 'translateX(20px)';
    newInviteBtn.style.margin = '0';

    newInviteBtn.innerHTML = `
      <div data-v-e32a4426="" class="triangle"></div>
      <div data-v-e32a4426="" class="text"> INVITE </div>
      <div data-v-e32a4426="" class="WwNwmM">
        <div data-v-e32a4426="" class="border-top border"></div>
        <div data-v-e32a4426="" class="border-bottom border"></div>
      </div>
    `;

    newInviteBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      originalInviteBtn.click();
    };

    const spacer = document.createElement('div');
    spacer.id = 'juice-simple-invite-spacer';
    spacer.style.height = (privateBtn.offsetHeight + 15) + 'px';
    spacer.style.width = '95%';
    spacer.style.display = 'flex';
    spacer.style.justifyContent = 'center';
    spacer.style.alignItems = 'center';
    spacer.style.overflow = 'visible';
    spacer.style.position = 'relative';
    spacer.appendChild(newInviteBtn);

    privateBtn.parentNode.insertBefore(spacer, privateBtn);

    this._simpleInviteActive = true;
    this._simpleInviteCleanup = () => {
      spacer.remove();
      hiddenElements.forEach(({ el, prevDisplay }) => {
        el.style.display = prevDisplay;
      });
      this._simpleInviteActive = false;
      this._simpleInviteCleanup = null;
    };
  }

  removeSimpleInviteBtns() {
    if (this._simpleInviteCleanup) {
      this._simpleInviteCleanup();
    }
  }

  injectEndGameMessageScript() {
    if (document.getElementById("juice-endgame-script")) return;

    const messageText = this.settings["endgame_message_text"] || "Good Game";

    const script = document.createElement("script");
    script.id = "juice-endgame-script";
    script.textContent = `
      (function() {
        const TARGET_TIME = "0:01";
        const MESSAGE_TEXT = ${JSON.stringify(messageText)};
        let hasSentMessage = false;
        let lastTimerValue = null;
        let timerWasAbsent = false;

        function parseTimerSeconds(str) {
          if (!str) return -1;
          const parts = str.trim().split(':');
          if (parts.length !== 2) return -1;
          return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        }

        function sendMessage() {
          const chatInput = document.querySelector('#WwMnw');
          if (chatInput) {
            chatInput.value = MESSAGE_TEXT;
            chatInput.dispatchEvent(new Event('input', { bubbles: true }));
            const enterButton = document.querySelector('.info-key-cont.enter');
            if (enterButton) {
              enterButton.click();
            } else {
              chatInput.dispatchEvent(new KeyboardEvent('keypress', {
                key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
              }));
            }
          }
        }

        function monitorTimersAndSendMessage() {
          if (hasSentMessage) return;
          const timers = document.querySelectorAll('.timer.bg.text-1');
          if (timers.length === 0) return;
          timers.forEach(timer => {
            if (timer.textContent.trim() === TARGET_TIME && !hasSentMessage) {
              hasSentMessage = true;
              sendMessage();
            }
          });
        }

        function handleShiftCRouch() {
          let shiftPressed = false;
          let hasTriggered = false;
          document.addEventListener('keydown', (event) => {
            if (event.key === 'Shift') shiftPressed = true;
            if (!hasTriggered && shiftPressed && (event.key === 'c' || event.key === 'C')) {
              const instructionTexts = document.querySelectorAll('.info-text');
              let foundCRouch = false;
              instructionTexts.forEach(text => {
                if (text.textContent.includes('cRouch')) foundCRouch = true;
              });
              if (foundCRouch) {
                const enterButton = document.querySelector('.info-key-cont.enter');
                if (enterButton) {
                  enterButton.click();
                  hasTriggered = true;
                }
              }
            }
          });
          document.addEventListener('keyup', (event) => {
            if (event.key === 'Shift') shiftPressed = false;
          });
        }

        function setupTimerWatcher() {
          const observer = new MutationObserver(() => monitorTimersAndSendMessage());
          const stateContainer = document.querySelector('.state-cont');
          if (stateContainer) {
            observer.observe(stateContainer, { childList: true, subtree: true, characterData: true });
          } else {
            setTimeout(setupTimerWatcher, 1000);
          }
        }

        setInterval(() => {
          const timers = document.querySelectorAll('.timer.bg.text-1');

          if (timers.length === 0) {
            timerWasAbsent = true;
            lastTimerValue = null;
            return;
          }

          const currentValue = timers[0].textContent.trim();
          const currentSeconds = parseTimerSeconds(currentValue);
          const lastSeconds = parseTimerSeconds(lastTimerValue);
          const timerJumpedUp = lastSeconds !== -1 && currentSeconds > lastSeconds + 5;

          if (timerWasAbsent || timerJumpedUp) {
            hasSentMessage = false;
            timerWasAbsent = false;
          }

          if (!hasSentMessage) {
            if (currentValue === TARGET_TIME && lastTimerValue !== TARGET_TIME) {
              monitorTimersAndSendMessage();
            }
          }

          lastTimerValue = currentValue;
        }, 100);

        setupTimerWatcher();
        handleShiftCRouch();
      })();
    `;
    document.head.appendChild(script);
  }

  initAssets() {
    const TEXTURE_API = "https://raw.githubusercontent.com/imnotkoolkid/KCH/refs/heads/main/data/texture.json";
    const CROSSHAIR_API = "https://raw.githubusercontent.com/imnotkoolkid/KCH/refs/heads/main/data/crosshair.json";
    const CSS_API = "https://raw.githubusercontent.com/imnotkoolkid/KCH/refs/heads/main/data/css.json";
    const MAPS_API = "https://raw.githubusercontent.com/OBS-Akuma/KirkaBadges/refs/heads/main/Json/maps.json";
    const TEXTURE_KEY = "SETTINGS___SETTING/BLOCKS___SETTING/TEXTURE_URL___SETTING";
    const CROSSHAIR_KEY = "SETTINGS___SETTING/SNIPER___SETTING/SCOPE_URL___SETTING";

    const FAV_KEY = "juice-asset-favorites";
    const DAYMIAN_BASE = "https://css.daymian.xyz";
    const DAYMIAN_EXCLUDED = new Set([
      "pink", "purp", "uwu", "wolfey", "jett", "monochrome",
    ]);

    let textureData = [];
    let crosshairData = [];
    let cssData = [];
    let mapsData = [];
    let currentType = "css";
    let loaded = false;

    let favorites;
    try {
      favorites = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]"));
    } catch {
      favorites = new Set();
    }

    const favKey = (type, id) => `${type}:${id}`;
    const isFav = (type, id) => favorites.has(favKey(type, id));
    const saveFavs = () => {
      localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(favorites)));
    };
    const toggleFav = (type, id) => {
      const key = favKey(type, id);
      if (favorites.has(key)) favorites.delete(key);
      else favorites.add(key);
      saveFavs();
    };
    const sortByFav = (data, type, getId) =>
      [...data].sort(
        (a, b) =>
          (isFav(type, getId(b)) ? 1 : 0) - (isFav(type, getId(a)) ? 1 : 0)
      );

    const getEls = () => ({
      grid: this.menu.querySelector("#assets-grid"),
      loading: this.menu.querySelector("#assets-loading"),
    });

    const showReloadToast = () => {
      const existing = this.menu.querySelector("#assets-reload-toast");
      if (existing) return;
      const toast = document.createElement("div");
      toast.id = "assets-reload-toast";
      toast.innerHTML = `
        <i class="fas fa-rotate-right"></i>
        <span>Reload the page for changes to apply</span>
        <button class="toast-reload-btn">Reload</button>
      `;
      this.menu.querySelector("#assets-options").prepend(toast);
      toast.querySelector(".toast-reload-btn").addEventListener("click", () => {
        location.reload();
      });
    };

    const buildAssetCard = (item, type) => {
      const imgSrc = type === "textures" ? item.textureImage : item.Crosshair;
      if (!imgSrc) return null;
      const storageKey = type === "textures" ? TEXTURE_KEY : CROSSHAIR_KEY;
      const favActive = isFav(type, item.id);

      const card = document.createElement("div");
      card.className = "asset-card";
      if (item.label === "featured") card.classList.add("featured");

      card.innerHTML = `
        <div class="asset-img-wrap">
          <img src="${imgSrc}" alt="${item.id}" />
          <button class="asset-favorite ${favActive ? "active" : ""}" title="${favActive ? "Unfavorite" : "Favorite"}">
            <i class="fas fa-star"></i>
          </button>
          ${item.label === "featured" ? `<div class="asset-badge"><i class="fas fa-star"></i></div>` : ""}
        </div>
        <div class="asset-info">
          <span class="asset-id">${item.id}</span>
          <span class="asset-owner">${item.owner || "Unknown"}</span>
          ${item.tags && item.tags.length ? `<div class="asset-tags">${item.tags.map(t => `<span class="asset-tag">${t}</span>`).join("")}</div>` : ""}
        </div>
        <button class="asset-apply juice-button">
          <span class="text">Apply</span>
          <div class="custom-border"></div>
        </button>
      `;

      const favBtn = card.querySelector(".asset-favorite");
      favBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFav(type, item.id);
        favBtn.classList.toggle("active");
        favBtn.title = favBtn.classList.contains("active") ? "Unfavorite" : "Favorite";
        if (currentType === "favorites") renderGrid("favorites");
      });

      card.querySelector(".asset-apply").addEventListener("click", () => {
        localStorage.setItem(storageKey, JSON.stringify(imgSrc));
        const btn = card.querySelector(".asset-apply .text");
        btn.innerText = "Applied!";
        card.classList.add("applied");
        showReloadToast();
        setTimeout(() => {
          btn.innerText = "Apply";
          card.classList.remove("applied");
        }, 1500);
      });

      return card;
    };

    // ── Maps grid renderer ─────────────────────────────────────────────────
    const renderMapsGrid = (grid, data) => {
      grid.innerHTML = "";
      grid.style.gridTemplateColumns = "repeat(3, 1fr)";

      if (!data || !data.length) {
        grid.innerHTML = `<div class="assets-empty"><i class="fas fa-map"></i><span>No maps found</span></div>`;
        return;
      }

      data.forEach((map) => {
        const card = document.createElement("div");
        card.className = "asset-card map-card";

        card.innerHTML = `
          <div class="asset-img-wrap">
            <img src="${map.image}" alt="${map.name}" />
          </div>
          <div class="asset-info">
            <span class="asset-id">${map.name}</span>
            ${map.modes && map.modes.length
              ? `<div class="asset-tags">${map.modes.map(m => `<span class="asset-tag">${m}</span>`).join("")}</div>`
              : ""}
          </div>
          <button class="asset-apply juice-button map-copy-btn" ${!map.file ? "disabled" : ""}>
            <span class="text"><i class="fas fa-copy"></i> Copy</span>
            <div class="custom-border"></div>
          </button>
        `;

        const copyBtn = card.querySelector(".map-copy-btn");
        if (map.file) {
          copyBtn.addEventListener("click", async () => {
            const textEl = copyBtn.querySelector(".text");
            try {
              const res = await fetch(map.file);
              if (!res.ok) throw new Error("Failed to fetch map file");
              const text = await res.text();
              await navigator.clipboard.writeText(text);
              textEl.innerHTML = `<i class="fas fa-check"></i> Copied!`;
              card.classList.add("applied");
              setTimeout(() => {
                textEl.innerHTML = `<i class="fas fa-copy"></i> Copy`;
                card.classList.remove("applied");
              }, 1500);
            } catch (err) {
              textEl.innerHTML = `<i class="fas fa-xmark"></i> Failed`;
              setTimeout(() => {
                textEl.innerHTML = `<i class="fas fa-copy"></i> Copy`;
              }, 1500);
              console.error("Map copy failed:", err);
            }
          });
        }

        grid.appendChild(card);
      });
    };
    // ──────────────────────────────────────────────────────────────────────

    const renderGrid = (type) => {
      const { grid } = getEls();
      if (!grid) return;
      grid.innerHTML = "";
      grid.style.gridTemplateColumns = "";

      if (type === "css") {
        this.renderCSSGrid(grid, cssData, {
          isFav,
          toggleFav,
          sortByFav,
          onToggle: () => {
            if (currentType === "favorites") renderGrid("favorites");
          },
        });
        return;
      }

      if (type === "maps") {
        renderMapsGrid(grid, mapsData);
        return;
      }

      if (type === "favorites") {
        const textureFavs = textureData.filter((i) => isFav("textures", i.id));
        const crosshairFavs = crosshairData.filter((i) => isFav("crosshairs", i.id));
        const cssFavs = cssData.filter(
          (i) => isFav("css", i.title) && i.availability !== "showcase" && !!i.downloadUrl
        );

        if (!textureFavs.length && !crosshairFavs.length && !cssFavs.length) {
          grid.innerHTML = `<div class="assets-empty"><i class="fas fa-star"></i><span>No favorites yet — click the star on any asset to add it here</span></div>`;
          return;
        }

        const addSection = (label, items, sectionType) => {
          if (!items.length) return;
          const header = document.createElement("div");
          header.className = "asset-fav-section-header";
          header.innerText = label;
          grid.appendChild(header);
          items.forEach((item) => {
            const card =
              sectionType === "css"
                ? this.buildCSSCardElement(item, {
                    isFav,
                    toggleFav,
                    onToggle: () => renderGrid("favorites"),
                    settings: this.settings,
                    menu: this.menu,
                    showReloadToast,
                  })
                : buildAssetCard(item, sectionType);
            if (card) grid.appendChild(card);
          });
        };

        addSection("Textures", textureFavs, "textures");
        addSection("Crosshairs", crosshairFavs, "crosshairs");
        addSection("CSS Themes", cssFavs, "css");
        return;
      }

      const data = type === "textures" ? textureData : crosshairData;
      if (!data.length) {
        grid.innerHTML = `<div class="assets-empty"><i class="fas fa-box-open"></i><span>No items found</span></div>`;
        return;
      }

      const sorted = sortByFav(data, type, (item) => item.id);
      sorted.forEach((item) => {
        const card = buildAssetCard(item, type);
        if (card) grid.appendChild(card);
      });
    };

    const fetchDaymianCSS = async () => {
      try {
        const res = await fetch(DAYMIAN_BASE + "/");
        if (!res.ok) throw new Error("HTTP " + res.status);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        const items = [];
        doc.querySelectorAll(".css-card").forEach((card) => {
          const titleEl = card.querySelector(".card-name");
          const downloadEl = card.querySelector(".btn-download");
          if (!titleEl || !downloadEl) return;
          const title = titleEl.textContent.trim();
          if (DAYMIAN_EXCLUDED.has(title.toLowerCase())) return;
          const downloadHref = downloadEl.getAttribute("href");
          if (!downloadHref) return;
          const imgs = [...card.querySelectorAll(".card-images img")]
            .map((img) => img.getAttribute("src"))
            .filter(Boolean)
            .map((src) => new URL(src, DAYMIAN_BASE).href);
          const filters = (card.dataset.filters || "")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
          items.push({
            title,
            description: "",
            homeImage: imgs[0] || "",
            ingameImage: imgs[1] || imgs[0] || "",
            tags: filters,
            availability: "free",
            owner: "daymian",
            discord: "",
            label: "",
            downloadUrl: new URL(downloadHref, DAYMIAN_BASE).href,
          });
        });
        return items;
      } catch (e) {
        console.error("[Daymian] Failed to fetch CSS list:", e);
        return [];
      }
    };

    const loadData = async () => {
      const { grid, loading } = getEls();
      if (!grid || !loading) return;

      loading.style.display = "flex";
      grid.style.display = "none";

      try {
        const [tex, cross, css, daymian, maps] = await Promise.all([
          fetch(TEXTURE_API).then((r) => r.json()),
          fetch(CROSSHAIR_API).then((r) => r.json()),
          fetch(CSS_API).then((r) => r.json()),
          fetchDaymianCSS(),
          fetch(MAPS_API).then((r) => r.json()),
        ]);
        textureData = tex;
        crosshairData = cross;
        cssData = [...css, ...daymian];
        mapsData = maps;
      } catch (err) {
        loading.style.display = "none";
        grid.style.display = "grid";
        grid.innerHTML = `<div class="assets-empty"><i class="fas fa-triangle-exclamation"></i><span>Failed to load assets</span></div>`;
        return;
      }

      loading.style.display = "none";
      grid.style.display = "grid";
      renderGrid(currentType);

      // Sync active state on sidebar subtabs
      const subtabContainer = this.menu.querySelector("#assets-subtabs");
      if (subtabContainer) {
        subtabContainer.querySelectorAll(".assets-subtab").forEach(t => {
          t.classList.toggle("active", t.dataset.assetsTab === currentType);
        });
      }
    };

    // Sidebar subtab clicks
    const subtabContainer = this.menu.querySelector("#assets-subtabs");
    if (subtabContainer) {
      subtabContainer.addEventListener("click", (e) => {
        const tab = e.target.closest(".assets-subtab");
        if (!tab) return;
        subtabContainer.querySelectorAll(".assets-subtab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        currentType = tab.dataset.assetsTab;
        renderGrid(currentType);
      });
    }

    // Main Assets tab click — show subtabs and lazy-load
    const mainTab = this.menu.querySelector(`[data-tab="assets"]`);
    if (mainTab) {
      mainTab.addEventListener("click", () => {
        const subtabs = this.menu.querySelector("#assets-subtabs");
        if (subtabs) subtabs.style.display = "flex";
        if (!loaded) {
          loaded = true;
          loadData();
        }
      });
    }
  }

  renderCSSGrid(grid, cssData, favCtx) {
    if (!cssData.length) {
      grid.innerHTML = `<div class="assets-empty"><i class="fas fa-box-open"></i><span>No CSS themes found</span></div>`;
      return;
    }

    grid.style.gridTemplateColumns = "repeat(4, 1fr)";

    const visible = cssData.filter(
      (item) =>
        item.availability !== "showcase" &&
        !!item.downloadUrl &&
        (!item.tags || !item.tags.map((t) => t.toLowerCase()).includes("showcase"))
    );
    const sorted = favCtx ? favCtx.sortByFav(visible, "css", (i) => i.title) : visible;

    sorted.forEach((item) => {
      const card = this.buildCSSCardElement(item, {
        ...favCtx,
        settings: this.settings,
        menu: this.menu,
        showReloadToast: () => {
          const existing = this.menu.querySelector("#assets-reload-toast");
          if (existing) return;
          const toast = document.createElement("div");
          toast.id = "assets-reload-toast";
          toast.innerHTML = `
            <i class="fas fa-rotate-right"></i>
            <span>Reload the page for changes to apply</span>
            <button class="toast-reload-btn">Reload</button>
          `;
          this.menu.querySelector("#assets-options").prepend(toast);
          toast.querySelector(".toast-reload-btn").addEventListener("click", () => {
            location.reload();
          });
        },
      });
      grid.appendChild(card);
    });
  }

  buildCSSCardElement(item, ctx) {
    const { isFav, toggleFav, onToggle, settings, menu, showReloadToast } = ctx;
    const favActive = isFav ? isFav("css", item.title) : false;

    const card = document.createElement("div");
    card.className = "asset-card css-card";
    if (item.label === "featured") card.classList.add("featured");

    const availabilityBadge =
      item.availability === "free"
        ? `<span class="asset-tag availability free">Free</span>`
        : `<span class="asset-tag availability paid">Paid</span>`;

    const truncatedTitle =
      item.title.length > 18 ? item.title.slice(0, 18).trimEnd() + "…" : item.title;

    card.innerHTML = `
      <div class="asset-img-wrap css-img-wrap">
        <img src="${item.homeImage}" alt="${item.title}" />
        <button class="asset-favorite ${favActive ? "active" : ""}" title="${favActive ? "Unfavorite" : "Favorite"}">
          <i class="fas fa-star"></i>
        </button>
        ${item.label === "featured" ? `<div class="asset-badge"><i class="fas fa-star"></i></div>` : ""}
      </div>
      <div class="asset-info">
        <span class="asset-id" title="${item.title}">${truncatedTitle}</span>
        <span class="asset-owner">${item.owner || "Unknown"}</span>
        ${item.description ? `<span class="asset-description">${item.description}</span>` : ""}
        <div class="asset-tags">
          ${availabilityBadge}
          ${item.tags && item.tags.length ? item.tags.map(t => `<span class="asset-tag">${t}</span>`).join("") : ""}
        </div>
      </div>
      <div class="css-card-actions">
        ${item.discord ? `<a href="${item.discord}" target="_blank" class="asset-discord juice-button"><span class="text"><i class="fab fa-discord"></i></span><div class="custom-border"></div></a>` : ""}
        <button class="asset-apply juice-button">
          <span class="text">Apply</span>
          <div class="custom-border"></div>
        </button>
      </div>
    `;

    if (toggleFav) {
      const favBtn = card.querySelector(".asset-favorite");
      favBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFav("css", item.title);
        favBtn.classList.toggle("active");
        favBtn.title = favBtn.classList.contains("active") ? "Unfavorite" : "Favorite";
        if (onToggle) onToggle();
      });
    }

    card.querySelector(".asset-apply").addEventListener("click", () => {
      const url = item.downloadUrl;
      if (!url) return;

      settings["css_link"] = url;
      ipcRenderer.send("update-setting", "css_link", url);
      settings["css_enabled"] = true;
      ipcRenderer.send("update-setting", "css_enabled", true);

      const cssLinkInput = menu.querySelector("[data-setting='css_link']");
      if (cssLinkInput) cssLinkInput.value = url;
      const cssEnabledInput = menu.querySelector("#css_enabled");
      if (cssEnabledInput) cssEnabledInput.checked = true;

      ["css_link", "css_enabled"].forEach((key) => {
        document.dispatchEvent(
          new CustomEvent("juice-settings-changed", {
            detail: { setting: key, value: settings[key] },
          })
        );
      });

      const btn = card.querySelector(".asset-apply .text");
      btn.innerText = "Applied!";
      card.classList.add("applied");
      showReloadToast();
      setTimeout(() => {
        btn.innerText = "Apply";
        card.classList.remove("applied");
      }, 1500);
    });

    return card;
  }

  initNews() {
    const NEWS_API = "https://raw.githubusercontent.com/OBS-Akuma/smudgy-client/refs/heads/main/Api/news.json";
    let loaded = false;

    const getEls = () => ({
      feed: this.menu.querySelector("#news-feed"),
      loading: this.menu.querySelector("#news-loading"),
    });

    const renderNews = (items) => {
      const { feed, loading } = getEls();
      if (!feed) return;
      loading.style.display = "none";
      feed.innerHTML = "";

      const filtered = items.filter(item => item.category === "MenuNews");

      if (!filtered.length) {
        feed.innerHTML = `<div class="assets-empty"><i class="far fa-newspaper"></i><span>No news right now</span></div>`;
        return;
      }

      filtered.forEach(item => {
        const card = document.createElement("div");
        card.className = "news-menu-card";
        card.style.cssText = `
          width: 100%;
          border: 4px solid #3e4d7c;
          border-bottom: 4px solid #26335b;
          border-top: 4px solid #4d5c8b;
          background-color: #3b4975;
          display: flex;
          flex-direction: column;
          position: relative;
          margin-bottom: 0.5rem;
          box-sizing: border-box;
          ${item.link ? "cursor: pointer;" : ""}
        `;

        if (item.img && item.imgType === "banner") {
          const img = document.createElement("img");
          img.src = item.img;
          img.style.cssText = "width: 100%; max-height: 7.5rem; object-fit: cover; object-position: center;";
          card.appendChild(img);
        }

        if (item.live) {
          const badge = document.createElement("span");
          badge.innerText = "LIVE";
          badge.style.cssText = `
            position: absolute; top: 0; right: 0;
            background-color: #4dbf4d; color: #fff;
            padding: 0.15rem 0.25rem; font-size: 0.75rem;
            font-weight: 600; border-radius: 0 0 0 0.25rem;
          `;
          card.appendChild(badge);
        } else if (item.updatedAt && item.updatedAt > Date.now() - 432000000) {
          const badge = document.createElement("span");
          badge.innerText = "NEW";
          badge.style.cssText = `
            position: absolute; top: 0; right: 0;
            background-color: #e24f4f; color: #fff;
            padding: 0.15rem 0.25rem; font-size: 0.75rem;
            font-weight: 600; border-radius: 0 0 0 0.25rem;
          `;
          card.appendChild(badge);
        }

        const content = document.createElement("div");
        content.style.cssText = "padding: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem; text-align: left;";

        const title = document.createElement("span");
        title.innerText = item.title;
        title.style.cssText = "font-size: 1.2rem; font-weight: 600; color: #ffb914;";
        content.appendChild(title);

        if (item.content) {
          const text = document.createElement("span");
          text.innerText = item.content;
          text.style.cssText = "font-size: 0.9rem; color: #fff;";
          content.appendChild(text);
        }

        card.appendChild(content);

        if (item.link) {
          card.addEventListener("click", () => {
            ipcRenderer.send("open-external", item.link);
          });
        }

        feed.appendChild(card);
      });
    };

    const loadNews = async () => {
      const { feed, loading } = getEls();
      if (!feed || !loading) return;
      loading.style.display = "flex";
      feed.style.display = "none";

      try {
        const res = await fetch(NEWS_API);
        const data = await res.json();
        loading.style.display = "none";
        feed.style.display = "block";
        renderNews(data);
      } catch (err) {
        loading.style.display = "none";
        feed.style.display = "block";
        feed.innerHTML = `<div class="assets-empty"><i class="fas fa-triangle-exclamation"></i><span>Failed to load news</span></div>`;
      }
    };

    const newsTab = this.menu.querySelector(`[data-tab="news"]`);
    if (newsTab) {
      newsTab.addEventListener("click", () => {
        if (!loaded) {
          loaded = true;
          loadNews();
        }
      });
    }
  }

  createModal(title, description) {
    const modal = document.createElement("div");
    modal.id = "modal";

    modal.innerHTML = `
    <div class="content">
      <div class="close">
        <i class="fas fa-times"></i>
      </div>
      <div class="top">
        <span class="title">${title}</span>
        <span class="description">${description}</span>
      </div>
      <div class="bottom">
      </div>
    </div>
    `;

    const close = modal.querySelector(".close");
    close.addEventListener("click", () => modal.remove());

    modal.addEventListener("click", (e) => {
      if (e.target.id === "modal") modal.remove();
    });

    return modal;
  }
}

module.exports = Menu;
