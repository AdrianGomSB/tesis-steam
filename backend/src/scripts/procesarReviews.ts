import dotenv from "dotenv";
import { obtenerReviewsJuego } from "../services/reviewDetails.service";
import {
  contarReviews,
  guardarReviews,
  obtenerJuegosParaReviews,
  marcarReviewsProcesadas,
} from "../repositories/review.repository";

dotenv.config();

const LIMITE_JUEGOS_POR_LOTE = 20;
const MAX_REVIEWS_POR_JUEGO = 300;
const PAUSA_ENTRE_PAGINAS_MS = 1500;
const PAUSA_ENTRE_JUEGOS_MS = 2500;
const PAUSA_REINTENTO_MS = 4000;
const MAX_INTENTOS = 3;

async function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function obtenerPaginaConReintento(
  appId: number,
  cursor = "*",
  intentos = MAX_INTENTOS,
) {
  try {
    return await obtenerReviewsJuego(appId, cursor);
  } catch (error: any) {
    console.error(
      `Error al consultar reviews para ${appId} con cursor ${cursor}:`,
      error.code || error.message,
    );

    if (intentos > 0) {
      console.log(
        `Reintentando reviews de ${appId}... intentos restantes: ${intentos - 1}`,
      );
      await esperar(PAUSA_REINTENTO_MS);
      return obtenerPaginaConReintento(appId, cursor, intentos - 1);
    }

    throw error;
  }
}

async function obtenerReviewsPaginadas(
  appId: number,
  maxReviews = MAX_REVIEWS_POR_JUEGO,
) {
  let cursor = "*";
  let todasLasReviews: Awaited<
    ReturnType<typeof obtenerReviewsJuego>
  >["reviews"] = [];

  while (todasLasReviews.length < maxReviews) {
    const respuesta = await obtenerPaginaConReintento(appId, cursor);

    if (!respuesta.reviews.length) {
      break;
    }

    todasLasReviews = [...todasLasReviews, ...respuesta.reviews];

    if (!respuesta.cursor || respuesta.cursor === cursor) {
      break;
    }

    cursor = respuesta.cursor;

    if (todasLasReviews.length >= maxReviews) {
      break;
    }

    await esperar(PAUSA_ENTRE_PAGINAS_MS);
  }

  return todasLasReviews.slice(0, maxReviews);
}

async function main(): Promise<void> {
  try {
    console.log("Iniciando procesamiento completo de reviews...");

    let totalJuegosProcesados = 0;

    while (true) {
      const juegos = await obtenerJuegosParaReviews(LIMITE_JUEGOS_POR_LOTE);

      if (!juegos.length) {
        console.log("No quedan más juegos pendientes.");
        break;
      }

      console.log(`Procesando lote de ${juegos.length} juegos`);

      for (const juego of juegos) {
        console.log(`Procesando ${juego.nombre} (${juego.steam_app_id})`);

        try {
          const reviews = await obtenerReviewsPaginadas(juego.steam_app_id);

          await guardarReviews(juego.steam_app_id, reviews);
          await marcarReviewsProcesadas(juego.steam_app_id);

          totalJuegosProcesados++;

          console.log(
            `OK: ${reviews.length} reviews guardadas | Marcado como procesado`,
          );
        } catch (error: any) {
          console.error(`Error final en ${juego.steam_app_id}:`, error.message);

          if (error.response?.status === 429) {
            console.log(
              `Rate limit detectado para ${juego.steam_app_id}. Se intentará después.`,
            );
            continue;
          }
        }

        await esperar(PAUSA_ENTRE_JUEGOS_MS);
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
