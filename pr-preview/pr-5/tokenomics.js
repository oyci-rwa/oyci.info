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
    const earliest = lp.earliest_unlock;
    const latest = lp.latest_unlock;

    const lockupTile = `
      <div class="tk-tile">
        <div class="tk-k">LP locked</div>
        <div class="tk-v">${lpPct !== null ? fmtNum(lpPct, { maximumFractionDigits: 1 }) + "%" : "—"}</div>
        <div class="tk-sub">${lpPosCount > 0
          ? "of supply, " + lpPosCount + " position" + (lpPosCount === 1 ? "" : "s") + " on Choice locker"
          : "No positions on Choice locker"}</div>
      </div>
      <div class="tk-tile">
        <div class="tk-k">OYCI locked</div>
        <div class="tk-v">${hasOyciLock ? escapeHTML(oyciLockedRaw) : "0"}</div>
        <div class="tk-sub">${hasOyciLock ? "via Choice locker" : "No OYCI lock positions on Choice"}</div>
      </div>
      <div class="tk-tile">
        <div class="tk-k">${earliest && latest && earliest !== latest ? "Unlock window" : "Final unlock"}</div>
        <div class="tk-v">${latest ? fmtDate(latest) : "—"}</div>
        <div class="tk-sub">${earliest && latest && earliest !== latest
          ? "Earliest " + fmtDate(earliest) + " · " + (lp.schedule_type || "vesting")
          : (earliest ? (lp.schedule_type || "vesting") : "—")}</div>
      </div>`;

    // Farms — list each farm as its own tile, plus a summary tile
    const farms = Array.isArray(d.farms) ? d.farms : [];
    let tvlSum = 0;
    let aprWeighted = 0; // tvl-weighted
    let aprTotalWeight = 0;
    const farmTiles = farms
      .map((f) => {
        const amount = scaleByDecimals(f.programmed_amount_raw, f.reward_decimals);
        const tvl = Number.isFinite(f.tvl_usd) ? f.tvl_usd : null;
        const apr = Number.isFinite(f.apr_percentage) ? f.apr_percentage : null;
        if (tvl !== null) tvlSum += tvl;
        if (tvl !== null && apr !== null) {
          aprWeighted += apr * tvl;
          aprTotalWeight += tvl;
        }
        return `
          <div class="tk-tile tk-farm">
            <div class="tk-k">${escapeHTML(f.reward_symbol || "?")} farm rewards</div>
            <div class="tk-v">${amount !== null ? fmtNum(amount, { maximumFractionDigits: 2 }) : "—"} <span class="tk-unit">${escapeHTML(f.reward_symbol || "")}</span></div>
            <div class="tk-sub">Programmed ${fmtDate(f.schedule_start)} → ${fmtDate(f.schedule_end)}</div>
          </div>`;
      })
      .join("");

    const aprAvg = aprTotalWeight > 0 ? aprWeighted / aprTotalWeight : null;
    const liveTile = farms.length
      ? `<div class="tk-tile tk-live tk-wide">
           <div class="tk-k">Live on Choice farms</div>
           <div class="tk-v-row">
             <div><span class="tk-v">${aprAvg !== null ? fmtNum(aprAvg, { maximumFractionDigits: 1 }) + "%" : "—"}</span><span class="tk-sub-inline">avg APR (TVL-weighted)</span></div>
             <div><span class="tk-v">$${fmtNum(tvlSum, { maximumFractionDigits: 0 })}</span><span class="tk-sub-inline">total TVL across ${farms.length} farm${farms.length === 1 ? "" : "s"}</span></div>
           </div>
         </div>`
      : "";

    root.innerHTML = supplyTile + lockupTile + farmTiles + liveTile;

    // Updated-at stamp
    const stamp = document.getElementById("tokenomics-updated");
    if (stamp && d.updated_at) {
      stamp.textContent = "Updated " + new Date(d.updated_at).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      });
    }
  } catch (err) {
    root.innerHTML = '<div class="tk-empty">Tokenomics data unavailable.</div>';
  }
})();
