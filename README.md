# NarxRadar: Android, iPhone va veb ilova

Bitta loyiha uchta joyda ishlaydi:

| Qayerda | Nima kerak | Qanday yigʻiladi |
|---|---|---|
| Veb-sayt (PWA) | Netlify | Avtomatik |
| Android (Google Play) | Windows kompyuter yetarli | GitHub Actions (bulutda, bepul) |
| iPhone (App Store) | Mac **kerak emas** | Codemagic (bulutdagi Mac, oyiga 500 daqiqa bepul) |

## Papkalar

| Papka / fayl | Vazifasi |
|---|---|
| `docs/` | Ilovaning oʻzi (HTML/JS). Android va iOS ham shu fayllarni ishlatadi |
| `docs/config.js` | Telefon ilovasi ulanadigan server manzili |
| `docs/privacy.html` | Maxfiylik siyosati (doʻkonlar talab qiladi) |
| `netlify/functions/api.mjs` | Server: AI rasm oʻqish va umumiy baza |
| `android/` | Android Studio loyihasi |
| `ios/` | Xcode loyihasi |
| `.github/workflows/` | Android'ni bulutda yigʻish |
| `codemagic.yaml` | iOS'ni bulutda yigʻish |
| `STORE.md` | Doʻkon sahifasi uchun tayyor matnlar va maxfiylik savollariga javoblar |

---

## 1-qadam. Loyihani GitHub'ga yuklash
1. https://github.com da hisob oching va **New repository** → nomi `narxradar` → **Private** → Create.
2. Windows uchun **GitHub Desktop** dasturini oʻrnating (https://desktop.github.com). File → Add local repository → shu papkani tanlang → **Publish repository**.
   (Brauzer orqali yuklash ham mumkin, lekin u bir martada 100 ta fayl oladi, loyihada esa 200 dan ortiq fayl bor.)

## 2-qadam. Serverni ishga tushirish (Netlify)
1. https://app.netlify.com → **Add new site → Import an existing project → GitHub** → `narxradar` → **Deploy**. Sozlamalar `netlify.toml` dan olinadi.
2. https://console.anthropic.com → API kalit yarating, **Billing**da oylik chegarani qoʻying.
3. Netlify → **Site configuration → Environment variables**: `ANTHROPIC_API_KEY` = kalitingiz → **Deploys → Trigger deploy**.
4. Tekshiring: `https://<sayt>.netlify.app/api/health` → `{"ok":true,"ai":true,"db":true}`.
5. **Muhim:** `docs/config.js` faylidagi `SIZNING-SAYT` soʻzini sayt nomingizga almashtiring (masalan `https://narxradar.netlify.app/api`) va GitHub'ga yuboring. Busiz telefon ilovasi serverga ulanmaydi (internetsiz rejimda ishlayveradi).

## 3-qadam. Android test ilovasi (hakaton uchun)
1. GitHub'da repository → **Actions** → “Android ilova” → **Run workflow** (har bir yangilanishda oʻzi ham ishga tushadi).
2. 5–10 daqiqadan soʻng tugagan ishga kiring → **Artifacts** → `NarxRadar-test-apk` ni yuklab oling (zip ichida `app-debug.apk`).
3. APK’ni Android telefonga oʻtkazing va oching. Telefon soʻrasa, “Nomaʼlum manbalardan oʻrnatish”ga ruxsat bering.

## 4-qadam. Google Play'ga chiqarish
1. **Hisob:** https://play.google.com/console → shaxsiy hisob, 25 $ bir martalik toʻlov, shaxsni tasdiqlash.
2. **Imzo kaliti (bir marta):**
   - GitHub → Settings → Secrets and variables → Actions → **New repository secret**: `NARX_KEYSTORE_PASSWORD` (kamida 8 belgili parol), `NARX_KEY_ALIAS` (masalan `narxradar`).
   - Actions → “Imzo kalitini yaratish” → Run workflow → Artifacts → `imzo-kaliti` ni yuklab oling.
   - `upload.jks` faylini **xavfsiz joyda** saqlang (flesh, parol bilan arxiv). Yoʻqotsangiz, Play qoʻllab-quvvatlash orqali tiklash kerak boʻladi.
   - `upload.jks.base64.txt` ichidagi matnni yangi secret qiling: `NARX_KEYSTORE_BASE64`. Yana bitta secret: `NARX_KEY_PASSWORD` (yuqoridagi parolning oʻzi).
   - Endi “Android ilova” har safar `NarxRadar-play-aab` faylini ham chiqaradi.
3. **Play Console:** Create app → nom NarxRadar, bepul → **Testing → Closed testing** → yangi trek → `app-release.aab` yuklang.
4. **Sinovchilar:** 12 tadan koʻp (zaxira bilan 15–20) kishining Gmail manzilini qoʻshing. Ular sinov havolasi orqali **Play'dan** oʻrnatib, **14 kun uzluksiz** qolishi kerak.
5. **Sahifa:** `STORE.md` dagi matnlar, skrinshotlar, Data safety javoblari, maxfiylik havolasi.
6. 14 kundan keyin: **Production → Apply for production access** → savollarga aniq javob bering → tekshiruvdan soʻng ilova chiqadi.

## 5-qadam. iPhone va App Store (Mac'siz)
1. **Apple Developer Program:** https://developer.apple.com/programs/enroll → Individual → 99 $/yil. Ilova sahifasida sizning ismingiz chiqadi. Toʻlov oʻtmasa, boshqa karta bilan urinib koʻring yoki Apple Developer Support’ga yozing.
2. **App Store Connect:** https://appstoreconnect.apple.com → My Apps → **+ New App** → Bundle ID `uz.narxradar.app` (Certificates, Identifiers → Identifiers boʻlimida oldin yarating) → nom NarxRadar.
   Ilovaning **Apple ID** raqamini (App Information) `codemagic.yaml` dagi `APP_STORE_APPLE_ID` ga yozing.
3. **API kalit:** App Store Connect → Users and Access → **Integrations → App Store Connect API** → Generate (rol: App Manager) → `.p8` faylni yuklab oling, Issuer ID va Key ID ni yozib oling.
4. **Codemagic:** https://codemagic.io → GitHub bilan kiring → `narxradar` ni qoʻshing → **Teams → Integrations → Developer Portal / App Store Connect** → `.p8`, Issuer ID, Key ID → nomini **NarxRadar ASC** qiling.
5. Codemagic → **Start new build** → `ios-testflight`. Codemagic sertifikat va profilni oʻzi yaratadi, ilovani TestFlight’ga yuklaydi.
6. iPhone’da **TestFlight** ilovasi orqali sinab koʻring → App Store Connect’da skrinshot, tavsif (`STORE.md`), App Privacy javoblari → **Submit for Review**.

---

## Kompyuterda ishlash (ixtiyoriy, HP Envy)
1. Node.js 22 LTS (https://nodejs.org) va Android Studio (Otter 2025.2.1 yoki yangisi) oʻrnating.
2. Loyiha papkasida terminal: `npm install` → `npx cap sync android` → `npx cap open android`.
3. Telefoningizni USB orqali ulang (Developer options → USB debugging) va Android Studio’da ▶ Run.

## Yangilash
- Ilovani oʻzgartirish: `docs/` dagi fayllarni tahrirlang → GitHub’ga yuboring → Android avtomatik qayta yigʻiladi, iOS uchun Codemagic’da yangi build.
- Rasmiy narxlar: `docs/ref.json` ni har hafta narx.stat.uz maʼlumoti bilan yangilang (format oʻzgarmaydi).

## Telefon ilovasida nima qoʻshilgan
- Telefonning oʻz kamerasi va galereya tanlagichi (Capacitor Camera).
- GPS orqali joylashuv, faqat ilova ochiq paytda (Capacitor Geolocation).
- Natijani Telegram va boshqa ilovalarga ulashish (Capacitor Share).
- Har dushanba narx eslatmasi (Capacitor Local Notifications).
- Internetsiz ishlash: xabarlar navbatga qoʻyilib, internet qaytganda yuboriladi.

## Texnik maʼlumot
Capacitor 8.6 · Android: minSdk 24, targetSdk 36 · iOS 15+, faqat iPhone, Swift Package Manager · Node.js 22+.
