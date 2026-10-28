// Ilustración vectorial original (sin fotografías externas): figura entrenando con mancuerna.
export function HeroArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 300" className={className} role="img" aria-label="Ilustración de una persona entrenando con una mancuerna">
      <defs>
        <linearGradient id="ha-glow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="200" cy="150" r="120" fill="url(#ha-glow)" />
      <circle cx="200" cy="150" r="88" fill="none" stroke="#fff" strokeOpacity=".25" strokeWidth="2" strokeDasharray="4 10" />
      {/* suelo */}
      <path d="M70 252h260" stroke="#fff" strokeOpacity=".5" strokeWidth="3" strokeLinecap="round" />
      {/* figura en zancada con press */}
      <g fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M200 132l-6 52" />
        <path d="M194 184l-38 30 4 38" />
        <path d="M194 184l36 22 10 46" />
        <path d="M198 142l-30-12-6-34" />
        <path d="M198 142l34-6 10-40" />
      </g>
      <circle cx="203" cy="110" r="15" fill="#fff" />
      {/* mancuernas */}
      <g fill="#fff">
        <rect x="148" y="80" width="28" height="7" rx="3.5" />
        <rect x="143" y="72" width="9" height="23" rx="3" />
        <rect x="172" y="72" width="9" height="23" rx="3" />
        <rect x="228" y="80" width="28" height="7" rx="3.5" />
        <rect x="223" y="72" width="9" height="23" rx="3" />
        <rect x="252" y="72" width="9" height="23" rx="3" />
      </g>
      {/* acentos */}
      <g stroke="#fff" strokeOpacity=".6" strokeWidth="3" strokeLinecap="round">
        <path d="M100 110h22M92 128h30M290 170h24M296 188h18" />
      </g>
    </svg>
  );
}
