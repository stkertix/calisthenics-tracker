/** Tab Setting: menu + subhalaman (Dashboard, Jadwal, About, …). */

import { $ } from "../lib/dom.js";
import { APP_NAME, APP_VERSION, SCHEMA_VERSION } from "../config.js";
import { renderSchedule } from "./schedule.js";
import { renderDashboard } from "./dashboard.js";
import { ctx } from "../context.js";

/** @type {null | "dashboard" | "schedule" | "about"} */
let settingsView = null;

const MENU = [
  {
    id: "dashboard",
    title: "Dashboard",
    desc: "Ringkasan progres & volume latihan",
  },
  {
    id: "schedule",
    title: "Jadwal",
    desc: "Pola mingguan & baseline muscle-up",
  },
  {
    id: "about",
    title: "About",
    desc: "Versi app & atribusi sumber",
  },
];

const SUBVIEWS = {
  dashboard: "settingsDashboard",
  schedule: "settingsSchedule",
  about: "settingsAbout",
};

const TITLES = {
  dashboard: "Dashboard",
  schedule: "Jadwal",
  about: "About",
};

function hideAllSubs() {
  Object.values(SUBVIEWS).forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  });
}

function setSubTitle(label) {
  const title = $("#settingsTitle");
  if (!title) return;
  title.innerHTML = `
    <button type="button" class="settings-back" id="settingsBack" aria-label="Kembali ke Setting">‹</button>
    <span>${label}</span>`;
  $("#settingsBack")?.addEventListener("click", showMenu);
}

function showMenu() {
  settingsView = null;
  const title = $("#settingsTitle");
  const menu = $("#settingsMenu");
  if (title) title.textContent = "Setting";
  hideAllSubs();
  if (menu) {
    menu.hidden = false;
    menu.innerHTML = MENU.map(
      (item) => `
      <button type="button" class="settings-item" data-settings="${item.id}">
        <span class="settings-item-text">
          <strong>${item.title}</strong>
          <span>${item.desc}</span>
        </span>
        <span class="settings-item-chevron" aria-hidden="true">›</span>
      </button>`
    ).join("");
    menu.querySelectorAll("[data-settings]").forEach((btn) => {
      btn.addEventListener("click", () => openSettingsView(btn.dataset.settings));
    });
  }
}

function renderAbout() {
  const el = $("#settingsAbout");
  if (!el) return;
  el.innerHTML = `
    <div class="about-brand">
      <strong>${APP_NAME}</strong>
      <span>v${APP_VERSION}</span>
    </div>
    <p class="about-lead">
      Tracker progresi calisthenics bertahap (Push, Pull, Squat, Muscle-up).
      Dioptimalkan untuk dipakai di HP dan bisa di-install sebagai PWA.
    </p>
    <ul class="about-meta">
      <li><span>Schema data</span><strong>v${SCHEMA_VERSION}</strong></li>
      <li><span>Penyimpanan</span><strong>localStorage perangkat</strong></li>
    </ul>
    <div class="about-block">
      <h3>Sumber program</h3>
      <p>
        Ringkasan struktur progresi mengacu pada Yellow Dude / Gravgear Calisthenics Playbook.
        Alat bantu pribadi — bukan pengganti buku resmi.
      </p>
      <p class="about-links">
        <a href="https://yellowdude.co" target="_blank" rel="noopener">yellowdude.co</a>
        <a href="https://thegravgear.com" target="_blank" rel="noopener">thegravgear.com</a>
      </p>
    </div>
    <p class="about-disclaimer">
      Panduan umum kebugaran, bukan saran medis. Latihan dengan form aman dan istirahat cukup.
    </p>
  `;
}

function openSettingsView(id) {
  if (!SUBVIEWS[id]) return;

  const menu = $("#settingsMenu");
  if (menu) menu.hidden = true;
  hideAllSubs();

  settingsView = id;
  setSubTitle(TITLES[id] || id);

  const panel = document.getElementById(SUBVIEWS[id]);
  if (panel) panel.hidden = false;

  if (id === "dashboard") renderDashboard();
  if (id === "schedule") renderSchedule();
  if (id === "about") renderAbout();
}

export function renderSettings() {
  if (settingsView && SUBVIEWS[settingsView]) {
    openSettingsView(settingsView);
  } else {
    showMenu();
  }
}

export function bindSettings() {
  ctx.renderSettings = renderSettings;
}
