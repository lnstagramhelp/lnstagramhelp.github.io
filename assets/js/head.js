/* SUSTEXPO — Sayfa görünmeden önce dili ve temayı ayarlar (ekranın yanıp sönmesini önler).
   Bu dosyayı düzenlemeniz gerekmez. Varsayılan dil ayarı: index.html içindeki <html ... data-default-lang="en"> */
(function () {
  var d = document.documentElement;
  d.className += ' js';
  var langs = (d.getAttribute('data-langs') || 'tr,en,de').split(',');
  var fallback = d.getAttribute('data-default-lang') || 'en';
  var lang = null, theme = null;
  try { lang = localStorage.getItem('sx-lang'); theme = localStorage.getItem('sx-theme'); } catch (e) {}
  var q = /[?&]lang=([a-z]{2})/.exec(location.search);
  if (q && langs.indexOf(q[1]) > -1) lang = q[1];
  if (!lang || langs.indexOf(lang) < 0) {
    lang = null;
    var list = navigator.languages || [navigator.language || ''];
    for (var i = 0; i < list.length && !lang; i++) {
      var c = String(list[i]).slice(0, 2).toLowerCase();
      if (langs.indexOf(c) > -1) lang = c;
    }
    if (!lang) lang = fallback;
  }
  d.setAttribute('data-lang', lang);
  d.setAttribute('lang', lang);
  if (theme !== 'light' && theme !== 'dark') {
    theme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
  }
  d.setAttribute('data-theme', theme);
  try { if (sessionStorage.getItem('sx-loaded')) d.className += ' no-preload'; } catch (e) {}
})();
