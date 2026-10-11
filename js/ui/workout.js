/** Tab Sesi: checklist latihan aktif. */

import { $, toast } from "../lib/dom.js";
import { getPrograms, guideFor } from "../catalog.js";
import { saveSession, saveHistory } from "../storage.js";
import { HISTORY_MAX } from "../config.js";
import { ctx } from "../context.js";

export function startSession() {
  const state = ctx.state;
  const PROGRAMS = getPrograms();
  const prog = PROGRAMS[state.activePath];
  const level = state.levels[prog.id] || 1;
  const exercises = prog.levels[level].exercises.map((ex, i) => ({
    ...ex,
    id: i,
    done: false,
    open: i === 0,
    loggedSets: ex.sets,
    loggedReps: ex.reps,
    loggedNote: "",
  }));
  state.session = {
    path: prog.id,
    level,
    startedAt: new Date().toISOString(),
    exercises,
  };
  saveSession();
  ctx.goTab("workout");
  renderWorkout();
  toast("Sesi mulai");
}

function toggleDone(id) {
  const state = ctx.state;
  const ex = state.session.exercises.find((x) => x.id === id);
  if (!ex) return;
  ex.done = !ex.done;
  if (ex.done) {
    const next = state.session.exercises.find((x) => !x.done);
    state.session.exercises.forEach((x) => {
      x.open = next ? x.id === next.id : false;
    });
    ctx.startRest(ex.rest);
  }
  saveSession();
  renderWorkout();
}

function finishSession() {
  const state = ctx.state;
  const s = state.session;
  if (!s) return;
  const done = s.exercises.filter((e) => e.done);
  if (!done.length) return;
  state.history.unshift({
    path: s.path,
    level: s.level,
    startedAt: s.startedAt,
    endedAt: new Date().toISOString(),
    completed: done.length,
    total: s.exercises.length,
    notes: done.map((e) => ({
      name: e.name,
      sets: e.loggedSets,
      reps: e.loggedReps,
      note: e.loggedNote,
    })),
  });
  state.history = state.history.slice(0, HISTORY_MAX);
  state.session = null;
  saveHistory();
  saveSession();
  ctx.stopRest();
  toast("Sesi tersimpan");
  ctx.goTab("history");
  ctx.renderHistory();
}

export function renderWorkout() {
  const state = ctx.state;
  const PROGRAMS = getPrograms();
  const view = $("#workoutView");

  if (!state.session) {
    const prog = PROGRAMS[state.activePath];
    const level = state.levels[prog.id];
    $("#heroLevel").textContent = `${prog.name} · L${level}`;
    view.innerHTML = `
      <div class="level-card">
        <h3>Belum ada sesi</h3>
        <p>${prog.name} Level ${level} siap dimulai.</p>
      </div>
      <div class="sticky-cta">
        <button type="button" class="btn" id="btnStartEmpty">Mulai L${level}</button>
      </div>`;
    $("#btnStartEmpty").addEventListener("click", startSession);
    return;
  }

  const prog = PROGRAMS[state.session.path];
  const doneCount = state.session.exercises.filter((e) => e.done).length;
  const total = state.session.exercises.length;
  const pct = Math.round((doneCount / total) * 100);
  const current =
    state.session.exercises.find((e) => e.open) ||
    state.session.exercises.find((e) => !e.done);
  $("#heroLevel").textContent = `${prog.name} · L${state.session.level}`;

  view.innerHTML = `
    <div class="session-top">
      <h2>${prog.name} L${state.session.level}</h2>
      <span class="pill-stat">${doneCount}/${total}</span>
    </div>
    <div class="session-progress">
      <div class="bar"><i style="width:${pct}%"></i></div>
    </div>
    <div class="exercise-list" id="exerciseList"></div>
    <div class="sticky-cta">
      <button type="button" class="btn" id="btnFinish" ${doneCount === 0 ? "disabled" : ""}>Simpan</button>
      <button type="button" class="btn ghost iconish" id="btnCancel" title="Batalkan">✕</button>
    </div>`;

  const list = $("#exerciseList");
  const ordered = [...state.session.exercises].sort((a, b) => {
    if (a.open && !b.open) return -1;
    if (!a.open && b.open) return 1;
    return a.id - b.id;
  });

  list.innerHTML = ordered
    .map((ex) => {
      const g = guideFor(ex.name);
      const cues = (g.cues || []).map((c) => `<li>${c}</li>`).join("");
      return `
    <div class="exercise ${ex.done ? "done" : ""} ${ex.open ? "open" : ""}" data-id="${ex.id}">
      <button type="button" class="exercise-head" data-toggle="${ex.id}">
        <span class="check" data-check="${ex.id}" aria-hidden="true"></span>
        <span style="flex:1;min-width:0">
          <p class="ex-title">${ex.name}</p>
          <p class="ex-meta">${ex.sets}×${ex.reps} · ${ex.tempo} · ${ex.rest}s</p>
        </span>
      </button>
      <div class="ex-body">
        <details class="fold" style="margin-bottom:0.45rem;border-color:var(--line)">
          <summary>Petunjuk</summary>
          <div class="fold-body">
            <p class="ex-desc">${g.desc}</p>
            <ul class="ex-cues">${cues}</ul>
          </div>
        </details>
        <div class="ex-fields">
          <label class="field">Set<input type="number" min="1" data-field="loggedSets" data-id="${ex.id}" value="${ex.loggedSets}" /></label>
          <label class="field">Rep<input type="text" data-field="loggedReps" data-id="${ex.id}" value="${ex.loggedReps}" /></label>
          <label class="field">Rest<input type="number" min="0" data-rest="${ex.id}" value="${ex.rest}" /></label>
        </div>
        <details class="fold" style="margin-bottom:0.4rem;border-color:var(--line)">
          <summary>Catatan</summary>
          <div class="fold-body">
            <textarea class="note-input" data-field="loggedNote" data-id="${ex.id}" placeholder="Form, RPE, band…">${ex.loggedNote || ""}</textarea>
          </div>
        </details>
        <div class="ex-quick">
          <button type="button" class="btn secondary" data-mark="${ex.id}">${ex.done ? "Batal ✓" : "Selesai ✓"}</button>
          <button type="button" class="btn ghost" data-timer="${ex.id}">Rest ${ex.rest}s</button>
        </div>
      </div>
    </div>`;
    })
    .join("");

  const openEl = list.querySelector(".exercise.open");
  if (openEl && current) {
    requestAnimationFrame(() => openEl.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }

  list.querySelectorAll("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      if (e.target.closest("[data-check]")) {
        toggleDone(+btn.dataset.toggle);
        return;
      }
      const id = +btn.dataset.toggle;
      state.session.exercises.forEach((ex) => {
        ex.open = ex.id === id ? !ex.open : false;
      });
      saveSession();
      renderWorkout();
    });
  });

  list.querySelectorAll("[data-check]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleDone(+el.dataset.check);
    });
  });

  list.querySelectorAll("[data-mark]").forEach((btn) => {
    btn.addEventListener("click", () => toggleDone(+btn.dataset.mark));
  });

  list.querySelectorAll("[data-timer]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = +btn.dataset.timer;
      const input = list.querySelector(`[data-rest="${id}"]`);
      ctx.startRest(+(input?.value || state.session.exercises.find((x) => x.id === id)?.rest || 60));
    });
  });

  list.querySelectorAll("[data-field]").forEach((input) => {
    input.addEventListener("change", () => {
      const id = +input.dataset.id;
      const field = input.dataset.field;
      const ex = state.session.exercises.find((x) => x.id === id);
      if (!ex) return;
      ex[field] = input.type === "number" ? +input.value : input.value;
      saveSession();
    });
  });

  $("#btnFinish").addEventListener("click", finishSession);
  $("#btnCancel").addEventListener("click", () => {
    if (!confirm("Batalkan sesi?")) return;
    state.session = null;
    saveSession();
    ctx.stopRest();
    renderWorkout();
    toast("Sesi dibatalkan");
  });
}
