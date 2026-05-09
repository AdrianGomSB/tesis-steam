import dotenv from "dotenv";
import {
  obtenerSemillaSteam,
  type AppSemilla,
} from "../services/steamSeed.service";
import {
  guardarSemilla,
  obtenerUltimoAppIdProceso,
  guardarUltimoAppIdProceso,
} from "../repositories/seed.repository";
dotenv.config();

const NOMBRE_PROCESO = "cargar_semilla_steam";
const MAX_LOTES = Number(process.env.MAX_LOTES ?? 20);
const PAUSA_ENTRE_LOTES_MS = 2000;
const PAUSA_REINTENTO_MS = 3000;
const MAX_INTENTOS = 3;

async function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mostrarProgreso(actual: number, total: number): void {
  const porcentaje = Math.round((actual / total) * 100);
  const totalBloques = 30;
  const bloquesCompletos = Math.round((porcentaje / 100) * totalBloques);

  const barra =
    "█".repeat(bloquesCompletos) + "░".repeat(totalBloques - bloquesCompletos);

  console.log(`[${barra}] ${porcentaje}% | Lote ${actual}/${total}`);
}

async function obtenerConReintento(
  ultimoAppId?: number,
  intentos = MAX_INTENTOS,
): Promise<AppSemilla[]> {
  try {
    return await obtenerSemillaSteam(ultimoAppId);
  } catch (error: any) {
    console.error(
      `Error al llamar a Steam para last_appid=${ultimoAppId ?? "inicio"}:`,
      error.code || error.message,
    );

    if (intentos > 0) {
      console.log(`Reintentando... intentos restantes: ${intentos - 1}`);
      await esperar(PAUSA_REINTENTO_MS);
      return obtenerConReintento(ultimoAppId, intentos - 1);
    }

    throw error;
  }
}

async function main(): Promise<void> {
  try {
    if (!process.env.STEAM_API_KEY) {
      throw new Error("Falta la variable de entorno STEAM_API_KEY");
    }

    console.log("Iniciando carga de semilla...");

    let ultimoAppId = await obtenerUltimoAppIdProceso(NOMBRE_PROCESO);

    if (ultimoAppId) {
      console.log(`Reanudando desde appid: ${ultimoAppId}`);
    } else {
      console.log("Iniciando desde el comienzo.");
    }
    let totalInsertados = 0;

    for (let i = 0; i < MAX_LOTES; i++) {
      mostrarProgreso(i + 1, MAX_LOTES);
      console.log(`Procesando lote ${i + 1} de ${MAX_LOTES}...`);

      const apps = await obtenerConReintento(ultimoAppId);

      if (!apps.length) {
        console.log("No se recibieron más apps. Fin del proceso.");
        break;
      }

      const insertados = await guardarSemilla(apps);

      totalInsertados += insertados;
      ultimoAppId = apps[apps.length - 1].appid;
      await guardarUltimoAppIdProceso(NOMBRE_PROCESO, ultimoAppId);

      console.log(`Apps procesadas en lote: ${insertados}`);
      console.log(`Total acumulado: ${totalInsertados}`);
      console.log(`Último appid procesado: ${ultimoAppId}`);

      await esperar(PAUSA_ENTRE_LOTES_MS);
    }

    console.log("Carga de semilla completada.");
    console.log(`Total de apps procesadas: ${totalInsertados}`);
  } catch (error) {
    console.error("Error en carga de semilla:", error);
    process.exit(1);
  }
}

main();
