/*
  Artist EPK — Vanilla JS
  - Fetches Published Google Sheet CSV
  - Parses rows:
    A: Platform Name
    B: Main Stat Label
    C: Value/Number
    F: Last Updated Timestamp
*/

const CONFIG = {
  // Replace with your Google Sheet "Published to web" CSV link
  // Example format: https://docs.google.com/spreadsheets/d/e/<pubid>/pub?output=csv
  SHEET_CSV_URL:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSd-eBeAuYkde8q-AKXvkqR2r0ogPmtJMJ4pzHSBsr2AcqUcBQsQwrpmZ1ecBUxBmzZiMTwn77NoZ-s/pub?output=csv",

  // Optional: if your sheet includes different casing/aliases, add them here.
  PLATFORM_ALIASES: {
    instagram: ["ig", "instagram"],
    tiktok: ["tiktok", "tik tok"],
    youtube: ["youtube", "yt"],
    facebook: ["facebook", "fb"],
    tunecore: ["tunecore", "total streams", "streams"],
  },

  // Pulled from https://alyrisband.com (Feb 2026)
  LINKS: {
    website: "https://alyrisband.com",
    tiktok: "https://tiktok.com/@alyrisband",
    instagram: "https://instagram.com/alyrisband",
    youtube: "https://www.youtube.com/@ALYRISBand",
    facebook: "https://www.facebook.com/share/1CBNjjaBgW/?mibextid=wwXIfr",
    spotify: "https://open.spotify.com/artist/2OLxuGyo18gD3Xj7QZVXg9?si=hwSqS-DlQByonLoHRYDfSw",
  },
};

const $ = (selector) => document.querySelector(selector);

function normalizeKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function findHeaderMap(rows) {
  // Try to locate a header row that contains expected column names.
  // This avoids hard-coding indexes (some sheets export with a leading blank column).
  const want = {
    platform: "platform name",
    label: "main stat",
    value: "number",
    secondaryLabel: "secondary stat",
    lastUpdated: "last updated",
  };

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const normalized = row.map(normalizeKey);
    const idxPlatform = normalized.indexOf(want.platform);
    const idxLabel = normalized.indexOf(want.label);
    const numberIndices = [];
    for (let i = 0; i < normalized.length; i++) {
      if (normalized[i] === want.value) numberIndices.push(i);
    }
    const idxValue = numberIndices.length ? numberIndices[0] : -1;
    const idxSecondaryValue = numberIndices.length > 1 ? numberIndices[1] : null;

    const idxSecondaryLabel = normalized.indexOf(want.secondaryLabel);
    const idxLastUpdated = normalized.indexOf(want.lastUpdated);

    if (idxPlatform !== -1 && idxLabel !== -1 && idxValue !== -1) {
      return {
        headerRowIndex: rowIndex,
        dataStartIndex: rowIndex + 1,
        idxPlatform,
        idxLabel,
        idxValue,
        idxSecondaryLabel: idxSecondaryLabel === -1 ? null : idxSecondaryLabel,
        idxSecondaryValue,
        idxLastUpdated: idxLastUpdated === -1 ? null : idxLastUpdated,
      };
    }
  }

  return null;
}

// Robust-enough CSV parser for Google Sheets output.
// Handles commas, quotes, and CRLF.
function parseCSV(csvText) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        value += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(value);
      value = "";
      continue;
    }

    if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    if (char === "\r") {
      // ignore CR; handled by \n
      continue;
    }

    value += char;
  }

  // flush last cell
  row.push(value);
  // avoid adding a trailing empty row if file ends with newline
  if (row.length > 1 || row[0].trim() !== "") rows.push(row);

  return rows;
}

function toDisplayNumber(raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "—";

  // If already includes non-numeric symbols (e.g. 1.2M, 250k, 10,000), keep as-is.
  // Otherwise format as locale number.
  const numeric = trimmed.replace(/,/g, "");
  if (/^-?\d+(\.\d+)?$/.test(numeric)) {
    const n = Number(numeric);
    if (Number.isFinite(n)) return n.toLocaleString();
  }

  return trimmed;
}

function formatLastUpdatedUK(rawTimestamp) {
  const raw = String(rawTimestamp ?? "").trim();
  if (!raw) return null;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  // UK time (handles GMT/BST automatically)
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return fmt.format(date);
}

function matchesAlias(platformName, canonicalKey) {
  const normalized = normalizeKey(platformName);
  const aliases = CONFIG.PLATFORM_ALIASES[canonicalKey] ?? [canonicalKey];
  return aliases.some((a) => normalized === a);
}

function includesAny(text, needles) {
  const hay = normalizeKey(text);
  return needles.some((n) => hay.includes(normalizeKey(n)));
}

function pickLastUpdated(rows, idxLastUpdated) {
  if (idxLastUpdated === null || idxLastUpdated === undefined) return null;

  // Use the most recent non-empty timestamp found.
  const candidates = [];
  for (const r of rows) {
    const ts = (r[idxLastUpdated] ?? "").trim();
    if (ts) candidates.push(ts);
  }
  if (candidates.length === 0) return null;

  // Try to parse and pick max date if possible
  const parsed = candidates
    .map((ts) => ({ ts, date: new Date(ts) }))
    .filter((x) => !Number.isNaN(x.date.getTime()));

  if (parsed.length) {
    parsed.sort((a, b) => b.date.getTime() - a.date.getTime());
    return parsed[0].ts;
  }

  // fallback: last non-empty
  return candidates[candidates.length - 1];
}

function rowToStat(row, map) {
  const idxPlatform = map?.idxPlatform ?? 0;
  const idxLabel = map?.idxLabel ?? 1;
  const idxValue = map?.idxValue ?? 2;
  const idxSecondaryLabel = map?.idxSecondaryLabel ?? 3;
  const idxSecondaryValue = map?.idxSecondaryValue ?? 4;
  const idxLastUpdated = map?.idxLastUpdated ?? 5;

  // Some Sheets exports include a leading blank column in the header rows,
  // but footer/summary rows may not include that blank cell (column shift).
  // If mapped platform is empty but column 0 has text, fall back to column 0.
  const platform = ((row[idxPlatform] ?? "").trim() || (row[0] ?? "").trim());
  const label = (row[idxLabel] ?? "").trim();
  const value = (row[idxValue] ?? "").trim();
  const secondaryLabel = idxSecondaryLabel === null ? "" : (row[idxSecondaryLabel] ?? "").trim();
  const secondaryValue = idxSecondaryValue === null ? "" : (row[idxSecondaryValue] ?? "").trim();
  const lastUpdated = idxLastUpdated === null ? "" : (row[idxLastUpdated] ?? "").trim();

  return { platform, label, value, secondaryLabel, secondaryValue, lastUpdated };
}

function buildStatCard({
  icon,
  title,
  label,
  value,
  href,
  tone,
  secondaryLabel,
  secondaryValue,
}) {
  const a = document.createElement("a");

  const base =
    "group relative rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md transition hover:bg-white/7 focus:outline-none focus:ring-2 focus:ring-sky-400/70";
  const gold =
    "border-amber-400/25 bg-gradient-to-b from-amber-500/10 to-white/5 shadow-[0_0_0_1px_rgba(251,191,36,0.10),0_20px_80px_rgba(0,0,0,0.55)]";

  a.className = tone === "gold" ? `${base} ${gold}` : base;
  a.href = href || "#";
  a.target = href ? "_blank" : "_self";
  a.rel = href ? "noreferrer" : "";

  const valueClass = tone === "gold" ? "text-amber-100" : "text-white";
  const titleClass = tone === "gold" ? "text-amber-200/70" : "text-white/55";
  const hasSecondary = String(secondaryValue ?? "").trim() !== "";
  const secondaryInlineLabel = (secondaryLabel || "Secondary").trim();

  a.innerHTML = `
    <div class="flex items-start justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
          ${icon}
        </div>
        <div>
          <div class="text-xs uppercase tracking-wider ${titleClass}">${title}</div>
          <div class="text-sm text-white/80">${label || ""}</div>
        </div>
      </div>
      <div class="text-right">
        <div class="flex items-baseline justify-end gap-2">
          <div class="text-2xl font-semibold tracking-tight ${valueClass}">${toDisplayNumber(value)}</div>
          ${hasSecondary ? `<div class=\"text-xs text-white/55 whitespace-nowrap\">${secondaryInlineLabel} · ${toDisplayNumber(secondaryValue)}</div>` : ""}
        </div>
        <div class="mt-1 text-xs text-white/45">Live from Sheet</div>
      </div>
    </div>
  `;

  return a;
}

const ICONS = {
  tiktok: `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-white/85">
      <path d="M14 3v10.2a4.8 4.8 0 1 1-4-4.72V6.2a8.6 8.6 0 1 0 8.6 8.6V8.3c1.1.8 2.4 1.3 3.9 1.4V5.8c-2.4-.2-4.6-1.5-5.7-2.8Z" fill="currentColor"/>
    </svg>
  `,
  instagram: `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-white/85">
      <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm10 2H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3Zm-5 4.5A5.5 5.5 0 1 1 6.5 12 5.5 5.5 0 0 1 12 8.5Zm0 2A3.5 3.5 0 1 0 15.5 12 3.5 3.5 0 0 0 12 10.5ZM18 6.2a1 1 0 1 1-1 1 1 1 0 0 1 1-1Z" fill="currentColor"/>
    </svg>
  `,
  youtube: `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-white/85">
      <path d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.6 12 4.6 12 4.6s-5.7 0-7.5.5A3 3 0 0 0 2.4 7.2 31.4 31.4 0 0 0 2 12a31.4 31.4 0 0 0 .4 4.8 3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1A31.4 31.4 0 0 0 22 12a31.4 31.4 0 0 0-.4-4.8ZM10 15.5v-7l6 3.5-6 3.5Z" fill="currentColor"/>
    </svg>
  `,
  facebook: `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-white/85">
      <path d="M13.5 21v-7h2.6l.4-3H13.5V9.2c0-.9.2-1.5 1.6-1.5H16.6V5.1a20 20 0 0 0-2.3-.1c-2.3 0-3.8 1.4-3.8 4v2H8v3h2.5v7h3Z" fill="currentColor"/>
    </svg>
  `,
  spotify: `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-white/85">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.6 14.5a.9.9 0 0 1-1.24.3c-2.4-1.5-5.4-1.9-8.9-1.1a.9.9 0 0 1-.4-1.75c3.9-.9 7.3-.5 10 1.2.42.26.55.82.3 1.35Zm.9-2.5a1.05 1.05 0 0 1-1.45.35c-2.75-1.7-6.95-2.2-10.2-1.2a1.05 1.05 0 1 1-.6-2c3.75-1.1 8.4-.55 11.6 1.4.5.3.66.96.35 1.45Zm.1-2.7c-3.3-2-8.75-2.2-11.9-1.25a1.2 1.2 0 0 1-.7-2.3c3.6-1.1 9.65-.9 13.5 1.5a1.2 1.2 0 1 1-1.3 2.05Z" fill="currentColor"/>
    </svg>
  `,
  streams: `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-white/85">
      <path d="M3 12a9 9 0 1 1 18 0 9 9 0 0 1-18 0Zm7-4.5v9l8-4.5-8-4.5Z" fill="currentColor"/>
    </svg>
  `,
};

function renderStats({ socialStats, careerStats, lastUpdated }) {
  const totalsGrid = $("#totalsGrid");
  const socialGrid = $("#socialGrid");
  const careerGrid = $("#careerGrid");
  const lastUpdatedEl = $("#lastUpdated");

  totalsGrid.innerHTML = "";
  socialGrid.innerHTML = "";
  careerGrid.innerHTML = "";

  // totals come first
  if (careerStats?.length) {
    for (const stat of careerStats) totalsGrid.appendChild(stat);
  }

  for (const stat of socialStats) {
    socialGrid.appendChild(stat);
  }

  // Keep a separate career area for any future expansions
  for (const stat of []) {
    careerGrid.appendChild(stat);
  }

  const formatted = formatLastUpdatedUK(lastUpdated);
  lastUpdatedEl.textContent = formatted ? `Last updated: ${formatted}` : "Last updated: —";
}

function setStatus(kind, message) {
  const el = $("#dataStatus");
  const colors = {
    idle: "text-white/45",
    ok: "text-emerald-300/70",
    warn: "text-amber-300/70",
    error: "text-rose-300/70",
  };
  el.className = `mt-2 text-xs ${colors[kind] || colors.idle}`;
  el.textContent = message;
}

async function loadSheetData() {
  if (!CONFIG.SHEET_CSV_URL || CONFIG.SHEET_CSV_URL.includes("PASTE_YOUR")) {
    setStatus(
      "warn",
      "Add your published Google Sheet CSV URL in app.js (CONFIG.SHEET_CSV_URL)."
    );
    return;
  }

  setStatus("idle", "Fetching live stats…");

  let text;
  try {
    const res = await fetch(CONFIG.SHEET_CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch (err) {
    console.error(err);
    setStatus("error", "Could not fetch the Google Sheet CSV. Check the URL and publishing settings.");
    return;
  }

  const rows = parseCSV(text);
  if (rows.length === 0) {
    setStatus("error", "CSV returned no rows.");
    return;
  }

  const headerMap = findHeaderMap(rows);
  const dataRows = headerMap ? rows.slice(headerMap.dataStartIndex) : rows;

  const stats = dataRows
    .map((r) => rowToStat(r, headerMap))
    .filter((s) => s.platform || s.label || s.value);

  const lastUpdated = headerMap?.idxLastUpdated != null
    ? pickLastUpdated(dataRows, headerMap.idxLastUpdated)
    : pickLastUpdated(dataRows, 5);

  const social = [];
  const totals = [];

  // Social platforms
  const tiktok = stats.find((s) => matchesAlias(s.platform, "tiktok"));
  const instagram = stats.find((s) => matchesAlias(s.platform, "instagram"));
  const youtube = stats.find((s) => matchesAlias(s.platform, "youtube"));
  const facebook = stats.find((s) => matchesAlias(s.platform, "facebook"));
  const spotify = stats.find((s) => matchesAlias(s.platform, "spotify"));

  // Totals (from sheet footer rows)
  const totalFollowers =
    stats.find((s) => includesAny(s.platform, ["total followers"])) || null;
  const totalStreamsRow =
    stats.find((s) => includesAny(s.platform, ["total streams"])) || null;

  if (totalStreamsRow) {
    totals.push(
      buildStatCard({
        icon: ICONS.streams,
        title: "Total Streams",
        label: "Reported from TuneCore",
        value: totalStreamsRow.value,
        href: CONFIG.LINKS.website,
        tone: "gold",
      })
    );
  }
  if (totalFollowers) {
    totals.push(
      buildStatCard({
        icon: ICONS.instagram,
        title: "Total Followers",
        label: "Across platforms",
        value: totalFollowers.value,
        href: CONFIG.LINKS.website,
        tone: "gold",
      })
    );
  }

  if (tiktok) {
    social.push(
      buildStatCard({
        icon: ICONS.tiktok,
        title: "TikTok",
        label: tiktok.label || "Followers",
        value: tiktok.value,
        href: CONFIG.LINKS.tiktok,
      })
    );
  }
  if (instagram) {
    social.push(
      buildStatCard({
        icon: ICONS.instagram,
        title: "Instagram",
        label: instagram.label || "Followers",
        value: instagram.value,
        href: CONFIG.LINKS.instagram,
      })
    );
  }
  if (youtube) {
    // YouTube primary stat (Subscribers)
    social.push(
      buildStatCard({
        icon: ICONS.youtube,
        title: "YouTube",
        label: youtube.label || "Subscribers",
        value: youtube.value,
        href: CONFIG.LINKS.youtube,
      })
    );

    // YouTube secondary stat (Total Views)
    if (includesAny(youtube.secondaryLabel, ["views"]) && youtube.secondaryValue) {
      social.push(
        buildStatCard({
          icon: ICONS.youtube,
          title: "YouTube",
          label: youtube.secondaryLabel || "Total Views",
          value: youtube.secondaryValue,
          href: CONFIG.LINKS.youtube,
        })
      );
    }
  }
  if (spotify) {
    social.push(
      buildStatCard({
        icon: ICONS.spotify,
        title: "Spotify",
        label: spotify.label || "Followers",
        value: spotify.value,
        href: CONFIG.LINKS.spotify,
      })
    );

    // Spotify secondary stat (Monthly Listeners) as its own card
    if (
      includesAny(spotify.secondaryLabel, ["monthly", "listeners"]) &&
      spotify.secondaryValue
    ) {
      social.push(
        buildStatCard({
          icon: ICONS.spotify,
          title: "Spotify",
          label: spotify.secondaryLabel || "Monthly Listeners",
          value: spotify.secondaryValue,
          href: CONFIG.LINKS.spotify,
        })
      );
    }
  }
  if (facebook) {
    social.push(
      buildStatCard({
        icon: ICONS.facebook,
        title: "Facebook",
        label: facebook.label || "Followers",
        value: facebook.value,
        href: CONFIG.LINKS.facebook,
      })
    );
  }

  // Add Website card
  social.push(
    buildStatCard({
      icon: ICONS.streams,
      title: "Website",
      label: "alyrisband.com",
      value: "Visit",
      href: CONFIG.LINKS.website,
    })
  );

  // Keep totals consistent even if missing
  while (totals.length < 2) {
    totals.push(
      buildStatCard({
        icon: ICONS.streams,
        title: "Total",
        label: "Add in Sheet",
        value: "—",
        href: CONFIG.LINKS.website,
      })
    );
  }

  renderStats({ socialStats: social, careerStats: totals, lastUpdated });
  setStatus("ok", "Live stats loaded successfully.");
}

function init() {
  // Hero slideshow (crossfade)
  const slides = Array.from(document.querySelectorAll(".hero-slide"));
  if (slides.length > 1) {
    for (const s of slides) {
      s.style.transition = "opacity 900ms ease-in-out";
      s.style.willChange = "opacity";
      // mild grading
      s.style.filter = "saturate(0.95) contrast(1.05)";
      // keep faces in frame a bit better across common press shots
      s.style.objectPosition = "center 22%";
    }

    let idx = 0;
    setInterval(() => {
      const next = (idx + 1) % slides.length;
      slides[idx].classList.remove("opacity-60");
      slides[idx].classList.add("opacity-0");
      slides[next].classList.remove("opacity-0");
      slides[next].classList.add("opacity-60");
      idx = next;
    }, 7000);
  }

  // Wire up refresh buttons (supports both the newer data-action selector and older id-based selector)
  const refreshButtons = new Set(
    Array.from(document.querySelectorAll('[data-action="refreshStats"]'))
  );
  const legacyRefresh = document.querySelector("#refreshBtn");
  if (legacyRefresh) refreshButtons.add(legacyRefresh);

  for (const btn of refreshButtons) btn.addEventListener("click", () => loadSheetData());
  loadSheetData();
}

document.addEventListener("DOMContentLoaded", init);
