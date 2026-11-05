# CLAUDE.md — Gym Tracker (proyecto Hefesto)

PWA personal para registrar entrenamiento de gym y medidas corporales durante un plan Upper/Lower de 12 semanas. La rutina original está en `docs/rutina-gym-upper-lower.md`.

---

## 1. Cómo trabajar en este proyecto

- Actúa como socio de desarrollo: si ves un hueco, una contradicción o una complicación innecesaria, dilo antes de programar.
- El dueño estudia Ingeniería en Sistemas (3er semestre) y mantiene el proyecto solo. **Prefiere siempre la solución más simple.** Si propones algo complejo, justifícalo.
- Cuando uses un concepto o API que quizá no domine (IndexedDB, service workers, Web Share API, hooks de Dexie, etc.), explícalo en 2-3 líneas, lo justo para mantenerlo.
- Trabaja en pasos pequeños y verificables. Un paso = algo que se puede probar en el celular.
- **No rediseñes lo que está en "Decidido"** (sección 9) sin que se pida. Si un cambio afecta algo decidido, señálalo explícitamente.
- No agregues pantallas, módulos, dependencias ni features fuera de este documento sin preguntar.
- Código listo para usar, sin relleno. Responde en español; el código (nombres de variables, tipos) en inglés.

---

## 2. Contexto de uso

- Uso principal: **iPhone, en el gym**, con una mano, entre series.
- Prioridad: **ahorrar datos**. Offline es deseable, no obligatorio.
- Usuarios: el dueño y quizá un amigo. **Cada quien en su propio teléfono = sus propios datos.** No hay cuentas ni login.

---

## 3. Stack

| Pieza | Elección |
|---|---|
| Base | Vite + React + TypeScript |
| Datos | Dexie.js (envoltorio de IndexedDB) |
| PWA | vite-plugin-pwa (manifest + service worker, precache de la app) |
| Gráficas | uPlot o Chart.js: elegir la más ligera que cubra líneas simples |
| Hosting | Estático gratis (Cloudflare Pages, Netlify o GitHub Pages) |
| Backend | **Ninguno.** Plan B futuro: Supabase o Firebase |

Mantener dependencias al mínimo. Nada de librerías de UI pesadas, routers complejos ni gestores de estado globales si React + hooks alcanzan.

---

## 4. Estructura del proyecto (propuesta inicial)

```
public/
  plan.json            # plantilla de la rutina (ejercicios + slots)
src/
  db/                  # ÚNICO lugar que toca Dexie (capa de guardado)
    db.ts              # definición de tablas
    repo.ts            # funciones: saveWorkout, getLastWorkout, addMeasurement...
  domain/              # lógica pura, sin React ni Dexie (fácil de probar)
    rotation.ts        # siguiente sesión
    progression.ts     # sugerencia de subir/bajar peso
    plan-week.ts       # semana del plan, descarga
    units.ts           # conversión kg/lb, STEP
  screens/             # Welcome, Home, Session, Measurements, Progress, Settings
  components/          # botones +/−, temporizador, etc.
```

**Regla clave:** las pantallas nunca llaman a Dexie directamente; usan `db/repo.ts`. Así, migrar a Supabase (Plan B) solo cambia esa carpeta.

---

## 5. Modelo de datos

```ts
// ---------- PLANTILLA (se carga una vez desde plan.json) ----------
type SessionKey = 'UPPER_A' | 'LOWER_A' | 'UPPER_B' | 'LOWER_B' | 'UPPER_C';
type Unit = 'kg' | 'lb' | 'pin';   // pin = "barrita": posición de placa en máquinas sin peso marcado

interface Exercise {
  id: string;                      // 'press-plano'
  name: string;                    // 'Press plano con barra'
  metric: 'reps' | 'seconds';      // plancha = seconds
  defaultUnit: Unit;               // kg en barra/mancuernas, pin en máquinas y poleas
  defaultPerSide: boolean;         // true en barra con discos
  unilateral?: boolean;            // reps por pierna/brazo (búlgara)
}

interface TemplateSlot {
  sessionKey: SessionKey;
  order: number;                   // 1..7
  exerciseIds: string[];           // 1 o más opciones (dominadas | jalón)
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  short: boolean;                  // ⭐ entra en la versión corta
  note?: string;                   // técnica
}

// ---------- REGISTROS ----------
interface Workout {
  id: string;
  sessionKey: SessionKey;
  mode: 'full' | 'short';
  startedAt: number;               // timestamp ms
  finishedAt?: number;             // vacío = sesión en curso
  entries: Entry[];                // embebidas (decisión, ver abajo)
}

interface Entry {
  exerciseId: string;              // la opción elegida
  unit: Unit;                      // copia de lo usado ese día
  perSide: boolean;                // copia de lo usado ese día
  repMin: number;                  // copia de la plantilla ese día
  repMax: number;
  sets: { weight: number; value: number; done: boolean }[];  // value = reps o segundos
}

interface Measurement {
  id: string;
  date: string;                    // 'YYYY-MM-DD'
  type: 'weight' | 'waist';
  value: number;                   // kg o cm
}

// ---------- AJUSTES (una sola fila) ----------
interface Settings {
  planStartDate: string;           // 'YYYY-MM-DD', define la semana 1
  includeUpperC: boolean;
  lastBackupAt?: number;
}

// ---------- CONSTANTES (en código, no en la base) ----------
const STEP: Record<Unit, number> = { kg: 2.5, lb: 5, pin: 1 };
const KG_TO_LB = 2.2046;
```

**Tablas Dexie:** `workouts`, `measurements`, `settings`, `plan` (ejercicios + slots).

**Por qué `entries` va embebido en `Workout`:** ~55 sesiones en 12 semanas; recorrerlas todas es instantáneo. Cada sesión es un solo objeto, el respaldo JSON es trivial y no hay joins. No normalizar.

**Principios del modelo:**
1. La rutina es **dato** (plan.json), no código.
2. Los registros **copian** lo esencial de la plantilla (rango de reps, unidad) para que cambiar la plantilla no rompa el historial.
3. **Lo calculable no se guarda** (siguiente sesión, semana, descarga, sugerencias, promedios, última opción elegida).

---

## 6. Reglas de dominio

| Qué | Regla |
|---|---|
| **Siguiente sesión** | Toma la última `Workout` terminada y avanza en el ciclo `UPPER_A → LOWER_A → UPPER_B → LOWER_B → (UPPER_C si includeUpperC) → UPPER_A`. Sin historial: `UPPER_A`. Faltar no "recupera" nada. Una sesión corta cuenta igual que una completa. |
| **Sesión en curso** | Si existe una `Workout` sin `finishedAt`, Inicio ofrece continuarla. |
| **Semana del plan** | `floor((hoy − planStartDate) / 7 días) + 1`, por calendario. |
| **Descarga** | Semanas 6 y 12: mitad de series (redondeo hacia arriba), mismo peso, **sin** sugerencia de subir peso. Inicio lo avisa. |
| **Semanas 1-2** | Adaptación: la app puede mostrar "3 en reserva" como recordatorio. Sin lógica extra. |
| **Versión corta** | Solo slots con `short = true`. |
| **Valores precargados** | Cada ejercicio precarga unidad, perSide, peso y reps de la última `Entry` de ese ejercicio. Sin historial: valores por defecto del `Exercise`. |
| **Opción de slot** | Precarga la opción elegida la última vez en esa misma `sessionKey` (se deduce del historial). |
| **Subir peso** | Si en la última sesión del ejercicio **todas** las series llegaron a `repMax` → sugerir `peso + STEP[unit]` y volver a `repMin`. |
| **Bajar peso** | Si falló `repMin` en 2 sesiones seguidas → sugerir bajar 5-10% (en `pin`: −1). |
| **Cambio de unidad** | kg ↔ lb se convierte en historial y gráficas. `pin` no se convierte: si un ejercicio cambia hacia o desde `pin`, la gráfica arranca una serie nueva y no hay sugerencia hasta tener una sesión en la unidad nueva. |
| **Peso corporal** | Peso 0 = peso corporal (dominadas). Valor positivo = lastre. |
| **Peso semanal** | Se registra cuando sea (diario); la gráfica muestra el promedio por semana. |
| **Cintura** | Registro semanal. |

---

## 7. Pantallas

Navegación inferior: **Inicio · Medidas · Progreso · Ajustes.** La pantalla de Sesión se abre desde Inicio.

| Pantalla | Contenido | Claves de uso |
|---|---|---|
| **Bienvenida** (solo la primera vez) | Guía para instalar en iOS (Compartir → Añadir a pantalla de inicio), fecha de inicio del plan, ¿incluir Upper C? | Detectar si ya corre instalada (`display-mode: standalone`) y, si no, insistir en instalar. |
| **Inicio** | Semana X de 12, siguiente sesión, botones **Completa** / **Corta ⭐**, enlace pequeño para elegir otra sesión, última sesión hecha, avisos (descarga, respaldo atrasado, sesión en curso), acceso rápido a medidas. | Un toque para empezar. |
| **Sesión** | Un ejercicio por pantalla: nombre, serie N/M, rango de reps, nota de técnica colapsable, selector de opción si el slot tiene varias, peso con +/− y selector kg/lb/barrita, reps (o segundos) con +/−, botón ✓, temporizador de descanso, sugerencia de peso en una línea, anterior/siguiente. | Botones grandes. **Guardar cada serie al marcar ✓** (no al final). El temporizador arranca solo al marcar ✓. |
| **Medidas** | Registrar peso y cintura (fecha = hoy por defecto) + historial con opción de borrar. | Dos campos y un botón. |
| **Progreso** | Gráficas: cintura, peso (promedio semanal), progresión por ejercicio (selector de ejercicio). | Ligero. |
| **Ajustes** | Exportar / importar respaldo, fecha del último respaldo, incluir Upper C, fecha de inicio del plan. | Exportar con Web Share API. |

**Temporizador:** guardar la hora de fin (`endsAt`) y calcular lo restante contra `Date.now()`, no contar con `setInterval`, para que no se desfase si la app pasa a segundo plano. En iOS **no** suena ni vibra con la pantalla bloqueada; en v1 es solo visual.

---

## 8. iOS y almacenamiento

- Safari puede borrar el almacenamiento tras ~7 días sin visitar el sitio, **salvo que la PWA esté instalada** en la pantalla de inicio.
- Mitigación:
  1. Bienvenida con guía de instalación.
  2. Exportar respaldo JSON con Web Share API (guardar en Archivos / iCloud). Si Web Share no está disponible, descargar el archivo.
  3. Aviso en Inicio: "Último respaldo hace X días" (umbral sugerido: 7).
  4. Importar respaldo desde archivo.
- Formato del respaldo: `{ schemaVersion, exportedAt, settings, workouts, measurements }`. `schemaVersion` permite migrar respaldos viejos si el modelo cambia.
- La plantilla (`plan`) no va en el respaldo: se recarga de `plan.json`.

---

## 9. Estado

### Decidido
- PWA local-first, sin backend ni cuentas; un teléfono = un usuario.
- Stack de la sección 3.
- Modelo de datos de la sección 5 (incluye `entries` embebidas y unidades por ejercicio).
- Peso en barra registrado **por lado**; sin cálculo de total barra + discos.
- Unidades kg / lb / barrita (`pin`) por ejercicio, recordadas desde el historial.
- Catálogo de ejercicios **fijo en v1**, cargado desde `plan.json`, sin pantalla de edición.
- Semana del plan y descarga **por calendario**.
- Las 5 pantallas + bienvenida de la sección 7.
- Respaldo JSON + Web Share API + aviso de último respaldo.
- Sin fotos, sin comidas, sin notificaciones push, sin temporizador en segundo plano.
- Gráficas con **Chart.js**.
- Importar respaldo **reemplaza todo** (con confirmación previa).
- Nombre provisional de la app: **Gym Tracker**.
- Node se instala con **nvm** (por usuario, sin sudo).

### Pendiente
- Diseño visual (se define con la pantalla de Sesión funcionando).
- Verificar si los datos creados en Safari pasan a la PWA instalada (probablemente no).
- Hosting (decidir en el paso 10; afecta `base` en Vite).

### Ideas (no construir sin pedirlo)
- Sincronización con Supabase / Firebase.
- Aviso de descanso con pantalla bloqueada.

---

## 10. Plan de trabajo

1. Convertir `docs/rutina-gym-upper-lower.md` a `public/plan.json` y validar el modelo contra la rutina real.
2. Scaffolding: Vite + React + TS + Dexie + vite-plugin-pwa; tablas y carga de `plan.json`.
3. `domain/`: rotación, semana/descarga, progresión, unidades (con pruebas simples).
4. Pantalla **Inicio** con siguiente sesión.
5. Pantalla **Sesión** (registro serie por serie + temporizador). Probar en el iPhone.
6. **Medidas**.
7. **Ajustes** + respaldo exportar/importar.
8. **Bienvenida** + guía de instalación.
9. **Progreso** (gráficas).
10. Deploy y prueba real en el gym.
