import { pool } from "../config/db";
import type { AppSemilla } from "../services/steamSeed.service";

export async function guardarSemilla(apps: AppSemilla[]): Promise<number> {
  if (!apps.length) return 0;

  const client = await pool.connect();
  let totalProcesadas = 0;

  try {
    await client.query("BEGIN");

    for (const app of apps) {
      await client.query(
        `
        INSERT INTO semilla_apps_steam (
          steam_app_id,
          nombre
        )
        VALUES ($1, $2)
        ON CONFLICT (steam_app_id)
        DO UPDATE SET
          nombre = EXCLUDED.nombre,
          updated_at = NOW()
        `,
        [app.appid, app.name ?? null],
      );

      totalProcesadas++;
    }

    await client.query("COMMIT");
    return totalProcesadas;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function contarSemilla(): Promise<number> {
  const resultado = await pool.query(
    `SELECT COUNT(*)::int AS total FROM semilla_apps_steam`,
  );

  return resultado.rows[0].total;
}
