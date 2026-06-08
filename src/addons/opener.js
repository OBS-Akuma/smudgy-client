let git_base = "Cheeseybowrger";
const opener_list = "https://raw.githubusercontent.com/zVipexx/dawn-client/refs/heads/main/openerlist.json";

async function fetchOpenerList() {
  const res = await fetch(opener_list);
  if (!res.ok) {
    throw new Error("Failed to fetch opener list");
  }
  return await res.json();
}

async function addOpenerList() {
  const select = document.getElementById("opener");
  if (!select) return;

  select.innerHTML = `<option value="none">None</option>`;

  const data = await fetchOpenerList();
  console.log("finished fetching " + data);

  data.chests.forEach((chest) => {
    const opt = document.createElement("option");
    opt.value = `Chest_${chest.name}`;
    opt.textContent = chest.name;
    select.appendChild(opt);
  });

  const allChests = document.createElement("option");
  allChests.value = "Chest_All";
  allChests.textContent = "All Chests";
  select.appendChild(allChests);

  data.cards.forEach((card) => {
    const opt = document.createElement("option");
    opt.value = `Card_${card.name.replace(/\s+/g, "")}`;
    opt.textContent = card.name;
    select.appendChild(opt);
  });

  const allCards = document.createElement("option");
  allCards.value = "Card_All";
  allCards.textContent = "All Cards";
  select.appendChild(allCards);
}

document.addEventListener("DOMContentLoaded", () => {
  addOpenerList();
});
// Helper function to execute card opening script
async function executeCardScript(customcardlist) {
  let openingdelay = 2000;
  let cards;
  try {
    cards = customcardlist;
  } catch {
    cards = [
      { cardid: "723c4ba7-57b3-4ae4-b65e-75686fa77bf2", name: "Cold" },
      { cardid: "723c4ba7-57b3-4ae4-b65e-75686fa77bf1", name: "Girls band" },
      { cardid: "6281ed5a-663a-45e1-9772-962c95aa4605", name: "Party" },
      { cardid: "9cc5bd60-806f-4818-a7d4-1ba9b32bd96c", name: "Soldiers" },
      { cardid: "a5002827-97d1-4eb4-b893-af4047e0c77f", name: "Periodic" },
    ];
  }

  let coloroutput = {
    PARANORMAL: "000000",
    MYTHICAL: "c20025",
    LEGENDARY: "feaa37",
    EPIC: "cd2afc",
    RARE: "43abde",
    COMMON: "47f2a0",
    DEFAULT: "ffffff",
  };

  let translations_req = await fetch(
    `https://raw.githubusercontent.com/${git_base}/KirkaScripts/refs/heads/main/ConsoleScripts/microwaves.json`,
  );
  let translations = await translations_req.json();

  //This Part reverses my translations
  Object.keys(translations).forEach((item) => {
    let translationItem = translations[item];
    translations[translationItem] = item;
  });

  //This code logs credits
  function logCredits() {
    console.log(
      "%cMade by carrysheriff/SheriffCarry discord: @carrysheriff",
      "color: #000000;background-color: #FFFFFF;font-size: large;",
    );
    console.log(
      "If you only want a specific card to be opened, just delete the card from the array at the top of the script",
    );
    console.log(
      `https://github.com/${git_base}/KirkaScripts/blob/main/ConsoleScripts/OpenAllCards_live_updating.js this code is live updatin`,
    );
  }

  //This code fetches and returns the inventory
  async function fetchInventory() {
    let response = await fetch(
      `https://api2.kirka.io/api/${translations["inventory"]}`,
      {
        headers: {
          accept: "application/json",
          authorization: `Bearer ${localStorage.token}`,
        },
      },
    );
    let json = await response.json();
    return json;
  }

  let bvl = [];

  async function setBVL() {
    let response = await fetch(
      "https://opensheet.elk.sh/1tzHjKpu2gYlHoCePjp6bFbKBGvZpwDjiRzT9ZUfNwbY/Alphabetical",
    );
    bvl = await response.json();
    return;
  }

  function rarity_backup(spreadsheet, namefield, rarityfield, skinname) {
    let found = false;
    let rarity = "Unknown-Rarity";
    spreadsheet.forEach((listitem) => {
      if (listitem && listitem[namefield] && listitem[rarityfield]) {
        if (
          found == false &&
          listitem[namefield] == skinname &&
          Object.keys(coloroutput).includes(listitem[rarityfield].toUpperCase())
        ) {
          found = true;
          rarity = listitem[rarityfield];
        }
      }
    });
    return rarity;
  }

  //this code opens cards
  async function openCard(cardid) {
    let bodyobj = {};
    bodyobj[translations["id"]] = cardid;
    const response = await fetch(
      `https://api2.kirka.io/api/${translations["inventory"]}/${translations["openCharacterCard"]}`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${localStorage.token}`,
          "content-type": "application/json;charset=UTF-8",
        },
        body: JSON.stringify(bodyobj),
      },
    );
    let json = await response.json();
    let returnobj = {};
    Array.from(json).forEach((item) => {
      Object.keys(item).forEach((key) => {
        if (typeof item[key] == "boolean" && item[key] == true) {
          returnobj = item;
        }
      });
    });
    return returnobj;
  }

  function ingameShowcase_messages(message, displaylength) {
    let elem = document.createElement("div");
    elem.classList = "vue-notification-wrapper";
    elem.style =
      "transition-timing-function: ease; transition-delay: 0s; transition-property: all;";
    elem.innerHTML = `<div data-v-3462d80a="" data-v-460e7e47="" class="alert-default"><span data-v-3462d80a="" class="text">${message}</span></div>`;
    elem.onclick = function () {
      try {
        elem.remove();
      } catch { }
    };
    document
      .getElementsByClassName("vue-notification-group")[0]
      .children[0].appendChild(elem);
    setTimeout(() => {
      try {
        elem.remove();
      } catch { }
    }, displaylength);
  }

  function ingameShowcase_end() {
    let end_elem = document.createElement("div");
    end_elem.classList = "vue-notification-wrapper";
    end_elem.style =
      "transition-timing-function: ease; transition-delay: 0s; transition-property: all;";
    end_elem.innerHTML = `<div data-v-3462d80a="" data-v-460e7e47="" class="alert-default"><span data-v-3462d80a="" class="text">Finished running, check console for more details</span></div>`;
    end_elem.onclick = function () {
      try {
        end_elem.remove();
      } catch { }
    };
    document
      .getElementsByClassName("vue-notification-group")[0]
      .children[0].appendChild(end_elem);
    setTimeout(() => {
      try {
        end_elem.remove();
      } catch { }
    }, 15000);
  }

  //This code displays the result of the container ingame + in the console
  function ingameShowcase(message, rarity, name) {
    rarity = translations[rarity];

    if (rarity == undefined) {
      rarity = rarity_backup(bvl, "Skin Name", "Rarity", name);
    }
    const text = `${rarity} ${message} from: ${name}`;
    const style = `color: #${coloroutput[rarity.toUpperCase()] || coloroutput.DEFAULT
      }`;
    console.log(`%c${text}`, style);

    const elem = document.createElement("div");
    elem.classList.add("vue-notification-wrapper");
    elem.style =
      "transition-timing-function: ease; transition-delay: 0s; transition-property: all;";
    elem.innerHTML = `<div data-v-3462d80a="" data-v-460e7e47="" class="alert-default"><span data-v-3462d80a="" class="text" style="color:#${coloroutput[rarity.toUpperCase()] || coloroutput.DEFAULT
      }">${text}</span></div>`;
    elem.onclick = function () {
      try {
        elem.remove();
      } catch { }
    };
    document
      .getElementsByClassName("vue-notification-group")[0]
      .children[0].appendChild(elem);

    setTimeout(() => {
      try {
        elem.remove();
      } catch { }
    }, 5000);
  }

  //This code is for an animation for a specific rarity
  function confettiAnimation() {
    const duration = 15 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = {
      startVelocity: 30,
      spread: 360,
      ticks: 60,
      zIndex: 0,
    };

    function randomInRange(min, max) {
      return Math.random() * (max - min) + min;
    }

    const intervalconfetti = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(intervalconfetti);
        return;
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        zIndex: 99999,
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        zIndex: 99999,
      });
    }, 250);
  }

  //This one handles updatign the counter variable
  function updateCounter(counter, cardskipper) {
    counter = (counter + 1) % cards.length;
    while (cardskipper[counter] >= 2) {
      counter = (counter + 1) % cards.length;

      let check = cardskipper.reduce((acc, val) => acc + val, 0);
      if (check == cardskipper.length * 2) {
        counter = 0;
        break;
      }
    }
    return counter;
  }

  function automatic_microwaves(inventory) {
    //item in the inventory request
    inventory.forEach((item) => {
      Object.keys(item).forEach((key) => {
        if (typeof item[key] == "object") {
          translations["item"] = key;
        }
      });
    });
    //name in the inventory request
    inventory.forEach((item) => {
      Object.keys(item[translations["item"]]).forEach((key) => {
        if (
          (typeof item[translations["item"]][key] == "string" &&
            item[translations["item"]][key] == "Elizabeth") ||
          item[translations["item"]][key] == "James"
        ) {
          translations["name"] = key;
        }
      });
    });
    //id in the inventory request
    inventory.forEach((item) => {
      Object.keys(item[translations["item"]]).forEach((key) => {
        if (
          (typeof item[translations["item"]][key] == "string" &&
            item[translations["item"]][key] ==
            "a1055b22-18ca-4cb9-8b39-e46bb0151185") ||
          item[translations["item"]][key] ==
          "6be53225-952a-45d7-a862-d69290e4348e"
        ) {
          translations["id"] = key;
        }
      });
    });
  }

  //This processes my cardskipper variable
  function processCardskipper(cardskipper, inventory) {
    try {
      inventory.forEach((item) => {
        for (let i = 0; i < cards.length; i++) {
          if (
            item[translations["item"]][translations["id"]] == cards[i]["cardid"]
          ) {
            cardskipper[i] = 0;
          }
        }
      });
      return cardskipper;
    } catch {
      ingameShowcase_messages("Kirka microwave issue", 15000);
      return cardskipper;
    }
  }

  function logSummary(itemsByRarity, colorMap) {
    console.log(
      "%c--- Summary ---",
      "color: #FFFFFF; background-color: #000000; font-weight: bold; font-size: 1.2em; padding: 2px;",
    );

    const rarityOrder = [
      "PARANORMAL",
      "MYTHICAL",
      "LEGENDARY",
      "EPIC",
      "RARE",
      "COMMON",
    ];

    const sortedRarities = Object.keys(itemsByRarity).sort((a, b) => {
      const indexA = rarityOrder.indexOf(a);
      const indexB = rarityOrder.indexOf(b);

      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    for (const rarity of sortedRarities) {
      const items = itemsByRarity[rarity];
      if (!items || items.length === 0) continue;

      const itemCounts = items.reduce((acc, item) => {
        acc[item] = (acc[item] || 0) + 1;
        return acc;
      }, {});

      const itemsString = Object.entries(itemCounts)
        .map(([name, count]) => `${name} x${count}`)
        .join(", ");

      const totalCount = items.length;
      const color = colorMap[rarity] || colorMap.DEFAULT;
      const logText = `${totalCount}x ${rarity}: ${itemsString}`;

      console.log(`%c${logText}`, `color: #${color}; font-weight: bold;`);
    }
  }

  let cardskipper = new Array(cards.length).fill(2);
  try {
    cardskipper[0] = 0;
  } catch { }

  logCredits();
  if (!cards[0]) {
    return;
  }
  await setBVL();
  let inventory = await fetchInventory();
  automatic_microwaves(inventory);

  cardskipper = processCardskipper(cardskipper, inventory);

  if (!document.getElementById("konfettijs")) {
    let script = document.createElement("script");
    script.id = "konfettijs";
    script.src =
      "https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js";
    document.head.appendChild(script);
  }

  let openedItems = {};
  let counter = 0;
  let interval = setInterval(async () => {
    let cardresult = await openCard(cards[counter]["cardid"]);
    let resultName = cardresult[translations["name"]];
    let resultRarity = cardresult[translations["rarity"]];
    if (resultName) {
      ingameShowcase(resultName, resultRarity, cards[counter]["name"]);

      let translatedRarity = translations[resultRarity];
      if (translatedRarity == undefined) {
        translatedRarity = rarity_backup(
          bvl,
          "Skin Name",
          "Rarity",
          resultName,
        );
      }
      translatedRarity = translatedRarity.toUpperCase();

      if (!openedItems[translatedRarity]) {
        openedItems[translatedRarity] = [];
      }
      openedItems[translatedRarity].push(resultName);

      if (
        translations[resultRarity] == "MYTHICAL" ||
        translations[resultRarity] == "PARANORMAL"
      ) {
        confettiAnimation();
      }
    } else if (cardresult["code"] == 9910) {
      console.log("RATELIMIT");
    } else {
      cardskipper[counter]++;
      console.log("DON'T WORRY ABOUT THE ERROR");
      console.log("THE CHEST THAT IT TRIED TO OPEN IS NOT AVAILABLE ANYMORE");
      console.log("IT WILL SKIP THAT ONE AFTER 2 FAILS");
    }
    counter = updateCounter(counter, cardskipper);
    let check = cardskipper.reduce((acc, val) => acc + val, 0);
    if (check == cardskipper.length * 2) {
      clearInterval(interval);
      console.log("Finished Running");
      ingameShowcase_end();
      logSummary(openedItems, coloroutput);
    }
  }, openingdelay);
}

// Helper function to execute chest opening script
async function executeChestScript(customchestlist) {
  let openingdelay = 2000;
  let chests;
  try {
    chests = customchestlist;
  } catch {
    chests = [
      {
        chestid: "077a4cf2-7b76-4624-8be6-4a7316cf5906",
        name: "Golden",
      },
      {
        chestid: "ec230bdb-4b96-42c3-8bd0-65d204a153fc",
        name: "Ice",
      },
      {
        chestid: "71182187-109c-40c9-94f6-22dbb60d70ee",
        name: "Wood",
      },
      {
        chestid: "ccf1dc3a-099b-4f9c-af5b-bc7136530a77",
        name: "Halloween",
      },
      {
        chestid: "be1fec80-d4e4-47ab-9f73-9f5622e6e905",
        name: "Christmas",
      },
    ];
  }

  let coloroutput = {
    PARANORMAL: "000000",
    MYTHICAL: "c20025",
    LEGENDARY: "feaa37",
    EPIC: "cd2afc",
    RARE: "43abde",
    COMMON: "47f2a0",
    DEFAULT: "ffffff",
  };

  let translations_req = await fetch(
    `https://raw.githubusercontent.com/${git_base}/KirkaScripts/refs/heads/main/ConsoleScripts/microwaves.json`,
  );
  let translations = await translations_req.json();

  //This Part reverses my translations
  Object.keys(translations).forEach((item) => {
    let translationItem = translations[item];
    translations[translationItem] = item;
  });

  //This code logs credits
  function logCredits() {
    console.log(
      "%cMade by carrysheriff/SheriffCarry discord: @carrysheriff",
      "color: #000000;background-color: #FFFFFF;font-size: large;",
    );
    console.log(
      "If you only want a specific chest to be opened, just delete the chest from the array at the top of the script",
    );
    console.log(
      `https://github.com/${git_base}/KirkaScripts/blob/main/ConsoleScripts/OpenAllChests_live_updating.js this code is live updating`,
    );
  }

  //This code fetches and returns the inventory
  async function fetchInventory() {
    let response = await fetch(
      `https://api2.kirka.io/api/${translations["inventory"]}`,
      {
        headers: {
          accept: "application/json",
          authorization: `Bearer ${localStorage.token}`,
        },
      },
    );
    let json = await response.json();
    return json;
  }

  let bvl = [];

  async function setBVL() {
    let response = await fetch(
      "https://opensheet.elk.sh/1tzHjKpu2gYlHoCePjp6bFbKBGvZpwDjiRzT9ZUfNwbY/Alphabetical",
    );
    bvl = await response.json();
    return;
  }

  function rarity_backup(spreadsheet, namefield, rarityfield, skinname) {
    let found = false;
    let rarity = "Unknown-Rarity";
    spreadsheet.forEach((listitem) => {
      if (listitem && listitem[namefield] && listitem[rarityfield]) {
        if (
          found == false &&
          listitem[namefield] == skinname &&
          Object.keys(coloroutput).includes(listitem[rarityfield].toUpperCase())
        ) {
          found = true;
          rarity = listitem[rarityfield];
        }
      }
    });
    return rarity;
  }

  //this code opens chests
  async function openChest(chestId) {
    let bodyobj = {};
    bodyobj[translations["id"]] = chestId;
    const response = await fetch(
      `https://api2.kirka.io/api/${translations["inventory"]}/${translations["openChest"]}`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${localStorage.token}`,
          "content-type": "application/json;charset=UTF-8",
        },
        body: JSON.stringify(bodyobj),
      },
    );
    return await response.json();
  }

  function ingameShowcase_messages(message, displaylength) {
    let elem = document.createElement("div");
    elem.classList = "vue-notification-wrapper";
    elem.style =
      "transition-timing-function: ease; transition-delay: 0s; transition-property: all;";
    elem.innerHTML = `<div data-v-3462d80a="" data-v-460e7e47="" class="alert-default"><span data-v-3462d80a="" class="text">${message}</span></div>`;
    elem.onclick = function () {
      try {
        elem.remove();
      } catch { }
    };
    document
      .getElementsByClassName("vue-notification-group")[0]
      .children[0].appendChild(elem);
    setTimeout(() => {
      try {
        elem.remove();
      } catch { }
    }, displaylength);
  }

  function ingameShowcase_end() {
    let end_elem = document.createElement("div");
    end_elem.classList = "vue-notification-wrapper";
    end_elem.style =
      "transition-timing-function: ease; transition-delay: 0s; transition-property: all;";
    end_elem.innerHTML = `<div data-v-3462d80a="" data-v-460e7e47="" class="alert-default"><span data-v-3462d80a="" class="text">Finished running, check console for more details</span></div>`;
    end_elem.onclick = function () {
      try {
        end_elem.remove();
      } catch { }
    };
    document
      .getElementsByClassName("vue-notification-group")[0]
      .children[0].appendChild(end_elem);
    setTimeout(() => {
      try {
        end_elem.remove();
      } catch { }
    }, 15000);
  }

  //This code displays the result of the container ingame + in the console
  function ingameShowcase(message, rarity, name) {
    rarity = translations[rarity];
    if (rarity == undefined) {
      rarity = rarity_backup(bvl, "Skin Name", "Rarity", name);
    }
    const text = `${rarity} ${message} from: ${name}`;
    const style = `color: #${coloroutput[rarity.toUpperCase()] || coloroutput.DEFAULT
      }`;
    console.log(`%c${text}`, style);

    const elem = document.createElement("div");
    elem.classList.add("vue-notification-wrapper");
    elem.style =
      "transition-timing-function: ease; transition-delay: 0s; transition-property: all;";
    elem.innerHTML = `<div data-v-3462d80a="" data-v-460e7e47="" class="alert-default"><span data-v-3462d80a="" class="text" style="color:#${coloroutput[rarity.toUpperCase()] || coloroutput.DEFAULT
      }">${text}</span></div>`;
    elem.onclick = function () {
      try {
        elem.remove();
      } catch { }
    };
    document
      .getElementsByClassName("vue-notification-group")[0]
      .children[0].appendChild(elem);

    setTimeout(() => {
      try {
        elem.remove();
      } catch { }
    }, 5000);
  }

  //This code is for an animation for a specific rarity
  function confettiAnimation() {
    const duration = 15 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = {
      startVelocity: 30,
      spread: 360,
      ticks: 60,
      zIndex: 0,
    };

    function randomInRange(min, max) {
      return Math.random() * (max - min) + min;
    }

    const intervalconfetti = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(intervalconfetti);
        return;
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({
        ...defaults,
        particleCount,
        origin: {
          x: randomInRange(0.1, 0.3),
          y: Math.random() - 0.2,
        },
        zIndex: 99999,
      });
      confetti({
        ...defaults,
        particleCount,
        origin: {
          x: randomInRange(0.7, 0.9),
          y: Math.random() - 0.2,
        },
        zIndex: 99999,
      });
    }, 250);
  }

  //This one handles updatign the counter variable
  function updateCounter(counter, chestskipper) {
    counter = (counter + 1) % chests.length;
    while (chestskipper[counter] >= 2) {
      counter = (counter + 1) % chests.length;

      let check = chestskipper.reduce((acc, val) => acc + val, 0);
      if (check == chestskipper.length * 2) {
        counter = 0;
        break;
      }
    }
    return counter;
  }

  function automatic_microwaves(inventory) {
    //item in the inventory request
    inventory.forEach((item) => {
      Object.keys(item).forEach((key) => {
        if (typeof item[key] == "object") {
          translations["item"] = key;
        }
      });
    });
    //name in the inventory request
    inventory.forEach((item) => {
      Object.keys(item[translations["item"]]).forEach((key) => {
        if (
          (typeof item[translations["item"]][key] == "string" &&
            item[translations["item"]][key] == "Elizabeth") ||
          item[translations["item"]][key] == "James"
        ) {
          translations["name"] = key;
        }
      });
    });
    //id in the inventory request
    inventory.forEach((item) => {
      Object.keys(item[translations["item"]]).forEach((key) => {
        if (
          (typeof item[translations["item"]][key] == "string" &&
            item[translations["item"]][key] ==
            "a1055b22-18ca-4cb9-8b39-e46bb0151185") ||
          item[translations["item"]][key] ==
          "6be53225-952a-45d7-a862-d69290e4348e"
        ) {
          translations["id"] = key;
        }
      });
    });
  }

  //This processes my chestskipper variable
  function processChestskipper(chestskipper, inventory) {
    try {
      inventory.forEach((item) => {
        for (let i = 0; i < chests.length; i++) {
          if (
            item[translations["item"]][translations["id"]] ==
            chests[i]["chestid"]
          ) {
            chestskipper[i] = 0;
          }
        }
      });
      return chestskipper;
    } catch {
      ingameShowcase_messages("Kirka microwave issue", 15000);
      return chestskipper;
    }
  }

  function logSummary(itemsByRarity, colorMap) {
    console.log(
      "%c--- Summary ---",
      "color: #FFFFFF; background-color: #000000; font-weight: bold; font-size: 1.2em; padding: 2px;",
    );

    const rarityOrder = [
      "PARANORMAL",
      "MYTHICAL",
      "LEGENDARY",
      "EPIC",
      "RARE",
      "COMMON",
    ];

    const sortedRarities = Object.keys(itemsByRarity).sort((a, b) => {
      const indexA = rarityOrder.indexOf(a);
      const indexB = rarityOrder.indexOf(b);

      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    for (const rarity of sortedRarities) {
      const items = itemsByRarity[rarity];
      if (!items || items.length === 0) continue;

      const itemCounts = items.reduce((acc, item) => {
        acc[item] = (acc[item] || 0) + 1;
        return acc;
      }, {});

      const itemsString = Object.entries(itemCounts)
        .map(([name, count]) => `${name} x${count}`)
        .join(", ");

      const totalCount = items.length;
      const color = colorMap[rarity] || colorMap.DEFAULT;
      const logText = `${totalCount}x ${rarity}: ${itemsString}`;

      console.log(`%c${logText}`, `color: #${color}; font-weight: bold;`);
    }
  }

  let chestskipper = new Array(chests.length).fill(2);
  try {
    chestskipper[0] = 0;
  } catch { }

  logCredits();
  if (!chests[0]) {
    return;
  }
  await setBVL();
  let inventory = await fetchInventory();
  automatic_microwaves(inventory);

  chestskipper = processChestskipper(chestskipper, inventory);

  if (!document.getElementById("konfettijs")) {
    let script = document.createElement("script");
    script.id = "konfettijs";
    script.src =
      "https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js";
    document.head.appendChild(script);
  }

  let openedItems = {};
  let counter = 0;
  let interval = setInterval(async () => {
    let chestresult = await openChest(chests[counter]["chestid"]);
    let resultName = chestresult[translations["name"]];
    let resultRarity = chestresult[translations["rarity"]];
    if (resultName) {
      ingameShowcase(resultName, resultRarity, chests[counter]["name"]);

      let translatedRarity = translations[resultRarity];
      if (translatedRarity == undefined) {
        translatedRarity = rarity_backup(
          bvl,
          "Skin Name",
          "Rarity",
          resultName,
        );
      }
      translatedRarity = translatedRarity.toUpperCase();

      if (!openedItems[translatedRarity]) {
        openedItems[translatedRarity] = [];
      }
      openedItems[translatedRarity].push(resultName);

      if (
        translations[resultRarity] == "MYTHICAL" ||
        translations[resultRarity] == "PARANORMAL"
      ) {
        confettiAnimation();
      }
    } else if (chestresult["code"] == 9910) {
      console.log("RATELIMIT");
    } else {
      chestskipper[counter]++;
      console.log("DON'T WORRY ABOUT THE ERROR");
      console.log("THE CHEST THAT IT TRIED TO OPEN IS NOT AVAILABLE ANYMORE");
      console.log("IT WILL SKIP THAT ONE AFTER 2 FAILS");
    }
    counter = updateCounter(counter, chestskipper);
    let check = chestskipper.reduce((acc, val) => acc + val, 0);
    if (check == chestskipper.length * 2) {
      clearInterval(interval);
      console.log("Finished Running");
      ingameShowcase_end();
      logSummary(openedItems, coloroutput);
    }
  }, openingdelay);
}

async function start_chests_input(inputarray) {
  await executeChestScript(inputarray);
}

async function start_chests() {
  await executeChestScript(undefined);
}

async function start_cards_input(inputarray) {
  await executeCardScript(inputarray);
}

async function start_cards() {
  await executeCardScript(undefined);
}

async function opener() {
  const select = document.getElementById("opener");
  if (!select) return;

  const data = await fetchOpenerList();

  select.addEventListener("change", async () => {
    const value = select.value;

    if (value === "none") return;

    if (value === "Chest_All") {
      return start_chests_input(data.chests);
    }

    if (value.startsWith("Chest_")) {
      const name = value.replace("Chest_", "");
      const chest = data.chests.find((c) => c.name === name);
      if (chest) {
        return start_chests_input([chest]);
      }
    }

    if (value === "Card_All") {
      return start_cards_input(data.cards);
    }

    if (value.startsWith("Card_")) {
      const name = value.replace("Card_", "");
      const card = data.cards.find(
        (c) => c.name.replace(/\s+/g, "") === name,
      );
      if (card) {
        return start_cards_input([card]);
      }
    }
  });
}

module.exports = { opener, addOpenerList };