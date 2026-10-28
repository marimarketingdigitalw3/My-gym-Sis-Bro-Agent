import { Droplets, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { Card, CardHeader, IconButton, ProgressBar } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/useAsync";
import { setWater } from "@/services/tracking";

const GLASS = 250;

export function WaterTracker({ date, ml, goalMl, onChange }: { date: string; ml: number; goalMl: number | null; onChange: (ml: number) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const goal = goalMl ?? 2000;
  async function change(delta: number) {
    const next = Math.max(0, ml + delta);
    setBusy(true);
    try {
      await setWater(date, next);
      onChange(next);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardHeader title="Hidratación" subtitle={`Guía general: ${(goal / 1000).toFixed(1)} L al día`} icon={<Droplets className="h-5 w-5" />} />
      <div className="flex items-center gap-3">
        <IconButton label="Quitar un vaso" onClick={() => change(-GLASS)} disabled={busy || ml === 0} className="border border-border"><Minus className="h-4 w-4" /></IconButton>
        <div className="flex-1">
          <p className="text-center text-2xl font-semibold" aria-live="polite">{(ml / 1000).toFixed(2)} L</p>
          <ProgressBar value={ml} max={goal} label="Agua de hoy" className="mt-2" />
        </div>
        <IconButton label="Añadir un vaso de 250 ml" onClick={() => change(GLASS)} disabled={busy} className="border border-border"><Plus className="h-4 w-4" /></IconButton>
      </div>
    </Card>
  );
}
