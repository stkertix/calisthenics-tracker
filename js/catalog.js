/** Katalog program dari data/catalog.json. */

let MOVE_GUIDE = {};
let PROGRAMS = {};
let SCHEDULES = [];
let BASELINE = [];
let DAYS = [];

export function getMoveGuide() {
  return MOVE_GUIDE;
}
export function getPrograms() {
  return PROGRAMS;
}
export function getSchedules() {
  return SCHEDULES;
}
export function getBaseline() {
  return BASELINE;
}
export function getDays() {
  return DAYS;
}

export async function loadCatalog(url = "./data/catalog.json") {
  const res = await fetch(url);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const catalog = await res.json();
  MOVE_GUIDE = catalog.moveGuide || {};
  PROGRAMS = catalog.programs || {};
  SCHEDULES = catalog.schedules || [];
  BASELINE = catalog.baseline || [];
  DAYS = catalog.days || [];
  return catalog;
}

export function showCatalogLoadError() {
  document.body.innerHTML =
    '<main style="font-family:system-ui;padding:2rem;max-width:28rem;margin:auto">' +
    "<h1>Gagal memuat data</h1>" +
    "<p>Pastikan app dijalankan lewat HTTP (bukan file://) agar <code>data/catalog.json</code> bisa dibaca.</p>" +
    "<p><code>python3 -m http.server 8080</code></p>" +
    "</main>";
}

function normalizeMoveKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function guideFor(name) {
  const key = normalizeMoveKey(name);
  if (MOVE_GUIDE[key]) return MOVE_GUIDE[key];
  const hit = Object.keys(MOVE_GUIDE).find((k) => key.includes(k) || k.includes(key));
  return hit
    ? MOVE_GUIDE[hit]
    : {
        desc: "Lakukan dengan kontrol penuh. Utamakan form bersih sebelum menambah volume.",
        cues: ["ROM penuh yang aman", "Napas teratur", "Stop jika nyeri tajam"],
      };
}
