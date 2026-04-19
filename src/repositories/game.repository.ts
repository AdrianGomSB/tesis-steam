import { pool } from "../config/db";
import type { JuegoDetalle } from "../services/gameDetails.service";

export type SemillaPendiente = {
  steam_app_id: number;
  nombre: string | null;
};

export async function obtenerSemillasPendientes(
  limite = 20,
): Promise<SemillaPendiente[]> {
  const resultado = await pool.query(
    `
    SELECT steam_app_id, nombre
    FROM semilla_apps_steam
    WHERE procesado_juego = FALSE
    ORDER BY steam_app_id ASC
    LIMIT $1
    `,
    [limite],
  );

  return resultado.rows;
}

export async function guardarJuego(juego: JuegoDetalle): Promise<void> {
  await pool.query(
    `
    INSERT INTO juegos (
      steam_app_id,
      nombre,
      tipo,
      descripcion_corta,
      descripcion_detallada,
      acerca_del_juego,
      idiomas_soportados,
      website,
      developers,
      publishers,
      generos,
      categorias,
      soporta_windows,
      soporta_mac,
      soporta_linux,
      fecha_lanzamiento,
      es_gratis,
      recomendaciones_total,
      metacritic_score,
      precio_inicial,
      precio_final,
      porcentaje_descuento,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14, $15, $16,
      $17, $18, $19, $20, $21, $22, NOW()
    )
    ON CONFLICT (steam_app_id)
    DO UPDATE SET
      nombre = EXCLUDED.nombre,
      tipo = EXCLUDED.tipo,
      descripcion_corta = EXCLUDED.descripcion_corta,
      descripcion_detallada = EXCLUDED.descripcion_detallada,
      acerca_del_juego = EXCLUDED.acerca_del_juego,
      idiomas_soportados = EXCLUDED.idiomas_soportados,
      website = EXCLUDED.website,
      developers = EXCLUDED.developers,
      publishers = EXCLUDED.publishers,
      generos = EXCLUDED.generos,
      categorias = EXCLUDED.categorias,
      soporta_windows = EXCLUDED.soporta_windows,
      soporta_mac = EXCLUDED.soporta_mac,
      soporta_linux = EXCLUDED.soporta_linux,
      fecha_lanzamiento = EXCLUDED.fecha_lanzamiento,
      es_gratis = EXCLUDED.es_gratis,
      recomendaciones_total = EXCLUDED.recomendaciones_total,
      metacritic_score = EXCLUDED.metacritic_score,
      precio_inicial = EXCLUDED.precio_inicial,
      precio_final = EXCLUDED.precio_final,
      porcentaje_descuento = EXCLUDED.porcentaje_descuento,
      updated_at = NOW()
    `,
    [
      juego.steam_app_id,
      juego.nombre,
      juego.tipo,
      juego.descripcion_corta,
      juego.descripcion_detallada,
      juego.acerca_del_juego,
      juego.idiomas_soportados,
      juego.sitio_web,
      juego.desarrolladores,
      juego.distribuidores,
      juego.generos,
      juego.categorias,
      juego.plataforma_windows,
      juego.plataforma_mac,
      juego.plataforma_linux,
      juego.fecha_lanzamiento,
      juego.es_gratis,
      juego.total_recomendaciones,
      juego.puntuacion_metacritic,
      juego.precio_inicial,
      juego.precio_final,
      juego.porcentaje_descuento,
    ],
  );
}

export async function marcarSemillaProcesada(
  steamAppId: number,
  valido: boolean,
): Promise<void> {
  await pool.query(
    `
    UPDATE semilla_apps_steam
    SET procesado_juego = TRUE,
        valido = $2,
        updated_at = NOW()
    WHERE steam_app_id = $1
    `,
    [steamAppId, valido],
  );
}

export async function contarJuegos(): Promise<number> {
  const resultado = await pool.query(
    `SELECT COUNT(*)::int AS total FROM juegos`,
  );

  return resultado.rows[0].total;
}
