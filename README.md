<div align="center">

# lava

**a free, open-source games library that runs straight from a GitHub repo**

![no build step](https://img.shields.io/badge/build%20step-none-ff6b1a?style=for-the-badge)
![no server](https://img.shields.io/badge/server-none-e2434a?style=for-the-badge)
![one file](https://img.shields.io/badge/site-1%20html%20file-ffd23f?style=for-the-badge&labelColor=5c1616)
![hosted on](https://img.shields.io/badge/hosted%20on-GitHub%20Pages-c81f2d?style=for-the-badge)

*drop a game in a folder. it shows up on the site. that's it.*

</div>

---

## ✨ What is this?

lava is a browser games library. The whole site is a single `index.html`, so there is nothing to install, build, or host besides GitHub Pages. It reads this repo's folders, turns every game it finds into a card, and plays it right inside the page.

## 🔥 Features

- 🎮 **Automatic library.** Every folder with an `index.html` becomes a game. No `games.json`, no backend.
- 🔎 **Instant search.** Filter games by name as you type.
- 🕹️ **Built-in player.** Play inside the page with a loading screen and a fullscreen button, or open games in a new tab.
- 🖼️ **Automatic thumbnails.** Uses an image from the game's folder, then the game's own share image or icon, then Wikipedia, then its favicon.
- 🎨 **Themes.** Lava, ocean, and midnight.
- ⚡ **Performance mode.** Turns off the animated background and transitions for slower devices.
- 🔄 **Always fresh.** New games appear right after you push them.

## 🕹️ Adding a game

1. Make a folder in the root of this repo, for example `my-game/`.
2. Put the game's files inside, with an `index.html` at the top of the folder.
3. Push it. Refresh the site, and it's there.

```
lava-games/
├── index.html          ← the site itself
├── README.md
├── lava-overrides.json ← shared name/thumbnail edits (created automatically)
├── 2048/
│   └── index.html
├── moto-x3m/
│   ├── index.html
│   └── thumbnail.png   ← optional: used as the card image
└── my-game/
    └── index.html
```

**Tips**

- Name a picture `thumbnail`, `cover`, `preview`, `splash`, `title`, `logo` or `icon` (png, jpg, webp) and it becomes the card image.
- The folder name becomes the game's title (`moto-x3m` shows as "Moto X3m"). Rename it any time from developer mode.
- Individual files over 20 MB won't load, so keep big assets small or split them up.

## 🛠️ Developer mode

Settings has a **developer mode** switch that needs a password. Once unlocked it adds:

| Tool | What it does |
| --- | --- |
| **add game** | Opens this repo's GitHub upload page |
| **edit (pencil on a card)** | Rename a game, search Google Images for a thumbnail, paste the image address |
| **github token** | Lets those edits save to the repo so every visitor sees them |
| **debug panel** | Live console, connectivity checks, and a library inspector |

The debug panel's connectivity tab tests GitHub, the CDN, Wikipedia, your token, and browser storage, and shows what's failing.

## 🚀 Put your own copy online

1. **Fork** this repo (or upload `index.html` to a new repo).
2. Go to **Settings → Pages**, choose **Deploy from a branch**, pick `main` and `/ (root)`, and save.
3. Open `index.html` and point it at your repo by changing these three lines near the top of the games script:

   ```js
   const GH_OWNER  = 'your-username';
   const GH_REPO   = 'your-repo';
   const GH_BRANCH = 'main';
   ```

4. **Set your own developer password.** Turn on developer mode, choose a password, copy the hash it shows, and paste it into `DEV_PASSWORD_HASH` in `index.html`.
5. **Optional: create a GitHub token** so edits sync. Make a fine-grained token limited to your repo with **Contents: read and write**, then paste it into developer mode's token box. It is stored only in your browser.

Your site will be at `https://<username>.github.io/<repo>/`.

## ⚙️ How it works

- The list of games comes from the GitHub API (one request for the latest commit, one for the file list).
- The site pins everything to that commit, so new pushes show up right away instead of hours later.
- Games are downloaded from the repo through the jsDelivr CDN and shown in the player, with their scripts, images and sounds loading from the same folder.
- The list is cached in your browser for 5 minutes, because GitHub allows about 60 API requests per hour per visitor. If GitHub can't be reached, the last saved list is used.
- Name and thumbnail edits live in `lava-overrides.json`, which every visitor reads.

## 🧯 Troubleshooting

- **"could not load games from GitHub"**: you may have hit the hourly limit. Wait a bit, then check developer mode → debug → connectivity.
- **A game won't start**: it may depend on its own web address (service workers, for example), or a file in it is over 20 MB.
- **A new game isn't showing**: the list refreshes every 5 minutes. In developer mode, use debug → library → refresh.
- **No thumbnail**: add a `thumbnail.png` to the game's folder, or set one from the edit button.

## 🔒 A note on the password

The developer password is a convenience lock, not real security, because anyone can read a web page's code. What actually protects your repo is the GitHub token: without yours, nobody can save changes to it. Keep the token private, and use a password you don't use anywhere else.

---

<div align="center">

made with 🔥 and one very long `index.html`

</div>
