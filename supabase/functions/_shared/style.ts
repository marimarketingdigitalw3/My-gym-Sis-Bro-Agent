// Gym Sis · Mis outfits: opciones, instrucciones de la estilista y consejos de respaldo sin IA.
// Compartido entre la app (modo demo) y la Edge Function style-advice.

export const ACTIVITIES = {
  fuerza: { label: "Fuerza en gimnasio", impact: "bajo", tips: ["Leggings de tiro alto y tela opaca para sentadillas sin preocupaciones.", "Top ajustado o crop que no se suba en press ni en dominadas.", "Zapatilla plana y estable (o de suela fina) para empujar bien el suelo."] },
  hiit: { label: "HIIT y funcional", impact: "alto", tips: ["Top deportivo de soporte alto: hay saltos y cambios de dirección.", "Shorts con licra interior o leggings que no se deslicen.", "Zapatilla con amortiguación y buen agarre lateral."] },
  running: { label: "Correr", impact: "alto", tips: ["Top de soporte alto y tejido técnico que seque rápido.", "Shorts con bolsillo o leggings con bolsillo lateral para el móvil.", "Capas ligeras y algún detalle reflectante si corres temprano o de noche."] },
  yoga: { label: "Yoga", impact: "bajo", tips: ["Top de soporte ligero que se quede en su sitio al invertir el cuerpo.", "Leggings de tela suave y elástica; evita bolsillos o costuras gruesas.", "Pies descalzos: un calcetín antideslizante si la sala es fría."] },
  pilates: { label: "Pilates", impact: "bajo", tips: ["Prendas ajustadas para que se vea la alineación.", "Calcetines antideslizantes, casi siempre obligatorios en reformer.", "Conjuntos monocromáticos: estilizan y se combinan fácil."] },
  spinning: { label: "Spinning y ciclismo indoor", impact: "medio", tips: ["Shorts o leggings sin costuras gruesas en la entrepierna; mejor con badana si haces clases largas.", "Top transpirable de soporte medio.", "Zapatilla rígida o de calas según la bici."] },
  baile: { label: "Baile y cardio dance", impact: "medio", tips: ["Top de soporte medio y prendas que acompañen el movimiento.", "Color y estampados: es la clase perfecta para lucirlos.", "Zapatilla ligera con suela que permita girar."] },
  caminata: { label: "Caminata y exterior", impact: "bajo", tips: ["Capas: top técnico, chaqueta ligera y algo para el sol.", "Leggings o jogger cómodos con bolsillos.", "Zapatilla con buena suela para terreno irregular."] },
} as const;
export type Activity = keyof typeof ACTIVITIES;
export const isActivity = (v: unknown): v is Activity => typeof v === "string" && v in ACTIVITIES;

export const CATEGORIES = {
  sports_bra: "Top deportivo",
  top: "Camiseta o top",
  leggings: "Leggings",
  shorts: "Shorts o falda",
  set: "Conjunto",
  jacket: "Chaqueta o sudadera",
  shoes: "Zapatillas",
  accessory: "Accesorio",
} as const;
export type WardrobeCategory = keyof typeof CATEGORIES;

export const STYLES = ["Minimalista", "Monocromático", "Colorido", "Estampados", "Athleisure", "Femenino", "Clásico deportivo", "Streetwear"] as const;
export const COLORS = ["Negro", "Blanco", "Gris", "Beige", "Rosa", "Coral", "Rojo", "Lila", "Azul marino", "Azul cielo", "Verde oliva", "Verde menta", "Amarillo", "Café", "Estampado"] as const;
export const NEUTRALS = new Set(["Negro", "Blanco", "Gris", "Beige", "Azul marino", "Café"]);
export const FITS = { ajustado: "Ajustado", holgado: "Holgado", mixto: "Mixto" } as const;
export const COVERAGE = { alta: "Más cubierta", media: "Intermedia", baja: "Menos cubierta" } as const;

export const MAX_ADVICE_ITEMS = 6;
export const MAX_QUESTION_CHARS = 500;

export interface StyleProfileLike {
  styles: string[]; favorite_colors: string[]; avoid_colors: string[];
  fit: string | null; coverage: string | null; activities: string[]; notes: string | null;
}
export interface WardrobeItemLike { id: string; category: string; colors: string[]; name: string | null }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export interface StyleRequest { activity: Activity; itemIds: string[]; question: string }

export function validateStyleRequest(body: unknown): { ok: true; value: StyleRequest } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Petición inválida." };
  const b = body as Record<string, unknown>;
  if (!isActivity(b.activity)) return { ok: false, error: "Elige un tipo de entreno." };
  const ids = Array.isArray(b.itemIds) ? b.itemIds : [];
  if (ids.length > MAX_ADVICE_ITEMS) return { ok: false, error: `Elige hasta ${MAX_ADVICE_ITEMS} prendas.` };
  if (!ids.every((id) => typeof id === "string" && UUID_RE.test(id))) return { ok: false, error: "Prenda inválida." };
  const question = typeof b.question === "string" ? b.question.trim() : "";
  if (question.length > MAX_QUESTION_CHARS) return { ok: false, error: `La pregunta supera ${MAX_QUESTION_CHARS} caracteres.` };
  return { ok: true, value: { activity: b.activity, itemIds: [...new Set(ids as string[])], question } };
}

export const STYLE_SYSTEM_PROMPT = `You are the personal activewear stylist inside "Gym Sis", a women's fitness app. You combine fashion styling with sports-apparel function.

Write in neutral, warm, professional Spanish, like a trusted stylist friend. Use short sections with Markdown headings (###) and bullets. No em dashes.

What to deliver:
1. "### Tu look para <activity>": one complete outfit, piece by piece. When the user attached photos of her own garments, build the look from those pieces first and name them by what you see (color, cut, type). Only suggest buying something when a key piece is missing.
2. "### Por qué funciona": function first (support level for the impact of the activity, fabric, coverage in squats or inversions, shoes), then style (color harmony, proportions, layering).
3. "### Otras combinaciones": two or three alternative pairings with the pieces she has.
4. "### Colores y detalles": color pairings that respect her favorite colors and avoid the colors she dislikes; accessories (hair, socks, bag, bottle) if useful.
5. "### Le falta a tu clóset" (optional, max 2 items): only versatile basics that unlock many combinations. Never push brands.

Rules:
- Respect her preferences: styles, favorite colors, colors to avoid, fit and coverage level. Coverage "alta" means opaque, longer tops and higher waists; never suggest less coverage than she chose.
- Never comment on her body, weight or size, and never suggest clothes to "hide" or "fix" anything. Talk about the garments, function and style only.
- If a photo is not clothing, or you cannot see it clearly, say so kindly and work with the rest.
- Be concrete and brief: 180 to 350 words.`;

export function formatStyleContext(input: {
  activity: Activity; profile: StyleProfileLike | null; selected: WardrobeItemLike[]; closet: WardrobeItemLike[]; question: string; firstName?: string;
}): string {
  const p = input.profile;
  const item = (i: WardrobeItemLike) => `- ${CATEGORIES[i.category as WardrobeCategory] ?? i.category}${i.name ? ` "${i.name}"` : ""}${i.colors.length ? ` (${i.colors.join(", ")})` : ""}`;
  const lines = [
    "<style_context>",
    input.firstName ? `Name: ${input.firstName}` : "",
    `Activity today: ${ACTIVITIES[input.activity].label} (impact: ${ACTIVITIES[input.activity].impact})`,
    p ? `Preferred styles: ${p.styles.join(", ") || "not set"}` : "Preferences: not set yet",
    p ? `Favorite colors: ${p.favorite_colors.join(", ") || "not set"}` : "",
    p ? `Colors to avoid: ${p.avoid_colors.join(", ") || "none"}` : "",
    p?.fit ? `Fit: ${FITS[p.fit as keyof typeof FITS] ?? p.fit}` : "",
    p?.coverage ? `Coverage: ${p.coverage}` : "",
    p?.activities.length ? `Usual activities: ${p.activities.map((a) => (isActivity(a) ? ACTIVITIES[a].label : a)).join(", ")}` : "",
    p?.notes ? `Her notes: ${p.notes}` : "",
    input.selected.length ? `Garments she selected (photos attached in this order):\n${input.selected.map(item).join("\n")}` : "She did not select garments: suggest a look from her closet list or general basics.",
    input.closet.length ? `Rest of her closet:\n${input.closet.slice(0, 40).map(item).join("\n")}` : "Her closet is empty.",
    input.question ? `Her question: ${input.question}` : "",
    "</style_context>",
  ];
  return lines.filter(Boolean).join("\n");
}

const pick = <T,>(list: T[], ok: (x: T) => boolean) => list.find(ok) ?? null;

/** Consejo con reglas cuando no hay proveedor de IA: funcional por actividad y combinación por colores. */
export function styleFallback(input: { activity: Activity; profile: StyleProfileLike | null; selected: WardrobeItemLike[]; closet: WardrobeItemLike[] }): string {
  const a = ACTIVITIES[input.activity];
  const avoid = new Set(input.profile?.avoid_colors ?? []);
  const fav = (input.profile?.favorite_colors ?? []).filter((c) => !avoid.has(c));
  const pool = (input.selected.length ? input.selected : input.closet).filter((i) => !i.colors.some((c) => avoid.has(c)));
  const score = (i: WardrobeItemLike) => i.colors.filter((c) => fav.includes(c)).length;
  const best = (cats: string[]) => pick([...pool].sort((x, y) => score(y) - score(x)), (i) => cats.includes(i.category));
  const top = best(a.impact === "alto" ? ["sports_bra", "set"] : ["sports_bra", "top", "set"]);
  const bottom = top?.category === "set" ? null : best(input.activity === "running" || input.activity === "hiit" ? ["shorts", "leggings"] : ["leggings", "shorts"]);
  const layer = best(["jacket"]);
  const shoes = best(["shoes"]);
  const name = (i: WardrobeItemLike) => `${CATEGORIES[i.category as WardrobeCategory] ?? i.category}${i.name ? ` "${i.name}"` : ""}${i.colors.length ? ` (${i.colors.join(" y ").toLowerCase()})` : ""}`;
  const activityName = /^[A-Z]{2,}/.test(a.label) ? a.label : a.label.charAt(0).toLowerCase() + a.label.slice(1);

  const look = [top, bottom, layer, shoes].filter((x): x is WardrobeItemLike => !!x).map((i) => `- ${name(i)}`);
  const neutral = fav.find((c) => NEUTRALS.has(c)) ?? "Negro";
  const accent = fav.find((c) => !NEUTRALS.has(c));
  const coverage = input.profile?.coverage === "alta" ? "- Elige tops más largos y leggings de tiro alto y tela opaca, como prefieres.\n" : "";
  const missing: string[] = [];
  if (!pool.some((i) => i.category === "sports_bra" || i.category === "set")) missing.push(`un top deportivo de soporte ${a.impact === "alto" ? "alto" : "medio"} en ${neutral.toLowerCase()}`);
  if (!pool.some((i) => i.category === "leggings" || i.category === "set")) missing.push(`unos leggings de tiro alto en ${neutral.toLowerCase()}, la base de casi cualquier look`);

  return [
    `### Tu look para ${activityName}`,
    look.length ? look.join("\n") : `- Base en ${neutral.toLowerCase()} de pies a cabeza${accent ? ` con un detalle en ${accent.toLowerCase()}` : ""}.`,
    "",
    "### Por qué funciona",
    ...a.tips.map((t) => `- ${t}`),
    coverage.trimEnd(),
    "",
    "### Colores y detalles",
    accent
      ? `- Combina una base en ${neutral.toLowerCase()} con un toque de ${accent.toLowerCase()} (top, coletero o calcetines): se ve pensado sin esfuerzo.`
      : `- Un look monocromático en ${neutral.toLowerCase()} siempre funciona; suma textura con una chaqueta o un top de otro tejido.`,
    avoid.size ? `- Dejamos fuera ${[...avoid].join(", ").toLowerCase()}, como pediste.` : "",
    missing.length ? "\n### Le falta a tu clóset\n" + missing.slice(0, 2).map((m) => `- ${m.charAt(0).toUpperCase()}${m.slice(1)}.`).join("\n") : "",
  ].filter((l) => l !== "").join("\n");
}
