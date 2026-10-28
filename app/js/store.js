// Persistencia local. Todo queda en el dispositivo.
const KEY = "sisbro:v1";

export function emptyState() {
  return { profile: null, periodStarts: [], questLog: {}, meals: {}, moods: {} };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...emptyState(), ...JSON.parse(raw) } : emptyState();
  } catch {
    return emptyState();
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Sin almacenamiento (modo privado): la app sigue funcionando en memoria.
  }
}

export function clear() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nada que borrar.
  }
}
