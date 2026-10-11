/**
 * Context bersama antar modul UI (menghindari circular import).
 * Diisi di main.js setelah modul siap.
 */
export const ctx = {
  /** @type {import('./storage.js').AppState | null} */
  state: null,
  renderHome: () => {},
  renderWorkout: () => {},
  renderSchedule: () => {},
  renderSettings: () => {},
  renderHistory: () => {},
  goTab: () => {},
  startSession: () => {},
  startRest: () => {},
  stopRest: () => {},
};
