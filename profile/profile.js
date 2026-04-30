/**
 * profile.js — Public profile page controller
 *
 * URL format: traillayers.app/profile/?u=<username>
 */

import { SUPABASE_URL, CDN_BASE, APP_STORE_URL } from "../shared/constants.js";

function getUsername() {
  const u = new URLSearchParams(window.location.search).get("u");
  return u ? u.toLowerCase() : null;
}

function edgeFunctionUrl(username) {
  return `${SUPABASE_URL}/functions/v1/get-public-profile?username=${encodeURIComponent(username)}`;
}

function showState(id) {
  const main = document.getElementById("profile-main");
  if (main) main.dataset.state = id.replace("state-", "");

  ["state-loading", "state-error", "state-content"].forEach((panelId) => {
    const el = document.getElementById(panelId);
    if (!el) return;
    el.hidden = panelId !== id;
    if (panelId === id && panelId === "state-loading") {
      el.setAttribute("aria-busy", "true");
    } else {
      el.removeAttribute("aria-busy");
    }
  });
}

function formatMemberSince(iso) {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

function formatSavedDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

function titleCase(str) {
  if (!str) return "";
  return String(str)
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function avatarInitials(displayName, username) {
  const source = displayName || username || "?";
  return source.charAt(0).toUpperCase();
}

function renderProfile(data) {
  const { profile, garmentCount, sharedOutfitCount, activityCount } = data;

  const displayName = profile.displayName || profile.username || "TrailLayers User";

  document.title = `${displayName} — TrailLayers`;

  const avatarEl = document.getElementById("profile-avatar");
  if (avatarEl) avatarEl.textContent = avatarInitials(profile.displayName, profile.username);

  const nameEl = document.getElementById("profile-name");
  if (nameEl) nameEl.textContent = displayName;

  const usernameEl = document.getElementById("profile-username");
  if (usernameEl && profile.username) {
    usernameEl.textContent = `@${profile.username}`;
  }

  const joinedEl = document.getElementById("profile-joined");
  if (joinedEl && profile.memberSince) {
    joinedEl.textContent = `Member since ${formatMemberSince(profile.memberSince)}`;
  }

  const garmentStatEl = document.getElementById("stat-garments");
  if (garmentStatEl) garmentStatEl.textContent = garmentCount;

  const outfitStatEl = document.getElementById("stat-outfits");
  if (outfitStatEl) outfitStatEl.textContent = sharedOutfitCount;

  const activityStatEl = document.getElementById("stat-activities");
  if (activityStatEl) activityStatEl.textContent = activityCount;
}

function buildOutfitCard(outfit) {
  const li = document.createElement("li");
  li.className = "profile-outfit-card";

  // Thumb
  const thumb = document.createElement("div");
  thumb.className = "profile-outfit-thumb";

  if (outfit.imagePath) {
    const img = document.createElement("img");
    img.src = `${CDN_BASE}/outfits/${outfit.imagePath}`;
    img.alt = escapeHtml(outfit.name || "Outfit photo");
    img.loading = "lazy";
    img.decoding = "async";
    thumb.appendChild(img);
  } else {
    thumb.classList.add("profile-outfit-thumb--placeholder");
    thumb.setAttribute("aria-hidden", "true");
    thumb.innerHTML = `
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="1.4"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 5a1 1 0 0 1 1-1h4l2 3h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5z"/>
        <circle cx="10" cy="12" r="2"/>
        <path d="m20 18-4-4-2 2-2-2-4 4"/>
      </svg>
    `;
  }

  // Body
  const body = document.createElement("div");
  body.className = "profile-outfit-body";

  if (outfit.intendedActivityType) {
    const activity = document.createElement("p");
    activity.className = "profile-outfit-activity";
    activity.textContent = titleCase(outfit.intendedActivityType);
    body.appendChild(activity);
  }

  const name = document.createElement("h3");
  name.className = "profile-outfit-name";
  name.textContent = outfit.name || "Untitled Outfit";
  body.appendChild(name);

  const meta = document.createElement("p");
  meta.className = "profile-outfit-meta";
  const parts = [];
  if (outfit.garmentCount > 0) {
    parts.push(`${outfit.garmentCount} ${outfit.garmentCount === 1 ? "piece" : "pieces"}`);
  }
  if (outfit.createdAt) parts.push(`Saved ${formatSavedDate(outfit.createdAt)}`);
  meta.textContent = parts.join(" · ");
  body.appendChild(meta);

  if (outfit.shareToken) {
    const link = document.createElement("a");
    link.className = "profile-outfit-link";
    link.href = `/outfits/?id=${encodeURIComponent(outfit.shareToken)}`;
    link.innerHTML = `View outfit <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2.4"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
    body.appendChild(link);
  }

  li.appendChild(thumb);
  li.appendChild(body);
  return li;
}

function renderOutfits(sharedOutfits) {
  const grid = document.getElementById("outfit-grid");
  if (!grid) return;

  grid.replaceChildren();

  if (!sharedOutfits || sharedOutfits.length === 0) {
    const empty = document.createElement("li");
    empty.style.cssText = "color:var(--muted);font-size:0.92rem;grid-column:1/-1";
    empty.textContent = "No shared outfits yet.";
    grid.appendChild(empty);
    return;
  }

  sharedOutfits.forEach((outfit) => grid.appendChild(buildOutfitCard(outfit)));
}

async function fetchProfile(username) {
  const res = await fetch(edgeFunctionUrl(username), {
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

  document.querySelectorAll('[id^="appstore-cta"]').forEach((el) => {
    el.href = APP_STORE_URL;
    el.target = "_blank";
    el.rel = "noopener noreferrer";
  });

  const username = getUsername();
  if (!username) {
    showState("state-error");
    return;
  }

  try {
    const data = await fetchProfile(username);

    if (!data) {
      showState("state-error");
      return;
    }

    renderProfile(data);
    renderOutfits(data.sharedOutfits ?? []);
    showState("state-content");
  } catch (err) {
    console.error("[TrailLayers] Failed to load profile:", err);
    showState("state-error");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
