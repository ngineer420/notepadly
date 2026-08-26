/* blanknotepad.com - service worker registration.
 * Every page loads this file. The worker at /sw.js precaches the site so
 * that each page opens without a network connection.
 */
(function () {
  "use strict";
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function () {
      /* The registration failed. The site still works online. */
    });
  });
})();
