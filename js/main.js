/* =========================================================
   Приглашение А & М — поведение страницы
   ========================================================= */
const WEDDING_DATE = new Date('2027-07-22T15:00:00+03:00');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SVG_NS = 'http://www.w3.org/2000/svg';

/* ---------------------------------------------------------
   1. Конверт
   Заставка стартует только когда загружены бумага, печать и шрифты —
   иначе картинки «доезжают» посреди анимации и всё дёргается.
   --------------------------------------------------------- */
(function gate() {
  const gate = document.getElementById('gate');
  const envelope = document.getElementById('envelope');
  const tilt = document.getElementById('env-tilt');
  const seal = document.getElementById('seal');
  const page = document.getElementById('sheet');
  const hero = document.getElementById('hero');
  if (!gate || !envelope || !seal || !page) return;

  const openPage = () => {
    document.body.classList.remove('is-gated');
    page.removeAttribute('aria-hidden');
    if (hero) runHero(hero);
    window.dispatchEvent(new Event('page:open'));
  };

  if (reduceMotion) {
    gate.remove();
    openPage();
    return;
  }

  // 1) ждём ресурсы (но не дольше 2.5 с)
  const decode = (src) => {
    const img = new Image();
    img.src = src;
    return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
  };
  const assets = Promise.all([
    decode('assets/images/env-paper.jpg'),
    decode('assets/images/card-paper.jpg'),
    decode('assets/images/wax-seal.png'),
    decode('assets/images/leaf-shadows.png'),
    document.fonts ? document.fonts.ready : Promise.resolve(),
  ]);
  const timeout = new Promise((r) => setTimeout(r, 2500));
  Promise.race([assets, timeout]).then(() => {
    requestAnimationFrame(() => gate.classList.add('is-ready'));
  });

  // 2) лёгкий наклон конверта за курсором (только мышь, на телефоне не нужен)
  let raf = 0;
  const onMove = (e) => {
    if (raf || envelope.classList.contains('is-open')) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      tilt.style.setProperty('--ry', (x * 14).toFixed(2) + 'deg');
      tilt.style.setProperty('--rx', (-y * 10).toFixed(2) + 'deg');
    });
  };
  if (tilt && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    window.addEventListener('pointermove', onMove, { passive: true });
  }

  // 3) вскрытие: печать раскалывается → клапан → письмо → «влетаем» в письмо
  const open = () => {
    if (envelope.classList.contains('is-open')) return;
    gate.classList.add('is-ready', 'is-opening');
    window.removeEventListener('pointermove', onMove);
    if (tilt) { tilt.style.setProperty('--rx', '0deg'); tilt.style.setProperty('--ry', '0deg'); }
    envelope.classList.add('is-open');
    if (window.weddingMusic) window.weddingMusic.start();

    // видео начинаем грузить заранее, пока идёт анимация
    const video = document.getElementById('hero-video');
    if (video) video.preload = 'auto';

    // письмо выехало → конверт уходит вниз, письмо приближается к гостю
    setTimeout(() => envelope.classList.add('is-out'), 2000);
    setTimeout(() => gate.classList.add('is-leaving'), 3150);
    setTimeout(openPage, 3450);
    setTimeout(() => gate.remove(), 4600);
  };

  seal.addEventListener('click', open);
})();

/* ---------------------------------------------------------
   2. Первый экран — по очереди
   --------------------------------------------------------- */
function runHero(hero) {
  hero.querySelectorAll('.reveal').forEach((el, i) => {
    setTimeout(() => el.classList.add('is-in'), reduceMotion ? 0 : 120 + i * 220);
  });
}

/* ---------------------------------------------------------
   2б. Видео на первом экране: без звука по кругу, звук по кнопке
   --------------------------------------------------------- */
(function heroVideo() {
  const video = document.getElementById('hero-video');
  const btn = document.getElementById('hero-sound');
  if (!video) return;

  if (reduceMotion) {
    video.removeAttribute('autoplay');
    video.pause();
    video.controls = true;
    if (btn) btn.hidden = true;
    return;
  }

  // некоторые браузеры игнорируют autoplay — пробуем ещё раз после вскрытия конверта
  window.addEventListener('page:open', () => { video.play().catch(() => {}); });

  if (btn) {
    btn.addEventListener('click', () => {
      video.muted = !video.muted;
      if (!video.muted) {
        video.play().catch(() => {});
        if (window.weddingMusic) window.weddingMusic.pause();
      }
      btn.setAttribute('aria-pressed', String(!video.muted));
    });
    window.addEventListener('music:play', () => {
      video.muted = true;
      btn.setAttribute('aria-pressed', 'false');
    });
  }
})();

/* ---------------------------------------------------------
   3. Обратный отсчёт
   --------------------------------------------------------- */
(function countdown() {
  const els = {
    d: document.getElementById('cd-days'),
    h: document.getElementById('cd-hours'),
    m: document.getElementById('cd-mins'),
    s: document.getElementById('cd-secs'),
  };
  if (!els.d) return;
  const pad = (n) => String(n).padStart(2, '0');
  const set = (el, v) => {
    v = String(v);
    if (el.textContent === v) return;
    el.textContent = v;
    if (reduceMotion) return;
    el.classList.remove('is-tick');
    void el.offsetWidth;
    el.classList.add('is-tick');
  };

  const tick = () => {
    const diff = WEDDING_DATE.getTime() - Date.now();
    if (diff <= 0) {
      Object.values(els).forEach((el) => (el.textContent = '00'));
      clearInterval(timer);
      return;
    }
    set(els.d, Math.floor(diff / 864e5));
    set(els.h, pad(Math.floor((diff % 864e5) / 36e5)));
    set(els.m, pad(Math.floor((diff % 36e5) / 6e4)));
    set(els.s, pad(Math.floor((diff % 6e4) / 1e3)));
  };
  tick();
  const timer = setInterval(tick, 1000);
})();

/* ---------------------------------------------------------
   4. Жемчуг: бусины вдоль любого пути
   --------------------------------------------------------- */
let pearlUid = 0;

function stringPearls(svg, d, r) {
  svg.textContent = '';
  const id = 'pearl-' + (++pearlUid);
  svg.insertAdjacentHTML('beforeend',
    `<defs>
       <radialGradient id="${id}" cx="36%" cy="30%" r="78%">
         <stop offset="0" stop-color="#FFFFFF"/>
         <stop offset="0.16" stop-color="#FCF9F4"/>
         <stop offset="0.5" stop-color="#EDE5DA"/>
         <stop offset="0.78" stop-color="#D6C9BA"/>
         <stop offset="1" stop-color="#AE9F8E"/>
       </radialGradient>
       <radialGradient id="${id}-glow" cx="68%" cy="74%" r="45%">
         <stop offset="0" stop-color="#F6DCD3" stop-opacity="0.75"/>
         <stop offset="1" stop-color="#F6DCD3" stop-opacity="0"/>
       </radialGradient>
     </defs>`);

  const guide = document.createElementNS(SVG_NS, 'path');
  guide.setAttribute('d', d);
  guide.setAttribute('fill', 'none');
  svg.appendChild(guide);

  const len = guide.getTotalLength();

  // шёлковая нить под бусинами
  const thread = guide.cloneNode();
  thread.setAttribute('stroke', 'rgba(255, 250, 242, 0.45)');
  thread.setAttribute('stroke-width', '0.8');
  svg.appendChild(thread);

  // бусины чуть разного размера, как у настоящего жемчуга
  const frag = document.createDocumentFragment();
  let at = 0, i = 0;
  while (at <= len) {
    const k = 0.9 + 0.16 * Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1);
    const rr = r * k;
    const p = guide.getPointAtLength(at);
    const g = document.createElementNS(SVG_NS, 'g');
    g.style.setProperty('--d', (i * 0.014).toFixed(3) + 's');
    g.innerHTML =
      `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${rr.toFixed(2)}" fill="url(#${id})"/>` +
      `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${rr.toFixed(2)}" fill="url(#${id}-glow)"/>`;
    frag.appendChild(g);
    at += rr * 2 + r * 0.12;
    i++;
  }
  guide.remove();
  svg.appendChild(frag);
}

// Плавная кривая через точки (Catmull–Rom → кубические Безье)
function smoothPath(pts) {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

// Программа дня: нитка петляет между временем слева и справа
(function programPearls() {
  const wrap = document.querySelector('.program');
  if (!wrap) return;
  const svg = wrap.querySelector('.program__pearls');
  const items = wrap.querySelectorAll('.program__item');
  const seal = wrap.querySelector('.program__seal');
  let lastW = 0;

  const build = () => {
    const box = wrap.getBoundingClientRect();
    if (!box.width || box.width === lastW) return;
    lastW = box.width;
    const W = box.width, H = box.height;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    const pts = [[W * 0.5, 0]];
    items.forEach((li, i) => {
      const r = li.getBoundingClientRect();
      const y = r.top - box.top + r.height / 2;
      pts.push([W * (i % 2 ? 0.41 : 0.59), y]);
    });
    const sealTop = seal ? seal.offsetTop + 6 : H - 40;
    pts.push([W * 0.5, sealTop]);
    stringPearls(svg, smoothPath(pts), W < 360 ? 4.4 : 5);
  };

  const ready = () => requestAnimationFrame(build);
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(ready);
  window.addEventListener('page:open', ready);
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(build, 150); });
})();

// Два сплетённых сердца в пожеланиях
(function heartPearls() {
  const svg = document.querySelector('.wishes__hearts');
  if (!svg) return;
  const heart = (cx, cy, s) => {
    const pts = [];
    for (let k = 0; k <= 120; k++) {
      const t = (k / 120) * Math.PI * 2;
      const x = 16 * Math.sin(t) ** 3;
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      pts.push(`${(cx + x * s).toFixed(1)} ${(cy - y * s).toFixed(1)}`);
    }
    return 'M' + pts.join(' L');
  };
  stringPearls(svg, heart(82, 50, 2.7) + ' ' + heart(138, 56, 2.7), 3.1);
})();

/* ---------------------------------------------------------
   5. Появление блоков при прокрутке
   --------------------------------------------------------- */
(function reveal() {
  // каждый элемент проявляется сам, когда до него долистали;
  // те, что появились одновременно, идут лесенкой сверху вниз
  const items = [...document.querySelectorAll('.reveal')].filter((el) => !el.closest('.hero'));
  const pearls = document.querySelectorAll('.pearls');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in'));
    pearls.forEach((el) => el.classList.add('is-in'));
    return;
  }

  let queue = [];
  let frame = 0;
  const flush = () => {
    frame = 0;
    queue
      .sort((a, b) => a.top - b.top || a.left - b.left)
      .forEach((q, i) => setTimeout(() => q.el.classList.add('is-in'), i * 120));
    queue = [];
  };

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const t = e.target;
      io.unobserve(t);
      if (t.classList.contains('pearls')) { t.classList.add('is-in'); return; }
      queue.push({ el: t, top: e.boundingClientRect.top, left: e.boundingClientRect.left });
    });
    if (queue.length && !frame) frame = requestAnimationFrame(flush);
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

  // пока конверт закрыт, ничего не запускаем — иначе анимация пройдёт под заставкой
  const start = () => {
    items.forEach((el) => io.observe(el));
    pearls.forEach((el) => io.observe(el));
  };
  if (document.body.classList.contains('is-gated')) window.addEventListener('page:open', start, { once: true });
  else start();
})();

/* ---------------------------------------------------------
   6. Анкета (заглушка — подключение см. README.md)
   --------------------------------------------------------- */
(function rsvp() {
  const form = document.getElementById('rsvp-form');
  const thanks = document.getElementById('rsvp-thanks');
  if (!form) return;

  form.querySelectorAll('.stepper').forEach((st) => {
    const input = st.querySelector('input');
    st.querySelectorAll('[data-step]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const v = (parseInt(input.value, 10) || 1) + Number(btn.dataset.step);
        input.value = Math.min(+input.max || 99, Math.max(+input.min || 1, v));
      });
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    form.reset();
    thanks.hidden = false;
  });
})();

/* ---------------------------------------------------------
   7. Музыка
   Файл: assets/audio/song.mp3. Если его нет — кнопка не появится.
   Браузеры не дают включать звук без действия гостя, поэтому
   музыка стартует в момент нажатия на печать.
   --------------------------------------------------------- */
(function music() {
  const audio = document.getElementById('music');
  const btn = document.getElementById('music-btn');
  if (!audio || !btn) return;

  let available = false;
  audio.volume = 0.55;
  audio.addEventListener('loadedmetadata', () => { available = true; btn.hidden = false; }, { once: true });
  audio.addEventListener('error', () => { available = false; btn.hidden = true; }, { once: true });
  audio.preload = 'metadata';
  audio.load();

  const sync = () => btn.setAttribute('aria-pressed', String(!audio.paused));
  audio.addEventListener('play', () => { sync(); window.dispatchEvent(new Event('music:play')); });
  audio.addEventListener('pause', sync);

  const api = {
    start() { audio.play().catch(() => {}); },
    pause() { audio.pause(); },
  };
  window.weddingMusic = api;

  btn.addEventListener('click', () => {
    if (!available) return;
    if (audio.paused) api.start(); else api.pause();
  });
})();

/* ---------------------------------------------------------
   8. Навигация: появляется после первого экрана,
      подсвечивает раздел, в котором сейчас гость
   --------------------------------------------------------- */
(function nav() {
  const nav = document.getElementById('nav');
  const hero = document.getElementById('hero');
  if (!nav || !hero || !('IntersectionObserver' in window)) return;

  new IntersectionObserver(([e]) => {
    nav.classList.toggle('is-shown', !e.isIntersecting && !document.body.classList.contains('is-gated'));
  }, { threshold: 0.05 }).observe(hero);

  const links = new Map();
  nav.querySelectorAll('.nav__links a').forEach((a) => links.set(a.getAttribute('href').slice(1), a));
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const a = links.get(e.target.id);
      if (a && e.isIntersecting) {
        links.forEach((l) => l.classList.remove('is-active'));
        a.classList.add('is-active');
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  links.forEach((_, id) => { const el = document.getElementById(id); if (el) spy.observe(el); });
})();

/* ---------------------------------------------------------
   9. «Добавить в календарь» — файл .ics (iPhone, Android, Outlook)
   --------------------------------------------------------- */
(function addToCalendar() {
  const btn = document.getElementById('add-to-cal');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DA wedding//RU', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:da-wedding-20270722@invite',
      'DTSTAMP:20261013T000000Z',
      'DTSTART:20270722T113000Z',
      'DTEND:20270722T200000Z',
      'SUMMARY:Свадьба Дмитрия и Анастасии',
      'LOCATION:The Sun\\, озеро Сенеж\\, Солнечногорск',
      'DESCRIPTION:Сбор гостей в 14:30. Ждём вас!',
      'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Завтра свадьба!', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'svadba-22-07-2027.ics' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
})();

/* ---------------------------------------------------------
   10. Фото по бокам письма: проявляются и плывут
       со своей скоростью (только широкие экраны)
   --------------------------------------------------------- */
(function strays() {
  const wide = window.matchMedia('(min-width: 1440px)');
  const items = [...document.querySelectorAll('.stray')];
  if (!items.length || reduceMotion) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }

  let tops = [];
  const measure = () => {
    tops = items.map((el) => {
      let y = 0, n = el;
      while (n) { y += n.offsetTop; n = n.offsetParent; }
      return y + el.offsetHeight / 2;
    });
  };

  let raf = 0;
  const update = () => {
    raf = 0;
    if (!wide.matches) return;
    const mid = window.scrollY + window.innerHeight / 2;
    items.forEach((el, i) => {
      const speed = parseFloat(el.style.getPropertyValue('--speed')) || 0.15;
      el.style.transform = `translate3d(0, ${((tops[i] - mid) * speed).toFixed(1)}px, 0)`;
    });
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('is-in'); });
  }, { rootMargin: '0px 0px -10% 0px' });
  items.forEach((el) => io.observe(el));

  window.addEventListener('page:open', () => { measure(); update(); });
  window.addEventListener('load', () => { measure(); update(); });
  window.addEventListener('resize', () => { measure(); onScroll(); });
  window.addEventListener('scroll', onScroll, { passive: true });
})();

/* ---------------------------------------------------------
   11. Пасхалка: полароид «О нас» переворачивается
   --------------------------------------------------------- */
(function flipPolaroid() {
  const card = document.getElementById('polaroid');
  if (!card) return;
  const flip = () => card.classList.toggle('is-flipped');
  card.addEventListener('click', flip);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
  });
})();
