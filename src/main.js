const { app, ipcMain, BrowserWindow, shell, dialog } = require("electron");
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
let quickCssWindow = null;


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
  shell.openExternal(url);
});

// ============================================
// QUICK CSS POPOUT WINDOW WITH SYNTAX HIGHLIGHTING
// ============================================

function buildQuickCssHtml() {
  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>SmudgyClient QuickCSS Editor</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body {
            background: #1e1e1e;
            height: 100%;
            overflow: hidden;
        }
        .editor-shell {
            display: flex;
            height: 100vh;
            width: 100vw;
        }
        #line-numbers {
            flex: 0 0 auto;
            min-width: 42px;
            padding: 12px 10px 12px 12px;
            background: #1e1e1e;
            color: #5c6370;
            font-family: Consolas, "Courier New", monospace;
            font-size: 13px;
            line-height: 1.5;
            text-align: right;
            user-select: none;
            overflow: hidden;
            white-space: pre;
            border-right: 1px solid #2c2c2c;
            position: sticky;
            left: 0;
            z-index: 3;
            height: 100vh;
        }
        #code-area {
            position: relative;
            flex: 1;
            overflow: auto;
            background: #1e1e1e;
            height: 100vh;
        }
        #editor-wrapper {
            position: relative;
            min-height: 100%;
            height: 100%;
        }
        #highlight-layer {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            margin: 0;
            padding: 12px;
            font-family: Consolas, "Courier New", monospace;
            font-size: 13px;
            line-height: 1.5;
            tab-size: 2;
            white-space: pre-wrap;
            word-wrap: break-word;
            border: none;
            color: #abb2bf;
            pointer-events: none;
            z-index: 1;
            overflow: hidden;
        }
        #highlight-layer code {
            display: block;
            white-space: pre-wrap;
            word-wrap: break-word;
            min-height: 100%;
        }
        #css-editor {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            margin: 0;
            padding: 12px;
            font-family: Consolas, "Courier New", monospace;
            font-size: 13px;
            line-height: 1.5;
            tab-size: 2;
            white-space: pre-wrap;
            word-wrap: break-word;
            border: none;
            background: transparent;
            outline: none;
            resize: none;
            color: #d4d4d4;
            caret-color: #ffffff;
            z-index: 2;
            overflow: auto;
            width: 100%;
            height: 100%;
        }
        #css-editor::selection {
            background: rgba(97, 175, 239, 0.35);
        }
        #css-editor::-moz-selection {
            background: rgba(97, 175, 239, 0.35);
        }
        .tok-comment { color: #5c6370; font-style: italic; }
        .tok-string { color: #98c379; }
        .tok-atrule { color: #c678dd; }
        .tok-hex { color: #d19a66; }
        .tok-number { color: #d19a66; }
        .tok-property { color: #61afef; }
        .tok-selector { color: #e06c75; }
        .tok-punct { color: #abb2bf; }
        .tok-default { color: #abb2bf; }

        #code-area::-webkit-scrollbar {
            width: 10px;
            height: 10px;
        }
        #code-area::-webkit-scrollbar-track {
            background: #1e1e1e;
        }
        #code-area::-webkit-scrollbar-thumb {
            background: #3d3d3d;
            border-radius: 5px;
            border: 2px solid #1e1e1e;
        }
        #code-area::-webkit-scrollbar-thumb:hover {
            background: #4d4d4d;
        }
        #code-area::-webkit-scrollbar-corner {
            background: #1e1e1e;
        }
        #code-area {
            scrollbar-width: thin;
            scrollbar-color: #3d3d3d #1e1e1e;
        }
    </style>
</head>
<body>
    <div class="editor-shell">
        <div id="line-numbers">1</div>
        <div id="code-area">
            <div id="editor-wrapper">
                <pre id="highlight-layer"><code></code></pre>
                <textarea id="css-editor" spellcheck="false" placeholder="/* Custom CSS */" wrap="soft"></textarea>
            </div>
        </div>
    </div>

    <script>
        const { ipcRenderer } = require('electron');

        const textarea = document.getElementById('css-editor');
        const highlightCode = document.querySelector('#highlight-layer code');
        const lineNumbers = document.getElementById('line-numbers');
        const codeArea = document.getElementById('code-area');
        const highlightLayer = document.getElementById('highlight-layer');

        let applyTimeout = null;

        function escapeHtml(str) {
            return str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        }

        const TOKEN_PATTERN = /(?<comment>\\/\\*[\\s\\S]*?\\*\\/)|(?<string>"(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*')|(?<atrule>@[a-zA-Z-]+)|(?<hex>#[0-9a-fA-F]{3,8}\\b)|(?<number>-?\\d*\\.?\\d+(?:px|em|rem|%|vh|vw|vmin|vmax|deg|s|ms|fr)?\\b)|(?<property>[a-zA-Z-]+)(?=\\s*:)|(?<selector>[.#]?[a-zA-Z_][a-zA-Z0-9_-]*)(?=[^{};]*\\{)|(?<punct>[{}:;,])/g;

        function highlightCss(code) {
            if (!code) return '';
            let result = '';
            let lastIndex = 0;
            let match;
            TOKEN_PATTERN.lastIndex = 0;
            while ((match = TOKEN_PATTERN.exec(code)) !== null) {
                if (match.index > lastIndex) {
                    result += escapeHtml(code.slice(lastIndex, match.index));
                }
                const token = match[0];
                const groups = match.groups || {};
                let cls = 'tok-default';
                if (groups.comment) cls = 'tok-comment';
                else if (groups.string) cls = 'tok-string';
                else if (groups.atrule) cls = 'tok-atrule';
                else if (groups.hex) cls = 'tok-hex';
                else if (groups.number) cls = 'tok-number';
                else if (groups.property) cls = 'tok-property';
                else if (groups.selector) cls = 'tok-selector';
                else if (groups.punct) cls = 'tok-punct';
                result += '<span class="' + cls + '">' + escapeHtml(token) + '</span>';
                lastIndex = match.index + token.length;
            }
            if (lastIndex < code.length) {
                result += escapeHtml(code.slice(lastIndex));
            }
            return result;
        }

        function updateLineNumbers() {
            const lines = textarea.value.split('\\n');
            const count = lines.length;
            let out = '';
            for (let i = 1; i <= count; i++) {
                out += i + '\\n';
            }
            lineNumbers.textContent = out;
        }

        function render() {
            const text = textarea.value;
            const highlighted = highlightCss(text);
            highlightCode.innerHTML = highlighted || '&nbsp;';
            updateLineNumbers();
            // Sync the scroll position of the highlight layer with the textarea
            highlightLayer.scrollTop = textarea.scrollTop;
            highlightLayer.scrollLeft = textarea.scrollLeft;
        }

        function syncScroll() {
            lineNumbers.scrollTop = codeArea.scrollTop;
            // Also sync the highlight layer with the textarea scroll
            highlightLayer.scrollTop = textarea.scrollTop;
            highlightLayer.scrollLeft = textarea.scrollLeft;
        }

        function scheduleApply() {
            clearTimeout(applyTimeout);
            applyTimeout = setTimeout(() => {
                ipcRenderer.send('apply-quick-css', textarea.value);
            }, 250);
        }

        // Sync scroll between all elements
        codeArea.addEventListener('scroll', syncScroll);
        textarea.addEventListener('scroll', syncScroll);

        // Click focus
        codeArea.addEventListener('mousedown', (e) => {
            if (e.target !== textarea) {
                textarea.focus();
            }
        });

        // Initial load
        ipcRenderer.send('get-quick-css-content');
        ipcRenderer.once('quick-css-content-response', (event, css) => {
            textarea.value = css || '';
            render();
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        });

        // Input events
        textarea.addEventListener('input', function() {
            render();
            scheduleApply();
        });

        // Tab key
        textarea.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.selectionStart;
                const end = this.selectionEnd;
                this.value = this.value.substring(0, start) + '  ' + this.value.substring(end);
                this.selectionStart = this.selectionEnd = start + 2;
                render();
                scheduleApply();
            }
            
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                this.setSelectionRange(0, this.value.length);
            }
        });

        // External updates
        ipcRenderer.on('quick-css-updated', (event, css) => {
            textarea.value = css || '';
            render();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        });

        // DOM ready
        window.addEventListener('DOMContentLoaded', () => {
            render();
            textarea.focus();
        });

        // Prevent drag
        document.addEventListener('dragover', (e) => e.preventDefault());
        document.addEventListener('drop', (e) => e.preventDefault());

        console.log('QuickCSS Editor initialized');
    </script>
</body>
</html>`;
}

// Open Quick CSS Window
ipcMain.on('open-quick-css-window', (event, cssContent) => {
  if (quickCssWindow) {
    quickCssWindow.focus();
    return;
  }

  quickCssWindow = new BrowserWindow({
    width: 900,
    height: 800,
    resizable: true,
    minimizable: true,
    maximizable: true,
    closable: true,
    frame: true,
    title: 'SmudgyClient QuickCSS Editor',
    icon: path.join(__dirname, "../assets/img/icon.png"),
    backgroundColor: '#1e1e1e',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  quickCssWindow.removeMenu();

  // Write the HTML out to a real file and load it via file://
  const quickCssHtmlPath = path.join(app.getPath("temp"), "smudgy-quickcss-editor.html");
  try {
    fs.writeFileSync(quickCssHtmlPath, buildQuickCssHtml(), "utf8");
  } catch (err) {
    console.error("[Main] Failed to write Quick CSS editor HTML:", err);
  }
  quickCssWindow.loadFile(quickCssHtmlPath);

  quickCssWindow.on('closed', () => {
    quickCssWindow = null;
  });
});

// Get CSS content from renderer
ipcMain.on('get-quick-css-content', (event) => {
  const windows = BrowserWindow.getAllWindows();
  const mainWindow = windows.find(win => win !== quickCssWindow);
  if (mainWindow) {
    mainWindow.webContents.send('request-quick-css-sync');
    ipcMain.once('quick-css-sync-response', (e, content) => {
      event.sender.send('quick-css-content-response', content);
    });
    setTimeout(() => {
      event.sender.send('quick-css-content-response', '');
    }, 3000);
  } else {
    event.sender.send('quick-css-content-response', '');
  }
});

// Apply CSS from Quick CSS window
ipcMain.on('apply-quick-css', (event, cssContent) => {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach(win => {
    if (win !== quickCssWindow) {
      win.webContents.send('update-quick-css', cssContent);
    }
  });
});

// ============================================

app.on("ready", () => {
  initSplash();
  initResourceSwapper();
});

app.on("window-all-closed", () => {
  if (!isRestarting) {
    app.quit();
  }
});