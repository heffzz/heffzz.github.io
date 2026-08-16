/* ha-glass-theme.js — tema dark glass per la dashboard "La mia casa"
   Risorsa Lovelace globale; si attiva SOLO sulle pagine /la-mia-casa/ */
(() => {
  if (window.__haGlassTheme) return;
  window.__haGlassTheme = true;

  const CSS = `
/* ============ VARIABILI TEMA (dark glass) ============ */
home-assistant.glass-theme {
  --primary-color: #00d9ff;
  --accent-color: #9d6bff;
  --primary-text-color: #e8f1ff;
  --secondary-text-color: #a3b8d6;
  --disabled-text-color: #5a6c8a;
  --card-background-color: rgba(15, 24, 44, 0.55);
  --app-background-color: #070d19;
  --sidebar-background-color: rgba(10, 17, 32, 0.85);
  --app-header-background-color: rgba(8, 14, 28, 0.5);
  --ha-card-border-radius: 18px;
  --ha-card-border-width: 1px;
  --ha-card-border-color: rgba(0, 217, 255, 0.14);
  --ha-card-box-shadow: 0 10px 32px rgba(0, 0, 0, 0.45);
  --mdc-theme-primary: #00d9ff;
  --mdc-theme-secondary: #9d6bff;
  --switch-checked-color: #00d9ff;
  --switch-unchecked-color: rgba(255,255,255,0.15);
  --divider-color: rgba(0, 217, 255, 0.12);
  --primary-background-color: #0a1120;
  --secondary-background-color: #0d1830;
  --input-fill-color: rgba(255,255,255,0.06);
  --input-text-color: #e8f1ff;
  --state-icon-color: #93a7c4;
  --state-icon-active-color: #00d9ff;
  --energy-date-selection-icon-color: #00d9ff;
  --paper-item-icon-color: #93a7c4;
  --paper-item-icon-active-color: #00d9ff;
  --label-badge-background-color: rgba(0,217,255,0.12);
  --label-badge-text-color: #00d9ff;
  --info-color: #00d9ff;
  --success-color: #22ff88;
  --warning-color: #ffb020;
  --error-color: #ff4455;
}

/* ============ PANNELLI SEZIONE = VETRO ============ */
home-assistant.glass-theme hui-grid-section {
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 22px !important;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255,255,255,0.06) !important;
  backdrop-filter: blur(18px) saturate(150%) !important;
  -webkit-backdrop-filter: blur(18px) saturate(150%) !important;
  overflow: hidden;
}
home-assistant.glass-theme hui-grid-section > .section-header {
  margin-bottom: 6px;
}
home-assistant.glass-theme hui-grid-section .section-header .section-title {
  font-weight: 700;
  letter-spacing: 0.4px;
  color: #dbe9ff;
}
home-assistant.glass-theme hui-grid-section .section-header ha-icon {
  color: #00d9ff;
}

/* ============ CARD = VETRO ============ */
home-assistant.glass-theme ha-card {
  background: rgba(13, 22, 42, 0.62) !important;
  backdrop-filter: blur(12px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(12px) saturate(140%) !important;
  border: 1px solid rgba(255, 255, 255, 0.07) !important;
  border-radius: 18px !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35) !important;
  color: #e8f1ff;
}
home-assistant.glass-theme ha-card:hover {
  border-color: rgba(0, 217, 255, 0.35) !important;
  box-shadow: 0 8px 28px rgba(0, 217, 255, 0.12) !important;
}

/* ============ HEADER VISTA ============ */
home-assistant.glass-theme hui-sections-view .view-header {
  margin-bottom: 8px;
}
home-assistant.glass-theme hui-sections-view .view-header .title {
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.5px;
  background: linear-gradient(120deg, #ffffff 0%, #9fdcff 60%, #9d6bff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: none;
}
home-assistant.glass-theme hui-sections-view .view-header .subtitle {
  color: #93a7c4;
  font-weight: 500;
}

/* ============ TILE / DETTAGLI ============ */
home-assistant.glass-theme hui-tile-card ha-tile {
  --tile-color: #00d9ff;
}
home-assistant.glass-theme hui-tile-card ha-tile[active] {
  --tile-color: #22ff88;
}
home-assistant.glass-theme hui-tile-card ha-tile .tile-info {
  color: #e8f1ff;
}
home-assistant.glass-theme hui-tile-card ha-tile .tile-badge {
  color: #9d6bff;
}

/* ============ MEDIA CONTROL (dark anche se unavailable) ============ */
home-assistant.glass-theme hui-media-control-card ha-card {
  background: rgba(13, 22, 42, 0.62) !important;
}
home-assistant.glass-theme hui-media-control-card .media-card-icon-container {
  background: rgba(0, 217, 255, 0.14) !important;
  color: #00d9ff !important;
}
home-assistant.glass-theme hui-media-control-card .media-card-title,
home-assistant.glass-theme hui-media-control-card .media-card-subtitle {
  color: #e8f1ff !important;
}
home-assistant.glass-theme hui-media-control-card .media-button {
  color: #93a7c4 !important;
}

/* ============ GAUGE ============ */
home-assistant.glass-theme hui-gauge-card ha-gauge {
  --gauge-color: #00d9ff;
}

/* ============ BOTTONI AZIONE RAPIDA ============ */
home-assistant.glass-theme hui-button-card ha-state-icon {
  color: #00d9ff;
}
home-assistant.glass-theme hui-button-card ha-card {
  border-radius: 20px !important;
}
home-assistant.glass-theme hui-button-card ha-card[data-active] {
  border-color: rgba(0, 217, 255, 0.5) !important;
  box-shadow: 0 0 24px rgba(0, 217, 255, 0.25) !important;
}

/* ============ HEADING CARD ============ */
home-assistant.glass-theme hui-heading-card {
  color: #dbe9ff;
}
home-assistant.glass-theme hui-heading-card .heading-content {
  font-weight: 800;
}

/* ============ BADGE ============ */
home-assistant.glass-theme hui-view-badges {
  gap: 8px;
}
home-assistant.glass-theme hui-badge {
  --badge-background-color: rgba(10, 18, 36, 0.65);
  border: 1px solid rgba(0, 217, 255, 0.18);
  border-radius: 14px;
  backdrop-filter: blur(10px);
}

/* ============ TABELLE/ENTITIES ============ */
home-assistant.glass-theme hui-entities-card ha-icon {
  color: #93a7c4;
}
home-assistant.glass-theme hui-entities-card .secondary {
  color: #8fa8cc;
  font-size: 13px;
}

/* ============ SCROLLBAR SUBTLE ============ */
home-assistant.glass-theme ::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
home-assistant.glass-theme ::-webkit-scrollbar-thumb {
  background: rgba(0, 217, 255, 0.25);
  border-radius: 8px;
}
home-assistant.glass-theme ::-webkit-scrollbar-track {
  background: transparent;
}
`;

  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  const isTarget = () => location.pathname.startsWith("/la-mia-casa");
  const apply = () => {
    const ha = document.querySelector("home-assistant");
    if (!ha) return;
    ha.classList.toggle("glass-theme", isTarget());
  };
  // applica quando il DOM è pronto e a ogni cambio URL (SPA)
  const t0 = setInterval(() => {
    const ha = document.querySelector("home-assistant");
    if (ha) { apply(); clearInterval(t0); }
  }, 300);
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) { lastPath = location.pathname; apply(); }
  }, 600);
  window.addEventListener("popstate", apply);
})();
