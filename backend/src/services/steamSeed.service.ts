import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const URL_STEAM = "https://api.steampowered.com/IStoreService/GetAppList/v1/";

export type AppSemilla = {
  appid: number;
  name: string;
  last_modified?: number;
  price_change_number?: number;
};

export async function obtenerSemillaSteam(
  ultimoAppId?: number,
): Promise<AppSemilla[]> {
  const response = await axios.get(URL_STEAM, {
    params: {
      key: process.env.STEAM_API_KEY,
      include_games: true,
      include_dlc: false,
      include_software: false,
      include_videos: false,
      include_hardware: false,
      max_results: 50,
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

  return apps;
}
