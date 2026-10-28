import clsx from "clsx";
import { Apple, Bot, CalendarHeart, Dumbbell, Home, LineChart, Library, Settings } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { db } from "@/services/data";
import { useBundle } from "./providers";
import { BrandMark } from "@/components/BrandMark";

export function useNavItems() {
  const bundle = useBundle();
  return [
    { to: "/", label: "Inicio", icon: Home, end: true },
    { to: "/workouts", label: "Entrenos", icon: Dumbbell },
    { to: "/exercises", label: "Ejercicios", icon: Library },
    { to: "/nutrition", label: "Nutrición", icon: Apple },
    { to: "/progress", label: "Progreso", icon: LineChart },
    { to: "/coach", label: "Coach", icon: Bot },
    ...(bundle.settings.cycle_tracking_enabled ? [{ to: "/cycle", label: "Ciclo", icon: CalendarHeart }] : []),
    { to: "/settings", label: "Ajustes", icon: Settings },
  ];
}

// En móvil la barra inferior muestra las secciones principales; el resto está en "Más" (Ajustes).
const MOBILE_PRIMARY = ["/", "/workouts", "/nutrition", "/progress", "/coach"];

export function AppShell() {
  const items = useNavItems();
  const mobile = items.filter((i) => MOBILE_PRIMARY.includes(i.to));
  return (
    <div className="min-h-dvh md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2">
        Saltar al contenido
      </a>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface px-4 py-6 md:flex">
        <BrandMark />
        <nav aria-label="Principal" className="mt-8 flex flex-1 flex-col gap-1">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => clsx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition",
                isActive ? "bg-primary/15 text-primary-strong" : "text-muted hover:bg-surface-2 hover:text-text",
              )}>
              <Icon className="h-5 w-5" aria-hidden /> {label}
            </NavLink>
          ))}
        </nav>
        {db.mode === "local" && <DemoBadge />}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-bg/90 px-4 py-3 backdrop-blur md:hidden">
          <BrandMark compact />
          <NavLink to="/settings" aria-label="Ajustes" className="rounded-full p-2 text-muted hover:bg-surface-2">
            <Settings className="h-5 w-5" />
          </NavLink>
        </header>
        {db.mode === "local" && <div className="px-4 pt-3 md:hidden"><DemoBadge /></div>}
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-5 sm:px-6 md:pb-10 md:pt-8">
          <Outlet />
        </main>
      </div>

      <nav aria-label="Principal móvil" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {mobile.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink to={to} end={end}
                className={({ isActive }) => clsx("flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold", isActive ? "text-primary-strong" : "text-muted")}>
                <Icon className="h-[22px] w-[22px]" aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export function DemoBadge() {
  return (
    <p className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-text">
      <strong>Modo demo local.</strong> Sin Supabase configurado: tus datos solo se guardan en este navegador y el coach usa respuestas predefinidas.
    </p>
  );
}
