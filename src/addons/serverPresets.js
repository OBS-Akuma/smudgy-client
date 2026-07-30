(function() {
  const STORAGE_KEY = "kirka_room_presets";

  const loadPresets = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  };

  const savePresets = (presets) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  };

  const esc = (str) =>
    String(str).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[c])
    );

  const flash = (el) => {
    el.style.transition = "border-color .1s";
    const prev = el.style.borderColor;
    el.style.borderColor = "rgba(255, 200, 60, 0.9)";
    setTimeout(() => {
      el.style.borderColor = prev;
    }, 700);
  };

  const getMapNameFromSettings = (modal) => {
    const mapInput = modal.querySelector(".keybind-input .input");
    if (mapInput && mapInput.value) {
      try {
        const mapCode = mapInput.value;
        const parsedMap = JSON.parse(mapCode);
        if (parsedMap.mapName) {
          return parsedMap.mapName;
        }
      } catch (e) {
        const match = mapInput.value.match(/["']mapName["']\s*:\s*["']([^"']+)["']/);
        if (match && match[1]) {
          return match[1];
        }
      }
    }
    
    const mapSelect = modal.querySelector(".wrapper-input.select .input");
    if (mapSelect) {
      const selected = mapSelect.querySelector(".selected");
      if (selected && selected.textContent) {
        return selected.textContent.trim();
      }
    }
    
    return null;
  };

  const snapshotSettings = (modal) => {
    const data = {};
    modal.querySelectorAll(".wrapper-input.select .input").forEach((input) => {
      const label = input.closest(".element")?.querySelector(".label");
      if (!label) return;
      const key = label.firstChild?.textContent?.trim();
      if (key)
        data[key] =
          input.querySelector(".selected")?.textContent?.trim() ?? "";
    });
    modal.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      const span = cb.nextElementSibling;
      if (!span) return;
      data[span.textContent.trim()] = cb.checked;
    });
    const mapInput = modal.querySelector(".keybind-input .input");
    if (mapInput) data["__customMap"] = mapInput.value;
    
    const mapName = getMapNameFromSettings(modal);
    if (mapName) data["__mapName"] = mapName;
    
    return data;
  };

  const applySettings = (modal, data) => {
    modal.querySelectorAll(".wrapper-input.select .input").forEach((input) => {
      const label = input.closest(".element")?.querySelector(".label");
      if (!label) return;
      const key = label.firstChild?.textContent?.trim();
      if (!key || !(key in data)) return;
      input.querySelectorAll(".items > div").forEach((opt) => {
        if (opt.textContent.trim() === data[key]) opt.click();
      });
    });
    modal.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      const span = cb.nextElementSibling;
      if (!span) return;
      const key = span.textContent.trim();
      if (key in data && cb.checked !== data[key]) cb.click();
    });
    const mapInput = modal.querySelector(".keybind-input .input");
    if (mapInput && "__customMap" in data) {
      mapInput.value = data["__customMap"];
      mapInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };

  const getPresetNameFromData = (settings, index) => {
    if (settings.__mapName) {
      return settings.__mapName;
    }
    return `Preset ${index + 1}`;
  };

  const createButton = (text, onClick, type = 'blue') => {
    const button = document.createElement('button');
    button.className = 'button select-all rectangle';
    button.setAttribute('data-v-02ffe5dc', '');
    button.setAttribute('data-v-5d0fefa8', '');
    button.setAttribute('data-v-a1eaaeac', '');
    
    if (type === 'blue') {
      button.style.cssText = `
        background-color: var(--blue-4);
        --hover-color: var(--blue-5);
        --top: var(--blue-5);
        --bottom: var(--blue-6);
        width: 100%;
        padding: 6px 0;
        margin-top: 4px;
      `;
    } else {
      button.style.cssText = `
        background-color: var(--WmWwMNn-1);
        --hover-color: var(--WmWwMNn-2);
        --top: var(--WmWwMNn-2);
        --bottom: var(--WmWwMNn-3);
        width: 100%;
        padding: 6px 0;
        margin-top: 4px;
      `;
    }
    
    button.innerHTML = `
      <div class="triangle"></div>
      <div class="text">${text}</div>
      <div class="WmWwnMN">
        <div class="border-top border"></div>
        <div class="border-bottom border"></div>
      </div>
    `;
    
    button.addEventListener('click', onClick);
    return button;
  };

  const createPlayButton = (onClick) => {
    const label = document.createElement('label');
    label.className = 'custom-checkbox checkbox-size';
    label.setAttribute('data-v-730c0c40', '');
    label.setAttribute('data-v-5d0fefa8', '');
    label.setAttribute('data-v-a1eaaeac', '');
    label.style.cssText = 'margin: 0; padding: 0;';
    
    const input = document.createElement('input');
    input.setAttribute('data-v-730c0c40', '');
    input.type = 'checkbox';
    input.style.display = 'none';
    
    const span = document.createElement('span');
    span.setAttribute('data-v-730c0c40', '');
    span.textContent = '▶';
    span.style.cssText = `
      cursor: pointer;
      font-size: 14px;
      font-weight: 700;
      opacity: 0.5;
      transition: all 0.15s;
      padding: 2px 6px;
      border-radius: 3px;
      display: inline-block;
    `;
    
    span.onmouseenter = function() {
      this.style.opacity = '1';
      this.style.background = 'rgba(76, 222, 120, 0.15)';
      this.style.color = 'rgb(76, 222, 120)';
    };
    span.onmouseleave = function() {
      this.style.opacity = '0.5';
      this.style.background = 'transparent';
      this.style.color = 'inherit';
    };
    
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.kp-play-btn').forEach(btn => {
        if (btn !== span) {
          btn.style.opacity = '0.5';
          btn.style.background = 'transparent';
          btn.style.color = 'inherit';
        }
      });
      onClick();
    });
    
    span.className = 'kp-play-btn';
    label.appendChild(input);
    label.appendChild(span);
    return label;
  };

  const createOverButton = (onClick) => {
    const label = document.createElement('label');
    label.className = 'custom-checkbox checkbox-size';
    label.setAttribute('data-v-730c0c40', '');
    label.setAttribute('data-v-5d0fefa8', '');
    label.setAttribute('data-v-a1eaaeac', '');
    label.style.cssText = 'margin: 0; padding: 0;';
    
    const input = document.createElement('input');
    input.setAttribute('data-v-730c0c40', '');
    input.type = 'checkbox';
    input.style.display = 'none';
    
    const span = document.createElement('span');
    span.setAttribute('data-v-730c0c40', '');
    span.textContent = '⟲';
    span.style.cssText = `
      cursor: pointer;
      font-size: 14px;
      font-weight: 700;
      opacity: 0.5;
      transition: all 0.15s;
      padding: 2px 6px;
      border-radius: 3px;
      display: inline-block;
    `;
    
    span.onmouseenter = function() {
      this.style.opacity = '1';
      this.style.background = 'rgba(74, 144, 226, 0.15)';
      this.style.color = 'rgb(120, 170, 240)';
    };
    span.onmouseleave = function() {
      this.style.opacity = '0.5';
      this.style.background = 'transparent';
      this.style.color = 'inherit';
    };
    
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    
    label.appendChild(input);
    label.appendChild(span);
    return label;
  };

  const createDeleteButton = (onClick) => {
    const label = document.createElement('label');
    label.className = 'custom-checkbox checkbox-size';
    label.setAttribute('data-v-730c0c40', '');
    label.setAttribute('data-v-5d0fefa8', '');
    label.setAttribute('data-v-a1eaaeac', '');
    label.style.cssText = 'margin: 0; padding: 0;';
    
    const input = document.createElement('input');
    input.setAttribute('data-v-730c0c40', '');
    input.type = 'checkbox';
    input.style.display = 'none';
    
    const span = document.createElement('span');
    span.setAttribute('data-v-730c0c40', '');
    span.textContent = '✕';
    span.style.cssText = `
      cursor: pointer;
      font-size: 13px;
      font-weight: 700;
      opacity: 0.5;
      transition: all 0.15s;
      padding: 2px 6px;
      border-radius: 3px;
      display: inline-block;
    `;
    
    span.onmouseenter = function() {
      this.style.opacity = '1';
      this.style.background = 'rgba(226, 74, 74, 0.15)';
      this.style.color = 'rgb(232, 100, 100)';
    };
    span.onmouseleave = function() {
      this.style.opacity = '0.5';
      this.style.background = 'transparent';
      this.style.color = 'inherit';
    };
    
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    
    label.appendChild(input);
    label.appendChild(span);
    return label;
  };

  const addChatMessage = (modal) => {
    const chatContainer = modal.querySelector('.chat-messages-cont .messages');
    if (!chatContainer) {
      console.log("Chat container not found");
      return;
    }

    if (chatContainer.querySelector('.kp-chat-message')) {
      return;
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message kp-chat-message';
    messageDiv.setAttribute('data-v-1a5d57ef', '');
    
    const authorSpan = document.createElement('span');
    authorSpan.className = 'author-name ml SERVER';
    authorSpan.setAttribute('data-v-1a5d57ef', '');
    authorSpan.textContent = 'Smudgy Helper:';
    authorSpan.style.cssText = 'color: #ff6b6b; font-weight: 700;';
    
    const textContainer = document.createElement('span');
    textContainer.setAttribute('data-v-1a5d57ef', '');
    
    const textSpan = document.createElement('span');
    textSpan.className = 'text';
    textSpan.setAttribute('data-v-1a5d57ef', '');
    textSpan.textContent = "Hiya!! i do nothing for right now but just you wait ;3";
    textSpan.style.cssText = 'color: #ffd93d;';
    
    textContainer.appendChild(textSpan);
    messageDiv.appendChild(authorSpan);
    messageDiv.appendChild(textContainer);
    
    const firstMessage = chatContainer.querySelector('.message');
    if (firstMessage) {
      chatContainer.insertBefore(messageDiv, firstMessage);
    } else {
      chatContainer.appendChild(messageDiv);
    }
    
    console.log("Chat message added!");
  };

  const createPresetsUI = () => {
    const container = document.createElement("div");
    container.className = "full";
    container.id = "kp-container";
    container.style.cssText = "margin-top: 8px;";
    
    container.innerHTML = `
      <div class="header" style="display: flex; justify-content: space-between; align-items: center; cursor: default; padding-bottom: 6px;">
        <span style="font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.8;">Room Presets</span>
      </div>
      <div class="kp-list" style="display: flex; flex-direction: column; gap: 4px; max-height: 280px; overflow-y: auto; padding: 2px 0;"></div>
      <div id="kp-save-container"></div>
    `;

    return container;
  };

  const renderList = (modal, container) => {
    const list = container.querySelector(".kp-list");
    const presets = loadPresets();
    list.innerHTML = "";

    if (presets.length === 0) {
      list.innerHTML = `<div style="
        font-size: 12px;
        opacity: 0.4;
        text-align: center;
        padding: 20px 0;
        font-style: italic;
        color: var(--text-color, #fff);
        letter-spacing: 0.3px;
      ">No presets saved yet</div>`;
      return;
    }

    let dragSrc = null;

    presets.forEach((preset, i) => {
      const item = document.createElement("div");
      item.className = "element";
      item.dataset.idx = String(i);
      item.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px;
        background: rgba(0, 0, 0, 0.15);
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        transition: border-color 0.15s, background 0.15s;
        cursor: default;
      `;
      
      item.onmouseenter = function() {
        this.style.background = 'rgba(0, 0, 0, 0.25)';
        this.style.borderColor = 'rgba(255, 255, 255, 0.12)';
      };
      item.onmouseleave = function() {
        this.style.background = 'rgba(0, 0, 0, 0.15)';
        this.style.borderColor = 'rgba(255, 255, 255, 0.06)';
      };
      
      let displayName;
      if (preset.name && !preset.name.startsWith("Preset ")) {
        displayName = preset.name;
      } else {
        displayName = getPresetNameFromData(preset.settings, i);
      }
      
      item.innerHTML = `
        <span class="kp-drag" draggable="true" style="
          cursor: grab;
          opacity: 0.3;
          font-size: 13px;
          line-height: 1;
          flex-shrink: 0;
          user-select: none;
          padding: 0 2px;
          letter-spacing: 1px;
        ">⋮⋮</span>
        <input class="kp-name" type="text" value="${esc(displayName)}" spellcheck="false" style="
          flex: 1;
          background: transparent;
          border: none;
          color: inherit;
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          outline: none;
          min-width: 0;
          padding: 2px 4px;
          letter-spacing: 0.2px;
        ">
        <div style="display: flex; gap: 2px; flex-shrink: 0; align-items: center;">
      `;
      
      const actionsDiv = item.querySelector('div:last-child');
      
      const applyBtn = createPlayButton(() => {
        applySettings(modal, preset.settings);
        flash(item);
      });
      actionsDiv.appendChild(applyBtn);
      
      const overBtn = createOverButton(() => {
        const ps = loadPresets();
        const newSettings = snapshotSettings(modal);
        ps[i].settings = newSettings;

        if (!ps[i].name || ps[i].name.startsWith("Preset ")) {
          const newName = getPresetNameFromData(newSettings, i);
          if (newName !== `Preset ${i + 1}`) {
            ps[i].name = newName;
          }
        }
        savePresets(ps);
        renderList(modal, container);
        flash(item);
      });
      actionsDiv.appendChild(overBtn);
      
      const delBtn = createDeleteButton(() => {
        const ps = loadPresets();
        ps.splice(i, 1);
        savePresets(ps);
        renderList(modal, container);
      });
      actionsDiv.appendChild(delBtn);

      const style = document.createElement('style');
      style.textContent = `
        .kp-drag:active { cursor: grabbing; }
        .kp-item-dragging { 
          opacity: 0.35; 
          transform: scale(0.98);
        }
        .kp-item-drag-over { 
          border-color: rgba(255, 200, 60, 0.7) !important;
          background: rgba(255, 200, 60, 0.05) !important;
        }
        .kp-name:focus {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 2px;
        }
      `;
      item.appendChild(style);

      const nameInput = item.querySelector(".kp-name");
      nameInput.addEventListener("change", (e) => {
        const ps = loadPresets();
        ps[i].name = e.target.value.trim() || `Preset ${i + 1}`;
        savePresets(ps);
      });

      const dragHandle = item.querySelector(".kp-drag");
      dragHandle.addEventListener("dragstart", (e) => {
        dragSrc = i;
        item.classList.add("kp-item-dragging");
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", String(i));
        }
      });
      dragHandle.addEventListener("dragend", () => {
        item.classList.remove("kp-item-dragging");
        list.querySelectorAll(".kp-item-drag-over").forEach((el) => 
          el.classList.remove("kp-item-drag-over")
        );
      });

      item.addEventListener("dragover", (e) => {
        if (dragSrc === null) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        item.classList.add("kp-item-drag-over");
      });
      item.addEventListener("dragleave", () =>
        item.classList.remove("kp-item-drag-over")
      );
      item.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        item.classList.remove("kp-item-drag-over");
        if (dragSrc === null || dragSrc === i) return;
        const ps = loadPresets();
        const [moved] = ps.splice(dragSrc, 1);
        ps.splice(i, 0, moved);
        savePresets(ps);
        dragSrc = null;
        renderList(modal, container);
      });

      list.appendChild(item);
    });
  };

  const initPresets = (modal) => {
    if (document.getElementById("kp-container")) {
      console.log("Presets already initialized");
      return;
    }

    console.log("Looking for Privacy section...");
    
    const generalContent = modal.querySelector('.general-content');
    if (!generalContent) {
      console.error("Could not find .general-content in modal");
      return;
    }
    
    const fullSections = generalContent.querySelectorAll('.full');
    console.log(`Found ${fullSections.length} .full sections`);
    
    let privacySection = null;
    for (const section of fullSections) {
      const header = section.querySelector('.header');
      if (header && header.textContent.trim() === 'Privacy') {
        privacySection = section;
        console.log("Found Privacy section");
        break;
      }
    }

    if (!privacySection) {
      console.error("Could not find Privacy section");
      return;
    }

    console.log("Creating presets UI...");
    const container = createPresetsUI();
    
    privacySection.parentNode.insertBefore(container, privacySection.nextSibling);
    console.log("Presets UI inserted after privacy section");

    const saveContainer = container.querySelector("#kp-save-container");
    const saveBtn = createButton('+ Save Current Preset', () => {
      const ps = loadPresets();
      const newSettings = snapshotSettings(modal);
      const mapName = getMapNameFromSettings(modal);
      
      ps.push({
        name: mapName || `Preset ${ps.length + 1}`,
        settings: newSettings,
      });
      savePresets(ps);
      renderList(modal, container);
      
      saveBtn.style.transform = 'scale(0.98)';
      setTimeout(() => {
        saveBtn.style.transform = 'scale(1)';
      }, 100);
    }, 'blue');
    saveContainer.appendChild(saveBtn);

    renderList(modal, container);
    
    setTimeout(() => {
      addChatMessage(modal);
    }, 100);
    
    console.log("Presets initialized successfully!");
  };

  const initServerPresets = () => {
    console.log("Kirka Room Presets script started...");
    console.log("Waiting for modal to open...");
    
    const start = () => {
      if (!document.body) {
        setTimeout(start, 50);
        return;
      }
      
      let initialized = false;
      const observer = new MutationObserver(() => {
        const modal = document.querySelector("#create-modal-modal");
        if (modal && !initialized) {
          console.log("Modal detected!");
          setTimeout(() => {
            initPresets(modal);
            initialized = true;
          }, 500);
        } else if (!modal) {
          if (initialized) {
            console.log("Modal closed");
          }
          initialized = false;
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    };
    start();
  };

  initServerPresets();
})();