/** Timer istirahat antar set. */

import { $, toast } from "./lib/dom.js";
import { ctx } from "./context.js";

let restTimer = null;
let restLeft = 0;

function updateRestDisplay() {
  const m = Math.floor(restLeft / 60);
  const s = restLeft % 60;
  $("#restTime").textContent = `${m}:${String(s).padStart(2, "0")}`;
}

export function stopRest() {
  clearInterval(restTimer);
  restTimer = null;
  $("#restBar").classList.remove("on");
}

export function startRest(seconds) {
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

export function bindRestControls() {
  $("#restSkip").addEventListener("click", stopRest);
  $("#restAdd").addEventListener("click", () => {
    restLeft += 30;
    if (!restTimer) startRest(restLeft);
    else updateRestDisplay();
  });
  ctx.startRest = startRest;
  ctx.stopRest = stopRest;
}
