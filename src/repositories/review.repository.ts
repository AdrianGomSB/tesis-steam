import { pool } from "../config/db";
import type { ReviewSteam } from "../services/reviewDetails.service";

export type JuegoPendienteReview = {
  steam_app_id: number;
  nombre: string;
};

export async function marcarReviewsProcesadas(
  steamAppId: number,
): Promise<void> {
  await pool.query(
    `
    UPDATE juegos
    SET reviews_procesadas = TRUE,
        updated_at = NOW()
    WHERE steam_app_id = $1
    `,
    [steamAppId],
  );
}

export async function obtenerJuegosParaReviews(
  limite = 20,
): Promise<JuegoPendienteReview[]> {
  const resultado = await pool.query(
    `
    SELECT steam_app_id, nombre
    FROM juegos
    WHERE reviews_procesadas = FALSE
    ORDER BY steam_app_id ASC
    LIMIT $1
    `,
    [limite],
  );

  return resultado.rows;
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
          recommendation_id,
          steam_app_id,
          idioma,
          review_texto,
          timestamp_created,
          timestamp_updated,
          voted_up,
          votes_up,
          votes_funny,
          weighted_vote_score,
          comment_count,
          steam_purchase,
          received_for_free,
          written_during_early_access,
          author_steamid,
          author_num_games_owned,
          author_num_reviews,
          author_playtime_forever,
          author_playtime_last_two_weeks,
          author_playtime_at_review,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW()
        )
        ON CONFLICT (recommendation_id)
        DO UPDATE SET
          idioma = EXCLUDED.idioma,
          review_texto = EXCLUDED.review_texto,
          timestamp_created = EXCLUDED.timestamp_created,
          timestamp_updated = EXCLUDED.timestamp_updated,
          voted_up = EXCLUDED.voted_up,
          votes_up = EXCLUDED.votes_up,
          votes_funny = EXCLUDED.votes_funny,
          weighted_vote_score = EXCLUDED.weighted_vote_score,
          comment_count = EXCLUDED.comment_count,
          steam_purchase = EXCLUDED.steam_purchase,
          received_for_free = EXCLUDED.received_for_free,
          written_during_early_access = EXCLUDED.written_during_early_access,
          author_steamid = EXCLUDED.author_steamid,
          author_num_games_owned = EXCLUDED.author_num_games_owned,
          author_num_reviews = EXCLUDED.author_num_reviews,
          author_playtime_forever = EXCLUDED.author_playtime_forever,
          author_playtime_last_two_weeks = EXCLUDED.author_playtime_last_two_weeks,
          author_playtime_at_review = EXCLUDED.author_playtime_at_review,
          updated_at = NOW()
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
    `SELECT COUNT(*)::int AS total FROM reviews`,
  );

  return resultado.rows[0].total;
}
