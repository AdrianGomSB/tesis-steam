import { pool } from "../config/db";
import type { FeatureJuego } from "../services/featureEngineering.service";

export type JuegoConDatos = {
  steam_app_id: number;
  nombre: string;
  descripcion_corta: string | null;
  descripcion_detallada: string | null;
  acerca_del_juego: string | null;
  generos: string[] | null;
  categorias: string[] | null;
};

export type ReviewJuego = {
  texto_review: string | null;
  voto_positivo: boolean;
  votos_utiles: number | null;
  autor_tiempo_jugado_total: number | null;
};

export type ResumenJuego = {
  total_positivas: number | null;
  total_negativas: number | null;
  total_reviews: number | null;
  score_review: number | null;
  descripcion_score: string | null;
};

export async function obtenerJuegosParaFeatures(
  limite = 50,
): Promise<JuegoConDatos[]> {
  const resultado = await pool.query(
    `
    SELECT
      j.steam_app_id,
      j.nombre,
      j.descripcion_corta,
      j.descripcion_detallada,
      j.acerca_del_juego,
      j.generos,
      j.categorias
    FROM juegos j
    WHERE NOT EXISTS (
      SELECT 1
      FROM features_juegos f
      WHERE f.steam_app_id = j.steam_app_id
    )
    ORDER BY j.steam_app_id ASC
    LIMIT $1
    `,
    [limite],
  );

  return resultado.rows;
}

export async function obtenerReviewsPorJuego(
  steamAppId: number,
): Promise<ReviewJuego[]> {
  const resultado = await pool.query(
    `
    SELECT
      texto_review,
      voto_positivo,
      votos_utiles,
      autor_tiempo_jugado_total
    FROM reviews
    WHERE steam_app_id = $1
    `,
    [steamAppId],
  );

  return resultado.rows;
}

export async function obtenerResumenPorJuego(
  steamAppId: number,
): Promise<ResumenJuego | null> {
  const resultado = await pool.query(
    `
    SELECT
      total_positivas,
      total_negativas,
      total_reviews,
      score_review,
      descripcion_score
    FROM resumen_reviews
    WHERE steam_app_id = $1
    `,
    [steamAppId],
  );

  return resultado.rows[0] ?? null;
}

export async function guardarFeatureJuego(
  feature: FeatureJuego,
): Promise<void> {
  await pool.query(
    `
    INSERT INTO features_juegos (
      steam_app_id,
      nombre,
      texto_consolidado,
      cantidad_reviews,
      cantidad_positivas,
      cantidad_negativas,
      ratio_positivo,
      promedio_horas_jugadas,
      score_review,
      descripcion_score,
      fecha_actualizacion
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()
    )
    ON CONFLICT (steam_app_id)
    DO UPDATE SET
      nombre = EXCLUDED.nombre,
      texto_consolidado = EXCLUDED.texto_consolidado,
      cantidad_reviews = EXCLUDED.cantidad_reviews,
      cantidad_positivas = EXCLUDED.cantidad_positivas,
      cantidad_negativas = EXCLUDED.cantidad_negativas,
      ratio_positivo = EXCLUDED.ratio_positivo,
      promedio_horas_jugadas = EXCLUDED.promedio_horas_jugadas,
      score_review = EXCLUDED.score_review,
      descripcion_score = EXCLUDED.descripcion_score,
      fecha_actualizacion = NOW()
    `,
    [
      feature.steam_app_id,
      feature.nombre,
      feature.texto_consolidado,
      feature.cantidad_reviews,
      feature.cantidad_positivas,
      feature.cantidad_negativas,
      feature.ratio_positivo,
      feature.promedio_horas_jugadas,
      feature.score_review,
      feature.descripcion_score,
    ],
  );
}

export async function contarFeaturesJuegos(): Promise<number> {
  const resultado = await pool.query(
    "SELECT COUNT(*)::int AS total FROM features_juegos",
  );

  return resultado.rows[0].total;
}
