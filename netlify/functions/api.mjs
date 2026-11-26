// NarxRadar API — Netlify Function (Node 22). Umumiy baza + zaxira AI yoʻli.
// Asosiy AI yoʻli: netlify/edge-functions/ai.js (/ai/*) — u yerda 10 soniyalik chegara yoʻq.
// Bu fayldagi /api/read, /api/parse, /api/explain zaxira sifatida qoladi (8,8 soniyada javob qaytaradi).
//
// Muhit oʻzgaruvchilari (Netlify → Project configuration → Environment variables):
//   GEMINI_API_KEY        — Google Gemini kaliti (bepul tarif, aistudio.google.com)
//   ANTHROPIC_API_KEY     — Claude kaliti (ixtiyoriy, pullik). Oʻzingiz qoʻysangiz, ustun turadi
//   GEMINI_MODEL          — ixtiyoriy: birinchi sinaladigan model (masalan gemini-3.8-flash)
//   AI_PROVIDER           — ixtiyoriy: "gemini" yoki "claude"
//   DAILY_AI_LIMIT        — kunlik AI soʻrovlari (hammasi), standart 800
//   DAILY_AI_PER_IP       — bitta internet manzildan kunlik AI soʻrovlari, standart 80
//   DAILY_REPORTS_PER_IP  — bitta internet manzildan kunlik xabarlar, standart 60
//   ADMIN_KEY             — faqat sizga: /ai/selftest, ?rebuild=1 va rasmiy narxlarni yuklash uchun parol (kamida 12 belgi)

import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

/* ===== NarxRadar AI yadrosi (Netlify Function va Edge Function uchun umumiy) ===== */
const ENV = name => {
  try { if (globalThis.Netlify && globalThis.Netlify.env) { const v = globalThis.Netlify.env.get(name); if (v != null && v !== "") return String(v); } } catch (e) { }
  try { const v = globalThis.process && globalThis.process.env && globalThis.process.env[name]; if (v) return String(v); } catch (e) { }
  return "";
};
const KEY = ENV("ANTHROPIC_API_KEY");
const MODEL = ENV("CLAUDE_MODEL") || "claude-haiku-5-5";
const GEMINI_KEY = ENV("GEMINI_API_KEY");
const AI_PROVIDER = ENV("AI_PROVIDER").toLowerCase();
const ANTHROPIC_BASE = (ENV("ANTHROPIC_BASE_URL") || "https://api.anthropic.com").replace(/\/+$/, "");
const GEMINI_BASE = (ENV("GOOGLE_GEMINI_BASE_URL") || "https://generativelanguage.googleapis.com").replace(/\/+$/, "");
const CLAUDE_OWN = !!KEY && !ENV("ANTHROPIC_BASE_URL");
const GEMINI_OWN = !!GEMINI_KEY && !ENV("GOOGLE_GEMINI_BASE_URL");
const PROVIDER =
  AI_PROVIDER === "claude" && KEY ? "claude" :
  AI_PROVIDER === "gemini" && GEMINI_KEY ? "gemini" :
  CLAUDE_OWN ? "claude" : GEMINI_OWN ? "gemini" :
  KEY ? "claude" : GEMINI_KEY ? "gemini" : null;
/* Ikkala kalit boʻlsa, ikkinchisi zaxira: biri band yoki ishlamasa, soʻrov ikkinchisiga oʻtadi */
const PROVIDERS = uniq0([PROVIDER, KEY ? "claude" : null, GEMINI_KEY ? "gemini" : null]);
function uniq0(a) { return [...new Set(a.filter(Boolean))]; }
const VIA = PROVIDER === "claude" ? (CLAUDE_OWN ? "direct" : "netlify-gateway") : PROVIDER === "gemini" ? (GEMINI_OWN ? "direct" : "netlify-gateway") : null;
/* Faqat egasi uchun: ADMIN_KEY (kamida 12 belgi) Netlify muhitida. Kalit URL (?key=) yoki x-admin-key sarlavhasi bilan beriladi. */
const ADMIN_KEY = String(ENV("ADMIN_KEY") || "");
const isAdmin = (url, req) => ADMIN_KEY.length >= 12 && (url.searchParams.get("key") === ADMIN_KEY || (req.headers.get("x-admin-key") || "") === ADMIN_KEY);

/* Gemini modellari (2026-noyabr holatiga): 3.8 Flash faqat low/medium/high fikrlashni qabul qiladi,
   3.5 Flash-Lite esa minimal rejimda eng tez ishlaydi. Har bir model uchun mos rejim tanlanadi. */
const uniq = a => [...new Set(a.filter(Boolean))];
const USER_MODEL = ENV("GEMINI_MODEL");
const chain = (list) => uniq([USER_MODEL, ...list]);
const THINK = m => /gemini-3\.8|gemini-3\.1-pro|gemini-4/.test(m) ? "low" : /gemini-3/.test(m) ? "minimal" : null;

const CATALOG = [{"c": 100, "n": "Guruch", "u": "kg", "p": 14999}, {"c": 4001, "n": "Bugʻdoy uni, oliy nav", "u": "kg", "p": 9425}, {"c": 4002, "n": "Bugʻdoy uni, 1-nav", "u": "kg", "p": 6292}, {"c": 114, "n": "Non (1-nav undan)", "u": "kg", "p": 6377}, {"c": 1180, "n": "Mol goʻshti", "u": "kg", "p": 125891}, {"c": 120, "n": "Qoʻy goʻshti", "u": "kg", "p": 137804}, {"c": 1220, "n": "Tovuq goʻshti", "u": "kg", "p": 32492}, {"c": 1250, "n": "Baliq", "u": "kg", "p": 37404}, {"c": 127, "n": "Sut (yangi sogʻilgan)", "u": "l", "p": 8024}, {"c": 135, "n": "Tuxum", "u": "10 dona", "p": 12837}, {"c": 1301, "n": "Paxta yogʻi", "u": "l", "p": 20391}, {"c": 1302, "n": "Kungaboqar yogʻi", "u": "l", "p": 21591}, {"c": 9001, "n": "Sariyogʻ", "u": "kg", "p": 70193}, {"c": 9002, "n": "Limon", "u": "kg", "p": 32810}, {"c": 141, "n": "Olma", "u": "kg", "p": 11340}, {"c": 9003, "n": "Nok", "u": "kg", "p": 18422}, {"c": 9004, "n": "Uzum", "u": "kg", "p": 13545}, {"c": 156, "n": "Karam", "u": "kg", "p": 4366}, {"c": 158, "n": "Bodring", "u": "kg", "p": 12725}, {"c": 159, "n": "Pomidor", "u": "kg", "p": 12421}, {"c": 160, "n": "Baqlajon", "u": "kg", "p": 7255}, {"c": 9005, "n": "Bulgʻor qalampiri", "u": "kg", "p": 11548}, {"c": 164, "n": "Sabzi", "u": "kg", "p": 4582}, {"c": 166, "n": "Sarimsoq", "u": "kg", "p": 16507}, {"c": 167, "n": "Piyoz", "u": "kg", "p": 3353}, {"c": 170, "n": "Kartoshka", "u": "kg", "p": 5105}, {"c": 9006, "n": "Loviya", "u": "kg", "p": 19171}, {"c": 9007, "n": "Noʻxat", "u": "kg", "p": 21258}, {"c": 9008, "n": "Mosh", "u": "kg", "p": 19108}, {"c": 174, "n": "Shakar", "u": "kg", "p": 12327}, {"c": 9201, "n": "Guruch, lazer", "u": "kg", "p": 21248}, {"c": 9202, "n": "Qiyma (farsh)", "u": "kg", "p": 119990}, {"c": 9203, "n": "Sarpanja, mol goʻshti", "u": "kg", "p": 139990}, {"c": 9204, "n": "Qoʻy goʻshti, son qismi", "u": "kg", "p": 174990}, {"c": 9205, "n": "Tovuq boldiri", "u": "kg", "p": 44945}, {"c": 9206, "n": "Muzlatilgan goʻsht (import)", "u": "kg", "p": 94950}, {"c": 9207, "n": "Banan", "u": "kg", "p": 19745}, {"c": 9101, "n": "Qatiq", "u": "l", "p": null, "lo": 4000, "hi": 40000}, {"c": 9102, "n": "Kefir", "u": "l", "p": null, "lo": 5000, "hi": 45000}, {"c": 9103, "n": "Smetana", "u": "kg", "p": null, "lo": 12000, "hi": 120000}, {"c": 9104, "n": "Tvorog (suzma)", "u": "kg", "p": null, "lo": 15000, "hi": 150000}, {"c": 9105, "n": "Pishloq", "u": "kg", "p": null, "lo": 35000, "hi": 350000}, {"c": 9106, "n": "Qaymoq", "u": "kg", "p": null, "lo": 20000, "hi": 200000}, {"c": 9111, "n": "Kolbasa", "u": "kg", "p": null, "lo": 25000, "hi": 300000}, {"c": 9112, "n": "Sosiska", "u": "kg", "p": null, "lo": 20000, "hi": 220000}, {"c": 9113, "n": "Jigar", "u": "kg", "p": null, "lo": 25000, "hi": 250000}, {"c": 9121, "n": "Makaron", "u": "kg", "p": null, "lo": 5000, "hi": 50000}, {"c": 9122, "n": "Grechka", "u": "kg", "p": null, "lo": 6000, "hi": 60000}, {"c": 9123, "n": "Suli yormasi", "u": "kg", "p": null, "lo": 6000, "hi": 60000}, {"c": 9124, "n": "Obi non", "u": "dona", "p": null, "lo": 1500, "hi": 15000}, {"c": 9125, "n": "Patir non", "u": "dona", "p": null, "lo": 3000, "hi": 30000}, {"c": 9126, "n": "Tuz", "u": "kg", "p": null, "lo": 800, "hi": 15000}, {"c": 9131, "n": "Qora choy", "u": "kg", "p": null, "lo": 30000, "hi": 600000}, {"c": 9132, "n": "Koʻk choy", "u": "kg", "p": null, "lo": 25000, "hi": 500000}, {"c": 9133, "n": "Qahva", "u": "kg", "p": null, "lo": 100000, "hi": 2000000}, {"c": 9134, "n": "Mineral suv", "u": "l", "p": null, "lo": 800, "hi": 12000}, {"c": 9135, "n": "Gazli ichimlik", "u": "l", "p": null, "lo": 2500, "hi": 25000}, {"c": 9136, "n": "Sharbat", "u": "l", "p": null, "lo": 5000, "hi": 50000}, {"c": 9141, "n": "Asal", "u": "kg", "p": null, "lo": 25000, "hi": 350000}, {"c": 9142, "n": "Shokolad", "u": "kg", "p": null, "lo": 40000, "hi": 600000}, {"c": 9143, "n": "Pechenye", "u": "kg", "p": null, "lo": 12000, "hi": 150000}, {"c": 9144, "n": "Mayonez", "u": "kg", "p": null, "lo": 10000, "hi": 100000}, {"c": 9145, "n": "Tomat pastasi", "u": "kg", "p": null, "lo": 10000, "hi": 100000}, {"c": 9151, "n": "Mandarin", "u": "kg", "p": null, "lo": 5000, "hi": 60000}, {"c": 9152, "n": "Apelsin", "u": "kg", "p": null, "lo": 6000, "hi": 60000}, {"c": 9153, "n": "Anor", "u": "kg", "p": null, "lo": 6000, "hi": 70000}, {"c": 9154, "n": "Xurmo", "u": "kg", "p": null, "lo": 4000, "hi": 50000}, {"c": 9155, "n": "Kivi", "u": "kg", "p": null, "lo": 8000, "hi": 80000}, {"c": 9161, "n": "Lavlagi", "u": "kg", "p": null, "lo": 1000, "hi": 15000}, {"c": 9162, "n": "Turp", "u": "kg", "p": null, "lo": 1000, "hi": 15000}, {"c": 9163, "n": "Qovoq", "u": "kg", "p": null, "lo": 1000, "hi": 15000}, {"c": 9164, "n": "Koʻkat (bogʻ)", "u": "dona", "p": null, "lo": 500, "hi": 15000}, {"c": 9165, "n": "Gulkaram", "u": "kg", "p": null, "lo": 3000, "hi": 35000}, {"c": 9166, "n": "Qoʻziqorin", "u": "kg", "p": null, "lo": 10000, "hi": 120000}, {"c": 9171, "n": "Kir yuvish kukuni", "u": "kg", "p": null, "lo": 8000, "hi": 120000}, {"c": 9172, "n": "Idish yuvish vositasi", "u": "l", "p": null, "lo": 7000, "hi": 90000}, {"c": 9173, "n": "Sovun", "u": "dona", "p": null, "lo": 1500, "hi": 30000}, {"c": 9174, "n": "Shampun", "u": "l", "p": null, "lo": 20000, "hi": 350000}, {"c": 9175, "n": "Tish pastasi", "u": "dona", "p": null, "lo": 4000, "hi": 70000}, {"c": 9176, "n": "Hojatxona qogʻozi", "u": "dona", "p": null, "lo": 800, "hi": 15000}, {"c": 9177, "n": "Bolalar tagligi", "u": "dona", "p": null, "lo": 700, "hi": 8000}, {"c": 9181, "n": "Benzin AI-80", "u": "l", "p": null, "lo": 4000, "hi": 20000}, {"c": 9182, "n": "Benzin AI-92", "u": "l", "p": null, "lo": 5000, "hi": 25000}, {"c": 9183, "n": "Benzin AI-95", "u": "l", "p": null, "lo": 5000, "hi": 28000}, {"c": 9184, "n": "Dizel yoqilgʻisi", "u": "l", "p": null, "lo": 5000, "hi": 28000}, {"c": 9185, "n": "Metan", "u": "m³", "p": null, "lo": 2000, "hi": 12000}, {"c": 9186, "n": "Propan", "u": "l", "p": null, "lo": 2500, "hi": 15000}];
const BY_CODE = new Map(CATALOG.map(p => [p.c, p]));
const UNIT = u => u === "l" ? "l" : u;
const catalogText = () => CATALOG.map(p => `${p.c}=${p.n} (${UNIT(p.u)})`).join("; ");

const READ_PROMPT = () => `You read price tags photographed by shoppers in Uzbekistan (bazaars, supermarkets, small shops, fuel stations). Tags may be handwritten, in Uzbek (Latin or Cyrillic) or Russian.
Reply with JSON only, no other text:
{"is_price_tag": boolean, "items": [{"product_text": string, "product_code": number|null, "price_uzs": number, "pack_qty": number|null, "pack_unit": "kg"|"l"|"dona"|null, "old_price_uzs": number|null}], "store_name": string|null, "place_type": "bozor"|"supermarket"|"dokon"|"zapravka"|null, "photo_issue": null|"screen"|"blurry"|"edited"|"not_a_tag", "confidence": "high"|"medium"|"low"}
Rules: product_text = the product name exactly as written. price_uzs = the current selling price in soum as a plain number ("145 000" or "145 ming" -> 145000). old_price_uzs = a crossed-out or "old" price if the tag shows one, else null. pack_qty = the quantity the price is for, in kg, litres or pieces (900 g -> 0.9 with "kg"; 400 ml -> 0.4 with "l"; 30 eggs -> 30 with "dona"; a pack of 50 diapers -> 50 with "dona"); null when the price is per 1 kg, 1 litre or 1 piece. product_code = the matching code from this catalog, or null: ${catalogText()}. store_name = a shop or chain name visible on the tag or in the photo (e.g. Korzinka, Makro, Havas), else null. photo_issue = "screen" if this is a photo of a screen, "edited" if numbers look digitally altered. At most 4 items. If there is no readable price tag, return {"is_price_tag": false, "items": []}.`;

const PARSE_PROMPT = text => `A shopper in Uzbekistan typed a price report. Extract it. Reply with JSON only: {"product_text": string, "product_code": number|null, "price_uzs": number|null, "pack_qty": number|null, "pack_unit": "kg"|"l"|"dona"|null, "old_price_uzs": number|null, "place": string|null}. price_uzs in soum as a number ("130 ming" -> 130000). product_code from this catalog or null: ${catalogText()}. Text: """${text}"""`;

const EXPLAIN_PROMPT = (kind, ctx) => kind === "index"
  ? `Siz NarxRadar ilovasining iqtisodiy tahlilchisisiz. Oddiy aholi uchun oʻzbek tilida (lotin yozuvi) 3–4 qisqa gapdan iborat haftalik sharh yozing: savat narxi qanday oʻzgardi, nimalar qimmatladi, xaridorga bitta amaliy maslahat. Faqat shu maʼlumotlardagi raqamlarni ishlating, yangi raqam toʻqimang. Faqat sharh matnini yozing. Maʼlumot: ${ctx}`
  : `Siz NarxRadar ilovasining tahlilchisisiz. Oddiy xaridorga oʻzbek tilida (lotin yozuvi), 2–3 qisqa gapda tushuntiring: bu narx (va chegirma boʻlsa, chegirma) adolatlimi va nima qilish kerak. Faqat shu maʼlumotdagi raqamlarni ishlating, yangi raqam toʻqimang. Faqat izoh matnini yozing. Maʼlumot: ${ctx}`;

function parseJSON(s) {
  const m = String(s || "").replace(/```json|```/g, "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (e) { return null; }
}
const err = (msg, status) => Object.assign(new Error(msg), { status });

/* vaqt chegarasi bilan fetch: deadline — millisekund (Date.now() asosida) */
async function tfetch(url, opts, deadline) {
  const left = deadline - Date.now();
  if (left < 600) throw err("timeout", 504);
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), left);
  try { return await fetch(url, { ...opts, signal: ctl.signal }); }
  catch (e) { if (ctl.signal.aborted) throw err("timeout", 504); throw err("network: " + String(e && e.message || e).slice(0, 120), 502); }
  finally { clearTimeout(t); }
}

async function claude(content, maxTokens, deadline, trace) {
  let last = err("claude", 500);
  /* 529 (band) yoki 500: qisqa kutib yana bir marta */
  for (let attempt = 0; attempt < 2; attempt++) {
    let r;
    try {
      r = await tfetch(`${ANTHROPIC_BASE}/v1/messages`, {
        method: "POST", headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: [{ role: "user", content }] })
      }, deadline);
    } catch (e) { last = e; if (trace) trace.push(`${MODEL}: ${e.message}`); break; }
    if (r.ok) {
      const j = await r.json();
      const txt = (j.content || []).filter(b => b.type === "text").map(b => b.text).join("");
      if (trace) trace.push(`${MODEL}: ok`);
      if (txt) return txt;
      last = err(`claude ${MODEL}: boʻsh javob`, 502); break;
    }
    const t = await r.text().catch(() => "");
    last = err(`claude ${r.status}: ${t.slice(0, 180)}`, r.status === 529 ? 503 : r.status);
    if (trace) trace.push(`${MODEL}: ${r.status}`);
    if ((r.status === 529 || r.status === 500 || r.status === 503) && attempt === 0 && deadline - Date.now() > 6000) { await sleep(900); continue; }
    break;
  }
  throw last;
}

async function geminiOnce(model, parts, maxTokens, json, think, deadline) {
  const gen = { temperature: 0.1, maxOutputTokens: Math.max(1024, maxTokens * 3) };
  if (json) gen.responseMimeType = "application/json";
  if (think) gen.thinkingConfig = { thinkingLevel: think };
  return tfetch(`${GEMINI_BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST", headers: { "x-goog-api-key": GEMINI_KEY, "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: gen })
  }, deadline);
}
const RETRY_NEXT = new Set([403, 404, 408, 429, 500, 502, 503, 504]);
/* Google "high demand" (503) yoki ichki xato (500): shu modelni qisqa kutib yana bir marta sinash */
const RETRY_SAME = new Set([500, 503]);
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function gemini(content, maxTokens, json, models, deadline, trace) {
  const parts = content.map(c => c.type === "image" ? { inline_data: { mime_type: c.source.media_type, data: c.source.data } } : { text: c.text });
  let last = err("no model", 500);
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    let think = THINK(model);
    /* Oxirgisidan boshqa modelga koʻpi bilan 10 s: band yoki sekin boʻlsa, keyingisiga oʻtiladi */
    const cap = i < models.length - 1 ? Math.min(deadline, Date.now() + 10000) : deadline;
    for (let attempt = 0; attempt < 3; attempt++) {
      let r;
      try { r = await geminiOnce(model, parts, maxTokens, json, think, cap); }
      catch (e) { last = e; if (trace) trace.push(`${model}: ${e.message}`); break; }
      if (r.ok) {
        const j = await r.json();
        const out = (((j.candidates || [])[0] || {}).content || {}).parts || [];
        const txt = out.filter(p => p.text && !p.thought).map(p => p.text).join("");
        if (trace) trace.push(`${model}: ok`);
        if (txt) return { text: txt, model };
        last = err(`gemini ${model}: boʻsh javob`, 502); break;
      }
      const t = await r.text().catch(() => "");
      last = err(`gemini ${model} ${r.status}: ${t.slice(0, 180)}`, r.status);
      if (trace) trace.push(`${model}: ${r.status}`);
      if (r.status === 400 && think) { think = null; continue; } /* fikrlash sozlamasini bilmasa, usiz qayta */
      if (RETRY_SAME.has(r.status) && attempt < 2 && cap - Date.now() > 5000) { await sleep(700 + attempt * 900); continue; }
      break;
    }
    if (last.status === 504 && deadline - Date.now() < 1500) break;
    if (!RETRY_NEXT.has(last.status) && last.status !== 400) break;
  }
  throw last;
}
/* Rasm ham, matn ham avval eng tez model bilan oʻqiladi (odatda 2–4 s). Kuchliroq 3.8 Flash
   faqat zaxira: tez model yorliqni topa olmasa yoki band boʻlsa ishlatiladi. */
async function aiCall(content, { maxTokens = 700, json = false, image = false, deadline, edge = false, trace, models: only, provider } = {}) {
  const list = provider ? PROVIDERS.filter(x => x === provider) : only ? ["gemini"] : PROVIDERS;
  if (!list.length) throw err("no_ai", 503);
  let last = err("no_ai", 503);
  for (let i = 0; i < list.length; i++) {
    const pv = list[i], more = i < list.length - 1;
    /* Zaxira provayderga vaqt qolishi uchun birinchisiga chegara: Claude 20 s, Gemini zanjiri 30 s */
    const dl = more ? Math.min(deadline, Date.now() + (pv === "claude" ? 20000 : 30000)) : deadline;
    if (dl - Date.now() < 2500) break;
    try {
      if (pv === "claude") return { text: await claude(content, maxTokens, dl, trace), model: MODEL, provider: "claude" };
      const models = only || chain(["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.6-flash", "gemini-3.8-flash"]);
      const r = await gemini(content, maxTokens, json, models, dl, trace);
      return { ...r, provider: "gemini" };
    } catch (e) {
      last = e;
      if (trace && more) trace.push(`${pv} → zaxira`);
      /* 400 (soʻrovning oʻzi notoʻgʻri) boshqa provayderda ham takrorlanishi mumkin, lekin baribir sinab koʻramiz */
    }
  }
  throw last;
}

const str = (v, n) => (typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, "").slice(0, n) : null);
const MIME_OK = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/* Bitta AI vazifasi: route = read | parse | explain | selftest */
async function runTask(route, body, opts) {
  const t0 = Date.now();
  if (route === "read") {
    const { image, mime } = body || {};
    if (typeof image !== "string" || image.length < 100 || image.length > 6_000_000) return { error: "invalid" };
    const mt = MIME_OK.includes(mime) ? mime : "image/jpeg";
    const content = [{ type: "image", source: { type: "base64", media_type: mt, data: image } }, { type: "text", text: READ_PROMPT() }];
    const trace = [];
    let r;
    try { r = await aiCall(content, { ...opts, maxTokens: 800, json: true, image: true, trace }); }
    catch (e) { e.trace = trace; console.log(JSON.stringify({ ai: "read", ok: false, ms: Date.now() - t0, trace })); throw e; }
    if (Date.now() - t0 > 6000 || trace.length > 1) console.log(JSON.stringify({ ai: "read", ok: true, ms: Date.now() - t0, trace }));
    let j = parseJSON(r.text) || { is_price_tag: false, items: [] }, model = r.model;
    const found = x => x && x.is_price_tag && Array.isArray(x.items) && x.items.length && x.items[0].price_uzs;
    /* Tez model narxni topa olmasa, vaqt yetsa kuchliroq model bilan bir marta qayta oʻqiladi */
    if (!found(j) && GEMINI_KEY && model !== "gemini-3.8-flash" && opts.deadline - Date.now() > 20000) {
      try { const r2 = await aiCall(content, { ...opts, maxTokens: 800, json: true, image: true, models: ["gemini-3.8-flash"] }); const j2 = parseJSON(r2.text); if (found(j2)) { j = j2; model = r2.model; } } catch (e) { }
    }
    j._m = model; j._ms = Date.now() - t0;
    return j;
  }
  if (route === "parse") {
    const text = str(body && body.text, 300);
    if (!text) return { error: "invalid" };
    const r = await aiCall([{ type: "text", text: PARSE_PROMPT(text) }], { ...opts, maxTokens: 300, json: true });
    return parseJSON(r.text) || {};
  }
  if (route === "explain") {
    const kind = body && body.kind === "index" ? "index" : "price";
    const ctx = JSON.stringify((body && body.ctx) || {}).slice(0, 3000);
    const lang = body && ["ru", "en"].includes(body.lang) ? body.lang : "uz";
    const note = { uz: "", ru: "\n\nВажно: весь ответ напиши на русском языке.", en: "\n\nImportant: write the whole answer in English." }[lang];
    const r = await aiCall([{ type: "text", text: EXPLAIN_PROMPT(kind, ctx) + note }], { ...opts, maxTokens: 500 });
    return { text: r.text.trim().slice(0, 1500) };
  }
  if (route === "selftest") {
    const trace = [];
    const content = body && body.img ? [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: TEST_IMG } }, { type: "text", text: READ_PROMPT() }] : [{ type: "text", text: 'Reply with JSON only: {"ok": true}' }];
    try {
      const r = await aiCall(content, { ...opts, maxTokens: body && body.img ? 800 : 50, json: true, image: !!(body && body.img), trace, provider: body && body.p || undefined });
      return { ok: true, provider: r.provider || PROVIDER, providers: PROVIDERS, via: VIA, model: r.model, ms: Date.now() - t0, trace, result: body && body.img ? parseJSON(r.text) : r.text.slice(0, 80) };
    } catch (e) { return { ok: false, provider: PROVIDER, providers: PROVIDERS, ms: Date.now() - t0, trace, error: String(e.message).slice(0, 300) }; }
  }
  return { error: "not_found" };
}
const errOut = e => ({ error: e && e.status === 429 ? "rate_limited" : e && e.status === 504 ? "timeout" : e && (e.status === 503 || e.status === 500) ? "busy" : e && e.message === "no_ai" ? "no_ai" : "server", message: String((e && e.message) || e).slice(0, 240), ...(e && Array.isArray(e.trace) && e.trace.length ? { trace: e.trace.map(x => String(x).slice(0, 80)).slice(0, 12) } : {}) });

/* Oqim: darhol boʻsh joy, keyin har 2 soniyada boʻsh joy, oxirida JSON. Telefon JSON.parse boʻsh joylarni eʼtiborsiz qoldiradi. */
function streamJSON(work, CORS) {
  const enc = new TextEncoder();
  const body = new ReadableStream({
    async start(ctrl) {
      ctrl.enqueue(enc.encode(" "));
      const hb = setInterval(() => { try { ctrl.enqueue(enc.encode(" ")); } catch (e) { } }, 2000);
      let out;
      try { out = await work(); } catch (e) { out = errOut(e); }
      clearInterval(hb);
      try { ctrl.enqueue(enc.encode(JSON.stringify(out))); ctrl.close(); } catch (e) { }
    }
  });
  return new Response(body, { status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...CORS } });
}
/* ===== yadro tugadi ===== */


const TEST_IMG = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAEsAeADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD0aiiivNOoKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiuC+Kn/Hhp/8A11f+QrWhS9rUUL2uTOXLG53tFfPFe2eENX/tnw7bzu26aMeVN67h3/EYP411YrBOhFSvczp1ed2sbdFc/wCNdY/sfw5O6Nief9zF6gnqfwGf0rxinhcC68XK9gqVuR2sfQ9FcP8ACz/kD3v/AF8D/wBBFdH4j16Dw9pTXko3yE7Yo8/fb/D1rmqUHGs6UdWXGaceZmm7pGheRlRR1ZjgCqR13Rw+w6tZBvT7Qmf5141f6rq3iS/UTyyXEkjYjhT7oJ7KtbSfDXX2t/NP2VWxnyjKd36DH613PAU6aXtZ2Zl7aUvhR6vFNFOgkhkSRD0ZGBBp9eFR3Gr+GdTZEeWzuYj86Z4P1HQivV/CfiWPxHpxdlEd1DhZox09mHsawxOClRjzp3iXCqpOz3N6iuT+JP8AyKh/67p/WvPvB3/I26d/11/oaKOD9rRdXmta/TsEqvLLlse20UUVwmoUUUUAFISFBJIAHUms7XtbttA0t724+Y52xxg8u3YV5Bq/iHVfEFx/pM7srN8lvHkIPQAdz+tdmGwc6+uyMqlVQ0PY31zSIm2yarZI3o1wgP8AOpre+s7v/j2u4Jv+ucgb+VeU2Xw61+7hEjpBbbhkLPIQ35AHH4027+H/AIish5kcEc+3nMEmSPwOD+VdDwmHvZVdSPaz35T2Ciuc8CSXr+HQt+05njmdCJ87lAxxzzT/ABd4nTw5YKY1WS7nyIUPQerH2H61w+xk6vso6s251y8zN2WaKCMyTSpGg6s7AD8zVMa7o7PsXVrIt6C4TP8AOvGWk1fxNqaozzXl1IflUngfTso/StqT4ba/HbmUfZZGxnyllO79Rj9a73gKVOyqVLMx9tJ/DE9ZR1kUOjBlPQg5Bp1eGabrOq+HL1hbyyQvG2JIHztJHUMv+TXsHh/XIPEGlJewja2dskeclGHUVz4nByoLmvdF06qnp1NOq9zf2Vnj7VdwQZ6ebIF/nXOePfEc2h6dFBZtsurokB+6KOpHvyB+decaRoeqeJruX7KPNZcNLNK/Az0yepNVh8F7Sn7ScrRFOrZ8qV2eyR61pUxxFqdnIfRZ1P8AWrqsGAZSCD0Iryef4aa/Em5GtJj/AHY5SD/48AK1fh7p+o6Xr13bX1vNB/o+Qrg7Sdw5HY/hTqYWioOVOpe3QI1JXs0eiUVV1T/kE3n/AFwf/wBBNeBVOFwf1hN81reQ6lXk6H0PRVew/wCQfbf9cl/kKwfiF/yJ9z/vx/8AoQrlp0+eood3Y0btG501FeG+F/8AkaNM/wCvlP5123j3w1q+tarbz6daedGkGxj5iLg7ie5HrXZUwUadVQlOyfX+mZRquUbpHeUV4rc+CvENnay3Nxp+yKFC7t50ZwByTgNWGASQB1Nbwy2E9Y1L/L/gkOu1vE+hqK8a/wCEB8T/APQM/wDI8f8A8VXc+ANE1HRLG7i1G38h5JQyjerZGPYmuathadOHNGom+39M0jUlJ2cbHWUV8/3v/H/cf9dW/ma9n8I/8ippv/XAUYnB+wgpc17+QU6vO7WNmiiiuE1CiiigAooooAKKKKACiiigAooooAKKKKACiiigArgvip/x4af/ANdX/kK72uC+Kn/Hhp//AF1f+QrrwP8AvEf66Gdb4GcToeknVxqEcYJlgtGnjA7lWXI/Imt74bav9i1p9PkbEV4vy57OOR+YyPypfhf/AMjHc/8AXm3/AKGlZXifTpPDnimT7PmNQ4uLdh2BORj6EEfhXtVGqs50JdVdHJH3Upov/EXWP7Q177HG2YbIbOO7n739B+FY+u6SdGks7eQETSWqyyg9mYtx+AwPwq54Q0x9e8URGfMkcbG4nY/xYOefqSP1q98Tf+Rnj/69U/8AQmp05KnUhQj0WoSXNFzZ0Hws/wCQPe/9fA/9BFYnxPvWm12C0z+7t4Q2P9pjz+gFbfws/wCQPe/9fA/9BFc58SYmj8VFyOJIEYfqP6VyUknj5XNJfwUXvhdp8c2pXd+6gtboqJnsWzk/kMfjXpteefCqZcalCT837tgPUfMD/T869DrhzBt4iV/L8jaj8CPP/inp8ZtrLUlUCQOYWPqCCR+WD+dc/wDDy9a18VwxA4S5Ro2H4bh+oFdV8UZlXQbWEn5nuQwHsFbP8xXG+B4ml8YWAUfdZmPsApr0cP72BfN2ZhPSqrHefEn/AJFQ/wDXdP61594O/wCRt07/AK6/0Neg/En/AJFQ/wDXdP61594O/wCRt07/AK6/0NLB/wC6S+f5Dq/xUe20UUV4R1hRRRQB5d8T755dbt7IH93BDux/tMef0Ao+GWlxXeq3F/Kob7IgEYPZmzz+AB/OqvxJhaPxUXI4lgRh+o/pWv8ACqdAdStyfnPluB6j5gf5j869+Xu4D3ey/PU41rW1PRKKw/GOnXeq+GrizsovNndkKpuC5wwJ5JAryLVdG1DRZkh1G38mSRdyjerZGcdia87DYSNdfHZ9v6ZvUqOD2Pea8c8fXrXniy5UnKW4WJB6ADJ/Umui+FP+q1T/AHov/Zq5TxlE0Pi7UVYcmXd+BAI/nXZg6KpYqUL3sv8AIyqy5qaZ2Hwt0+NbC71EqDI8nkqfRQAT+ZI/Ku8rjfhhMr+HJ4gfmjuWyPYquP612VefjW3Xlc2pfAjy74n6fHb6vbXqKFN1GQ+O7Ljn8iB+FO+F160er3dkT8k0PmY/2lIH8mNWfitMpm0yAH5lWRyPY7QP5Gs74ZRM/iaRwPljtmJP1KivUj72A97t+uhzvStoaPxUtpfN0+6AJi2tGT2B4I/Pn8qwfCPi0+GpJkktvPgnwWCthlIzyPXr0r1vUNPtdUs3tLyESwv1U/zB7GuD1H4WvvZtM1Bdp6R3C4x/wIf4VhhsTRlR9jWLqU5qXNE3bL4h+H7shZJ5bVj2mj4/MZFdHBcQXUKzW8yTRt9142DA/iK8U1jwtq+hp5l7bfuc482Ngy5/p+NXfA2tXGmeIbe3WQ/Z7uQRSR54JPAP1BxTq4CnKm50ZBGtJO0kes6p/wAgm8/64P8A+gmvAq991T/kE3n/AFwf/wBBNeBVplXwy+ROI3R6/aeOvDUVnBG+pYZI1BHkScED/drJ8ZeLND1Xw3PZ2V95s7shVfKdc4YE8kAVWg+Fvn28cv8AbO3zEDY+y5xkZ/v1n+IfAH9g6PLqH9p+f5bKPL8jbnJx13GopU8GqqcZu9/66DlKryu60MTwv/yNGmf9fKfzr3KvDfC//I0aZ/18p/OvcqjNP4kfQrD/AAszPEv/ACLGp/8AXrJ/6Ca8Nj/1i/UV7l4l/wCRY1P/AK9ZP/QTXhsf+sX6it8r/hy9SMR8SPoWiiivCOs+f73/AI/7j/rq38zXs/hH/kVNN/64CvGL3/j/ALj/AK6t/M17P4R/5FTTf+uAr3cz/gx9f0OSh8TNmiiivCOsKKKKACiiigAooooAKKKKACiiigAooooAKKKKACuC+Kn/AB4af/11f+QrvayPEHhuz8RwwxXks8YhYsvksATn1yDXRhqkadaM5bIipFyi0jgvhd/yMlz/ANebf+hpXZ+KvCcXiZLc/afs0sBOJPL35U9sZHcD9aXQfBuneHb17uzmuXd4zGRKykYJB7KPQV0FbYjE3r+1pMmFO0OWRgeFfCsXhmCdRcfaZZ2BaTy9mFHQYyfU1w3xN/5GeP8A69U/9CavWK57XfBem+IL8Xl3PdJIIxHiJ1AwCT3U+tGGxPLX9rVYVKd4csTI+Fn/ACB73/r4H/oIqx8Q/D0uq6dHfWkZe4tM7kUcuh649x1/OtvQPDtp4ctpbezkmkWV95MzAnOMdgK1ameItiXVgNQ9zlZ4Z4d1ybw9qyXsa71xsljzjep6j+v4V6WnxE8ONb+Y1zKj4z5Rhbd+nH60/WfAmjavK04R7SduWeHADH1Knj8sVhH4UpuyNZbb6fZufz3V2VKuDxFpVG0/69TKMasNFqcv4r8SP4k1JZQhitoQVhjJ59yfc8fkK6z4beHpbZJNZukKGZNkCsOdvUt+OBj8fWtPSfh5o2nSrNP5l7IvI87GwH/dHX8c11QAAwOBWeIxkPZexorQcKT5uaRynxJ/5FQ/9d0/rXmugahFpWuWl9OrtHA+5ggBYjHbJFey63ottr2n/Yrp5Uj3h8xEA5H1Brnf+FX6J/z9X/8A38T/AOIqsJiqNOi6c+twqU5SldB/wtDRP+fW/wD+/af/ABdW9L8f6Tq2pQ2Fvb3iyzEhTIihRxnnDH0qp/wq/RP+fq//AO/if/EVb0vwBpOk6lDf29xeNLCSVEjqVPGOcKPWsp/UuV8t7jXtb6nUUUUV5xucl4/8OS6zpqXdohe6tMnYOroeoHuOo/GvNdE1i50HVI723GWTKujdHU9Qa93rnta8E6NrUjTyRNb3DcmWAgFj7jof516WFxkYQ9lVV4mFSk2+aO5Ws/iN4fuIQ08stq+OUeJm5+qg1xPjvXLHXdUgmsHaSOKHYWZSuTknjNb7/CmMtlNYYL6G3yfz3VZtfhdpsbA3V9cT47IAgP8AOt6U8FRn7SEnf+vIiSqyVmit8Kf9Vqn+9F/7NR8SfD0spTWrWMuEXZcBRyAOjf0P4V2el6Lp+iwNDp9ssKtjcQSS2PUnk1dIDAggEHgg1ySxdsS60DVU/c5WeMeEvEz+G9Qd3RpbWcATIvXjow9xz+degSfETw6luZFuJZHxnylhYN9Mnj9aj1X4daNqErTW5kspG5IiwU/75PT8MVkj4UpuydZYr6C2wfz3V1VKmCrvnm2n/XqZxjVgrI43X9am1/VpL6VdgOFjjBzsUdB/X6mvR/h/4el0fS3urpClzd4Ow9UQdAfc5J/KrWi+BtH0aVZwj3VwvKyTkHafYdK6OssVjIzh7KkvdKp0mnzS3OT8YeKrvw1f2JhijmhmV/MjbgnBGMHt196bZfEnQrhAbnz7R+4eMsPwK5/lWzrfhvTfECRi/ictECEdHKlc9fbt3FcxP8K7NmP2fVJ4x6SRh/5YqKTwkqaVS6fccvaKV47EXi/xvpN/ok+n6ez3Dz4BcoVVQCD3wc8Vyvg2wkv/ABTYrGpKwyCZz6BTn+eB+NdZD8KrdXBn1aR17hIQp/Mk11ujaBp2g25isYdpb78jHLv9TXQ8Th6FF06N22R7Oc5XkWNU/wCQTef9cH/9BNeBV9BzwrcW8kDkhZEKEjrgjFch/wAKv0T/AJ+r/wD7+J/8RWWBxNOgpKfUqtTlNqx1dh/yD7b/AK5L/IVg/EL/AJE+5/34/wD0IV0cMawwpEpJVFCjPXAqnrOkW+uaa9hcvIkUhBJjIDcHPcGuKlNRqqT2TNZJuLR454X/AORo0z/r5T+de5Vylh8O9I06/gvYbm9aSBw6h3Qgkevy11ddOOrwrTTgZ0YOCdzM8S/8ixqf/XrJ/wCgmvDY/wDWL9RXvt9aR6hYT2cpZY542jYocEAjHFcqPhhoikEXV/x/00T/AOIrXA4qnRg1PqTVpyk00dlRRRXlnQfP97/x/wBx/wBdW/ma9n8I/wDIqab/ANcBWRL8M9FmmeVrq/BdixxImOf+A10+nWMWmafBYwM7RwJtUuQSR74r1MbiqdanGMOhz0qcoybZZoooryzoCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKinuYLZd088cS+sjhR+tA0r7EtFUf7b0n/oKWf/AIEJ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1Go+Y53xjp8GmeKLy2tlCRZV1UdF3KCR+ZNereFv+RW03/r2T+VeP69e3OpaxNfXcRhe4w6oeyYG39MV7B4W/wCRW03/AK9k/lU49NYeClv/AMAdG3O7GtRRRXjHUFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABVS+0rT9SXbe2cNxjoZEBI+h6irdFNNp3QWuc//wAIL4aD7/7LXP8A11fH5bq2LOxtNPgEFnbxwRjnbGoANWKKqVWc1aUmxKKWyGvGkqNHIiujDBVhkEViTeCfDc8hd9LjBP8AcdkH5AgVu0URqTh8LaBxT3RS0/R9O0pSthZxQZ6lV+Y/U9TV2iipcnJ3bGlbYKy9V8N6RrUyTajaee8a7VPmOuB17EVqUURlKLvF2YNJ7lXTtNtNJs1tLGHyoVJIXcW5PXkkms278GeH767kurnT/Mmlbc7edIMn6BsVuUVSqzi3JSd2JxTVrEZgiNt9nK/utmzbk/dxjFY9n4N8P2F3Hd21h5c0TbkbzpDg/QtityiiNScU0m1cHFPdBUc7SJBI8UfmSKpKJkDcccDJqSioGcZ4F8Oajpd5fahq0Hl3E2FT51YkE5Y8E98V2dFFa1qsqs+eRMYqKsgooorIowJvA/hyeZ5pdO3PIxZj58gyScn+Kmf8ID4Y/wCgZ/5Hk/8Aiq6KitvrFb+d/eyeSPYydL8MaNo1y1zp9n5MrIULea7cEg4wSfQVrUUVnKcpu8ncpJLYKwV8E+HUuRcrp2JVfeG86T72c5+961vUURqTh8LsJpPciuLeG7t5Le4jWSKRdrow4IrFi8D+HIJUmi09o5EIZWW4lBBHcfNW/RTjUnBWi2gcU90YfifXLDRraFNStTcW10xRwAGxgZ5B61zUeofDm1b7VFbB5RyIzFI3P0b5a7TVNHsNZtxBqFusyA5XJIKn1BHIrnG+GWhF9wlvQP7okXH/AKDmuuhUoKFpuSflszKcZt6JHn2q3k/ibxHJPBA3mXThYohyQAAAPyHNez6bZ/2fpdrZ5z5EKx59cDGaqaR4Z0nQyWsbULKRgyudzn8T0/CtWli8TGqowgrRQ6dNxu3uwoooriNQooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/2Q==";

const DAILY_AI = Number(ENV("DAILY_AI_LIMIT") || 800);
const DAILY_AI_IP = Number(ENV("DAILY_AI_PER_IP") || 80);
const DAILY_PER_IP = Number(ENV("DAILY_REPORTS_PER_IP") || 60);
const REGIONS = new Set(["TOSS", "TOS", "AND", "BUX", "FAR", "JIZ", "NAM", "NAV", "QAS", "QQR", "SAM", "SIR", "SUR", "XOR"]);
const MAX_AGG = 2000;
const VERSION = "2.6.0";

const store = () => getStore("narxradar");
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type, x-cap-key, x-admin-key", "access-control-max-age": "86400" };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...CORS } });
const today = () => new Date().toISOString().slice(0, 10);
const hashIp = ip => createHash("sha256").update(String(ip)).digest("hex").slice(0, 16);
/* Edge funksiya bilan umumiy kalit: AI kalitining xeshi (kalitning oʻzi hech qayerga yuborilmaydi) */
const CAP_KEY = createHash("sha256").update("narxradar-cap:" + (GEMINI_KEY || KEY || "none")).digest("hex").slice(0, 32);

async function bump(key, limit) {
  const s = store();
  const cur = (await s.get(key, { type: "json" })) || { n: 0 };
  if (cur.n >= limit) return false;
  await s.setJSON(key, { n: cur.n + 1 });
  return true;
}
async function aiAllowed(ip) {
  if (!(await bump(`cap/${today()}`, DAILY_AI))) return false;
  return bump(`aip/${today()}/${hashIp(ip)}`, DAILY_AI_IP);
}

/* ---------- Xabarlarni tekshirish (server tomoni) ---------- */
const num = (v, lo, hi) => (typeof v === "number" && isFinite(v) && v >= lo && v <= hi ? v : null);
const oneOf = (v, list) => (list.includes(v) ? v : null);
const pub = x => (x && x.loc ? { ...x, loc: { ...x.loc, la: null, lo: null } } : x);
function clean(x) {
  if (!x || typeof x !== "object") return null;
  const c = num(x.c, 1, 99999), prod = c && BY_CODE.get(c);
  if (!prod) return null;
  const price = num(x.price, 1, 1e9), up = num(x.up, 1, 1e9);
  if (!price || !up) return null;
  const now = Date.now();
  let t = str(x.t, 40); const tt = t ? Date.parse(t) : NaN;
  if (!t || isNaN(tt) || tt > now + 10 * 60e3 || tt < now - 3 * 864e5) t = new Date(now).toISOString();
  const id = /^[a-z0-9]{6,24}$/.test(x.id || "") ? x.id : Math.random().toString(36).slice(2, 12);
  const L = x.loc && typeof x.loc === "object" ? x.loc : {};
  const la = num(L.la, 36, 46), lo = num(L.lo, 55, 74);
  const v = x.v && typeof x.v === "object" ? x.v : null;
  const qa = x.qa && typeof x.qa === "object" ? x.qa : {};
  const why = Array.isArray(qa.why) ? qa.why.slice(0, 5).map(w => str(String(w), 160)) : [];
  let ok = !!qa.ok;
  const off = OFF_CACHE.data && OFF_CACHE.data.items && OFF_CACHE.data.items[c];
  if (off && off.mn && off.mx) { if (up < off.mn * 0.55 || up > off.mx * 1.7) { ok = false; why.push("Server: narx rasmiy kuzatuvdagi oraliqdan juda uzoq"); } }
  else if (prod.p) { const ratio = up / prod.p; if (ratio < 0.4 || ratio > 2.6) { ok = false; why.push("Server: narx rasmiy oʻrtachadan juda uzoq"); } }
  else if (prod.lo && (up < prod.lo || up > prod.hi)) { ok = false; why.push("Server: narx odatiy chegaradan tashqarida"); }
  return {
    id, t, wk: str(x.wk, 10), a: /^[a-z0-9]{6,12}$/.test(x.a || "") ? x.a : null, cf: num(x.cf, 0, 2), c, pt: str(x.pt, 80), price, q: num(x.q, 0.001, 1000) || 1, up: Math.round(up),
    old: num(x.old, 1, 1e9), src: oneOf(x.src, ["rasm", "matn"]) || "matn", conf: oneOf(x.conf, ["high", "medium", "low"]), issue: str(x.issue, 20),
    loc: {
      r: REGIONS.has(L.r) ? L.r : null, pl: str(L.pl, 60), chain: str(L.chain, 30), ty: oneOf(L.ty, ["bozor", "supermarket", "dokon", "zapravka"]),
      m: oneOf(L.m, ["gps", "exif", "matn", "tanlangan", "oxirgi", "sinov"]),
      la: la === null ? null : Math.round(la * 100) / 100, lo: lo === null ? null : Math.round(lo * 100) / 100
    },
    v: v ? { lab: oneOf(v.lab, ["arzon", "adolatli", "qimmat", "juda", "yangi"]), g: num(v.g, -10, 10), b: num(v.b, 0, 1e9), bl: str(v.bl, 60) } : null,
    d: oneOf(x.d, ["haqiqiy", "chalgituvchi", "soxta", "nomalum"]), ds: num(x.ds, 0, 100),
    qa: { ok, w: num(qa.w, 0, 1) ?? 0.5, why }
  };
}

/* ---------- Baza ---------- */
async function listReports() {
  const agg = await store().get("agg/latest", { type: "json" });
  if (agg && Array.isArray(agg.items)) return agg.items;
  return rebuild();
}
async function rebuild() {
  const s = store();
  const { blobs } = await s.list({ prefix: "r/" });
  const keys = blobs.map(b => b.key).sort().reverse().slice(0, MAX_AGG);
  const items = [];
  for (let i = 0; i < keys.length; i += 50) {
    const part = await Promise.all(keys.slice(i, i + 50).map(k => s.get(k, { type: "json" })));
    items.push(...part.filter(Boolean));
  }
  await s.setJSON("agg/latest", { items, rebuilt: new Date().toISOString() });
  return items;
}
async function addReport(item) {
  const s = store();
  await s.setJSON(`r/${item.t}_${item.id}`, item);
  const agg = (await s.get("agg/latest", { type: "json" })) || { items: [] };
  const items = [item, ...(agg.items || []).filter(x => x.id !== item.id)].slice(0, MAX_AGG);
  await s.setJSON("agg/latest", { items, updated: new Date().toISOString() });
}

/* ---------- Rasmiy narxlar: narx.stat.uz ochiq maʼlumoti (haftalik CSV) ----------
   Manba: https://narx.stat.uz/data → “Toʻliq narx toʻplami” (CSV). Ustunlar:
   sana;mahsulot_kodi;mahsulot;birlik;toifa;daraja;saoto;hudud;viloyat_saoto;viloyat;narx_som
   daraja = viloyat | tuman. Viloyat narxi = tumanlar oʻrtachasi; respublika = barcha tumanlar oʻrtachasi. */
const SAOTO = { "1703": "AND", "1706": "BUX", "1730": "FAR", "1708": "JIZ", "1714": "NAM", "1712": "NAV", "1710": "QAS", "1735": "QQR", "1718": "SAM", "1724": "SIR", "1722": "SUR", "1726": "TOSS", "1727": "TOS", "1733": "XOR" };
const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d || "") && !isNaN(Date.parse(d));
const quant = (s, f) => { const i = (s.length - 1) * f, a = Math.floor(i), b = Math.ceil(i); return s[a] + (s[b] - s[a]) * (i - a); };
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
function parseOfficialCSV(text) {
  const lines = String(text || "").replace(/^﻿/, "").split(/\r?\n/).filter(l => l.trim());
  const bad = code => Object.assign(new Error(code), { code, status: 400 });
  if (lines.length < 30) throw bad("csv_short");
  const head = lines[0].split(";").map(x => x.trim().toLowerCase());
  const col = n => head.indexOf(n);
  const I = { d: col("sana"), c: col("mahsulot_kodi"), n: col("mahsulot"), u: col("birlik"), lv: col("daraja"), s: col("saoto"), vs: col("viloyat_saoto"), p: col("narx_som") };
  if (Object.values(I).some(v => v < 0)) throw bad("csv_format");
  const prods = {}; let date = null;
  for (let k = 1; k < lines.length; k++) {
    const r = lines[k].split(";");
    const price = Number(String(r[I.p] || "").replace(",", ".")), c = Number(r[I.c]);
    if (!c || !isFinite(price) || price <= 0) continue;
    if (!date) date = String(r[I.d]).trim();
    if (String(r[I.d]).trim() !== date) continue;
    const P = prods[c] || (prods[c] = { n: r[I.n], u: r[I.u], rep: null, reg: {}, dist: {}, all: [] });
    const lv = String(r[I.lv] || "").trim().toLowerCase();
    const g = SAOTO[String(r[I.vs]).trim()] || SAOTO[String(r[I.s]).trim().slice(0, 4)];
    if (lv === "viloyat" && g) P.reg[g] = price;
    else if (lv === "tuman" && g) { (P.dist[g] = P.dist[g] || []).push(price); P.all.push(price); }
    else if (/resp|zbek|uzb/.test(lv)) P.rep = price;
  }
  if (!isDate(date)) throw bad("csv_date");
  const products = {};
  for (const [c, P] of Object.entries(prods)) {
    const r = {}, rl = {}, rh = {};
    for (const [g, v] of Object.entries(P.reg)) r[g] = Math.round(v);
    for (const [g, arr] of Object.entries(P.dist)) {
      const sorted = arr.sort((a, b) => a - b);
      if (!r[g]) r[g] = Math.round(mean(sorted));
      if (sorted.length >= 3) { rl[g] = Math.round(quant(sorted, 0.1)); rh[g] = Math.round(quant(sorted, 0.9)); }
    }
    const all = P.all.sort((a, b) => a - b), regv = Object.values(r);
    const rep = P.rep || (all.length ? mean(all) : regv.length ? mean(regv) : null);
    if (!rep) continue;
    products[c] = { n: String(P.n || "").slice(0, 80), u: String(P.u || "").slice(0, 12), p: Math.round(rep), r, rl, rh, mn: all.length ? Math.round(quant(all, 0.02)) : null, mx: all.length ? Math.round(quant(all, 0.98)) : null, nd: all.length };
  }
  if (Object.keys(products).length < 10) throw bad("csv_products");
  return { date, products };
}
const OFF_CACHE = { data: null, at: 0 };
async function officialSummary(force) {
  if (!force && OFF_CACHE.data && Date.now() - OFF_CACHE.at < 10 * 60e3) return OFF_CACHE.data;
  const data = await store().get("off/summary", { type: "json" });
  OFF_CACHE.data = data || null; OFF_CACHE.at = Date.now();
  return OFF_CACHE.data;
}
async function rebuildOfficialSummary() {
  const s = store();
  const dates = ((await s.get("off/index", { type: "json" })) || []).filter(isDate).sort();
  if (!dates.length) return null;
  const week = dates.at(-1), t = Date.parse(week), DAY = 864e5;
  const near = (target, tol) => { const c = dates.filter(d => d < week).map(d => [d, Math.abs(Date.parse(d) - target)]).filter(x => x[1] <= tol * DAY).sort((a, b) => a[1] - b[1]); return c.length ? c[0][0] : null; };
  const prev = near(t - 7 * DAY, 3), yearAgo = near(t - 364 * DAY, 10);
  const W = await s.get(`off/w/${week}`, { type: "json" });
  const Pv = prev ? await s.get(`off/w/${prev}`, { type: "json" }) : null;
  const Y = yearAgo ? await s.get(`off/w/${yearAgo}`, { type: "json" }) : null;
  const items = {};
  for (const [c, x] of Object.entries(W.products)) {
    const pp = Pv && Pv.products[c], yy = Y && Y.products[c];
    items[c] = { p: x.p, w: pp ? x.p - pp.p : null, y: yy ? x.p - yy.p : null, r: x.r, rl: x.rl, rh: x.rh, mn: x.mn, mx: x.mx, nd: x.nd, n: x.n, u: x.u };
  }
  /* Prognoz va signal uchun: oxirgi 13 haftaning respublika narxlari (mahsulot → [[sana, narx], …]) */
  const hist = {};
  for (const d of dates.filter(d => d <= week).slice(-13)) {
    const doc = d === week ? W : d === prev ? Pv : await s.get(`off/w/${d}`, { type: "json" }).catch(() => null);
    if (!doc || !doc.products) continue;
    for (const [c, x] of Object.entries(doc.products)) if (x && x.p) (hist[c] ||= []).push([d, Math.round(x.p)]);
  }
  const sum = { week, prev, yearAgo, dates: dates.slice(-60), items, hist, source: "narx.stat.uz ochiq maʼlumoti", updated: new Date().toISOString() };
  await s.setJSON("off/summary", sum);
  OFF_CACHE.data = sum; OFF_CACHE.at = Date.now();
  return sum;
}
async function saveOfficial(parsed) {
  const s = store();
  await s.setJSON(`off/w/${parsed.date}`, { date: parsed.date, products: parsed.products, saved: new Date().toISOString() });
  const idx = ((await s.get("off/index", { type: "json" })) || []).filter(isDate);
  if (!idx.includes(parsed.date)) idx.push(parsed.date);
  await s.setJSON("off/index", idx.sort());
  return rebuildOfficialSummary();
}

/* ---------- Marshrutlar ---------- */
export default async (req, context) => {
  const T0 = Date.now();
  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, "");
  const ip = (context && context.ip) || req.headers.get("x-nf-client-connection-ip") || "0";
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  try {
    const admin = isAdmin(url, req);
    if (route === "health") return json(admin ? { ok: true, v: VERSION, ai: !!PROVIDER, provider: PROVIDER, providers: PROVIDERS, via: VIA, db: true, edge: "/ai", admin: true } : { ok: true, v: VERSION, ai: !!PROVIDER, db: true });

    /* Edge funksiya uchun kunlik limit hisoblagichi */
    if (route === "cap" && req.method === "POST") {
      if (req.headers.get("x-cap-key") !== CAP_KEY) return json({ ok: false, error: "forbidden" }, 403);
      const b = await req.json().catch(() => ({}));
      return json({ ok: await aiAllowed(String(b.ip || ip)) });
    }

    if (route === "selftest") {
      if (!admin) return json({ error: "not_found" }, 404);
      if (!PROVIDER) return json({ ok: false, error: "no_ai" });
      if (!(await aiAllowed(ip))) return json({ ok: false, error: "rate_limited" });
      const img = url.searchParams.get("img") === "1";
      return streamJSON(() => runTask("selftest", { img }, { deadline: T0 + 9000 }), CORS);
    }
    if (route === "official" && req.method === "GET") {
      const sum = await officialSummary(false);
      return new Response(JSON.stringify(sum || { week: null }), { status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300", ...CORS } });
    }
    if (route === "official" && req.method === "POST") {
      if (!admin) return json({ error: "forbidden" }, 403);
      const parsed = parseOfficialCSV(await req.text());
      const want = url.searchParams.get("date");
      if (want && want !== parsed.date) return json({ error: "date_mismatch", got: parsed.date }, 400);
      const sum = await saveOfficial(parsed);
      const pick = c => parsed.products[c] ? `${parsed.products[c].n}: ${parsed.products[c].p}` : null;
      return json({ ok: true, date: parsed.date, products: Object.keys(parsed.products).length, week: sum && sum.week, prev: sum && sum.prev, yearAgo: sum && sum.yearAgo, check: [pick(100), pick(1180), pick(170)].filter(Boolean) });
    }
    if (route === "reports" && req.method === "GET") {
      const items = admin && url.searchParams.get("rebuild") === "1" ? await rebuild() : await listReports();
      /* Ochiq roʻyxatda aniq koordinata yoʻq: faqat hudud va joy nomi */
      return json({ items: admin ? items : items.map(pub) });
    }
    if (req.method !== "POST") return json({ error: "method" }, 405);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "invalid" }, 400);

    if (route === "reports") {
      try { await officialSummary(false); } catch (e) { } /* rasmiy oraliq bilan tekshirish uchun */
      const item = clean(body.item);
      if (!item) return json({ error: "invalid" }, 400);
      if (!(await bump(`rl/${today()}/${hashIp(ip)}`, DAILY_PER_IP))) return json({ error: "rate_limited" }, 429);
      await addReport(item);
      return json({ ok: true, id: item.id });
    }

    if (!["read", "parse", "explain"].includes(route)) return json({ error: "not_found" }, 404);
    if (!PROVIDER) return json({ error: "no_ai" }, 503);
    if (!(await aiAllowed(ip))) return json({ error: "rate_limited" }, 429);
    /* 10 soniyalik chegaradan oldin javob qaytaramiz */
    return streamJSON(() => runTask(route, body, { deadline: T0 + 9000, edge: false }), CORS);
  } catch (e) {
    if (e && e.status === 400) return json({ error: e.code || "invalid" }, 400);
    return json(errOut(e), e && e.status === 429 ? 429 : 502);
  }
};

export const config = { path: "/api/*" };
