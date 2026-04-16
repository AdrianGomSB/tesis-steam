import { pool } from "../config/db";
import type { AppSemilla } from "../services/steamSeed.service";

export async function guardarSemilla(apps: AppSemilla[]): Promise<void> {
  if (!apps.length) return;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const app of apps) {
      await client.query(
        `
        INSERT INTO semilla_apps_steam (
          appid,
          nombre,
          ultima_modificacion,
          numero_cambio_precio
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (appid)
        DO UPDATE SET
          nombre = EXCLUDED.nombre,
          ultima_modificacion = EXCLUDED.ultima_modificacion,
          numero_cambio_precio = EXCLUDED.numero_cambio_precio
        `,
        [
          app.appid,
          app.name ?? null,
          app.last_modified ?? null,
          app.price_change_number ?? null,
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

export async function contarSemilla(): Promise<number> {
  const resultado = await pool.query(
    "SELECT COUNT(*)::int AS total FROM semilla_apps_steam",
  );

  return resultado.rows[0].total;
}
