# NarxRadar 2.2.1: rasmiy narxlarni telefon yangilaydi

## Nega
narx.stat.uz chet eldagi serverlarga (GitHub, AQSh) ochilmaydi, O'zbekistondagi telefonga esa ochiladi. Shuning uchun rasmiy narxlarni endi sizning telefoningiz yuklaydi:
- ilova ochilganda, 12 soatda bir marta yangi hafta chiqqan-chiqmaganini tekshiradi;
- yangi hafta bo'lsa, faylni yuklab olib serverga yozadi;
- boshqa foydalanuvchilar tayyor narxni serverdan oladi.

GitHub'dagi "Rasmiy narxlar" ishi endi o'zi ishga tushmaydi, shuning uchun xato xatlari ham kelmaydi.

## Tartib (muhim)
1. **Avval** 2.2 APK'ni telefonga o'rnating (Actions → Android ilova → NarxRadar 2.2 → NarxRadar-test-apk). Eski ilovani o'chirib o'rnating va bir marta oching.
2. **Keyin** bu arxivdagi `docs`, `.github`, `tools` ni NarxRadar papkasiga ko'chiring (Replace) → commit `NarxRadar 2.2.1` → **Push origin**.
3. 3–5 daqiqa kuting. Ilovani yoping va qayta oching. Bosh sahifada **"Yangi versiya tayyor → Yangilash"** chiqishi kerak. Bosing.
   - Bu avtomatik yangilanishning birinchi haqiqiy sinovi.
   - Profil → Versiya qatorida **2.2.1** ko'rinishi kerak.
4. Profil → **Versiya** qatorini 4 soniya ichida 7 marta bosing → "Ishlab chiquvchi rejimi yoqildi".
5. Pastda **Rasmiy narxlar (narx.stat.uz)** bo'limi chiqadi:
   - **Parol** maydoniga Netlify'dagi ADMIN_KEY ni yozing;
   - **Rasmiy narxlarni hozir yangilash** ni bosing;
   - 1–2 daqiqada "Rasmiy narxlar yangilandi: 2026-11-11, 2026-11-04, 2025-11-12" xabari chiqishi kerak.
6. Narxlar → Mol go'shti → "tumanlarida odatda: … so'm" qatori ko'rinishi kerak.

Parol faqat sizning telefoningizda saqlanadi. Telefonni boshqaga bersangiz, shu bo'limdagi "Parolni telefondan o'chirish" ni bosing.

## Ishlamasa
- 3-qadamda banner chiqmasa: ilovani 1–2 marta yopib-oching. Baribir chiqmasa, menga yozing.
- 5-qadamda "narx.stat.uz ga ulanib bo'lmadi" chiqsa: kompyuterdan `narxradar.netlify.app/admin.html` orqali qo'lda yuklang (2.2 ko'rsatmasidagi kabi).
