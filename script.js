/* =========================================================
   BELGERY FINAL SMOOTH ONE-PAGE ENGINE
   - No Custom Orders
   - All Products rail card
   - Smooth native mobile rail scroll
   - Click collections works on desktop and mobile
   - Sheets supports image1 ... image6
   ========================================================= */

const CONFIG = {
  productsCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTQOWR3E1sjd7wLZDDx66hSNLB3C_bCQfJZwaCSmRNvStwGasp6Yx1ICc3mP5-z_24RmCVOm8JdKHnz/pub?gid=0&single=true&output=csv",
  whatsappNumber: "27769925371",
  localProductImageFolder: "assets/products/",
  placeholderImage: "assets/products/placeholder.svg",
  allProductsCover: "assets/backgrounds/dark-product-board.png"
};

let allProducts = [];
let collections = [];
let activeCollection = "All Products";
let activeCollectionObj = null;
let didRailDrag = false;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function clean(value) { return String(value ?? "").trim(); }
function normaliseKey(key) {
  return clean(key).toLowerCase().replace(/^\uFEFF/, "").replace(/\s+/g, "").replace(/[_-]+/g, "").replace(/[^\w]/g, "");
}
function firstValue(row, keys, fallback = "") {
  for (const key of keys) {
    const value = row[normaliseKey(key)];
    if (clean(value)) return clean(value);
  }
  return fallback;
}
function no(value) {
  return ["NO", "FALSE", "0", "N", "HIDDEN", "UNAVAILABLE", "SOLD"].includes(clean(value).toUpperCase());
}
function slugify(value) {
  return clean(value).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function escapeHTML(value) {
  return clean(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
}
function escapeAttr(value) { return escapeHTML(value); }

function sheetUrlWithCacheBust() {
  const separator = CONFIG.productsCsvUrl.includes("?") ? "&" : "?";
  return `${CONFIG.productsCsvUrl}${separator}cacheBust=${Date.now()}`;
}

async function fetchProducts() {
  const response = await fetch(sheetUrlWithCacheBust(), { cache: "no-store" });
  if (!response.ok) throw new Error(`Google Sheet fetch failed: ${response.status}`);
  const text = await response.text();
  return parseCSV(text)
    .map(mapSheetRowToProduct)
    .filter(product => clean(product.name))
    .filter(product => !no(product.available))
    .sort((a, b) => Number(clean(a.sortOrder) || 9999) - Number(clean(b.sortOrder) || 9999));
}

function parseCSV(text) {
  const rows = csvToRows(text);
  if (!rows.length) return [];
  const headers = rows.shift().map(normaliseKey);
  return rows.filter(row => row.some(cell => clean(cell))).map(row => {
    const item = {};
    headers.forEach((header, index) => { if (header) item[header] = clean(row[index]); });
    return item;
  });
}

function csvToRows(text) {
  const rows = [];
  let row = [], cell = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i], next = text[i + 1];
    if (char === '"' && inQuotes && next === '"') { cell += '"'; i++; }
    else if (char === '"') inQuotes = !inQuotes;
    else if (char === "," && !inQuotes) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  row.push(cell); rows.push(row);
  return rows;
}

function mapSheetRowToProduct(row, index) {
  const name = firstValue(row, ["name", "productName", "product", "title"]);
  const collection = firstValue(row, ["collection", "category", "range", "type"], "BELGERY Edit");
  return {
    id: firstValue(row, ["id", "productId", "sku", "slug"]) || slugify(name) || `product-${index + 1}`,
    name,
    collection,
    collectionTagline: firstValue(row, ["collectionTagline", "rangeTagline", "collectionSubtitle", "collectionMood", "tagline"]),
    collectionDescription: firstValue(row, ["collectionDescription", "collectionDesc", "rangeDescription", "rangeStory", "collectionStory"]),
    collectionCover: firstValue(row, ["collectionCover", "collectionImage", "rangeCover", "categoryImage", "coverImage"]),
    collectionRailImage: firstValue(row, ["collectionRailImage", "railImage", "railCover", "collectionCardImage", "collectionThumbnail"]),
    price: firstValue(row, ["price", "normalPrice", "regularPrice", "sellingPrice"]),
    salePrice: firstValue(row, ["salePrice", "discountPrice", "specialPrice"]),
    compareAtPrice: firstValue(row, ["compareAtPrice", "comparePrice", "oldPrice", "wasPrice", "originalPrice", "previousPrice"]),
    shortDescription: firstValue(row, ["shortDescription", "shortDesc", "cardDescription", "summary", "descriptionShort"]),
    description: firstValue(row, ["description", "productDescription", "mainDescription"]),
    material: firstValue(row, ["material", "materials", "leather", "fabric"]),
    dimensions: firstValue(row, ["dimensions", "dimension", "size", "measurements"]),
    available: firstValue(row, ["available", "availability", "status"], "YES"),
    sortOrder: firstValue(row, ["sortOrder", "sort", "order", "displayOrder"]),
    whatsappMessage: firstValue(row, ["whatsappMessage", "whatsapp", "enquiryMessage", "message"]),
    images: getImagesFromRow(row)
  };
}

function getImagesFromRow(row) {
  const images = [];
  const mainImage = firstValue(row, ["image", "mainImage", "productImage", "photo", "picture"]);
  if (mainImage) images.push(mainImage);
  for (let i = 1; i <= 6; i++) {
    const value = firstValue(row, [`image${i}`, `img${i}`, `photo${i}`, `picture${i}`, `productImage${i}`, `productPhoto${i}`]);
    if (value) images.push(value);
  }
  const gallery = firstValue(row, ["gallery", "images", "imageGallery", "photos", "photoGallery"]);
  if (gallery) gallery.split(/[|;]/).map(clean).filter(Boolean).slice(0, 6).forEach(image => images.push(image));
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
        description: "A curated selection of BELGERY pieces chosen for natural texture, practical detail and quiet luxury.",
        cover: product.images?.[0] || CONFIG.placeholderImage,
        products: []
      });
    }
    const collection = map.get(name);
    collection.products.push(product);
    if (product.collectionTagline) collection.tagline = product.collectionTagline;
    if (product.collectionDescription) collection.description = product.collectionDescription;
    if (product.collectionRailImage) collection.cover = resolveImage(product.collectionRailImage);
    else if (product.collectionCover) collection.cover = resolveImage(product.collectionCover);
  });

  const built = Array.from(map.values()).map(collection => ({ ...collection, description: smartDescription(collection) }));
  return [makeAllProductsCollection(products), ...built];
}

function makeAllProductsCollection(products) {
  return {
    name: "All Products",
    slug: "all-products",
    tagline: "Complete BELGERY catalogue",
    description: "Browse every available BELGERY piece in one place. Use the rail to narrow the catalogue by range, mood or product type.",
    cover: CONFIG.allProductsCover,
    products
  };
}

function smartDescription(collection) {
  if (collection.description && !collection.description.includes("curated selection of BELGERY")) return collection.description;
  const name = collection.name.toLowerCase();
  if (name.includes("bag")) return "Structured carry pieces with honest leather grain, built for daily use, work days and travel.";
  if (name.includes("belt")) return "Clean leather staples selected for shape, strength and everyday wear.";
  if (name.includes("wallet") || name.includes("card")) return "Small leather goods made for pockets, gifting and daily carry.";
  if (name.includes("wine")) return "Leather wine carriers designed for gifting, hosting and refined carry.";
  return collection.description;
}

function collectionRailCard(collection, index) {
  return `
    <button class="collection-rail-card ${collection.name === activeCollection ? "is-active" : ""}" type="button" data-collection="${escapeAttr(collection.name)}" style="--delay:${index * 35}ms">
      <div class="rail-wire-hanger" aria-hidden="true"><span class="rail-loop"></span><span class="rail-wire"></span></div>
      <span class="collection-count">${collection.products.length} piece${collection.products.length === 1 ? "" : "s"}</span>
      <img src="${escapeAttr(collection.cover)}" alt="${escapeAttr(collection.name)} collection" loading="lazy" onerror="this.src='${CONFIG.placeholderImage}'">
      <span class="collection-rail-copy">
        <small>${escapeHTML(collection.tagline)}</small>
        <strong>${escapeHTML(collection.name)}</strong>
        <em>${collection.name === "All Products" ? "View full catalogue" : "Open collection"}</em>
      </span>
    </button>`;
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
  activeCollection = activeCollection || collections[0].name;
  rail.innerHTML = collections.map(collectionRailCard).join("");
  const status = $("#collectionStatus");
  if (status) status.textContent = `${collections.length - 1} collections loaded + all products`;

  rail.querySelectorAll("[data-collection]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      if (didRailDrag) return;
      selectCollection(button.dataset.collection, { scroll: true, updateHash: true });
    });
  });

  setupRail(rail);
}

function selectCollection(name, options = {}) {
  const collection = collections.find(item => item.name === name) || collections[0];
  if (!collection) return;
  activeCollection = collection.name;
  activeCollectionObj = collection;

  $$("#collectionRail .collection-rail-card").forEach(card => {
    card.classList.toggle("is-active", card.dataset.collection === collection.name);
  });

  const title = $("#productsTitle");
  if (title) title.textContent = collection.name === "All Products" ? "All Products" : `${collection.name} pieces`;
  const note = $("#selectedCollectionNote");
  if (note) note.textContent = collection.description;

  renderGrid("#productsGrid", collection.products, { emptySelector: "#productsEmpty", collection });

  const whatsapp = $("#activeCollectionWhatsapp");
  if (whatsapp) whatsapp.href = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(`Hi BELGERY, I would like to ask about ${collection.name === "All Products" ? "your available products" : `the ${collection.name} collection`}.`)}`;

  if (options.updateHash !== false) history.replaceState(null, "", `#${encodeURIComponent(collection.name)}`);
  if (options.scroll) $("#catalogue-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setupRail(rail) {
  // Native scrolling on touch devices = smoothest on iPhone/WhatsApp browser.
  rail.style.overflowX = "auto";
  rail.style.webkitOverflowScrolling = "touch";

  let down = false, startX = 0, startLeft = 0, moved = false;
  const isTouch = matchMedia("(hover: none), (pointer: coarse)").matches;
  if (isTouch) return;

  rail.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    down = true; moved = false; didRailDrag = false;
    startX = event.clientX; startLeft = rail.scrollLeft;
    rail.setPointerCapture?.(event.pointerId);
    rail.classList.add("is-dragging");
  });
  rail.addEventListener("pointermove", event => {
    if (!down) return;
    const dx = event.clientX - startX;
    if (Math.abs(dx) > 14) {
      moved = true; didRailDrag = true;
      rail.scrollLeft = startLeft - dx;
      event.preventDefault();
    }
  });
  const end = event => {
    if (!down) return;
    down = false;
    rail.releasePointerCapture?.(event.pointerId);
    rail.classList.remove("is-dragging");
    setTimeout(() => { didRailDrag = false; }, moved ? 120 : 0);
  };
  rail.addEventListener("pointerup", end);
  rail.addEventListener("pointercancel", end);
  rail.addEventListener("pointerleave", end);
}

function renderGrid(selector, products, { emptySelector, collection } = {}) {
  const grid = $(selector);
  if (!grid) return;
  const empty = emptySelector ? $(emptySelector) : null;
  if (!products.length) {
    grid.innerHTML = "";
    empty?.classList.remove("hidden");
    return;
  }
  empty?.classList.add("hidden");
  grid.innerHTML = products.map(product => productCard(product, collection)).join("");
  grid.querySelectorAll("[data-open-product]").forEach(button => {
    button.addEventListener("click", () => openProduct(button.dataset.openProduct));
  });
}

function productCard(product, collection = activeCollectionObj) {
  const images = product.images?.length ? product.images : [CONFIG.placeholderImage];
  const note = product.shortDescription || product.description || collection?.description || "";
  const hasMany = images.length > 1;
  return `
    <article class="product-card">
      <button class="product-image" type="button" data-open-product="${escapeAttr(product.id)}" aria-label="View ${escapeAttr(product.name)}">
        <img src="${escapeAttr(images[0])}" alt="${escapeAttr(product.name)}" loading="lazy" onerror="this.src='${CONFIG.placeholderImage}'">
        ${hasMany ? `<span class="photo-dots" aria-hidden="true">${images.map((_, i) => `<i class="${i === 0 ? "active" : ""}"></i>`).join("")}</span>` : ""}
      </button>
      <div class="product-info">
        <p class="product-kicker">${escapeHTML(product.collection)}</p>
        <h3>${escapeHTML(product.name)}</h3>
        ${priceHTML(product)}
        ${note ? `<p class="card-note">${escapeHTML(note)}</p>` : ""}
        <div class="product-actions">
          <button class="small-btn" type="button" data-open-product="${escapeAttr(product.id)}">View piece</button>
          <a class="small-btn gold" href="${whatsAppLink(product)}" target="_blank" rel="noopener">Enquire</a>
        </div>
      </div>
    </article>`;
}

function priceHTML(product) {
  const current = product.salePrice || product.price;
  const old = product.salePrice ? (product.compareAtPrice || product.price) : product.compareAtPrice;
  if (!current && !old) return "";
  return `<div class="price-row">${current ? `<span class="price-current">R${escapeHTML(current).replace(/^R/i, "")}</span>` : ""}${old ? `<span class="price-old">R${escapeHTML(old).replace(/^R/i, "")}</span>` : ""}</div>${product.salePrice ? `<span class="sale-badge">Limited offer</span>` : ""}`;
}

function whatsAppLink(product) {
  const message = product.whatsappMessage || `Hi BELGERY, I would like to ask about ${product.name}.`;
  return `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

function openProduct(id) {
  const product = allProducts.find(item => item.id === id);
  const modal = $("#productModal");
  if (!product || !modal) return;
  const images = product.images?.length ? product.images : [CONFIG.placeholderImage];
  modal.innerHTML = `
    <div class="modal-inner">
      <button class="close-btn small-btn" type="button" data-close-modal>Close</button>
      <div class="modal-gallery">
        ${images.map(src => `<img src="${escapeAttr(src)}" alt="${escapeAttr(product.name)}" onerror="this.src='${CONFIG.placeholderImage}'">`).join("")}
      </div>
      <div class="modal-copy">
        <p class="eyebrow">${escapeHTML(product.collection)}</p>
        <h2>${escapeHTML(product.name)}</h2>
        ${priceHTML(product)}
        <p>${escapeHTML(product.description || product.shortDescription || activeCollectionObj?.description || "Message BELGERY to confirm availability, sizing and collection details.")}</p>
        <div class="modal-details">
          ${product.material ? `<div><strong>Material</strong><span>${escapeHTML(product.material)}</span></div>` : ""}
          ${product.dimensions ? `<div><strong>Size</strong><span>${escapeHTML(product.dimensions)}</span></div>` : ""}
          <div><strong>Photos</strong><span>${images.length} image${images.length === 1 ? "" : "s"}</span></div>
        </div>
        <a class="btn primary" href="${whatsAppLink(product)}" target="_blank" rel="noopener">Enquire on WhatsApp</a>
      </div>
    </div>`;
  modal.querySelector("[data-close-modal]")?.addEventListener("click", () => modal.close());
  modal.addEventListener("click", event => { if (event.target === modal) modal.close(); }, { once: true });
  modal.showModal();
}

function setupMenu() {
  const button = $("#menuToggle");
  const nav = $("#mainNav");
  if (!button || !nav) return;
  button.addEventListener("click", () => {
    const open = document.body.classList.toggle("menu-open");
    button.setAttribute("aria-expanded", String(open));
  });
  nav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
    document.body.classList.remove("menu-open");
    button.setAttribute("aria-expanded", "false");
  }));
}

async function init() {
  setupMenu();
  try {
    allProducts = await fetchProducts();
  } catch (error) {
    console.error(error);
    allProducts = [];
    $("#productsEmpty")?.classList.remove("hidden");
  }
  collections = buildCollections(allProducts);
  renderMainCollectionRail();
  const hash = decodeURIComponent(location.hash.replace("#", ""));
  const initial = collections.find(c => c.name === hash)?.name || "All Products";
  selectCollection(initial, { scroll: false, updateHash: false });
}

document.addEventListener("DOMContentLoaded", init);
