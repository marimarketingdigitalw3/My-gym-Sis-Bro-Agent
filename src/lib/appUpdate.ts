// Mantiene la app al día tras cada despliegue, sin service worker.
// - Al volver a primer plano compara el script principal publicado con el cargado; si cambió, recarga.
// - Si falla la carga de una pantalla diferida (archivo de un despliegue anterior), recarga una vez.
const RELOAD_KEY = "mgs:reloaded-at";

function currentEntry(): string | null {
  const s = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  return s ? new URL(s.src, location.href).pathname : null;
}

function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < 30_000) return; // evita bucles si el servidor aún no sirve la versión nueva
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // sin almacenamiento: recargamos igualmente
  }
  location.reload();
}

async function checkForUpdate(loaded: string) {
  try {
    const html = await (await fetch("/", { cache: "no-store" })).text();
    const latest = html.match(/\/assets\/index-[^"']+\.js/)?.[0];
    if (latest && latest !== loaded) reloadOnce();
  } catch {
    // sin conexión: se vuelve a intentar en la próxima visita
  }
}

export function startAppUpdates() {
  window.addEventListener("vite:preloadError", (e) => {
    e.preventDefault();
    reloadOnce();
  });
  const loaded = currentEntry();
  if (!loaded) return;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkForUpdate(loaded);
  });
}
