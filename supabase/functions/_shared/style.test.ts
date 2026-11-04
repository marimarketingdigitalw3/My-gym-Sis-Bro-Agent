import { describe, expect, it } from "vitest";
import { formatStyleContext, styleFallback, validateStyleRequest, type StyleProfileLike, type WardrobeItemLike } from "./style.ts";

const profile: StyleProfileLike = { styles: ["Minimalista"], favorite_colors: ["Negro", "Rosa"], avoid_colors: ["Amarillo"], fit: "ajustado", coverage: "alta", activities: ["fuerza"], notes: null };
const id = (n: number) => `00000000-0000-0000-0000-00000000000${n}`;
const closet: WardrobeItemLike[] = [
  { id: id(1), category: "sports_bra", colors: ["Rosa"], name: "Top rosa" },
  { id: id(2), category: "leggings", colors: ["Negro"], name: null },
  { id: id(3), category: "top", colors: ["Amarillo"], name: "Camiseta amarilla" },
  { id: id(4), category: "shoes", colors: ["Blanco"], name: null },
];

describe("consejos de outfits", () => {
  it("valida la petición", () => {
    expect(validateStyleRequest({ activity: "yoga", itemIds: [id(1)], question: " ¿Qué combino? " })).toEqual({ ok: true, value: { activity: "yoga", itemIds: [id(1)], question: "¿Qué combino?" } });
    expect(validateStyleRequest({ activity: "boxeo" }).ok).toBe(false);
    expect(validateStyleRequest({ activity: "yoga", itemIds: ["x"] }).ok).toBe(false);
    expect(validateStyleRequest({ activity: "yoga", itemIds: [1, 2, 3, 4, 5, 6, 7].map(id) }).ok).toBe(false);
  });

  it("arma un look con sus prendas y respeta colores y cobertura", () => {
    const text = styleFallback({ activity: "fuerza", profile, selected: [], closet });
    expect(text).toContain("### Tu look para fuerza en gimnasio");
    expect(text).toContain('Top deportivo "Top rosa" (rosa)');
    expect(text).toContain("Leggings (negro)");
    expect(text).not.toContain("Camiseta amarilla");
    expect(text).toContain("tela opaca");
    expect(text).toContain("Dejamos fuera amarillo");
  });

  it("sugiere básicos cuando el clóset está vacío", () => {
    const text = styleFallback({ activity: "running", profile: null, selected: [], closet: [] });
    expect(text).toContain("soporte alto");
    expect(text).toContain("### Le falta a tu clóset");
  });

  it("incluye preferencias y prendas en el contexto para la IA", () => {
    const ctx = formatStyleContext({ activity: "hiit", profile, selected: [closet[0]], closet: closet.slice(1), question: "Para clase de las 7", firstName: "Mar" });
    expect(ctx).toContain("HIIT y funcional (impact: alto)");
    expect(ctx).toContain("Colors to avoid: Amarillo");
    expect(ctx).toContain('Top deportivo "Top rosa" (Rosa)');
    expect(ctx).toContain("Her question: Para clase de las 7");
  });
});
