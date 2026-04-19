import axios from "axios";

export type JuegoDetalle = {
  steam_app_id: number;
  nombre: string;
  tipo: string | null;
  descripcion_corta: string | null;
  descripcion_detallada: string | null;
  acerca_del_juego: string | null;
  idiomas_soportados: string | null;
  sitio_web: string | null;
  desarrolladores: string[];
  distribuidores: string[];
  generos: string[];
  categorias: string[];
  plataforma_windows: boolean;
  plataforma_mac: boolean;
  plataforma_linux: boolean;
  fecha_lanzamiento: string | null;
  es_gratis: boolean;
  total_recomendaciones: number | null;
  puntuacion_metacritic: number | null;
  precio_inicial: number | null;
  precio_final: number | null;
  porcentaje_descuento: number | null;
};

function limpiarHtml(texto?: string | null): string | null {
  if (!texto) return null;

  return texto
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function obtenerDetalleJuego(
  appId: number,
): Promise<JuegoDetalle | null> {
  const url = "https://store.steampowered.com/api/appdetails";

  const response = await axios.get(url, {
    params: {
      appids: appId,
      cc: "pe",
      l: "spanish",
    },
    timeout: 20000,
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
    },
  });

  const bloque = response.data?.[appId];

  if (!bloque?.success) {
    return null;
  }

  const data = bloque.data;

  if (!data || data.type !== "game") {
    return null;
  }

  if (!data.name) {
    return null;
  }

  const generos: string[] = Array.isArray(data.genres)
    ? data.genres
        .map((g: any) => g?.description)
        .filter((valor: unknown): valor is string => Boolean(valor))
    : [];

  const categorias: string[] = Array.isArray(data.categories)
    ? data.categories
        .map((c: any) => c?.description)
        .filter((valor: unknown): valor is string => Boolean(valor))
    : [];

  const desarrolladores: string[] = Array.isArray(data.developers)
    ? data.developers.filter(
        (valor: unknown): valor is string =>
          typeof valor === "string" && valor.trim().length > 0,
      )
    : [];

  const distribuidores: string[] = Array.isArray(data.publishers)
    ? data.publishers.filter(
        (valor: unknown): valor is string =>
          typeof valor === "string" && valor.trim().length > 0,
      )
    : [];

  const detalle: JuegoDetalle = {
    steam_app_id: appId,
    nombre: data.name,
    tipo: data.type ?? null,
    descripcion_corta: limpiarHtml(data.short_description),
    descripcion_detallada: limpiarHtml(data.detailed_description),
    acerca_del_juego: limpiarHtml(data.about_the_game),
    idiomas_soportados: limpiarHtml(data.supported_languages),
    sitio_web: data.website ?? null,
    desarrolladores,
    distribuidores,
    generos,
    categorias,
    plataforma_windows: Boolean(data.platforms?.windows),
    plataforma_mac: Boolean(data.platforms?.mac),
    plataforma_linux: Boolean(data.platforms?.linux),
    fecha_lanzamiento: data.release_date?.date ?? null,
    es_gratis: Boolean(data.is_free),
    total_recomendaciones:
      typeof data.recommendations?.total === "number"
        ? data.recommendations.total
        : null,
    puntuacion_metacritic:
      typeof data.metacritic?.score === "number" ? data.metacritic.score : null,
    precio_inicial:
      typeof data.price_overview?.initial === "number"
        ? data.price_overview.initial
        : null,
    precio_final:
      typeof data.price_overview?.final === "number"
        ? data.price_overview.final
        : null,
    porcentaje_descuento:
      typeof data.price_overview?.discount_percent === "number"
        ? data.price_overview.discount_percent
        : null,
  };

  if (
    !detalle.descripcion_corta &&
    !detalle.descripcion_detallada &&
    !detalle.acerca_del_juego
  ) {
    return null;
  }

  return detalle;
}
