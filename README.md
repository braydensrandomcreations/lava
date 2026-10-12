<p align="center">
  <img src="logo.svg" alt="FoilPack logo" width="110" height="110">
</p>

<h1 align="center">FoilPack</h1>

<p align="center">Wrap any web page in a single SVG file. Runs in your browser, nothing uploaded.</p>

FoilPack turns an HTML page into one self-contained `.svg` file that still works: same layout, same code, same behavior. Drop in your page along with the CSS, scripts, images, and fonts it uses, and they all get packed inside.

## Features

- **One file out.** Your page, its stylesheets, scripts, images, icons, fonts, audio, and video end up in a single `.svg`.
- **Private by design.** Everything runs locally in your browser. Nothing is uploaded anywhere.
- **Drag and drop.** Drop individual files or a whole folder, or paste HTML straight in.
- **Online files too.** Optionally downloads and packs in Google Fonts, CDN scripts, and online images.
- **Flexible sizing.** Fill the whole window, or set a fixed width and height.
- **Built-in preview.** Check the result before downloading.

## How to use

1. **Add your page.** Drop your `.html` file, plus any files it uses (or the whole folder). You can also paste HTML instead. If you add several pages, pick the main one from the dropdown.
2. **Set your options.**
   - *Pack in the files you dropped*: stylesheets, scripts, images, icons, fonts, audio, and video the page points to.
   - *Also download and pack in online files*: needs internet, and only works when the other site allows it. Anything blocked stays a normal link.
   - *Size*: fill the window (recommended) or a fixed size.
3. **Convert**, then **download the `.svg`** or hit **preview**.

## Running it

FoilPack is a static site with no build step and no dependencies. Open `index.html` in any modern browser, or host the folder anywhere static files are served, such as GitHub Pages.

## Project structure

```
foilpack/
├── index.html                  # page markup
├── style.css                   # all styling
├── app.js                      # the converter: reads files, inlines assets, builds the SVG
├── logo.svg                    # logo
├── assets/
│   ├── social-preview.png      # 1280x640 link preview (also set it in repo Settings)
│   ├── social-preview.svg      # editable source for the preview
│   ├── icon-192.png, icon-512.png, apple-touch-icon.png, favicon.ico
│   └── site.webmanifest
├── .github/
│   ├── workflows/pages.yml     # deploys to GitHub Pages on push to main
│   ├── ISSUE_TEMPLATE/         # bug report and feature request forms
│   └── pull_request_template.md
├── package.json                # npm start (local server), npm run check
├── LICENSE
└── .gitignore
```

## Development

No install needed. To serve it locally:

```
npm start
```

Then open http://localhost:3000. `npm run check` syntax-checks `app.js`.

## Deploying to GitHub Pages

1. Push the repo to GitHub with the default branch named `main`.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push a commit. The workflow in `.github/workflows/pages.yml` checks the script and publishes the site.

To get the link preview when you share the repo, upload `assets/social-preview.png` under **Settings → General → Social preview**.

## How it works

A web page can't become vector shapes and stay interactive, so the SVG hosts your original page, byte for byte, inside itself using a `foreignObject` containing an `iframe`. That keeps the layout, code, fonts, and behavior identical to the HTML file.

## Good to know

- **Open the `.svg` directly** in a browser, or host it. Where an SVG is only shown as a picture (an `<img>` tag, a README, most upload sites), browsers switch scripts off, so it won't be interactive there.
- **Iframes aren't packed in.** If your page embeds another page, convert that page on its own.
- **Add `<!DOCTYPE html>`** as the first line of your page. Inside an SVG, browsers always use standards mode, so pages without it can shift slightly.
- **Previews are sandboxed**, so a few things (like saved settings) can behave differently there. Download the file and open it in a browser for the real thing.
- **Very large outputs** (over about 25 MB) may be slow to open in some browsers.

## License

[MIT](LICENSE)
