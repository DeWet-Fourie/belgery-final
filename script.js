/* =========================================================
   BELGERY COLLECTION RAIL ENGINE
   Baadjie-inspired rail, rebuilt for Belgery collections.
   Flow: collection rail -> collection story -> collection products.
   ========================================================= */

const CONFIG = {
  productsCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTQOWR3E1sjd7wLZDDx66hSNLB3C_bCQfJZwaCSmRNvStwGasp6Yx1ICc3mP5-z_24RmCVOm8JdKHnz/pub?gid=0&single=true&output=csv",
  whatsappNumber: "27769925371",
  localProductImageFolder: "assets/products/",
  placeholderImage: "assets/products/placeholder.svg"
};

let allProducts = [];
let collections = [];
let activeCollection = "";
let railDidDrag = false;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function clean(value) {
  return String(value ?? "").trim();
}

function normaliseKey(key) {
  return clean(key)
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, "")
    .replace(/[_-]+/g, "")
    .replace(/[^\w]/g, "");
}

function yes(value) {
  return ["YES", "TRUE", "1", "Y", "FEATURED"].includes(clean(value).toUpperCase());
}

function no(value) {
  return ["NO", "FALSE", "0", "N", "HIDDEN", "UNAVAILABLE", "SOLD"].includes(clean(value).toUpperCase());
}

function firstValue(row, keys, fallback = "") {
  for (const key of keys) {
    const value = row[normaliseKey(key)];
    if (clean(value)) return clean(value);
  }
  return fallback;
}

function sheetUrlWithCacheBust() {
  const separator = CONFIG.productsCsvUrl.includes("?") ? "&" : "?";
  return `${CONFIG.productsCsvUrl}${separator}cacheBust=${Date.now()}`;
}

async function fetchProducts() {
  const response = await fetch(sheetUrlWithCacheBust(), { cache: "no-store" });
  if (!response.ok) throw new Error(`Google Sheet fetch failed: ${response.status}`);

  const text = await response.text();
  const rows = parseCSV(text);

  return rows
    .map((row, index) => mapSheetRowToProduct(row, index))
    .filter(product => clean(product.name))
    .filter(product => !no(product.available))
    .sort((a, b) => Number(clean(a.sortOrder) || 9999) - Number(clean(b.sortOrder) || 9999));
}

function parseCSV(text) {
  const trimmed = clean(text);
  if (!trimmed) return [];

  const rows = csvToRows(trimmed);
  if (!rows.length) return [];

  const headers = rows.shift().map(header => normaliseKey(header));

  return rows
    .filter(row => row.some(cell => clean(cell)))
    .map(row => {
      const item = {};
      headers.forEach((header, index) => {
        if (header) item[header] = clean(row[index]);
      });
      return item;
    });
}

function csvToRows(csvText) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function mapSheetRowToProduct(row, index) {
  const name = firstValue(row, ["name", "productName", "product", "title"]);
  const id = firstValue(row, ["id", "productId", "sku", "slug"]) || slugify(name) || `product-${index + 1}`;
  const collection = firstValue(row, ["collection", "category", "range", "type"], "BELGERY Edit");

  return {
    id,
    name,
    collection,
    collectionTagline: firstValue(row, ["collectionTagline", "rangeTagline", "collectionSubtitle", "collectionMood", "tagline"]),
    collectionDescription: firstValue(row, ["collectionDescription", "collectionDesc", "rangeDescription", "rangeStory", "collectionStory"]),
    collectionCover: firstValue(row, ["collectionCover", "collectionImage", "rangeCover", "categoryImage", "coverImage"]),
    collectionRailImage: firstValue(row, ["collectionRailImage", "railImage", "railCover", "collectionCardImage", "collectionThumbnail"]),
    collectionStoryImage: firstValue(row, ["collectionStoryImage", "storyImage", "storyCover", "descriptionImage", "collectionDescriptionImage"]),
    price: firstValue(row, ["price", "normalPrice", "regularPrice", "sellingPrice"]),
    salePrice: firstValue(row, ["salePrice", "discountPrice", "specialPrice"]),
    compareAtPrice: firstValue(row, ["compareAtPrice", "comparePrice", "oldPrice", "wasPrice", "originalPrice", "previousPrice"]),
    shortDescription: firstValue(row, ["shortDescription", "shortDesc", "cardDescription", "summary", "descriptionShort"]),
    description: firstValue(row, ["description", "productDescription", "mainDescription"]),
    longDescription: firstValue(row, ["longDescription", "longDesc", "fullDescription", "details", "story"]),
    material: firstValue(row, ["material", "materials", "leather", "fabric"]),
    dimensions: firstValue(row, ["dimensions", "dimension", "size", "measurements"]),
    leadTime: firstValue(row, ["leadTime", "leadtime", "productionTime", "deliveryTime", "turnaround"]),
    available: firstValue(row, ["available", "availability", "status"], "YES"),
    featured: firstValue(row, ["featured", "feature", "homepage", "home"]),
    sortOrder: firstValue(row, ["sortOrder", "sort", "order", "displayOrder"]),
    whatsappMessage: firstValue(row, ["whatsappMessage", "whatsapp", "enquiryMessage", "message"]),
    images: getImagesFromRow(row)
  };
}

function getImagesFromRow(row) {
  const images = [];

  // BELGERY Sheet image support:
  // Use image1 ... image6 as the cleanest format.
  // Backwards-compatible aliases also work: photo1-photo6, img1-img6,
  // picture1-picture6, productImage1-productImage6, productPhoto1-productPhoto6.
  const mainImage = firstValue(row, ["image", "mainImage", "productImage", "photo", "picture"]);
  if (mainImage) images.push(mainImage);

  for (let i = 1; i <= 6; i++) {
    const value = firstValue(row, [
      `image${i}`,
      `img${i}`,
      `photo${i}`,
      `picture${i}`,
      `productImage${i}`,
      `productPhoto${i}`
    ]);
    if (value) images.push(value);
  }

  const gallery = firstValue(row, ["gallery", "images", "imageGallery", "photos", "photoGallery"]);
  if (gallery) {
    gallery
      .split(/[|;]/)
      .map(clean)
      .filter(Boolean)
      .slice(0, 6)
      .forEach(image => images.push(image));
  }

  return [...new Set(images)].slice(0, 6).map(resolveImage);
}

function resolveImage(src) {
  const value = clean(src);
  if (!value) return CONFIG.placeholderImage;

  if (/^(https?:)?\/\//i.test(value) || value.startsWith("data:")) return value;
  if (value.startsWith("assets/") || value.startsWith("./") || value.startsWith("/")) return value;

  return `${CONFIG.localProductImageFolder}${value}`;
}

function buildCollections(products) {
  const map = new Map();

  products.forEach(product => {
    const name = clean(product.collection) || "BELGERY Edit";
    if (!map.has(name)) {
      map.set(name, {
        name,
        slug: slugify(name),
        tagline: "Curated BELGERY pieces",
        description: "A curated selection of handmade BELGERY pieces chosen for natural texture, practical detail and quieter luxury.",
        cover: product.images?.[0] || CONFIG.placeholderImage,
        storyCover: product.images?.[0] || CONFIG.placeholderImage,
        products: []
      });
    }

    const collection = map.get(name);
    collection.products.push(product);

    if (clean(product.collectionTagline)) collection.tagline = clean(product.collectionTagline);
    if (clean(product.collectionDescription)) collection.description = clean(product.collectionDescription);

    // Collection images are separate from product images.
    // Use these Google Sheet columns when you want a curated rail/story photo:
    // collectionRailImage / railImage / railCover / collectionCardImage / collectionThumbnail
    // collectionStoryImage / storyImage / storyCover / descriptionImage / collectionDescriptionImage
    // collectionCover still works as one image for both if you only want one column.
    if (clean(product.collectionRailImage)) collection.cover = resolveImage(product.collectionRailImage);
    else if (clean(product.collectionCover)) collection.cover = resolveImage(product.collectionCover);
    else if (!collection.cover || collection.cover === CONFIG.placeholderImage) collection.cover = product.images?.[0] || CONFIG.placeholderImage;

    if (clean(product.collectionStoryImage)) collection.storyCover = resolveImage(product.collectionStoryImage);
    else if (clean(product.collectionCover)) collection.storyCover = resolveImage(product.collectionCover);
    else if (!collection.storyCover || collection.storyCover === CONFIG.placeholderImage) collection.storyCover = collection.cover || product.images?.[0] || CONFIG.placeholderImage;
  });

  return Array.from(map.values()).map(collection => ({
    ...collection,
    description: smartCollectionDescription(collection)
  }));
}

function smartCollectionDescription(collection) {
  if (collection.description && !collection.description.includes("curated selection of handmade")) return collection.description;

  const name = collection.name.toLowerCase();
  if (name.includes("bag")) return "Structured carry pieces with honest leather grain, built for daily use, work days and travel without losing the handmade character that makes every piece feel personal.";
  if (name.includes("belt")) return "Clean leather staples selected for shape, strength and everyday wear — simple enough to use daily, refined enough to finish the outfit.";
  if (name.includes("wallet") || name.includes("card")) return "Small leather goods made for pockets, gifting and daily carry, with compact details that age beautifully through use.";
  if (name.includes("custom")) return "A more personal BELGERY range shaped around the customer — made for meaningful gifts, specific sizing and pieces with a story behind them.";
  if (name.includes("new")) return "Freshly added BELGERY pieces from the latest selection. Limited, practical and available while the current batch lasts.";
  if (name.includes("signature")) return "The core BELGERY look: natural texture, clean silhouettes and handmade detail balanced into pieces that feel timeless rather than trendy.";
  return collection.description;
}

function collectionRailCard(collection, index) {
  return `
    <button class="collection-rail-card ${collection.name === activeCollection ? "is-active" : ""}" type="button" data-collection="${escapeAttr(collection.name)}" style="--delay:${index * 40}ms">
      <div class="rail-wire-hanger" aria-hidden="true">
        <span class="rail-loop"></span>
        <span class="rail-wire"></span>
      </div>
      <span class="collection-count">${collection.products.length} piece${collection.products.length === 1 ? "" : "s"}</span>
      <img src="${escapeAttr(collection.cover)}" alt="${escapeAttr(collection.name)} collection" loading="lazy" onerror="this.src='${CONFIG.placeholderImage}'">
      <span class="collection-rail-copy">
        <small>${escapeHTML(collection.tagline)}</small>
        <strong>${escapeHTML(collection.name)}</strong>
        <em>Open collection</em>
      </span>
    </button>
  `;
}

function renderMainCollectionRail() {
  const rail = $("#collectionRail");
  if (!rail) return;

  if (!collections.length) {
    rail.innerHTML = "";
    const status = $("#collectionStatus");
    if (status) status.textContent = "No collections found yet.";
    return;
  }

  if (!activeCollection) activeCollection = collections[0].name;

  rail.innerHTML = collections.map(collectionRailCard).join("");
  const status = $("#collectionStatus");
  if (status) status.textContent = `${collections.length} collection${collections.length === 1 ? "" : "s"} loaded`;

  rail.querySelectorAll("[data-collection]").forEach(button => {
    button.addEventListener("click", () => {
      if (railDidDrag) return;
      selectCollection(button.dataset.collection, { scroll: true, updateHash: true });
    });
  });

  setupHorizontalRail(rail);
  bindRailButtons(rail);
}

function renderHomeCollectionRail() {
  const rail = $("#homeCollectionRail");
  if (!rail) return;

  if (!collections.length) {
    rail.innerHTML = `<div class="empty-state">Collections will appear here once products load from the Google Sheet.</div>`;
    return;
  }

  rail.innerHTML = collections.slice(0, 5).map(collection => `
    <a class="mini-collection-card" href="products.html#${encodeURIComponent(collection.name)}">
      <img src="${escapeAttr(collection.cover)}" alt="${escapeAttr(collection.name)}" loading="lazy" onerror="this.src='${CONFIG.placeholderImage}'">
      <span>${escapeHTML(collection.name)}</span>
    </a>
  `).join("");
}

function selectCollection(name, options = {}) {
  activeCollection = name;
  const collection = collections.find(item => item.name === name) || collections[0];
  if (!collection) return;

  $$("#collectionRail .collection-rail-card").forEach(card => {
    card.classList.toggle("is-active", card.dataset.collection === collection.name);
  });

  renderCollectionStory(collection);
  renderGrid("#productsGrid", collection.products, { emptySelector: "#productsEmpty" });

  const title = $("#productsTitle");
  if (title) title.textContent = `${collection.name} products`;

  const whatsapp = $("#activeCollectionWhatsapp");
  if (whatsapp) {
    whatsapp.href = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(`Hi BELGERY, I would like to ask about the ${collection.name} collection.`)}`;
  }

  if (options.updateHash !== false) {
    history.replaceState(null, "", `#${encodeURIComponent(collection.name)}`);
  }

  if (options.scroll) {
    $("#collectionStory")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function renderCollectionStory(collection) {
  const story = $("#collectionStory");
  if (!story) return;

  story.innerHTML = `
    <div class="story-index">${String(collections.indexOf(collection) + 1).padStart(2, "0")}</div>
    <div class="story-bg-word" aria-hidden="true">${escapeHTML(collection.name)}</div>
    <div class="story-main">
      <p class="eyebrow">${escapeHTML(collection.tagline)}</p>
      <h2>${escapeHTML(collection.name)}</h2>
      <div class="story-description-card">
        <span class="story-description-label">Collection description</span>
        <p class="story-description-text">${escapeHTML(collection.description)}</p>
      </div>
      <div class="story-meta-row">
        <span>${collection.products.length} available piece${collection.products.length === 1 ? "" : "s"}</span>
        <span>Curated collection</span>
        <span>WhatsApp to claim</span>
      </div>
    </div>
  `;
}

function setupHorizontalRail(rail) {
  if (!rail || rail.dataset.dragReady === "true") return;
  rail.dataset.dragReady = "true";

  const isTouch = window.matchMedia("(hover: none), (pointer: coarse)").matches;

  // On phones: let the browser do native inertial scrolling.
  // This is dramatically smoother in Safari/WhatsApp than JS-preventDefault dragging.
  if (isTouch) {
    rail.style.overflowX = "auto";
    rail.style.webkitOverflowScrolling = "touch";
    rail.addEventListener("click", event => {
      if (railDidDrag) event.preventDefault();
    }, true);
    return;
  }

  let isDown = false;
  let startX = 0;
  let startLeft = 0;
  let moved = false;

  rail.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    isDown = true;
    moved = false;
    railDidDrag = false;
    startX = event.clientX;
    startLeft = rail.scrollLeft;
    rail.setPointerCapture?.(event.pointerId);
    rail.classList.add("is-dragging");
  });

  rail.addEventListener("pointermove", event => {
    if (!isDown) return;
    const dx = event.clientX - startX;
    if (Math.abs(dx) > 4) {
      moved = true;
      railDidDrag = true;
      rail.scrollLeft = startLeft - dx;
      event.preventDefault();
    }
  });

  const end = event => {
    if (!isDown) return;
    isDown = false;
    rail.releasePointerCapture?.(event.pointerId);
    rail.classList.remove("is-dragging");
    if (moved) setTimeout(() => { railDidDrag = false; }, 160);
    else railDidDrag = false;
  };

  rail.addEventListener("pointerup", end);
  rail.addEventListener("pointercancel", end);
  rail.addEventListener("pointerleave", end);
}

function bindRailButtons(rail) {
  const prev = $("[data-rail-prev]");
  const next = $("[data-rail-next]");
  if (!rail || !prev || !next || prev.dataset.bound === "true") return;

  prev.dataset.bound = "true";
  next.dataset.bound = "true";

  const cardStep = () => {
    const card = rail.querySelector(".collection-rail-card");
    return card ? card.getBoundingClientRect().width + 24 : 320;
  };

  prev.addEventListener("click", () => rail.scrollBy({ left: -cardStep(), behavior: "smooth" }));
  next.addEventListener("click", () => rail.scrollBy({ left: cardStep(), behavior: "smooth" }));
}

function productCard(product) {
  const mainImage = product.images?.[0] || CONFIG.placeholderImage;

  return `
    <article class="product-card" data-id="${escapeAttr(product.id)}" data-collection="${escapeAttr(product.collection)}">
      <button class="product-image" type="button" data-open-product="${escapeAttr(product.id)}" aria-label="Open ${escapeAttr(product.name)} gallery">
        <img src="${escapeAttr(mainImage)}" alt="${escapeAttr(product.name)}" loading="lazy" onerror="this.src='${CONFIG.placeholderImage}'">
        ${productPhotoDots(product)}
      </button>

      <div class="product-info">
        <div class="product-kicker"><span>${escapeHTML(product.collection)}</span></div>
        <h3>${escapeHTML(product.name)}</h3>
        ${priceHTML(product)}
        <div class="product-actions">
          <button class="small-btn" type="button" data-open-product="${escapeAttr(product.id)}">View piece</button>
          <a class="small-btn gold" href="${whatsappLink(product)}" target="_blank" rel="noopener">Enquire</a>
        </div>
      </div>
    </article>
  `;
}

function productPhotoDots(product) {
  const count = Math.min((product.images || []).filter(Boolean).length, 6);
  if (count <= 1) return "";

  return `
    <span class="product-photo-dots" aria-label="${count} photos available">
      ${Array.from({ length: count }, (_, index) => `<span class="product-photo-dot ${index === 0 ? "is-active" : ""}" aria-hidden="true"></span>`).join("")}
    </span>
  `;
}

function priceHTML(product) {
  const hasSale = clean(product.salePrice) && clean(product.compareAtPrice);

  if (hasSale) {
    return `
      <div class="price-row">
        <span class="price-current">${escapeHTML(product.salePrice)}</span>
        <span class="price-old">${escapeHTML(product.compareAtPrice)}</span>
      </div>
      <span class="sale-badge">Limited offer</span>
    `;
  }

  return `
    <div class="price-row">
      <span class="price-current">${escapeHTML(clean(product.price) || "Price on request")}</span>
    </div>
  `;
}

function renderGrid(selector, products, options = {}) {
  const grid = $(selector);
  if (!grid) return;

  let items = [...products];

  if (options.featuredOnly) items = items.filter(product => yes(product.featured));
  if (options.limit) items = items.slice(0, options.limit);

  grid.innerHTML = items.map(productCard).join("");

  const empty = $(options.emptySelector);
  if (empty) empty.classList.toggle("hidden", items.length > 0);

  bindProductButtons();
}

function bindProductButtons() {
  $$('[data-open-product]').forEach(button => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => openProduct(button.dataset.openProduct));
  });
}

function openProduct(id) {
  const product = allProducts.find(item => clean(item.id) === clean(id));
  const modal = $("#productModal");
  if (!product || !modal) return;

  const galleryImages = product.images?.length ? product.images : [CONFIG.placeholderImage];
  const productDescription =
    clean(product.longDescription) ||
    clean(product.description) ||
    clean(product.shortDescription) ||
    "Contact BELGERY for more details about this piece.";

  modal.innerHTML = `
    <div class="modal-inner">
      <button class="small-btn close-btn" type="button" onclick="document.getElementById('productModal').close()">Close</button>
      <div class="modal-gallery" aria-label="${escapeAttr(product.name)} image gallery">
        ${galleryImages.map(img => `
          <img src="${escapeAttr(img)}" alt="${escapeAttr(product.name)}" onerror="this.src='${CONFIG.placeholderImage}'">
        `).join("")}
      </div>
      ${galleryImages.length > 1 ? `<div class="modal-photo-count">${galleryImages.length} photos · swipe sideways</div>` : ""}
      <div class="modal-copy">
        <p class="eyebrow">${escapeHTML(product.collection || "BELGERY")}</p>
        <h2>${escapeHTML(product.name)}</h2>
        ${priceHTML(product)}
        <p class="modal-description">${escapeHTML(productDescription)}</p>
        ${additionalInformationHTML(product)}
        <a class="liquid-btn" target="_blank" rel="noopener" href="${whatsappLink(product)}">Enquire on WhatsApp</a>
      </div>
    </div>
  `;

  modal.showModal();
}

function additionalInformationHTML(product) {
  const details = [
    ["Material", product.material],
    ["Dimensions / Size", product.dimensions],
    ["Lead time", product.leadTime]
  ].filter(([, value]) => clean(value));

  if (!details.length) return "";

  return `
    <div class="modal-section additional-information">
      <h3>Additional information</h3>
      <dl class="product-detail-list clean-details">
        ${details.map(([label, value]) => `
          <div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd></div>
        `).join("")}
      </dl>
    </div>
  `;
}

function whatsappLink(product) {
  const msg = clean(product.whatsappMessage) || `Hi BELGERY, I am interested in ${product.name}. Could you please send me more details?`;
  return `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(msg)}`;
}

function escapeHTML(str) {
  return clean(str).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function escapeAttr(str) {
  return escapeHTML(str);
}

function slugify(str) {
  return clean(str).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function showSheetError(error) {
  console.error(error);
  const message = `
    <div class="sheet-error">
      <strong>Google Sheet did not load.</strong><br>
      Check that the published CSV link is correct, public and not blocked.
    </div>
  `;

  ["#featuredProducts", "#productsGrid", "#collectionRail", "#homeCollectionRail"]
    .map($)
    .filter(Boolean)
    .forEach(target => target.innerHTML = message);

  const status = $("#collectionStatus");
  if (status) status.textContent = "Could not load the collection rail.";
}

function initHashCollection() {
  const hashCollection = decodeURIComponent(location.hash.replace("#", ""));
  if (!hashCollection) return collections[0]?.name || "";
  const match = collections.find(collection => collection.name.toLowerCase() === hashCollection.toLowerCase());
  return match?.name || collections[0]?.name || "";
}

function restoreAnchorAfterLoad() {
  const hash = decodeURIComponent(location.hash.replace("#", ""));
  if (!hash) return;
  const isCollectionHash = collections.some(collection => collection.name.toLowerCase() === hash.toLowerCase());
  if (isCollectionHash) return;

  const target = document.getElementById(hash);
  if (target) {
    setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "start" }), 180);
  }
}

async function init() {
  try {
    allProducts = await fetchProducts();
    collections = buildCollections(allProducts);
    activeCollection = initHashCollection();

    renderHomeCollectionRail();
    renderMainCollectionRail();

    if ($("#collectionStory")) selectCollection(activeCollection || collections[0]?.name || "", { updateHash: false });
    restoreAnchorAfterLoad();

    renderGrid("#featuredProducts", allProducts, {
      featuredOnly: true,
      limit: Number($("#featuredProducts")?.dataset.productLimit || 6),
      emptySelector: "#featuredEmpty"
    });
  } catch (error) {
    showSheetError(error);
  }
}

document.addEventListener("click", event => {
  const toggle = event.target.closest(".menu-toggle");
  if (toggle) {
    const isOpen = document.body.classList.toggle("menu-open");
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }

  const navLink = event.target.closest(".nav a");
  if (navLink) {
    document.body.classList.remove("menu-open");
    const toggleButton = $(".menu-toggle");
    if (toggleButton) toggleButton.setAttribute("aria-expanded", "false");
  }

  if (event.target.matches(".product-modal")) event.target.close();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    const modal = $("#productModal");
    if (modal?.open) modal.close();
    document.body.classList.remove("menu-open");
  }
});

document.addEventListener("DOMContentLoaded", init);

/* BELGERY bag opening reveal — final mobile-safe version */
(function(){
  function initBagIntro(){
    const intro = document.querySelector('.belgery-bag-intro');
    const stage = document.querySelector('.bag-intro-stage');
    const left = document.querySelector('.opening-bag-left');
    const right = document.querySelector('.opening-bag-right');
    const copy = document.querySelector('.bag-intro-copy');
    const cue = document.querySelector('.bag-scroll-cue');
    const header = document.querySelector('.site-header');
    if (!intro || !stage || !left || !right || !copy) return;

    const clamp = (num, min, max) => Math.min(Math.max(num, min), max);
    const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    let target = 0;
    let current = 0;
    let ticking = false;

    function dimensions(){
      return {
        mobile: window.matchMedia('(max-width: 640px)').matches,
        tablet: window.matchMedia('(max-width: 900px)').matches
      };
    }

    function setProgress(){
      const rect = intro.getBoundingClientRect();
      const scrollRange = Math.max(intro.offsetHeight - window.innerHeight, 1);
      target = clamp((-rect.top) / scrollRange, 0, 1);
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(render);
      }
    }

    function render(){
      current += (target - current) * 0.18;
      if (Math.abs(target - current) < 0.001) current = target;

      const { mobile, tablet } = dimensions();
      const p = ease(current);
      const open = clamp((p - 0.02) / 0.72, 0, 1);
      const reveal = clamp((p - 0.30) / 0.46, 0, 1);
      const navReveal = clamp((p - 0.40) / 0.38, 0, 1);

      stage.classList.toggle('is-opening', p > 0.03);

      if (mobile) {
        left.style.transform = `translate3d(calc(-50% + ${(-120 * open).toFixed(2)}vw), ${(10 + 22 * open).toFixed(2)}px, 0) rotate(${(-2 - 18 * open).toFixed(2)}deg)`;
        right.style.transform = `translate3d(calc(-50% + ${(130 * open).toFixed(2)}vw), ${(20 + 26 * open).toFixed(2)}px, 0) rotate(${(2 + 18 * open).toFixed(2)}deg)`;
      } else if (tablet) {
        left.style.transform = `translate3d(${(-88 * open).toFixed(2)}vw, ${(16 + 14 * open).toFixed(2)}px, 0) rotate(${(-2 - 18 * open).toFixed(2)}deg)`;
        right.style.transform = `translate3d(${(98 * open).toFixed(2)}vw, ${(20 + 16 * open).toFixed(2)}px, 0) rotate(${(2 + 18 * open).toFixed(2)}deg)`;
      } else {
        left.style.transform = `translate3d(${(-76 * open).toFixed(2)}vw, ${(18 + 10 * open).toFixed(2)}px, 0) rotate(${(-2 - 18 * open).toFixed(2)}deg)`;
        right.style.transform = `translate3d(${(86 * open).toFixed(2)}vw, ${(22 + 12 * open).toFixed(2)}px, 0) rotate(${(2 + 18 * open).toFixed(2)}deg)`;
      }

      copy.style.opacity = reveal.toFixed(3);
      copy.style.filter = `blur(${(10 * (1 - reveal)).toFixed(2)}px)`;
      if (cue) cue.style.opacity = clamp(1 - p * 3.5, 0, 1).toFixed(3);

      if (header) {
        header.style.opacity = navReveal.toFixed(3);
        header.style.pointerEvents = navReveal > 0.95 ? 'auto' : 'none';
        header.style.transform = `translate3d(-50%, ${(-14 * (1 - navReveal)).toFixed(2)}px, 0)`;
        header.classList.toggle('header-revealed', navReveal > 0.95);
      }

      if (current !== target) requestAnimationFrame(render);
      else ticking = false;
    }

    setProgress();
    window.addEventListener('scroll', setProgress, { passive: true });
    window.addEventListener('resize', setProgress, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBagIntro);
  else initBagIntro();
})();

/* FINAL CLIENT LOCK: staged bag reveal.
   1) starts on matte charcoal,
   2) bags slide first,
   3) logo atelier background fades only after the bags are mostly open,
   4) page content only comes after the full reveal distance.
*/
(function(){
  function lockFinalBagReveal(){
    const intro = document.querySelector('.belgery-bag-intro');
    const stage = document.querySelector('.bag-intro-stage');
    const left = document.querySelector('.opening-bag-left');
    const right = document.querySelector('.opening-bag-right');
    const header = document.querySelector('.site-header');
    const cue = document.querySelector('.bag-scroll-cue');
    if (!intro || !stage || !left || !right) return;

    const clamp = (v,min,max)=>Math.min(Math.max(v,min),max);
    const easeOut = t => 1 - Math.pow(1 - t, 3);
    let target = 0;
    let current = 0;
    let raf = 0;

    function measureProgress(){
      const rect = intro.getBoundingClientRect();
      const distance = Math.max(intro.offsetHeight - window.innerHeight, 1);
      target = clamp(-rect.top / distance, 0, 1);
      if (!raf) raf = requestAnimationFrame(render);
    }

    function render(){
      raf = 0;
      current += (target - current) * 0.28;
      if (Math.abs(target - current) < 0.002) current = target;

      const mobile = window.matchMedia('(max-width:640px)').matches;
      const tablet = window.matchMedia('(max-width:900px)').matches;

      // Bags must finish opening before the atelier/logo background fully arrives.
      const bagP = easeOut(clamp(current / 0.58, 0, 1));
      const bgP = easeOut(clamp((current - 0.48) / 0.30, 0, 1));
      const navP = easeOut(clamp((current - 0.36) / 0.36, 0, 1));

      stage.style.setProperty('--intro-charcoal', (1 - bgP).toFixed(3));
      stage.style.setProperty('--intro-bg-reveal', bgP.toFixed(3));
      stage.classList.toggle('is-opening', bagP > 0.02);
      stage.classList.toggle('is-opened', bgP > 0.82);

      if (mobile) {
        left.style.transform = `translate3d(calc(-50% + ${(-108 * bagP).toFixed(2)}vw), ${(0 + 8 * bagP).toFixed(2)}px, 0) rotate(${(-1 - 11 * bagP).toFixed(2)}deg)`;
        right.style.transform = `translate3d(calc(-50% + ${(118 * bagP).toFixed(2)}vw), ${(4 + 8 * bagP).toFixed(2)}px, 0) rotate(${(1 + 11 * bagP).toFixed(2)}deg)`;
      } else if (tablet) {
        left.style.transform = `translate3d(${(-84 * bagP).toFixed(2)}vw, ${(10 + 8 * bagP).toFixed(2)}px, 0) rotate(${(-1 - 10 * bagP).toFixed(2)}deg)`;
        right.style.transform = `translate3d(${(96 * bagP).toFixed(2)}vw, ${(14 + 8 * bagP).toFixed(2)}px, 0) rotate(${(1 + 10 * bagP).toFixed(2)}deg)`;
      } else {
        left.style.transform = `translate3d(${(-72 * bagP).toFixed(2)}vw, ${(12 + 6 * bagP).toFixed(2)}px, 0) rotate(${(-1 - 9 * bagP).toFixed(2)}deg)`;
        right.style.transform = `translate3d(${(88 * bagP).toFixed(2)}vw, ${(16 + 6 * bagP).toFixed(2)}px, 0) rotate(${(1 + 9 * bagP).toFixed(2)}deg)`;
      }

      if (header) {
        header.style.opacity = navP.toFixed(3);
        header.style.pointerEvents = navP > 0.95 ? 'auto' : 'none';
        header.style.transform = `translate3d(-50%, ${(-18 * (1-navP)).toFixed(2)}px, 0)`;
        header.classList.toggle('header-revealed', navP > 0.95);
      }
      if (cue) cue.style.opacity = clamp(1 - current * 4.5, 0, 1).toFixed(3);

      if (current !== target) raf = requestAnimationFrame(render);
    }

    measureProgress();
    window.addEventListener('scroll', measureProgress, {passive:true});
    window.addEventListener('resize', measureProgress, {passive:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lockFinalBagReveal);
  else lockFinalBagReveal();
})();


/* BELGERY CLEAN LOGO INTRO — no bag opener, mobile-safe scroll life */
(function(){
  function initCleanLogoIntro(){
    const hero = document.querySelector('.belgery-logo-intro');
    const stage = document.querySelector('.logo-intro-stage');
    const logo = document.querySelector('.intro-logo-mark');
    const header = document.querySelector('.site-header');
    if (!hero || !stage || !logo) return;

    const clamp = (v,min,max)=>Math.min(Math.max(v,min),max);
    const ease = t => 1 - Math.pow(1 - t, 3);
    let target = 0;
    let current = 0;
    let raf = 0;

    function update(){
      const rect = hero.getBoundingClientRect();
      const distance = Math.max(hero.offsetHeight - window.innerHeight * .42, 1);
      target = clamp(-rect.top / distance, 0, 1);
      if (!raf) raf = requestAnimationFrame(render);
    }

    function render(){
      raf = 0;
      current += (target - current) * 0.22;
      if (Math.abs(target - current) < 0.002) current = target;

      const p = ease(current);
      stage.style.setProperty('--hero-life', p.toFixed(3));
      logo.style.transform = `translate3d(0, ${(10 - 18*p).toFixed(2)}px, 0) scale(${(0.985 + .015*p).toFixed(4)})`;

      if (header) {
        const nav = clamp((p - .10) / .34, 0, 1);
        header.style.opacity = nav.toFixed(3);
        header.style.pointerEvents = nav > .95 ? 'auto' : 'none';
        header.style.transform = `translate3d(-50%, ${(-12 * (1-nav)).toFixed(2)}px, 0)`;
        header.classList.toggle('header-revealed', nav > .95);
      }

      if (current !== target) raf = requestAnimationFrame(render);
    }

    update();
    window.addEventListener('scroll', update, {passive:true});
    window.addEventListener('resize', update, {passive:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCleanLogoIntro);
  else initCleanLogoIntro();
})();


/* CLIENT PATCH 06 — keep the mobile header permanently visible */
(function(){
  function forceMobileHeader(){
    const header = document.querySelector('.site-header');
    if (!header) return;
    const mobile = window.matchMedia('(max-width: 900px)').matches;
    if (!mobile) return;
    header.classList.add('header-revealed');
    header.style.opacity = '1';
    header.style.pointerEvents = 'auto';
    header.style.transform = 'translate3d(-50%,0,0)';
  }
  forceMobileHeader();
  window.addEventListener('resize', forceMobileHeader, { passive:true });
  window.addEventListener('scroll', forceMobileHeader, { passive:true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', forceMobileHeader);
})();
