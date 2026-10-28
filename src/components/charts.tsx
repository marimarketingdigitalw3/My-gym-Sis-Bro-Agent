// Gráficos con los colores del tema activo. Solo muestran datos registrados por la persona.
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatShortDate } from "@/lib/dates";

const color = (v: string) => `rgb(var(--${v}))`;
const axis = { stroke: color("muted"), fontSize: 12, tickLine: false, axisLine: false } as const;

function tooltipStyle() {
  return {
    contentStyle: { background: color("surface"), border: `1px solid ${color("border")}`, borderRadius: 12, color: color("text"), fontSize: 13 },
    labelStyle: { color: color("muted") },
  };
}

export function TrendChart({ data, unit, height = 220, label }: { data: { date: string; value: number }[]; unit: string; height?: number; label: string }) {
  return (
    <div role="img" aria-label={`${label}: ${data.length} registros`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={color("border")} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickFormatter={formatShortDate} {...axis} minTickGap={24} />
          <YAxis domain={["auto", "auto"]} {...axis} width={44} />
          <Tooltip {...tooltipStyle()} labelFormatter={(d) => formatShortDate(String(d))} formatter={(v) => [`${v} ${unit}`, label]} />
          <Line type="monotone" dataKey="value" stroke={color("primary-strong")} strokeWidth={2.5} dot={{ r: 3, fill: color("primary-strong") }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WeeklyBars({ data, label, height = 180, unit = "" }: { data: { label: string; value: number }[]; label: string; height?: number; unit?: string }) {
  return (
    <div role="img" aria-label={label} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={color("border")} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" {...axis} />
          <YAxis allowDecimals={false} {...axis} width={36} />
          <Tooltip {...tooltipStyle()} cursor={{ fill: color("surface-2") }} formatter={(v) => [`${v}${unit}`, label]} />
          <Bar dataKey="value" fill={color("primary-strong")} radius={[8, 8, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
