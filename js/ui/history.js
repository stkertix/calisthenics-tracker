/** Tab Log: riwayat, export/import, reset. */

import { $, toast, formatDate } from "../lib/dom.js";
import { getPrograms } from "../catalog.js";
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

export function renderHistory() {
  const state = ctx.state;
  const PROGRAMS = getPrograms();
  const list = $("#historyList");
  if (!state.history.length) {
    list.innerHTML = `<p class="empty">Belum ada sesi tersimpan. Mulai dari tab Jalur.</p>`;
    return;
  }
  list.innerHTML = state.history
    .slice(0, 20)
    .map((h) => {
      const prog = PROGRAMS[h.path];
      return `
        <div class="log-item">
          <time>${formatDate(h.endedAt)}</time>
          <div><strong>${prog?.name || h.path}</strong> L${h.level} · ${h.completed}/${h.total}</div>
        </div>`;
    })
    .join("");
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
    ctx.renderHome();
    renderHistory();
    toast("Data direset");
  });
}
