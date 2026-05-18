/* =========================================================
   BELGERY SHEET-ONLY CATALOGUE ENGINE
   Final version: ZERO hard-coded products.

   What this does:
   - Reads the published Google Sheet CSV below.
   - Creates one product card for every valid sheet row.
   - Creates collections automatically from the `collection` column.
   - Supports Cloudinary URLs in image1-image8 and gallery.
   - If `available` = NO/FALSE/0, product is hidden.
   - If `featured` = YES/TRUE/1, product appears on homepage.
   ========================================================= */

const CONFIG = {
  productsCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTQOWR3E1sjd7wLZDDx66hSNLB3C_bCQfJZwaCSmRNvStwGasp6Yx1ICc3mP5-z_24RmCVOm8JdKHnz/pub?gid=0&single=true&output=csv",
  whatsappNumber: "27769925371",
  localProductImageFolder: "assets/products/",
  placeholderImage: "assets/products/placeholder.svg"
};

let allProducts = [];
let activeCollection = "All";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const clean = value => String(value ?? "").trim();
const yes = value => ["YES", "TRUE", "1", "Y"].includes(clean(value).toUpperCase());
const no = value => ["NO", "FALSE", "0", "N"].includes(clean(value).toUpperCase());

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
    .filter(product => clean(product.name))
    .filter(product => !no(product.available))
    .map((product, index) => ({
      ...product,
      id: clean(product.id) || slugify(product.name) || `product-${index + 1}`
    }))
    .sort((a, b) => Number(clean(a.sortOrder) || 9999) - Number(clean(b.sortOrder) || 9999));
}

function parseCSV(text) {
  const trimmed = clean(text);
  if (!trimmed) return [];

  const rows = csvToRows(trimmed);
  if (!rows.length) return [];

  const headers = rows.shift().map(header => clean(header));

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

function resolveImage(src) {
  const value = clean(src);
  if (!value) return CONFIG.placeholderImage;

  // Cloudinary/full web URLs are used directly.
  if (/^(https?:)?\/\//i.test(value) || value.startsWith("data:")) return value;

  // Local paths still work, but are optional.
  if (value.startsWith("assets/") || value.startsWith("./") || value.startsWith("/")) return value;

  // Filename-only fallback, e.g. product-1.jpg => assets/products/product-1.jpg
  return `${CONFIG.localProductImageFolder}${value}`;
}

function getImages(product) {
  const numbered = [1, 2, 3, 4, 5, 6, 7, 8]
    .map(number => clean(product[`image${number}`]))
    .filter(Boolean);

  const gallery = clean(product.gallery)
    ? clean(product.gallery).split(/[|,]/).map(clean).filter(Boolean)
    : [];

  return [...new Set([...numbered, ...gallery])].map(resolveImage);
}

function collectionList(products) {
  return ["All", ...new Set(products.map(product => clean(product.collection)).filter(Boolean))];
}

function productCard(product) {
  const images = getImages(product);
  const mainImage = images[0] || CONFIG.placeholderImage;
  const price = clean(product.price) || "Price on request";
  const collection = clean(product.collection) || "BELGERY";
  const shortDescription = clean(product.shortDescription) || clean(product.description) || "Handmade leather piece from BELGERY.";

  return `
    <article class="product-card" data-id="${escapeAttr(product.id)}" data-collection="${escapeAttr(collection)}">
      <div class="product-image">
        <img src="${escapeAttr(mainImage)}" alt="${escapeAttr(product.name)}" loading="lazy" onerror="this.src='${CONFIG.placeholderImage}'">
      </div>
      <div class="product-info">
        <div class="product-kicker"><span>${escapeHTML(collection)}</span><span>Available</span></div>
        <h3>${escapeHTML(product.name)}</h3>
        <div class="price">${escapeHTML(price)}</div>
        <p>${escapeHTML(shortDescription)}</p>
        <div class="product-actions">
          <button class="small-btn" type="button" data-open-product="${escapeAttr(product.id)}">View details</button>
          <a class="small-btn gold" href="${whatsappLink(product)}" target="_blank" rel="noopener">Enquire</a>
        </div>
      </div>
    </article>
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

function renderFilters() {
  const wrap = $("#collectionFilters");
  if (!wrap) return;

  const collections = collectionList(allProducts);
  wrap.innerHTML = collections.map(collection => `
    <button class="filter-btn ${collection === activeCollection ? "active" : ""}" type="button" data-filter="${escapeAttr(collection)}">
      ${escapeHTML(collection)}
    </button>
  `).join("");

  $$(".filter-btn", wrap).forEach(button => {
    button.addEventListener("click", () => {
      activeCollection = button.dataset.filter;
      $$(".filter-btn", wrap).forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");

      const filteredProducts = activeCollection === "All"
        ? allProducts
        : allProducts.filter(product => clean(product.collection) === activeCollection);

      renderGrid("#productsGrid", filteredProducts, { emptySelector: "#productsEmpty" });
    });
  });
}

function renderCollectionCards() {
  const wrap = $("#collectionCards");
  if (!wrap) return;

  const names = collectionList(allProducts).filter(collection => collection !== "All");

  wrap.innerHTML = names.map(name => {
    const items = allProducts.filter(product => clean(product.collection) === name);
    const coverProduct = items.find(product => getImages(product).length) || items[0];
    const cover = coverProduct ? (getImages(coverProduct)[0] || CONFIG.placeholderImage) : CONFIG.placeholderImage;

    return `
      <a class="collection-card" href="products.html#${encodeURIComponent(name)}" data-collection-card="${escapeAttr(name)}">
        <img src="${escapeAttr(cover)}" alt="${escapeAttr(name)} collection" loading="lazy" onerror="this.src='${CONFIG.placeholderImage}'">
        <div>
          <p class="eyebrow">${items.length} piece${items.length === 1 ? "" : "s"}</p>
          <h2>${escapeHTML(name)}</h2>
          <p>Explore handmade BELGERY pieces in this collection.</p>
        </div>
      </a>
    `;
  }).join("");

  const empty = $("#collectionsEmpty");
  if (empty) empty.classList.toggle("hidden", names.length > 0);
}

function bindProductButtons() {
  $$('[data-open-product]').forEach(button => {
    button.addEventListener("click", () => openProduct(button.dataset.openProduct));
  });
}

function openProduct(id) {
  const product = allProducts.find(item => clean(item.id) === clean(id));
  const modal = $("#productModal");
  if (!product || !modal) return;

  const images = getImages(product);
  const longDescription = clean(product.longDescription) || clean(product.description) || clean(product.shortDescription) || "Contact BELGERY for more details about this piece.";

  modal.innerHTML = `
    <div class="modal-inner">
      <button class="small-btn close-btn" type="button" onclick="document.getElementById('productModal').close()">Close</button>
      <div class="modal-gallery">
        ${(images.length ? images : [CONFIG.placeholderImage]).map(img => `
          <img src="${escapeAttr(img)}" alt="${escapeAttr(product.name)}" onerror="this.src='${CONFIG.placeholderImage}'">
        `).join("")}
      </div>
      <div class="modal-copy">
        <p class="eyebrow">${escapeHTML(clean(product.collection) || "BELGERY")}</p>
        <h2>${escapeHTML(product.name)}</h2>
        <p class="price">${escapeHTML(clean(product.price) || "Price on request")}</p>
        <p>${escapeHTML(longDescription)}</p>
        ${detailLine("Material", product.material)}
        ${detailLine("Dimensions", product.dimensions)}
        ${detailLine("Lead time", product.leadTime)}
        <a class="liquid-btn" target="_blank" rel="noopener" href="${whatsappLink(product)}">Enquire on WhatsApp</a>
      </div>
    </div>
  `;

  modal.showModal();
}

function detailLine(label, value) {
  return clean(value) ? `<p><strong>${label}:</strong> ${escapeHTML(value)}</p>` : "";
}

function whatsappLink(product) {
  const msg = clean(product.whatsappMessage) || `Hi BELGERY, I am interested in ${product.name}. Could you please send me more details?`;
  return `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(msg)}`;
}

function escapeHTML(str) {
  return clean(str).replace(/[&<>"]/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[char]));
}

function escapeAttr(str) {
  return escapeHTML(str).replace(/'/g, "&#039;");
}

function slugify(str) {
  return clean(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function showSheetError(error) {
  console.error(error);
  const message = `
    <div class="sheet-error">
      <strong>Google Sheet did not load.</strong><br>
      Check that the published CSV link is correct and public.
    </div>
  `;

  ["#featuredProducts", "#productsGrid", "#collectionCards"]
    .map($)
    .filter(Boolean)
    .forEach(target => target.innerHTML = message);
}

async function init() {
  try {
    allProducts = await fetchProducts();

    renderGrid("#featuredProducts", allProducts, {
      featuredOnly: true,
      limit: Number($("#featuredProducts")?.dataset.productLimit || 6),
      emptySelector: "#featuredEmpty"
    });

    renderFilters();
    renderGrid("#productsGrid", allProducts, { emptySelector: "#productsEmpty" });
    renderCollectionCards();

    const hashCollection = decodeURIComponent(location.hash.replace("#", ""));
    if (hashCollection && $("#collectionFilters")) {
      const button = $$("#collectionFilters .filter-btn").find(btn => btn.dataset.filter === hashCollection);
      if (button) button.click();
    }
  } catch (error) {
    showSheetError(error);
  }
}

document.addEventListener("DOMContentLoaded", init);
