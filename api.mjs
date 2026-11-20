// NarxRadar API — Netlify Function (Node 18+).
// Vazifasi: (1) narx yorligʻi rasmini Claude orqali oʻqish, (2) umumiy narx bazasini saqlash.
// API kaliti faqat shu yerda (Netlify muhit oʻzgaruvchisi) turadi, telefonga hech qachon yuborilmaydi.
//
// Muhit oʻzgaruvchilari (Netlify → Site configuration → Environment variables):
//   ANTHROPIC_API_KEY     — Claude kaliti (pullik, juda arzon). Boʻlsa, shu ishlatiladi
//   GEMINI_API_KEY        — Google Gemini kaliti (bepul tarif, aistudio.google.com). Claude kaliti boʻlmasa ishlatiladi
//   CLAUDE_MODEL          — standart: claude-haiku-5-5
//   GEMINI_MODEL          — standart: gemini-3.8-flash
//   Ikkalasi ham boʻlmasa AI oʻchiq, baza baribir ishlaydi
//   DAILY_AI_LIMIT        — kunlik AI soʻrovlari chegarasi, standart 800
//   DAILY_REPORTS_PER_IP  — bitta IP dan kunlik xabar chegarasi, standart 60

import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

const KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = process.env.CLAUDE_MODEL || "claude-haiku-5-5";
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const PROVIDER = KEY ? "claude" : GEMINI_KEY ? "gemini" : null;
const DAILY_AI = Number(process.env.DAILY_AI_LIMIT || 800);
const DAILY_PER_IP = Number(process.env.DAILY_REPORTS_PER_IP || 60);

const CATALOG = [{"c": 100, "n": "Guruch", "u": "kg", "p": 14999}, {"c": 4001, "n": "Bugʻdoy uni, oliy nav", "u": "kg", "p": 9425}, {"c": 4002, "n": "Bugʻdoy uni, 1-nav", "u": "kg", "p": 6292}, {"c": 114, "n": "Non (1-nav undan)", "u": "kg", "p": 6377}, {"c": 1180, "n": "Mol goʻshti", "u": "kg", "p": 125891}, {"c": 120, "n": "Qoʻy goʻshti", "u": "kg", "p": 137804}, {"c": 1220, "n": "Tovuq goʻshti", "u": "kg", "p": 32492}, {"c": 1250, "n": "Baliq", "u": "kg", "p": 37404}, {"c": 127, "n": "Sut (yangi sogʻilgan)", "u": "l", "p": 8024}, {"c": 135, "n": "Tuxum", "u": "10 dona", "p": 12837}, {"c": 1301, "n": "Paxta yogʻi", "u": "l", "p": 20391}, {"c": 1302, "n": "Kungaboqar yogʻi", "u": "l", "p": 21591}, {"c": 9001, "n": "Sariyogʻ", "u": "kg", "p": 70193}, {"c": 9002, "n": "Limon", "u": "kg", "p": 32810}, {"c": 141, "n": "Olma", "u": "kg", "p": 11340}, {"c": 9003, "n": "Nok", "u": "kg", "p": 18422}, {"c": 9004, "n": "Uzum", "u": "kg", "p": 13545}, {"c": 156, "n": "Karam", "u": "kg", "p": 4366}, {"c": 158, "n": "Bodring", "u": "kg", "p": 12725}, {"c": 159, "n": "Pomidor", "u": "kg", "p": 12421}, {"c": 160, "n": "Baqlajon", "u": "kg", "p": 7255}, {"c": 9005, "n": "Bulgʻor qalampiri", "u": "kg", "p": 11548}, {"c": 164, "n": "Sabzi", "u": "kg", "p": 4582}, {"c": 166, "n": "Sarimsoq", "u": "kg", "p": 16507}, {"c": 167, "n": "Piyoz", "u": "kg", "p": 3353}, {"c": 170, "n": "Kartoshka", "u": "kg", "p": 5105}, {"c": 9006, "n": "Loviya", "u": "kg", "p": 19171}, {"c": 9007, "n": "Noʻxat", "u": "kg", "p": 21258}, {"c": 9008, "n": "Mosh", "u": "kg", "p": 19108}, {"c": 174, "n": "Shakar", "u": "kg", "p": 12327}];
const BY_CODE = new Map(CATALOG.map(p => [p.c, p]));
const REGIONS = new Set(["TOSS", "TOS", "AND", "BUX", "FAR", "JIZ", "NAM", "NAV", "QAS", "QQR", "SAM", "SIR", "SUR", "XOR"]);
const MAX_AGG = 1500;

const store = () => getStore("narxradar");
/* CORS: telefon ilovasi (capacitor://localhost, https://localhost) ham serverga murojaat qila oladi. Cookie ishlatilmaydi. */
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "86400" };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...CORS } });
const today = () => new Date().toISOString().slice(0, 10);
const hashIp = ip => createHash("sha256").update(String(ip)).digest("hex").slice(0, 16);

/* oddiy hisoblagich: kunlik chegaralar uchun (taxminiy, poyga holatida biroz oshishi mumkin) */
async function bump(key, limit) {
  const s = store();
  const cur = (await s.get(key, { type: "json" })) || { n: 0 };
  if (cur.n >= limit) return false;
  await s.setJSON(key, { n: cur.n + 1 });
  return true;
}

/* ---------- Claude ---------- */
async function claude(content, maxTokens = 700) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: [{ role: "user", content }] })
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    const err = new Error(`claude ${r.status}: ${t.slice(0, 200)}`); err.status = r.status; throw err;
  }
  const j = await r.json();
  return (j.content || []).filter(b => b.type === "text").map(b => b.text).join("");
}
/* ---------- Gemini (bepul tarif) ---------- */
async function gemini(content, maxTokens = 700) {
  const parts = content.map(c => c.type === "image" ? { inline_data: { mime_type: c.source.media_type, data: c.source.data } } : { text: c.text });
  const body = thinking => JSON.stringify({
    contents: [{ role: "user", parts }],
    generationConfig: { temperature: 0.2, maxOutputTokens: Math.max(2048, maxTokens * 3), ...(thinking ? { thinkingConfig: { thinkingLevel: "low" } } : {}) }
  });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
  const call = thinking => fetch(url, { method: "POST", headers: { "x-goog-api-key": GEMINI_KEY, "content-type": "application/json" }, body: body(thinking) });
  let r = await call(true);
  if (r.status === 400) r = await call(false); /* model "thinkingLevel"ni qoʻllamasa, usiz qayta urinadi */
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    const err = new Error(`gemini ${r.status}: ${t.slice(0, 200)}`); err.status = r.status; throw err;
  }
  const j = await r.json();
  const out = (((j.candidates || [])[0] || {}).content || {}).parts || [];
  return out.filter(p => p.text && !p.thought).map(p => p.text).join("");
}
const ai = (content, maxTokens) => (PROVIDER === "claude" ? claude(content, maxTokens) : gemini(content, maxTokens));

function parseJSON(s) {
  const m = String(s || "").replace(/```json|```/g, "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (e) { return null; }
}
const catalogText = () => CATALOG.map(p => `${p.c}=${p.n} (${p.u})`).join("; ");

const READ_PROMPT = () => `You read price tags photographed by shoppers in Uzbekistan (bazaars, supermarkets, small shops). Tags may be handwritten, in Uzbek (Latin or Cyrillic) or Russian.
Reply with JSON only, no other text:
{"is_price_tag": boolean, "items": [{"product_text": string, "product_code": number|null, "price_uzs": number, "pack_qty": number|null, "pack_unit": "kg"|"l"|"dona"|null, "old_price_uzs": number|null}], "store_name": string|null, "place_type": "bozor"|"supermarket"|"dokon"|null, "photo_issue": null|"screen"|"blurry"|"edited"|"not_a_tag", "confidence": "high"|"medium"|"low"}
Rules: product_text = the product name exactly as written. price_uzs = the current selling price in soum as a plain number ("145 000" or "145 ming" -> 145000). old_price_uzs = a crossed-out or "old" price if the tag shows one, else null. pack_qty = the quantity the price is for, in kg, litres or pieces (900 g -> 0.9 with "kg"; 5 L -> 5 with "l"; 30 eggs -> 30 with "dona"); null when the price is per 1 kg or 1 litre. product_code = the matching code from this catalog, or null: ${catalogText()}. store_name = a shop or chain name visible on the tag or in the photo (e.g. Korzinka, Makro, Havas), else null. photo_issue = "screen" if this is a photo of a screen, "edited" if numbers look digitally altered. At most 4 items. If there is no readable price tag, return {"is_price_tag": false, "items": []}.`;

const PARSE_PROMPT = text => `A shopper in Uzbekistan typed a price report. Extract it. Reply with JSON only: {"product_text": string, "product_code": number|null, "price_uzs": number|null, "pack_qty": number|null, "pack_unit": "kg"|"l"|"dona"|null, "old_price_uzs": number|null, "place": string|null}. price_uzs in soum as a number ("130 ming" -> 130000). product_code from this catalog or null: ${catalogText()}. Text: """${text}"""`;

const EXPLAIN_PROMPT = (kind, ctx) => kind === "index"
  ? `Siz NarxRadar ilovasining iqtisodiy tahlilchisisiz. Oddiy aholi uchun oʻzbek tilida (lotin yozuvi) 3–4 qisqa gapdan iborat haftalik sharh yozing: savat narxi qanday oʻzgardi, nimalar qimmatladi, xaridorga bitta amaliy maslahat. Faqat shu maʼlumotlardagi raqamlarni ishlating, yangi raqam toʻqimang. Faqat sharh matnini yozing. Maʼlumot: ${ctx}`
  : `Siz NarxRadar ilovasining tahlilchisisiz. Oddiy xaridorga oʻzbek tilida (lotin yozuvi), 2–3 qisqa gapda tushuntiring: bu narx (va chegirma boʻlsa, chegirma) adolatlimi va nima qilish kerak. Faqat shu maʼlumotdagi raqamlarni ishlating, yangi raqam toʻqimang. Faqat izoh matnini yozing. Maʼlumot: ${ctx}`;

/* ---------- Xabarlarni tekshirish (server tomoni) ---------- */
const num = (v, lo, hi) => (typeof v === "number" && isFinite(v) && v >= lo && v <= hi ? v : null);
const str = (v, n) => (typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, "").slice(0, n) : null);
const oneOf = (v, list) => (list.includes(v) ? v : null);
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
  const ratio = up / prod.p;
  if (ratio < 0.3 || ratio > 3.5) { ok = false; why.push("Server: narx rasmiy oʻrtachadan juda uzoq"); }
  return {
    id, t, wk: str(x.wk, 10), c, pt: str(x.pt, 80), price, q: num(x.q, 0.001, 1000) || 1, up: Math.round(up),
    old: num(x.old, 1, 1e9), src: oneOf(x.src, ["rasm", "matn"]) || "matn", conf: oneOf(x.conf, ["high", "medium", "low"]), issue: str(x.issue, 20),
    loc: {
      r: REGIONS.has(L.r) ? L.r : null, pl: str(L.pl, 60), chain: str(L.chain, 30), ty: oneOf(L.ty, ["bozor", "supermarket", "dokon"]),
      m: oneOf(L.m, ["gps", "exif", "matn", "tanlangan", "oxirgi", "sinov"]),
      la: la === null ? null : Math.round(la * 1000) / 1000, lo: lo === null ? null : Math.round(lo * 1000) / 1000
    },
    v: v ? { lab: oneOf(v.lab, ["arzon", "adolatli", "qimmat", "juda"]), g: num(v.g, -10, 10), b: num(v.b, 0, 1e9), bl: str(v.bl, 60) } : null,
    d: oneOf(x.d, ["haqiqiy", "chalgituvchi", "soxta"]), ds: num(x.ds, 0, 100),
    qa: { ok, w: num(qa.w, 0, 1) ?? 0.5, why }
  };
}

/* ---------- Baza: har bir xabar alohida + tezkor yigʻma roʻyxat ---------- */
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

/* ---------- Marshrutlar ---------- */
export default async (req, context) => {
  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, "");
  const ip = (context && context.ip) || req.headers.get("x-nf-client-connection-ip") || "0";
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  try {
    if (route === "health") return json({ ok: true, ai: !!PROVIDER, provider: PROVIDER, db: true });
    if (route === "reports" && req.method === "GET") {
      const items = url.searchParams.get("rebuild") === "1" ? await rebuild() : await listReports();
      return json({ items });
    }
    if (req.method !== "POST") return json({ error: "method" }, 405);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "invalid" }, 400);

    if (route === "reports") {
      const item = clean(body.item);
      if (!item) return json({ error: "invalid" }, 400);
      if (!(await bump(`rl/${today()}/${hashIp(ip)}`, DAILY_PER_IP))) return json({ error: "rate_limited" }, 429);
      await addReport(item);
      return json({ ok: true, id: item.id });
    }

    if (!["read", "parse", "explain"].includes(route)) return json({ error: "not_found" }, 404);
    if (!PROVIDER) return json({ error: "no_ai" }, 503);
    if (!(await bump(`cap/${today()}`, DAILY_AI))) return json({ error: "rate_limited" }, 429);

    if (route === "read") {
      const { image, mime } = body;
      if (typeof image !== "string" || image.length < 100 || image.length > 4_000_000) return json({ error: "invalid" }, 400);
      const mt = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime) ? mime : "image/jpeg";
      const txt = await ai([{ type: "image", source: { type: "base64", media_type: mt, data: image } }, { type: "text", text: READ_PROMPT() }], 800);
      return json(parseJSON(txt) || { is_price_tag: false, items: [] });
    }
    if (route === "parse") {
      const text = str(body.text, 300);
      if (!text) return json({ error: "invalid" }, 400);
      return json(parseJSON(await ai([{ type: "text", text: PARSE_PROMPT(text) }], 300)) || {});
    }
    if (route === "explain") {
      const kind = body.kind === "index" ? "index" : "price";
      const ctx = JSON.stringify(body.ctx || {}).slice(0, 3000);
      return json({ text: (await ai([{ type: "text", text: EXPLAIN_PROMPT(kind, ctx) }], 400)).trim().slice(0, 1500) });
    }
    return json({ error: "not_found" }, 404);
  } catch (e) {
    return json({ error: e && e.status === 429 ? "rate_limited" : "server", message: String((e && e.message) || e).slice(0, 200) }, e && e.status === 429 ? 429 : 502);
  }
};

export const config = { path: "/api/*" };
