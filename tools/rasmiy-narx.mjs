// NarxRadar: rasmiy narxlarni narx.stat.uz ochiq maʼlumotidan (https://narx.stat.uz/data → “Toʻliq narx toʻplami”, CSV)
// olib, NarxRadar serveriga yuklaydi. GitHub Actions har hafta ishga tushiradi (.github/workflows/rasmiy-narxlar.yml).
// Kerak: GitHub → Settings → Secrets → Actions → NARX_ADMIN_KEY (Netlify'dagi ADMIN_KEY bilan bir xil).
const SITE = (process.env.NARX_SITE || "https://narxradar.netlify.app").replace(/\/$/, "");
const SRC = (process.env.NARX_SRC || "https://narx.stat.uz").replace(/\/$/, "");
const KEY = process.env.NARX_ADMIN_KEY || "";
const DAY = 864e5, iso = t => new Date(t).toISOString().slice(0, 10);
const UA = { "user-agent": "NarxRadar/2.2 (+https://narxradar.netlify.app; weekly open-data sync)" };
function fail(msg) { console.error("✗ " + msg); process.exit(1); }
async function get(url, ms = 60000, opt = {}) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opt, signal: c.signal, headers: { ...UA, ...(opt.headers || {}) } }); } finally { clearTimeout(t); }
}
if (KEY.length < 12) fail("NARX_ADMIN_KEY secret qoʻshilmagan yoki 12 belgidan qisqa (GitHub → Settings → Secrets and variables → Actions).");

let sum;
try { sum = await (await get(SITE + "/api/official", 30000)).json(); } catch (e) { fail("NarxRadar serveriga ulanib boʻlmadi: " + e.message); }
const have = new Set(sum && sum.dates || []);
console.log(`Serverda ${have.size} ta hafta bor. Oxirgisi: ${sum && sum.week || "yoʻq"}`);

let reached = false, netErr = null;
const uploaded = [];
async function tryDate(d) {
  if (have.has(d)) return "bor";
  let r;
  try { r = await get(`${SRC}/api/export/weekly.csv?date=${d}`); reached = true; }
  catch (e) { netErr = e; return "xato"; }
  if (!r.ok) return "yoʻq";
  const text = await r.text();
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  if (!/^sana;/.test(lines[0]) || lines.length < 50) return "yoʻq";
  if ((lines[1] || "").split(";")[0] !== d) return "yoʻq";
  const up = await get(`${SITE}/api/official?date=${d}`, 60000, { method: "POST", headers: { "content-type": "text/csv; charset=utf-8", "x-admin-key": KEY }, body: text });
  const j = await up.json().catch(() => null);
  if (up.status === 403) fail("Server parolni qabul qilmadi: NARX_ADMIN_KEY Netlify'dagi ADMIN_KEY bilan bir xil boʻlishi kerak.");
  if (!up.ok || !j || !j.ok) fail(`Serverga yuklab boʻlmadi (${d}): ${up.status} ${JSON.stringify(j)}`);
  console.log(`✓ ${d}: ${j.products} ta mahsulot yuklandi (oldingi hafta: ${j.prev || "—"}, bir yil oldin: ${j.yearAgo || "—"})`);
  if (j.check && j.check.length) console.log(`  Respublika narxi (narx.stat.uz/prices bilan solishtiring): ${j.check.join("; ")}`);
  have.add(d); uploaded.push(d); return "yuklandi";
}
const near = (target, tolDays) => [...have].some(d => Math.abs(Date.parse(d) - target) <= tolDays * DAY);

const manual = (process.env.NARX_DATE || "").split(",").map(s => s.trim()).filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s));
if (manual.length) { for (const d of manual) console.log(d, await tryDate(d)); }
else {
  // 1) eng yangi hafta: bugundan orqaga 14 kun (sayt odatda chorshanba kuzatuvini keyingi haftada eʼlon qiladi)
  for (let k = 0; k <= 14; k++) { const d = iso(Date.now() - k * DAY); const st = await tryDate(d); if (st === "bor") break; }
  // 2) haftalik va yillik oʻzgarish uchun: oldingi hafta va bir yil oldingi hafta
  const latest = [...have].sort().at(-1);
  if (latest) {
    const t = Date.parse(latest);
    if (!near(t - 7 * DAY, 3)) for (const k of [7, 6, 8, 5, 9]) { if ((await tryDate(iso(t - k * DAY))) === "yuklandi") break; }
    if (!near(t - 364 * DAY, 10)) for (const k of [364, 363, 365, 362, 366, 361, 367, 360, 368]) { if ((await tryDate(iso(t - k * DAY))) === "yuklandi") break; }
  }
}
if (!reached && netErr) fail(`narx.stat.uz ga ulanib boʻlmadi (${netErr.message}). Sayt chet eldan bloklangan boʻlishi mumkin. Unda faylni qoʻlda yuklang: ${SITE}/admin.html`);
console.log(uploaded.length ? `Tayyor: ${uploaded.join(", ")} yuklandi.` : "Yangi hafta hali eʼlon qilinmagan: hech narsa oʻzgarmadi.");
