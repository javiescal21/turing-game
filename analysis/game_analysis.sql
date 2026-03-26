-- ============================================================
-- Turing Game — Análisis de Partidas (SQL para Supabase Editor)
-- ============================================================
-- Reemplaza los game_ids en la CTE target_games con tu lista real.
-- Cada sección es una query independiente — copia y ejecuta por separado.

-- ============================================================
-- 0. LISTA DE JUEGOS TARGET (CTE reutilizable)
-- ============================================================
-- Copia esta CTE al inicio de cada query que la necesite.
-- Reemplaza con tus 31 game_ids reales.

-- WITH target_games AS (
--   SELECT unnest(ARRAY[
--     'GAME_ID1','GAME_ID2','GAME_ID3','GAME_ID4','GAME_ID5',
--     'GAME_ID6','GAME_ID7','GAME_ID8','GAME_ID9','GAME_ID10',
--     'GAME_ID11','GAME_ID12','GAME_ID13','GAME_ID14','GAME_ID15',
--     'GAME_ID16','GAME_ID17','GAME_ID18','GAME_ID19','GAME_ID20',
--     'GAME_ID21','GAME_ID22','GAME_ID23','GAME_ID24','GAME_ID25',
--     'GAME_ID26','GAME_ID27','GAME_ID28','GAME_ID29','GAME_ID30',
--     'GAME_ID31'
--   ]) AS id
-- )


-- ============================================================
-- 1. PANORAMA GENERAL — Resumen de los 31 juegos
-- ============================================================

WITH target_games AS (
  SELECT unnest(ARRAY[
    'GAME_ID1','GAME_ID2','GAME_ID3' -- REEMPLAZAR
  ]) AS id
)
SELECT
  g.id                                           AS game_id,
  g.status,
  g.claude_slot,
  g.guess_correct,
  g.p1_guess_left,
  g.p1_guess_right,
  g.created_at,
  g.started_at,
  g.ended_at,
  EXTRACT(EPOCH FROM (g.ended_at - g.started_at)) / 60.0
                                                  AS duracion_minutos,
  g.claude_persona->>'name'                       AS claude_nombre,
  g.claude_persona->>'major'                      AS claude_carrera,
  (SELECT count(*) FROM messages m WHERE m.game_id = g.id)
                                                  AS total_mensajes
FROM games g
JOIN target_games tg ON g.id = tg.id
ORDER BY g.created_at;


-- ============================================================
-- 2. TASA DE ENGAÑO — Deception Rate
-- ============================================================

WITH target_games AS (
  SELECT unnest(ARRAY[
    'GAME_ID1','GAME_ID2','GAME_ID3' -- REEMPLAZAR
  ]) AS id
),
resultados AS (
  SELECT
    g.id,
    g.guess_correct,
    CASE
      WHEN g.guess_correct = true  THEN 'P1 acierta (detectó a Claude)'
      WHEN g.guess_correct = false THEN 'P1 falla (Claude engañó)'
      WHEN g.status = 'ended' AND g.guess_correct IS NULL THEN 'Timeout (cuenta como fallo)'
      ELSE 'Juego no terminado'
    END AS resultado
  FROM games g
  JOIN target_games tg ON g.id = tg.id
  WHERE g.status = 'ended'
)
SELECT
  resultado,
  count(*)                                              AS cantidad,
  round(count(*)::numeric / (SELECT count(*) FROM resultados) * 100, 1)
                                                        AS porcentaje
FROM resultados
GROUP BY resultado
ORDER BY cantidad DESC;


-- ============================================================
-- 3. EXPORTAR GAMES (para CSV)
-- ============================================================

WITH target_games AS (
  SELECT unnest(ARRAY[
    'GAME_ID1','GAME_ID2','GAME_ID3' -- REEMPLAZAR
  ]) AS id
)
SELECT
  g.id,
  g.status,
  g.claude_slot,
  g.claude_persona,
  g.p1_guess_left,
  g.p1_guess_right,
  g.guess_correct,
  g.created_at,
  g.started_at,
  g.ended_at
FROM games g
JOIN target_games tg ON g.id = tg.id
ORDER BY g.created_at;


-- ============================================================
-- 4. EXPORTAR MESSAGES (para CSV)
-- ============================================================

WITH target_games AS (
  SELECT unnest(ARRAY[
    'GAME_ID1','GAME_ID2','GAME_ID3' -- REEMPLAZAR
  ]) AS id
)
SELECT
  m.id,
  m.game_id,
  m.sender,
  m.slot,
  m.content,
  m.created_at
FROM messages m
JOIN target_games tg ON m.game_id = tg.id
ORDER BY m.game_id, m.created_at;


-- ============================================================
-- 5. EXPORTAR LESSONS (para CSV)
-- ============================================================

WITH target_games AS (
  SELECT unnest(ARRAY[
    'GAME_ID1','GAME_ID2','GAME_ID3' -- REEMPLAZAR
  ]) AS id
)
SELECT
  l.id,
  l.game_id,
  l.content,
  l.weight,
  l.created_at,
  l.updated_at
FROM lessons l
LEFT JOIN target_games tg ON l.game_id = tg.id
ORDER BY l.created_at;


-- ============================================================
-- 6. CHAT RECONSTRUIDO — Cada conversación por separado
-- ============================================================
-- Muestra mensajes con etiqueta de a quién pertenece el chat
-- (p1_vs_human o p1_vs_claude) basado en claude_slot

WITH target_games AS (
  SELECT unnest(ARRAY[
    'GAME_ID1','GAME_ID2','GAME_ID3' -- REEMPLAZAR
  ]) AS id
)
SELECT
  m.game_id,
  CASE
    WHEN m.slot = g.claude_slot THEN 'p1_vs_claude'
    WHEN m.slot IS NOT NULL AND m.slot != g.claude_slot THEN 'p1_vs_human'
    ELSE 'system_or_feedback'
  END AS chat_panel,
  m.sender,
  m.slot,
  m.content,
  m.created_at,
  ROW_NUMBER() OVER (
    PARTITION BY m.game_id,
      CASE
        WHEN m.slot = g.claude_slot THEN 'p1_vs_claude'
        WHEN m.slot IS NOT NULL AND m.slot != g.claude_slot THEN 'p1_vs_human'
        ELSE 'system_or_feedback'
      END
    ORDER BY m.created_at
  ) AS msg_order
FROM messages m
JOIN games g ON m.game_id = g.id
JOIN target_games tg ON m.game_id = tg.id
WHERE m.slot IS NOT NULL
ORDER BY m.game_id, chat_panel, m.created_at;


-- ============================================================
-- 7. ESTADÍSTICAS POR CHAT — Longitud, tiempo de respuesta
-- ============================================================

WITH target_games AS (
  SELECT unnest(ARRAY[
    'GAME_ID1','GAME_ID2','GAME_ID3' -- REEMPLAZAR
  ]) AS id
),
chat_msgs AS (
  SELECT
    m.game_id,
    CASE
      WHEN m.slot = g.claude_slot THEN 'p1_vs_claude'
      ELSE 'p1_vs_human'
    END AS chat_panel,
    m.sender,
    m.content,
    m.created_at,
    LAG(m.created_at) OVER (
      PARTITION BY m.game_id, m.slot ORDER BY m.created_at
    ) AS prev_msg_at
  FROM messages m
  JOIN games g ON m.game_id = g.id
  JOIN target_games tg ON m.game_id = tg.id
  WHERE m.slot IS NOT NULL
)
SELECT
  game_id,
  chat_panel,
  count(*)                                                  AS total_msgs,
  round(avg(char_length(content))::numeric, 1)              AS avg_msg_length,
  max(char_length(content))                                 AS max_msg_length,
  round(avg(
    EXTRACT(EPOCH FROM (created_at - prev_msg_at))
  )::numeric, 1)                                            AS avg_response_time_sec
FROM chat_msgs
GROUP BY game_id, chat_panel
ORDER BY game_id, chat_panel;


-- ============================================================
-- 8. TIEMPOS DE RESPUESTA — Claude vs P2
-- ============================================================

WITH target_games AS (
  SELECT unnest(ARRAY[
    'GAME_ID1','GAME_ID2','GAME_ID3' -- REEMPLAZAR
  ]) AS id
),
response_pairs AS (
  SELECT
    m.game_id,
    m.sender,
    m.created_at AS response_at,
    LAG(m.created_at) OVER (
      PARTITION BY m.game_id, m.slot ORDER BY m.created_at
    ) AS stimulus_at,
    CASE
      WHEN m.slot = g.claude_slot THEN 'claude_slot'
      ELSE 'human_slot'
    END AS slot_type
  FROM messages m
  JOIN games g ON m.game_id = g.id
  JOIN target_games tg ON m.game_id = tg.id
  WHERE m.slot IS NOT NULL
)
SELECT
  slot_type,
  sender,
  count(*)                                                          AS responses,
  round(avg(EXTRACT(EPOCH FROM (response_at - stimulus_at)))::numeric, 1)
                                                                    AS avg_response_sec,
  round(percentile_cont(0.5) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (response_at - stimulus_at))
  )::numeric, 1)                                                    AS median_response_sec
FROM response_pairs
WHERE stimulus_at IS NOT NULL
  AND sender IN ('p2', 'claude')
GROUP BY slot_type, sender
ORDER BY slot_type, sender;


-- ============================================================
-- 9. LESSONS — Evolución temporal
-- ============================================================

SELECT
  l.id,
  l.game_id,
  l.content,
  l.weight,
  l.created_at                                      AS lesson_created,
  g.created_at                                      AS game_created,
  g.guess_correct                                   AS game_result,
  g.claude_persona->>'name'                         AS claude_nombre
FROM lessons l
LEFT JOIN games g ON l.game_id = g.id
ORDER BY l.created_at;


-- ============================================================
-- 10. LESSONS vs DECEPTION — ¿Mejora Claude con más lessons?
-- ============================================================

WITH target_games AS (
  SELECT unnest(ARRAY[
    'GAME_ID1','GAME_ID2','GAME_ID3' -- REEMPLAZAR
  ]) AS id
),
games_ordered AS (
  SELECT
    g.id,
    g.guess_correct,
    g.created_at,
    ROW_NUMBER() OVER (ORDER BY g.created_at) AS game_number,
    (SELECT count(*) FROM lessons l WHERE l.created_at <= g.created_at)
                                                AS lessons_available_at_game
  FROM games g
  JOIN target_games tg ON g.id = tg.id
  WHERE g.status = 'ended'
)
SELECT
  game_number,
  id AS game_id,
  guess_correct,
  lessons_available_at_game,
  created_at
FROM games_ordered
ORDER BY game_number;
