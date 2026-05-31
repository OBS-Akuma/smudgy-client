const { BrowserWindow, ipcMain, app, shell, dialog } = require("electron");
const { default_settings, allowed_urls } = require("../util/defaults.json");
const { registerShortcuts } = require("../util/shortcuts");
const { applySwitches } = require("../util/switches");
const DiscordRPC = require("../addons/rpc");
const { initGameFeatures } = require("./gamefeatures");
const path = require("path");
const Store = require("electron-store");
const fs = require("fs");

const store = new Store();
if (!store.has("settings")) {
  store.set("settings", default_settings);
}

const settings = store.get("settings");

for (const key in default_settings) {
  if (
    !settings.hasOwnProperty(key) ||
    typeof settings[key] !== typeof default_settings[key]
  ) {
    settings[key] = default_settings[key];
    store.set("settings", settings);
  }
}

if (!allowed_urls.includes(settings.base_url)) {
  settings.base_url = default_settings.base_url;
  store.set("settings", settings);
}

ipcMain.on("get-settings", (e) => {
  e.returnValue = settings;
});

ipcMain.on("update-setting", (e, key, value) => {
  settings[key] = value;
  store.set("settings", settings);
});

ipcMain.on("open-swapper-folder", () => {
  const swapperPath = path.join(
    app.getPath("documents"),
    "SmudgyClient/swapper/assets"
  );

  if (!fs.existsSync(swapperPath)) {
    fs.mkdirSync(swapperPath, { recursive: true });
    shell.openPath(swapperPath);
  } else {
    shell.openPath(swapperPath);
  }
});

ipcMain.on("open-scripts-folder", () => {
  const scriptsPath = path.join(
    app.getPath("documents"),
    "SmudgyClient/scripts"
  );

  if (!fs.existsSync(scriptsPath)) {
    fs.mkdirSync(scriptsPath, { recursive: true });
    shell.openPath(scriptsPath);
  } else {
    shell.openPath(scriptsPath);
  }
});

ipcMain.on("open-sounds-folder", () => {
  const soundsPath = path.join(
    app.getPath("documents"),
    "SmudgyClient/swapper/assets/media"
  );

  if (!fs.existsSync(soundsPath)) {
    fs.mkdirSync(soundsPath, { recursive: true });
    shell.openPath(soundsPath);
  } else {
    shell.openPath(soundsPath);
  }
});

ipcMain.on("open-external", (_, url) => {
  shell.openExternal(url);
});

ipcMain.on("reset-juice-settings", () => {
  store.set("settings", default_settings);
  app.relaunch();
  app.quit();
});

ipcMain.handle("upload-custom-font", async () => {
  const result = await dialog.showOpenDialog({
    title: "Select a font file",
    filters: [{ name: "Fonts", extensions: ["ttf", "otf", "woff", "woff2"] }],
    properties: ["openFile"],
  });
  if (result.canceled || !result.filePaths[0]) return null;

  const sourcePath = result.filePaths[0];
  const fontsDir = path.join(app.getPath("userData"), "customFonts");
  if (!fs.existsSync(fontsDir)) {
    fs.mkdirSync(fontsDir, { recursive: true });
  }

  const destPath = path.join(fontsDir, path.basename(sourcePath));
  fs.copyFileSync(sourcePath, destPath);
  return destPath;
});

ipcMain.handle("remove-custom-font", async (_e, fontPath) => {
  if (fontPath && fs.existsSync(fontPath)) {
    try {
      fs.unlinkSync(fontPath);
    } catch {}
  }
  return true;
});

let gameWindow;

applySwitches(settings);

const createWindow = () => {
  gameWindow = new BrowserWindow({
    fullscreen: settings.auto_fullscreen,
    icon: path.join(__dirname, "../assets/img/icon.png"),
    title: "Smudgy Client",
    width: 1280,
    height: 720,
    show: false,
    backgroundColor: "#141414",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      preload: path.join(__dirname, "../preload/game.js"),
    },
  });

  const scriptsPath = path.join(
    app.getPath("documents"),
    "SmudgyClient",
    "scripts"
  );
  if (!fs.existsSync(scriptsPath)) {
    fs.mkdirSync(scriptsPath, { recursive: true });
  }

  ipcMain.on("get-scripts-path", (e) => {
    e.returnValue = scriptsPath;
  });

  gameWindow.webContents.on("new-window", (e, url) => {
    e.preventDefault();
    require("electron").shell.openExternal(url);
  });

  gameWindow.webContents.on("did-navigate-in-page", (e, url) => {
    gameWindow.webContents.send("url-change", url);

    if (settings.discord_rpc && gameWindow.DiscordRPC) {
      const base_url = settings.base_url;
      const stateMap = {
        [`${base_url}`]: "In the lobby meow",
        [`${base_url}hub/leaderboard`]: "Viewing the leaderboard meow",
        [`${base_url}hub/clans/champions-league`]:
          "Viewing the clan leaderboard",
        [`${base_url}hub/clans/my-clan`]: "Viewing their clan meow",
        [`${base_url}hub/market`]: "Viewing the market meow",
        [`${base_url}hub/live`]: "Viewing videos meow",
        [`${base_url}hub/news`]: "Viewing news meow",
        [`${base_url}hub/terms`]: "Viewing the terms of service meow",
        [`${base_url}store`]: "Viewing the store meow",
        [`${base_url}servers/main`]: "Viewing main servers meow",
        [`${base_url}servers/parkour`]: "Viewing parkour servers meow",
        [`${base_url}servers/custom`]: "Viewing custom servers meow",
        [`${base_url}quests/hourly`]: "Viewing hourly quests meow",
        [`${base_url}friends`]: "Viewing friends meow",
        [`${base_url}inventory`]: "Viewing their inventory meow",
        [`${base_url}/profile/NUGGET`]: "Viewing the smudgy client owners Profle",
      };

      let state;

      if (stateMap[url]) {
        state = stateMap[url];
      } else if (url.startsWith(`${base_url}games/`)) {
        state = "In a match meow";
      } else if (url.startsWith(`${base_url}profile/`)) {
        const profileMatch = url.match(`${base_url}profile/(.+)`);
        if (profileMatch && profileMatch[1]) {
          const shortId = profileMatch[1];
          state = `Viewing player profile #${shortId}`;
          
          // Set the profile picture as small image with random number to bypass cache
          const randomNumbers = Math.floor(Math.random() * 1000000);
          const activity = gameWindow.DiscordRPC.defaultActivity();
          activity.state = state;
          activity.smallImageKey = `https://www.smudgy.store/api/list/profile.png?meow=${shortId}&v=${randomNumbers}`;
          activity.smallImageText = `Viewing ${shortId}'s profile`;
          gameWindow.DiscordRPC.setActivity(activity);
        } else {
          state = "Viewing a profile meow";
          const activity = gameWindow.DiscordRPC.defaultActivity();
          activity.state = state;
          delete activity.smallImageKey;
          delete activity.smallImageText;
          gameWindow.DiscordRPC.setActivity(activity);
        }
      } else {
        state = "In the lobby meow";
        const activity = gameWindow.DiscordRPC.defaultActivity();
        activity.state = state;
        delete activity.smallImageKey;
        delete activity.smallImageText;
        gameWindow.DiscordRPC.setActivity(activity);
      }

      if (!url.startsWith(`${base_url}profile/`) && !stateMap[url] && !url.startsWith(`${base_url}games/`)) {
        const activity = gameWindow.DiscordRPC.defaultActivity();
        activity.state = state;
        delete activity.smallImageKey;
        delete activity.smallImageText;
        gameWindow.DiscordRPC.setActivity(activity);
      } else if (!url.startsWith(`${base_url}profile/`)) {
        gameWindow.DiscordRPC.setState(state);
      }
    }
  });

  gameWindow.loadURL(settings.base_url);
  gameWindow.webContents.setUserAgent(
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.7103.116 Safari/537.36 Electron/10.4.7 SmudgyClient/${app.getVersion()}`
  );
  initGameFeatures(gameWindow);
  gameWindow.removeMenu();
  gameWindow.maximize();

  gameWindow.once("ready-to-show", () => {
    gameWindow.show();
  });

  registerShortcuts(gameWindow);

  gameWindow.on("page-title-updated", (e) => e.preventDefault());

  gameWindow.on("closed", () => {
    ipcMain.removeAllListeners("get-settings");
    ipcMain.removeAllListeners("update-setting");
    gameWindow = null;
  });
};

const initGame = () => {
  createWindow();
  if (settings.discord_rpc) {
    gameWindow.DiscordRPC = new DiscordRPC();
  }
};

module.exports = {
  initGame,
};
