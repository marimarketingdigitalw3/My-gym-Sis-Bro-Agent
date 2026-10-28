// Ilustración plana de una persona levantando una mancuerna. "sis" dibuja una figura femenina y "bro" una masculina.
// Es decorativa: usa currentColor para adaptarse a cada tema.
export function AthleteArt({ variant, className }: { variant: "sis" | "bro"; className?: string }) {
  const bro = variant === "bro";
  const shoulderL = bro ? 52 : 60;
  const shoulderR = bro ? 108 : 100;
  return (
    <svg viewBox="0 0 160 210" className={className} aria-hidden focusable="false">
      <circle cx="80" cy="110" r="74" fill={bro ? "currentColor" : "rgb(var(--accent))"} opacity={bro ? 0.12 : 0.55} />
      {/* Mancuerna */}
      <g fill="currentColor">
        <rect x="30" y="14" width="100" height="5" rx="2.5" />
        <rect x="24" y="4" width="10" height="25" rx="3" />
        <rect x="126" y="4" width="10" height="25" rx="3" />
        <rect x="16" y="8" width="8" height="17" rx="3" opacity="0.8" />
        <rect x="136" y="8" width="8" height="17" rx="3" opacity="0.8" />
      </g>
      {/* Brazos */}
      <g stroke="currentColor" strokeWidth={bro ? 12 : 9} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <polyline points={`${shoulderL + 4},72 ${shoulderL - 12},50 46,20`} />
        <polyline points={`${shoulderR - 4},72 ${shoulderR + 12},50 114,20`} />
      </g>
      {/* Cabeza y cabello */}
      <g fill="currentColor">
        <circle cx="80" cy="44" r={bro ? 15 : 14} />
        {bro ? (
          <path d="M65 40c0-11 7-17 15-17s15 6 15 17c-3-5-8-7-15-7s-12 2-15 7z" opacity="0.7" />
        ) : (
          <>
            <circle cx="80" cy="25" r="8" />
            <path d="M88 26c10 2 14 10 12 22-4-7-8-11-13-13z" opacity="0.85" />
          </>
        )}
        {/* Torso */}
        <path d={bro
          ? `M${shoulderL} 66Q80 60 ${shoulderR} 66L96 124H64Z`
          : `M${shoulderL} 66Q80 61 ${shoulderR} 66L92 104Q96 116 94 128H66Q64 116 68 104Z`} />
      </g>
      {/* Piernas */}
      <g stroke="currentColor" strokeWidth={bro ? 15 : 12} strokeLinecap="round" fill="none">
        <polyline points="70,124 60,160 54,200" />
        <polyline points="90,124 100,160 106,200" />
      </g>
    </svg>
  );
}
