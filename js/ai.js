/* AI auto-fill: turn text copied from a company's public listing into a structured
 * profile using Claude (structured outputs). Runs in the browser with your own API key. */
(function () {
  "use strict";

  const MODEL = "claude-opus-5-5";
  const SDK_URL = "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk/+esm";

  const str = { type: "string" };
  const strList = { type: "array", items: str };
  const labelValue = {
    type: "object",
    properties: { label: str, value: str },
    required: ["label", "value"],
    additionalProperties: false,
  };

  const PROFILE_SCHEMA = {
    type: "object",
    properties: {
      template: { type: "string", enum: ["engineering", "jute", "leather"] },
      company: {
        type: "object",
        properties: {
          name: str,
          tagline: str,
          business_type: str,
          established_year: str,
          city: str,
          state: str,
          gstin: str,
          iec: str,
          about: str,
        },
        required: ["name", "tagline", "business_type", "established_year", "city", "state", "gstin", "iec", "about"],
        additionalProperties: false,
      },
      highlights: { type: "array", items: labelValue },
      why_us: {
        type: "array",
        items: {
          type: "object",
          properties: { title: str, text: str },
          required: ["title", "text"],
          additionalProperties: false,
        },
      },
      products: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: str,
            category: str,
            description: str,
            specs: { type: "array", items: labelValue },
          },
          required: ["name", "category", "description", "specs"],
          additionalProperties: false,
        },
      },
      industries: strList,
      certifications: strList,
      export_markets: strList,
      contact: {
        type: "object",
        properties: {
          person: str,
          phone: str,
          whatsapp: str,
          email: str,
          address: str,
          pincode: str,
          hours: str,
        },
        required: ["person", "phone", "whatsapp", "email", "address", "pincode", "hours"],
        additionalProperties: false,
      },
    },
    required: [
      "template",
      "company",
      "highlights",
      "why_us",
      "products",
      "industries",
      "certifications",
      "export_markets",
      "contact",
    ],
    additionalProperties: false,
  };

  const SYSTEM_PROMPT = `You prepare website content for small and mid-sized Indian manufacturers (mostly in Kolkata and Howrah) from text copied out of their public business listings, such as an IndiaMART company page.

The output becomes a sample website shown to the business owner, so accuracy matters more than polish. Two kinds of fields:

Facts — copy only what the text states: company name, year established, city/state, GSTIN, IEC, certifications, export countries, capacities, product specifications, phone, email, address, contact person, business hours. If a fact is not in the text, use an empty string or empty list. Never guess a number, year, certification, or country, and never complete a partial phone number or email.

Copy — tagline, about, why_us, product descriptions: write clear, professional English aimed at B2B and export buyers, built only on the facts in the text. Avoid unverifiable superlatives ("leading", "best", "largest", "world-class") unless the listing itself claims them. Keep the tagline under 12 words and the about text to two short paragraphs (separate them with a blank line). Write up to 4 why_us points that follow from the listing (e.g. in-house machining, custom sizes); leave the list empty if nothing supports them. Product descriptions: one or two sentences each.

highlights: up to 4 short stat-style facts taken from the text (e.g. label "Year established", value "1994"). Leave empty if there are none.

products: up to 12 distinct products or product lines, merging near-duplicate listings. Put stated attributes (grade, material, size, capacity, finish, MOQ) into specs as label/value pairs.

template: "engineering" for castings, forgings, fabrication, machinery, pumps, valves and metal parts; "jute" for jute and natural-fibre goods; "leather" for leather goods. If none fits, use "engineering".

Phone numbers: keep them as written; if a 10-digit Indian mobile number appears without a country code, write it as +91 followed by the number. whatsapp: only if the text marks a number as WhatsApp.`;

  let sdkPromise = null;
  function loadSdk() {
    if (!sdkPromise) {
      sdkPromise = import(SDK_URL).catch((err) => {
        sdkPromise = null;
        throw new Error("Could not load the Anthropic SDK (check your internet connection): " + err.message);
      });
    }
    return sdkPromise;
  }

  /**
   * Extract a company profile from pasted listing text.
   * @returns {Promise<object>} object matching PROFILE_SCHEMA
   */
  async function extractProfile(listingText, apiKey) {
    if (!String(listingText || "").trim()) throw new Error("Paste the company's listing text first.");
    if (!String(apiKey || "").trim()) throw new Error("Add your Anthropic API key in Settings first.");

    const mod = await loadSdk();
    const Anthropic = mod.default || mod.Anthropic;
    const client = new Anthropic({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true });

    let response;
    try {
      response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: {
          effort: "medium",
          format: { type: "json_schema", schema: PROFILE_SCHEMA },
        },
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Here is the listing text copied from the company's public page:\n\n<listing>\n${listingText}\n</listing>`,
          },
        ],
      });
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) throw new Error("The API key was rejected. Check it in Settings.");
      if (err instanceof Anthropic.PermissionDeniedError) throw new Error("This API key doesn't have access to " + MODEL + ".");
      if (err instanceof Anthropic.RateLimitError) throw new Error("Rate limited by the API — wait a minute and try again.");
      if (err instanceof Anthropic.BadRequestError) throw new Error("The API rejected the request: " + err.message);
      if (err instanceof Anthropic.APIConnectionError) throw new Error("Couldn't reach the Anthropic API. Check your internet connection.");
      if (err instanceof Anthropic.APIError) throw new Error("API error (" + err.status + "): " + err.message);
      throw err;
    }

    if (response.stop_reason === "refusal") {
      const why = response.stop_details && response.stop_details.explanation;
      throw new Error("Claude declined this request" + (why ? ": " + why : "."));
    }
    if (response.stop_reason === "max_tokens") {
      throw new Error("The listing was too long to process in one go — paste a shorter section (e.g. company info + main products).");
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) throw new Error("No content came back from the API.");
    try {
      return JSON.parse(textBlock.text);
    } catch (e) {
      throw new Error("The API response wasn't valid JSON. Try again.");
    }
  }

  window.SiteAI = { extractProfile, MODEL };
})();
