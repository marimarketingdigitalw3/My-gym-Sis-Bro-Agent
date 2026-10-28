# Sis Bro: producto combinado

> Un programa de 66 días que adapta entrenamiento, comida y hábitos a la fase del ciclo. Lo que haces cada día depende de cómo está tu cuerpo ese día.

## 1. Concepto

| Viene de | Lo que tomamos | Lo que mejoramos |
|---|---|---|
| **Lively** | Motor de fases y consejos diarios | Los consejos se convierten en misiones medibles |
| **InOut** | Registro de comidas, balance in/out, retos | Objetivos de calorías y macros que cambian según la fase |
| **Life Reset** | 66 días, misiones, XP, niveles, racha | Dificultad ajustada a la fase y días de gracia en lugar de castigo |

**Nombre de trabajo:** *Sis Bro*. "Sis" es la usuaria. "Bro" es su compañero de entrenamiento o pareja, que recibe el modo acompañante (el Partner Sync de Lively, enfocado en el gimnasio).

## 2. Bucle principal

```
Abrir app
  └─ Pantalla "Hoy": día del programa (x/66) + fase + energía estimada
       ├─ Misiones del día (adaptadas a la fase)  → XP, racha, estadísticas
       ├─ Objetivo de calorías y macros del día    → registrar comidas
       └─ Registro rápido de ánimo y síntomas      → afina las predicciones
Volver mañana (recordatorio)
```

## 3. Reglas del motor

### 3.1 Ciclo (de Lively)
- Entrada: fecha de inicio de la última regla, duración media del ciclo (21 a 40 días) y del sangrado (2 a 8 días).
- Día de ovulación estimado = duración del ciclo − 14.
- Fases:
  - **Menstrual:** días 1 a duración del sangrado.
  - **Folicular:** hasta dos días antes de la ovulación.
  - **Ovulatoria:** ovulación ± 1 día.
  - **Lútea:** resto del ciclo.
- Ventana fértil: ovulación − 5 hasta ovulación + 1.
- Si la usuaria registra una regla nueva, el ciclo se recalcula desde esa fecha y la media se actualiza con los últimos ciclos registrados.

### 3.2 Nutrición (de InOut, ajustada por fase)
- Gasto base: fórmula de Mifflin-St Jeor × factor de actividad.
- Ajuste por objetivo: perder −15 %, mantener 0 %, ganar +10 %.
- **Fase lútea: +150 kcal.** El metabolismo basal sube entre un 2,5 % y un 11 % en esta fase y el apetito aumenta. Reconocerlo evita la sensación de "fallé la dieta".
- Proteína 1,8 g/kg. Grasa 0,9 g/kg (1,0 g/kg en fase lútea). Carbohidratos: el resto.

### 3.3 Entrenamiento por fase
| Fase | Energía | Enfoque | Intensidad |
|---|---|---|---|
| Menstrual | Baja | Movilidad, caminar, yoga | Suave |
| Folicular | Subiendo | Fuerza progresiva, técnica | Alta |
| Ovulatoria | Pico | Récords personales, HIIT | Máxima |
| Lútea | Bajando | Fuerza moderada, cardio estable | Media |

### 3.4 Programa de 66 días (de Life Reset)
| Etapa | Días | Misiones diarias |
|---|---|---|
| Base | 1 a 22 | 3 |
| Construcción | 23 a 44 | 4 |
| Consolidación | 45 a 66 | 5 |

- Áreas: Movimiento, Nutrición, Agua, Sueño, Mente, Pantalla.
- Cada misión tiene versión por fase. Ejemplo de Movimiento: caminata de 20 min (menstrual), fuerza de 40 min (folicular), intento de récord (ovulatoria), fuerza moderada de 30 min (lútea).
- XP = 10 × dificultad. Bonus del 50 % si se completan todas las misiones del día.
- Nivel = ⌊√(XP / 50)⌋ + 1.
- Estadísticas de personaje: Fuerza, Energía, Disciplina, Mente.

### 3.5 Días de gracia (respuesta a la principal queja de Life Reset)
- Un día con al menos una misión completada mantiene la racha.
- Un día sin ninguna misión consume un **comodín**. Se gana un comodín cada 7 días y se acumulan hasta 2.
- Sin comodines, la racha vuelve a 0, pero **el programa de 66 días no se reinicia**.
- En fase menstrual las misiones bajan de dificultad, no desaparecen: la constancia se mantiene sin forzar.

## 4. Modo Bro (de Lively Partner Sync)
- La usuaria comparte un resumen: fase, energía, entrenamiento sugerido y cómo apoyar.
- Pensado para compañeros de gimnasio y parejas: "hoy toca récord, anímala" o "hoy toca suave, propón caminar".
- La usuaria decide qué se comparte. Los síntomas nunca se comparten por defecto.

## 5. Monetización propuesta
Aprendizajes: el *hard paywall* de Life Reset convierte pero genera reseñas negativas; los anuncios de InOut dañan la experiencia; el plan pareja de Lively es una buena idea.

| Plan | Incluye | Precio de referencia |
|---|---|---|
| Gratis | Ciclo, misiones de la etapa Base (días 1 a 22), registro manual de comida | 0 |
| Premium | Programa completo de 66 días, foto de comida con IA, informes | ~USD 4,99/mes o 29,99/año |
| Sis + Bro | Premium para dos cuentas vinculadas y retos entre ambos | ~USD 44,99/año |

Sin anuncios. Avisar 2 días antes de que termine la prueba. Cancelación con un toque.

## 6. Privacidad
Los datos del ciclo son datos de salud sensibles.
- Por defecto todo se guarda en el dispositivo. La nube es opcional y cifrada.
- Nunca se venden ni se comparten con terceros para publicidad.
- Exportar y borrar todos los datos desde Ajustes.

## 7. Prototipo incluido
La carpeta `app/` contiene una versión web funcional, sin dependencias:
- Onboarding: datos del ciclo, cuerpo y objetivo.
- **Hoy**: día x/66, fase, misiones, XP, racha y comodines.
- **Comida**: objetivo por fase, registro manual y alimentos frecuentes.
- **Ciclo**: calendario de fases, predicciones, registro de regla y ánimo.
- **Progreso**: nivel, estadísticas y mensaje para el Bro.

## 8. Hoja de ruta
1. **MVP (prototipo actual):** motor de ciclo, nutrición y misiones. Datos locales.
2. **v1 móvil:** React Native o Swift, notificaciones, Apple Health y Health Connect.
3. **IA:** foto de comida con un modelo de visión (por ejemplo Claude) y coach semanal que lee el registro y ajusta el plan.
4. **Social:** retos Sis vs. Bro y grupos pequeños (no un feed abierto, que fue una queja de InOut).
5. **Aprendizaje del ciclo:** ajustar la duración media y la ovulación con registros reales y, si se conecta, temperatura basal o wearables.

## 9. Aviso
Sis Bro no es un dispositivo médico ni un método anticonceptivo. Las predicciones son estimaciones.
