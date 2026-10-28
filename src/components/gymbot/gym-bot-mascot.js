// Mascota animada de GYM BOT, tomada del diseño "GYM BOT Mascota Viva".
/*
 * <gym-bot-mascot> · Mascota animada de GYM BOT
 *
 * Uso:
 *   <script type="module" src="gym-bot-mascot.js"></script>
 *   <gym-bot-mascot progress="65" size="56"></gym-bot-mascot>
 *
 * Atributos
 *   mood         happy | sad | tired | motivated | angry | celebrating | neutral
 *                (también en español: feliz, triste, cansado, motivado, enojado, celebrando, neutral).
 *                Si no se indica, el ánimo sale de `progress`.
 *   progress     0 a 100. Progreso del día o de la meta.
 *   size         Alto en px (por defecto 56). El ancho se calcula solo.
 *   static       Desactiva el seguimiento del cursor y el clic.
 *
 * API
 *   el.react('celebrating', 2500)  Reacción temporal; luego vuelve a su ánimo.
 *   Evento 'moodchange' con detail { mood }.
 */

const MOOD_ALIASES = {
  feliz: 'happy', triste: 'sad', cansado: 'tired', motivado: 'motivated',
  enojado: 'angry', celebrando: 'celebrating', neutro: 'neutral',
};
const MOODS = ['happy', 'sad', 'tired', 'motivated', 'angry', 'celebrating', 'neutral'];

/** Ánimo por defecto según el progreso (0 a 100). */
export function moodFromProgress(p) {
  if (p >= 100) return 'celebrating';
  if (p >= 70) return 'happy';
  if (p >= 35) return 'motivated';
  if (p >= 10) return 'tired';
  return 'sad';
}

const BODY = 'M100 18 C142 18 164 50 166 92 C168 120 176 150 178 180 C180 206 168 222 150 222 L50 222 C32 222 20 206 22 180 C24 150 32 120 34 92 C36 50 58 18 100 18 Z';
const INK = '#1B1512';

// Ojos abiertos con brillo (base de varios ánimos)
const openEyes = (r = 5) => `
  <circle cx="85" cy="88" r="${r}" fill="${INK}"/><circle cx="86.6" cy="86.4" r="${r * .3}" fill="#fff"/>
  <circle cx="115" cy="88" r="${r}" fill="${INK}"/><circle cx="116.6" cy="86.4" r="${r * .3}" fill="#fff"/>`;
const brows = (l, r, w = 2.8) =>
  `<path d="${l}" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" fill="none"/>
   <path d="${r}" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
const line = (d, w = 2.6) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

// Caras: ojos (parpadean), resto de la cara y extras fuera de la cara
const FACES = {
  neutral: {
    eyes: openEyes(),
    face: line('M94 100 Q100 105 106 100'),
  },
  happy: {
    eyes: line('M79.5 90 Q85 83 90.5 90', 3) + line('M109.5 90 Q115 83 120.5 90', 3),
    face: `<path d="M92 98.5 Q100 111 108 98.5 Z" fill="${INK}"/><path d="M95.5 104 Q100 101.5 104.5 104 Q100 108.5 95.5 104 Z" fill="#F28C96"/>`,
    cheeks: .8,
  },
  celebrating: {
    eyes: line('M79 90 Q85 82 91 90', 3.2) + line('M109 90 Q115 82 121 90', 3.2),
    face: `<path d="M90 97.5 Q100 114 110 97.5 Z" fill="${INK}"/><path d="M94.5 105 Q100 101.5 105.5 105 Q100 110.5 94.5 105 Z" fill="#F28C96"/>`,
    cheeks: .9,
    extra: `<g class="sparkles">
      <path class="sp s1" d="M38 40 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 Z" fill="#FFD23F"/>
      <path class="sp s2" d="M162 30 l2.4 6 6 2.4 -6 2.4 -2.4 6 -2.4 -6 -6 -2.4 6 -2.4 Z" fill="#2FB4FF"/>
      <path class="sp s3" d="M172 96 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" fill="#FF4D7A"/>
      <path class="sp s4" d="M24 104 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" fill="#35D68A"/></g>`,
  },
  motivated: {
    eyes: openEyes(5.4),
    face: brows('M77 78.5 Q84 75.5 91 79', 'M109 79 Q116 75.5 123 78.5', 3) +
      `<path d="M92 99 Q100 107.5 108 99 Z" fill="${INK}"/><rect x="95" y="99" width="10" height="2.6" rx="1" fill="#fff"/>`,
    extra: `<g class="flame"><path d="M150 60 C144 52 150 44 152 38 C156 46 164 50 160 60 C158 64 152 64 150 60 Z" fill="#FF9A3D"/>
      <path d="M152 58 C149 54 152 50 153 47 C156 51 158 54 156 58 C155 60 153 60 152 58 Z" fill="#FFD23F"/></g>`,
  },
  tired: {
    eyes: `<path d="M80 88 A5 5 0 0 0 90 88 Z" fill="${INK}"/><path d="M110 88 A5 5 0 0 0 120 88 Z" fill="${INK}"/>` +
      line('M78.5 87.6 L91.5 88.6', 2.4) + line('M108.5 88.6 L121.5 87.6', 2.4),
    face: brows('M78 80 Q84 77.5 91 79.5', 'M109 79.5 Q116 77.5 122 80', 2.4) +
      line('M93.5 103 Q96.75 100.5 100 103 Q103.25 105.5 106.5 103', 2.4),
    cheeks: .3,
    extra: `<path class="sweat" d="M131 64 C131 64 125 72 125 76 A6 6 0 0 0 137 76 C137 72 131 64 131 64 Z" fill="#7CCBFF" stroke="#3A9BE0" stroke-width="1.2"/>
      <g class="zzz" fill="#8A7A6A" font-family="Outfit,Arial,sans-serif" font-weight="800">
      <text x="150" y="48" font-size="14">z</text><text x="160" y="34" font-size="11">z</text></g>`,
  },
  sad: {
    eyes: openEyes(5.2) + '<circle cx="83.4" cy="90.5" r="1" fill="#fff"/><circle cx="113.4" cy="90.5" r="1" fill="#fff"/>',
    face: brows('M78.5 80 Q85 75.5 91 76', 'M109 76 Q115 75.5 121.5 80', 2.6) + line('M94 105 Q100 99.5 106 105'),
    cheeks: .35,
    extra: '<path class="tear" d="M82 95 C82 95 78.5 100.5 78.5 103 A3.5 3.5 0 0 0 85.5 103 C85.5 100.5 82 95 82 95 Z" fill="#7CCBFF"/>',
  },
  angry: {
    eyes: openEyes(4.6),
    face: brows('M77 75 L92 81.5', 'M108 81.5 L123 75', 3.4) +
      `<rect x="92.5" y="98.5" width="15" height="7" rx="2.5" fill="#fff" stroke="${INK}" stroke-width="2.2"/>` + line('M92.5 102 L107.5 102', 1.6),
    cheeks: 1,
    tint: .28,
    extra: `<g class="vein" stroke="#E5394F" stroke-width="3" stroke-linecap="round" fill="none">
      <path d="M128 58 q4 4 0 8"/><path d="M134 54 q4 4 8 0"/><path d="M134 70 q4 -4 8 0"/><path d="M146 58 q-4 4 0 8"/></g>`,
  },
};

const CSS = `
:host{display:inline-block;line-height:0;-webkit-tap-highlight-color:transparent}
.stage{perspective:420px;cursor:pointer}
.tilt{transform:rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));transition:transform .25s ease-out;transform-style:preserve-3d}
:host([static]) .stage{cursor:default}
svg{display:block;overflow:visible}
svg *{transform-box:view-box}
.rig{transform-origin:100px 222px;animation:breathe 3.2s ease-in-out infinite}
.parallax{transform:translate(var(--px,0px),var(--py,0px));transition:transform .25s ease-out}
.eyes{transform-origin:100px 88px;animation:blink 4.6s infinite}
.arms{transform-origin:100px 170px}
.shadow{transform-origin:100px 228px}
.pop{animation:pop .35s ease-out}

@keyframes breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.015,1.025)}}
@keyframes blink{0%,94%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
@keyframes pop{0%{transform:scale(1)}40%{transform:scale(1.08,.92)}70%{transform:scale(.96,1.05)}100%{transform:scale(1)}}

/* Feliz: rebote suave */
.m-happy .rig{animation:hop 1s ease-in-out infinite}
.m-happy .shadow{animation:shadow-hop 1s ease-in-out infinite}
@keyframes hop{0%,100%{transform:translateY(0) scale(1.03,.97)}45%{transform:translateY(-10px) scale(.98,1.03)}}
@keyframes shadow-hop{0%,100%{transform:scale(1);opacity:1}45%{transform:scale(.8);opacity:.6}}

/* Celebrando: saltos altos, brazos arriba, destellos */
.m-celebrating .rig{animation:jump .8s cubic-bezier(.3,0,.4,1) infinite}
.m-celebrating .shadow{animation:shadow-jump .8s cubic-bezier(.3,0,.4,1) infinite}
.m-celebrating .arms{animation:arms-up .8s ease-in-out infinite}
.sp{transform-origin:center;transform-box:fill-box;animation:twinkle 1.2s ease-in-out infinite}
.s2{animation-delay:.3s}.s3{animation-delay:.6s}.s4{animation-delay:.9s}
@keyframes jump{0%,100%{transform:translateY(0) scale(1.05,.95)}50%{transform:translateY(-22px) rotate(-3deg) scale(.97,1.04)}}
@keyframes shadow-jump{0%,100%{transform:scale(1)}50%{transform:scale(.65);opacity:.5}}
@keyframes arms-up{0%,100%{transform:translateY(-6px)}50%{transform:translateY(-24px)}}
@keyframes twinkle{0%,100%{transform:scale(.4) rotate(0);opacity:.3}50%{transform:scale(1.15) rotate(45deg);opacity:1}}

/* Motivado: hace repeticiones con la mancuerna */
.m-motivated .arms{animation:reps 1.1s ease-in-out infinite}
.m-motivated .rig{animation:bob 1.1s ease-in-out infinite}
.flame{transform-origin:152px 62px;animation:flicker .5s ease-in-out infinite alternate}
@keyframes reps{0%,100%{transform:translateY(0)}50%{transform:translateY(-16px)}}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(2px) scale(1.02,.98)}}
@keyframes flicker{from{transform:scale(.92) rotate(-4deg)}to{transform:scale(1.06) rotate(4deg)}}

/* Cansado: respira lento, se inclina, suda */
.m-tired .rig{animation:tired 4s ease-in-out infinite}
.m-tired .arms{transform:translateY(7px) rotate(4deg)}
.sweat{animation:sweat 2.4s ease-in infinite}
.zzz{animation:zzz 3s ease-in-out infinite}
@keyframes tired{0%,100%{transform:rotate(-3deg) scale(1.02,.97)}50%{transform:rotate(-4deg) scale(1.03,.95)}}
@keyframes sweat{0%{transform:translateY(0);opacity:0}15%{opacity:1}80%{opacity:1}100%{transform:translateY(16px);opacity:0}}
@keyframes zzz{0%,100%{transform:translateY(0);opacity:.2}50%{transform:translateY(-6px);opacity:1}}

/* Triste: decaído, se balancea, cae una lágrima */
.m-sad .rig{animation:sway 3.6s ease-in-out infinite}
.m-sad .arms{transform:translateY(9px)}
.m-sad .body-fill{filter:saturate(.75)}
.tear{animation:tear 2.2s ease-in infinite}
@keyframes sway{0%,100%{transform:translateY(4px) rotate(-1.5deg) scale(1.02,.96)}50%{transform:translateY(4px) rotate(1.5deg) scale(1.02,.96)}}
@keyframes tear{0%{transform:translateY(0) scale(.6);opacity:0}20%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(22px);opacity:0}}

/* Enojado: tiembla, cara roja, vena */
.m-angry .rig{animation:shake 2s ease-in-out infinite}
.m-angry .arms{transform:translateY(-4px)}
.vein{transform-origin:137px 62px;animation:throb .6s ease-in-out infinite alternate}
@keyframes shake{0%,60%,100%{transform:translateX(0)}64%,72%,80%{transform:translateX(-3px) rotate(-1deg)}68%,76%,84%{transform:translateX(3px) rotate(1deg)}}
@keyframes throb{from{transform:scale(.85)}to{transform:scale(1.1)}}

@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
`;

let instanceCount = 0;

class GymBotMascot extends HTMLElement {
  static get observedAttributes() { return ['mood', 'progress', 'size', 'static']; }

  constructor() {
    super();
    this._id = `gbm${++instanceCount}`;
    this._reaction = null;
    this._onPointer = this._onPointer.bind(this);
    this._onLeave = this._onLeave.bind(this);
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    if (!this._built) this._build();
    this._update();
    window.addEventListener('pointermove', this._onPointer, { passive: true });
    document.addEventListener('pointerleave', this._onLeave);
  }

  disconnectedCallback() {
    window.removeEventListener('pointermove', this._onPointer);
    document.removeEventListener('pointerleave', this._onLeave);
    clearTimeout(this._reactionTimer);
  }

  attributeChangedCallback() { if (this._built) this._update(); }

  get mood() { return this._currentMood; }

  /** Muestra un ánimo por un tiempo y vuelve al anterior. */
  react(mood, ms = 2000) {
    this._reaction = normalize(mood);
    clearTimeout(this._reactionTimer);
    this._update();
    this._reactionTimer = setTimeout(() => { this._reaction = null; this._update(); }, ms);
  }

  _build() {
    const id = this._id;
    this.shadowRoot.innerHTML = `<style>${CSS}</style>
<div class="stage" part="stage"><div class="tilt">
<svg viewBox="-10 -10 220 250" aria-hidden="true">
<defs>
<linearGradient id="${id}-rb" gradientUnits="userSpaceOnUse" x1="30" y1="0" x2="170" y2="0"><stop offset="0" stop-color="#FF4D7A"/><stop offset=".22" stop-color="#FF9A3D"/><stop offset=".42" stop-color="#FFD23F"/><stop offset=".6" stop-color="#35D68A"/><stop offset=".8" stop-color="#2FB4FF"/><stop offset="1" stop-color="#8A5CFF"/></linearGradient>
<radialGradient id="${id}-fur" cx=".42" cy=".3" r=".8"><stop offset="0" stop-color="#FBF5EA"/><stop offset=".6" stop-color="#EFE4D2"/><stop offset="1" stop-color="#D6C4A7"/></radialGradient>
<radialGradient id="${id}-skin" cx=".45" cy=".38" r=".7"><stop offset="0" stop-color="#F9E0CA"/><stop offset="1" stop-color="#E9C2A2"/></radialGradient>
<radialGradient id="${id}-shine" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<filter id="${id}-fur-f" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G"/></filter>
<filter id="${id}-b3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="${id}-b6" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
<clipPath id="${id}-clip"><path d="${BODY}"/></clipPath>
</defs>
<ellipse class="shadow" cx="100" cy="228" rx="62" ry="7" fill="#5A4630" opacity=".22" filter="url(#${id}-b6)"/>
<g class="rig"><g class="pop-target">
  <g class="body-fill" filter="url(#${id}-fur-f)">
    <path d="${BODY}" fill="url(#${id}-fur)"/>
    <g clip-path="url(#${id}-clip)">
      <path d="M10 52 Q100 20 190 52 L190 66 Q100 34 10 66 Z" fill="url(#${id}-rb)"/>
      <ellipse class="shine" cx="72" cy="58" rx="34" ry="26" fill="url(#${id}-shine)" opacity=".55"/>
      <path d="M150 40 C172 80 176 150 178 200 L190 200 L190 30 Z" fill="#B49A78" opacity=".18"/>
    </g>
  </g>
  <g class="parallax">
    <ellipse cx="100" cy="88" rx="43" ry="37" fill="#B49A78" opacity=".55" filter="url(#${id}-b3)"/>
    <ellipse cx="100" cy="89" rx="40" ry="34" fill="url(#${id}-skin)"/>
    <ellipse class="tint" cx="100" cy="92" rx="38" ry="30" fill="#FF4D5E" opacity="0" filter="url(#${id}-b3)"/>
    <ellipse class="cheek" cx="76" cy="100" rx="8" ry="5" fill="#F28C96" opacity=".55" filter="url(#${id}-b3)"/>
    <ellipse class="cheek" cx="124" cy="100" rx="8" ry="5" fill="#F28C96" opacity=".55" filter="url(#${id}-b3)"/>
    <g class="eyes"></g>
    <g class="face"></g>
  </g>
  <g class="extra"></g>
  <g class="arms">
    <rect x="44" y="167" width="112" height="6" rx="3" fill="#3A3444"/>
    <rect x="44" y="152" width="11" height="36" rx="4.5" fill="url(#${id}-rb)"/>
    <rect x="34" y="158" width="9" height="24" rx="3.5" fill="url(#${id}-rb)"/>
    <rect x="145" y="152" width="11" height="36" rx="4.5" fill="url(#${id}-rb)"/>
    <rect x="157" y="158" width="9" height="24" rx="3.5" fill="url(#${id}-rb)"/>
    <g filter="url(#${id}-fur-f)">
      <ellipse cx="64" cy="152" rx="13" ry="24" fill="url(#${id}-fur)" transform="rotate(-28 64 152)"/>
      <ellipse cx="136" cy="152" rx="13" ry="24" fill="url(#${id}-fur)" transform="rotate(28 136 152)"/>
    </g>
  </g>
</g></g>
</svg></div></div>`;
    const $ = (s) => this.shadowRoot.querySelector(s);
    this._els = {
      stage: $('.stage'), tilt: $('.tilt'), svg: $('svg'), pop: $('.pop-target'), eyes: $('.eyes'),
      face: $('.face'), extra: $('.extra'), tint: $('.tint'), cheeks: this.shadowRoot.querySelectorAll('.cheek'),
      parallax: $('.parallax'),
    };
    this._els.stage.addEventListener('click', () => {
      if (this.hasAttribute('static')) return;
      // Al tocarlo se alegra un momento (si está enojado, se enoja más)
      this.react(this._baseMood() === 'angry' ? 'angry' : 'happy', 1400);
    });
    this._built = true;
  }

  _baseMood() {
    const attr = this.getAttribute('mood');
    if (attr) return normalize(attr);
    const p = parseFloat(this.getAttribute('progress'));
    return moodFromProgress(Number.isFinite(p) ? p : 50);
  }

  _update() {
    const size = parseFloat(this.getAttribute('size')) || 56;
    this._els.svg.setAttribute('height', size);
    this._els.svg.setAttribute('width', (size * 220 / 250).toFixed(1));

    const mood = this._reaction || this._baseMood();
    if (mood === this._currentMood) return;
    const f = FACES[mood];
    this._els.stage.className = `stage m-${mood}`;
    this._els.eyes.innerHTML = f.eyes;
    this._els.face.innerHTML = f.face || '';
    this._els.extra.innerHTML = f.extra || '';
    this._els.tint.setAttribute('opacity', f.tint || 0);
    this._els.cheeks.forEach((c) => {
      c.setAttribute('opacity', f.cheeks ?? .55);
      c.setAttribute('fill', mood === 'angry' ? '#E5394F' : '#F28C96');
    });
    // Pequeño "squash" al cambiar de ánimo
    if (this._currentMood) {
      this._els.pop.classList.remove('pop');
      void this._els.pop.getBoundingClientRect();
      this._els.pop.classList.add('pop');
    }
    this._currentMood = mood;
    this.setAttribute('aria-label', `GYM BOT ${mood}`);
    this.dispatchEvent(new CustomEvent('moodchange', { detail: { mood }, bubbles: true }));
  }

  // Inclinación 3D y parallax de la cara siguiendo el cursor
  _onPointer(e) {
    if (this.hasAttribute('static') || !this._els) return;
    const r = this.getBoundingClientRect();
    const dx = clamp((e.clientX - (r.left + r.width / 2)) / 300, -1, 1);
    const dy = clamp((e.clientY - (r.top + r.height / 2)) / 300, -1, 1);
    this._els.tilt.style.setProperty('--ry', `${dx * 18}deg`);
    this._els.tilt.style.setProperty('--rx', `${-dy * 12}deg`);
    this._els.parallax.style.setProperty('--px', `${dx * 5}px`);
    this._els.parallax.style.setProperty('--py', `${dy * 4}px`);
  }

  _onLeave() {
    if (!this._els) return;
    ['--ry', '--rx'].forEach((p) => this._els.tilt.style.removeProperty(p));
    ['--px', '--py'].forEach((p) => this._els.parallax.style.removeProperty(p));
  }
}

function normalize(m) {
  const k = String(m || '').trim().toLowerCase();
  const v = MOOD_ALIASES[k] || k;
  return MOODS.includes(v) ? v : 'neutral';
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

if (!customElements.get('gym-bot-mascot')) customElements.define('gym-bot-mascot', GymBotMascot);
export { GymBotMascot, MOODS };
