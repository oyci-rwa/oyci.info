/*
 * Renders /tokenomics.json into the .tokenomics-section grid.
 * Refreshed every 6h by fetch-tokenomics.yml.
 */
(async () => {
  const root = document.getElementById("tokenomics-grid");
  if (!root) return;

  const escapeHTML = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));

  const fmtNum = (n, opts = {}) => {
    if (n === null || n === undefined || !Number.isFinite(n)) return "—";
    return n.toLocaleString("en-US", opts);
  };

  const scaleByDecimals = (rawStr, decimals) => {
    // rawStr may be a string or a number; either way we need an integer count divided by 10^decimals.
    // For typical amounts (≤ 1e21) Number precision is fine for display rounding.
    if (rawStr === null || rawStr === undefined) return null;
    const n = Number(rawStr);
    if (!Number.isFinite(n)) return null;
    return n / Math.pow(10, Number(decimals) || 0);
  };

  const fmtDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const relTime = (iso) => {
    if (!iso) return null;
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return null;
    const mins = Math.round((Date.now() - t) / 60000);
    if (mins < 1) return "just now";
    const plural = (n, unit) => n + " " + unit + (n === 1 ? "" : "s") + " ago";
    if (mins < 60) return plural(mins, "minute");
    const hours = Math.round(mins / 60);
    if (hours < 24) return plural(hours, "hour");
    return plural(Math.round(hours / 24), "day");
  };

  try {
    const r = await fetch("tokenomics.json", { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const d = await r.json();

    // Total supply tile
    const supplyTotal = d.supply && Number.isFinite(d.supply.total) ? d.supply.total : null;
    const supplyTile = `
      <div class="tk-tile">
        <div class="tk-k">Total supply</div>
        <div class="tk-v">${supplyTotal !== null ? fmtNum(supplyTotal) : "—"} <span class="tk-unit">OYCI</span></div>
        <div class="tk-sub">Fixed factory mint</div>
      </div>`;

    // Lockups — Choice locker data
    const lp = (d.lockups && d.lockups.lp) || {};
    const oyciLock = (d.lockups && d.lockups.oyci) || {};
    const lpPct = Number.isFinite(lp.locked_percentage) ? lp.locked_percentage : null;
    const lpPosCount = Number.isFinite(lp.position_count) ? lp.position_count : 0;
    const oyciLockedRaw = oyciLock.total_locked_raw;
    const hasOyciLock = oyciLockedRaw && oyciLockedRaw !== "0";
    // OYCI factory token uses 6 decimals — scale raw → token units.
    const oyciLockedScaled = scaleByDecimals(oyciLockedRaw, 6);
    const oyciLockedDisplay = oyciLockedScaled !== null
      ? fmtNum(oyciLockedScaled, { maximumFractionDigits: 2 }) + ' <span class="tk-unit">OYCI</span>'
      : "—";
    const earliest = lp.earliest_unlock;
    const latest = lp.latest_unlock;

    const lockupTile = `
      <a class="tk-tile tk-link" href="https://choice.exchange/locker?view=explore" target="_blank" rel="noopener noreferrer">
        <div class="tk-k">🔒 LP locked <span class="tk-arrow" aria-hidden="true">→</span></div>
        <div class="tk-v">${lpPct !== null ? fmtNum(lpPct, { maximumFractionDigits: 1 }) + "%" : "—"}</div>
        <div class="tk-sub">${lpPosCount > 0
          ? "of supply, " + lpPosCount + " position" + (lpPosCount === 1 ? "" : "s") + " on Choice locker"
          : "No positions on Choice locker"}</div>
      </a>
      <div class="tk-tile">
        <div class="tk-k">OYCI locked</div>
        <div class="tk-v">${oyciLockedDisplay}</div>
        <div class="tk-sub">${hasOyciLock ? "via Choice locker" : "No OYCI lock positions on Choice"}</div>
      </div>
      <div class="tk-tile">
        <div class="tk-k">${earliest && latest && earliest !== latest ? "Unlock window" : "Final unlock"}</div>
        <div class="tk-v">${latest ? fmtDate(latest) : "—"}</div>
        <div class="tk-sub">${earliest && latest && earliest !== latest
          ? "Earliest " + fmtDate(earliest) + " · " + (lp.schedule_type || "vesting")
          : (earliest ? (lp.schedule_type || "vesting") : "—")}</div>
      </div>`;

    // Buys vs sells — lifetime swap totals on Choice
    const trades = d.trades || {};
    const buys = trades.buys || {};
    const sells = trades.sells || {};
    const fmtUsd = (v) =>
      Number.isFinite(v) ? "$" + fmtNum(v, { maximumFractionDigits: 0 }) : "—";
    const fmtCount = (n) =>
      Number.isFinite(n) ? fmtNum(n) + " swap" + (n === 1 ? "" : "s") : "—";
    const tradesTile = (Number.isFinite(buys.count) || Number.isFinite(sells.count))
      ? `<div class="tk-tile tk-wide tk-trades">
           <div class="tk-k">Buys vs sells on Choice</div>
           <div class="tk-v-row">
             <div><span class="tk-v tk-buy">${fmtUsd(buys.usd)}</span><span class="tk-sub-inline">bought · ${fmtCount(buys.count)}</span></div>
             <div><span class="tk-v tk-sell">${fmtUsd(sells.usd)}</span><span class="tk-sub-inline">sold · ${fmtCount(sells.count)}</span></div>
           </div>
         </div>`
      : "";

    // Farms — a farm is live until its LATEST schedule ends, since farms get topped up.
    const now = Date.now();
    const farms = Array.isArray(d.farms) ? d.farms : [];
    const endsAt = (f) => {
      const t = Date.parse(f.schedule_end);
      return Number.isFinite(t) ? t : null;
    };

    const activeFarms = farms
      .filter((f) => endsAt(f) !== null && endsAt(f) > now)
      .sort((a, b) => (b.apr_percentage || 0) - (a.apr_percentage || 0));
    const doneFarms = farms
      .filter((f) => endsAt(f) === null || endsAt(f) <= now)
      .sort((a, b) => (endsAt(b) || 0) - (endsAt(a) || 0));

    // Headline APR and TVL describe what you can earn today, so only live farms count.
    let tvlSum = 0;
    let aprWeighted = 0;
    let aprTotalWeight = 0;
    activeFarms.forEach((f) => {
      const tvl = Number.isFinite(f.tvl_usd) ? f.tvl_usd : null;
      const apr = Number.isFinite(f.apr_percentage) ? f.apr_percentage : null;
      if (tvl !== null) tvlSum += tvl;
      if (tvl !== null && apr !== null) {
        aprWeighted += apr * tvl;
        aprTotalWeight += tvl;
      }
    });
    const aprAvg = aprTotalWeight > 0 ? aprWeighted / aprTotalWeight : null;

    const farmTile = (f, live) => {
      const sym = escapeHTML(f.reward_symbol || "?");
      const amount = scaleByDecimals(f.programmed_amount_raw, f.reward_decimals);
      const apr = Number.isFinite(f.apr_percentage) ? f.apr_percentage : null;
      const tvl = Number.isFinite(f.tvl_usd) ? f.tvl_usd : null;
      const badge = live && apr
        ? ` <span class="tk-badge">${fmtNum(apr, { maximumFractionDigits: 1 })}% APR</span>`
        : "";
      const sub = live
        ? "Runs to " + fmtDate(f.schedule_end) +
          (tvl !== null ? " · $" + fmtNum(tvl, { maximumFractionDigits: 0 }) + " TVL" : "")
        : "Ended " + fmtDate(f.schedule_end);
      return `
        <div class="tk-tile tk-farm${live ? "" : " tk-farm-done"}">
          <div class="tk-k">${sym} rewards${badge}</div>
          <div class="tk-v">${amount !== null ? fmtNum(amount, { maximumFractionDigits: 2 }) : "—"} <span class="tk-unit">${sym}</span></div>
          <div class="tk-sub">${sub}</div>
        </div>`;
    };

    const rel = relTime(d.updated_at);
    const freshness = rel
      ? `<div class="tk-fresh"><span class="tk-dot" aria-hidden="true"></span>Updated ${escapeHTML(rel)}</div>`
      : "";

    const liveTile = activeFarms.length
      ? `<a class="tk-tile tk-live tk-wide tk-link" href="https://choice.exchange/farms" target="_blank" rel="noopener noreferrer">
           <div class="tk-k">🦪 Join oyster farming now <span class="tk-arrow" aria-hidden="true">→</span></div>
           <div class="tk-v-row">
             <div><span class="tk-v">${aprAvg !== null ? fmtNum(aprAvg, { maximumFractionDigits: 1 }) + "%" : "—"}</span><span class="tk-sub-inline">avg APR (TVL-weighted)</span></div>
             <div><span class="tk-v">$${fmtNum(tvlSum, { maximumFractionDigits: 0 })}</span><span class="tk-sub-inline">TVL across ${activeFarms.length} active farm${activeFarms.length === 1 ? "" : "s"}</span></div>
           </div>
           ${freshness}
         </a>`
      : `<div class="tk-tile tk-wide tk-muted">
           <div class="tk-k">Oyster farming</div>
           <div class="tk-v tk-v-text">No farms running right now</div>
           <div class="tk-sub">Past campaigns are listed below.</div>
           ${freshness}
         </div>`;

    const groupHead = (title, note) =>
      `<div class="tk-head"><span class="tk-head-t">${title}</span><span class="tk-head-s">${note}</span></div>`;

    const activeSection = activeFarms.length
      ? groupHead("Active farms", activeFarms.length + " earning rewards now") +
        activeFarms.map((f) => farmTile(f, true)).join("")
      : "";
    const doneSection = doneFarms.length
      ? groupHead("Completed farms", doneFarms.length + " finished — kept for the record") +
        doneFarms.map((f) => farmTile(f, false)).join("")
      : "";

    const holdersTile = `
      <a class="tk-tile tk-link" href="https://injscan.com/asset/factory%2Finj1jdt04erw6jdmh6c939u87kldf3mvvmkedsjp3w%2FOYCI/" target="_blank" rel="noopener noreferrer">
        <div class="tk-k">Holders</div>
        <div class="tk-v tk-v-text">View top wallets <span class="tk-arrow" aria-hidden="true">→</span></div>
        <div class="tk-sub">Live on-chain list — opens injscan in a new tab</div>
      </a>`;

    root.innerHTML =
      liveTile +
      activeSection +
      supplyTile + lockupTile + tradesTile + holdersTile +
      doneSection;

    // Updated-at stamp
    const stamp = document.getElementById("tokenomics-updated");
    if (stamp && d.updated_at) {
      const absolute = new Date(d.updated_at).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      });
      stamp.textContent = rel ? "Updated " + rel + " · " + absolute : "Updated " + absolute;
      stamp.title = d.updated_at;
    }
  } catch (err) {
    root.innerHTML = '<div class="tk-empty">Tokenomics data unavailable.</div>';
  }
})();
