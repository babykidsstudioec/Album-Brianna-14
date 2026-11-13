/* Motor del álbum de páginas 3D — sin dependencias externas. */
(() => {
  'use strict';
  const conf = ALBUM_CONFIG;
  const $ = (id) => document.getElementById(id);
  const book = $('book');
  const sheetsWrap = $('sheets');
  const audio = $('backgroundMusic');
  const intro = $('intro');
  const sheetData = [];
  const pageData = [
    { type: 'cover' },
    ...conf.recuerdos.map((entry) => ({ type: 'age', ...entry })),
    { type: 'letter' },
    { type: 'backcover' }
  ];

  let current = 0;
  let moving = false;
  let hasOpened = false;
  let audioCtx = null;
  let lastSwipeTime = 0;
  let dragStart = null;
  const maxStep = 9; // permite abrir también la contraportada de la marca

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  function pageMarkup(info, i) {
    if (info.type === 'cover') {
      return `<div class="book-cover">
        <span class="book-cover__flowers">✿ ❀</span><span class="book-cover__flowers book-cover__flowers--right">❀ ✿</span>
        <div class="book-cover__small">NUESTROS MOMENTOS MÁS BONITOS</div>
        <div class="book-cover__age">${escapeHTML(conf.titulo)}</div>
        <div class="book-cover__name">${escapeHTML(conf.nombre)}</div>
        <div class="book-cover__symbol">♡ ✧ ♡</div>
        <div class="book-cover__end">Un recuerdo por cada año vivido.</div>
      </div>`;
    }
    if (info.type === 'backcover') {
      return `<div class="book-cover book-cover--back" aria-label="Contraportada de Momentos Digitales SP">
        <picture class="book-cover__brand-picture">
          <source media="(max-width: 520px)" srcset="assets/brand/contraportada-mobile.svg" />
          <img class="book-cover__brand-art" src="assets/brand/contraportada-desktop.svg"
               alt="Momentos Digitales SP. Creamos recuerdos, celebramos momentos. Álbum fotográfico digital."
               decoding="async" />
        </picture>
      </div>`;
    }
    if (info.type === 'letter') {
      return `<section class="letter-page">
        <div class="letter-page__icon">♡</div>
        <span class="letter-page__eyebrow">UNA CARTA PARA TI</span>
        <h3>${escapeHTML(conf.nombre)}</h3>
        <p>${escapeHTML(conf.mensajeFinal)}</p>
        <div class="letter-page__footer">Con todo nuestro amor ♡</div>
      </section>`;
    }
    const edad = Number(info.edad);
    return `<article class="memory-page" data-age="${edad}" style="--photo-pos:${escapeHTML(info.foco || '50% 50%')};--photo-zoom:${escapeHTML(info.zoom || 1)};--photo-fit:${escapeHTML(info.fit || 'contain')}">
       <div class="memory-page__photo" style="--photo-bg:url('${escapeHTML(info.foto)}')"><img src="${escapeHTML(info.foto)}" alt="${escapeHTML(conf.nombre)} a los ${edad} ${edad === 1 ? 'año' : 'años'}" ${edad <= 2 ? 'loading="eager"' : 'loading="lazy"'} decoding="async"></div>
       <div class="memory-page__caption">
         <div class="memory-page__caption-top"><span class="memory-page__top">UN AÑO · UN RECUERDO</span><span class="memory-page__number">✧ ${String(i).padStart(2, '0')}</span></div>
         <h3 class="memory-page__title">${edad === 0 ? 'Tu llegada' : edad + (edad === 1 ? ' añito' : ' años')}</h3>
         <p class="memory-page__quote">${escapeHTML(info.frase)}</p>
       </div>
    </article>`;
  }

  function initialize() {
    $('heroTitle').textContent = conf.titulo;
    $('heroName').textContent = conf.nombre;
    $('headerName').textContent = conf.nombre;
    $('heroSubtitle').textContent = conf.subtitulo;
    $('footerDedication').textContent = conf.dedicatoria;
    document.title = `${conf.nombre} · 14 Years of You · Álbum 3D`;
    audio.src = conf.musica;
    audio.volume = .40;
    for (let i=0; i < pageData.length / 2; i++) {
      const div = document.createElement('div');
      div.className = 'sheet';
      div.dataset.index = i;
      div.innerHTML = `<div class="paper-face sheet-front">${pageMarkup(pageData[i*2], i*2)}<span class="page-sheen" aria-hidden="true"></span><span class="fold-gloss" aria-hidden="true"></span><span class="fold-corner" aria-hidden="true"></span></div>
                       <div class="paper-face sheet-back">${pageMarkup(pageData[i*2+1], i*2+1)}<span class="page-sheen" aria-hidden="true"></span><span class="fold-gloss" aria-hidden="true"></span><span class="fold-corner" aria-hidden="true"></span></div>`;
      sheetsWrap.append(div);
      sheetData.push(div);
      // El giro lo controla Web Animations API; no dependemos de eventos CSS.

    }
    setStackOrder();
    updateButtons();
    // Resolve previews/next pages early: all assets are local and optimized.
    for (const entry of conf.recuerdos) { const img = new Image(); img.src = entry.foto; }
    $('startBtn').addEventListener('click', startExperience);
    $('nextBtn').addEventListener('click', () => flipTo(current + 1));
    $('prevBtn').addEventListener('click', () => flipTo(current - 1));
    $('homeBtn').addEventListener('click', returnToCover);
    $('musicBtn').addEventListener('click', toggleMusic);
    $('fullscreenBtn').addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', syncFullscreenUI);
    document.addEventListener('webkitfullscreenchange', syncFullscreenUI);
    document.addEventListener('keydown', (e) => {
      if (!hasOpened) { if (e.key==='Enter' && document.activeElement === $('startBtn')) startExperience(); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); flipTo(current+1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); flipTo(current-1); }
      if (e.key === 'Escape' && !document.fullscreenElement) { document.body.classList.remove('cinema-mode'); syncFullscreenUI(); }
    });
    // Swipe on mobile, while allowing normal vertical scrolling.
    book.addEventListener('pointerdown', (e) => { dragStart = {x:e.clientX,y:e.clientY}; });
    book.addEventListener('pointerup', (e) => {
      if (!dragStart || !hasOpened) return;
      const dx = e.clientX - dragStart.x; const dy = e.clientY - dragStart.y;
      dragStart = null;
      if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy)*1.2) {
        lastSwipeTime = Date.now();
        flipTo(current + (dx < 0 ? 1 : -1));
      }
    });
    book.addEventListener('pointercancel', () => { dragStart = null; });
    book.addEventListener('click', (e) => {
      if (Date.now() - lastSwipeTime < 500 || !hasOpened || moving) return;
      const rect = book.getBoundingClientRect();
      flipTo(current + (e.clientX < rect.left + rect.width / 2 ? -1 : 1));
    });
  }

  function setStackOrder() {
    for (let i=0; i<sheetData.length; i++) {
      const flipped = i < current;
      sheetData[i].classList.toggle('is-flipped', flipped);
      sheetData[i].style.zIndex = flipped ? String(11+i) : String(sheetData.length-i);
    }
  }

  function updateButtons() {
    $('prevBtn').disabled = moving || current <= 0;
    $('nextBtn').disabled = moving || current >= maxStep;
    $('homeBtn').disabled = moving || current <= 0;
    const labels = [
      'La portada de Brianna',
      'De recién nacida a su primer añito',
      'Sus 2 y 3 años',
      'Sus 4 y 5 años',
      'Sus 6 y 7 años',
      'Sus 8 y 9 años',
      'Sus 10 y 11 años',
      'Sus 12 y 13 años',
      'Sus 14 años y una carta especial',
      'Contraportada · Momentos Digitales SP'
    ];
    $('spreadLabel').textContent = labels[current];
    $('spreadProgress').textContent = `${String(Math.max(1,current)).padStart(2,'0')} / 09`;
    $('announcer').textContent = labels[current];
  }


// Giro de hoja estilo álbum Valentina: levantamiento de esquina, doblez,
// perspectiva y sombra sobre el libro. Animación activada por el lector.
const PAGE_TURN_MS = 1700;
let activeTurn = null;
function ease(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2; }
function flipTo(target) {
  if (!hasOpened || moving || target === current || target < 0 || target > maxStep) return;
  const forward = target > current;
  const sheet = sheetData[forward ? current : current - 1];
  if (!sheet) return;
  moving = true;
  current = target;
  sheet.style.zIndex = '350';
  sheet.classList.add('is-turning');
  sheet.classList.toggle('turn-forward',forward);
  sheet.classList.toggle('turn-backward',!forward);
  const pageLights = sheet.querySelectorAll('.page-sheen');
  const start = performance.now();
  let raf = 0;
  function tick(now) {
    const p = Math.min(1,Math.max(0,(now-start)/PAGE_TURN_MS));
    const e = ease(p);
    const curve = Math.sin(Math.PI * e);
    const angle = forward ? -180*e : -180*(1-e);
    const lift = 7 + 58*curve;
    // La inclinación imita la esquina curvada del video de Valentina.
    const tiltZ = (forward ? -1 : 1) * Math.sin(2*Math.PI*e) * 2.1;
    const tiltX = Math.sin(2*Math.PI*e)*1.3;
    const pageWidth = 1 - .05*curve;
    sheet.style.transform = `rotateY(${angle.toFixed(2)}deg) rotateZ(${tiltZ.toFixed(2)}deg) rotateX(${tiltX.toFixed(2)}deg) translateZ(${lift.toFixed(2)}px) scaleX(${pageWidth.toFixed(4)})`;
    const shade = Math.pow(curve,.85);
    sheet.style.setProperty('--curl-light', shade.toFixed(3));
    sheet.style.setProperty('--fold-px', `${Math.round(10+62*Math.min(1,p*3)*(1-Math.max(0,(p-.55)*1.9)))}px`);
    for (const light of pageLights) light.style.opacity = (shade*.57).toFixed(3);
    if (p < 1) { raf = requestAnimationFrame(tick); return; }
    sheet.classList.toggle('is-flipped',forward);
    sheet.style.transform='';
    sheet.style.removeProperty('--curl-light');
    sheet.style.removeProperty('--fold-px');
    pageLights.forEach(x=>x.style.opacity='');
    sheet.classList.remove('is-turning','turn-forward','turn-backward');
    activeTurn=null; moving=false;
    setStackOrder(); updateButtons();
  }
  activeTurn = {stop:()=>cancelAnimationFrame(raf)};
  playTurnSound();updateButtons();
  raf = requestAnimationFrame(tick);
}

// Volver a la portada en un solo toque, incluso desde las últimas páginas.
  function returnToCover() {
    if (!hasOpened || moving || current === 0) return;
    book.classList.add('is-resetting');
    current = 0;
    setStackOrder();
    updateButtons();
    requestAnimationFrame(() => requestAnimationFrame(() => book.classList.remove('is-resetting')));
  }

  function startExperience() {
    if (hasOpened) return;
    hasOpened = true;
    intro.classList.add('is-gone');
    // A click is a user gesture: audio is explicitly started, and can always be muted.
    try {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.then(() => markMusic(true)).catch(() => markMusic(false));
      } else markMusic(true);
    } catch (_) { markMusic(false); }
    window.setTimeout(() => { intro.setAttribute('aria-hidden','true'); flipTo(1); }, 530);
  }

  function markMusic(on) {
    $('musicBtn').setAttribute('aria-pressed',String(on));
    $('musicBtnLabel').textContent = on ? 'Pausar música' : 'Música';
    $('musicBtn').querySelector('.control__symbol').textContent = on ? '♫' : '♪';
  }
  function toggleMusic() {
    if (audio.paused) {
      audio.play().then(()=>markMusic(true)).catch(()=>markMusic(false));
    } else { audio.pause();markMusic(false); }
  }

function syncFullscreenUI() {
  const active=Boolean(document.fullscreenElement || document.webkitFullscreenElement || document.body.classList.contains('cinema-mode'));
  const btn=$('fullscreenBtn');
  btn.setAttribute('aria-pressed',String(active));
  btn.setAttribute('aria-label', active ? 'Salir de pantalla completa' : 'Activar pantalla completa');
  const label=$('fullscreenBtnLabel');
  if (label) label.textContent=active?'Salir':'Pantalla completa';
  btn.querySelector('.control__symbol').textContent=active?'⤡':'⛶';
}
async function toggleFullscreen() {
  const elem=$('experience');
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } else if (elem.requestFullscreen) {
      document.body.classList.remove('cinema-mode');
      await elem.requestFullscreen({navigationUI:'hide'});
    } else if (elem.webkitRequestFullscreen) {
      document.body.classList.remove('cinema-mode');
      elem.webkitRequestFullscreen();
    } else {
      // Respaldo para navegadores que no admiten Fullscreen API.
      document.body.classList.toggle('cinema-mode');
    }
  } catch(err) {
    // Algunos navegadores móviles impiden pantalla completa a una pestaña.
    document.body.classList.toggle('cinema-mode');
  }
  syncFullscreenUI();
}

function playTurnSound() {
    try {
      const AudioC = window.AudioContext || window.webkitAudioContext;
      if (!AudioC) return;
      audioCtx ||= new AudioC();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const d=.38, sr=audioCtx.sampleRate, size=Math.floor(sr*d);
      const buffer=audioCtx.createBuffer(1,size,sr), data=buffer.getChannelData(0);
      for (let i=0;i<size;i++) {
        const t=i/sr;
        const envelope=Math.pow(Math.sin(Math.PI * t / d),2) * Math.exp(-1.1*t);
        data[i] = (Math.random()*2-1)*envelope*.19;
      }
      const source=audioCtx.createBufferSource(); source.buffer=buffer;
      const filter=audioCtx.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=2100;
      const gain=audioCtx.createGain();gain.gain.value=.65;
      source.connect(filter).connect(gain).connect(audioCtx.destination);
      source.start();source.stop(audioCtx.currentTime + d);
    } catch(_) { /* The album still works without audio support. */ }
  }
  document.addEventListener('DOMContentLoaded', initialize);
})();
