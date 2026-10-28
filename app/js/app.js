import { addDays, today } from "./dates.js";
import { averageCycleLength, getCycleInfo, phaseForDay, PHASES } from "./cycle.js";
import { ACTIVITY, GOALS, QUICK_FOODS, dailyTargets, sumMeals } from "./nutrition.js";
import {
  PROGRAM_DAYS, STATS, levelFor, programDay, questsFor, stageFor, statTotals, streakFor, totalXP,
} from "./quests.js";
import { clear, load, save } from "./store.js";

const MOODS = ["😊", "😐", "😔", "😤", "😴"];
const SYMPTOMS = ["Cólicos", "Hinchazón", "Dolor de cabeza", "Antojos", "Acné", "Fatiga"];

let state = load();
let tab = "today";
const root = document.getElementById("app");

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const fmt = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es", { day: "numeric", month: "short" });

function commit() {
  save(state);
  render();
}

function context() {
  const date = today();
  const p = state.profile;
  const cycle = getCycleInfo(p, date);
  const day = Math.min(programDay(p.programStart, date), PROGRAM_DAYS);
  return {
    date,
    p,
    cycle,
    day,
    finished: programDay(p.programStart, date) > PROGRAM_DAYS,
    quests: questsFor(day, cycle.phase),
    targets: dailyTargets(p, cycle.phase),
  };
}

// ---------- Onboarding ----------

function renderOnboarding() {
  const opts = (obj, sel) =>
    Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${v.label}</option>`).join("");
  root.innerHTML = `
    <section class="onboarding">
      <h1>Sis Bro</h1>
      <p class="lead">66 días para entrenar, comer y crear hábitos al ritmo de tu ciclo.</p>
      <form id="onb" class="card form">
        <label>Tu nombre<input name="name" required maxlength="30" /></label>
        <div class="row">
          <label>Edad<input name="age" type="number" min="14" max="70" value="28" required /></label>
          <label>Altura (cm)<input name="height" type="number" min="130" max="210" value="162" required /></label>
          <label>Peso (kg)<input name="weight" type="number" min="35" max="200" step="0.1" value="62" required /></label>
        </div>
        <label>Actividad<select name="activity">${opts(ACTIVITY, "moderate")}</select></label>
        <label>Objetivo<select name="goal">${opts(GOALS, "maintain")}</select></label>
        <label>¿Cuándo empezó tu última regla?<input name="lastPeriodStart" type="date" max="${today()}" value="${addDays(today(), -10)}" required /></label>
        <div class="row">
          <label>Duración del ciclo (días)<input name="cycleLength" type="number" min="21" max="40" value="28" required /></label>
          <label>Días de sangrado<input name="periodLength" type="number" min="2" max="8" value="5" required /></label>
        </div>
        <button class="primary" type="submit">Crear mi plan de 66 días</button>
        <p class="fine">Tus datos se guardan solo en este dispositivo. No es un método anticonceptivo ni un consejo médico.</p>
      </form>
    </section>`;
  root.querySelector("#onb").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    state.profile = {
      name: f.name.trim(),
      age: +f.age,
      height: +f.height,
      weight: +f.weight,
      activity: f.activity,
      goal: f.goal,
      lastPeriodStart: f.lastPeriodStart,
      cycleLength: +f.cycleLength,
      periodLength: +f.periodLength,
      programStart: today(),
    };
    state.periodStarts = [f.lastPeriodStart];
    commit();
  });
}

// ---------- Hoy ----------

function renderToday(ctx) {
  const { date, cycle, day, quests, finished } = ctx;
  const entry = state.questLog[date]?.done ?? {};
  const xp = totalXP(state.questLog);
  const lvl = levelFor(xp);
  const st = streakFor(state.questLog, state.profile.programStart, date);
  const stage = stageFor(day);

  return `
    <div class="card phase phase-${cycle.phase}">
      <div class="phase-top">
        <span class="badge">${cycle.emoji} Fase ${cycle.name} · día ${cycle.day}</span>
        <span class="badge light">Energía: ${cycle.energy}</span>
      </div>
      <h2>${finished ? "¡Completaste los 66 días!" : `Día ${day} de ${PROGRAM_DAYS}`}</h2>
      <div class="bar"><span style="width:${(day / PROGRAM_DAYS) * 100}%"></span></div>
      <p class="muted">Etapa ${stage.name} · ${stage.quests} misiones al día</p>
      <p>${cycle.tip}</p>
    </div>

    <div class="stats-row">
      <div class="mini"><b>Nv. ${lvl.level}</b><span>${xp} XP</span></div>
      <div class="mini"><b>🔥 ${st.streak}</b><span>racha</span></div>
      <div class="mini"><b>🧊 ${st.freezes}</b><span>comodines</span></div>
    </div>

    <h3>Misiones de hoy</h3>
    <ul class="quests">
      ${quests.map((q) => `
        <li class="${entry[q.id] ? "done" : ""}">
          <label>
            <input type="checkbox" data-quest="${q.id}" ${entry[q.id] ? "checked" : ""} />
            <span class="q-body"><small>${q.area} · ${STATS[q.stat]}</small>${q.title}</span>
            <span class="xp">+${q.xp}</span>
          </label>
        </li>`).join("")}
    </ul>
    <p class="fine">Completa todas para un bonus del 50 %. Un día sin misiones gasta un comodín, no reinicia el programa.</p>

    <div class="card">
      <h3>Entreno sugerido</h3>
      <p><b>${cycle.training}</b> · intensidad ${cycle.intensity.toLowerCase()}</p>
    </div>`;
}

function toggleQuest(id, checked) {
  const { date, quests } = context();
  const q = quests.find((x) => x.id === id);
  const entry = state.questLog[date] ?? { total: quests.length, done: {} };
  entry.total = quests.length;
  if (checked) entry.done[id] = { xp: q.xp, stat: q.stat };
  else delete entry.done[id];
  state.questLog[date] = entry;
  commit();
}

// ---------- Comida ----------

function renderFood(ctx) {
  const { date, cycle, targets } = ctx;
  const meals = state.meals[date] ?? [];
  const eaten = sumMeals(meals);
  const pct = (a, b) => Math.min(100, Math.round((a / b) * 100));
  const macro = (label, key, unit) => `
    <div class="macro">
      <div class="macro-head"><span>${label}</span><span>${Math.round(eaten[key])} / ${targets[key]} ${unit}</span></div>
      <div class="bar"><span style="width:${pct(eaten[key], targets[key])}%"></span></div>
    </div>`;

  return `
    <div class="card">
      <h2>${Math.max(0, targets.kcal - eaten.kcal)} kcal restantes</h2>
      <p class="muted">Objetivo de hoy: ${targets.kcal} kcal${cycle.phase === "luteal" ? " (incluye +150 por fase lútea)" : ""}</p>
      ${macro("Calorías", "kcal", "kcal")}
      ${macro("Proteína", "protein", "g")}
      ${macro("Carbohidratos", "carbs", "g")}
      ${macro("Grasa", "fat", "g")}
      <p class="tip">${cycle.emoji} ${cycle.food}</p>
    </div>

    <h3>Registrado hoy</h3>
    ${meals.length ? `<ul class="list">${meals.map((m, i) => `
      <li><span>${esc(m.name)}<small>${m.kcal} kcal · P${m.protein} C${m.carbs} G${m.fat}</small></span>
      <button class="ghost" data-del-meal="${i}" aria-label="Borrar">✕</button></li>`).join("")}</ul>`
      : `<p class="muted">Aún no registras comidas.</p>`}

    <h3>Añadir rápido</h3>
    <div class="chips">${QUICK_FOODS.map((f, i) => `<button class="chip" data-quick="${i}">${f.name}</button>`).join("")}</div>

    <h3>Añadir manual</h3>
    <form id="meal" class="card form">
      <label>Alimento<input name="name" required maxlength="60" /></label>
      <div class="row">
        <label>kcal<input name="kcal" type="number" min="0" required /></label>
        <label>Prot. (g)<input name="protein" type="number" min="0" value="0" /></label>
        <label>Carb. (g)<input name="carbs" type="number" min="0" value="0" /></label>
        <label>Grasa (g)<input name="fat" type="number" min="0" value="0" /></label>
      </div>
      <button class="primary" type="submit">Añadir</button>
    </form>`;
}

function addMeal(meal) {
  const date = today();
  state.meals[date] = [...(state.meals[date] ?? []), meal];
  commit();
}

// ---------- Ciclo ----------

function renderCycle(ctx) {
  const { date, cycle, p } = ctx;
  const start = addDays(date, -(cycle.day - 1));
  const mood = state.moods[date] ?? { mood: null, symptoms: [] };
  const cells = Array.from({ length: p.cycleLength }, (_, i) => {
    const d = i + 1;
    const ph = phaseForDay(d, p.cycleLength, p.periodLength);
    return `<div class="cell phase-${ph} ${d === cycle.day ? "now" : ""}" title="${fmt(addDays(start, i))}">${d}</div>`;
  }).join("");

  return `
    <div class="card">
      <h2>${cycle.emoji} Día ${cycle.day} · ${cycle.name}</h2>
      <div class="grid">${cells}</div>
      <div class="legend">${Object.entries(PHASES).map(([k, v]) => `<span><i class="dot phase-${k}"></i>${v.name}</span>`).join("")}</div>
    </div>

    <div class="card">
      <h3>Predicciones</h3>
      <ul class="facts">
        <li><span>Próxima regla</span><b>${fmt(cycle.nextPeriod)} (en ${cycle.daysToPeriod} días)</b></li>
        <li><span>Ovulación estimada</span><b>${fmt(cycle.ovulation)}</b></li>
        <li><span>Ventana fértil</span><b>${fmt(cycle.fertileStart)} a ${fmt(cycle.fertileEnd)}</b></li>
        <li><span>Ciclo medio</span><b>${p.cycleLength} días</b></li>
      </ul>
      <form id="period" class="inline">
        <label>Me llegó la regla el<input name="date" type="date" max="${date}" value="${date}" required /></label>
        <button class="primary" type="submit">Registrar</button>
      </form>
    </div>

    <div class="card">
      <h3>¿Cómo te sientes hoy?</h3>
      <div class="chips">${MOODS.map((m) => `<button class="chip big ${mood.mood === m ? "on" : ""}" data-mood="${m}">${m}</button>`).join("")}</div>
      <div class="chips">${SYMPTOMS.map((s) => `<button class="chip ${mood.symptoms.includes(s) ? "on" : ""}" data-symptom="${s}">${s}</button>`).join("")}</div>
    </div>`;
}

function registerPeriod(dateISO) {
  const starts = [...new Set([...state.periodStarts, dateISO])].sort();
  state.periodStarts = starts;
  state.profile.lastPeriodStart = starts[starts.length - 1];
  state.profile.cycleLength = averageCycleLength(starts, state.profile.cycleLength);
  commit();
}

function updateMood(patch) {
  const date = today();
  const cur = state.moods[date] ?? { mood: null, symptoms: [] };
  state.moods[date] = { ...cur, ...patch(cur) };
  commit();
}

// ---------- Progreso y Bro ----------

function broMessage({ cycle, p }) {
  return `${p.name} está en fase ${cycle.name.toLowerCase()} (día ${cycle.day}).
Energía: ${cycle.energy.toLowerCase()}. Entreno sugerido: ${cycle.training.toLowerCase()}.
Cómo apoyar hoy: ${cycle.bro}`;
}

function renderProgress(ctx) {
  const xp = totalXP(state.questLog);
  const lvl = levelFor(xp);
  const st = streakFor(state.questLog, ctx.p.programStart, ctx.date);
  const stats = statTotals(state.questLog);
  const maxStat = Math.max(50, ...Object.values(stats));
  const doneDays = Object.values(state.questLog).filter((e) => Object.keys(e.done).length).length;

  return `
    <div class="card">
      <h2>Nivel ${lvl.level}</h2>
      <div class="bar"><span style="width:${(lvl.current / lvl.needed) * 100}%"></span></div>
      <p class="muted">${lvl.current} / ${lvl.needed} XP para el nivel ${lvl.level + 1}</p>
      <ul class="facts">
        <li><span>Días con misiones</span><b>${doneDays} de ${Math.min(ctx.day, PROGRAM_DAYS)}</b></li>
        <li><span>Racha actual / mejor</span><b>${st.streak} / ${st.best}</b></li>
        <li><span>Comodines usados</span><b>${st.used}</b></li>
      </ul>
    </div>

    <div class="card">
      <h3>Tu personaje</h3>
      ${Object.entries(STATS).map(([k, label]) => `
        <div class="macro">
          <div class="macro-head"><span>${label}</span><span>${stats[k]}</span></div>
          <div class="bar"><span style="width:${(stats[k] / maxStat) * 100}%"></span></div>
        </div>`).join("")}
    </div>

    <div class="card">
      <h3>Modo Bro</h3>
      <p class="muted">Comparte con tu compañero de gym o pareja cómo apoyarte hoy. Los síntomas no se incluyen.</p>
      <textarea id="bro" rows="4" readonly>${esc(broMessage(ctx))}</textarea>
      <button class="primary" id="share">Compartir</button>
    </div>

    <button class="ghost danger" id="reset">Borrar todos mis datos</button>`;
}

async function shareBro() {
  const text = document.getElementById("bro").value;
  try {
    if (navigator.share) await navigator.share({ text });
    else {
      await navigator.clipboard.writeText(text);
      alert("Mensaje copiado.");
    }
  } catch {
    // La persona canceló o el navegador no lo permite.
  }
}

// ---------- Shell ----------

const TABS = [
  ["today", "Hoy", renderToday],
  ["food", "Comida", renderFood],
  ["cycle", "Ciclo", renderCycle],
  ["progress", "Progreso", renderProgress],
];

function render() {
  if (!state.profile) return renderOnboarding();
  const ctx = context();
  const current = TABS.find(([k]) => k === tab);
  root.innerHTML = `
    <header class="top"><span>Hola, ${esc(ctx.p.name)}</span><span class="muted">${fmt(ctx.date)}</span></header>
    <main>${current[2](ctx)}</main>
    <nav class="tabs">${TABS.map(([k, label]) => `<button data-tab="${k}" class="${k === tab ? "on" : ""}">${label}</button>`).join("")}</nav>`;
}

root.addEventListener("click", (e) => {
  const t = e.target.closest("button");
  if (!t) return;
  const d = t.dataset;
  if (d.tab) { tab = d.tab; render(); window.scrollTo(0, 0); }
  else if (d.quick) addMeal({ ...QUICK_FOODS[+d.quick] });
  else if (d.delMeal) { state.meals[today()].splice(+d.delMeal, 1); commit(); }
  else if (d.mood) updateMood((c) => ({ mood: c.mood === d.mood ? null : d.mood }));
  else if (d.symptom) updateMood((c) => ({
    symptoms: c.symptoms.includes(d.symptom) ? c.symptoms.filter((s) => s !== d.symptom) : [...c.symptoms, d.symptom],
  }));
  else if (t.id === "share") shareBro();
  else if (t.id === "reset" && confirm("¿Seguro? Se borrará todo tu progreso.")) { clear(); state = load(); tab = "today"; render(); }
});

root.addEventListener("change", (e) => {
  if (e.target.dataset.quest) toggleQuest(e.target.dataset.quest, e.target.checked);
});

root.addEventListener("submit", (e) => {
  const f = Object.fromEntries(new FormData(e.target));
  if (e.target.id === "meal") {
    e.preventDefault();
    addMeal({ name: f.name.trim(), kcal: +f.kcal, protein: +f.protein, carbs: +f.carbs, fat: +f.fat });
  } else if (e.target.id === "period") {
    e.preventDefault();
    registerPeriod(f.date);
  }
});

render();
