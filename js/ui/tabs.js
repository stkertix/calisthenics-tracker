/** Navigasi tab bawah. */

import { $ } from "../lib/dom.js";
import { ctx } from "../context.js";

export function goTab(name) {
  document.querySelector(`.tab[data-tab="${name}"]`)?.click();
}

export function bindTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", "false"));
      tab.setAttribute("aria-selected", "true");
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      $(`#panel-${tab.dataset.tab}`).classList.add("active");
      if (tab.dataset.tab === "workout") ctx.renderWorkout();
      if (tab.dataset.tab === "history") ctx.renderHistory();
      if (tab.dataset.tab === "settings") ctx.renderSettings();
      if (tab.dataset.tab === "home") ctx.renderHome();
    });
  });
  ctx.goTab = goTab;
}
