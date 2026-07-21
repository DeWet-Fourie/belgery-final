/* =========================================================
   BELGERY FINAL ENGINE — one page, smooth rail, 6 photos
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
let activeCollection = "";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clean = v => String(v ?? "").trim();
const key = v => clean(v).toLowerCase().replace(/^\uFEFF/, "").replace(/[\s_-]+/g, "").replace(/[^\w]/g, "");
const yes = v => ["YES","TRUE","1","Y","FEATURED"].includes(clean(v).toUpperCase());
const no = v => ["NO","FALSE","0","N","HIDDEN","UNAVAILABLE","SOLD"].includes(clean(v).toUpperCase());

function firstValue(row, keys, fallback = "") {
  for (const k of keys) {
    const value = row[key(k)];
    if (clean(value)) return clean(value);
  }
  return fallback;
}

function escapeHTML(str) {
  return clean(str).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));
}
const escapeAttr = escapeHTML;
const slugify = str => clean(str).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function csvToRows(csvText) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i], next = csvText[i + 1];
    if (ch === '"' && quoted && next === '"') { cell += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  row.push(cell); rows.push(row);
  return rows;
}

function parseCSV(text) {
  if (!clean(text)) return [];
  const rows = csvToRows(text);
  const headers = rows.shift().map(key);
  return rows.filter(r => r.some(clean)).map(r => {
    const obj = {};
    headers.forEach((h, i) => { if (h) obj[h] = clean(r[i]); });
    return obj;
  });
}

function sheetUrl() {
  const sep = CONFIG.productsCsvUrl.includes("?") ? "&" : "?";
  return `${CONFIG.productsCsvUrl}${sep}cacheBust=${Date.now()}`;
}

async function fetchProducts() {
  const res = await fetch(sheetUrl(), { cache: "no-store" });
  if (!res.ok) throw new Error(`Google Sheet fetch failed: ${res.status}`);
  const rows = parseCSV(await res.text());
  return rows.map(mapRowToProduct)
    .filter(p => clean(p.name))
    .filter(p => !no(p.available))
    .sort((a, b) => Number(clean(a.sortOrder) || 9999) - Number(clean(b.sortOrder) || 9999));
}

function mapRowToProduct(row, index) {
  const name = firstValue(row, ["name", "productName", "product", "title"]);
  const id = firstValue(row, ["id", "productId", "sku", "slug"]) || slugify(name) || `product-${index + 1}`;
  const collection = firstValue(row, ["collection", "category", "range", "type"], "BELGERY Edit");
  return {
    id, name, collection,
    collectionTagline: firstValue(row, ["collectionTagline", "rangeTagline", "collectionSubtitle", "collectionMood", "tagline"]),
    collectionDescription: firstValue(row, ["collectionDescription", "collectionDesc", "rangeDescription", "rangeStory", "collectionStory"]),
    collectionCover: firstValue(row, ["collectionCover", "collectionImage", "rangeCover", "categoryImage", "coverImage"]),
    collectionRailImage: firstValue(row, ["collectionRailImage", "railImage", "railCover", "collectionCardImage", "collectionThumbnail"]),
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
    images: getImages(row)
  };
}

function getImages(row) {
  const images = [];
  const main = firstValue(row, ["image", "mainImage", "productImage", "photo", "picture"]);
  if (main) images.push(main);
  for (let i = 1; i <= 6; i++) {
    const v = firstValue(row, [`image${i}`, `img${i}`, `photo${i}`, `picture${i}`, `productImage${i}`, `productPhoto${i}`]);
    if (v) images.push(v);
  }
  const gallery = firstValue(row, ["gallery", "images", "imageGallery", "photos", "photoGallery"]);
  if (gallery) gallery.split(/[|;]/).map(clean).filter(Boolean).forEach(v => images.push(v));
  return [...new Set(images)].slice(0, 6).map(resolveImage);
}

function resolveImage(src) {
  const v = clean(src);
  if (!v) return CONFIG.placeholderImage;
  if (/^(https?:)?\/\//i.test(v) || v.startsWith("data:")) return v;
  if (v.startsWith("assets/") || v.startsWith("./") || v.startsWith("/")) return v;
  return `${CONFIG.localProductImageFolder}${v}`;
}

function smartDescription(collection) {
  if (collection.description && !collection.description.includes("curated selection of handmade")) return collection.description;
  const name = collection.name.toLowerCase();
  if (name.includes("bag")) return "Structured carry pieces with honest leather grain, built for daily use, work days and travel without losing the handmade character that makes every piece feel personal.";
  if (name.includes("belt")) return "Clean leather staples selected for shape, strength and everyday wear — simple enough to use daily, refined enough to finish the outfit.";
  if (name.includes("wallet") || name.includes("card")) return "Small leather goods made for pockets, gifting and daily carry, with compact details that age beautifully through use.";
  if (name.includes("wine")) return "Leather pieces built around gifting, hosting and the quiet details that make an ordinary bottle feel considered.";
  return collection.description || "A curated selection of handmade BELGERY pieces chosen for natural texture, practical detail and quieter luxury.";
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
        products: []
      });
    }
    const col = map.get(name);
    col.products.push(product);
    if (clean(product.collectionTagline)) col.tagline = clean(product.collectionTagline);
    if (clean(product.collectionDescription)) col.description = clean(product.collectionDescription);
    if (clean(product.collectionRailImage)) col.cover = resolveImage(product.collectionRailImage);
    else if (clean(product.collectionCover)) col.cover = resolveImage(product.collectionCover);
    else if (!col.cover || col.cover === CONFIG.placeholderImage) col.cover = product.images?.[0] || CONFIG.placeholderImage;
  });
  const base = Array.from(map.values()).map(c => ({ ...c, description: smartDescription(c) }));
  return [{
    name: "All Products",
    slug: "all-products",
    tagline: "Complete BELGERY catalogue",
    description: "Browse every available BELGERY piece in one place. Use the collection rail to narrow the catalogue by range, mood or product type.",
    cover: CONFIG.allProductsCover,
    products,
    isAllProducts: true
  }, ...base];
}

function railCard(collection, index) {
  const isAll = collection.isAllProducts;
  return `
    <button class="collection-rail-card ${isAll ? "all-products-card" : ""} ${collection.name === activeCollection ? "is-active" : ""}" type="button" data-collection="${escapeAttr(collection.name)}" style="--delay:${index * 35}ms">
      <div class="rail-wire-hanger" aria-hidden="true"><span class="rail-loop"></span><span class="rail-wire"></span></div>
      <span class="collection-count">${collection.products.length} piece${collection.products.length === 1 ? "" : "s"}</span>
      <img src="${escapeAttr(collection.cover)}" alt="${escapeAttr(collection.name)} collection" loading="lazy" onerror="this.src='${CONFIG.placeholderImage}'">
      <span class="collection-rail-copy">
        <small>${escapeHTML(collection.tagline)}</small>
        <strong>${escapeHTML(collection.name)}</strong>
        <em>${isAll ? "View full catalogue" : "Open collection"}</em>
      </span>
    </button>`;
}

function renderRail() {
  const rail = $("#collectionRail");
  if (!rail) return;
  if (!collections.length) { rail.innerHTML = ""; return; }
  if (!activeCollection) activeCollection = collections[0].name;
  rail.innerHTML = collections.map(railCard).join("");
  const status = $("#collectionStatus");
  if (status) status.textContent = `${Math.max(collections.length - 1, 0)} collections loaded + all products`;
  rail.onclick = event => {
    const button = event.target.closest("[data-collection]");
    if (!button || !rail.contains(button)) return;
    if (rail.dataset.wasDragging === "true") return;
    selectCollection(button.dataset.collection, { scroll: true, updateHash: true });
  };
  setupRailScroll(rail);
}

function setupRailScroll(rail) {
  if (!rail || rail.dataset.ready === "true") return;
  rail.dataset.ready = "true";
  rail.style.overflowX = "auto";
  rail.style.webkitOverflowScrolling = "touch";

  const touchDevice = matchMedia("(hover:none), (pointer:coarse)").matches;
  if (touchDevice) return;

  let down = false, startX = 0, startLeft = 0, moved = false;
  rail.addEventListener("pointerdown", e => {
    if (e.button !== 0) return;
    down = true; moved = false; rail.dataset.wasDragging = "false";
    startX = e.clientX; startLeft = rail.scrollLeft; rail.classList.add("is-dragging");
  });
  rail.addEventListener("pointermove", e => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 12) { moved = true; rail.dataset.wasDragging = "true"; rail.scrollLeft = startLeft - dx; }
  }, { passive: true });
  const end = () => {
    if (!down) return;
    down = false; rail.classList.remove("is-dragging");
    setTimeout(() => { rail.dataset.wasDragging = "false"; }, moved ? 140 : 0);
  };
  rail.addEventListener("pointerup", end);
  rail.addEventListener("pointercancel", end);
  rail.addEventListener("pointerleave", end);
}

function selectCollection(name, options = {}) {
  const wanted = clean(name).toLowerCase();
  const collection = collections.find(c => c.name.toLowerCase() === wanted) || collections[0];
  if (!collection) return;
  activeCollection = collection.name;
  $$("#collectionRail .collection-rail-card").forEach(card => card.classList.toggle("is-active", clean(card.dataset.collection).toLowerCase() === collection.name.toLowerCase()));
  renderGrid("#productsGrid", collection.products, { emptySelector: "#productsEmpty", collection });
  const title = $("#productsTitle");
  if (title) title.textContent = cleanCollectionHeading(collection.name);
  const note = $("#selectedCollectionNote");
  if (note) note.textContent = "";
  const whatsapp = $("#activeCollectionWhatsapp");
  if (whatsapp) {
    const message = collection.isAllProducts ? "Hi BELGERY, I would like to ask about your available products." : `Hi BELGERY, I would like to ask about the ${collection.name} collection.`;
    whatsapp.href = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
  }
  if (options.updateHash !== false) history.replaceState(null, "", collection.isAllProducts ? "#all-products" : `#${encodeURIComponent(collection.name)}`);
  if (options.scroll) $("#catalogue-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function productCard(product, collection) {
  const img = product.images?.[0] || CONFIG.placeholderImage;
  return `
    <article class="product-card" data-id="${escapeAttr(product.id)}">
      <button class="product-image" type="button" data-open-product="${escapeAttr(product.id)}" aria-label="Open ${escapeAttr(product.name)} gallery">
        <img src="${escapeAttr(img)}" alt="${escapeAttr(product.name)}" loading="lazy" onerror="this.src='${CONFIG.placeholderImage}'">
        ${photoDots(product)}
      </button>
      <div class="product-info">
        <p class="product-kicker">${escapeHTML(product.collection)}</p>
        <h3>${escapeHTML(product.name)}</h3>
        ${priceHTML(product)}
        <div class="product-actions">
          <button class="small-btn" type="button" data-open-product="${escapeAttr(product.id)}">View piece</button>
          <a class="small-btn gold" href="${whatsappLink(product)}" target="_blank" rel="noopener">Enquire</a>
        </div>
      </div>
    </article>`;
}

function photoDots(product) {
  const count = Math.min((product.images || []).filter(Boolean).length, 6);
  if (count <= 1) return "";
  return `<span class="photo-dots" aria-label="${count} photos available">${Array.from({length: count}, (_, i) => `<i class="${i === 0 ? "active" : ""}"></i>`).join("")}</span>`;
}

function priceHTML(product) {
  if (clean(product.salePrice) && clean(product.compareAtPrice)) {
    return `<div class="price-row"><span class="price-current">${escapeHTML(product.salePrice)}</span><span class="price-old">${escapeHTML(product.compareAtPrice)}</span></div><span class="sale-badge">Limited offer</span>`;
  }
  return `<div class="price-row"><span class="price-current">${escapeHTML(clean(product.price) || "Price on request")}</span></div>`;
}

function renderGrid(selector, products, options = {}) {
  const grid = $(selector);
  if (!grid) return;
  let items = [...products];
  if (options.featuredOnly) items = items.filter(p => yes(p.featured));
  if (options.limit) items = items.slice(0, options.limit);
  grid.innerHTML = items.map(p => productCard(p, options.collection)).join("");
  const empty = $(options.emptySelector);
  if (empty) empty.classList.toggle("hidden", items.length > 0);
  bindProductButtons();
}

function bindProductButtons() {
  $$('[data-open-product]').forEach(btn => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = "true";
    btn.addEventListener("click", () => openProduct(btn.dataset.openProduct));
  });
}

function openProduct(id) {
  const product = allProducts.find(p => clean(p.id) === clean(id));
  const modal = $("#productModal");
  if (!product || !modal) return;
  const images = product.images?.length ? product.images : [CONFIG.placeholderImage];
  const description = clean(product.longDescription) || clean(product.description) || clean(product.shortDescription);
  modal.innerHTML = `
    <div class="modal-inner upgraded-product-modal">
      <button class="modal-close" type="button" onclick="document.getElementById('productModal').close()" aria-label="Close product">×</button>
      <section class="modal-visual-panel" aria-label="${escapeAttr(product.name)} image gallery">
        <div class="modal-gallery">
          ${images.map((src, index) => `<figure class="modal-photo"><img src="${escapeAttr(src)}" alt="${escapeAttr(product.name)} photo ${index + 1}" onerror="this.src='${CONFIG.placeholderImage}'"></figure>`).join("")}
        </div>
        ${images.length > 1 ? `<div class="modal-thumb-strip" aria-label="${images.length} product photos">${images.map((src, index) => `<span class="modal-thumb"><img src="${escapeAttr(src)}" alt="${escapeAttr(product.name)} thumbnail ${index + 1}" onerror="this.src='${CONFIG.placeholderImage}'"></span>`).join("")}</div>` : ""}
      </section>
      <section class="modal-copy modal-sheet-copy">
        <p class="eyebrow">${escapeHTML(product.collection || "BELGERY")}</p>
        <h2>${escapeHTML(product.name)}</h2>
        ${priceHTML(product)}
        ${description ? `<div class="modal-description-block">
          <h3>Description</h3>
          <p>${escapeHTML(description)}</p>
        </div>` : ""}
        <a class="btn primary modal-whatsapp" target="_blank" rel="noopener" href="${whatsappLink(product)}">Enquire on WhatsApp</a>
      </section>
    </div>`;
  modal.showModal();
  requestAnimationFrame(() => {
    const inner = modal.querySelector('.upgraded-product-modal');
    const gallery = modal.querySelector('.modal-gallery');
    if (inner) inner.scrollTop = 0;
    if (gallery) gallery.scrollLeft = 0;
    modal.querySelectorAll('.modal-thumb').forEach((thumb, index) => {
      thumb.addEventListener('click', () => {
        const target = gallery?.querySelectorAll('.modal-photo')[index];
        if (target) target.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      });
    });
  });
}

function detailsHTML(product) {
  const details = [
    ["Short description", product.shortDescription],
    ["Material", product.material],
    ["Dimensions", product.dimensions],
    ["Lead time", product.leadTime],
    ["Collection", product.collection],
    ["Availability", product.available],
    ["Product ID", product.id]
  ].filter(([,v]) => clean(v));
  if (!details.length) return "";
  return `<div class="modal-details"><h3>Additional information</h3>${details.map(([k,v]) => `<div><strong>${escapeHTML(k)}</strong><span>${escapeHTML(v)}</span></div>`).join("")}</div>`;
}

function whatsappLink(product) {
  const msg = clean(product.whatsappMessage) || `Hi BELGERY, I am interested in ${product.name}. Could you please send me more details?`;
  return `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(msg)}`;
}


function cleanCollectionHeading(value) {
  const raw = clean(value);
  if (!raw) return "Pieces";
  if (raw.toLowerCase() === "all products") return "All Products";
  // Never show the added word "products" after a selected collection.
  return raw.replace(/\s+products?$/i, "");
}

function forceCleanCollectionHeading() {
  const title = document.getElementById("productsTitle");
  if (!title) return;
  const cleaned = cleanCollectionHeading(title.textContent);
  if (title.textContent !== cleaned) title.textContent = cleaned;
}

function initHashCollection() {
  const raw = decodeURIComponent(location.hash.replace("#", ""));
  if (!raw) return "All Products";
  if (raw.toLowerCase() === "all-products" || raw.toLowerCase() === "all products") return "All Products";
  return collections.find(c => c.name.toLowerCase() === raw.toLowerCase())?.name || "All Products";
}

function showError(error) {
  console.error(error);
  const html = `<div class="sheet-error"><strong>Google Sheet did not load.</strong><br>Check that the published CSV link is public and correct.</div>`;
  ["#collectionRail", "#productsGrid"].forEach(s => { const el = $(s); if (el) el.innerHTML = html; });
  const status = $("#collectionStatus");
  if (status) status.textContent = "Could not load the collection rail.";
}

async function init() {
  document.body.classList.add("laser-ready");
  try {
    allProducts = await fetchProducts();
    collections = buildCollections(allProducts);
    activeCollection = initHashCollection();
    renderRail();
    selectCollection(activeCollection, { updateHash: false });
  } catch (e) { showError(e); }
}

document.addEventListener("click", event => {
  const toggle = event.target.closest(".menu-toggle");
  if (toggle) {
    const open = document.body.classList.toggle("menu-open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }
  if (event.target.closest(".nav a")) document.body.classList.remove("menu-open");
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


/* Exact animation support: reveal header after supplied intro animation has played. */
(function(){
  function revealHeader(){
    const header = document.querySelector('.site-header');
    if (!header) return;
    setTimeout(() => {
      header.classList.add('header-revealed');
      header.style.opacity = '1';
      header.style.pointerEvents = 'auto';
      header.style.transform = 'translateX(-50%)';
    }, 3350);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', revealHeader);
  else revealHeader();
})();


/* Hard lock: remove accidental "products" word from selected collection heading. */
(function(){
  function startHeadingCleaner(){
    forceCleanCollectionHeading();
    const title = document.getElementById("productsTitle");
    if (!title) return;
    new MutationObserver(forceCleanCollectionHeading).observe(title, { childList:true, characterData:true, subtree:true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startHeadingCleaner);
  else startHeadingCleaner();
})();
