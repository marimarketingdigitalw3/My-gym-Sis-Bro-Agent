import { ArrowRight, Bot, CalendarDays, CalendarHeart, CheckCircle2, ChevronRight, Flame, Snowflake } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useGymBotMood } from "@/app/gymbot";
import { useBundle } from "@/app/providers";
import { GymBotLive } from "@/components/GymBot";
import { Badge, Card, CardHeader, ErrorState, Notice, PageSkeleton, ProgressRing } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { trainingClearance } from "@/lib/clearance";
import { computeStreak, weeklyCompletion } from "@/lib/consistency";
import { cycleTrainingSuggestion, estimateCycle, PHASE_INFO } from "@/lib/cycle";
import { formatLongDate, startOfWeek, todayISO, weekdayIndex, WEEKDAYS_SHORT } from "@/lib/dates";
import { MOOD_LABELS } from "@/lib/gymbotMood";
import { dayStartTime, formatTime } from "@/lib/schedule";
import { errorMessage, useAsync } from "@/lib/useAsync";
import { getRecovery, listCycleLogs } from "@/services/tracking";
import { getActivePlan, listSessions, startSession } from "@/services/workouts";
import { RecoveryCheckin } from "@/features/wellness/RecoveryCheckin";

// Inicio: solo lo de hoy. Racha, semana y récords están en Progreso; nutrición e hidratación, en Nutrición.
export default function DashboardPage() {
  const bundle = useBundle();
  const navigate = useNavigate();
  const toast = useToast();
  const today = todayISO();
  const mood = useGymBotMood();
  const [starting, setStarting] = useState(false);

  const { data, loading, error, reload, setData } = useAsync(async () => {
    const [active, sessions, recovery, cycleLogs] = await Promise.all([
      getActivePlan(), listSessions(200), getRecovery(today),
      bundle.settings.cycle_tracking_enabled ? listCycleLogs() : Promise.resolve([]),
    ]);
    return { active, sessions, recovery, cycleLogs };
  }, [today]);

  if (loading && !data) return <PageSkeleton />;
  if (error || !data) return <ErrorState message={error ?? "No se pudo cargar tu panel."} onRetry={reload} />;

  const { active, sessions, recovery, cycleLogs } = data;
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
  const theme = bundle.profile.theme;
  return (
    <div className="space-y-5">
      {/* Saludo y resumen del día */}
      <section className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <p className="text-sm text-muted first-letter:uppercase">{formatLongDate(today)}</p>
          <h1 className="display-hero mt-2 text-[2.35rem] sm:text-5xl">
            Hola, <em>{firstName}</em>
            <span className="block">{theme === "sis" ? <>Hoy toca <em>brillar</em></> : theme === "bro" ? "A darle con todo" : "Tu resumen de hoy"}</span>
          </h1>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-2">
          <GymBotLive mood={mood?.mood} size={124} />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface px-3 py-1.5 text-sm font-semibold shadow-sm" title="Racha actual">
            <Flame className="h-4 w-4 text-headline" aria-hidden /> {streak.streak} <span className="text-xs font-medium text-muted">días</span>
          </span>
        </div>
      </section>

      {mood && (
        <p className="relative rounded-3xl rounded-tr-md border border-border/60 bg-surface px-4 py-3 text-[15px] shadow-card" role="status">
          <span className="mb-0.5 block text-xs font-semibold uppercase tracking-wide text-muted">Gym Bot · {MOOD_LABELS[mood.mood]}</span>
          {mood.message}
        </p>
      )}

      <div className="flex items-center gap-4">
        <p className="flex items-baseline gap-3 tabular-nums">
          <span className="text-5xl font-semibold leading-none">{String(completedThisWeek).padStart(2, "0")}</span>
          <span className="h-10 w-px self-center bg-border" aria-hidden />
          <span className="text-5xl font-light leading-none text-muted">{String(active?.plan.days_per_week ?? 0).padStart(2, "0")}</span>
        </p>
        <p className="text-sm leading-tight text-muted">Sesiones<br />esta semana</p>
        <Link to="/workouts" aria-label="Ver plan semanal" className="ml-auto grid h-12 w-12 place-items-center rounded-full border border-border/60 bg-surface shadow-sm">
          <CalendarDays className="h-5 w-5" />
        </Link>
      </div>

      {clearance.status !== "ok" && (
        <Notice tone={clearance.status === "blocked" ? "danger" : "warning"} title={clearance.status === "blocked" ? "Entrenamiento en pausa" : "Tu plan tiene ajustes de seguridad"}>
          <ul className="list-disc space-y-1 pl-4">{clearance.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </Notice>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Sesión de hoy */}
        <section className="relative overflow-hidden rounded-card border border-border/60 bg-surface shadow-card">
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full opacity-80 blur-2xl"
            style={{ background: "radial-gradient(circle at 30% 30%, rgb(var(--primary) / .9), rgb(var(--accent) / .9) 55%, transparent 72%)" }} />
          <div className="relative p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">{todayDay ? `Entrenamiento de hoy · ${formatTime(dayStartTime(todayDay, bundle.onboarding?.lifestyle?.preferredTime))}` : "Hoy"}</p>
            <h2 className="mt-1 text-2xl font-semibold">{clearance.status === "blocked" ? "Entrenamiento en pausa" : todayDay ? todayDay.title : "Día de descanso"}</h2>
            <p className="text-sm text-muted">{todayDay ? todayDay.focus : "Camina, estira o descansa."}</p>
            <div className="mt-5 flex gap-6 text-sm">
              <div>
                <p className="text-muted">{todayDay ? "Ejercicios" : "Próxima sesión"}</p>
                <p className="mt-0.5 font-semibold">{todayDay ? todaysExercises.length : nextDay ? `${WEEKDAYS_SHORT[nextDay.weekday]} · ${nextDay.title}` : "—"}</p>
              </div>
              {todayDay && <span className="w-px bg-border" aria-hidden />}
              {todayDay && (
                <div>
                  <p className="text-muted">Duración</p>
                  <p className="mt-0.5 font-semibold">~{todayDay.estimatedMinutes} min</p>
                </div>
              )}
            </div>
          </div>
          {clearance.status !== "blocked" && (todayDay || nextDay) && (
            doneToday && todayDay ? (
              <p className="relative flex items-center gap-2 border-t border-border/60 bg-surface-2/60 px-5 py-4 text-sm font-semibold text-success sm:px-6">
                <CheckCircle2 className="h-5 w-5" /> Sesión de hoy completada
              </p>
            ) : (
              <button type="button" disabled={starting}
                onClick={() => (todayDay ? start(todayDay.dayIndex, todayDay.title) : nextDay && start(nextDay.dayIndex, nextDay.title))}
                className="relative flex w-full items-center justify-between border-t border-border/60 bg-surface-2/60 px-5 py-4 text-left font-semibold transition hover:bg-surface-2 disabled:opacity-60 sm:px-6">
                {starting ? "Abriendo…" : todayDay ? "Empezar la sesión de hoy" : "Entrenar igual hoy"}
                <ArrowRight className="h-5 w-5" aria-hidden />
              </button>
            )
          )}
        </section>

        {/* Progreso semanal: tarjeta destacada */}
        <section className="feature-card rounded-card p-5 shadow-card sm:p-6" aria-label="Progreso de la semana">
          <p className="text-lg font-semibold">Progreso de la semana</p>
          <div className="mt-4 flex items-center gap-5">
            <ProgressRing value={weeklyCompletion(completedThisWeek, active?.plan.days_per_week ?? 0)} size={128} stroke={14}
              color="var(--feature-ring)" track="var(--feature-fg) / .12" label="Cumplimiento semanal">
              <span className="text-2xl font-semibold">{weeklyCompletion(completedThisWeek, active?.plan.days_per_week ?? 0)}<span className="text-sm">%</span></span>
            </ProgressRing>
            <span className="h-24 w-px bg-feature-fg/15" aria-hidden />
            <ul className="space-y-3 text-sm">
              {[
                { icon: CalendarDays, value: active?.plan.days_per_week ?? 0, label: "Planificadas" },
                { icon: CheckCircle2, value: completedThisWeek, label: "Completadas" },
                { icon: Snowflake, value: streak.freezes, label: "Comodines" },
              ].map(({ icon: Icon, value, label }) => (
                <li key={label} className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-feature-fg/10"><Icon className="h-4 w-4" aria-hidden /></span>
                  <span className="leading-tight"><span className="block font-semibold tabular-nums">{value}</span><span className="text-xs opacity-70">{label}</span></span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <RecoveryCheckin date={today} value={recovery} onSaved={(r) => setData((d) => (d ? { ...d, recovery: r } : d))} />

        {cycleEstimate && cycleTip && (
          <Card className="tint-pink md:col-span-2 lg:col-span-1">
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
          <Card className="tint-purple flex h-full items-center gap-4 transition group-hover:border-primary-strong">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary-strong"><Bot className="h-6 w-6" /></span>
            <span className="flex-1">
              <span className="block font-semibold">Pregúntale a Gym AI Coach</span>
              <span className="block text-sm text-muted">“¿Qué entreno hoy?”, “¿Qué como después de entrenar?”</span>
            </span>
            <ChevronRight className="h-5 w-5 text-muted" />
          </Card>
        </Link>
      </div>

      <Link to="/progress" className="flex items-center justify-between rounded-card border border-border/60 bg-surface px-5 py-4 shadow-card transition hover:border-primary-strong">
        <span>
          <span className="block font-semibold">Tu racha, tu semana y tus récords</span>
          <span className="block text-sm text-muted">Míralos en Progreso</span>
        </span>
        <ChevronRight className="h-5 w-5 text-muted" />
      </Link>
    </div>
  );
}
