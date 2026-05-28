const { initGameFeatures } = (() => {
  let gameWindowRef = null;
  let isInjected = false;

  const buildScript = () => {
    return `
      (function() {
        if (window.__fullFeaturesInstalled) return;
        window.__fullFeaturesInstalled = true;
        
        let customIdMapping = {};
        let subnamesData = null;
        let subnameIsProcessing = false;
        let subnameInterval = null;
        
        // Background API variables
        const ALL_BANNERS_API = "https://www.smudgy.store/api/user-banners";
        const SINGLE_BANNER_API = "https://www.smudgy.store/api/user-banners?kirkaId=";
        let appliedElements = new Map();
        let bgIsProcessing = false;
        let currentProfileIdentifier = null;
        let hasFetchedForCurrentPage = false;
        
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
        
        // Background API functions
        async function fetchSpecificUserBanner(identifier, isLongId) {
          if (!identifier) return null;
          try {
            if (isLongId || identifier.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
              const response = await fetch(ALL_BANNERS_API);
              const data = await response.json();
              if (data.success && data.banners) {
                return data.banners.find(b => b.userLongId === identifier && b.equipped === true) || null;
              }
            } else {
              const response = await fetch(\`\${SINGLE_BANNER_API}\${identifier}\`);
              const data = await response.json();
              if (data.success && data.banners && data.banners.length > 0) {
                return data.banners.find(b => b.equipped === true) || null;
              }
            }
            return null;
          } catch { return null; }
        }
        
        async function fetchAllUsersBanners() {
          try {
            const response = await fetch(ALL_BANNERS_API);
            const data = await response.json();
            if (data.success && data.banners) return data.banners.filter(b => b.equipped === true);
            return [];
          } catch { return []; }
        }
        
        function isProfilePage() {
          return window.location.pathname.match(/\\/profile\\/([^\\/?#]+)/) !== null;
        }
        
        function isFriendsPage() {
          return window.location.pathname === '/friends' || window.location.pathname.startsWith('/friends/');
        }
        
        function getIdentifierFromURL() {
          const match = window.location.pathname.match(/\\/profile\\/([^\\/?#]+)/);
          if (match) {
            const identifier = match[1];
            const isLongId = identifier.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
            return { identifier, isLongId: !!isLongId };
          }
          return null;
        }
        
        function getIdsFromElement(element) {
          const shortIdElement = element.querySelector('.friend-id');
          let shortId = shortIdElement ? shortIdElement.textContent.trim() : null;
          let longId = null;
          
          const badgesDiv = element.querySelector('.kirka-badges');
          if (badgesDiv) {
            if (badgesDiv.getAttribute('data-short-id')) shortId = badgesDiv.getAttribute('data-short-id');
            if (badgesDiv.getAttribute('data-long-id')) longId = badgesDiv.getAttribute('data-long-id');
          }
          
          const longIdElement = element.querySelector('.user-long-id, .long-id, [data-user-id]');
          if (longIdElement) longId = longIdElement.getAttribute('data-user-id') || longIdElement.textContent.trim();
          
          element.querySelectorAll('a[href*="/profile/"]').forEach(link => {
            const match = link.getAttribute('href').match(/\\/profile\\/([^\\/?#]+)/);
            if (match && match[1].match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
              longId = match[1];
            }
          });
          
          return { shortId, longId };
        }
        
        function findBannerByIds(banners, shortId, longId) {
          if (!banners || banners.length === 0) return null;
          if (shortId) {
            const m = banners.find(b => b.kirkaId === shortId && b.equipped === true);
            if (m) return m;
          }
          if (longId) return banners.find(b => b.userLongId === longId && b.equipped === true) || null;
          return null;
        }
        
        function preserveProgressBar(element) {
          const progressLines = element.querySelectorAll('.progress-line');
          progressLines.forEach(progressLine => {
            progressLine.style.backdropFilter = '';
            progressLine.style.backgroundColor = '';
            progressLine.style.background = '';
            progressLine.style.removeProperty('backdrop-filter');
            progressLine.style.removeProperty('background-color');
            progressLine.style.removeProperty('background');
            const innerProgress = progressLine.querySelector('.progress');
            if (innerProgress) {
              innerProgress.style.backdropFilter = '';
              innerProgress.style.backgroundColor = '';
              innerProgress.style.background = '';
              innerProgress.style.removeProperty('backdrop-filter');
              innerProgress.style.removeProperty('background-color');
              innerProgress.style.removeProperty('background');
            }
          });
        }
        
        function shouldSkipElement(el) {
          if (el.closest('.you-head')) return true;
          if (el.classList && el.classList.contains('you-head')) return true;
          if (el.closest('.map-image')) return true;
          if (el.classList && el.classList.contains('map-image')) return true;
          if (el.closest('.progress-line')) return true;
          if (el.closest('.avatar')) return true;
          if (el.classList && el.classList.contains('nickname')) return true;
          if (el.closest('.close')) return true;
          if (el.classList && el.classList.contains('close')) return true;
          return false;
        }
        
        function applyTransparentEffect(element) {
          if (!element || shouldSkipElement(element)) return;
          element.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
          element.style.background = 'transparent';
          element.style.backdropFilter = 'blur(4px)';
        }
        
        function applyBackground(element, identifier, imageUrl) {
          if (appliedElements.has(element)) return;
          
          appliedElements.set(element, { identifier, imageUrl });
          element.setAttribute('data-bg-applied', identifier);
          
          element.style.background = \`url('\${imageUrl}') center center / cover no-repeat\`;
          element.style.backgroundColor = 'transparent';
          element.style.backdropFilter = 'none';
          
          element.querySelectorAll('div').forEach(div => {
            if (shouldSkipElement(div) || div === element) return;
            if (!div.classList.contains('bg-overlay')) applyTransparentEffect(div);
          });
          
          const containers = [
            '.friend-left', '.friend-right', '.level-cont', '.friend-desc',
            '.add-delete', '.add', '.delete', '.friend-pin-btn',
            '.player-cont', '.you', '.content', '.top-medium',
            '.top', '.card', '.medium', '.statistics', '.bottom',
            '.profile-cont', '.profile-holder', '.statistic', '.stat-name',
            '.stat-value', '.progress-text-cont', '.progress-level', '.progress-exp'
          ];
          containers.forEach(selector => {
            element.querySelectorAll(selector).forEach(el => {
              if (shouldSkipElement(el) || el === element) return;
              applyTransparentEffect(el);
            });
          });
          
          preserveProgressBar(element);
          const existingOverlay = element.querySelector('.bg-overlay');
          if (existingOverlay) existingOverlay.remove();
        }
        
        function applyTopBarEffect() {
          const topBar = document.querySelector('.top-bar');
          if (topBar && !appliedElements.has(topBar)) {
            const leftSection = topBar.querySelector('.left');
            if (leftSection && !shouldSkipElement(leftSection)) applyTransparentEffect(leftSection);
            appliedElements.set(topBar, { identifier: 'top-bar', imageUrl: null });
          }
        }
        
        async function handleProfilePage(identifier, isLongId) {
          if (!identifier) return false;
          const profileKey = isLongId ? \`long:\${identifier}\` : \`short:\${identifier}\`;
          if (currentProfileIdentifier === profileKey && hasFetchedForCurrentPage) return true;
          currentProfileIdentifier = profileKey;
          hasFetchedForCurrentPage = true;
          
          const banner = await fetchSpecificUserBanner(identifier, isLongId);
          const profileContainer = document.querySelector('.profile-cont, .profile-holder');
          if (profileContainer && banner) {
            if (appliedElements.has(profileContainer)) appliedElements.delete(profileContainer);
            applyBackground(profileContainer, identifier, banner.imageUrl);
            applyTopBarEffect();
            return true;
          }
          return false;
        }
        
        async function handleFriendsPage() {
          if (hasFetchedForCurrentPage) return;
          hasFetchedForCurrentPage = true;
          
          const banners = await fetchAllUsersBanners();
          if (!banners || banners.length === 0) return;
          
          document.querySelectorAll('.friend').forEach(friend => {
            if (!appliedElements.has(friend)) {
              const { shortId, longId } = getIdsFromElement(friend);
              const banner = findBannerByIds(banners, shortId, longId);
              if (banner) {
                const identifier = banner.kirkaId === shortId ? shortId : longId;
                applyBackground(friend, identifier, banner.imageUrl);
              }
            }
          });
        }
        
        async function scanAndApplyBackgrounds() {
          if (bgIsProcessing) return;
          bgIsProcessing = true;
          try {
            if (isProfilePage()) {
              const urlInfo = getIdentifierFromURL();
              if (urlInfo) await handleProfilePage(urlInfo.identifier, urlInfo.isLongId);
            } else if (isFriendsPage()) {
              await handleFriendsPage();
            }
          } finally {
            bgIsProcessing = false;
          }
        }
        
        function maintainBackgroundEffects() {
          document.querySelectorAll('.friend').forEach(friend => {
            if (appliedElements.has(friend)) {
              friend.querySelectorAll('div').forEach(div => {
                if (shouldSkipElement(div) || div === friend) return;
                if (!div.classList.contains('bg-overlay')) applyTransparentEffect(div);
              });
              preserveProgressBar(friend);
            }
          });
          
          const profileContainer = document.querySelector('.profile-cont, .profile-holder');
          if (profileContainer && appliedElements.has(profileContainer)) {
            profileContainer.querySelectorAll('div').forEach(div => {
              if (shouldSkipElement(div) || div === profileContainer) return;
              if (!div.classList.contains('bg-overlay')) applyTransparentEffect(div);
            });
            preserveProgressBar(profileContainer);
          }
          
          const topBar = document.querySelector('.top-bar');
          if (topBar && appliedElements.has(topBar)) {
            const leftSection = topBar.querySelector('.left');
            if (leftSection && !shouldSkipElement(leftSection)) applyTransparentEffect(leftSection);
          }
        }
        
        function resetBgPageState() {
          hasFetchedForCurrentPage = false;
          currentProfileIdentifier = null;
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
        
        async function initBackgrounds() {
          console.log('[Background] Initializing...');
          await new Promise(resolve => setTimeout(resolve, 500));
          await scanAndApplyBackgrounds();
          maintainBackgroundEffects();
          
          // Periodic maintenance
          setInterval(() => {
            maintainBackgroundEffects();
          }, 2000);
        }
        
        // Navigation handling
        let lastUrl = window.location.href;
        setInterval(() => {
          const currentUrl = window.location.href;
          if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            console.log('[Navigation] URL changed to:', currentUrl);
            resetBgPageState();
            setTimeout(() => {
              checkAndRedirectCustomId();
              injectAllSubnames();
              scanAndApplyBackgrounds();
            }, 100);
          }
          blockUserNotFound();
        }, 500);
        
        const originalPushState = history.pushState;
        history.pushState = function() {
          originalPushState.apply(this, arguments);
          resetBgPageState();
          setTimeout(() => {
            checkAndRedirectCustomId();
            injectAllSubnames();
            scanAndApplyBackgrounds();
          }, 100);
        };
        
        window.addEventListener('popstate', () => {
          resetBgPageState();
          setTimeout(() => {
            checkAndRedirectCustomId();
            injectAllSubnames();
            scanAndApplyBackgrounds();
          }, 100);
        });
        
        // Watch for dynamically added friend elements
        const domObserver = new MutationObserver(() => {
          scanAndApplyBackgrounds();
        });
        domObserver.observe(document.body, { childList: true, subtree: true });
        
        // Initialize everything
        watchUserNotFoundAlerts();
        patchFetchForCustomIds();
        fetchCustomIdMappings();
        fetchSubnamesData();
        initBackgrounds();
        
        setTimeout(() => {
          checkAndRedirectCustomId();
          injectAllSubnames();
        }, 500);
        
        startSubnamePersistence();
        
        console.log('[GameFeatures] All systems initialized (Custom ID, Subname, Backgrounds)');
      })();
    `;
  };

  const injectScript = () => {
    if (!gameWindowRef || gameWindowRef.isDestroyed()) return;
    
    gameWindowRef.webContents.executeJavaScript(buildScript())
      .then(() => {
        console.log('[GameFeatures] Features injected successfully');
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
    
    const inject = () => {
      setTimeout(injectScript, 1000);
    };
    
    if (gameWindow.webContents.isLoading()) {
      gameWindow.webContents.once('did-finish-load', inject);
    } else {
      inject();
    }
    
    gameWindow.webContents.on('did-navigate', inject);
    gameWindow.webContents.on('did-navigate-in-page', inject);
  };

  return { initGameFeatures };
})();

module.exports = { initGameFeatures };
