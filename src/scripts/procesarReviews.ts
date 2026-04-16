import dotenv from "dotenv";
import { obtenerReviewsJuego } from "../services/reviewDetails.service";
import {
  contarReviews,
  guardarResumenReviews,
  guardarReviews,
  obtenerJuegosParaReviews,
} from "../repositories/review.repository";

dotenv.config();

async function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function obtenerReviewsConReintento(appId: number, intentos = 3) {
  try {
    return await obtenerReviewsJuego(appId);
  } catch (error: any) {
    console.error(
      `Error al consultar reviews para ${appId}:`,
      error.code || error.message,
    );

    if (intentos > 0) {
      console.log(
        `Reintentando reviews de ${appId}... intentos restantes: ${intentos}`,
      );
      await esperar(3000);
      return obtenerReviewsConReintento(appId, intentos - 1);
    }

    throw error;
  }
}

async function main() {
  try {
    console.log("Iniciando procesamiento completo de reviews...");

    let totalJuegosProcesados = 0;

    while (true) {
      const juegos = await obtenerJuegosParaReviews(20); // tamaño del lote

      if (!juegos.length) {
        console.log("No quedan más juegos pendientes.");
        break;
      }

      console.log(`Procesando lote de ${juegos.length} juegos`);

      for (const juego of juegos) {
        console.log(`Procesando ${juego.nombre} (${juego.steam_app_id})`);

        try {
          const respuesta = await obtenerReviewsConReintento(
            juego.steam_app_id,
          );

          await guardarResumenReviews(juego.steam_app_id, respuesta.summary);
          await guardarReviews(juego.steam_app_id, respuesta.reviews);

          totalJuegosProcesados++;

          console.log(`OK: ${respuesta.reviews.length} reviews guardadas`);
        } catch (error) {
          console.error(`Error final en ${juego.steam_app_id}:`, error);
        }

        await esperar(2000); // muy importante
      }
    }

    const totalReviews = await contarReviews();

    console.log("Proceso completo terminado.");
    console.log(`Total juegos procesados: ${totalJuegosProcesados}`);
    console.log(`Total reviews en BD: ${totalReviews}`);
  } catch (error) {
    console.error("Error general:", error);
    process.exit(1);
  }
}

main();
