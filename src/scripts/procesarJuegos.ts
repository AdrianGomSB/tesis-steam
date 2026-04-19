import dotenv from "dotenv";
import { obtenerDetalleJuego } from "../services/gameDetails.service";
import {
  contarJuegos,
  guardarJuego,
  marcarSemillaProcesada,
  obtenerSemillasPendientes,
} from "../repositories/game.repository";

dotenv.config();

async function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function obtenerDetalleConReintento(steamAppId: number, intentos = 3) {
  try {
    return await obtenerDetalleJuego(steamAppId);
  } catch (error: any) {
    console.error(
      `Error al consultar appdetails para ${steamAppId}:`,
      error.code || error.message,
    );

    if (intentos > 0) {
      console.log(
        `Reintentando app ${steamAppId}... intentos restantes: ${intentos - 1}`,
      );
      await esperar(2000);
      return obtenerDetalleConReintento(steamAppId, intentos - 1);
    }

    throw error;
  }
}

async function main(): Promise<void> {
  try {
    console.log("Iniciando procesamiento completo de juegos...");

    let totalProcesados = 0;
    let totalValidos = 0;
    let totalInvalidos = 0;

    while (true) {
      const semillas = await obtenerSemillasPendientes(50);

      if (!semillas.length) {
        console.log("No quedan más semillas pendientes.");
        break;
      }

      console.log(`Procesando lote de ${semillas.length}`);

      for (const semilla of semillas) {
        try {
          const detalle = await obtenerDetalleConReintento(
            semilla.steam_app_id,
          );

          if (detalle) {
            await guardarJuego(detalle);
            await marcarSemillaProcesada(semilla.steam_app_id, true);
            totalValidos++;
          } else {
            await marcarSemillaProcesada(semilla.steam_app_id, false);
            totalInvalidos++;
          }

          totalProcesados++;

          console.log(
            `Procesados: ${totalProcesados} | Válidos: ${totalValidos} | Inválidos: ${totalInvalidos}`,
          );
        } catch (error) {
          console.error(
            `Error con steam_app_id ${semilla.steam_app_id}:`,
            error,
          );
          await marcarSemillaProcesada(semilla.steam_app_id, false);
          totalInvalidos++;
          totalProcesados++;
        }

        await esperar(1200);
      }
    }

    const totalJuegos = await contarJuegos();

    console.log("Procesamiento completo terminado.");
    console.log(`Total procesados: ${totalProcesados}`);
    console.log(`Total válidos: ${totalValidos}`);
    console.log(`Total inválidos: ${totalInvalidos}`);
    console.log(`Total en tabla juegos: ${totalJuegos}`);
  } catch (error) {
    console.error("Error general:", error);
    process.exit(1);
  }
}

main();
