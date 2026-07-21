/*
 * Live OYCI/USD price for the nav pill.
 *
 * Source chain: Choice pair contract (OYCI/INJ on Injective) → public REST
 * (publicnode) → INJ/USD from CoinGecko (Binance fallback).
 *
 * No deps. Refreshes every REFRESH_MS. On any failure the pill shows "—".
 */
(() => {
  const POOL = "inj1qxp3uga2q2x8sfs46ul2luk7tvq09x9r4cvuzr";
  const REST = "https://injective-rest.publicnode.com";
  const OYCI_DENOM =
    "factory/inj1jdt04erw6jdmh6c939u87kldf3mvvmkedsjp3w/OYCI";
  const OYCI_DEC = 6;
  const INJ_DEC = 18;
  const REFRESH_MS = 60_000;

  const priceEl = document.getElementById("oyci-price");
  if (!priceEl) return;
  const mcPill = document.getElementById("oyci-mcpill");
  const mcEl = document.getElementById("oyci-mc");
  const mcChgEl = document.getElementById("oyci-mc-chg");

  function formatUSD(v) {
    if (!Number.isFinite(v) || v <= 0) return "—";
    if (v >= 1) return "$" + v.toFixed(4);
    if (v >= 0.01) return "$" + v.toFixed(6);
    // Sub-cent: keep ~4 significant figures after the first non-zero digit.
    const log10 = Math.floor(Math.log10(v));
    const decimals = Math.min(20, -log10 + 3);
    return "$" + v.toFixed(decimals);
  }

  function formatCompactUSD(v) {
    if (!Number.isFinite(v) || v <= 0) return "—";
    if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
    if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
    if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
    return "$" + v.toFixed(0);
  }

  function formatPct(v) {
    if (!Number.isFinite(v)) return "—";
    const arrow = v > 0 ? "▲" : v < 0 ? "▼" : "•";
    return arrow + " " + Math.abs(v * 100).toFixed(1) + "%";
  }

  async function fetchOyciStats() {
    try {
      const r = await fetch("https://api.choice.exchange/v1/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          query:
            '{ analytics_tokenstats(where: {token_id: {_eq: "factory/inj1jdt04erw6jdmh6c939u87kldf3mvvmkedsjp3w/OYCI"}}) { market_cap price_change_usd_24h } }',
        }),
      });
      const j = await r.json();
      const row = j && j.data && j.data.analytics_tokenstats && j.data.analytics_tokenstats[0];
      if (!row) return null;
      return {
        mc: Number(row.market_cap),
        chg24h: Number(row.price_change_usd_24h),
      };
    } catch (_) {
      return null;
    }
  }

  function renderMC(stats) {
    if (!mcPill || !mcEl || !mcChgEl) return;
    if (!stats || !Number.isFinite(stats.mc)) {
      mcEl.textContent = "—";
      mcChgEl.textContent = "—";
      mcPill.classList.remove("up", "down", "flat");
      mcPill.title = "Market cap unavailable";
      return;
    }
    mcEl.textContent = formatCompactUSD(stats.mc);
    mcChgEl.textContent = formatPct(stats.chg24h);
    mcPill.classList.remove("up", "down", "flat");
    if (!Number.isFinite(stats.chg24h) || Math.abs(stats.chg24h) < 0.001) {
      mcPill.classList.add("flat");
    } else if (stats.chg24h > 0) {
      mcPill.classList.add("up");
    } else {
      mcPill.classList.add("down");
    }
    mcPill.title =
      "Market cap $" +
      stats.mc.toLocaleString("en-US", { maximumFractionDigits: 0 }) +
      " · 24h " +
      (stats.chg24h * 100).toFixed(2) +
      "% · source: Choice analytics · updated " +
      new Date().toLocaleTimeString();
  }

  async function fetchInjUsd() {
    try {
      const r = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=injective-protocol&vs_currencies=usd",
        { cache: "no-store" }
      );
      const j = await r.json();
      const p = j && j["injective-protocol"] && j["injective-protocol"].usd;
      if (typeof p === "number" && p > 0) return p;
    } catch (_) {}
    try {
      const r = await fetch(
        "https://api.binance.com/api/v3/ticker/price?symbol=INJUSDT",
        { cache: "no-store" }
      );
      const j = await r.json();
      const p = parseFloat(j && j.price);
      if (p > 0) return p;
    } catch (_) {}
    return null;
  }

  async function fetchPoolReserves() {
    const q = btoa('{"pool":{}}');
    const r = await fetch(
      REST + "/cosmwasm/wasm/v1/contract/" + POOL + "/smart/" + q,
      { cache: "no-store" }
    );
    if (!r.ok) throw new Error("pool http " + r.status);
    const j = await r.json();
    const assets = j && j.data && j.data.assets;
    if (!Array.isArray(assets)) throw new Error("bad pool response");
    let oyci, inj;
    for (const a of assets) {
      const denom = a && a.info && a.info.native_token && a.info.native_token.denom;
      if (denom === OYCI_DENOM) oyci = BigInt(a.amount);
      else if (denom === "inj") inj = BigInt(a.amount);
    }
    if (oyci === undefined || inj === undefined) throw new Error("missing assets");
    return {
      oyci: Number(oyci) / Math.pow(10, OYCI_DEC),
      inj: Number(inj) / Math.pow(10, INJ_DEC),
    };
  }

  async function update() {
    const statsPromise = fetchOyciStats();
    try {
      const [reserves, injUsd] = await Promise.all([
        fetchPoolReserves(),
        fetchInjUsd(),
      ]);
      if (!injUsd) throw new Error("inj/usd unavailable");
      const oyciInInj = reserves.inj / reserves.oyci;
      const oyciInUsd = oyciInInj * injUsd;
      priceEl.textContent = formatUSD(oyciInUsd);
      priceEl.title =
        "Live: OYCI $" +
        oyciInUsd.toExponential(4) +
        " · INJ $" +
        injUsd.toFixed(3) +
        " · pool " +
        oyciInInj.toExponential(4) +
        " INJ/OYCI · updated " +
        new Date().toLocaleTimeString();
    } catch (err) {
      priceEl.textContent = "—";
      priceEl.title = "Live price unavailable (" + (err && err.message) + ")";
    }
    renderMC(await statsPromise);
  }

  update();
  setInterval(update, REFRESH_MS);
})();
