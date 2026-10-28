import clsx from "clsx";
import { Apple, Bot, CalendarHeart, Dumbbell, Home, LineChart, Library, Settings } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
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

// En móvil la barra flotante muestra las secciones principales; el resto se abre desde Ajustes.
const MOBILE_PRIMARY = ["/", "/workouts", "/nutrition", "/progress", "/coach"];

export function greeting(date = new Date()): string {
  const h = date.getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "·";
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-full bg-secondary font-semibold text-text ring-2 ring-surface"
      style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials}
    </span>
  );
}

export function AppShell() {
  const bundle = useBundle();
  const items = useNavItems();
  const mobile = items.filter((i) => MOBILE_PRIMARY.includes(i.to));
  const name = bundle.profile.display_name;
  return (
    <div className="min-h-dvh md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2">
        Saltar al contenido
      </a>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border/60 bg-surface/70 px-4 py-6 backdrop-blur-xl md:flex">
        <BrandMark />
        <div className="mt-8 flex items-center gap-3 rounded-3xl bg-surface-2/70 p-3">
          <Avatar name={name} size={40} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{greeting()}</p>
            <p className="truncate text-sm text-muted">{name}</p>
          </div>
        </div>
        <nav aria-label="Principal" className="mt-6 flex flex-1 flex-col gap-1">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => clsx(
                "flex items-center gap-3 rounded-full px-4 py-2.5 text-[15px] font-medium transition",
                isActive ? "bg-primary-strong text-on-primary shadow-sm" : "text-muted hover:bg-surface-2 hover:text-text",
              )}>
              <Icon className="h-5 w-5" aria-hidden /> {label}
            </NavLink>
          ))}
        </nav>
        {db.mode === "local" && <DemoBadge />}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 pb-2 pt-[calc(env(safe-area-inset-top,0px)+12px)] backdrop-blur-md md:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={name} />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[17px] font-semibold">{greeting()}</p>
              <p className="truncate text-sm text-muted">{name}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link to="/coach" aria-label="Abrir Gym AI Coach" className="grid h-12 w-12 place-items-center rounded-full bg-primary-strong text-on-primary shadow-md">
              <Bot className="h-5 w-5" />
            </Link>
            <Link to="/settings" aria-label="Ajustes" className="grid h-12 w-12 place-items-center rounded-full bg-surface text-text shadow-md">
              <Settings className="h-5 w-5" />
            </Link>
          </div>
        </header>
        {db.mode === "local" && <div className="px-4 pt-2 md:hidden"><DemoBadge /></div>}
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-32 pt-4 sm:px-6 md:pb-10 md:pt-8">
          <Outlet />
        </main>
      </div>

      <nav aria-label="Principal móvil" className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] md:hidden">
        <ul className="mx-auto flex max-w-md items-center justify-between gap-1 rounded-[2rem] border border-border/60 bg-surface/90 p-1.5 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.35)] backdrop-blur-xl">
          {mobile.map(({ to, label, icon: Icon, end }) => (
            <li key={to} className="flex-1">
              <NavLink to={to} end={end}
                className={({ isActive }) => clsx(
                  "flex flex-col items-center gap-0.5 rounded-[1.6rem] py-2.5 text-[11px] font-semibold transition",
                  isActive ? "bg-primary-strong text-on-primary shadow-md" : "text-muted hover:text-text",
                )}>
                <Icon className="h-[21px] w-[21px]" aria-hidden />
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
    <p className="rounded-2xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-text">
      <strong>Modo demo local.</strong> Sin Supabase configurado: tus datos solo se guardan en este navegador y el coach usa respuestas predefinidas.
    </p>
  );
}
