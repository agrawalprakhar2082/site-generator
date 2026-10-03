# Demo Site Generator

Builds a complete, mobile-friendly website for a manufacturer in a few minutes. You can show it as a demo, then publish the same site on the client's own domain once they pay.

Nothing to install: double-click `index.html` to open it in Chrome. An internet connection is needed for zip export and AI auto-fill.

## Workflow for each lead

1. **New client**, choose a template (Engineering & Foundry, Jute, or Leather), and keep **Site mode = Demo**.
2. **Auto-fill with AI** (optional): open the company's IndiaMART page, select the text by hand, copy it, paste it into the box and click **Fill form from text**.
   - Facts the AI can't find (year, GSTIN, certifications) stay blank. It never makes them up. Check every field anyway.
   - Needs your Anthropic API key in **⚙ Settings**. Each fill costs a few US cents.
3. Add photos: logo, a hero photo, product photos and factory photos. Large photos are shrunk automatically.
4. Click through **Home / Products / About / Contact / Catalog** in the preview. Use 📱 to check the mobile view. Fix anything flagged ⚠ above the preview.
5. **Save client file** (keeps the work, including photos, as a `.json` file you can reopen).
6. **Download website (.zip)** and publish it (see below).
7. **✉ Outreach email** gives you a ready-to-send message containing the demo link.

## Publishing on Cloudflare Pages (free)

1. Sign in at dash.cloudflare.com, go to **Workers & Pages → Create → Pages → Upload assets**.
2. Name the project after the company (for example `sharma-castings`). The site goes live at `https://sharma-castings.pages.dev`. Set **Demo link pattern** in Settings to match, e.g. `https://{slug}.pages.dev`.
3. Drag in the **unzipped** folder and click **Deploy**.
4. **If they decline:** delete the Cloudflare project within 14 days. The demo uses their name and photos without permission.
5. **If they pay:** switch **Site mode** to **Live**, enter their domain, export again, upload a new version, then add the custom domain in Cloudflare (**Custom domains** tab).

### Demo mode vs live mode

| | Demo | Live |
|---|---|---|
| "Sample website" banner | Yes | No |
| Google indexing | Blocked (`noindex` and `robots.txt`) | Allowed, with `sitemap.xml` and a canonical URL |
| Company info for Google (JSON-LD) | No | Yes |

## Putting the generator itself online (GitHub Pages)

This lets other people (teammates or clients) build sites in their own browser.

1. On github.com, create a new **public** repository, for example `site-generator`.
2. **Add file → Upload files**, then drag in everything inside this folder: `index.html`, `README.md`, `css/` and `js/`.
3. Go to **Settings → Pages**, choose branch **main** and folder **/ (root)**, then click **Save**.
4. After about a minute, open `https://<your-username>.github.io/site-generator/`.

Each visitor's work stays in their own browser and nothing is shared between users. AI auto-fill only works for people who enter their own Anthropic API key in Settings; everything else works without one.

## Enquiry form

- With no form endpoint set, the Contact form opens WhatsApp (or email) with the enquiry already typed in.
- To receive enquiries by email without that step, create a free form at formspree.io and paste its URL into **Form endpoint**.

## Files

```
index.html        the app
css/app.css       app styles
js/templates.js   website templates (all 3 industries) and site CSS
js/samples.js     3 fictional sample companies for showing prospects
js/ai.js          AI auto-fill (Claude, structured output)
js/app.js         editor, preview, export
```

## Privacy and safety

- Your draft autosaves in this browser only. The API key is saved only if you tick "Remember".
- Copy listing text by hand. Don't use scrapers or bots on IndiaMART.
- Use only photos the company has published on its own listing or sent to you.
