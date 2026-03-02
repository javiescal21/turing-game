# Turing Game — Documento de Entrega

**Nombre del proyecto:** Turing Game

**URL de producción:** https://turing-game-seven.vercel.app/

**📦 Repositorio GitHub:** **[https://github.com/javiescal21/turing-game](https://github.com/javiescal21/turing-game)** (branch `main`)

**Equipo:** Israel Hernández y Javier Escalante 

**Fecha:** Marzo 2026

---

## 1. Resumen del Proyecto

Turing Game es una aplicación web que implementa una versión moderna y jugable del Test de Turing. Un jugador (el interrogador) conversa simultáneamente con dos testigos en paneles de chat paralelos: uno es una persona real y el otro es un agente de inteligencia artificial (Claude, de Anthropic). El interrogador tiene 4 minutos para descubrir quién es quién.

La aplicación es completamente funcional en navegador, no requiere cuentas ni autenticación, y permite jugar una partida completa en menos de 6 minutos.

---

## 2. Instrucciones de Uso

### 2.1 — Crear una partida (Interrogador / P1)

1. Abrir https://turing-game-seven.vercel.app/
2. Hacer clic en **"Create Game"**
3. Se genera una sala de espera con un enlace de invitación
4. Copiar el enlace y enviarlo al compañero (P2)
5. Esperar a que P2 se una — la pantalla cambia automáticamente cuando se conecta

### 2.2 — Unirse a una partida (Testigo / P2)

1. Abrir el enlace de invitación recibido (formato: `https://turing-game-seven.vercel.app/join/XXXXXXXX`)
2. Leer el aviso: uno de los testigos es una IA, el interrogador no sabe cuál eres tú
3. Hacer clic en **"Accept & Join"**
4. Comienza el chat con el interrogador

### 2.3 — Jugar (fase activa — 4 minutos)

**Interrogador (P1):**
- Ve dos paneles: "Witness A" y "Witness B"
- Puede escribir a ambos testigos simultáneamente
- Uno es la persona real (P2) y el otro es la IA — el interrogador no sabe cuál es cuál
- Debajo de cada panel hay un selector: "Human" o "AI"
- El botón "Submit Guess" se activa cuando ambos selectores tienen una opción elegida
- Puede enviar su respuesta en cualquier momento (termina el juego inmediatamente) o esperar a que expire el temporizador

**Testigo (P2):**
- Ve un solo panel de chat
- Responde normalmente al interrogador
- Cuando se acaba el tiempo, el chat se desactiva y aparece un mensaje de espera

### 2.4 — Resultado

- Si el temporizador principal expira sin guess, se abre una ventana de 2 minutos para adivinar
- Si no adivina en esos 2 minutos, se cuenta como respuesta incorrecta (timeout)
- Al enviar el guess o al expirar el timeout:
  - **P1** ve un overlay con la identidad real de cada testigo, si acertó o no, y un mensaje final de reflexión de la IA
  - **P2** ve si logró engañar al interrogador o no
- Ambos pueden hacer clic en "Play Again" para volver al inicio

---

## 3. Arquitectura Técnica

### Stack

| Componente | Tecnología |
|---|---|
| Frontend + Backend | Next.js 16 (App Router) con TypeScript |
| Estilos | Tailwind CSS 4 (dark theme) |
| Base de datos | Supabase (PostgreSQL) |
| Comunicación en tiempo real | Supabase Realtime (postgres_changes) |
| Agente de IA | Claude (Anthropic) via Vercel AI SDK |
| Modelo | `claude-haiku-4-5` (placeholder para `claude-sonnet-4-6` en producción final) |
| Hosting | Vercel |

### Modelo de datos

**Tabla `games`:** Almacena el estado de cada partida — ID, estatus (`waiting` → `ready` → `guessing` → `ended`), slot asignado a Claude (oculto al interrogador hasta el final), persona generada, resultado del guess, timestamps.

**Tabla `messages`:** Almacena todos los mensajes del chat — sender (`p1`, `p2`, `claude`), slot (`left`/`right`), contenido, timestamp. Se usa Supabase Realtime para entregar mensajes en tiempo real a todos los participantes.

### Agente de IA — Cómo funciona

Claude no tiene un proceso persistente. Se invoca **por mensaje**: cada vez que P1 escribe en el slot de Claude, el servidor:

1. Inserta el mensaje de P1 en Supabase
2. Aplica un delay aleatorio proporcional a la longitud del mensaje (3-10 segundos) para simular tiempo humano de lectura y escritura
3. Reconstruye el contexto: system prompt (ensamblado desde archivos de habilidades .md) + historial completo de conversación + persona generada
4. Llama a Claude con streaming y devuelve la respuesta token por token
5. Al terminar, guarda la respuesta completa en Supabase

Los archivos de habilidades (`agent-skills/`) controlan el comportamiento de Claude:

| Archivo | Propósito |
|---|---|
| `persona.md` | Instrucciones para mantener una persona consistente de estudiante ITAM. Contexto bilingüe español/inglés. Reglas de matching de energía (no sobre-elaborar en saludos). |
| `pacing.md` | Calibración de longitud y tono. Máximo 10% de mensajes con filler/slang. Capitalización normal. |
| `typo-engine.md` | Motor probabilístico de imperfecciones: 30% de mensajes con un error menor (typo, acento faltante, apóstrofe omitido). |
| `result-reflection.md` | Instrucciones para el mensaje final post-juego. Claude rompe personaje brevemente para reaccionar al resultado. |

### Flujo de estados del juego

```
waiting → ready → guessing → ended
  (P2 joins)  (timer expires)  (guess submitted / timeout)
                    ↗
              ready → ended  (early guess — P1 submits before timer)
```

---

## 4. Estructura de Archivos Principales

```
src/
├── app/
│   ├── page.tsx                          # Home — botón "Create Game"
│   ├── layout.tsx                        # Layout global (dark theme)
│   ├── globals.css                       # Estilos globales + scrollbar
│   ├── api/
│   │   ├── create-game/route.ts          # POST — crea partida
│   │   ├── claude-message/route.ts       # POST — procesa mensaje + respuesta IA
│   │   └── end-game/route.ts             # POST — evalúa guess + reflexión IA
│   ├── game/[gameId]/
│   │   ├── page.tsx                      # Server component — P1
│   │   └── game-client.tsx               # Client component — máquina de estados P1
│   └── join/[gameId]/
│       ├── page.tsx                      # Server component — P2
│       └── join-client.tsx               # Client component — flujo P2
├── components/
│   ├── ChatPanel.tsx                     # Panel de chat reutilizable
│   ├── CountdownTimer.tsx                # Temporizador sincronizado al servidor
│   ├── GuessDropdown.tsx                 # Selector Human/AI
│   └── ResultOverlay.tsx                 # Overlay de resultado (P1)
├── lib/
│   ├── supabase.ts                       # Clientes Supabase (browser + server)
│   ├── game.ts                           # Tipos + helpers de consulta
│   └── claude.ts                         # Invocación de Claude + habilidades
└── agent-skills/
    ├── persona.md                        # Persona + contexto ITAM + idioma
    ├── pacing.md                         # Calibración de tono y longitud
    ├── typo-engine.md                    # Motor de imperfecciones
    └── result-reflection.md              # Reflexión post-juego
```

---

## 5. Decisiones de Diseño Relevantes

1. **Sin autenticación** — La URL de invitación funciona como token de acceso. Simplifica el MVP sin comprometer la funcionalidad.
2. **`claude_slot` oculto** — El slot asignado a Claude nunca se expone al frontend hasta que el juego termina. Esto previene que P1 haga trampa inspeccionando el DOM o las peticiones de red.
3. **Delay obligatorio del servidor** — Claude responde demasiado rápido para ser creíble. Se implementó un delay de 3-10 segundos proporcional a la longitud del mensaje, ejecutado en el servidor para que no pueda ser evadido.
4. **Persona ITAM** — El generador de personas crea estudiantes de ITAM (Ing. en Computación, Ciencia de Datos, etc.) ya que los testers principales son estudiantes y profesores de ITAM.
5. **Streaming** — Las respuestas de Claude se transmiten token por token usando Vercel AI SDK. P1 ve la respuesta construyéndose en tiempo real, igual que en cualquier chat.
6. **Supabase Realtime** — Los mensajes y cambios de estado se propagan instantáneamente a todos los participantes sin polling.

---

## 6. Cómo Ejecutar Localmente

```bash
# Clonar el repositorio
git clone <repo-url>
cd turing-game

# Instalar dependencias
pnpm install

# Configurar variables de entorno
cp .env.local.example .env.local
# Llenar: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#          SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY

# Ejecutar la migración SQL en Supabase (SQL Editor del dashboard)
# Archivo: supabase/migrations/001_create_tables.sql

# Iniciar el servidor de desarrollo
pnpm dev
```

---

## 7. Limpiar Base de Datos (Supabase)

Para reiniciar entre sesiones de prueba, ejecutar en el SQL Editor de Supabase:

```sql
DELETE FROM messages;
DELETE FROM games;
```

Los mensajes se borran primero por la restricción de foreign key.
