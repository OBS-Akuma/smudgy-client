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
      swapper: this.menu.querySelector("#swapper-options"),
      client: this.menu.querySelector("#client-options"),
      scripts: this.menu.querySelector("#scripts-options"),
      about: this.menu.querySelector("#about-client"),
      Credits: this.menu.querySelector("#Credits-options"),
      assets: this.menu.querySelector("#assets-options"),
      news: this.menu.querySelector("#news-options"),
      tools: this.menu.querySelector("#tools-options"),
      installation: this.menu.querySelector("#installation-options"),
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
  this.initInstallation();
  this.initTools();
  this.initSkins();
  this.initQuickCssPopout();
  
  if (this.settings["friends_profiles"]) {
    this.initFriendsProfiles();
  }
  
  if (this.settings["subnames_enabled"]) {
    this.initSubnames();
  }
  
  if (this.settings["kirka_badges_enabled"]) {
    this.initKirkaBadges();
  }
  
  if (this.settings["oneko_enabled"]) {
    setTimeout(() => {
      this.initOneko();
    }, 500);
  }
  
  // Initialize Key Watcher if enabled
  if (this.settings["key_watcher_enabled"]) {
    this.initKeyWatcher();
  }

  window.addEventListener('beforeunload', () => {
    this.stopFriendProfileChecking();
    this.removeFriendProfileStyles();
    this.stopSubnames();
    this.stopKirkaBadges();
    this.removeOneko();
    this.removeKeyWatcher();
  });
  
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
    element.innerText = `Version ${version}`;
  });
}

setUser() {
  const user = JSON.parse(this.localStorage.getItem("current-user"));
  if (user) {
    this.menu.querySelector(".user").innerText = `${user.wNmnw}#${user.wMWWm}`;
  }
}

setKeybind() {
  this.menu.querySelector(
    ".keybind"
  ).innerText = `${this.settings.menu_keybind} to toggle the client menu `;
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
    friends_profiles: false,
    subnames_enabled: false,
    kirka_badges_enabled: false,
    kirka_badges_size: 16,
    kirka_badges_brackets: true,
    oneko_enabled: false,
    oneko_variant: "classic",
    oneko_kuroneko: false,
    key_watcher_enabled: false,
    key_watcher_pos_x: 14,  // Default left position (14px)
    key_watcher_pos_y: 14,  // Default top position (14px)
    key_watcher_active_bg: "#ffffff",
    key_watcher_active_text: "#ffffff",
    key_watcher_inactive_bg: "#262626",
    key_watcher_inactive_text: "#aaaaaa",
  };

  inputs.forEach((input) => {
    const setting = input.dataset.setting;
    const type = input.type;
    const value = this.settings[setting] ?? settingDefaults[setting];
    if (type === "checkbox") {
      input.checked = value ?? false;
    } else if (type === "color") {
      // For color inputs, set the value and store default
      const colorValue = value || settingDefaults[setting] || "#ffffff";
      input.value = colorValue;
      input.dataset.defaultValue = colorValue;
    } else {
      input.value = value ?? "";
    }
  });

  selects.forEach((select) => {
    const setting = select.dataset.setting;
    const value = this.settings[setting] ?? settingDefaults[setting];
    select.value = value;
  });

  textareas.forEach((textarea) => {
    const setting = textarea.dataset.setting;
    const value = this.settings[setting] ?? settingDefaults[setting];
    textarea.value = value;
  });

  const serverZoom = this.settings["server_zoom"] ?? 1;
  this.applyServerZoom(serverZoom);

  const clientMenuSize = this.settings["client_menu_size"] ?? 1;
  this.applyClientZoom(clientMenuSize);

  if (this.settings["endgame_message_enabled"]) {
    this.injectEndGameMessageScript();
  }

  if (this.settings["always_show_ingame_menu"]) {
    this.injectAlwaysShowIngameMenu();
  }

  // Show/hide oneko suboptions based on setting
  const onekoSuboptions = this.menu.querySelector("#oneko-suboptions");
  if (onekoSuboptions) {
    onekoSuboptions.style.display = this.settings["oneko_enabled"] ? '' : 'none';
  }

  // Show/hide kirka badges suboptions based on setting
  const kirkaBadgesSuboptions = this.menu.querySelector("#kirka-badges-suboptions");
  if (kirkaBadgesSuboptions) {
    kirkaBadgesSuboptions.style.display = this.settings["kirka_badges_enabled"] ? '' : 'none';
  }

  // Sync all color inputs to ensure they show the current saved values
  this.syncColorInputs();

  // Initialize key watcher if enabled
  if (this.settings["key_watcher_enabled"]) {
    this.initKeyWatcher();
  }
}

// Add this helper method to sync color inputs
syncColorInputs() {
  const colorInputs = this.menu.querySelectorAll('input[type="color"][data-setting]');
  colorInputs.forEach((input) => {
    const setting = input.dataset.setting;
    const value = this.settings[setting];
    if (value) {
      input.value = value;
    } else {
      // If no value in settings, use the default from data attribute or set a default
      const defaultValue = input.dataset.defaultValue || "#ffffff";
      input.value = defaultValue;
      // Also save it to settings if it doesn't exist
      if (!this.settings[setting]) {
        this.settings[setting] = defaultValue;
        ipcRenderer.send("update-setting", setting, defaultValue);
      }
    }
  });
}

applyServerZoom(value) {
  let styleEl = document.getElementById("juice-server-zoom");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "juice-server-zoom";
    document.head.appendChild(styleEl);
  }
  styleEl.innerHTML = `
    .right-interface, 
    .play-content, 
    .players-lobby, 
    .heads[data-v-00ce7b25], 
    .logo, 
    .playerholderelement { 
      zoom: ${value}; 
    }
  `;
}

applyClientZoom(value) {
  let styleEl = document.getElementById("juice-client-zoom");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "juice-client-zoom";
    document.head.appendChild(styleEl);
  }
  styleEl.innerHTML = `
    .menu {
      transform: scale(${value}) !important;
      transform-origin: top left !important;
    }
  `;
}



initInstallation() {
  const PLUGIN_LIST_API = "https://raw.githubusercontent.com/OBS-Akuma/Smudgy-plugins/refs/heads/main/PluginList.json";
  const RAW_BASE = "https://raw.githubusercontent.com/OBS-Akuma/Smudgy-plugins/refs/heads/main";

  let allPlugins = [];
  let loaded = false;

  const grid = this.menu.querySelector("#plugins-grid");
  const loading = this.menu.querySelector("#plugins-loading");
  const emptyEl = this.menu.querySelector("#plugins-empty");
  const searchEl = this.menu.querySelector("#plugins-search");

  if (!grid) return;

  const parseUserScriptHeader = (src) => {
    const meta = {};
    const block = src.match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/);
    if (!block) return meta;
    const lines = block[1].split("\n");
    for (const line of lines) {
      const m = line.match(/\/\/\s*@(\w+)\s+(.*)/);
      if (m) meta[m[1].trim()] = m[2].trim();
    }
    return meta;
  };

  const isInstalled = (scriptName) => {
    try {
      const installed = this.settings.installed_plugins || [];
      return installed.includes(scriptName);
    } catch { 
      return false; 
    }
  };

  const markInstalled = (scriptName) => {
    try {
      const installed = this.settings.installed_plugins || [];
      if (!installed.includes(scriptName)) {
        installed.push(scriptName);
        this.settings.installed_plugins = installed;
        ipcRenderer.send("update-setting", "installed_plugins", installed);
      }
    } catch (err) {
      console.error("[Plugins] Failed to mark installed:", err);
    }
  };

  const uninstallPlugin = async (scriptName) => {
    try {
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      
      const scriptsDir = path.join(os.homedir(), "Documents", "SmudgyClient", "scripts");
      const filePath = path.join(scriptsDir, scriptName);
      

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log("[Plugins] Deleted file:", filePath);
        

        const installed = this.settings.installed_plugins || [];
        const updated = installed.filter(p => p !== scriptName);
        this.settings.installed_plugins = updated;
        ipcRenderer.send("update-setting", "installed_plugins", updated);
        
        return true;
      }
      return false;
    } catch (err) {
      console.error("[Plugins] Failed to uninstall:", err);
      return false;
    }
  };

  const renderPlugins = (plugins) => {
    const query = (searchEl ? searchEl.value : "").toLowerCase().trim();

    const filtered = query
      ? plugins.filter(p =>
          (p.meta.name || p.fileName).toLowerCase().includes(query) ||
          (p.meta.description || "").toLowerCase().includes(query) ||
          (p.meta.author || "").toLowerCase().includes(query)
        )
      : plugins;

    grid.innerHTML = "";

    if (!filtered.length) {
      grid.style.display = "none";
      emptyEl.style.display = "flex";
      return;
    }

    emptyEl.style.display = "none";
    grid.style.display = "grid";

    filtered.forEach((plugin) => {
      const { meta, fileName, url, version } = plugin;
      const displayName = meta.name || fileName.replace(/\.js$/, "");
      const author = meta.author || "Unknown";
      const desc = meta.description || "No description provided.";
      const ver = meta.version || version || "?";
      const installed = isInstalled(fileName);

      const truncName = displayName.length > 22
        ? displayName.slice(0, 22).trimEnd() + "…"
        : displayName;

      const card = document.createElement("div");
      card.className = `plugin-card${installed ? " installed" : ""}`;

      card.innerHTML = `
        <span class="plugin-name" title="${displayName}">${this.escapeHtml(truncName)}</span>
        <span class="plugin-author"><i class="fas fa-user"></i> ${this.escapeHtml(author)}</span>
        <span class="plugin-version"><i class="fas fa-tag"></i> v${this.escapeHtml(ver)}</span>
        <span class="plugin-desc">${this.escapeHtml(desc)}</span>
        <div class="plugin-actions">
          ${installed ? `<span class="plugin-installed-badge"><i class="fas fa-download"></i> Installed</span>` : ""}
          <button class="juice-button plugin-download-btn">
            <span class="text"><i class="fas fa-download"></i> ${installed ? "Re-install" : "Install"}</span>
            <div class="custom-border"></div>
          </button>
          ${installed ? `
          <button class="juice-button plugin-uninstall-btn">
            <span class="text"><i class="fas fa-trash"></i> Uninstall</span>
            <div class="custom-border"></div>
          </button>
          ` : ""}
        </div>
      `;

      const dlBtn = card.querySelector(".plugin-download-btn");
      dlBtn.addEventListener("click", async () => {
        const textEl = dlBtn.querySelector(".text");
        const originalText = textEl.innerHTML;
        textEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Downloading...`;
        dlBtn.disabled = true;

        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const scriptContent = await res.text();

          const success = await ipcRenderer.invoke("install-plugin", {
            fileName,
            content: scriptContent,
          });

          if (!success) throw new Error("Write failed");

          markInstalled(fileName);
          
          renderPlugins(allPlugins);

        } catch (err) {
          textEl.innerHTML = `<i class="fas fa-xmark"></i> Failed`;
          dlBtn.disabled = false;
          console.error("[Plugins] Download failed:", err);
          setTimeout(() => {
            textEl.innerHTML = originalText;
          }, 2000);
        }
      });

      const uninstallBtn = card.querySelector(".plugin-uninstall-btn");
      if (uninstallBtn) {
        uninstallBtn.addEventListener("click", async () => {
          if (confirm(`Are you sure you want to uninstall "${displayName}"?`)) {
            const textEl = uninstallBtn.querySelector(".text");
            const originalText = textEl.innerHTML;
            textEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Uninstalling...`;
            uninstallBtn.disabled = true;
            
            const success = await uninstallPlugin(fileName);
            
            if (success) {
              renderPlugins(allPlugins);
            } else {
              textEl.innerHTML = `<i class="fas fa-xmark"></i> Failed`;
              setTimeout(() => {
                textEl.innerHTML = originalText;
                uninstallBtn.disabled = false;
              }, 2000);
            }
          }
        });
      }

      grid.appendChild(card);
    });
  };

  const loadPlugins = async () => {
    loaded = true;
    loading.style.display = "flex";
    grid.style.display = "none";
    emptyEl.style.display = "none";

    try {
      const list = await fetch(PLUGIN_LIST_API).then(r => r.json());

      const scriptEntries = [];
      for (const entry of list) {
        for (const script of entry.scripts) {
          scriptEntries.push({
            path: entry.path,
            fileName: script.name,
            version: script.version,
            url: `${RAW_BASE}/${entry.path}/${script.name}`,
          });
        }
      }

      const plugins = (
        await Promise.all(
          scriptEntries.map(async (entry) => {
            try {
              const res = await fetch(entry.url);
              if (!res.ok) return null;
              const src = await res.text();
              const meta = parseUserScriptHeader(src);
              return { ...entry, meta };
            } catch {
              return null;
            }
          })
        )
      ).filter(Boolean);

      allPlugins = plugins;

    } catch (err) {
      loading.style.display = "none";
      grid.style.display = "grid";
      grid.innerHTML = `<div class="assets-empty"><i class="fas fa-triangle-exclamation"></i><span>Failed to load plugins</span></div>`;
      console.error("[Plugins] load failed:", err);
      return;
    }

    loading.style.display = "none";
    renderPlugins(allPlugins);
  };

  if (searchEl) {
    searchEl.addEventListener("input", () => renderPlugins(allPlugins));
  }

  const installTab = this.menu.querySelector(`[data-tab="installation"]`);
  if (installTab) {
    installTab.addEventListener("click", () => {
      if (!loaded) loadPlugins();
    });
  }
}


escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}



  injectAlwaysShowIngameMenu() {
    if (document.getElementById("juice-always-show-ingame-menu")) return;

    const link = document.createElement("link");
    link.id = "juice-always-show-ingame-menu";
    link.rel = "stylesheet";
    link.href = "https://irrvlo.xyz/aosb.css";
    document.head.appendChild(link);

    this.observeMenuRemoval();
  }

  observeMenuRemoval() {
    if (this.menuObserver) this.menuObserver.disconnect();

    this.menuObserver = new MutationObserver((mutations) => {
      const removed = mutations.some(mutation =>
        Array.from(mutation.removedNodes).some(node =>
          node.id === "juice-always-show-ingame-menu" ||
          (node.nodeType === 1 && node.querySelector?.("#juice-always-show-ingame-menu"))
        )
      );

      if (removed && !document.getElementById("juice-always-show-ingame-menu")) {
        console.log("Menu style removed, re-injecting...");
        this.injectAlwaysShowIngameMenu();
      }
    });

    this.menuObserver.observe(document.head, { childList: true, subtree: true });
  }

  removeAlwaysShowIngameMenu() {
    const el = document.getElementById("juice-always-show-ingame-menu");
    if (el) el.remove();

    if (this.menuObserver) {
      this.menuObserver.disconnect();
      this.menuObserver = null;
    }
  }



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

 restartOneko() {

  const enabled = this.settings["oneko_enabled"] ?? false;
  

  this.removeOneko();
  
  if (enabled) {

    setTimeout(() => {
      this.initOneko();
    }, 150);
  }
}

handleMenuInputChange(input) {
  const setting = input.dataset.setting;
  const type = input.type;
  let value = type === "checkbox" ? input.checked : input.value;
  
  // For color inputs, ensure hex value is properly formatted
  if (type === "color") {
    // Color inputs already return hex with #, but just in case
    if (value && !value.startsWith('#')) {
      value = '#' + value;
    }
    // Ensure we save the value
    this.settings[setting] = value;
    ipcRenderer.send("update-setting", setting, value);
    
    // Update the input's dataset default value to match
    input.dataset.defaultValue = value;
  } else {
    this.settings[setting] = value;
    ipcRenderer.send("update-setting", setting, value);
  }

  const event = new CustomEvent("juice-settings-changed", {
    detail: { setting: setting, value: value },
  });
  document.dispatchEvent(event);

  if (setting === "server_zoom") {
    this.applyServerZoom(value);
  }
  if (setting === "client_menu_size") {
    this.applyClientZoom(value);
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

  if (setting === "friends_profiles") {
    if (value) {
      this.initFriendsProfiles();
    } else {
      this.stopFriendProfileChecking();
      this.removeFriendProfileStyles();
    }
  }

  if (setting === "subnames_enabled") {
    if (value) {
      this.initSubnames();
    } else {
      this.stopSubnames();
    }
  }

  if (setting === "kirka_badges_enabled") {
    const kirkaBadgesSuboptions = this.menu.querySelector("#kirka-badges-suboptions");
    if (kirkaBadgesSuboptions) {
      kirkaBadgesSuboptions.style.display = value ? '' : 'none';
    }
    if (value) {
      this.initKirkaBadges();
    } else {
      this.stopKirkaBadges();
    }
  }

  if (setting === "kirka_badges_size" || setting === "kirka_badges_brackets") {
    if (this.settings["kirka_badges_enabled"]) {
      this.stopKirkaBadges();
      this.initKirkaBadges();
    }
  }

  if (setting === "oneko_enabled") {
    const onekoSuboptions = this.menu.querySelector("#oneko-suboptions");
    if (onekoSuboptions) {
      onekoSuboptions.style.display = value ? '' : 'none';
    }
    
    if (value) {
      this.initOneko();
    } else {
      this.removeOneko();
    }
  }

  if (setting === "oneko_variant" || setting === "oneko_kuroneko") {
    if (window.__onekoSettings) {
      window.__onekoSettings.variant = this.settings["oneko_variant"] || "classic";
      window.__onekoSettings.kuroNeko = this.settings["oneko_kuroneko"] || false;
    }

    if (window.__onekoUpdateSettings) {
      window.__onekoUpdateSettings({
        variant: this.settings["oneko_variant"] || "classic",
        kuroNeko: this.settings["oneko_kuroneko"] || false
      });
    } else {
      this.removeOneko();
      if (this.settings["oneko_enabled"]) {
        setTimeout(() => {
          this.initOneko();
        }, 100);
      }
    }
  }

// Key Watcher settings
if (setting === "key_watcher_enabled") {
  if (value) {
    this.initKeyWatcher();
  } else {
    this.removeKeyWatcher();
  }
}

if (setting === "key_watcher_pos_x" || setting === "key_watcher_pos_y") {
  if (this.settings["key_watcher_enabled"] && window.__updateKeyPosition) {
    const x = this.settings["key_watcher_pos_x"] ?? 14;
    const y = this.settings["key_watcher_pos_y"] ?? 14;
    window.__updateKeyPosition(x, y);
  }
}

if (setting === "key_watcher_active_bg" || 
    setting === "key_watcher_active_text" || 
    setting === "key_watcher_inactive_bg" || 
    setting === "key_watcher_inactive_text") {
  if (this.settings["key_watcher_enabled"] && window.__updateKeyColors) {
    const activeBg = this.settings["key_watcher_active_bg"] || "#ffffff";
    const activeText = this.settings["key_watcher_active_text"] || "#ffffff";
    const inactiveBg = this.settings["key_watcher_inactive_bg"] || "#262626";
    const inactiveText = this.settings["key_watcher_inactive_text"] || "#aaaaaa";
    window.__updateKeyColors(activeBg, activeText, inactiveBg, inactiveText);
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
  if (!tab) return;
  const tabs = this.menu.querySelectorAll(".juice.tab");
  const tabName = tab.dataset.tab;

  this.localStorage.setItem("juice-menu-tab", tabName);

  const contents = this.menu.querySelectorAll(".juice.options");
  tabs.forEach((t) => t.classList.remove("active"));
  contents.forEach((c) => c.classList.remove("active"));
  tab.classList.add("active");


  if (tabName === "swapper") {

    const swapperOptions = this.menu.querySelector("#swapper-options");
    if (swapperOptions) {
      swapperOptions.classList.add("active");
      swapperOptions.style.display = "";
    }
    

    const gunsPanel = this.menu.querySelector("#swapper-guns");
    const soundsPanel = this.menu.querySelector("#swapper-sounds");
    if (gunsPanel) {
      gunsPanel.classList.remove("active");
      gunsPanel.style.display = "none";
    }
    if (soundsPanel) {
      soundsPanel.classList.remove("active");
      soundsPanel.style.display = "none";
    }
    

    const swapperSubtabs = this.menu.querySelector("#swapper-subtabs");
    if (swapperSubtabs) {
      swapperSubtabs.style.display = "flex";
    }
    

    if (!this._swapperInitialized) {
      this._swapperInitialized = true;
      this.initSwapper();
    }
  } else {

    const targetContent = this.tabToContentMap[tabName];
    if (targetContent) {
      targetContent.classList.add("active");
      targetContent.style.display = "";
    }
    

    const swapperSubtabs = this.menu.querySelector("#swapper-subtabs");
    if (swapperSubtabs) {
      swapperSubtabs.style.display = "none";
    }
  }


  const assetsSubtabs = this.menu.querySelector("#assets-subtabs");
  if (assetsSubtabs) {
    assetsSubtabs.style.display = tabName === "assets" ? "flex" : "none";
  }


  const toolsSubtabs = this.menu.querySelector("#tools-subtabs");
  if (toolsSubtabs) {
    toolsSubtabs.style.display = tabName === "tools" ? "flex" : "none";
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

    const weaponResetOffsets = this.menu.querySelector("#weapon-reset-offsets");
    if (weaponResetOffsets) {
      weaponResetOffsets.addEventListener("click", () => {
        const defaults = {
          weapon_wireframe: false,
          weapon_rainbow:   false,
          weapon_scale:     1.0,
          weapon_offset_x:  0,
          weapon_offset_y:  0,
          weapon_offset_z:  0,
        };
        for (const [key, val] of Object.entries(defaults)) {
          this.settings[key] = val;
          ipcRenderer.send("update-setting", key, val);
          const el = this.menu.querySelector(`[data-setting="${key}"]`);
          if (el) {
            if (el.type === "checkbox") el.checked = val;
            else el.value = val;
          }
          document.dispatchEvent(new CustomEvent("juice-settings-changed", { detail: { setting: key, value: val } }));
        }
      });
    }
  }

  removeSimpleInviteBtns() {
    const script = document.getElementById("juice-simple-invite-btn");
    if (script) script.remove();

    const spacer = document.getElementById('juice-simple-invite-spacer');
    if (spacer) spacer.remove();

    const hiddenSelectors = ['.invite-btn', '.invite-right', '.invite-left1', '.invite-left2'];
    hiddenSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        el.style.display = '';
      });
    });
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



  initTools() {
    const subtabContainer = this.menu.querySelector("#tools-subtabs");
    if (!subtabContainer) return;

    const toolsPanels = {
      "skins": this.menu.querySelector("#tools-skins"),
      "player-lookup": this.menu.querySelector("#tools-player-lookup"),
      "inventory-lookup": this.menu.querySelector("#tools-inventory-lookup"),
    };

    const defaultPanel = this.menu.querySelector("#tools-options");

    const showToolsPanel = (tabName) => {
      if (defaultPanel) defaultPanel.classList.remove("active");
      Object.values(toolsPanels).forEach((p) => {
        if (p) {
          p.classList.remove("active");
          p.style.display = "none";
        }
      });

      const target = toolsPanels[tabName];
      if (target) {
        target.style.display = "";
        target.classList.add("active");
      }
    };

    subtabContainer.addEventListener("click", (e) => {
      const tab = e.target.closest(".tools-subtab");
      if (!tab) return;

      if (tab.classList.contains("locked")) return;

      subtabContainer.querySelectorAll(".tools-subtab").forEach((t) =>
        t.classList.remove("active")
      );
      tab.classList.add("active");
      showToolsPanel(tab.dataset.toolsTab);
    });

    const mainTab = this.menu.querySelector(`[data-tab="tools"]`);
    if (mainTab) {
      mainTab.addEventListener("click", () => {
        Object.values(toolsPanels).forEach((p) => {
          if (p) {
            p.classList.remove("active");
            p.style.display = "none";
          }
        });
        if (defaultPanel) defaultPanel.classList.add("active");

        subtabContainer.querySelectorAll(".tools-subtab").forEach((t) =>
          t.classList.remove("active")
        );
      });
    }
  }


initFriendsProfiles() {

  const enabled = this.settings["friends_profiles"] ?? false;
  if (!enabled) {

    this.stopFriendProfileChecking();
    this.removeFriendProfileStyles();
    return;
  }


  this.removeFriendProfileStyles();
  

  const style = document.createElement('style');
  style.id = 'juice-friend-profiles-style';
  style.textContent = `
    .friend .level-cont:has(img[data-level-cont="true"]) {
      width: 50px;
      height: 50px;
      flex-shrink: 0;
    }
    .friend img[data-level-cont="true"] {
      width: 50px !important;
      height: 50px !important;
      border-radius: 4px !important;
      object-fit: cover !important;
      display: block !important;
      flex-shrink: 0 !important;
      image-rendering: pixelated !important;
      image-rendering: -moz-crisp-edges !important;
      image-rendering: -webkit-optimize-contrast !important;
      image-rendering: crisp-edges !important;
    }
    .friend img[data-level-cont="true"][data-loaded="failed"] {
      opacity: 0.4;
    }
  `;
  document.head.appendChild(style);


  this.runFriendProfileProcessor();
}

removeFriendProfileStyles() {
  const style = document.getElementById('juice-friend-profiles-style');
  if (style) style.remove();
}

stopFriendProfileChecking() {
  if (this._friendProfileInterval) {
    clearInterval(this._friendProfileInterval);
    this._friendProfileInterval = null;
  }
  if (this._friendProfileObserver) {
    this._friendProfileObserver.disconnect();
    this._friendProfileObserver = null;
  }
  this._isFriendProcessing = false;
}

runFriendProfileProcessor() {

  if (!(this.settings["friends_profiles"] ?? false)) return;
  

  if (this._isFriendProcessing) return;
  this._isFriendProcessing = true;


  this.processFriendProfiles();


  if (this._friendProfileObserver) {
    this._friendProfileObserver.disconnect();
  }
  
  this._friendProfileObserver = new MutationObserver(() => {

    if (!(this.settings["friends_profiles"] ?? false)) {
      this.stopFriendProfileChecking();
      return;
    }
    this.processFriendProfiles();
  });
  
  this._friendProfileObserver.observe(document.body, {
    childList: true,
    subtree: true
  });


  if (this._friendProfileInterval) {
    clearInterval(this._friendProfileInterval);
  }
  this._friendProfileInterval = setInterval(() => {
    if (!(this.settings["friends_profiles"] ?? false)) {
      this.stopFriendProfileChecking();
      return;
    }
    this.backgroundFriendSkinCheck();
  }, 120000);
}

async processFriendProfiles(initialLoad = true) {
  if (this._friendProfileRunning) return;
  this._friendProfileRunning = true;

  try {
    await this.loadDefaultSkinForFriends();
    
    const friendElements = document.querySelectorAll('.friend');
    const friendArray = Array.from(friendElements);
    
    if (friendArray.length === 0) {
      this._friendProfileRunning = false;
      return;
    }
    

    friendArray.forEach(friend => this.applyDefaultSkinToFriend(friend));
    

    const friendsToFetch = friendArray.filter(friend => {
      const img = friend.querySelector('img[data-level-cont="true"]');
      if (!img) return false;
      const friendId = img.dataset.friendId;
      return !this.isFriendProcessed(friendId) || !this.loadFriendSkinFromCache(friendId);
    });
    
    if (friendsToFetch.length === 0) {
      this._friendProfileRunning = false;
      return;
    }
    

    for (let i = 0; i < friendsToFetch.length; i += 5) {
      const batch = friendsToFetch.slice(i, i + 5);
      await Promise.all(batch.map(friend => this.processFriendRealSkin(friend)));
      
      if (i + 5 < friendsToFetch.length) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
  } finally {
    this._friendProfileRunning = false;
  }
}

async loadDefaultSkinForFriends() {
  if (this._defaultSkinDataUrl) return;
  
  const DEFAULT_SKIN_ID = '6be53225-952a-45d7-a862-d69290e4348e';
  

  const cachedDefaultSkin = this.loadFromFriendCache('juice_default_skin_data');
  if (cachedDefaultSkin) {
    this._defaultSkinDataUrl = cachedDefaultSkin;
    return;
  }
  
  try {
    const textureUrl = await this.getSkinTextureUrl(DEFAULT_SKIN_ID);
    if (textureUrl) {
      this._defaultSkinDataUrl = await this.extractHeadClean(textureUrl);
      if (this._defaultSkinDataUrl) {
        this.saveToFriendCache('juice_default_skin_data', this._defaultSkinDataUrl);
      }
    } else {
      this._defaultSkinDataUrl = this.createFallbackHead('?');
    }
  } catch (error) {
    this._defaultSkinDataUrl = this.createFallbackHead('?');
  }
}

saveToFriendCache(key, data) {
  try {
    const cacheData = {
      data: data,
      timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Save to cache error:', error);
  }
}

loadFromFriendCache(key) {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const cacheData = JSON.parse(cached);
    

    if (Date.now() - cacheData.timestamp > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(key);
      return null;
    }
    
    return cacheData.data;
  } catch (error) {
    return null;
  }
}

saveFriendSkinToCache(friendId, skinDataUrl, skinId) {
  try {
    const friendSkins = this.loadFromFriendCache('juice_friend_skins_data') || {};
    friendSkins[friendId] = {
      dataUrl: skinDataUrl,
      timestamp: Date.now()
    };
    this.saveToFriendCache('juice_friend_skins_data', friendSkins);
    
    const friendSkinIds = this.loadFromFriendCache('juice_friend_skin_ids') || {};
    friendSkinIds[friendId] = {
      skinId: skinId,
      timestamp: Date.now()
    };
    this.saveToFriendCache('juice_friend_skin_ids', friendSkinIds);
    
    this.saveProcessedFriend(friendId);
  } catch (error) {}
}

loadFriendSkinFromCache(friendId) {
  try {
    const friendSkins = this.loadFromFriendCache('juice_friend_skins_data');
    if (!friendSkins) return null;
    
    const friendData = friendSkins[friendId];
    if (!friendData) return null;
    
    if (Date.now() - friendData.timestamp > 7 * 24 * 60 * 60 * 1000) {
      delete friendSkins[friendId];
      this.saveToFriendCache('juice_friend_skins_data', friendSkins);
      return null;
    }
    
    return friendData.dataUrl;
  } catch (error) {
    return null;
  }
}

getCachedSkinId(friendId) {
  try {
    const friendSkinIds = this.loadFromFriendCache('juice_friend_skin_ids');
    if (!friendSkinIds) return null;
    
    const friendData = friendSkinIds[friendId];
    if (!friendData) return null;
    
    return friendData.skinId;
  } catch (error) {
    return null;
  }
}

saveProcessedFriend(friendId) {
  try {
    const processed = this.loadFromFriendCache('juice_processed_friends') || [];
    if (!processed.includes(friendId)) {
      processed.push(friendId);
      this.saveToFriendCache('juice_processed_friends', processed);
    }
  } catch (error) {}
}

isFriendProcessed(friendId) {
  try {
    const processed = this.loadFromFriendCache('juice_processed_friends') || [];
    return processed.includes(friendId);
  } catch (error) {
    return false;
  }
}

async getSkinTextureUrl(skinId, retryCount = 0) {
  try {
    const response = await fetch('https://raw.githubusercontent.com/OBS-Akuma/KirkaSkins/refs/heads/main/AllItemData.json');
    
    if (response.status === 503 || response.status === 429) {
      const waitTime = Math.min(1000 * Math.pow(2, retryCount), 8000);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.getSkinTextureUrl(skinId, retryCount + 1);
    }
    
    if (!response.ok) {
      throw new Error(`Skins API returned ${response.status}`);
    }
    const skins = await response.json();
    const skin = skins.find(s => s.id === skinId);
    
    if (!skin) {
      throw new Error(`Skin ${skinId} not found`);
    }
    
    return skin.textureUrl || skin.renderUrl;
  } catch (error) {
    return null;
  }
}

async extractHeadClean(textureUrl, retryCount = 0) {
  try {
    if (!textureUrl) {
      return null;
    }
    
    const response = await fetch(textureUrl);
    
    if (response.status === 503 || response.status === 429) {
      const waitTime = Math.min(1000 * Math.pow(2, retryCount), 8000);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.extractHeadClean(textureUrl, retryCount + 1);
    }
    
    if (!response.ok) {
      throw new Error(`Texture fetch failed: ${response.status}`);
    }
    
    const blob = await response.blob();
    const img = await createImageBitmap(blob);
    
    const TARGET_SIZE = 128;
    const canvas = document.createElement('canvas');
    canvas.width = TARGET_SIZE;
    canvas.height = TARGET_SIZE;
    const ctx = canvas.getContext('2d');
    
    ctx.imageSmoothingEnabled = false;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, TARGET_SIZE, TARGET_SIZE);
    
    const scale = img.width / 64;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 8;
    tempCanvas.height = 8;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.imageSmoothingEnabled = false;
    
    tempCtx.drawImage(img, 8*scale, 8*scale, 8*scale, 8*scale, 0, 0, 8, 8);
    tempCtx.drawImage(img, 40*scale, 8*scale, 8*scale, 8*scale, 0, 0, 8, 8);
    
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tempCanvas, 0, 0, TARGET_SIZE, TARGET_SIZE);
    
    return canvas.toDataURL('image/png');
  } catch (error) {
    return null;
  }
}

createFallbackHead(text = '?') {
  const TARGET_SIZE = 128;
  const canvas = document.createElement('canvas');
  canvas.width = TARGET_SIZE;
  canvas.height = TARGET_SIZE;
  const ctx = canvas.getContext('2d');
  
  ctx.imageSmoothingEnabled = false;
  
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, 0, TARGET_SIZE, TARGET_SIZE);
  
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, TARGET_SIZE, TARGET_SIZE);
  
  ctx.fillStyle = '#888';
  ctx.font = '20px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, TARGET_SIZE/2, TARGET_SIZE/2);
  
  return canvas.toDataURL('image/png');
}

applyDefaultSkinToFriend(friendElement) {
  const levelCont = friendElement.querySelector('.level-cont');
  const friendIdElement = friendElement.querySelector('.friend-id');
  
  if (!levelCont || !friendIdElement) return;
  
  const friendId = friendIdElement.textContent.trim();
  
  const cachedSkin = this.loadFriendSkinFromCache(friendId);
  
  let img = friendElement.querySelector('img[data-level-cont="true"]');
  
  if (!img) {
    img = document.createElement('img');
    img.dataset.levelCont = 'true';
    img.dataset.friendId = friendId;
    
    img.style.width = '50px';
    img.style.height = '50px';
    img.style.borderRadius = '4px';
    img.style.objectFit = 'cover';
    img.style.display = 'block';
    img.style.flexShrink = '0';
    img.style.imageRendering = 'pixelated';
    img.style.imageRendering = '-moz-crisp-edges';
    img.style.imageRendering = '-webkit-optimize-contrast';
    img.style.imageRendering = 'crisp-edges';
    
    levelCont.parentNode.replaceChild(img, levelCont);
  }
  
  img.src = cachedSkin || this._defaultSkinDataUrl || this.createFallbackHead('?');
  img.alt = cachedSkin ? `Profile ${friendId}` : 'Loading...';
  
  if (cachedSkin) {
    img.dataset.loaded = 'cached';
  }
}

async processFriendRealSkin(friendElement, forceUpdate = false) {
  try {
    const img = friendElement.querySelector('img[data-level-cont="true"]');
    if (!img) return;
    
    const friendId = img.dataset.friendId;
    if (!friendId) return;
    
    if (!forceUpdate && this.isFriendProcessed(friendId) && this.loadFriendSkinFromCache(friendId)) {
      img.dataset.loaded = 'cached';
      return;
    }
    
    const cachedSkin = this.loadFriendSkinFromCache(friendId);
    if (!forceUpdate && cachedSkin) {
      img.src = cachedSkin;
      img.alt = `Profile ${friendId}`;
      img.dataset.loaded = 'cached';
      this.saveProcessedFriend(friendId);
      return;
    }
    
    const profileData = await this.getProfileData(friendId);
    if (!profileData) {
      img.dataset.loaded = 'failed';
      return;
    }
    
    let skinId = profileData.wWnNmWMw?.WwmMWw;
    if (!skinId) {
      img.dataset.loaded = 'no-skin';
      return;
    }
    
    const cachedSkinId = this.getCachedSkinId(friendId);
    if (cachedSkinId === skinId && cachedSkin) {
      this.saveFriendSkinToCache(friendId, cachedSkin, skinId);
      img.dataset.loaded = 'cached';
      return;
    }
    
    const textureUrl = await this.getSkinTextureUrl(skinId);
    if (!textureUrl) {
      img.dataset.loaded = 'no-texture';
      return;
    }
    
    const headDataUrl = await this.extractHeadClean(textureUrl);
    if (!headDataUrl) {
      img.dataset.loaded = 'extract-failed';
      return;
    }
    
    img.src = headDataUrl;
    img.alt = `Profile ${friendId}`;
    img.dataset.loaded = 'updated';
    
    this.saveFriendSkinToCache(friendId, headDataUrl, skinId);
    
  } catch (error) {}
}

async getProfileData(friendId, retryCount = 0) {
  try {
    const response = await fetch('https://api2.kirka.io/api/wNmwWMWn/wWWnwmNM', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        WwmMWw: friendId,
        wmWW: true
      })
    });
    
    if (response.status === 503 || response.status === 429) {
      const waitTime = Math.min(1000 * Math.pow(2, retryCount), 8000);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.getProfileData(friendId, retryCount + 1);
    }
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    if (retryCount < 3) {
      const waitTime = Math.min(1000 * Math.pow(2, retryCount), 5000);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.getProfileData(friendId, retryCount + 1);
    }
    return null;
  }
}

async backgroundFriendSkinCheck() {
  if (this._isBackgroundChecking || !(this.settings["friends_profiles"] ?? false)) return;
  this._isBackgroundChecking = true;
  
  try {
    const friendElements = document.querySelectorAll('.friend');
    const friendArray = Array.from(friendElements);
    
    if (friendArray.length === 0) {
      return;
    }
    
    const processedFriends = friendArray.filter(friend => {
      const img = friend.querySelector('img[data-level-cont="true"]');
      if (!img) return false;
      const friendId = img.dataset.friendId;
      return this.isFriendProcessed(friendId);
    });
    
    if (processedFriends.length === 0) return;
    
    for (let i = 0; i < processedFriends.length; i += 2) {
      const batch = processedFriends.slice(i, i + 2);
      await Promise.all(batch.map(friend => this.processFriendRealSkin(friend, true)));
      
      if (i + 2 < processedFriends.length) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  } finally {
    this._isBackgroundChecking = false;
  }
}



restartOneko() {

  const enabled = this.settings["oneko_enabled"] ?? false;
  
  if (enabled) {

    this.removeOneko();

    setTimeout(() => {
      this.initOneko();
    }, 50);
  } else {

    this.removeOneko();
  }
}

initOneko() {

  this.removeOneko();
  

  const enabled = this.settings["oneko_enabled"] ?? false;
  if (!enabled) return;
  

  window.__onekoSettings = {
    variant: this.settings["oneko_variant"] || "classic",
    kuroNeko: this.settings["oneko_kuroneko"] || false
  };
  
  const onekoScript = `
(function oneko() {

  if (window.__onekoRunning) {
    console.log('[Oneko] Already running, skipping...');
    return;
  }
  window.__onekoRunning = true;


  let currentVariant = window.__onekoSettings?.variant || "classic";
  let currentKuroNeko = window.__onekoSettings?.kuroNeko || false;
  
  const nekoEl = document.createElement("div");
  let nekoPosX = 32,
    nekoPosY = 32,
    mousePosX = 0,
    mousePosY = 0,
    frameCount = 0,
    idleTime = 0,
    idleAnimation = null,
    idleAnimationFrame = 0,
    grabbing = false,
    grabStop = true,
    nudge = false;

  const nekoSpeed = 10;
  const spriteSets = {
    idle: [[-3, -3]],
    alert: [[-7, -3]],
    scratchSelf: [[-5, 0], [-6, 0], [-7, 0]],
    scratchWallN: [[0, 0], [0, -1]],
    scratchWallS: [[-7, -1], [-6, -2]],
    scratchWallE: [[-2, -2], [-2, -3]],
    scratchWallW: [[-4, 0], [-4, -1]],
    tired: [[-3, -2]],
    sleeping: [[-2, 0], [-2, -1]],
    N: [[-1, -2], [-1, -3]],
    NE: [[0, -2], [0, -3]],
    E: [[-3, 0], [-3, -1]],
    SE: [[-5, -1], [-5, -2]],
    S: [[-6, -3], [-7, -2]],
    SW: [[-5, -3], [-6, -1]],
    W: [[-4, -2], [-4, -3]],
    NW: [[-1, 0], [-1, -1]],
  };


  function shouldHide() {
    return window.location.pathname.includes('/games/');
  }

  function getSprite(name, frame) {
    return spriteSets[name][frame % spriteSets[name].length];
  }

  function setSprite(name, frame) {
    const sprite = getSprite(name, frame);
    nekoEl.style.backgroundPosition = \`\${sprite[0] * 32}px \${sprite[1] * 32}px\`;
  }

  function updateVariant(newVariant, newKuroNeko) {
    currentVariant = newVariant;
    currentKuroNeko = newKuroNeko;
    nekoEl.style.backgroundImage = \`url('https://raw.githubusercontent.com/kyrie25/spicetify-oneko/main/assets/oneko/oneko-\${currentVariant}.gif')\`;
    nekoEl.style.filter = currentKuroNeko ? "invert(100%)" : "none";
    console.log('[Oneko] Updated variant to:', currentVariant);
  }


  window.__onekoUpdateSettings = function(settings) {
    if (settings.variant && settings.variant !== currentVariant) {
      updateVariant(settings.variant, settings.kuroNeko !== undefined ? settings.kuroNeko : currentKuroNeko);
    } else if (settings.kuroNeko !== undefined && settings.kuroNeko !== currentKuroNeko) {
      updateVariant(currentVariant, settings.kuroNeko);
    }
  };

  function resetIdleAnimation() {
    idleAnimation = null;
    idleAnimationFrame = 0;
  }

  function idle() {

    if (nekoEl.style.display === 'none') return;
    
    idleTime += 1;

    if (idleTime > 10 && Math.floor(Math.random() * 200) == 0 && idleAnimation == null) {
      let avalibleIdleAnimations = ["sleeping", "scratchSelf"];
      if (nekoPosX < 32) avalibleIdleAnimations.push("scratchWallW");
      if (nekoPosY < 32) avalibleIdleAnimations.push("scratchWallN");
      if (nekoPosX > window.innerWidth - 32) avalibleIdleAnimations.push("scratchWallE");
      if (nekoPosY > window.innerHeight - 32) avalibleIdleAnimations.push("scratchWallS");
      idleAnimation = avalibleIdleAnimations[Math.floor(Math.random() * avalibleIdleAnimations.length)];
    }

    switch (idleAnimation) {
      case "sleeping":
        if (idleAnimationFrame < 8 && nudge) {
          setSprite("idle", 0);
          break;
        } else if (nudge) {
          nudge = false;
          resetIdleAnimation();
        }
        if (idleAnimationFrame < 8) {
          setSprite("tired", 0);
          break;
        }
        setSprite("sleeping", Math.floor(idleAnimationFrame / 4));
        if (idleAnimationFrame > 192) resetIdleAnimation();
        break;
      case "scratchWallN":
      case "scratchWallS":
      case "scratchWallE":
      case "scratchWallW":
      case "scratchSelf":
        setSprite(idleAnimation, idleAnimationFrame);
        if (idleAnimationFrame > 9) resetIdleAnimation();
        break;
      default:
        setSprite("idle", 0);
        return;
    }
    idleAnimationFrame += 1;
  }

  function frame() {
    frameCount += 1;

    if (grabbing) {
      grabStop && setSprite("alert", 0);
      return;
    }

    const diffX = nekoPosX - mousePosX;
    const diffY = nekoPosY - mousePosY;
    const distance = Math.sqrt(diffX ** 2 + diffY ** 2);

    if (distance < nekoSpeed || distance < 48) {
      idle();
      return;
    }

    idleAnimation = null;
    idleAnimationFrame = 0;

    if (idleTime > 1) {
      setSprite("alert", 0);
      idleTime = Math.min(idleTime, 7);
      idleTime -= 1;
      return;
    }

    let direction = diffY / distance > 0.5 ? "N" : "";
    direction += diffY / distance < -0.5 ? "S" : "";
    direction += diffX / distance > 0.5 ? "W" : "";
    direction += diffX / distance < -0.5 ? "E" : "";
    setSprite(direction, frameCount);

    nekoPosX -= (diffX / distance) * nekoSpeed;
    nekoPosY -= (diffY / distance) * nekoSpeed;

    nekoPosX = Math.min(Math.max(16, nekoPosX), window.innerWidth - 16);
    nekoPosY = Math.min(Math.max(16, nekoPosY), window.innerHeight - 16);

    nekoEl.style.left = \`\${nekoPosX - 16}px\`;
    nekoEl.style.top = \`\${nekoPosY - 16}px\`;
  }

  function create() {

    const variant = window.__onekoSettings?.variant || "classic";
    const kuroNeko = window.__onekoSettings?.kuroNeko || false;
    currentVariant = variant;
    currentKuroNeko = kuroNeko;

    nekoEl.id = "oneko";
    nekoEl.style.width = "32px";
    nekoEl.style.height = "32px";
    nekoEl.style.position = "fixed";
    nekoEl.style.backgroundImage = \`url('https://raw.githubusercontent.com/kyrie25/spicetify-oneko/main/assets/oneko/oneko-\${variant}.gif')\`;
    nekoEl.style.imageRendering = "pixelated";
    nekoEl.style.left = \`\${nekoPosX - 16}px\`;
    nekoEl.style.top = \`\${nekoPosY - 16}px\`;
    nekoEl.style.filter = kuroNeko ? "invert(100%)" : "none";
    nekoEl.style.zIndex = "99999999";
    nekoEl.style.pointerEvents = "none";
    

    if (shouldHide()) {
      nekoEl.style.display = 'none';
      console.log('[Oneko] Hidden because URL contains /games/');
    }

    document.body.appendChild(nekoEl);

    window.addEventListener("mousemove", (e) => {
      mousePosX = e.clientX;
      mousePosY = e.clientY;
    });


    let lastUrl = window.location.href;
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        if (shouldHide()) {
          nekoEl.style.display = 'none';
          console.log('[Oneko] Hidden because URL contains /games/');
        } else {
          nekoEl.style.display = '';
          console.log('[Oneko] Shown because URL no longer contains /games/');
        }
      }
    }, 500);

    window.onekoInterval = setInterval(frame, 100);
  }


  const existingNeko = document.getElementById("oneko");
  if (existingNeko) existingNeko.remove();
  
  if (window.onekoInterval) {
    clearInterval(window.onekoInterval);
    window.onekoInterval = null;
  }

  create();
  setSprite("idle", 0);
  
  console.log('[Oneko] Initialized with variant:', currentVariant);


  window.__onekoCleanup = function() {
    if (window.onekoInterval) {
      clearInterval(window.onekoInterval);
      window.onekoInterval = null;
    }
    const neko = document.getElementById("oneko");
    if (neko) neko.remove();
    window.__onekoRunning = false;
    window.__onekoUpdateSettings = null;
    console.log('[Oneko] Cleaned up');
  };
})();
  `;
  

  const script = document.createElement("script");
  script.id = "juice-oneko-script";
  script.textContent = onekoScript;
  document.head.appendChild(script);
}
removeOneko() {

  const script = document.getElementById("juice-oneko-script");
  if (script) {
    script.remove();
  }
  

  if (window.__onekoCleanup) {
    window.__onekoCleanup();
    delete window.__onekoCleanup;
  }
  

  const neko = document.getElementById("oneko");
  if (neko) {
    neko.remove();
  }
  

  if (window.onekoInterval) {
    clearInterval(window.onekoInterval);
    window.onekoInterval = null;
  }
  

  window.__onekoRunning = false;
  

  delete window.__onekoSettings;
}

// Add this method to your Menu class
initQuickCssPopout() {
  const popoutBtn = this.menu.querySelector('.quick-css-popout-btn');
  
  if (!popoutBtn) return;

  popoutBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    ipcRenderer.send('open-quick-css-window');
  });

  // Listen for updates from the popout window (applies CSS)
  ipcRenderer.on('update-quick-css', (event, cssContent) => {
    const mainTextarea = this.menu.querySelector('[data-setting="advanced_css"]');
    if (mainTextarea) {
      mainTextarea.value = cssContent;
      this.settings.advanced_css = cssContent;
      ipcRenderer.send('update-setting', 'advanced_css', cssContent);
      
      const event = new CustomEvent('juice-settings-changed', {
        detail: { setting: 'advanced_css', value: cssContent }
      });
      document.dispatchEvent(event);
    }
  });

  // Listen for sync request from the main process
  ipcRenderer.on('request-quick-css-sync', (event, responseChannel) => {
    const mainTextarea = this.menu.querySelector('[data-setting="advanced_css"]');
    if (mainTextarea) {
      const currentCss = mainTextarea.value || '';
      // Send response back using the provided channel
      event.sender.send(responseChannel || 'quick-css-sync-response', currentCss);
    } else {
      // If no textarea found, send empty string
      event.sender.send(responseChannel || 'quick-css-sync-response', '');
    }
  });

  // NEW: Listen for changes in the main textarea and sync to popout
  const mainTextarea = this.menu.querySelector('[data-setting="advanced_css"]');
  if (mainTextarea) {
    // Save the original input handler if it exists
    const originalInputHandler = mainTextarea._inputHandler || null;
    
    // Add our input listener
    mainTextarea.addEventListener('input', () => {
      const currentCss = mainTextarea.value || '';
      // Send update to main process to sync with popout
      ipcRenderer.send('main-quick-css-updated', currentCss);
      // Also save settings
      this.settings.advanced_css = currentCss;
      ipcRenderer.send('update-setting', 'advanced_css', currentCss);
    });
    
    // Store reference to prevent duplicate listeners
    mainTextarea._inputHandler = true;
  }

  // Also listen for settings reset to update the popout
  ipcRenderer.on('settings-reset', (event, newSettings) => {
    const mainTextarea = this.menu.querySelector('[data-setting="advanced_css"]');
    if (mainTextarea && newSettings.advanced_css !== undefined) {
      mainTextarea.value = newSettings.advanced_css;
      ipcRenderer.send('main-quick-css-updated', newSettings.advanced_css);
    }
  });
}


initSubnames() {

  const enabled = this.settings["subnames_enabled"] ?? false;
  if (!enabled) {
    this.stopSubnames();
    return;
  }


  this.injectSubnamesScript();
}

injectSubnamesScript() {
  if (document.getElementById("juice-subnames-script")) return;

  const script = document.createElement("script");
  script.id = "juice-subnames-script";
  script.textContent = `
    (function() {
      if (window.__subnamesInstalled) return;
      window.__subnamesInstalled = true;

      let subnamesData = null;
      let subnameInterval = null;

      async function fetchSubnamesData() {
        try {
          const r = await fetch("https://raw.githubusercontent.com/OBS-Akuma/KirkaBadges/refs/heads/main/Json/subnames.json");
          if (!r.ok) throw new Error();
          subnamesData = await r.json();
          console.log('[Subnames] Loaded data');
          return true;
        } catch { 
          console.error('[Subnames] Failed to load data');
          return false; 
        }
      }

      function injectProfileSubname() {
        const valueElement = document.querySelector(".card-profile .copy-cont .value");
        if (!valueElement) return;
        const text = valueElement.textContent.trim();
        const currentId = text.startsWith("#") ? text.substring(1) : text;
        if (!currentId) return;
        const subname = subnamesData?.find(item => item.id === currentId)?.subname;
        if (!subname) return;
        const existing = valueElement.parentNode.querySelector(".kirka-subname-profile");
        if (existing && existing.textContent === \` (\${subname})\`) return;
        if (existing) existing.remove();
        const span = document.createElement("span");
        span.className = "kirka-subname-profile";
        span.textContent = \` (\${subname})\`;
        span.style.cssText = "color: #888888 !important; font-size: 0.9rem !important; font-weight: normal !important; display: inline-block !important; margin-left: 4px !important;";
        valueElement.insertAdjacentElement("afterend", span);
      }

      function injectFriendSubnames() {
        for (const friend of document.querySelectorAll(".friend")) {
          const friendIdEl = friend.querySelector(".friend-desc .friend-id");
          if (!friendIdEl) continue;
          const shortId = friendIdEl.textContent.trim();
          if (!shortId) continue;
          const subname = subnamesData?.find(item => item.id === shortId)?.subname;
          if (!subname) continue;
          const parent = friendIdEl.parentNode;
          const existing = parent.querySelector(".kirka-subname-friend");
          if (existing && existing.textContent === \` (\${subname})\`) continue;
          if (existing) existing.remove();
          const span = document.createElement("span");
          span.className = "kirka-subname-friend";
          span.textContent = \` (\${subname})\`;
          span.style.cssText = "color: #888888 !important; font-size: 0.8rem !important; font-weight: normal !important; display: inline-block !important; margin-left: 4px !important;";
          friendIdEl.insertAdjacentElement("afterend", span);
        }
      }

      function injectAllSubnames() {
        if (!subnamesData) return;
        
        const path = window.location.pathname;
        

        if (path.includes("/profile/")) {
          injectProfileSubname();
        }
        

        if (path.includes("/friends")) {
          injectFriendSubnames();
        }
      }

      function startSubnamePersistence() {
        if (subnameInterval) clearInterval(subnameInterval);
        subnameInterval = setInterval(() => {
          if (location.href.includes("/profile/") || location.href.includes("/friends")) {
            injectAllSubnames();
          }
        }, 500);
      }


      fetchSubnamesData().then(() => {
        injectAllSubnames();
        startSubnamePersistence();
        

        const observer = new MutationObserver(() => {
          injectAllSubnames();
        });
        observer.observe(document.body, { childList: true, subtree: true });
        

        let lastUrl = window.location.href;
        setInterval(() => {
          if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            setTimeout(() => injectAllSubnames(), 100);
          }
        }, 500);
        
        console.log('[Subnames] Initialized');
      });
    })();
  `;
  document.head.appendChild(script);
}

stopSubnames() {
  const script = document.getElementById("juice-subnames-script");
  if (script) script.remove();
  

  document.querySelectorAll('.kirka-subname-profile, .kirka-subname-friend, .kirka-subname-lobby').forEach(el => {
    el.remove();
  });
}



initSwapper() {
  const SWAPPER_API = "https://raw.githubusercontent.com/OBS-Akuma/KirkaSkins/refs/heads/main/CleanAllrendersAndTextures.json";

  const WEAPON_FILE_MAP = {
    "scar":     { texture: "texture.b3fc7981.webp", render: "render.b3fc7981.webp" },
    "ar-9":     { texture: "texture.1794de31.webp", render: "render.1794de31.webp" },
    "mac-10":   { texture: "texture.36d894bd.webp", render: "render.36d894bd.webp" },
    "m60":      { texture: "texture.b658c822.webp", render: "render.b658c822.webp" },
    "tomahawk": { texture: "texture.397a3f05.webp", render: "render.397a3f05.webp" },
    "vita":     { texture: "texture.b2a49027.webp", render: "render.b2a49027.webp" },
    "shark":    { texture: "texture.6c8a6582.webp", render: "render.6c8a6582.webp" },
    "revolver": { texture: "texture.0bed9187.webp", render: "render.0bed9187.webp" },
    "bayonet":  { texture: "texture.76c24e59.webp", render: "render-mini.f3df9462.webp" },
    "lar":      { texture: "texture.d97db214.webp", render: "render.d97db214.webp" },
    "weatie":   { texture: "texture.212a85fe.webp", render: "render.212a85fe.webp" },
    "characters": { texture: "texture.df509d7b.png", render: "render.df509d7b.png" },
  };

  const os   = require("os");
  const path = require("path");
  const fs   = require("fs");

  const SWAPPER_DIR = path.join(os.homedir(), "Documents", "SmudgyClient", "swapper", "assets", "img");

  let allSkins = [];
  let loaded   = false;
  let pendingTextureUrl  = null;
  let pendingRenderUrl   = null;
  let pendingSkinId      = null;

  const grid      = this.menu.querySelector("#swapper-grid");
  const loading   = this.menu.querySelector("#swapper-loading");
  const emptyEl   = this.menu.querySelector("#swapper-empty");
  const searchEl  = this.menu.querySelector("#swapper-search");
  const weaponFilter = this.menu.querySelector("#swapper-weapon-filter");

  const modal       = this.menu.querySelector("#swapper-weapon-modal");
  const modalRender = this.menu.querySelector("#swapper-modal-render");
  const modalStatus = this.menu.querySelector("#swapper-modal-status");
  const modalClose  = this.menu.querySelector("#swapper-modal-close");

  if (!grid) return;



  const getInstalledMap = () => {
    const installed = {};
    
    try {
      if (this.settings && this.settings.swapper_installed) {
        const map = JSON.parse(this.settings.swapper_installed) || {};

        for (const [skinId, weapon] of Object.entries(map)) {
          const files = WEAPON_FILE_MAP[weapon];
          if (files) {
            const texturePath = path.join(SWAPPER_DIR, files.texture);
            const renderPath = path.join(SWAPPER_DIR, files.render);
            if (fs.existsSync(texturePath) && fs.existsSync(renderPath)) {
              installed[skinId] = weapon;
            } else {

              delete map[skinId];
              saveInstalledMap(map);
            }
          }
        }
      }
    } catch {}
    
    return installed;
  };

  const saveInstalledMap = (map) => {
    const mapString = JSON.stringify(map);
    if (this.settings) {
      this.settings.swapper_installed = mapString;
      ipcRenderer.send("update-setting", "swapper_installed", mapString);
    }
    this.localStorage.setItem("swapper-installed", mapString);

    const event = new CustomEvent("juice-settings-changed", {
      detail: { setting: "swapper_installed", value: mapString },
    });
    document.dispatchEvent(event);
  };

  const markSkinInstalled = (skinId, weapon) => {
    const map = {};
    try {
      if (this.settings && this.settings.swapper_installed) {
        const existing = JSON.parse(this.settings.swapper_installed) || {};
        Object.assign(map, existing);
      }
    } catch {}
    

    for (const [key, value] of Object.entries(map)) {
      if (value === weapon) delete map[key];
    }
    
    map[skinId] = weapon;
    saveInstalledMap(map);
  };

  const unmarkSkin = (skinId) => {
    const map = {};
    try {
      if (this.settings && this.settings.swapper_installed) {
        const existing = JSON.parse(this.settings.swapper_installed) || {};
        Object.assign(map, existing);
      }
    } catch {}
    delete map[skinId];
    saveInstalledMap(map);
  };



  const ensureSwapperDir = () => {
    if (!fs.existsSync(SWAPPER_DIR)) {
      fs.mkdirSync(SWAPPER_DIR, { recursive: true });
    }
  };

  const writeTexture = async (textureUrl, renderUrl, weapon) => {
    ensureSwapperDir();
    const files = WEAPON_FILE_MAP[weapon];
    if (!files) throw new Error(`Unknown weapon: ${weapon}`);


    const texturePath = path.join(SWAPPER_DIR, files.texture);
    if (textureUrl.startsWith("data:")) {
      const base64 = textureUrl.split(",")[1];
      if (!base64) throw new Error("Invalid base64 data URI");
      const buf = Buffer.from(base64, "base64");
      fs.writeFileSync(texturePath, buf);
    } else {
      const res = await fetch(textureUrl);
      if (!res.ok) throw new Error(`Fetch failed for texture: ${res.status}`);
      const arrayBuf = await res.arrayBuffer();
      fs.writeFileSync(texturePath, Buffer.from(arrayBuf));
    }


    const renderPath = path.join(SWAPPER_DIR, files.render);
    if (renderUrl.startsWith("data:")) {
      const base64 = renderUrl.split(",")[1];
      if (!base64) throw new Error("Invalid base64 data URI");
      const buf = Buffer.from(base64, "base64");
      fs.writeFileSync(renderPath, buf);
    } else {
      const res = await fetch(renderUrl);
      if (!res.ok) throw new Error(`Fetch failed for render: ${res.status}`);
      const arrayBuf = await res.arrayBuffer();
      fs.writeFileSync(renderPath, Buffer.from(arrayBuf));
    }

    return { texturePath, renderPath };
  };

  const removeTexture = (weapon) => {
    const files = WEAPON_FILE_MAP[weapon];
    if (!files) return false;

    const texturePath = path.join(SWAPPER_DIR, files.texture);
    const renderPath = path.join(SWAPPER_DIR, files.render);
    
    let removed = false;
    if (fs.existsSync(texturePath)) {
      fs.unlinkSync(texturePath);
      removed = true;
    }
    if (fs.existsSync(renderPath)) {
      fs.unlinkSync(renderPath);
      removed = true;
    }
    return removed;
  };



  const openModal = (renderUrl, textureUrl, skinId) => {
    pendingRenderUrl  = renderUrl;
    pendingTextureUrl = textureUrl;
    pendingSkinId     = skinId;

    modalRender.src = renderUrl;
    modalStatus.style.display = "none";
    modalStatus.className = "swapper-modal-status";
    modalStatus.innerText = "";

    modal.querySelectorAll(".swapper-weapon-btn").forEach((btn) => {
      btn.disabled = false;
      btn.querySelector(".text").innerHTML =
        btn.dataset.weapon.charAt(0).toUpperCase() + btn.dataset.weapon.slice(1);
    });

    modal.style.display = "flex";
  };

  const closeModal = () => {
    modal.style.display = "none";
    pendingRenderUrl  = null;
    pendingTextureUrl = null;
    pendingSkinId     = null;
  };

  if (modalClose) {
    modalClose.addEventListener("click", closeModal);
  }

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });



  const createSkinCard = (skin, installed) => {
  let installedWeapon = installed[skin._id] || null;
  

  if (installedWeapon) {
    const files = WEAPON_FILE_MAP[installedWeapon];
    if (files) {
      const texturePath = path.join(SWAPPER_DIR, files.texture);
      const renderPath = path.join(SWAPPER_DIR, files.render);
      if (!fs.existsSync(texturePath) || !fs.existsSync(renderPath)) {
        installedWeapon = null;
        unmarkSkin(skin._id);
      }
    }
  }
  
  const weaponLabel = installedWeapon
    ? installedWeapon.charAt(0).toUpperCase() + installedWeapon.slice(1)
    : null;

  const card = document.createElement("div");

  card.className = installedWeapon ? "skin-card installed" : "skin-card";


  card.innerHTML = `
    <div class="skin-img-wrap">
      <img src="${skin.renderurl}" alt="${skin._id}" loading="lazy"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
      <div class="skin-no-img" style="display:none;"><i class="fas fa-image"></i></div>
      ${installedWeapon
        ? `<span class="skin-rarity-badge" style="background:rgba(var(--green), 0.8); color:#fff; padding:2px 8px; border-radius:4px; font-size:0.65rem; font-weight:600;">${weaponLabel} ✓</span>`
        : ""}
    </div>
    <div class="skin-info">
      <span class="skin-name" title="${this.escapeHtml(skin._id)}">${this.escapeHtml(
    skin._id.length > 18 ? skin._id.slice(0, 18) + "…" : skin._id
  )}</span>
    </div>
    <div class="plugin-actions" style="flex-direction:column; gap:0.3rem; width:100%;">
      <button class="juice-button swapper-apply-btn" style="width:100%;">
        <span class="text"><i class="fas fa-repeat"></i> ${installedWeapon ? "Re-apply" : "Apply"}</span>
        <div class="custom-border"></div>
      </button>
      <!-- Remove button is always in HTML, hidden by CSS unless installed -->
      <button class="juice-button swapper-remove-btn" style="width:100%; margin-top:2px; border-color: rgba(var(--red), 0.5);">
        <span class="text" style="color: rgba(var(--red), 1);"><i class="fas fa-trash"></i> Remove</span>
        <div class="custom-border"></div>
      </button>
    </div>
  `;


  card.querySelector(".swapper-apply-btn").addEventListener("click", () => {
    openModal(skin.renderurl, skin.textureurl, skin._id);
  });


  const removeBtn = card.querySelector(".swapper-remove-btn");
  removeBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!installedWeapon) {
      console.log("No installed weapon to remove");
      return;
    }
    
    const weapon = installedWeapon;
    const textEl = removeBtn.querySelector(".text");

    textEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Removing...`;
    removeBtn.disabled = true;

    try {

      const files = WEAPON_FILE_MAP[weapon];
      if (files) {
        const texturePath = path.join(SWAPPER_DIR, files.texture);
        const renderPath = path.join(SWAPPER_DIR, files.render);
        if (fs.existsSync(texturePath)) fs.unlinkSync(texturePath);
        if (fs.existsSync(renderPath)) fs.unlinkSync(renderPath);
      }
      

      unmarkSkin(skin._id);
      

      renderSkins();
    } catch (err) {
      console.error("[Swapper] Remove failed:", err);
      textEl.innerHTML = `<i class="fas fa-xmark"></i> Failed`;
      setTimeout(() => {
        textEl.innerHTML = `<i class="fas fa-trash"></i> Remove`;
        removeBtn.disabled = false;
      }, 2000);
    }
  });

  return card;
};


  const renderSkins = () => {
    const query = (searchEl ? searchEl.value : "").toLowerCase().trim();
    const weaponOnly = weaponFilter ? weaponFilter.value : "";
    const installed = getInstalledMap();

    let filtered = [...allSkins];

    if (query) {
      filtered = filtered.filter((s) =>
        s._id.toLowerCase().includes(query)
      );
    }

    if (weaponOnly) {
      filtered = filtered.filter((s) => {
        return installed[s._id] === weaponOnly;
      });
      
      if (!filtered.length && !query) {
        filtered = allSkins;
      }
    }

    grid.innerHTML = "";

    if (!filtered.length) {
      grid.style.display = "none";
      emptyEl.style.display = "flex";
      return;
    }

    emptyEl.style.display = "none";
    grid.style.display = "grid";

    filtered.sort((a, b) => {
      const aHas = !!installed[a._id] ? 1 : 0;
      const bHas = !!installed[b._id] ? 1 : 0;
      return bHas - aHas;
    });

    filtered.forEach((skin) => {
      const card = createSkinCard(skin, installed);
      grid.appendChild(card);
    });
  };



  modal.querySelectorAll(".swapper-weapon-btn").forEach((btn) => {
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);

    fresh.addEventListener("click", async () => {
      if (!pendingTextureUrl || !pendingRenderUrl) return;

      const weapon = fresh.dataset.weapon;
      if (!WEAPON_FILE_MAP[weapon]) return;

      const textEl = fresh.querySelector(".text");
      const originalHTML = textEl.innerHTML;

      fresh.disabled = true;
      textEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
      modalStatus.style.display = "none";

      try {

        await writeTexture(pendingTextureUrl, pendingRenderUrl, weapon);

        if (pendingSkinId) markSkinInstalled(pendingSkinId, weapon);

        textEl.innerHTML = `<i class="fas fa-check"></i> Done`;
        modalStatus.className = "swapper-modal-status success";
        modalStatus.innerText = `Applied ${weapon.toUpperCase()}! Restart client to see changes.`;
        modalStatus.style.display = "block";

        setTimeout(() => {
          closeModal();
          renderSkins();
        }, 1800);

      } catch (err) {
        console.error("[Swapper] Write failed:", err);
        textEl.innerHTML = `<i class="fas fa-xmark"></i> Failed`;
        fresh.disabled = false;
        modalStatus.className = "swapper-modal-status error";
        modalStatus.innerText = `Error: ${err.message}`;
        modalStatus.style.display = "block";
        setTimeout(() => {
          textEl.innerHTML = originalHTML;
          modalStatus.style.display = "none";
        }, 2500);
      }
    });
  });



  const loadSwapper = async () => {
    loading.style.display = "flex";
    grid.style.display = "none";
    emptyEl.style.display = "none";

    try {
      const raw = await fetch(SWAPPER_API).then((r) => r.json());
      
      allSkins = Object.entries(raw).map(([id, data]) => ({
        _id: id,
        renderurl: data.renderurl || "",
        textureurl: data.textureurl || "",
      })).filter((s) => s.renderurl && s.textureurl);

      if (allSkins.length === 0) {
        throw new Error("No skins found in the API response");
      }

    } catch (err) {
      loading.style.display = "none";
      grid.style.display = "grid";
      grid.innerHTML = `<div class="assets-empty"><i class="fas fa-triangle-exclamation"></i><span>Failed to load textures: ${err.message}</span></div>`;
      console.error("[Swapper] load failed:", err);
      return;
    }

    loading.style.display = "none";
    renderSkins();
  };


  if (searchEl) searchEl.addEventListener("input", () => renderSkins());
  if (weaponFilter) weaponFilter.addEventListener("change", () => renderSkins());



  const gunsPanel = this.menu.querySelector("#swapper-guns");
  const soundsPanel = this.menu.querySelector("#swapper-sounds");
  const defaultPanel = this.menu.querySelector("#swapper-options");

  if (gunsPanel) {
    gunsPanel.style.display = "none";
    gunsPanel.classList.remove("active");
  }
  if (soundsPanel) {
    soundsPanel.style.display = "none";
    soundsPanel.classList.remove("active");
  }
  if (defaultPanel) {
    defaultPanel.style.display = "";
    defaultPanel.classList.add("active");
  }

  const showSwapperPanel = (tabName) => {
    if (defaultPanel) {
      defaultPanel.style.display = "none";
      defaultPanel.classList.remove("active");
    }
    if (gunsPanel) {
      gunsPanel.style.display = "none";
      gunsPanel.classList.remove("active");
    }
    if (soundsPanel) {
      soundsPanel.style.display = "none";
      soundsPanel.classList.remove("active");
    }

    if (tabName === "guns") {
      if (gunsPanel) {
        gunsPanel.style.display = "";
        gunsPanel.classList.add("active");
      }
    } else if (tabName === "sounds") {
      if (soundsPanel) {
        soundsPanel.style.display = "";
        soundsPanel.classList.add("active");
      }
    } else {
      if (defaultPanel) {
        defaultPanel.style.display = "";
        defaultPanel.classList.add("active");
      }
    }
  };

  const subtabContainer = this.menu.querySelector("#swapper-subtabs");
  if (subtabContainer) {
    subtabContainer.addEventListener("click", (e) => {
      const tab = e.target.closest(".swapper-subtab");
      if (!tab || tab.classList.contains("locked")) return;

      subtabContainer.querySelectorAll(".swapper-subtab").forEach((t) =>
        t.classList.remove("active")
      );
      tab.classList.add("active");

      const tabName = tab.dataset.swapperTab;
      showSwapperPanel(tabName);

      if (tabName === "guns" && !loaded) {
        loaded = true;
        loadSwapper();
      }
    });
  }

  const mainTab = this.menu.querySelector(`[data-tab="swapper"]`);
  if (mainTab) {
    mainTab.addEventListener("click", () => {
      showSwapperPanel(null);
      if (subtabContainer) {
        subtabContainer.querySelectorAll(".swapper-subtab").forEach((t) =>
          t.classList.remove("active")
        );
      }
    });
  }
}



initKirkaBadges() {

  const enabled = this.settings["kirka_badges_enabled"] ?? false;
  if (!enabled) {
    this.stopKirkaBadges();
    return;
  }


  this.injectKirkaBadgesScript();
}

injectKirkaBadgesScript() {
  if (document.getElementById("juice-kirka-badges-script")) return;

  const script = document.createElement("script");
  script.id = "juice-kirka-badges-script";
  
  const badgeSize = this.settings["kirka_badges_size"] || 16;
  const showBrackets = this.settings["kirka_badges_brackets"] !== false;
  
  script.textContent = `
    (function() {
      if (window.__kirkaBadgesInstalled) return;
      window.__kirkaBadgesInstalled = true;

      const BADGE_API = 'https://raw.githubusercontent.com/OBS-Akuma/KirkaBadges/refs/heads/main/Json/badge.json';
      const PROFILE_API = 'https://api2.kirka.io/api/wNmwWMWn/wWWnwmNM';

      const defaultColor = '#FFE881';
      const BADGE_SIZE = ${badgeSize};
      const SHOW_BRACKETS = ${showBrackets};

      const badgeMap = {};
      const verifiedUsers = {};
      const processedIds = new Set();

      let ws = null;
      let observer = null;

      async function loadBadges() {
        try {
          const res = await fetch(BADGE_API);
          const data = await res.json();
          data.forEach(entry => {
            if (entry.shortId) {
              badgeMap[entry.shortId] = {
                gradient: entry.gradient ? buildGradient(entry.gradient) : null,
                badges: Array.isArray(entry.badges) && entry.badges.length > 0
                  ? entry.badges
                  : null,
                font: entry.font || null,
              };
            }
          });
          console.log('[KirkaBadges] Loaded badge data');
        } catch(e) {
          console.error('[KirkaBadges] Failed to load badges, retrying...');
          setTimeout(loadBadges, 5000);
        }
      }

      function buildGradient(gradient) {
        return \`linear-gradient(\${gradient.rot}, \${gradient.stops.join(', ')})\`;
      }

      async function fetchProfile(shortId) {
        try {
          const res = await fetch(PROFILE_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ WwmMWw: shortId, wmWW: true })
          });
          const data = await res.json();
          return { username: data.wNmnw, level: data.wnNwWmMW };
        } catch(e) {
          processedIds.delete(shortId);
          return {};
        }
      }

      function applyGradient(el, gradientStyle) {
        el.style.color = 'transparent';
        el.style.background = gradientStyle;
        el.style.webkitBackgroundClip = 'text';
        el.style.backgroundClip = 'text';
        el.style.webkitTextFillColor = 'transparent';
      }

      function applyDefault(el) {
        el.style.color = defaultColor;
        el.style.background = '';
        el.style.webkitBackgroundClip = '';
        el.style.backgroundClip = '';
        el.style.webkitTextFillColor = '';
      }

      function getUserKey(name, level) {
        return \`\${name}:\${level}\`;
      }

      function injectFont(fontUrl) {
        if (!fontUrl) return;
        try {
          const existing = document.head.querySelector(\`link[data-kirka-font="\${CSS.escape(fontUrl)}"]\`);
          if (existing) return;
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = fontUrl;
          link.setAttribute('data-kirka-font', fontUrl);
          document.head.appendChild(link);
        } catch(e) {}
      }

      function colorMessage(msg) {
        try {
          const authorEl = msg.querySelector('.author-name');
          if (!authorEl) return;

          const name = authorEl.textContent.trim().replace(':', '');
          
          const lvlEl = msg.querySelector('.lvl .value');
          const level = lvlEl ? parseInt(lvlEl.textContent.trim()) : null;

          const lvlSpan = msg.querySelector('.lvl');
          if (lvlSpan) {
            lvlSpan.style.color = '';
            lvlSpan.style.background = '';
            lvlSpan.style.webkitTextFillColor = '';
          }

          const key = getUserKey(name, level);
          const userInfo = verifiedUsers[key];

          if (userInfo && userInfo.gradient) {
            applyGradient(authorEl, userInfo.gradient);
          } else {
            applyDefault(authorEl);
          }

          const hasBadges = userInfo && userInfo.badges && userInfo.badges.length > 0;
          const badgeUrls = hasBadges ? userInfo.badges : [];

          let container = msg.querySelector('.kirka-badges-container');

          if (hasBadges) {
            if (!container) {
              const textSpan = msg.querySelector('.text');
              if (textSpan) {
                container = document.createElement('span');
                container.className = 'kirka-badges-container';
                container.style.cssText = 'display:inline-flex;align-items:center;gap:2px;margin-left:4px;margin-right:6px;vertical-align:middle;';

                if (SHOW_BRACKETS) {
                  const leftBracket = document.createElement('span');
                  leftBracket.textContent = '[';
                  leftBracket.style.cssText = 'color:#FFE881;font-weight:bold;font-size:14px;';
                  container.appendChild(leftBracket);
                }

                badgeUrls.forEach(url => {
                  const img = document.createElement('img');
                  img.src = url;
                  img.style.cssText = \`width:\${BADGE_SIZE}px;height:\${BADGE_SIZE}px;object-fit:contain;vertical-align:middle;pointer-events:none;\`;
                  container.appendChild(img);
                });

                if (SHOW_BRACKETS) {
                  const rightBracket = document.createElement('span');
                  rightBracket.textContent = ']';
                  rightBracket.style.cssText = 'color:#FFE881;font-weight:bold;font-size:14px;';
                  container.appendChild(rightBracket);
                }

                textSpan.parentNode.insertBefore(container, textSpan);
              }
            } else {
              const imgs = container.querySelectorAll('img');
              badgeUrls.forEach((url, i) => {
                if (imgs[i]) {
                  if (imgs[i].src !== url) imgs[i].src = url;
                } else {
                  const img = document.createElement('img');
                  img.src = url;
                  img.style.cssText = \`width:\${BADGE_SIZE}px;height:\${BADGE_SIZE}px;object-fit:contain;vertical-align:middle;pointer-events:none;\`;
                  container.appendChild(img);
                }
              });
              for (let i = badgeUrls.length; i < imgs.length; i++) {
                imgs[i].remove();
              }
              container.style.display = 'inline-flex';
            }
          } else {
            if (container) {
              container.remove();
            }
          }
        } catch(e) {}
      }

      function updateMessages() {
        document.querySelectorAll('.message').forEach(colorMessage);
      }

      async function handleShortId(shortId) {
        if (processedIds.has(shortId)) return;
        if (!badgeMap[shortId]) return;
        processedIds.add(shortId);

        const entry = badgeMap[shortId];
        if (entry.font) injectFont(entry.font);

        const profile = await fetchProfile(shortId);
        if (profile.username && profile.level !== undefined) {
          const key = getUserKey(profile.username, profile.level);
          verifiedUsers[key] = {
            gradient: entry.gradient,
            badges: entry.badges,
          };
          updateMessages();
        }
      }

      function connectToChat() {
        if (ws) {
          try { ws.close(); } catch(e) {}
        }

        ws = new WebSocket('wss://chat.kirka.io/');

        ws.addEventListener('open', () => {
          console.log('[KirkaBadges] Connected to chat');
          const ping = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 0 }));
            } else {
              clearInterval(ping);
            }
          }, 30000);
        });

        ws.addEventListener('message', (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 2 && data.user) {
              const { shortId } = data.user;
              handleShortId(shortId);
            }
          } catch(e) {}
        });

        ws.addEventListener('close', () => {
          console.log('[KirkaBadges] Chat disconnected, reconnecting...');
          setTimeout(connectToChat, 3000);
        });

        ws.addEventListener('error', () => {
          console.log('[KirkaBadges] Chat error, reconnecting...');
          setTimeout(connectToChat, 3000);
        });
      }

      function startObserver() {
        if (observer) observer.disconnect();
        observer = new MutationObserver((mutations) => {
          mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
              if (node.nodeType !== 1) return;
              if (node.classList?.contains('message')) {
                colorMessage(node);
              }
              node.querySelectorAll?.('.message').forEach(colorMessage);
            });
          });
          updateMessages();
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }


      setInterval(updateMessages, 1000);


      setInterval(() => {
        startObserver();
      }, 30000);


      loadBadges().then(() => {
        updateMessages();
        startObserver();
        connectToChat();
        console.log('[KirkaBadges] Initialized');
      });
    })();
  `;
  document.head.appendChild(script);
}

stopKirkaBadges() {
  const script = document.getElementById("juice-kirka-badges-script");
  if (script) script.remove();
  

  document.querySelectorAll('.kirka-badges-container').forEach(el => {
    el.remove();
  });
}

initKeyWatcher() {
  const enabled = this.settings["key_watcher_enabled"] ?? false;
  if (!enabled) {
    this.removeKeyWatcher();
    return;
  }

  // Remove existing watcher if present
  this.removeKeyWatcher();

  // Get settings
  const posX = this.settings["key_watcher_pos_x"] ?? 14;
  const posY = this.settings["key_watcher_pos_y"] ?? 14;
  const activeBgColor = this.settings["key_watcher_active_bg"] || "#ffffff";
  const activeTextColor = this.settings["key_watcher_active_text"] || "#ffffff";
  const inactiveBgColor = this.settings["key_watcher_inactive_bg"] || "#262626";
  const inactiveTextColor = this.settings["key_watcher_inactive_text"] || "#aaaaaa";

  // Inject script
  const script = document.createElement("script");
  script.id = "juice-key-watcher-script";
  script.textContent = `
    (function() {
      if (window.__keyWatcherRunning) return;
      window.__keyWatcherRunning = true;

      // Store current settings
      let currentPosX = ${posX};
      let currentPosY = ${posY};
      let currentActiveBg = "${activeBgColor}";
      let currentActiveText = "${activeTextColor}";
      let currentInactiveBg = "${inactiveBgColor}";
      let currentInactiveText = "${inactiveTextColor}";

      function shouldShow() {
        return window.location.pathname.includes('/games/');
      }

      function updatePosition() {
        const ko = document.getElementById('__ko');
        if (!ko) return;
        ko.style.left = currentPosX + 'px';
        ko.style.top = currentPosY + 'px';
      }

      function updateAllKeys() {
        document.querySelectorAll('#__ko .k').forEach(k => {
          if (k.classList.contains('on')) {
            k.style.background = currentActiveBg;
            k.style.color = currentActiveText;
          } else {
            k.style.background = currentInactiveBg;
            k.style.color = currentInactiveText;
          }
        });
      }

      function buildOverlay() {
        if (document.getElementById('__ko')) return;

        const el = document.createElement('div');
        el.id = '__ko';

        function makeKey(label, classes) {
          const k = document.createElement('div');
          k.className = 'k' + (classes ? ' ' + classes : '');
          k.textContent = label;
          k.style.background = currentInactiveBg;
          k.style.color = currentInactiveText;
          return k;
        }

        function makeRow(...keys) {
          const r = document.createElement('div');
          r.className = 'r';
          keys.forEach(k => r.appendChild(k));
          return r;
        }

        el.appendChild(makeRow(makeKey('W')));
        el.appendChild(makeRow(makeKey('A'), makeKey('S'), makeKey('D')));
        el.appendChild(makeRow(makeKey('SPACE', 'wide'), makeKey('SHIFT', 'medium')));
        el.appendChild(makeRow(makeKey('RMB', 'medium'), makeKey('LMB', 'medium')));

        const labels = ['w','a','s','d','space','shift','rmb','lmb'];
        el.querySelectorAll('.k').forEach((k, i) => {
          k.id = 'ko-' + labels[i];
        });

        // Set position
        el.style.left = currentPosX + 'px';
        el.style.top = currentPosY + 'px';

        // Hide initially if on games page
        if (shouldShow()) {
          el.style.display = '';
        } else {
          el.style.display = 'none';
        }

        document.body.appendChild(el);

        // Update colors when settings change
        window.__updateKeyColors = function(activeBg, activeText, inactiveBg, inactiveText) {
          currentActiveBg = activeBg;
          currentActiveText = activeText;
          currentInactiveBg = inactiveBg;
          currentInactiveText = inactiveText;
          updateAllKeys();
        };

        // Update position when settings change
        window.__updateKeyPosition = function(x, y) {
          currentPosX = x;
          currentPosY = y;
          updatePosition();
        };
      }

      function destroyOverlay() {
        document.getElementById('__ko')?.remove();
        window.__updateKeyColors = null;
        window.__updateKeyPosition = null;
      }

      const map = {
        KeyW: 'ko-w', KeyA: 'ko-a', KeyS: 'ko-s', KeyD: 'ko-d',
        Space: 'ko-space', ShiftLeft: 'ko-shift', ShiftRight: 'ko-shift'
      };

      const on  = id => {
        const el = document.getElementById(id);
        if (el) {
          el.classList.add('on');
          el.style.background = currentActiveBg;
          el.style.color = currentActiveText;
        }
      };
      const off = id => {
        const el = document.getElementById(id);
        if (el) {
          el.classList.remove('on');
          el.style.background = currentInactiveBg;
          el.style.color = currentInactiveText;
        }
      };

      document.addEventListener('keydown', e => {
        if (map[e.code]) on(map[e.code]);
      });
      document.addEventListener('keyup', e => {
        if (map[e.code]) off(map[e.code]);
      });
      document.addEventListener('mousedown', e => {
        if (e.button === 0) on('ko-lmb');
        if (e.button === 2) on('ko-rmb');
      });
      document.addEventListener('mouseup', e => {
        if (e.button === 0) off('ko-lmb');
        if (e.button === 2) off('ko-rmb');
      });

      function checkUrl() {
        const ko = document.getElementById('__ko');
        if (!ko) return;
        if (shouldShow()) {
          ko.style.display = '';
        } else {
          ko.style.display = 'none';
          // Reset all keys when hiding
          document.querySelectorAll('#__ko .k').forEach(k => {
            k.classList.remove('on');
            k.style.background = currentInactiveBg;
            k.style.color = currentInactiveText;
          });
        }
      }

      // Intercept pushState for SPA navigation
      const _push = history.pushState.bind(history);
      history.pushState = function (...args) {
        _push(...args);
        checkUrl();
      };

      const _replace = history.replaceState.bind(history);
      history.replaceState = function (...args) {
        _replace(...args);
        checkUrl();
      };

      window.addEventListener('popstate', checkUrl);

      // Build overlay initially
      buildOverlay();

      // Cleanup function
      window.__keyWatcherCleanup = function() {
        destroyOverlay();
        window.__keyWatcherRunning = false;
        window.__keyWatcherCleanup = null;
        window.__updateKeyColors = null;
        window.__updateKeyPosition = null;
      };

      console.log('[KeyWatcher] Initialized with position:', currentPosX, currentPosY);
    })();
  `;

  document.head.appendChild(script);
}

removeKeyWatcher() {
  // Remove script
  const script = document.getElementById('juice-key-watcher-script');
  if (script) script.remove();

  // Cleanup if available
  if (window.__keyWatcherCleanup) {
    window.__keyWatcherCleanup();
  }

  // Remove overlay
  const overlay = document.getElementById('__ko');
  if (overlay) overlay.remove();

  window.__keyWatcherRunning = false;
}

removeKeyWatcher() {
  // Remove script
  const script = document.getElementById('juice-key-watcher-script');
  if (script) script.remove();

  // Cleanup if available
  if (window.__keyWatcherCleanup) {
    window.__keyWatcherCleanup();
  }

  // Remove overlay
  const overlay = document.getElementById('__ko');
  if (overlay) overlay.remove();

  window.__keyWatcherRunning = false;
}

removeKeyWatcher() {
  // Remove script
  const script = document.getElementById('juice-key-watcher-script');
  if (script) script.remove();

  // Cleanup if available
  if (window.__keyWatcherCleanup) {
    window.__keyWatcherCleanup();
  }

  // Remove overlay
  const overlay = document.getElementById('__ko');
  if (overlay) overlay.remove();

  window.__keyWatcherRunning = false;
}
  initSkins() {
    const SKINS_API   = "https://opensheet.elk.sh/1pxMSoaSo8FYv-OIJ26HpSj8EDy7EDRmatHyQW24o6E4/1";
    const RENDERS_API = "https://raw.githubusercontent.com/OBS-Akuma/KirkaSkins/refs/heads/main/itemrenders.json";

    const RARITY_ORDER = ["Common", "Paranormal", "Rare", "Epic", "Legendary", "Mythical"];

    let allSkins = [];
    let renders  = {};
    let loaded   = false;

    const grid     = this.menu.querySelector("#skins-grid");
    const loading  = this.menu.querySelector("#skins-loading");
    const emptyEl  = this.menu.querySelector("#skins-empty");
    const searchEl = this.menu.querySelector("#skins-search");
    const rarityEl = this.menu.querySelector("#skins-rarity-filter");
    const typeEl   = this.menu.querySelector("#skins-type-filter");

    if (!grid) return;

    const renderSkins = () => {
      const query  = (searchEl.value || "").toLowerCase().trim();
      const rarity = rarityEl.value;
      const type   = typeEl.value;

      const filtered = allSkins.filter((s) => {
        if (query  && !s["Skin Name"].toLowerCase().includes(query))  return false;
        if (rarity && s["Skin Rarity"] !== rarity)                    return false;
        if (type   && s["Type"] !== type)                             return false;
        return true;
      });

      grid.innerHTML = "";

      if (!filtered.length) {
        grid.style.display = "none";
        emptyEl.style.display = "flex";
        return;
      }

      emptyEl.style.display = "none";
      grid.style.display = "grid";

      filtered.forEach((skin) => {
        const name   = skin["Skin Name"]     || "Unknown";
        const rarity = skin["Skin Rarity"]   || "";
        const value  = skin["Base Value"]    || "";
        const obtain = skin["Obtainable By"] || "";
        const type   = skin["Type"]          || "";
        const imgSrc = renders[name]         || "";

        const rarityLower = rarity.toLowerCase();

        const card = document.createElement("div");
        card.className = `skin-card skin-rarity-${rarityLower}`;

        card.innerHTML = `
          <div class="skin-img-wrap">
            ${imgSrc
              ? `<img src="${imgSrc}" alt="${name}" loading="lazy" />`
              : `<div class="skin-no-img"><i class="fas fa-shirt"></i></div>`}
            <span class="skin-rarity-badge skin-rarity-${rarityLower}">${rarity}</span>
          </div>
          <div class="skin-info">
            <span class="skin-name" title="${name}">${name}</span>
            <div class="skin-meta">
              <span class="skin-meta-row"><i class="fas fa-tag"></i> ${type}</span>
              <span class="skin-meta-row"><i class="fas fa-coins"></i> ${value}</span>
              <span class="skin-meta-row skin-obtain"><i class="fas fa-box-open"></i> ${obtain}</span>
            </div>
          </div>
        `;

        grid.appendChild(card);
      });
    };

    const populateTypes = () => {
      const types = [...new Set(allSkins.map((s) => s["Type"]).filter(Boolean))].sort();
      typeEl.innerHTML = `<option value="">All Types</option>`;
      types.forEach((t) => {
        const opt = document.createElement("option");
        opt.value = t;
        opt.textContent = t;
        typeEl.appendChild(opt);
      });
    };

    const loadSkins = async () => {
      loading.style.display = "flex";
      grid.style.display    = "none";
      emptyEl.style.display = "none";

      try {
        const [skinsData, rendersData] = await Promise.all([
          fetch(SKINS_API).then((r) => r.json()),
          fetch(RENDERS_API).then((r) => r.json()),
        ]);

        allSkins = skinsData.sort((a, b) => {
          const ai = RARITY_ORDER.indexOf(a["Skin Rarity"]);
          const bi = RARITY_ORDER.indexOf(b["Skin Rarity"]);
          return bi - ai;
        });
        renders = rendersData;

        populateTypes();
      } catch (err) {
        loading.style.display = "none";
        grid.style.display    = "grid";
        grid.innerHTML = `<div class="assets-empty"><i class="fas fa-triangle-exclamation"></i><span>Failed to load skins</span></div>`;
        console.error("[Skins] load failed:", err);
        return;
      }

      loading.style.display = "none";
      renderSkins();
    };

    searchEl.addEventListener("input", renderSkins);
    rarityEl.addEventListener("change", renderSkins);
    typeEl.addEventListener("change", renderSkins);

    const skinsSubtab = this.menu.querySelector(`[data-tools-tab="skins"]`);
    if (skinsSubtab) {
      skinsSubtab.addEventListener("click", () => {
        if (!loaded) {
          loaded = true;
          loadSkins();
        }
      });
    }
  }



  initAssets() {
    const TEXTURE_API   = "https://raw.githubusercontent.com/imnotkoolkid/KCH/refs/heads/main/data/texture.json";
    const CROSSHAIR_API = "https://raw.githubusercontent.com/imnotkoolkid/KCH/refs/heads/main/data/crosshair.json";
    const CSS_API       = "https://raw.githubusercontent.com/imnotkoolkid/KCH/refs/heads/main/data/css.json";
    const MAPS_API      = "https://raw.githubusercontent.com/imnotkoolkid/KCH/refs/heads/main/data/maps.json";
    const TEXTURE_KEY   = "SETTINGS___SETTING/BLOCKS___SETTING/TEXTURE_URL___SETTING";
    const CROSSHAIR_KEY = "SETTINGS___SETTING/SNIPER___SETTING/SCOPE_URL___SETTING";

    const FAV_KEY        = "juice-asset-favorites";
    const DAYMIAN_BASE   = "https://css.daymian.xyz";
    const DAYMIAN_EXCLUDED = new Set([
      "pink", "purp", "uwu", "wolfey", "jett", "monochrome",
    ]);

    let textureData  = [];
    let crosshairData = [];
    let cssData      = [];
    let mapsData     = [];
    let currentType  = "css";
    let loaded       = false;
    let assetsQuery  = "";

    let favorites;
    try {
      favorites = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]"));
    } catch {
      favorites = new Set();
    }

    const favKey    = (type, id) => `${type}:${id}`;
    const isFav     = (type, id) => favorites.has(favKey(type, id));
    const saveFavs  = () => {
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
      const imgSrc     = type === "textures" ? item.textureImage : item.Crosshair;
      if (!imgSrc) return null;
      const storageKey = type === "textures" ? TEXTURE_KEY : CROSSHAIR_KEY;
      const favActive  = isFav(type, item.id);

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

    const renderMapsGrid = (grid, data) => {
      grid.innerHTML = "";
      grid.style.gridTemplateColumns = "repeat(3, 1fr)";

      const filtered = assetsQuery
        ? data.filter((m) => m.name.toLowerCase().includes(assetsQuery))
        : data;

      if (!filtered.length) {
        grid.innerHTML = `<div class="assets-empty"><i class="fas fa-map"></i><span>No maps found</span></div>`;
        return;
      }

      filtered.forEach((map) => {
        const card = document.createElement("div");
        card.className = "asset-card map-card";

        card.innerHTML = `
          <div class="asset-img-wrap">
            <img src="${map.img}" alt="${map.name}" />
          </div>
          <div class="asset-info">
            <span class="asset-id">${map.name}</span>
            ${map.modes && map.modes.length
              ? `<div class="asset-tags">${map.modes.map(m => `<span class="asset-tag">${m}</span>`).join("")}</div>`
              : ""}
          </div>
          <button class="asset-apply juice-button map-copy-btn" ${!map.downloadUrl ? "disabled" : ""}>
            <span class="text"><i class="fas fa-copy"></i> Copy</span>
            <div class="custom-border"></div>
          </button>
        `;

        const copyBtn = card.querySelector(".map-copy-btn");
        if (map.downloadUrl) {
          copyBtn.addEventListener("click", async () => {
            const textEl = copyBtn.querySelector(".text");
            try {
              const res = await fetch(map.downloadUrl);
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

    const renderGrid = (type) => {
      const { grid } = getEls();
      if (!grid) return;
      grid.innerHTML = "";
      grid.style.gridTemplateColumns = "";

      if (type === "css") {
        const cssFiltered = assetsQuery
          ? cssData.filter((i) => i.title.toLowerCase().includes(assetsQuery))
          : cssData;
        this.renderCSSGrid(grid, cssFiltered, {
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
        const textureFavs   = textureData.filter((i) => isFav("textures", i.id));
        const crosshairFavs = crosshairData.filter((i) => isFav("crosshairs", i.id));
        const cssFavs       = cssData.filter(
          (i) => isFav("css", i.title) && i.availability !== "showcase" && !!i.downloadUrl
        );

        if (!textureFavs.length && !crosshairFavs.length && !cssFavs.length) {
          grid.innerHTML = `<div class="assets-empty"><i class="fas fa-star"></i><span>No favorites yet, click the star on any asset to add it here</span></div>`;
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

      const filtered = assetsQuery
        ? data.filter((i) => i.id.toLowerCase().includes(assetsQuery))
        : data;

      if (!filtered.length) {
        grid.innerHTML = `<div class="assets-empty"><i class="fas fa-box-open"></i><span>No results for "${assetsQuery}"</span></div>`;
        return;
      }

      const sorted = sortByFav(filtered, type, (item) => item.id);
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
        const doc  = new DOMParser().parseFromString(html, "text/html");
        const items = [];
        doc.querySelectorAll(".css-card").forEach((card) => {
          const titleEl    = card.querySelector(".card-name");
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
      grid.style.display    = "none";

      try {
        const [tex, cross, css, daymian, maps] = await Promise.all([
          fetch(TEXTURE_API).then((r) => r.json()),
          fetch(CROSSHAIR_API).then((r) => r.json()),
          fetch(CSS_API).then((r) => r.json()),
          fetchDaymianCSS(),
          fetch(MAPS_API).then((r) => r.json()),
        ]);
        textureData   = tex;
        crosshairData = cross;
        cssData       = [...css, ...daymian];
        mapsData      = maps;
      } catch (err) {
        loading.style.display = "none";
        grid.style.display    = "grid";
        grid.innerHTML = `<div class="assets-empty"><i class="fas fa-triangle-exclamation"></i><span>Failed to load assets</span></div>`;
        return;
      }

      loading.style.display = "none";
      grid.style.display    = "grid";
      injectAssetsSearch();
      renderGrid(currentType);

      const subtabContainer = this.menu.querySelector("#assets-subtabs");
      if (subtabContainer) {
        subtabContainer.querySelectorAll(".assets-subtab").forEach(t => {
          t.classList.toggle("active", t.dataset.assetsTab === currentType);
        });
      }
    };

    const injectAssetsSearch = () => {
      const assetsPanel = this.menu.querySelector("#assets-options");
      if (!assetsPanel || assetsPanel.querySelector(".assets-search-wrap")) return;
      const wrap = document.createElement("div");
      wrap.className = "assets-search-wrap skins-search-wrap";
      wrap.innerHTML = `<i class="fas fa-search"></i><input id="assets-search" type="text" placeholder="Search assets..." />`;
      const gridGroup = assetsPanel.querySelector(".assets-grid-group");
      assetsPanel.insertBefore(wrap, gridGroup);
      wrap.querySelector("#assets-search").addEventListener("input", (e) => {
        assetsQuery = e.target.value.toLowerCase().trim();
        renderGrid(currentType);
      });
    };

    const subtabContainer = this.menu.querySelector("#assets-subtabs");
    if (subtabContainer) {
      subtabContainer.addEventListener("click", (e) => {
        const tab = e.target.closest(".assets-subtab");
        if (!tab) return;
        subtabContainer.querySelectorAll(".assets-subtab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        assetsQuery = "";
        const searchEl = this.menu.querySelector("#assets-search");
        if (searchEl) searchEl.value = "";
        currentType = tab.dataset.assetsTab;
        renderGrid(currentType);
      });
    }

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
    const NEWS_API = "https:raw.githubusercontent.com/OBS-Akuma/smudgy-client/refs/heads/main/Api/news.json";
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
      feed.style.display    = "none";

      try {
        const res  = await fetch(NEWS_API);
        const data = await res.json();
        loading.style.display = "none";
        feed.style.display    = "block";
        renderNews(data);
      } catch (err) {
        loading.style.display = "none";
        feed.style.display    = "block";
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