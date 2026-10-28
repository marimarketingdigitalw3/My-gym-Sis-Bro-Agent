# Sis Bro

Programa de 66 días que adapta entrenamiento, comida y hábitos a la fase del ciclo menstrual.

Nace de la ingeniería inversa de tres apps de la App Store:

| App | Qué aporta |
|---|---|
| **Lively** (cycle syncing) | Motor de fases, consejos diarios, modo pareja |
| **InOut** (contador de calorías) | Registro de comidas, balance de calorías y macros |
| **Life Reset** (hábito de 66 días) | Programa de 66 días, misiones, XP, niveles y rachas |

## Documentación
- [`docs/01-ingenieria-inversa.md`](docs/01-ingenieria-inversa.md): análisis de cada app (funciones, bucle de uso, modelo de datos inferido, monetización, fortalezas y debilidades).
- [`docs/02-producto-combinado.md`](docs/02-producto-combinado.md): especificación del producto combinado, reglas del motor, monetización y hoja de ruta.

## Prototipo
Web app sin dependencias en `app/`. Los datos se guardan solo en el navegador.

```bash
npm start   # abre http://localhost:8080
npm test    # pruebas del motor (ciclo, nutrición, misiones y rachas)
```

Estructura:
```
app/js/cycle.js      Fases, predicciones y consejos por fase
app/js/nutrition.js  Calorías y macros según objetivo y fase
app/js/quests.js     Programa de 66 días, XP, niveles, racha y comodines
app/js/app.js        Interfaz: Hoy, Comida, Ciclo, Progreso
```

> Sis Bro no es un dispositivo médico ni un método anticonceptivo. Las predicciones son estimaciones.
