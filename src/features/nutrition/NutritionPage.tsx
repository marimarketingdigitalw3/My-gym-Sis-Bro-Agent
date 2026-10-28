import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Circle, Coins, Info, Pencil, Plus, RefreshCw, Repeat, ShoppingBasket, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useBundle } from "@/app/providers";
import { WeeklyBars } from "@/components/charts";
import {
  Badge, Button, Card, CardHeader, Chip, EmptyState, ErrorState, Field, IconButton, Input, Modal, Notice, PageHeader, PageSkeleton, ProgressBar, Select, Stat, Tabs,
} from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { RECIPE_BY_ID } from "@/data/recipes";
import { addDays, formatLongDate, formatShortDate, startOfWeek, todayISO, WEEKDAYS, WEEKDAYS_SHORT } from "@/lib/dates";
import {
  AISLE_LABELS, dayMacros, eligibleRecipes, generateMealPlan, groceryList, MEAL_LABELS, MEAL_SPLITS, mealMacros, substituteMeal,
} from "@/lib/meals";
import { sumMacros } from "@/lib/nutrition";
import { errorMessage, useAsync } from "@/lib/useAsync";
import { nutritionFromBundle, showCalories } from "@/services/derived";
import {
  addMealLog, deleteMealLog, getMealPlan, getWater, listMealLogs, saveMealPlan, updateMealLog,
} from "@/services/tracking";
import type { MealLogRow, MealPlanDay, NutritionPrefsRow } from "@/types/db";
import type { MealType, Recipe } from "@/types/domain";
import { WaterTracker } from "./WaterTracker";

type TabKey = "today" | "plan" | "grocery" | "history";

const DEFAULT_PREFS: Omit<NutritionPrefsRow, "user_id" | "updated_at"> = {
  diet: "omnivore", eating_pattern: null, allergens: [], dislikes: [], meals_per_day: 4, budget: "medium", cooking_minutes: 30, cuisines: ["colombian"], wants_meal_prep: false,
};

export default function NutritionPage() {
  const bundle = useBundle();
  const toast = useToast();
  const today = todayISO();
  const weekStart = startOfWeek(today);
  const [tab, setTab] = useState<TabKey>("today");
  const estimate = useMemo(() => nutritionFromBundle(bundle), [bundle]);
  const caloriesVisible = showCalories(bundle, estimate);
  const prefs = bundle.nutrition ?? { ...DEFAULT_PREFS, user_id: bundle.profile.id, updated_at: "" };
  const targets = estimate.mode === "no_numbers" ? null : estimate.targets;

  const { data, loading, error, reload, setData } = useAsync(async () => {
    const [plan, logs, water] = await Promise.all([getMealPlan(weekStart), listMealLogs(addDays(today, -27), today), getWater(today)]);
    return { plan, logs, water };
  }, [weekStart]);

  if (loading && !data) return <PageSkeleton />;
  if (error || !data) return <ErrorState message={error ?? "Error"} onRetry={reload} />;

  const plan = data.plan;
  async function ensurePlan(regenerate = false) {
    try {
      const days = generateMealPlan({ weekStart, prefs, targets });
      if (regenerate || !plan) {
        const saved = await saveMealPlan(weekStart, days, targets);
        setData((d) => d && { ...d, plan: saved });
        toast(regenerate ? "Plan semanal regenerado" : "Plan semanal creado");
      }
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  async function saveDays(days: MealPlanDay[]) {
    const saved = await saveMealPlan(weekStart, days, targets);
    setData((d) => d && { ...d, plan: saved });
  }

  return (
    <div>
      <PageHeader title="Nutrición" subtitle="Plan flexible, comida real y sin culpas." />
      <div className="mb-5"><Tabs label="Secciones de nutrición" value={tab} onChange={setTab} items={[
        { value: "today", label: "Hoy" }, { value: "plan", label: "Plan semanal" }, { value: "grocery", label: "Lista de compras" }, { value: "history", label: "Historial" },
      ]} /></div>

      {estimate.warnings.length > 0 && <div className="mb-4 space-y-2">{estimate.warnings.map((w) => <Notice key={w} tone="warning">{w}</Notice>)}</div>}

      {tab === "today" && (
        <TodayTab today={today} logs={data.logs.filter((l) => l.logged_on === today)} plan={plan} caloriesVisible={caloriesVisible} estimate={estimate}
          water={data.water} onWater={(ml) => setData((d) => d && { ...d, water: ml })}
          onLogsChange={(fn) => setData((d) => d && { ...d, logs: fn(d.logs) })} onPlanChange={saveDays} onCreatePlan={() => ensurePlan()} />
      )}
      {tab === "plan" && (
        plan ? <PlanTab days={plan.days} prefs={prefs} targets={targets} caloriesVisible={caloriesVisible} onChange={saveDays} onRegenerate={() => ensurePlan(true)} />
          : <EmptyState icon={<RefreshCw className="h-5 w-5" />} title="Aún no tienes plan esta semana" description="Lo creamos según tu dieta, alergias, presupuesto y tiempo para cocinar." action={<Button onClick={() => ensurePlan()}>Crear plan semanal</Button>} />
      )}
      {tab === "grocery" && (plan ? <GroceryTab days={plan.days} weekStart={weekStart} /> : <EmptyState title="Primero crea tu plan semanal" action={<Button onClick={() => ensurePlan()}>Crear plan</Button>} />)}
      {tab === "history" && <HistoryTab logs={data.logs} today={today} caloriesVisible={caloriesVisible} kcalTarget={targets?.kcal ?? null} />}
    </div>
  );
}

function EstimatesCard({ estimate, caloriesVisible }: { estimate: ReturnType<typeof nutritionFromBundle>; caloriesVisible: boolean }) {
  const [open, setOpen] = useState(false);
  if (!estimate.targets) return <Notice>{estimate.assumptions[0]}</Notice>;
  if (!caloriesVisible) {
    return (
      <Card>
        <CardHeader title="Guía del día" />
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Incluye una fuente de proteína en cada comida.</li>
          <li>Medio plato de verduras o fruta.</li>
          <li>Carbohidratos que te den energía para entrenar.</li>
          <li>Come con regularidad y escucha tu hambre y saciedad.</li>
        </ul>
      </Card>
    );
  }
  const t = estimate.targets;
  return (
    <Card>
      <CardHeader title="Tus estimaciones diarias" subtitle="Son estimaciones, no prescripciones médicas."
        action={<IconButton label="Cómo lo calculamos" onClick={() => setOpen(true)}><Info className="h-5 w-5" /></IconButton>} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Energía" value={`${t.kcal} kcal`} hint={`rango ${t.kcalMin}–${t.kcalMax}`} />
        <Stat label="Proteína" value={`${t.proteinG} g`} />
        <Stat label="Carbohidratos" value={`${t.carbsG} g`} />
        <Stat label="Grasas" value={`${t.fatG} g`} />
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Cómo calculamos tus estimaciones">
        <ul className="list-disc space-y-2 pl-5 text-sm">
          {estimate.bmr && <li>Metabolismo basal estimado: {estimate.bmr} kcal. Gasto total estimado: {estimate.tdee} kcal.</li>}
          {estimate.assumptions.map((a) => <li key={a}>{a}</li>)}
        </ul>
        <p className="mt-3 text-sm text-muted">Ajustaremos según la evolución real de tu peso, tu energía y tu rendimiento. Si tienes una condición médica, consulta a un profesional en nutrición.</p>
      </Modal>
    </Card>
  );
}

const logSchema = z.object({
  name: z.string().trim().min(1, "Escribe qué comiste.").max(120),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  kcal: z.coerce.number().min(0, "Mínimo 0.").max(5000, "Máximo 5000."),
  protein_g: z.coerce.number().min(0).max(500),
  carbs_g: z.coerce.number().min(0).max(1000),
  fat_g: z.coerce.number().min(0).max(500),
});
type LogForm = z.infer<typeof logSchema>;

function LogModal({ open, onClose, initial, onSubmit, title }: { open: boolean; onClose: () => void; initial?: Partial<LogForm>; onSubmit: (v: LogForm) => Promise<void>; title: string }) {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<LogForm>({
    resolver: zodResolver(logSchema),
    values: { name: "", meal_type: "lunch", kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, ...initial } as LogForm,
  });
  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title={title}>
      <form onSubmit={handleSubmit(async (v) => { await onSubmit(v); reset(); })} className="space-y-3" noValidate>
        <Field label="Alimento o plato" htmlFor="l-name" error={errors.name?.message}><Input id="l-name" {...register("name")} invalid={!!errors.name} /></Field>
        <Field label="Comida" htmlFor="l-type">
          <Select id="l-type" {...register("meal_type")}>{(Object.keys(MEAL_LABELS) as MealType[]).map((m) => <option key={m} value={m}>{MEAL_LABELS[m]}</option>)}</Select>
        </Field>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="kcal" htmlFor="l-kcal" error={errors.kcal?.message}><Input id="l-kcal" type="number" inputMode="numeric" {...register("kcal")} /></Field>
          <Field label="Proteína g" htmlFor="l-p"><Input id="l-p" type="number" step="0.1" {...register("protein_g")} /></Field>
          <Field label="Carbos g" htmlFor="l-c"><Input id="l-c" type="number" step="0.1" {...register("carbs_g")} /></Field>
          <Field label="Grasa g" htmlFor="l-f"><Input id="l-f" type="number" step="0.1" {...register("fat_g")} /></Field>
        </div>
        <p className="text-xs text-muted">Si no conoces los valores, déjalos en 0: también cuenta registrar qué comiste.</p>
        <Button type="submit" block loading={isSubmitting}>Guardar</Button>
      </form>
    </Modal>
  );
}

function TodayTab({ today, logs, plan, caloriesVisible, estimate, water, onWater, onLogsChange, onPlanChange, onCreatePlan }: {
  today: string; logs: MealLogRow[]; plan: { days: MealPlanDay[] } | null; caloriesVisible: boolean; estimate: ReturnType<typeof nutritionFromBundle>;
  water: number; onWater: (ml: number) => void; onLogsChange: (fn: (l: MealLogRow[]) => MealLogRow[]) => void; onPlanChange: (d: MealPlanDay[]) => Promise<void>; onCreatePlan: () => void;
}) {
  const bundle = useBundle();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<MealLogRow | null>(null);
  const eaten = sumMacros(logs);
  const t = estimate.targets;
  const dayIdx = plan?.days.findIndex((d) => d.date === today) ?? -1;
  const planDay = dayIdx >= 0 ? plan!.days[dayIdx] : null;

  async function markPlanned(mealIndex: number) {
    if (!plan || !planDay) return;
    const meal = planDay.meals[mealIndex];
    const r = RECIPE_BY_ID[meal.recipeId];
    try {
      if (!meal.completed) {
        const m = mealMacros(meal);
        const created = await addMealLog({ logged_on: today, meal_type: meal.mealType, name: r.name, kcal: m.kcal, protein_g: m.proteinG, carbs_g: m.carbsG, fat_g: m.fatG, recipe_id: r.id, source: "plan", is_estimate: true });
        onLogsChange((l) => [...l, created]);
      } else {
        const log = logs.find((l) => l.recipe_id === meal.recipeId && l.source === "plan");
        if (log) { await deleteMealLog(log.id); onLogsChange((l) => l.filter((x) => x.id !== log.id)); }
      }
      const days = plan.days.map((d, i) => (i === dayIdx ? { ...d, meals: d.meals.map((m, j) => (j === mealIndex ? { ...m, completed: !m.completed } : m)) } : d));
      await onPlanChange(days);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <EstimatesCard estimate={estimate} caloriesVisible={caloriesVisible} />
        {t && caloriesVisible && (
          <Card>
            <CardHeader title="Hoy llevas" subtitle="Valores estimados" />
            <div className="space-y-3 text-sm">
              {([["Energía", eaten.kcal, t.kcal, "kcal"], ["Proteína", eaten.proteinG, t.proteinG, "g"], ["Carbohidratos", eaten.carbsG, t.carbsG, "g"], ["Grasas", eaten.fatG, t.fatG, "g"]] as const).map(([l, v, max, u]) => (
                <div key={l}>
                  <div className="mb-1 flex justify-between"><span>{l}</span><span className="font-semibold">{Math.round(v)} / {max} {u}</span></div>
                  <ProgressBar value={v} max={max} label={l} />
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card>
          <CardHeader title="Plan de hoy" action={!plan && <Button size="sm" onClick={onCreatePlan}>Crear plan</Button>} />
          {planDay ? (
            <ul className="divide-y divide-border">
              {planDay.meals.map((m, i) => {
                const r = RECIPE_BY_ID[m.recipeId];
                const mm = mealMacros(m);
                return (
                  <li key={`${m.mealType}-${i}`} className="flex items-center gap-3 py-3">
                    <button type="button" onClick={() => markPlanned(i)} aria-pressed={m.completed} aria-label={m.completed ? `Desmarcar ${r?.name}` : `Marcar ${r?.name} como comida`} className="text-primary-strong">
                      {m.completed ? <CheckCircle2 className="h-6 w-6" /> : <Circle className="h-6 w-6" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase text-muted">{MEAL_LABELS[m.mealType]}</p>
                      <p className={m.completed ? "text-muted line-through" : "font-medium"}>{r?.name}</p>
                    </div>
                    {caloriesVisible && <span className="text-sm text-muted">{mm.kcal} kcal</span>}
                  </li>
                );
              })}
            </ul>
          ) : <p className="text-sm text-muted">{plan ? "Este día no está en el plan actual." : "Crea tu plan semanal para ver aquí tus comidas sugeridas."}</p>}
        </Card>

        <Card>
          <CardHeader title="Registro de hoy" action={<Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Añadir</Button>} />
          {logs.length === 0 ? <p className="text-sm text-muted">Aún no registras comidas hoy.</p> : (
            <ul className="divide-y divide-border">
              {logs.map((l) => (
                <li key={l.id} className="flex items-center gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{l.name}</p>
                    <p className="text-xs text-muted">{MEAL_LABELS[l.meal_type]}{caloriesVisible ? ` · ${l.kcal} kcal · P ${l.protein_g} · C ${l.carbs_g} · G ${l.fat_g}` : ""}{l.is_estimate ? " · estimado" : ""}</p>
                  </div>
                  <IconButton label={`Editar ${l.name}`} onClick={() => setEditing(l)}><Pencil className="h-4 w-4" /></IconButton>
                  <IconButton label={`Borrar ${l.name}`} onClick={async () => {
                    try { await deleteMealLog(l.id); onLogsChange((xs) => xs.filter((x) => x.id !== l.id)); } catch (e) { toast(errorMessage(e), "error"); }
                  }}><Trash2 className="h-4 w-4" /></IconButton>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="space-y-5">
        {bundle.settings.water_tracking_enabled && <WaterTracker date={today} ml={water} goalMl={t?.waterMl ?? null} onChange={onWater} />}
        <Card>
          <CardHeader title="Sin culpas" />
          <p className="text-sm text-muted">Un día fuera del plan no arruina tu progreso. Lo que cuenta es la constancia de las semanas.</p>
        </Card>
      </div>

      <LogModal open={adding} onClose={() => setAdding(false)} title="Registrar comida" onSubmit={async (v) => {
        try {
          const created = await addMealLog({ ...v, logged_on: today, recipe_id: null, source: "manual", is_estimate: true });
          onLogsChange((l) => [...l, created]);
          setAdding(false);
          toast("Comida registrada");
        } catch (e) { toast(errorMessage(e), "error"); }
      }} />
      {editing && (
        <LogModal open onClose={() => setEditing(null)} title="Editar registro" initial={{ ...editing, kcal: Number(editing.kcal), protein_g: Number(editing.protein_g), carbs_g: Number(editing.carbs_g), fat_g: Number(editing.fat_g) }}
          onSubmit={async (v) => {
            try {
              await updateMealLog(editing.id, v);
              onLogsChange((l) => l.map((x) => (x.id === editing.id ? { ...x, ...v } : x)));
              setEditing(null);
              toast("Registro actualizado");
            } catch (e) { toast(errorMessage(e), "error"); }
          }} />
      )}
    </div>
  );
}

function PlanTab({ days, prefs, targets, caloriesVisible, onChange, onRegenerate }: {
  days: MealPlanDay[]; prefs: Omit<NutritionPrefsRow, "user_id" | "updated_at">; targets: ReturnType<typeof nutritionFromBundle>["targets"];
  caloriesVisible: boolean; onChange: (d: MealPlanDay[]) => Promise<void>; onRegenerate: () => void;
}) {
  const toast = useToast();
  const [dayIdx, setDayIdx] = useState(() => Math.max(0, days.findIndex((d) => d.date === todayISO())));
  const [recipe, setRecipe] = useState<{ r: Recipe; servings: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const day = days[dayIdx];
  const split = MEAL_SPLITS[prefs.meals_per_day] ?? MEAL_SPLITS[4];
  const totals = dayMacros(day);
  const fewOptions = (["breakfast", "lunch", "dinner", "snack"] as MealType[]).some((m) => day.meals.some((x) => x.mealType === m) && eligibleRecipes(prefs, m).length < 3);

  async function update(next: MealPlanDay, message: string) {
    setBusy(true);
    try {
      await onChange(days.map((d, i) => (i === dayIdx ? next : d)));
      toast(message);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5 overflow-x-auto">
          {days.map((d, i) => <Chip key={d.date} selected={i === dayIdx} onClick={() => setDayIdx(i)}>{WEEKDAYS_SHORT[i]} {formatShortDate(d.date).split(" ")[0]}</Chip>)}
        </div>
        <Button variant="outline" size="sm" onClick={onRegenerate}><RefreshCw className="h-4 w-4" /> Regenerar semana</Button>
      </div>
      {fewOptions && <Notice>Con tus preferencias hay pocas recetas disponibles para algunas comidas, así que algunas se repiten.</Notice>}
      <Card>
        <CardHeader title={WEEKDAYS[dayIdx]} subtitle={caloriesVisible ? `${totals.kcal} kcal · P ${totals.proteinG} g · C ${totals.carbsG} g · G ${totals.fatG} g (estimado)` : formatLongDate(day.date)} />
        <ul className="space-y-3">
          {day.meals.map((m, i) => {
            const r = RECIPE_BY_ID[m.recipeId];
            if (!r) return null;
            const mm = mealMacros(m);
            return (
              <li key={`${m.mealType}-${i}`} className="rounded-2xl border border-border p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <button type="button" className="min-w-0 text-left" onClick={() => setRecipe({ r, servings: m.servings })}>
                    <p className="text-xs font-semibold uppercase text-muted">{MEAL_LABELS[m.mealType]}</p>
                    <p className="font-semibold hover:text-primary-strong">{r.name}</p>
                    <p className="text-xs text-muted">{r.prepMinutes} min · {m.servings} {m.servings === 1 ? "porción" : "porciones"}{caloriesVisible ? ` · ${mm.kcal} kcal · ${mm.proteinG} g proteína` : ""}</p>
                  </button>
                  <div className="flex shrink-0">
                    <IconButton label="Cambiar por otra receta" disabled={busy} onClick={() => update(substituteMeal(day, i, prefs, targets, split), "Comida cambiada")}><Repeat className="h-4 w-4" /></IconButton>
                    <IconButton label="Opción más económica" disabled={busy} onClick={() => update(substituteMeal(day, i, prefs, targets, split, true), "Opción más económica")}><Coins className="h-4 w-4" /></IconButton>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <span className="text-muted">Porción:</span>
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                    <button key={s} type="button" disabled={busy} aria-pressed={m.servings === s}
                      onClick={() => update({ ...day, meals: day.meals.map((x, j) => (j === i ? { ...x, servings: s } : x)) }, "Porción ajustada")}
                      className={m.servings === s ? "rounded-full bg-primary-strong px-2 py-0.5 text-xs font-semibold text-on-primary" : "rounded-full px-2 py-0.5 text-xs text-muted hover:bg-surface-2"}>
                      ×{s}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge>{r.budget === "low" ? "Económica" : r.budget === "medium" ? "Precio medio" : "Precio alto"}</Badge>
                  {r.tags.slice(0, 3).map((t) => <Badge key={t} tone="primary">{t}</Badge>)}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
      <p className="text-xs text-muted">Valores nutricionales estimados a partir de tablas de composición estándar; pueden variar según marcas y preparación.</p>

      <Modal open={!!recipe} onClose={() => setRecipe(null)} title={recipe?.r.name ?? ""}>
        {recipe && (
          <div className="space-y-4 text-sm">
            <p className="text-muted">{recipe.r.prepMinutes} min · {recipe.servings} {recipe.servings === 1 ? "porción" : "porciones"}</p>
            <div>
              <p className="font-semibold">Ingredientes</p>
              <ul className="mt-1 list-disc pl-5">{recipe.r.ingredients.map((i) => <li key={i.name}>{i.name}: {Math.round(i.grams * recipe.servings)} g</li>)}</ul>
            </div>
            <div>
              <p className="font-semibold">Preparación</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5">{recipe.r.steps.map((s) => <li key={s}>{s}</li>)}</ol>
            </div>
            {caloriesVisible && (
              <p className="rounded-xl bg-surface-2 p-3">
                Por esta cantidad (estimado): {Math.round(recipe.r.kcal * recipe.servings)} kcal · P {Math.round(recipe.r.proteinG * recipe.servings)} g · C {Math.round(recipe.r.carbsG * recipe.servings)} g · G {Math.round(recipe.r.fatG * recipe.servings)} g
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function GroceryTab({ days, weekStart }: { days: MealPlanDay[]; weekStart: string }) {
  const list = useMemo(() => groceryList(days), [days]);
  const key = `mgs:grocery:${weekStart}`;
  const [checked, setChecked] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(key) ?? "[]"); } catch { return []; }
  });
  const toggle = (name: string) => {
    const next = checked.includes(name) ? checked.filter((x) => x !== name) : [...checked, name];
    setChecked(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* sin almacenamiento */ }
  };
  const aisles = Object.keys(list) as (keyof typeof AISLE_LABELS)[];
  return (
    <div className="space-y-4">
      <Card className="flex items-center gap-3">
        <ShoppingBasket className="h-6 w-6 text-primary-strong" />
        <p className="text-sm">Cantidades aproximadas para toda la semana según tu plan y tus porciones.</p>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {aisles.map((a) => (
          <Card key={a}>
            <CardHeader title={AISLE_LABELS[a]} />
            <ul className="space-y-1.5">
              {list[a].map((item) => (
                <li key={item.name}>
                  <label className="flex items-center gap-2.5 text-sm">
                    <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--primary-strong))]" checked={checked.includes(item.name)} onChange={() => toggle(item.name)} />
                    <span className={checked.includes(item.name) ? "text-muted line-through" : ""}>{item.name}</span>
                    <span className="ml-auto text-muted">{item.grams >= 1000 ? `${(item.grams / 1000).toFixed(1)} kg` : `${item.grams} g`}</span>
                  </label>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}

function HistoryTab({ logs, today, caloriesVisible, kcalTarget }: { logs: MealLogRow[]; today: string; caloriesVisible: boolean; kcalTarget: number | null }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const perDay = days.map((d) => ({ date: d, logs: logs.filter((l) => l.logged_on === d) }));
  const loggedDays = perDay.filter((d) => d.logs.length).length;
  if (!logs.length) return <EmptyState title="Aún no hay historial" description="Registra tus comidas para ver tu constancia semanal." />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Días con registro" value={`${loggedDays}/7`} hint="últimos 7 días" />
        <Stat label="Comidas registradas" value={perDay.reduce((a, d) => a + d.logs.length, 0)} />
        {caloriesVisible && kcalTarget && <Stat label="Promedio" value={`${Math.round(perDay.filter((d) => d.logs.length).reduce((a, d) => a + sumMacros(d.logs).kcal, 0) / Math.max(1, loggedDays))} kcal`} hint={`objetivo ${kcalTarget}`} />}
      </div>
      <Card>
        <CardHeader title={caloriesVisible ? "Energía por día (estimada)" : "Comidas registradas por día"} />
        <WeeklyBars label={caloriesVisible ? "kcal" : "comidas"} data={perDay.map((d, i) => ({ label: WEEKDAYS_SHORT[(new Date(`${d.date}T12:00:00`).getDay() + 6) % 7] ?? String(i), value: caloriesVisible ? Math.round(sumMacros(d.logs).kcal) : d.logs.length }))} />
      </Card>
      <Card>
        <CardHeader title="Historial de comidas" />
        <ul className="divide-y divide-border">
          {[...perDay].reverse().filter((d) => d.logs.length).map((d) => (
            <li key={d.date} className="py-2.5">
              <p className="text-sm font-semibold first-letter:uppercase">{formatLongDate(d.date)}</p>
              <p className="text-sm text-muted">{d.logs.map((l) => l.name).join(" · ")}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
