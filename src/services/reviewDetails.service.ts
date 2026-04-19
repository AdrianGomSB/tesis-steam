import axios from "axios";

export type ReviewSteam = {
  recommendationid: string;
  language: string | null;
  review: string | null;
  timestamp_created: number | null;
  timestamp_updated: number | null;
  voted_up: boolean;
  votes_up: number | null;
  votes_funny: number | null;
  weighted_vote_score: string | null;
  comment_count: number | null;
  steam_purchase: boolean;
  received_for_free: boolean;
  written_during_early_access: boolean;
  author: {
    steamid: string | null;
    num_games_owned: number | null;
    num_reviews: number | null;
    playtime_forever: number | null;
    playtime_last_two_weeks: number | null;
    playtime_at_review: number | null;
  };
};

export type RespuestaReviewsSteam = {
  reviews: ReviewSteam[];
  cursor: string | null;
};

export async function obtenerReviewsJuego(
  appId: number,
  cursor = "*",
): Promise<RespuestaReviewsSteam> {
  const url = `https://store.steampowered.com/appreviews/${appId}`;

  const response = await axios.get(url, {
    params: {
      json: 1,
      language: "spanish",
      filter: "recent",
      purchase_type: "all",
      num_per_page: 100,
      cursor,
    },
    timeout: 20000,
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
    },
  });

  const data = response.data;

  const reviews: ReviewSteam[] = Array.isArray(data?.reviews)
    ? data.reviews
    : [];

  return {
    reviews,
    cursor: data?.cursor ?? null,
  };
}
