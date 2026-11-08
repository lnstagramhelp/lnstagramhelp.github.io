/* =====================================================================
   SUSTEXPO — Ana JavaScript dosyası
   Dil değiştirme, tema, menü, kaydırma animasyonları, sayaçlar,
   iletişim formu ve harita. Bu dosyayı düzenlemeniz gerekmez:
   metinler ve iletişim bilgileri HTML dosyalarındadır.
   ===================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var body = document.body;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* ---------------------------------------------------------------- DİL */
  var LOCALES = { tr: 'tr-TR', en: 'en-GB', de: 'de-DE' };
  function lang() { return root.getAttribute('data-lang') || 'tr'; }
  // Görünen dildeki metni döndürür (lang etiketli alt öğelerden)
  function visibleText(el) {
    if (!el) return '';
    var l = el.querySelector('[lang="' + lang() + '"]');
    return (l || el).textContent.replace(/\s+/g, ' ').trim();
  }
  window.SX = { visibleText: visibleText, lang: lang };

  function applyAttrTranslations(l) {
    $$('[data-tr]').forEach(function (el) {
      var v = el.getAttribute('data-' + l) || el.getAttribute('data-tr');
      var tag = el.tagName;
      if (tag === 'TITLE') { document.title = v; return; }
      if (tag === 'META') { el.setAttribute('content', v); return; }
      if (tag === 'OPTION') { el.textContent = v; return; }
      var attr = el.getAttribute('data-i18n-attr') || ((tag === 'INPUT' || tag === 'TEXTAREA') ? 'placeholder' : 'aria-label');
      el.setAttribute(attr, v);
    });
  }
  function movePill(group) {
    var pill = $('.lang__pill', group), on = $('[aria-pressed="true"]', group);
    if (!pill || !on) return;
    pill.style.width = on.offsetWidth + 'px';
    pill.style.transform = 'translateX(' + on.offsetLeft + 'px)';
  }
  function setLang(l, save) {
    root.setAttribute('data-lang', l);
    root.setAttribute('lang', l);
    if (save) store('sx-lang', l);
    applyAttrTranslations(l);
    $$('[data-set-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-set-lang') === l)); });
    $$('.lang').forEach(movePill);
    $$('[data-count].is-counted').forEach(function (el) { el.textContent = fmt(parseFloat(el.getAttribute('data-count'))); });
    document.dispatchEvent(new CustomEvent('sx:lang', { detail: l }));
  }
  $$('[data-set-lang]').forEach(function (b) {
    b.addEventListener('click', function () { setLang(b.getAttribute('data-set-lang'), true); });
  });

  /* ---------------------------------------------------------------- TEMA */
  var metaTheme = $('meta[name="theme-color"]');
  function setTheme(t, save) {
    root.classList.add('theme-anim');
    root.setAttribute('data-theme', t);
    if (save) store('sx-theme', t);
    if (metaTheme) metaTheme.setAttribute('content', t === 'dark' ? '#0E0E0F' : '#F4F1EB');
    clearTimeout(setTheme.t);
    setTheme.t = setTimeout(function () { root.classList.remove('theme-anim'); }, 650);
  }
  $$('.theme-toggle').forEach(function (b) {
    b.addEventListener('click', function () { setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true); });
  });
  if (metaTheme) metaTheme.setAttribute('content', root.getAttribute('data-theme') === 'dark' ? '#0E0E0F' : '#F4F1EB');

  /* ---------------------------------------------------------------- MENÜ */
  var menuBtn = $('.menu-btn');
  function closeMenu() { body.classList.remove('menu-open'); if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false'); }
  if (menuBtn) {
    menuBtn.addEventListener('click', function () {
      var open = !body.classList.contains('menu-open');
      body.classList.toggle('menu-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      if (open) $$('.mnav .lang').forEach(movePill);
    });
    $$('.mnav a').forEach(function (a) { a.addEventListener('click', closeMenu); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  }

  /* ---------------------------------------------------------------- SÜZÜLEN KAYDIRMA
     Fare tekerleği ve sayfa içi bağlantılar (#hizmetler gibi) sayfayı yumuşakça,
     süzülerek kaydırır. Dokunmatik ekranlar kendi doğal kaydırmasını kullanır;
     "hareketi azalt" ayarı açık cihazlarda bu özellik kapalıdır.
     Süzülme hızını değiştirmek için GLIDE değerini ayarlayın (0.06 = daha yavaş, 0.15 = daha hızlı). */
  var GLIDE = 0.09;
  var smooth = (function () {
    var api = { to: function (y) { window.scrollTo(0, y); }, active: false };
    if (reduce) return api;
    root.style.scrollBehavior = 'auto';
    var cur = window.scrollY, tgt = cur, running = false, lastSet = cur, lastT = 0;
    function maxY() { return Math.max(0, document.documentElement.scrollHeight - window.innerHeight); }
    function frame(t) {
      if (!running) return;
      var dt = lastT ? Math.min(64, t - lastT) : 16.7;
      lastT = t;
      cur += (tgt - cur) * (1 - Math.pow(1 - GLIDE, dt / 16.7));
      if (Math.abs(tgt - cur) < 0.5) cur = tgt;
      window.scrollTo(0, cur);
      lastSet = window.scrollY;
      if (cur !== tgt) requestAnimationFrame(frame); else { running = false; lastT = 0; }
    }
    function start() { if (!running) { running = true; lastT = 0; requestAnimationFrame(frame); } }
    function blocked() { return body.classList.contains('lb-open') || body.classList.contains('menu-open'); }
    // fare kendi içinde kayabilen bir kutunun üzerindeyse (ör. uzun mesaj kutusu) ona dokunma
    function scrollsInside(el, dy) {
      for (; el && el !== body && el !== root; el = el.parentElement) {
        if (el.nodeType !== 1) continue;
        var oy = getComputedStyle(el).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
          if (dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0) return true;
        }
      }
      return false;
    }
    window.addEventListener('wheel', function (e) {
      if (e.defaultPrevented || e.ctrlKey || blocked()) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (scrollsInside(e.target, e.deltaY)) return;
      e.preventDefault();
      var d = e.deltaY * (e.deltaMode === 1 ? 40 : (e.deltaMode === 2 ? window.innerHeight : 1));
      if (!running) cur = tgt = window.scrollY;
      tgt = clamp(tgt + d, 0, maxY());
      start();
    }, { passive: false });
    // klavye, kaydırma çubuğu veya dokunmatik ile yapılan kaydırmayı takip et
    window.addEventListener('scroll', function () {
      if (!running) { cur = tgt = window.scrollY; return; }
      if (Math.abs(window.scrollY - lastSet) > 3) { running = false; lastT = 0; cur = tgt = window.scrollY; }
    }, { passive: true });
    window.addEventListener('resize', function () { tgt = clamp(tgt, 0, maxY()); });
    api.to = function (y) { if (!running) cur = window.scrollY; tgt = clamp(y, 0, maxY()); start(); };
    api.active = true;
    return api;
  })();
  window.SX.scrollTo = smooth.to;

  // Sayfa içi bağlantılar (#...) süzülerek kayar
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var id = decodeURIComponent(a.getAttribute('href').slice(1));
    var el = id && document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    var pad = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
    smooth.to(el.getBoundingClientRect().top + window.scrollY - pad);
    if (id !== 'top') { try { history.replaceState(null, '', '#' + id); } catch (err) {} }
    if (!el.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  });

  /* ---------------------------------------------------------------- KELİMELERE BÖLME */
  function splitInto(el, cls, inner) {
    var groups = $$('[lang]', el);
    if (!groups.length) groups = [el];
    groups.forEach(function (g) {
      var i = 0;
      (function walk(node) {
        Array.prototype.slice.call(node.childNodes).forEach(function (ch) {
          if (ch.nodeType === 3) {
            var parts = ch.textContent.split(/(\s+)/), frag = document.createDocumentFragment();
            parts.forEach(function (p) {
              if (!p) return;
              if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
              var w = document.createElement('span');
              w.className = cls;
              if (inner) {
                var wi = document.createElement('span');
                wi.className = 'wi';
                wi.style.setProperty('--i', i);
                wi.textContent = p;
                w.appendChild(wi);
              } else { w.textContent = p; }
              i++;
              frag.appendChild(w);
            });
            ch.parentNode.replaceChild(frag, ch);
          } else if (ch.nodeType === 1 && ch.tagName !== 'BR') { walk(ch); }
        });
      })(g);
    });
  }
  $$('[data-split]').forEach(function (el) { splitInto(el, 'w', true); el.classList.add('split'); });
  var statements = $$('[data-words]');
  statements.forEach(function (el) { splitInto(el, 'word', false); });

  /* ---------------------------------------------------------------- GÖRÜNÜNCE BELİRME */
  if ('IntersectionObserver' in window && !reduce) {
    // "clip" ile açılan öğeler başta tamamen kırpılı olduğu için onların kapsayıcısı izlenir
    var targets = new Map();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        (targets.get(e.target) || []).forEach(function (t) { t.classList.add('is-in'); });
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.01 });
    $$('[data-reveal], .split').forEach(function (el) {
      var watch = el.getAttribute('data-reveal') === 'clip' ? el.parentElement : el;
      if (!targets.has(watch)) targets.set(watch, []);
      targets.get(watch).push(el);
      io.observe(watch);
    });
  } else {
    $$('[data-reveal], .split').forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------------------------------------------------------------- SAYAÇLAR */
  function fmt(n) { try { return new Intl.NumberFormat(LOCALES[lang()] || 'tr-TR').format(n); } catch (e) { return String(n); } }
  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-count')) || 0;
    if (reduce) { el.textContent = fmt(target); el.classList.add('is-counted'); return; }
    var start = null, dur = 1900;
    (function step(t) {
      if (!start) start = t;
      var p = Math.min(1, (t - start) / dur), e = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt(Math.round(target * e));
      if (p < 1) requestAnimationFrame(step); else el.classList.add('is-counted');
    })(performance.now());
  }
  var counters = $$('[data-count]');
  counters.forEach(function (el) { el.textContent = fmt(0); });
  if ('IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { countUp(e.target); cio.unobserve(e.target); } });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { cio.observe(el); });
  } else counters.forEach(countUp);

  /* ---------------------------------------------------------------- KAYAN BANTLAR (kopyalayıp sonsuz döngü)
     İş ortakları: HTML'deki tek logo listesinden ikinci (ters yönde akan) sıra otomatik üretilir. */
  var partners = $('[data-partners]');
  if (partners) {
    var row1 = $('.logo-row', partners), set1 = row1 && row1.firstElementChild;
    if (set1 && set1.children.length) {
      var row2 = document.createElement('div');
      row2.className = 'logo-row logo-row--rev';
      row2.setAttribute('aria-hidden', 'true');
      var set2 = document.createElement('div');
      set2.className = 'logo-set';
      Array.prototype.slice.call(set1.children).reverse().forEach(function (c) { set2.appendChild(c.cloneNode(true)); });
      row2.appendChild(set2);
      partners.appendChild(row2);
    }
  }
  $$('.marquee__track, .logo-row').forEach(function (track) {
    var first = track.firstElementChild;
    if (!first) return;
    var base = Array.prototype.slice.call(first.children), guard = 0;
    while (first.scrollWidth < window.innerWidth * 1.15 && base.length && guard++ < 8) {
      base.forEach(function (c) { var k = c.cloneNode(true); k.setAttribute('aria-hidden', 'true'); first.appendChild(k); });
    }
    var clone = first.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    $$('a, button', clone).forEach(function (x) { x.setAttribute('tabindex', '-1'); });
    track.appendChild(clone);
  });
  // WhatsApp numarası tek yerden ([data-wa-link]) diğer butonlara kopyalanır
  var waSrc = $('[data-wa-link]');
  $$('[data-wa-copy]').forEach(function (a) { if (waSrc) a.setAttribute('href', waSrc.getAttribute('href')); });

  /* ---------------------------------------------------------------- KAYDIRMA: menü, ilerleme, paralaks, süreç */
  var header = $('.header');
  var line = $('.scroll-line');
  var parallax = $$('[data-parallax]');
  var proc = $('[data-process]');
  var procTrack = proc ? $('.process__track', proc) : null;
  var lastY = window.scrollY, ticking = false;
  // yatay kayan süreç kartları hedef konumu yumuşakça takip eder
  var procCur = null, procTgt = 0, procMax = 1, procRunning = false;
  function paintProc() {
    procTrack.style.transform = 'translate3d(' + procCur.toFixed(1) + 'px,0,0)';
    proc.style.setProperty('--pp', procMax > 0 ? (-procCur / procMax).toFixed(4) : '0');
  }
  function procFrame() {
    procCur += (procTgt - procCur) * 0.13;
    if (Math.abs(procTgt - procCur) < 0.3) procCur = procTgt;
    paintProc();
    if (procCur !== procTgt && window.innerWidth >= 981) requestAnimationFrame(procFrame); else procRunning = false;
  }

  function sizeProcess() {
    if (!proc || !procTrack) return;
    if (window.innerWidth < 981) { proc.style.height = ''; procTrack.style.transform = ''; procCur = null; return; }
    var max = Math.max(0, procTrack.scrollWidth - window.innerWidth);
    proc.style.height = (window.innerHeight + max * 1.15 + window.innerHeight * 0.25) + 'px';
  }
  function onScroll() {
    ticking = false;
    var y = window.scrollY, vh = window.innerHeight;
    if (header) {
      header.classList.toggle('is-scrolled', y > 20);
      var hide = y > lastY && y > 300 && !body.classList.contains('menu-open') && !body.classList.contains('lb-open');
      if (Math.abs(y - lastY) > 4) { header.classList.toggle('is-hidden', hide); body.classList.toggle('header-hidden', hide); }
    }
    lastY = y;
    if (line) {
      var h = document.documentElement.scrollHeight - vh;
      line.style.transform = 'scaleX(' + (h > 0 ? y / h : 0).toFixed(4) + ')';
    }
    if (!reduce) {
      parallax.forEach(function (el) {
        var box = el.parentElement.getBoundingClientRect();
        if (box.bottom < -100 || box.top > vh + 100) return;
        var f = parseFloat(el.getAttribute('data-parallax')) || 0.12;
        var extra = Math.max(0, el.offsetHeight - el.parentElement.offsetHeight) / 2;
        var c = (box.top + box.height / 2 - vh / 2) * f;
        el.style.transform = 'translate3d(0,' + clamp(-c, -extra, extra).toFixed(1) + 'px,0)';
      });
    }
    if (proc && procTrack && window.innerWidth >= 981) {
      var r = proc.getBoundingClientRect(), total = proc.offsetHeight - vh;
      var p = total > 0 ? clamp(-r.top / total, 0, 1) : 0;
      var max = Math.max(0, procTrack.scrollWidth - window.innerWidth);
      procMax = max;
      procTgt = -max * clamp((p - 0.06) / 0.88, 0, 1);
      if (reduce || procCur === null) { procCur = procTgt; paintProc(); }
      else if (!procRunning) { procRunning = true; requestAnimationFrame(procFrame); }
    }
    statements.forEach(function (el) {
      var b = el.getBoundingClientRect();
      if (b.bottom < 0 || b.top > vh) return;
      var prog = reduce ? 1 : clamp((vh * 0.82 - b.top) / (b.height + vh * 0.3), 0, 1);
      $$('[lang]', el).concat($$('[lang]', el).length ? [] : [el]).forEach(function (g) {
        var words = g.querySelectorAll('.word'), n = Math.round(prog * words.length);
        for (var i = 0; i < words.length; i++) words[i].classList.toggle('on', i < n);
      });
    });
  }
  function requestScroll() { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }
  window.addEventListener('scroll', requestScroll, { passive: true });
  window.addEventListener('resize', function () { sizeProcess(); $$('.lang').forEach(movePill); requestScroll(); });
  document.addEventListener('sx:lang', function () { setTimeout(function () { sizeProcess(); requestScroll(); }, 50); });

  /* ---------------------------------------------------------------- AKTİF MENÜ BAĞLANTISI */
  var navLinks = $$('.nav a[href^="#"]');
  if (navLinks.length && 'IntersectionObserver' in window) {
    var map = {};
    navLinks.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var nio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          navLinks.forEach(function (a) { a.classList.remove('is-active'); });
          if (map[e.target.id]) map[e.target.id].classList.add('is-active');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(map).forEach(function (id) { var s = document.getElementById(id); if (s) nio.observe(s); });
  }

  /* ---------------------------------------------------------------- ÖZEL İMLEÇ */
  var cursor = $('.cursor');
  if (cursor && window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reduce) {
    root.classList.add('has-cursor');
    var dot = $('.cursor__dot', cursor), ring = $('.cursor__ring', cursor);
    var mx = -100, my = -100, rx = -100, ry = -100;
    window.addEventListener('mousemove', function (e) { mx = e.clientX; my = e.clientY; cursor.classList.remove('is-hidden'); }, { passive: true });
    document.addEventListener('mouseleave', function () { cursor.classList.add('is-hidden'); });
    document.addEventListener('mouseover', function (e) {
      var t = e.target;
      var view = t.closest && t.closest('[data-cursor="view"], .g-item');
      var link = !view && t.closest && t.closest('a, button, [role="button"], input, select, textarea, label');
      cursor.classList.toggle('is-view', !!view);
      cursor.classList.toggle('is-link', !!link);
    });
    (function loop() {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
      ring.style.transform = 'translate3d(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px,0)';
      requestAnimationFrame(loop);
    })();
  }

  /* ---------------------------------------------------------------- İLETİŞİM FORMU
     Sitenin sunucusu olmadığı için form, mesajı hazırlayıp ziyaretçinin
     e-posta uygulamasını veya WhatsApp'ı açar. E-posta adresi ve WhatsApp
     numarası, HTML'deki [data-email-link] ve [data-wa-link] bağlantılarından okunur. */
  var form = $('[data-contact-form]');
  if (form) {
    var status = $('.form__status', form);
    var msgs = $('[data-messages]', form);
    function msg(key) { return visibleText(msgs && $('[data-msg="' + key + '"]', msgs)); }
    form.addEventListener('submit', function (e) { e.preventDefault(); send('mail'); });
    $$('[data-send]', form).forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); send(b.getAttribute('data-send')); });
    });
    function send(via) {
      var ok = true, lines = [];
      $$('.field', form).forEach(function (f) {
        var input = $('input, select, textarea', f);
        if (!input) return;
        var v = (input.tagName === 'SELECT' ? (input.options[input.selectedIndex] || {}).text || '' : input.value).trim();
        if (input.tagName === 'SELECT' && !input.value) v = '';
        var bad = input.hasAttribute('required') && !v;
        f.classList.toggle('is-invalid', bad);
        if (bad) ok = false;
        if (v) lines.push(visibleText($('label', f)) + ': ' + v);
      });
      if (!ok) { status.textContent = msg('invalid'); return; }
      var service = $('select', form);
      var subject = 'SUSTEXPO' + (service && service.value ? ' – ' + service.options[service.selectedIndex].text : '');
      var text = lines.join('\n');
      if (via === 'wa') {
        var wa = $('[data-wa-link]');
        var num = wa ? (wa.getAttribute('href').match(/\d{6,}/) || [''])[0] : '';
        window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(subject + '\n\n' + text), '_blank', 'noopener');
        status.textContent = msg('wa');
      } else {
        var ml = $('[data-email-link]');
        var addr = ml ? ml.getAttribute('href').replace(/^mailto:/i, '').split('?')[0] : '';
        window.location.href = 'mailto:' + addr + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
        status.textContent = msg('mail');
      }
    }
    $$('input, textarea', form).forEach(function (i) { i.addEventListener('input', function () { i.closest('.field').classList.remove('is-invalid'); }); });
  }

  /* ---------------------------------------------------------------- HARİTA (tıklayınca yüklenir) */
  var mapBox = $('[data-map]');
  if (mapBox) {
    var q = mapBox.getAttribute('data-map');
    var dir = $('[data-map-directions]');
    if (dir) dir.setAttribute('href', 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q));
    var loadBtn = $('[data-map-load]', mapBox);
    if (loadBtn) loadBtn.addEventListener('click', function () {
      var f = document.createElement('iframe');
      f.src = 'https://www.google.com/maps?q=' + encodeURIComponent(q) + '&hl=' + lang() + '&output=embed';
      f.loading = 'lazy';
      f.referrerPolicy = 'no-referrer-when-downgrade';
      f.title = 'Google Maps';
      mapBox.appendChild(f);
      var ph = $('.map__ph', mapBox); if (ph) ph.style.display = 'none';
    });
  }

  /* ---------------------------------------------------------------- DİĞER */
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  var pre = $('.preloader');
  var t0 = performance.now();
  function donePre() {
    if (pre) setTimeout(function () { pre.classList.add('is-done'); }, Math.max(0, 950 - (performance.now() - t0)));
    try { sessionStorage.setItem('sx-loaded', '1'); } catch (e) {}
  }
  if (document.readyState === 'complete') donePre(); else window.addEventListener('load', donePre);
  setTimeout(function () { if (pre) pre.classList.add('is-done'); }, 3500);

  setLang(lang(), false);
  sizeProcess();
  onScroll();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { $$('.lang').forEach(movePill); sizeProcess(); });
})();
