import { CalendarHeart, ChevronRight, Download, Library, LogOut, Star, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { applyTheme, useBundle, useUserData } from "@/app/providers";
import { Button, Card, CardHeader, Chip, Field, Input, Modal, Notice, PageHeader, Select, Toggle, cx } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { ageFromBirthDate, todayISO } from "@/lib/dates";
import { ENVIRONMENT_LABELS, EQUIPMENT_LABELS, JOINT_LABELS, LEVEL_LABELS } from "@/lib/labels";
import { GOAL_LABELS } from "@/lib/userBundle";
import { errorMessage } from "@/lib/useAsync";
import { db } from "@/services/data";
import { generatorInputFromBundle } from "@/services/derived";
import {
  deleteAllMyData, exportMyData, loadUserBundle, saveGoals, saveNutritionPrefs, saveOnboardingSection, updateProfile, updateSettings,
} from "@/services/profile";
import { regeneratePlan } from "@/services/workouts";
import { RED_FLAGS } from "../../../supabase/functions/_shared/safety.ts";
import type { HealthAnswers } from "@/types/db";
import type { Allergen, BiologicalSex, BudgetLevel, DietPattern, Equipment, FitnessLevel, GoalKey, JointArea, ThemeName, TrainingEnvironment, Units } from "@/types/domain";

function Section({ id, title, subtitle, children }: { id: string; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-20">
      <CardHeader title={title} subtitle={subtitle} />
      {children}
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Perfil y ajustes" />
      <QuickLinks />
      <ProfileSection />
      <ThemeSection />
      <TrainingSection />
      <HealthSection />
      <NutritionSection />
      <FeaturesSection />
      <AccountSection />
    </div>
  );
}

function QuickLinks() {
  const bundle = useBundle();
  const links = [
    { to: "/exercises", label: "Biblioteca de ejercicios", icon: Library },
    ...(bundle.settings.cycle_tracking_enabled ? [{ to: "/cycle", label: "Cycle Wellness", icon: CalendarHeart }] : []),
  ];
  return (
    <Card className="p-2 md:hidden">
      <ul>
        {links.map(({ to, label, icon: Icon }) => (
          <li key={to}><Link to={to} className="flex items-center gap-3 rounded-full px-4 py-3 font-medium hover:bg-surface-2"><Icon className="h-5 w-5 text-primary-strong" /> {label}<ChevronRight className="ml-auto h-4 w-4 text-muted" /></Link></li>
        ))}
      </ul>
    </Card>
  );
}

function useSaver() {
  const { refresh } = useUserData();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const run = async (fn: () => Promise<void>, message = "Cambios guardados") => {
    setSaving(true);
    try {
      await fn();
      await refresh();
      toast(message);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  };
  return { saving, run };
}

function ProfileSection() {
  const { profile } = useBundle();
  const { saving, run } = useSaver();
  const [f, setF] = useState({
    display_name: profile.display_name, birth_date: profile.birth_date ?? "", height_cm: String(profile.height_cm ?? ""), weight_kg: String(profile.weight_kg ?? ""),
    target_weight_kg: profile.target_weight_kg ? String(profile.target_weight_kg) : "", country: profile.country ?? "", units: profile.units, language: profile.language,
    sex: (profile.sex ?? "") as BiologicalSex | "", gender_identity: profile.gender_identity ?? "",
  });
  const errors: Record<string, string> = {};
  if (!f.display_name.trim()) errors.display_name = "Escribe tu nombre.";
  const age = ageFromBirthDate(f.birth_date || null);
  if (!f.birth_date || age === null || age < 13 || age > 100) errors.birth_date = "Revisa la fecha (13 años o más).";
  if (!(Number(f.height_cm) >= 100 && Number(f.height_cm) <= 250)) errors.height_cm = "Entre 100 y 250 cm.";
  if (!(Number(f.weight_kg) >= 25 && Number(f.weight_kg) <= 350)) errors.weight_kg = "Entre 25 y 350 kg.";
  if (f.target_weight_kg && !(Number(f.target_weight_kg) >= 25 && Number(f.target_weight_kg) <= 350)) errors.target_weight_kg = "Entre 25 y 350 kg.";
  const valid = Object.keys(errors).length === 0;
  return (
    <Section id="perfil" title="Datos personales">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" htmlFor="p-name" error={errors.display_name}><Input id="p-name" value={f.display_name} maxLength={50} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></Field>
        <Field label="Fecha de nacimiento" htmlFor="p-birth" error={errors.birth_date}><Input id="p-birth" type="date" max={todayISO()} value={f.birth_date} onChange={(e) => setF({ ...f, birth_date: e.target.value })} /></Field>
        <Field label="Estatura (cm)" htmlFor="p-h" error={errors.height_cm}><Input id="p-h" type="number" value={f.height_cm} onChange={(e) => setF({ ...f, height_cm: e.target.value })} /></Field>
        <Field label="Peso actual (kg)" htmlFor="p-w" error={errors.weight_kg}><Input id="p-w" type="number" step="0.1" value={f.weight_kg} onChange={(e) => setF({ ...f, weight_kg: e.target.value })} /></Field>
        <Field label="Peso objetivo (kg)" optional htmlFor="p-t" error={errors.target_weight_kg}><Input id="p-t" type="number" step="0.1" value={f.target_weight_kg} onChange={(e) => setF({ ...f, target_weight_kg: e.target.value })} /></Field>
        <Field label="País" htmlFor="p-c"><Input id="p-c" value={f.country} maxLength={60} onChange={(e) => setF({ ...f, country: e.target.value })} /></Field>
        <Field label="Unidades" htmlFor="p-u"><Select id="p-u" value={f.units} onChange={(e) => setF({ ...f, units: e.target.value as Units })}><option value="metric">Métricas (kg)</option><option value="imperial">Imperiales (lb)</option></Select></Field>
        <Field label="Idioma del coach" htmlFor="p-l"><Select id="p-l" value={f.language} onChange={(e) => setF({ ...f, language: e.target.value as "es" | "en" })}><option value="es">Español</option><option value="en">English</option></Select></Field>
        <Field label="Sexo biológico" htmlFor="p-s"><Select id="p-s" value={f.sex} onChange={(e) => setF({ ...f, sex: e.target.value as BiologicalSex | "" })}><option value="" disabled>Selecciona</option><option value="female">Mujer</option><option value="male">Hombre</option></Select></Field>
        <Field label="Identidad de género" optional htmlFor="p-g"><Input id="p-g" maxLength={50} value={f.gender_identity} onChange={(e) => setF({ ...f, gender_identity: e.target.value })} /></Field>
      </div>
      <Button className="mt-4" disabled={!valid} loading={saving} onClick={() => run(async () => {
        await updateProfile({
          display_name: f.display_name.trim(), birth_date: f.birth_date, height_cm: Number(f.height_cm), weight_kg: Number(f.weight_kg),
          target_weight_kg: f.target_weight_kg ? Number(f.target_weight_kg) : null, country: f.country.trim() || null, units: f.units, language: f.language,
          sex: f.sex || null, gender_identity: f.gender_identity.trim() || null,
        });
        // El seguimiento del ciclo solo aplica a mujeres.
        if (f.sex !== "female") await updateSettings({ cycle_tracking_enabled: false });
      })}>Guardar datos</Button>
    </Section>
  );
}

function ThemeSection() {
  const { profile } = useBundle();
  const { run } = useSaver();
  const options: { key: ThemeName; label: string; swatch: string[] }[] = [
    { key: "sis", label: "My Gym/Sis", swatch: ["#C93A62", "#F7927F", "#FFD3DF", "#FFD678"] },
    { key: "bro", label: "Gym Bro", swatch: ["#000000", "#161619", "#F0F1F3", "#D3E496"] },
    { key: "neutral", label: "Neutro", swatch: ["#6D3FF0", "#FF4D7A", "#FFD23F", "#35D68A"] },
  ];
  return (
    <Section id="tema" title="Apariencia" subtitle="El tema solo cambia el diseño. Tu plan no depende de él.">
      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((o) => (
          <button key={o.key} type="button" aria-pressed={profile.theme === o.key}
            onClick={() => { applyTheme(o.key); void run(() => updateProfile({ theme: o.key }), `Tema ${o.label} activado`); }}
            className={cx("rounded-2xl border p-3 text-left", profile.theme === o.key ? "border-primary-strong ring-2 ring-primary/30" : "border-border hover:bg-surface-2")}>
            <div className="flex h-8 overflow-hidden rounded-lg">{o.swatch.map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}</div>
            <p className="mt-2 font-semibold">{o.label}</p>
          </button>
        ))}
      </div>
    </Section>
  );
}

function TrainingSection() {
  const bundle = useBundle();
  const { saving, run } = useSaver();
  const f = bundle.onboarding?.fitness ?? {};
  const env = bundle.onboarding?.environment ?? {};
  const [goals, setGoals] = useState<GoalKey[]>(bundle.goals.map((g) => g.goal));
  const [level, setLevel] = useState<FitnessLevel>(f.level ?? "beginner");
  const [days, setDays] = useState(f.daysPerWeek ?? 3);
  const [minutes, setMinutes] = useState(f.sessionMinutes ?? 45);
  const [environment, setEnvironment] = useState<TrainingEnvironment>(env.environment ?? "home_none");
  const [equipment, setEquipment] = useState<Equipment[]>(env.equipment ?? []);
  const [regen, setRegen] = useState(true);
  const toggle = <T,>(xs: T[], v: T) => (xs.includes(v) ? xs.filter((x) => x !== v) : [...xs, v]);
  return (
    <Section id="entrenamiento" title="Objetivos y entrenamiento">
      <p className="mb-2 text-sm font-medium">Objetivos (el primero es el principal)</p>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(GOAL_LABELS) as GoalKey[]).map((g) => (
          <Chip key={g} selected={goals.includes(g)} onClick={() => setGoals(goals.includes(g) ? goals.filter((x) => x !== g) : [...goals, g])}>
            {goals[0] === g && <Star className="h-3.5 w-3.5 fill-current" />}{GOAL_LABELS[g]}
          </Chip>
        ))}
      </div>
      {goals.length > 1 && (
        <Field label="Objetivo principal" htmlFor="t-main">
          <Select id="t-main" value={goals[0]} onChange={(e) => setGoals([e.target.value as GoalKey, ...goals.filter((x) => x !== e.target.value)])} className="mt-2">
            {goals.map((g) => <option key={g} value={g}>{GOAL_LABELS[g]}</option>)}
          </Select>
        </Field>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Nivel" htmlFor="t-level"><Select id="t-level" value={level} onChange={(e) => setLevel(e.target.value as FitnessLevel)}>{(Object.keys(LEVEL_LABELS) as FitnessLevel[]).map((k) => <option key={k} value={k}>{LEVEL_LABELS[k]}</option>)}</Select></Field>
        <Field label="Lugar" htmlFor="t-env"><Select id="t-env" value={environment} onChange={(e) => setEnvironment(e.target.value as TrainingEnvironment)}>{(Object.keys(ENVIRONMENT_LABELS) as TrainingEnvironment[]).map((k) => <option key={k} value={k}>{ENVIRONMENT_LABELS[k]}</option>)}</Select></Field>
        <Field label="Días por semana" htmlFor="t-days"><Select id="t-days" value={days} onChange={(e) => setDays(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{d}</option>)}</Select></Field>
        <Field label="Minutos por sesión" htmlFor="t-min"><Select id="t-min" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>{[20, 30, 45, 60, 75, 90].map((m) => <option key={m} value={m}>{m}</option>)}</Select></Field>
      </div>
      <p className="mb-2 mt-4 text-sm font-medium">Equipo disponible</p>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(EQUIPMENT_LABELS) as Equipment[]).filter((e) => e !== "bodyweight").map((e) => <Chip key={e} selected={equipment.includes(e)} onClick={() => setEquipment(toggle(equipment, e))}>{EQUIPMENT_LABELS[e]}</Chip>)}
      </div>
      <div className="mt-3"><Toggle label="Regenerar mi plan con estos cambios" checked={regen} onChange={setRegen} /></div>
      <Button className="mt-2" disabled={goals.length === 0} loading={saving} onClick={() => run(async () => {
        await saveGoals(goals, bundle.goals[0]?.target_weeks ?? null);
        await saveOnboardingSection({ fitness: { ...f, level, daysPerWeek: days, sessionMinutes: minutes }, environment: { environment, equipment } });
        if (regen) await regeneratePlan(generatorInputFromBundle(await loadUserBundle()));
      }, regen ? "Guardado y plan regenerado" : "Cambios guardados")}>Guardar</Button>
    </Section>
  );
}

function HealthSection() {
  const bundle = useBundle();
  const { saving, run } = useSaver();
  const [h, setH] = useState<HealthAnswers>(bundle.onboarding?.health ?? {});
  const toggle = <T,>(xs: T[], v: T) => (xs.includes(v) ? xs.filter((x) => x !== v) : [...xs, v]);
  return (
    <Section id="salud" title="Salud y seguridad" subtitle="Datos privados. Solo los usamos para adaptar tu plan.">
      <p className="mb-2 text-sm font-medium">Zonas a cuidar</p>
      <div className="flex flex-wrap gap-2">{(Object.keys(JOINT_LABELS) as JointArea[]).map((j) => <Chip key={j} selected={(h.limitations ?? []).includes(j)} onClick={() => setH({ ...h, limitations: toggle(h.limitations ?? [], j) })}>{JOINT_LABELS[j]}</Chip>)}</div>
      <div className="mt-3 divide-y divide-border">
        <Toggle label="Condición crónica relevante" checked={!!h.chronicConditions} onChange={(v) => setH({ ...h, chronicConditions: v })} />
        <Toggle label="Restricción médica de actividad" checked={!!h.medicalRestriction} onChange={(v) => setH({ ...h, medicalRestriction: v })} />
        <Toggle label="Siento dolor al entrenar" checked={!!h.painDuringExercise} onChange={(v) => setH({ ...h, painDuringExercise: v })} />
      </div>
      {bundle.profile.sex === "female" && (
        <Field label="Embarazo o posparto" htmlFor="h-preg">
          <Select id="h-preg" value={h.pregnancyStatus ?? "none"} onChange={(e) => setH({ ...h, pregnancyStatus: e.target.value as HealthAnswers["pregnancyStatus"] })}>
            <option value="none">No aplica</option><option value="pregnant">Embarazo</option><option value="postpartum">Posparto</option><option value="prefer_not">Prefiero no decirlo</option>
          </Select>
        </Field>
      )}
      <p className="mb-2 mt-4 text-sm font-medium">Síntomas de alarma reportados</p>
      <div className="space-y-1.5 text-sm">
        {RED_FLAGS.map((f) => (
          <label key={f.key} className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={(h.redFlags ?? []).includes(f.key)} onChange={() => setH({ ...h, redFlags: toggle(h.redFlags ?? [], f.key) })} />
            {f.label}
          </label>
        ))}
      </div>
      {(bundle.onboarding?.health?.redFlags ?? []).length > 0 && <div className="mt-2"><Notice>Desmarca los síntomas solo cuando un profesional de la salud te haya autorizado a entrenar.</Notice></div>}
      <Field label="Antecedentes de trastorno de la conducta alimentaria" htmlFor="h-ed">
        <Select id="h-ed" value={h.edHistory === true ? "yes" : h.edHistory === false ? "no" : "skip"} onChange={(e) => setH({ ...h, edHistory: e.target.value === "yes" ? true : e.target.value === "no" ? false : null })}>
          <option value="no">No</option><option value="yes">Sí</option><option value="skip">Prefiero no responder</option>
        </Select>
      </Field>
      <Button className="mt-4" loading={saving} onClick={() => run(async () => {
        await saveOnboardingSection({ health: { ...h, acknowledgedDisclaimer: true } });
        await regeneratePlan(generatorInputFromBundle(await loadUserBundle()));
      }, "Guardado y plan ajustado")}>Guardar y ajustar plan</Button>
    </Section>
  );
}

const ALLERGENS: { key: Allergen; label: string }[] = [
  { key: "gluten", label: "Gluten" }, { key: "lactose", label: "Lactosa" }, { key: "eggs", label: "Huevo" }, { key: "nuts", label: "Frutos secos" },
  { key: "peanuts", label: "Maní" }, { key: "soy", label: "Soya" }, { key: "fish", label: "Pescado" }, { key: "shellfish", label: "Mariscos" },
];

function NutritionSection() {
  const bundle = useBundle();
  const { saving, run } = useSaver();
  const n = bundle.nutrition;
  const [diet, setDiet] = useState<DietPattern>(n?.diet ?? "omnivore");
  const [allergens, setAllergens] = useState<Allergen[]>(n?.allergens ?? []);
  const [dislikes, setDislikes] = useState((n?.dislikes ?? []).join(", "));
  const [meals, setMeals] = useState(n?.meals_per_day ?? 4);
  const [budget, setBudget] = useState<BudgetLevel>(n?.budget ?? "medium");
  const [cooking, setCooking] = useState(n?.cooking_minutes ?? 30);
  const [prep, setPrep] = useState(n?.wants_meal_prep ?? false);
  return (
    <Section id="nutricion" title="Preferencias de alimentación" subtitle="Al guardar, regenera tu plan semanal desde Nutrición para aplicar los cambios.">
      <div className="flex flex-wrap gap-2">
        {([["omnivore", "Omnívora"], ["vegetarian", "Vegetariana"], ["vegan", "Vegana"], ["pescatarian", "Pescetariana"]] as const).map(([k, l]) => <Chip key={k} selected={diet === k} onClick={() => setDiet(k)}>{l}</Chip>)}
      </div>
      <p className="mb-2 mt-4 text-sm font-medium">Alergias e intolerancias</p>
      <div className="flex flex-wrap gap-2">{ALLERGENS.map((a) => <Chip key={a.key} selected={allergens.includes(a.key)} onClick={() => setAllergens(allergens.includes(a.key) ? allergens.filter((x) => x !== a.key) : [...allergens, a.key])}>{a.label}</Chip>)}</div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="No me gusta" htmlFor="n-dis" hint="Separado por comas"><Input id="n-dis" value={dislikes} onChange={(e) => setDislikes(e.target.value)} /></Field>
        <Field label="Comidas al día" htmlFor="n-meals"><Select id="n-meals" value={meals} onChange={(e) => setMeals(Number(e.target.value))}>{[2, 3, 4, 5, 6].map((x) => <option key={x}>{x}</option>)}</Select></Field>
        <Field label="Presupuesto" htmlFor="n-b"><Select id="n-b" value={budget} onChange={(e) => setBudget(e.target.value as BudgetLevel)}><option value="low">Ajustado</option><option value="medium">Medio</option><option value="high">Amplio</option></Select></Field>
        <Field label="Tiempo para cocinar" htmlFor="n-c"><Select id="n-c" value={cooking} onChange={(e) => setCooking(Number(e.target.value))}>{[10, 15, 20, 30, 45, 60].map((x) => <option key={x} value={x}>{x} min</option>)}</Select></Field>
      </div>
      <Toggle label="Meal prep" checked={prep} onChange={setPrep} />
      <Button className="mt-2" loading={saving} onClick={() => run(() => saveNutritionPrefs({
        diet, allergens, dislikes: dislikes.split(",").map((s) => s.trim()).filter(Boolean), meals_per_day: meals, budget, cooking_minutes: cooking, wants_meal_prep: prep,
        cuisines: n?.cuisines ?? ["colombian", "latin"], eating_pattern: n?.eating_pattern ?? null,
      }))}>Guardar preferencias</Button>
    </Section>
  );
}

function FeaturesSection() {
  const { settings, profile } = useBundle();
  const { run } = useSaver();
  return (
    <Section id="funciones" title="Funciones opcionales y privacidad del coach">
      <div className="divide-y divide-border">
        {profile.sex === "female" && (
          <Toggle label="Cycle Wellness" description="Registro opcional del ciclo y síntomas. Puedes desactivarlo cuando quieras." checked={settings.cycle_tracking_enabled}
            onChange={(v) => run(() => updateSettings({ cycle_tracking_enabled: v }), v ? "Cycle Wellness activado" : "Cycle Wellness desactivado")} />
        )}
        <Toggle label="Registro de agua" checked={settings.water_tracking_enabled} onChange={(v) => run(() => updateSettings({ water_tracking_enabled: v }))} />
        <Toggle label="Mostrar cifras de calorías y macros" description="Si prefieres no ver números, mostramos guías generales." checked={settings.calorie_tracking_enabled}
          onChange={(v) => run(() => updateSettings({ calorie_tracking_enabled: v }))} />
        <Toggle label="Compartir mi contexto con Gym AI Coach" description="Objetivos, plan, equipo, zonas a cuidar y progreso (sin notas médicas, peso exacto ni fotos). Si lo desactivas, el coach responde de forma general."
          checked={settings.ai_share_context} onChange={(v) => run(() => updateSettings({ ai_share_context: v }))} />
      </div>
    </Section>
  );
}

function AccountSection() {
  const navigate = useNavigate();
  const toast = useToast();
  const { refresh } = useUserData();
  const [modal, setModal] = useState<"data" | "account" | "password" | null>(null);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");

  async function exportData() {
    try {
      const blob = await exportMyData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mis-datos-${todayISO()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  return (
    <Section id="cuenta" title="Cuenta y datos">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={exportData}><Download className="h-4 w-4" /> Exportar mis datos</Button>
        <Button variant="outline" onClick={() => setModal("password")}>Cambiar contraseña</Button>
        <Button variant="outline" onClick={async () => { await db.auth.signOut(); navigate("/login", { replace: true }); }}><LogOut className="h-4 w-4" /> Cerrar sesión</Button>
      </div>
      <div className="mt-5 space-y-2 rounded-2xl border border-danger/30 p-4">
        <p className="font-semibold text-danger">Zona de borrado</p>
        <p className="text-sm text-muted">Borrar tus datos elimina entrenamientos, medidas, fotos, ciclo, comidas y conversaciones, y conserva tu cuenta. Borrar la cuenta lo elimina todo de forma permanente.</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="outline" className="text-danger" onClick={() => { setConfirm(""); setModal("data"); }}><Trash2 className="h-4 w-4" /> Borrar mis datos</Button>
          <Button variant="danger" onClick={() => { setConfirm(""); setModal("account"); }}><Trash2 className="h-4 w-4" /> Borrar mi cuenta</Button>
        </div>
      </div>

      <Modal open={modal === "data" || modal === "account"} onClose={() => setModal(null)} title={modal === "account" ? "Borrar cuenta" : "Borrar mis datos"}
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancelar</Button>
          <Button variant="danger" disabled={confirm !== "BORRAR"} loading={busy} onClick={async () => {
            setBusy(true);
            try {
              if (modal === "account") {
                await db.deleteAccount();
                navigate("/login", { replace: true });
              } else {
                await deleteAllMyData();
                await refresh();
                setModal(null);
                toast("Tus datos se borraron");
                navigate("/onboarding", { replace: true });
              }
            } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
          }}>Borrar definitivamente</Button></>}>
        <p className="text-sm">Esta acción no se puede deshacer. Escribe <strong>BORRAR</strong> para confirmar.</p>
        <Input aria-label="Escribe BORRAR para confirmar" className="mt-3" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Modal>

      <Modal open={modal === "password"} onClose={() => setModal(null)} title="Cambiar contraseña"
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancelar</Button>
          <Button loading={busy} disabled={password.length < 8 || !/\d/.test(password) || !/[A-Za-z]/.test(password)} onClick={async () => {
            setBusy(true);
            try { await db.auth.updatePassword(password); setModal(null); setPassword(""); toast("Contraseña actualizada"); } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
          }}>Guardar</Button></>}>
        <Field label="Contraseña nueva" htmlFor="np" hint="Mínimo 8 caracteres, con letras y números."><Input id="np" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      </Modal>
    </Section>
  );
}
