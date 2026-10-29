// Animación de referencia de un ejercicio: una figura de perfil (mujer u hombre) pasa de la posición
// inicial a la final según el patrón de movimiento. Es una guía visual; los pasos escritos mandan.
import { useEffect, useState } from "react";
import type { Exercise, MovementPattern } from "@/types/domain";

type P = [number, number];
interface Pose {
  head: P; neck: P; hip: P;
  knee: P; ankle: P; toe: P;
  elbow: P; wrist: P;
  // Lado lejano (opcional: si falta, igual al cercano).
  kneeF?: P; ankleF?: P; toeF?: P; elbowF?: P; wristF?: P;
}

const STAND: Pose = { head: [100, 38], neck: [100, 54], hip: [100, 108], knee: [101, 146], ankle: [100, 183], toe: [114, 185], elbow: [101, 82], wrist: [102, 108] };
const s = (p: Partial<Pose>): Pose => ({ ...STAND, ...p });

/** Posición inicial y final de cada patrón (vista lateral, mirando a la derecha; suelo en y = 185). */
const POSES: Record<string, [Pose, Pose]> = {
  squat: [
    s({ elbow: [112, 78], wrist: [124, 70] }),
    s({ head: [118, 76], neck: [111, 91], hip: [76, 140], knee: [120, 146], elbow: [126, 110], wrist: [138, 100] }),
  ],
  hinge: [
    s({ elbow: [102, 82], wrist: [103, 108] }),
    s({ head: [149, 84], neck: [135, 88], hip: [86, 110], knee: [100, 148], elbow: [136, 114], wrist: [137, 140] }),
  ],
  lunge: [
    s({ kneeF: [99, 146], ankleF: [98, 183], toeF: [112, 185] }),
    s({ head: [100, 66], neck: [100, 82], hip: [100, 135], knee: [132, 142], ankle: [130, 183], toe: [144, 185], kneeF: [80, 172], ankleF: [60, 178], toeF: [50, 184], elbow: [101, 110], wrist: [102, 134] }),
  ],
  hip_extension: [
    { head: [34, 146], neck: [48, 150], hip: [100, 176], knee: [136, 142], ankle: [150, 183], toe: [164, 185], elbow: [62, 170], wrist: [84, 178] },
    { head: [34, 146], neck: [48, 150], hip: [100, 146], knee: [136, 138], ankle: [150, 183], toe: [164, 185], elbow: [62, 170], wrist: [84, 178] },
  ],
  push_up: [
    { head: [152, 116], neck: [140, 123], hip: [86, 140], knee: [60, 154], ankle: [36, 170], toe: [29, 183], elbow: [141, 153], wrist: [141, 183] },
    { head: [154, 149], neck: [142, 156], hip: [88, 164], knee: [61, 172], ankle: [36, 178], toe: [29, 183], elbow: [118, 162], wrist: [141, 183] },
  ],
  bench_press: [
    { head: [42, 140], neck: [56, 142], hip: [112, 144], knee: [140, 150], ankle: [150, 183], toe: [164, 185], elbow: [60, 112], wrist: [62, 86] },
    { head: [42, 140], neck: [56, 142], hip: [112, 144], knee: [140, 150], ankle: [150, 183], toe: [164, 185], elbow: [74, 146], wrist: [62, 122] },
  ],
  vertical_push: [
    s({ elbow: [114, 72], wrist: [110, 52] }),
    s({ elbow: [106, 30], wrist: [104, 8] }),
  ],
  horizontal_pull: [
    s({ head: [149, 84], neck: [135, 88], hip: [86, 110], knee: [100, 148], elbow: [136, 114], wrist: [137, 140] }),
    s({ head: [149, 84], neck: [135, 88], hip: [86, 110], knee: [100, 148], elbow: [110, 98], wrist: [124, 112] }),
  ],
  vertical_pull: [
    { head: [100, 52], neck: [100, 68], hip: [100, 122], knee: [100, 156], ankle: [100, 182], toe: [110, 184], elbow: [101, 38], wrist: [100, 12] },
    { head: [100, 28], neck: [100, 44], hip: [100, 98], knee: [100, 132], ankle: [100, 160], toe: [110, 162], elbow: [80, 34], wrist: [100, 12] },
  ],
  elbow_flexion: [
    s({ elbow: [100, 84], wrist: [102, 110] }),
    s({ elbow: [100, 84], wrist: [116, 64] }),
  ],
  elbow_extension: [
    s({ elbow: [104, 84], wrist: [120, 70] }),
    s({ elbow: [104, 84], wrist: [105, 110] }),
  ],
  shoulder_isolation: [
    s({ elbow: [102, 82], wrist: [103, 108] }),
    s({ elbow: [124, 60], wrist: [148, 58] }),
  ],
  plank: [
    { head: [152, 140], neck: [140, 146], hip: [88, 151], knee: [61, 160], ankle: [36, 171], toe: [29, 183], elbow: [140, 182], wrist: [162, 182] },
    { head: [152, 139], neck: [140, 145], hip: [88, 147], knee: [61, 158], ankle: [36, 171], toe: [29, 183], elbow: [140, 182], wrist: [162, 182] },
  ],
  crunch: [
    { head: [36, 170], neck: [50, 172], hip: [100, 178], knee: [128, 146], ankle: [152, 182], toe: [166, 185], elbow: [44, 156], wrist: [32, 164] },
    { head: [60, 140], neck: [68, 152], hip: [100, 178], knee: [128, 146], ankle: [152, 182], toe: [166, 185], elbow: [62, 126], wrist: [50, 134] },
  ],
  rotation: [
    s({ head: [100, 74], neck: [100, 90], hip: [88, 150], knee: [120, 152], ankle: [124, 183], toe: [138, 185], elbow: [118, 106], wrist: [132, 112] }),
    s({ head: [100, 74], neck: [100, 90], hip: [88, 150], knee: [120, 152], ankle: [124, 183], toe: [138, 185], elbow: [80, 108], wrist: [66, 116] }),
  ],
  calf: [
    s({}),
    s({ head: [100, 28], neck: [100, 44], hip: [100, 98], knee: [101, 136], ankle: [102, 172], toe: [114, 185] }),
  ],
  walk: [
    s({ knee: [112, 146], ankle: [118, 183], toe: [131, 185], kneeF: [92, 147], ankleF: [82, 182], toeF: [92, 185] }),
    s({ knee: [92, 147], ankle: [82, 182], toe: [92, 185], kneeF: [112, 146], ankleF: [118, 183], toeF: [131, 185] }),
  ],
  run: [
    s({ head: [104, 40], neck: [102, 56], knee: [124, 132], ankle: [114, 160], toe: [126, 162], kneeF: [94, 148], ankleF: [78, 176], toeF: [86, 183], elbow: [88, 80], wrist: [104, 96], elbowF: [114, 80], wristF: [126, 66] }),
    s({ head: [104, 40], neck: [102, 56], knee: [94, 148], ankle: [78, 176], toe: [86, 183], kneeF: [124, 132], ankleF: [114, 160], toeF: [126, 162], elbow: [114, 80], wrist: [126, 66], elbowF: [88, 80], wristF: [104, 96] }),
  ],
  stretch: [
    s({ elbow: [101, 82], wrist: [102, 108] }),
    s({ head: [104, 40], elbow: [104, 28], wrist: [110, 6] }),
  ],
  // Bicicleta estática: sentado en el sillín, manos en el manubrio, piernas pedaleando.
  bike: [
    { head: [120, 34], neck: [112, 50], hip: [70, 104], knee: [104, 124], ankle: [98, 158], toe: [110, 160], kneeF: [90, 144], ankleF: [74, 164], toeF: [86, 166], elbow: [132, 78], wrist: [150, 90] },
    { head: [120, 34], neck: [112, 50], hip: [70, 104], knee: [90, 144], ankle: [74, 164], toe: [86, 166], kneeF: [104, 124], ankleF: [98, 158], toeF: [110, 160], elbow: [132, 78], wrist: [150, 90] },
  ],
  // Cinta: caminata o trote sobre la banda.
  treadmill: [
    s({ head: [104, 46], neck: [102, 62], hip: [100, 114], knee: [120, 144], ankle: [114, 168], toe: [126, 170], kneeF: [92, 150], ankleF: [82, 172], toeF: [90, 175], elbow: [90, 86], wrist: [104, 100], elbowF: [114, 86], wristF: [126, 74] }),
    s({ head: [104, 46], neck: [102, 62], hip: [100, 114], knee: [92, 150], ankle: [82, 172], toe: [90, 175], kneeF: [120, 144], ankleF: [114, 168], toeF: [126, 170], elbow: [114, 86], wrist: [126, 74], elbowF: [90, 86], wristF: [104, 100] }),
  ],
  // Elíptica: de pie, brazos en los mangos, piernas en elipse.
  elliptical: [
    { head: [102, 34], neck: [100, 50], hip: [98, 104], knee: [118, 134], ankle: [120, 162], toe: [132, 164], kneeF: [84, 136], ankleF: [78, 164], toeF: [90, 166], elbow: [114, 78], wrist: [134, 60], elbowF: [88, 78], wristF: [110, 92] },
    { head: [102, 34], neck: [100, 50], hip: [98, 104], knee: [84, 136], ankle: [78, 164], toe: [90, 166], kneeF: [118, 134], ankleF: [120, 162], toeF: [132, 164], elbow: [88, 78], wrist: [110, 92], elbowF: [114, 78], wristF: [134, 60] },
  ],
  // Remo: sentado, se desliza atrás y tira del mango.
  rower: [
    { head: [116, 88], neck: [108, 102], hip: [84, 150], knee: [122, 128], ankle: [146, 156], toe: [156, 160], elbow: [128, 118], wrist: [148, 130] },
    { head: [78, 84], neck: [84, 100], hip: [66, 150], knee: [104, 146], ankle: [146, 156], toe: [156, 160], elbow: [74, 128], wrist: [100, 128] },
  ],
  // Saltar la cuerda: pequeños saltos rítmicos; la cuerda gira (se dibuja aparte).
  jump_rope: [
    s({ head: [100, 36], neck: [100, 52], hip: [100, 106], knee: [102, 144], ankle: [100, 180], toe: [113, 182], elbow: [112, 84], wrist: [124, 96] }),
    s({ head: [100, 24], neck: [100, 40], hip: [100, 94], knee: [104, 128], ankle: [98, 162], toe: [110, 168], elbow: [112, 72], wrist: [124, 84] }),
  ],
  // Yoga: zancada arrodillada con brazos arriba, luego inclinación suave al frente.
  yoga_lunge: [
    { head: [96, 44], neck: [98, 60], hip: [92, 118], knee: [128, 134], ankle: [132, 172], toe: [148, 174], kneeF: [62, 172], ankleF: [38, 172], toeF: [30, 180], elbow: [104, 38], wrist: [112, 16], elbowF: [90, 38], wristF: [84, 16] },
    { head: [142, 84], neck: [132, 94], hip: [92, 118], knee: [128, 134], ankle: [132, 172], toe: [148, 174], kneeF: [62, 172], ankleF: [38, 172], toeF: [30, 180], elbow: [146, 118], wrist: [150, 146], elbowF: [138, 118], wristF: [142, 146] },
  ],
};

/** Ejercicios de cardio con máquina propia. */
const MACHINE_BY_ID: Record<string, string> = {
  "stationary-bike": "bike", "treadmill-incline-walk": "treadmill", elliptical: "elliptical", "rowing-machine": "rower",
  "jumping-jacks": "jump_rope",
};
const MOBILITY_BY_ID: Record<string, string> = {
  "worlds-greatest-stretch": "yoga_lunge", "hip-flexor-stretch": "yoga_lunge",
};

function poseKey(ex: Pick<Exercise, "pattern" | "equipment" | "id">): string {
  const p: MovementPattern = ex.pattern;
  if (p === "horizontal_push") return ex.equipment.some((e) => e === "bench" || e === "barbell" || e === "dumbbells" || e === "machines") ? "bench_press" : "push_up";
  if (p === "core_anti_extension") return "plank";
  if (p === "core_flexion") return "crunch";
  if (p === "core_rotation") return "rotation";
  if (p === "carry") return "walk";
  if (p === "cardio") return MACHINE_BY_ID[ex.id] ?? "run";
  if (p === "mobility") return MOBILITY_BY_ID[ex.id] ?? "stretch";
  return POSES[p] ? p : "stretch";
}

const KEY_SPLINES = ".45 0 .55 1;.45 0 .55 1";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

// ---------- Geometría ----------
const add = (p: P, q: P): P => [p[0] + q[0], p[1] + q[1]];
const lerp = (p: P, q: P, t: number): P => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
const round = (p: P): P => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];

/** Puntos derivados de una pose: hombro, cintura, pecho y orientación de la cabeza. */
function rig(a: Pose) {
  const shoulder = add(a.neck, [0, 3]);
  const v: P = [a.hip[0] - shoulder[0], a.hip[1] - shoulder[1]];
  const len = Math.hypot(v[0], v[1]) || 1;
  const front: P = [v[1] / len, -v[0] / len]; // perpendicular hacia el frente de la figura
  const chest = add(lerp(shoulder, a.hip, 0.3), [front[0] * 7, front[1] * 7]);
  const waist = lerp(shoulder, a.hip, 0.62);
  const headAngle = (Math.atan2(a.head[1] - a.neck[1], a.head[0] - a.neck[0]) * 180) / Math.PI + 90;
  return {
    ...a, shoulder, chest: round(chest), waist: round(waist), headAngle: Math.round(headAngle),
    kneeF: a.kneeF ?? a.knee, ankleF: a.ankleF ?? a.ankle, toeF: a.toeF ?? a.toe,
    elbowF: a.elbowF ?? a.elbow, wristF: a.wristF ?? a.wrist,
  };
}
type Rig = ReturnType<typeof rig>;
type Joint = Exclude<keyof Rig, "headAngle">;

interface Palette { skin: string; skinFar: string; top: string; topFar: string; bottom: string; bottomFar: string; hair: string; shoe: string; shoeFar: string; accent: string; sleeve: string; line: string }
// Estilo plano de la referencia: formas suaves sin contorno, piel durazno y ropa lila o violeta.
// Paleta de la colección "Gym & Fitness Illustrations": azul claro, lila, coral, negro y blanco.
const PALETTES: Record<"female" | "male", Palette> = {
  female: { skin: "#F4C4A8", skinFar: "#E2A98B", top: "#F47C72", topFar: "#DE6A61", bottom: "#A8C8F5", bottomFar: "#8FB3E6", hair: "#171717", shoe: "#A99AF7", shoeFar: "#8F80E6", accent: "#FF765F", sleeve: "#F47C72", line: "#171717" },
  male: { skin: "#E9B191", skinFar: "#D39A78", top: "#A8C8F5", topFar: "#8FB3E6", bottom: "#171717", bottomFar: "#3A3A3A", hair: "#171717", shoe: "#FF765F", shoeFar: "#E25F4A", accent: "#F47C72", sleeve: "#A8C8F5", line: "#171717" },
};
const MACHINE = { body: "#A8C8F5", light: "#D5E5FB", dark: "#171717", base: "#EEF3FB" };

/**
 * `variant`: "female" dibuja una mujer (top deportivo, leggings y coleta); "male", un hombre
 * (camiseta sin mangas, pantaloneta y cabello corto). Vista lateral, animada entre la posición inicial y la final.
 */
export function ExerciseDemo({ exercise, variant, className, size = 160 }: {
  exercise: Pick<Exercise, "pattern" | "equipment" | "id" | "name">; variant: "female" | "male"; className?: string; size?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const key = poseKey(exercise);
  const [pa, pb] = POSES[key];
  const A = rig(pa);
  const B = rig(pb);
  const female = variant === "female";
  const c = PALETTES[variant];
  const dur = key === "run" || key === "walk" || key === "treadmill" ? "1.1s" : key === "jump_rope" ? "0.8s" : key === "yoga_lunge" ? "4s" : "2.8s";
  const kind = (["barbell", "dumbbells", "kettlebells"] as const).find((k) => exercise.equipment.includes(k)) ?? null;

  const anim = (attr: string, from: number, to: number) => reduced || from === to ? null : (
    <animate attributeName={attr} dur={dur} repeatCount="indefinite" values={`${from};${to};${from}`} keyTimes="0;0.5;1" calcMode="spline" keySplines={KEY_SPLINES} />
  );
  const moveTo = (from: P, to: P) => reduced ? null : (
    <animateTransform attributeName="transform" type="translate" dur={dur} repeatCount="indefinite"
      values={`${from.join(" ")};${to.join(" ")};${from.join(" ")}`} keyTimes="0;0.5;1" calcMode="spline" keySplines={KEY_SPLINES} />
  );
  /** Segmento redondeado entre dos articulaciones (miembro con volumen). */
  const seg = (p: Joint, q: Joint, w: number, color: string, outline = true) => {
    const [x1, y1] = A[p] as P; const [x2, y2] = A[q] as P;
    const [bx1, by1] = B[p] as P; const [bx2, by2] = B[q] as P;
    const line = (stroke: string, width: number) => (
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={width} strokeLinecap="round">
        {anim("x1", x1, bx1)}{anim("y1", y1, by1)}{anim("x2", x2, bx2)}{anim("y2", y2, by2)}
      </line>
    );
    // Contorno fino, como en la ilustración de referencia.
    return outline ? <g>{line(c.line, w + 1)}{line(color, w)}</g> : line(color, w);
  };
  const dot = (p: Joint, r: number, color: string, outline = true) => {
    const [x, y] = A[p] as P; const [bx, by] = B[p] as P;
    return <circle cx={x} cy={y} r={r} fill={color} stroke={outline ? c.line : "none"} strokeWidth={0.5}>{anim("cx", x, bx)}{anim("cy", y, by)}</circle>;
  };

  const torsoW = female ? 20 : 24;
  const thighW = female ? 13 : 13;
  const shinW = female ? 9.5 : 9.5;
  const upperArmW = female ? 8 : 9;
  const foreArmW = female ? 7 : 8;
  const pullBar = exercise.pattern === "vertical_pull";
  const benchKind = key === "bench_press" ? "bench" : key === "hip_extension" ? "box" : null;
  const machine = (["bike", "treadmill", "elliptical", "rower", "jump_rope", "yoga_lunge"] as const).find((m) => m === key) ?? null;
  const shadowX = (A.hip[0] + A.ankle[0]) / 2;

  // Piernas: pantalón largo en ambos (azul claro en ella, joggers negros en él) y zapatillas de color.
  const leg = (far: boolean) => {
    const sfx = far ? "F" : "";
    const knee = `knee${sfx}` as Joint; const ankle = `ankle${sfx}` as Joint; const toe = `toe${sfx}` as Joint;
    return (
      <g>
        {seg("hip", knee, thighW, far ? c.bottomFar : c.bottom)}
        {seg(knee, ankle, shinW, far ? c.bottomFar : c.bottom)}
        {seg(ankle, toe, 9, far ? c.shoeFar : c.shoe)}
      </g>
    );
  };
  // Brazos: manga larga (sudadera en él, con raya coral; top en ella) y mano de piel.
  const arm = (far: boolean) => {
    const sfx = far ? "F" : "";
    const elbow = `elbow${sfx}` as Joint; const wrist = `wrist${sfx}` as Joint;
    return (
      <g>
        {seg("shoulder", elbow, upperArmW, far ? c.topFar : c.top)}
        {seg(elbow, wrist, foreArmW, far ? c.topFar : c.top)}
        {!female && seg("shoulder", elbow, 2.2, far ? "#DE6A61" : c.accent, false)}
        {dot(wrist, foreArmW / 2 + 1, far ? c.skinFar : c.skin)}
      </g>
    );
  };

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} role="img"
      aria-label={`Animación de referencia: ${female ? "mujer" : "hombre"} haciendo ${exercise.name}`}>
      {/* Escenario: base suave como en la referencia */}
      <ellipse cx={shadowX} cy={188} rx={44} ry={4} fill={MACHINE.base} />
      {pullBar && (
        <g stroke={MACHINE.body} strokeLinecap="round">
          <line x1="64" y1="12" x2="136" y2="12" strokeWidth={6} />
          <line x1="66" y1="12" x2="66" y2="184" strokeWidth={5} opacity={0.6} />
          <line x1="134" y1="12" x2="134" y2="184" strokeWidth={5} opacity={0.6} />
        </g>
      )}
      {benchKind === "bench" && (
        <g>
          <rect x={26} y={150} width={104} height={11} rx={5.5} fill={MACHINE.dark} />
          <rect x={40} y={160} width={7} height={24} rx={3} fill={MACHINE.body} />
          <rect x={110} y={160} width={7} height={24} rx={3} fill={MACHINE.body} />
        </g>
      )}
      {benchKind === "box" && <rect x={14} y={154} width={46} height={30} rx={8} fill={MACHINE.body} />}
      {machine === "bike" && (
        <g>
          {/* Cuerpo carenado con la rueda atrás, poste del sillín, manubrio alto y pedal que gira con el pie */}
          <path d="M70 184 Q58 184 58 170 Q58 150 86 148 L136 148 Q160 150 160 170 Q160 184 146 184 Z" fill={MACHINE.body} />
          <circle cx={132} cy={166} r={16} fill={MACHINE.dark} />
          <circle cx={132} cy={166} r={9} fill={MACHINE.body} />
          <path d="M70 104 L82 148" stroke={MACHINE.light} strokeWidth={6} strokeLinecap="round" />
          <rect x={54} y={98} width={32} height={10} rx={5} fill={MACHINE.dark} />
          <path d="M140 148 L152 92" stroke={MACHINE.light} strokeWidth={6} strokeLinecap="round" />
          <path d="M136 92 Q152 82 166 92" stroke={MACHINE.dark} strokeWidth={6} strokeLinecap="round" fill="none" />
          <rect x={138} y={76} width={22} height={9} rx={4.5} fill={MACHINE.dark} />
        </g>
      )}
      {machine === "treadmill" && (
        <g>
          <rect x={44} y={176} width={120} height={8} rx={4} fill={MACHINE.dark} />
          <path d="M150 176 L160 92" stroke={MACHINE.light} strokeWidth={6} strokeLinecap="round" />
          <rect x={140} y={84} width={34} height={10} rx={5} fill={MACHINE.dark} />
          <rect x={150} y={70} width={20} height={14} rx={4} fill={MACHINE.body} />
        </g>
      )}
      {machine === "elliptical" && (
        <g>
          <rect x={46} y={176} width={110} height={8} rx={4} fill={MACHINE.dark} />
          <path d="M140 176 L144 52" stroke={MACHINE.light} strokeWidth={6} strokeLinecap="round" />
          <path d="M134 60 L128 100 M150 50 L152 90" stroke={MACHINE.body} strokeWidth={5} strokeLinecap="round" />
          <rect x={120} y={158} width={26} height={8} rx={4} fill={MACHINE.body} />
          <rect x={72} y={160} width={26} height={8} rx={4} fill={MACHINE.body} />
        </g>
      )}
      {machine === "jump_rope" && (
        // Cuerda: pasa por encima de la cabeza y por debajo de los pies (se dibuja detrás de la figura).
        <path d="M124 96 Q100 -4 76 96" fill="none" stroke={c.line} strokeWidth={1.8} strokeLinecap="round" opacity={0.85}>
          {!reduced && (
            <animate attributeName="d" dur={dur} repeatCount="indefinite"
              values="M124 96 Q100 -4 76 96;M124 96 Q100 206 76 96;M124 96 Q100 -4 76 96" keyTimes="0;0.5;1" />
          )}
        </path>
      )}
      {machine === "yoga_lunge" && (
        <g>
          <rect x={14} y={176} width={172} height={6} rx={3} fill={MACHINE.dark} />
          <rect x={160} y={150} width={22} height={26} rx={3} fill={MACHINE.light} stroke={c.line} strokeWidth={0.8} />
          <circle cx={171} cy={160} r={3} fill={c.accent} /><circle cx={171} cy={169} r={2} fill={c.line} />
        </g>
      )}
      {machine === "rower" && (
        <g>
          <rect x={40} y={162} width={132} height={9} rx={4.5} fill={MACHINE.dark} />
          <rect x={56} y={150} width={38} height={12} rx={6} fill={MACHINE.body} />
          <circle cx={166} cy={146} r={16} fill={MACHINE.body} />
          <circle cx={166} cy={146} r={8} fill={MACHINE.dark} />
          <rect x={140} y={158} width={14} height={6} rx={3} fill={MACHINE.light} />
        </g>
      )}

      {/* Lado lejano */}
      {leg(true)}
      {arm(true)}

      {/* Tronco: top deportivo o camiseta; abdomen descubierto en el top de ella */}
      {seg("shoulder", "hip", torsoW, c.top)}
      {female && dot("chest", 6.5, c.top, false)}
      {dot("hip", torsoW / 2 + 0.5, c.bottom)}
      {seg("neck", "shoulder", 8, c.skin)}

      {/* Lado cercano */}
      {leg(false)}

      {/* Cabeza: gira con la postura */}
      <g transform={`translate(${A.head.join(" ")})`}>
        {moveTo(A.head, B.head)}
        <g transform={`rotate(${A.headAngle})`}>
          {!reduced && A.headAngle !== B.headAngle && (
            <animateTransform attributeName="transform" type="rotate" dur={dur} repeatCount="indefinite"
              values={`${A.headAngle};${B.headAngle};${A.headAngle}`} keyTimes="0;0.5;1" calcMode="spline" keySplines={KEY_SPLINES} />
          )}
          {/* Cabeza ovalada con contorno fino */}
          <path d="M-10 -4 Q-11 -13 0 -13 Q12 -13 12 -1 Q12 8 8 11 Q3 14 -3 12 Q-10 9 -10 -4 Z" fill={c.skin} stroke={c.line} strokeWidth={0.6} />
          {female ? (
            <>
              {/* Cabello recogido en moño */}
              <path d="M-10.5 1 Q-12 -13 1 -13 Q11 -12.5 11.5 -3 Q4 -8 -3 -7 Q-8 -4 -10.5 1 Z" fill={c.hair} />
              <circle cx={-11} cy={-6} r={4.2} fill={c.hair} />
              <circle cx={-9} cy={-9} r={1.3} fill={c.accent} />
            </>
          ) : (
            <>
              {/* Cabello corto rizado */}
              <path d="M-10.5 2 Q-12 -14 2 -13.5 Q12 -12 12 -2 Q8 -6 3 -5.5 Q-2 -8 -6 -4 Q-9 -1 -10.5 2 Z" fill={c.hair} />
              <circle cx={-6} cy={-11} r={3} fill={c.hair} /><circle cx={1} cy={-13.5} r={3} fill={c.hair} /><circle cx={8} cy={-11} r={2.6} fill={c.hair} />
            </>
          )}
          <circle cx={7.5} cy={1} r={1.2} fill={c.line} />
          <path d="M8.5 5.5 Q10 6.5 11 5.2" fill="none" stroke={c.line} strokeWidth={0.8} strokeLinecap="round" />
        </g>
      </g>

      {arm(false)}

      {machine === "bike" && (
        <g transform={`translate(${A.toe.join(" ")})`} opacity={0.9}>
          {moveTo(A.toe as P, B.toe as P)}
          <rect x={-9} y={1} width={18} height={5} rx={2.5} fill={MACHINE.dark} />
        </g>
      )}
      {machine === "rower" && (
        <g transform={`translate(${A.wrist.join(" ")})`}>
          {moveTo(A.wrist as P, B.wrist as P)}
          <rect x={-3} y={-9} width={6} height={18} rx={3} fill={MACHINE.dark} />
        </g>
      )}

      {/* Equipo en la mano cercana */}
      {kind && (
        <g transform={`translate(${A.wrist.join(" ")})`}>
          {moveTo(A.wrist as P, B.wrist as P)}
          {kind === "barbell" && (
            <g>
              <circle r={15} fill={MACHINE.dark} />
              <circle r={10} fill="none" stroke={MACHINE.body} strokeWidth={2} />
              <circle r={3} fill={MACHINE.light} />
            </g>
          )}
          {kind === "dumbbells" && (
            <g>
              <rect x={-9} y={-3} width={18} height={6} rx={2} fill={MACHINE.light} />
              <rect x={-11} y={-7} width={6} height={14} rx={2} fill={MACHINE.dark} />
              <rect x={5} y={-7} width={6} height={14} rx={2} fill={MACHINE.dark} />
            </g>
          )}
          {kind === "kettlebells" && (
            <g>
              <path d="M-5 0 Q0 -8 5 0" fill="none" stroke={MACHINE.dark} strokeWidth={3} />
              <circle cy={8} r={8} fill={MACHINE.dark} />
            </g>
          )}
        </g>
      )}
    </svg>
  );
}

/** Figura según el perfil: sexo declarado o, si falta, el tema elegido. */
export function demoVariant(sex: "female" | "male" | null | undefined, theme: string): "female" | "male" {
  if (sex) return sex;
  return theme === "bro" ? "male" : "female";
}
