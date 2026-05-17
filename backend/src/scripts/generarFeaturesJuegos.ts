import dotenv from "dotenv";
import {
  contarFeaturesJuegos,
  guardarFeatureJuego,
  obtenerJuegosParaFeatures,
  obtenerReviewsMuestraPorJuego,
} from "../repositories/features.repository";

dotenv.config();

const LIMITE_JUEGOS_POR_LOTE = 50;
const LIMITE_REVIEWS_POR_JUEGO = 50; // Subimos para compensar el filtro más estricto
const MAX_REVIEWS_LIMPIAS_POR_JUEGO = 10;
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

  // FIX: mínimo subido de 15 a 80 caracteres — elimina "si", "juegazo",
  // "alto juego", "CHIMBA", "hola adios", emojis sueltos, números sueltos
  if (texto.length < 80 || texto.length > 600) return false;

  // Solo números, símbolos o separadores
  if (/^[\d\s.,!?;:()\-]+$/.test(texto)) return false;

  // FIX: mínimo subido de 3 a 12 palabras — elimina frases de 2-3 palabras
  // que no aportan información semántica útil
  const palabras = texto.split(/\s+/).filter(Boolean);
  if (palabras.length < 12) return false;

  // Spam por repetición de caracteres (ej: "aaaaaaaa")
  if (/(.)\\1{4,}/.test(texto)) return false;

  // Texto demasiado repetitivo (mismas palabras una y otra vez)
  const palabrasUnicas = new Set(palabras);
  if (palabras.length >= 8 && palabrasUnicas.size / palabras.length < 0.4) {
    return false;
  }

  // Expresiones genéricas de una sola idea sin contenido descriptivo
  const expresionesBasura = new Set([
    "muy bueno",
    "muy malo",
    "muy mal",
    "buen juego",
    "mal juego",
    "juegazo",
    "joyita",
    "basura",
    "poronga",
    "mierda",
    "hola",
    "adios",
    "xd",
    "jaja",
    "jajaja",
    "god",
    "10 10",
    "100 100",
    "chimba",
    "alto juego",
  ]);
  if (expresionesBasura.has(texto)) return false;

  // Insultos sueltos en reviews cortas
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
  if (palabras.length <= 8 && insultos.some((i) => texto.includes(i))) {
    return false;
  }

  // FIX: detectar reviews que son claramente de otro juego
  // (contienen referencias a personajes/franquicias ajenas)
  const referenciasFueraDeContexto = [
    "arcadia bay",
    "max chloe",
    "life is strange",
    "zelda",
    "mario",
    "sonic",
    "minecraft",
  ];
  if (referenciasFueraDeContexto.some((ref) => texto.includes(ref))) {
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

        const tagsTexto = Array.isArray(juego.tags) ? juego.tags.join(" ") : "";

        const resumenOpiniones = unirPartesTexto(reviewsLimpias);

        const steamspyResumen =
          juego.steamspy_positive !== null || juego.steamspy_negative !== null
            ? `Métricas de comunidad: ${juego.steamspy_positive ?? 0} reseñas positivas y ${juego.steamspy_negative ?? 0} reseñas negativas.`
            : null;

        const jugadoresActuales =
          juego.steamspy_ccu !== null
            ? `Jugadores concurrentes aproximados: ${juego.steamspy_ccu}.`
            : null;

        const textoConsolidado = unirPartesTexto([
          `Videojuego: ${juego.nombre}.`,
          juego.descripcion_corta
            ? `Descripción general del juego: ${juego.descripcion_corta}.`
            : null,
          generosTexto
            ? `El videojuego pertenece a los géneros: ${generosTexto}.`
            : null,
          categoriasTexto
            ? `Incluye las siguientes características, modos o funcionalidades: ${categoriasTexto}.`
            : null,
          tagsTexto
            ? `Etiquetas populares del videojuego: ${tagsTexto}.`
            : null,
          //steamspyResumen,
          //jugadoresActuales,
          juego.descripcion_detallada
            ? `Descripción detallada: ${juego.descripcion_detallada}.`
            : null,
          // Las reviews van al final — son la parte más ruidosa
          resumenOpiniones
            ? `Opiniones de usuarios: ${resumenOpiniones}.`
            : null,
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
          `Feature generada: ${juego.nombre} (${juego.steam_app_id}) | tags: ${
            juego.tags?.length ?? 0
          } | reviews útiles: ${reviewsLimpias.length}`,
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
