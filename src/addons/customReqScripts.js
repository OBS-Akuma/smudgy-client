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

  async function marketUsers() {
    const itemElements = document.getElementsByClassName("item-name");

    let count = 0;
    for (let i = 0; i < itemElements.length; i++) {
      let sellerId = ids[i];

      try {
        await new Promise((resolve) => setTimeout(resolve, 200));

        let fetchreq = await fetch(`https://api.kirka.io/api/user/getProfile`, {
          headers: {
            accept: "application/json, text/plain, */*",
            "content-type": "application/json;charset=UTF-8",
            Referer: base_url,
            "Referrer-Policy": "strict-origin-when-cross-origin",
          },
          body: `{"id":"${sellerId}"}`,
          method: "POST",
        });
        fetchreq = await fetchreq.json();
        if (fetchreq["shortId"]) {
          count++;
          if (count >= itemElements.length) {
            updating = false;
          }
          itemElements[i].innerText = itemElements[i].innerText.split(" - ")[0];
          itemElements[
            i
          ].innerText += ` - ${fetchreq["name"]}#${fetchreq["shortId"]}`;
        }
      } catch {
        count++;
        if (count === itemElements.length) {
          updating = false;
        }
      }
    }
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
    if (window.location.href === `${base_url}inventory` && custom_list_price) {
      const sellElem = document.querySelector(".cont-sell");
      if (sellElem && !document.getElementById("juice-custom-listing") && sellElem.parentElement.parentElement.id !== "sell-item-modal") {
        sellElem.children[1].after(inputElem);
      }
    }

    if (
      window.location.href === `${base_url}hub/market` &&
      document.getElementsByClassName("subjects").length === 2 &&
      !document
        .getElementsByClassName("item-name")[0]
        ?.innerText.includes(" - ") &&
      !updating &&
      ids.length > 0 &&
      market_names
    ) {
      marketUsers();
      updating = true;
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
};

module.exports = { customReqScripts };