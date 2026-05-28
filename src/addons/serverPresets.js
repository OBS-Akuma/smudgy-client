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

const injectStyles = () => {
  if (document.getElementById("kp-styles")) return;
  const s = document.createElement("style");
  s.id = "kp-styles";
  s.textContent = `
    @keyframes kp-in {
      from { opacity: 0; transform: translateY(-10px); }
      to   { opacity: 1; transform: translateY(0px); }
    }
    @keyframes kp-out {
      from { opacity: 1; transform: translateY(0px); }
      to   { opacity: 0; transform: translateY(-10px); }
    }
    #kp-panel {
      position: fixed;
      z-index: 999999;
      width: 320px;
      padding: 14px 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      box-sizing: border-box;
      animation: kp-in 0.2s ease forwards;
    }
    #kp-panel.kp-hiding {
      animation: kp-out 0.2s ease forwards;
    }
    #kp-panel .kp-title {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      opacity: 0.85;
    }
    #kp-panel .kp-list {
      display: flex;
      flex-direction: column;
      gap: 5px;
      max-height: 320px;
      overflow-y: auto;
    }
    #kp-panel .kp-item {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      padding: 5px 7px;
      transition: border-color 0.15s;
    }
    #kp-panel .kp-item.drag-over { border-color: rgba(255, 200, 60, 0.9); }
    #kp-panel .kp-item.dragging  { opacity: 0.35; }
    #kp-panel .kp-drag {
      cursor: grab;
      opacity: 0.5;
      font-size: 13px;
      line-height: 1;
      flex-shrink: 0;
      user-select: none;
      padding: 0 2px;
    }
    #kp-panel .kp-drag:active { cursor: grabbing; }
    #kp-panel .kp-name {
      flex: 1;
      background: transparent;
      border: none;
      color: inherit;
      font-size: 12px;
      font-weight: 600;
      font-family: inherit;
      outline: none;
      min-width: 0;
    }
    #kp-panel .kp-actions { display: flex; gap: 2px; flex-shrink: 0; }
    #kp-panel .kp-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 13px;
      padding: 3px 6px;
      border-radius: 4px;
      color: inherit;
      opacity: 0.55;
      transition: opacity 0.15s, background 0.15s, color 0.15s;
      font-family: inherit;
    }
    #kp-panel .kp-btn:hover { opacity: 1; }
    #kp-panel .kp-btn.apply:hover { background: rgba(76, 222, 120, 0.2); color: rgb(76, 222, 120); }
    #kp-panel .kp-btn.over:hover  { background: rgba(74, 144, 226, 0.2); color: rgb(120, 170, 240); }
    #kp-panel .kp-btn.del:hover   { background: rgba(226, 74, 74, 0.2); color: rgb(232, 100, 100); }
    #kp-panel .kp-save-btn {
      background: rgba(47, 128, 237, 0.85);
      border: 1px solid rgba(0, 0, 0, 0.3);
      color: #fff;
      border-radius: 6px;
      padding: 9px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 2px;
      text-transform: uppercase;
      cursor: pointer;
      font-family: inherit;
      width: 100%;
      transition: background 0.2s ease, filter 0.2s ease;
    }
    #kp-panel .kp-save-btn:hover { background: rgba(79, 148, 241, 0.95); filter: brightness(1.1); }
    #kp-panel .kp-empty {
      font-size: 11px;
      opacity: 0.5;
      text-align: center;
      padding: 10px 0;
      font-style: italic;
    }
  `;
  document.head.appendChild(s);
};

let panel = null;
let rafId = null;

const dismissPanel = () => {
  if (!panel) return;
  panel.classList.add("kp-hiding");
  const dying = panel;
  panel = null;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  dying.addEventListener("animationend", () => dying.remove(), { once: true });
  setTimeout(() => {
    if (dying.parentNode) dying.remove();
  }, 400);
};

const syncStylesFromCard = (card) => {
  if (!panel || !card) return;
  const cs = getComputedStyle(card);
  const props = [
    "background-color",
    "background-image",
    "background-size",
    "background-repeat",
    "background-position",
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
    "border-top-width",
    "border-right-width",
    "border-bottom-width",
    "border-left-width",
    "border-top-style",
    "border-right-style",
    "border-bottom-style",
    "border-left-style",
    "border-top-left-radius",
    "border-top-right-radius",
    "border-bottom-left-radius",
    "border-bottom-right-radius",
    "color",
    "font-family",
    "box-shadow",
  ];
  for (const p of props) {
    panel.style.setProperty(p, cs.getPropertyValue(p));
  }
};

const renderList = (modal) => {
  if (!panel) return;
  const list = panel.querySelector(".kp-list");
  const presets = loadPresets();
  list.innerHTML = "";

  if (presets.length === 0) {
    list.innerHTML = '<div class="kp-empty">No presets saved yet</div>';
    return;
  }

  let dragSrc = null;

  presets.forEach((preset, i) => {
    const item = document.createElement("div");
    item.className = "kp-item";
    item.dataset.idx = String(i);
    item.innerHTML = `
      <span class="kp-drag" draggable="true" title="Drag to reorder">⋮⋮</span>
      <input class="kp-name" type="text" value="${esc(preset.name)}" spellcheck="false">
      <div class="kp-actions">
        <button class="kp-btn apply" title="Apply">▶</button>
        <button class="kp-btn over"  title="Overwrite with current settings">⟲</button>
        <button class="kp-btn del"   title="Delete">✕</button>
      </div>
    `;

    const nameInput = item.querySelector(".kp-name");
    nameInput.addEventListener("change", (e) => {
      const ps = loadPresets();
      ps[i].name = e.target.value.trim() || `Preset ${i + 1}`;
      savePresets(ps);
    });

    item.querySelector(".apply").addEventListener("click", () =>
      applySettings(modal, preset.settings)
    );

    item.querySelector(".over").addEventListener("click", () => {
      const ps = loadPresets();
      ps[i].settings = snapshotSettings(modal);
      savePresets(ps);
      flash(item);
    });

    item.querySelector(".del").addEventListener("click", () => {
      const ps = loadPresets();
      ps.splice(i, 1);
      savePresets(ps);
      renderList(modal);
    });

    const dragHandle = item.querySelector(".kp-drag");
    dragHandle.addEventListener("dragstart", (e) => {
      dragSrc = i;
      item.classList.add("dragging");
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(i));
        const rect = item.getBoundingClientRect();
        try {
          e.dataTransfer.setDragImage(
            item,
            e.clientX - rect.left,
            e.clientY - rect.top
          );
        } catch {}
      }
    });
    dragHandle.addEventListener("dragend", () => {
      item.classList.remove("dragging");
      list
        .querySelectorAll(".kp-item.drag-over")
        .forEach((el) => el.classList.remove("drag-over"));
    });

    item.addEventListener("dragover", (e) => {
      if (dragSrc === null) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      item.classList.add("drag-over");
    });
    item.addEventListener("dragleave", () =>
      item.classList.remove("drag-over")
    );
    item.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      item.classList.remove("drag-over");
      if (dragSrc === null || dragSrc === i) return;
      const ps = loadPresets();
      const [moved] = ps.splice(dragSrc, 1);
      ps.splice(i, 0, moved);
      savePresets(ps);
      dragSrc = null;
      renderList(modal);
    });

    list.appendChild(item);
  });
};

const initPanel = (modal) => {
  if (panel) return;

  injectStyles();

  const card = modal.querySelector(".container-card");
  if (!card) return;

  panel = document.createElement("div");
  panel.id = "kp-panel";
  panel.className = "container-card";
  panel.innerHTML = `
    <div class="kp-title">Presets</div>
    <div class="kp-list"></div>
    <button class="kp-save-btn">+ Save Current</button>
  `;

  syncStylesFromCard(card);

  const r0 = card.getBoundingClientRect();
  panel.style.top = r0.top + "px";
  panel.style.left = r0.right + 12 + "px";

  document.body.appendChild(panel);

  let frames = 0;
  const track = () => {
    if (!panel) return;
    const r = card.getBoundingClientRect();
    panel.style.top = r.top + "px";
    panel.style.left = r.right + 12 + "px";
    frames++;
    if (frames % 30 === 0) syncStylesFromCard(card);
    rafId = requestAnimationFrame(track);
  };
  rafId = requestAnimationFrame(track);

  panel.querySelector(".kp-save-btn").addEventListener("click", () => {
    const ps = loadPresets();
    ps.push({
      name: `Preset ${ps.length + 1}`,
      settings: snapshotSettings(modal),
    });
    savePresets(ps);
    renderList(modal);
  });

  renderList(modal);
};

const initServerPresets = () => {
  const start = () => {
    if (!document.body) {
      setTimeout(start, 50);
      return;
    }
    const observer = new MutationObserver(() => {
      const modal = document.querySelector("#create-modal-modal");
      if (modal && !panel) {
        initPanel(modal);
      } else if (!modal && panel) {
        dismissPanel();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };
  start();
};

module.exports = { initServerPresets };
