# Supuestos de cálculo

Todas las cifras de la app son **estimaciones** y se muestran como tales.

## Energía (`src/lib/nutrition.ts`)

**Metabolismo basal (Mifflin-St Jeor):** `10 × peso(kg) + 6,25 × estatura(cm) − 5 × edad + C`, con C = +5 (sexo masculino), −161 (femenino) o −78 (punto medio, si la persona no lo declara; se avisa de la menor precisión).

**Gasto total:** basal × factor de actividad: sedentaria 1,2 · ligera 1,375 · moderada 1,55 · alta 1,725 · muy alta 1,9. Si la persona no elige un nivel, se infiere de los días de entrenamiento, la ocupación y los pasos.

**Ajuste por objetivo principal** (central y rango):

| Objetivo | Central | Rango |
|---|---|---|
| Perder grasa | −15 % | −20 % a −10 % |
| Recomposición | −5 % | −10 % a 0 % |
| Ganar músculo | +8 % | +5 % a +10 % |
| Fuerza, glúteos y piernas, tren superior | +5 % | 0 % a +8 % |
| Resto | 0 % | ±5 % |

**Protecciones:**

- Nunca por debajo de `max(basal, 1200 mujer / 1500 hombre / 1350 sin dato)` cuando hay déficit.
- Menores de 18 años: solo mantenimiento.
- Embarazo o posparto: sin déficit.
- IMC < 18,5 con objetivo de perder grasa: sin déficit.
- Antecedentes de TCA: sin cifras visibles y sin déficit; se recomienda apoyo profesional.

**Macros:** proteína 2,0 g/kg (perder grasa, recomposición), 1,8 g/kg (objetivos de músculo y fuerza) o 1,4 g/kg (resto). Con IMC > 30 se usa el peso de referencia de IMC 25. Grasa: máximo entre 0,8 g/kg y el 25 % de la energía (si los carbohidratos quedan por debajo de 100 g, se baja al 20 % o 0,6 g/kg). Carbohidratos: el resto.

**Agua:** 35 ml/kg como guía general.

### Casos de referencia (probados en `src/lib/engines.test.ts`)

| Caso | Resultado |
|---|---|
| Mujer, 30 años, 165 cm, 60 kg | Basal 1320,25 kcal |
| Hombre, 25 años, 180 cm, 80 kg | Basal 1805 kcal |
| Mujer, 30 años, 165 cm, 70 kg, actividad moderada, perder grasa | Basal 1420,25 kcal; gasto 2201 kcal; objetivo 1870 kcal (−15 %, redondeado a 10); proteína 140 g |
| Mujer, 60 años, 150 cm, 50 kg, sedentaria, perder grasa | Limitado a ≥ 1200 kcal y ≥ basal |

## Plan de comidas (`src/lib/meals.ts`)

- **Reglas duras** (nunca se relajan): dieta, alérgenos declarados y alimentos rechazados.
- **Reglas blandas** (se relajan si hay menos de 3 opciones): presupuesto, tiempo de cocina y estilo.
- **Reparto de la energía:** con 4 comidas, desayuno 25 %, almuerzo 35 %, merienda 10 % y cena 30 %. Porciones redondeadas a 0,25 entre 0,5 y 2,5.
- **Valores de las recetas:** estimados a partir de tablas de composición estándar. Se verificó que `4P + 4C + 9G` no se desvíe más de un 8 % de las calorías declaradas.

## Progresión (`src/lib/workouts/progression.ts`)

Doble progresión:

1. Dolor en la última sesión: no se sube carga; se sugiere sustituir.
2. Técnica dudosa o recuperación baja (energía ≤ 2 o agujetas ≥ 4): se repite el peso.
3. Dos o más series por debajo del rango, o esfuerzo medio ≥ 9,5: se baja ~10 %.
4. Todas las series en el tope del rango con esfuerzo ≤ 8,5: se sube el incremento del ejercicio (barra pierna 5 kg, barra torso 2,5 kg, mancuernas 2 kg, máquinas 2,5 a 5 kg).
5. En otro caso: +1 repetición.

1RM estimado con Epley: `peso × (1 + reps/30)`. Es orientativo.

## Ciclo (`src/lib/cycle.ts`)

- Duración: mediana de los últimos 6 ciclos registrados (15 a 60 días). Si no hay registros, se usa la duración típica declarada; solo en último caso, 28 días con confianza baja.
- Ovulación estimada: duración − 14. Ventana de ovulación ± 1 día.
- Variabilidad: la mitad del rango registrado (mínimo 2 días), 7 días si es irregular.
- Con anticoncepción hormonal o sin deseo de ver fases, no se estiman fases.
- Los síntomas que bajan la energía o una energía ≤ 2 tienen prioridad sobre la fase y solo **ofrecen** una opción más suave.
