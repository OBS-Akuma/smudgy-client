// from CarrySheriff!

const customReqScripts = (settings) => {
  const originalXHR = window.XMLHttpRequest;
  const { base_url, custom_list_price, market_names } = settings;
  let ids = [];
  let newprice;
  let updating = false;

  window.XMLHttpRequest = function () {
    const xhr = new originalXHR();
    let requestUrl = "";

    xhr.open = function (method, url, ...args) {
      requestUrl = url;
      originalXHR.prototype.open.apply(this, [method, url, ...args]);
    };

    xhr.send = function (data) {
      if (
        requestUrl.includes(`api2.${base_url.replace("https://", "")}`) &&
        location.href === `${base_url}inventory` &&
        document.querySelector(".vm--container > .vm--modal > .wrapper-modal")?.id !== "sell-item-modal" &&
        data &&
        newprice &&
        custom_list_price
      ) {
        try {
          const json = JSON.parse(data);
          if (Object.keys(json).length === 2) {
            for (let key in json) {
              if (typeof json[key] === "number" && json[key] !== 0) {
                json[key] = newprice;
              }
            }
          }
          data = JSON.stringify(json);
        } catch { }
      }
      originalXHR.prototype.send.call(this, data);
    };

    return xhr;
  };

  // Function to get user profile with seller ID
  async function getUserProfile(sellerId, token) {
    try {
      const response = await fetch(`https://api2.kirka.io/api/wNmwWMWn/wWWnwmNM`, {
        headers: {
          accept: "application/json, text/plain, */*",
          "content-type": "application/json;charset=UTF-8",
          "Authorization": "Bearer " + token,
          "Referer": base_url,
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
        body: JSON.stringify({
          WwmMWw: sellerId
        }),
        method: "POST",
      });
      return await response.json();
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return null;
    }
  }

  async function marketUsers() {
    // Reset updating flag
    updating = true;
    
    const itemElements = document.getElementsByClassName("item-name");
    console.log("Found " + itemElements.length + " items on market");
    
    if (itemElements.length === 0) {
      console.log("No items found");
      updating = false;
      return;
    }

    // Get auth token from localStorage
    const token = localStorage.getItem('token');
    if (!token) {
      console.log("No auth token found");
      updating = false;
      return;
    }

    // Get all seller IDs from the first API
    try {
      const response = await fetch(`https://api2.kirka.io/api/wnWmNw`, {
        headers: {
          accept: "application/json, text/plain, */*",
          "content-type": "application/json;charset=UTF-8",
          "Authorization": "Bearer " + token,
          "Referer": base_url,
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
        body: JSON.stringify({
          wnWmwM: "",
          wnWmM: ""
        }),
        method: "POST",
      });
      
      const data = await response.json();
      
      if (!data || data.length === 0) {
        console.log("No user data received");
        updating = false;
        return;
      }

      // Create array of seller IDs
      const sellerIds = [];
      for (let i = 0; i < data.length && i < itemElements.length; i++) {
        if (data[i].wnWmN) {
          sellerIds.push(data[i].wnWmN);
        }
      }

      console.log("Processing " + sellerIds.length + " seller IDs");

      let count = 0;
      const batchSize = 9;
      const delayBetweenBatches = 1000;

      // Process in batches of 10
      for (let i = 0; i < sellerIds.length; i += batchSize) {
        const batch = sellerIds.slice(i, i + batchSize);
        
        // Process batch in parallel
        const promises = batch.map(async (sellerId, index) => {
          const itemIndex = i + index;
          if (itemIndex >= itemElements.length) return;

          try {
            await new Promise((resolve) => setTimeout(resolve, 200));

            const profile = await getUserProfile(sellerId, token);
            
            if (profile && profile.wNmnw && profile.wMWWm) {
              count++;
              // Only update if not already updated
              const currentText = itemElements[itemIndex].innerText;
              if (!currentText.includes('#')) {
                itemElements[itemIndex].innerText = itemElements[itemIndex].innerText.split(" - ")[0];
                itemElements[itemIndex].innerText += ` - ${profile.wNmnw}#${profile.wMWWm}`;
              }
            }
          } catch (error) {
            console.error("Error processing seller:", error);
            count++;
          }
        });

        await Promise.all(promises);
        
        // Delay between batches
        if (i + batchSize < sellerIds.length) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }

      console.log("Updated " + count + " items");

    } catch (error) {
      console.error("Error fetching seller data:", error);
    }
    
    updating = false;
  }

  const inputElem = Object.assign(document.createElement("input"), {
    id: "juice-custom-listing",
    type: "number",
    min: "0",
    placeholder: "Custom amount",
    onchange: (e) => (newprice = Number(e.target.value)),
  });

  Object.assign(inputElem.style, {
    marginTop: "-.5em",
    marginBottom: "1em",
    border: ".125rem solid #202639",
    background: "none",
    outline: "none",
    background: "#2f3957",
    width: "50%",
    height: "2.875rem",
    paddingLeft: ".5rem",
    boxSizing: "border-box",
    fontWeight: "600",
    fontSize: "1rem",
    color: "#f2f2f2",
    boxShadow: "0 1px 2px rgba(0,0,0,.4), inset 0 0 8px rgba(0,0,0,.4)",
    borderRadius: ".25rem",
  });

  const observer = new MutationObserver(() => {
    // Check for inventory page
    if (window.location.href === `${base_url}inventory` && custom_list_price) {
      const sellElem = document.querySelector(".cont-sell");
      if (sellElem && !document.getElementById("juice-custom-listing") && sellElem.parentElement.parentElement.id !== "sell-item-modal") {
        sellElem.children[1].after(inputElem);
      }
    }

    // Check for market page - more reliable conditions
    if (
      window.location.href === `${base_url}hub/market` &&
      market_names &&
      !updating
    ) {
      const items = document.getElementsByClassName("item-name");
      // Check if items exist and need updating (don't have # in them)
      if (items.length > 0 && !items[0]?.innerText.includes("#")) {
        console.log("Market page detected, updating names...");
        marketUsers();
      }
    }
  });

  // Start observing
  observer.observe(document.body, { childList: true, subtree: true });

  // Also run immediately when script loads
  setTimeout(() => {
    if (window.location.href === `${base_url}inventory` && custom_list_price) {
      const sellElem = document.querySelector(".cont-sell");
      if (sellElem && !document.getElementById("juice-custom-listing") && sellElem.parentElement.parentElement.id !== "sell-item-modal") {
        sellElem.children[1].after(inputElem);
      }
    }

    if (window.location.href === `${base_url}hub/market` && market_names && !updating) {
      const items = document.getElementsByClassName("item-name");
      if (items.length > 0 && !items[0]?.innerText.includes("#")) {
        console.log("Initial market check, updating names...");
        marketUsers();
      }
    }
  }, 2000);

  // Add a mutation observer for URL changes (SPA navigation)
  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      console.log("URL changed to:", location.href);
      
      // Check if we're on market page
      if (location.href === `${base_url}hub/market` && market_names && !updating) {
        const items = document.getElementsByClassName("item-name");
        if (items.length > 0 && !items[0]?.innerText.includes("#")) {
          console.log("URL changed to market, updating names...");
          setTimeout(marketUsers, 1000);
        }
      }
    }
  });
  urlObserver.observe(document, { subtree: true, childList: true });
};

module.exports = { customReqScripts };