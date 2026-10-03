/* Editor UI: form <-> profile data, live preview, AI auto-fill, export. */
(function () {
  "use strict";

  const T = window.SiteTemplates;
  const esc = T.esc;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const DRAFT_KEY = "sg.draft.v1";
  const SETTINGS_KEY = "sg.settings.v1";
  const PAGE_LABELS = { index: "Home", products: "Products", about: "About", contact: "Contact", catalog: "Catalog" };

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  function blankProfile(template) {
    return {
      template: template || "engineering",
      mode: "demo",
      domain: "",
      brand_color: "",
      company: { name: "", tagline: "", business_type: "Manufacturer & Exporter", established_year: "", city: "Kolkata", state: "West Bengal", gstin: "", iec: "", about: "" },
      highlights: [],
      why_us: [],
      products: [{ name: "", category: "", description: "", specs: [], image: "" }],
      industries: [],
      certifications: [],
      export_markets: [],
      contact: { person: "", phone: "", whatsapp: "", email: "", address: "", pincode: "", hours: "", form_endpoint: "", map_query: "" },
      assets: {},
      logo: "",
      hero: "",
      gallery: [],
    };
  }

  // Fill in any keys missing from older or hand-edited client files.
  function normalize(d) {
    const base = blankProfile(d && d.template);
    const out = Object.assign({}, base, d || {});
    out.company = Object.assign({}, base.company, (d && d.company) || {});
    out.contact = Object.assign({}, base.contact, (d && d.contact) || {});
    ["highlights", "why_us", "products", "industries", "certifications", "export_markets", "gallery"].forEach((k) => {
      if (!Array.isArray(out[k])) out[k] = [];
    });
    out.products = out.products.map((p) => Object.assign({ name: "", category: "", description: "", specs: [], image: "" }, p, { specs: Array.isArray(p.specs) ? p.specs : [] }));
    if (!out.assets || typeof out.assets !== "object") out.assets = {};
    return out;
  }

  const clone = (o) => JSON.parse(JSON.stringify(o));

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }
  function safeRemove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  let data = (() => {
    try {
      const raw = safeGet(DRAFT_KEY);
      return raw ? normalize(JSON.parse(raw)) : normalize(clone(window.SiteSamples.engineering));
    } catch (e) {
      return normalize(clone(window.SiteSamples.engineering));
    }
  })();

  let settings = Object.assign(
    { agencyName: "", agencyPhone: "", agencyEmail: "", demoUrl: "https://{slug}.pages.dev", apiKey: "", rememberKey: false },
    (() => { try { return JSON.parse(safeGet(SETTINGS_KEY) || "{}"); } catch (e) { return {}; } })()
  );
  let sessionApiKey = settings.apiKey || "";
  let currentPage = "index";

  // ---------------------------------------------------------------------------
  // Path helpers for data-path inputs ("company.name", "highlights.0.label")
  // ---------------------------------------------------------------------------
  function getPath(obj, path) {
    return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }
  function setPath(obj, path, value) {
    const keys = path.split(".");
    let o = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (o[keys[i]] == null) o[keys[i]] = /^\d+$/.test(keys[i + 1]) ? [] : {};
      o = o[keys[i]];
    }
    o[keys[keys.length - 1]] = value;
  }

  const listToText = (arr) => (arr || []).join(", ");
  const textToList = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);
  const specsToText = (specs) => (specs || []).map((s) => (s.label ? s.label + ": " : "") + (s.value || "")).join("\n");
  const textToSpecs = (s) =>
    String(s || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const i = line.indexOf(":");
        return i > -1 ? { label: line.slice(0, i).trim(), value: line.slice(i + 1).trim() } : { label: "", value: line };
      });

  // ---------------------------------------------------------------------------
  // Images
  // ---------------------------------------------------------------------------
  const newId = () => "img" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // Shrink photos so sites stay fast on mobile data; keep PNG for logos (transparency).
  function processImage(file, { maxSize, keepPng }) {
    return new Promise((resolve, reject) => {
      if (!/^image\//.test(file.type)) return reject(new Error("Not an image file: " + file.name));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Couldn't read " + file.name));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Couldn't open " + file.name));
        img.onload = () => {
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const g = canvas.getContext("2d");
          const png = keepPng && file.type === "image/png";
          if (!png) { g.fillStyle = "#fff"; g.fillRect(0, 0, canvas.width, canvas.height); }
          g.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(png ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.82));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function addImage(file, opts) {
    const id = newId();
    data.assets[id] = await processImage(file, opts);
    return id;
  }

  // Drop assets no longer referenced anywhere, so client files don't bloat.
  function pruneAssets() {
    const used = new Set([data.logo, data.hero, ...data.gallery, ...data.products.map((p) => p.image)].filter(Boolean));
    Object.keys(data.assets).forEach((id) => { if (!used.has(id)) delete data.assets[id]; });
  }

  const extFor = (dataUrl) => (/^data:image\/png/.test(dataUrl) ? "png" : /^data:image\/webp/.test(dataUrl) ? "webp" : "jpg");

  // ---------------------------------------------------------------------------
  // Editor rendering
  // ---------------------------------------------------------------------------
  function bindSimpleFields() {
    $$("[data-path]", $("#editor")).forEach((el) => {
      if (el.closest("#highlights-list, #whyus-list, #products-list")) return;
      const v = getPath(data, el.dataset.path);
      el.value = v == null ? "" : v;
    });
    $$("[data-list]").forEach((el) => { el.value = listToText(data[el.dataset.list]); });
  }

  function renderHighlights() {
    $("#highlights-list").innerHTML = data.highlights
      .map(
        (h, i) => `<div class="repeat-row">
  <input data-path="highlights.${i}.value" value="${esc(h.value)}" placeholder="Value e.g. 250 MT">
  <input data-path="highlights.${i}.label" value="${esc(h.label)}" placeholder="Label e.g. Monthly capacity">
  <button class="ghost small danger" data-remove="highlights" data-index="${i}" title="Remove">✕</button>
</div>`
      )
      .join("");
  }

  function renderWhyUs() {
    $("#whyus-list").innerHTML = data.why_us
      .map(
        (w, i) => `<div class="repeat-row why">
  <div><input data-path="why_us.${i}.title" value="${esc(w.title)}" placeholder="Title">
  <input data-path="why_us.${i}.text" value="${esc(w.text)}" placeholder="One sentence"></div>
  <button class="ghost small danger" data-remove="why_us" data-index="${i}" title="Remove">✕</button>
</div>`
      )
      .join("");
  }

  function thumbHtml(id, removeAttrs) {
    const src = id && data.assets[id];
    return src ? `<div class="thumb"><img src="${src}" alt=""><button class="small" ${removeAttrs} title="Remove image">✕</button></div>` : "";
  }

  function renderProducts() {
    const n = data.products.length;
    $("#products-list").innerHTML = data.products
      .map(
        (p, i) => `<div class="product-card">
  <div class="head"><b>Product ${i + 1}</b><div class="tools">
    <button class="ghost small" data-move="-1" data-index="${i}" ${i === 0 ? "disabled" : ""} title="Move up">↑</button>
    <button class="ghost small" data-move="1" data-index="${i}" ${i === n - 1 ? "disabled" : ""} title="Move down">↓</button>
    <button class="ghost small danger" data-remove="products" data-index="${i}" title="Delete product">✕</button>
  </div></div>
  <div class="grid2">
    <label>Name<input data-path="products.${i}.name" value="${esc(p.name)}"></label>
    <label>Category<input data-path="products.${i}.category" value="${esc(p.category)}"></label>
  </div>
  <label>Description<textarea data-path="products.${i}.description" rows="2">${esc(p.description)}</textarea></label>
  <label>Specifications <span class="muted">(one per line, “Label: value”)</span><textarea data-specs="${i}" rows="3">${esc(specsToText(p.specs))}</textarea></label>
  <div class="thumb-row">${thumbHtml(p.image, `data-clear-image="product" data-index="${i}"`)}
    <span class="button upload small">${p.image ? "Replace photo" : "+ Add photo"}<input type="file" accept="image/*" data-image="product" data-index="${i}"></span>
  </div>
</div>`
      )
      .join("");
  }

  function renderImageSlots() {
    $("#slot-logo").innerHTML = `<div class="label">Logo</div><div class="thumb-row">${thumbHtml(data.logo, 'data-clear-image="logo"')}
      <span class="button upload small">${data.logo ? "Replace" : "+ Add logo"}<input type="file" accept="image/*" data-image="logo"></span></div>`;
    $("#slot-hero").innerHTML = `<div class="label">Hero photo <span class="muted">(top of home page — factory or best product)</span></div><div class="thumb-row">${thumbHtml(data.hero, 'data-clear-image="hero"')}
      <span class="button upload small">${data.hero ? "Replace" : "+ Add photo"}<input type="file" accept="image/*" data-image="hero"></span></div>`;
    $("#slot-gallery").innerHTML = `<div class="label">Factory / facility photos <span class="muted">(About page)</span></div><div class="thumb-row">${data.gallery
      .map((id, i) => thumbHtml(id, `data-clear-image="gallery" data-index="${i}"`))
      .join("")}<span class="button upload small">+ Add photos<input type="file" accept="image/*" multiple data-image="gallery"></span></div>`;
  }

  function renderEditor() {
    bindSimpleFields();
    renderHighlights();
    renderWhyUs();
    renderProducts();
    renderImageSlots();
  }

  // ---------------------------------------------------------------------------
  // Preview
  // ---------------------------------------------------------------------------
  const agency = () => ({ name: settings.agencyName, phone: settings.agencyPhone, email: settings.agencyEmail });

  function renderTabs() {
    $("#page-tabs").innerHTML = T.PAGE_KEYS.map(
      (k) => `<button role="tab" data-page="${k}" class="${k === currentPage ? "on" : ""}" aria-selected="${k === currentPage}">${PAGE_LABELS[k]}</button>`
    ).join("");
  }

  function pageHtml(key) {
    return T.renderPage(data, key, { mode: "preview", siteMode: data.mode, asset: (id) => data.assets[id], agency: agency() });
  }

  let previewTimer = null;
  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 250);
  }

  function renderPreview() {
    const frame = $("#preview");
    const scrollY = frame.contentWindow ? frame.contentWindow.scrollY : 0;
    frame.onload = () => {
      try {
        const doc = frame.contentDocument;
        if (frame.dataset.page === currentPage) frame.contentWindow.scrollTo(0, scrollY);
        frame.dataset.page = currentPage;
        // Internal links in preview use "#page=<key>" — switch the preview instead of navigating.
        doc.addEventListener("click", (e) => {
          const a = e.target.closest("a");
          if (!a) return;
          const href = a.getAttribute("href") || "";
          if (href.startsWith("#page=")) {
            e.preventDefault();
            showPage(href.slice(6));
          } else if (/^https?:|^mailto:|^tel:/.test(href)) {
            e.preventDefault();
            window.open(href, "_blank", "noopener");
          }
        });
      } catch (e) { /* cross-origin preview: links simply won't switch pages */ }
    };
    frame.srcdoc = pageHtml(currentPage);
    renderChecks();
  }

  function showPage(key) {
    currentPage = T.PAGE_KEYS.includes(key) ? key : "index";
    renderTabs();
    renderPreview();
  }

  // Things to fix before sending a demo or going live.
  function renderChecks() {
    const issues = [];
    const co = data.company, c = data.contact;
    if (!co.name.trim()) issues.push("Add the company name");
    if (/\(sample\)/i.test(co.name)) issues.push("This is a sample company");
    if (!c.phone.trim() && !c.email.trim()) issues.push("No phone or email");
    const named = data.products.filter((p) => p.name.trim());
    if (!named.length) issues.push("No products");
    const noPhoto = named.filter((p) => !p.image).length;
    if (noPhoto) issues.push(`${noPhoto} product${noPhoto > 1 ? "s" : ""} without a photo`);
    if (!co.about.trim()) issues.push("No ‘About’ text");
    if (data.mode === "live" && !data.domain.trim()) issues.push("Live mode: add the domain");
    $("#checks").innerHTML = issues.length
      ? issues.map((x) => `<span class="check-pill">⚠ ${esc(x)}</span>`).join("")
      : `<span class="check-pill ok">✓ Ready — ${data.mode === "live" ? "live mode" : "demo mode (hidden from Google)"}</span>`;
  }

  // ---------------------------------------------------------------------------
  // Autosave
  // ---------------------------------------------------------------------------
  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const ok = safeSet(DRAFT_KEY, JSON.stringify(data));
      $("#autosave-status").textContent = ok
        ? "Draft saved in this browser."
        : "⚠ Draft too large for browser storage (photos). Use “Save client file” to keep your work.";
    }, 600);
  }

  function changed() {
    schedulePreview();
    scheduleSave();
  }

  // ---------------------------------------------------------------------------
  // Editor events
  // ---------------------------------------------------------------------------
  const editor = $("#editor");

  editor.addEventListener("input", (e) => {
    const el = e.target;
    if (el.dataset.path) {
      setPath(data, el.dataset.path, el.value);
    } else if (el.dataset.list) {
      data[el.dataset.list] = textToList(el.value);
    } else if (el.dataset.specs != null) {
      data.products[+el.dataset.specs].specs = textToSpecs(el.value);
    } else {
      return;
    }
    if (el.dataset.path === "template" || el.dataset.path === "mode") renderChecks();
    changed();
  });

  editor.addEventListener("change", async (e) => {
    const el = e.target;
    if (el.type !== "file" || !el.dataset.image || !el.files.length) return;
    const kind = el.dataset.image;
    const files = Array.from(el.files);
    el.value = "";
    try {
      if (kind === "logo") data.logo = await addImage(files[0], { maxSize: 400, keepPng: true });
      else if (kind === "hero") data.hero = await addImage(files[0], { maxSize: 1600 });
      else if (kind === "product") data.products[+el.dataset.index].image = await addImage(files[0], { maxSize: 1200 });
      else if (kind === "gallery") for (const f of files) data.gallery.push(await addImage(f, { maxSize: 1400 }));
    } catch (err) {
      alert(err.message);
    }
    pruneAssets();
    kind === "product" ? renderProducts() : renderImageSlots();
    changed();
  });

  editor.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.add) {
      e.preventDefault();
      const k = btn.dataset.add;
      if (k === "highlights") data.highlights.push({ label: "", value: "" });
      if (k === "why_us") data.why_us.push({ title: "", text: "" });
      if (k === "products") data.products.push({ name: "", category: "", description: "", specs: [], image: "" });
      renderEditor();
      changed();
    } else if (btn.dataset.remove) {
      e.preventDefault();
      const k = btn.dataset.remove;
      const i = +btn.dataset.index;
      if (k === "products" && data.products[i].name && !confirm(`Delete “${data.products[i].name}”?`)) return;
      data[k].splice(i, 1);
      pruneAssets();
      renderEditor();
      changed();
    } else if (btn.dataset.move) {
      e.preventDefault();
      const i = +btn.dataset.index;
      const j = i + +btn.dataset.move;
      [data.products[i], data.products[j]] = [data.products[j], data.products[i]];
      renderProducts();
      changed();
    } else if (btn.dataset.clearImage) {
      e.preventDefault();
      const k = btn.dataset.clearImage;
      if (k === "logo") data.logo = "";
      if (k === "hero") data.hero = "";
      if (k === "product") data.products[+btn.dataset.index].image = "";
      if (k === "gallery") data.gallery.splice(+btn.dataset.index, 1);
      pruneAssets();
      k === "product" ? renderProducts() : renderImageSlots();
      changed();
    }
  });

  // ---------------------------------------------------------------------------
  // AI auto-fill
  // ---------------------------------------------------------------------------
  // Merge AI output into the current profile: keep existing values where the AI found nothing,
  // and keep product photos when the product name still matches.
  function mergeProfile(ai) {
    const keepIfEmpty = (oldObj, newObj) => {
      const out = Object.assign({}, oldObj);
      Object.keys(newObj || {}).forEach((k) => { if (String(newObj[k] || "").trim()) out[k] = newObj[k]; });
      return out;
    };
    data.template = ai.template || data.template;
    data.company = keepIfEmpty(data.company, ai.company);
    data.contact = keepIfEmpty(data.contact, ai.contact);
    if (ai.highlights && ai.highlights.length) data.highlights = ai.highlights;
    if (ai.why_us && ai.why_us.length) data.why_us = ai.why_us;
    ["industries", "certifications", "export_markets"].forEach((k) => { if (ai[k] && ai[k].length) data[k] = ai[k]; });
    if (ai.products && ai.products.length) {
      const photoByName = {};
      data.products.forEach((p) => { if (p.image && p.name) photoByName[p.name.trim().toLowerCase()] = p.image; });
      data.products = ai.products.map((p) => Object.assign({}, p, { image: photoByName[(p.name || "").trim().toLowerCase()] || "" }));
    }
    pruneAssets();
  }

  $("#btn-ai").addEventListener("click", async () => {
    const btn = $("#btn-ai");
    const status = $("#ai-status");
    const text = $("#ai-input").value;
    if (!sessionApiKey) {
      status.className = "status error";
      status.textContent = "Add your Anthropic API key in ⚙ Settings first.";
      openSettings();
      return;
    }
    btn.disabled = true;
    status.className = "status";
    status.textContent = "Reading the listing… (usually 20–60 seconds)";
    try {
      const profile = await window.SiteAI.extractProfile(text, sessionApiKey);
      mergeProfile(profile);
      renderEditor();
      changed();
      status.className = "status ok";
      status.textContent = `✓ Filled ${profile.products.length} products. Check every fact before sending.`;
    } catch (err) {
      status.className = "status error";
      status.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  // ---------------------------------------------------------------------------
  // Preview toolbar
  // ---------------------------------------------------------------------------
  $("#page-tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-page]");
    if (b) showPage(b.dataset.page);
  });

  $$("[data-device]").forEach((b) =>
    b.addEventListener("click", () => {
      $$("[data-device]").forEach((x) => x.classList.toggle("on", x === b));
      $("#frame-wrap").classList.toggle("mobile", b.dataset.device === "mobile");
    })
  );

  $("#btn-newtab").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([pageHtml(currentPage)], { type: "text/html" }));
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------
  function dataUrlToBytes(dataUrl) {
    const b64 = dataUrl.split(",")[1] || "";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  $("#btn-export").addEventListener("click", async () => {
    if (typeof JSZip === "undefined") {
      alert("The zip library didn't load — check your internet connection and reload the page.");
      return;
    }
    if (data.mode === "live" && !data.domain.trim() && !confirm("Live mode without a domain: the sitemap and Google tags will be skipped. Export anyway?")) return;

    const zip = new JSZip();
    const assetPath = (id) => (data.assets[id] ? `${id}.${extFor(data.assets[id])}` : "");
    const opts = { mode: "export", siteMode: data.mode, asset: assetPath, agency: agency() };
    T.PAGE_KEYS.forEach((k) => zip.file(`${k}.html`, T.renderPage(data, k, opts)));
    zip.file("site.css", T.siteCss(data));
    zip.file("robots.txt", T.robotsTxt(data, data.mode));
    if (data.mode === "live") {
      const sitemap = T.sitemapXml(data);
      if (sitemap) zip.file("sitemap.xml", sitemap);
    }
    pruneAssets();
    Object.keys(data.assets).forEach((id) => zip.file(assetPath(id), dataUrlToBytes(data.assets[id])));

    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    download(blob, `${T.slugify(data.company.name)}-${data.mode}-website.zip`);
  });

  // ---------------------------------------------------------------------------
  // Client files, samples, new
  // ---------------------------------------------------------------------------
  function loadProfile(p) {
    data = normalize(clone(p));
    currentPage = "index";
    $("#ai-input").value = "";
    $("#ai-status").textContent = "";
    renderEditor();
    renderTabs();
    renderPreview();
    scheduleSave();
  }

  $("#sample-select").addEventListener("change", (e) => {
    const key = e.target.value;
    e.target.value = "";
    if (!key) return;
    if (!confirm("Replace the current form with the sample? Save a client file first if you need the current one.")) return;
    loadProfile(window.SiteSamples[key]);
  });

  $("#btn-new").addEventListener("click", () => {
    if (!confirm("Start a new client? Save a client file first if you need the current one.")) return;
    loadProfile(blankProfile(data.template));
    $("#ai-input").focus();
  });

  $("#btn-save").addEventListener("click", () => {
    pruneAssets();
    download(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `${T.slugify(data.company.name)}.json`);
  });

  $("#btn-open").addEventListener("click", () => $("#open-file").click());
  $("#open-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    file.text().then((txt) => {
      try {
        const p = JSON.parse(txt);
        if (!p || typeof p !== "object" || !p.company) throw new Error();
        loadProfile(p);
      } catch (err) {
        alert("That file isn't a client file saved from this tool.");
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------
  function openSettings() {
    $("#set-agency-name").value = settings.agencyName;
    $("#set-agency-phone").value = settings.agencyPhone;
    $("#set-agency-email").value = settings.agencyEmail;
    $("#set-demo-url").value = settings.demoUrl;
    $("#set-api-key").value = sessionApiKey;
    $("#set-remember-key").checked = !!settings.rememberKey;
    $("#settings-dialog").showModal();
  }
  $("#btn-settings").addEventListener("click", openSettings);

  $("#settings-dialog").addEventListener("close", () => {
    if ($("#settings-dialog").returnValue !== "save") return;
    sessionApiKey = $("#set-api-key").value.trim();
    settings = {
      agencyName: $("#set-agency-name").value.trim(),
      agencyPhone: $("#set-agency-phone").value.trim(),
      agencyEmail: $("#set-agency-email").value.trim(),
      demoUrl: $("#set-demo-url").value.trim() || "https://{slug}.pages.dev",
      rememberKey: $("#set-remember-key").checked,
      apiKey: $("#set-remember-key").checked ? sessionApiKey : "",
    };
    if (!safeSet(SETTINGS_KEY, JSON.stringify(settings))) alert("Couldn't save settings in this browser.");
    if (!settings.rememberKey) {
      // Make sure no previously remembered key lingers in storage.
      const stored = JSON.parse(safeGet(SETTINGS_KEY) || "{}");
      if (stored.apiKey) { stored.apiKey = ""; safeSet(SETTINGS_KEY, JSON.stringify(stored)); }
    }
    renderPreview();
  });

  // ---------------------------------------------------------------------------
  // Outreach email
  // ---------------------------------------------------------------------------
  function demoUrl() {
    return (settings.demoUrl || "").replace("{slug}", T.slugify(data.company.name.replace(/\(sample\)/i, "")));
  }

  function buildOutreach() {
    const co = data.company;
    const first = (data.products.find((p) => p.name.trim()) || {}).name || "products";
    const place = co.city || "Kolkata";
    const greet = data.contact.person && !/team|desk|sales/i.test(data.contact.person) ? `${data.contact.person} ji` : "Sir/Madam";
    const subject = `A website for ${co.name || "your company"}: take a look`;
    const body = `Namaste ${greet},

I came across ${co.name || "your company"} on IndiaMART. Your ${first.toLowerCase()} range is impressive, but buyers who search on Google can't find a website for your company.

I've built a sample website for you:
${demoUrl()}

It can go live on your own domain within 48 hours, with a product catalog for export buyers and enquiries coming straight to your phone and email. One-time ₹9,999, then ₹9,999 a year for hosting and updates. That's well under the cost of an IndiaMART paid plan.

I'm based in Kolkata and happy to visit your unit in ${place} for 10 minutes to show you.

If you're not interested, just reply "no" and I'll delete the sample.

Regards,
${settings.agencyName || "[Your name]"}
${settings.agencyPhone || "[Your phone]"}${settings.agencyEmail ? "\n" + settings.agencyEmail : ""}`;
    return { subject, body };
  }

  function updateMailto() {
    const to = data.contact.email || "";
    $("#out-mailto").href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent($("#out-subject").value)}&body=${encodeURIComponent($("#out-body").value)}`;
  }

  $("#btn-outreach").addEventListener("click", () => {
    const { subject, body } = buildOutreach();
    $("#out-subject").value = subject;
    $("#out-body").value = body;
    $("#out-status").textContent = data.contact.email ? "To: " + data.contact.email : "No email on file. Copy the message instead.";
    updateMailto();
    $("#outreach-dialog").showModal();
  });
  $("#out-subject").addEventListener("input", updateMailto);
  $("#out-body").addEventListener("input", updateMailto);
  $("#out-copy").addEventListener("click", async () => {
    const text = $("#out-body").value;
    try {
      await navigator.clipboard.writeText(text);
      $("#out-status").textContent = "✓ Copied";
    } catch (e) {
      $("#out-body").select();
      $("#out-status").textContent = "Press ⌘C to copy";
    }
  });

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  renderEditor();
  renderTabs();
  renderPreview();
})();
