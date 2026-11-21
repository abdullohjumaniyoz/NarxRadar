/* NarxRadar sozlamasi: telefon ilovasi (Android/iOS) serverga toʻliq manzil orqali ulanadi.
   Saytning oʻzida (brauzerda) "/api" avtomatik ishlatiladi. */
(function () {
  var C = window.Capacitor;
  var native = !!(C && typeof C.isNativePlatform === "function" && C.isNativePlatform());
  window.NARX_API = native ? "https://narxradar.netlify.app/api" : "/api";
})();
