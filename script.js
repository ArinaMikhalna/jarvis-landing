/* ============================================================
   ДЖАРВИС · лендинг · логика (ванильный JS + Lenis)
   Оптимизировано под плавный скролл: один scroll-обработчик на кадр,
   курсор без дорогого shadowBlur и с простоем в покое.
   ============================================================ */
(function () {
  "use strict";
  var root = document.documentElement;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- ЕДИНЫЙ ОБРАБОТЧИК СКРОЛЛА (один проход на кадр) ---------- */
  var scrollFns = [], ticking = false;
  function runScroll() { ticking = false; for (var i = 0; i < scrollFns.length; i++) scrollFns[i](); }
  window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(runScroll); } }, { passive: true });
  window.addEventListener("resize", function () { for (var i = 0; i < scrollFns.length; i++) scrollFns[i](); });
  function onScroll(fn) { scrollFns.push(fn); fn(); }

  /* ---------- ИНЕРЦИОННЫЙ СКРОЛЛ (Lenis) + GSAP ScrollTrigger ---------- */
  var TOUCH = !!(window.matchMedia && window.matchMedia("(pointer:coarse)").matches);
  var GSAP_ON = !!(window.gsap && window.ScrollTrigger) && !TOUCH;
  (function lenisInit() {
    if (!window.Lenis || TOUCH) return;
    var lenis = new window.Lenis({ lerp: 0.12, smoothWheel: true, wheelMultiplier: 1 });
    if (GSAP_ON) {
      window.gsap.registerPlugin(window.ScrollTrigger);
      lenis.on("scroll", window.ScrollTrigger.update);
      window.gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      window.gsap.ticker.lagSmoothing(0);
    } else {
      (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })();
    }
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        var id = a.getAttribute("href");
        if (id.length > 1 && document.querySelector(id)) { e.preventDefault(); lenis.scrollTo(id, { offset: -10 }); }
      });
    });
  })();

  /* ---------- BOOT-UP ---------- */
  (function boot() {
    var boot = $("#boot"), fill = $("#bootFill"), pct = $("#bootPct");
    if (!boot) return;
    // показываем загрузчик только один раз за сессию
    try { if (sessionStorage.getItem("jarvis_booted")) { if (boot.parentNode) boot.parentNode.removeChild(boot); return; } } catch (e) {}
    var p = 0, done = false;
    function finish() {
      if (done) return; done = true;
      try { sessionStorage.setItem("jarvis_booted", "1"); } catch (e) {}
      boot.classList.add("is-done");
      setTimeout(function () { if (boot.parentNode) boot.parentNode.removeChild(boot); }, 700);
    }
    var t = setInterval(function () {
      p += Math.random() * 9 + 4;
      if (p >= 100) { p = 100; clearInterval(t); setTimeout(finish, 260); }
      if (fill) fill.style.width = p + "%";
      if (pct) pct.textContent = Math.floor(p);
    }, 80);
    boot.addEventListener("click", function () { clearInterval(t); finish(); });
  })();

  /* ---------- ПОЯВЛЕНИЕ ПО СКРОЛЛУ (если нет GSAP) ---------- */
  (function reveal() {
    if (GSAP_ON) return;                       // ревилы делает GSAP (см. ниже)
    var items = $$(".reveal");
    if (!("IntersectionObserver" in window)) { items.forEach(function (e) { e.classList.add("is-in"); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    items.forEach(function (e) { io.observe(e); });
  })();

  /* ---------- КИНО-СКРОЛЛ (GSAP ScrollTrigger) ---------- */
  (function cinematic() {
    if (!GSAP_ON) return;
    var gsap = window.gsap, ST = window.ScrollTrigger;
    root.classList.add("gsap-on");             // отключает CSS-правило скрытия .reveal

    // герой — анимируем сразу на загрузке (конечное состояние — видимое)
    var heroReveals = $$(".hero .reveal");
    if (heroReveals.length) gsap.from(heroReveals, { opacity: 0, y: 30, duration: .9, ease: "power3.out", stagger: .08, delay: .12 });
    // остальные ревилы — прячем и показываем по входу в экран
    var rest = $$(".reveal").filter(function (e) { return heroReveals.indexOf(e) === -1; });
    gsap.set(rest, { opacity: 0, y: 30 });
    ST.batch(rest, {
      start: "top 92%",
      onEnter: function (els) {
        gsap.to(els, { opacity: 1, y: 0, duration: .9, ease: "power3.out", stagger: .08, overwrite: true });
      }
    });

    // параллакс слоёв — только transform, дёшево для GPU
    $$(".bignum").forEach(function (el) {
      gsap.to(el, { yPercent: -16, ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
    });

    // параллакс героя убран: из-за рассинхрона со скроллом блок «залипал» и не пролистывался с одного жеста

    requestAnimationFrame(function () { ST.refresh(); });
  })();

  /* ---------- ПЕРЕКЛЮЧАТЕЛЬ ОБРАЗА ГЕРОЯ (A/B-тест) ---------- */
  (function heroSwitch() {
    var btns = $$(".hero-switch [data-hero]"); if (!btns.length) return;
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        root.setAttribute("data-hero", b.getAttribute("data-hero"));
        btns.forEach(function (x) { x.classList.remove("is-active"); });
        b.classList.add("is-active");
        if (window.ScrollTrigger) window.ScrollTrigger.refresh();
      });
    });
  })();

  /* ---------- КУРСОР-КОМЕТА (лёгкий: без shadowBlur, простаивает в покое) ---------- */
  (function comet() {
    if (window.matchMedia && window.matchMedia("(pointer:coarse)").matches) return;
    var cv = $("#comet"), ret = $(".reticle");
    if (!cv) return;
    var ctx = cv.getContext("2d"), dpr = Math.min(1.5, window.devicePixelRatio || 1);
    var accent = getComputedStyle(root).getPropertyValue("--accent").trim() || "#00A3FF";
    function size() { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    size(); window.addEventListener("resize", size);

    var pts = [], mx = -100, my = -100, rx = -100, ry = -100, moved = false;
    var magnets = [], hot = "a, button, summary, input, [data-magnetic]";   // магнит отключён: кнопки не «ерзают» за курсором

    document.addEventListener("mousemove", function (e) {
      mx = e.clientX; my = e.clientY; moved = true;
      pts.push({ x: mx, y: my });
      if (pts.length > 16) pts.shift();
      var t = e.target, onField = !!(t && t.closest && t.closest("input,textarea,select,.slider"));
      if (ret) {
        ret.classList.toggle("hide", onField);     // на полях прячем прицел, виден обычный курсор
        ret.classList.toggle("is-hot", !onField && !!(t && t.closest && t.closest(hot)));
      }
    }, { passive: true });

    // магнитные кнопки — отдельно, только когда курсор рядом (без чтения rect каждый кадр)
    magnets.forEach(function (m) {
      m.addEventListener("mousemove", function (e) {
        var r = m.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        m.style.transform = "translate(" + dx * 0.28 + "px," + dy * 0.28 + "px)";
      });
      m.addEventListener("mouseleave", function () { m.style.transform = ""; });
    });

    function loop() {
      // прицел двигаем всегда (дёшево)
      rx += (mx - rx) * 0.2; ry += (my - ry) * 0.2;
      if (ret) ret.style.transform = "translate(" + rx + "px," + ry + "px)";
      // хвост рисуем только когда есть точки
      if (pts.length > 1) {
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = accent; ctx.lineCap = "round";
        for (var i = 1; i < pts.length; i++) {
          var k = i / pts.length;
          ctx.globalAlpha = k * 0.45; ctx.lineWidth = k * 5;
          ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        if (!moved) pts.shift();   // курсор стоит — хвост постепенно укорачивается
      } else if (pts.length === 1 && !moved) {
        ctx.clearRect(0, 0, innerWidth, innerHeight); pts.length = 0;
      }
      moved = false;
      requestAnimationFrame(loop);
    }
    loop();
  })();

  /* ---------- ПАРАЛЛАКС ТУМАНА (лёгкий, в общем кадре) ---------- */
  (function parallax() {
    var blobs = $$("[data-parallax]");
    if (!blobs.length) return;
    onScroll(function () {
      var y = scrollY;
      for (var i = 0; i < blobs.length; i++) {
        var k = parseFloat(blobs[i].getAttribute("data-parallax")) || 0.05;
        blobs[i].style.transform = "translate3d(0," + (y * k * -1) + "px,0)";
      }
    });
  })();

  /* ---------- РЕЛЬС: прогресс + SEQ ---------- */
  (function rail() {
    var fill = $("#railFill"), seq = $("#railSeq"), ghosts = $$("[data-ghost]");
    var last = "";
    onScroll(function () {
      var max = document.body.scrollHeight - innerHeight;
      var p = max > 0 ? scrollY / max : 0;
      if (fill) fill.style.height = (p * 100) + "%";
      if (seq) {
        var c = innerHeight / 2, best = -1, bd = 1e9;
        for (var i = 0; i < ghosts.length; i++) {
          var r = ghosts[i].getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - c);
          if (d < bd) { bd = d; best = i; }
        }
        var pad = function (n) { return (n < 10 ? "0" : "") + n; };
        if (best >= 0) { var v = pad(best + 1) + " / " + pad(ghosts.length); if (v !== last) { seq.textContent = v; last = v; } }
      }
    });
  })();

  /* ---------- ЛИПКАЯ КНОПКА ---------- */
  (function stickyCta() {
    var el = $("#stickyCta"), price = $("#price"); if (!el) return;
    onScroll(function () {
      var pastHero = scrollY > innerHeight * 0.7;
      var atPrice = price ? price.getBoundingClientRect().top < innerHeight * 0.9 : false;
      el.classList.toggle("is-shown", pastHero && !atPrice);
    });
  })();

  /* ---------- КАЛЬКУЛЯТОР (число ⇄ ползунок, табло, шкала) ---------- */
  (function calc() {
    var rateEl = $("#rate"), hoursEl = $("#hours"), rateR = $("#rateR"), hoursR = $("#hoursR");
    var mEl = $("#lossMonth"), yEl = $("#lossYear"), pbEl = $("#payback"), ring = $("#ring");
    if (!rateEl) return;
    var PRICE = 1490, nf = new Intl.NumberFormat("ru-RU"); // окупаемость считаем по стартовой цене курса
    var perSec = 0, anchorMs = 0, lostAtAnchor = 0, yearBase = 0;
    function days(n) {
      var a = Math.abs(n) % 100, b = a % 10;
      if (a > 10 && a < 20) return n + " дней";
      if (b > 1 && b < 5) return n + " дня";
      if (b === 1) return n + " день";
      return n + " дней";
    }
    function secsInYear(d) { var y = d.getFullYear(); return ((new Date(y + 1, 0, 1)) - (new Date(y, 0, 1))) / 1000; }
    function fill(s) { if (!s) return; var p = (s.value - s.min) / (s.max - s.min) * 100; s.style.setProperty("--fill", Math.max(0, Math.min(100, p)) + "%"); }
    function recompute() {
      var rate = Math.max(0, +rateEl.value || 0), hours = Math.max(0, +hoursEl.value || 0);
      var month = rate * hours * 4, year = rate * hours * 52, now = new Date();
      var elapsed = (now - new Date(now.getFullYear(), 0, 1)) / 1000;
      perSec = year / secsInYear(now); lostAtAnchor = perSec * elapsed; anchorMs = now.getTime(); yearBase = year;
      mEl.textContent = nf.format(Math.round(month)) + " ₽";
      var daily = month / 30, d = daily > 0 ? Math.max(1, Math.ceil(PRICE / daily)) : 0;
      pbEl.textContent = daily > 0 ? days(d) : "—";
      // круговая шкала: чем быстрее окупается, тем полнее (30 дн → 0, 1 дн → почти полный круг)
      var f = daily > 0 ? Math.max(0.04, Math.min(1, (30 - Math.min(d, 30)) / 30)) : 0;
      if (ring) ring.style.setProperty("--deg", Math.round(f * 360) + "deg");
    }
    function fromNumber() {
      if (rateR) rateR.value = Math.min(rateR.max, rateEl.value || 0);
      if (hoursR) hoursR.value = Math.min(hoursR.max, hoursEl.value || 0);
      fill(rateR); fill(hoursR); recompute();
    }
    function fromRate() { rateEl.value = rateR.value; fill(rateR); recompute(); }
    function fromHours() { hoursEl.value = hoursR.value; fill(hoursR); recompute(); }
    rateEl.addEventListener("input", fromNumber); hoursEl.addEventListener("input", fromNumber);
    if (rateR) rateR.addEventListener("input", fromRate);
    if (hoursR) hoursR.addEventListener("input", fromHours);
    // тикающий счётчик — раз в секунду (не каждый кадр)
    function tick() {
      if (yearBase > 0) yEl.textContent = nf.format(Math.round(lostAtAnchor + perSec * ((Date.now() - anchorMs) / 1000))) + " ₽";
      else yEl.textContent = "0 ₽";
    }
    fill(rateR); fill(hoursR); recompute(); tick(); setInterval(tick, 1000);
  })();

  /* ---------- 3D-ДЕТАЛИ КОСТЮМА: подхват PNG, если есть ---------- */
  (function suitAssets() {
    var box = $("#suitImgs"); if (!box) return;
    var imgs = $$(".part-img", box);
    box.style.display = "none";
    var pending = imgs.length, ok = 0;
    function done() { pending--; if (pending <= 0 && ok >= 2) { box.style.display = "block"; box.classList.add("is-active"); } }
    imgs.forEach(function (im) {
      if (im.complete) { if (im.naturalWidth > 0) ok++; done(); }
      else { im.addEventListener("load", function () { ok++; done(); }); im.addEventListener("error", done); }
    });
  })();

  /* ---------- СБОРКА КОСТЮМА ПО СКРОЛЛУ ---------- */
  (function assembly() {
    var sec = $("#program"); if (!sec) return;
    var parts = $$(".suit .part, .part-img, .suit-aura");
    var lessons = $$(".lesson"), dots = $$("#steps span"), fill = $("#asmFill"), STEPS = 8;
    var lastStep = -1;
    onScroll(function () {
      var rect = sec.getBoundingClientRect(), total = sec.offsetHeight - innerHeight;
      var progress = total > 0 ? Math.min(1, Math.max(0, (-rect.top) / total)) : 0;
      var step = Math.min(STEPS - 1, Math.floor(progress * STEPS));   // 0..7
      if (fill) fill.style.width = (progress * 100) + "%";
      if (step === lastStep) return;            // ничего не трогаем, пока шаг тот же
      lastStep = step;
      // костюм собирается на шагах 1..7 (урок 00 — вводный, деталей ещё нет)
      for (var i = 0; i < parts.length; i++) parts[i].classList.toggle("is-on", (+parts[i].getAttribute("data-part")) <= step);
      lessons.forEach(function (l) { l.classList.toggle("is-active", (+l.getAttribute("data-step")) === step); });
      dots.forEach(function (d, i) { d.classList.toggle("on", i <= step); });
    });
  })();

  /* ---------- СТРЕЛКИ ПРОКРУТКИ ОТЗЫВОВ ---------- */
  (function reviewsNav() {
    var row = document.getElementById("reviewsRow");
    if (!row) return;
    var shots = row.querySelectorAll(".tg-shot");
    function glideTo(target) {
      var start = row.scrollLeft, t0 = null, dur = 380;
      function step(t) {
        if (t0 === null) t0 = t;
        var p = Math.min((t - t0) / dur, 1);
        var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        row.scrollLeft = start + (target - start) * e;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }
    $$(".reviews__arrow").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var dir = +btn.getAttribute("data-rev") || 1;
        var amt = Math.min(row.clientWidth * 0.85, 640);
        glideTo(row.scrollLeft + dir * amt);
      });
    });
    // точки-листалка отзывов
    var dotsBox = document.getElementById("reviewsDots");
    if (dotsBox && shots.length) {
      var dots = [];
      var setActive = function (i) { dots.forEach(function (d, k) { d.classList.toggle("is-on", k === i); }); };
      var posOf = function (s) { return Math.round(s.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft); };
      shots.forEach(function (s, i) {
        var d = document.createElement("button");
        d.className = "reviews__dot" + (i === 0 ? " is-on" : "");
        d.type = "button";
        d.setAttribute("aria-label", "Отзыв " + (i + 1));
        d.addEventListener("click", function () { glideTo(posOf(s) - 6); setActive(i); });
        dotsBox.appendChild(d);
        dots.push(d);
      });
      var nearest = function () {
        var sl = row.scrollLeft, best = 0, bd = Infinity;
        shots.forEach(function (s, i) { var dd = Math.abs(posOf(s) - sl); if (dd < bd) { bd = dd; best = i; } });
        return best;
      };
      row.addEventListener("scroll", function () { setActive(nearest()); }, { passive: true });
    }
  })();

  /* ---------- ЯКОРЬ ЦЕНЫ: «окупается за N ч рутины» из ставки калькулятора ---------- */
  (function priceAnchor() {
    var el = $("#planAnchor"), rate = $("#rate"), rateR = $("#rateR");
    if (!el || !rate) return;
    var PRICE_PRO = 4990;
    function upd() {
      var r = parseFloat(rate.value) || 0;
      if (r <= 0) { el.textContent = "окупается за пару часов рутины"; return; }
      var h = PRICE_PRO / r;
      var txt = h < 1 ? "окупается меньше чем за час рутины"
              : "окупается за ≈ " + (h >= 10 ? Math.round(h) : (Math.round(h * 2) / 2 + "").replace(".", ",")) + " ч рутины";
      el.textContent = txt;
    }
    rate.addEventListener("input", upd);
    if (rateR) rateR.addEventListener("input", upd);
    upd();
  })();

  /* ---------- ВСТРОЕННЫЙ БРАУЗЕР TELEGRAM: чиним переход в бота ----------
     Встроенный webview Telegram не умеет открывать "новые вкладки" (target="_blank") —
     ссылка на бота там просто не срабатывает. Только внутри него убираем target/rel,
     чтобы переход шёл в том же окне. В обычных браузерах ничего не меняем. */
  (function fixPayLinksInTelegramWebview() {
    if (!document.documentElement.classList.contains("is-tg")) return;
    document.querySelectorAll('a[href*="t.me/arinamikhalna_ai_bot"]').forEach(function (a) {
      a.removeAttribute("target");
      a.removeAttribute("rel");
    });
  })();

  /* ---------- ЦЕЛИ МЕТРИКИ: клик по любой кнопке оплаты (переход в TG-бота) ---------- */
  (function payGoals() {
    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href*="t.me/arinamikhalna_ai_bot"]') : null;
      if (!a) return;
      try { if (typeof ym === "function") ym(109725874, "reachGoal", "pay_click"); } catch (err) {}
    }, true);
  })();

})();
