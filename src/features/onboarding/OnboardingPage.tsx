import { ArrowLeft, ArrowRight, Check, Moon, Sparkles, Star, Sun } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { applyTheme, useBundle, useUserData } from "@/app/providers";
import { BrandMark } from "@/components/BrandMark";
import {
  Badge, Button, Card, Chip, Field, Input, Notice, OptionCard, ProgressBar, Select, Textarea, Toggle, cx,
} from "@/components/ui";
import { BODY_TYPE_DISCLAIMER, BODY_TYPE_INFO, BODY_TYPE_QUESTIONS, classifyBodyType } from "@/lib/bodyType";
import { CYCLE_DISCLAIMER, SYMPTOMS } from "@/lib/cycle";
import { ageFromBirthDate, todayISO, WEEKDAYS_SHORT } from "@/lib/dates";
import { ENVIRONMENT_LABELS, EQUIPMENT_LABELS, JOINT_LABELS, LEVEL_LABELS } from "@/lib/labels";
import { GOAL_LABELS } from "@/lib/userBundle";
import { errorMessage } from "@/lib/useAsync";
import { RED_FLAGS, isUrgent } from "../../../supabase/functions/_shared/safety.ts";
import { DISLIKE_PATTERNS, generatorInputFromBundle } from "@/services/derived";
import {
  saveCycleSettings, saveGoals, saveNutritionPrefs, saveOnboardingSection, updateProfile, updateSettings, loadUserBundle,
} from "@/services/profile";
import { saveCycleLog } from "@/services/tracking";
import { regeneratePlan } from "@/services/workouts";
import type { ActivityLevel, BodyTypeAnswers, CycleSettingsRow, HealthAnswers, LifestyleAnswers } from "@/types/db";
import type {
  Allergen, BiologicalSex, BudgetLevel, CuisineStyle, DietPattern, Equipment, FitnessLevel, GoalKey, JointArea, ThemeName, TrainingEnvironment, Units,
} from "@/types/domain";
import { ACTIVITY_FACTORS } from "@/lib/nutrition";

// ---------- Estado del cuestionario ----------
interface Answers {
  displayName: string;
  birthDate: string;
  heightCm: string;
  weightKg: string;
  targetWeightKg: string;
  country: string;
  units: Units;
  language: "es" | "en";
  sex: BiologicalSex | "";
  genderIdentity: string;
  theme: ThemeName;
  goals: GoalKey[];
  targetWeeks: number;
  level: FitnessLevel | "";
  experienceMonths: number;
  daysPerWeek: number;
  sessionMinutes: number;
  hasRoutine: boolean;
  knownExercises: string[];
  dislikedExercises: string[];
  environment: TrainingEnvironment | "";
  equipment: Equipment[];
  activityLevel: ActivityLevel | "";
  dailySteps: string;
  occupation: LifestyleAnswers["occupation"] | "";
  sleepHours: number;
  preferredDays: number[];
  preferredTime: NonNullable<LifestyleAnswers["preferredTime"]>;
  stressLevel: number | null;
  sports: string;
  health: HealthAnswers;
  diet: DietPattern;
  eatingPattern: string;
  allergens: Allergen[];
  dislikes: string;
  mealsPerDay: number;
  budget: BudgetLevel;
  cookingMinutes: number;
  cuisines: CuisineStyle[];
  wantsMealPrep: boolean;
  bodyType: BodyTypeAnswers;
  cycleEnabled: boolean | null;
  cycle: Omit<CycleSettingsRow, "user_id" | "updated_at">;
  lastPeriodUnknown: boolean;
  cycleSymptoms: string[];
  cycleEnergy: number | null;
}

const STEPS = [
  { key: "basic", title: "Sobre ti" },
  { key: "goals", title: "Tus objetivos" },
  { key: "fitness", title: "Tu nivel" },
  { key: "environment", title: "Dónde entrenas" },
  { key: "lifestyle", title: "Tu día a día" },
  { key: "health", title: "Salud y seguridad" },
  { key: "nutrition", title: "Alimentación" },
  { key: "body", title: "Composición corporal" },
  { key: "cycle", title: "Ciclo menstrual" },
  { key: "confirm", title: "Confirmación" },
] as const;

const KNOWN = ["Sentadilla", "Peso muerto", "Press de banca", "Dominadas", "Hip thrust", "Flexiones", "Zancadas", "Plancha", "Remo", "Press militar"];
const COUNTRIES = ["Colombia", "México", "Argentina", "Chile", "Perú", "Ecuador", "Venezuela", "España", "Estados Unidos", "Otro"];
const ALLERGENS: { key: Allergen; label: string }[] = [
  { key: "gluten", label: "Gluten" }, { key: "lactose", label: "Lactosa" }, { key: "eggs", label: "Huevo" }, { key: "nuts", label: "Frutos secos" },
  { key: "peanuts", label: "Maní" }, { key: "soy", label: "Soya" }, { key: "fish", label: "Pescado" }, { key: "shellfish", label: "Mariscos" },
];

function initialAnswers(b: ReturnType<typeof useBundle>): Answers {
  const p = b.profile;
  const o = b.onboarding;
  const n = b.nutrition;
  return {
    displayName: p.display_name ?? "",
    birthDate: p.birth_date ?? "",
    heightCm: p.height_cm ? String(p.height_cm) : "",
    weightKg: p.weight_kg ? String(p.weight_kg) : "",
    targetWeightKg: p.target_weight_kg ? String(p.target_weight_kg) : "",
    country: p.country ?? "Colombia",
    units: p.units,
    language: p.language,
    sex: p.sex ?? "",
    genderIdentity: p.gender_identity ?? "",
    theme: p.theme,
    goals: b.goals.map((g) => g.goal),
    targetWeeks: b.goals[0]?.target_weeks ?? 12,
    level: o?.fitness.level ?? "",
    experienceMonths: o?.fitness.experienceMonths ?? 0,
    daysPerWeek: o?.fitness.daysPerWeek ?? 3,
    sessionMinutes: o?.fitness.sessionMinutes ?? 45,
    hasRoutine: o?.fitness.hasRoutine ?? false,
    knownExercises: o?.fitness.knownExercises ?? [],
    dislikedExercises: o?.fitness.dislikedExercises ?? [],
    environment: o?.environment.environment ?? "",
    equipment: o?.environment.equipment ?? [],
    activityLevel: o?.lifestyle.activityLevel ?? "",
    dailySteps: o?.lifestyle.dailySteps ? String(o.lifestyle.dailySteps) : "",
    occupation: o?.lifestyle.occupation ?? "",
    sleepHours: o?.lifestyle.sleepHours ?? 7,
    preferredDays: o?.lifestyle.preferredDays ?? [],
    preferredTime: o?.lifestyle.preferredTime ?? "flexible",
    stressLevel: o?.lifestyle.stressLevel ?? null,
    sports: o?.lifestyle.sports ?? "",
    health: o?.health ?? { limitations: [], redFlags: [], pregnancyStatus: "none", edHistory: null },
    diet: n?.diet ?? "omnivore",
    eatingPattern: n?.eating_pattern ?? "regular",
    allergens: n?.allergens ?? [],
    dislikes: (n?.dislikes ?? []).join(", "),
    mealsPerDay: n?.meals_per_day ?? 4,
    budget: n?.budget ?? "medium",
    cookingMinutes: n?.cooking_minutes ?? 30,
    cuisines: n?.cuisines ?? ["colombian", "latin"],
    wantsMealPrep: n?.wants_meal_prep ?? false,
    bodyType: o?.body_type ?? { wantsClassification: false },
    cycleEnabled: b.settings.cycle_tracking_enabled ? true : null,
    cycle: {
      last_period_start: b.cycle?.last_period_start ?? null,
      typical_cycle_length: b.cycle?.typical_cycle_length ?? null,
      typical_period_length: b.cycle?.typical_period_length ?? 5,
      regularity: b.cycle?.regularity ?? "unknown",
      hormonal_contraception: b.cycle?.hormonal_contraception ?? false,
      wants_phase_estimates: b.cycle?.wants_phase_estimates ?? true,
      period_training_preference: b.cycle?.period_training_preference ?? "decide_daily",
    },
    lastPeriodUnknown: false,
    cycleSymptoms: [],
    cycleEnergy: null,
  };
}

// ---------- Validación por paso (Zod) ----------
const num = (min: number, max: number, msg: string) =>
  z.string().trim().min(1, msg).refine((v) => !Number.isNaN(Number(v)) && Number(v) >= min && Number(v) <= max, msg);

const basicSchema = z.object({
  displayName: z.string().trim().min(1, "Escribe tu nombre o cómo prefieres que te llamemos.").max(50),
  birthDate: z.string().min(1, "Indica tu fecha de nacimiento.").refine((v) => {
    const age = ageFromBirthDate(v);
    return age !== null && age >= 13 && age <= 100;
  }, "La app es para personas de 13 años o más. Revisa la fecha."),
  heightCm: num(100, 250, "Estatura entre 100 y 250 cm."),
  weightKg: num(25, 350, "Peso entre 25 y 350 kg."),
  targetWeightKg: z.string().trim().refine((v) => v === "" || (Number(v) >= 25 && Number(v) <= 350), "Peso objetivo entre 25 y 350 kg."),
});

function validate(step: number, a: Answers): Record<string, string> {
  const errors: Record<string, string> = {};
  if (step === 0) {
    const r = basicSchema.safeParse(a);
    if (!r.success) for (const issue of r.error.issues) errors[String(issue.path[0])] ??= issue.message;
  }
  if (step === 1 && a.goals.length === 0) errors.goals = "Elige al menos un objetivo.";
  if (step === 2 && !a.level) errors.level = "Elige tu nivel actual.";
  if (step === 3) {
    if (!a.environment) errors.environment = "Elige dónde entrenas.";
  }
  if (step === 4) {
    if (!a.activityLevel) errors.activityLevel = "Elige tu nivel de actividad diaria.";
    if (a.dailySteps && (Number(a.dailySteps) < 0 || Number(a.dailySteps) > 60000)) errors.dailySteps = "Pasos entre 0 y 60.000.";
  }
  if (step === 5 && !a.health.acknowledgedDisclaimer) errors.disclaimer = "Necesitamos que leas y aceptes este aviso para continuar.";
  if (step === 8 && a.cycleEnabled) {
    const c = a.cycle;
    if (!a.lastPeriodUnknown && !c.last_period_start) errors.lastPeriod = "Indica la fecha o marca que no la recuerdas.";
    if (c.last_period_start && c.last_period_start > todayISO()) errors.lastPeriod = "La fecha no puede ser futura.";
    if (c.typical_cycle_length !== null && (c.typical_cycle_length < 15 || c.typical_cycle_length > 60)) errors.cycleLength = "Entre 15 y 60 días.";
  }
  return errors;
}

// ---------- Página ----------
export default function OnboardingPage() {
  const bundle = useBundle();
  const { refresh } = useUserData();
  const navigate = useNavigate();
  const [step, setStep] = useState(Math.min(bundle.profile.onboarding_step, STEPS.length - 1));
  const [a, setA] = useState<Answers>(() => initialAnswers(bundle));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => setA((s) => ({ ...s, [k]: v }));
  const setHealth = (patch: Partial<HealthAnswers>) => setA((s) => ({ ...s, health: { ...s.health, ...patch } }));
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function persist(stepIndex: number) {
    switch (STEPS[stepIndex].key) {
      case "basic":
        await updateProfile({
          display_name: a.displayName.trim(), birth_date: a.birthDate, height_cm: Number(a.heightCm), weight_kg: Number(a.weightKg),
          target_weight_kg: a.targetWeightKg ? Number(a.targetWeightKg) : null, country: a.country, units: a.units, language: a.language,
          sex: a.sex || null, gender_identity: a.genderIdentity.trim() || null, theme: a.theme,
        });
        break;
      case "goals":
        await saveGoals(a.goals, a.targetWeeks);
        break;
      case "fitness":
        await saveOnboardingSection({ fitness: {
          level: a.level || undefined, experienceMonths: a.experienceMonths, daysPerWeek: a.daysPerWeek, sessionMinutes: a.sessionMinutes,
          hasRoutine: a.hasRoutine, knownExercises: a.knownExercises, dislikedExercises: a.dislikedExercises,
        } });
        break;
      case "environment":
        await saveOnboardingSection({ environment: { environment: a.environment || undefined, equipment: a.equipment } });
        break;
      case "lifestyle":
        await saveOnboardingSection({ lifestyle: {
          activityLevel: a.activityLevel || undefined, dailySteps: a.dailySteps ? Number(a.dailySteps) : null, occupation: a.occupation || undefined,
          sleepHours: a.sleepHours, preferredDays: a.preferredDays, preferredTime: a.preferredTime,
          stressLevel: a.stressLevel as LifestyleAnswers["stressLevel"], sports: a.sports.trim(),
        } });
        break;
      case "health":
        await saveOnboardingSection({ health: a.health });
        await updateSettings({ health_consent_at: new Date().toISOString() });
        break;
      case "nutrition":
        await saveNutritionPrefs({
          diet: a.diet, eating_pattern: a.eatingPattern, allergens: a.allergens,
          dislikes: a.dislikes.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 30),
          meals_per_day: a.mealsPerDay, budget: a.budget, cooking_minutes: a.cookingMinutes, cuisines: a.cuisines, wants_meal_prep: a.wantsMealPrep,
        });
        break;
      case "body":
        await saveOnboardingSection({ body_type: a.bodyType.wantsClassification
          ? { ...a.bodyType, result: classifyBodyType(a.bodyType.answers) }
          : { wantsClassification: false } });
        break;
      case "cycle":
        await updateSettings({ cycle_tracking_enabled: a.cycleEnabled === true });
        if (a.cycleEnabled) {
          await saveCycleSettings({ ...a.cycle, last_period_start: a.lastPeriodUnknown ? null : a.cycle.last_period_start });
          if (a.cycleSymptoms.length || a.cycleEnergy) {
            await saveCycleLog({ logged_on: todayISO(), symptoms: a.cycleSymptoms, energy: a.cycleEnergy, period_start: false });
          }
        }
        break;
    }
    await updateProfile({ onboarding_step: Math.min(stepIndex + 1, STEPS.length - 1) });
  }

  async function next() {
    const errs = validate(step, a);
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.querySelector("[role=alert]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await persist(step);
      setStep((s) => s + 1);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setSaveError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function finish() {
    setSaving(true);
    setSaveError(null);
    try {
      const fresh = await loadUserBundle();
      await regeneratePlan(generatorInputFromBundle(fresh));
      await updateProfile({ onboarding_completed: true, onboarding_step: STEPS.length - 1 });
      await refresh();
      navigate("/", { replace: true });
    } catch (e) {
      setSaveError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const current = STEPS[step];
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 bg-bg/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <BrandMark compact />
          <span className="text-sm text-muted">Paso {step + 1} de {STEPS.length}</span>
        </div>
        <div className="mx-auto max-w-2xl px-4 pb-3"><ProgressBar value={step + 1} max={STEPS.length} label="Progreso del cuestionario" /></div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-32 pt-6">
        <h1 className="display-hero text-3xl sm:text-4xl">{current.title}</h1>
        <div key={current.key} className="mt-5 animate-fade-up space-y-5">
          {current.key === "basic" && <BasicStep a={a} set={set} errors={errors} />}
          {current.key === "goals" && <GoalsStep a={a} set={set} toggle={toggle} errors={errors} />}
          {current.key === "fitness" && <FitnessStep a={a} set={set} toggle={toggle} errors={errors} />}
          {current.key === "environment" && <EnvironmentStep a={a} set={set} toggle={toggle} errors={errors} />}
          {current.key === "lifestyle" && <LifestyleStep a={a} set={set} toggle={toggle} errors={errors} />}
          {current.key === "health" && <HealthStep a={a} setHealth={setHealth} toggle={toggle} errors={errors} />}
          {current.key === "nutrition" && <NutritionStep a={a} set={set} toggle={toggle} />}
          {current.key === "body" && <BodyStep a={a} set={set} />}
          {current.key === "cycle" && <CycleStep a={a} set={set} toggle={toggle} errors={errors} />}
          {current.key === "confirm" && <ConfirmStep a={a} />}
          {saveError && <Notice tone="danger" title="No pudimos guardar">{saveError}</Notice>}
        </div>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-[2rem] border border-border/60 bg-surface/90 p-2 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.35)] backdrop-blur-xl">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || saving}>
            <ArrowLeft className="h-4 w-4" /> Atrás
          </Button>
          {current.key === "confirm" ? (
            <Button size="lg" onClick={finish} loading={saving}><Sparkles className="h-4 w-4" /> Crear mi plan</Button>
          ) : (
            <Button size="lg" onClick={next} loading={saving}>Siguiente <ArrowRight className="h-4 w-4" /></Button>
          )}
        </div>
      </footer>
    </div>
  );
}

type SetFn = <K extends keyof Answers>(k: K, v: Answers[K]) => void;
type ToggleFn = <T>(list: T[], v: T) => T[];

function Section({ title, hint, children, error }: { title: string; hint?: ReactNode; children: ReactNode; error?: string }) {
  return (
    <section className="space-y-2.5">
      <div>
        <h2 className="text-base font-semibold font-body normal-case tracking-normal">{title}</h2>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {children}
      {error && <p role="alert" className="text-xs font-medium text-danger">{error}</p>}
    </section>
  );
}

const THEME_OPTIONS: { key: ThemeName; title: string; text: string; swatch: string[] }[] = [
  { key: "sis", title: "My Gym/Sis", text: "Femenino y luminoso, en rosados, salmón y amarillo.", swatch: ["#C93A62", "#F7927F", "#FFD3DF", "#FFD678"] },
  { key: "bro", title: "Gym Bro", text: "Potente y enfocado en rendimiento, sobre fondo negro.", swatch: ["#000000", "#161619", "#F0F1F3", "#D3E496"] },
  { key: "neutral", title: "Neutro", text: "Limpio y sereno, en blanco con botones negros.", swatch: ["#18181B", "#FFFFFF", "#F5F4F7", "#D3E496"] },
];

function BasicStep({ a, set, errors }: { a: Answers; set: SetFn; errors: Record<string, string> }) {
  return (
    <>
      <Section title="¿Cómo quieres ver tu app?" hint="Elige la experiencia que más te guste. El entrenamiento no depende de esta elección y puedes cambiarla en Ajustes.">
        <div className="grid gap-3 sm:grid-cols-3">
          {THEME_OPTIONS.map((t) => (
            <button key={t.key} type="button" aria-pressed={a.theme === t.key}
              onClick={() => { set("theme", t.key); applyTheme(t.key); }}
              className={cx("rounded-2xl border p-3 text-left transition", a.theme === t.key ? "border-primary-strong ring-2 ring-primary/30" : "border-border hover:bg-surface-2")}>
              <div className="flex h-10 overflow-hidden rounded-lg">{t.swatch.map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}</div>
              <p className="mt-2 font-semibold">{t.title}</p>
              <p className="text-xs text-muted">{t.text}</p>
            </button>
          ))}
        </div>
      </Section>
      <Card className="space-y-4">
        <Field label="Nombre o cómo prefieres que te llamemos" htmlFor="name" error={errors.displayName}>
          <Input id="name" value={a.displayName} onChange={(e) => set("displayName", e.target.value)} invalid={!!errors.displayName} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fecha de nacimiento" htmlFor="birth" error={errors.birthDate}>
            <Input id="birth" type="date" max={todayISO()} value={a.birthDate} onChange={(e) => set("birthDate", e.target.value)} invalid={!!errors.birthDate} />
          </Field>
          <Field label="País" htmlFor="country">
            <Select id="country" value={a.country} onChange={(e) => set("country", e.target.value)}>
              {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Estatura (cm)" htmlFor="height" error={errors.heightCm}>
            <Input id="height" inputMode="decimal" type="number" step="0.5" value={a.heightCm} onChange={(e) => set("heightCm", e.target.value)} invalid={!!errors.heightCm} />
          </Field>
          <Field label="Peso actual (kg)" htmlFor="weight" error={errors.weightKg}>
            <Input id="weight" inputMode="decimal" type="number" step="0.1" value={a.weightKg} onChange={(e) => set("weightKg", e.target.value)} invalid={!!errors.weightKg} />
          </Field>
          <Field label="Peso objetivo (kg)" optional htmlFor="target" error={errors.targetWeightKg} hint="No es obligatorio: también medimos fuerza, constancia y energía.">
            <Input id="target" inputMode="decimal" type="number" step="0.1" value={a.targetWeightKg} onChange={(e) => set("targetWeightKg", e.target.value)} />
          </Field>
          <Field label="Unidades para mostrar" htmlFor="units">
            <Select id="units" value={a.units} onChange={(e) => set("units", e.target.value as Units)}>
              <option value="metric">Métricas (kg, cm)</option>
              <option value="imperial">Imperiales (lb)</option>
            </Select>
          </Field>
          <Field label="Idioma del coach" htmlFor="lang">
            <Select id="lang" value={a.language} onChange={(e) => set("language", e.target.value as "es" | "en")}>
              <option value="es">Español</option>
              <option value="en">English</option>
            </Select>
          </Field>
          <Field label="Sexo biológico" optional htmlFor="sex" hint="Solo se usa para estimar tu gasto energético con más precisión.">
            <Select id="sex" value={a.sex} onChange={(e) => set("sex", e.target.value as BiologicalSex | "")}>
              <option value="">Prefiero no decirlo</option>
              <option value="female">Femenino</option>
              <option value="male">Masculino</option>
            </Select>
          </Field>
        </div>
        <Field label="Identidad de género" optional htmlFor="gender" hint="Si quieres compartirla. No cambia tu plan.">
          <Input id="gender" maxLength={50} value={a.genderIdentity} onChange={(e) => set("genderIdentity", e.target.value)} />
        </Field>
      </Card>
    </>
  );
}

function GoalsStep({ a, set, toggle, errors }: { a: Answers; set: SetFn; toggle: ToggleFn; errors: Record<string, string> }) {
  const primary = a.goals[0];
  return (
    <>
      <Section title="¿Qué quieres lograr?" hint="Elige uno o varios. El primero es tu objetivo principal: toca la estrella para cambiarlo." error={errors.goals}>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {(Object.keys(GOAL_LABELS) as GoalKey[]).map((g) => {
            const selected = a.goals.includes(g);
            return (
              <div key={g} className={cx("flex items-center rounded-2xl border transition", selected ? "border-primary-strong bg-primary/10" : "border-border bg-surface")}>
                <button type="button" aria-pressed={selected} onClick={() => set("goals", toggle(a.goals, g))} className="flex flex-1 items-center gap-2 p-3.5 text-left font-medium">
                  <span className={cx("grid h-5 w-5 place-items-center rounded-md border", selected ? "border-primary-strong bg-primary-strong text-on-primary" : "border-border")}>
                    {selected && <Check className="h-3.5 w-3.5" />}
                  </span>
                  {GOAL_LABELS[g]}
                </button>
                {selected && (
                  <button type="button" aria-label={`Hacer de ${GOAL_LABELS[g]} mi objetivo principal`} onClick={() => set("goals", [g, ...a.goals.filter((x) => x !== g)])}
                    className="mr-2 rounded-full p-2 text-primary-strong hover:bg-surface-2">
                    <Star className={cx("h-5 w-5", primary === g && "fill-current")} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Section>
      {primary && <Notice>Objetivo principal: <strong>{GOAL_LABELS[primary]}</strong>.</Notice>}
      <Section title="¿En cuánto tiempo te gustaría ver avances claros?" hint="Los cambios reales llevan semanas. No prometemos resultados concretos: medimos tu progreso y ajustamos el plan.">
        <div className="flex flex-wrap gap-2">
          {[8, 12, 16, 24, 52].map((w) => <Chip key={w} selected={a.targetWeeks === w} onClick={() => set("targetWeeks", w)}>{w === 52 ? "1 año" : `${w} semanas`}</Chip>)}
        </div>
      </Section>
    </>
  );
}

function FitnessStep({ a, set, toggle, errors }: { a: Answers; set: SetFn; toggle: ToggleFn; errors: Record<string, string> }) {
  return (
    <>
      <Section title="Tu nivel actual" error={errors.level}>
        <div className="grid gap-2.5">
          <OptionCard selected={a.level === "beginner"} onClick={() => set("level", "beginner")} title="Principiante" description="Empiezo o llevo menos de 6 meses entrenando con constancia." />
          <OptionCard selected={a.level === "intermediate"} onClick={() => set("level", "intermediate")} title="Intermedio" description="Entreno hace 6 meses a 2 años y conozco los ejercicios básicos." />
          <OptionCard selected={a.level === "advanced"} onClick={() => set("level", "advanced")} title="Avanzado" description="Más de 2 años entrenando con técnica sólida y progresión planificada." />
        </div>
      </Section>
      <Card className="grid gap-4 sm:grid-cols-2">
        <Field label="¿Cuánto tiempo llevas entrenando?" htmlFor="exp">
          <Select id="exp" value={a.experienceMonths} onChange={(e) => set("experienceMonths", Number(e.target.value))}>
            <option value={0}>Estoy empezando</option><option value={3}>Menos de 6 meses</option><option value={12}>6 a 18 meses</option>
            <option value={30}>1,5 a 3 años</option><option value={60}>Más de 3 años</option>
          </Select>
        </Field>
        <Field label="¿Tienes una rutina actualmente?" htmlFor="routine">
          <Select id="routine" value={a.hasRoutine ? "yes" : "no"} onChange={(e) => set("hasRoutine", e.target.value === "yes")}>
            <option value="no">No</option><option value="yes">Sí</option>
          </Select>
        </Field>
      </Card>
      <Section title="¿Cuántos días por semana puedes entrenar?">
        <div className="flex flex-wrap gap-2">{[1, 2, 3, 4, 5, 6].map((d) => <Chip key={d} selected={a.daysPerWeek === d} onClick={() => set("daysPerWeek", d)}>{d} {d === 1 ? "día" : "días"}</Chip>)}</div>
      </Section>
      <Section title="¿Cuánto tiempo por sesión?">
        <div className="flex flex-wrap gap-2">{[20, 30, 45, 60, 75, 90].map((m) => <Chip key={m} selected={a.sessionMinutes === m} onClick={() => set("sessionMinutes", m)}>{m} min</Chip>)}</div>
      </Section>
      <Section title="¿Qué ejercicios ya conoces?" hint="Opcional. Nos ayuda a ajustar las explicaciones.">
        <div className="flex flex-wrap gap-2">{KNOWN.map((k) => <Chip key={k} selected={a.knownExercises.includes(k)} onClick={() => set("knownExercises", toggle(a.knownExercises, k))}>{k}</Chip>)}</div>
      </Section>
      <Section title="¿Hay movimientos que no te gustan o no puedes hacer?" hint="Los evitaremos al generar tu plan.">
        <div className="flex flex-wrap gap-2">{DISLIKE_PATTERNS.map((d) => <Chip key={d.key} selected={a.dislikedExercises.includes(d.key)} onClick={() => set("dislikedExercises", toggle(a.dislikedExercises, d.key))}>{d.label}</Chip>)}</div>
      </Section>
    </>
  );
}

const GYM_DEFAULT: Equipment[] = ["dumbbells", "barbell", "machines", "cables", "bench", "cardio_machine", "pullup_bar"];

function EnvironmentStep({ a, set, toggle, errors }: { a: Answers; set: SetFn; toggle: ToggleFn; errors: Record<string, string> }) {
  const pick = (env: TrainingEnvironment) => {
    set("environment", env);
    if (env === "gym" && a.equipment.length === 0) set("equipment", GYM_DEFAULT);
    if (env === "home_none") set("equipment", []);
  };
  return (
    <>
      <Section title="¿Dónde entrenas?" error={errors.environment}>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {(Object.keys(ENVIRONMENT_LABELS) as TrainingEnvironment[]).map((e) => <OptionCard key={e} selected={a.environment === e} onClick={() => pick(e)} title={ENVIRONMENT_LABELS[e]} />)}
        </div>
      </Section>
      {a.environment !== "home_none" && (
        <Section title="¿Qué equipo tienes disponible?" hint="El peso corporal siempre está incluido.">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(EQUIPMENT_LABELS) as Equipment[]).filter((e) => e !== "bodyweight").map((e) => (
              <Chip key={e} selected={a.equipment.includes(e)} onClick={() => set("equipment", toggle(a.equipment, e))}>{EQUIPMENT_LABELS[e]}</Chip>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

function LifestyleStep({ a, set, toggle, errors }: { a: Answers; set: SetFn; toggle: ToggleFn; errors: Record<string, string> }) {
  const daysMismatch = a.preferredDays.length > 0 && a.preferredDays.length !== a.daysPerWeek;
  return (
    <>
      <Section title="Actividad diaria general" error={errors.activityLevel}>
        <div className="grid gap-2.5">
          {(Object.keys(ACTIVITY_FACTORS) as ActivityLevel[]).map((k) => <OptionCard key={k} selected={a.activityLevel === k} onClick={() => set("activityLevel", k)} title={ACTIVITY_FACTORS[k].label} />)}
        </div>
      </Section>
      <Card className="grid gap-4 sm:grid-cols-2">
        <Field label="Pasos diarios aproximados" optional htmlFor="steps" error={errors.dailySteps}>
          <Input id="steps" type="number" inputMode="numeric" value={a.dailySteps} onChange={(e) => set("dailySteps", e.target.value)} />
        </Field>
        <Field label="Tu trabajo es…" htmlFor="occ">
          <Select id="occ" value={a.occupation} onChange={(e) => set("occupation", e.target.value as Answers["occupation"])}>
            <option value="">Elige una opción</option><option value="sitting">Mayormente sentado</option><option value="mixed">Mixto</option><option value="physical">Físicamente exigente</option>
          </Select>
        </Field>
        <Field label={`Horas de sueño habituales: ${a.sleepHours} h`} htmlFor="sleep">
          <input id="sleep" type="range" min={3} max={11} step={0.5} value={a.sleepHours} onChange={(e) => set("sleepHours", Number(e.target.value))} className="w-full accent-[rgb(var(--primary-strong))]" />
        </Field>
        <Field label="Horario preferido" htmlFor="time">
          <Select id="time" value={a.preferredTime} onChange={(e) => set("preferredTime", e.target.value as Answers["preferredTime"])}>
            <option value="morning">Mañana</option><option value="midday">Mediodía</option><option value="evening">Tarde o noche</option><option value="flexible">Flexible</option>
          </Select>
        </Field>
      </Card>
      <Section title="Días preferidos para entrenar" hint={`Elige ${a.daysPerWeek} días o déjalo vacío y los repartimos por ti.`}>
        <div className="flex flex-wrap gap-2">{WEEKDAYS_SHORT.map((d, i) => <Chip key={d} selected={a.preferredDays.includes(i)} onClick={() => set("preferredDays", toggle(a.preferredDays, i))}>{d}</Chip>)}</div>
        {daysMismatch && <p className="text-xs text-warning">Elegiste {a.preferredDays.length} días y entrenarás {a.daysPerWeek}. Si no coinciden, repartiremos los días automáticamente.</p>}
      </Section>
      <Section title="Nivel de estrés reciente" hint="Opcional. Ayuda a estimar tu recuperación.">
        <div className="flex flex-wrap gap-2">
          {["Muy bajo", "Bajo", "Medio", "Alto", "Muy alto"].map((l, i) => <Chip key={l} selected={a.stressLevel === i + 1} onClick={() => set("stressLevel", a.stressLevel === i + 1 ? null : i + 1)}>{l}</Chip>)}
        </div>
      </Section>
      <Field label="Deportes o actividades que ya practicas" optional htmlFor="sports">
        <Input id="sports" maxLength={120} value={a.sports} onChange={(e) => set("sports", e.target.value)} placeholder="Ej.: fútbol los sábados, bicicleta al trabajo" />
      </Field>
    </>
  );
}

function HealthStep({ a, setHealth, toggle, errors }: { a: Answers; setHealth: (p: Partial<HealthAnswers>) => void; toggle: ToggleFn; errors: Record<string, string> }) {
  const h = a.health;
  const urgent = isUrgent(h.redFlags ?? []);
  return (
    <>
      <Notice title="Antes de seguir">
        My Gym/Sis no es una herramienta de diagnóstico médico ni sustituye a profesionales de la salud. Todas las preguntas de esta sección son opcionales:
        las usamos solo para adaptar o evitar ejercicios y no se comparten con terceros.
      </Notice>
      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-[rgb(var(--primary-strong))]" checked={!!h.acknowledgedDisclaimer} onChange={(e) => setHealth({ acknowledgedDisclaimer: e.target.checked })} />
        <span>Entiendo el aviso y doy mi consentimiento para que la app use estos datos de salud para personalizar mi plan.</span>
      </label>
      {errors.disclaimer && <p role="alert" className="text-xs font-medium text-danger">{errors.disclaimer}</p>}

      <Section title="¿Tienes lesiones o zonas con molestias?" hint="Evitaremos ejercicios que las carguen de forma notable.">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(JOINT_LABELS) as JointArea[]).map((j) => <Chip key={j} selected={(h.limitations ?? []).includes(j)} onClick={() => setHealth({ limitations: toggle(h.limitations ?? [], j) })}>{JOINT_LABELS[j]}</Chip>)}
        </div>
        <Textarea aria-label="Detalles de lesiones" placeholder="Detalles opcionales (solo para ti, no se envían al coach)" maxLength={300} value={h.injuriesNotes ?? ""} onChange={(e) => setHealth({ injuriesNotes: e.target.value })} />
      </Section>

      <Card className="space-y-1 divide-y divide-border">
        <Toggle label="Tengo una condición crónica que podría afectar el ejercicio" description="Por ejemplo cardiovascular, respiratoria, metabólica o articular." checked={!!h.chronicConditions} onChange={(v) => setHealth({ chronicConditions: v })} />
        <Toggle label="Un profesional me indicó restricciones de actividad física" checked={!!h.medicalRestriction} onChange={(v) => setHealth({ medicalRestriction: v })} />
        <Toggle label="Siento dolor o molestias cuando hago ejercicio" checked={!!h.painDuringExercise} onChange={(v) => setHealth({ painDuringExercise: v })} />
      </Card>

      <Section title="Embarazo o posparto" hint="Solo si aplica y quieres indicarlo.">
        <div className="flex flex-wrap gap-2">
          {([["none", "No aplica"], ["pregnant", "Embarazo"], ["postpartum", "Posparto"], ["prefer_not", "Prefiero no decirlo"]] as const).map(([k, l]) => (
            <Chip key={k} selected={(h.pregnancyStatus ?? "none") === k} onClick={() => setHealth({ pregnancyStatus: k })}>{l}</Chip>
          ))}
        </div>
      </Section>

      <Section title="¿Has tenido alguno de estos síntomas al hacer ejercicio?" hint="Marca solo si te ha pasado.">
        <div className="space-y-2">
          {RED_FLAGS.map((f) => (
            <label key={f.key} className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[rgb(var(--primary-strong))]" checked={(h.redFlags ?? []).includes(f.key)} onChange={() => setHealth({ redFlags: toggle(h.redFlags ?? [], f.key) })} />
              {f.label}
            </label>
          ))}
        </div>
        {urgent && (
          <Notice tone="danger" title="Busca evaluación médica antes de entrenar">
            Estos síntomas necesitan una valoración profesional. Pausaremos las recomendaciones de entrenamiento hasta que actualices tu estado en Ajustes
            después de que un profesional te autorice. Si los síntomas son intensos ahora, llama a la línea de emergencias de tu país.
          </Notice>
        )}
      </Section>

      <Section title="¿Has tenido un trastorno de la conducta alimentaria?" hint="Opcional. Si respondes que sí, no mostraremos cifras de calorías ni propondremos déficit, y te sugeriremos apoyo profesional.">
        <div className="flex flex-wrap gap-2">
          <Chip selected={h.edHistory === false} onClick={() => setHealth({ edHistory: false })}>No</Chip>
          <Chip selected={h.edHistory === true} onClick={() => setHealth({ edHistory: true })}>Sí</Chip>
          <Chip selected={h.edHistory === null || h.edHistory === undefined} onClick={() => setHealth({ edHistory: null })}>Prefiero no responder</Chip>
        </div>
      </Section>
    </>
  );
}

const CUISINES: { key: CuisineStyle; label: string }[] = [
  { key: "colombian", label: "Colombiana" }, { key: "latin", label: "Latinoamericana" }, { key: "mediterranean", label: "Mediterránea" }, { key: "international", label: "Internacional" },
];

function NutritionStep({ a, set, toggle }: { a: Answers; set: SetFn; toggle: ToggleFn }) {
  return (
    <>
      <Section title="Tipo de alimentación">
        <div className="flex flex-wrap gap-2">
          {([["omnivore", "Omnívora"], ["vegetarian", "Vegetariana"], ["vegan", "Vegana"], ["pescatarian", "Pescetariana"]] as const).map(([k, l]) => <Chip key={k} selected={a.diet === k} onClick={() => set("diet", k)}>{l}</Chip>)}
        </div>
      </Section>
      <Section title="Alergias e intolerancias" hint="Nunca te propondremos recetas que las contengan.">
        <div className="flex flex-wrap gap-2">{ALLERGENS.map((x) => <Chip key={x.key} selected={a.allergens.includes(x.key)} onClick={() => set("allergens", toggle(a.allergens, x.key))}>{x.label}</Chip>)}</div>
      </Section>
      <Field label="Alimentos que no te gustan" optional htmlFor="dislikes" hint="Sepáralos con comas. Ej.: hígado, berenjena, atún">
        <Input id="dislikes" value={a.dislikes} onChange={(e) => set("dislikes", e.target.value)} />
      </Field>
      <Card className="grid gap-4 sm:grid-cols-2">
        <Field label="Patrón de alimentación" htmlFor="pattern">
          <Select id="pattern" value={a.eatingPattern} onChange={(e) => set("eatingPattern", e.target.value)}>
            <option value="regular">Comidas regulares</option><option value="intermittent_fasting">Ayuno intermitente</option>
            <option value="flexible">Flexible</option><option value="other">Otro</option>
          </Select>
        </Field>
        <Field label="Comidas al día" htmlFor="meals">
          <Select id="meals" value={a.mealsPerDay} onChange={(e) => set("mealsPerDay", Number(e.target.value))}>
            {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </Field>
        <Field label="Presupuesto para comida" htmlFor="budget">
          <Select id="budget" value={a.budget} onChange={(e) => set("budget", e.target.value as BudgetLevel)}>
            <option value="low">Ajustado</option><option value="medium">Medio</option><option value="high">Amplio</option>
          </Select>
        </Field>
        <Field label="Tiempo para cocinar por comida" htmlFor="cook">
          <Select id="cook" value={a.cookingMinutes} onChange={(e) => set("cookingMinutes", Number(e.target.value))}>
            {[10, 15, 20, 30, 45, 60].map((n) => <option key={n} value={n}>{n} min</option>)}
          </Select>
        </Field>
      </Card>
      <Section title="Estilo de cocina preferido">
        <div className="flex flex-wrap gap-2">{CUISINES.map((c) => <Chip key={c.key} selected={a.cuisines.includes(c.key)} onClick={() => set("cuisines", toggle(a.cuisines, c.key))}>{c.label}</Chip>)}</div>
      </Section>
      <Toggle label="Quiero planes para cocinar por adelantado (meal prep)" description="Repetimos almuerzos y cenas en bloques de 3 días." checked={a.wantsMealPrep} onChange={(v) => set("wantsMealPrep", v)} />
    </>
  );
}

function BodyStep({ a, set }: { a: Answers; set: SetFn }) {
  const bt = a.bodyType;
  const result = bt.wantsClassification && Object.keys(bt.answers ?? {}).length === BODY_TYPE_QUESTIONS.length ? classifyBodyType(bt.answers) : null;
  return (
    <>
      <Notice title="Esta sección es opcional">{BODY_TYPE_DISCLAIMER}</Notice>
      <Toggle label="Quiero ver la clasificación tradicional (orientativa)" checked={!!bt.wantsClassification}
        onChange={(v) => set("bodyType", { ...bt, wantsClassification: v })} />
      {bt.wantsClassification && (
        <div className="space-y-4">
          {BODY_TYPE_QUESTIONS.map((q) => (
            <Section key={q.id} title={q.text}>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(q.options) as ("a" | "b" | "c")[]).map((k) => (
                  <Chip key={k} selected={bt.answers?.[q.id] === k} onClick={() => set("bodyType", { ...bt, answers: { ...(bt.answers ?? {}), [q.id]: k } })}>{q.options[k]}</Chip>
                ))}
              </div>
            </Section>
          ))}
          {result && (
            <Card>
              <Badge tone="primary">Interpretación tentativa</Badge>
              <p className="mt-2 text-lg font-semibold">{BODY_TYPE_INFO[result].name}</p>
              <p className="text-sm text-muted">{BODY_TYPE_INFO[result].text} No la usamos para calcular calorías ni elegir ejercicios.</p>
            </Card>
          )}
        </div>
      )}
    </>
  );
}

function CycleStep({ a, set, toggle, errors }: { a: Answers; set: SetFn; toggle: ToggleFn; errors: Record<string, string> }) {
  const c = a.cycle;
  const setC = (patch: Partial<Answers["cycle"]>) => set("cycle", { ...c, ...patch });
  return (
    <>
      <p className="text-muted">
        Cycle Wellness es opcional y está pensado para quienes menstrúan y quieren registrar síntomas, energía y fechas. Puedes saltarlo y activarlo después en Ajustes.
      </p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <OptionCard selected={a.cycleEnabled === true} onClick={() => set("cycleEnabled", true)} icon={<Moon className="h-5 w-5" />} title="Sí, quiero activarlo" description="Registro de síntomas y sugerencias opcionales." />
        <OptionCard selected={a.cycleEnabled === false} onClick={() => set("cycleEnabled", false)} icon={<Sun className="h-5 w-5" />} title="No, gracias" description="No se pedirá ni guardará información del ciclo." />
      </div>
      {a.cycleEnabled && (
        <div className="space-y-5">
          <Card className="grid gap-4 sm:grid-cols-2">
            <Field label="Primer día de tu último periodo" htmlFor="lmp" error={errors.lastPeriod}>
              <Input id="lmp" type="date" max={todayISO()} disabled={a.lastPeriodUnknown} value={c.last_period_start ?? ""} onChange={(e) => setC({ last_period_start: e.target.value || null })} />
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--primary-strong))]" checked={a.lastPeriodUnknown} onChange={(e) => set("lastPeriodUnknown", e.target.checked)} />
                No lo recuerdo
              </label>
            </Field>
            <Field label="Duración típica del ciclo (días)" optional htmlFor="clen" error={errors.cycleLength} hint="Déjalo vacío si no lo sabes. No asumimos 28 días.">
              <Input id="clen" type="number" min={15} max={60} value={c.typical_cycle_length ?? ""} onChange={(e) => setC({ typical_cycle_length: e.target.value ? Number(e.target.value) : null })} />
            </Field>
            <Field label="Duración del sangrado (días)" htmlFor="plen">
              <Input id="plen" type="number" min={1} max={10} value={c.typical_period_length ?? ""} onChange={(e) => setC({ typical_period_length: e.target.value ? Number(e.target.value) : null })} />
            </Field>
            <Field label="Regularidad" htmlFor="reg">
              <Select id="reg" value={c.regularity} onChange={(e) => setC({ regularity: e.target.value as CycleSettingsRow["regularity"] })}>
                <option value="regular">Bastante regular</option><option value="irregular">Irregular</option><option value="unknown">No lo sé</option>
              </Select>
            </Field>
          </Card>
          <Card className="divide-y divide-border">
            <Toggle label="Uso anticoncepción hormonal" description="En ese caso no estimamos fases y nos guiamos por tus síntomas." checked={c.hormonal_contraception} onChange={(v) => setC({ hormonal_contraception: v })} />
            <Toggle label="Quiero ver fases estimadas" description="Si lo desactivas, solo registramos fechas y síntomas." checked={c.wants_phase_estimates} onChange={(v) => setC({ wants_phase_estimates: v })} />
          </Card>
          <Section title="Durante el periodo prefiero…">
            <div className="flex flex-wrap gap-2">
              {([["as_usual", "Entrenar como siempre"], ["lighter", "Sesiones más ligeras"], ["decide_daily", "Decidir cada día"]] as const).map(([k, l]) => (
                <Chip key={k} selected={c.period_training_preference === k} onClick={() => setC({ period_training_preference: k })}>{l}</Chip>
              ))}
            </div>
          </Section>
          <Section title="¿Cómo te sientes hoy?" hint="Opcional: síntomas y energía de hoy.">
            <div className="flex flex-wrap gap-2">{SYMPTOMS.map((s) => <Chip key={s.key} selected={a.cycleSymptoms.includes(s.key)} onClick={() => set("cycleSymptoms", toggle(a.cycleSymptoms, s.key))}>{s.label}</Chip>)}</div>
            <div className="flex flex-wrap gap-2 pt-1">
              {[1, 2, 3, 4, 5].map((n) => <Chip key={n} selected={a.cycleEnergy === n} onClick={() => set("cycleEnergy", a.cycleEnergy === n ? null : n)}>Energía {n}/5</Chip>)}
            </div>
          </Section>
          <p className="text-xs text-muted">{CYCLE_DISCLAIMER}</p>
        </div>
      )}
    </>
  );
}

function ConfirmStep({ a }: { a: Answers }) {
  const rows: [string, ReactNode][] = useMemo(() => [
    ["Experiencia", THEME_OPTIONS.find((t) => t.key === a.theme)?.title],
    ["Objetivo principal", a.goals[0] ? GOAL_LABELS[a.goals[0]] : "—"],
    ["Otros objetivos", a.goals.slice(1).map((g) => GOAL_LABELS[g]).join(", ") || "—"],
    ["Nivel", a.level ? LEVEL_LABELS[a.level] : "—"],
    ["Entrenamiento", `${a.daysPerWeek} días por semana · ${a.sessionMinutes} min`],
    ["Lugar", a.environment ? ENVIRONMENT_LABELS[a.environment] : "—"],
    ["Equipo", a.equipment.map((e) => EQUIPMENT_LABELS[e]).join(", ") || "Peso corporal"],
    ["Zonas a cuidar", (a.health.limitations ?? []).map((j) => JOINT_LABELS[j]).join(", ") || "Ninguna"],
    ["Alimentación", `${a.diet === "omnivore" ? "Omnívora" : a.diet === "vegan" ? "Vegana" : a.diet === "vegetarian" ? "Vegetariana" : "Pescetariana"} · ${a.mealsPerDay} comidas`],
    ["Cycle Wellness", a.cycleEnabled ? "Activado" : "Desactivado"],
  ], [a]);
  return (
    <>
      <p className="text-muted">Revisa tus respuestas. Puedes volver atrás para cambiarlas o editarlas más tarde en Ajustes.</p>
      <Card>
        <dl className="divide-y divide-border">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2.5 text-sm">
              <dt className="text-muted">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Notice>Con estos datos generaremos tu plan semanal de entrenamiento y tus estimaciones de nutrición. Todo se puede ajustar después.</Notice>
    </>
  );
}
