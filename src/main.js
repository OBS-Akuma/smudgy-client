require("v8-compile-cache");
const { app, ipcMain, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { initSplash } = require("./windows/splash");
const { initResourceSwapper } = require("./addons/swapper");

const defaults = require("./util/defaults.json");
const userDataPath = app.getPath("userData");
const settingsPath = path.join(userDataPath, "settings.json");


function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, "utf8");
      const savedSettings = JSON.parse(data);
      return { ...defaults.default_settings, ...savedSettings };
    }
  } catch (error) {
    console.error("Error loading settings:", error);
  }
  return { ...defaults.default_settings };
}


function saveSettings(settings) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");
  } catch (error) {
    console.error("Error saving settings:", error);
  }
}

let settings = loadSettings();
let isRestarting = false;


ipcMain.on("get-settings", (event) => {
  event.returnValue = settings;
});

ipcMain.on("update-setting", (event, key, value) => {
  settings[key] = value;
  saveSettings(settings);
  
  const windows = BrowserWindow.getAllWindows();
  windows.forEach(win => {
    win.webContents.send("setting-updated", { key, value });
  });
});

ipcMain.on("reset-juice-settings", () => {
  settings = { ...defaults.default_settings };
  saveSettings(settings);
  
  const windows = BrowserWindow.getAllWindows();
  windows.forEach(win => {
    win.webContents.send("settings-reset", settings);
  });
  
  if (!isRestarting) {
    isRestarting = true;
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 100);
  }
});


ipcMain.handle("install-plugin", async (event, { fileName, content }) => {
  console.log("[Main] Installing plugin:", fileName);
  try {
    const scriptsDir = path.join(
      os.homedir(), "Documents", "SmudgyClient", "scripts"
    );
    if (!fs.existsSync(scriptsDir)) {
      fs.mkdirSync(scriptsDir, { recursive: true });
    }
    const filePath = path.join(scriptsDir, fileName);
    fs.writeFileSync(filePath, content, "utf8");
    console.log("[Main] Plugin installed successfully:", fileName);
    return true;
  } catch (err) {
    console.error("[Main] Error installing plugin:", err);
    return false;
  }
});

ipcMain.handle("uninstall-plugin", async (event, fileName) => {
  console.log("[Main] ===== UNINSTALL CALLED =====");
  console.log("[Main] Uninstalling plugin:", fileName);
  try {
    const scriptsDir = path.join(
      os.homedir(), "Documents", "SmudgyClient", "scripts"
    );
    const filePath = path.join(scriptsDir, fileName);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log("[Main] Plugin deleted:", filePath);
      return true;
    } else {
      console.log("[Main] Plugin not found:", filePath);
      return false;
    }
  } catch (err) {
    console.error("[Main] Error uninstalling plugin:", err);
    return false;
  }
});

ipcMain.on("restart-client", () => {
  if (!isRestarting) {
    isRestarting = true;
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 100);
  }
});


ipcMain.on("open-external", (event, url) => {
  require("electron").shell.openExternal(url);
});

app.on("ready", () => {
  initSplash();
  initResourceSwapper();
});

app.on("window-all-closed", () => {
  if (!isRestarting) {
    app.quit();
  }
});