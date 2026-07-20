/*!
 * wallet-multi.js  v2.0  —  Zombit Farmers
 * Solana Wallet Standard + legacy multi-wallet connector
 *
 * • Discovers wallets via Wallet Standard events (app-ready / register-wallet)
 * • Falls back to legacy window injection: Phantom, Solflare, Backpack,
 *   Coinbase Wallet, Trust Wallet
 * • Installs window.solana / window.phantom.solana Proxy shim so the compiled
 *   Phaser bundle works with any wallet, not just Phantom
 * • Renders a "Connect Wallet" widget inside .zf-topbar nav on static pages
 * • Hooks into the game's internal #walletBtn on the game page
 * • Auto-reconnects silently on page load (onlyIfTrusted: true)
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "zf_last_wallet";

  // ─── Inline SVG wallet icons ─────────────────────────────────────────────
  var ICONS = {
    phantom: '<svg width="32" height="32" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg"><rect width="128" height="128" rx="20" fill="#AB9FF2"/><path d="M110.6 65H99.1C99.1 41.8 80.2 23 56.8 23 33.7 23 14.9 41.3 14.4 64c-.5 23.8 19.4 44 43.5 44H63.7C84.7 108 112.7 91.8 112.7 69c0-2.3-.9-4-2.1-4zM45.9 66c0 2.8-2.3 5-5.1 5s-5-2.2-5-5v-7c0-2.8 2.2-5 5-5s5.1 2.2 5.1 5v7zm17.9 0c0 2.8-2.3 5-5.1 5s-5-2.2-5-5v-7c0-2.8 2.2-5 5-5s5.1 2.2 5.1 5v7z" fill="#fff"/></svg>',
    solflare: '<svg width="32" height="32" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg"><rect width="128" height="128" rx="20" fill="#FC9E03"/><path d="M64 18 l18 34h16L64 110 34 52h16z" fill="#fff" opacity=".9"/><path d="M64 18 l18 34H64z" fill="#fff"/></svg>',
    backpack: '<svg width="32" height="32" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg"><rect width="128" height="128" rx="20" fill="#E33E3F"/><path d="M48 36h32s0-14-16-14-16 14-16 14z" fill="#fff"/><rect x="30" y="40" width="68" height="58" rx="12" fill="#fff"/><rect x="52" y="52" width="24" height="14" rx="5" fill="#E33E3F"/></svg>',
    coinbase: '<svg width="32" height="32" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg"><rect width="128" height="128" rx="20" fill="#1652F0"/><path d="M64 22C41 22 22 41 22 64s19 42 42 42 42-19 42-42S87 22 64 22zm0 58c-8.8 0-16-7.2-16-16s7.2-16 16-16 16 7.2 16 16-7.2 16-16 16z" fill="#fff"/></svg>',
    trust:    '<svg width="32" height="32" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg"><rect width="128" height="128" rx="20" fill="#3375BB"/><path d="M64 18 L22 36v30c0 22 18 42 42 48 24-6 42-26 42-48V36z" fill="#fff" opacity=".9"/><path d="M50 64l10 10 20-20" stroke="#3375BB" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
    other:    '<svg width="32" height="32" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg"><rect width="128" height="128" rx="20" fill="#5b4fcf"/><circle cx="64" cy="64" r="28" fill="none" stroke="#fff" stroke-width="6"/><path d="M64 40v48M40 64h48" stroke="#fff" stroke-width="6" stroke-linecap="round"/></svg>',
  };

  // ─── Legacy wallet definitions ────────────────────────────────────────────
  var LEGACY = [
    {
      id: "phantom",
      name: "Phantom",
      url: "https://phantom.app/",
      detect: function () {
        return (global.phantom && global.phantom.solana) || null;
      },
    },
    {
      id: "solflare",
      name: "Solflare",
      url: "https://solflare.com/",
      detect: function () {
        return global.solflare || null;
      },
    },
    {
      id: "backpack",
      name: "Backpack",
      url: "https://www.backpack.app/",
      detect: function () {
        return (global.backpack && global.backpack.solana) || null;
      },
    },
    {
      id: "coinbase",
      name: "Coinbase Wallet",
      url: "https://www.coinbase.com/wallet",
      detect: function () {
        return global.coinbaseSolana || null;
      },
    },
    {
      id: "trust",
      name: "Trust Wallet",
      url: "https://trustwallet.com/",
      detect: function () {
        return (global.trustwallet && global.trustwallet.solana) || null;
      },
    },
  ];

  // ─── Application state ────────────────────────────────────────────────────
  var state = {
    connected: false,
    publicKey: null,
    walletId: null,
    provider: null,
    stdWallets: [], // wallets from Wallet Standard events
  };

  // ─── Wallet Standard discovery ────────────────────────────────────────────
  function addStdWallet(wallet) {
    if (!wallet || !wallet.name) return;
    // Only Solana wallets
    var chains = wallet.chains || [];
    var isSolana = false;
    for (var i = 0; i < chains.length; i++) {
      if (chains[i] && chains[i].startsWith("solana")) { isSolana = true; break; }
    }
    if (!isSolana) return;
    // Deduplicate by name
    for (var j = 0; j < state.stdWallets.length; j++) {
      if (state.stdWallets[j].name === wallet.name) return;
    }
    state.stdWallets.push(wallet);
  }

  function discoverStandardWallets() {
    // (1) Listen for wallets that register AFTER this script runs
    global.addEventListener("wallet-standard:register-wallet", function (e) {
      try {
        e.detail.register(function (w) { addStdWallet(w); });
      } catch (_) {}
    });

    // (2) Notify wallets that loaded BEFORE this script that the app is ready
    try {
      global.dispatchEvent(new CustomEvent("wallet-standard:app-ready", {
        detail: {
          register: function (w) { addStdWallet(w); },
        },
      }));
    } catch (_) {}
  }

  // ─── Build wallet list for the picker ─────────────────────────────────────
  function buildWalletList() {
    var list = [];
    var seen = {};

    // Known legacy wallets first (detected or installable)
    for (var i = 0; i < LEGACY.length; i++) {
      var def = LEGACY[i];
      var prov = def.detect();
      list.push({
        id: def.id,
        name: def.name,
        icon: ICONS[def.id] || ICONS.other,
        detected: !!prov,
        provider: prov,
        installUrl: def.url,
        type: "legacy",
        stdWallet: null,
      });
      seen[def.name.toLowerCase()] = list.length - 1;
    }

    // Wallet Standard wallets — merge with legacy entries if names match
    for (var j = 0; j < state.stdWallets.length; j++) {
      var sw = state.stdWallets[j];
      var key = sw.name.toLowerCase();
      if (key in seen) {
        list[seen[key]].detected = true;
        list[seen[key]].stdWallet = sw;
        continue;
      }
      seen[key] = list.length;
      list.push({
        id: "std_" + j,
        name: sw.name,
        icon: sw.icon
          ? '<img src="' + sw.icon + '" width="32" height="32" style="border-radius:8px">'
          : ICONS.other,
        detected: true,
        provider: null,
        installUrl: null,
        type: "standard",
        stdWallet: sw,
      });
    }

    // Detected wallets first, then alphabetically
    list.sort(function (a, b) {
      if (a.detected !== b.detected) return a.detected ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return list;
  }

  // ─── Phantom shim (game compatibility) ────────────────────────────────────
  function makeShim(real) {
    if (!real) return null;
    if (real.isPhantom) return real;
    try {
      return new Proxy(real, {
        get: function (target, prop) {
          if (prop === "isPhantom") return true;
          var v = target[prop];
          return typeof v === "function" ? v.bind(target) : v;
        },
      });
    } catch (_) {
      return {
        isPhantom: true,
        get publicKey() { return real.publicKey; },
        connect: real.connect ? real.connect.bind(real) : undefined,
        disconnect: real.disconnect ? real.disconnect.bind(real) : undefined,
        signTransaction: real.signTransaction ? real.signTransaction.bind(real) : undefined,
        signAllTransactions: real.signAllTransactions ? real.signAllTransactions.bind(real) : undefined,
        signMessage: real.signMessage ? real.signMessage.bind(real) : undefined,
        on: (real.on || function () {}).bind(real),
        off: (real.off || function () {}).bind(real),
      };
    }
  }

  function installShim(provider) {
    var shim = makeShim(provider);
    if (!shim) return false;
    global.solana = shim;
    global.phantom = global.phantom || {};
    global.phantom.solana = shim;
    return true;
  }

  // ─── Connect via legacy provider ──────────────────────────────────────────
  function connectLegacy(wallet, cb) {
    if (!wallet.provider) {
      if (wallet.installUrl) global.open(wallet.installUrl, "_blank");
      cb(new Error("not_installed"));
      return;
    }
    installShim(wallet.provider);
    wallet.provider
      .connect({ onlyIfTrusted: false })
      .then(function (res) {
        var pk = (res && res.publicKey) || wallet.provider.publicKey;
        state.connected = true;
        state.publicKey  = pk ? pk.toString() : null;
        state.provider   = wallet.provider;
        state.walletId   = wallet.id;
        try { localStorage.setItem(STORAGE_KEY, wallet.id); } catch (_) {}
        cb(null);
      })
      .catch(function (err) { cb(err); });
  }

  // ─── Connect via Wallet Standard ──────────────────────────────────────────
  function connectStandard(wallet, cb) {
    var sw = wallet.stdWallet;
    var feat = sw && sw.features && sw.features["standard:connect"];
    if (!feat) { cb(new Error("no_connect_feature")); return; }

    feat.connect()
      .then(function (out) {
        var account = out && out.accounts && out.accounts[0];
        state.connected = true;
        state.publicKey  = account ? account.address : null;
        state.walletId   = wallet.id;
        state.provider   = null;
        // Install minimal shim for game compatibility
        if (account) {
          var addr = account.address;
          var fakeProvider = {
            isPhantom: true,
            publicKey: { toString: function () { return addr; }, toBase58: function() { return addr; } },
            connect: function () { return Promise.resolve({ publicKey: this.publicKey }); },
            disconnect: function () {
              var df = sw.features && sw.features["standard:disconnect"];
              return df ? df.disconnect() : Promise.resolve();
            },
            signTransaction: function (tx) {
              var sf = sw.features && sw.features["solana:signTransaction"];
              return sf ? sf.signTransaction({ transaction: tx, account: account }) : Promise.reject(new Error("unsupported"));
            },
            signAllTransactions: function (txs) {
              var sf = sw.features && sw.features["solana:signAllTransactions"];
              return sf ? sf.signAllTransactions({ transactions: txs, account: account }) : Promise.reject(new Error("unsupported"));
            },
            signMessage: function (msg) {
              var sf = sw.features && sw.features["standard:signMessage"];
              return sf ? sf.signMessage({ message: msg, account: account }) : Promise.reject(new Error("unsupported"));
            },
            on: function () {},
            off: function () {},
          };
          global.solana = fakeProvider;
          global.phantom = global.phantom || {};
          global.phantom.solana = fakeProvider;
        }
        try { localStorage.setItem(STORAGE_KEY, wallet.id); } catch (_) {}
        cb(null);
      })
      .catch(function (err) { cb(err); });
  }

  // ─── Disconnect ────────────────────────────────────────────────────────────
  function doDisconnect(cb) {
    var prov = state.provider;
    state.connected = false;
    state.publicKey  = null;
    state.provider   = null;
    state.walletId   = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    if (prov && prov.disconnect) {
      prov.disconnect().catch(function () {}).then(function () {
        updateUI();
        cb && cb();
      });
    } else {
      updateUI();
      cb && cb();
    }
  }

  // ─── Utility ───────────────────────────────────────────────────────────────
  function shortKey(pk) {
    if (!pk || pk.length < 8) return pk || "";
    return pk.slice(0, 4) + "…" + pk.slice(-4);
  }

  // ─── CSS (injected once) ───────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById("zf-wallet-styles")) return;
    var s = document.createElement("style");
    s.id = "zf-wallet-styles";
    s.textContent =
      /* ── modal overlay ── */
      "#zfWM{position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;" +
        "background:rgba(0,0,0,.75);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);" +
        "opacity:0;pointer-events:none;transition:opacity .2s ease;}" +
      "#zfWM.show{opacity:1;pointer-events:all;}" +
      /* ── modal card ── */
      "#zfWC{background:linear-gradient(170deg,#201610 0%,#120c06 100%);" +
        "border:1px solid #5b3a1c;border-radius:22px;padding:22px 18px 18px;" +
        "width:min(360px,92vw);box-shadow:0 28px 72px rgba(0,0,0,.75);" +
        "transform:translateY(14px);transition:transform .22s ease;}" +
      "#zfWM.show #zfWC{transform:translateY(0);}" +
      /* ── header ── */
      "#zfWC .zfw-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}" +
      "#zfWC .zfw-title{font:800 17px/1 'Segoe UI',system-ui,sans-serif;color:#ffe9be;letter-spacing:.3px;}" +
      "#zfWC .zfw-x{background:rgba(255,255,255,.08);border:none;border-radius:8px;" +
        "width:28px;height:28px;cursor:pointer;color:#ffe9be;font-size:13px;" +
        "display:flex;align-items:center;justify-content:center;}" +
      "#zfWC .zfw-x:hover{background:rgba(255,255,255,.16);}" +
      /* ── wallet list ── */
      "#zfWL{display:flex;flex-direction:column;gap:7px;max-height:370px;overflow-y:auto;padding-right:2px;}" +
      "#zfWL::-webkit-scrollbar{width:3px;}" +
      "#zfWL::-webkit-scrollbar-track{background:rgba(255,255,255,.04);border-radius:4px;}" +
      "#zfWL::-webkit-scrollbar-thumb{background:#5b3a1c;border-radius:4px;}" +
      /* ── wallet row ── */
      ".zfw-row{display:flex;align-items:center;gap:11px;width:100%;" +
        "background:rgba(255,255,255,.04);border:1px solid rgba(91,58,28,.4);" +
        "border-radius:13px;padding:10px 13px;cursor:pointer;transition:background .13s,border-color .13s;text-align:left;}" +
      ".zfw-row:hover{background:rgba(255,233,190,.07);border-color:rgba(91,58,28,.85);}" +
      ".zfw-row:disabled{opacity:.4;cursor:default;pointer-events:none;}" +
      ".zfw-row .zfw-ico{width:32px;height:32px;border-radius:8px;overflow:hidden;flex-shrink:0;" +
        "display:flex;align-items:center;justify-content:center;}" +
      ".zfw-row .zfw-ico svg,.zfw-row .zfw-ico img{width:32px;height:32px;border-radius:8px;}" +
      ".zfw-row .zfw-inf{flex:1;min-width:0;}" +
      ".zfw-row .zfw-name{font:700 14px/1 'Segoe UI',system-ui,sans-serif;color:#ffe9be;}" +
      ".zfw-row .zfw-sub{font:400 11px/1 'Segoe UI',system-ui,sans-serif;color:rgba(255,233,190,.42);margin-top:3px;}" +
      ".zfw-badge{font:600 11px/1 'Segoe UI',system-ui,sans-serif;color:#cdf77c;" +
        "background:rgba(124,191,62,.15);border-radius:5px;padding:2px 8px;flex-shrink:0;}" +
      /* ── footer note ── */
      "#zfWC .zfw-ft{margin-top:13px;font:400 11px/1.3 'Segoe UI',system-ui,sans-serif;" +
        "color:rgba(255,233,190,.32);text-align:center;}" +
      /* ── connect button widget (static pages) ── */
      "#zfWBtn{font:700 13px/1 'Segoe UI',system-ui,sans-serif;color:#ffe9be;" +
        "background:linear-gradient(180deg,#a9743f,#83512a);border:1.5px solid #5b3a1c;" +
        "border-radius:10px;padding:7px 14px;cursor:pointer;box-shadow:0 3px 0 #4a2d15;" +
        "display:inline-flex;align-items:center;gap:7px;white-space:nowrap;" +
        "transition:filter .1s ease;}" +
      "#zfWBtn:hover{filter:brightness(1.1);}" +
      "#zfWBtn .zfwb-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;" +
        "background:#555;transition:background .2s,box-shadow .2s;}" +
      "#zfWBtn .zfwb-dot.on{background:#cdf77c;box-shadow:0 0 7px #cdf77c;}";
    document.head.appendChild(s);
  }

  // ─── Modal ─────────────────────────────────────────────────────────────────
  var modalEl   = null;
  var listEl    = null;
  var onPickCb  = null; // optional callback after successful connect (for game hook)

  function ensureModal() {
    if (modalEl) return;
    modalEl = document.createElement("div");
    modalEl.id = "zfWM";
    modalEl.innerHTML =
      '<div id="zfWC">' +
        '<div class="zfw-hd">' +
          '<span class="zfw-title">🔗 Connect Wallet</span>' +
          '<button class="zfw-x" id="zfWX">✕</button>' +
        '</div>' +
        '<div id="zfWL"></div>' +
        '<p class="zfw-ft">Solana Wallet Standard — your keys, your wallet</p>' +
      '</div>';
    document.body.appendChild(modalEl);
    listEl = document.getElementById("zfWL");
    modalEl.addEventListener("click", function (e) {
      if (e.target === modalEl) closeModal();
    });
    document.getElementById("zfWX").addEventListener("click", closeModal);
  }

  function openModal(afterConnect) {
    ensureModal();
    onPickCb = afterConnect || null;
    renderList();
    modalEl.classList.add("show");
  }

  function closeModal() {
    if (modalEl) modalEl.classList.remove("show");
  }

  function renderList() {
    if (!listEl) return;
    var wallets = buildWalletList();
    listEl.innerHTML = "";

    wallets.forEach(function (w) {
      var btn = document.createElement("button");
      btn.className = "zfw-row";
      var badge = w.detected ? '<span class="zfw-badge">Detected</span>' : "";
      var sub   = w.detected ? "Ready to connect" : "Not installed — click to install";
      btn.innerHTML =
        '<span class="zfw-ico">' + w.icon + '</span>' +
        '<span class="zfw-inf">' +
          '<span class="zfw-name">' + w.name + '</span>' +
          '<div class="zfw-sub">' + sub + '</div>' +
        '</span>' +
        badge;

      btn.addEventListener("click", function () {
        btn.disabled = true;
        btn.querySelector(".zfw-name").textContent = "Connecting…";

        var done = function (err) {
          if (err) {
            btn.disabled = false;
            btn.querySelector(".zfw-name").textContent = w.name;
            return;
          }
          closeModal();
          updateUI();
          if (onPickCb) { onPickCb(); onPickCb = null; }
        };

        if (w.type === "standard" && w.stdWallet) {
          connectStandard(w, done);
        } else {
          connectLegacy(w, done);
        }
      });

      listEl.appendChild(btn);
    });
  }

  // ─── Connect-button widget (about / how-to-play pages) ───────────────────
  function buildWidget() {
    // Only on static pages — game page has #lfPreloader
    if (document.getElementById("lfPreloader")) return;
    if (document.getElementById("zfWBtn")) return;

    var nav = document.querySelector(".zf-topbar nav");
    if (!nav) return;

    var btn = document.createElement("button");
    btn.id = "zfWBtn";
    btn.title = "Connect your Solana wallet";
    btn.innerHTML = '<span class="zfwb-dot" id="zfWDot"></span><span id="zfWTxt">Connect Wallet</span>';
    nav.appendChild(btn);

    btn.addEventListener("click", function () {
      if (state.connected) {
        doDisconnect();
      } else {
        openModal();
      }
    });
  }

  // ─── Update all UI surfaces ────────────────────────────────────────────────
  function updateUI() {
    var btn = document.getElementById("zfWBtn");
    var txt = document.getElementById("zfWTxt");
    var dot = document.getElementById("zfWDot");

    if (btn) {
      if (state.connected && state.publicKey) {
        if (txt) txt.textContent = shortKey(state.publicKey);
        if (dot) dot.className = "zfwb-dot on";
        btn.title = state.publicKey + "\n\nClick to disconnect";
      } else {
        if (txt) txt.textContent = "Connect Wallet";
        if (dot) dot.className = "zfwb-dot";
        btn.title = "Connect your Solana wallet";
      }
    }
  }

  // ─── Hook into the game's #walletBtn ──────────────────────────────────────
  function hookGameButton() {
    var btn = document.getElementById("walletBtn");
    if (!btn) return false;
    if (btn.dataset.zfHooked) return true;
    btn.dataset.zfHooked = "1";

    var origClick = btn.onclick;
    btn.onclick = function (e) {
      // Already connected — let game handle its own menu
      if (btn.classList.contains("connected")) {
        return origClick && origClick.call(btn, e);
      }
      e && e.preventDefault();
      openModal(function () {
        // Wallet connected — fire original handler so game proceeds
        origClick && origClick.call(btn, e);
      });
    };

    if (!btn.classList.contains("connected")) {
      btn.textContent = "🔗 Connect Wallet";
    }
    return true;
  }

  // ─── Auto-reconnect on load (silent / trusted only) ───────────────────────
  function autoReconnect() {
    var saved;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (_) { return; }
    if (!saved) return;

    setTimeout(function () {
      for (var i = 0; i < LEGACY.length; i++) {
        if (LEGACY[i].id !== saved) continue;
        var prov = LEGACY[i].detect();
        if (!prov || !prov.connect) break;
        installShim(prov);
        prov.connect({ onlyIfTrusted: true })
          .then(function (res) {
            var pk = (res && res.publicKey) || prov.publicKey;
            if (pk) {
              state.connected = true;
              state.publicKey  = pk.toString();
              state.provider   = prov;
              state.walletId   = saved;
              updateUI();
            }
          })
          .catch(function () {
            try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
          });
        break;
      }
    }, 500);
  }

  // ─── Init ──────────────────────────────────────────────────────────────────
  function init() {
    injectStyles();
    discoverStandardWallets();
    autoReconnect();

    function onReady() {
      buildWidget();
      updateUI();
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", onReady);
    } else {
      onReady();
    }

    // Poll for game's #walletBtn (appears after game JS mounts)
    var tick = setInterval(function () {
      if (hookGameButton()) clearInterval(tick);
    }, 150);
    setTimeout(function () { clearInterval(tick); }, 20000);
  }

  init();

})(window);
