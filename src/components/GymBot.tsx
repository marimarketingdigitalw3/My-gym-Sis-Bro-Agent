// Gym Bot: mascota de peluche con cinta arcoíris (diseño "Gym Bot Logo", ronda 2).
// Se usa como logotipo, ícono de la app y avatar del coach.
import { useId } from "react";
import { storedTheme, useUserData } from "@/app/providers";
import type { GymBotMood } from "@/lib/gymbotMood";

export const RAINBOW_STOPS: [number, string][] = [
  [0, "#FF4D7A"], [0.22, "#FF9A3D"], [0.42, "#FFD23F"], [0.6, "#35D68A"], [0.8, "#2FB4FF"], [1, "#8A5CFF"],
];
export const RAINBOW_CSS = `linear-gradient(135deg, ${RAINBOW_STOPS.map(([o, c]) => `${c} ${o * 100}%`).join(", ")})`;

const BODY = "M100 18 C142 18 164 50 166 92 C168 120 176 150 178 180 C180 206 168 222 150 222 L50 222 C32 222 20 206 22 180 C24 150 32 120 34 92 C36 50 58 18 100 18 Z";

const INK = "#1B1512";
const STAR = "M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z";

/** Ojos, cejas, boca y detalles de cada estado de ánimo. "tranquilo" es la cara original del logo. */
function Face({ mood }: { mood: GymBotMood }) {
  const line = { fill: "none", stroke: INK, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const openEyes = (
    <>
      <circle cx="85" cy="88" r="5" fill={INK} /><circle cx="86.6" cy="86.4" r={mood === "triste" ? 2 : 1.5} fill="#FFFFFF" />
      <circle cx="115" cy="88" r="5" fill={INK} /><circle cx="116.6" cy="86.4" r={mood === "triste" ? 2 : 1.5} fill="#FFFFFF" />
    </>
  );
  switch (mood) {
    case "feliz":
      return (
        <>
          <path d="M79 90 Q85 82 91 90 M109 90 Q115 82 121 90" {...line} strokeWidth={3} />
          <path d="M91 98 Q100 111 109 98 Z" fill={INK} />
          <ellipse cx="100" cy="104.5" rx="4" ry="2.4" fill="#F28C96" />
          <g className="gb-sparkle" fill="#FFD23F">
            <path d={STAR} transform="translate(34 44)" />
            <path d={STAR} transform="translate(168 50) scale(.8)" />
            <path d={STAR} transform="translate(176 96) scale(.55)" />
          </g>
        </>
      );
    case "motivado":
      return (
        <>
          {openEyes}
          <path d="M77 77 L92 80 M123 77 L108 80" {...line} strokeWidth={2.8} />
          <path d="M90 99 Q100 109 110 99" {...line} strokeWidth={2.8} />
        </>
      );
    case "cansado":
      return (
        <>
          <path d="M80 88 A5 5 0 0 0 90 88 Z M110 88 A5 5 0 0 0 120 88 Z" fill={INK} />
          <path d="M78.5 87.5 L91.5 87.5 M108.5 87.5 L121.5 87.5" {...line} strokeWidth={2.6} />
          <ellipse cx="100" cy="103" rx="3.6" ry="3" fill={INK} opacity=".85" />
          <path d="M147 62 q6 9 0 13 q-6 -4 0 -13Z" fill="#8ED0FF" />
          <path className="gb-zz" d="M150 22 h10 l-10 12 h10 M166 8 h7 l-7 8 h7" {...line} strokeWidth={2.4} />
        </>
      );
    case "triste":
      return (
        <>
          {openEyes}
          <path d="M78 80 L92 75 M122 80 L108 75" {...line} strokeWidth={2.6} />
          <path d="M93 105 Q100 98 107 105" {...line} strokeWidth={2.6} />
          <path className="gb-tear" d="M83 96 q4 7 0 10 q-4 -3 0 -10Z" fill="#6EC1FF" />
        </>
      );
    case "enojado":
      return (
        <>
          {openEyes}
          <path d="M77 74 L93 82 M123 74 L107 82" {...line} strokeWidth={3.2} />
          <path d="M92 104 Q100 99 108 104" {...line} strokeWidth={3} />
          <ellipse cx="76" cy="100" rx="8" ry="5" fill="#FF6B6B" opacity=".45" />
          <ellipse cx="124" cy="100" rx="8" ry="5" fill="#FF6B6B" opacity=".45" />
          <path d="M146 30 q5 5 0 10 M160 30 q-5 5 0 10 M148 28 q5 -5 10 0 M148 42 q5 5 10 0" fill="none" stroke="#FF4D7A" strokeWidth={3} strokeLinecap="round" />
        </>
      );
    default:
      return (
        <>
          {openEyes}
          <path d="M94 100 Q100 105 106 100" {...line} strokeWidth={2.6} />
        </>
      );
  }
}

function Mascot({ id, shadow, mood = "tranquilo", animate = false }: { id: string; shadow?: boolean; mood?: GymBotMood; animate?: boolean }) {
  const u = (name: string) => `url(#${id}-${name})`;
  return (
    <>
      <defs>
        <linearGradient id={`${id}-rb`} gradientUnits="userSpaceOnUse" x1="30" y1="0" x2="170" y2="0">
          {RAINBOW_STOPS.map(([o, c]) => <stop key={c} offset={o} stopColor={c} />)}
        </linearGradient>
        <radialGradient id={`${id}-fur-fill`} cx=".42" cy=".3" r=".8">
          <stop offset="0" stopColor="#FBF5EA" /><stop offset=".6" stopColor="#EFE4D2" /><stop offset="1" stopColor="#D6C4A7" />
        </radialGradient>
        <radialGradient id={`${id}-skin`} cx=".45" cy=".38" r=".7">
          <stop offset="0" stopColor="#F9E0CA" /><stop offset="1" stopColor="#E9C2A2" />
        </radialGradient>
        <filter id={`${id}-fur`} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves={2} seed={4} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={7} xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id={`${id}-blur3`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={3} /></filter>
        <filter id={`${id}-blur6`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={6} /></filter>
        <clipPath id={`${id}-body`}><path d={BODY} /></clipPath>
      </defs>
      {shadow && <ellipse cx="100" cy="228" rx="62" ry="7" fill="#5A4630" opacity=".2" filter={u("blur6")} />}
      <g className={animate ? `gb gb-${mood}` : "gb"}>
        <g className="gb-body">
          <g filter={u("fur")}>
            <path d={BODY} fill={u("fur-fill")} />
            <g clipPath={u("body")}><path d="M10 52 Q100 20 190 52 L190 66 Q100 34 10 66 Z" fill={u("rb")} /></g>
          </g>
          <ellipse cx="100" cy="88" rx="43" ry="37" fill="#B49A78" opacity=".55" filter={u("blur3")} />
          <ellipse cx="100" cy="89" rx="40" ry="34" fill={u("skin")} />
          <ellipse cx="76" cy="100" rx="8" ry="5" fill="#F28C96" opacity=".55" filter={u("blur3")} />
          <ellipse cx="124" cy="100" rx="8" ry="5" fill="#F28C96" opacity=".55" filter={u("blur3")} />
          <Face mood={mood} />
          <g className="gb-lift">
            <rect x="44" y="167" width="112" height="6" rx="3" fill="#3A3444" />
            <rect x="44" y="152" width="11" height="36" rx="4.5" fill={u("rb")} />
            <rect x="34" y="158" width="9" height="24" rx="3.5" fill={u("rb")} />
            <rect x="145" y="152" width="11" height="36" rx="4.5" fill={u("rb")} />
            <rect x="157" y="158" width="9" height="24" rx="3.5" fill={u("rb")} />
            <g filter={u("fur")}>
              <ellipse cx="64" cy="152" rx="13" ry="24" fill={u("fur-fill")} transform="rotate(-28 64 152)" />
              <ellipse cx="136" cy="152" rx="13" ry="24" fill={u("fur-fill")} transform="rotate(28 136 152)" />
            </g>
          </g>
        </g>
      </g>
    </>
  );
}

function useSvgId() {
  return "gb" + useId().replace(/[^a-zA-Z0-9]/g, "");
}

interface MascotProps { className?: string; crop?: boolean; shadow?: boolean; mood?: GymBotMood; animate?: boolean }

/** Mascota completa. `crop` muestra solo el busto, como en el ícono de app. `animate` la mueve según su ánimo. */
export function GymBotMascot({ className, crop = false, shadow = false, mood, animate }: MascotProps) {
  const id = useSvgId();
  return (
    <svg viewBox={crop ? "24 10 152 140" : "0 0 200 240"} className={className} aria-hidden focusable="false" overflow="visible">
      <Mascot id={id} shadow={shadow} mood={mood} animate={animate} />
    </svg>
  );
}

const ICON_BG = {
  rainbow: RAINBOW_CSS,
  light: "#FFFFFF",
  dark: "#050505",
  pink: "linear-gradient(150deg, #ffd3df 0%, #ffb6c8 55%, #f9a08f 100%)",
} as const;
type IconTone = keyof typeof ICON_BG | "theme";

/** Fondo del ícono según el tema: blanco en neutro, negro en Gym Bro y rosado en Gym Sis. */
function useThemeTone(): keyof typeof ICON_BG {
  const { bundle } = useUserData();
  const theme = bundle?.profile.theme ?? storedTheme();
  return theme === "bro" ? "dark" : theme === "sis" ? "pink" : "light";
}

/** Ícono de app: la mascota recortada. Por defecto toma el fondo del tema activo. */
export function GymBotIcon({ size = 40, tone = "theme", className, mood, animate }: { size?: number; tone?: IconTone; className?: string; mood?: GymBotMood; animate?: boolean }) {
  const themeTone = useThemeTone();
  const bg = tone === "theme" ? themeTone : tone;
  return (
    <span aria-hidden className={`flex shrink-0 items-end justify-center overflow-hidden ${bg === "light" ? "ring-1 ring-border" : ""} ${className ?? ""}`}
      style={{ width: size, height: size, borderRadius: size * 0.29, background: ICON_BG[bg] }}>
      <GymBotMascot crop mood={mood} animate={animate} className="block w-[91%]" />
    </span>
  );
}

/** Palabra "gym bot" en Outfit extrabold; con subrayado arcoíris para fondos oscuros. */
export function GymBotWordmark({ className, underline = false }: { className?: string; underline?: boolean }) {
  return (
    <span className={`relative inline-block font-logo font-extrabold lowercase leading-none tracking-[-0.045em] ${className ?? ""}`}>
      gym bot
      {underline && <span aria-hidden className="absolute -bottom-[0.18em] left-0 h-[0.09em] w-full rounded-full" style={{ background: RAINBOW_CSS }} />}
    </span>
  );
}
