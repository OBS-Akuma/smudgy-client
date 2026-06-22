const { initGameFeatures } = (() => {
  let gameWindowRef = null;
  let isInjected = false;

  const buildScript = () => {
    return `
      (function() {
        if (window.__fullFeaturesInstalled) return;
        window.__fullFeaturesInstalled = true;
        
        let customIdMapping = {};
        let bgIsProcessing = false;
        let currentProfileIdentifier = null;
        let hasFetchedForCurrentPage = false;
        let badgeMappings = null;
        let allBannersCache = null;
        let currentFetchPromise = null;
        let scanInterval = null;

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

        function isPlayerListVisible() {
          return document.querySelector('.player-list') !== null || 
                 document.querySelector('.team-players-state') !== null ||
                 document.querySelector('.player-cont') !== null ||
                 document.querySelector('.teammate') !== null;
        }

        function isUserCardVisible() {
          return document.querySelector('#user-card') !== null;
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
          if (el.classList && el.classList.contains('avatar')) return true;
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

        let appliedElements = new Map();

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
              if (div.closest('.avatar')) return;
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
              '.you', '.content', '.top-medium',
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
        // ── User Card (Kill Card) Background ──────────────────────────────────
        async function handleUserCard() {
          const userCard = document.querySelector('#user-card');
          if (!userCard) return;
          
          if (appliedElements.has(userCard)) return;
          
          const shortIdEl = userCard.querySelector('.short-id');
          if (!shortIdEl) return;
          
          const shortId = shortIdEl.textContent.trim();
          if (!shortId || !shortId.match(/^#?[A-Z0-9]{4,8}$/i)) return;
          
          const cleanId = cleanShortId(shortId);
          
          // Get banner
          const banner = await fetchSpecificUserBanner(cleanId);
          let imageUrl = null;
          
          if (banner && banner.imageUrl) {
            imageUrl = banner.imageUrl;
          } else {
            const discordId = getDiscordIdFromShortId(cleanId);
            if (discordId) {
              const discordBanner = await fetchDiscordFallbackBanner(cleanId);
              if (discordBanner && discordBanner.imageUrl) {
                imageUrl = discordBanner.imageUrl;
              }
            }
          }
          
          if (imageUrl) {
            // Apply background to the user card
            userCard.style.backgroundImage = \`url('\${imageUrl}')\`;
            userCard.style.backgroundSize = 'cover';
            userCard.style.backgroundPosition = 'center center';
            userCard.style.backgroundRepeat = 'no-repeat';
            userCard.style.backgroundColor = 'rgba(0,0,0,0.3)';
            userCard.style.backgroundBlendMode = 'overlay';
            userCard.style.borderRadius = '8px';
            userCard.setAttribute('data-bg-applied', cleanId);
            appliedElements.set(userCard, { identifier: cleanId, imageUrl });
            
            // ISOLATE the avatar from the parent's blend mode
            const avatar = userCard.querySelector('.avatar');
            if (avatar) {
              const originalBg = avatar.style.backgroundImage;
              avatar.style.position = 'relative';
              avatar.style.zIndex = '10';
              avatar.style.isolation = 'isolate';
              avatar.style.mixBlendMode = 'normal';
              if (originalBg && !avatar.style.backgroundImage) {
                avatar.style.backgroundImage = originalBg;
              }
              avatar.style.flexShrink = '0';
              avatar.style.flexGrow = '0';
              avatar.style.overflow = 'hidden';
            }
            
            // Isolate the top section
            const top = userCard.querySelector('.top');
            if (top) {
              top.style.position = 'relative';
              top.style.zIndex = '5';
              top.style.isolation = 'isolate';
              top.style.mixBlendMode = 'normal';
            }
            
            // Isolate the bottom section
            const bottom = userCard.querySelector('.bottom');
            if (bottom) {
              bottom.style.position = 'relative';
              bottom.style.zIndex = '5';
              bottom.style.isolation = 'isolate';
              bottom.style.mixBlendMode = 'normal';
            }
            
            // ── Apply Smudgy Badges & Gradient to User Card ──────────────────
            const nicknameEl = userCard.querySelector('.nickname');
            if (nicknameEl) {
              // Get customizations for this user
              const customs = getCustomsForId(cleanId);
              
              // Make nickname a flex container to keep badges inline
              nicknameEl.style.display = 'inline-flex';
              nicknameEl.style.alignItems = 'center';
              nicknameEl.style.gap = '0.25rem';
              nicknameEl.style.flexWrap = 'wrap';
              
              if (customs) {
                // Apply gradient to nickname text only
                if (customs.gradient) {
                  // Wrap the text in a span for gradient
                  const textSpan = document.createElement('span');
                  textSpan.className = 'kirka-nickname-text';
                  textSpan.textContent = nicknameEl.textContent.trim();
                  textSpan.style.background = \`linear-gradient(\${customs.gradient.rot}, \${customs.gradient.stops.join(', ')})\`;
                  textSpan.style.backgroundClip = 'text';
                  textSpan.style.webkitBackgroundClip = 'text';
                  textSpan.style.color = 'transparent';
                  textSpan.style.webkitTextFillColor = 'transparent';
                  textSpan.style.fontWeight = '700';
                  textSpan.style.textShadow = customs.gradient.shadow || '0 0 0 transparent';
                  if (customs.animated) {
                    textSpan.style.backgroundSize = '200% 200%';
                    textSpan.style.animation = 'kirka-badges-gradient 3s linear infinite';
                  }
                  // Clear and add the text span
                  nicknameEl.innerHTML = '';
                  nicknameEl.appendChild(textSpan);
                }
                
                // Add badges - APPENDED DIRECTLY TO nicknameEl
                if (customs.discord || customs.booster || (customs.badges && customs.badges.length)) {
                  const badgesContainer = document.createElement('div');
                  badgesContainer.className = 'kirka-badges';
                  badgesContainer.style.cssText = 'display: inline-flex; gap: 0.25rem; align-items: center; flex-shrink: 0;';
                  
                  if (customs.discord) {
                    const img = document.createElement('img');
                    img.src = 'https://raw.githubusercontent.com/OBS-Akuma/KirkaSkins/refs/heads/main/img/linked.webp';
                    img.style.cssText = 'height: 22px; width: auto;';
                    badgesContainer.appendChild(img);
                  }
                  if (customs.booster) {
                    const img = document.createElement('img');
                    img.src = 'https://raw.githubusercontent.com/OBS-Akuma/KirkaSkins/refs/heads/main/img/booster.webp';
                    img.style.cssText = 'height: 22px; width: auto;';
                    badgesContainer.appendChild(img);
                  }
                  if (customs.badges && customs.badges.length) {
                    customs.badges.forEach(badge => {
                      const img = document.createElement('img');
                      if (badge.startsWith('/') || /^[A-Za-z]:[\\\\/]/.test(badge)) {
                        const fp = badge.replace(/\\\\/g, '/');
                        img.src = \`file://\${fp.startsWith('/') ? '' : '/'}\${fp}\`;
                      } else {
                        img.src = badge;
                      }
                      img.style.cssText = 'height: 22px; width: auto;';
                      badgesContainer.appendChild(img);
                    });
                  }
                  
                  // Append badges DIRECTLY to nicknameEl (inline with text)
                  nicknameEl.appendChild(badgesContainer);
                }
              }
              
              // Add text shadow for readability if no gradient
              if (!customs || !customs.gradient) {
                const textSpan = nicknameEl.querySelector('.kirka-nickname-text');
                if (textSpan) {
                  textSpan.style.textShadow = '0 0 10px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.7)';
                  textSpan.style.color = '#fff';
                } else {
                  nicknameEl.style.textShadow = '0 0 10px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.7)';
                  nicknameEl.style.color = '#fff';
                }
              }
            }
            
            // Style other elements for readability
            const killerName = userCard.querySelector('.killer-name');
            if (killerName) {
              killerName.style.textShadow = '0 0 10px rgba(0,0,0,0.9)';
            }
            
            const killerClan = userCard.querySelector('.killer-clan');
            if (killerClan) {
              killerClan.style.textShadow = '0 0 10px rgba(0,0,0,0.9)';
            }
            
            const killerLevel = userCard.querySelector('.killer-level');
            if (killerLevel) {
              killerLevel.style.textShadow = '0 0 10px rgba(0,0,0,0.9)';
            }
            
            const labelKilled = userCard.querySelector('.label-killed');
            if (labelKilled) {
              labelKilled.style.textShadow = '0 0 10px rgba(0,0,0,0.9)';
            }
            
            const nameGun = userCard.querySelector('.name-gun');
            if (nameGun) {
              nameGun.style.textShadow = '0 0 10px rgba(0,0,0,0.9)';
            }
            
            const damageValue = userCard.querySelector('.damage-value');
            if (damageValue) {
              damageValue.style.textShadow = '0 0 10px rgba(0,0,0,0.9)';
            }
            
            console.log('[UserCard] Applied background and badges to:', cleanId);
          }
        }

        // ── Helper to get customizations ──────────────────────────────────────
        function getCustomsForId(shortId) {
          try {
            const customizations = JSON.parse(localStorage.getItem('juice-customizations') || '[]');
            return customizations.find(c => c.shortId === shortId) || null;
          } catch {
            return null;
          }
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
            
            if (isPlayerListVisible()) {
              await handlePlayerList();
            }
            
            if (isUserCardVisible()) {
              await handleUserCard();
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
          
          const userCard = document.querySelector('#user-card');
          if (userCard && appliedElements.has(userCard)) {
            const avatar = userCard.querySelector('.avatar');
            if (avatar) {
              avatar.style.position = 'relative';
              avatar.style.zIndex = '10';
              avatar.style.isolation = 'isolate';
              avatar.style.mixBlendMode = 'normal';
            }
            const top = userCard.querySelector('.top');
            if (top) {
              top.style.position = 'relative';
              top.style.zIndex = '5';
              top.style.isolation = 'isolate';
              top.style.mixBlendMode = 'normal';
            }
            const bottom = userCard.querySelector('.bottom');
            if (bottom) {
              bottom.style.position = 'relative';
              bottom.style.zIndex = '5';
              bottom.style.isolation = 'isolate';
              bottom.style.mixBlendMode = 'normal';
            }
          }
          
          const topBar = document.querySelector('.top-bar');
          if (topBar && appliedElements.has(topBar)) {
            const leftSection = topBar.querySelector('.left');
            if (leftSection && !shouldSkipElement(leftSection)) applyTransparentEffect(leftSection);
          }

          // Maintain player list backgrounds (ALL teammates)
          const playerList = document.querySelector('.player-list') || document.querySelector('.team-players-state');
          if (playerList) {
            playerList.querySelectorAll('.player-cont, .teammate').forEach(player => {
              if (appliedElements.has(player)) {
                player.querySelectorAll('div').forEach(div => {
                  if (shouldSkipElement(div) || div === player) return;
                  if (!div.classList.contains('bg-overlay')) applyTransparentEffect(div);
                });
              }
            });
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
          
          if (scanInterval) clearInterval(scanInterval);
          scanInterval = setInterval(() => {
            if (isUserCardVisible() || isPlayerListVisible()) {
              scanAndApplyBackgrounds();
            }
          }, 2000);
          
          setInterval(() => { maintainBackgroundEffects(); }, 2000);
        }
        // ── End Background Script ─────────────────────────────────────────────


        // ── Custom ID ──────────────────────────────────────────────────────────
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
            scanAndApplyBackgrounds();
          }, 100);
        };
        
        window.addEventListener('popstate', () => {
          resetBgPageState();
          setTimeout(() => {
            checkAndRedirectCustomId();
            scanAndApplyBackgrounds();
          }, 100);
        });
        
        const domObserver = new MutationObserver(() => {
          if (isProfilePage() || isFriendsPage() || isUserCardVisible() || isPlayerListVisible()) {
            scanAndApplyBackgrounds();
          }
        });
        domObserver.observe(document.body, { childList: true, subtree: true });

        // ── Initialize everything ─────────────────────────────────────────────
        watchUserNotFoundAlerts();
        patchFetchForCustomIds();
        fetchCustomIdMappings();
        initBackgrounds();
        
        setTimeout(() => {
          checkAndRedirectCustomId();
          if (isUserCardVisible() || isPlayerListVisible()) scanAndApplyBackgrounds();
        }, 500);
        
        console.log('[GameFeatures] All systems initialized (Custom ID, Backgrounds, Profile Lookup, User Card, Player List)');
        console.log('[GameFeatures] Player List backgrounds work on ALL teammates (both blue and red)');
      })();
    `;
  };

  // ── Lobby Badges Script ──────────────────────────────────────────────────────
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