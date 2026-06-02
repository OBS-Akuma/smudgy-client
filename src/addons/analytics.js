const { app, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs").promises;

const ANALYTICS_PATH = path.join(
  app.getPath("documents"),
  "SmudgyClient",
  "clientdata",
  "analytics.json"
);

let currentGameCode = null;
let joinTime = null;
let analyticsWriteTimer = null;

// --- Analytics File Helpers ---

const ensureAnalyticsFile = async () => {
  const dir = path.dirname(ANALYTICS_PATH);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {
    // directory already exists
  }

  const exists = await fs
    .access(ANALYTICS_PATH)
    .then(() => true)
    .catch(() => false);

  if (!exists) {
    const empty = { score: [], playtime: [] };
    await fs.writeFile(ANALYTICS_PATH, JSON.stringify(empty));
    return empty;
  }

  try {
    const raw = await fs.readFile(ANALYTICS_PATH, "utf8");
    return JSON.parse(raw) || { score: [], playtime: [] };
  } catch {
    const empty = { score: [], playtime: [] };
    await fs.writeFile(ANALYTICS_PATH, JSON.stringify(empty));
    return empty;
  }
};

const saveAnalytics = async (analytics) => {
  const analyticsCache = await ensureAnalyticsFile();

  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  let day = analyticsCache.playtime.find((d) => d.date === date);
  if (!day) {
    day = { date, playtime: analytics.duration || 0, games: [analytics] };
    analyticsCache.playtime.push(day);
  } else {
    day.playtime = (day.playtime || 0) + (analytics.duration || 0);
    day.games.push(analytics);
  }

  clearTimeout(analyticsWriteTimer);
  analyticsWriteTimer = setTimeout(() => {
    fs.writeFile(ANALYTICS_PATH, JSON.stringify(analyticsCache)).catch((err) =>
      console.error("[Analytics] Error saving analytics:", err)
    );
  }, 500);

  console.log(`[Analytics] Saved for game: ${analytics.gameCode}`);
};

// --- Game Code Detection ---

const updateGameCodeFromUrl = (pageUrl) => {
  if (pageUrl.includes("/games/")) {
    const parts = pageUrl.split("~");
    currentGameCode = parts[parts.length - 1];
    joinTime = Date.now();
    console.log(`[Analytics] Joined game: ${currentGameCode}`);
  } else if (currentGameCode) {
    const duration = Date.now() - joinTime;
    console.log(`[Analytics] Left game ${currentGameCode} after ${duration}ms`);
    saveAnalytics({
      gameCode: currentGameCode,
      duration,
      date: new Date().toISOString(),
    }).catch((err) => console.error("[Analytics] Error saving analytics:", err));
    currentGameCode = null;
    joinTime = null;
  }
};

// --- Main Process Integration ---

const initGameLogger = (webContents) => {
  // Piggyback on the url-change event already sent by game.js
  ipcMain.on("url-change", (_event, url) => {
    updateGameCodeFromUrl(url);
  });

  // Inject the navigation spy for SPA pushState/replaceState changes
  webContents.on("dom-ready", () => {
    webContents.executeJavaScript(`
      (function () {
        "use strict";
        function logNavigation(pageUrl) {
          if (window.require) {
            try {
              const { ipcRenderer } = window.require("electron");
              ipcRenderer.send("url-change", pageUrl);
            } catch (e) {}
          }
        }
        const _pushState = history.pushState;
        history.pushState = function (...args) {
          const result = _pushState.apply(this, args);
          logNavigation(new URL(args[2], window.location.href).href);
          return result;
        };
        const _replaceState = history.replaceState;
        history.replaceState = function (...args) {
          const result = _replaceState.apply(this, args);
          logNavigation(new URL(args[2], window.location.href).href);
          return result;
        };
        window.addEventListener("popstate", () => logNavigation(window.location.href));
      })();
    `).catch((err) =>
      console.error("[Analytics] Failed to inject navigation spy:", err)
    );
  });

  console.log("[Analytics] Game logger initialized.");
};

module.exports = { initGameLogger, saveAnalytics };
