/** Persistensi localStorage: master, history, session + migrasi. */

import {
  SCHEMA_VERSION,
  STORAGE,
  LEGACY_STORAGE_KEY,
  HISTORY_MAX,
  MIGRATIONS,
} from "./config.js";
import { getPrograms, getSchedules, getBaseline } from "./catalog.js";
import { ctx } from "./context.js";

/**
 * @typedef {object} AppState
 * @property {string} activePath
 * @property {Record<string, number>} levels
 * @property {string} schedule
 * @property {Record<string, boolean>} baseline
 * @property {object[]} history
 * @property {object | null} session
 */

export function defaultMaster() {
  return {
    activePath: "push",
    levels: { push: 1, pull: 1, squat: 1, muscleup: 1 },
    schedule: "split",
    baseline: {},
  };
}

export function defaultState() {
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

function clampLevel(pathId, value) {
  const PROGRAMS = getPrograms();
  const max = PROGRAMS[pathId]?.maxLevel || 1;
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(max, Math.max(1, Math.round(n)));
}

/** Samakan progress/history/session dengan katalog saat ini. */
function reconcileWithCatalog(data) {
  const PROGRAMS = getPrograms();
  const SCHEDULES = getSchedules();
  const BASELINE = getBaseline();
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

export function loadState() {
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

function currentState() {
  return ctx.state;
}

export function saveMaster() {
  const state = currentState();
  writeJson(STORAGE.master, {
    activePath: state.activePath,
    levels: state.levels,
    schedule: state.schedule,
    baseline: state.baseline,
  });
}

export function saveHistory() {
  writeJson(STORAGE.history, currentState().history);
}

export function saveSession() {
  const state = currentState();
  if (state.session) writeJson(STORAGE.session, state.session);
  else localStorage.removeItem(STORAGE.session);
}

export function saveState() {
  saveMaster();
  saveHistory();
  saveSession();
}

export function clearAllStorage() {
  Object.values(STORAGE).forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}
