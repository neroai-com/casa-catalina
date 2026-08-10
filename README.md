# Casa Catalina

Marketing site for **Casa Catalina** — a newly remodeled 2-bedroom vacation rental above Avalon on Catalina Island (golf cart included), hosted direct by Thomas & Megan Gill.

It's a **single, self-contained static site** — no build step, no framework, no dependencies. Just `index.html` and the photos in `images/`. It works on any static host.

```
.
├── index.html        ← the whole site (HTML + CSS + JS inline)
├── images/           ← property + Avalon photos, logo, favicons
├── frames/           ← the scroll-scrubbed arrival film (600px set + hd/ 1024px set)
├── videos/           ← cinematic room loops (lazy-loaded)
├── vercel.json       ← cache headers for Vercel deploys
├── robots.txt
├── .nojekyll         ← tells GitHub Pages to serve files as-is
└── .github/workflows/pages.yml   ← optional: auto-deploy to GitHub Pages
```

## Host it

Pick whichever you prefer — all serve the folder as-is.

**GitHub Pages (simplest, free)**
1. Push this folder to a repo (e.g. `main`).
2. Repo → **Settings → Pages** → **Source: Deploy from a branch** → **Branch: `main` / `root`** → Save.
3. It goes live at `https://<owner>.github.io/<repo>/` in ~1 minute.
   *(Or set Source to “GitHub Actions” to use the included `pages.yml` workflow.)*

**Vercel (recommended)** — “Add New Project” → import this repo → Framework preset: **Other**, **no build command**, **output = repo root** → Deploy. The included `vercel.json` sets long-lived caching for the scroll-film frames and videos. When you attach the final domain, update the `canonical`, `og:url`, `og:image`, and JSON-LD `url`/`image` values near the top of `index.html`.

**Netlify** — same idea: import the repo with no build command, or drag-and-drop the folder into Netlify Drop.

**Your own domain (linxapi / Coolify / nginx)** — copy this folder to the web root and serve it as static files. Point `catalina.linxapi.com` (or `catalinarentalshub.com`) at it.

## Edit it

- **Words:** edit the text directly in `index.html`.
- **Photos:** replace files in `images/` (keep the same names), or add new ones and update the `src` in `index.html`.
- **Contact / booking:** phone, email, and SMS links live near the `#book` and footer sections of `index.html`.

Photos and copy were sourced from the property's own listing (catalinarentalshub.com).
