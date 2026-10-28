import { Bot, CalendarHeart, ChevronRight, Dumbbell, Flame, Play, Snowflake, Target, Trophy, UtensilsCrossed } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useBundle } from "@/app/providers";
import { TrendChart } from "@/components/charts";
import {
  Badge, Button, Card, CardHeader, EmptyState, ErrorState, Notice, PageSkeleton, ProgressBar, ProgressRing, Stat, cx,
} from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { trainingClearance } from "@/lib/clearance";
import { computeStreak, CHALLENGE_DAYS, weeklyCompletion } from "@/lib/consistency";
import { cycleTrainingSuggestion, estimateCycle, PHASE_INFO } from "@/lib/cycle";
import { addDays, formatLongDate, startOfWeek, todayISO, weekdayIndex, WEEKDAYS_SHORT } from "@/lib/dates";
import { formatWeight } from "@/lib/labels";
import { sumMacros } from "@/lib/nutrition";
import { personalRecords } from "@/lib/workouts/progression";
import { GOAL_LABELS, primaryGoal } from "@/lib/userBundle";
import { errorMessage, useAsync } from "@/lib/useAsync";
import { EXERCISE_BY_ID } from "@/data/exercises";
import { nutritionFromBundle, showCalories } from "@/services/derived";
import { getRecovery, getWater, listCycleLogs, listMealLogs, listMeasurements } from "@/services/tracking";
import { allSets, getActivePlan, listSessions, startSession } from "@/services/workouts";
import { RecoveryCheckin } from "@/features/wellness/RecoveryCheckin";
import { WaterTracker } from "@/features/nutrition/WaterTracker";

export default function DashboardPage() {
  const bundle = useBundle();
  const navigate = useNavigate();
  const toast = useToast();
  const today = todayISO();
  const [starting, setStarting] = useState(false);

  const { data, loading, error, reload, setData } = useAsync(async () => {
    const [active, sessions, sets, measurements, meals, water, recovery, cycleLogs] = await Promise.all([
      getActivePlan(), listSessions(200), allSets(), listMeasurements(), listMealLogs(today, today), getWater(today), getRecovery(today),
      bundle.settings.cycle_tracking_enabled ? listCycleLogs() : Promise.resolve([]),
    ]);
    return { active, sessions, sets, measurements, meals, water, recovery, cycleLogs };
  }, [today]);

  if (loading && !data) return <PageSkeleton />;
  if (error || !data) return <ErrorState message={error ?? "No se pudo cargar tu panel."} onRetry={reload} />;

  const { active, sessions, sets, measurements, meals, water, recovery, cycleLogs } = data;
  const clearance = trainingClearance(bundle.onboarding?.health, recovery);
  const weekStart = startOfWeek(today);
  const todayIdx = weekdayIndex(today);
  const completed = sessions.filter((s) => s.status === "completed");
  const completedDates = new Set(completed.map((s) => s.started_at.slice(0, 10)));
  const completedThisWeek = completed.filter((s) => s.started_at.slice(0, 10) >= weekStart).length;
  const todayDay = active?.plan.schedule.find((d) => d.weekday === todayIdx) ?? null;
  const nextDay = active?.plan.schedule.find((d) => d.weekday > todayIdx) ?? active?.plan.schedule[0] ?? null;
  const todaysExercises = todayDay && active ? active.exercises.filter((e) => e.day_index === todayDay.dayIndex) : [];
  const doneToday = completedDates.has(today);

  const activeDates = new Set([...completedDates, ...(recovery ? [today] : [])]);
  const streak = computeStreak(activeDates, bundle.profile.created_at.slice(0, 10), today);

  const nutrition = nutritionFromBundle(bundle);
  const caloriesVisible = showCalories(bundle, nutrition);
  const eaten = sumMacros(meals);

  const weights = measurements.filter((m) => m.weight_kg !== null).map((m) => ({ date: m.measured_on, value: Number(m.weight_kg) }));
  const prs = personalRecords(sets).slice(0, 3);
  const goal = primaryGoal(bundle);
  const target = bundle.profile.target_weight_kg ? Number(bundle.profile.target_weight_kg) : null;
  const startWeight = weights[0]?.value ?? (bundle.profile.weight_kg ? Number(bundle.profile.weight_kg) : null);
  const latestWeight = weights[weights.length - 1]?.value ?? startWeight;
  const weightProgress = target && startWeight && latestWeight && startWeight !== target
    ? Math.max(0, Math.min(100, ((startWeight - latestWeight) / (startWeight - target)) * 100)) : null;

  const cycleEstimate = bundle.settings.cycle_tracking_enabled ? estimateCycle(bundle.cycle, cycleLogs, today) : null;
  const cycleToday = cycleLogs.find((c) => c.logged_on === today) ?? null;
  const cycleTip = cycleEstimate ? cycleTrainingSuggestion(cycleEstimate, cycleToday, bundle.cycle?.period_training_preference) : null;

  async function start(dayIndex: number, title: string) {
    if (!active) return;
    setStarting(true);
    try {
      const s = await startSession(active.plan.id, dayIndex, title);
      navigate(`/workouts/session/${s.id}`);
    } catch (e) {
      toast(errorMessage(e), "error");
      setStarting(false);
    }
  }

  const firstName = bundle.profile.display_name.split(" ")[0];
  return (
    <div className="space-y-5">
      {/* Saludo y entrenamiento de hoy */}
      <section className="hero-surface overflow-hidden rounded-card p-5 shadow-card sm:p-7">
        <p className="text-sm first-letter:uppercase text-white/80">{formatLongDate(today)}</p>
        <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">Hola, {firstName}</h1>
        <p className="mt-1 text-white/85">Objetivo: {GOAL_LABELS[goal]}</p>

        <div className="mt-5 rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
          {clearance.status === "blocked" ? (
            <p className="font-medium">Pausamos las recomendaciones de entrenamiento: {clearance.reasons[0]} Busca evaluación médica.</p>
          ) : todayDay ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Entrenamiento de hoy</p>
                <p className="text-xl font-semibold">{todayDay.title}</p>
                <p className="text-sm text-white/80">{todaysExercises.length} ejercicios · ~{todayDay.estimatedMinutes} min · {todayDay.focus}</p>
              </div>
              {doneToday
                ? <Badge tone="success" className="bg-white/90">Completado hoy</Badge>
                : <Button variant="inverse" onClick={() => start(todayDay.dayIndex, todayDay.title)} loading={starting}><Play className="h-4 w-4" /> Empezar</Button>}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Hoy</p>
                <p className="text-xl font-semibold">Día de descanso</p>
                <p className="text-sm text-white/80">Camina, estira o descansa. {nextDay ? `Próximo: ${nextDay.title} (${WEEKDAYS_SHORT[nextDay.weekday]}).` : ""}</p>
              </div>
              {nextDay && <Button variant="inverse-outline" onClick={() => start(nextDay.dayIndex, nextDay.title)} loading={starting}>Entrenar igual</Button>}
            </div>
          )}
        </div>
      </section>

      {clearance.status !== "ok" && (
        <Notice tone={clearance.status === "blocked" ? "danger" : "warning"} title={clearance.status === "blocked" ? "Entrenamiento en pausa" : "Tu plan tiene ajustes de seguridad"}>
          <ul className="list-disc space-y-1 pl-4">{clearance.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </Notice>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Semana */}
        <Card className="lg:col-span-2">
          <CardHeader title="Tu semana" subtitle={`${completedThisWeek} de ${active?.plan.days_per_week ?? 0} sesiones completadas`} icon={<Dumbbell className="h-5 w-5" />}
            action={<Link to="/workouts" className="text-sm font-semibold text-primary-strong">Ver plan</Link>} />
          <ol className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS_SHORT.map((label, i) => {
              const date = addDays(weekStart, i);
              const planned = active?.plan.schedule.some((d) => d.weekday === i);
              const done = completedDates.has(date);
              return (
                <li key={label} className={cx("flex flex-col items-center gap-1 rounded-xl py-2 text-xs",
                  date === today ? "bg-primary/15 font-semibold text-primary-strong" : "text-muted")}>
                  {label}
                  <span aria-label={done ? "completado" : planned ? "planificado" : "descanso"}
                    className={cx("grid h-8 w-8 place-items-center rounded-full border text-[11px]",
                      done ? "border-primary-strong bg-primary-strong text-on-primary" : planned ? "border-primary-strong/60" : "border-dashed border-border")}>
                    {done ? "✓" : planned ? "•" : ""}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 flex items-center gap-4">
            <ProgressRing value={weeklyCompletion(completedThisWeek, active?.plan.days_per_week ?? 0)} label="Cumplimiento semanal">
              {weeklyCompletion(completedThisWeek, active?.plan.days_per_week ?? 0)}%
            </ProgressRing>
            <div className="grid flex-1 grid-cols-3 gap-2">
              <Stat label="Racha" value={<span className="inline-flex items-center gap-1"><Flame className="h-4 w-4 text-primary-strong" />{streak.streak}</span>} hint="días" />
              <Stat label="Comodines" value={<span className="inline-flex items-center gap-1"><Snowflake className="h-4 w-4 text-primary-strong" />{streak.freezes}</span>} hint="disponibles" />
              <Stat label="Reto" value={`${streak.challengeDay}/${CHALLENGE_DAYS}`} hint="días" />
            </div>
          </div>
        </Card>

        <RecoveryCheckin date={today} value={recovery} onSaved={(r) => setData((d) => (d ? { ...d, recovery: r } : d))} />
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {/* Objetivo */}
        <Card>
          <CardHeader title="Tu objetivo" subtitle={GOAL_LABELS[goal]} icon={<Target className="h-5 w-5" />} />
          {weightProgress !== null && target ? (
            <>
              <ProgressBar value={weightProgress} label="Progreso hacia el peso objetivo" />
              <p className="mt-2 text-sm text-muted">{formatWeight(latestWeight, bundle.profile.units)} hoy · objetivo {formatWeight(target, bundle.profile.units)}</p>
            </>
          ) : (
            <p className="text-sm text-muted">Medimos tu avance con fuerza, constancia y cómo te sientes. Registra tu peso o medidas en Progreso si quieres seguirlos.</p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat label="Sesiones" value={completed.length} hint="en total" />
            <Stat label="Días activos" value={streak.activeDays} hint="en el reto" />
          </div>
        </Card>

        {/* Nutrición */}
        <Card>
          <CardHeader title="Nutrición de hoy" icon={<UtensilsCrossed className="h-5 w-5" />} action={<Link to="/nutrition" className="text-sm font-semibold text-primary-strong">Abrir</Link>} />
          {nutrition.targets && caloriesVisible ? (
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between"><span>Energía</span><span className="font-semibold">{Math.round(eaten.kcal)} / {nutrition.targets.kcal} kcal</span></div>
              <ProgressBar value={eaten.kcal} max={nutrition.targets.kcal} label="Calorías" />
              <div className="flex justify-between"><span>Proteína</span><span className="font-semibold">{Math.round(eaten.proteinG)} / {nutrition.targets.proteinG} g</span></div>
              <ProgressBar value={eaten.proteinG} max={nutrition.targets.proteinG} label="Proteína" />
              <p className="text-xs text-muted">Valores estimados.</p>
            </div>
          ) : (
            <p className="text-sm text-muted">{meals.length ? `Registraste ${meals.length} comidas hoy.` : "Aún no registras comidas hoy."} Enfócate en comidas completas y regulares.</p>
          )}
        </Card>

        {bundle.settings.water_tracking_enabled && (
          <WaterTracker date={today} ml={water} goalMl={nutrition.targets?.waterMl ?? null} onChange={(ml) => setData((d) => (d ? { ...d, water: ml } : d))} />
        )}

        {/* Peso */}
        <Card className="md:col-span-2">
          <CardHeader title="Evolución del peso" icon={<Target className="h-5 w-5" />} action={<Link to="/progress" className="text-sm font-semibold text-primary-strong">Registrar</Link>} />
          {weights.length >= 2
            ? <TrendChart data={weights} unit="kg" label="Peso" height={180} />
            : <EmptyState title="Aún no hay suficientes registros" description="Registra tu peso al menos dos veces para ver la tendencia. El peso es solo una de muchas formas de medir tu progreso." />}
        </Card>

        {/* Fuerza */}
        <Card>
          <CardHeader title="Récords recientes" icon={<Trophy className="h-5 w-5" />} />
          {prs.length ? (
            <ul className="space-y-2">
              {prs.map((p) => (
                <li key={p.exerciseId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{EXERCISE_BY_ID[p.exerciseId]?.name ?? p.exerciseId}</span>
                  <span className="shrink-0 font-semibold">{p.bestWeightKg > 0 ? `${formatWeight(p.bestWeightKg, bundle.profile.units)} × ${p.bestReps}` : `${p.bestReps} reps`}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">Completa tu primer entrenamiento para ver tus récords.</p>}
        </Card>

        {cycleEstimate && cycleTip && (
          <Card className="md:col-span-2 lg:col-span-1">
            <CardHeader title="Cycle Wellness" icon={<CalendarHeart className="h-5 w-5" />} action={<Link to="/cycle" className="text-sm font-semibold text-primary-strong">Abrir</Link>} />
            {cycleEstimate.hasData && cycleEstimate.phase && (
              <Badge tone="primary">{PHASE_INFO[cycleEstimate.phase].name}{cycleEstimate.currentDay ? ` · día ${cycleEstimate.currentDay}` : ""}</Badge>
            )}
            <p className="mt-2 font-semibold">{cycleTip.headline}</p>
            <p className="mt-1 text-sm text-muted">{cycleTip.explanation}</p>
          </Card>
        )}

        {/* Coach */}
        <Link to="/coach" className="group md:col-span-2 lg:col-span-1">
          <Card className="flex h-full items-center gap-4 transition group-hover:border-primary-strong">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary-strong"><Bot className="h-6 w-6" /></span>
            <span className="flex-1">
              <span className="block font-semibold">Pregúntale a Gym AI Coach</span>
              <span className="block text-sm text-muted">“¿Qué entreno hoy?”, “¿Qué como después de entrenar?”</span>
            </span>
            <ChevronRight className="h-5 w-5 text-muted" />
          </Card>
        </Link>
      </div>

      {/* Actividad reciente */}
      <Card>
        <CardHeader title="Actividad reciente" />
        {completed.length ? (
          <ul className="divide-y divide-border">
            {completed.slice(0, 5).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="font-medium">{s.title}</span>
                <span className="text-muted">{formatLongDate(s.started_at.slice(0, 10))}{s.duration_s ? ` · ${Math.round(s.duration_s / 60)} min` : ""}</span>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="Tu historial empieza hoy" description="Cuando completes un entrenamiento aparecerá aquí." icon={<Dumbbell className="h-5 w-5" />} />}
      </Card>
    </div>
  );
}
