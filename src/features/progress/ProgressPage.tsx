import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Flame, Lock, Plus, Trash2, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth, useBundle } from "@/app/providers";
import { TrendChart, WeeklyBars } from "@/components/charts";
import {
  Badge, Button, Card, CardHeader, Chip, EmptyState, ErrorState, Field, IconButton, Input, Modal, Notice, PageHeader, PageSkeleton, Select, Stat, Tabs, useConfirm,
} from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { EXERCISE_BY_ID } from "@/data/exercises";
import { computeStreak, CHALLENGE_DAYS } from "@/lib/consistency";
import { addDays, formatLongDate, formatShortDate, startOfWeek, todayISO } from "@/lib/dates";
import { formatWeight, fromDisplayWeight, toDisplayWeight, weightUnit } from "@/lib/labels";
import { estimatedOneRepMax, personalRecords } from "@/lib/workouts/progression";
import { errorMessage, useAsync } from "@/lib/useAsync";
import { addMeasurement, deleteMeasurement, deletePhoto, listMeasurements, listPhotos, photoUrl, uploadPhoto } from "@/services/tracking";
import { allSets, listSessions } from "@/services/workouts";
import type { MeasurementRow, ProgressPhotoRow } from "@/types/db";
import { ProgressSummary } from "./ProgressSummary";

type TabKey = "summary" | "body" | "strength" | "consistency" | "photos";
type Range = "30" | "90" | "365" | "all";
const RANGES: { value: Range; label: string }[] = [{ value: "30", label: "30 días" }, { value: "90", label: "3 meses" }, { value: "365", label: "1 año" }, { value: "all", label: "Todo" }];

const METRICS = [
  { key: "weight_kg", label: "Peso", unit: "kg" },
  { key: "waist_cm", label: "Cintura", unit: "cm" },
  { key: "hips_cm", label: "Cadera", unit: "cm" },
  { key: "chest_cm", label: "Pecho", unit: "cm" },
  { key: "arm_cm", label: "Brazo", unit: "cm" },
  { key: "thigh_cm", label: "Muslo", unit: "cm" },
  { key: "body_fat_pct", label: "% grasa (si se midió con fiabilidad)", unit: "%" },
] as const;
type MetricKey = (typeof METRICS)[number]["key"];

export default function ProgressPage() {
  const [tab, setTab] = useState<TabKey>("summary");
  const [range, setRange] = useState<Range>("90");
  const today = todayISO();
  const from = range === "all" ? "0000-01-01" : addDays(today, -Number(range));
  return (
    <div>
      <PageHeader title="Progreso" subtitle="El peso es solo una métrica. También cuentan tu fuerza, tu constancia y cómo te sientes." />
      <div className="mb-3"><Tabs label="Tipos de progreso" value={tab} onChange={setTab} items={[
        { value: "summary", label: "Resumen" }, { value: "body", label: "Cuerpo" }, { value: "strength", label: "Fuerza" }, { value: "consistency", label: "Constancia" }, { value: "photos", label: "Fotos" },
      ]} /></div>
      {tab !== "photos" && tab !== "summary" && (
        <div className="mb-5 flex flex-wrap gap-2" aria-label="Rango de fechas">
          {RANGES.map((r) => <Chip key={r.value} selected={range === r.value} onClick={() => setRange(r.value)}>{r.label}</Chip>)}
        </div>
      )}
      {tab === "summary" && <ProgressSummary />}
      {tab === "body" && <BodyTab from={from} />}
      {tab === "strength" && <StrengthTab from={from} />}
      {tab === "consistency" && <ConsistencyTab from={from} />}
      {tab === "photos" && <PhotosTab />}
    </div>
  );
}

function BodyTab({ from }: { from: string }) {
  const bundle = useBundle();
  const toast = useToast();
  const units = bundle.profile.units;
  const [metric, setMetric] = useState<MetricKey>("weight_kg");
  const [adding, setAdding] = useState(false);
  const { data, loading, error, reload, setData } = useAsync(listMeasurements, []);
  if (loading && !data) return <PageSkeleton />;
  if (error || !data) return <ErrorState message={error ?? "Error"} onRetry={reload} />;

  const inRange = data.filter((m) => m.measured_on >= from);
  const meta = METRICS.find((m) => m.key === metric)!;
  const series = inRange.filter((m) => m[metric] !== null).map((m) => ({
    date: m.measured_on,
    value: metric === "weight_kg" ? toDisplayWeight(Number(m.weight_kg), units) : Number(m[metric]),
  }));
  const unit = metric === "weight_kg" ? weightUnit(units) : meta.unit;
  const first = series[0]?.value;
  const last = series[series.length - 1]?.value;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="metric" className="sr-only">Medida</label>
        <Select id="metric" value={metric} onChange={(e) => setMetric(e.target.value as MetricKey)} className="w-auto">
          {METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </Select>
        <Button className="ml-auto" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Registrar medidas</Button>
      </div>
      <Card>
        <CardHeader title={meta.label} subtitle={series.length >= 2 && first !== undefined && last !== undefined ? `${last > first ? "+" : ""}${(last - first).toFixed(1)} ${unit} en el periodo` : undefined} />
        {series.length >= 2 ? <TrendChart data={series} unit={unit} label={meta.label} /> :
          <EmptyState title={series.length === 1 ? "Un registro más y verás la tendencia" : "Sin registros en este periodo"} description="Mide en condiciones parecidas (por ejemplo, en ayunas y a la misma hora) para comparar mejor." />}
      </Card>
      {inRange.length > 0 && (
        <Card>
          <CardHeader title="Historial" />
          <ul className="divide-y divide-border">
            {[...inRange].reverse().map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="w-24 shrink-0 font-medium">{formatShortDate(m.measured_on)}</span>
                <span className="flex-1 text-muted">
                  {METRICS.filter((x) => m[x.key] !== null).map((x) => `${x.label.split(" ")[0]} ${x.key === "weight_kg" ? formatWeight(Number(m.weight_kg), units) : `${m[x.key]} ${x.unit}`}`).join(" · ")}
                </span>
                <IconButton label="Borrar registro" onClick={async () => {
                  try { await deleteMeasurement(m.id); setData((d) => d?.filter((x) => x.id !== m.id)); toast("Registro borrado"); } catch (e) { toast(errorMessage(e), "error"); }
                }}><Trash2 className="h-4 w-4" /></IconButton>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <MeasurementModal open={adding} onClose={() => setAdding(false)} onSaved={(m) => { setData((d) => [...(d ?? []), m].sort((a, b) => a.measured_on.localeCompare(b.measured_on))); setAdding(false); toast("Medidas guardadas"); }} />
    </div>
  );
}

const optionalNum = (min: number, max: number) => z.string().trim().refine((v) => v === "" || (Number(v) >= min && Number(v) <= max), `Entre ${min} y ${max}.`);
const measurementSchema = z.object({
  measured_on: z.string().min(1).refine((v) => v <= todayISO(), "La fecha no puede ser futura."),
  weight: optionalNum(25, 800), waist_cm: optionalNum(30, 250), hips_cm: optionalNum(30, 250), chest_cm: optionalNum(30, 250),
  arm_cm: optionalNum(10, 100), thigh_cm: optionalNum(20, 150), body_fat_pct: optionalNum(2, 70),
}).refine((v) => [v.weight, v.waist_cm, v.hips_cm, v.chest_cm, v.arm_cm, v.thigh_cm, v.body_fat_pct].some((x) => x !== ""), { message: "Completa al menos una medida.", path: ["weight"] });

function MeasurementModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (m: MeasurementRow) => void }) {
  const bundle = useBundle();
  const units = bundle.profile.units;
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<z.infer<typeof measurementSchema>>({
    resolver: zodResolver(measurementSchema),
    defaultValues: { measured_on: todayISO(), weight: "", waist_cm: "", hips_cm: "", chest_cm: "", arm_cm: "", thigh_cm: "", body_fat_pct: "" },
  });
  const [error, setError] = useState<string | null>(null);
  const n = (v: string) => (v === "" ? null : Number(v));
  return (
    <Modal open={open} onClose={onClose} title="Registrar medidas">
      <form noValidate className="space-y-3" onSubmit={handleSubmit(async (v) => {
        setError(null);
        try {
          const created = await addMeasurement({
            measured_on: v.measured_on, weight_kg: v.weight === "" ? null : fromDisplayWeight(Number(v.weight), units),
            waist_cm: n(v.waist_cm), hips_cm: n(v.hips_cm), chest_cm: n(v.chest_cm), arm_cm: n(v.arm_cm), thigh_cm: n(v.thigh_cm), body_fat_pct: n(v.body_fat_pct), notes: null,
          });
          reset();
          onSaved(created);
        } catch (e) { setError(errorMessage(e)); }
      })}>
        <Field label="Fecha" htmlFor="m-date" error={errors.measured_on?.message}><Input id="m-date" type="date" max={todayISO()} {...register("measured_on")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Peso (${weightUnit(units)})`} htmlFor="m-w" error={errors.weight?.message}><Input id="m-w" type="number" step="0.1" {...register("weight")} /></Field>
          <Field label="Cintura (cm)" htmlFor="m-waist" error={errors.waist_cm?.message}><Input id="m-waist" type="number" step="0.1" {...register("waist_cm")} /></Field>
          <Field label="Cadera (cm)" htmlFor="m-hips" error={errors.hips_cm?.message}><Input id="m-hips" type="number" step="0.1" {...register("hips_cm")} /></Field>
          <Field label="Pecho (cm)" htmlFor="m-chest" error={errors.chest_cm?.message}><Input id="m-chest" type="number" step="0.1" {...register("chest_cm")} /></Field>
          <Field label="Brazo (cm)" htmlFor="m-arm" error={errors.arm_cm?.message}><Input id="m-arm" type="number" step="0.1" {...register("arm_cm")} /></Field>
          <Field label="Muslo (cm)" htmlFor="m-thigh" error={errors.thigh_cm?.message}><Input id="m-thigh" type="number" step="0.1" {...register("thigh_cm")} /></Field>
        </div>
        <Field label="% de grasa corporal" optional htmlFor="m-bf" error={errors.body_fat_pct?.message} hint="Solo si lo mediste con un método fiable (DEXA, bioimpedancia clínica).">
          <Input id="m-bf" type="number" step="0.1" {...register("body_fat_pct")} />
        </Field>
        {error && <Notice tone="danger">{error}</Notice>}
        <Button type="submit" block loading={isSubmitting}>Guardar</Button>
      </form>
    </Modal>
  );
}

function StrengthTab({ from }: { from: string }) {
  const bundle = useBundle();
  const units = bundle.profile.units;
  const { data, loading, error, reload } = useAsync(allSets, []);
  const [exercise, setExercise] = useState<string>("");
  const prs = useMemo(() => personalRecords(data ?? []), [data]);
  if (loading && !data) return <PageSkeleton />;
  if (error || !data) return <ErrorState message={error ?? "Error"} onRetry={reload} />;
  if (!data.length) return <EmptyState icon={<Trophy className="h-5 w-5" />} title="Aún no hay registros de fuerza" description="Completa un entrenamiento y anota tus series para ver tu progreso." />;

  const exercises = [...new Set(data.filter((s) => s.completed && s.reps).map((s) => s.exercise_id))];
  const selected = exercise || exercises[0];
  const bySession = new Map<string, { date: string; value: number }>();
  for (const s of data.filter((x) => x.exercise_id === selected && x.completed && x.reps && x.created_at.slice(0, 10) >= from)) {
    const weighted = Number(s.weight_kg ?? 0) > 0;
    const value = weighted ? toDisplayWeight(estimatedOneRepMax(Number(s.weight_kg), s.reps!), units) : s.reps!;
    const prev = bySession.get(s.session_id);
    if (!prev || value > prev.value) bySession.set(s.session_id, { date: s.created_at.slice(0, 10), value });
  }
  const series = [...bySession.values()].sort((a, b) => a.date.localeCompare(b.date));
  const weighted = data.some((s) => s.exercise_id === selected && Number(s.weight_kg ?? 0) > 0);

  return (
    <div className="space-y-4">
      <label htmlFor="ex" className="sr-only">Ejercicio</label>
      <Select id="ex" value={selected} onChange={(e) => setExercise(e.target.value)} className="w-auto max-w-full">
        {exercises.map((id) => <option key={id} value={id}>{EXERCISE_BY_ID[id]?.name ?? id}</option>)}
      </Select>
      <Card>
        <CardHeader title={weighted ? "Fuerza estimada (1RM, fórmula de Epley)" : "Mejores repeticiones por sesión"} subtitle="Orientativo: no hace falta probar tu máximo real." />
        {series.length >= 2 ? <TrendChart data={series} unit={weighted ? weightUnit(units) : "reps"} label={weighted ? "1RM estimado" : "Repeticiones"} /> :
          <EmptyState title="Registra al menos dos sesiones de este ejercicio" />}
      </Card>
      <Card>
        <CardHeader title="Récords personales" icon={<Trophy className="h-5 w-5" />} />
        <ul className="divide-y divide-border">
          {prs.map((p) => (
            <li key={p.exerciseId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="font-medium">{EXERCISE_BY_ID[p.exerciseId]?.name ?? p.exerciseId}</span>
              <span className="text-right">
                <span className="font-semibold">{p.bestWeightKg ? `${formatWeight(p.bestWeightKg, units)} × ${p.bestReps}` : `${p.bestReps} reps`}</span>
                <span className="block text-xs text-muted">{formatShortDate(p.date)}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function ConsistencyTab({ from }: { from: string }) {
  const bundle = useBundle();
  const today = todayISO();
  const { data, loading, error, reload } = useAsync(() => listSessions(500), []);
  if (loading && !data) return <PageSkeleton />;
  if (error || !data) return <ErrorState message={error ?? "Error"} onRetry={reload} />;
  const completed = data.filter((s) => s.status === "completed");
  const dates = new Set(completed.map((s) => s.started_at.slice(0, 10)));
  const streak = computeStreak(dates, bundle.profile.created_at.slice(0, 10), today);
  const weeks = Array.from({ length: 8 }, (_, i) => startOfWeek(addDays(today, -7 * (7 - i))));
  const perWeek = weeks.map((w) => ({ label: formatShortDate(w), value: completed.filter((s) => s.started_at.slice(0, 10) >= w && s.started_at.slice(0, 10) < addDays(w, 7)).length }));
  const inRange = completed.filter((s) => s.started_at.slice(0, 10) >= from);
  const minutes = inRange.reduce((a, s) => a + (s.duration_s ?? 0), 0) / 60;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Sesiones" value={inRange.length} hint="en el periodo" />
        <Stat label="Tiempo" value={`${Math.round(minutes)} min`} hint="entrenando" />
        <Stat label="Racha actual" value={<span className="inline-flex items-center gap-1"><Flame className="h-4 w-4 text-primary-strong" />{streak.streak}</span>} hint={`mejor: ${streak.best}`} />
        <Stat label="Reto 66 días" value={`${streak.challengeDay}/${CHALLENGE_DAYS}`} hint={`${streak.usedFreezes} comodines usados`} />
      </div>
      <Card>
        <CardHeader title="Sesiones por semana" subtitle="Últimas 8 semanas" />
        <WeeklyBars data={perWeek} label="Sesiones" />
      </Card>
      <Card>
        <CardHeader title="Cómo funciona la racha" />
        <p className="text-sm text-muted">Cada día con un entrenamiento suma a tu racha. Ganas un comodín cada 7 días (máximo 2): si un día no entrenas, se usa un comodín en lugar de romper la racha. El reto de 66 días nunca se reinicia.</p>
      </Card>
    </div>
  );
}

function PhotosTab() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload, setData } = useAsync(listPhotos, []);
  const [consent, setConsent] = useState(false);
  const [pose, setPose] = useState<ProgressPhotoRow["pose"]>("front");
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<ProgressPhotoRow | null>(null);
  const [ask, confirmDialog] = useConfirm();
  if (loading && !data) return <PageSkeleton />;
  if (error || !data) return <ErrorState message={error ?? "Error"} onRetry={reload} />;

  async function onFile(file: File | undefined) {
    if (!file || !user) return;
    setUploading(true);
    try {
      const row = await uploadPhoto(user.id, file, todayISO(), pose ?? "other");
      setData((d) => [row, ...(d ?? [])]);
      toast("Foto guardada de forma privada");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Notice title="Tus fotos son privadas">
        <span className="inline-flex items-start gap-1.5"><Lock className="mt-0.5 h-4 w-4 shrink-0" />Se guardan en un almacenamiento privado al que solo tú puedes acceder, nunca se publican ni se envían al coach de IA, y puedes borrarlas cuando quieras.</span>
      </Notice>
      <Card className="space-y-3">
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[rgb(var(--primary-strong))]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          Quiero guardar fotos de progreso y entiendo cómo se protegen.
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {([["front", "Frente"], ["side", "Perfil"], ["back", "Espalda"], ["other", "Otra"]] as const).map(([k, l]) => <Chip key={k} selected={pose === k} onClick={() => setPose(k)}>{l}</Chip>)}
          <label className={`ml-auto inline-flex h-11 cursor-pointer items-center gap-2 rounded-full px-4 font-semibold ${consent ? "bg-primary-strong text-on-primary" : "pointer-events-none bg-surface-2 text-muted"}`}>
            <Camera className="h-4 w-4" /> {uploading ? "Subiendo…" : "Subir foto"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={!consent || uploading} onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </div>
      </Card>
      {data.length === 0 ? <EmptyState icon={<Camera className="h-5 w-5" />} title="Sin fotos" description="Las fotos pueden ayudarte a ver cambios que la báscula no muestra. Son opcionales." /> : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {data.map((p) => <PhotoTile key={p.id} photo={p} onOpen={() => setViewing(p)} onDelete={async () => {
            if (!(await ask("¿Borrar esta foto de forma permanente?", "Borrar foto"))) return;
            try { await deletePhoto(p.id, p.storage_path); setData((d) => d?.filter((x) => x.id !== p.id)); toast("Foto borrada"); } catch (e) { toast(errorMessage(e), "error"); }
          }} />)}
        </ul>
      )}
      {confirmDialog}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing ? formatLongDate(viewing.taken_on) : ""}>
        {viewing && <PhotoImage path={viewing.storage_path} className="w-full rounded-xl" />}
      </Modal>
    </div>
  );
}

function PhotoImage({ path, className }: { path: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    photoUrl(path).then((u) => alive && setUrl(u)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [path]);
  if (failed) return <div className="grid aspect-[3/4] place-items-center rounded-xl bg-surface-2 text-xs text-muted">No disponible</div>;
  if (!url) return <div className="skeleton aspect-[3/4]" />;
  return <img src={url} alt="Foto de progreso" className={className} />;
}

function PhotoTile({ photo, onOpen, onDelete }: { photo: ProgressPhotoRow; onOpen: () => void; onDelete: () => void }) {
  return (
    <li className="relative overflow-hidden rounded-2xl border border-border">
      <button type="button" onClick={onOpen} className="block w-full" aria-label={`Ver foto del ${formatLongDate(photo.taken_on)}`}>
        <PhotoImage path={photo.storage_path} className="aspect-[3/4] w-full object-cover" />
      </button>
      <div className="flex items-center justify-between bg-surface px-2 py-1.5 text-xs">
        <span>{formatShortDate(photo.taken_on)} <Badge className="ml-1">{photo.pose === "front" ? "Frente" : photo.pose === "side" ? "Perfil" : photo.pose === "back" ? "Espalda" : "Otra"}</Badge></span>
        <IconButton label="Borrar foto" onClick={onDelete} className="h-8 w-8"><Trash2 className="h-4 w-4" /></IconButton>
      </div>
    </li>
  );
}
