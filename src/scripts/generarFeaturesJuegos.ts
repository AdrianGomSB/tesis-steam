import dotenv from "dotenv";
import {
  contarFeaturesJuegos,
  guardarFeatureJuego,
  obtenerJuegosParaFeatures,
  obtenerReviewsMuestraPorJuego,
} from "../repositories/features.repository";

dotenv.config();

const LIMITE_JUEGOS_POR_LOTE = 50;
const LIMITE_REVIEWS_POR_JUEGO = 30;
const MAX_REVIEWS_LIMPIAS_POR_JUEGO = 15;
const PAUSA_ENTRE_JUEGOS_MS = 300;

async function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function limpiarTexto(texto?: string | null): string {
  if (!texto) return "";

  return texto
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s.,:;!?()\-]/gu, " ")
    .trim();
}

function unirPartesTexto(partes: Array<string | null | undefined>): string {
  const partesLimpias = partes
    .map((parte) => limpiarTexto(parte))
    .filter((parte) => parte.length > 0);

  return partesLimpias.join(" ");
}

function esReviewUtil(review: string): boolean {
  const texto = review.trim().toLowerCase();

  if (!texto) return false;

  // mínimo y máximo de longitud
  if (texto.length < 30 || texto.length > 250) return false;

  // solo números, símbolos o separadores
  if (/^[\d\s.,!?;:()\-]+$/.test(texto)) return false;

  // muy pocas palabras
  const palabras = texto.split(/\s+/).filter(Boolean);
  if (palabras.length < 5) return false;

  // demasiada repetición del mismo carácter (spam)
  if (/(.)\1{4,}/.test(texto)) return false;

  // texto demasiado repetitivo
  const palabrasUnicas = new Set(palabras);
  if (palabras.length >= 6 && palabrasUnicas.size / palabras.length < 0.5) {
    return false;
  }

  // expresiones demasiado genéricas o vacías
  const expresionesBasura = new Set([
    "hola",
    "adios",
    "xd",
    "jaja",
    "jajaja",
    "god",
    "10 10",
    "100 100",
    "muy bueno",
    "muy mal",
    "basura",
    "poronga",
    "mierda",
    "juegazo",
    "joyita",
    "buen juego",
  ]);

  if (expresionesBasura.has(texto)) return false;

  // insultos sueltos o reviews cortas sin contenido real
  const insultos = [
    "basura",
    "poronga",
    "mierda",
    "asco",
    "shit",
    "trash",
    "malisimo",
    "malísimo",
  ];

  if (
    palabras.length <= 6 &&
    insultos.some((insulto) => texto.includes(insulto))
  ) {
    return false;
  }

  return true;
}

async function main(): Promise<void> {
  try {
    console.log("Iniciando generación de features_juegos...");

    let totalProcesados = 0;

    while (true) {
      const juegos = await obtenerJuegosParaFeatures(LIMITE_JUEGOS_POR_LOTE);

      if (!juegos.length) {
        console.log("No quedan más juegos pendientes para features.");
        break;
      }

      console.log(`Procesando lote de ${juegos.length} juegos`);

      for (const juego of juegos) {
        const reviewsMuestra = await obtenerReviewsMuestraPorJuego(
          juego.steam_app_id,
          LIMITE_REVIEWS_POR_JUEGO,
        );

        const reviewsLimpias = reviewsMuestra
          .map((review) => limpiarTexto(review))
          .filter(esReviewUtil)
          .slice(0, MAX_REVIEWS_LIMPIAS_POR_JUEGO);

        const generosTexto = Array.isArray(juego.generos)
          ? juego.generos.join(" ")
          : "";

        const categoriasTexto = Array.isArray(juego.categorias)
          ? juego.categorias.join(" ")
          : "";

        const resumenOpiniones = unirPartesTexto(reviewsLimpias);

        const textoConsolidado = unirPartesTexto([
          juego.nombre,
          juego.descripcion_corta,
          generosTexto,
          categoriasTexto,
          resumenOpiniones,
        ]);

        await guardarFeatureJuego({
          steam_app_id: juego.steam_app_id,
          nombre: juego.nombre,
          generos_texto: generosTexto || null,
          categorias_texto: categoriasTexto || null,
          resumen_opiniones: resumenOpiniones || null,
          cantidad_reviews_usadas: reviewsLimpias.length,
          texto_consolidado: textoConsolidado,
        });

        totalProcesados++;

        console.log(
          `Feature generada: ${juego.nombre} (${juego.steam_app_id}) | reviews útiles: ${reviewsLimpias.length}`,
        );

        await esperar(PAUSA_ENTRE_JUEGOS_MS);
      }
    }

    const totalFeatures = await contarFeaturesJuegos();

    console.log("Generación de features completada.");
    console.log(`Total juegos procesados: ${totalProcesados}`);
    console.log(`Total registros en features_juegos: ${totalFeatures}`);
  } catch (error) {
    console.error("Error generando features_juegos:", error);
    process.exit(1);
  }
}

main();
