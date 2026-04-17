/**
 * outfit.js — Shared Outfit page controller
 *
 * URL format: traillayers.app/outfits/?id=<uuid>
 *
 * Reads ?id from the query string, fetches outfit data from the
 * Supabase Edge Function, then renders the result into the DOM.
 *
 * Configuration:
 *   SUPABASE_URL  — set this to your project's Supabase URL before deploy.
 *   APP_STORE_URL — set to the App Store link once the app is live.
 */

// ----------------------------------------------------------------
// Configuration — update before deploying
// ----------------------------------------------------------------

const SUPABASE_URL = "https://aumkrmgkdhnkkjdwzvdp.supabase.co";
const CDN_BASE     = "https://cdn.traillayers.app";
const APP_STORE_URL = "https://tally.so/r/rjLxAN"; // Replace with App Store URL when live

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

/** Return the ?id= query param value, or null. */
function getToken() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id") ?? null;
}

/** Build the Edge Function URL for a given token. */
function edgeFunctionUrl(token) {
  return `${SUPABASE_URL}/functions/v1/get-shared-outfit?token=${encodeURIComponent(token)}`;
}

/** Swap which top-level state panel is visible. */
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

    if (panelId === id) {
      if (panelId === "state-loading") {
        el.setAttribute("aria-busy", "true");
      } else {
        el.removeAttribute("aria-busy");
      }
    } else {
      el.removeAttribute("aria-busy");
    }
  });
}

/** Format an ISO date string as a readable date (e.g. "April 14, 2026"). */
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

/** Capitalise the first letter of a string. */
function titleCase(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Map an insulation level string from the API to a human-readable label.
 * The iOS app stores values like "light", "medium", "heavy", "none".
 */
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

// ----------------------------------------------------------------
// DOM renderers
// ----------------------------------------------------------------

/**
 * Build and inject the SVG icon used as a placeholder in image slots.
 * @param {string} ariaLabel
 */
function placeholderIconHTML(ariaLabel) {
  return `
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.4"
         stroke-linecap="round" stroke-linejoin="round"
         role="img" aria-label="${ariaLabel}">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  `;
}

/** Render the outfit hero section (name, activity, image). */
function renderHero(outfit, sharedBy) {
  // Activity eyebrow
  const activityEl = document.getElementById("outfit-activity");
  if (activityEl) {
    activityEl.textContent = outfit.intendedActivityType
      ? titleCase(outfit.intendedActivityType)
      : "Outfit";
  }

  // Outfit name
  const nameEl = document.getElementById("outfit-name");
  if (nameEl) {
    nameEl.textContent = outfit.name || "Untitled Outfit";
    // Also update page <title>
    document.title = `${outfit.name || "Outfit"} — TrailLayers`;
  }

  // Attribution
  const sharedByEl = document.getElementById("shared-by");
  if (sharedByEl) {
    if (sharedBy) {
      sharedByEl.textContent = `Shared by ${sharedBy}`;
      sharedByEl.hidden = false;
    } else {
      sharedByEl.hidden = true;
    }
  }

  // Date line
  const dateEl = document.getElementById("outfit-date");
  if (dateEl && outfit.createdAt) {
    dateEl.textContent = `Saved ${formatDate(outfit.createdAt)}`;
  }

  // Outfit image
  const imageWrap = document.getElementById("outfit-image-wrap");
  if (imageWrap) {
    if (outfit.imagePath) {
      const img = document.createElement("img");
      img.src = `${CDN_BASE}/outfits/${outfit.imagePath}`;
      img.alt = `${outfit.name || "Outfit"} cover photo`;
      img.loading = "eager"; // hero image — load immediately
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
  }
}

/** Build a single garment card element. */
function buildGarmentCard(garment) {
  const li = document.createElement("li");
  li.className = "garment-card";

  // Thumbnail
  const thumbDiv = document.createElement("div");
  thumbDiv.className = "garment-card-thumb";
  if (garment.imagePath) {
    const img = document.createElement("img");
    img.src = `${CDN_BASE}/garments/${garment.imagePath}`;
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

  // Body
  const bodyDiv = document.createElement("div");
  bodyDiv.className = "garment-card-body";

  // Name
  const nameEl = document.createElement("h3");
  nameEl.className = "garment-card-name";
  nameEl.textContent = garment.name || "Unnamed garment";

  // Brand
  const brandEl = document.createElement("p");
  brandEl.className = "garment-card-brand";
  brandEl.textContent = garment.brand || "";

  // Category / subcategory / color pills
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

  // Weather property badges
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

  // Assemble
  bodyDiv.appendChild(nameEl);
  if (garment.brand) bodyDiv.appendChild(brandEl);
  if (pills.length) bodyDiv.appendChild(metaDiv);
  if (badgesDiv.children.length) bodyDiv.appendChild(badgesDiv);

  li.appendChild(thumbDiv);
  li.appendChild(bodyDiv);
  return li;
}

/** Sort garments by category: outerwear → top → bottom → footwear → accessory → other. */
function sortGarments(garments) {
  const order = ["outerwear", "top", "bottom", "footwear", "accessory"];
  return [...garments].sort((a, b) => {
    const ai = order.indexOf(a.category?.toLowerCase() ?? "");
    const bi = order.indexOf(b.category?.toLowerCase() ?? "");
    const an = ai === -1 ? order.length : ai;
    const bn = bi === -1 ? order.length : bi;
    return an - bn;
  });
}

/** Render all garment cards into the list. */
function renderGarments(garments) {
  const list = document.getElementById("garment-list");
  if (!list) return;

  if (!garments || garments.length === 0) {
    const empty = document.createElement("li");
    empty.style.color = "var(--muted)";
    empty.style.fontSize = "0.92rem";
    empty.style.gridColumn = "1 / -1";
    empty.textContent = "No garments listed for this outfit.";
    list.appendChild(empty);
    return;
  }

  sortGarments(garments).forEach((g) => list.appendChild(buildGarmentCard(g)));
}

/** Wire up all App Store CTA links. */
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

// ----------------------------------------------------------------
// Data fetching
// ----------------------------------------------------------------

async function fetchOutfit(token) {
  const url = edgeFunctionUrl(token);
  // The Edge Function is public — no auth header needed.
  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (res.status === 404) {
    return null; // token not found or expired
  }

  if (!res.ok) {
    // Surface any unexpected server error
    const body = await res.text().catch(() => "");
    throw new Error(`Edge function returned ${res.status}: ${body}`);
  }

  return res.json();
}

// ----------------------------------------------------------------
// Boot
// ----------------------------------------------------------------

async function init() {
  // All three panels start with hidden in the HTML. Reveal loading first
  // so there is no flash of empty content while the fetch runs.
  showState("state-loading");

  // Set the copyright year
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Wire up App Store links with the known (or placeholder) URL
  setAppStoreCTAs(APP_STORE_URL);

  const token = getToken();

  if (!token) {
    // No token in URL — show error immediately
    showState("state-error");
    return;
  }

  try {
    const data = await fetchOutfit(token);

    if (!data || !data.outfit) {
      showState("state-error");
      return;
    }

    renderHero(data.outfit, data.sharedBy ?? null);
    renderGarments(data.garments ?? []);
    showState("state-content");

  } catch (err) {
    console.error("[TrailLayers] Failed to load outfit:", err);
    showState("state-error");
  }
}

// Run after DOM is ready (this file is loaded as a module, so
// it is deferred by default — but guard anyway for clarity).
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
