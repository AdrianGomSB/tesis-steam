import { pool } from "../config/db";

export type JuegoBaseFeature = {
  steam_app_id: number;
  nombre: string;
  descripcion_corta: string | null;
  descripcion_detallada: string | null;
  acerca_del_juego: string | null;
  generos: string[] | null;
  categorias: string[] | null;
};

export type FeatureJuegoInsert = {
  steam_app_id: number;
  nombre: string;
  generos_texto: string | null;
  categorias_texto: string | null;
  resumen_opiniones: string | null;
  cantidad_reviews_usadas: number;
  texto_consolidado: string;
};

export async function obtenerJuegosParaFeatures(
  limite = 50,
): Promise<JuegoBaseFeature[]> {
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

export async function obtenerReviewsMuestraPorJuego(
  steamAppId: number,
  limiteReviews = 30,
): Promise<string[]> {
  const resultado = await pool.query(
    `
    SELECT review_texto
    FROM reviews
    WHERE steam_app_id = $1
      AND review_texto IS NOT NULL
      AND LENGTH(TRIM(review_texto)) > 0
    ORDER BY timestamp_created DESC
    LIMIT $2
    `,
    [steamAppId, limiteReviews],
  );

  return resultado.rows.map((row) => row.review_texto as string);
}

export async function guardarFeatureJuego(
  feature: FeatureJuegoInsert,
): Promise<void> {
  await pool.query(
    `
    INSERT INTO features_juegos (
      steam_app_id,
      nombre,
      generos_texto,
      categorias_texto,
      resumen_opiniones,
      cantidad_reviews_usadas,
      texto_consolidado,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    ON CONFLICT (steam_app_id)
    DO UPDATE SET
      nombre = EXCLUDED.nombre,
      generos_texto = EXCLUDED.generos_texto,
      categorias_texto = EXCLUDED.categorias_texto,
      resumen_opiniones = EXCLUDED.resumen_opiniones,
      cantidad_reviews_usadas = EXCLUDED.cantidad_reviews_usadas,
      texto_consolidado = EXCLUDED.texto_consolidado,
      updated_at = NOW()
    `,
    [
      feature.steam_app_id,
      feature.nombre,
      feature.generos_texto,
      feature.categorias_texto,
      feature.resumen_opiniones,
      feature.cantidad_reviews_usadas,
      feature.texto_consolidado,
    ],
  );
}

export async function contarFeaturesJuegos(): Promise<number> {
  const resultado = await pool.query(
    `SELECT COUNT(*)::int AS total FROM features_juegos`,
  );

  return resultado.rows[0].total;
}
