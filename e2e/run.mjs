// Pruebas de extremo a extremo (modo demo local) con Playwright.
// Uso: npm run build && npm run test:e2e
// Arranca `vite preview`, recorre los flujos principales con varios perfiles y guarda capturas en e2e/screenshots.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const PORT = 4179;
const BASE = `http://localhost:${PORT}`;
const SHOTS = new URL("./screenshots/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const results = [];
async function test(name, fn) {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - started });
    console.log(`✔ ${name}`);
  } catch (e) {
    results.push({ name, ok: false, error: e.message });
    console.log(`✘ ${name}\n   ${e.message.split("\n")[0]}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Grupo de procesos propio para poder cerrar npx y vite juntos al terminar.
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "pipe", detached: true });
const stopServer = () => {
  try {
    process.kill(-server.pid);
  } catch {
    // ya terminó
  }
};
process.on("exit", stopServer);
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error("preview no arrancó")), 20000);
  server.stdout.on("data", (d) => { if (String(d).includes(String(PORT))) { clearTimeout(t); resolve(); } });
});

const browser = await chromium.launch();

async function newPage(viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport, locale: "es-CO" });
  // Sin red externa en CI: bloqueamos las fuentes de Google para no esperar tiempos de espera.
  await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/fonts\.googleapis|ERR_FAILED/.test(m.text())) page.errors.push(m.text()); });
  page.on("dialog", (d) => d.accept());
  return { context, page };
}

const next = (page) => page.getByRole("button", { name: /^Siguiente/ }).click();

async function signup(page, name, email) {
  await page.goto(`${BASE}/signup`);
  await page.getByLabel("Nombre o cómo prefieres que te llamemos").fill(name);
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill("Prueba1234");
  await page.getByLabel("Confirma la contraseña").fill("Prueba1234");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.waitForURL(/\/onboarding/);
}

async function onboarding(page, p) {
  await page.getByRole("button", { name: new RegExp(p.theme) }).first().click();
  await page.getByLabel("Fecha de nacimiento").fill(p.birth);
  await page.getByLabel("Estatura (cm)").fill(String(p.height));
  await page.getByLabel("Peso actual (kg)").fill(String(p.weight));
  if (p.sex) await page.getByLabel("Sexo biológico").selectOption(p.sex);
  await next(page);
  for (const g of p.goals) await page.getByRole("button", { name: g, exact: true }).click();
  await next(page);
  await page.getByRole("button", { name: new RegExp(`^${p.level}`) }).click();
  await page.getByRole("button", { name: `${p.days} días`, exact: true }).click();
  await page.getByRole("button", { name: `${p.minutes} min`, exact: true }).click();
  await next(page);
  await page.getByRole("button", { name: p.environment, exact: true }).click();
  await next(page);
  await page.getByRole("button", { name: /Moderada/ }).click();
  await next(page);
  await page.getByLabel(/Entiendo el aviso/).check();
  for (const l of p.limitations ?? []) await page.getByRole("button", { name: l, exact: true }).click();
  await next(page);
  if (p.diet) await page.getByRole("button", { name: p.diet, exact: true }).click();
  for (const a of p.allergens ?? []) await page.getByRole("button", { name: a, exact: true }).click();
  await next(page);
  await next(page); // composición corporal (opcional)
  // El paso del ciclo menstrual solo aparece para mujeres.
  if (p.sex === "female") {
    if (p.cycle) {
      await page.getByRole("button", { name: /Sí, quiero activarlo/ }).click();
      await page.getByLabel("Primer día de tu último periodo").fill(p.cycle.lastPeriod);
      await page.getByLabel("Regularidad").selectOption(p.cycle.regularity);
      await page.getByRole("button", { name: "Cólicos", exact: true }).click();
    } else {
      await page.getByRole("button", { name: /No, gracias/ }).click();
    }
    await next(page);
  }
  await page.getByText("Revisa tus respuestas").waitFor();
  await page.getByRole("button", { name: /Crear mi plan/ }).click();
  await page.getByRole("heading", { name: new RegExp(`Hola, ${p.name}`) }).waitFor({ timeout: 15000 });
}

async function noHorizontalScroll(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(overflow <= 1, `${label}: desbordamiento horizontal de ${overflow}px`);
}

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

// ---------------------------------------------------------------------------
await test("rutas protegidas redirigen a /login sin sesión", async () => {
  const { page, context } = await newPage();
  await page.goto(`${BASE}/workouts`);
  await page.waitForURL(/\/login/);
  await page.getByRole("heading", { name: "Hola de nuevo" }).waitFor();
  await context.close();
});

await test("validación del registro y del onboarding", async () => {
  const { page, context } = await newPage();
  await page.goto(`${BASE}/signup`);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.getByText("¿Cómo quieres que te llamemos?").waitFor();
  await page.getByText("Debes aceptar el aviso de privacidad").waitFor();
  await signup(page, "Datos", "incompleto@test.dev");
  await page.getByLabel("Fecha de nacimiento").fill("");
  await next(page);
  await page.getByText("Indica tu fecha de nacimiento.").waitFor();
  await page.getByText("Estatura entre 100 y 250 cm.").waitFor();
  await page.getByText(/Elige mujer u hombre/).waitFor();
  await page.getByLabel("Sexo biológico").selectOption("female");
  // Onboarding incompleto: tras completar el paso 1 y recargar, se retoma en el paso 2.
  await page.getByLabel("Fecha de nacimiento").fill("1995-05-05");
  await page.getByLabel("Estatura (cm)").fill("170");
  await page.getByLabel("Peso actual (kg)").fill("70");
  await next(page);
  await page.getByText("Paso 2 de 10").waitFor();
  await page.reload();
  await page.getByText("Paso 2 de 10").waitFor();
  await next(page);
  await page.getByText("Elige al menos un objetivo.").waitFor();
  // Con el onboarding incompleto, el panel no es accesible.
  await page.goto(`${BASE}/`);
  await page.waitForURL(/\/onboarding/);
  await context.close();
});

// Persona 1: principiante en casa, ciclo irregular, tema Sis.
let mar;
await test("principiante en casa: onboarding completo con ciclo irregular", async () => {
  mar = await newPage();
  const { page } = mar;
  await signup(page, "Mar", "mar@test.dev");
  await onboarding(page, {
    name: "Mar", theme: "My Gym/Sis", birth: "1996-03-14", height: 162, weight: 63, sex: "female", goals: ["Glúteos y piernas", "Salud general"],
    level: "Principiante", days: 3, minutes: 45, environment: "En casa sin equipo", cycle: { lastPeriod: daysAgo(10), regularity: "irregular" },
  });
  assert(await page.evaluate(() => document.documentElement.dataset.theme) === "sis", "el tema Sis no se aplicó");
  await page.getByText("Cycle Wellness").first().waitFor();
  await noHorizontalScroll(page, "panel móvil");
  await page.screenshot({ path: `${SHOTS}01-dashboard-sis-mobile.png`, fullPage: true });
});

await test("principiante en casa: el plan solo usa peso corporal", async () => {
  const { page } = mar;
  await page.goto(`${BASE}/workouts`);
  await page.getByText("¿Por qué este plan?").waitFor();
  const text = await page.locator("main").innerText();
  assert(!/Barra|Máquina|Polea|mancuerna/i.test(text.split("Cómo progresar")[0]), "el plan incluye equipo que no tiene");
  await page.screenshot({ path: `${SHOTS}02-workouts-plan.png`, fullPage: true });
});

await test("modo entrenamiento: registrar series, descanso, sustituir y terminar", async () => {
  const { page } = mar;
  await page.goto(`${BASE}/workouts`);
  await page.getByRole("button", { name: /Empezar sesión/ }).click();
  await page.waitForURL(/\/workouts\/session\//);
  await page.getByText("La última vez").waitFor();
  await page.getByRole("button", { name: "Completar serie 1" }).click();
  await page.getByRole("timer").waitFor();
  await page.getByRole("button", { name: /Saltar/ }).click();
  await page.getByRole("button", { name: "Completar serie 2" }).click();
  await page.getByRole("button", { name: /Pausar/ }).click();
  await page.getByText("Sesión en pausa").waitFor();
  await page.getByRole("button", { name: /Reanudar/ }).click();
  await page.getByRole("button", { name: /Sustituir/ }).click();
  await page.getByRole("dialog").getByRole("button").nth(1).click();
  await page.getByText("Sustituido hoy").waitFor();
  await page.screenshot({ path: `${SHOTS}03-session.png`, fullPage: true });
  await page.getByRole("button", { name: "Completar serie 1" }).click();
  await page.getByRole("button", { name: "Terminar entrenamiento" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "7", exact: true }).click();
  await page.getByRole("button", { name: "Guardar sesión" }).click();
  await page.getByRole("heading", { name: "¡Sesión completada!" }).waitFor();
  await page.screenshot({ path: `${SHOTS}04-session-summary.png` });
  await page.goto(`${BASE}/workouts`);
  await page.getByRole("tab", { name: "Historial" }).click();
  await page.getByText("Completada").first().waitFor();
});

await test("nutrición: plan semanal, sustitución, comida marcada, registro manual, agua y lista de compras", async () => {
  const { page } = mar;
  await page.goto(`${BASE}/nutrition`);
  await page.getByText("Tus estimaciones diarias").waitFor();
  await page.getByRole("button", { name: "Crear plan" }).first().click();
  await page.getByText("Plan semanal creado").waitFor();
  await page.getByRole("button", { name: /^Marcar .* como comida$/ }).first().click();
  await page.getByText("estimado").first().waitFor();
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await page.getByLabel("Alimento o plato").fill("Tinto con pandebono");
  await page.getByLabel("kcal").fill("230");
  await page.getByRole("dialog").getByRole("button", { name: "Guardar" }).click();
  await page.getByText("Tinto con pandebono").waitFor();
  await page.getByRole("button", { name: "Añadir un vaso de 250 ml" }).first().click();
  await page.getByText("0.25 L").first().waitFor();
  await page.getByRole("tab", { name: "Plan semanal" }).click();
  const mealName = () => page.locator("li p.font-semibold:not(.uppercase)").first().innerText();
  const firstMeal = await mealName();
  await page.getByRole("button", { name: "Cambiar por otra receta" }).first().click();
  await page.getByText("Comida cambiada").waitFor();
  const swapped = await mealName();
  assert(firstMeal !== swapped, "la sustitución no cambió la receta");
  await page.getByRole("tab", { name: "Lista de compras" }).click();
  await page.getByText("Frutas y verduras").waitFor();
  await page.screenshot({ path: `${SHOTS}05-grocery.png`, fullPage: true });
});

await test("progreso: medidas con gráfico real, fuerza y constancia", async () => {
  const { page } = mar;
  // Inicio queda simple: racha y semana están en Progreso, nutrición e hidratación en Nutrición.
  await page.goto(`${BASE}/`);
  await page.getByText("Tu racha, tu semana y tus récords").waitFor();
  assert(!(await page.getByText("Nutrición de hoy").count()) && !(await page.getByText("Hidratación").count()), "Inicio sigue mostrando nutrición o hidratación");
  await page.goto(`${BASE}/progress`);
  await page.getByText("Racha activa").waitFor();
  await page.getByText("Tu semana", { exact: true }).waitFor();
  await page.getByRole("tab", { name: "Cuerpo" }).click();
  await page.getByText("Sin registros en este periodo").waitFor();
  for (const [date, w] of [[daysAgo(14), "63.5"], [daysAgo(7), "63.1"], [daysAgo(0), "62.8"]]) {
    await page.getByRole("button", { name: "Registrar medidas" }).click();
    await page.getByLabel("Fecha", { exact: true }).fill(date);
    await page.getByLabel(/Peso \(kg\)/).fill(w);
    await page.getByRole("dialog").getByRole("button", { name: "Guardar" }).click();
    await page.getByText("Medidas guardadas").first().waitFor();
  }
  await page.locator(".recharts-line").first().waitFor();
  await page.getByText("-0.7 kg en el periodo").waitFor();
  await page.getByRole("tab", { name: "Constancia" }).click();
  await page.getByText("Sesiones por semana").waitFor();
  await page.screenshot({ path: `${SHOTS}06-progress.png`, fullPage: true });
});

await test("coach: respuesta de respaldo identificada y bloqueo por síntomas de alarma", async () => {
  const { page } = mar;
  await page.goto(`${BASE}/coach`);
  await page.getByRole("button", { name: "¿Qué entreno hoy?" }).click();
  await page.getByText("Modo de respaldo · no es IA").first().waitFor();
  await page.getByLabel("Escribe tu pregunta").fill("Tengo cólicos hoy, ¿qué opciones tengo?");
  await page.getByRole("button", { name: "Enviar" }).click();
  await page.getByText(/Seguir tu plan normal si te sientes bien/).waitFor();
  await page.getByLabel("Escribe tu pregunta").fill("Ayer me dio dolor en el pecho corriendo");
  await page.getByRole("button", { name: "Enviar" }).click();
  await page.getByText("Seguridad").last().waitFor();
  await page.getByText(/busca evaluación médica/).waitFor();
  await page.screenshot({ path: `${SHOTS}07-coach.png`, fullPage: true });
});

await test("ciclo: calendario, confianza baja por irregularidad y registro de síntomas", async () => {
  const { page } = mar;
  await page.goto(`${BASE}/cycle`);
  await page.getByText("Confianza baja").waitFor();
  await page.getByText("Hoy puedes elegir una opción más suave").waitFor(); // reportó cólicos en el onboarding
  await page.getByRole("button", { name: "Cansancio", exact: true }).click();
  await page.getByRole("button", { name: "Guardar registro" }).click();
  await page.getByText("Registro guardado").waitFor();
  await page.screenshot({ path: `${SHOTS}08-cycle.png`, fullPage: true });
});

await test("ajustes: cambio de tema y persistencia tras cerrar sesión", async () => {
  const { page } = mar;
  await page.goto(`${BASE}/settings`);
  await page.getByRole("button", { name: /Gym Bro/ }).click();
  await page.getByText("Tema Gym Bro activado").waitFor();
  assert(await page.evaluate(() => document.documentElement.dataset.theme) === "bro", "el tema no cambió");
  await page.screenshot({ path: `${SHOTS}09-settings-bro.png`, fullPage: true });
  await page.getByRole("button", { name: /Cerrar sesión/ }).click();
  await page.waitForURL(/\/login/);
  await page.getByLabel("Correo").fill("mar@test.dev");
  await page.getByLabel("Contraseña").fill("incorrecta1");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.getByText("Correo o contraseña incorrectos.").waitFor();
  await page.getByLabel("Contraseña").fill("Prueba1234");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.getByRole("heading", { name: /Hola, Mar/ }).waitFor();
  await page.getByText("Tinto con pandebono").count(); // no visible aquí; comprobamos en nutrición
  await page.goto(`${BASE}/nutrition`);
  await page.getByText("Tinto con pandebono").waitFor();
});

// Persona 2: intermedio en gimnasio, hipertrofia, rodilla limitada, sin ciclo, escritorio.
await test("intermedio en gimnasio con limitación de rodilla y sin ciclo (escritorio)", async () => {
  const { page, context } = await newPage({ width: 1366, height: 900 });
  await signup(page, "Andrés", "andres@test.dev");
  await onboarding(page, {
    name: "Andrés", theme: "Gym Bro", birth: "1990-08-02", height: 178, weight: 82, sex: "male", goals: ["Ganar músculo"],
    level: "Intermedio", days: 4, minutes: 60, environment: "Gimnasio comercial", limitations: ["Rodilla"],
  });
  assert(!(await page.getByRole("link", { name: "Ciclo" }).count()), "la navegación muestra Ciclo sin activarlo");
  await page.goto(`${BASE}/settings`);
  await page.getByText("Funciones opcionales y privacidad del coach").waitFor();
  assert(!(await page.getByText("Cycle Wellness", { exact: true }).count()), "un hombre ve la opción de Cycle Wellness");
  assert(!(await page.getByLabel("Embarazo o posparto").count()), "un hombre ve la pregunta de embarazo");
  await page.goto(`${BASE}/cycle`);
  await page.getByText("Cycle Wellness está desactivado").waitFor();
  await page.goto(`${BASE}/workouts`);
  await page.getByText(/zonas que marcaste/).first().waitFor({ state: "attached" });
  const planText = await page.locator("main").innerText();
  for (const knee of ["Sentadilla trasera con barra", "Prensa de piernas", "Zancada caminando"]) assert(!planText.includes(knee), `el plan incluye ${knee} pese a la rodilla`);
  await noHorizontalScroll(page, "plan escritorio");
  await page.screenshot({ path: `${SHOTS}10-workouts-bro-desktop.png`, fullPage: true });
  // Aislamiento de datos: Andrés no ve datos de Mar.
  await page.goto(`${BASE}/progress`);
  await page.getByRole("tab", { name: "Cuerpo" }).click();
  await page.getByText("Sin registros en este periodo").waitFor();
  await page.goto(`${BASE}/coach`);
  assert(!(await page.getByText("¿Qué entreno hoy?").locator("xpath=ancestor::aside").count()), "aparecen conversaciones ajenas");
  await page.screenshot({ path: `${SHOTS}11-dashboard-bro-desktop.png` });

  // Agenda por días y horarios: cambiar la hora de entreno.
  await page.goto(`${BASE}/workouts`);
  await page.getByText("Tu semana de entrenamiento").waitFor();
  await page.getByRole("button", { name: /Cambiar hora/ }).click();
  await page.getByLabel("Hora de inicio").fill("07:00");
  await page.getByLabel(/todos los días de entreno/).check();
  await page.getByRole("dialog").getByRole("button", { name: "Guardar" }).click();
  await page.getByText("Horario guardado").waitFor();
  assert((await page.getByText("7:00 a. m.").count()) >= 4, "la hora nueva no se aplicó a todos los días");

  await page.getByRole("button", { name: "Cómo se hace" }).first().click();
  await page.getByRole("img", { name: /Animación de referencia: hombre/ }).first().waitFor();

  // Gym Bro: horario de comidas y suplementos.
  await page.goto(`${BASE}/nutrition`);
  await page.getByRole("tab", { name: "Horario y déficit" }).click();
  await page.getByText("Tu ventana de comidas de hoy").waitFor();
  await page.getByText("Empieza a comer").waitFor();
  await page.getByRole("tab", { name: "Suplementos" }).click();
  await page.getByRole("button", { name: "Creatina monohidratada" }).click();
  await page.getByRole("button", { name: "Marcar Creatina monohidratada como tomado" }).click();
  await page.getByText("1 de 1 tomados").waitFor();
  await noHorizontalScroll(page, "suplementos");
  await page.screenshot({ path: `${SHOTS}13-supplements-bro.png`, fullPage: true });
  await context.close();
});

// Persona 3: pérdida de grasa, vegana con alergia, antecedentes de TCA: sin cifras.
await test("pérdida de grasa con antecedentes de TCA: sin cifras de calorías ni déficit", async () => {
  const { page, context } = await newPage();
  await signup(page, "Lu", "lu@test.dev");
  await page.getByRole("button", { name: /Neutro/ }).click();
  await page.getByLabel("Fecha de nacimiento").fill("1992-01-20");
  await page.getByLabel("Estatura (cm)").fill("165");
  await page.getByLabel("Peso actual (kg)").fill("80");
  await page.getByLabel("Sexo biológico").selectOption("female");
  await next(page);
  await page.getByRole("button", { name: "Perder grasa corporal", exact: true }).click();
  await next(page);
  await page.getByRole("button", { name: /^Principiante/ }).click();
  await next(page);
  await page.getByRole("button", { name: "Gimnasio en casa", exact: true }).click();
  await page.getByRole("button", { name: "Mancuernas", exact: true }).click();
  await next(page);
  await page.getByRole("button", { name: /Ligera/ }).click();
  await next(page);
  await page.getByLabel(/Entiendo el aviso/).check();
  await page.getByRole("button", { name: "Sí", exact: true }).click();
  await next(page);
  await page.getByRole("button", { name: "Vegana", exact: true }).click();
  await page.getByRole("button", { name: "Soya", exact: true }).click();
  await next(page);
  await next(page);
  await page.getByRole("button", { name: /No, gracias/ }).click();
  await next(page);
  await page.getByRole("button", { name: /Crear mi plan/ }).click();
  await page.getByRole("heading", { name: /Hola, Lu/ }).waitFor();
  await page.goto(`${BASE}/nutrition`);
  await page.getByText(/no mostramos cifras de calorías/).waitFor();
  await page.getByText("Guía del día").waitFor();
  assert(!(await page.getByText(/kcal/).count()), "se muestran calorías pese al modo sin cifras");
  await page.getByRole("button", { name: "Crear plan" }).first().click();
  await page.getByRole("tab", { name: "Plan semanal" }).click();
  await page.locator("li p.font-semibold").first().waitFor();
  await page.screenshot({ path: `${SHOTS}12-nutrition-no-numbers.png`, fullPage: true });
  assert(!(await page.getByRole("tab", { name: "Suplementos" }).count()), "el tema neutro muestra suplementos");
  await context.close();
});

await test("borrar una sesión con confirmación dentro de la página", async () => {
  const { page } = mar;
  await page.goto(`${BASE}/workouts`);
  await page.getByRole("tab", { name: "Historial" }).click();
  await page.getByRole("button", { name: "Borrar sesión" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();
  await page.getByText("Completada").first().waitFor();
  await page.getByRole("button", { name: "Borrar sesión" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Borrar sesión" }).click();
  await page.getByText("Sesión borrada").waitFor();
});

await test("entrenos: mover días, crear rutina, añadir por músculo, reordenar y ver cómo se hace", async () => {
  const { page } = mar;
  await page.goto(`${BASE}/workouts`);
  await page.getByText("Tu semana de entrenamiento").waitFor();
  // Guía visual con figura de mujer.
  await page.getByRole("button", { name: "Cómo se hace" }).first().click();
  await page.getByRole("img", { name: /Animación de referencia: mujer/ }).first().waitFor();
  // Mover la rutina seleccionada a otro día (intercambia si está ocupado).
  const moveSelect = page.getByLabel("Mover a");
  const current = await moveSelect.inputValue();
  await moveSelect.selectOption(current === "6" ? "5" : "6");
  await page.getByText("Rutina movida").waitFor();
  // Crear una rutina de glúteos y femoral en un día de descanso.
  await page.getByRole("button", { name: /^Agregar rutina el/ }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Femoral", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Crear rutina" }).click();
  await page.getByText(/Glúteos y Femoral agregado el/).waitFor();
  assert((await page.getByRole("button", { name: /^Mover .* a otro día$/ }).count()) === 4, "la nueva rutina no aparece en la semana");
  // Añadir ejercicios filtrando por músculo, sin cerrar el selector.
  await page.getByRole("button", { name: "Añadir ejercicio" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Pierna", exact: true }).click();
  await dialog.locator("ul button").first().click();
  await dialog.getByText("Añadido ✓").waitFor();
  await dialog.getByRole("button", { name: /Cerrar/ }).click();
  // Reordenar ejercicios con el teclado (arrastrar accesible).
  const names = async () => page.locator("ol li a[href^='/exercises/']").allInnerTexts();
  const before = await names();
  assert(before[0] !== before[1], "los dos primeros ejercicios son iguales");
  const handle = page.locator("li:has(a[href^='/exercises/']) button[aria-label^='Mover ']").first();
  await handle.focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(250);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(250);
  await page.keyboard.press("Space");
  await page.waitForTimeout(500);
  const after = await names();
  assert(after[1] === before[0] && after[0] === before[1], `el orden no cambió: ${before.slice(0, 2)} → ${after.slice(0, 2)}`);
  await noHorizontalScroll(page, "entrenos editables");
  await page.screenshot({ path: `${SHOTS}14-workouts-edit.png`, fullPage: true });
  // Detalle del ejercicio con animación.
  await page.locator("ol li a[href^='/exercises/']").first().click();
  await page.getByText("Así se hace").waitFor();
  await page.getByRole("img", { name: /Animación de referencia: mujer/ }).waitFor();
});

await test("borrar datos de ciclo y borrar cuenta", async () => {
  const { page, context } = mar;
  await page.goto(`${BASE}/cycle`);
  await page.getByRole("button", { name: "Ajustes del ciclo" }).click();
  await page.getByRole("button", { name: /Borrar todos mis datos del ciclo/ }).click();
  await page.getByRole("button", { name: "Sí, borrar" }).click();
  await page.getByText("Cycle Wellness está desactivado").waitFor();
  await page.goto(`${BASE}/settings`);
  await page.getByRole("button", { name: /Borrar mi cuenta/ }).click();
  await page.getByLabel("Escribe BORRAR para confirmar").fill("BORRAR");
  await page.getByRole("button", { name: "Borrar definitivamente" }).click();
  await page.waitForURL(/\/login/);
  await page.getByLabel("Correo").fill("mar@test.dev");
  await page.getByLabel("Contraseña").fill("Prueba1234");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.getByText("Correo o contraseña incorrectos.").waitFor();
  const leftovers = await page.evaluate(() => localStorage.getItem("mgs:local-db:v1") ?? "");
  assert(!leftovers.includes("Tinto con pandebono"), "quedaron datos de la cuenta borrada");
  assert(page.errors.length === 0, `errores de consola: ${page.errors.join(" | ")}`);
  await context.close();
});

await browser.close();
stopServer();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pruebas E2E pasaron`);
process.exit(failed.length ? 1 : 0);
