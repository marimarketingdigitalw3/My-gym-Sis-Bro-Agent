# Ingeniería inversa: Lively, InOut y Life Reset

> **Fuentes y límites.** El análisis parte de las fichas públicas de App Store y Google Play, agregadores (AppFollow, AppBrain, AppsHunter, Adapty Paywall Library, JustUseApp) y reseñas de usuarios. No se descompiló ningún binario. Lo que aparece como *inferido* es una reconstrucción razonada a partir del comportamiento visible, no un dato confirmado. Los precios cambian según país y fecha.

---

## 1. Lively: Period Tracker, Cycle Syncing

| Campo | Dato |
|---|---|
| ID App Store | 6447674634 |
| Categoría | Salud y bienestar |
| Plataformas | iPhone (iOS), Android (`com.app.lively_app`) |
| Modelo | Gratis con compras dentro de la app |
| Precio observado | Semanal ~USD 2,99 · Mensual ~USD 4,99 · Anual entre USD 18,99 y 49,99 · Plan pareja USD 9,99/mes o 59,99/año |
| Prueba | 7 días gratis que pasa a plan anual |

### Propuesta de valor
"Sincroniza tu vida con tu ciclo." No se queda en predecir la regla: traduce la fase hormonal del día en recomendaciones concretas de alimentación, ejercicio, trabajo y autocuidado.

### Funciones
1. **Seguimiento de periodo y ovulación**, con predicción de próxima regla y ventana fértil.
2. **Cuatro fases**: menstrual, folicular, ovulatoria y lútea. Cada una tiene su propio color, mensaje y consejos.
3. **Consejos diarios** según fase y nivel hormonal estimado (estrógeno, progesterona, LH).
4. **Cycle syncing**: qué comer, cómo entrenar y cómo organizar la agenda en cada fase.
5. **Partner Sync**: la pareja ve la fase actual, el estado de ánimo y una guía de cómo acompañar.
6. **Apple Health**: lectura y escritura de datos del ciclo.
7. **Modos de embarazo y posparto**.

### Bucle principal (inferido)
`Abrir app → ver fase y día del ciclo → leer consejo del día → registrar síntomas/ánimo → volver mañana`

### Modelo de datos (inferido)
```
User { birthDate, avgCycleLength, avgPeriodLength, goal (track | conceive | pregnant | postpartum) }
PeriodLog { startDate, endDate, flowByDay[] }
DailyLog { date, mood, symptoms[], energy, notes }
Partner { inviteCode, linkedUserId, permissions }
Content { phase, category (food | fitness | work | selfcare), body }
```
La fase se calcula de forma determinista con la fecha de inicio del último periodo y la duración media del ciclo. No requiere IA.

### Fortalezas
- Concepto muy claro, fácil de explicar en una frase.
- El modo pareja es un motor de crecimiento orgánico: cada usuaria trae a otra persona.
- El contenido por fase es barato de producir y reutilizable.

### Debilidades (según reseñas)
- Contenido "muy escaso para lo que cuesta".
- Quejas por cobros tras la prueba gratuita.
- No mide resultados: dice cómo entrenar o comer, pero no registra si lo hiciste.

---

## 2. InOut: Calorie Counter (INOUT: AI Calorie Tracker)

| Campo | Dato |
|---|---|
| ID App Store | 1599210729 |
| Desarrollador | Origen coreano (paquete Android `com.taejinketo.inout_webview`) |
| Categoría | Salud y bienestar |
| Arquitectura | App híbrida (*webview*), según el nombre del paquete |
| Modelo | Gratis con anuncios + membresía anual ~USD 26,99 + moneda virtual ("Apples", ej. 1.300 por USD 7,49) |
| Valoración | Mixta: buena aceptación, quejas por estabilidad y anuncios |

### Propuesta de valor
"Lo que entra y lo que sale." Comida (in) y ejercicio (out) en una sola gráfica de peso, con un componente social fuerte.

### Funciones
1. **Registro de comidas con foto** y cálculo automático de calorías y nutrientes con IA.
2. **Modo manual** (añadido en agosto de 2026 tras quejas de que todo dependía de la foto).
3. **Registro de entrenamientos** con foto.
4. **Ayuno intermitente**: horarios y temporizador.
5. **Gráfica unificada** de peso frente a comidas, ejercicio y ayuno.
6. **Coach con IA** e informes personalizados.
7. **Comunidad**: feed para compartir registros.
8. **Diet Battles**: retos grupales o 1 contra 1 con ranking.
9. **Puntos y moneda virtual** para retos y recompensas.

### Bucle principal (inferido)
`Comer → foto → la IA estima → ver balance in/out → compartir en el feed → competir en reto → volver`

### Modelo de datos (inferido)
```
User { weight, height, sex, goalWeight, activityLevel, fastingPlan }
Meal { timestamp, photoUrl, items[{ name, grams, kcal, protein, carbs, fat }], source (ai | manual) }
Workout { timestamp, type, minutes, kcalBurned, photoUrl }
FastingSession { start, end, targetHours }
WeightLog { date, kg }
Post { userId, mealId | workoutId, likes, comments }
Battle { type (group | 1v1), participants[], metric, startDate, endDate, ranking }
Wallet { apples, transactions[] }
```

### Fortalezas
- La foto reduce mucho la fricción del registro.
- La presión social (retos y ranking) mejora la constancia.
- Doble monetización: suscripción y moneda virtual.

### Debilidades (según reseñas)
- Demasiado peso en lo social para quien solo quiere contar calorías.
- Anuncios invasivos en la versión gratuita.
- Inestabilidad, probablemente por la arquitectura *webview*.
- Objetivos calóricos fijos: no se ajustan al ciclo hormonal.

---

## 3. Life Reset: 66 Day Habit (antes "Rise: Life Reset in 66 Days")

| Campo | Dato |
|---|---|
| ID App Store | 6478942469 |
| Paquete Android | `build.designand.riselife` |
| Categoría | Salud y bienestar |
| Valoración | ~4,7 con ~12.000 valoraciones |
| Usuarios declarados | 1,4 a 1,5 millones |
| Modelo | Suscripción obligatoria (*hard paywall*) tras el onboarding. Prueba de 7 días en el plan anual |
| Precio observado | Muy variable según región: de ~USD 6,49 a 99,99. Opciones de acceso completo a USD 17,99 y 28,99 |

### Propuesta de valor
"Reinicia tu vida en 66 días." Se apoya en el estudio de Lally (UCL, 2009), que estima en 66 días la mediana para automatizar un hábito. Convierte la vida diaria en un juego de rol.

### Funciones
1. **Onboarding largo tipo cuestionario** (unos 2 minutos): diagnóstico, datos científicos sobre hábitos y generación de un programa personalizado. Al final aparece el muro de pago.
2. **Programa de 66 días** con dificultad progresiva.
3. **Daily Quests**: tareas pequeñas que suman XP.
4. **XP, niveles y rachas**.
5. **Estadísticas de personaje**: disciplina, enfoque, fuerza.
6. **Seis áreas**: sueño, agua, ejercicio, mente, tiempo de pantalla y ducha fría.
7. **Recordatorios diarios**.

### Bucle principal (inferido)
`Notificación → abrir → ver misiones del día → marcarlas → ganar XP / subir nivel → mantener la racha → volver`

### Modelo de datos (inferido)
```
User { programStartDate, answers{}, areas[], level, xp, streak }
Program { day (1..66), stage, quests[] }
QuestTemplate { id, area, title, difficulty, xp, minDay }
QuestLog { date, questId, completed }
Stats { discipline, focus, strength, ... }
```

### Fortalezas
- El onboarding vende: la persona invierte tiempo y siente que el plan es suyo antes de ver el precio.
- La gamificación tipo RPG es muy eficaz para retención temprana.
- Un final claro (día 66) da sentido de logro.

### Debilidades (según reseñas)
- El muro de pago tras el cuestionario genera frustración.
- Cobros después de cancelar (reportes individuales).
- Tareas que no se guardan y poca flexibilidad para personalizar.
- **Fallar un día es castigado en exceso** y cuesta reiniciar una tarea fallida.
- Las misiones no se adaptan al estado físico del día.

---

## 4. Comparativa

| Dimensión | Lively | InOut | Life Reset |
|---|---|---|---|
| Pregunta que responde | ¿En qué fase estoy y qué hago? | ¿Cuánto comí y quemé? | ¿Estoy cumpliendo mis hábitos? |
| Dato principal | Fecha del periodo | Comida y ejercicio | Misiones completadas |
| Motor de retención | Consejo diario | Social y retos | XP, racha, nivel |
| Uso de IA | Bajo | Alto (visión) | Bajo (generación de plan) |
| Monetización | Suscripción + plan pareja | Anuncios + suscripción + moneda | Suscripción obligatoria |
| Hueco que deja | No mide la ejecución | Ignora el ciclo hormonal | Ignora el cuerpo y la energía del día |

## 5. La oportunidad

Cada app resuelve un tercio del problema y deja abierto justo lo que resuelven las otras dos:

- **Lively** sabe *cuándo* el cuerpo está preparado, pero no comprueba qué haces.
- **InOut** mide *qué* comes y quemas, pero exige lo mismo todos los días del mes.
- **Life Reset** consigue que *vuelvas cada día*, pero castiga por igual un día de regla que un día de pico de energía.

Ninguna conecta las tres cosas. Esa es la base del producto combinado, descrito en [`02-producto-combinado.md`](./02-producto-combinado.md).
