// Herramientas de Gym Sis y Gym Bro: tracker de suplementos con horas sugeridas y horario de comidas con déficit calórico.
import { AlarmClock, Check, Clock, Moon, Pill, Sun, Utensils } from "lucide-react";
import { useMemo, useState } from "react";
import { useBundle, useUserData } from "@/app/providers";
import { Badge, Button, Card, CardHeader, Chip, cx, ErrorState, Field, Input, Notice, PageSkeleton, ProgressBar } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { addDays, ageFromBirthDate, todayISO, weekdayIndex, WEEKDAYS_SHORT } from "@/lib/dates";
import { eatingWindow, supplementTime, SUPPLEMENTS, SUPPLEMENT_BY_KEY, windowStatus, type DayRhythm } from "@/lib/mealTiming";
import type { NutritionEstimate } from "@/lib/nutrition";
import { sumMacros } from "@/lib/nutrition";
import { addMinutes, dayStartTime, formatTime, fromMinutes, nowTime, TIME_RE, toMinutes } from "@/lib/schedule";
import { errorMessage, useAsync } from "@/lib/useAsync";
import { primaryGoal } from "@/lib/userBundle";
import { saveNutritionPrefs } from "@/services/profile";
import { listSupplementLogs, setSupplementTaken } from "@/services/tracking";
import { getActivePlan } from "@/services/workouts";
import type { MealLogRow } from "@/types/db";

const DEFAULT_WAKE = "06:30";

/** Despertar, dormir y entreno de hoy, con valores por defecto a partir del cuestionario. */
function useDayRhythm() {
  const bundle = useBundle();
  const today = todayISO();
  const { data, loading, error, reload, setData } = useAsync(async () => {
    const [plan, logs] = await Promise.all([getActivePlan(), listSupplementLogs(addDays(today, -6))]);
    return { plan, logs };
  }, [today]);
  const prefs = bundle.nutrition;
  const wake = prefs?.wake_time ?? DEFAULT_WAKE;
  const sleepHours = bundle.onboarding?.lifestyle?.sleepHours ?? 8;
  const sleep = prefs?.sleep_time ?? fromMinutes(toMinutes(wake) - sleepHours * 60);
  const todayMeta = data?.plan?.plan.schedule.find((d) => d.weekday === weekdayIndex(today)) ?? null;
  const rhythm: DayRhythm = {
    wake, sleep,
    trainingStart: todayMeta ? dayStartTime(todayMeta, bundle.onboarding?.lifestyle?.preferredTime) : null,
    trainingMinutes: todayMeta?.estimatedMinutes ?? 0,
  };
  return { rhythm, todayMeta, data, loading, error, reload, setData };
}

function RhythmCard({ rhythm, trainingTitle }: { rhythm: DayRhythm; trainingTitle: string | null }) {
  const { refresh } = useUserData();
  const toast = useToast();
  const [wake, setWake] = useState(rhythm.wake);
  const [sleep, setSleep] = useState(rhythm.sleep);
  const [saving, setSaving] = useState(false);
  const dirty = wake !== rhythm.wake || sleep !== rhythm.sleep;
  return (
    <Card className="tint-blue">
      <CardHeader title="Tu ritmo del día" subtitle="Con esto calculamos tus horarios." icon={<AlarmClock className="h-5 w-5" />} />
      <form className="grid grid-cols-2 gap-3" onSubmit={async (e) => {
        e.preventDefault();
        if (!TIME_RE.test(wake) || !TIME_RE.test(sleep)) return;
        setSaving(true);
        try {
          await saveNutritionPrefs({ wake_time: wake, sleep_time: sleep });
          await refresh();
          toast("Horario guardado");
        } catch (err) { toast(errorMessage(err), "error"); } finally { setSaving(false); }
      }}>
        <Field label="Me despierto" htmlFor="wake-time"><Input id="wake-time" type="time" value={wake} onChange={(e) => setWake(e.target.value)} required /></Field>
        <Field label="Me duermo" htmlFor="sleep-time"><Input id="sleep-time" type="time" value={sleep} onChange={(e) => setSleep(e.target.value)} required /></Field>
        <p className="col-span-2 text-sm text-muted">
          <Clock className="mr-1.5 inline h-4 w-4 align-[-3px]" aria-hidden />
          {rhythm.trainingStart
            ? <>Hoy entrenas {trainingTitle ? <strong className="text-text">{trainingTitle}</strong> : null} a las {formatTime(rhythm.trainingStart)} ({rhythm.trainingMinutes} min).</>
            : "Hoy es día de descanso."}
        </p>
        {dirty && <Button type="submit" size="sm" loading={saving} className="col-span-2 justify-self-start">Guardar horario</Button>}
      </form>
    </Card>
  );
}

const SAFETY_NOTE = "Información general, no es una prescripción. Si tomas medicamentos, tienes una condición médica o estás en embarazo o lactancia, consulta antes con un profesional de salud.";

// ---------- Suplementos ----------

export function SupplementsTab() {
  const bundle = useBundle();
  const { refresh } = useUserData();
  const toast = useToast();
  const today = todayISO();
  const { rhythm, todayMeta, data, loading, error, reload, setData } = useDayRhythm();
  const [editing, setEditing] = useState(false);
  const theme = bundle.profile.theme;
  const mine = bundle.nutrition?.supplements ?? [];
  const goal = primaryGoal(bundle);
  const win = useMemo(() => eatingWindow(goal, rhythm, bundle.nutrition?.meals_per_day ?? 4), [goal, rhythm, bundle.nutrition?.meals_per_day]);

  if (loading && !data) return <PageSkeleton />;
  if (error || !data) return <ErrorState message={error ?? "No se pudieron cargar tus suplementos."} onRetry={reload} />;

  const catalog = [...SUPPLEMENTS].sort((a, b) => Number(b.focus === theme) - Number(a.focus === theme));
  const takenToday = new Set(data.logs.filter((l) => l.logged_on === today).map((l) => l.supplement));
  const schedule = mine
    .filter((k) => SUPPLEMENT_BY_KEY[k])
    .map((k) => ({ s: SUPPLEMENT_BY_KEY[k], slot: supplementTime(k, rhythm, win) }))
    .sort((a, b) => (a.slot.time ?? "99") .localeCompare(b.slot.time ?? "99"));
  const pregnant = ["pregnant", "postpartum"].includes(bundle.onboarding?.health?.pregnancyStatus ?? "");

  async function toggleMine(key: string) {
    const next = mine.includes(key) ? mine.filter((k) => k !== key) : [...mine, key];
    try {
      await saveNutritionPrefs({ supplements: next });
      await refresh();
    } catch (e) { toast(errorMessage(e), "error"); }
  }

  async function toggleTaken(key: string) {
    const taken = !takenToday.has(key);
    try {
      const row = await setSupplementTaken(today, key, taken);
      setData((d) => d && { ...d, logs: taken && row ? [...d.logs, row] : d.logs.filter((l) => !(l.logged_on === today && l.supplement === key)) });
      if (taken) toast(`${SUPPLEMENT_BY_KEY[key].name}: tomado`);
    } catch (e) { toast(errorMessage(e), "error"); }
  }

  return (
    <div className="space-y-5">
      <Notice tone="info">{SAFETY_NOTE}</Notice>
      {pregnant && <Notice tone="warning">Estás en embarazo o posparto: no tomes suplementos (sobre todo cafeína o pre-entreno) sin indicación médica.</Notice>}
      <RhythmCard rhythm={rhythm} trainingTitle={todayMeta?.title ?? null} />

      <Card className="tint-purple">
        <CardHeader title="Tus suplementos de hoy" subtitle={mine.length ? `${takenToday.size} de ${mine.length} tomados` : "Elige los que tomas y te decimos a qué hora."}
          icon={<Pill className="h-5 w-5" />}
          action={<Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>{editing || !mine.length ? "Listo" : "Elegir"}</Button>} />
        {mine.length > 0 && <ProgressBar value={takenToday.size} max={mine.length} label="Suplementos tomados hoy" />}

        {(editing || mine.length === 0) && (
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Catálogo de suplementos">
            {catalog.map((s) => (
              <Chip key={s.key} selected={mine.includes(s.key)} onClick={() => toggleMine(s.key)}>{s.name}</Chip>
            ))}
          </div>
        )}

        {schedule.length > 0 && (
          <ol className="mt-4 space-y-2.5">
            {schedule.map(({ s, slot }) => {
              const done = takenToday.has(s.key);
              return (
                <li key={s.key} className={cx("rounded-3xl border p-3.5 transition", done ? "border-success/40 bg-success/5" : "border-border/60 bg-surface")}>
                  <div className="flex items-start gap-3">
                    <span className="grid w-[4.5rem] shrink-0 text-center">
                      <span className="text-sm font-semibold tabular-nums">{slot.time ? formatTime(slot.time) : "—"}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-sm text-muted">{slot.label} · {s.dose}</p>
                      <details className="mt-1 text-sm">
                        <summary className="cursor-pointer text-primary-strong">¿Por qué a esta hora?</summary>
                        <p className="mt-1 text-muted">{s.why}</p>
                        {s.caution && <p className="mt-1 text-warning">{s.caution}</p>}
                      </details>
                      {slot.warning && <p className="mt-1.5 text-sm font-medium text-warning">{slot.warning}</p>}
                    </div>
                    <button type="button" onClick={() => toggleTaken(s.key)} aria-pressed={done} aria-label={`${done ? "Desmarcar" : "Marcar"} ${s.name} como tomado`}
                      className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-full border transition",
                        done ? "border-success bg-success text-white" : "border-border bg-surface text-muted hover:border-primary-strong")}>
                      <Check className="h-5 w-5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      {mine.length > 0 && (
        <Card className="tint-green">
          <CardHeader title="Tu constancia esta semana" subtitle="Lo que más cuenta es tomarlos todos los días." />
          <ol className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((date) => {
              const count = data.logs.filter((l) => l.logged_on === date && mine.includes(l.supplement)).length;
              const full = count >= mine.length;
              return (
                <li key={date} className="flex flex-col items-center gap-1 text-xs text-muted">
                  {WEEKDAYS_SHORT[weekdayIndex(date)]}
                  <span className={cx("grid h-9 w-9 place-items-center rounded-full text-xs font-semibold tabular-nums",
                    full ? "bg-primary-strong text-on-primary" : count ? "bg-primary-strong/15 text-text" : "bg-surface-2")}
                    aria-label={`${count} de ${mine.length}`}>
                    {full ? <Check className="h-4 w-4" /> : count}
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
      )}
    </div>
  );
}

// ---------- Horario de comidas y déficit ----------

export function MealTimingTab({ logsToday, estimate, caloriesVisible }: { logsToday: MealLogRow[]; estimate: NutritionEstimate; caloriesVisible: boolean }) {
  const bundle = useBundle();
  const { rhythm, todayMeta, data, loading, error, reload } = useDayRhythm();
  const goal = primaryGoal(bundle);
  const health = bundle.onboarding?.health;
  const age = ageFromBirthDate(bundle.profile.birth_date);
  const win = useMemo(() => eatingWindow(goal, rhythm, bundle.nutrition?.meals_per_day ?? 4), [goal, rhythm, bundle.nutrition?.meals_per_day]);

  if (loading && !data) return <PageSkeleton />;
  if (error || !data) return <ErrorState message={error ?? "No se pudo calcular tu horario."} onRetry={reload} />;

  // Modo seguro: sin ventanas de comida ni déficit cuando no es recomendable.
  const blocked = health?.edHistory === true ? "Por tus antecedentes de trastornos de la conducta alimentaria no proponemos ventanas de comida ni déficit. Lo más sano es comer con regularidad; un profesional en nutrición puede acompañarte."
    : ["pregnant", "postpartum"].includes(health?.pregnancyStatus ?? "") ? "Durante el embarazo y el posparto no se recomienda restringir horarios ni hacer déficit calórico. Come con regularidad y sigue la guía de tu médico."
      : age !== null && age < 18 ? "Si eres menor de edad no proponemos ventanas de comida ni déficit. Come con regularidad y consulta con un profesional."
        : null;
  if (blocked) return <Notice tone="info" title="Herramienta no disponible para tu perfil">{blocked}</Notice>;

  const status = windowStatus(win, nowTime());
  const eaten = sumMacros(logsToday);
  const targets = estimate.mode === "no_numbers" ? null : estimate.targets;
  const fatLoss = goal === "lose_fat" || goal === "recomposition";
  const deficit = targets && estimate.tdee ? Math.max(0, Math.round(estimate.tdee - targets.kcal)) : null;
  const hm = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ""}` : `${m} min`).trim();

  return (
    <div className="space-y-5">
      <section className="feature-card rounded-card p-5 shadow-card sm:p-6" aria-label="Ventana de comidas">
        <p className="text-sm font-semibold opacity-80">Tu ventana de comidas de hoy</p>
        <div className="mt-3 flex items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm opacity-80"><Sun className="h-4 w-4" aria-hidden /> Empieza a comer</p>
            <p className="font-display text-3xl font-semibold tabular-nums sm:text-4xl">{formatTime(win.start)}</p>
          </div>
          <div className="text-right">
            <p className="flex items-center justify-end gap-2 text-sm opacity-80"><Moon className="h-4 w-4" aria-hidden /> Termina de comer</p>
            <p className="font-display text-3xl font-semibold tabular-nums sm:text-4xl">{formatTime(win.end)}</p>
          </div>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-feature-fg/15" aria-hidden>
          <div className="h-full rounded-full bg-feature-ring transition-all" style={{ width: `${status.progress}%` }} />
        </div>
        <p className="mt-2 text-sm font-medium" role="status">
          {status.state === "before" ? `Abre en ${hm(status.minutesLeft)}`
            : status.state === "open" ? `Ventana abierta: cierra en ${hm(status.minutesLeft)}`
              : `Ventana cerrada. Mañana abre a las ${formatTime(win.start)}`}
          {" · "}{hm(Math.round(win.hours * 60))} para comer
        </p>
      </section>

      <Card className="tint-orange">
        <CardHeader title="Horario sugerido" subtitle="Comidas repartidas dentro de tu ventana." icon={<Utensils className="h-5 w-5" />} />
        <ol className="space-y-2">
          {win.meals.map((m) => (
            <li key={m.label} className="flex items-center justify-between rounded-full bg-surface/80 px-4 py-2.5 text-sm">
              <span className="font-medium">{m.label}</span>
              <span className="font-semibold tabular-nums">{formatTime(m.time)}</span>
            </li>
          ))}
          {rhythm.trainingStart && (
            <li className="flex flex-wrap items-center justify-between gap-x-3 rounded-3xl bg-primary-strong/10 px-4 py-2.5 text-sm">
              <span className="font-medium">Entreno{todayMeta ? `: ${todayMeta.title}` : ""}</span>
              <span className="font-semibold tabular-nums">{formatTime(rhythm.trainingStart)} a {formatTime(addMinutes(rhythm.trainingStart, rhythm.trainingMinutes))}</span>
            </li>
          )}
        </ol>
        {win.notes.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">{win.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
      </Card>

      <Card className="tint-pink">
        <CardHeader title={fatLoss ? "Tracker de déficit calórico" : "Calorías de hoy"}
          subtitle={caloriesVisible && targets ? (fatLoss && deficit ? `Déficit planeado: unas ${deficit} kcal por día` : "Según tu objetivo") : undefined} />
        {caloriesVisible && targets ? (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Meta", value: targets.kcal },
                { label: "Comido", value: Math.round(eaten.kcal) },
                { label: "Te quedan", value: Math.max(0, Math.round(targets.kcal - eaten.kcal)) },
              ].map((x) => (
                <div key={x.label} className="rounded-3xl bg-surface/80 px-2 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">{x.label}</p>
                  <p className="text-xl font-semibold tabular-nums">{x.value}</p>
                  <p className="text-[11px] text-muted">kcal</p>
                </div>
              ))}
            </div>
            <div className="mt-3"><ProgressBar value={Math.min(eaten.kcal, targets.kcal)} max={targets.kcal} label="Calorías consumidas" /></div>
            {eaten.kcal > targets.kcal && <p className="mt-2 text-sm text-muted">Hoy pasaste tu meta. No pasa nada: el progreso se mide por semanas, no por un día.</p>}
            <p className="mt-3 text-xs text-muted">Estimaciones. Registra tus comidas en la pestaña Hoy para actualizar el tracker.</p>
            {!fatLoss && <Badge className="mt-2">Tu objetivo no requiere déficit</Badge>}
          </>
        ) : (
          <p className="text-sm text-muted">Las cifras de calorías están ocultas. Puedes activarlas en Ajustes si lo deseas; el horario de comidas funciona igual.</p>
        )}
      </Card>

      <RhythmCard rhythm={rhythm} trainingTitle={todayMeta?.title ?? null} />
    </div>
  );
}
