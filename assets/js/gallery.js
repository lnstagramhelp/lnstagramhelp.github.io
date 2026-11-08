/* =====================================================================
   SUSTEXPO — Galeri: kategori filtreleri, mozaik düzen ve tam ekran
   görüntüleyici (lightbox). Bu dosyayı düzenlemeniz gerekmez.
   Yeni görsel eklemek için galeri.html içindeki bir <figure> bloğunu
   kopyalamanız yeterli; sayılar, numaralar ve görüntüleyici otomatik
   güncellenir.
   ===================================================================== */
(function () {
  'use strict';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EASE = 'cubic-bezier(.16,1,.3,1)';
  var SX = window.SX || { visibleText: function (el) { return el ? el.textContent.trim() : ''; }, lang: function () { return 'tr'; } };
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  // main.js'teki süzülen kaydırmayı kullanır (yoksa tarayıcının yumuşak kaydırması)
  function scrollToY(y) {
    if (SX.scrollTo) SX.scrollTo(y);
    else window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  }

  var grids = $$('[data-gallery]');
  if (!grids.length) return;

  var ICON = {
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    zoom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M11 8.5v5M8.5 11h5"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a.6.6 0 0 0 .9.5l10.2-6.5a.6.6 0 0 0 0-1L8.9 5a.6.6 0 0 0-.9.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>'
  };
  var UI = {
    tr: { close: 'Kapat', prev: 'Önceki', next: 'Sonraki', zoom: 'Yakınlaştır', play: 'Slayt gösterisi', dialog: 'Görsel görüntüleyici' },
    en: { close: 'Close', prev: 'Previous', next: 'Next', zoom: 'Zoom', play: 'Slideshow', dialog: 'Image viewer' },
    de: { close: 'Schließen', prev: 'Zurück', next: 'Weiter', zoom: 'Vergrößern', play: 'Diashow', dialog: 'Bildbetrachter' }
  };
  function ui(k) { return (UI[SX.lang()] || UI.tr)[k]; }

  /* ---------------------------------------------------------------- öğeleri hazırla */
  function itemsOf(g) { return $$('.g-item', g); }
  function visibleItems(g) { return itemsOf(g).filter(function (it) { return !it.classList.contains('is-hidden'); }); }
  function catLabel(cat) {
    var b = $('[data-filter="' + cat + '"]');
    return b ? SX.visibleText($('.f-label', b) || b) : '';
  }
  function prepare(item) {
    if (item.__sx) return;
    item.__sx = true;
    item.setAttribute('tabindex', '0');
    item.setAttribute('role', 'button');
    var cap = $('figcaption', item);
    if (cap && !$('.g-title', cap)) {
      var title = document.createElement('span');
      title.className = 'g-title';
      while (cap.firstChild) title.appendChild(cap.firstChild);
      var cat = document.createElement('span');
      cat.className = 'g-cat';
      cap.appendChild(cat);
      cap.appendChild(title);
    }
    var num = document.createElement('span'); num.className = 'g-num'; item.appendChild(num);
    var plus = document.createElement('span'); plus.className = 'g-plus'; plus.innerHTML = ICON.plus; item.appendChild(plus);
    var img = $('img', item);
    if (img && !img.complete) {
      img.classList.add('is-loading');
      var done = function () { img.classList.remove('is-loading'); };
      img.addEventListener('load', done); img.addEventListener('error', done);
    }
  }
  function refreshTexts() {
    grids.forEach(function (g) {
      itemsOf(g).forEach(function (it) {
        var t = SX.visibleText($('.g-title', it));
        var img = $('img', it);
        if (img) img.alt = t;
        it.setAttribute('aria-label', t);
        var c = $('.g-cat', it);
        if (c) c.textContent = catLabel(it.getAttribute('data-category'));
      });
    });
  }
  function numberItems(g) {
    var vis = visibleItems(g);
    vis.forEach(function (it, i) { var n = $('.g-num', it); if (n) n.textContent = pad(i + 1) + ' / ' + pad(vis.length); });
  }

  /* ---------------------------------------------------------------- mozaik düzen */
  var PATTERNS = {
    4: ['s-big', 's-tall', '', '', 's-wide', '', '', '', 's-wide', '', 's-tall', '', 's-big', ''],
    3: ['s-big', '', '', '', 's-wide', 's-wide', '', '', 's-big', ''],
    2: ['s-big', '', '', 's-tall', '', '']
  };
  function colCount(g) { return getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length; }
  function applyBento(g) {
    if (!g.hasAttribute('data-bento')) return;
    var pat = PATTERNS[colCount(g)] || PATTERNS[4];
    visibleItems(g).forEach(function (it, i) {
      it.classList.remove('s-big', 's-wide', 's-tall');
      var c = pat[i % pat.length];
      if (c) it.classList.add(c);
    });
    g.__cols = colCount(g);
  }

  /* ---------------------------------------------------------------- filtreleme (FLIP animasyonu) */
  function filter(g, cat, animate) {
    var items = itemsOf(g);
    var match = function (it) { return cat === 'all' || it.getAttribute('data-category') === cat; };
    var first = new Map();
    items.forEach(function (it) { if (!it.classList.contains('is-hidden')) first.set(it, it.getBoundingClientRect()); });
    var leaving = items.filter(function (it) { return !it.classList.contains('is-hidden') && !match(it); });

    function apply() {
      items.forEach(function (it) { it.classList.toggle('is-hidden', !match(it)); });
      applyBento(g);
      numberItems(g);
      var empty = $('.g-empty');
      if (empty) empty.classList.toggle('is-on', !visibleItems(g).length);
      if (!animate || reduce || !g.animate) return;
      visibleItems(g).forEach(function (it, i) {
        var last = it.getBoundingClientRect(), f = first.get(it);
        if (f) {
          var dx = f.left - last.left, dy = f.top - last.top, sx = f.width / last.width, sy = f.height / last.height;
          if (Math.abs(dx) + Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return;
          it.animate([
            { transformOrigin: '0 0', transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')' },
            { transformOrigin: '0 0', transform: 'none' }
          ], { duration: 750, easing: EASE });
        } else {
          it.animate([{ opacity: 0, transform: 'translateY(40px) scale(.96)' }, { opacity: 1, transform: 'none' }],
            { duration: 800, delay: Math.min(i, 14) * 45, easing: EASE, fill: 'backwards' });
        }
      });
    }
    if (animate && !reduce && leaving.length && leaving[0].animate) {
      var anims = leaving.map(function (it) {
        return it.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.94)' }], { duration: 260, easing: 'ease-in', fill: 'forwards' });
      });
      Promise.all(anims.map(function (a) { return a.finished; })).then(function () { apply(); anims.forEach(function (a) { a.cancel(); }); });
    } else apply();
  }

  /* ---------------------------------------------------------------- filtre çubuğu */
  var bar = $('[data-filters]');
  var mainGrid = $('[data-gallery][data-bento]') || grids[0];
  function movePill() {
    if (!bar) return;
    var pill = $('.filters__pill', bar), on = $('[aria-pressed="true"]', bar);
    if (!pill || !on) return;
    pill.style.width = on.offsetWidth + 'px';
    pill.style.transform = 'translateX(' + on.offsetLeft + 'px)';
  }
  if (bar) {
    var btns = $$('[data-filter]', bar);
    var all = itemsOf(mainGrid);
    var catsUsed = 0;
    btns.forEach(function (b) {
      var c = b.getAttribute('data-filter');
      var n = c === 'all' ? all.length : all.filter(function (it) { return it.getAttribute('data-category') === c; }).length;
      var sup = $('sup', b);
      if (!sup) { sup = document.createElement('sup'); b.appendChild(sup); }
      sup.textContent = n;
      if (c !== 'all') { if (n === 0) b.hidden = true; else catsUsed++; }
    });
    $$('[data-g-total]').forEach(function (el) { el.textContent = all.length; });
    $$('[data-g-cats]').forEach(function (el) { el.textContent = catsUsed; });
    function choose(b, animate) {
      btns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      movePill();
      var c = b.getAttribute('data-filter');
      filter(mainGrid, c, animate);
      try { history.replaceState(null, '', c === 'all' ? location.pathname + location.search : '#' + c); } catch (e) {}
      if (b.scrollIntoView && bar.scrollWidth > bar.clientWidth) b.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
    }
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        choose(b, true);
        var top = mainGrid.getBoundingClientRect().top;
        if (top < 0) scrollToY(window.scrollY + top - 160);
      });
    });
    var initial = location.hash ? $('[data-filter="' + location.hash.slice(1) + '"]', bar) : null;
    choose(initial || btns[0], false);
    // footer / dış bağlantılardan gelen #kategori seçimleri
    window.addEventListener('hashchange', function () {
      var b = location.hash ? $('[data-filter="' + location.hash.slice(1) + '"]', bar) : null;
      if (!b) return;
      choose(b, true);
      scrollToY((bar.closest('.filters-wrap') || bar).getBoundingClientRect().top + window.scrollY - 90);
    });

    var wrap = bar.closest('.filters-wrap');
    if (wrap) {
      var onS = function () { wrap.classList.toggle('is-stuck', wrap.getBoundingClientRect().top <= (document.body.classList.contains('header-hidden') ? 1 : 80)); };
      window.addEventListener('scroll', function () { requestAnimationFrame(onS); }, { passive: true });
      onS();
    }
  }

  grids.forEach(function (g) {
    itemsOf(g).forEach(prepare);
    applyBento(g);
    numberItems(g);
  });
  refreshTexts();

  var rT;
  window.addEventListener('resize', function () {
    clearTimeout(rT);
    rT = setTimeout(function () {
      grids.forEach(function (g) { if (g.__cols !== colCount(g)) applyBento(g); });
      movePill();
    }, 120);
  });

  /* ---------------------------------------------------------------- LIGHTBOX */
  var lb = document.createElement('div');
  lb.className = 'lb';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.innerHTML =
    '<div class="lb__backdrop"></div>' +
    '<div class="lb__top"><div class="lb__count"></div><div class="lb__tools">' +
    '<button class="lb__btn" data-lb="zoom" aria-pressed="false">' + ICON.zoom + '</button>' +
    '<button class="lb__btn" data-lb="play" aria-pressed="false">' + ICON.play + '</button>' +
    '<button class="lb__btn" data-lb="close">' + ICON.close + '</button></div></div>' +
    '<div class="lb__stage"><img class="lb__img" alt="" draggable="false">' +
    '<button class="lb__nav lb__nav--prev" data-lb="prev">' + ICON.prev + '</button>' +
    '<button class="lb__nav lb__nav--next" data-lb="next">' + ICON.next + '</button></div>' +
    '<div class="lb__bottom"><div class="lb__caption"><span class="lb__cat"></span><span class="lb__title"></span></div><div class="lb__thumbs"></div></div>' +
    '<div class="lb__progress"><span></span></div>';
  document.body.appendChild(lb);
  var img = $('.lb__img', lb), stage = $('.lb__stage', lb), thumbs = $('.lb__thumbs', lb);
  var countEl = $('.lb__count', lb), catEl = $('.lb__cat', lb), titleEl = $('.lb__title', lb);
  var btnZoom = $('[data-lb="zoom"]', lb), btnPlay = $('[data-lb="play"]', lb), btnClose = $('[data-lb="close"]', lb);
  var progressBar = $('.lb__progress span', lb);
  var S = { list: [], i: 0, open: false, zoom: false, playing: false, anim: null, token: 0, lastFocus: null };

  function labelUI() {
    lb.setAttribute('aria-label', ui('dialog'));
    btnClose.setAttribute('aria-label', ui('close'));
    btnZoom.setAttribute('aria-label', ui('zoom'));
    btnPlay.setAttribute('aria-label', ui('play'));
    $('[data-lb="prev"]', lb).setAttribute('aria-label', ui('prev'));
    $('[data-lb="next"]', lb).setAttribute('aria-label', ui('next'));
  }
  function srcOf(it) { var im = $('img', it); return it.getAttribute('data-full') || (im && (im.currentSrc || im.src)) || ''; }
  function ready(im) {
    return new Promise(function (res) {
      if (im.complete && im.naturalWidth) { (im.decode ? im.decode() : Promise.resolve()).then(res, res); return; }
      im.onload = function () { im.onload = null; (im.decode ? im.decode() : Promise.resolve()).then(res, res); };
      im.onerror = function () { im.onerror = null; res(); };
    });
  }
  function preload(i) { var n = S.list.length; if (!n) return; var it = S.list[(i + n) % n]; var p = new Image(); p.src = srcOf(it); }
  function setCaption() {
    var it = S.list[S.i];
    if (!it) return;
    countEl.innerHTML = '<b>' + pad(S.i + 1) + '</b> / ' + pad(S.list.length);
    catEl.textContent = catLabel(it.getAttribute('data-category'));
    titleEl.textContent = SX.visibleText($('.g-title', it));
    img.alt = titleEl.textContent;
  }
  function buildThumbs() {
    thumbs.innerHTML = '';
    S.list.forEach(function (it, i) {
      var b = document.createElement('button');
      b.className = 'lb__thumb';
      b.setAttribute('aria-label', pad(i + 1) + ' – ' + SX.visibleText($('.g-title', it)));
      var t = document.createElement('img');
      t.src = srcOf(it); t.alt = ''; t.loading = 'lazy';
      b.appendChild(t);
      b.addEventListener('click', function () { go(i); });
      thumbs.appendChild(b);
    });
  }
  function markThumb() {
    $$('.lb__thumb', thumbs).forEach(function (t, i) { t.classList.toggle('is-active', i === S.i); });
    var a = $('.lb__thumb.is-active', thumbs);
    if (a && thumbs.scrollWidth > thumbs.clientWidth) {
      thumbs.scrollTo({ left: a.offsetLeft - thumbs.clientWidth / 2 + a.offsetWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
    }
  }
  function fly(fromRect, toRect, src, radiusFrom, radiusTo) {
    var f = document.createElement('div');
    f.className = 'lb__fly';
    f.style.cssText = 'left:' + fromRect.left + 'px;top:' + fromRect.top + 'px;width:' + fromRect.width + 'px;height:' + fromRect.height + 'px;overflow:hidden;border-radius:' + radiusFrom + 'px';
    var fi = document.createElement('img');
    fi.src = src; fi.alt = '';
    fi.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
    f.appendChild(fi);
    document.body.appendChild(f);
    var a = f.animate([
      { left: fromRect.left + 'px', top: fromRect.top + 'px', width: fromRect.width + 'px', height: fromRect.height + 'px', borderRadius: radiusFrom + 'px' },
      { left: toRect.left + 'px', top: toRect.top + 'px', width: toRect.width + 'px', height: toRect.height + 'px', borderRadius: radiusTo + 'px' }
    ], { duration: 680, easing: EASE, fill: 'forwards' });
    return a.finished.then(function () { return f; });
  }
  function lockScroll(on) {
    var sbw = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.paddingRight = on && sbw > 0 ? sbw + 'px' : '';
    document.body.classList.toggle('lb-open', on);
  }
  function open(list, i, from) {
    S.list = list; S.i = i; S.open = true; S.lastFocus = document.activeElement;
    var token = ++S.token;
    labelUI(); buildThumbs(); setCaption(); markThumb();
    lockScroll(true);
    lb.classList.add('is-open');
    img.style.opacity = '0';
    img.src = srcOf(list[i]);
    ready(img).then(function () {
      if (token !== S.token) return;
      var canFly = !reduce && from && document.body.animate && from.getBoundingClientRect().width > 0;
      if (!canFly) { img.style.opacity = '1'; return; }
      fly(from.getBoundingClientRect(), img.getBoundingClientRect(), img.src, 20, 14).then(function (f) {
        img.style.opacity = '1';
        requestAnimationFrame(function () { f.remove(); });
      });
    });
    preload(i + 1); preload(i - 1);
    setTimeout(function () { btnClose.focus({ preventScroll: true }); }, 60);
  }
  function close() {
    if (!S.open) return;
    stop(); unzoom();
    S.open = false; S.token++;
    var it = S.list[S.i];
    var to = it && it.offsetParent !== null ? it.getBoundingClientRect() : null;
    if (!reduce && to && to.bottom > 0 && to.top < window.innerHeight && document.body.animate && img.naturalWidth) {
      var fr = img.getBoundingClientRect();
      img.style.opacity = '0';
      fly(fr, to, img.src, 14, 20).then(function (f) {
        f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' }).finished.then(function () { f.remove(); });
      });
    }
    lb.classList.remove('is-open');
    lockScroll(false);
    if (S.lastFocus && S.lastFocus.focus) S.lastFocus.focus({ preventScroll: true });
  }
  function go(n) {
    var len = S.list.length;
    if (!len) return;
    n = (n + len) % len;
    if (n === S.i) return;
    var dir = (n > S.i) ? 1 : -1;
    if (S.i === len - 1 && n === 0) dir = 1;
    if (S.i === 0 && n === len - 1) dir = -1;
    S.i = n;
    var token = ++S.token;
    unzoom(); setCaption(); markThumb();
    var src = srcOf(S.list[n]);
    if (reduce || !img.animate) { img.src = src; }
    else {
      var out = img.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(' + (-60 * dir) + 'px)' }], { duration: 200, easing: 'ease-in', fill: 'forwards' });
      out.finished.then(function () {
        if (token !== S.token) return;
        img.src = src;
        return ready(img).then(function () {
          if (token !== S.token) return;
          out.cancel();
          img.animate([{ opacity: 0, transform: 'translateX(' + (60 * dir) + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 480, easing: EASE });
        });
      });
    }
    preload(n + 1); preload(n - 1);
    if (S.playing) restartProgress();
  }
  // zoom
  function setOrigin(x, y) {
    var r = img.getBoundingClientRect();
    var px = Math.min(100, Math.max(0, (x - r.left) / r.width * 100)), py = Math.min(100, Math.max(0, (y - r.top) / r.height * 100));
    img.style.transformOrigin = px + '% ' + py + '%';
  }
  function zoomIn(x, y) {
    S.zoom = true; lb.classList.add('is-zoomed'); btnZoom.setAttribute('aria-pressed', 'true');
    if (x != null) setOrigin(x, y); else img.style.transformOrigin = '50% 50%';
    img.style.transform = 'scale(2.2)';
    stop();
  }
  function unzoom() { S.zoom = false; lb.classList.remove('is-zoomed'); btnZoom.setAttribute('aria-pressed', 'false'); img.style.transform = ''; }
  // slideshow
  function restartProgress() {
    if (S.anim) S.anim.cancel();
    if (!progressBar.animate) return;
    S.anim = progressBar.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 4200, easing: 'linear' });
    S.anim.onfinish = function () { if (S.playing) go(S.i + 1); };
  }
  function play() { S.playing = true; btnPlay.setAttribute('aria-pressed', 'true'); btnPlay.innerHTML = ICON.pause; unzoom(); restartProgress(); }
  function stop() { S.playing = false; btnPlay.setAttribute('aria-pressed', 'false'); btnPlay.innerHTML = ICON.play; if (S.anim) { S.anim.cancel(); S.anim = null; } }

  lb.addEventListener('click', function (e) {
    var b = e.target.closest('[data-lb]');
    if (b) {
      var a = b.getAttribute('data-lb');
      if (a === 'close') close();
      else if (a === 'prev') go(S.i - 1);
      else if (a === 'next') go(S.i + 1);
      else if (a === 'zoom') { if (S.zoom) unzoom(); else zoomIn(); }
      else if (a === 'play') { if (S.playing) stop(); else play(); }
      return;
    }
    if (e.target === stage || e.target.classList.contains('lb__backdrop')) close();
  });
  // pointer: tap = zoom, swipe = next/prev, swipe down = close, move while zoomed = pan
  var ptr = null;
  stage.addEventListener('pointerdown', function (e) {
    if (e.target.closest('[data-lb]')) return;
    ptr = { x: e.clientX, y: e.clientY, onImg: e.target === img };
  });
  stage.addEventListener('pointermove', function (e) { if (S.zoom && (e.pointerType === 'mouse' || ptr)) setOrigin(e.clientX, e.clientY); });
  stage.addEventListener('pointerup', function (e) {
    if (!ptr) return;
    var dx = e.clientX - ptr.x, dy = e.clientY - ptr.y, onImg = ptr.onImg;
    ptr = null;
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
      if (onImg) { if (S.zoom) unzoom(); else zoomIn(e.clientX, e.clientY); }
      return;
    }
    if (S.zoom) return;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(S.i + (dx < 0 ? 1 : -1));
    else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) close();
  });
  stage.addEventListener('pointercancel', function () { ptr = null; });
  document.addEventListener('keydown', function (e) {
    if (!S.open) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowRight') go(S.i + 1);
    else if (e.key === 'ArrowLeft') go(S.i - 1);
    else if (e.key === 'Tab') {
      var f = $$('button', lb).filter(function (b) { return b.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // open from items
  grids.forEach(function (g) {
    g.addEventListener('click', function (e) {
      var it = e.target.closest('.g-item');
      if (!it || !g.contains(it)) return;
      var list = visibleItems(g);
      open(list, list.indexOf(it), it);
    });
    g.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var it = e.target.closest('.g-item');
      if (!it) return;
      e.preventDefault();
      var list = visibleItems(g);
      open(list, list.indexOf(it), it);
    });
  });

  document.addEventListener('sx:lang', function () {
    refreshTexts();
    grids.forEach(numberItems);
    movePill();
    if (S.open) { setCaption(); labelUI(); }
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(movePill);
})();
