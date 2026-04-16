import dotenv from "dotenv";
import { obtenerDetalleJuego } from "../services/gameDetails.service";
import {
  contarJuegos,
  guardarJuego,
  marcarSemillaProcesada,
  obtenerSemillasPendientes,
} from "../repositories/game.repository";

dotenv.config();

async function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function obtenerDetalleConReintento(appId: number, intentos = 3) {
  try {
    return await obtenerDetalleJuego(appId);
  } catch (error: any) {
    console.error(
      `Error al consultar appdetails para ${appId}:`,
      error.code || error.message,
    );

    if (intentos > 0) {
      console.log(
        `Reintentando app ${appId}... intentos restantes: ${intentos}`,
      );
      await esperar(2000);
      return obtenerDetalleConReintento(appId, intentos - 1);
    }

    throw error;
  }
}

async function main() {
  try {
    console.log("Iniciando procesamiento completo...");

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
          const detalle = await obtenerDetalleConReintento(semilla.appid);

          if (detalle) {
            await guardarJuego(detalle);
            await marcarSemillaProcesada(semilla.appid, true);
            totalValidos++;
          } else {
            await marcarSemillaProcesada(semilla.appid, false);
            totalInvalidos++;
          }

          totalProcesados++;

          console.log(
            `Procesados: ${totalProcesados} | Válidos: ${totalValidos} | Inválidos: ${totalInvalidos}`,
          );
        } catch (error) {
          console.error(`Error con appid ${semilla.appid}:`, error);
          await marcarSemillaProcesada(semilla.appid, false);
          totalInvalidos++;
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
