type JuegoBase = {
  steam_app_id: number;
  nombre: string;
  descripcion_corta: string | null;
  descripcion_detallada: string | null;
  acerca_del_juego: string | null;
  generos: string[] | null;
  categorias: string[] | null;
};

type ReviewBase = {
  texto_review: string | null;
  voto_positivo: boolean;
  votos_utiles: number | null;
  autor_tiempo_jugado_total: number | null;
};

type ResumenBase = {
  total_positivas: number | null;
  total_negativas: number | null;
  total_reviews: number | null;
  score_review: number | null;
  descripcion_score: string | null;
};

export type FeatureJuego = {
  steam_app_id: number;
  nombre: string;
  texto_consolidado: string;
  cantidad_reviews: number;
  cantidad_positivas: number;
  cantidad_negativas: number;
  ratio_positivo: number;
  promedio_horas_jugadas: number;
  score_review: number | null;
  descripcion_score: string | null;
};

function limpiarTexto(texto: string | null | undefined): string {
  if (!texto) return "";
  return texto.replace(/\s+/g, " ").trim();
}

function seleccionarReviews(
  reviews: ReviewBase[],
  votoPositivo: boolean,
  limite = 5,
): string[] {
  return reviews
    .filter(
      (r) =>
        r.voto_positivo === votoPositivo &&
        r.texto_review &&
        r.texto_review.trim().length > 20,
    )
    .sort((a, b) => {
      const utilesA = a.votos_utiles ?? 0;
      const utilesB = b.votos_utiles ?? 0;
      if (utilesB !== utilesA) return utilesB - utilesA;

      const horasA = a.autor_tiempo_jugado_total ?? 0;
      const horasB = b.autor_tiempo_jugado_total ?? 0;
      return horasB - horasA;
    })
    .slice(0, limite)
    .map((r) => limpiarTexto(r.texto_review));
}

export function construirFeatureJuego(
  juego: JuegoBase,
  reviews: ReviewBase[],
  resumen: ResumenBase | null,
): FeatureJuego {
  const nombre = limpiarTexto(juego.nombre);
  const descripcionCorta = limpiarTexto(juego.descripcion_corta);
  const descripcionDetallada = limpiarTexto(juego.descripcion_detallada);
  const acercaDelJuego = limpiarTexto(juego.acerca_del_juego);

  const generos = (juego.generos ?? []).join(" ");
  const categorias = (juego.categorias ?? []).join(" ");

  const reviewsPositivas = seleccionarReviews(reviews, true, 5);
  const reviewsNegativas = seleccionarReviews(reviews, false, 5);

  const bloquePositivas =
    reviewsPositivas.length > 0
      ? `opiniones positivas ${reviewsPositivas.join(" ")}`
      : "";

  const bloqueNegativas =
    reviewsNegativas.length > 0
      ? `opiniones negativas ${reviewsNegativas.join(" ")}`
      : "";

  const textoConsolidado = limpiarTexto(
    [
      nombre,
      descripcionCorta,
      descripcionDetallada,
      acercaDelJuego,
      generos,
      categorias,
      bloquePositivas,
      bloqueNegativas,
    ].join(" "),
  );

  const cantidadReviews = reviews.length;
  const cantidadPositivas = reviews.filter(
    (r) => r.voto_positivo === true,
  ).length;
  const cantidadNegativas = reviews.filter(
    (r) => r.voto_positivo === false,
  ).length;

  const ratioPositivo =
    cantidadReviews > 0 ? cantidadPositivas / cantidadReviews : 0;

  const horasValidas = reviews
    .map((r) => r.autor_tiempo_jugado_total ?? 0)
    .filter((h) => h > 0);

  const promedioHorasJugadas =
    horasValidas.length > 0
      ? horasValidas.reduce((acc, h) => acc + h, 0) / horasValidas.length
      : 0;

  return {
    steam_app_id: juego.steam_app_id,
    nombre,
    texto_consolidado: textoConsolidado,
    cantidad_reviews: resumen?.total_reviews ?? cantidadReviews,
    cantidad_positivas: resumen?.total_positivas ?? cantidadPositivas,
    cantidad_negativas: resumen?.total_negativas ?? cantidadNegativas,
    ratio_positivo: Number(ratioPositivo.toFixed(4)),
    promedio_horas_jugadas: Number(promedioHorasJugadas.toFixed(2)),
    score_review: resumen?.score_review ?? null,
    descripcion_score: resumen?.descripcion_score ?? null,
  };
}
