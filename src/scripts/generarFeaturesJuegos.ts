import dotenv from "dotenv";
import {
  contarFeaturesJuegos,
  guardarFeatureJuego,
  obtenerJuegosParaFeatures,
  obtenerResumenPorJuego,
  obtenerReviewsPorJuego,
} from "../repositories/feature.repository";
import { construirFeatureJuego } from "../services/featureEngineering.service";

dotenv.config();

async function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  try {
    console.log("Iniciando generación de features_juegos...");

    let totalProcesados = 0;

    while (true) {
      const juegos = await obtenerJuegosParaFeatures(50);

      if (!juegos.length) {
        console.log("No quedan más juegos pendientes para features.");
        break;
      }

      console.log(`Procesando lote de ${juegos.length} juegos`);

      for (const juego of juegos) {
        const reviews = await obtenerReviewsPorJuego(juego.steam_app_id);
        const resumen = await obtenerResumenPorJuego(juego.steam_app_id);

        const feature = construirFeatureJuego(juego, reviews, resumen);

        await guardarFeatureJuego(feature);

        totalProcesados++;
        console.log(`Procesado: ${totalProcesados} | ${juego.nombre}`);

        await esperar(100);
      }
    }

    const total = await contarFeaturesJuegos();

    console.log("Generación completada.");
    console.log(`Total de features_juegos: ${total}`);
  } catch (error) {
    console.error("Error general al generar features:", error);
    process.exit(1);
  }
}

main();
