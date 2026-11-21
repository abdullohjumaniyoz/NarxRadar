# NarxRadar 2.2: rasmiy narxlar avtomatik, narxlar aniqroq

Bu arxivda 2.0.1, 2.1 va 2.2 dagi o'zgarishlarning hammasi bor. Oldingi arxivlarni yuklamagan bo'lsangiz, faqat shuni ishlating.

## Nima o'zgardi

### Rasmiy narxlar endi o'zi yangilanadi
- **Manba:** Milliy statistika qo'mitasining ochiq ma'lumoti, ya'ni [narx.stat.uz/data](https://narx.stat.uz/data) → "To'liq narx to'plami" (CSV).
- **Qanday ishlaydi:** GitHub har seshanba, payshanba va shanba kuni yangi haftani tekshiradi. Yangi hafta chiqqan bo'lsa, uni NarxRadar serveriga yozadi. Ilovalar keyingi ochilishda yangi narxni oladi.
  - Bu Netlify kreditini sarflamaydi.
  - Ilovani yangilash shart emas.
- **Endi tuman darajasidagi ma'lumot ham ishlatiladi:**
  - Mahsulot sahifasida "Toshkent sh. tumanlarida odatda: 132 883–142 677 so'm" ko'rinishida tumanlardagi odatiy narx oralig'i chiqadi.
  - "Adolatli narx" chegarasi qo'lda tanlangan ±10% emas. U har bir viloyat va mahsulot uchun tumanlardagi haqiqiy tarqoqlikdan hisoblanadi (6–25%).
  - Haftalik va yillik o'zgarish rasmiy fayllardan hisoblanadi.
- **Zaxira yo'li:** narx.stat.uz chet eldan ochilmasa (GitHub serverlari AQShda), faylni `narxradar.netlify.app/admin.html` sahifasidan qo'lda yuklaysiz. Bu haftasiga 1 daqiqa vaqt oladi.

### Foydalanuvchilar yuborgan narxlar aniqroq
- **Tasdiqlash oynasi.** Rasm o'qilgandan keyin "To'g'ri o'qildimi?" oynasi chiqadi: mahsulot, narx va qadoq hajmini bir qarashda tekshirib, kerak bo'lsa tuzatasiz.
- **Xato raqam ogohlantirishi.** Narx odatdagidan 2,2 baravar yuqori yoki 2 baravardan ko'proq past bo'lsa, ilova ogohlantiradi, masalan: "11,5 baravar qimmat, raqamni yoki qadoq hajmini tekshiring". Ko'pincha bu 5 litrlik idish yoki ortiqcha nol bo'ladi.
- **Bir telefon, bir ovoz.** Bir telefondan bir hafta ichida bir mahsulotga 10 marta yuborilsa ham, u bitta ovoz bo'lib hisoblanadi. Xalq narxi uchun kamida 3 xil telefondan xabar kerak. Bu bitta odam narxni "sindirishi"ning oldini oladi.
  - Telefon kodi telefondan chiqmaydi va foydalanuvchini aniqlamaydi.
- **Qattiqroq tekshiruv.** Narx rasmiy kuzatuvdagi eng past va eng yuqori tuman narxidan juda uzoq bo'lsa, umumiy hisobga kirmaydi. Bu tekshiruv serverda ham takrorlanadi.

### 2.1 dagi o'zgarishlar
- Ilovani o'chirmasdan yangilash va avtomatik yangilanish.
- Yangi interfeys, Profil bo'limi, orqaga tugmasi (Android).

## 1-qadam: parollar (bir marta)
1. **Netlify:** narxradar → **Project configuration** → **Environment variables** → **Add a variable**.
   - Key: `ADMIN_KEY`
   - Value: o'zingiz o'ylab topgan, kamida 12 belgili parol.
   - Agar 2.0.1 da qo'ygan bo'lsangiz, bu qadamni o'tkazib yuboring.
2. **GitHub:** NarxRadar repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
   - Name: `NARX_ADMIN_KEY`
   - Secret: **xuddi shu parol**.
3. Bu parolni hech kimga bermang, Claude'ga ham yozmang.

## 2-qadam: fayllarni almashtirish
1. `narxradar-2.2-yangilash.zip` ni oching (**Extract All**).
2. Ichidagi hamma narsani NarxRadar papkasiga ko'chiring:
   - `docs`, `netlify`, `android`, `.github`, `tools` papkalari;
   - `netlify.toml`, `package.json`, `package-lock.json`, `capacitor.config.json`, `.gitignore` fayllari.
3. Windows so'raganda **Replace the files in the destination** ni tanlang.
4. GitHub Desktop → Summary: `NarxRadar 2.2` → **Commit to main** → **Push origin**. Bu 15 kredit.

## 3-qadam: rasmiy narxlarni birinchi marta yuklash
1. GitHub → **Actions** → chapda **Rasmiy narxlar** → **Run workflow** → **Run workflow**.
2. 1–2 daqiqadan keyin ishni oching. Bitta qadam bor: **"narx.stat.uz dan olish va serverga yuklash"**.
3. **Yashil belgi** chiqsa: `✓ 2026-11-11: 30 ta mahsulot yuklandi` kabi qatorlar ko'rinadi.
   - Pastroqdagi "Respublika narxi" qatorini [narx.stat.uz/prices](https://narx.stat.uz/prices) bilan solishtiring. Masalan, 11-noyabr uchun Guruch 14 999, Mol go'shti 125 891, Kartoshka 5 105 bo'lishi kerak.
   - Farq 1% dan katta bo'lsa, menga yozing.
4. **Qizil belgi** va "narx.stat.uz ga ulanib bo'lmadi" chiqsa, sayt chet eldan ochilmayapti. Unda qo'lda yuklang:
   - kompyuteringizda [narx.stat.uz/data](https://narx.stat.uz/data) ni oching;
   - haftani tanlab, "To'liq narx to'plami" → **Yuklab olish** ni bosing;
   - birinchi marta 3 ta fayl yuklang: oxirgi hafta, undan oldingi hafta va bir yil oldingi hafta (masalan, 11.11.2026, 04.11.2026 va 12.11.2025);
   - `https://narxradar.netlify.app/admin.html` ni oching, parolni kiriting, fayllarni tanlab **Yuklash** ni bosing;
   - keyingi haftalarda faqat yangi haftani yuklaysiz.

## 4-qadam: telefon (oxirgi marta o'chirib o'rnatish)
1. Actions → **Android ilova** → oxirgi ish → **NarxRadar-test-apk** ni yuklab oling.
2. Eski NarxRadar'ni o'chiring va yangisini o'rnating. Keyingi safarlar o'chirish kerak bo'lmaydi.
3. Sinab ko'ring:
   - narx yorlig'ini rasmga oling → "To'g'ri o'qildimi?" oynasi chiqishi kerak;
   - Narxlar → Mol go'shti → "tumanlarida odatda: … so'm" qatori ko'rinishi kerak (3-qadamdan keyin).

## Hali qo'lda qoladiganlar
- **Supermarket narxlari** (narxtahlil.uz): saytda ochiq yuklab olish yo'q, hozirgi ma'lumot 20-noyabr holatiga. Ularni qanday yangilashni alohida hal qilamiz.
- **Xalq narxlari** (yoqilg'i, sut mahsulotlari va boshqalar) faqat foydalanuvchi xabarlaridan chiqadi: qancha ko'p xabar bo'lsa, shuncha aniq.
