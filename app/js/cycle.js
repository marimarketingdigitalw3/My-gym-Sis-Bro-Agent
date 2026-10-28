// Motor del ciclo: calcula fase, predicciones y consejos (inspirado en Lively).
import { addDays, diffDays } from "./dates.js";

export const PHASES = {
  menstrual: {
    name: "Menstrual",
    emoji: "🌑",
    energy: "Baja",
    training: "Movilidad, caminar o yoga suave",
    intensity: "Suave",
    food: "Hierro y calor: legumbres, carnes rojas, espinaca, caldos",
    tip: "Tu cuerpo está haciendo un trabajo extra. Moverte suave también cuenta.",
    bro: "Hoy toca suave. Propón caminar o estirar juntos y no insistas con la intensidad.",
  },
  follicular: {
    name: "Folicular",
    emoji: "🌒",
    energy: "Subiendo",
    training: "Fuerza progresiva y técnica nueva",
    intensity: "Alta",
    food: "Carbohidratos de calidad y proteína para construir músculo",
    tip: "El estrógeno sube: buen momento para aprender ejercicios y subir peso.",
    bro: "Está con energía al alza. Buen día para probar una rutina nueva juntos.",
  },
  ovulatory: {
    name: "Ovulatoria",
    emoji: "🌕",
    energy: "Pico",
    training: "Récords personales, HIIT o deporte de equipo",
    intensity: "Máxima",
    food: "Fibra y antioxidantes: frutas, verduras, granos enteros",
    tip: "Es tu pico de fuerza. Calienta bien: las articulaciones están más laxas.",
    bro: "Día de récord. Ayúdala como spotter y celebra cada PR.",
  },
  luteal: {
    name: "Lútea",
    emoji: "🌘",
    energy: "Bajando",
    training: "Fuerza moderada y cardio estable",
    intensity: "Media",
    food: "Algo más de energía: magnesio, grasas buenas, carbohidratos complejos",
    tip: "Gastas un poco más y tienes más hambre. Es fisiología, no falta de disciplina.",
    bro: "La energía baja. Mantén el plan, pero sin presionar por marcas.",
  },
};

export function ovulationDay(cycleLength) {
  return cycleLength - 14;
}

export function cycleDay(lastPeriodStart, cycleLength, dateISO) {
  const diff = diffDays(lastPeriodStart, dateISO);
  return (((diff % cycleLength) + cycleLength) % cycleLength) + 1;
}

export function phaseForDay(day, cycleLength, periodLength) {
  const ov = ovulationDay(cycleLength);
  if (day <= periodLength) return "menstrual";
  if (day >= ov - 1 && day <= ov + 1) return "ovulatory";
  if (day < ov - 1) return "follicular";
  return "luteal";
}

export function getCycleInfo(profile, dateISO) {
  const { lastPeriodStart, cycleLength, periodLength } = profile;
  const day = cycleDay(lastPeriodStart, cycleLength, dateISO);
  const phase = phaseForDay(day, cycleLength, periodLength);
  const cycleStart = addDays(dateISO, -(day - 1));
  const ov = ovulationDay(cycleLength);
  return {
    day,
    phase,
    ...PHASES[phase],
    nextPeriod: addDays(cycleStart, cycleLength),
    ovulation: addDays(cycleStart, ov - 1),
    fertileStart: addDays(cycleStart, ov - 6),
    fertileEnd: addDays(cycleStart, ov),
    daysToPeriod: cycleLength - day + 1,
  };
}

// Media de los últimos ciclos registrados (máx. 6), limitada a un rango fisiológico.
export function averageCycleLength(periodStarts, fallback) {
  const sorted = [...new Set(periodStarts)].sort();
  const lengths = [];
  for (let i = 1; i < sorted.length; i++) {
    const len = diffDays(sorted[i - 1], sorted[i]);
    if (len >= 21 && len <= 40) lengths.push(len);
  }
  if (!lengths.length) return fallback;
  const recent = lengths.slice(-6);
  return Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
}
