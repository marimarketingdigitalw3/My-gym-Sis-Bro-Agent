import { HeartPulse } from "lucide-react";
import { useState } from "react";
import { Button, Card, CardHeader, Chip, Notice } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { JOINT_LABELS } from "@/lib/labels";
import { errorMessage } from "@/lib/useAsync";
import { saveRecovery } from "@/services/tracking";
import { RED_FLAGS, isUrgent, safetyMessage } from "../../../supabase/functions/_shared/safety.ts";
import type { RecoveryLogRow } from "@/types/db";
import type { JointArea } from "@/types/domain";

const SCALE = [1, 2, 3, 4, 5];

export function RecoveryCheckin({ date, value, onSaved }: { date: string; value: RecoveryLogRow | null; onSaved: (r: RecoveryLogRow) => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState(!value);
  const [energy, setEnergy] = useState<number | null>(value?.energy ?? null);
  const [soreness, setSoreness] = useState<number | null>(value?.soreness ?? null);
  const [sleep, setSleep] = useState<number>(value?.sleep_hours ? Number(value.sleep_hours) : 7);
  const [pain, setPain] = useState<JointArea[]>(value?.pain_areas ?? []);
  const [flags, setFlags] = useState<string[]>(value?.red_flags ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = <T,>(xs: T[], v: T) => (xs.includes(v) ? xs.filter((x) => x !== v) : [...xs, v]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveRecovery({ logged_on: date, energy, soreness, sleep_hours: sleep, pain_areas: pain, red_flags: flags });
      onSaved(saved);
      setEditing(false);
      toast("Registro de bienestar guardado");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  if (!editing && value) {
    return (
      <Card className="tint-pink">
        <CardHeader title="Bienestar de hoy" icon={<HeartPulse className="h-5 w-5" />} action={<Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Editar</Button>} />
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-3xl bg-surface-2/70 p-2"><p className="text-muted">Energía</p><p className="font-semibold">{value.energy ?? "—"}/5</p></div>
          <div className="rounded-3xl bg-surface-2/70 p-2"><p className="text-muted">Sueño</p><p className="font-semibold">{value.sleep_hours ?? "—"} h</p></div>
          <div className="rounded-3xl bg-surface-2/70 p-2"><p className="text-muted">Agujetas</p><p className="font-semibold">{value.soreness ?? "—"}/5</p></div>
        </div>
        {value.red_flags.length > 0 && <div className="mt-3"><Notice tone="danger">{safetyMessage(value.red_flags)}</Notice></div>}
      </Card>
    );
  }

  return (
    <Card className="tint-pink">
      <CardHeader title="¿Cómo te sientes hoy?" subtitle="Ajustamos las recomendaciones a tu recuperación." icon={<HeartPulse className="h-5 w-5" />} />
      <div className="space-y-3 text-sm">
        <div>
          <p className="mb-1.5 font-medium">Energía</p>
          <div className="flex gap-1.5">{SCALE.map((n) => <Chip key={n} selected={energy === n} onClick={() => setEnergy(n)}>{n}</Chip>)}</div>
        </div>
        <div>
          <p className="mb-1.5 font-medium">Agujetas o fatiga muscular</p>
          <div className="flex gap-1.5">{SCALE.map((n) => <Chip key={n} selected={soreness === n} onClick={() => setSoreness(n)}>{n}</Chip>)}</div>
        </div>
        <label className="block">
          <span className="font-medium">Horas de sueño: {sleep} h</span>
          <input type="range" min={0} max={12} step={0.5} value={sleep} onChange={(e) => setSleep(Number(e.target.value))} className="mt-1 w-full accent-[rgb(var(--primary-strong))]" />
        </label>
        <div>
          <p className="mb-1.5 font-medium">¿Dolor en alguna zona?</p>
          <div className="flex flex-wrap gap-1.5">{(Object.keys(JOINT_LABELS) as JointArea[]).map((j) => <Chip key={j} selected={pain.includes(j)} onClick={() => setPain(toggle(pain, j))}>{JOINT_LABELS[j]}</Chip>)}</div>
        </div>
        <details className="rounded-3xl bg-surface-2/70 p-3">
          <summary className="cursor-pointer font-medium">Síntomas de alarma</summary>
          <div className="mt-2 space-y-1.5">
            {RED_FLAGS.map((f) => (
              <label key={f.key} className="flex items-start gap-2">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[rgb(var(--primary-strong))]" checked={flags.includes(f.key)} onChange={() => setFlags(toggle(flags, f.key))} />
                {f.label}
              </label>
            ))}
          </div>
        </details>
        {isUrgent(flags) && <Notice tone="danger">{safetyMessage(flags)}</Notice>}
        {error && <Notice tone="danger">{error}</Notice>}
        <Button block onClick={save} loading={saving}>Guardar</Button>
      </div>
    </Card>
  );
}
