import axios from "axios";

const URL_STEAMSPY = "https://steamspy.com/api.php";

export type SteamSpyDetalle = {
  tags: Record<string, number>;
  positive: number;
  negative: number;
  owners: string | null;
  ccu: number;
};

export async function obtenerSteamSpy(
  appid: number,
): Promise<SteamSpyDetalle | null> {
  try {
    const response = await axios.get(URL_STEAMSPY, {
      params: {
        request: "appdetails",
        appid,
      },
      timeout: 20000,
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
      },
    });

    const data = response.data;

    if (!data || !data.appid) {
      return null;
    }

    return {
      tags: data.tags && typeof data.tags === "object" ? data.tags : {},
      positive: typeof data.positive === "number" ? data.positive : 0,
      negative: typeof data.negative === "number" ? data.negative : 0,
      owners: typeof data.owners === "string" ? data.owners : null,
      ccu: typeof data.ccu === "number" ? data.ccu : 0,
    };
  } catch (error: any) {
    console.error(
      `Error consultando SteamSpy para appid ${appid}:`,
      error.code || error.message,
    );

    return null;
  }
}
