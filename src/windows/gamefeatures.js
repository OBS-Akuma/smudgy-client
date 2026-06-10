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
        
        // ── Background Script (Smooth transitions, no flashing) ──────────────
        let appliedElements = new Map();
        let bgIsProcessing = false;
        let currentProfileIdentifier = null;
        let hasFetchedForCurrentPage = false;
        let badgeMappings = null;
        let allBannersCache = null;
        let currentFetchPromise = null;

        const BANNERS_API = "https://opensheet.elk.sh/1FNq0RTv0SOSSRVmGJFtli3Fld86uoAlAjDzHByRiZFI/1";
        const BADGE_JSON_URL = "https://raw.githubusercontent.com/OBS-Akuma/KirkaBadges/refs/heads/main/Json/badge.json";

        function cleanShortId(shortId) {
          if (!shortId) return null;
          return shortId.replace(/^#/, '').trim().toUpperCase();
        }

        async function loadBadgeMappings() {
          try {
            const response = await fetch(BADGE_JSON_URL);
            if (!response.ok) throw new Error();
            const data = await response.json();
            badgeMappings = new Map();
            data.forEach(item => {
              if (item.shortId && item.discord) {
                badgeMappings.set(item.shortId.toUpperCase(), item.discord);
              }
            });
            console.log('[Background] Loaded badge mappings for', badgeMappings.size, 'users');
            return true;
          } catch (err) {
            console.error('[Background] Failed to load badge mappings:', err);
            return false;
          }
        }

        async function fetchDiscordUserData(discordId) {
          try {
            const response = await fetch(\`https://bot.kirka.io/api/data?userid=\${discordId}\`);
            if (!response.ok) return null;
            const data = await response.json();
            return data.data || null;
          } catch (err) {
            console.error('[Background] Failed to fetch Discord user data:', err);
            return null;
          }
        }

        function getDiscordIdFromShortId(shortId) {
          if (!badgeMappings || !shortId) return null;
          const cleanId = cleanShortId(shortId);
          return badgeMappings.get(cleanId) || null;
        }

        async function fetchAllUsersBanners() {
          if (allBannersCache) return allBannersCache;
          try {
            const response = await fetch(BANNERS_API);
            const data = await response.json();
            allBannersCache = data.filter(b => b.equipped === "TRUE" && b.status === "approved");
            console.log('[Background] Loaded', allBannersCache.length, 'banners from Kirka API');
            return allBannersCache;
          } catch { return []; }
        }

        async function fetchSpecificUserBanner(shortId) {
          if (!shortId) return null;
          try {
            const banners = await fetchAllUsersBanners();
            const cleanId = cleanShortId(shortId);
            const banner = banners.find(b => b.kirkaId?.toUpperCase() === cleanId);
            if (banner) {
              console.log('[Short ID] Found banner for:', cleanId);
              return banner;
            }
            return null;
          } catch (err) {
            console.error('[Background] Error fetching banner:', err);
            return null;
          }
        }

        async function fetchDiscordFallbackBanner(shortId) {
          const cleanId = cleanShortId(shortId);
          const discordId = getDiscordIdFromShortId(cleanId);
          if (!discordId) return null;
          const userData = await fetchDiscordUserData(discordId);
          if (userData && userData.image && userData.image !== '') {
            console.log('[Discord Fallback] Found banner for:', cleanId);
            return { imageUrl: userData.image, source: 'discord' };
          }
          return null;
        }

        function isProfilePage() {
          return window.location.pathname.match(/\\/profile\\/([^\\/?#]+)/) !== null;
        }

        function isFriendsPage() {
          return window.location.pathname === '/friends' || window.location.pathname.startsWith('/friends/');
        }

        function getShortIdFromPage() {
          const selectors = [
            '.value', '.copy-cont .value', '[data-v-cb399910].value',
            '.friend-id', '.short-id', '.user-short-id'
          ];
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent) {
              let text = element.textContent.trim();
              if (text.match(/^#?[A-Z0-9]{4,8}$/i)) return text;
            }
          }
          const allElements = document.querySelectorAll('*');
          for (const el of allElements) {
            const text = el.textContent?.trim();
            if (text && text.match(/^#[A-Z0-9]{4,8}$/i)) return text;
          }
          return null;
        }

        function getIdentifierFromURL() {
          const match = window.location.pathname.match(/\\/profile\\/([^\\/?#]+)/);
          if (match) {
            const identifier = match[1];
            const isLongId = identifier.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) !== null;
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
          if (!shortId) {
            const valueElement = element.querySelector('.value');
            if (valueElement && valueElement.textContent) {
              const text = valueElement.textContent.trim();
              if (text.match(/^#?[A-Z0-9]{4,8}$/i)) shortId = text;
            }
          }
          return { shortId, longId };
        }

        function findBannerByIds(banners, shortId, longId) {
          if (!banners || banners.length === 0) return null;
          if (shortId) {
            const cleanId = cleanShortId(shortId);
            const banner = banners.find(b => b.kirkaId?.toUpperCase() === cleanId);
            if (banner) return banner;
          }
          if (longId) return banners.find(b => b.userLongId === longId) || null;
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
          if (el.closest('.bottom')) return true;
          if (el.classList && el.classList.contains('bottom')) return true;
          return false;
        }

        function applyTransparentEffect(element) {
          if (!element || shouldSkipElement(element)) return;
          element.style.backgroundColor = 'transparent';
          element.style.background = 'transparent';
          element.style.backdropFilter = 'none';
        }

        function applyStatsBlurEffect(element) {
          if (!element || shouldSkipElement(element)) return;
          element.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
          element.style.background = 'transparent';
          element.style.backdropFilter = 'blur(4px)';
        }

        function preloadImage(url) {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
          });
        }

        async function applyBackground(element, identifier, imageUrl) {
          if (!imageUrl) return false;
          if (appliedElements.has(element) && appliedElements.get(element).imageUrl === imageUrl) return true;
          try {
            await preloadImage(imageUrl);
            appliedElements.set(element, { identifier, imageUrl });
            element.setAttribute('data-bg-applied', identifier);
            element.style.transition = 'background-image 0.2s ease-in-out';
            element.style.backgroundImage = \`url('\${imageUrl}')\`;
            element.style.backgroundSize = 'cover';
            element.style.backgroundPosition = 'center center';
            element.style.backgroundRepeat = 'no-repeat';
            element.style.backgroundColor = 'transparent';
            element.querySelectorAll('div').forEach(div => {
              if (shouldSkipElement(div) || div === element) return;
              if (!div.classList.contains('bg-overlay')) applyTransparentEffect(div);
            });
            const statsContainers = [
              '.statistics', '.statistic', '.stat-name', '.stat-value',
              '.progress-text-cont', '.progress-level', '.progress-exp',
              '.level-cont', '.card', '.medium'
            ];
            statsContainers.forEach(selector => {
              element.querySelectorAll(selector).forEach(el => {
                if (shouldSkipElement(el) || el === element) return;
                applyStatsBlurEffect(el);
              });
            });
            const otherContainers = [
              '.friend-left', '.friend-right', '.friend-desc',
              '.add-delete', '.add', '.delete', '.friend-pin-btn',
              '.player-cont', '.you', '.content', '.top-medium',
              '.top', '.bottom'
            ];
            otherContainers.forEach(selector => {
              element.querySelectorAll(selector).forEach(el => {
                if (shouldSkipElement(el) || el === element) return;
                applyTransparentEffect(el);
              });
            });
            preserveProgressBar(element);
            const existingOverlay = element.querySelector('.bg-overlay');
            if (existingOverlay) existingOverlay.remove();
            setTimeout(() => { element.style.transition = ''; }, 200);
            return true;
          } catch (err) {
            console.error('[Background] Failed to preload image:', imageUrl, err);
            return false;
          }
        }

        function removeBackground(element) {
          if (!element) return;
          element.style.transition = 'background-image 0.2s ease-in-out';
          element.style.backgroundImage = '';
          element.style.backgroundSize = '';
          element.style.backgroundPosition = '';
          element.style.backgroundRepeat = '';
          element.style.backgroundColor = 'transparent';
          appliedElements.delete(element);
          element.removeAttribute('data-bg-applied');
          setTimeout(() => { element.style.transition = ''; }, 200);
        }

        function applyTopBarEffect() {
          const topBar = document.querySelector('.top-bar');
          if (topBar && !appliedElements.has(topBar)) {
            const leftSection = topBar.querySelector('.left');
            if (leftSection && !shouldSkipElement(leftSection)) applyTransparentEffect(leftSection);
            appliedElements.set(topBar, { identifier: 'top-bar', imageUrl: null });
          }
        }

        async function handleProfilePage(urlIdentifier, isLongId) {
          if (!urlIdentifier) return false;
          if (currentFetchPromise) { currentFetchPromise = null; }
          let rawShortId = null;
          let attempts = 0;
          while (!rawShortId && attempts < 15) {
            rawShortId = getShortIdFromPage();
            if (!rawShortId) { await new Promise(resolve => setTimeout(resolve, 200)); attempts++; }
          }
          let imageUrl = null;
          let source = null;
          let usedIdentifier = null;
          if (rawShortId) {
            const cleanId = cleanShortId(rawShortId);
            console.log('[Profile] Using short ID:', cleanId);
            const profileKey = \`short:\${cleanId}\`;
            if (currentProfileIdentifier === profileKey && hasFetchedForCurrentPage) return true;
            currentProfileIdentifier = profileKey;
            hasFetchedForCurrentPage = true;
            usedIdentifier = cleanId;
            const fetchPromise = (async () => {
              const banner = await fetchSpecificUserBanner(cleanId);
              if (banner && banner.imageUrl) return { imageUrl: banner.imageUrl, source: 'kirka' };
              const discordId = getDiscordIdFromShortId(cleanId);
              if (discordId) {
                const discordBanner = await fetchDiscordFallbackBanner(cleanId);
                if (discordBanner && discordBanner.imageUrl) return { imageUrl: discordBanner.imageUrl, source: 'discord' };
              }
              return null;
            })();
            currentFetchPromise = fetchPromise;
            const result = await fetchPromise;
            if (currentFetchPromise !== fetchPromise) { console.log('[Profile] Fetch was cancelled'); return false; }
            if (result) { imageUrl = result.imageUrl; source = result.source; console.log('[Profile] Found', source, 'banner for', cleanId); }
            else { console.log('[Profile] No banner found for', cleanId); }
            currentFetchPromise = null;
          } else {
            console.log('[Profile] Could not find short ID on page');
            return false;
          }
          let containerAttempts = 0;
          let profileContainer = null;
          while (containerAttempts < 10 && !profileContainer) {
            profileContainer = document.querySelector('.profile-cont, .profile-holder, .profile-container, .user-profile');
            if (!profileContainer) { await new Promise(resolve => setTimeout(resolve, 200)); containerAttempts++; }
          }
          if (profileContainer) {
            if (imageUrl) { await applyBackground(profileContainer, usedIdentifier, imageUrl); applyTopBarEffect(); return true; }
            else { if (appliedElements.has(profileContainer)) removeBackground(profileContainer); }
          }
          return false;
        }

        async function handleFriendsPage() {
          if (hasFetchedForCurrentPage) return;
          hasFetchedForCurrentPage = true;
          console.log('[Friends] Loading banners for friends list');
          const banners = await fetchAllUsersBanners();
          const promises = [];
          document.querySelectorAll('.friend').forEach(friend => {
            if (appliedElements.has(friend)) return;
            const promise = (async () => {
              const { shortId, longId } = getIdsFromElement(friend);
              let banner = findBannerByIds(banners, shortId, longId);
              if (banner && banner.imageUrl) {
                const identifier = banner.kirkaId || shortId || longId;
                console.log('[Friend] Using Kirka banner for:', identifier);
                await applyBackground(friend, identifier, banner.imageUrl);
                return;
              }
              if (shortId) {
                const cleanId = cleanShortId(shortId);
                const discordId = getDiscordIdFromShortId(cleanId);
                if (discordId) {
                  const discordBanner = await fetchDiscordFallbackBanner(cleanId);
                  if (discordBanner && discordBanner.imageUrl) {
                    console.log('[Friend] Using Discord banner for:', cleanId);
                    await applyBackground(friend, cleanId, discordBanner.imageUrl);
                    return;
                  }
                }
              }
              if (appliedElements.has(friend)) removeBackground(friend);
            })();
            promises.push(promise);
          });
          await Promise.allSettled(promises);
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
          } finally { bgIsProcessing = false; }
        }

        function maintainBackgroundEffects() {
          document.querySelectorAll('.friend').forEach(friend => {
            if (appliedElements.has(friend)) {
              friend.querySelectorAll('div').forEach(div => {
                if (shouldSkipElement(div) || div === friend) return;
                if (!div.classList.contains('bg-overlay')) applyTransparentEffect(div);
              });
              ['.statistics', '.statistic', '.stat-name', '.stat-value', '.level-cont'].forEach(selector => {
                friend.querySelectorAll(selector).forEach(el => {
                  if (shouldSkipElement(el) || el === friend) return;
                  applyStatsBlurEffect(el);
                });
              });
              preserveProgressBar(friend);
            }
          });
          const profileContainer = document.querySelector('.profile-cont, .profile-holder, .profile-container, .user-profile');
          if (profileContainer && appliedElements.has(profileContainer)) {
            profileContainer.querySelectorAll('div').forEach(div => {
              if (shouldSkipElement(div) || div === profileContainer) return;
              if (!div.classList.contains('bg-overlay')) applyTransparentEffect(div);
            });
            ['.statistics', '.statistic', '.stat-name', '.stat-value',
             '.progress-text-cont', '.progress-level', '.progress-exp',
             '.level-cont', '.card', '.medium'].forEach(selector => {
              profileContainer.querySelectorAll(selector).forEach(el => {
                if (shouldSkipElement(el) || el === profileContainer) return;
                applyStatsBlurEffect(el);
              });
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
          currentFetchPromise = null;
        }

        async function initBackgrounds() {
          console.log('[Background] Initializing - Preloading images to prevent flashing');
          await loadBadgeMappings();
          await fetchAllUsersBanners();
          await new Promise(resolve => setTimeout(resolve, 500));
          await scanAndApplyBackgrounds();
          maintainBackgroundEffects();
          setInterval(() => { maintainBackgroundEffects(); }, 2000);
        }
        // ── End Background Script ─────────────────────────────────────────────


        // ── Custom ID & Subnames ──────────────────────────────────────────────
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

        // ── Navigation handling ───────────────────────────────────────────────
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
        
        const domObserver = new MutationObserver(() => {
          if (isProfilePage() || isFriendsPage()) scanAndApplyBackgrounds();
        });
        domObserver.observe(document.body, { childList: true, subtree: true });

        // ── Initialize everything ─────────────────────────────────────────────
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
        
        console.log('[GameFeatures] All systems initialized (Custom ID, Subname, Backgrounds, Profile Lookup)');
      })();
    `;
  };

  const friendTrackerScript = () => {
    return `
      (function() {
        if (window.__friendTrackerInstalled) return;
        window.__friendTrackerInstalled = true;

        let previousFriends = [];
        let previousIncoming = [];
        let currentInterval = null;
        let notifiedScammers = new Set();

        const token = localStorage.getItem('token');
        if (!token) {
            console.error('[FriendTracker] No token found in localStorage');
            return;
        }

        try {
            const savedFriends = localStorage.getItem('Friends_list_0.0.2');
            if (savedFriends) previousFriends = JSON.parse(savedFriends);
            const savedIncoming = localStorage.getItem('Incoming_list_0.0.2');
            if (savedIncoming) previousIncoming = JSON.parse(savedIncoming);
            const savedNotified = localStorage.getItem('Notified_scammers_0.0.2');
            if (savedNotified) notifiedScammers = new Set(JSON.parse(savedNotified));
        } catch (e) {
            console.error('[FriendTracker] Failed to load saved lists:', e);
        }

        function ensureNotificationContainer() {
            let container = document.getElementsByClassName("vue-notification-group")[0];
            if (!container) {
                container = document.createElement("div");
                container.className = "vue-notification-group";
                container.style.cssText = "position: fixed; bottom: 0; left: 0; right: auto; top: auto; z-index: 9999;";
                const innerDiv = document.createElement("div");
                innerDiv.style.cssText = "position: relative; display: flex; flex-direction: column;";
                container.appendChild(innerDiv);
                document.body.appendChild(container);
            }
            return container;
        }

        const customNotification = (data) => {
            const container = ensureNotificationContainer();
            const notificationGroup = container.children[0];
            const notifElement = document.createElement("div");
            notifElement.classList.add("vue-notification-wrapper");
            notifElement.style = "transition-timing-function: ease; transition-delay: 0s; transition-property: all;";
            notifElement.innerHTML = \`
            <div style="display: flex; align-items: center; padding: .9rem 1.1rem; margin-bottom: .5rem; color: var(--white); cursor: pointer; box-shadow: 0 0 0.7rem rgba(0,0,0,.25); border-radius: .2rem; background: linear-gradient(262.54deg,#202639 9.46%,#223163 100.16%); margin-left: 1rem; border: solid .15rem #ffb914; font-family: Exo\\ 2;" class="alert-default">
                \${data.icon ? \`<img src="\${data.icon}" style="min-width: 2rem; height: 2rem; margin-right: .9rem;" />\` : ""}
                <span style="font-size: 1rem; font-weight: 600; text-align: left;" class="text">\${data.message}</span>
            </div>\`;
            if (data.onClick) {
                notifElement.querySelector('.alert-default').addEventListener('click', data.onClick);
            }
            notificationGroup.appendChild(notifElement);
            setTimeout(() => { try { notifElement.remove(); } catch {} }, 10000);
        };

        function extractFriendList(data) {
            if (data && data.wMWWmwn && Array.isArray(data.wMWWmwn)) {
                return data.wMWWmwn.map(friend => ({ wMWWm: friend.wMWWm, wNmnw: friend.wNmnw, shortId: friend.wMWWm }));
            }
            return [];
        }

        function extractIncomingRequests(data) {
            if (data && data.wWnNmWM && Array.isArray(data.wWnNmWM)) {
                return data.wWnNmWM.map(request => ({ wMWWm: request.wMWWm, wNmnw: request.wNmnw, shortId: request.wMWWm }));
            }
            return [];
        }

        async function checkScammers(users) {
            try {
                const response = await fetch('https://opensheet.elk.sh/1FNq0RTv0SOSSRVmGJFtli3Fld86uoAlAjDzHByRiZFI/2');
                if (!response.ok) return;
                const data = await response.json();
                if (!Array.isArray(data)) return;
                const scammerMap = new Map();
                data.forEach(scammer => {
                    const shortId = scammer.shortId ? scammer.shortId.replace(/^#/, '') : '';
                    if (shortId) scammerMap.set(shortId, scammer);
                });
                users.forEach(user => {
                    const shortId = user.shortId;
                    if (scammerMap.has(shortId) && !notifiedScammers.has(shortId)) {
                        const scammer = scammerMap.get(shortId);
                        customNotification({
                            icon: \`https://www.smudgy.store/api/list/profile.png?meow=\${shortId}\`,
                            message: \`\${user.wNmnw} (\${shortId}) has been marked Unsafe\`,
                            onClick: () => {
                                alert(\`Reason: \${scammer.reason}\\nReported by: \${scammer.reportedBy}\\nDate: \${scammer.dateTime}\`);
                            }
                        });
                        notifiedScammers.add(shortId);
                    }
                });
                localStorage.setItem('Notified_scammers_0.0.2', JSON.stringify(Array.from(notifiedScammers)));
            } catch (error) {
                console.error('[FriendTracker] Failed to fetch scammers:', error);
            }
        }

        function compareFriendLists(oldList, newList) {
            const newIds = new Set(newList.map(f => f.shortId));
            oldList.filter(friend => !newIds.has(friend.shortId)).forEach(friend => {
                customNotification({
                    icon: \`https://www.smudgy.store/api/list/profile.png?meow=\${friend.shortId}\`,
                    message: \`User \${friend.wNmnw} (\${friend.shortId}) isn't your friend anymore\`
                });
            });
        }

        function compareIncomingRequests(oldIncoming, newIncoming, currentFriends) {
            const newIncomingIds = new Set(newIncoming.map(r => r.shortId));
            const friendIds = new Set(currentFriends.map(f => f.shortId));
            oldIncoming.filter(request => !newIncomingIds.has(request.shortId)).forEach(request => {
                customNotification({
                    icon: \`https://www.smudgy.store/api/list/profile.png?meow=\${request.shortId}\`,
                    message: friendIds.has(request.shortId)
                        ? \`You accepted \${request.wNmnw} (\${request.shortId})\`
                        : \`You declined \${request.wNmnw} (\${request.shortId})\`
                });
            });
        }

        function watchForButtons() {
            document.querySelectorAll('button:not([data-ft-watched])').forEach(button => {
                button.setAttribute('data-ft-watched', 'true');
                button.addEventListener('click', () => setTimeout(fetchData, 500));
            });
        }

        async function fetchData() {
            try {
                const response = await fetch('https://api2.kirka.io/api/wNmwWMWn', {
                    headers: { 'Authorization': \`Bearer \${token}\` }
                });
                if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
                const data = await response.json();
                const currentFriends = extractFriendList(data);
                const currentIncoming = extractIncomingRequests(data);
                await checkScammers([...currentFriends, ...currentIncoming]);
                if (previousFriends.length > 0) compareFriendLists(previousFriends, currentFriends);
                if (previousIncoming.length > 0) compareIncomingRequests(previousIncoming, currentIncoming, currentFriends);
                previousFriends = currentFriends;
                previousIncoming = currentIncoming;
                localStorage.setItem('Friends_list_0.0.2', JSON.stringify(previousFriends));
                localStorage.setItem('Incoming_list_0.0.2', JSON.stringify(previousIncoming));
            } catch (error) {
                console.error('[FriendTracker] Failed to fetch data:', error);
            }
        }

        fetchData();
        setInterval(watchForButtons, 2000);
        if (currentInterval) clearInterval(currentInterval);
        currentInterval = setInterval(fetchData, 60000);

        console.log('[FriendTracker] Initialized');
      })();
    `;
  };

  const lobbyBadgesScript = () => {
    return `
      (function() {
        if (window.__lobbyBadgesInstalled) return;
        window.__lobbyBadgesInstalled = true;

        let customizations = null;

        if (!document.getElementById('kirka-badges-styles')) {
          const style = document.createElement('style');
          style.id = 'kirka-badges-styles';
          style.textContent = \`
            @keyframes kirka-badges-gradient {
              0%   { background-position: 0% 50%; }
              50%  { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
            .kirka-badges { display: inline-flex !important; gap: 0.25rem; align-items: center; flex-shrink: 0; white-space: nowrap; }
            .kirka-badges img { object-fit: contain; }
            .nickname { display: flex !important; align-items: center !important; flex-wrap: nowrap !important; white-space: nowrap !important; overflow: visible !important; }
            .kirka-nickname-span { white-space: nowrap !important; display: inline-block !important; }
          \`;
          document.head.appendChild(style);
        }

        async function fetchCustomizations() {
          try {
            const stored = localStorage.getItem('juice-customizations');
            if (stored) { customizations = JSON.parse(stored); }
            const r = await fetch('https://raw.githubusercontent.com/OBS-Akuma/KirkaBadges/refs/heads/main/Json/badge.json');
            if (!r.ok) throw new Error();
            customizations = await r.json();
            localStorage.setItem('juice-customizations', JSON.stringify(customizations));
          } catch {
            if (!customizations) {
              const stored = localStorage.getItem('juice-customizations');
              if (stored) customizations = JSON.parse(stored);
            }
          }
        }

        function getCustomsForId(shortId) {
          if (!customizations || !shortId) return null;
          return customizations.find(c => c.shortId === shortId) || null;
        }

        function makeSafeImgSrc(src) {
          if (!src) return '';
          if (src.startsWith('/') || /^[A-Za-z]:[\\\\/]/.test(src)) {
            const fp = src.replace(/\\\\/g, '/');
            return \`file://\${fp.startsWith('/') ? '' : '/'}\${fp}\`;
          }
          return src;
        }

        function addBadgeImg(container, src, height = '22px') {
          const safeSrc = makeSafeImgSrc(src);
          if ([...container.children].some(img => img.src === safeSrc)) return;
          const img = document.createElement('img');
          img.src = safeSrc;
          img.style.cssText = \`height: \${height}; width: auto;\`;
          container.appendChild(img);
        }

        function populateBadges(container, customs, height = '22px') {
          if (customs.discord) addBadgeImg(container, 'https://raw.githubusercontent.com/OBS-Akuma/KirkaSkins/refs/heads/main/img/linked.webp', height);
          if (customs.booster) addBadgeImg(container, 'https://raw.githubusercontent.com/OBS-Akuma/KirkaSkins/refs/heads/main/img/booster.webp', height);
          if (customs.badges?.length) customs.badges.forEach(badge => addBadgeImg(container, badge, height));
        }

        function applyGradient(el, gradient, animated = false) {
          el.style.background = \`linear-gradient(\${gradient.rot}, \${gradient.stops.join(', ')})\`;
          el.style.backgroundClip = 'text';
          el.style.webkitBackgroundClip = 'text';
          el.style.color = 'transparent';
          el.style.webkitTextFillColor = 'transparent';
          el.style.fontWeight = '700';
          el.style.textShadow = gradient.shadow || '0 0 0 transparent';
          if (animated) {
            el.style.backgroundSize = '200% 200%';
            el.style.animation = 'kirka-badges-gradient 3s linear infinite';
          }
        }

        function applyLobbyCustomizations() {
          if (!customizations) return;

          const avatarEl = document.querySelector('.avatar-info .username');
          let shortIdCard = avatarEl?.textContent.trim().split('#')[1] || null;

          if (!shortIdCard) {
            try {
              const stored = localStorage.getItem('current-user');
              if (stored) shortIdCard = JSON.parse(stored)?.wMWWm || null;
            } catch {}
          }

          const lobbyNickname =
            document.querySelector('.team-section .head-right .nickname') ||
            document.querySelector('.head-right .nickname') ||
            document.querySelector('.team-section .heads .nickname') ||
            document.querySelector('.heads .nickname');

          if (!lobbyNickname || !shortIdCard) return;

          const customs = getCustomsForId(shortIdCard);
          if (!customs) return;

          lobbyNickname.style.display = 'flex';
          lobbyNickname.style.alignItems = 'flex-end';
          lobbyNickname.style.gap = '0.25rem';
          lobbyNickname.style.overflow = 'unset';

          if (customs.gradient) applyGradient(lobbyNickname, customs.gradient, customs.animated);
          else { lobbyNickname.style.color = ''; lobbyNickname.style.background = ''; }

          if (lobbyNickname.querySelector('.kirka-badges')) return;

          const badgesElem = document.createElement('div');
          badgesElem.style.cssText = 'display: flex; gap: 0.25rem; align-items: center; width: 0;';
          badgesElem.className = 'kirka-badges';
          badgesElem.dataset.shortId = shortIdCard;
          lobbyNickname.appendChild(badgesElem);
          populateBadges(badgesElem, customs, '32px');
        }

        function applyFriendsCustomizations() {
          if (!customizations) return;
          document.querySelectorAll('.friend').forEach(friend => {
            const shortId = friend.querySelector('.Akuma-didnt-fix-this-hehe')?.innerText;
            if (!shortId) return;
            const customs = getCustomsForId(shortId);
            if (!customs) return;
            const nickname = friend.querySelector('.nickname');
            if (!nickname) return;
            nickname.style.display = 'flex';
            nickname.style.alignItems = 'flex-end';
            nickname.style.gap = '0.25rem';
            nickname.style.overflow = 'unset';
            if (customs.gradient) { applyGradient(nickname, customs.gradient, customs.animated); nickname.style.maxWidth = 'min-content'; }
            let badgesElem = nickname.querySelector('.kirka-badges');
            if (badgesElem?.dataset.shortId === shortId) return;
            if (badgesElem) badgesElem.remove();
            badgesElem = document.createElement('div');
            badgesElem.className = 'kirka-badges';
            badgesElem.dataset.shortId = shortId;
            badgesElem.style.cssText = 'display: flex; gap: 0.25rem; align-items: center; width: 0;';
            nickname.appendChild(badgesElem);
            populateBadges(badgesElem, customs, '18px');
          });
        }

        function run() {
          applyLobbyCustomizations();
          applyFriendsCustomizations();
        }

        fetchCustomizations().then(() => {
          run();
          new MutationObserver(() => run()).observe(document.body, { childList: true, subtree: true });
        });

        console.log('[LobbyBadges] Initialized');
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

    gameWindowRef.webContents.executeJavaScript(friendTrackerScript())
      .then(() => console.log('[FriendTracker] Injected successfully'))
      .catch((err) => console.error('[FriendTracker] Injection failed:', err));

    gameWindowRef.webContents.executeJavaScript(lobbyBadgesScript())
      .then(() => console.log('[LobbyBadges] Injected successfully'))
      .catch((err) => console.error('[LobbyBadges] Injection failed:', err));
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