import dotenv from "dotenv";
import { AppSemilla, obtenerSemillaSteam } from "../services/steamSeed.service";
import { guardarSemilla } from "../repositories/seed.repository";

dotenv.config();

async function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function obtenerConReintento(
  ultimoAppId?: number,
  intentos = 3,
): Promise<AppSemilla[]> {
  try {
    return await obtenerSemillaSteam(ultimoAppId);
  } catch (error: any) {
    console.error("Error al llamar a Steam:", error.code || error.message);

    if (intentos > 0) {
      console.log(
        `Reintentando... intentos restantes después de este intento: ${intentos - 1}`,
      );
      await esperar(3000);
      return obtenerConReintento(ultimoAppId, intentos - 1);
    }

    throw error;
  }
}

async function main() {
  try {
    console.log("Iniciando carga de semilla...");

    let ultimoAppId: number | undefined = undefined;
    let totalInsertados = 0;

    for (let i = 0; i < 20; i++) {
      console.log(`Lote ${i + 1}`);

      const apps = await obtenerConReintento(ultimoAppId);

      if (!apps.length) {
        console.log("No se recibieron más apps.");
        break;
      }

      await guardarSemilla(apps);

      totalInsertados += apps.length;

      ultimoAppId = apps[apps.length - 1].appid;

      console.log(`Insertados en lote: ${apps.length}`);
      console.log(`Total acumulado: ${totalInsertados}`);

      await esperar(2000);
    }

    console.log("Carga completa.");
    console.log(`Total insertado: ${totalInsertados}`);
  } catch (error) {
    console.error("Error en carga de semilla:", error);
  }
}

main();
