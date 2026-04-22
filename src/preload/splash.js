const { ipcRenderer } = require("electron");
const version = require("../../package.json").version;

document.addEventListener("DOMContentLoaded", () => {
  const versionElement = document.querySelector(".ver");
  const statusElement = document.querySelector(".status");

  versionElement.textContent = `v${version}`;

  const updateStatus = (status) => (statusElement.textContent = status);

  ipcRenderer.send("check-for-updates");
  updateStatus("Checking for updates meow...");

  ipcRenderer.on("update-available", () =>
    updateStatus("Update available! meow...")
  );
  ipcRenderer.on("update-not-available", () =>
    updateStatus("No updates available. meow...")
  );

  ipcRenderer.on("update-downloaded", () => {
    updateStatus("Update downloaded! meow...");
    ipcRenderer.send("quit-and-install");
  });

  ipcRenderer.on("download-progress", (_, progress) =>
    updateStatus(`Downloading update: ${Math.round(progress.percent)}%`)
  );
});
