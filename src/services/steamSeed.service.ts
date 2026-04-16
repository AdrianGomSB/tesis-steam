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
  try {
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
    });

    return response.data.response.apps as AppSemilla[];
  } catch (error: any) {
    console.error("Error al llamar a Steam:", error.code || error.message);
    throw error;
  }
}
