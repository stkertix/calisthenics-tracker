/** Entry point — bootstrap katalog, storage, dan UI. */

import { loadCatalog, showCatalogLoadError } from "./catalog.js";
import { loadState } from "./storage.js";
import { ctx } from "./context.js";
import { bindRestControls } from "./rest.js";
import { bindTabs } from "./ui/tabs.js";
import { renderHome } from "./ui/home.js";
import { renderWorkout, startSession } from "./ui/workout.js";
import { renderSchedule } from "./ui/schedule.js";
import { renderHistory, bindHistoryActions } from "./ui/history.js";
import { registerServiceWorker } from "./pwa.js";

async function boot() {
  try {
    await loadCatalog();
  } catch (err) {
    console.error(err);
    showCatalogLoadError();
    return;
  }

  ctx.state = loadState();
  ctx.renderHome = renderHome;
  ctx.renderWorkout = renderWorkout;
  ctx.renderSchedule = renderSchedule;
  ctx.renderHistory = renderHistory;
  ctx.startSession = startSession;

  bindTabs();
  bindRestControls();
  bindHistoryActions();

  renderHome();
  registerServiceWorker();
}

boot();
