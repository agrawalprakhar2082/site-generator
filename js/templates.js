/* Site templates: turn a company profile into a complete static website.
 * Pure functions only — no DOM access — so the same code renders the live
 * preview and the exported .zip. */
(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Industry presets
  // ---------------------------------------------------------------------------
  const PRESETS = {
    engineering: {
      label: "Engineering & Foundry",
      colors: { brand: "#17406b", brandDark: "#0d2a4a", accent: "#f2a900", tint: "#eef3f8" },
      heroKicker: "Manufacturer & Exporter",
      productsHeading: "Our Products",
      productsIntro: "Precision-made components manufactured to drawing and international standards.",
      industriesHeading: "Industries We Serve",
      defaultWhyUs: [
        { title: "Built to specification", text: "Every order is manufactured to your drawings, grades and tolerances." },
        { title: "In-house quality checks", text: "Material and dimensional inspection before every dispatch." },
        { title: "Export-ready packing", text: "Documentation and packing suitable for domestic and overseas shipments." },
        { title: "Direct from the factory", text: "Deal directly with the manufacturer — no middlemen, clear pricing." },
      ],
      pattern: "grid",
    },
    jute: {
      label: "Jute & Natural Fibre",
      colors: { brand: "#3f5f2f", brandDark: "#2a4120", accent: "#c8a165", tint: "#f5f1e8" },
      heroKicker: "Sustainable Jute Products",
      productsHeading: "Our Jute Range",
      productsIntro: "Eco-friendly jute products made in the Hooghly jute belt, available in custom sizes and prints.",
      industriesHeading: "Who We Supply",
      defaultWhyUs: [
        { title: "Natural & biodegradable", text: "Made from 100% natural jute fibre — a plastic-free alternative." },
        { title: "Custom sizes & printing", text: "Bulk orders made to your size, colour, lamination and branding." },
        { title: "Bulk & export supply", text: "Consistent quality across large volumes for buyers in India and abroad." },
        { title: "Direct from the mill region", text: "Sourced and made in West Bengal, India's jute heartland." },
      ],
      pattern: "weave",
    },
    leather: {
      label: "Leather Goods",
      colors: { brand: "#5b3a29", brandDark: "#3d2519", accent: "#c27c3e", tint: "#f7f1ec" },
      heroKicker: "Leather Goods Manufacturer",
      productsHeading: "Our Collection",
      productsIntro: "Finished leather goods crafted for private labels, retailers and corporate buyers.",
      industriesHeading: "Who We Work With",
      defaultWhyUs: [
        { title: "Skilled craftsmanship", text: "Experienced artisans and careful finishing on every piece." },
        { title: "Private label ready", text: "Your designs, your branding — sampling to bulk production." },
        { title: "Quality leather sourcing", text: "Leather selected for consistency in grain, colour and feel." },
        { title: "Export experience", text: "Packing and documentation for international buyers." },
      ],
      pattern: "stitch",
    },
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const esc = (v) =>
    String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const has = (v) => (Array.isArray(v) ? v.length > 0 : String(v == null ? "" : v).trim() !== "");

  const slugify = (s) =>
    String(s || "site")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "site";

  const initials = (name) =>
    String(name || "?")
      .replace(/\(.*?\)|<[^>]*>/g, " ")
      .split(/[^A-Za-z0-9]+/)
      .filter((w) => w && !/^(pvt|private|ltd|limited|llp|co|company|and|the)$/i.test(w))
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "?";

  const digits = (s) => String(s || "").replace(/[^\d]/g, "");

  // wa.me needs the full international number without "+" — assume India for 10-digit numbers.
  const waNumber = (s) => {
    const d = digits(s);
    if (d.length === 10) return "91" + d;
    if (d.length === 11 && d.startsWith("0")) return "91" + d.slice(1);
    return d;
  };

  const telHref = (s) => {
    const d = digits(s);
    if (d.length === 10) return "+91" + d;
    return (String(s || "").trim().startsWith("+") ? "+" : "") + d;
  };

  const presetFor = (data) => PRESETS[data.template] || PRESETS.engineering;

  const colorsFor = (data) => {
    const c = Object.assign({}, presetFor(data).colors);
    if (/^#[0-9a-f]{6}$/i.test(data.brand_color || "")) c.brand = data.brand_color;
    return c;
  };

  const fullAddress = (c) =>
    [c.address, [c.city, c.state].filter(has).join(", "), c.pincode].filter(has).join(", ");

  // ---------------------------------------------------------------------------
  // Placeholder artwork (used when a photo hasn't been added yet)
  // ---------------------------------------------------------------------------
  function patternSvg(kind, fg, bg) {
    const shapes = {
      grid:
        `<path d="M0 20h40M20 0v40" stroke="${fg}" stroke-opacity=".18" stroke-width="1"/>` +
        `<circle cx="20" cy="20" r="2.2" fill="${fg}" fill-opacity=".25"/>`,
      weave:
        `<path d="M0 10h40M0 30h40" stroke="${fg}" stroke-opacity=".1" stroke-width="6"/>` +
        `<path d="M10 0v40M30 0v40" stroke="${fg}" stroke-opacity=".06" stroke-width="6"/>`,
      stitch:
        `<path d="M0 20h40" stroke="${fg}" stroke-opacity=".25" stroke-width="1.5" stroke-dasharray="4 4"/>` +
        `<path d="M20 0v40" stroke="${fg}" stroke-opacity=".12" stroke-width="1"/>`,
    };
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="${bg}"/>` +
      (shapes[kind] || shapes.grid) +
      `</svg>`
    );
  }

  const svgDataUri = (svg) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);

  function placeholderImage(label, data) {
    const c = colorsFor(data);
    const text = esc(String(label || "").slice(0, 28));
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">` +
      `<defs><pattern id="p" width="40" height="40" patternUnits="userSpaceOnUse">` +
      patternSvg(presetFor(data).pattern, "#ffffff", c.brand).replace(/^<svg[^>]*>|<\/svg>$/g, "") +
      `</pattern></defs><rect width="800" height="600" fill="url(#p)"/>` +
      `<text x="400" y="315" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="40" font-weight="700" fill="#ffffff" fill-opacity=".9">${text}</text>` +
      `</svg>`;
    return svgDataUri(svg);
  }

  // ---------------------------------------------------------------------------
  // Shared stylesheet for generated sites
  // ---------------------------------------------------------------------------
  function siteCss(data) {
    const c = colorsFor(data);
    const pat = svgDataUri(patternSvg(presetFor(data).pattern, "#ffffff", c.brandDark));
    return `
:root{--brand:${c.brand};--brand-dark:${c.brandDark};--accent:${c.accent};--tint:${c.tint};
--ink:#1c2430;--muted:#5b6675;--line:#e3e7ed;--bg:#ffffff;--radius:10px;
--shadow:0 1px 2px rgba(16,24,40,.06),0 4px 16px rgba(16,24,40,.06)}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:var(--ink);background:var(--bg);line-height:1.6;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}
a{color:var(--brand)}
h1,h2,h3{line-height:1.2;margin:0 0 .5em;color:var(--ink)}
h1{font-size:clamp(2rem,4.5vw,3.1rem);letter-spacing:-.02em}
h2{font-size:clamp(1.5rem,3vw,2.1rem);letter-spacing:-.01em}
h3{font-size:1.1rem}
p{margin:0 0 1em}
.wrap{max-width:1160px;margin:0 auto;padding:0 20px}
.btn{display:inline-flex;align-items:center;gap:.5em;padding:.8em 1.3em;border-radius:8px;font-weight:600;text-decoration:none;border:2px solid transparent;cursor:pointer;font-size:1rem;font-family:inherit}
.btn-primary{background:var(--accent);color:#111}
.btn-primary:hover{filter:brightness(.95)}
.btn-ghost{border-color:rgba(255,255,255,.7);color:#fff}
.btn-ghost:hover{background:rgba(255,255,255,.12)}
.btn-outline{border-color:var(--brand);color:var(--brand);background:#fff}
.btn-wa{background:#25d366;color:#fff}
.demo-banner{background:#111827;color:#f9fafb;font-size:.85rem;text-align:center;padding:.55em 1em}
.demo-banner b{color:#fbbf24}
.topbar{background:var(--brand-dark);color:#dbe4ee;font-size:.85rem}
.topbar .wrap{display:flex;gap:1.5em;justify-content:flex-end;padding-top:.45em;padding-bottom:.45em;flex-wrap:wrap}
.topbar a{color:#fff;text-decoration:none}
header.site{background:#fff;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:20}
header.site .wrap{display:flex;align-items:center;justify-content:space-between;gap:1rem;min-height:70px}
.logo{display:flex;align-items:center;gap:.7em;text-decoration:none;color:var(--ink);font-weight:700;font-size:1.1rem;line-height:1.15}
.logo img{height:44px;width:auto}
.logo .mark{width:44px;height:44px;border-radius:8px;background:var(--brand);color:#fff;display:grid;place-items:center;font-weight:800;letter-spacing:.02em;flex:none}
.logo small{display:block;font-weight:500;font-size:.72rem;color:var(--muted);letter-spacing:.06em;text-transform:uppercase}
nav.main{display:flex;align-items:center;gap:1.4rem}
nav.main a{text-decoration:none;color:var(--ink);font-weight:500}
nav.main a.active,nav.main a:hover{color:var(--brand)}
nav.main a.btn{color:#111}
.menu-toggle{display:none;background:none;border:1px solid var(--line);border-radius:8px;padding:.45em .7em;font-size:1.1rem;cursor:pointer}
.hero{position:relative;color:#fff;background:var(--brand-dark) url("${pat}");overflow:hidden}
.hero .wrap{display:grid;grid-template-columns:1.1fr .9fr;gap:3rem;align-items:center;padding-top:4.5rem;padding-bottom:4.5rem}
.hero h1{color:#fff}
.hero .kicker{display:inline-block;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);padding:.3em .8em;border-radius:99px;font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;margin-bottom:1.1rem}
.hero p.lead{font-size:1.15rem;color:#e5ecf3;max-width:36em}
.hero .actions{display:flex;gap:.8rem;flex-wrap:wrap;margin-top:1.6rem}
.hero .visual img{border-radius:var(--radius);box-shadow:0 20px 50px rgba(0,0,0,.35);aspect-ratio:4/3;object-fit:cover;width:100%}
.facts{background:#fff;border-bottom:1px solid var(--line)}
.facts .wrap{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:1px;background:var(--line);padding:0}
.fact{background:#fff;padding:1.4rem 1.2rem;text-align:center}
.fact b{display:block;font-size:1.35rem;color:var(--brand)}
.fact span{color:var(--muted);font-size:.9rem}
section{padding:4.2rem 0}
section.alt{background:var(--tint)}
.section-head{max-width:720px;margin-bottom:2.2rem}
.section-head p{color:var(--muted)}
.eyebrow{color:var(--brand);font-weight:700;font-size:.8rem;letter-spacing:.12em;text-transform:uppercase;margin-bottom:.4rem}
.grid{display:grid;gap:1.4rem}
.grid.products{grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}
.card{background:#fff;border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow);display:flex;flex-direction:column}
.card img{aspect-ratio:4/3;object-fit:cover;width:100%;background:var(--tint)}
.card .body{padding:1.1rem 1.2rem 1.3rem;display:flex;flex-direction:column;gap:.4rem;flex:1}
.card .cat{font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.card p{color:var(--muted);font-size:.95rem;margin:0}
.card .more{margin-top:auto;padding-top:.6rem;font-weight:600;text-decoration:none}
.why{grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}
.why .item{background:#fff;border-radius:var(--radius);padding:1.4rem;border-top:4px solid var(--accent);box-shadow:var(--shadow)}
.why .item p{color:var(--muted);margin:0}
.chips{display:flex;flex-wrap:wrap;gap:.6rem}
.chip{background:#fff;border:1px solid var(--line);border-radius:99px;padding:.45em 1em;font-weight:500}
.chip.dark{background:var(--brand);color:#fff;border-color:var(--brand)}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:3rem;align-items:start}
.cta-band{background:var(--brand);color:#fff;padding:3.2rem 0}
.cta-band .wrap{display:flex;justify-content:space-between;align-items:center;gap:1.5rem;flex-wrap:wrap}
.cta-band h2{color:#fff;margin:0}
.cta-band p{margin:.3em 0 0;color:#dbe4ee}
.page-head{background:var(--brand-dark) url("${pat}");color:#fff;padding:3.2rem 0}
.page-head h1{color:#fff;margin:0}
.page-head p{color:#dbe4ee;margin:.5em 0 0}
.product-row{display:grid;grid-template-columns:340px 1fr;gap:2rem;padding:2rem 0;border-bottom:1px solid var(--line);scroll-margin-top:90px}
.product-row img{border-radius:var(--radius);aspect-ratio:4/3;object-fit:cover;width:100%}
table.specs{border-collapse:collapse;width:100%;margin:1rem 0;font-size:.95rem}
table.specs th,table.specs td{text-align:left;padding:.55em .8em;border-bottom:1px solid var(--line);vertical-align:top}
table.specs th{width:38%;color:var(--muted);font-weight:500;background:var(--tint)}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem}
.gallery img{border-radius:var(--radius);aspect-ratio:4/3;object-fit:cover;width:100%}
.contact-grid{display:grid;grid-template-columns:1fr 1.2fr;gap:2.5rem}
.contact-card{background:var(--tint);border-radius:var(--radius);padding:1.6rem}
.contact-card dl{margin:0}
.contact-card dt{font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-top:1em}
.contact-card dd{margin:.15em 0 0;font-weight:500}
form.enquiry{display:grid;gap:1rem}
form.enquiry .row{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
form.enquiry label{display:grid;gap:.35em;font-weight:500;font-size:.92rem}
form.enquiry input,form.enquiry textarea,form.enquiry select{font:inherit;padding:.7em .8em;border:1px solid #cdd5df;border-radius:8px;background:#fff;width:100%}
form.enquiry textarea{min-height:130px;resize:vertical}
form.enquiry .note{font-size:.85rem;color:var(--muted)}
.form-status{font-weight:600}
.map iframe{width:100%;height:320px;border:0;border-radius:var(--radius);margin-top:1.5rem}
footer.site{background:#0f1720;color:#b8c2cf;padding:3rem 0 1.5rem;font-size:.93rem}
footer.site .cols{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:2rem}
footer.site h3{color:#fff;font-size:1rem}
footer.site a{color:#dfe6ee;text-decoration:none}
footer.site ul{list-style:none;padding:0;margin:0;display:grid;gap:.35em}
footer.site .legal{border-top:1px solid #253141;margin-top:2rem;padding-top:1.2rem;display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;font-size:.83rem}
.wa-float{position:fixed;right:18px;bottom:18px;width:56px;height:56px;border-radius:50%;background:#25d366;display:grid;place-items:center;box-shadow:0 6px 20px rgba(0,0,0,.25);z-index:30}
.wa-float svg{width:30px;height:30px;fill:#fff}
@media (max-width:860px){
  .hero .wrap,.two-col,.contact-grid,.product-row{grid-template-columns:1fr}
  .hero .wrap{padding-top:3rem;padding-bottom:3rem;gap:2rem}
  footer.site .cols{grid-template-columns:1fr}
  .menu-toggle{display:block}
  nav.main{display:none;position:absolute;left:0;right:0;top:100%;background:#fff;flex-direction:column;align-items:stretch;padding:1rem 20px 1.4rem;border-bottom:1px solid var(--line);gap:.9rem}
  nav.main.open{display:flex}
  .topbar .wrap{justify-content:center}
  form.enquiry .row{grid-template-columns:1fr}
}
/* Printable catalog */
.catalog-cover{padding:4rem 0 2rem;border-bottom:4px solid var(--brand)}
.catalog-cover h1{margin-bottom:.2em}
.catalog-grid{display:grid;grid-template-columns:1fr 1fr;gap:1.6rem;padding:2rem 0}
.catalog-item{border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;break-inside:avoid;page-break-inside:avoid}
.catalog-item img{aspect-ratio:16/10;object-fit:cover;width:100%}
.catalog-item .body{padding:1rem 1.1rem}
.print-bar{position:sticky;top:0;background:var(--tint);border-bottom:1px solid var(--line);padding:.7rem 0;z-index:5}
.print-bar .wrap{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}
@media print{
  .print-bar,.demo-banner,.wa-float,.topbar,header.site,footer.site{display:none!important}
  body{font-size:11pt}
  .catalog-grid{grid-template-columns:1fr 1fr;gap:12pt}
  @page{margin:14mm}
}
`.trim();
  }

  // ---------------------------------------------------------------------------
  // Page chrome
  // ---------------------------------------------------------------------------
  const WA_ICON =
    '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3C9 3 3.3 8.6 3.3 15.6c0 2.2.6 4.4 1.7 6.3L3 29l7.3-1.9c1.8 1 3.8 1.5 5.8 1.5 7 0 12.7-5.7 12.7-12.6C28.8 8.6 23 3 16 3zm0 23.1c-1.9 0-3.7-.5-5.3-1.5l-.4-.2-4.3 1.1 1.2-4.2-.3-.4c-1.1-1.7-1.6-3.6-1.6-5.6C5.3 9.9 10.1 5.2 16 5.2s10.7 4.7 10.7 10.5S21.9 26.1 16 26.1zm5.9-7.8c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1c-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-1.9-1.8-2.2s0-.5.1-.6l.5-.6c.2-.2.2-.4.3-.6.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.2 1.4 3.5c.2.2 2.4 3.6 5.8 5 .8.4 1.4.6 1.9.7.8.3 1.5.2 2.1.1.6-.1 1.9-.8 2.2-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4z"/></svg>';

  const NAV = [
    ["index", "Home", "index.html"],
    ["products", "Products", "products.html"],
    ["about", "About Us", "about.html"],
    ["contact", "Contact", "contact.html"],
  ];

  function pageUrl(key, ctx) {
    const item = NAV.find((n) => n[0] === key);
    const file = item ? item[2] : key + ".html";
    return ctx.mode === "preview" ? "#page=" + key : file;
  }

  function logoHtml(data, ctx) {
    const c = data.company || {};
    const sub = c.business_type || presetFor(data).heroKicker;
    const mark = data.logo && ctx.asset(data.logo)
      ? `<img src="${ctx.asset(data.logo)}" alt="${esc(c.name)} logo">`
      : `<span class="mark">${esc(initials(c.name))}</span>`;
    return `<a class="logo" href="${pageUrl("index", ctx)}">${mark}<span>${esc(c.name || "Company Name")}<small>${esc(sub)}</small></span></a>`;
  }

  function header(data, active, ctx) {
    const c = data.contact || {};
    const top = [
      has(c.phone) ? `<a href="tel:${esc(telHref(c.phone))}">📞 ${esc(c.phone)}</a>` : "",
      has(c.email) ? `<a href="mailto:${esc(c.email)}">✉️ ${esc(c.email)}</a>` : "",
      has(data.company && data.company.city) ? `<span>📍 ${esc([data.company.city, data.company.state].filter(has).join(", "))}</span>` : "",
    ].join("");
    const links = NAV.map(
      ([key, label]) =>
        `<a href="${pageUrl(key, ctx)}"${key === active ? ' class="active" aria-current="page"' : ""}>${label}</a>`
    ).join("");
    return `
${ctx.banner}
${top ? `<div class="topbar"><div class="wrap">${top}</div></div>` : ""}
<header class="site"><div class="wrap">
  ${logoHtml(data, ctx)}
  <button class="menu-toggle" aria-label="Open menu" onclick="document.querySelector('nav.main').classList.toggle('open')">☰</button>
  <nav class="main">${links}<a class="btn btn-primary" href="${pageUrl("contact", ctx)}">Request a Quote</a></nav>
</div></header>`;
  }

  function footer(data, ctx) {
    const co = data.company || {};
    const c = data.contact || {};
    const year = new Date().getFullYear();
    const legal = [has(co.gstin) ? `GSTIN: ${esc(co.gstin)}` : "", has(co.iec) ? `IEC: ${esc(co.iec)}` : ""]
      .filter(Boolean)
      .join(" · ");
    const productLinks = (data.products || [])
      .slice(0, 5)
      .map((p, i) => `<li><a href="${ctx.mode === "preview" ? "#page=products" : "products.html#p" + (i + 1)}">${esc(p.name)}</a></li>`)
      .join("");
    const wa = has(c.whatsapp || c.phone)
      ? `<a class="wa-float" href="https://wa.me/${waNumber(c.whatsapp || c.phone)}?text=${encodeURIComponent("Hello " + (co.name || "") + ", I have an enquiry.")}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">${WA_ICON}</a>`
      : "";
    return `
<footer class="site"><div class="wrap">
  <div class="cols">
    <div>
      <h3>${esc(co.name || "Company Name")}</h3>
      <p>${esc(co.tagline || presetFor(data).productsIntro)}</p>
      ${has(fullAddress(Object.assign({}, c, co))) ? `<p>${esc(fullAddress({ address: c.address, city: co.city, state: co.state, pincode: c.pincode }))}</p>` : ""}
    </div>
    <div><h3>Products</h3><ul>${productLinks || "<li>Coming soon</li>"}</ul></div>
    <div><h3>Contact</h3><ul>
      ${has(c.person) ? `<li>${esc(c.person)}</li>` : ""}
      ${has(c.phone) ? `<li><a href="tel:${esc(telHref(c.phone))}">${esc(c.phone)}</a></li>` : ""}
      ${has(c.email) ? `<li><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>` : ""}
      <li><a href="${pageUrl("contact", ctx)}">Send an enquiry →</a></li>
    </ul></div>
  </div>
  <div class="legal"><span>© ${year} ${esc(co.name || "")}. All rights reserved.</span><span>${legal}</span></div>
</div></footer>
${wa}`;
  }

  function jsonLd(data, ctx) {
    if (ctx.siteMode !== "live") return "";
    const co = data.company || {};
    const c = data.contact || {};
    const url = data.domain ? "https://" + data.domain.replace(/^https?:\/\//, "").replace(/\/$/, "") + "/" : undefined;
    const ld = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: co.name,
      url,
      description: co.tagline || undefined,
      foundingDate: co.established_year || undefined,
      telephone: c.phone ? telHref(c.phone) : undefined,
      email: c.email || undefined,
      address: has(c.address)
        ? {
            "@type": "PostalAddress",
            streetAddress: c.address,
            addressLocality: co.city || undefined,
            addressRegion: co.state || undefined,
            postalCode: c.pincode || undefined,
            addressCountry: "IN",
          }
        : undefined,
    };
    // Escape "<" so the JSON can never close the script tag early.
    return `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`;
  }

  function layout(data, key, title, description, body, ctx) {
    const co = data.company || {};
    const pageTitle = key === "index" ? `${co.name || "Company"} — ${co.tagline || presetFor(data).heroKicker}` : `${title} | ${co.name || "Company"}`;
    const robots = ctx.siteMode === "live" ? "index,follow" : "noindex,nofollow";
    const canonical =
      ctx.siteMode === "live" && has(data.domain)
        ? `<link rel="canonical" href="https://${esc(data.domain.replace(/^https?:\/\//, "").replace(/\/$/, ""))}/${key === "index" ? "" : key + ".html"}">`
        : "";
    const css = ctx.mode === "preview" ? `<style>${siteCss(data)}</style>` : `<link rel="stylesheet" href="site.css">`;
    const icon = data.logo && ctx.asset(data.logo) ? `<link rel="icon" href="${ctx.asset(data.logo)}">` : "";
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${robots}">
<meta property="og:title" content="${esc(pageTitle)}">
<meta property="og:description" content="${esc(description)}">
${canonical}
${icon}
${css}
${jsonLd(data, ctx)}
</head>
<body>
${header(data, key, ctx)}
<main>
${body}
</main>
${footer(data, ctx)}
</body>
</html>`;
  }

  // ---------------------------------------------------------------------------
  // Page bodies
  // ---------------------------------------------------------------------------
  function productImg(p, i, data, ctx) {
    return (p.image && ctx.asset(p.image)) || placeholderImage(p.name || "Product " + (i + 1), data);
  }

  function factsStrip(data) {
    const items = (data.highlights || []).filter((h) => has(h.value) || has(h.label)).slice(0, 4);
    if (!items.length) return "";
    return `<div class="facts"><div class="wrap">${items
      .map((h) => `<div class="fact"><b>${esc(h.value)}</b><span>${esc(h.label)}</span></div>`)
      .join("")}</div></div>`;
  }

  function ctaBand(data, ctx) {
    const c = data.contact || {};
    return `
<div class="cta-band"><div class="wrap">
  <div><h2>Looking for a reliable supplier?</h2><p>Share your requirement — we usually respond within one working day.</p></div>
  <div style="display:flex;gap:.7rem;flex-wrap:wrap">
    <a class="btn btn-primary" href="${pageUrl("contact", ctx)}">Request a Quote</a>
    ${has(c.whatsapp || c.phone) ? `<a class="btn btn-ghost" href="https://wa.me/${waNumber(c.whatsapp || c.phone)}" target="_blank" rel="noopener">WhatsApp Us</a>` : ""}
  </div>
</div></div>`;
  }

  function homeBody(data, ctx) {
    const preset = presetFor(data);
    const co = data.company || {};
    const c = data.contact || {};
    const products = data.products || [];
    const whyUs = (data.why_us || []).filter((w) => has(w.title)).length ? data.why_us.filter((w) => has(w.title)) : preset.defaultWhyUs;
    const heroImg = (data.hero && ctx.asset(data.hero)) || (products[0] ? productImg(products[0], 0, data, ctx) : placeholderImage(co.name, data));
    const lead =
      (co.about || "").split(/(?<=[.!?])\s+/).slice(0, 2).join(" ") ||
      `${co.name || "We"} manufacture and supply quality products for customers across India and overseas.`;

    const productCards = products
      .slice(0, 6)
      .map(
        (p, i) => `
<article class="card">
  <img src="${productImg(p, i, data, ctx)}" alt="${esc(p.name)}" loading="lazy">
  <div class="body">
    ${has(p.category) ? `<span class="cat">${esc(p.category)}</span>` : ""}
    <h3>${esc(p.name)}</h3>
    <p>${esc(String(p.description || "").slice(0, 140))}${String(p.description || "").length > 140 ? "…" : ""}</p>
    <a class="more" href="${ctx.mode === "preview" ? "#page=products" : "products.html#p" + (i + 1)}">View details →</a>
  </div>
</article>`
      )
      .join("");

    const industries = (data.industries || []).filter(has);
    const certs = (data.certifications || []).filter(has);
    const markets = (data.export_markets || []).filter(has);

    return `
<section class="hero"><div class="wrap">
  <div>
    <span class="kicker">${esc(co.business_type || preset.heroKicker)}${has(co.established_year) ? " · Since " + esc(co.established_year) : ""}</span>
    <h1>${esc(co.tagline || co.name || "Quality manufacturing you can rely on")}</h1>
    <p class="lead">${esc(lead)}</p>
    <div class="actions">
      <a class="btn btn-primary" href="${pageUrl("contact", ctx)}">Request a Quote</a>
      <a class="btn btn-ghost" href="${pageUrl("products", ctx)}">View Products</a>
      ${has(c.whatsapp || c.phone) ? `<a class="btn btn-wa" href="https://wa.me/${waNumber(c.whatsapp || c.phone)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
    </div>
  </div>
  <div class="visual"><img src="${heroImg}" alt="${esc(co.name)}"></div>
</div></section>
${factsStrip(data)}

<section><div class="wrap">
  <div class="section-head"><div class="eyebrow">${esc(preset.productsHeading)}</div><h2>What we manufacture</h2><p>${esc(preset.productsIntro)}</p></div>
  <div class="grid products">${productCards || "<p>Product details coming soon.</p>"}</div>
  ${products.length > 6 ? `<p style="margin-top:1.6rem"><a class="btn btn-outline" href="${pageUrl("products", ctx)}">See all ${products.length} products</a></p>` : ""}
</div></section>

<section class="alt"><div class="wrap">
  <div class="section-head"><div class="eyebrow">Why choose us</div><h2>Why buyers work with ${esc(co.name || "us")}</h2></div>
  <div class="grid why">${whyUs
    .slice(0, 4)
    .map((w) => `<div class="item"><h3>${esc(w.title)}</h3><p>${esc(w.text)}</p></div>`)
    .join("")}</div>
</div></section>

${
  industries.length || certs.length || markets.length
    ? `<section><div class="wrap two-col">
  ${industries.length ? `<div><div class="eyebrow">${esc(preset.industriesHeading)}</div><h2>Trusted across sectors</h2><div class="chips">${industries.map((x) => `<span class="chip">${esc(x)}</span>`).join("")}</div></div>` : ""}
  ${
    certs.length || markets.length
      ? `<div>${certs.length ? `<div class="eyebrow">Quality & compliance</div><h2>Certifications</h2><div class="chips" style="margin-bottom:1.6rem">${certs.map((x) => `<span class="chip dark">${esc(x)}</span>`).join("")}</div>` : ""}
         ${markets.length ? `<div class="eyebrow">Export markets</div><div class="chips">${markets.map((x) => `<span class="chip">🌍 ${esc(x)}</span>`).join("")}</div>` : ""}</div>`
      : ""
  }
</div></section>`
    : ""
}
${ctaBand(data, ctx)}`;
  }

  function productsBody(data, ctx) {
    const preset = presetFor(data);
    const products = data.products || [];
    const rows = products
      .map((p, i) => {
        const specs = (p.specs || []).filter((s) => has(s.label) || has(s.value));
        const enquire = ctx.mode === "preview" ? "#page=contact" : "contact.html?product=" + encodeURIComponent(p.name || "") + "#enquiry";
        return `
<div class="product-row" id="p${i + 1}">
  <img src="${productImg(p, i, data, ctx)}" alt="${esc(p.name)}" loading="lazy">
  <div>
    ${has(p.category) ? `<div class="eyebrow">${esc(p.category)}</div>` : ""}
    <h2>${esc(p.name)}</h2>
    <p>${esc(p.description)}</p>
    ${specs.length ? `<table class="specs"><tbody>${specs.map((s) => `<tr><th>${esc(s.label)}</th><td>${esc(s.value)}</td></tr>`).join("")}</tbody></table>` : ""}
    <a class="btn btn-primary" href="${enquire}">Enquire about this product</a>
  </div>
</div>`;
      })
      .join("");
    return `
<div class="page-head"><div class="wrap"><h1>${esc(preset.productsHeading)}</h1><p>${esc(preset.productsIntro)}</p></div></div>
<section style="padding-top:1rem"><div class="wrap">
  ${rows || "<p>Product details coming soon.</p>"}
  <p style="margin-top:2rem"><a class="btn btn-outline" href="${ctx.mode === "preview" ? "#page=catalog" : "catalog.html"}">📄 Download product catalog (PDF)</a></p>
</div></section>
${ctaBand(data, ctx)}`;
  }

  function aboutBody(data, ctx) {
    const co = data.company || {};
    const paras = String(co.about || "")
      .split(/\n\s*\n|\n/)
      .filter(has)
      .map((p) => `<p>${esc(p)}</p>`)
      .join("");
    const facts = [
      ["Company", co.name],
      ["Nature of business", co.business_type],
      ["Year established", co.established_year],
      ["Location", [co.city, co.state].filter(has).join(", ")],
      ["GSTIN", co.gstin],
      ["IEC (Import Export Code)", co.iec],
    ].filter(([, v]) => has(v));
    const gallery = (data.gallery || []).map((id) => ctx.asset(id)).filter(Boolean);
    const certs = (data.certifications || []).filter(has);
    return `
<div class="page-head"><div class="wrap"><h1>About ${esc(co.name || "Us")}</h1>${has(co.tagline) ? `<p>${esc(co.tagline)}</p>` : ""}</div></div>
<section><div class="wrap two-col">
  <div><div class="eyebrow">Our story</div><h2>Who we are</h2>${paras || "<p>Company profile coming soon.</p>"}</div>
  <div>${facts.length ? `<table class="specs"><tbody>${facts.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</tbody></table>` : ""}
  ${certs.length ? `<h3 style="margin-top:1.6rem">Certifications</h3><div class="chips">${certs.map((x) => `<span class="chip dark">${esc(x)}</span>`).join("")}</div>` : ""}</div>
</div></section>
${gallery.length ? `<section class="alt"><div class="wrap"><div class="section-head"><div class="eyebrow">Infrastructure</div><h2>Our facility</h2></div><div class="gallery">${gallery.map((src, i) => `<img src="${src}" alt="${esc(co.name)} facility photo ${i + 1}" loading="lazy">`).join("")}</div></div></section>` : ""}
${ctaBand(data, ctx)}`;
  }

  function contactBody(data, ctx) {
    const co = data.company || {};
    const c = data.contact || {};
    const addr = fullAddress({ address: c.address, city: co.city, state: co.state, pincode: c.pincode });
    const mapQ = c.map_query || [co.name, addr].filter(has).join(", ");
    const products = (data.products || []).filter((p) => has(p.name));
    const formConfig = {
      endpoint: c.form_endpoint || "",
      whatsapp: has(c.whatsapp || c.phone) ? waNumber(c.whatsapp || c.phone) : "",
      email: c.email || "",
      company: co.name || "",
    };
    return `
<div class="page-head"><div class="wrap"><h1>Contact Us</h1><p>Send us your requirement and we will get back with a quotation.</p></div></div>
<section><div class="wrap contact-grid">
  <div class="contact-card">
    <h2>${esc(co.name || "Get in touch")}</h2>
    <dl>
      ${has(c.person) ? `<dt>Contact person</dt><dd>${esc(c.person)}</dd>` : ""}
      ${has(c.phone) ? `<dt>Phone</dt><dd><a href="tel:${esc(telHref(c.phone))}">${esc(c.phone)}</a></dd>` : ""}
      ${has(c.whatsapp) && c.whatsapp !== c.phone ? `<dt>WhatsApp</dt><dd><a href="https://wa.me/${waNumber(c.whatsapp)}" target="_blank" rel="noopener">${esc(c.whatsapp)}</a></dd>` : ""}
      ${has(c.email) ? `<dt>Email</dt><dd><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></dd>` : ""}
      ${has(addr) ? `<dt>Address</dt><dd>${esc(addr)}</dd>` : ""}
      ${has(c.hours) ? `<dt>Business hours</dt><dd>${esc(c.hours)}</dd>` : ""}
    </dl>
    ${has(mapQ) ? `<div class="map"><iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Map" src="https://www.google.com/maps?q=${encodeURIComponent(mapQ)}&output=embed"></iframe></div>` : ""}
  </div>
  <div id="enquiry">
    <h2>Send an enquiry</h2>
    <form class="enquiry" id="enquiry-form">
      <div class="row">
        <label>Your name<input name="name" required autocomplete="name"></label>
        <label>Company<input name="company" autocomplete="organization"></label>
      </div>
      <div class="row">
        <label>Phone / WhatsApp<input name="phone" required inputmode="tel" autocomplete="tel"></label>
        <label>Email<input name="email" type="email" autocomplete="email"></label>
      </div>
      <div class="row">
        <label>Product of interest<select name="product"><option value="">— Select —</option>${products.map((p) => `<option>${esc(p.name)}</option>`).join("")}<option>Other</option></select></label>
        <label>Quantity required<input name="quantity" placeholder="e.g. 500 pcs / 2 MT"></label>
      </div>
      <label>Requirement details<textarea name="message" placeholder="Size, grade, specifications, delivery location…"></textarea></label>
      <div><button class="btn btn-primary" type="submit">Send Enquiry</button></div>
      <p class="note">${formConfig.endpoint ? "We'll respond within one working day." : formConfig.whatsapp ? "Your enquiry opens in WhatsApp, ready to send." : "Your enquiry opens in your email app, ready to send."}</p>
      <p class="form-status" id="form-status" role="status"></p>
    </form>
  </div>
</div></section>
<script>
(function(){
  var cfg=${JSON.stringify(formConfig).replace(/</g, "\\u003c")};
  var form=document.getElementById('enquiry-form'); if(!form) return;
  try{var q=new URLSearchParams(location.search).get('product'); if(q){form.product.value=q; if(form.product.value!==q){form.product.value='Other'; form.message.value='Product: '+q+'\\n';}}}catch(e){}
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var f=new FormData(form), status=document.getElementById('form-status');
    var text='New enquiry for '+cfg.company+'\\n\\nName: '+f.get('name')+'\\nCompany: '+f.get('company')+'\\nPhone: '+f.get('phone')+'\\nEmail: '+f.get('email')+'\\nProduct: '+f.get('product')+'\\nQuantity: '+f.get('quantity')+'\\n\\n'+f.get('message');
    if(cfg.endpoint){
      status.textContent='Sending…';
      fetch(cfg.endpoint,{method:'POST',body:f,headers:{Accept:'application/json'}})
        .then(function(r){ if(!r.ok) throw new Error(); status.textContent='Thank you! We have received your enquiry.'; form.reset(); })
        .catch(function(){ status.textContent='Could not send. Please call or WhatsApp us instead.'; });
    } else if(cfg.whatsapp){
      window.open('https://wa.me/'+cfg.whatsapp+'?text='+encodeURIComponent(text),'_blank');
    } else if(cfg.email){
      location.href='mailto:'+cfg.email+'?subject='+encodeURIComponent('Enquiry: '+(f.get('product')||'Products'))+'&body='+encodeURIComponent(text);
    }
  });
})();
</script>`;
  }

  function catalogBody(data, ctx) {
    const co = data.company || {};
    const c = data.contact || {};
    const items = (data.products || [])
      .map((p, i) => {
        const specs = (p.specs || []).filter((s) => has(s.label) || has(s.value)).slice(0, 6);
        return `
<div class="catalog-item">
  <img src="${productImg(p, i, data, ctx)}" alt="${esc(p.name)}">
  <div class="body">
    ${has(p.category) ? `<div class="eyebrow">${esc(p.category)}</div>` : ""}
    <h3>${esc(p.name)}</h3>
    <p style="color:var(--muted);font-size:.92rem">${esc(p.description)}</p>
    ${specs.length ? `<table class="specs"><tbody>${specs.map((s) => `<tr><th>${esc(s.label)}</th><td>${esc(s.value)}</td></tr>`).join("")}</tbody></table>` : ""}
  </div>
</div>`;
      })
      .join("");
    const contactLine = [c.phone, c.email, data.domain].filter(has).map(esc).join(" · ");
    return `
<div class="print-bar"><div class="wrap"><span>Product catalog — ${esc(co.name)}</span><button class="btn btn-primary" onclick="window.print()">⬇ Save as PDF / Print</button></div></div>
<div class="wrap">
  <div class="catalog-cover">
    <div class="eyebrow">${esc(co.business_type || presetFor(data).heroKicker)}</div>
    <h1>${esc(co.name)}</h1>
    <p style="font-size:1.1rem;color:var(--muted)">${esc(co.tagline)}</p>
    <p>${contactLine}</p>
    ${has(co.gstin) ? `<p style="font-size:.9rem;color:var(--muted)">GSTIN: ${esc(co.gstin)}${has(co.iec) ? " · IEC: " + esc(co.iec) : ""}</p>` : ""}
  </div>
  <div class="catalog-grid">${items || "<p>No products added yet.</p>"}</div>
</div>`;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  const PAGES = {
    index: { title: "Home", body: homeBody },
    products: { title: "Products", body: productsBody },
    about: { title: "About Us", body: aboutBody },
    contact: { title: "Contact Us", body: contactBody },
    catalog: { title: "Product Catalog", body: catalogBody },
  };

  function describe(data, key) {
    const co = data.company || {};
    const names = (data.products || []).map((p) => p.name).filter(has).slice(0, 4).join(", ");
    const where = [co.city, co.state].filter(has).join(", ");
    const base = `${co.name || "We"}${where ? ", " + where : ""} — ${co.business_type || presetFor(data).heroKicker}`;
    if (key === "products") return `${base}. Products: ${names}.`.slice(0, 300);
    if (key === "contact") return `Contact ${co.name || "us"} for quotations and enquiries.${where ? " Located in " + where + "." : ""}`;
    return `${base}.${names ? " " + names + "." : ""}`.slice(0, 300);
  }

  /**
   * Render one page.
   * @param {object} data   company profile
   * @param {string} key    index | products | about | contact | catalog
   * @param {object} opts   { mode: "preview"|"export", siteMode: "demo"|"live",
   *                          asset: (id) => src, agency: {name, phone, email} }
   */
  function renderPage(data, key, opts) {
    const page = PAGES[key] || PAGES.index;
    const agency = opts.agency || {};
    const banner =
      opts.siteMode === "live"
        ? ""
        : `<div class="demo-banner"><b>Sample website</b> prepared for ${esc((data.company || {}).name || "you")}${
            has(agency.name) ? " by " + esc(agency.name) : ""
          } — not live yet.${has(agency.phone) ? " Call " + esc(agency.phone) + " to make it yours." : ""}</div>`;
    const ctx = Object.assign({}, opts, { banner });
    return layout(data, key, page.title, describe(data, key), page.body(data, ctx), ctx);
  }

  function robotsTxt(data, siteMode) {
    if (siteMode !== "live") return "User-agent: *\nDisallow: /\n";
    const domain = (data.domain || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
    return "User-agent: *\nAllow: /\n" + (domain ? `Sitemap: https://${domain}/sitemap.xml\n` : "");
  }

  function sitemapXml(data) {
    const domain = (data.domain || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!domain) return "";
    const urls = ["", "products.html", "about.html", "contact.html", "catalog.html"]
      .map((p) => `  <url><loc>https://${esc(domain)}/${p}</loc></url>`)
      .join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  }

  window.SiteTemplates = {
    PRESETS,
    PAGE_KEYS: Object.keys(PAGES),
    renderPage,
    siteCss,
    robotsTxt,
    sitemapXml,
    slugify,
    waNumber,
    esc,
  };
})();
