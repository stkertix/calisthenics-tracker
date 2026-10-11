/** Tab Jalur: pilih path, level, mulai sesi. */

import { $, toast, hoursSince } from "../lib/dom.js";
import { getPrograms, guideFor } from "../catalog.js";
import { saveMaster } from "../storage.js";
import { ctx } from "../context.js";

function lastSessionFor(pathId) {
  return ctx.state.history.find((h) => h.path === pathId);
}

export function renderHome() {
  const state = ctx.state;
  const PROGRAMS = getPrograms();
  const grid = $("#pathGrid");

  grid.innerHTML = Object.values(PROGRAMS)
    .map((p) => {
      const lvl = state.levels[p.id] || 1;
      const last = lastSessionFor(p.id);
      const restH = hoursSince(last?.endedAt);
      const restNote =
        restH < 48
          ? `<span class="rest-warn">Istirahat ${Math.max(0, Math.ceil(48 - restH))}j</span>`
          : `L${lvl}/${p.maxLevel}`;
      return `
        <button type="button" class="path-btn ${state.activePath === p.id ? "active" : ""}" data-path="${p.id}">
          <span class="code">${p.name}</span>
          <span class="meta">${p.goal}<br>${restNote}</span>
        </button>`;
    })
    .join("");

  grid.querySelectorAll(".path-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activePath = btn.dataset.path;
      saveMaster();
      renderHome();
    });
  });

  const prog = PROGRAMS[state.activePath];
  const level = state.levels[prog.id] || 1;
  const info = prog.levels[level];
  $("#heroLevel").textContent = `${prog.name} · L${level}`;

  const dots = Array.from({ length: prog.maxLevel }, (_, i) => {
    const n = i + 1;
    const cls = n < level ? "done" : n === level ? "current" : "";
    return `<div class="level-dot ${cls}" title="Level ${n}"></div>`;
  }).join("");

  const focusIdx = Math.min(
    prog.chain.length - 1,
    Math.max(0, Math.round(((level - 1) / Math.max(1, prog.maxLevel - 1)) * (prog.chain.length - 1)))
  );
  const chainRows = prog.chain
    .map((step, i) => {
      const g = guideFor(step);
      const isFocus = i === focusIdx;
      const isDone = i < focusIdx;
      const isGoal = i === prog.chain.length - 1;
      const rowClass = [isFocus ? "is-focus" : "", isDone ? "is-done" : ""].filter(Boolean).join(" ");
      const badge = isFocus
        ? `<span class="chain-badge">Fokus</span>`
        : isGoal
          ? `<span class="chain-badge">Goal</span>`
          : "";
      return `
        <tr class="${rowClass}">
          <td><span class="num">${i + 1}</span></td>
          <td>
            <span class="move-name">${step}</span>${badge}
          </td>
          <td><span class="move-desc">${g.desc}</span></td>
        </tr>`;
    })
    .join("");

  $("#pathDetail").innerHTML = `
    <div class="level-track" aria-hidden="true">${dots}</div>
    <div class="level-card">
      <h3>L${level} · ${info.focus}</h3>
      <div class="criteria">
        <strong>Naik level bila</strong>
        ${info.advance}
      </div>
      <details class="fold">
        <summary>Rantai progresi (${prog.chain.length})</summary>
        <div class="fold-body">
          <div class="chain-table-wrap">
            <table class="chain-table">
              <tbody>${chainRows}</tbody>
            </table>
          </div>
        </div>
      </details>
      <details class="fold">
        <summary>Level + / −</summary>
        <div class="fold-body actions" style="padding-top:0.35rem">
          <button type="button" class="btn secondary" id="btnAdvance" ${level >= prog.maxLevel ? "disabled" : ""}>Naik level</button>
          <button type="button" class="btn ghost" id="btnDown" ${level <= 1 ? "disabled" : ""}>Turun level</button>
        </div>
      </details>
    </div>
    <div class="sticky-cta">
      <button type="button" class="btn" id="btnStart">Mulai L${level}</button>
    </div>`;

  $("#btnStart").addEventListener("click", () => ctx.startSession());
  $("#btnAdvance")?.addEventListener("click", () => {
    if (level >= prog.maxLevel) return;
    if (!confirm(`Naik ke Level ${level + 1}?`)) return;
    state.levels[prog.id] = level + 1;
    saveMaster();
    toast(`Naik ke Level ${level + 1}`);
    renderHome();
  });
  $("#btnDown")?.addEventListener("click", () => {
    if (level <= 1) return;
    state.levels[prog.id] = level - 1;
    saveMaster();
    toast(`Turun ke Level ${level - 1}`);
    renderHome();
  });
}
