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
        let redirectInterval = null;
        let statusDotObserver = null;
        let isProcessingMutation = false;

        const BANNERS_API = "https://opensheet.elk.sh/1FNq0RTv0SOSSRVmGJFtli3Fld86uoAlAjDzHByRiZFI/1";
        const BADGE_JSON_URL = "https://raw.githubusercontent.com/OBS-Akuma/KirkaBadges/refs/heads/main/Json/badge.json";

        // --- Rate limiting and debouncing ---
        const RATE_LIMIT = 50; // Max requests per batch
        const BATCH_DELAY = 100; // Delay between batches in ms
        let isProcessingFriends = false;
        let friendProcessingQueue = [];

        function cleanShortId(id) {
          if (!id) return null;
          return id.replace(/^#/, '').toUpperCase().trim();
        }

        function replaceStatusDots() {
          const statusMap = {
            '.online-dot.dot-online': 'https://raw.githubusercontent.com/discord/social-sdk-unity-sample/refs/heads/main/DiscordSocialSDKUnitySample/Assets/Images/StatusIcons/online.png',
            '.online-dot.dot-busy': 'https://raw.githubusercontent.com/discord/social-sdk-unity-sample/refs/heads/main/DiscordSocialSDKUnitySample/Assets/Images/StatusIcons/dnd.png',
            '.online-dot.dot-away': 'https://raw.githubusercontent.com/discord/social-sdk-unity-sample/refs/heads/main/DiscordSocialSDKUnitySample/Assets/Images/StatusIcons/idle.png'
          };

          Object.entries(statusMap).forEach(([selector, imgUrl]) => {
            document.querySelectorAll(selector).forEach(dot => {
              if (dot.dataset.statusReplaced === 'true') return;
              
              const img = document.createElement('img');
              img.src = imgUrl;
              img.alt = selector.includes('online') ? 'Online' : selector.includes('busy') ? 'Do Not Disturb' : 'Idle';
              img.style.cssText = 'width: 10px; height: 10px; display: inline-block; vertical-align: middle;';
              dot.innerHTML = '';
              dot.appendChild(img);
              dot.dataset.statusReplaced = 'true';
            });
          });
        }

        function setupStatusDotObserver() {
          if (statusDotObserver) {
            statusDotObserver.disconnect();
          }

          statusDotObserver = new MutationObserver(function(mutations) {
            let shouldCheck = false;
            mutations.forEach(mutation => {
              if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                shouldCheck = true;
              }
              if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                if (target.classList && (
                  target.classList.contains('online-dot') ||
                  target.classList.contains('dot-online') ||
                  target.classList.contains('dot-busy') ||
                  target.classList.contains('dot-away')
                )) {
                  shouldCheck = true;
                }
              }
            });

            if (shouldCheck) {
              replaceStatusDots();
            }
          });

          statusDotObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
          });

          replaceStatusDots();
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
          return document.querySelector('.akumawashere') !== null || 
                 document.querySelector('.team-players-state') !== null ||
                 document.querySelector('.akumawashere') !== null ||
                 document.querySelector('.akumawashere  ') !== null;
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
          if (el.classList && el.classList.contains('progress-line')) return true;
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
            
            Array.from(element.children).forEach(div => {
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

        // --- FIXED: Optimized handleFriendsPage with batching ---
        async function handleFriendsPage() {
          if (hasFetchedForCurrentPage) return;
          hasFetchedForCurrentPage = true;
          
          // Prevent concurrent processing
          if (isProcessingFriends) {
            console.log('[Friends] Already processing, skipping');
            return;
          }
          
          console.log('[Friends] Loading banners for friends list');
          
          try {
            isProcessingFriends = true;
            
            // Get all friend elements
            const friendElements = document.querySelectorAll('.friend');
            if (friendElements.length === 0) {
              console.log('[Friends] No friends found');
              return;
            }
            
            console.log('[Friends] Found', friendElements.length, 'friends');
            
            // Load banners once
            const banners = await fetchAllUsersBanners();
            if (!banners || banners.length === 0) {
              console.log('[Friends] No banners available');
              return;
            }
            
            // Process friends in batches
            const batchSize = 10;
            const totalBatches = Math.ceil(friendElements.length / batchSize);
            
            for (let i = 0; i < friendElements.length; i += batchSize) {
              const batch = Array.from(friendElements).slice(i, i + batchSize);
              const batchNumber = Math.floor(i / batchSize) + 1;
              
              console.log(\`[Friends] Processing batch \${batchNumber}/\${totalBatches} (\${batch.length} friends)\`);
              
              const promises = batch.map(friend => processFriendElement(friend, banners));
              await Promise.allSettled(promises);
              
              // Delay between batches to prevent UI freezing
              if (i + batchSize < friendElements.length) {
                await new Promise(resolve => setTimeout(resolve, 50));
              }
            }
            
            console.log('[Friends] Finished processing all friends');
            
          } catch (error) {
            console.error('[Friends] Error processing friends:', error);
          } finally {
            isProcessingFriends = false;
          }
        }

        // Helper function to process a single friend
        async function processFriendElement(friend, banners) {
          try {
            // Skip if already processed
            if (appliedElements.has(friend) || friend.dataset.processed === 'true') {
              return;
            }
            
            // Mark as being processed
            friend.dataset.processed = 'true';
            
            const { shortId, longId } = getIdsFromElement(friend);
            if (!shortId && !longId) return;
            
            // Try to find banner from cache first
            let banner = findBannerByIds(banners, shortId, longId);
            let imageUrl = null;
            let identifier = null;
            
            if (banner && banner.imageUrl) {
              identifier = banner.kirkaId || shortId || longId;
              imageUrl = banner.imageUrl;
            } else if (shortId) {
              const cleanId = cleanShortId(shortId);
              const discordId = getDiscordIdFromShortId(cleanId);
              if (discordId) {
                const discordBanner = await fetchDiscordFallbackBanner(cleanId);
                if (discordBanner && discordBanner.imageUrl) {
                  identifier = cleanId;
                  imageUrl = discordBanner.imageUrl;
                }
              }
            }
            
            if (imageUrl && identifier) {
              await applyBackground(friend, identifier, imageUrl);
              console.log('[Friend] Applied banner for:', identifier);
            }
          } catch (error) {
            console.error('[Friend] Error processing friend:', error);
          }
        }

        // --- FIXED: Optimized handlePlayerList ---
        async function handlePlayerList() {
          const playerElements = document.querySelectorAll('.player-cont, .teammate');
          if (playerElements.length === 0) return;
          
          console.log('[PlayerList] Loading banners for', playerElements.length, 'players');
          
          try {
            const banners = await fetchAllUsersBanners();
            if (!banners || banners.length === 0) return;
            
            // Process in batches
            const batchSize = 5;
            for (let i = 0; i < playerElements.length; i += batchSize) {
              const batch = Array.from(playerElements).slice(i, i + batchSize);
              
              const promises = batch.map(player => processPlayerElement(player, banners));
              await Promise.allSettled(promises);
              
              if (i + batchSize < playerElements.length) {
                await new Promise(resolve => setTimeout(resolve, 30));
              }
            }
          } catch (error) {
            console.error('[PlayerList] Error:', error);
          }
        }

        function processPlayerElement(player, banners) {
          return new Promise(async (resolve) => {
            try {
              if (appliedElements.has(player)) {
                resolve();
                return;
              }
              
              let shortId = null;
              let longId = null;
              
              const shortIdElement = player.querySelector('.friend-id, .short-id, .value');
              if (shortIdElement) {
                const text = shortIdElement.textContent.trim();
                if (text.match(/^#?[A-Z0-9]{4,8}$/i)) {
                  shortId = text;
                }
              }
              
              const longIdElement = player.querySelector('[data-user-id], .user-long-id, .long-id');
              if (longIdElement) {
                longId = longIdElement.getAttribute('data-user-id') || longIdElement.textContent.trim();
              }
              
              if (!shortId && !longId) {
                resolve();
                return;
              }
              
              let banner = findBannerByIds(banners, shortId, longId);
              let imageUrl = null;
              let identifier = null;
              
              if (banner && banner.imageUrl) {
                identifier = banner.kirkaId || shortId || longId;
                imageUrl = banner.imageUrl;
              } else if (shortId) {
                const cleanId = cleanShortId(shortId);
                const discordId = getDiscordIdFromShortId(cleanId);
                if (discordId) {
                  const discordBanner = await fetchDiscordFallbackBanner(cleanId);
                  if (discordBanner && discordBanner.imageUrl) {
                    identifier = cleanId;
                    imageUrl = discordBanner.imageUrl;
                  }
                }
              }
              
              if (imageUrl && identifier) {
                await applyBackground(player, identifier, imageUrl);
              }
              resolve();
            } catch (error) {
              console.error('[PlayerList] Error processing player:', error);
              resolve();
            }
          });
        }

        async function handleUserCard() {
          const userCard = document.querySelector('#user-card');
          if (!userCard) return;
          
          if (appliedElements.has(userCard)) return;
          
          const shortIdEl = userCard.querySelector('.short-id');
          if (!shortIdEl) return;
          
          const shortId = shortIdEl.textContent.trim();
          if (!shortId || !shortId.match(/^#?[A-Z0-9]{4,8}$/i)) return;
          
          const cleanId = cleanShortId(shortId);
          
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
            userCard.style.backgroundImage = \`url('\${imageUrl}')\`;
            userCard.style.backgroundSize = 'cover';
            userCard.style.backgroundPosition = 'center center';
            userCard.style.backgroundRepeat = 'no-repeat';
            userCard.style.backgroundColor = 'rgba(0,0,0,0.3)';
            userCard.style.backgroundBlendMode = 'overlay';
            userCard.style.borderRadius = '8px';
            userCard.setAttribute('data-bg-applied', cleanId);
            appliedElements.set(userCard, { identifier: cleanId, imageUrl });
            
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
            
            const nicknameEl = userCard.querySelector('.nickname');
            if (nicknameEl) {
              const customs = getCustomsForId(cleanId);
              
              nicknameEl.style.display = 'inline-flex';
              nicknameEl.style.alignItems = 'center';
              nicknameEl.style.gap = '0.25rem';
              nicknameEl.style.flexWrap = 'wrap';
              
              if (customs) {
                if (customs.gradient) {
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
                  nicknameEl.innerHTML = '';
                  nicknameEl.appendChild(textSpan);
                }
                
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
                  
                  nicknameEl.appendChild(badgesContainer);
                }
              }
              
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

        function getCustomsForId(shortId) {
          try {
            const customizations = JSON.parse(localStorage.getItem('juice-customizations') || '[]');
            return customizations.find(c => c.shortId === shortId) || null;
          } catch {
            return null;
          }
        }

        function addProfileButtons() {
          const getShortId = () => {
            const shortIdElement = document.querySelector('[data-v-e5a0c932] .value');
            if (shortIdElement) {
              const shortId = shortIdElement.textContent.trim();
              return shortId.replace('#', '');
            }
            return null;
          };

          const createButton = (text, bgColor, textColor, url) => {
            const button = document.createElement('button');
            button.className = 'button button rectangle';
            button.style.cssText = \`
              background-color: \${bgColor};
              --hover-color: \${bgColor};
              --top: \${bgColor};
              --bottom: \${bgColor};
              color: \${textColor};
              margin-right: 8px;
            \`;

            const textDiv = document.createElement('div');
            textDiv.className = 'text';
            textDiv.textContent = text;
            button.appendChild(textDiv);

            button.addEventListener('click', function(e) {
              e.preventDefault();
              const shortId = getShortId();
              if (shortId) {
                window.open(url.replace('{shortid}', shortId), '_blank');
              }
            });

            const wrapperDiv = document.createElement('div');
            wrapperDiv.className = 'WmWwnM';

            const borderTop = document.createElement('div');
            borderTop.className = 'border-top border';
            wrapperDiv.appendChild(borderTop);

            const borderBottom = document.createElement('div');
            borderBottom.className = 'border-bottom border';
            wrapperDiv.appendChild(borderBottom);

            button.appendChild(wrapperDiv);
            return button;
          };

          const addButtons = () => {
            const logoutButton = document.querySelector('[data-v-e5a0c932] .button.rectangle:last-child');
            if (!logoutButton) return false;

            const existingButtons = logoutButton.parentElement.querySelectorAll('.custom-profile-btn');
            if (existingButtons.length > 0) return true;

            const parentContainer = logoutButton.parentElement;

            const trickButton = createButton(
              'TRICKO',
              '#1a1a1a',
              'white',
              'https://tricko.pro/kirka/player/{shortid}'
            );
            trickButton.classList.add('custom-profile-btn');

            const frokeButton = createButton(
              'FROKE',
              '#1A8E50',
              'white',
              'https://www.smudgy.store/kirka/profile?meow={shortid}'
            );
            frokeButton.classList.add('custom-profile-btn');

            parentContainer.insertBefore(trickButton, logoutButton);
            parentContainer.insertBefore(frokeButton, logoutButton);

            return true;
          };

          const profileContainer = document.querySelector('[data-v-112b925e] .content');
          if (profileContainer) {
            addButtons();
          }

          const observer = new MutationObserver(function(mutations) {
            const profileContainer = document.querySelector('[data-v-112b925e] .content');
            if (!profileContainer) return;

            const logoutButton = document.querySelector('[data-v-e5a0c932] .button.rectangle:last-child');
            if (logoutButton) {
              const existingButtons = logoutButton.parentElement.querySelectorAll('.custom-profile-btn');
              if (existingButtons.length === 0) {
                addButtons();
              }
            }
          });

          observer.observe(document.body, {
            childList: true,
            subtree: true
          });
        }

        async function initCountdown() {
          const API_URL = 'https://api2.kirka.io/api/wwMmnWW/wnWmMN';
          const EVENT_INDEX = 0;

          function formatTimeLeft(ms) {
            if (ms < 0) return '0 days left';
            const totalSec = Math.floor(ms / 1000);
            const days = Math.floor(totalSec / 86400);
            const hours = Math.floor((totalSec % 86400) / 3600);
            const minutes = Math.floor((totalSec % 3600) / 60);
            const seconds = totalSec % 60;
            let parts = [];
            if (days > 0) parts.push(days + ' day' + (days > 1 ? 's' : ''));
            if (hours > 0) parts.push(hours + ' hour' + (hours > 1 ? 's' : ''));
            if (minutes > 0) parts.push(minutes + ' minute' + (minutes > 1 ? 's' : ''));
            if (seconds > 0 || parts.length === 0) parts.push(seconds + ' second' + (seconds > 1 ? 's' : ''));
            return parts.join(' ') + ' left';
          }

          function updateElement(text) {
            const container = document.querySelector('[data-v-b52dc228].text-1.header');
            if (!container) return false;
            const popover = container.querySelector('[data-v-5c854b68][data-v-b52dc228].v-popover');
            if (!popover) return false;
            const nodesToRemove = [];
            for (let node of container.childNodes) {
              if (node.nodeType === Node.TEXT_NODE) {
                nodesToRemove.push(node);
              }
            }
            for (let node of nodesToRemove) {
              node.remove();
            }
            const textNode = document.createTextNode(' ' + text + ' ');
            container.insertBefore(textNode, popover);
            return true;
          }

          function updateByStructure(text) {
            const containers = document.querySelectorAll('.text-1.header');
            for (let container of containers) {
              const popover = container.querySelector('.v-popover .trigger .copy-cont .info-icon');
              if (popover) {
                const popoverParent = container.querySelector('.v-popover');
                if (popoverParent) {
                  const textNodes = [];
                  for (let node of container.childNodes) {
                    if (node.nodeType === Node.TEXT_NODE) {
                      textNodes.push(node);
                    }
                  }
                  for (let node of textNodes) {
                    node.remove();
                  }
                  const textNode = document.createTextNode(' ' + text + ' ');
                  container.insertBefore(textNode, popoverParent);
                  return true;
                }
              }
            }
            return false;
          }

          try {
            const response = await fetch(API_URL);
            if (!response.ok) return;
            const data = await response.json();
            if (!Array.isArray(data) || data.length === 0) return;
            const event = data[EVENT_INDEX];
            if (!event || !event.wnNWmwM) return;
            const endDate = new Date(event.wnNWmwM);
            if (isNaN(endDate.getTime())) return;
            const now = new Date();
            const diff = endDate.getTime() - now.getTime();
            const text = formatTimeLeft(diff);

            let updated = updateElement(text);
            if (!updated) updated = updateByStructure(text);
            if (!updated) {
              const allElements = document.querySelectorAll('*');
              for (let el of allElements) {
                if (el.textContent && el.textContent.includes('days left')) {
                  const popover = el.querySelector('.v-popover');
                  if (popover) {
                    const textNodes = [];
                    for (let node of el.childNodes) {
                      if (node.nodeType === Node.TEXT_NODE) {
                        textNodes.push(node);
                      }
                    }
                    for (let node of textNodes) {
                      node.remove();
                    }
                    const textNode = document.createTextNode(' ' + text + ' ');
                    el.insertBefore(textNode, popover);
                    updated = true;
                    break;
                  }
                }
              }
            }
            if (!updated) return;

            window.__countdownEndDate = endDate;
            if (window.__countdownInterval) clearInterval(window.__countdownInterval);
            window.__countdownInterval = setInterval(() => {
              if (window.__countdownEndDate) {
                const now = new Date();
                const diff = window.__countdownEndDate.getTime() - now.getTime();
                const text = formatTimeLeft(diff);
                updateElement(text);
              }
            }, 1000);
          } catch (e) {}
        }

        function addPercentageAboveProgress() {
          const progressContainer = document.querySelector('.card-cont.user-info .progress-lvl');
          if (!progressContainer) {
            setTimeout(addPercentageAboveProgress, 1000);
            return;
          }
          if (progressContainer.querySelector('.progress-percentage')) {
            return;
          }
          const expValues = progressContainer.querySelector('.exp-values');
          if (!expValues) return;
          const text = expValues.textContent.trim();
          const match = text.match(/(\\d+)\\s*\\/\\s*(\\d+)/);
          if (!match) return;
          const current = parseInt(match[1]);
          const max = parseInt(match[2]);
          if (isNaN(current) || isNaN(max) || max === 0) return;
          const percentage = ((current / max) * 100).toFixed(1) + '%';
          const percentageEl = document.createElement('div');
          percentageEl.className = 'progress-percentage';
          percentageEl.style.cssText = 'text-align:right;font-size:14px;font-weight:600;color:#b0c0d4;padding-right:2px;margin-bottom:4px;text-shadow:0 0 10px rgba(0,0,0,0.5)';
          percentageEl.textContent = percentage;
          const progressTop = progressContainer.querySelector('.progress-top');
          if (progressTop) {
            progressContainer.insertBefore(percentageEl, progressTop);
          } else {
            const progressLine = progressContainer.querySelector('.progress-line');
            if (progressLine) {
              progressContainer.insertBefore(percentageEl, progressLine);
            } else {
              progressContainer.prepend(percentageEl);
            }
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

        function resetBgPageState() {
          hasFetchedForCurrentPage = false;
          currentProfileIdentifier = null;
          currentFetchPromise = null;
        }

        function addHideFullServersDropdown() {
          const filtersContainer = document.querySelector('.filters[data-v-6b4c78b6]');
          if (!filtersContainer) {
            setTimeout(addHideFullServersDropdown, 1000);
            return;
          }

          if (filtersContainer.querySelector('.filter-rarity:last-child input[value="true"]')) {
            updateDropdownState(filtersContainer);
            return;
          }

          const dropdownHTML = \`<div data-v-6b4c78b6="" class="filter-rarity">
            <div data-v-6f41210a="" data-v-6b4c78b6="" class="wrapper-input select" value="true,false">
              <div data-v-6f41210a="" tabindex="0" class="input">
                <div data-v-6f41210a="" class="selected">Hide Full</div>
                <div data-v-6f41210a="" class="items" style="display:none;">
                  <label data-v-730c0c40="" data-v-6f41210a="" class="custom-checkbox mode-checkbox" value="false">
                    <input data-v-730c0c40="" type="checkbox" value="false">
                    <span data-v-730c0c40="">False</span>
                  </label>
                  <label data-v-730c0c40="" data-v-6f41210a="" class="custom-checkbox mode-checkbox" value="true">
                    <input data-v-730c0c40="" type="checkbox" value="true">
                    <span data-v-730c0c40="">True</span>
                  </label>
                </div>
              </div>
            </div>
          </div>\`;

          filtersContainer.insertAdjacentHTML('beforeend', dropdownHTML);

          const dropdown = filtersContainer.lastElementChild;
          const inputDiv = dropdown.querySelector('.input');
          const itemsDiv = dropdown.querySelector('.items');
          const selectedDiv = dropdown.querySelector('.selected');
          const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');

          if (!document.getElementById('hide-full-servers-style')) {
            const styleElement = document.createElement('style');
            styleElement.id = 'hide-full-servers-style';
            styleElement.textContent = \`
                .server.is-locked.is-ranked,
                .server.is-locked {
                    display: none !important;
                }
            \`;
            document.head.appendChild(styleElement);
          }

          function toggleFullServers(hideFull) {
            const style = document.getElementById('hide-full-servers-style');
            if (style) {
              style.disabled = !hideFull;
            }
            localStorage.setItem('hideFullServers', hideFull ? 'true' : 'false');
          }

          function updateDropdownState(container) {
            const savedPreference = localStorage.getItem('hideFullServers');
            const value = savedPreference !== null ? savedPreference === 'true' : false;
            
            const dropdownContainer = container.querySelector('.filter-rarity:last-child');
            if (dropdownContainer) {
              const checkboxes = dropdownContainer.querySelectorAll('input[type="checkbox"]');
              const selectedDiv = dropdownContainer.querySelector('.selected');
              
              checkboxes.forEach(cb => {
                const isTrue = cb.value === 'true';
                cb.checked = (isTrue === value);
              });
              
              if (selectedDiv) {
                selectedDiv.textContent = value ? 'True' : 'False';
              }
              
              const style = document.getElementById('hide-full-servers-style');
              if (style) {
                style.disabled = !value;
              }
            }
          }

          const savedPreference = localStorage.getItem('hideFullServers');
          const currentValue = savedPreference !== null ? savedPreference === 'true' : false;

          checkboxes.forEach(cb => {
            const isTrue = cb.value === 'true';
            cb.checked = (isTrue === currentValue);
          });

          selectedDiv.textContent = currentValue ? 'True' : 'False';

          const style = document.getElementById('hide-full-servers-style');
          if (style) {
            style.disabled = !currentValue;
          }

          inputDiv.addEventListener('click', function(e) {
            e.stopPropagation();
            const isOpen = itemsDiv.style.display !== 'none';
            itemsDiv.style.display = isOpen ? 'none' : 'block';
          });

          checkboxes.forEach(cb => {
            cb.addEventListener('change', function(e) {
              e.stopPropagation();
              if (this.checked) {
                checkboxes.forEach(other => {
                  if (other !== this) {
                    other.checked = false;
                  }
                });
                const value = this.value === 'true';
                selectedDiv.textContent = this.value.charAt(0).toUpperCase() + this.value.slice(1);
                localStorage.setItem('hideFullServers', this.value);
                
                const style = document.getElementById('hide-full-servers-style');
                if (style) {
                  style.disabled = !value;
                }
                itemsDiv.style.display = 'none';
              } else {
                this.checked = true;
              }
            });
          });

          document.addEventListener('click', function(e) {
            if (!dropdown.contains(e.target)) {
              itemsDiv.style.display = 'none';
            }
          });
        }

        async function initBackgrounds() {
          console.log('[Background] Initializing - Preloading images to prevent flashing');
          await loadBadgeMappings();
          await fetchAllUsersBanners();
          await new Promise(resolve => setTimeout(resolve, 500));
          await scanAndApplyBackgrounds();
          
          if (scanInterval) clearInterval(scanInterval);
          scanInterval = setInterval(() => {
            if (isUserCardVisible() || isPlayerListVisible()) {
              scanAndApplyBackgrounds();
            }
          }, 5000);
        }

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
              addHideFullServersDropdown();
              initCountdown();
              addPercentageAboveProgress();
              addProfileButtons();
              replaceStatusDots();
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
            addHideFullServersDropdown();
            initCountdown();
            addPercentageAboveProgress();
            addProfileButtons();
            replaceStatusDots();
          }, 100);
        };
        
        window.addEventListener('popstate', () => {
          resetBgPageState();
          setTimeout(() => {
            checkAndRedirectCustomId();
            scanAndApplyBackgrounds();
            addHideFullServersDropdown();
            initCountdown();
            addPercentageAboveProgress();
            addProfileButtons();
            replaceStatusDots();
          }, 100);
        });
        
        const domObserver = new MutationObserver(() => {
          if (isProcessingMutation) return;
          isProcessingMutation = true;
          
          try {
            if (document.querySelector('#user-card') || document.querySelector('.player-list') || 
                document.querySelector('.team-players-state') || document.querySelector('.friends-list')) {
              scanAndApplyBackgrounds();
            }
            if (document.querySelector('.filters')) {
              addHideFullServersDropdown();
            }
            if (document.querySelector('.card-cont.user-info .progress-lvl')) {
              addPercentageAboveProgress();
            }
            if (document.querySelector('.online-dot')) {
              replaceStatusDots();
            }
          } finally {
            setTimeout(() => {
              isProcessingMutation = false;
            }, 100);
          }
        });
        domObserver.observe(document.body, { childList: true, subtree: true });

        watchUserNotFoundAlerts();
        patchFetchForCustomIds();
        fetchCustomIdMappings();
        initBackgrounds();
        
        setupStatusDotObserver();
        
        setTimeout(() => {
          checkAndRedirectCustomId();
          if (isUserCardVisible() || isPlayerListVisible()) scanAndApplyBackgrounds();
          addHideFullServersDropdown();
          initCountdown();
          addPercentageAboveProgress();
          addProfileButtons();
          replaceStatusDots();
        }, 500);

        // --- Score Element Functionality ---
        function findKillDeathContainer() {
          let container = document.querySelector('.kill-death');
          if (container) return container;
          
          const allDivs = document.querySelectorAll('div[class*="kill"], div[class*="death"]');
          for (const div of allDivs) {
            if (div.textContent.includes('kill') || div.textContent.includes('death')) {
              const children = div.querySelectorAll('div');
              if (children.length >= 2) {
                return div;
              }
            }
          }
          
          const stateCont = document.querySelector('.state-cont');
          if (stateCont) {
            const possibleContainer = stateCont.querySelector('[class*="kill"], [class*="death"]');
            if (possibleContainer) {
              const parent = possibleContainer.closest('div[class*="kill-death"]');
              if (parent) return parent;
              const killChildren = stateCont.querySelectorAll('div');
              if (killChildren.length >= 2) {
                return stateCont;
              }
            }
          }
          
          return null;
        }

        function addScoreElement() {
          const killDeath = findKillDeathContainer();
          if (!killDeath) {
            return;
          }
          
          if (killDeath.querySelector('.score')) {
            return;
          }
          
          let userData = null;
          let userShortId = 'NUGGET';
          
          try {
            const storedData = localStorage.getItem('current-user');
            if (storedData) {
              userData = JSON.parse(storedData);
              if (userData && userData.wMwmWnNW) {
                userShortId = userData.wMwmWnNW;
              }
            }
          } catch (e) {}
          
          function getCurrentUserScore() {
            let playerList = document.querySelector('.player-list');
            if (!playerList) {
              const possibleLists = document.querySelectorAll('[class*="player"], [class*="list"]');
              for (const list of possibleLists) {
                if (list.querySelector('.player-cont') || list.querySelector('[class*="player-cont"]')) {
                  playerList = list;
                  break;
                }
              }
            }
            
            if (!playerList) return 0;
            
            const playerContainers = playerList.querySelectorAll('.player-cont, [class*="player-cont"]');
            
            for (const container of playerContainers) {
              let shortIdElement = container.querySelector('.short-id, [class*="short-id"]');
              if (shortIdElement) {
                let shortId = shortIdElement.textContent.trim().replace('#', '');
                if (shortId === userShortId) {
                  const playerRight = container.querySelector('.player-right, [class*="player-right"]');
                  if (playerRight) {
                    const values = playerRight.querySelectorAll('.player-value, [class*="player-value"]');
                    if (values.length >= 3) {
                      const score = parseInt(values[2].textContent.trim()) || 0;
                      return score;
                    }
                  }
                }
              }
            }
            
            return 0;
          }
          
          const existingKill = killDeath.querySelector('.kill');
          const existingDeath = killDeath.querySelector('.WnwNmWwM');
          
          const scoreDiv = document.createElement('div');
          
          if (existingKill) {
            Array.from(existingKill.attributes).forEach(attr => {
              if (attr.name.startsWith('data-')) {
                scoreDiv.setAttribute(attr.name, attr.value);
              }
            });
          }
          
          scoreDiv.className = 'score bg text-1';
          
          const scoreText = document.createTextNode(' 0 ');
          
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
          svg.setAttribute('viewBox', '0 0 16 16');
          svg.setAttribute('width', '18');
          svg.setAttribute('height', '18');
          svg.setAttribute('class', 'icon svg-icon');
          svg.style.cssText = 'display: inline-block; vertical-align: middle;';
          
          const killSvg = existingKill ? existingKill.querySelector('svg') : null;
          if (killSvg) {
            Array.from(killSvg.attributes).forEach(attr => {
              if (attr.name.startsWith('data-')) {
                svg.setAttribute(attr.name, attr.value);
              }
            });
          }
          
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', 'M12.44 9.74a.825.825 0 0 0-.24.727l.667 3.69a.81.81 0 0 1-.338.81.826.826 0 0 1-.877.06L8.33 13.296a.847.847 0 0 0-.375-.098h-.203a.609.609 0 0 0-.203.067l-3.322 1.741c-.165.082-.35.112-.533.082a.834.834 0 0 1-.667-.953l.667-3.69a.84.84 0 0 0-.24-.734L.748 7.085a.81.81 0 0 1-.202-.848.842.842 0 0 1 .667-.562l3.727-.54a.834.834 0 0 0 .66-.457L7.242 1.31a.78.78 0 0 1 .15-.203l.067-.052a.503.503 0 0 1 .12-.097l.083-.03.127-.053h.316c.282.03.53.198.66.45l1.664 3.353c.12.245.353.415.623.456l3.727.541a.85.85 0 0 1 .683.563c.098.3.013.63-.218.847L12.44 9.74z');
          path.setAttribute('fill', '#FFB914');
          svg.appendChild(path);
          
          scoreDiv.appendChild(scoreText);
          scoreDiv.appendChild(svg);
          
          if (existingDeath) {
            killDeath.insertBefore(scoreDiv, existingDeath.nextSibling);
          } else if (existingKill) {
            killDeath.insertBefore(scoreDiv, existingKill.nextSibling);
          } else {
            killDeath.appendChild(scoreDiv);
          }
          
          function updateScore() {
            const currentScore = getCurrentUserScore();
            if (scoreDiv.firstChild) {
              scoreDiv.firstChild.textContent = ' ' + currentScore + ' ';
            }
          }
          
          setTimeout(updateScore, 1000);
          const scoreInterval = setInterval(updateScore, 2000);
          
          const scoreObserver = new MutationObserver(function() {
            updateScore();
          });
          
          const playerList = document.querySelector('.player-list, [class*="player-list"]');
          if (playerList) {
            scoreObserver.observe(playerList, {
              childList: true,
              subtree: true,
              characterData: true
            });
          } else {
            scoreObserver.observe(document.body, {
              childList: true,
              subtree: true,
              characterData: true
            });
          }
          
          window.__scoreInterval = scoreInterval;
          window.__scoreObserver = scoreObserver;
          
          console.log('[Score] Score element added successfully');
        }

        const scoreObserver = new MutationObserver(() => {
          if (document.querySelector('.kill-death') && !document.querySelector('.score')) {
            addScoreElement();
          }
        });
        scoreObserver.observe(document.body, { childList: true, subtree: true });
        
        setTimeout(addScoreElement, 1500);
        
        console.log('[GameFeatures] All systems initialized');
      })();
    `;
  };

  // Lobby Badges script - unchanged
  const lobbyBadgesScript = () => {
    return `
      (function() {
        if (window.__lobbyBadgesInstalled) return;
        window.__lobbyBadgesInstalled = true;

        let customizations = null;
        let isProcessingLobbyMutation = false;

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
            if (friend.dataset.customized === 'true') return;
            
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
            
            if (customs.gradient) { 
              applyGradient(nickname, customs.gradient, customs.animated); 
              nickname.style.maxWidth = 'min-content'; 
            }
            
            let badgesElem = nickname.querySelector('.kirka-badges');
            if (badgesElem?.dataset.shortId === shortId) return;
            
            if (badgesElem) badgesElem.remove();
            
            badgesElem = document.createElement('div');
            badgesElem.className = 'kirka-badges';
            badgesElem.dataset.shortId = shortId;
            badgesElem.style.cssText = 'display: flex; gap: 0.25rem; align-items: center; width: 0;';
            nickname.appendChild(badgesElem);
            populateBadges(badgesElem, customs, '18px');
            
            friend.dataset.customized = 'true';
          });
        }

        function run() {
          applyLobbyCustomizations();
          applyFriendsCustomizations();
        }

        fetchCustomizations().then(() => {
          run();
          
          const observer = new MutationObserver(() => {
            if (isProcessingLobbyMutation) return;
            isProcessingLobbyMutation = true;
            
            if (document.querySelector('.friends-list') || document.querySelector('.team-section')) {
              run();
            }
            
            setTimeout(() => {
              isProcessingLobbyMutation = false;
            }, 100);
          });
          
          observer.observe(document.body, { 
            childList: true, 
            subtree: true,
            attributes: false
          });
        });

        console.log('[LobbyBadges] Initialized');
      })();
    `;
  };

  // Kirka Badges (Profile Badges) - unchanged
  const kirkaBadgesScript = () => {
    return `
      (function() {
        console.log('[BADGES] Script started');
        
        const BADGE_API_URL = "https://raw.githubusercontent.com/OBS-Akuma/KirkaBadges/refs/heads/main/Json/bottombadges.json";

        const TOOLTIP_ID = "ktiers-badge-tooltip";
        const BADGE_WIDTH = 88;
        const BADGE_HEIGHT = 40;
        const GAP = 6;

        let currentBadges = [];
        let currentUserId = null;
        let isInitialized = false;
        let observer = null;
        let profileObserver = null;

        function getScopedProfile() {
          const profile = document.querySelector('.profile[data-v-e5a0c932]');
          if (profile) return profile;
          
          const container = document.querySelector('[data-v-e5a0c932]');
          if (container) {
            return container.querySelector('.profile');
          }
          
          return null;
        }

        function extractUserId() {
          const idElement = document.querySelector('.copy-cont .value');
          if (!idElement) return null;
          
          const fullId = idElement.textContent.trim();
          return fullId.startsWith('#') ? fullId.substring(1) : fullId;
        }

        function createTooltip() {
          const existing = document.getElementById(TOOLTIP_ID);
          if (existing) existing.remove();

          const tooltip = document.createElement("div");
          tooltip.id = TOOLTIP_ID;
          document.body.appendChild(tooltip);
          return tooltip;
        }

        function injectStyles() {
          if (document.getElementById("ktiers-badge-styles")) return;
          const style = document.createElement("style");
          style.id = "ktiers-badge-styles";
          style.textContent = \`
            #\${TOOLTIP_ID} {
              position: fixed;
              z-index: 1000000;
              background: rgba(20, 20, 20, 0.95);
              color: #fff;
              padding: 6px 10px;
              border-radius: 4px;
              font-size: 12px;
              font-family: inherit;
              line-height: 1.4;
              pointer-events: none;
              opacity: 0;
              transform: translateY(4px);
              transition: opacity 0.12s ease, transform 0.12s ease;
              white-space: nowrap;
              box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            }
            #\${TOOLTIP_ID}.visible {
              opacity: 1;
              transform: translateY(0);
            }
            #\${TOOLTIP_ID} .badge-date {
              font-size: 10px;
              color: #aaa;
              margin-top: 2px;
            }
          \`;
          document.head.appendChild(style);
        }

        function setupTooltipEvents(el, title, date) {
          const tooltip = document.getElementById(TOOLTIP_ID);
          if (!tooltip) return;

          let timeoutId = null;

          function showTooltip(target) {
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            tooltip.innerHTML = \`<div>\${title}</div>\${
              date ? \`<div class="badge-date">\${date}</div>\` : ""
            }\`;
            const rect = target.getBoundingClientRect();
            tooltip.style.left = \`\${rect.left}px\`;
            tooltip.style.top = \`\${rect.top - tooltip.offsetHeight - 8}px\`;
            tooltip.classList.add("visible");
          }

          function moveTooltip(target) {
            if (!tooltip.classList.contains("visible")) return;
            const rect = target.getBoundingClientRect();
            tooltip.style.left = \`\${rect.left}px\`;
            tooltip.style.top = \`\${rect.top - tooltip.offsetHeight - 8}px\`;
          }

          function hideTooltip() {
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            timeoutId = setTimeout(() => {
              tooltip.classList.remove("visible");
              timeoutId = null;
            }, 100);
          }

          el.addEventListener("mouseenter", () => showTooltip(el));
          el.addEventListener("mousemove", () => moveTooltip(el));
          el.addEventListener("mouseleave", hideTooltip);
        }

        function renderBadges(badges) {
          const profile = getScopedProfile();
          if (!profile) {
            console.log('[BADGES] Profile not found, cannot render');
            return false;
          }

          const rect = profile.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) {
            console.log('[BADGES] Profile is hidden, skipping render');
            return false;
          }

          const existing = profile.querySelectorAll('img[id$="-badge"]');
          existing.forEach(el => el.remove());

          if (getComputedStyle(profile).position === "static") {
            profile.style.position = "relative";
          }

          if (badges.length === 0) return true;

          badges.forEach((badge, index) => {
            const el = document.createElement("img");
            el.id = badge.id;
            el.src = badge.img;
            el.alt = badge.title;
            el.width = BADGE_WIDTH;
            el.height = BADGE_HEIGHT;

            Object.assign(el.style, {
              position: "absolute",
              bottom: "8px",
              left: \`\${8 + index * (BADGE_WIDTH + GAP)}px\`,
              width: \`\${BADGE_WIDTH}px\`,
              height: \`\${BADGE_HEIGHT}px\`,
              zIndex: "999999",
              cursor: "pointer",
              borderRadius: "4px",
            });

            setupTooltipEvents(el, badge.title, badge.date);
            profile.appendChild(el);
          });
          
          console.log('[BADGES] Rendered', badges.length, 'badges');
          return true;
        }

        function loadBadges(force = false) {
          const userId = extractUserId();
          if (!userId) {
            console.log('[BADGES] No user ID found');
            return;
          }

          if (!force && currentUserId === userId && currentBadges.length > 0) {
            console.log('[BADGES] Using cached badges for user:', userId);
            renderBadges(currentBadges);
            return;
          }

          console.log('[BADGES] Loading badges for user:', userId);
          currentUserId = userId;

          fetch(BADGE_API_URL)
            .then((res) => {
              if (!res.ok) throw new Error(\`HTTP error! status: \${res.status}\`);
              return res.json();
            })
            .then((data) => {
              if (!Array.isArray(data)) return;
              
              const userBadges = data.filter((item) => {
                if (!item.uuid) return false;
                const itemUuid = String(item.uuid).replace(/^#/, '').trim();
                return itemUuid === userId;
              });
              
              console.log('[BADGES] Found', userBadges.length, 'badges for user', userId);
              currentBadges = userBadges;
              isInitialized = true;
              renderBadges(userBadges);
            })
            .catch((err) => {
              console.error("[BADGES] Failed to load badges:", err);
            });
        }

        function checkAndRender() {
          const profile = getScopedProfile();
          if (!profile) return;
          
          const rect = profile.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return;
          
          const currentUserId = extractUserId();
          if (!currentUserId) return;
          
          const hasBadges = profile.querySelectorAll('img[id$="-badge"]').length > 0;
          const isSameUser = currentUserId === currentUserId;
          
          if (!hasBadges || currentUserId !== currentUserId) {
            console.log('[BADGES] User changed or badges missing, reloading...');
            loadBadges(true);
          }
        }

        function setupObservers() {
          const targetNode = document.querySelector('.container-card') || document.body;
          
          if (profileObserver) {
            profileObserver.disconnect();
          }

          profileObserver = new MutationObserver((mutations) => {
            let shouldCheck = false;
            
            for (const mutation of mutations) {
              if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                  if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.matches && node.matches('.profile[data-v-e5a0c932]')) {
                      shouldCheck = true;
                      break;
                    }
                    if (node.querySelector && node.querySelector('.profile[data-v-e5a0c932]')) {
                      shouldCheck = true;
                      break;
                    }
                  }
                }
              }
              
              if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const target = mutation.target;
                if (target.matches && target.matches('.profile[data-v-e5a0c932]')) {
                  shouldCheck = true;
                }
              }

              if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                  if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.querySelector && node.querySelector('.copy-cont .value')) {
                      shouldCheck = true;
                      break;
                    }
                  }
                }
              }
            }
            
            if (shouldCheck) {
              console.log('[BADGES] Profile change detected');
              setTimeout(checkAndRender, 300);
            }
          });

          profileObserver.observe(targetNode, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
          });

          console.log('[BADGES] Observers set up');
        }

        function init() {
          console.log('[BADGES] Initializing...');
          
          injectStyles();
          createTooltip();
          
          loadBadges();
          
          setupObservers();

          document.addEventListener("visibilitychange", () => {
            if (!document.hidden) {
              setTimeout(checkAndRender, 300);
            }
          });

          window.addEventListener('popstate', () => {
            console.log('[BADGES] Navigation detected');
            setTimeout(() => {
              currentUserId = null;
              currentBadges = [];
              loadBadges(true);
            }, 500);
          });

          window.addEventListener('hashchange', () => {
            console.log('[BADGES] Hash change detected');
            setTimeout(() => {
              currentUserId = null;
              currentBadges = [];
              loadBadges(true);
            }, 300);
          });

          setInterval(checkAndRender, 3000);

          console.log('[BADGES] Initialization complete');
        }

        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", () => {
            setTimeout(init, 200);
          });
        } else {
          setTimeout(init, 200);
        }

        setTimeout(() => {
          if (!isInitialized) {
            console.log('[BADGES] Delayed initialization');
            init();
          }
        }, 2000);

        console.log('[BADGES] Script loaded');
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

    gameWindowRef.webContents.executeJavaScript(kirkaBadgesScript())
      .then(() => console.log('[KirkaBadges] Injected successfully'))
      .catch((err) => console.error('[KirkaBadges] Injection failed:', err));
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