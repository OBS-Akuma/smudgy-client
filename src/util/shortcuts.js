const { app, clipboard, screen, dialog } = require("electron");
const shortcut = require("electron-localshortcut");
const Store = require("electron-store");
const fs = require("fs");
const path = require("path");
const store = new Store();
const { initResourceSwapper } = require("../addons/swapper");

const registerShortcuts = (window) => {
  const register = (key, action) => shortcut.register(window, key, action);
  
  register("Escape", () =>
    window.webContents.executeJavaScript("document.exitPointerLock()")
  );
  
  // F2 - Save screenshot to Documents/SmudgyClient/screenshots AND copy to clipboard
  register("F2", () => {
    const { x, y, width, height } = screen.getPrimaryDisplay().bounds;
    window.capturePage({ x, y, width, height }).then((image) => {
      // Create the directory if it doesn't exist
      const saveDir = path.join(app.getPath("documents"), "SmudgyClient", "screenshots");
      if (!fs.existsSync(saveDir)) {
        fs.mkdirSync(saveDir, { recursive: true });
      }
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filePath = path.join(saveDir, `screenshot-${timestamp}.png`);
      
      // Save the image
      fs.writeFile(filePath, image.toPNG(), (err) => {
        if (err) {
          console.error("[Screenshot] Failed to save:", err);
          window.webContents.send("notification", {
            message: "Failed to save screenshot!",
            type: "error",
          });
        } else {
          console.log("[Screenshot] Saved to:", filePath);
          // Copy to clipboard as well
          clipboard.writeImage(image);
          window.webContents.send("notification", {
            message: `Screenshot Saved!, (also copied to clipboard)`,
            icon: image.toDataURL(),
          });
        }
      });
    }).catch((err) => {
      console.error("[Screenshot] Failed to capture:", err);
      window.webContents.send("notification", {
        message: "Failed to capture screenshot!",
        type: "error",
      });
    });
  });
  
  register("F4", () => {
    window.loadURL(store.get("settings").base_url);
  });
  
  register("F5", () => {
    window.reload();
  });
  
  register("F6", () => {
    window.loadURL(clipboard.readText());
  });
  
  register("F7", () => clipboard.writeText(window.webContents.getURL()));
  
  register("F11", () => window.setFullScreen(!window.isFullScreen()));
  
  register("F12", () => window.webContents.toggleDevTools());
  
  register("Ctrl+Shift+I", () => window.webContents.toggleDevTools());
  register("Ctrl+Shift+C", () => window.webContents.toggleDevTools());
  register("Ctrl+Shift+J", () => window.webContents.toggleDevTools());
  
  register("Alt+F4", () => app.quit());
};

module.exports = { registerShortcuts };