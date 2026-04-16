import { pool } from "../config/db";
import type {
  ReviewSteam,
  ResumenReviewsSteam,
} from "../services/reviewDetails.service";

export type JuegoPendienteReview = {
  steam_app_id: number;
  nombre: string;
};

export async function obtenerJuegosParaReviews(
  limite = 20,
): Promise<JuegoPendienteReview[]> {
  const resultado = await pool.query(
    `
    SELECT j.steam_app_id, j.nombre
    FROM juegos j
    WHERE NOT EXISTS (
      SELECT 1
      FROM resumen_reviews rr
      WHERE rr.steam_app_id = j.steam_app_id
    )
    ORDER BY j.steam_app_id ASC
    LIMIT $1
    `,
    [limite],
  );

  return resultado.rows;
}

export async function guardarResumenReviews(
  steamAppId: number,
  resumen: ResumenReviewsSteam,
): Promise<void> {
  await pool.query(
    `
    INSERT INTO resumen_reviews (
      steam_app_id,
      descripcion_score,
      score_review,
      total_positivas,
      total_negativas,
      total_reviews,
      fecha_actualizacion
    )
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (steam_app_id)
    DO UPDATE SET
      descripcion_score = EXCLUDED.descripcion_score,
      score_review = EXCLUDED.score_review,
      total_positivas = EXCLUDED.total_positivas,
      total_negativas = EXCLUDED.total_negativas,
      total_reviews = EXCLUDED.total_reviews,
      fecha_actualizacion = NOW()
    `,
    [
      steamAppId,
      resumen.review_score_desc,
      resumen.review_score,
      resumen.total_positive,
      resumen.total_negative,
      resumen.total_reviews,
    ],
  );
}

export async function guardarReviews(
  steamAppId: number,
  reviews: ReviewSteam[],
): Promise<void> {
  if (!reviews.length) return;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const review of reviews) {
      await client.query(
        `
        INSERT INTO reviews (
          review_id,
          steam_app_id,
          idioma,
          texto_review,
          fecha_creacion,
          fecha_actualizacion,
          voto_positivo,
          votos_utiles,
          votos_divertidos,
          puntaje_ponderado,
          cantidad_comentarios,
          compra_steam,
          recibido_gratis,
          acceso_anticipado,
          autor_steam_id,
          autor_num_juegos_propios,
          autor_num_reviews,
          autor_tiempo_jugado_total,
          autor_tiempo_jugado_2semanas,
          autor_tiempo_jugado_al_review
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
        )
        ON CONFLICT (review_id)
        DO UPDATE SET
          idioma = EXCLUDED.idioma,
          texto_review = EXCLUDED.texto_review,
          fecha_creacion = EXCLUDED.fecha_creacion,
          fecha_actualizacion = EXCLUDED.fecha_actualizacion,
          voto_positivo = EXCLUDED.voto_positivo,
          votos_utiles = EXCLUDED.votos_utiles,
          votos_divertidos = EXCLUDED.votos_divertidos,
          puntaje_ponderado = EXCLUDED.puntaje_ponderado,
          cantidad_comentarios = EXCLUDED.cantidad_comentarios,
          compra_steam = EXCLUDED.compra_steam,
          recibido_gratis = EXCLUDED.recibido_gratis,
          acceso_anticipado = EXCLUDED.acceso_anticipado,
          autor_steam_id = EXCLUDED.autor_steam_id,
          autor_num_juegos_propios = EXCLUDED.autor_num_juegos_propios,
          autor_num_reviews = EXCLUDED.autor_num_reviews,
          autor_tiempo_jugado_total = EXCLUDED.autor_tiempo_jugado_total,
          autor_tiempo_jugado_2semanas = EXCLUDED.autor_tiempo_jugado_2semanas,
          autor_tiempo_jugado_al_review = EXCLUDED.autor_tiempo_jugado_al_review
        `,
        [
          review.recommendationid,
          steamAppId,
          review.language ?? null,
          review.review ?? null,
          review.timestamp_created ?? null,
          review.timestamp_updated ?? null,
          review.voted_up,
          review.votes_up ?? null,
          review.votes_funny ?? null,
          review.weighted_vote_score ?? null,
          review.comment_count ?? null,
          review.steam_purchase,
          review.received_for_free,
          review.written_during_early_access,
          review.author?.steamid ?? null,
          review.author?.num_games_owned ?? null,
          review.author?.num_reviews ?? null,
          review.author?.playtime_forever ?? null,
          review.author?.playtime_last_two_weeks ?? null,
          review.author?.playtime_at_review ?? null,
        ],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function contarReviews(): Promise<number> {
  const resultado = await pool.query(
    "SELECT COUNT(*)::int AS total FROM reviews",
  );

  return resultado.rows[0].total;
}
