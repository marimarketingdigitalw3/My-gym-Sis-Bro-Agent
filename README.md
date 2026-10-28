# GYM BOT

App de entrenamiento con IA. Temas: My Gym/Sis, Gym Bro y neutro.

Aplicación de fitness personalizada: entrenamiento, nutrición, progreso, bienestar del ciclo y un coach con IA. Se adapta a los objetivos, el nivel, el equipo, las limitaciones y el estilo de vida de cada persona.

Tiene dos experiencias visuales, **My Gym/Sis** y **Gym Bro**, más un tema **Neutro**. Cada persona elige la suya; el motor de entrenamiento y nutrición nunca depende del tema ni del género.

## Funciones

| Área | Qué incluye |
|---|---|
| **Cuenta** | Registro, inicio de sesión, verificación de correo (Supabase), recuperación de contraseña, sesión persistente, rutas protegidas, exportación de datos, borrado de datos y de cuenta |
| **Onboarding** | 9 pasos con validación y progreso guardado: datos básicos y tema, objetivos con prioridad, nivel, lugar y equipo, estilo de vida, salud y seguridad, alimentación, composición corporal (opcional) y ciclo (opcional) |
| **Entrenamiento** | Plan semanal generado según objetivo, nivel, días, minutos, equipo, limitaciones, gustos y recuperación. Calentamiento, vuelta a la calma, explicación del plan, edición, sustituciones seguras y regeneración |
| **Modo entrenamiento** | Series con peso, repeticiones y esfuerzo, temporizador de descanso, rendimiento anterior, sugerencia de progresión, sustitución solo por hoy, pausa, registro de dolor y resumen con récords |
| **Biblioteca** | 98 ejercicios con técnica, errores comunes, alternativas y mapa muscular. Búsqueda y filtros por músculo, equipo, dificultad y categoría |
| **Nutrición** | Estimación de energía y macros (Mifflin-St Jeor) con rango y supuestos visibles, plan semanal con 59 recetas (muchas colombianas y latinoamericanas), sustituciones, opción económica, porciones, lista de compras, registro diario, agua e historial |
| **Progreso** | Peso y medidas con gráficos y filtro de fechas, fuerza (1RM estimado) por ejercicio, récords, constancia semanal, racha con comodines, reto de 66 días y fotos privadas |
| **Cycle Wellness** | Opcional. Calendario, próxima fecha con ventana de incertidumbre, fases estimadas con nivel de confianza, síntomas y energía. Soporta ciclos irregulares, anticoncepción hormonal y fechas desconocidas |
| **Gym AI Coach** | Chat con contexto del plan y el progreso, vía Edge Function segura (Claude). Límite de uso, manejo de errores, historial y modo de respaldo claramente identificado |
| **Seguridad** | Señales de alarma (dolor en el pecho, desmayo, falta de aire) que pausan el entrenamiento, protección de menores, modo sin cifras para antecedentes de TCA, ajustes para embarazo y posparto |

## Inicio rápido

```bash
npm install
npm run dev          # http://localhost:5173
```

Sin variables de entorno la app arranca en **modo demo local**: todo funciona en el navegador, los datos se guardan en este dispositivo y el coach usa respuestas predefinidas. La interfaz lo indica en todo momento.

Para el modo completo con Supabase y la IA, sigue [`docs/03-guia-tecnica.md`](docs/03-guia-tecnica.md).

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Verificación de tipos y compilación de producción |
| `npm test` | Pruebas unitarias (motores, coach, proveedor de IA) |
| `npm run test:db` | Migraciones y pruebas de RLS sobre PostgreSQL local |
| `npm run test:e2e` | Pruebas de extremo a extremo con Playwright (requiere `npm run build`) |
| `npm run lint` · `npm run typecheck` | Calidad de código |
| `npm run exercises:sql` | Regenera la migración de la biblioteca pública de ejercicios |

## Documentación

- [`docs/03-guia-tecnica.md`](docs/03-guia-tecnica.md): arquitectura, estructura, base de datos, seguridad, variables de entorno, Supabase, IA, despliegue, pruebas y limitaciones.
- [`docs/04-supuestos-calculos.md`](docs/04-supuestos-calculos.md): fórmulas y casos de referencia de nutrición, progresión y ciclo.
- [`docs/01-ingenieria-inversa.md`](docs/01-ingenieria-inversa.md) y [`docs/02-producto-combinado.md`](docs/02-producto-combinado.md): análisis inicial de producto.

> My Gym/Sis no es una herramienta de diagnóstico médico ni sustituye a profesionales de la salud, la nutrición o el entrenamiento.
