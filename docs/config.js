/* NarxRadar sozlamasi.
   Telefon ilovasi (Android/iOS) serverga toʻliq manzil orqali ulanadi.
   Netlify'ga joylagandan keyin quyidagi narxradar soʻzini oʻz sayt nomingizga almashtiring,
   masalan: "https://narxradar.netlify.app/api".
   Saytning oʻzida (brauzerda) "/api" avtomatik ishlatiladi. */
(function () {
  var C = window.Capacitor;
  var native = !!(C && typeof C.isNativePlatform === "function" && C.isNativePlatform());
  window.NARX_API = native ? "https://narxradar.netlify.app/api" : "/api";
})();
