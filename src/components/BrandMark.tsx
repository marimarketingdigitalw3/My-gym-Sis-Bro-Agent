import { useUserData } from "@/app/providers";
import { storedTheme } from "@/app/providers";

/** Logotipo: el nombre cambia con la experiencia elegida. */
export function BrandMark({ compact = false }: { compact?: boolean }) {
  const { bundle } = useUserData();
  const theme = bundle?.profile.theme ?? storedTheme();
  const name = theme === "bro" ? "Gym Bro" : theme === "sis" ? "My Gym/Sis" : "My Gym";
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 64 64" className={compact ? "h-8 w-8" : "h-10 w-10"} aria-hidden>
        <rect width="64" height="64" rx="16" fill="rgb(var(--primary-strong))" />
        <path d="M14 28h6v8h-6zM44 28h6v8h-6zM20 24h5v16h-5zM39 24h5v16h-5zM25 30h14v4H25z" fill="rgb(var(--on-primary))" />
      </svg>
      <span className="font-display text-lg font-semibold tracking-tight">{name}</span>
    </div>
  );
}
