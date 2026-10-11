/** Tab Jadwal: pola mingguan + baseline muscle-up. */

import { $ } from "../lib/dom.js";
import { getSchedules, getBaseline, getDays } from "../catalog.js";
import { saveMaster } from "../storage.js";
import { ctx } from "../context.js";

export function renderSchedule() {
  const state = ctx.state;
  const SCHEDULES = getSchedules();
  const BASELINE = getBaseline();
  const DAYS = getDays();

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
