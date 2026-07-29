# Casa Catalina

Marketing site for **Casa Catalina** — a newly remodeled 2-bedroom vacation rental above Avalon on Catalina Island (golf cart included), hosted direct by Thomas & Megan Gill.

It's a **single, self-contained static site** — no build step, no framework, no dependencies. Just `index.html` and the photos in `images/`. It works on any static host.

```
.
├── index.html        ← the whole site (HTML + CSS + JS inline)
├── images/           ← the 16 property + Avalon photos
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

**Vercel / Netlify** — “Add new project” → import this repo → **no build command**, **output = repo root** (or drag-and-drop the folder into Netlify Drop).

**Your own domain (linxapi / Coolify / nginx)** — copy this folder to the web root and serve it as static files. Point `catalina.linxapi.com` (or `catalinarentalshub.com`) at it.

## Edit it

- **Words:** edit the text directly in `index.html`.
- **Photos:** replace files in `images/` (keep the same names), or add new ones and update the `src` in `index.html`.
- **Contact / booking:** phone, email, and SMS links live near the `#book` and footer sections of `index.html`.

Photos and copy were sourced from the property's own listing (catalinarentalshub.com).
