import dotenv from "dotenv";
import { obtenerSemillaSteam } from "../services/steamSeed.service";
import { guardarSemilla } from "../repositories/seed.repository";

dotenv.config();

async function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function obtenerConReintento(intentos = 3): Promise<any[]> {
  try {
    return await obtenerSemillaSteam();
  } catch (error) {
    if (intentos > 0) {
      console.log(`Reintentando... intentos restantes: ${intentos}`);
      await esperar(3000);
      return obtenerConReintento(intentos - 1);
    }
    throw error;
  }
}

async function main() {
  try {
    console.log("Obteniendo datos de Steam...");

    const apps = await obtenerConReintento();

    if (!apps.length) {
      throw new Error("Steam devolvió 0 apps.");
    }

    console.log(`Apps recibidas: ${apps.length}`);

    await guardarSemilla(apps);

    console.log("Datos guardados correctamente en la base.");
  } catch (error) {
    console.error("Error al cargar la semilla:", error);
  }
}

main();
