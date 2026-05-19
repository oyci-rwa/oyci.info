/*
 * Renders the NWS forecast from /weather.json into the .weather-card.
 * Refreshed daily at 04:00 UTC by fetch-weather.yml.
 */
(async () => {
  const card = document.getElementById("weather-card");
  if (!card) return;

  const escapeHTML = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));

  const fmtDate = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };

  const fmtTime = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/New_York",
    });
  };

  try {
    const r = await fetch("weather.json", { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json();

    if (!Array.isArray(data.periods) || data.periods.length === 0) {
      card.innerHTML = '<div class="wx-empty">Forecast unavailable.</div>';
      return;
    }

    const today = data.periods[0];
    const tonight = data.periods[1];
    const tomorrow = data.periods[2];

    const todayLabel = today.is_daytime
      ? "Today's high"
      : "Tonight";
    const nightLabel = today.is_daytime ? "Overnight low" : null;

    card.innerHTML = `
      <div class="wx-head">
        <div class="wx-loc">
          <span class="wx-kicker">Today in Menchville</span>
          <span class="wx-day">${escapeHTML(fmtDate(today.start))}</span>
        </div>
        <span class="wx-updated">Updated ${escapeHTML(fmtTime(data.updated_at))} ET</span>
      </div>
      <div class="wx-grid">
        <div class="wx-cell">
          <div class="wx-label">${escapeHTML(todayLabel)}</div>
          <div class="wx-value">${escapeHTML(String(today.temperature))}°${escapeHTML(today.temperature_unit || "F")}</div>
        </div>
        ${
          today.is_daytime && tonight
            ? `<div class="wx-cell">
                 <div class="wx-label">${escapeHTML(nightLabel)}</div>
                 <div class="wx-value">${escapeHTML(String(tonight.temperature))}°${escapeHTML(tonight.temperature_unit || "F")}</div>
               </div>`
            : ""
        }
        <div class="wx-cell wx-cell-wide">
          <div class="wx-label">Conditions</div>
          <div class="wx-value wx-value-text">${escapeHTML(today.short_forecast || "—")}</div>
        </div>
        <div class="wx-cell">
          <div class="wx-label">Wind</div>
          <div class="wx-value wx-value-text">${escapeHTML(today.wind_speed || "—")} <span class="wx-dir">${escapeHTML(today.wind_direction || "")}</span></div>
        </div>
        ${
          tomorrow
            ? `<div class="wx-cell wx-cell-tomorrow">
                 <div class="wx-label">${escapeHTML(tomorrow.name || "Tomorrow")}</div>
                 <div class="wx-value wx-value-text">${escapeHTML(String(tomorrow.temperature))}°${escapeHTML(tomorrow.temperature_unit || "F")} · ${escapeHTML(tomorrow.short_forecast || "")}</div>
               </div>`
            : ""
        }
      </div>
    `;
  } catch (err) {
    card.innerHTML = '<div class="wx-empty">Forecast unavailable.</div>';
  }
})();
