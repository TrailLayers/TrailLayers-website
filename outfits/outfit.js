/**
 * outfit.js — Shared Outfit page controller
 *
 * URL format: traillayers.app/outfits/?id=<uuid>
 */

import { SUPABASE_URL, CDN_BASE, APP_STORE_URL } from "../shared/constants.js";

let currentGarments = [];
let currentPins = [];
let selectedGarmentID = null;

function getToken() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id") ?? null;
}

function edgeFunctionUrl(token) {
  return `${SUPABASE_URL}/functions/v1/get-shared-outfit?token=${encodeURIComponent(token)}`;
}

function showState(id) {
  const ids = ["state-loading", "state-error", "state-content"];
  const main = document.getElementById("outfit-main");
  const stateName = id.replace("state-", "");

  if (main) {
    main.dataset.state = stateName;
  }

  ids.forEach((panelId) => {
    const el = document.getElementById(panelId);
    if (!el) return;

    const isActive = panelId === id;
    el.hidden = !isActive;

    if (isActive && panelId === "state-loading") {
      el.setAttribute("aria-busy", "true");
    } else {
      el.removeAttribute("aria-busy");
    }
  });
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function formatPrice(price) {
  if (price === null || price === undefined || price === "") return "";
  const value = Number(price);
  if (Number.isNaN(value)) return String(price);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function titleCase(str) {
  if (!str) return "";
  return String(str)
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function insulationLabel(level) {
  const map = {
    none: "Uninsulated",
    light: "Light insulation",
    medium: "Medium insulation",
    heavy: "Heavy insulation",
    synthetic: "Synthetic insulation",
    down: "Down insulation",
  };
  return map[level?.toLowerCase()] ?? titleCase(level);
}

function placeholderIconHTML(ariaLabel) {
  return `
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.4"
         stroke-linecap="round" stroke-linejoin="round"
         role="img" aria-label="${escapeHtml(ariaLabel)}">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  `;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function garmentImageURL(garment) {
  return garment?.imagePath ? `${CDN_BASE}/garments/${garment.imagePath}` : null;
}

function renderHero(outfit, sharedBy, sharedByUsername) {
  const activityEl = document.getElementById("outfit-activity");
  if (activityEl) {
    activityEl.textContent = outfit.intendedActivityType
      ? titleCase(outfit.intendedActivityType)
      : "Shared Kit";
  }

  const nameEl = document.getElementById("outfit-name");
  if (nameEl) {
    nameEl.textContent = outfit.name || "Untitled Outfit";
    document.title = `${outfit.name || "Outfit"} — TrailLayers`;
  }

  const sharedByEl = document.getElementById("shared-by");
  if (sharedByEl) {
    if (sharedBy) {
      if (sharedByUsername) {
        sharedByEl.innerHTML = `Shared by <a href="/profile/?u=${encodeURIComponent(sharedByUsername)}" class="shared-by-link">${escapeHtml(sharedBy)}</a>`;
      } else {
        sharedByEl.textContent = `Shared by ${sharedBy}`;
      }
      sharedByEl.hidden = false;
    } else {
      sharedByEl.hidden = true;
    }
  }

  const dateEl = document.getElementById("outfit-date");
  if (dateEl && outfit.createdAt) {
    dateEl.textContent = `Saved ${formatDate(outfit.createdAt)}`;
  }
}

function renderOutfitPhoto(outfit, pins) {
  const imageWrap = document.getElementById("outfit-image-wrap");
  const helper = document.getElementById("photo-helper");
  if (!imageWrap) return;

  imageWrap.replaceChildren();

  if (outfit.imagePath) {
    const img = document.createElement("img");
    img.src = `${CDN_BASE}/outfits/${outfit.imagePath}`;
    img.alt = `${outfit.name || "Outfit"} tagged photo`;
    img.loading = "eager";
    img.decoding = "async";
    imageWrap.appendChild(img);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "outfit-image-placeholder";
    placeholder.innerHTML = `
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="1.4"
           stroke-linecap="round" stroke-linejoin="round"
           aria-hidden="true">
        <path d="M4 5a1 1 0 0 1 1-1h4l2 3h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5z"/>
        <circle cx="10" cy="12" r="2"/>
        <path d="m20 18-4-4-2 2-2-2-4 4"/>
      </svg>
    `;
    imageWrap.appendChild(placeholder);
  }

  const usablePins = pins.filter((pin) => pin.garmentID && pin.x !== null && pin.y !== null);
  usablePins.forEach((pin) => {
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "photo-pin";
    marker.style.setProperty("--pin-x", Number(pin.x));
    marker.style.setProperty("--pin-y", Number(pin.y));
    marker.dataset.garmentId = pin.garmentID;
    marker.setAttribute("aria-label", `Show ${garmentName(pin.garmentID)}`);
    marker.addEventListener("click", () => selectGarment(pin.garmentID, { scroll: false }));
    imageWrap.appendChild(marker);
  });

  if (helper) {
    helper.hidden = usablePins.length === 0;
  }
}

function garmentName(id) {
  return currentGarments.find((garment) => garment.id === id)?.name || "garment";
}

function buildMetaLine(garment) {
  return [
    garment.brand,
    titleCase(garment.category),
    titleCase(garment.subcategory),
  ].filter(Boolean).join(" · ");
}

function buildPills(garment) {
  const metaDiv = document.createElement("div");
  metaDiv.className = "garment-card-meta";
  const pills = [
    garment.category,
    garment.subcategory,
    garment.color,
    garment.material,
  ].filter(Boolean);

  pills.forEach((text) => {
    const pill = document.createElement("span");
    pill.className = "garment-pill";
    pill.textContent = titleCase(text);
    metaDiv.appendChild(pill);
  });

  return metaDiv;
}

function buildBadges(garment) {
  const badgesDiv = document.createElement("div");
  badgesDiv.className = "garment-badges";

  if (garment.waterproof) {
    const badge = document.createElement("span");
    badge.className = "badge badge-waterproof";
    badge.innerHTML = `
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.4"
           stroke-linecap="round" stroke-linejoin="round"
           aria-hidden="true">
        <path d="M12 2C6 10 4 14.5 4 17a8 8 0 0 0 16 0c0-2.5-2-7-8-15z"/>
      </svg>
      Waterproof
    `;
    badgesDiv.appendChild(badge);
  }

  if (garment.windResistant) {
    const badge = document.createElement("span");
    badge.className = "badge badge-wind";
    badge.innerHTML = `
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.4"
           stroke-linecap="round" stroke-linejoin="round"
           aria-hidden="true">
        <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/>
        <path d="M9.6 4.6A2 2 0 1 1 11 8H2"/>
        <path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>
      </svg>
      Wind resistant
    `;
    badgesDiv.appendChild(badge);
  }

  if (garment.insulationLevel && garment.insulationLevel !== "none") {
    const badge = document.createElement("span");
    badge.className = "badge badge-insulation";
    badge.innerHTML = `
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.4"
           stroke-linecap="round" stroke-linejoin="round"
           aria-hidden="true">
        <path d="M12 2v20M2 12h20"/>
        <path d="m4.93 4.93 14.14 14.14M19.07 4.93 4.93 19.07"/>
      </svg>
      ${insulationLabel(garment.insulationLevel)}
    `;
    badgesDiv.appendChild(badge);
  }

  return badgesDiv;
}

// ----------------------------------------------------------
// Temperature bar
// ----------------------------------------------------------

/**
 * Full display scale in °F — matches iOS GarmentTemperatureBar exactly.
 * @type {number}
 */
const TEMP_SCALE_MIN = -10;
const TEMP_SCALE_MAX = 110;

/**
 * Converts a temperature value to a 0–1 fraction within the display scale.
 * Clamps to the scale boundaries.
 * @param {number} tempF
 * @returns {number}
 */
function tempFraction(tempF) {
  const clamped = Math.max(TEMP_SCALE_MIN, Math.min(TEMP_SCALE_MAX, tempF));
  return (clamped - TEMP_SCALE_MIN) / (TEMP_SCALE_MAX - TEMP_SCALE_MIN);
}

/**
 * Formats a °F value for display (integer, no decimals).
 * @param {number} tempF
 * @returns {string}
 */
function formatTempF(tempF) {
  return `${Math.round(tempF)}°F`;
}

/**
 * Derives the worn lo/hi range from weatherStats, handling the asymmetric-nil
 * case the same way iOS OutfitTemperatureBarView does:
 *   (lo, hi) → (lo, hi)
 *   (lo, null) → point range at lo
 *   (null, hi) → point range at hi
 *   (null, null) → null (no temp data)
 *
 * @param {{ tempMin: number|null, tempMax: number|null }} stats
 * @returns {{ lo: number, hi: number } | null}
 */
function wornRange(stats) {
  const { tempMin, tempMax } = stats;
  if (tempMin !== null && tempMax !== null) return { lo: tempMin, hi: tempMax };
  if (tempMin !== null) return { lo: tempMin, hi: tempMin };
  if (tempMax !== null) return { lo: tempMax, hi: tempMax };
  return null;
}

/**
 * Renders the temperature bar into #outfit-weather-section.
 * Shows nothing when weatherStats is absent, wearCount is 0, or both
 * tempMin and tempMax are null.
 *
 * @param {{ wearCount: number, tempMin: number|null, tempMax: number|null,
 *           hadRain: boolean, hadWind: boolean } | null | undefined} weatherStats
 */
function renderWeatherBar(weatherStats) {
  const section = document.getElementById("outfit-weather-section");
  const container = document.getElementById("temp-bar-container");
  if (!section || !container) return;

  // Guard: nothing to show
  if (
    !weatherStats ||
    weatherStats.wearCount <= 0 ||
    (weatherStats.tempMin === null && weatherStats.tempMax === null)
  ) {
    section.hidden = true;
    return;
  }

  const range = wornRange(weatherStats);
  // range should always be non-null here given the guard above, but be safe
  if (!range) {
    section.hidden = true;
    return;
  }

  const loFrac = tempFraction(range.lo);
  const hiFrac = tempFraction(range.hi);
  const isPointRange = range.lo === range.hi;

  // The overlay capsule is centered on the midpoint between lo and hi ticks,
  // same as the iOS implementation. We ensure a minimum visible width.
  const overlayLeft = ((loFrac + hiFrac) / 2) * 100;
  const overlayWidthPct = Math.max(hiFrac - loFrac, 0.04) * 100;

  // ---- Build DOM ----

  container.replaceChildren();

  // Eyebrow label
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow temp-bar-eyebrow";
  eyebrow.textContent = "Worn in";
  container.appendChild(eyebrow);

  // Scale row: min label | bar | max label
  const scaleRow = document.createElement("div");
  scaleRow.className = "temp-bar-scale-row";

  const minLabel = document.createElement("span");
  minLabel.className = "temp-bar-scale-label";
  minLabel.textContent = formatTempF(TEMP_SCALE_MIN);
  scaleRow.appendChild(minLabel);

  // Bar area — gradient + overlay capsule + ticks
  const barArea = document.createElement("div");
  barArea.className = "temp-bar-area";

  const track = document.createElement("div");
  track.className = "temp-bar-track";
  barArea.appendChild(track);

  // Frosted worn-range overlay capsule
  const overlay = document.createElement("div");
  overlay.className = "temp-bar-overlay";
  overlay.style.left = `${overlayLeft}%`;
  overlay.style.width = `${overlayWidthPct}%`;
  overlay.style.transform = "translateX(-50%)";
  barArea.appendChild(overlay);

  // Left boundary tick
  const tickLo = document.createElement("div");
  tickLo.className = "temp-bar-tick";
  tickLo.style.left = `${loFrac * 100}%`;
  barArea.appendChild(tickLo);

  // Right boundary tick — omitted for a point range (matches iOS)
  if (!isPointRange) {
    const tickHi = document.createElement("div");
    tickHi.className = "temp-bar-tick";
    tickHi.style.left = `${hiFrac * 100}%`;
    barArea.appendChild(tickHi);
  }

  scaleRow.appendChild(barArea);

  const maxLabel = document.createElement("span");
  maxLabel.className = "temp-bar-scale-label";
  maxLabel.textContent = formatTempF(TEMP_SCALE_MAX);
  scaleRow.appendChild(maxLabel);

  container.appendChild(scaleRow);

  // Worn-range labels below the bar, anchored to tick positions.
  // The labels row is position:relative; labels are position:absolute
  // left-aligned to the tick fraction, then shifted -50% to center on the tick.
  // When the two labels would overlap (gap < 10% of bar width ≈ 52px equivalent),
  // collapse to a single centered label — same logic as iOS.
  const labelsRow = document.createElement("div");
  labelsRow.className = "temp-bar-labels-row";
  labelsRow.setAttribute("aria-hidden", "true"); // screen readers get the footer text

  const GAP_COLLAPSE_THRESHOLD = 0.10; // fraction of scale width
  const tooClose = !isPointRange && (hiFrac - loFrac) < GAP_COLLAPSE_THRESHOLD;

  if (isPointRange || tooClose) {
    const midFrac = (loFrac + hiFrac) / 2;
    const lbl = document.createElement("span");
    lbl.className = "temp-bar-label";
    lbl.style.left = `${midFrac * 100}%`;
    lbl.textContent = isPointRange
      ? formatTempF(range.lo)
      : `${formatTempF(range.lo)}–${formatTempF(range.hi)}`;
    labelsRow.appendChild(lbl);
  } else {
    const lblLo = document.createElement("span");
    lblLo.className = "temp-bar-label";
    lblLo.style.left = `${loFrac * 100}%`;
    lblLo.textContent = formatTempF(range.lo);
    labelsRow.appendChild(lblLo);

    const lblHi = document.createElement("span");
    lblHi.className = "temp-bar-label";
    lblHi.style.left = `${hiFrac * 100}%`;
    lblHi.textContent = formatTempF(range.hi);
    labelsRow.appendChild(lblHi);
  }

  container.appendChild(labelsRow);

  // Footer: wear count + condition icons
  const footer = document.createElement("div");
  footer.className = "temp-bar-footer";

  const wearText = document.createElement("span");
  wearText.className = "temp-bar-wear-count";
  wearText.textContent = weatherStats.wearCount === 1 ? "1 wear" : `${weatherStats.wearCount} wears`;
  footer.appendChild(wearText);

  if (weatherStats.hadRain) {
    const rainIcon = document.createElement("span");
    rainIcon.className = "temp-bar-condition-icon temp-bar-rain";
    rainIcon.setAttribute("aria-label", "worn in rain");
    rainIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">
      <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/>
      <line x1="8" y1="19" x2="8" y2="21"/>
      <line x1="8" y1="23" x2="8" y2="23.01"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="12" y1="17" x2="12" y2="17.01"/>
      <line x1="16" y1="19" x2="16" y2="21"/>
      <line x1="16" y1="23" x2="16" y2="23.01"/>
    </svg>`;
    footer.appendChild(rainIcon);
  }

  if (weatherStats.hadWind) {
    const windIcon = document.createElement("span");
    windIcon.className = "temp-bar-condition-icon temp-bar-wind";
    windIcon.setAttribute("aria-label", "worn in wind");
    windIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">
      <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/>
      <path d="M9.6 4.6A2 2 0 1 1 11 8H2"/>
      <path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>
    </svg>`;
    footer.appendChild(windIcon);
  }

  container.appendChild(footer);

  section.hidden = false;
}

function renderSelectedGarment(garment) {
  const panel = document.getElementById("selected-garment-panel");
  if (!panel) return;

  panel.replaceChildren();

  if (!garment) {
    const empty = document.createElement("div");
    empty.className = "selected-garment-card";
    empty.innerHTML = `
      <div class="selected-garment-copy">
        <p class="eyebrow">Selected garment</p>
        <h2>No garments listed</h2>
        <p class="selected-garment-meta">This shared outfit does not include garment details yet.</p>
      </div>
    `;
    panel.appendChild(empty);
    return;
  }

  const card = document.createElement("article");
  card.className = "selected-garment-card";

  const media = document.createElement("div");
  media.className = "selected-garment-media";
  const imageURL = garmentImageURL(garment);
  if (imageURL) {
    const img = document.createElement("img");
    img.src = imageURL;
    img.alt = garment.name || "Selected garment";
    img.loading = "eager";
    img.decoding = "async";
    media.appendChild(img);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "garment-thumb-placeholder";
    placeholder.innerHTML = placeholderIconHTML(garment.name || "Selected garment");
    media.appendChild(placeholder);
  }

  const copy = document.createElement("div");
  copy.className = "selected-garment-copy";

  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Selected garment";

  const title = document.createElement("h2");
  title.textContent = garment.name || "Unnamed garment";

  const brand = document.createElement("p");
  brand.className = "selected-garment-brand";
  brand.textContent = garment.brand || garment.retailer || "";

  const meta = document.createElement("p");
  meta.className = "selected-garment-meta";
  meta.textContent = buildMetaLine(garment);

  const price = document.createElement("p");
  price.className = "selected-garment-price";
  price.textContent = formatPrice(garment.price);

  const actions = document.createElement("div");
  actions.className = "selected-garment-actions";

  if (garment.productURL) {
    const link = document.createElement("a");
    link.className = "button button-primary";
    link.href = garment.productURL;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = garment.retailer ? `View at ${garment.retailer}` : "View product";
    actions.appendChild(link);
  }

  copy.appendChild(eyebrow);
  copy.appendChild(title);
  if (brand.textContent) copy.appendChild(brand);
  if (meta.textContent) copy.appendChild(meta);
  if (price.textContent) copy.appendChild(price);

  const badges = buildBadges(garment);
  if (badges.children.length) copy.appendChild(badges);
  if (actions.children.length) copy.appendChild(actions);

  card.appendChild(media);
  card.appendChild(copy);
  panel.appendChild(card);
}

function buildGarmentCard(garment) {
  const li = document.createElement("li");
  li.className = "garment-card";
  li.dataset.garmentId = garment.id;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "garment-card-button";
  button.addEventListener("click", () => selectGarment(garment.id, { scroll: true }));

  const thumbDiv = document.createElement("div");
  thumbDiv.className = "garment-card-thumb";
  const imageURL = garmentImageURL(garment);
  if (imageURL) {
    const img = document.createElement("img");
    img.src = imageURL;
    img.alt = garment.name || "Garment photo";
    img.loading = "lazy";
    img.decoding = "async";
    thumbDiv.appendChild(img);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "garment-thumb-placeholder";
    placeholder.innerHTML = placeholderIconHTML(garment.name || "Garment");
    thumbDiv.appendChild(placeholder);
  }

  const bodyDiv = document.createElement("div");
  bodyDiv.className = "garment-card-body";

  const nameEl = document.createElement("h3");
  nameEl.className = "garment-card-name";
  nameEl.textContent = garment.name || "Unnamed garment";

  const brandEl = document.createElement("p");
  brandEl.className = "garment-card-brand";
  brandEl.textContent = garment.brand || "";

  bodyDiv.appendChild(nameEl);
  if (garment.brand) bodyDiv.appendChild(brandEl);

  const pills = buildPills(garment);
  if (pills.children.length) bodyDiv.appendChild(pills);

  const badges = buildBadges(garment);
  if (badges.children.length) bodyDiv.appendChild(badges);

  button.appendChild(thumbDiv);
  button.appendChild(bodyDiv);
  li.appendChild(button);
  return li;
}

function sortGarments(garments) {
  const order = ["outerwear", "top", "bottom", "footwear", "accessory"];
  return [...garments].sort((a, b) => {
    const ai = order.indexOf(a.category?.toLowerCase() ?? "");
    const bi = order.indexOf(b.category?.toLowerCase() ?? "");
    const an = ai === -1 ? order.length : ai;
    const bn = bi === -1 ? order.length : bi;
    return an - bn || String(a.name ?? "").localeCompare(String(b.name ?? ""));
  });
}

function renderGarments(garments) {
  const list = document.getElementById("garment-list");
  if (!list) return;

  list.replaceChildren();

  if (!garments || garments.length === 0) {
    const empty = document.createElement("li");
    empty.style.color = "var(--muted)";
    empty.style.fontSize = "0.92rem";
    empty.style.gridColumn = "1 / -1";
    empty.textContent = "No garments listed for this outfit.";
    list.appendChild(empty);
    return;
  }

  sortGarments(garments).forEach((garment) => list.appendChild(buildGarmentCard(garment)));
}

function selectGarment(garmentID, options = {}) {
  const garment = currentGarments.find((item) => item.id === garmentID) ?? currentGarments[0] ?? null;
  selectedGarmentID = garment?.id ?? null;

  renderSelectedGarment(garment);
  syncSelectionState();

  if (options.scroll) {
    document.getElementById("selected-garment-panel")?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }
}

function syncSelectionState() {
  document.querySelectorAll(".photo-pin").forEach((pin) => {
    pin.classList.toggle("is-active", pin.dataset.garmentId === selectedGarmentID);
  });

  document.querySelectorAll(".garment-card").forEach((card) => {
    card.classList.toggle("is-active", card.dataset.garmentId === selectedGarmentID);
  });
}

function pickInitialGarmentID(garments, pins) {
  const firstPinnedGarmentID = pins.find((pin) =>
    garments.some((garment) => garment.id === pin.garmentID)
  )?.garmentID;
  return firstPinnedGarmentID ?? garments[0]?.id ?? null;
}

function setAppStoreCTAs(url) {
  document
    .querySelectorAll('[id^="appstore-cta"]')
    .forEach((el) => {
      el.href = url;
      if (url !== "#") {
        el.target = "_blank";
        el.rel = "noopener noreferrer";
      }
    });
}

async function fetchOutfit(token) {
  const res = await fetch(edgeFunctionUrl(token), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (res.status === 404) return null;

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Edge function returned ${res.status}: ${body}`);
  }

  return res.json();
}

async function init() {
  showState("state-loading");

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  setAppStoreCTAs(APP_STORE_URL);

  const token = getToken();
  if (!token) {
    showState("state-error");
    return;
  }

  try {
    const data = await fetchOutfit(token);

    if (!data || !data.outfit) {
      showState("state-error");
      return;
    }

    currentGarments = sortGarments(data.garments ?? []);
    currentPins = data.pins ?? [];
    selectedGarmentID = pickInitialGarmentID(currentGarments, currentPins);

    renderHero(data.outfit, data.sharedBy ?? null, data.sharedByUsername ?? null);
    renderWeatherBar(data.weatherStats ?? null);
    renderOutfitPhoto(data.outfit, currentPins);
    renderGarments(currentGarments);
    renderSelectedGarment(currentGarments.find((g) => g.id === selectedGarmentID) ?? currentGarments[0] ?? null);
    syncSelectionState();
    showState("state-content");
  } catch (err) {
    console.error("[TrailLayers] Failed to load outfit:", err);
    showState("state-error");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
