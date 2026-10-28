# Guía técnica

## 1. Auditoría inicial y decisiones

El repositorio contenía solo un prototipo en JavaScript sin build, sin autenticación y con datos en `localStorage`. Se reemplazó por una aplicación React + TypeScript. La lógica útil del prototipo (motor del ciclo, cálculo nutricional y racha con comodines del reto de 66 días) se portó a TypeScript con pruebas, y ahora sigue reglas más seguras (por ejemplo, el ciclo ya no asume 28 días ni obliga a entrenar menos).

| Capa | Tecnología |
|---|---|
| Frontend | React 18, TypeScript estricto, Vite 5, Tailwind CSS 3, React Router 6, React Hook Form + Zod, Recharts, lucide-react |
| Componentes | Sistema propio y accesible (`src/components/ui`), inspirado en shadcn/ui pero sin su CLI |
| Backend | Supabase: Auth, PostgreSQL con RLS, Storage privado y Edge Functions (Deno) |
| IA | Claude (Anthropic) mediante el SDK oficial, solo en el servidor |

## 2. Estructura

```
src/
  app/                 Providers (sesión, perfil, tema) y AppShell (navegación móvil y escritorio)
  components/          Sistema de diseño, gráficos, mapa muscular, ilustraciones
  data/                exercises.ts (98 ejercicios) y recipes.ts (59 recetas)
  features/            Pantallas: auth, onboarding, dashboard, workouts, exercises, nutrition,
                       progress, coach, cycle, settings, wellness
  lib/                 Lógica de negocio pura y probada (sin React)
    workouts/          generator.ts (planes) y progression.ts (sobrecarga progresiva, récords)
    nutrition.ts       Energía y macros     meals.ts       Plan de comidas y lista de compras
    cycle.ts           Cycle Wellness       clearance.ts   Autorización para entrenar
    consistency.ts     Racha y reto 66 días bodyType.ts    Somatotipo orientativo
  services/
    data/              Contrato DataClient + implementación Supabase + modo demo local
    profile.ts, workouts.ts, tracking.ts, derived.ts
  types/               domain.ts (dominio) y db.ts (filas de la base de datos)
supabase/
  migrations/          Esquema, RLS, storage y datos de la biblioteca de ejercicios
  functions/
    _shared/           Lógica compartida con la app: seguridad, coach, contexto, respaldo, proveedores de IA
    coach-chat/        Edge Function del Gym AI Coach
    delete-account/    Edge Function de borrado de cuenta
  tests/               Stub de Supabase y pruebas de RLS para PostgreSQL local
e2e/run.mjs            Pruebas de extremo a extremo con Playwright
```

La UI nunca habla con Supabase directamente: usa `db` (`src/services/data`). Si existen `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` se usa Supabase; si no, el **modo demo local**, que replica el aislamiento por usuario y guarda contraseñas con PBKDF2. El modo demo se identifica en la interfaz y no debe usarse como producción.

## 3. Base de datos

Migraciones en `supabase/migrations`:

1. `…01_schema.sql`: tablas, restricciones, índices, triggers `updated_at` y creación automática de perfil y ajustes al registrarse.
2. `…02_rls.sql`: Row Level Security en todas las tablas.
3. `…03_storage.sql`: bucket privado `progress-photos` con políticas por carpeta de usuario.
4. `…04_exercise_library_data.sql`: datos de la biblioteca pública (generado con `npm run exercises:sql`).

| Tabla | Contenido |
|---|---|
| `profiles` | Datos básicos, unidades, idioma, tema, estado del onboarding |
| `user_settings` | Funciones opcionales (ciclo, agua, cifras de calorías), permiso de contexto para la IA, consentimiento de salud |
| `onboarding_responses` | Respuestas de nivel, equipo, estilo de vida, salud y somatotipo (JSONB) |
| `fitness_goals` | Objetivos con prioridad y plazo |
| `nutrition_preferences` | Dieta, alérgenos, rechazos, comidas al día, presupuesto, tiempo, cocinas |
| `cycle_settings` · `cycle_logs` | Configuración y registros diarios del ciclo |
| `exercise_library` | Biblioteca **pública** de solo lectura, separada de los datos personales |
| `workout_plans` · `workout_exercises` | Plan activo (índice único parcial: un plan activo por persona) y sus ejercicios |
| `workout_sessions` · `exercise_sets` | Sesiones y series registradas |
| `meal_plans` · `meal_logs` · `water_logs` | Plan semanal, registro de comidas y agua |
| `progress_measurements` · `progress_photos` | Medidas y metadatos de fotos (la ruta debe empezar por el id del propietario) |
| `recovery_logs` | Energía, sueño, agujetas, dolor y señales de alarma del día |
| `chat_conversations` · `chat_messages` | Historial del coach |

Todas las tablas personales referencian `auth.users` con `on delete cascade`: borrar la cuenta elimina todos los datos.

### Seguridad (RLS)

- Cada tabla personal permite `select/insert/update/delete` solo cuando `user_id = auth.uid()`.
- Las filas hijas (`workout_exercises`, `exercise_sets`, `chat_messages`) además exigen que el padre pertenezca a la misma persona.
- Desde el cliente solo se pueden insertar mensajes con rol `user`; las respuestas del asistente las escribe la Edge Function con `service_role`.
- `anon` no tiene acceso a datos personales; solo puede leer la biblioteca de ejercicios.
- Storage: cada persona solo puede leer, subir o borrar dentro de `progress-photos/<su id>/`.

`npm run test:db` aplica las migraciones sobre PostgreSQL con un stub mínimo de Supabase (`supabase/tests/supabase-stub.sql`) y ejecuta 28 comprobaciones de aislamiento entre dos usuarias, acceso anónimo, escritura en la biblioteca, storage y borrado en cascada.

## 4. Variables de entorno

Copia `.env.example` a `.env`.

| Variable | Dónde | Uso |
|---|---|---|
| `VITE_SUPABASE_URL` | Frontend | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Clave pública anon (protegida por RLS) |
| `ANTHROPIC_API_KEY` | Secreto de Edge Functions | Clave del proveedor de IA. **Nunca** con prefijo `VITE_` |
| `COACH_MODEL` | Secreto (opcional) | Modelo del coach. Por defecto `claude-opus-5-5` |
| `COACH_RATE_LIMIT_PER_HOUR` | Secreto (opcional) | Mensajes por persona y hora. Por defecto 30 |
| `ALLOWED_ORIGIN` | Secreto (opcional) | Origen permitido por CORS en las Edge Functions |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase en las Edge Functions automáticamente.

## 5. Configurar Supabase

### Opción A: desde Vercel (recomendada)

1. En el proyecto de Vercel: **Storage → Create Database → Supabase**. Vercel crea el proyecto de Supabase y añade `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`, que la app ya lee.
2. En GitHub (**Settings → Secrets and variables → Actions**) añade `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` y, si quieres IA, `ANTHROPIC_API_KEY`.
3. Ejecuta el flujo **Supabase** en la pestaña Actions (o haz push a `main` con cambios en `supabase/`). Aplica las migraciones, carga la clave del coach y despliega las Edge Functions.
4. Vuelve a desplegar en Vercel para que el build incluya las variables nuevas.

### Opción B: con la CLI

```bash
npx supabase login
npx supabase link --project-ref <tu-project-ref>
npx supabase db push
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
npx supabase functions deploy coach-chat
npx supabase functions deploy delete-account
```

### En ambos casos

En el panel de Supabase, **Authentication → URL Configuration**: `Site URL` con tu dominio de Vercel y, en *Redirect URLs*, `https://tu-dominio/login` y `https://tu-dominio/reset-password`. Activa *Confirm email* en **Providers → Email** si quieres verificación de correo.

Para desarrollo local con Docker: `npx supabase start`, `npx supabase db reset` y `npx supabase functions serve`.

## 6. Proveedor de IA

La clave se guarda solo como secreto de Supabase (`ANTHROPIC_API_KEY`) y nunca llega al navegador ni a Vercel. Opcionales: `COACH_MODEL` (por defecto `claude-opus-5-5`), `COACH_RATE_LIMIT_PER_HOUR` (30) y `ALLOWED_ORIGIN` (tu dominio, para CORS).

Cómo funciona `coach-chat`:

1. Valida el JWT del usuario y el cuerpo de la petición (mensaje de 1 a 2000 caracteres, id de conversación UUID).
2. Aplica el límite de mensajes por hora.
3. Si el mensaje contiene señales de alarma, responde con un mensaje de seguridad sin llamar al proveedor.
4. Construye un **contexto mínimo** con RLS: nombre de pila, objetivos, nivel, equipo, zonas a cuidar, plan de hoy, sesiones recientes, récords, dieta y alérgenos, y síntomas del día solo si el ciclo está activo. Nunca envía notas médicas, peso exacto, fechas del ciclo ni fotos. Si la persona desactiva "Compartir mi contexto", solo se envía el idioma.
5. Llama al proveedor (`supabase/functions/_shared/ai/anthropic.ts`): modelo `claude-opus-5-5`, esfuerzo `medium`, instrucciones estables cacheadas y `fallbacks: "default"` para que un rechazo de seguridad se reintente en el modelo recomendado. Trata `stop_reason: "refusal"`, tiempos de espera (45 s) y errores tipados.
6. Si no hay clave o el proveedor falla, responde con el **modo de respaldo** y lo marca como tal (`source: "fallback"` y un aviso visible).

Para añadir otro proveedor, implementa la interfaz `ChatProvider` de `supabase/functions/_shared/ai/provider.ts` y selecciónalo en `providerFromEnv()`.

## 7. Despliegue en Vercel

El proyecto incluye `vercel.json` (build de Vite, reescritura SPA hacia `index.html`, cabeceras de seguridad y caché de assets). Vercel despliega automáticamente cada push al repositorio conectado. Sin variables de Supabase, el despliegue funciona en modo demo local.

**CI:** `.github/workflows/ci.yml` ejecuta lint, tipos, pruebas unitarias, migraciones y RLS en PostgreSQL 16, build y pruebas de extremo a extremo en cada push y pull request.

## 8. Pruebas

| Suite | Cobertura |
|---|---|
| `npm test` (Vitest, 50 pruebas) | Integridad de datos; Mifflin-St Jeor con casos calculados a mano; déficit, mínimos seguros, menores, TCA, IMC bajo y datos incompletos; generador para principiante en casa, intermedio en gimnasio, pérdida de grasa, rodilla limitada, embarazo, tiempo disponible y días preferidos; sustituciones; progresión (subir carga, subir repeticiones, no progresar con dolor o mala recuperación, reducir); récords; ciclo con duración declarada, aprendizaje de registros, irregularidad, anticoncepción y sin fechas; prioridad de síntomas; señales de alarma; plan de comidas seguro para alergias y rechazos, porciones, sin repeticiones en el día, sustitución y lista de compras; racha con comodines; validación, límite de uso, historial, contexto mínimo, respaldo y proveedor de IA con cliente simulado |
| `npm run test:db` (PostgreSQL 16) | 28 comprobaciones de RLS, storage y borrado en cascada |
| `npm run test:e2e` (Playwright, 14 escenarios) | Rutas protegidas; validación de registro y onboarding; onboarding incompleto que se retoma; principiante en casa con ciclo irregular; modo entrenamiento completo; nutrición; progreso con gráficos reales; coach de respaldo y bloqueo por síntomas; ciclo; cambio de tema y persistencia tras cerrar sesión; intermedio en gimnasio con rodilla limitada y sin ciclo en escritorio; aislamiento entre cuentas; pérdida de grasa con antecedentes de TCA; borrado de una sesión con confirmación dentro de la página; borrado de datos del ciclo y de la cuenta. Comprueba móvil (390 px) y escritorio (1366 px) sin desbordamiento horizontal ni errores de consola |

## 9. Limitaciones conocidas

- **Supabase sin probar en vivo.** El código de integración compila contra los tipos oficiales y las migraciones y la RLS se probaron en PostgreSQL 16, pero no se ejecutó contra un proyecto Supabase real ni contra Edge Functions desplegadas (no había credenciales ni Docker activo en el entorno de desarrollo).
- **IA sin probar en vivo.** El proveedor se probó con un cliente simulado; falta una prueba con una clave real.
- **Idioma.** La interfaz está en español. El coach responde en español o inglés según la pregunta y la preferencia.
- **Medios.** No se incluyen videos ni fotografías de ejercicios: no hay material con licencia verificada. Se usan instrucciones paso a paso y un mapa muscular ilustrado propio.
- **Unidades.** Las medidas corporales se capturan en cm; la opción imperial convierte solo el peso.
- **Modo demo local.** Útil para probar y presentar la app, pero los datos viven en el navegador y no son una solución de producción.
- **Tamaño del bundle.** Recharts ocupa ~150 kB comprimidos en un chunk separado que solo se carga en pantallas con gráficos.
- **Notificaciones** (recordatorios) y **foto de comida con IA** quedan para una siguiente iteración.
