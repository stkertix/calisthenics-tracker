/* Calisthenics Tracker — app logic */
(async function boot() {
  const SCHEMA_VERSION = 1;

  const STORAGE = {
    meta: "yd-calisthenics-tracker:meta",
    master: "yd-calisthenics-tracker:master-v1",
    history: "yd-calisthenics-tracker:history-v1",
    session: "yd-calisthenics-tracker:session-v1",
  };
  const LEGACY_STORAGE_KEY = "yd-calisthenics-tracker-v1";
  const HISTORY_EXPORT_TYPE = "calisthenics-tracker-history";
  const HISTORY_MAX = 60;

  let catalog;
  try {
    const res = await fetch("./data/catalog.json");
    if (!res.ok) throw new Error("HTTP " + res.status);
    catalog = await res.json();
  } catch (err) {
    console.error(err);
    document.body.innerHTML =
      '<main style="font-family:system-ui;padding:2rem;max-width:28rem;margin:auto">' +
      "<h1>Gagal memuat data</h1>" +
      "<p>Pastikan app dijalankan lewat HTTP (bukan file://) agar <code>data/catalog.json</code> bisa dibaca.</p>" +
      "<p><code>python3 -m http.server 8080</code></p>" +
      "</main>";
    return;
  }

  const MOVE_GUIDE = catalog.moveGuide;
  const PROGRAMS = catalog.programs;
  const SCHEDULES = catalog.schedules;
  const BASELINE = catalog.baseline;
  const DAYS = catalog.days;

  function normalizeMoveKey(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function guideFor(name) {
    const key = normalizeMoveKey(name);
    if (MOVE_GUIDE[key]) return MOVE_GUIDE[key];
    // fuzzy: cari key yang terkandung di nama / sebaliknya
    const hit = Object.keys(MOVE_GUIDE).find(
      (k) => key.includes(k) || k.includes(key)
    );
    return hit
      ? MOVE_GUIDE[hit]
      : {
          desc: "Lakukan dengan kontrol penuh. Utamakan form bersih sebelum menambah volume.",
          cues: ["ROM penuh yang aman", "Napas teratur", "Stop jika nyeri tajam"],
        };
  }
  function defaultMaster() {
    return {
      activePath: "push",
      levels: { push: 1, pull: 1, squat: 1, muscleup: 1 },
      schedule: "split",
      baseline: {},
    };
  }

  function defaultState() {
    return {
      ...defaultMaster(),
      history: [],
      session: null,
    };
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback();
      return JSON.parse(raw);
    } catch {
      return fallback();
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function migrateLegacyStorage() {
    const legacy = readJson(LEGACY_STORAGE_KEY, () => null);
    if (!legacy || typeof legacy !== "object") return;

    const hasScoped =
      localStorage.getItem(STORAGE.master) ||
      localStorage.getItem(STORAGE.history) ||
      localStorage.getItem(STORAGE.session);
    if (hasScoped) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return;
    }

    const master = {
      ...defaultMaster(),
      activePath: legacy.activePath ?? defaultMaster().activePath,
      levels: { ...defaultMaster().levels, ...(legacy.levels || {}) },
      schedule: legacy.schedule ?? defaultMaster().schedule,
      baseline: legacy.baseline || {},
    };
    writeJson(STORAGE.master, master);
    writeJson(STORAGE.history, legacy.history || []);
    if (legacy.session) writeJson(STORAGE.session, legacy.session);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }

  /**
   * Step migrasi: key = versi asal (sebelum naik 1).
   * Contoh nanti: 1: (data) => { ...ubah data...; return data; }
   * lalu naikkan SCHEMA_VERSION ke 2.
   */
  const MIGRATIONS = {
    0: (data) => data,
  };

  function clampLevel(pathId, value) {
    const max = PROGRAMS[pathId]?.maxLevel || 1;
    const n = Number(value);
    if (!Number.isFinite(n)) return 1;
    return Math.min(max, Math.max(1, Math.round(n)));
  }

  /** Samakan progress/history/session dengan katalog PROGRAMS & SCHEDULES saat ini. */
  function reconcileWithCatalog(data) {
    const pathIds = Object.keys(PROGRAMS);
    const scheduleIds = new Set(SCHEDULES.map((s) => s.id));
    const baselineIds = new Set(BASELINE.map((b) => b.id));

    if (!pathIds.includes(data.master.activePath)) {
      data.master.activePath = pathIds[0] || "push";
    }

    const levels = {};
    pathIds.forEach((id) => {
      levels[id] = clampLevel(id, data.master.levels?.[id] ?? 1);
    });
    data.master.levels = levels;

    if (!scheduleIds.has(data.master.schedule)) {
      data.master.schedule = "split";
    }

    const baseline = {};
    Object.entries(data.master.baseline || {}).forEach(([id, on]) => {
      if (baselineIds.has(id)) baseline[id] = !!on;
    });
    data.master.baseline = baseline;

    data.history = (Array.isArray(data.history) ? data.history : [])
      .filter((h) => h && typeof h === "object")
      .map((h) => ({
        ...h,
        // path lama tetap disimpan (tampil fallback); level di-clamp jika path masih ada
        level: pathIds.includes(h.path)
          ? clampLevel(h.path, h.level)
          : Math.max(1, Number(h.level) || 1),
      }))
        .slice(0, HISTORY_MAX);

      const session = data.session;
    if (session && typeof session === "object") {
      const prog = PROGRAMS[session.path];
      const levelOk = prog && session.level >= 1 && session.level <= prog.maxLevel;
      const exercisesOk = Array.isArray(session.exercises) && session.exercises.length > 0;
      data.session = levelOk && exercisesOk
        ? { ...session, level: clampLevel(session.path, session.level) }
        : null;
    } else {
      data.session = null;
    }

    return data;
  }

  function readScopedData() {
    const masterRaw = readJson(STORAGE.master, defaultMaster);
    const history = readJson(STORAGE.history, () => []);
    const session = readJson(STORAGE.session, () => null);
    return {
      master: {
        ...defaultMaster(),
        ...masterRaw,
        levels: { ...defaultMaster().levels, ...(masterRaw.levels || {}) },
        baseline: masterRaw.baseline || {},
      },
      history: Array.isArray(history) ? history : [],
      session,
    };
  }

  function persistScopedData(data) {
    writeJson(STORAGE.meta, { schemaVersion: SCHEMA_VERSION });
    writeJson(STORAGE.master, data.master);
    writeJson(STORAGE.history, data.history);
    if (data.session) writeJson(STORAGE.session, data.session);
    else localStorage.removeItem(STORAGE.session);
  }

  function migrateAndLoad() {
    migrateLegacyStorage();

    let data = readScopedData();
    const meta = readJson(STORAGE.meta, () => ({ schemaVersion: 0 }));
    let from = Number(meta.schemaVersion);
    if (!Number.isFinite(from) || from < 0) from = 0;

    while (from < SCHEMA_VERSION) {
      const step = MIGRATIONS[from];
      if (typeof step === "function") data = step(data) || data;
      from += 1;
    }

    data = reconcileWithCatalog(data);
    persistScopedData(data);

    return {
      ...data.master,
      history: data.history,
      session: data.session,
    };
  }

  function loadState() {
    return migrateAndLoad();
  }

  function saveMaster() {
    writeJson(STORAGE.master, {
      activePath: state.activePath,
      levels: state.levels,
      schedule: state.schedule,
      baseline: state.baseline,
    });
  }

  function saveHistory() {
    writeJson(STORAGE.history, state.history);
  }

  function saveSession() {
    if (state.session) writeJson(STORAGE.session, state.session);
    else localStorage.removeItem(STORAGE.session);
  }

  function saveState() {
    saveMaster();
    saveHistory();
    saveSession();
  }

  function clearAllStorage() {
    Object.values(STORAGE).forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }

  let state = loadState();
  let restTimer = null;
  let restLeft = 0;

  const $ = (sel) => document.querySelector(sel);

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function hoursSince(iso) {
    if (!iso) return Infinity;
    return (Date.now() - new Date(iso).getTime()) / 36e5;
  }

  function lastSessionFor(pathId) {
    return state.history.find((h) => h.path === pathId);
  }

  /* —— Tabs —— */
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", "false"));
      tab.setAttribute("aria-selected", "true");
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      $(`#panel-${tab.dataset.tab}`).classList.add("active");
      if (tab.dataset.tab === "workout") renderWorkout();
      if (tab.dataset.tab === "history") renderHistory();
      if (tab.dataset.tab === "schedule") renderSchedule();
      if (tab.dataset.tab === "home") renderHome();
    });
  });

  function goTab(name) {
    document.querySelector(`.tab[data-tab="${name}"]`)?.click();
  }

  /* —— Home —— */
  function renderHome() {
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
        const rowClass = [isFocus ? "is-focus" : "", isDone ? "is-done" : ""]
          .filter(Boolean)
          .join(" ");
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

    $("#btnStart").addEventListener("click", () => startSession());
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

  /* —— Session —— */
  function startSession() {
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
    goTab("workout");
    renderWorkout();
    toast("Sesi mulai");
  }

  function renderWorkout() {
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
    const current = state.session.exercises.find((e) => e.open) || state.session.exercises.find((e) => !e.done);
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
    // Compact: current open first, then the rest
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

    // Scroll current into view lightly
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
        startRest(+(input?.value || state.session.exercises.find((x) => x.id === id)?.rest || 60));
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
      stopRest();
      renderWorkout();
      toast("Sesi dibatalkan");
    });
  }

  function toggleDone(id) {
    const ex = state.session.exercises.find((x) => x.id === id);
    if (!ex) return;
    ex.done = !ex.done;
    if (ex.done) {
      const next = state.session.exercises.find((x) => !x.done);
      state.session.exercises.forEach((x) => {
        x.open = next ? x.id === next.id : false;
      });
      startRest(ex.rest);
    }
    saveSession();
    renderWorkout();
  }

  function finishSession() {
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
    stopRest();
    toast("Sesi tersimpan");
    goTab("history");
    renderHistory();
  }

  /* —— Rest timer —— */
  function startRest(seconds) {
    stopRest();
    restLeft = Math.max(0, Math.round(seconds));
    if (restLeft <= 0) return;
    $("#restBar").classList.add("on");
    updateRestDisplay();
    restTimer = setInterval(() => {
      restLeft -= 1;
      updateRestDisplay();
      if (restLeft <= 0) {
        stopRest();
        toast("Istirahat selesai");
        try {
          if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
        } catch (_) {}
      }
    }, 1000);
  }

  function updateRestDisplay() {
    const m = Math.floor(restLeft / 60);
    const s = restLeft % 60;
    $("#restTime").textContent = `${m}:${String(s).padStart(2, "0")}`;
  }

  function stopRest() {
    clearInterval(restTimer);
    restTimer = null;
    $("#restBar").classList.remove("on");
  }

  $("#restSkip").addEventListener("click", stopRest);
  $("#restAdd").addEventListener("click", () => {
    restLeft += 30;
    if (!restTimer) startRest(restLeft);
    else updateRestDisplay();
  });

  /* —— Schedule —— */
  function renderSchedule() {
    $("#scheduleOptions").innerHTML = SCHEDULES.map(
      (sch) => `
      <label>
        <input type="radio" name="schedule" value="${sch.id}" ${state.schedule === sch.id ? "checked" : ""} />
        <div>
          <strong>${sch.title}</strong>
          <span>${sch.desc}</span>
        </div>
      </label>`
    ).join("");

    $("#scheduleOptions").querySelectorAll("input").forEach((input) => {
      input.addEventListener("change", () => {
        state.schedule = input.value;
        saveMaster();
        renderSchedule();
      });
    });

    const sch = SCHEDULES.find((s) => s.id === state.schedule) || SCHEDULES[1];
    $("#weekPreview").innerHTML = `
      <div class="week-chip-row">
        ${sch.week.map((d, i) => `<div class="week-chip"><strong>${DAYS[i]}</strong>${d}</div>`).join("")}
      </div>`;

    $("#baselineBlock").innerHTML = `
      <details class="fold">
        <summary>Baseline muscle-up</summary>
        <div class="fold-body">
          <ul class="baseline">
            ${BASELINE.map(
              (b) => `
              <li>
                <input type="checkbox" id="bl-${b.id}" ${state.baseline[b.id] ? "checked" : ""} data-bl="${b.id}" />
                <label for="bl-${b.id}">${b.label}</label>
              </li>`
            ).join("")}
          </ul>
          <p style="font-size:0.78rem;color:var(--ink-soft);margin:0.5rem 0 0">
            Prioritas: <strong>Pull → Dips → Teknik</strong>
          </p>
        </div>
      </details>`;

    $("#baselineBlock").querySelectorAll("[data-bl]").forEach((cb) => {
      cb.addEventListener("change", () => {
        state.baseline[cb.dataset.bl] = cb.checked;
        saveMaster();
      });
    });
  }

  /* —— History —— */
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
    renderHome();
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

  function renderHistory() {
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
    state = defaultState();
    clearAllStorage();
    saveState();
    stopRest();
    renderHome();
    renderHistory();
    toast("Data direset");
  });

  /* —— Resume open session —— */
  renderHome();
  if (state.session) {
    // keep session available on workout tab
  }

  /* —— PWA —— */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

})();
