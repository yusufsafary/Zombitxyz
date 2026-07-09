/*
 * Zombit Farmers — multi-wallet connector.
 *
 * The game's compiled bundle only ever talks to `window.solana` /
 * `window.phantom.solana` and gates its connect flow on a `.isPhantom`
 * flag. This script adds a small wallet picker so players can connect
 * with Phantom, Solflare, Backpack, or any other Solana Wallet Standard
 * wallet, without touching the compiled game code.
 *
 * How it works: when the player picks a non-Phantom wallet, we wrap the
 * real provider in a Proxy that reports `isPhantom: true` (satisfying the
 * game's internal checks) while forwarding every real call
 * (connect/disconnect/signTransaction/...) to the actual wallet. The
 * proxy is installed as `window.solana` / `window.phantom.solana` before
 * the game's own connect handler runs.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "zf_wallet_provider";

  var WALLETS = [
    {
      id: "phantom",
      label: "Phantom",
      icon: "🟣",
      installUrl: "https://phantom.app/",
      detect: function () {
        return (window.phantom && window.phantom.solana) || null;
      },
    },
    {
      id: "solflare",
      label: "Solflare",
      icon: "🔥",
      installUrl: "https://solflare.com/",
      detect: function () {
        return window.solflare || null;
      },
    },
    {
      id: "backpack",
      label: "Backpack",
      icon: "🎒",
      installUrl: "https://www.backpack.app/",
      detect: function () {
        return (window.backpack && window.backpack.solana) || null;
      },
    },
    {
      id: "other",
      label: "Other Solana Wallet",
      icon: "🧩",
      installUrl: "https://solana.com/ecosystem/explore?categories=wallet",
      detect: function () {
        // Any Solana Wallet Standard provider that injected onto window.solana
        // directly and isn't one of the above (e.g. Glow, Trust, Coinbase Wallet).
        var w = window.solana;
        if (w && !w.isPhantom) return w;
        return null;
      },
    },
  ];

  function getWallet(id) {
    var def = null;
    for (var i = 0; i < WALLETS.length; i++) {
      if (WALLETS[i].id === id) {
        def = WALLETS[i];
        break;
      }
    }
    if (!def) return null;
    return { def: def, provider: def.detect() };
  }

  function makeShim(real) {
    if (!real) return null;
    if (real.isPhantom) return real;
    try {
      return new Proxy(real, {
        get: function (target, prop, receiver) {
          if (prop === "isPhantom") return true;
          var value = Reflect.get(target, prop, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    } catch (e) {
      // Proxy unsupported (very old browser) — fall back to a plain wrapper
      // for the handful of methods the game actually calls.
      var wrapper = {
        isPhantom: true,
        connect: real.connect ? real.connect.bind(real) : undefined,
        disconnect: real.disconnect ? real.disconnect.bind(real) : undefined,
        signTransaction: real.signTransaction ? real.signTransaction.bind(real) : undefined,
        signAllTransactions: real.signAllTransactions ? real.signAllTransactions.bind(real) : undefined,
        signMessage: real.signMessage ? real.signMessage.bind(real) : undefined,
        on: real.on ? real.on.bind(real) : function () {},
        off: real.off ? real.off.bind(real) : function () {},
        get publicKey() {
          return real.publicKey;
        },
      };
      return wrapper;
    }
  }

  function applyProvider(id) {
    var found = getWallet(id);
    if (!found || !found.provider) return false;
    var shim = makeShim(found.provider);
    if (!shim) return false;
    window.solana = shim;
    window.phantom = window.phantom || {};
    window.phantom.solana = shim;
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch (e) {}
    return true;
  }

  function tryRestoreSavedProvider() {
    var saved;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return;
    }
    if (!saved) return;
    applyProvider(saved);
  }

  // Wallet detection can lag behind our script (extensions inject
  // asynchronously), so retry the restore a few times after load.
  tryRestoreSavedProvider();
  [300, 800, 1500, 3000].forEach(function (delay) {
    setTimeout(tryRestoreSavedProvider, delay);
  });

  // ---- Picker UI ----------------------------------------------------

  var modalEl = null;

  function ensureStyles() {
    if (document.getElementById("zfWalletPickerStyles")) return;
    var style = document.createElement("style");
    style.id = "zfWalletPickerStyles";
    style.textContent =
      "#zfWalletPicker{position:fixed;inset:0;z-index:100050;display:none;align-items:center;justify-content:center;background:rgba(10,20,17,.72);font-family:'Segoe UI',system-ui,sans-serif;}" +
      "#zfWalletPicker.show{display:flex;}" +
      "#zfWalletPicker .zf-wp-box{width:min(340px,88vw);background:#1c140c;border:2px solid #5b3a1c;border-radius:16px;padding:22px;box-shadow:0 12px 30px rgba(0,0,0,.5);}" +
      "#zfWalletPicker h3{margin:0 0 4px;color:#ffe9be;font-size:17px;}" +
      "#zfWalletPicker p{margin:0 0 16px;color:#c9ac86;font-size:12.5px;line-height:1.5;}" +
      "#zfWalletPicker .zf-wp-list{display:flex;flex-direction:column;gap:8px;}" +
      "#zfWalletPicker button.zf-wp-item{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:10px 12px;border-radius:10px;border:2px solid #5b3a1c;background:rgba(255,255,255,.04);color:#fff3e0;font-size:14px;cursor:pointer;}" +
      "#zfWalletPicker button.zf-wp-item:hover{background:rgba(255,255,255,.09);border-color:#a9743f;}" +
      "#zfWalletPicker button.zf-wp-item .zf-wp-icon{font-size:18px;}" +
      "#zfWalletPicker button.zf-wp-item .zf-wp-tag{margin-left:auto;font-size:10.5px;padding:2px 7px;border-radius:20px;background:rgba(124,191,62,.18);color:#cdf77c;border:1px solid #6cae3e;}" +
      "#zfWalletPicker button.zf-wp-item .zf-wp-tag.zf-wp-missing{background:rgba(255,120,120,.12);color:#ff9a9a;border-color:#7a3a3a;}" +
      "#zfWalletPicker .zf-wp-close{margin-top:14px;width:100%;padding:9px;border-radius:10px;border:none;background:transparent;color:#a9743f;font-size:13px;cursor:pointer;}" +
      "#zfWalletPicker .zf-wp-close:hover{color:#ffe9be;}";
    document.head.appendChild(style);
  }

  function buildModal() {
    if (modalEl) return modalEl;
    ensureStyles();
    var box = document.createElement("div");
    box.id = "zfWalletPicker";
    box.innerHTML =
      '<div class="zf-wp-box">' +
      "<h3>Connect a wallet</h3>" +
      "<p>Choose the Solana wallet you want to use to play Zombit Farmers.</p>" +
      '<div class="zf-wp-list"></div>' +
      '<button type="button" class="zf-wp-close">Cancel</button>' +
      "</div>";
    document.body.appendChild(box);
    box.addEventListener("click", function (e) {
      if (e.target === box) closeModal();
    });
    box.querySelector(".zf-wp-close").addEventListener("click", closeModal);
    modalEl = box;
    return box;
  }

  function renderList(onPick) {
    var box = buildModal();
    var list = box.querySelector(".zf-wp-list");
    list.innerHTML = "";
    WALLETS.forEach(function (w) {
      var installed = !!w.detect();
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "zf-wp-item";
      btn.innerHTML =
        '<span class="zf-wp-icon">' + w.icon + "</span><span>" + w.label + "</span>" +
        '<span class="zf-wp-tag' + (installed ? "" : " zf-wp-missing") + '">' +
        (installed ? "Detected" : "Install") +
        "</span>";
      btn.addEventListener("click", function () {
        if (!installed) {
          window.open(w.installUrl, "_blank", "noopener");
          return;
        }
        closeModal();
        onPick(w.id);
      });
      list.appendChild(btn);
    });
  }

  function openModal(onPick) {
    renderList(onPick);
    modalEl.classList.add("show");
  }

  function closeModal() {
    if (modalEl) modalEl.classList.remove("show");
  }

  // ---- Hook into the game's wallet button ---------------------------

  function hookWalletButton() {
    var btn = document.getElementById("walletBtn");
    if (!btn) return false;
    if (btn.dataset.zfHooked) return true;
    btn.dataset.zfHooked = "1";

    var originalOnclick = btn.onclick;
    btn.onclick = function (e) {
      // Already connected — let the game's own toggle/menu behavior run.
      if (btn.classList.contains("connected")) {
        return originalOnclick && originalOnclick.call(btn, e);
      }
      if (e && e.preventDefault) e.preventDefault();
      openModal(function (walletId) {
        var ok = applyProvider(walletId);
        if (!ok) return;
        if (originalOnclick) originalOnclick.call(btn, e);
      });
    };
    if (!btn.classList.contains("connected")) {
      btn.textContent = "🔗 Connect Wallet";
    }
    return true;
  }

  var hookInterval = setInterval(function () {
    if (hookWalletButton()) clearInterval(hookInterval);
  }, 150);
  setTimeout(function () {
    clearInterval(hookInterval);
  }, 20000);
})();
