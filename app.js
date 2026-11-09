// Entre Elas — prévia conceitual (Bruno Luque). "Entre." — a palavra é o convite; a página é uma porta que se abre.
//
// Camadas de motion (IDs da biblioteca em shared/motion-library):
//  · Assinatura: a porta do hero (duas folhas que pivotam; `sp-door-pivot`) e a cena presa "Três portas":
//    a câmera entra em cada porta (translate + escala com mola interrompível), a folha abre conforme a
//    proximidade da câmera. Escolha também por chip, clique na porta e setas.
//  · Narrativa: (1) a folha grande como cortina entre hero e cena (`curtain`, dirigida pela rolagem);
//    (2) o fio vinho que liga as três profissionais (`path`, traço desenhado pela rolagem).
//  · Interface: pressão dos botões, chips das frentes (`ix-tabs-slide` simplificado: troca de painel com
//    origem comum), copiar mensagem com troca de ícone e texto (`ix-copy-confirm`), foco visível.
// O conteúdo funciona sem este arquivo: os estados escondidos só existem depois de `motion-ready`.

const root = document.documentElement;
const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
const fineMQ = matchMedia('(hover: hover) and (pointer: fine)');
const pinMQ = matchMedia('(min-width: 861px) and (min-height: 560px)');
const deskMQ = matchMedia('(min-width: 861px)');
const reduce = reduceMQ.matches;
if (reduce) root.classList.add('reduce');

/* tokens (espelham o CSS) */
const EASE_OUT = [0.23, 1, 0.32, 1];
const EASE_IN_OUT = [0.77, 0, 0.175, 1];
const SPRING_DOOR = { k: 120, c: 17 };      // porta: overshoot discreto
const SPRING_CAM = { k: 95, c: 17.5 };      // câmera: suave, quase crítica
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const M = window.Motion || null;
const motion = !!M && !reduce;
if (!M) console.warn('Motion indisponível; página segue estática.');

/* ------------------------------------------------------------------ */
/* Mola escalar interrompível (velocidade preservada). Um laço só.     */
/* ------------------------------------------------------------------ */
const live = new Set();
let rafId = 0, lastT = 0;
function frame(t) {
  const dt = Math.min(0.032, (t - (lastT || t)) / 1000 || 0.016);
  lastT = t;
  for (const s of live) s.step(dt);
  if (live.size) rafId = requestAnimationFrame(frame); else { rafId = 0; lastT = 0; }
}
function spring(x0, apply, { k = 120, c = 17 } = {}) {
  const s = {
    x: x0, v: 0, t: x0,
    step(dt) {
      const f = -k * (s.x - s.t) - c * s.v;
      s.v += f * dt; s.x += s.v * dt;
      if (Math.abs(s.x - s.t) < 0.0006 && Math.abs(s.v) < 0.0006) { s.x = s.t; s.v = 0; live.delete(s); }
      apply(s.x);
    },
    to(t) { s.t = t; if (!live.has(s)) { live.add(s); if (!rafId) rafId = requestAnimationFrame(frame); } },
    set(x) { s.x = x; s.t = x; s.v = 0; live.delete(s); apply(x); },
  };
  return s;
}

/* ------------------------------------------------------------------ */
/* Copiar mensagem / Direct                                            */
/* ------------------------------------------------------------------ */
const ficha = $('[data-ficha]');
const fichaMsg = $('[data-ficha-msg]');
const base = 'Olá! Vi a página do Entre Elas e gostaria de saber mais sobre';
const assunto = () => (ficha ? ficha.elements.assunto.value : '');
function messageFor(el) {
  switch (el.dataset.msg || el.dataset.copy) {
    case 'area': return `${base} ${el.dataset.area}.`;
    case 'ficha': return `${base} ${assunto() || 'os atendimentos'}.`;
    default: return `${base} os atendimentos.`;
  }
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch {
    const ta = document.createElement('textarea');
    ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove(); return ok;
  }
}
const toastEl = $('[data-toast]');
let toastT = 0;
function toast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg; toastEl.classList.add('is-on');
  clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2600);
}
$$('[data-copy]').forEach((b) => {
  b.hidden = false;
  let t = 0;
  b.addEventListener('click', async () => {
    const ok = await copyText(messageFor(b));
    b.classList.add('is-done'); clearTimeout(t); t = setTimeout(() => b.classList.remove('is-done'), 1900);
    toast(ok ? 'Mensagem copiada. Abra o Direct e cole na conversa.' : 'Não foi possível copiar. Selecione o texto da mensagem.');
  });
});
// ao abrir o Direct, a mensagem correspondente também vai para a área de transferência
$$('a[data-direct]').forEach((a) => a.addEventListener('click', () => {
  copyText(messageFor(a)).then((ok) => ok && toast('Mensagem copiada: é só colar no Direct.'));
}));
function updateFicha() {
  if (!fichaMsg) return;
  const t = messageFor({ dataset: { msg: 'ficha' } });
  if (fichaMsg.textContent === t) return;
  fichaMsg.textContent = t;
  if (motion) M.animate(fichaMsg, { opacity: [0.35, 1], transform: ['translateY(4px)', 'translateY(0px)'] }, { duration: 0.28, ease: EASE_OUT });
}
ficha?.addEventListener('change', updateFicha);

/* ------------------------------------------------------------------ */
/* Cabeçalho, barra de CTA (celular)                                    */
/* ------------------------------------------------------------------ */
const top = $('[data-top]');
const barCta = $('[data-bar-cta]');
const hero = $('[data-hero]');
const contato = $('#contato');
let heroOut = false, contatoIn = false;
function syncBar() { barCta?.classList.toggle('is-on', heroOut && !contatoIn); }
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([e]) => { heroOut = !e.isIntersecting; syncBar(); }, { threshold: 0.15 }).observe(hero);
  new IntersectionObserver(([e]) => { contatoIn = e.isIntersecting; syncBar(); }, { threshold: 0.25 }).observe(contato);
}

/* ------------------------------------------------------------------ */
/* Rolagem contínua (Lenis): só roda do mouse/trackpad; toque nativo    */
/* ------------------------------------------------------------------ */
let lenis = null;
function startLenis() {
  if (reduce || !window.Lenis || lenis || !fineMQ.matches) return;
  lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.95 });
  const raf = (t) => { if (!lenis) return; lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}
if (window.Lenis) startLenis(); else addEventListener('load', startLenis, { once: true });
reduceMQ.addEventListener('change', () => { if (reduceMQ.matches && lenis) { lenis.destroy(); lenis = null; } });
addEventListener('pagehide', () => { if (lenis) { lenis.destroy(); lenis = null; } });

function goTo(y, { instant = false } = {}) {
  if (lenis && !instant) lenis.scrollTo(y, { duration: 1.3, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else scrollTo({ top: y, behavior: reduce || instant ? 'auto' : 'smooth' });
}

/* ------------------------------------------------------------------ */
/* Portas (peça comum): --o = abertura 0..1                             */
/* ------------------------------------------------------------------ */
const setO = (el) => (v) => el.style.setProperty('--o', Math.max(0, Math.min(1.04, v)).toFixed(4));
const heroArch = $('[data-arch="hero"]');
const arches = $$('.track .arch');
const openS = arches.map((a) => spring(1, setO(a), SPRING_DOOR));
const heroS = heroArch ? spring(1, setO(heroArch), SPRING_DOOR) : null;

/* ------------------------------------------------------------------ */
/* Cena presa "Três portas" (desktop, com movimento)                    */
/* ------------------------------------------------------------------ */
const scene = $('[data-scene]');
const track = $('[data-track]');
const stage = $('[data-stage]');
const curtainL = $('.curtain__l');
const curtainR = $('.curtain__r');
const bar = $('[data-bar]');
const hint = $('[data-hint]');
const chips = $$('[data-chip]');
const salas = $$('.sala');
const OV = 0.12;      // trecho inicial: visão geral (portas fechadas)
const ZOOM = 1.42;
let pinned = false;
let active = -2;      // -1 visão geral; 0..2 porta
let pitch = 0, stageW = 0;

const camS = spring(1, () => renderCam(), SPRING_CAM);
const zoomS = spring(1, () => renderCam(), SPRING_CAM);
function renderCam() {
  if (!pinned) return;
  const cam = camS.x, z = zoomS.x;
  const z01 = clamp((z - 1) / (ZOOM - 1));
  const tx = -(cam - 1) * pitch * z + 0.2 * stageW * z01;
  track.style.transform = `translate3d(${tx.toFixed(2)}px,0,0) scale(${z.toFixed(4)})`;
  arches.forEach((a, i) => {
    const prox = clamp(1 - Math.abs(cam - i));
    a.style.opacity = (1 - z01 * (1 - prox) * 0.95).toFixed(3);
  });
}
function measure() {
  if (!pinned) return;
  pitch = arches[1].offsetLeft - arches[0].offsetLeft;
  stageW = stage.clientWidth;
  renderCam();
}
function setActive(idx) {
  if (idx === active) return;
  active = idx;
  camS.to(idx < 0 ? 1 : idx);
  zoomS.to(idx < 0 ? 1 : ZOOM);
  openS.forEach((s, i) => s.to(i === idx ? 1 : 0));
  chips.forEach((c, i) => { if (i === idx) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current'); });
  salas.forEach((s, i) => {
    const on = i === idx;
    s.classList.toggle('is-on', on);
    s.inert = !on; if (on) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
  });
  hint?.classList.toggle('is-off', idx >= 0);
}
function stepY(i) {
  const top0 = scene.getBoundingClientRect().top + scrollY;
  const range = scene.offsetHeight - innerHeight;
  return top0 + (OV + (i + 0.5) * (1 - OV) / 3) * range;
}
function enablePin() {
  pinned = true; root.classList.add('pin-on');
  active = -2; measure(); setActive(-1);
  camS.set(1); zoomS.set(1); openS.forEach((s) => s.set(0));
  renderCam(); update();
}
function disablePin() {
  pinned = false; root.classList.remove('pin-on'); active = -2;
  track.style.transform = ''; arches.forEach((a) => { a.style.opacity = ''; });
  curtainL.style.transform = curtainR.style.transform = '';
  salas.forEach((s) => { s.inert = false; s.removeAttribute('aria-hidden'); s.classList.remove('is-on'); });
  chips.forEach((c) => c.removeAttribute('aria-current'));
  openS.forEach((s, i) => (motion ? s.set(seen[i] ? 1 : 0) : s.set(1)));
}
function syncPin() {
  const want = motion && pinMQ.matches;
  if (want && !pinned) enablePin(); else if (!want && pinned) disablePin();
}
pinMQ.addEventListener('change', syncPin);
addEventListener('resize', () => { measure(); update(); }, { passive: true });

// escolher uma frente: leva a rolagem ao passo correspondente; a mola cuida do resto
function selectStep(i) { goTo(stepY(i)); }
chips.forEach((c, i) => c.addEventListener('click', (e) => {
  if (!pinned) return;           // sem cena presa: âncora normal até a sala
  e.preventDefault(); selectStep(i);
}));
$('[data-chips]')?.addEventListener('keydown', (e) => {
  if (!pinned || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
  e.preventDefault();
  const cur = Math.max(0, chips.indexOf(document.activeElement));
  const next = clamp(cur + (e.key === 'ArrowRight' ? 1 : -1), 0, chips.length - 1);
  chips[next].focus(); selectStep(next);
});
arches.forEach((a, i) => a.addEventListener('click', () => { if (pinned && active !== i) selectStep(i); }));

/* portas abrindo ao entrar na tela (celular / sem cena presa) */
const seen = arches.map(() => false);
if (motion && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    const i = arches.indexOf(e.target);
    if (e.isIntersecting && !seen[i]) { seen[i] = true; if (!pinned) openS[i].to(1); io.unobserve(e.target); }
  }), { threshold: 0.55 });
  arches.forEach((a) => io.observe(a));
} else seen.fill(true);

/* ------------------------------------------------------------------ */
/* Quem cuida: fio vinho + entrada dos cartões                          */
/* ------------------------------------------------------------------ */
const quem = $('[data-quem]');
const quemGrid = $('.quem__grid');
const threadH = $('[data-thread]');
const threadV = $('[data-thread-v]');
const nodes = $$('.node');
const pessoas = $$('[data-pessoa]');
function updateThread() {
  const r = quemGrid.getBoundingClientRect(), vh = innerHeight;
  if (deskMQ.matches) {
    const tp = clamp((vh * 0.9 - r.top - 60) / (vh * 0.5));
    threadH.style.strokeDashoffset = String(1 - tp);
    nodes.forEach((n, i) => n.classList.toggle('is-lit', tp > [0.12, 0.5, 0.88][i]));
  } else {
    const tp = clamp((vh * 0.72 - r.top) / (r.height * 0.9));
    threadV.style.setProperty('--tp', tp.toFixed(3));
    nodes.forEach((n) => n.classList.toggle('is-lit', n.getBoundingClientRect().top < vh * 0.7));
  }
}

/* ------------------------------------------------------------------ */
/* Atualização por rolagem (um só ouvinte, coalescido em rAF)           */
/* ------------------------------------------------------------------ */
let queued = false;
function update() {
  queued = false;
  top.classList.toggle('is-solid', scrollY > 24);
  if (pinned) {
    const r = scene.getBoundingClientRect(), vh = innerHeight;
    // narrativa 1: a folha grande se abre enquanto a cena chega
    const cp = smooth(clamp((clamp((vh - r.top) / vh) - 0.3) / 0.7));
    curtainL.style.transform = `translate3d(${(-cp * 101).toFixed(2)}%,0,0)`;
    curtainR.style.transform = `translate3d(${(cp * 101).toFixed(2)}%,0,0)`;
    const range = Math.max(1, r.height - vh);
    const p = clamp(-r.top / range);
    bar.style.transform = `scaleX(${p.toFixed(4)})`;
    const idx = p < OV ? -1 : Math.min(2, Math.floor((p - OV) / ((1 - OV) / 3)));
    setActive(r.top > vh * 0.2 ? -1 : idx);
  }
  if (motion) updateThread();
}
addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });

/* âncoras do menu com deslocamento do cabeçalho */
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || (a.hasAttribute('data-chip') && pinned)) return;
  const id = a.getAttribute('href');
  const target = id === '#inicio' ? document.body : $(id);
  if (!target) return;
  e.preventDefault();
  const off = id === '#inicio' ? 0 : -(top.offsetHeight + 8);
  const y = id === '#inicio' ? 0 : target.getBoundingClientRect().top + scrollY + off;
  goTo(y);
  if (id !== '#inicio') { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
});

/* ------------------------------------------------------------------ */
/* Coreografia: hero, revelações                                        */
/* ------------------------------------------------------------------ */
function initMotion() {
  root.classList.add('motion-ready');
  const { animate } = M;
  arches.forEach((a) => a.style.setProperty('--o', '0'));
  heroArch.style.setProperty('--o', '0'); heroS.set(0);

  // hero: a palavra sobe da linha; a porta se abre; Elas aparece do lado de dentro
  animate($('.w-entre__in'), { transform: ['translateY(108%)', 'translateY(0%)'] }, { duration: 0.95, ease: EASE_OUT });
  animate($$('.hero .eyebrow, .hero .plate'), { opacity: [0, 1] }, { duration: 0.5, delay: 0.2 });
  setTimeout(() => heroS.to(1), 520);
  animate($$('.hero__lead, .hero__actions'), { opacity: [0, 1] }, { duration: 0.6, delay: 0.7, ease: EASE_OUT });

  // quem cuida e espaço entram ao aparecer
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }), { threshold: 0.2 });
  [$('.quem__head'), ...pessoas, ...$$('[data-reveal]')].forEach((el) => el && io.observe(el));

  syncPin();
  update();
}
if (motion) {
  try { initMotion(); } catch (err) { console.warn(err); root.classList.remove('motion-ready'); }
} else {
  // sem Motion ou com movimento reduzido: tudo aceso
  nodes.forEach((n) => n.classList.add('is-lit'));
  update();
}
