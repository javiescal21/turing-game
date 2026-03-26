# Turing Game — Estado Actual del Proyecto

> Última actualización: Marzo 2026  
> Repositorio: [github.com/javiescal21/turing-game](https://github.com/javiescal21/turing-game)  
> Producción: [turing-game-seven.vercel.app](https://turing-game-seven.vercel.app/)

---

## 1. Síntesis

### Objetivo

Turing Game es un test de Turing jugable en navegador. Un interrogador (P1) conversa simultáneamente con dos testigos — uno es una persona real (P2) y el otro es una instancia de Claude (Anthropic) haciéndose pasar por humano. P1 tiene 10 minutos para descubrir quién es quién.

### Stack tecnológico

| Capa | Tecnología |
|---|---|
| App (fullstack) | Next.js 16 — App Router, TypeScript, React 19 |
| Estilos | Tailwind CSS 4, dark theme |
| Base de datos + Realtime | Supabase (PostgreSQL + Realtime pub/sub) |
| Agente de IA | Claude Sonnet 4.6 vía Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) |
| IDs de partida | `nanoid` (8 caracteres) |
| Hosting | Vercel (Hobby tier, deploy automático desde `main`) |

### Features principales

- Partida sin autenticación — la URL de invitación funciona como token de acceso.
- Dos paneles de chat simultáneos para P1 (Witness A / Witness B), un solo panel para P2.
- Claude ocupa un slot aleatorio (`left` o `right`), oculto a P1 hasta el final.
- Respuestas de Claude streameadas token por token con delay humanizado (15–45s).
- Persona generada dinámicamente por partida (estudiante de ITAM).
- Temporizador de 10 min para chat + 2 min para adivinar.
- Sistema de **lessons compuestas** que hace a Claude más convincente con cada partida.
- Reflexión post-juego de Claude y feedback opcional de P1.
- Interfaz responsive (mobile tabs + desktop side-by-side).

---

## 2. Experiencia de juego

### Flujo de P1 (Interrogador)

1. **Home** (`/`) — Clic en "Create Game". Se genera un `gameId` y se redirige a `/game/{gameId}`.
2. **Lobby** — Pantalla de espera con enlace de invitación copiable. Escucha vía Supabase Realtime hasta que P2 se une.
3. **Chat activo** — Dos paneles lado a lado (desktop) o con tabs (mobile): "Witness A" y "Witness B". P1 escribe a ambos. Un countdown de 10 minutos corre en el header. Los mensajes al slot de Claude se procesan por la API y regresan como stream; los mensajes al slot de P2 se insertan directo en Supabase y P2 los ve en tiempo real.
4. **Fase de guess** — Al expirar el timer (o si P1 decide antes), se activan dos dropdowns (Human/AI) debajo de cada panel. P1 tiene 2 minutos adicionales para enviar su adivinanza. Si no adivina, se registra como timeout (incorrecto).
5. **Resultado** — Un overlay muestra: identidad real de cada testigo, si P1 acertó o no, mensaje de reflexión de Claude, y un campo opcional de feedback. Clic en "Play Again" reinicia.

### Flujo de P2 (Testigo humano)

1. **Join** (`/join/{gameId}`) — Ve un aviso de que será un testigo y que el interrogador no sabe quién es humano. Clic en "Accept & Join".
2. **Chat activo** — Un solo panel de chat con P1. Responde normalmente. Ve el mismo countdown de 10 minutos.
3. **Esperando guess** — Al expirar el timer, el chat se deshabilita y P2 espera el resultado.
4. **Resultado** — Ve si el interrogador lo identificó correctamente o si logró confundirlo. "Play Again" regresa al home.

### Diagrama de estados

```
waiting → ready → guessing → ended
  (P2 joins)  (timer expira)  (guess enviado / timeout)
                    ↗
              ready → ended  (P1 envía guess antes del timer)
```

---

## 3. Cómo se arma la instancia de Claude

Claude no tiene un proceso persistente. Se invoca **por mensaje** desde `POST /api/claude-message`. Cada invocación ensambla un contexto completo a partir de tres fuentes:

### 3.1 Archivos de habilidades (agent-skills)

Archivos Markdown en `src/agent-skills/` leídos con `fs.readFileSync` al inicio del proceso (cacheados en memoria). Tres se inyectan en el system prompt de cada mensaje, uno se usa solo post-juego:

| Archivo | Qué hace |
|---|---|
| `persona.md` | Instrucciones maestras: nunca romper personaje, matching de energía, reglas de idioma español/inglés, reveal progresivo de la identidad (broad → specific), contexto ITAM, qué NO hacer. |
| `pacing.md` | Calibración de longitud (short in → short out), tono informal universitario, límites de filler/slang (máx 10%), evitar AI-tells como "certainly" o "absolutely". |
| `typo-engine.md` | Motor probabilístico: ~30% de mensajes llevan una imperfección (typo, acento faltante, apóstrofe omitido). Nunca más de un error por mensaje. |
| `result-reflection.md` | Solo para el mensaje final post-juego: Claude rompe personaje brevemente para comentar el resultado. |

### 3.2 Persona generada (JSON)

En la primera invocación de cada partida, `generatePersona()` en `src/lib/claude.ts` llama a Claude para generar un JSON con: nombre, edad, carrera ITAM, semestre, intereses, y notas de personalidad. Se guarda en `games.claude_persona` y se inyecta en el system prompt como bloque JSON.

### 3.3 Lessons aprendidas

`getLessons()` en `src/lib/game.ts` trae todas las lessons de la tabla `lessons` ordenadas por peso descendente. Se inyectan en el system prompt como lista con prioridad:

```
## Lessons from past games (apply these strictly):
- [priority 8/10] No uses signos de exclamación al saludar
- [priority 6/10] Responde más corto cuando te preguntan algo simple
```

### Ensamblaje del prompt

`buildSystemPrompt()` concatena: `persona.md` + bloque JSON de persona + bloque de lessons + `pacing.md` + `typo-engine.md`. El historial de conversación se construye con `buildConversationHistory()`, que filtra mensajes del slot de Claude y los formatea como turnos `user`/`assistant` alternados (merge de turnos consecutivos del mismo rol).

---

## 4. Arquitectura del repositorio

### 4.1 Capa de React — Páginas y componentes

**Páginas (App Router):**

| Ruta | Archivo | Rol |
|---|---|---|
| `/` | `src/app/page.tsx` | Home — botón "Create Game" |
| `/game/[gameId]` | `src/app/game/[gameId]/page.tsx` → `game-client.tsx` | Vista de P1: lobby, chat dual, guess, resultado |
| `/join/[gameId]` | `src/app/join/[gameId]/page.tsx` → `join-client.tsx` | Vista de P2: join, chat single, resultado |

Las `page.tsx` son server components mínimos que extraen `params` y renderizan el client component correspondiente.

**Componentes reutilizables (`src/components/`):**

| Componente | Función |
|---|---|
| `ChatPanel.tsx` | Lista de mensajes con burbujas, input de texto, soporte para streaming con cursor animado, auto-scroll. |
| `CountdownTimer.tsx` | Countdown sincronizado a `started_at` del servidor (no al reloj local). Tick de 250ms, estilo urgente en los últimos 30s. |
| `GuessDropdown.tsx` | Select con opciones Human / AI debajo de cada panel. |
| `ResultOverlay.tsx` | Overlay fullscreen: resultado, grilla de identidades, campo de feedback opcional, "Play Again". |

### 4.2 API Routes (`src/app/api/`)

| Endpoint | Método | Qué hace |
|---|---|---|
| `/api/create-game` | POST | Genera `nanoid(8)`, elige `claude_slot` al azar, inserta fila en `games`. Retorna `{ gameId }`. |
| `/api/claude-message` | POST | Recibe `{ gameId, slot, content }`. Inserta mensaje de P1. Si el slot es de Claude: aplica delay (15–45s), genera persona si es la primera vez, ensambla prompt con skills + lessons, streamea respuesta de Claude Sonnet 4.6, guarda respuesta en `messages`. Si no es el slot de Claude: retorna `{ ok: true }`. |
| `/api/end-game` | POST | Recibe `{ gameId, guessLeft?, guessRight?, timeout? }`. Evalúa acierto comparando guesses vs `claude_slot`. Actualiza `games` a `ended`. Genera reflexión post-juego (best-effort). Retorna `{ guessCorrect, claudeSlot }`. |
| `/api/game-feedback` | POST | Recibe `{ gameId, feedback?, skip? }`. Guarda feedback como mensaje con `slot: null`. Dispara `analyzeGame()` (fire-and-forget) para generar lessons. |

### 4.3 Librería utilitaria (`src/lib/`)

| Archivo | Contenido |
|---|---|
| `supabase.ts` | Dos factories: `createBrowserSupabaseClient()` (anon key, para client components y Realtime) y `createServerSupabaseClient()` (service role key, para API routes). |
| `game.ts` | Tipos (`Game`, `Message`, `Lesson`, `GameStatus`, `Slot`, `Sender`, `Guess`), constantes (`GAME_DURATION_SECONDS = 600`, `GUESS_DURATION_SECONDS = 120`), helpers de consulta (`getGame`, `getMessages`, `insertMessage`, `updateGame`), helpers de lessons (`getLessons`, `upsertLessons`, `evictExcessLessons`). |
| `claude.ts` | Carga de skills (`getSkills`), ensamblaje de prompt (`buildSystemPrompt`), formateo de historial (`buildConversationHistory`), generación de persona (`generatePersona`), reflexión post-juego (`generateReflection`), análisis post-juego (`analyzeGame`). |

---

## 5. Esquema relacional de la base de datos

Tres tablas en Supabase (PostgreSQL), definidas en `supabase/migrations/`.

### 5.1 Tabla `games`

> Migración: `supabase/migrations/001_create_tables.sql`  
> API que la alimenta: `/api/create-game` (insert), `/api/claude-message` (update persona), `/api/end-game` (update resultado), client-side update en join (status → ready)

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `TEXT` PK | nanoid de 8 caracteres |
| `status` | `game_status` enum | `waiting` → `ready` → `active` → `guessing` → `ended` |
| `claude_slot` | `slot_type` enum | `left` o `right` — oculto a P1 hasta ended |
| `claude_persona` | `JSONB` | Persona generada (nombre, carrera, intereses, etc.) |
| `p1_guess_left` | `guess_type` enum | `human` o `ai` — guess de P1 para Witness A |
| `p1_guess_right` | `guess_type` enum | `human` o `ai` — guess de P1 para Witness B |
| `guess_correct` | `BOOLEAN` | Si P1 acertó ambos |
| `created_at` | `TIMESTAMPTZ` | Creación de la partida |
| `started_at` | `TIMESTAMPTZ` | Cuando P2 se une |
| `ended_at` | `TIMESTAMPTZ` | Cuando se resuelve el juego |

### 5.2 Tabla `messages`

> Migración: `supabase/migrations/001_create_tables.sql`  
> API que la alimenta: `/api/claude-message` (insert P1 + Claude), `/api/end-game` (insert reflexión), `/api/game-feedback` (insert feedback), P2 inserta directo desde client via Supabase

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `UUID` PK | Auto-generado |
| `game_id` | `TEXT` FK → `games.id` | Referencia a la partida (cascade delete) |
| `sender` | `sender_type` enum | `p1`, `p2`, o `claude` |
| `slot` | `slot_type` nullable | `left`/`right` para mensajes in-game, `null` para feedback de P1 |
| `content` | `TEXT` | Contenido del mensaje |
| `created_at` | `TIMESTAMPTZ` | Timestamp del mensaje |

Índices: `idx_messages_game_id`, `idx_messages_game_slot`.  
Realtime habilitado para que los subscriptores reciban INSERTs instantáneamente.

### 5.3 Tabla `lessons`

> Migración: `supabase/migrations/002_create_lessons.sql`  
> API que la alimenta: `analyzeGame()` en `src/lib/claude.ts`, invocada desde `/api/game-feedback`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `UUID` PK | Auto-generado |
| `game_id` | `TEXT` FK → `games.id` nullable | Partida que originó la lesson (SET NULL on delete) |
| `content` | `TEXT` | Instrucción imperativa (ej: "No uses signos de exclamación al saludar") |
| `weight` | `SMALLINT` (1–10) | Prioridad/importancia, default 5 |
| `created_at` | `TIMESTAMPTZ` | Creación |
| `updated_at` | `TIMESTAMPTZ` | Última actualización de peso |

Índice: `idx_lessons_weight` (DESC).  
RLS: abierta (permissive, sin auth en MVP).

### Relaciones

```
games (1) ──< messages (N)     game_id FK, CASCADE DELETE
games (1) ──< lessons  (N)     game_id FK, SET NULL on DELETE
```

### Enums

Definidos en `001_create_tables.sql`:
- `game_status`: `waiting`, `ready`, `active`, `guessing`, `ended`
- `slot_type`: `left`, `right`
- `sender_type`: `p1`, `p2`, `claude`
- `guess_type`: `human`, `ai`

---

## 6. Sistema de Lessons — Aprendizaje compuesto

El sistema de lessons es el mecanismo por el cual Claude mejora su desempeño como impostor entre partidas. Funciona como una memoria persistente de errores y aciertos.

### 6.1 Ciclo de vida

1. **Trigger**: Cuando P1 envía feedback (o lo salta) en el `ResultOverlay`, el frontend hace `POST /api/game-feedback`. Este endpoint guarda el feedback como mensaje (si lo hay) y dispara `analyzeGame(gameId)` en modo fire-and-forget.

2. **Análisis** (`analyzeGame` en `src/lib/claude.ts`): Una invocación separada de Claude Sonnet 4.6 actúa como **analista post-juego**. Recibe:
   - El resultado de la partida (¿Claude fue detectado o no?).
   - La transcripción completa de la conversación de Claude (solo mensajes in-game, excluyendo la reflexión post-juego).
   - La transcripción de la conversación del testigo humano (para comparación).
   - El feedback textual de P1 (si lo proporcionó).
   - Todas las lessons existentes con sus IDs y pesos actuales.

3. **Output del analista**: Responde con un JSON que contiene:
   - `new_lessons`: 0–2 lessons nuevas (solo si hay un error o una oportunidad clara y no duplicada).
   - `updated_weights`: Mapa de `lesson_id → nuevo_peso` para re-evaluar lessons existentes según la evidencia de esta partida.

4. **Persistencia** (`upsertLessons` en `src/lib/game.ts`): Las lessons nuevas se insertan y los pesos de las existentes se actualizan. Los pesos se clampean al rango [1, 10].

5. **Evicción** (`evictExcessLessons` en `src/lib/game.ts`): Se mantiene un máximo de **15 lessons**. Si hay más, se eliminan las de menor peso.

### 6.2 Cómo se usan las lessons

En cada invocación de Claude durante una partida (`/api/claude-message`), se llama `getLessons()` que trae todas las lessons ordenadas por `weight DESC`. Se inyectan en el system prompt como un bloque de instrucciones priorizadas:

```
## Lessons from past games (apply these strictly):
- [priority 8/10] Contenido de la lesson más importante
- [priority 7/10] Segunda lesson
- ...
```

Claude debe aplicarlas como reglas adicionales a sus habilidades base.

### 6.3 Ranking de lessons

- **Peso (1–10)**: Refleja la importancia y validez de la lesson. Un peso alto indica que la lesson ha sido validada por múltiples partidas.
- **Re-evaluación continua**: En cada análisis, el analista puede subir el peso de lessons que se siguen validando o bajar el de lessons que ya no son relevantes (Claude ya corrigió ese comportamiento).
- **Deduplicación semántica**: El analista tiene instrucciones explícitas de NO crear lessons que dupliquen semánticamente a una existente — en su lugar, debe ajustar el peso de la existente.
- **Evicción por peso**: Cuando se excede el límite de 15, las lessons con peso más bajo (menos relevantes o ya obsoletas) se eliminan automáticamente. Esto crea un efecto de "memoria de trabajo" donde solo las instrucciones más valiosas sobreviven.

### 6.4 Lógica de compounding

El nombre "compounding" refleja que las lessons se acumulan y refinan con cada partida:

- Partidas tempranas generan lessons básicas (ej: "no respondas con párrafos a un saludo").
- Partidas subsecuentes validan, ajustan pesos, o invalidan lessons previas.
- El pool se estabiliza alrededor de las ~15 instrucciones más efectivas.
- Lessons obsoletas (Claude ya no comete ese error) decaen en peso hasta ser eviccionadas.

Este sistema funciona como un loop de mejora continua sin necesidad de re-entrenar el modelo: el prompt se enriquece partida a partida.

---

## 7. Archivos del proyecto — Referencia rápida

```
turing-game/
├── docs/                              # Documentación del proyecto
│   ├── PRD-turing-game.md            # Product Requirements Document
│   ├── PLAN-implementation.md        # Log detallado de implementación por fases
│   ├── IMPL-turing-game.md           # Guía técnica de setup y decisiones
│   ├── ENTREGA-turing-game.md        # Documento de entrega (español)
│   └── ESTADO-turing-game.md         # Este documento
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Home
│   │   ├── layout.tsx                # Root layout (Geist font, dark theme)
│   │   ├── globals.css               # Estilos globales
│   │   ├── api/
│   │   │   ├── create-game/route.ts
│   │   │   ├── claude-message/route.ts
│   │   │   ├── end-game/route.ts
│   │   │   └── game-feedback/route.ts
│   │   ├── game/[gameId]/
│   │   │   ├── page.tsx
│   │   │   └── game-client.tsx
│   │   └── join/[gameId]/
│   │       ├── page.tsx
│   │       └── join-client.tsx
│   ├── components/
│   │   ├── ChatPanel.tsx
│   │   ├── CountdownTimer.tsx
│   │   ├── GuessDropdown.tsx
│   │   └── ResultOverlay.tsx
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── game.ts
│   │   └── claude.ts
│   └── agent-skills/
│       ├── persona.md
│       ├── pacing.md
│       ├── typo-engine.md
│       └── result-reflection.md
├── supabase/migrations/
│   ├── 001_create_tables.sql         # games + messages + enums + realtime
│   └── 002_create_lessons.sql        # lessons table
├── package.json
├── next.config.ts
├── tsconfig.json
└── postcss.config.mjs
```
