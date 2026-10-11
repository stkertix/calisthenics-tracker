/** Tab Log: kalender, riwayat, export/import, reset. */

import { $, toast, formatDate } from "../lib/dom.js";
import { getPrograms, getDays } from "../catalog.js";
import {
  saveHistory,
  saveState,
  clearAllStorage,
  defaultState,
} from "../storage.js";
import {
  SCHEMA_VERSION,
  HISTORY_EXPORT_TYPE,
  HISTORY_MAX,
} from "../config.js";
import { ctx } from "../context.js";

/** @type {{ y: number, m: number }} month index 0–11 */
let calCursor = { y: new Date().getFullYear(), m: new Date().getMonth() };
/** @type {string | null} YYYY-MM-DD local */
let selectedDayKey = toDayKey(new Date());

function historyEntryKey(h) {
  return [h.path, h.level, h.startedAt, h.endedAt, h.completed, h.total].join("|");
}

function normalizeHistoryEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (!raw.path || !raw.endedAt) return null;
  const level = Math.max(1, Number(raw.level) || 1);
  const completed = Math.max(0, Number(raw.completed) || 0);
  const total = Math.max(completed, Number(raw.total) || 0);
  return {
    path: String(raw.path),
    level,
    startedAt: raw.startedAt ? String(raw.startedAt) : String(raw.endedAt),
    endedAt: String(raw.endedAt),
    completed,
    total,
    notes: Array.isArray(raw.notes) ? raw.notes : [],
  };
}

function sortHistoryNewestFirst(list) {
  return [...list].sort((a, b) => {
    const ta = new Date(a.endedAt).getTime() || 0;
    const tb = new Date(b.endedAt).getTime() || 0;
    return tb - ta;
  });
}

/** Local calendar day key (hindari geser zona waktu dari toISOString). */
function toDayKey(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function countByDay(history) {
  const map = new Map();
  history.forEach((h) => {
    const key = toDayKey(h.endedAt);
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
}

function sessionsForDay(history, dayKey) {
  if (!dayKey) return [];
  return history.filter((h) => toDayKey(h.endedAt) === dayKey);
}

function shiftMonth(delta) {
  const d = new Date(calCursor.y, calCursor.m + delta, 1);
  calCursor = { y: d.getFullYear(), m: d.getMonth() };
}

function monthTitle(y, m) {
  return new Date(y, m, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

function formatDayHeading(dayKey) {
  if (!dayKey) return "Semua sesi";
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function exportHistory() {
  const state = ctx.state;
  if (!state.history.length) {
    toast("Belum ada riwayat untuk diexport");
    return;
  }
  const payload = {
    type: HISTORY_EXPORT_TYPE,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    history: state.history,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `calisthenics-history-${stamp}.json`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast(`Export ${state.history.length} sesi`);
}

function parseHistoryImport(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("File bukan JSON valid");
  }

  let list;
  if (Array.isArray(data)) {
    list = data;
  } else if (data && typeof data === "object") {
    if (data.type && data.type !== HISTORY_EXPORT_TYPE) {
      throw new Error("Tipe file tidak dikenali");
    }
    if (!Array.isArray(data.history)) {
      throw new Error("Field history tidak ditemukan");
    }
    list = data.history;
  } else {
    throw new Error("Format file tidak didukung");
  }

  const entries = list.map(normalizeHistoryEntry).filter(Boolean);
  if (!entries.length) throw new Error("Tidak ada entri riwayat valid");
  return entries;
}

function applyImportedHistory(incoming, mode) {
  const state = ctx.state;
  let next;
  if (mode === "replace") {
    next = sortHistoryNewestFirst(incoming);
  } else {
    const seen = new Set(state.history.map(historyEntryKey));
    next = [...state.history];
    incoming.forEach((h) => {
      const key = historyEntryKey(h);
      if (seen.has(key)) return;
      seen.add(key);
      next.push(h);
    });
    next = sortHistoryNewestFirst(next);
  }
  state.history = next.slice(0, HISTORY_MAX);
  saveHistory();
  renderHistory();
  ctx.renderHome();
}

async function importHistoryFromFile(file) {
  if (!file) return;
  const text = await file.text();
  const incoming = parseHistoryImport(text);
  const replace = confirm(
    `Impor ${incoming.length} sesi.\n\nOK = ganti seluruh riwayat\nCancel = batalkan`
  );
  if (!replace) {
    const merge = confirm("Gabungkan dengan riwayat yang ada?");
    if (!merge) {
      toast("Import dibatalkan");
      return;
    }
    applyImportedHistory(incoming, "merge");
    toast(`Digabung (maks ${HISTORY_MAX} sesi)`);
    return;
  }
  applyImportedHistory(incoming, "replace");
  toast(`Diganti (${Math.min(incoming.length, HISTORY_MAX)} sesi)`);
}

function renderCalendar() {
  const el = $("#historyCalendar");
  if (!el) return;

  const state = ctx.state;
  const byDay = countByDay(state.history);
  const weekdays = getDays().length ? getDays() : ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
  const todayKey = toDayKey(new Date());
  const { y, m } = calCursor;

  // Senin = 0 … Minggu = 6
  const first = new Date(y, m, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startPad; i++) {
    cells.push(`<button type="button" class="log-cal-day" disabled aria-hidden="true"></button>`);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const count = byDay.get(key) || 0;
    const cls = [
      "log-cal-day",
      count ? "has-log" : "",
      key === todayKey ? "today" : "",
      key === selectedDayKey ? "selected" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const label = count ? `${day}, ${count} sesi` : String(day);
    cells.push(`
      <button type="button" class="${cls}" data-day="${key}" aria-label="${label}" aria-pressed="${key === selectedDayKey}">
        <span>${day}</span>
        ${count ? `<span class="log-cal-dot" aria-hidden="true"></span>` : ""}
      </button>`);
  }

  el.innerHTML = `
    <div class="log-cal-head">
      <button type="button" class="log-cal-nav" id="calPrev" aria-label="Bulan sebelumnya">‹</button>
      <h3 class="log-cal-title">${monthTitle(y, m)}</h3>
      <button type="button" class="log-cal-nav" id="calNext" aria-label="Bulan berikutnya">›</button>
    </div>
    <div class="log-cal-weekdays" aria-hidden="true">
      ${weekdays.map((d) => `<span>${d}</span>`).join("")}
    </div>
    <div class="log-cal-grid">${cells.join("")}</div>
  `;

  $("#calPrev").addEventListener("click", () => {
    shiftMonth(-1);
    renderHistory();
  });
  $("#calNext").addEventListener("click", () => {
    shiftMonth(1);
    renderHistory();
  });
  el.querySelectorAll("[data-day]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.day;
      selectedDayKey = selectedDayKey === key ? null : key;
      renderHistory();
    });
  });
}

function deleteHistoryEntry(idx) {
  const state = ctx.state;
  const entry = state.history[idx];
  if (!entry) return;
  const prog = getPrograms()[entry.path];
  const label = `${prog?.name || entry.path} L${entry.level}`;
  if (!confirm(`Hapus sesi ini?\n${label}\n${formatDate(entry.endedAt)}`)) return;
  state.history.splice(idx, 1);
  saveHistory();
  renderHistory();
  ctx.renderHome();
  toast("Sesi dihapus");
}

function renderHistoryList() {
  const state = ctx.state;
  const PROGRAMS = getPrograms();
  const list = $("#historyList");
  const filtered = selectedDayKey
    ? sessionsForDay(state.history, selectedDayKey)
    : state.history;

  if (!state.history.length) {
    list.innerHTML = `<p class="empty">Belum ada sesi tersimpan. Mulai dari tab Jalur.</p>`;
    return;
  }

  const heading = selectedDayKey
    ? `<p class="log-day-label">${formatDayHeading(selectedDayKey)}</p>`
    : `<p class="log-day-label">Semua sesi · ketuk tanggal untuk filter</p>`;

  if (!filtered.length) {
    list.innerHTML = `${heading}<p class="empty">Tidak ada sesi di tanggal ini.</p>`;
    return;
  }

  list.innerHTML =
    heading +
    filtered
      .slice(0, selectedDayKey ? 40 : 20)
      .map((h) => {
        const prog = PROGRAMS[h.path];
        const idx = state.history.indexOf(h);
        return `
          <div class="log-item">
            <div class="log-item-main">
              <time>${formatDate(h.endedAt)}</time>
              <div><strong>${prog?.name || h.path}</strong> L${h.level} · ${h.completed}/${h.total}</div>
            </div>
            <button type="button" class="log-item-del" data-del="${idx}" aria-label="Hapus sesi" title="Hapus">✕</button>
          </div>`;
      })
      .join("");

  list.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      deleteHistoryEntry(+btn.dataset.del);
    });
  });
}

export function renderHistory() {
  renderCalendar();
  renderHistoryList();
}

export function bindHistoryActions() {
  $("#btnExportHistory").addEventListener("click", exportHistory);
  $("#btnImportHistory").addEventListener("click", () => {
    $("#importHistoryFile").value = "";
    $("#importHistoryFile").click();
  });
  $("#importHistoryFile").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      await importHistoryFromFile(file);
    } catch (err) {
      console.error(err);
      toast(err.message || "Import gagal");
    } finally {
      e.target.value = "";
    }
  });

  $("#btnReset").addEventListener("click", () => {
    if (!confirm("Hapus semua progress, riwayat, dan sesi?")) return;
    ctx.state = defaultState();
    clearAllStorage();
    saveState();
    ctx.stopRest();
    selectedDayKey = toDayKey(new Date());
    calCursor = { y: new Date().getFullYear(), m: new Date().getMonth() };
    ctx.renderHome();
    renderHistory();
    toast("Data direset");
  });
}
