const { initGameFeatures } = (() => {
  let gameWindowRef = null;
  let isInjected = false;

  const buildScript = () => {
    return `
      (function() {
        if (window.__customIdRedirectInstalled) return;
        window.__customIdRedirectInstalled = true;
        
        let customIdMapping = {};
        let subnamesData = null;
        let subnameIsProcessing = false;
        let subnameInterval = null;
        
        async function fetchCustomIdMappings() {
          try {
            const r = await fetch("https://raw.githubusercontent.com/OBS-Akuma/KirkaBadges/refs/heads/main/Json/customids.json");
            if (!r.ok) throw new Error();
            const data = await r.json();
            data.forEach(item => {
              if (item.custom && Array.isArray(item.custom)) {
                item.custom.forEach(customId => {
                  customIdMapping[customId.toUpperCase()] = item.shortId;
                });
              }
            });
            console.log('[CustomID] Loaded', Object.keys(customIdMapping).length, 'mappings');
            return true;
          } catch (err) { 
            console.error('[CustomID] Failed to load mappings');
            return false; 
          }
        }
        
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
        
        function navigateToProfile(shortId) {
          const newUrl = '/profile/' + shortId;
          if (window.location.pathname !== newUrl) {
            console.log('[CustomID] Redirecting to:', newUrl);
            window.location.href = newUrl;
          }
        }
        
        function blockUserNotFound() {
          const alertElement = document.querySelector(".alert-default.wnNmMWwW, [class*='alert-default']");
          if (alertElement) {
            const textSpan = alertElement.querySelector(".text");
            if (textSpan && textSpan.textContent === "User not found") {
              alertElement.style.display = "none";
              alertElement.remove();
              return true;
            }
          }
          return false;
        }
        
        async function checkAndRedirectCustomId() {
          if (Object.keys(customIdMapping).length === 0) await fetchCustomIdMappings();
        
          const currentPath = window.location.pathname;
          let profileId = null;
        
          if (currentPath.startsWith("/profile/")) profileId = currentPath.split("/").pop().toUpperCase();
          else if (currentPath.startsWith("/custom/")) profileId = currentPath.split("/").pop().toUpperCase();
        
          if (profileId && customIdMapping[profileId]) {
            const realId = customIdMapping[profileId];
            blockUserNotFound();
            const closeBtn = document.querySelector("[data-v-da7c34da].close");
            if (closeBtn) closeBtn.click();
            setTimeout(() => navigateToProfile(realId), 100);
            return true;
          }
          return false;
        }
        
        function watchUserNotFoundAlerts() {
          new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
              mutation.addedNodes.forEach(node => {
                if (node.nodeType !== Node.ELEMENT_NODE) return;
                const alert = node.matches?.(".alert-default.wnNmMWwW") ? node : node.querySelector?.(".alert-default.wnNmMWwW");
                if (alert) {
                  const textSpan = alert.querySelector(".text");
                  if (textSpan && textSpan.textContent === "User not found") {
                    blockUserNotFound();
                    checkAndRedirectCustomId();
                  }
                }
              });
            });
          }).observe(document.body, { childList: true, subtree: true });
        }
        
        function patchFetchForCustomIds() {
          const originalFetch = window.fetch;
          window.fetch = function(...args) {
            const url = args[0];
            return originalFetch.apply(this, args).then(response => {
              const cloned = response.clone();
              if (typeof url === "string" && (url.includes("/profile") || url.includes("/api/"))) {
                cloned.json().then(data => {
                  if (data && (data.error === "User not found" || data.message === "User not found" || !data.wMWWm)) {
                    setTimeout(() => { blockUserNotFound(); checkAndRedirectCustomId(); }, 50);
                  }
                }).catch(() => {});
              }
              return response;
            });
          };
        }
        
        async function injectProfileSubname() {
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
        
        async function injectFriendSubnames() {
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
        
        async function injectAllSubnames() {
          if (!subnamesData) { 
            await fetchSubnamesData(); 
            if (!subnamesData) return; 
          }
          if (subnameIsProcessing) return;
          
          subnameIsProcessing = true;
          try {
            if (location.href.includes("/profile/")) await injectProfileSubname();
            if (location.href.includes("/friends")) await injectFriendSubnames();
          } catch (e) {}
          subnameIsProcessing = false;
        }
        
        function startSubnamePersistence() {
          if (subnameInterval) clearInterval(subnameInterval);
          subnameInterval = setInterval(() => {
            if (location.href.includes("/profile/") || location.href.includes("/friends")) {
              injectAllSubnames();
            }
          }, 500);
        }
        
        let lastUrl = window.location.href;
        setInterval(() => {
          const currentUrl = window.location.href;
          if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            setTimeout(checkAndRedirectCustomId, 100);
            setTimeout(injectAllSubnames, 150);
          }
          blockUserNotFound();
        }, 500);
        
        const originalPushState = history.pushState;
        history.pushState = function() {
          originalPushState.apply(this, arguments);
          setTimeout(checkAndRedirectCustomId, 100);
          setTimeout(injectAllSubnames, 150);
        };
        
        window.addEventListener('popstate', () => {
          setTimeout(checkAndRedirectCustomId, 100);
          setTimeout(injectAllSubnames, 150);
        });
        
        watchUserNotFoundAlerts();
        patchFetchForCustomIds();
        fetchCustomIdMappings();
        fetchSubnamesData();
        setTimeout(checkAndRedirectCustomId, 200);
        setTimeout(injectAllSubnames, 300);
        startSubnamePersistence();
        
        console.log('[GameFeatures] Custom ID and Subname systems initialized');
      })();
    `;
  };

  const injectScript = () => {
    if (!gameWindowRef || gameWindowRef.isDestroyed()) return;
    
    gameWindowRef.webContents.executeJavaScript(buildScript())
      .then(() => {
        console.log('[GameFeatures] Features injected');
        isInjected = true;
      })
      .catch((err) => {
        console.error('[GameFeatures] Injection failed:', err);
      });
  };

  const initGameFeatures = (gameWindow) => {
    if (!gameWindow) {
      console.error('[GameFeatures] No game window provided');
      return;
    }
    
    gameWindowRef = gameWindow;
    
    if (gameWindow.webContents.isLoading()) {
      gameWindow.webContents.once('did-finish-load', () => {
        setTimeout(injectScript, 500);
      });
    } else {
      setTimeout(injectScript, 500);
    }
    
    gameWindow.webContents.on('did-navigate', () => {
      setTimeout(injectScript, 500);
    });
  };

  return { initGameFeatures };
})();

module.exports = { initGameFeatures };