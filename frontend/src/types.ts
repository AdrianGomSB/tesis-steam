export interface Recomendacion {
  app_id: number;
  nombre: string;
  score: number;
  metricas: {
    semantica: number;
    vectorial: number;
    popularidad: number;
  };
}
