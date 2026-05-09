import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const URL_STEAM = "https://api.steampowered.com/IStoreService/GetAppList/v1/";

const STEAM_API_KEY = process.env.STEAM_API_KEY;

if (!STEAM_API_KEY) {
  throw new Error("Falta STEAM_API_KEY en el archivo .env");
}

export type AppSemilla = {
  appid: number;
  name: string;
  last_modified?: number;
  price_change_number?: number;
};

export async function obtenerSemillaSteam(
  ultimoAppId?: number,
): Promise<AppSemilla[]> {
  try {
    console.log("Consultando semillas desde Steam...");

    if (ultimoAppId) {
      console.log(`Continuando desde appid: ${ultimoAppId}`);
    }

    const response = await axios.get(URL_STEAM, {
      params: {
        key: STEAM_API_KEY,
        include_games: true,
        include_dlc: false,
        include_software: false,
        include_videos: false,
        include_hardware: false,

        max_results: 100,

        ...(ultimoAppId ? { last_appid: ultimoAppId } : {}),
      },

      timeout: 20000,

      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
      },
    });

    const apps = response.data?.response?.apps;

    if (!Array.isArray(apps)) {
      throw new Error(
        "La respuesta de Steam no contiene una lista válida de apps.",
      );
    }

    console.log(`Apps obtenidas: ${apps.length}`);

    if (apps.length > 0) {
      console.log(
        `Primer appid recibido: ${apps[0].appid} | Último appid recibido: ${apps[apps.length - 1].appid}`,
      );
    }

    return apps;
  } catch (error: any) {
    console.error("Error obteniendo semillas desde Steam:");

    if (error.code) {
      console.error(`Código: ${error.code}`);
    }

    console.error(`Mensaje: ${error.message}`);

    throw new Error(`No se pudieron obtener semillas desde Steam.`);
  }
}
