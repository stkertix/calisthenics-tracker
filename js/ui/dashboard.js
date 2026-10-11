/** Dashboard ringkasan progres (subhalaman Setting). */

import { $, formatDate, hoursSince } from "../lib/dom.js";
import { getPrograms } from "../catalog.js";
import { ctx } from "../context.js";

function toDayKey(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfLocalDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function buildStats(state) {
  const history = Array.isArray(state.history) ? state.history : [];
  const PROGRAMS = getPrograms();
  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); // Senin
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const uniqueDays = new Set();
  const byPath = {};
  Object.keys(PROGRAMS).forEach((id) => {
    byPath[id] = 0;
  });

  let weekCount = 0;
  let monthCount = 0;

  history.forEach((h) => {
    const ended = new Date(h.endedAt);
    if (Number.isNaN(ended.getTime())) return;
    const key = toDayKey(ended);
    if (key) uniqueDays.add(key);
    if (byPath[h.path] != null) byPath[h.path] += 1;
    else byPath[h.path] = (byPath[h.path] || 0) + 1;
    if (ended >= weekStart) weekCount += 1;
    if (ended >= monthStart) monthCount += 1;
  });

  // Streak: hari berurutan mundur dari hari ini / kemarin yang punya sesi
  let streak = 0;
  const cursor = startOfLocalDay(now);
  // Jika hari ini belum latihan, mulai hitung dari kemarin
  if (!uniqueDays.has(toDayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (uniqueDays.has(toDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const last = history[0] || null;

  return {
    total: history.length,
    weekCount,
    monthCount,
    activeDays: uniqueDays.size,
    streak,
    byPath,
    last,
    levels: state.levels || {},
  };
}

function lastSessionNote(last) {
  if (!last) return "Belum ada sesi";
  const h = hoursSince(last.endedAt);
  if (h < 1) return "Baru saja";
  if (h < 48) return `${Math.ceil(h)} jam lalu`;
  return formatDate(last.endedAt);
}

export function renderDashboard() {
  const el = $("#settingsDashboard");
  if (!el || !ctx.state) return;

  const PROGRAMS = getPrograms();
  const stats = buildStats(ctx.state);
  const maxPath = Math.max(1, ...Object.values(stats.byPath), 1);

  const levelRows = Object.values(PROGRAMS)
    .map((p) => {
      const lvl = stats.levels[p.id] || 1;
      const pct = Math.round((lvl / p.maxLevel) * 100);
      return `
        <div class="dash-path">
          <div class="dash-path-head">
            <strong>${p.name}</strong>
            <span>L${lvl}/${p.maxLevel}</span>
          </div>
          <div class="bar"><i style="width:${pct}%"></i></div>
        </div>`;
    })
    .join("");

  const volumeRows = Object.values(PROGRAMS)
    .map((p) => {
      const n = stats.byPath[p.id] || 0;
      const pct = Math.round((n / maxPath) * 100);
      return `
        <div class="dash-path">
          <div class="dash-path-head">
            <strong>${p.name}</strong>
            <span>${n} sesi</span>
          </div>
          <div class="bar"><i style="width:${n ? Math.max(pct, 8) : 0}%"></i></div>
        </div>`;
    })
    .join("");

  const lastProg = stats.last ? PROGRAMS[stats.last.path] : null;

  el.innerHTML = `
    <div class="dash-grid">
      <div class="dash-stat">
        <span class="dash-stat-label">Total sesi</span>
        <strong class="dash-stat-value">${stats.total}</strong>
      </div>
      <div class="dash-stat">
        <span class="dash-stat-label">Minggu ini</span>
        <strong class="dash-stat-value">${stats.weekCount}</strong>
      </div>
      <div class="dash-stat">
        <span class="dash-stat-label">Bulan ini</span>
        <strong class="dash-stat-value">${stats.monthCount}</strong>
      </div>
      <div class="dash-stat">
        <span class="dash-stat-label">Streak</span>
        <strong class="dash-stat-value">${stats.streak}<small>h</small></strong>
      </div>
    </div>

    <div class="dash-block">
      <h3>Level jalur</h3>
      ${levelRows || `<p class="empty">Belum ada data jalur.</p>`}
    </div>

    <div class="dash-block">
      <h3>Volume per jalur</h3>
      ${
        stats.total
          ? volumeRows
          : `<p class="empty">Belum ada sesi tersimpan.</p>`
      }
    </div>

    <div class="dash-block">
      <h3>Aktivitas</h3>
      <ul class="dash-meta">
        <li><span>Hari aktif</span><strong>${stats.activeDays}</strong></li>
        <li><span>Sesi terakhir</span><strong>${lastSessionNote(stats.last)}</strong></li>
        ${
          stats.last
            ? `<li><span>Detail terakhir</span><strong>${lastProg?.name || stats.last.path} L${stats.last.level} · ${stats.last.completed}/${stats.last.total}</strong></li>`
            : ""
        }
      </ul>
    </div>
  `;
}
