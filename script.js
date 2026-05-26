/* =========================================================
   BELGERY SHEET-ONLY CATALOGUE ENGINE — CLEAN CLIENT VERSION
   Replace your entire script.js with this file.

   Current display rules:
   - Product cards show: image, collection, name, price, buttons.
   - NO short description on product cards.
   - Product popup shows: gallery, name, price, longDescription/description,
     then "Additional information" with Material, Dimensions, Lead time.
   - Products still come ONLY from the published Google Sheet.
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

function clean(value) {
  return String(value ?? "").trim();
}

function normaliseKey(key) {
  return clean(key)
    .toLowerCase()
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

  return {
    id,
    name,
    collection: firstValue(row, ["collection", "category", "range", "type"], "BELGERY"),
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

  const mainImage = firstValue(row, ["image", "mainImage", "coverImage", "productImage", "photo", "picture"]);
  if (mainImage) images.push(mainImage);

  for (let i = 1; i <= 12; i++) {
    const value = firstValue(row, [`image${i}`, `img${i}`, `photo${i}`, `picture${i}`]);
    if (value) images.push(value);
  }

  const gallery = firstValue(row, ["gallery", "images", "imageGallery", "photos", "photoGallery"]);
  if (gallery) {
    gallery
      .split(/[|;]/)
      .map(clean)
      .filter(Boolean)
      .forEach(image => images.push(image));
  }

  return [...new Set(images)].map(resolveImage);
}

function resolveImage(src) {
  const value = clean(src);
  if (!value) return CONFIG.placeholderImage;

  if (/^(https?:)?\/\//i.test(value) || value.startsWith("data:")) return value;
  if (value.startsWith("assets/") || value.startsWith("./") || value.startsWith("/")) return value;

  return `${CONFIG.localProductImageFolder}${value}`;
}

function collectionList(products) {
  return ["All", ...new Set(products.map(product => clean(product.collection)).filter(Boolean))];
}

function productCard(product) {
  const mainImage = product.images?.[0] || CONFIG.placeholderImage;

  return `
    <article class="product-card" data-id="${escapeAttr(product.id)}" data-collection="${escapeAttr(product.collection)}">
      <button class="product-image" type="button" data-open-product="${escapeAttr(product.id)}" aria-label="Open ${escapeAttr(product.name)} gallery">
        <img src="${escapeAttr(mainImage)}" alt="${escapeAttr(product.name)}" loading="lazy" onerror="this.src='${CONFIG.placeholderImage}'">
      </button>

      <div class="product-info">
        <div class="product-kicker">
          <span>${escapeHTML(product.collection)}</span>
        </div>

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
    const coverProduct = items.find(product => product.images?.length) || items[0];
    const cover = coverProduct ? (coverProduct.images?.[0] || CONFIG.placeholderImage) : CONFIG.placeholderImage;

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
  $$("[data-open-product]").forEach(button => {
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
    ["Dimensions", product.dimensions],
    ["Lead time", product.leadTime]
  ].filter(([, value]) => clean(value));

  if (!details.length) return "";

  return `
    <div class="modal-section additional-information">
      <h3>Additional information</h3>
      <dl class="product-detail-list clean-details">
        ${details.map(([label, value]) => `
          <div>
            <dt>${escapeHTML(label)}</dt>
            <dd>${escapeHTML(value)}</dd>
          </div>
        `).join("")}
      </dl>
    </div>
  `;
}

function whatsappLink(product) {
  const msg =
    clean(product.whatsappMessage) ||
    `Hi BELGERY, I am interested in ${product.name}. Could you please send me more details?`;

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
      Check that the published CSV link is correct, public and not blocked.
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

  if (event.target.matches(".product-modal")) {
    event.target.close();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    const modal = $("#productModal");
    if (modal?.open) modal.close();
    document.body.classList.remove("menu-open");
  }
});

document.addEventListener("DOMContentLoaded", init);
