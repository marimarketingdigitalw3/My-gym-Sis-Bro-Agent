import { GymBotIcon, GymBotWordmark } from "./GymBot";

/** Logotipo de la app: ícono de Gym Bot y palabra "gym bot". */
export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5" role="img" aria-label="GYM BOT">
      <GymBotIcon size={compact ? 34 : 42} />
      <GymBotWordmark className={compact ? "text-[22px]" : "text-[26px]"} />
    </div>
  );
}
