import { CalendarHeart, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useBundle, useUserData } from "@/app/providers";
import {
  Badge, Button, Card, CardHeader, Chip, EmptyState, ErrorState, Field, IconButton, Input, Modal, Notice, PageHeader, PageSkeleton, Select, Textarea, Toggle, cx,
} from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import {
  CYCLE_DISCLAIMER, cycleTrainingSuggestion, estimateCycle, PHASE_INFO, phaseForDay, SYMPTOMS,
} from "@/lib/cycle";
import { addDays, diffDays, formatLongDate, formatShortDate, todayISO, weekdayIndex, WEEKDAYS_SHORT } from "@/lib/dates";
import { errorMessage, useAsync } from "@/lib/useAsync";
import { saveCycleSettings, updateSettings } from "@/services/profile";
import { deleteAllCycleData, listCycleLogs, saveCycleLog } from "@/services/tracking";
import type { CycleLogRow, CycleSettingsRow } from "@/types/db";

export default function CyclePage() {
  const bundle = useBundle();
  const { refresh } = useUserData();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (!bundle.settings.cycle_tracking_enabled) {
    return (
      <div>
        <PageHeader title="Cycle Wellness" />
        <EmptyState icon={<CalendarHeart className="h-5 w-5" />} title="Cycle Wellness está desactivado"
          description="Es opcional. Si menstrúas y quieres registrar síntomas, energía y fechas, puedes activarlo. Nunca te obligará a entrenar menos."
          action={<Button loading={busy} onClick={async () => {
            setBusy(true);
            try { await updateSettings({ cycle_tracking_enabled: true }); await refresh(); toast("Cycle Wellness activado"); } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
          }}>Activar Cycle Wellness</Button>} />
      </div>
    );
  }
  return <CycleEnabled />;
}

function CycleEnabled() {
  const bundle = useBundle();
  const { refresh } = useUserData();
  const toast = useToast();
  const today = todayISO();
  const { data, loading, error, reload, setData } = useAsync(listCycleLogs, []);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const estimate = useMemo(() => estimateCycle(bundle.cycle, data ?? [], today), [bundle.cycle, data, today]);

  if (loading && !data) return <PageSkeleton />;
  if (error || !data) return <ErrorState message={error ?? "Error"} onRetry={reload} />;

  const todayLog = data.find((l) => l.logged_on === today) ?? null;
  const tip = cycleTrainingSuggestion(estimate, todayLog, bundle.cycle?.period_training_preference);
  const selectedLog = data.find((l) => l.logged_on === selected) ?? null;
  const periodStarts = new Set(data.filter((l) => l.period_start).map((l) => l.logged_on));
  if (bundle.cycle?.last_period_start) periodStarts.add(bundle.cycle.last_period_start);

  const phaseOf = (date: string) => {
    if (!estimate.hasData || estimate.confidence === "none" || !estimate.currentDay) return null;
    const lastStart = addDays(today, -(estimate.currentDay - 1));
    const d = diffDays(lastStart, date);
    if (d < 0 || d >= estimate.cycleLength * 2) return null;
    return phaseForDay((d % estimate.cycleLength) + 1, estimate.cycleLength, estimate.periodLength);
  };

  const first = `${month}-01`;
  const lead = weekdayIndex(first);
  const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const shiftMonth = (n: number) => {
    const d = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + n, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Cycle Wellness" subtitle="Tus síntomas y tu energía mandan sobre el calendario."
        action={<Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>Ajustes del ciclo</Button>} />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <IconButton label="Mes anterior" onClick={() => shiftMonth(-1)}><ChevronLeft className="h-5 w-5" /></IconButton>
            <h2 className="text-lg font-semibold first-letter:uppercase">{new Date(`${first}T12:00:00`).toLocaleDateString("es", { month: "long", year: "numeric" })}</h2>
            <IconButton label="Mes siguiente" onClick={() => shiftMonth(1)}><ChevronRight className="h-5 w-5" /></IconButton>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">{WEEKDAYS_SHORT.map((d) => <span key={d}>{d}</span>)}</div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: lead }, (_, i) => <span key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const date = `${month}-${String(i + 1).padStart(2, "0")}`;
              const phase = phaseOf(date);
              const log = data.find((l) => l.logged_on === date);
              const isStart = periodStarts.has(date);
              return (
                <button key={date} type="button" onClick={() => setSelected(date)} aria-pressed={selected === date}
                  aria-label={`${formatLongDate(date)}${phase ? `, ${PHASE_INFO[phase].name}` : ""}${isStart ? ", inicio de periodo" : ""}${log ? ", con registro" : ""}`}
                  className={cx("relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition",
                    selected === date ? "ring-2 ring-primary-strong" : "", date === today && "font-bold", date > today && "opacity-70")}
                  style={phase ? { background: `${PHASE_INFO[phase].color}${date > today ? "22" : "40"}` } : undefined}>
                  {i + 1}
                  <span className="absolute bottom-1 flex gap-0.5">
                    {isStart && <span className="h-1.5 w-1.5 rounded-full bg-danger" />}
                    {log && log.symptoms.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-primary-strong" />}
                  </span>
                </button>
              );
            })}
          </div>
          {estimate.confidence !== "none" && estimate.hasData && (
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
              {(Object.keys(PHASE_INFO) as (keyof typeof PHASE_INFO)[]).map((p) => (
                <span key={p} className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ background: PHASE_INFO[p].color }} />{PHASE_INFO[p].name}</span>
              ))}
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-danger" />Inicio de periodo</span>
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Hoy" />
            {estimate.phase && <Badge tone="primary">{PHASE_INFO[estimate.phase].name}{estimate.currentDay ? ` · día ${estimate.currentDay}` : ""}</Badge>}
            {estimate.confidence === "low" && <Badge tone="warning" className="ml-1">Confianza baja</Badge>}
            <p className="mt-2 font-semibold">{tip.headline}</p>
            <p className="mt-1 text-sm text-muted">{tip.explanation}</p>
            {tip.ideas.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm">{tip.ideas.map((i) => <li key={i}>{i}</li>)}</ul>}
            {tip.offerLighterSession && <Link to="/exercises?category=mobility" className="mt-3 block"><Button variant="outline" size="sm" block>Ver ejercicios de movilidad</Button></Link>}
          </Card>
          <Card>
            <CardHeader title="Próximo periodo" />
            {estimate.nextPeriodWindow ? (
              <>
                <p className="text-lg font-semibold">{formatShortDate(estimate.nextPeriodStart!)}</p>
                <p className="text-sm text-muted">Ventana probable: {formatShortDate(estimate.nextPeriodWindow[0])} a {formatShortDate(estimate.nextPeriodWindow[1])}</p>
                <p className="mt-1 text-xs text-muted">Ciclo de {estimate.cycleLength} días ({estimate.lengthSource === "logged" ? "según tus registros" : estimate.lengthSource === "typical" ? "según lo que indicaste" : "valor de referencia"}).</p>
              </>
            ) : <p className="text-sm text-muted">Necesitamos al menos la fecha de inicio de un periodo para estimarlo.</p>}
            {estimate.notes.map((n) => <p key={n} className="mt-2 text-xs text-muted">{n}</p>)}
          </Card>
        </div>
      </div>

      <DayLogCard key={selected} date={selected} log={selectedLog} onSaved={(row) => setData((d) => [...(d ?? []).filter((x) => x.logged_on !== row.logged_on), row].sort((a, b) => a.logged_on.localeCompare(b.logged_on)))} />

      <p className="text-xs text-muted">{CYCLE_DISCLAIMER}</p>

      <CycleSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={bundle.cycle}
        onSaved={async () => { await refresh(); setSettingsOpen(false); toast("Ajustes del ciclo guardados"); }}
        onDeleted={async () => { await refresh(); await reload(); setSettingsOpen(false); toast("Datos del ciclo borrados"); }} />
    </div>
  );
}

function DayLogCard({ date, log, onSaved }: { date: string; log: CycleLogRow | null; onSaved: (r: CycleLogRow) => void }) {
  const toast = useToast();
  const [periodStart, setPeriodStart] = useState(log?.period_start ?? false);
  const [flow, setFlow] = useState<CycleLogRow["flow"]>(log?.flow ?? null);
  const [symptoms, setSymptoms] = useState<string[]>(log?.symptoms ?? []);
  const [energy, setEnergy] = useState<number | null>(log?.energy ?? null);
  const [notes, setNotes] = useState(log?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const future = date > todayISO();
  return (
    <Card>
      <CardHeader title={`Registro del ${formatLongDate(date)}`} subtitle={future ? "No puedes registrar días futuros." : "Todo es opcional."} />
      {!future && (
        <div className="space-y-4 text-sm">
          <Toggle label="Hoy empezó mi periodo" checked={periodStart} onChange={setPeriodStart} />
          <div>
            <p className="mb-1.5 font-medium">Flujo</p>
            <div className="flex flex-wrap gap-1.5">
              {([["none", "Ninguno"], ["spotting", "Manchado"], ["light", "Ligero"], ["medium", "Medio"], ["heavy", "Abundante"]] as const).map(([k, l]) => (
                <Chip key={k} selected={flow === k} onClick={() => setFlow(flow === k ? null : k)}>{l}</Chip>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 font-medium">Síntomas</p>
            <div className="flex flex-wrap gap-1.5">{SYMPTOMS.map((s) => <Chip key={s.key} selected={symptoms.includes(s.key)} onClick={() => setSymptoms(symptoms.includes(s.key) ? symptoms.filter((x) => x !== s.key) : [...symptoms, s.key])}>{s.label}</Chip>)}</div>
          </div>
          <div>
            <p className="mb-1.5 font-medium">Energía</p>
            <div className="flex gap-1.5">{[1, 2, 3, 4, 5].map((n) => <Chip key={n} selected={energy === n} onClick={() => setEnergy(energy === n ? null : n)}>{n}</Chip>)}</div>
          </div>
          <Field label="Notas" optional htmlFor="cnotes"><Textarea id="cnotes" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <Button loading={saving} onClick={async () => {
            setSaving(true);
            try {
              onSaved(await saveCycleLog({ logged_on: date, period_start: periodStart, flow, symptoms, energy, notes: notes.trim() || null }));
              toast("Registro guardado");
            } catch (e) { toast(errorMessage(e), "error"); } finally { setSaving(false); }
          }}>Guardar registro</Button>
        </div>
      )}
    </Card>
  );
}

function CycleSettingsModal({ open, onClose, settings, onSaved, onDeleted }: {
  open: boolean; onClose: () => void; settings: CycleSettingsRow | null; onSaved: () => void; onDeleted: () => void;
}) {
  const toast = useToast();
  const [s, setS] = useState({
    last_period_start: settings?.last_period_start ?? "",
    typical_cycle_length: settings?.typical_cycle_length ?? "",
    typical_period_length: settings?.typical_period_length ?? 5,
    regularity: settings?.regularity ?? "unknown",
    hormonal_contraception: settings?.hormonal_contraception ?? false,
    wants_phase_estimates: settings?.wants_phase_estimates ?? true,
    period_training_preference: settings?.period_training_preference ?? "decide_daily",
  });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const invalid = s.typical_cycle_length !== "" && (Number(s.typical_cycle_length) < 15 || Number(s.typical_cycle_length) > 60);
  return (
    <Modal open={open} onClose={onClose} title="Ajustes del ciclo"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button loading={saving} disabled={invalid} onClick={async () => {
        setSaving(true);
        try {
          await saveCycleSettings({
            last_period_start: s.last_period_start || null,
            typical_cycle_length: s.typical_cycle_length === "" ? null : Number(s.typical_cycle_length),
            typical_period_length: Number(s.typical_period_length) || null,
            regularity: s.regularity as CycleSettingsRow["regularity"],
            hormonal_contraception: s.hormonal_contraception,
            wants_phase_estimates: s.wants_phase_estimates,
            period_training_preference: s.period_training_preference as CycleSettingsRow["period_training_preference"],
          });
          onSaved();
        } catch (e) { toast(errorMessage(e), "error"); } finally { setSaving(false); }
      }}>Guardar</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Inicio del último periodo" htmlFor="s-lmp"><Input id="s-lmp" type="date" max={todayISO()} value={s.last_period_start} onChange={(e) => setS({ ...s, last_period_start: e.target.value })} /></Field>
          <Field label="Duración típica del ciclo" optional htmlFor="s-len" error={invalid ? "Entre 15 y 60 días." : undefined}><Input id="s-len" type="number" value={s.typical_cycle_length} onChange={(e) => setS({ ...s, typical_cycle_length: e.target.value })} /></Field>
          <Field label="Días de sangrado" htmlFor="s-plen"><Input id="s-plen" type="number" min={1} max={10} value={s.typical_period_length} onChange={(e) => setS({ ...s, typical_period_length: Number(e.target.value) })} /></Field>
          <Field label="Regularidad" htmlFor="s-reg"><Select id="s-reg" value={s.regularity} onChange={(e) => setS({ ...s, regularity: e.target.value as CycleSettingsRow["regularity"] })}><option value="regular">Regular</option><option value="irregular">Irregular</option><option value="unknown">No lo sé</option></Select></Field>
        </div>
        <Toggle label="Uso anticoncepción hormonal" checked={s.hormonal_contraception} onChange={(v) => setS({ ...s, hormonal_contraception: v })} />
        <Toggle label="Mostrar fases estimadas" checked={s.wants_phase_estimates} onChange={(v) => setS({ ...s, wants_phase_estimates: v })} />
        <Field label="Durante el periodo prefiero" htmlFor="s-pref">
          <Select id="s-pref" value={s.period_training_preference} onChange={(e) => setS({ ...s, period_training_preference: e.target.value as NonNullable<CycleSettingsRow["period_training_preference"]> })}>
            <option value="as_usual">Entrenar como siempre</option><option value="lighter">Sesiones más ligeras</option><option value="decide_daily">Decidir cada día</option>
          </Select>
        </Field>
        <div className="rounded-2xl border border-danger/30 p-3">
          {!confirmDelete
            ? <Button variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4" /> Borrar todos mis datos del ciclo</Button>
            : (
              <div className="space-y-2">
                <Notice tone="danger">Se borrarán de forma permanente todos tus registros y ajustes del ciclo, y Cycle Wellness se desactivará.</Notice>
                <div className="flex gap-2">
                  <Button variant="danger" onClick={async () => {
                    try { await deleteAllCycleData(); await updateSettings({ cycle_tracking_enabled: false }); onDeleted(); } catch (e) { toast(errorMessage(e), "error"); }
                  }}>Sí, borrar</Button>
                  <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
                </div>
              </div>
            )}
        </div>
      </div>
    </Modal>
  );
}
