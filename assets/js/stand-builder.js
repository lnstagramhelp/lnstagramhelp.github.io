/* =====================================================================
   SUSTEXPO — Kaydırdıkça kurulan fuar standı
   ---------------------------------------------------------------------
   Saf JavaScript + <canvas>. Hiçbir kütüphane kullanılmaz.
   Sıra: Alan → Parke → Duvarlar → Ekranlar → Oturma alanı → Info desk
         → Aydınlatma → Teslim
   Renkler temaya (koyu/aydınlık) ve style.css içindeki --accent
   rengine göre otomatik ayarlanır. Bu dosyayı düzenlemeniz gerekmez.
   ===================================================================== */
(function () {
  'use strict';

  var section = document.querySelector('[data-build]');
  if (!section) return;
  var canvas = section.querySelector('.build__canvas');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var root = document.documentElement;
  var stepEls = Array.prototype.slice.call(section.querySelectorAll('[data-step]'));
  var countEl = section.querySelector('[data-step-count]');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------ helpers */
  var C30 = Math.cos(Math.PI / 6), S30 = 0.5, TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function seg(v, a, b) { return clamp((v - a) / (b - a), 0, 1); }
  var ease = {
    out3: function (t) { return 1 - Math.pow(1 - t, 3); },
    out4: function (t) { return 1 - Math.pow(1 - t, 4); },
    inOut: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    back: function (t) { var c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  };
  function rand(seed) { var s = seed % 2147483647; if (s <= 0) s += 2147483646; return function () { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; }; }

  var rgbCache = {};
  function rgb(hex) {
    if (rgbCache[hex]) return rgbCache[hex];
    var h = hex.replace('#', '').trim();
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return (rgbCache[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
  }
  var amb = 1; // ambient light multiplier (drops when the hall lights dim)
  function shade(hex, f, a) {
    var c = rgb(hex), m = f * amb;
    return 'rgba(' + Math.min(255, c[0] * m | 0) + ',' + Math.min(255, c[1] * m | 0) + ',' + Math.min(255, c[2] * m | 0) + ',' + (a == null ? 1 : a) + ')';
  }
  function glow(hex, a) { var c = rgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  /* ------------------------------------------------------------ palette */
  var PAL = {
    light: {
      hall: '#E8E3DA', grid: 'rgba(40,32,22,.075)', plot: 'rgba(40,32,22,.16)', alu: '#C9CED3', sub: '#D9D3C9',
      wall: '#FAF8F4', ink: '#26262A', frame: '#1B1B1E', sofa: '#6F7B73', cushion: '#E8E1D4', leather: '#AA6B3C',
      rug: '#DDD5C6', marble: '#F2EFE9', black: '#232326', desk: '#F7F5F1', oak: '#C99B6B', slat: '#B98B5F',
      potD: '#2B2B2E', potL: '#E9E3D9', leaves: ['#41704B', '#527F59', '#335E3F', '#5F9066'], truss: 'rgba(120,128,136,.9)',
      planks: ['#CFA880', '#C49B72', '#D7B28C', '#BD9168', '#CAA27A'], shadow: [40, 30, 20], shadowA: 0.16,
      ambMin: 0.84, cone: 0.11, pool: 0.16, led: 0.65, dark: false
    },
    dark: {
      hall: '#151517', grid: 'rgba(255,255,255,.055)', plot: 'rgba(255,255,255,.13)', alu: '#A2A8AE', sub: '#2B2B2F',
      wall: '#EDEAE4', ink: '#2C2C31', frame: '#141416', sofa: '#67736C', cushion: '#DCD5C8', leather: '#9E6134',
      rug: '#D2C9BA', marble: '#EAE6DF', black: '#1C1C1F', desk: '#EFECE7', oak: '#C09162', slat: '#AB7F54',
      potD: '#28282B', potL: '#DED7CC', leaves: ['#3C6846', '#4B7954', '#2F583B', '#588C61'], truss: 'rgba(196,202,208,.75)',
      planks: ['#C49D75', '#B99168', '#CEA982', '#B3885F', '#C09870'], shadow: [0, 0, 0], shadowA: 0.36,
      ambMin: 0.46, cone: 0.2, pool: 0.3, led: 1, dark: true
    }
  };
  var pal = PAL.dark, accent = '#D4A866', warm = '#FFD596';
  function readTheme() {
    pal = root.getAttribute('data-theme') === 'light' ? PAL.light : PAL.dark;
    var a = getComputedStyle(root).getPropertyValue('--accent').trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(a)) accent = a;
    hallDirty = true;
  }

  /* ------------------------------------------------------------ stages */
  // [start, end] of each build step on the 0..1 scroll progress
  var ST = [[0.0, 0.12], [0.12, 0.26], [0.26, 0.38], [0.38, 0.49], [0.49, 0.61], [0.61, 0.71], [0.71, 0.86], [0.86, 1.0]];
  var prog = 0;
  function sp(i) { return seg(prog, ST[i][0], ST[i][1]); }
  // the empty plot draws itself once when the page opens (then scrolling takes over)
  var introStart = 0, introT = reduceMotion ? 1 : 0;
  function introProgress(time) {
    if (introT >= 1) return 1;
    if (!introStart) introStart = time || 1;
    introT = clamp(((time || 0) - introStart - 250) / 1700, 0, 1);
    return introT;
  }

  /* ------------------------------------------------------------ camera */
  var W = 0, H = 0, dpr = 1, k = 50, kFit = 50, ox = 0, oy = 0, wide = true;
  function P(x, y, z) { return [ox + (x - y) * C30 * k, oy + (x + y) * S30 * k - z * k]; }

  function resize() {
    var r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    if (!W || !H) return;
    dpr = Math.min(window.devicePixelRatio || 1, W < 700 ? 1.6 : 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    wide = W >= 980;
    var bw = 13.4, bh = 12.9;
    var aw = wide ? W * 0.58 : W * 0.96;
    var ah = wide ? H * 0.82 : H * 0.6;
    kFit = Math.min(aw / bw, ah / bh);
    hallDirty = true;
  }

  /* ------------------------------------------------------------ primitives */
  function poly(pts, fill) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }
  var FT = 1, FL = 0.86, FR = 0.71; // face light factors: top, +y (left), +x (right)
  function box(x0, y0, z0, x1, y1, z1, col, opt) {
    var cT = typeof col === 'string' ? col : col.t, cL = typeof col === 'string' ? col : col.l, cR = typeof col === 'string' ? col : col.r;
    var a = P(x0, y0, z1), b = P(x1, y0, z1), c = P(x1, y1, z1), d = P(x0, y1, z1);
    var e = P(x1, y0, z0), f = P(x1, y1, z0), g = P(x0, y1, z0);
    if (!opt || !opt.noR) poly([e, f, c, b], shade(cR, FR));
    if (!opt || !opt.noL) poly([g, f, c, d], shade(cL, FL));
    if (!opt || !opt.noT) poly([a, b, c, d], shade(cT, FT));
    if (opt && opt.edge) {
      ctx.strokeStyle = 'rgba(255,255,255,' + opt.edge + ')';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(d[0], d[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
  }
  function ellipseAt(cx, cy, z, r) { var p = P(cx, cy, z); return [p[0], p[1], 1.2247 * r * k, 0.7071 * r * k]; }
  function cyl(cx, cy, z0, z1, r, col) {
    var t = P(cx, cy, z1), b = P(cx, cy, z0), rx = 1.2247 * r * k, ry = 0.7071 * r * k;
    var g = ctx.createLinearGradient(b[0] - rx, 0, b[0] + rx, 0);
    g.addColorStop(0, shade(col, 0.93)); g.addColorStop(0.5, shade(col, 0.8)); g.addColorStop(1, shade(col, 0.6));
    ctx.beginPath();
    ctx.moveTo(t[0] - rx, t[1]);
    ctx.lineTo(b[0] - rx, b[1]);
    ctx.ellipse(b[0], b[1], rx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(t[0] + rx, t[1]);
    ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.ellipse(t[0], t[1], rx, ry, 0, 0, TAU);
    ctx.fillStyle = shade(col, 1.04); ctx.fill();
  }
  function shadow(x0, y0, x1, y1, z, a, spread) {
    if (a <= 0) return;
    var s = spread == null ? 0.1 : spread, sh = pal.shadow;
    for (var i = 0; i < 2; i++) {
      var e = s * (i ? 2.2 : 1);
      poly([P(x0 - e, y0 - e * 0.4, z), P(x1 + e, y0 - e * 0.4, z), P(x1 + e, y1 + e, z), P(x0 - e, y1 + e, z)],
        'rgba(' + sh[0] + ',' + sh[1] + ',' + sh[2] + ',' + (pal.shadowA * a * (i ? 0.45 : 1)) + ')');
    }
  }
  function roundShadow(cx, cy, z, r, a) {
    if (a <= 0) return;
    var e = ellipseAt(cx + 0.05, cy + 0.05, z, r * 1.25), sh = pal.shadow;
    var g = ctx.createRadialGradient(e[0], e[1], 0, e[0], e[1], e[2]);
    g.addColorStop(0, 'rgba(' + sh[0] + ',' + sh[1] + ',' + sh[2] + ',' + (pal.shadowA * 1.6 * a) + ')');
    g.addColorStop(1, 'rgba(' + sh[0] + ',' + sh[1] + ',' + sh[2] + ',0)');
    ctx.save(); ctx.translate(e[0], e[1]); ctx.scale(1, e[3] / e[2]); ctx.translate(-e[0], -e[1]);
    ctx.beginPath(); ctx.arc(e[0], e[1], e[2], 0, TAU); ctx.fillStyle = g; ctx.fill(); ctx.restore();
  }
  // Plane transforms (1 unit = 1 cm on the plane)
  function planeY(x0, yc, ztop) { var p = P(x0, yc, ztop), s = k / 100; ctx.setTransform(dpr * C30 * s, dpr * S30 * s, 0, dpr * s, dpr * p[0], dpr * p[1]); }
  function planeX(xc, y1, ztop) { var p = P(xc, y1, ztop), s = k / 100; ctx.setTransform(dpr * C30 * s, -dpr * S30 * s, 0, dpr * s, dpr * p[0], dpr * p[1]); }
  function planeZ(x0, y0, z) { var p = P(x0, y0, z), s = k / 100; ctx.setTransform(dpr * C30 * s, dpr * S30 * s, -dpr * C30 * s, dpr * S30 * s, dpr * p[0], dpr * p[1]); }
  function planeZv(x0, y1, z) { var p = P(x0, y1, z), s = k / 100; ctx.setTransform(dpr * C30 * s, -dpr * S30 * s, dpr * C30 * s, dpr * S30 * s, dpr * p[0], dpr * p[1]); }
  function resetT() { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function spacedText(str, x, y, size, spacing, fill, weight) {
    ctx.font = (weight || 800) + ' ' + size + 'px Manrope, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = fill;
    ctx.textBaseline = 'middle';
    var w = 0, i;
    for (i = 0; i < str.length; i++) w += ctx.measureText(str[i]).width + (i < str.length - 1 ? spacing : 0);
    var cx = x - w / 2;
    for (i = 0; i < str.length; i++) { ctx.fillText(str[i], cx, y); cx += ctx.measureText(str[i]).width + spacing; }
    return w;
  }
  function line3(a, b, color, width) {
    var p = P(a[0], a[1], a[2]), q = P(b[0], b[1], b[2]);
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
  }
  function glowLine(a, b, a2) {
    if (a2 <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    var w = Math.max(1, k / 40);
    line3(a, b, glow(warm, 0.08 * a2), w * 9);
    line3(a, b, glow(warm, 0.16 * a2), w * 4);
    line3(a, b, glow('#FFF4DE', 0.9 * a2), w * 1.2);
    ctx.restore();
  }

  /* ------------------------------------------------------------ hall (pre-rendered) */
  var hall = document.createElement('canvas'), hctx = hall.getContext('2d'), hallDirty = true, hallK = 1, hallOff = [0, 0];
  var HX0 = -9, HX1 = 17, HY0 = -9, HY1 = 15;
  function renderHall() {
    hallK = kFit;
    function q(x, y) { return [(x - y) * C30 * hallK, (x + y) * S30 * hallK]; }
    var c = [q(HX0, HY0), q(HX1, HY0), q(HX1, HY1), q(HX0, HY1)];
    var minx = Math.min(c[0][0], c[1][0], c[2][0], c[3][0]), maxx = Math.max(c[0][0], c[1][0], c[2][0], c[3][0]);
    var miny = Math.min(c[0][1], c[1][1], c[2][1], c[3][1]), maxy = Math.max(c[0][1], c[1][1], c[2][1], c[3][1]);
    hall.width = Math.max(2, Math.ceil((maxx - minx) * dpr));
    hall.height = Math.max(2, Math.ceil((maxy - miny) * dpr));
    hallOff = [minx, miny];
    var h = hctx;
    h.setTransform(dpr, 0, 0, dpr, -minx * dpr, -miny * dpr);
    h.clearRect(minx, miny, maxx - minx, maxy - miny);
    h.beginPath(); h.moveTo(c[0][0], c[0][1]); for (var i = 1; i < 4; i++) h.lineTo(c[i][0], c[i][1]); h.closePath();
    h.fillStyle = pal.hall; h.fill();
    h.lineWidth = 1; h.strokeStyle = pal.grid; h.beginPath();
    var x, y, a, b;
    for (x = HX0; x <= HX1; x++) { a = q(x, HY0); b = q(x, HY1); h.moveTo(a[0], a[1]); h.lineTo(b[0], b[1]); }
    for (y = HY0; y <= HY1; y++) { a = q(HX0, y); b = q(HX1, y); h.moveTo(a[0], a[1]); h.lineTo(b[0], b[1]); }
    h.stroke();
    // neighbouring plots (dashed)
    h.setLineDash([6, 5]); h.strokeStyle = pal.plot; h.lineWidth = 1.2;
    [[-8, 0, -2, 6], [0, -8, 8, -3], [11, 0, 16, 6], [0, 9, 7, 14], [11, -8, 16, -3], [-8, 9, -2, 14]].forEach(function (r) {
      var p1 = q(r[0], r[1]), p2 = q(r[2], r[1]), p3 = q(r[2], r[3]), p4 = q(r[0], r[3]);
      h.beginPath(); h.moveTo(p1[0], p1[1]); h.lineTo(p2[0], p2[1]); h.lineTo(p3[0], p3[1]); h.lineTo(p4[0], p4[1]); h.closePath(); h.stroke();
    });
    h.setLineDash([]);
    // fade edges
    var cc = q(4, 3), R = Math.max(maxx - minx, maxy - miny) * 0.5;
    var g = h.createRadialGradient(cc[0], cc[1], R * 0.15, cc[0], cc[1], R * 0.92);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,.7)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    h.globalCompositeOperation = 'destination-in';
    h.fillStyle = g; h.fillRect(minx, miny, maxx - minx, maxy - miny);
    h.globalCompositeOperation = 'source-over';
    hallDirty = false;
  }
  function drawHall(dim) {
    if (hallDirty) renderHall();
    var s = k / hallK;
    ctx.save();
    ctx.globalAlpha = 1 - dim * (pal.dark ? 0.55 : 0.2);
    ctx.drawImage(hall, ox + hallOff[0] * s, oy + hallOff[1] * s, hall.width / dpr * s, hall.height / dpr * s);
    ctx.restore();
  }

  /* ------------------------------------------------------------ scene data */
  var PLANKS = (function () {
    var out = [], r, rnd = rand(7), RW = 0.4, L = 1.6, rows = 15;
    for (r = 0; r < rows; r++) {
      var y0 = r * RW, y1 = y0 + RW, off = (r * 0.57) % L, x = -off, i = 0;
      while (x < 8) {
        var a = Math.max(0, x), b = Math.min(8, x + L);
        if (b - a > 0.05) out.push({ x0: a, x1: b, y0: y0, y1: y1, c: Math.floor(rnd() * 5), t0: (r / rows) * 0.8 + i * 0.022 });
        x += L; i++;
      }
    }
    return out;
  })();
  var WALL_A = [], WALL_B = [];
  (function () {
    for (var i = 0; i < 8; i++) WALL_A.push([i, i + 1]);
    var ys = [0.15, 1.15, 2.15, 3.15, 4.15, 5.15, 6.0];
    for (var j = 0; j < 6; j++) WALL_B.push([ys[j], ys[j + 1]]);
  })();
  function foliage(seed, n, r, h) {
    var rnd = rand(seed), out = [];
    for (var i = 0; i < n; i++) {
      var a = rnd() * TAU, d = Math.sqrt(rnd()) * r;
      out.push({ dx: Math.cos(a) * d, dy: Math.sin(a) * d, dz: (rnd() - 0.3) * h, r: 0.13 + rnd() * 0.12, c: Math.floor(rnd() * 4) });
    }
    out.sort(function (p, q) { return (p.dx + p.dy + p.dz * 0.1) - (q.dx + q.dy + q.dz * 0.1); });
    return out;
  }
  var PLANTS = [
    { x: 1.75, y: 0.55, pr: 0.17, ph: 0.42, top: 1.25, r: 0.32, light: true, f: foliage(3, 18, 0.3, 0.45) },
    { x: 7.6, y: 0.6, pr: 0.19, ph: 0.46, top: 1.45, r: 0.36, light: false, f: foliage(9, 20, 0.34, 0.5) },
    { x: 0.55, y: 5.5, pr: 0.2, ph: 0.5, top: 1.7, r: 0.4, light: false, f: foliage(15, 24, 0.38, 0.6) }
  ];
  var TZ = 4.35, TH = 0.28;
  var SPOTS = [
    { x: 3.2, y: 1.9, tx: 3.4, ty: 0.25, tz: 1.9, r: 0.95 },
    { x: 4.8, y: 1.9, tx: 4.6, ty: 0.25, tz: 1.9, r: 0.95 },
    { x: 1.9, y: 3.3, tx: 0.25, ty: 3.3, tz: 1.6, r: 0.9 },
    { x: 1.9, y: 4.6, tx: 2.2, ty: 3.4, tz: 0.45, r: 0.95 },
    { x: 6.2, y: 5.7, tx: 6.2, ty: 4.0, tz: 1.1, r: 0.85 },
    { x: 7.7, y: 3.9, tx: 6.4, ty: 3.9, tz: 1.1, r: 0.8 },
    { x: 7.7, y: 1.9, tx: 6.6, ty: 1.55, tz: 1.1, r: 0.7 },
    { x: 3.6, y: 5.7, tx: 3.25, ty: 3.4, tz: 0.44, r: 0.9 }
  ];

  /* ------------------------------------------------------------ drawing: build steps */
  function drawTape(t, fade) {
    if (fade <= 0) return;
    ctx.save();
    ctx.globalAlpha = fade;
    var per = [[0, 0], [8, 0], [8, 6], [0, 6], [0, 0]], lens = [8, 6, 8, 6], total = 28, drawn = total * ease.out3(seg(t, 0, 0.65));
    ctx.strokeStyle = accent; ctx.lineWidth = Math.max(1.5, k / 30); ctx.setLineDash([k * 0.16, k * 0.1]);
    ctx.beginPath();
    var p0 = P(0, 0, 0); ctx.moveTo(p0[0], p0[1]);
    for (var i = 0; i < 4 && drawn > 0; i++) {
      var f = Math.min(1, drawn / lens[i]), a = per[i], b = per[i + 1];
      var p = P(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 0);
      ctx.lineTo(p[0], p[1]);
      drawn -= lens[i];
    }
    ctx.stroke(); ctx.setLineDash([]);
    var c2 = seg(t, 0.45, 1);
    if (c2 > 0) {
      ctx.globalAlpha = fade * c2;
      ctx.lineWidth = Math.max(2, k / 22);
      [[0, 0, 1, 1], [8, 0, -1, 1], [8, 6, -1, -1], [0, 6, 1, -1]].forEach(function (c) {
        var a = P(c[0] + c[2] * 0.6, c[1], 0), m = P(c[0], c[1], 0), b = P(c[0], c[1] + c[3] * 0.6, 0);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(m[0], m[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      });
      // dimension lines
      ctx.lineWidth = 1; ctx.strokeStyle = pal.dark ? 'rgba(255,255,255,.45)' : 'rgba(30,25,20,.45)';
      line3([0, 6.8, 0], [8, 6.8, 0], ctx.strokeStyle, 1);
      line3([8.8, 0, 0], [8.8, 6, 0], ctx.strokeStyle, 1);
      [[0, 6.6, 0, 7.0], [8, 6.6, 8, 7.0]].forEach(function (s) { line3([s[0], s[1], 0], [s[2], s[3], 0], ctx.strokeStyle, 1); });
      [[8.6, 0, 9.0, 0], [8.6, 6, 9.0, 6]].forEach(function (s) { line3([s[0], s[1], 0], [s[2], s[3], 0], ctx.strokeStyle, 1); });
      var txt = pal.dark ? 'rgba(255,255,255,.8)' : 'rgba(30,25,20,.75)';
      planeZ(0, 6.8, 0); spacedText('8 m', 400, 32, 34, 2, txt, 700);
      planeZv(8.8, 6, 0); spacedText('6 m', 300, -32, 34, 2, txt, 700);
      planeZ(0, 0, 0); ctx.globalAlpha = fade * c2 * 0.9; spacedText('48 m²', 400, 300, 110, 6, glow(accent, 0.55), 800);
      resetT();
    }
    ctx.restore();
  }

  function drawPlatform(t) {
    var h = 0.1 * t;
    box(0, 0, 0, 8, 6, h, { t: pal.sub, l: pal.alu, r: pal.alu });
    return h;
  }
  function drawPlanks(t) {
    var cols = pal.planks, seam = pal.dark ? 'rgba(0,0,0,.28)' : 'rgba(80,50,25,.2)';
    for (var i = 0; i < PLANKS.length; i++) {
      var pl = PLANKS[i], lt = seg(t, pl.t0, pl.t0 + 0.16);
      if (lt <= 0) continue;
      var z = 0.1 + (1 - ease.out3(lt)) * 0.55;
      ctx.globalAlpha = Math.min(1, lt * 3);
      var pts = [P(pl.x0, pl.y0, z), P(pl.x1, pl.y0, z), P(pl.x1, pl.y1, z), P(pl.x0, pl.y1, z)];
      poly(pts, shade(cols[pl.c], 1));
      ctx.strokeStyle = seam; ctx.lineWidth = 0.8; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function wallAO(a) {
    if (a <= 0) return;
    var sh = pal.shadow;
    planeZ(0.15, 0.15, 0.1);
    var g = ctx.createLinearGradient(0, 0, 0, 70);
    g.addColorStop(0, 'rgba(' + sh + ',' + (pal.shadowA * 1.4 * a) + ')'); g.addColorStop(1, 'rgba(' + sh + ',0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 785, 70);
    var g2 = ctx.createLinearGradient(0, 0, 70, 0);
    g2.addColorStop(0, 'rgba(' + sh + ',' + (pal.shadowA * 1.4 * a) + ')'); g2.addColorStop(1, 'rgba(' + sh + ',0)');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, 70, 585);
    resetT();
  }
  function drawWalls(t) {
    var i, lt, z1;
    for (i = 0; i < WALL_A.length; i++) {
      lt = seg(t, 0.04 + i * 0.05, 0.3 + i * 0.05); if (lt <= 0) continue;
      z1 = 0.1 + 3.0 * ease.out4(lt);
      box(WALL_A[i][0], 0, 0.1, WALL_A[i][1], 0.15, z1, pal.wall);
    }
    for (i = 0; i < WALL_B.length; i++) {
      lt = seg(t, 0.06 + i * 0.05, 0.32 + i * 0.05); if (lt <= 0) continue;
      z1 = 0.1 + 3.0 * ease.out4(lt);
      box(0, WALL_B[i][0], 0.1, 0.15, WALL_B[i][1], z1, pal.wall);
    }
    // seams
    var sa = seg(t, 0.5, 0.8);
    if (sa > 0) {
      ctx.strokeStyle = pal.dark ? 'rgba(0,0,0,' + 0.1 * sa + ')' : 'rgba(0,0,0,' + 0.07 * sa + ')'; ctx.lineWidth = 1;
      for (i = 1; i < 8; i++) line3([i, 0.15, 0.1], [i, 0.15, 3.1], ctx.strokeStyle, 1);
      for (i = 1; i < 6; i++) line3([0.15, WALL_B[i][0], 0.1], [0.15, WALL_B[i][0], 3.1], ctx.strokeStyle, 1);
    }
  }
  function drawSlats(t) {
    if (t <= 0) return;
    for (var i = 0; i < 48; i++) {
      var y = 1.7 + i * 0.085, lt = seg(t, i / 48 * 0.6, i / 48 * 0.6 + 0.4);
      if (lt <= 0) continue;
      var z1 = 0.1 + 2.95 * ease.out3(lt);
      box(0.15, y, 0.1, 0.19, y + 0.045, z1, pal.slat);
    }
  }
  function drawTower(t, logoLit) {
    if (t <= 0) return;
    var z1 = 0.1 + 5.2 * ease.out4(t);
    box(0, 0, 0.1, 1.4, 1.4, z1, pal.ink, { edge: 0.12 });
    var la = seg(t, 0.75, 1);
    if (la <= 0) return;
    ctx.save();
    ctx.globalAlpha = la;
    var fill = glow(accent, 1);
    if (logoLit > 0) { ctx.shadowColor = glow(accent, 0.9 * logoLit); ctx.shadowBlur = 14 * logoLit * (k / 60); }
    planeY(0, 1.4, 5.3); spacedText('SUSTEXPO', 70, 44, 19, 3, fill, 800);
    ctx.fillStyle = fill; ctx.fillRect(25, 70, 90, 2);
    planeX(1.4, 1.4, 5.3); spacedText('SUSTEXPO', 70, 44, 19, 3, fill, 800);
    ctx.fillRect(25, 70, 90, 2);
    resetT();
    ctx.restore();
  }
  // simplified SUSTEXPO mark (cm units)
  function mark(x, y, s, ink, brass) {
    var u = s / 40;
    ctx.fillStyle = ink;
    ctx.fillRect(x + 10 * u, y + 9 * u, 20 * u, 4.6 * u); ctx.fillRect(x + 10 * u, y + 9 * u, 4.6 * u, 7.5 * u);
    ctx.fillRect(x + 10 * u, y + 26.4 * u, 20 * u, 4.6 * u); ctx.fillRect(x + 25.4 * u, y + 23.5 * u, 4.6 * u, 7.5 * u);
    ctx.fillStyle = brass; ctx.fillRect(x + 10 * u, y + 17.7 * u, 20 * u, 4.6 * u);
  }
  function drawLedWall(t, on, time) {
    if (t <= 0) return;
    var d = ease.out3(t), dz = (1 - d) * 0.8;
    ctx.save(); ctx.globalAlpha = Math.min(1, t * 2.5);
    box(2.0, 0.15, 0.85 + dz, 5.8, 0.24, 3.0 + dz, pal.frame);
    // screen surface on plane y=0.24 (x 2.05..5.75, z 0.9..2.95) → 370 x 205 cm
    planeY(2.05, 0.2405, 2.95 + dz);
    var g = ctx.createLinearGradient(0, 0, 370, 205);
    g.addColorStop(0, '#111114'); g.addColorStop(1, '#1D1D22');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 370, 205);
    if (on > 0) {
      ctx.globalAlpha = Math.min(1, t * 2.5) * on;
      var g2 = ctx.createLinearGradient(0, 0, 370, 205);
      g2.addColorStop(0, '#141416'); g2.addColorStop(0.55, '#231D16'); g2.addColorStop(1, glow(accent, 0.85));
      ctx.fillStyle = g2; ctx.fillRect(0, 0, 370, 205);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 370, 205); ctx.clip();
      ctx.strokeStyle = glow(accent, 0.55); ctx.lineWidth = 1.2;
      var shift = reduceMotion ? 0 : (time * 0.012) % 34;
      for (var i = -4; i < 16; i++) { var x = 190 + i * 34 + shift; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - 120, 205); ctx.stroke(); }
      ctx.restore();
      mark(40, 62, 80, '#EEE9E1', accent);
      spacedText('SUSTEXPO', 225, 102, 34, 4, '#EEE9E1', 800);
      ctx.fillStyle = glow(accent, 0.9); ctx.fillRect(150, 128, 150, 2);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.05)';
      ctx.beginPath(); ctx.moveTo(250, 0); ctx.lineTo(330, 0); ctx.lineTo(180, 205); ctx.lineTo(100, 205); ctx.closePath(); ctx.fill();
    }
    resetT();
    ctx.restore();
  }
  function drawTV(t, on, time) {
    if (t <= 0) return;
    var d = ease.out3(t), dz = (1 - d) * 0.6;
    ctx.save(); ctx.globalAlpha = Math.min(1, t * 2.5);
    box(0.19, 2.55, 1.42 + dz, 0.24, 4.05, 2.3 + dz, pal.frame);
    planeX(0.2405, 4.0, 2.26 + dz);  // u along -y from y=4.0 → 140cm, v down 80cm
    ctx.fillStyle = '#121215'; ctx.fillRect(0, 0, 140, 80);
    if (on > 0) {
      ctx.globalAlpha = Math.min(1, t * 2.5) * on;
      var g = ctx.createLinearGradient(0, 0, 140, 80);
      g.addColorStop(0, glow(accent, 1)); g.addColorStop(1, '#2A1F14');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 140, 80);
      ctx.strokeStyle = 'rgba(255,240,215,.55)'; ctx.lineWidth = 0.8;
      var ph = reduceMotion ? 0 : (time * 0.004) % 8;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 140, 80); ctx.clip();
      for (var i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(98, 46, 6 + i * 8 + ph, 0, TAU); ctx.stroke(); }
      ctx.restore();
      mark(10, 22, 36, '#18160F', '#FFF0D7');
    }
    resetT();
    ctx.restore();
  }
  function drawRug(t) {
    if (t <= 0) return;
    var y1 = 1.95 + 3.0 * ease.out3(t);
    box(0.35, 1.95, 0.1, 3.95, y1, 0.114, pal.rug);
    if (t > 0.6) {
      ctx.save(); ctx.globalAlpha = seg(t, 0.6, 1) * 0.35;
      ctx.strokeStyle = shade(pal.rug, 0.7); ctx.lineWidth = 1;
      var a = P(0.5, 2.1, 0.114), b = P(3.8, 2.1, 0.114), c = P(3.8, y1 - 0.15, 0.114), d = P(0.5, y1 - 0.15, 0.114);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.stroke();
      ctx.restore();
    }
  }
  function dropT(t) { return { dz: (1 - ease.out3(t)) * 1.3, a: Math.min(1, t * 2.4) }; }
  function drawSofa(t) {
    if (t <= 0) return;
    var d = dropT(t), z = 0.114 + d.dz;
    shadow(0.45, 2.1, 1.4, 4.6, 0.114, d.a * (1 - d.dz));
    ctx.save(); ctx.globalAlpha = d.a;
    box(0.45, 2.3, z, 1.4, 4.4, z + 0.31, pal.sofa);
    box(0.45, 2.3, z + 0.31, 0.72, 4.4, z + 0.84, pal.sofa);
    box(0.45, 2.1, z, 1.4, 2.32, z + 0.55, pal.sofa);
    box(0.72, 2.34, z + 0.31, 1.38, 3.34, z + 0.45, pal.sofa, { edge: 0.08 });
    box(0.72, 3.36, z + 0.31, 1.38, 4.36, z + 0.45, pal.sofa, { edge: 0.08 });
    box(0.78, 2.55, z + 0.45, 0.96, 2.95, z + 0.82, pal.cushion);
    box(0.78, 3.75, z + 0.45, 0.96, 4.15, z + 0.82, pal.cushion);
    box(0.45, 4.38, z, 1.4, 4.6, z + 0.55, pal.sofa);
    ctx.restore();
  }
  function drawCoffee(t) {
    if (t <= 0) return;
    var d = dropT(t), z = 0.114 + d.dz;
    roundShadow(2.15, 3.35, 0.114, 0.5, d.a * (1 - d.dz));
    ctx.save(); ctx.globalAlpha = d.a;
    cyl(2.15, 3.35, z, z + 0.33, 0.09, pal.black);
    cyl(2.15, 3.35, z + 0.33, z + 0.365, 0.48, pal.marble);
    cyl(2.0, 3.25, z + 0.365, z + 0.47, 0.07, pal.potL);
    ctx.restore();
  }
  function drawArmchair(yc, t) {
    if (t <= 0) return;
    var d = dropT(t), z = 0.114 + d.dz;
    shadow(2.85, yc - 0.42, 3.7, yc + 0.42, 0.114, d.a * (1 - d.dz));
    ctx.save(); ctx.globalAlpha = d.a;
    box(3.45, yc - 0.42, z, 3.7, yc + 0.42, z + 0.77, pal.leather);
    box(2.85, yc - 0.42, z, 3.45, yc + 0.42, z + 0.33, pal.leather, { edge: 0.08 });
    box(2.85, yc - 0.42, z, 3.45, yc - 0.3, z + 0.52, pal.leather);
    box(2.85, yc + 0.3, z, 3.45, yc + 0.42, z + 0.52, pal.leather);
    ctx.restore();
  }
  function drawPlant(pl, t) {
    if (t <= 0) return;
    var d = dropT(seg(t, 0, 0.6)), z = 0.1 + d.dz, g = ease.back(seg(t, 0.35, 1));
    roundShadow(pl.x, pl.y, 0.1, pl.pr * 1.3, d.a);
    ctx.save(); ctx.globalAlpha = d.a;
    cyl(pl.x, pl.y, z, z + pl.ph, pl.pr, pl.light ? pal.potL : pal.potD);
    if (g > 0) {
      var top = z + pl.ph, stemTop = z + pl.top * g;
      line3([pl.x, pl.y, top], [pl.x, pl.y, stemTop], shade('#4A3B2C', 1), Math.max(1, k / 45));
      for (var i = 0; i < pl.f.length; i++) {
        var f = pl.f[i], c = P(pl.x + f.dx * g, pl.y + f.dy * g, stemTop + f.dz * g * 0.6);
        var rr = f.r * k * 0.62 * g;
        if (rr < 0.5) continue;
        var gr = ctx.createRadialGradient(c[0] - rr * 0.35, c[1] - rr * 0.4, rr * 0.1, c[0], c[1], rr);
        gr.addColorStop(0, shade(pal.leaves[f.c], 1.25)); gr.addColorStop(1, shade(pal.leaves[f.c], 0.8));
        ctx.beginPath(); ctx.arc(c[0], c[1], rr, 0, TAU); ctx.fillStyle = gr; ctx.fill();
      }
    }
    ctx.restore();
  }
  function drawStool(x, y, t, seatCol) {
    if (t <= 0) return;
    var d = dropT(t), z = 0.1 + d.dz;
    roundShadow(x, y, 0.1, 0.2, d.a);
    ctx.save(); ctx.globalAlpha = d.a;
    cyl(x, y, z, z + 0.015, 0.17, pal.black);
    cyl(x, y, z, z + 0.66, 0.025, pal.black);
    cyl(x, y, z + 0.66, z + 0.72, 0.18, seatCol || pal.leather);
    ctx.restore();
  }
  function drawHighTable(t) {
    if (t <= 0) return;
    var d = dropT(t), z = 0.1 + d.dz;
    roundShadow(6.6, 1.55, 0.1, 0.4, d.a);
    ctx.save(); ctx.globalAlpha = d.a;
    cyl(6.6, 1.55, z, z + 0.015, 0.22, pal.black);
    cyl(6.6, 1.55, z, z + 1.0, 0.03, pal.black);
    cyl(6.6, 1.55, z + 1.0, z + 1.03, 0.36, pal.oak);
    ctx.restore();
  }
  function drawDesk(t) {
    if (t <= 0) return;
    var b = ease.out4(seg(t, 0, 0.45)), top = dropT(seg(t, 0.32, 0.62)), logo = seg(t, 0.55, 0.85), lap = dropT(seg(t, 0.62, 0.92));
    shadow(4.94, 3.66, 7.46, 4.38, 0.1, b);
    var z1 = 0.1 + 0.94 * b;
    box(5.0, 3.72, 0.1, 7.4, 4.3, z1, pal.desk);
    if (logo > 0) {
      ctx.save(); ctx.globalAlpha = logo;
      planeY(5.0, 4.3, 1.04);
      spacedText('SUSTEXPO', 120, 52, 15, 3, pal.ink, 800);
      ctx.fillStyle = glow(accent, 1); ctx.fillRect(60, 66, 120, 2);
      resetT(); ctx.restore();
    }
    if (top.a > 0) {
      ctx.save(); ctx.globalAlpha = top.a;
      box(4.94, 3.66, 1.04 + top.dz, 7.46, 4.38, 1.1 + top.dz, pal.oak, { edge: 0.12 });
      ctx.restore();
    }
    if (lap.a > 0) {
      ctx.save(); ctx.globalAlpha = lap.a;
      var z = 1.1 + lap.dz;
      box(5.9, 3.85, z, 6.25, 4.08, z + 0.012, '#C9CDD2');
      box(5.9, 3.84, z + 0.012, 6.25, 3.852, z + 0.23, pal.frame);
      cyl(7.1, 4.0, z, z + 0.18, 0.05, pal.potL);
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------ lighting */
  function drawTruss(t) {
    if (t <= 0) return;
    var pts = [[1.9, 1.9], [7.7, 1.9], [7.7, 5.7], [1.9, 5.7]];
    var col = pal.truss, lw = Math.max(1.1, k / 48);
    ctx.save(); ctx.lineCap = 'round';
    // cables
    var ca = seg(t, 0, 0.3);
    ctx.globalAlpha = ca * 0.6;
    pts.forEach(function (p) { line3([p[0], p[1], TZ + TH], [p[0], p[1], TZ + 9], col, Math.max(0.6, k / 120)); });
    ctx.globalAlpha = 1;
    // beams: back first (0→1, 3→0), then front
    var order = [[0, 1], [3, 0], [1, 2], [2, 3]];
    order.forEach(function (o, idx) {
      var bt = ease.out3(seg(t, 0.05 + idx * 0.12, 0.45 + idx * 0.12));
      if (bt <= 0) return;
      var a = pts[o[0]], b = pts[o[1]];
      var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy), nx = -dy / len * 0.14, ny = dx / len * 0.14;
      var ex = a[0] + dx * bt, ey = a[1] + dy * bt;
      [[nx, ny], [-nx, -ny]].forEach(function (n) {
        line3([a[0] + n[0], a[1] + n[1], TZ], [ex + n[0], ey + n[1], TZ], col, lw);
        line3([a[0] + n[0], a[1] + n[1], TZ + TH], [ex + n[0], ey + n[1], TZ + TH], col, lw);
      });
      var steps = Math.floor(len * bt / 0.32);
      ctx.globalAlpha = 0.75;
      for (var i = 0; i < steps; i++) {
        var f0 = (i * 0.32) / len, f1 = ((i + 1) * 0.32) / len;
        var x0 = a[0] + dx * f0, y0 = a[1] + dy * f0, x1 = a[0] + dx * f1, y1 = a[1] + dy * f1;
        var up = i % 2 ? [TZ, TZ + TH] : [TZ + TH, TZ];
        line3([x0 - nx, y0 - ny, up[0]], [x1 - nx, y1 - ny, up[1]], col, lw * 0.6);
        line3([x0 + nx, y0 + ny, up[0]], [x1 + nx, y1 + ny, up[1]], col, lw * 0.6);
      }
      ctx.globalAlpha = 1;
    });
    ctx.restore();
  }
  function spotOn(i, Lt) {
    var t = (Lt - (0.45 + i * 0.045)) / 0.07;
    if (t <= 0) return 0;
    if (t >= 1 || reduceMotion) return 1;
    return (t < 0.25) ? 1 : (t < 0.42 ? 0.15 : (t < 0.55 ? 1 : (t < 0.62 ? 0.35 : 1)));
  }
  function drawFixtures(fixT, Lt) {
    if (fixT <= 0) return;
    for (var i = 0; i < SPOTS.length; i++) {
      var s = SPOTS[i], ft = seg(fixT, i * 0.07, i * 0.07 + 0.4);
      if (ft <= 0) continue;
      ctx.save(); ctx.globalAlpha = ft;
      cyl(s.x, s.y, TZ - 0.24, TZ - 0.02, 0.075, pal.black);
      var on = spotOn(i, Lt);
      if (on > 0) {
        var c = P(s.x, s.y, TZ - 0.24);
        ctx.globalCompositeOperation = 'lighter';
        var g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], k * 0.35);
        g.addColorStop(0, 'rgba(255,248,230,' + 0.95 * on + ')'); g.addColorStop(1, 'rgba(255,214,150,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c[0], c[1], k * 0.35, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }
  function drawLightFX(Lt, ledT, time) {
    if (Lt <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < SPOTS.length; i++) {
      var s = SPOTS[i], on = spotOn(i, Lt);
      if (on <= 0) continue;
      var breathe = reduceMotion ? 1 : 0.94 + 0.06 * Math.sin(time * 0.0012 + i);
      var apex = P(s.x, s.y, TZ - 0.26), base = ellipseAt(s.tx, s.ty, s.tz, s.r);
      // cone
      var g = ctx.createLinearGradient(apex[0], apex[1], base[0], base[1]);
      g.addColorStop(0, glow(warm, pal.cone * 1.6 * on * breathe)); g.addColorStop(1, glow(warm, pal.cone * 0.25 * on));
      ctx.beginPath();
      ctx.moveTo(apex[0] - k * 0.04, apex[1]);
      ctx.lineTo(base[0] - base[2], base[1]);
      ctx.ellipse(base[0], base[1], base[2], base[3], 0, Math.PI, 0, true);
      ctx.lineTo(apex[0] + k * 0.04, apex[1]);
      ctx.closePath();
      ctx.fillStyle = g; ctx.fill();
      // pool
      ctx.save();
      ctx.translate(base[0], base[1]); ctx.scale(1, base[3] / base[2]);
      var pg = ctx.createRadialGradient(0, 0, 0, 0, 0, base[2] * 1.15);
      pg.addColorStop(0, glow(warm, pal.pool * on * breathe)); pg.addColorStop(1, glow(warm, 0));
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(0, 0, base[2] * 1.15, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    // LED strips
    var la = ledT * pal.led;
    glowLine([1.4, 0.16, 3.085], [8, 0.16, 3.085], la);
    glowLine([0.16, 1.4, 3.085], [0.16, 6, 3.085], la);
    glowLine([1.4, 0.16, 0.13], [8, 0.16, 0.13], la * 0.8);
    glowLine([5.02, 4.38, 1.03], [7.38, 4.38, 1.03], la);
    glowLine([5.08, 4.31, 0.13], [7.32, 4.31, 0.13], la * 0.8);
    // wall wash from the cove LEDs
    if (la > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      planeY(1.4, 0.151, 3.1);
      var gw = ctx.createLinearGradient(0, 0, 0, 120);
      gw.addColorStop(0, glow(warm, 0.22 * la)); gw.addColorStop(1, glow(warm, 0));
      ctx.fillStyle = gw; ctx.fillRect(0, 0, 60, 120); ctx.fillRect(440, 0, 220, 120);
      planeX(0.151, 6, 3.1);
      ctx.fillStyle = gw; ctx.fillRect(0, 0, 25, 120);
      resetT(); ctx.restore();
    }
  }

  /* ------------------------------------------------------------ frame */
  function draw(time) {
    if (!W || !H) return;
    time = time || 0;
    var p = prog;
    var z = ease.inOut(seg(p, 0, 0.55));
    k = kFit * (0.8 + 0.2 * z) * (1 + 0.04 * ease.inOut(seg(p, 0.86, 1)));
    var tx = wide ? W * (W < 1200 ? 0.655 : 0.64) : W * 0.5;
    // narrow screens: the plot starts low (under the intro text) and rises before the step card appears
    var ty = wide ? H * (0.6 - 0.05 * z) : H * (0.68 - 0.23 * ease.inOut(seg(p, 0, 0.12)) - 0.02 * z);
    ox = tx - 0.866 * k; oy = ty - 1.15 * k;

    resetT();
    ctx.clearRect(0, 0, W, H);

    var Lt = sp(6), dim = ease.inOut(seg(Lt, 0.3, 0.62));
    amb = 1 - (1 - pal.ambMin) * dim;
    drawHall(dim);

    var areaT = Math.max(seg(prog, 0.0, 0.1), introProgress(time)), floorT = sp(1), wallT = sp(2), scrT = sp(3), loungeT = sp(4), deskT = sp(5);
    var platT = ease.out3(seg(floorT, 0, 0.16));
    if (areaT > 0) drawTape(areaT, 1 - platT);
    if (platT > 0) {
      drawPlatform(platT);
      drawPlanks(seg(floorT, 0.1, 1));
    }
    wallAO(seg(wallT, 0.2, 0.8));
    drawRug(seg(loungeT, 0, 0.28));
    if (wallT > 0) drawWalls(wallT);
    drawSlats(seg(wallT, 0.62, 1));
    var on = seg(scrT, 0.62, 1);
    if (!reduceMotion && on > 0 && on < 1) on = on * (0.75 + 0.25 * Math.sin(on * 40));
    drawLedWall(seg(scrT, 0, 0.5), on, time);
    drawTV(seg(scrT, 0.25, 0.7), on, time);
    drawTower(seg(wallT, 0.5, 0.98), ease.inOut(seg(Lt, 0.55, 0.9)));

    // floor objects back → front
    drawPlant(PLANTS[0], seg(loungeT, 0.62, 1));
    drawPlant(PLANTS[1], seg(loungeT, 0.7, 1));
    var ht = seg(deskT, 0.66, 1);
    drawStool(6.35, 0.98, ht);
    drawHighTable(ht);
    drawStool(6.14, 1.97, ht);
    drawStool(7.11, 1.9, ht);
    drawSofa(seg(loungeT, 0.12, 0.45));
    drawCoffee(seg(loungeT, 0.32, 0.6));
    drawArmchair(2.65, seg(loungeT, 0.42, 0.72));
    drawArmchair(4.05, seg(loungeT, 0.5, 0.8));
    drawPlant(PLANTS[2], seg(loungeT, 0.55, 0.95));
    drawStool(6.2, 3.25, seg(deskT, 0.5, 0.85), pal.black);
    drawDesk(deskT);

    // lighting
    drawTruss(seg(Lt, 0, 0.4));
    drawFixtures(seg(Lt, 0.22, 0.5), Lt);
    drawLightFX(Lt, ease.inOut(seg(Lt, 0.6, 0.95)), time);
    amb = 1;
  }

  /* ------------------------------------------------------------ DOM sync */
  var lastActive = -2;
  function syncDom() {
    var active = -1;
    for (var i = 0; i < ST.length; i++) if (prog >= ST[i][0]) active = i;
    for (var j = 0; j < stepEls.length; j++) {
      var el = stepEls[j];
      if (active !== lastActive) {
        el.classList.toggle('is-active', j === active);
        el.classList.toggle('is-done', j < active);
      }
      if (j === active) el.style.setProperty('--sp', seg(prog, ST[j][0], ST[j][1]).toFixed(3));
    }
    if (active !== lastActive && countEl) countEl.textContent = active < 0 ? '00' : ('0' + (active + 1)).slice(-2);
    lastActive = active;
    section.style.setProperty('--p', prog.toFixed(4));
    section.classList.toggle('is-started', prog > 0.012);
    section.classList.toggle('is-finished', prog >= ST[7][0] + 0.02);
  }

  /* ------------------------------------------------------------ loop
     Ekranda görünen ilerleme, gerçek kaydırma konumunu yumuşakça takip eder (süzülme). */
  var inView = true, raf = 0, target = 0, firstMeasure = true, lastT = 0, GLIDE = 0.15;
  function measure() {
    var r = section.getBoundingClientRect();
    var total = section.offsetHeight - window.innerHeight;
    target = total > 0 ? clamp(-r.top / total, 0, 1) : 0;
    if (firstMeasure || reduceMotion || !inView) { prog = target; firstMeasure = false; }
  }
  function glide(time) {
    var dt = lastT ? Math.min(64, time - lastT) : 16.7;
    lastT = time;
    prog += (target - prog) * (1 - Math.pow(1 - GLIDE, dt / 16.7));
    if (Math.abs(target - prog) < 0.00005) prog = target;
  }
  function needsLoop() { return inView && !reduceMotion && (introT < 1 || prog !== target || prog > ST[3][0] + 0.06); }
  function tick(time) {
    raf = 0;
    measure(); glide(time || 0); syncDom(); draw(time);
    if (needsLoop()) raf = requestAnimationFrame(tick); else lastT = 0;
  }
  function request() { if (!raf) raf = requestAnimationFrame(tick); }

  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', function () { resize(); request(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { inView = en[0].isIntersecting; if (inView) request(); }, { rootMargin: '100px' }).observe(section);
  }
  new MutationObserver(function () { readTheme(); request(); }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(request);

  readTheme();
  resize();
  request();
  // expose for debugging / tests
  window.SUSTEXPO_BUILD = { redraw: request, stages: ST };
})();
