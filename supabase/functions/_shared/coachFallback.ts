// Modo de respaldo del Gym AI Coach: respuestas predefinidas por intención.
// Se usa cuando no hay proveedor de IA configurado o falla. La UI lo identifica como tal.
import type { CoachContext, CoachLanguage } from "./coach.ts";
import { detectLanguage } from "./coach.ts";
import { detectRedFlags, safetyMessage } from "./safety.ts";

interface Intent {
  key: string;
  re: RegExp;
  answer: (ctx: CoachContext, lang: CoachLanguage) => string;
}

const list = (items: string[]) => items.map((i) => `• ${i}`).join("\n");
const t = (lang: CoachLanguage, es: string, en: string) => (lang === "es" ? es : en);

const INTENTS: Intent[] = [
  {
    key: "today",
    re: /(qu[eé]\s+(entreno|entrenar|me toca|hago)\s+hoy)|(what\s+(should|do)\s+i\s+train)|(today'?s workout)|rutina de hoy/i,
    answer: (ctx, lang) => {
      if (!ctx.todayWorkout) {
        return t(lang,
          "Hoy no tienes una sesión de fuerza programada. Es un buen día para descansar, caminar 20 a 30 minutos o hacer movilidad. Si quieres entrenar igual, abre Mis entrenamientos y elige cualquier día del plan.",
          "You have no strength session planned today. It's a good day to rest, walk for 20–30 minutes or do mobility work. If you still want to train, open My Workouts and pick any day of your plan.");
      }
      return t(lang,
        `Hoy te toca **${ctx.todayWorkout.title}**:\n${list(ctx.todayWorkout.exercises)}\n\nCalienta 5 a 8 minutos y empieza con un peso que te deje 2 o 3 repeticiones en reserva.`,
        `Today's session is **${ctx.todayWorkout.title}**:\n${list(ctx.todayWorkout.exercises)}\n\nWarm up for 5–8 minutes and start with a load that leaves 2–3 reps in reserve.`);
    },
  },
  {
    key: "knee",
    re: /rodilla|knee|sentadilla.*(duele|molest)|squats?\s+(hurt|bother)/i,
    answer: (_ctx, lang) => t(lang,
      `Si la sentadilla te molesta en la rodilla, prueba opciones que la carguen menos:\n${list([
        "Puente de glúteo o hip thrust",
        "Peso muerto rumano con mancuernas (bisagra de cadera)",
        "Sentadilla a un cajón con rango limitado y sin dolor",
        "Curl femoral o abducción con banda",
      ])}\n\nUsa el botón Sustituir en tu entrenamiento para cambiarla. Si el dolor persiste o la rodilla se inflama, consulta a un fisioterapeuta.`,
      `If squats bother your knee, try options with less knee load:\n${list([
        "Glute bridge or hip thrust",
        "Dumbbell Romanian deadlift (hip hinge)",
        "Box squat with a pain-free, limited range",
        "Leg curl or band abduction",
      ])}\n\nUse the Substitute button in your workout to swap it. If pain persists or the knee swells, see a physiotherapist.`),
  },
  {
    key: "glutes",
    re: /gl[uú]teo|glute|pompis|cola/i,
    answer: (_ctx, lang) => t(lang,
      `Para desarrollar glúteos:\n${list([
        "Entrénalos 2 o 3 veces por semana",
        "Combina hip thrust o puente (extensión de cadera), peso muerto rumano y zancadas o sentadilla búlgara",
        "Trabaja entre 8 y 15 repeticiones, cerca del fallo técnico, y sube carga o repeticiones cada semana",
        "Come suficiente proteína y duerme bien: el músculo crece en la recuperación",
      ])}`,
      `To build your glutes:\n${list([
        "Train them 2–3 times per week",
        "Combine hip thrusts or bridges, Romanian deadlifts and lunges or Bulgarian split squats",
        "Work in the 8–15 rep range close to technical failure, adding load or reps each week",
        "Eat enough protein and sleep well: muscle grows during recovery",
      ])}`),
  },
  {
    key: "postworkout",
    re: /(despu[eé]s|post).{0,20}(entren|gym|ejercicio)|after\s+(my\s+)?(workout|training)|post-?workout/i,
    answer: (ctx, lang) => {
      const allergens = ctx.nutrition?.allergens ?? [];
      const vegan = ctx.nutrition?.diet === "vegan";
      const ideas = vegan
        ? ["Batido de bebida vegetal con banano y avena", "Arroz con fríjoles o lentejas", "Arepa con hummus y aguacate"]
        : ["Arepa con huevo y queso", "Yogur griego con fruta y avena", "Arroz con pollo y verduras", "Batido de leche con banano"];
      const filtered = ideas.filter((i) => !(allergens.includes("lactose") && /queso|yogur|leche/i.test(i)) && !(allergens.includes("eggs") && /huevo/i.test(i)) && !(allergens.includes("gluten") && /avena/i.test(i)));
      return t(lang,
        `Después de entrenar busca proteína y carbohidratos en las 2 horas siguientes. Algunas ideas${ctx.nutrition ? " según tus preferencias" : ""}:\n${list(filtered)}\n\nHidrátate según tu sed y el sudor de la sesión.`,
        `After training, aim for protein plus carbs within about 2 hours. A few ideas:\n${list(filtered)}\n\nRehydrate according to thirst and how much you sweated.`);
    },
  },
  {
    key: "missed",
    re: /(perd[ií]|falt[eé]|no\s+(pude|fui)).{0,30}(d[ií]as?|entren|sesi)|missed\s+\w*\s*(days?|sessions?|workouts?)/i,
    answer: (_ctx, lang) => t(lang,
      `Faltar unos días no borra tu progreso. Para ajustar la semana:\n${list([
        "No intentes recuperar todo: retoma con la siguiente sesión del plan",
        "Si te quedan pocos días, prioriza las sesiones de cuerpo completo o las de tus objetivos principales",
        "Usa un peso similar al de tu última sesión y vuelve a progresar desde ahí",
        "Tu racha tiene comodines: un par de días sin entrenar no la rompen",
      ])}`,
      `Missing a few days doesn't erase your progress. To adjust your week:\n${list([
        "Don't try to make everything up: continue with the next planned session",
        "If few days remain, prioritise full-body sessions or those tied to your main goal",
        "Use a load similar to your last session and progress again from there",
        "Your streak has freezes: a couple of missed days won't break it",
      ])}`),
  },
  {
    key: "plateau",
    re: /(no\s+(progreso|avanzo|subo))|estancad|plateau|not\s+progressing|stuck\s+on|press\s+de\s+banca|bench/i,
    answer: (ctx, lang) => {
      const pr = ctx.personalRecords[0];
      const prLine = pr ? t(lang, `Tu mejor registro reciente: ${pr.exercise} ${pr.weightKg} kg × ${pr.reps}.`, `Your best recent record: ${pr.exercise} ${pr.weightKg} kg × ${pr.reps}.`) : "";
      return t(lang,
        `${prLine}\nSi te estancaste, revisa en este orden:\n${list([
          "Sueño (7 horas o más) y proteína suficiente",
          "Progresión: suma una repetición antes de subir peso (doble progresión)",
          "Técnica: graba una serie y compara con las instrucciones del ejercicio",
          "Volumen: 10 a 20 series semanales por grupo muscular suelen bastar",
          "Cada 6 a 8 semanas, una semana más ligera ayuda a recuperar",
        ])}`,
        `${prLine}\nIf you've stalled, check in this order:\n${list([
          "Sleep (7+ hours) and enough protein",
          "Progression: add a rep before adding weight (double progression)",
          "Technique: film a set and compare with the exercise cues",
          "Volume: 10–20 weekly sets per muscle group is usually enough",
          "Every 6–8 weeks, a lighter week helps recovery",
        ])}`);
    },
  },
  {
    key: "cramps",
    re: /c[oó]lico|regla|menstrua|periodo|period|cramps/i,
    answer: (_ctx, lang) => t(lang,
      `Si tienes cólicos o poca energía, tus opciones son:\n${list([
        "Seguir tu plan normal si te sientes bien: no es obligatorio bajar la intensidad",
        "Hacer una versión más suave: una serie menos o pesos más ligeros",
        "Caminar, movilidad o yoga suave",
        "Descansar si lo necesitas",
      ])}\n\nEl calor local, la hidratación y moverte suave ayudan a muchas personas. Si el dolor es muy intenso o te impide tu vida diaria, consulta a un profesional de la salud.`,
      `With cramps or low energy, your options are:\n${list([
        "Follow your normal plan if you feel fine: you don't have to reduce intensity",
        "Do a lighter version: one fewer set or lighter loads",
        "Walk, mobility work or gentle yoga",
        "Rest if you need it",
      ])}\n\nHeat, hydration and gentle movement help many people. If pain is severe or disrupts daily life, see a health professional.`),
  },
  {
    key: "recovery",
    re: /recuper|descans|dolor muscular|agujetas|sore|rest\s+day|recovery|sue[nñ]o|sleep/i,
    answer: (_ctx, lang) => t(lang,
      `Para recuperarte mejor:\n${list([
        "Duerme 7 a 9 horas",
        "Deja 48 horas antes de entrenar fuerte el mismo grupo muscular",
        "Las agujetas son normales al empezar; movimiento suave ayuda",
        "Si un dolor es punzante, articular o empeora, no es agujeta: para y consulta",
      ])}`,
      `To recover better:\n${list([
        "Sleep 7–9 hours",
        "Allow 48 hours before training the same muscle group hard",
        "Muscle soreness is normal when starting; gentle movement helps",
        "Sharp, joint or worsening pain isn't soreness: stop and get it checked",
      ])}`),
  },
  {
    key: "cardio",
    re: /cardio|correr|running|run|caminar|walk|resistencia|endurance/i,
    answer: (_ctx, lang) => t(lang,
      `Una buena base de cardio:\n${list([
        "150 minutos por semana a intensidad moderada (puedes hablar con frases cortas)",
        "Si te gusta, 1 o 2 sesiones de intervalos cortos",
        "Haz el cardio después de la fuerza o en otro día si tu objetivo es ganar fuerza",
      ])}`,
      `A solid cardio base:\n${list([
        "150 minutes per week at moderate intensity (you can talk in short sentences)",
        "Optionally 1–2 short interval sessions",
        "Do cardio after strength work or on separate days if strength is your goal",
      ])}`),
  },
  {
    key: "motivation",
    re: /motiva|ganas|pereza|constan|consistency|lazy|unmotivated/i,
    answer: (_ctx, lang) => t(lang,
      `La constancia gana a la motivación:\n${list([
        "Agenda tus sesiones como citas",
        "En días difíciles, comprométete solo con el calentamiento: casi siempre sigues",
        "Celebra lo que no es la báscula: más fuerza, mejor sueño, más energía",
        "Una sesión corta cuenta más que una sesión perfecta que no haces",
      ])}`,
      `Consistency beats motivation:\n${list([
        "Schedule sessions like appointments",
        "On hard days, commit to the warm-up only: you'll usually keep going",
        "Celebrate non-scale wins: strength, sleep, energy",
        "A short session beats a perfect one you skip",
      ])}`),
  },
  {
    key: "nutrition",
    re: /prote[ií]na|protein|comer|comida|dieta|calor|carbo|grasa|eat|meal|diet|food/i,
    answer: (ctx, lang) => t(lang,
      `Principios que funcionan para casi todo el mundo:\n${list([
        ctx.nutrition?.proteinTargetG ? `Reparte tu proteína (unos ${ctx.nutrition.proteinTargetG} g/día estimados) en 3 o 4 comidas` : "Incluye una fuente de proteína en cada comida",
        "Llena medio plato con verduras y fruta",
        "Elige carbohidratos que te den energía para entrenar: arroz, papa, avena, plátano, legumbres",
        "No hace falta eliminar alimentos: la constancia importa más que la perfección",
      ])}\n\nEn la sección Nutrición tienes un plan semanal adaptado a tus preferencias.`,
      `Principles that work for nearly everyone:\n${list([
        ctx.nutrition?.proteinTargetG ? `Spread your protein (about ${ctx.nutrition.proteinTargetG} g/day, estimated) across 3–4 meals` : "Include a protein source at every meal",
        "Fill half your plate with vegetables and fruit",
        "Pick carbs that fuel training: rice, potatoes, oats, plantain, legumes",
        "You don't need to cut foods out: consistency matters more than perfection",
      ])}\n\nThe Nutrition section has a weekly plan adapted to your preferences.`),
  },
];

export function fallbackReply(message: string, ctx: CoachContext): { text: string; source: "fallback" | "safety"; intent: string } {
  const lang = detectLanguage(message, ctx.language);
  const flags = detectRedFlags(message);
  if (flags.length) return { text: safetyMessage(flags, lang), source: "safety", intent: "safety" };
  const intent = INTENTS.find((i) => i.re.test(message));
  if (intent) return { text: intent.answer(ctx, lang), source: "fallback", intent: intent.key };
  return {
    text: t(lang,
      `En el modo de respaldo puedo ayudarte con temas frecuentes:\n${list([
        "¿Qué entreno hoy?",
        "Sustituir un ejercicio que te molesta",
        "Glúteos, cardio o recuperación",
        "Qué comer después de entrenar",
        "Qué hacer si te perdiste entrenamientos o te estancaste",
      ])}\n\nPrueba con una de esas preguntas.`,
      `In fallback mode I can help with common topics:\n${list([
        "What should I train today?",
        "Replacing an exercise that bothers you",
        "Glutes, cardio or recovery",
        "What to eat after training",
        "What to do if you missed sessions or stalled",
      ])}\n\nTry one of those questions.`),
    source: "fallback",
    intent: "unknown",
  };
}
