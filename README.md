# 🧟 ZOMBIT FARMER

> **Farm by day. Survive by night.**

A pixel-art farming RPG on Solana — grow crops, descend into the mine, raise pets, and fight off whatever crawls out after dark.

**▶ [Play now at zombitxyz.vercel.app](https://zombitxyz.vercel.app)**

---

## ✨ Features

| | |
|---|---|
| 🌾 **Farming** | Plant, water, and harvest crops through multiple visible growth stages |
| ⛏️ **Mine** | Descend into procedurally dangerous tunnels for ore and rare drops |
| 🐔 **Pets & Mounts** | Raise animal companions and unlock mounts that speed up farm work |
| 🏗️ **Building** | Expand your homestead — furniture, storage, and defenses |
| 🛒 **Economy** | Shop, gem shop, NFT shop, player market, and a bank |
| 💬 **Live Chat** | Talk to other farmers online in real time |
| 🏆 **Battle Pass** | Seasonal quests with exclusive rewards, including $30 in $ZOMBIT cashback |
| 👘 **Wardrobe** | Cosmetics, NFT skins, and full character customization |
| 🐾 **Pet Skill Tree** | Upgrade your pets with a branching skill tree |
| 🤝 **Referrals** | Share your referral link and earn with friends |

---

## 🔗 Wallet Support

Zombit Farmer uses the **Solana Wallet Standard** — connect with any of these:

| Wallet | Status |
|---|---|
| [Phantom](https://phantom.app/) | ✅ Fully supported |
| [Solflare](https://solflare.com/) | ✅ Fully supported |
| [Backpack](https://www.backpack.app/) | ✅ Fully supported |
| [Coinbase Wallet](https://www.coinbase.com/wallet) | ✅ Supported |
| [Trust Wallet](https://trustwallet.com/) | ✅ Supported |
| Any Wallet Standard wallet | ✅ Auto-detected |

No email. No account. Your **wallet address is your identity** — connect once and your progress follows your key across every device.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Game engine | [Phaser 3](https://phaser.io/) |
| Build tool | [Vite](https://vitejs.dev/) |
| Blockchain | Solana — [web3.js](https://solana-labs.github.io/solana-web3.js/) |
| Wallet layer | [Solana Wallet Standard](https://github.com/wallet-standard/wallet-standard) |
| Hosting | [Vercel](https://vercel.com/) (static SPA) |
| Font | CuteFantasy pixel font |

---

## 🗂 Project Structure

```
/
├── index.html              # Game entry point (Phaser SPA)
├── about.html              # About page
├── how-to-play.html        # Player guide
├── vercel.json             # SPA rewrite + asset cache headers
├── .well-known/
│   └── ory-verify.txt      # Ory verification token
└── assets/
    ├── wallet-multi.js     # Solana Wallet Standard connector (v2)
    ├── index-*.js          # Compiled Phaser game bundle
    ├── index-*.css         # Game styles
    ├── pages.css           # Static page styles
    ├── fonts/              # CuteFantasy pixel font
    ├── ui/                 # HUD sprites and icons
    ├── intro/              # Intro video and assets
    ├── world/              # World-map sprites
    └── cf/                 # Crop-field tile sprites
```

---

## 🚀 Deployment

Hosted on **Vercel** as a fully static SPA. The `vercel.json` rewrite sends all non-asset paths to `index.html` so the Phaser router handles in-game navigation, while static files (`/assets/`, `/.well-known/`) are served directly.

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    { "source": "/assets/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] }
  ]
}
```

**Live URL:** https://zombitxyz.vercel.app

---

## 🔐 Security Tips

- Only approve transactions you initiated yourself from inside the game
- Keep a small amount of SOL in your wallet — some actions require a tiny network fee
- Your progress is stored server-side and tied to your public key — back up your seed phrase
- You can safely disconnect and reconnect at any time from the in-game wallet menu

---

## 🌐 Pages

| Page | URL |
|---|---|
| Game | [zombitxyz.vercel.app](https://zombitxyz.vercel.app) |
| About | [zombitxyz.vercel.app/about.html](https://zombitxyz.vercel.app/about.html) |
| How to Play | [zombitxyz.vercel.app/how-to-play.html](https://zombitxyz.vercel.app/how-to-play.html) |

---

## 📄 License

© Zombit Farmer. All rights reserved.

---

<div align="center">

[![Featured on Orynth](https://orynth.dev/api/badge/zombit-farmers-5330?theme=dark&style=default)](https://orynth.dev/projects/zombit-farmers-5330)

**[Play](https://zombitxyz.vercel.app) · [About](https://zombitxyz.vercel.app/about.html) · [How to Play](https://zombitxyz.vercel.app/how-to-play.html)**

</div>
