import os
import faiss
import numpy as np
import psycopg2
import re
import json
import sys
from sentence_transformers import SentenceTransformer, CrossEncoder

# ---------------- CONFIGURACIÓN ----------------
MODELO_BI = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
MODELO_CROSS = "cross-encoder/mmarco-mMiniLMv2-L12-H384-v1"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RUTA_MODELOS = os.path.join(BASE_DIR, "modelos")
TOP_K = 10


# ---------------- CONEXIÓN A BASE DE DATOS ----------------
def conectar():
    try:
        return psycopg2.connect(
            host=os.getenv("DB_HOST", "localhost"),
            port=os.getenv("DB_PORT", "5432"),
            database=os.getenv("DB_NAME", "steam_recomendador"),
            user=os.getenv("DB_USER", "postgres"),
            password=os.getenv("DB_PASSWORD", "pokemonblack2"),
        )
    except Exception as e:
        print(f"Error al conectar a PostgreSQL: {e}")
        return None


# ---------------- FUNCIONES DE UTILIDAD ----------------
def normalizar_lista(texto):
    if not texto:
        return set()

    texto = str(texto).lower()

    for char in ["{", "}", "[", "]", '"', "'"]:
        texto = texto.replace(char, "")

    partes = re.split(r",|;|\|", texto)
    return {p.strip() for p in partes if p.strip()}


def calcular_jaccard(a, b):
    set_a = normalizar_lista(a)
    set_b = normalizar_lista(b)

    if not set_a or not set_b:
        return 0

    return len(set_a & set_b) / len(set_a | set_b)


def sigmoid(x):
    return 1 / (1 + np.exp(-x))


def cargar_recursos():
    index = faiss.read_index(os.path.join(RUTA_MODELOS, "faiss.index"))
    ids = np.load(os.path.join(RUTA_MODELOS, "ids.npy"))

    bi_encoder = SentenceTransformer(MODELO_BI)
    cross_encoder = CrossEncoder(MODELO_CROSS)

    return index, ids, bi_encoder, cross_encoder


# ---------------- CONSULTAS A POSTGRESQL ----------------
def obtener_juego(app_id):
    conn = conectar()

    if not conn:
        return None

    cur = conn.cursor()

    cur.execute(
        """
        SELECT
            steam_app_id,
            nombre,
            texto_consolidado,
            generos_texto,
            categorias_texto,
            0 AS sentimiento_score,
            cantidad_reviews_usadas
        FROM features_juegos
        WHERE steam_app_id = %s
        """,
        (app_id,),
    )

    row = cur.fetchone()

    cur.close()
    conn.close()

    return row


def obtener_candidatos(ids_lista):
    if not ids_lista:
        return {}

    conn = conectar()

    if not conn:
        return {}

    cur = conn.cursor()

    cur.execute(
        """
        SELECT
            steam_app_id,
            nombre,
            texto_consolidado,
            generos_texto,
            categorias_texto,
            0 AS sentimiento_score,
            cantidad_reviews_usadas
        FROM features_juegos
        WHERE steam_app_id = ANY(%s)
        """,
        (list(map(int, ids_lista)),),
    )

    rows = cur.fetchall()

    cur.close()
    conn.close()

    return {
        r[0]: {
            "nombre": r[1],
            "texto_metadata": r[2],
            "generos": r[3],
            "categorias": r[4],
            "sentimiento": r[5],
            "reviews": r[6],
        }
        for r in rows
    }


# ---------------- RECOMENDACIÓN POR JUEGO BASE ----------------
def recomendar(app_id, top_k=TOP_K):
    index, ids, bi_encoder, cross_encoder = cargar_recursos()

    base = obtener_juego(app_id)

    if not base:
        return {"error": "Juego base no encontrado"}

    base_id, nombre_base, texto_base, gen_base, cat_base, sent_base, rev_base = base

    if not texto_base:
        return {"error": "El juego base no tiene texto_metadata"}

    vector = bi_encoder.encode([texto_base], normalize_embeddings=True).astype("float32")

    D, I = index.search(vector, 40)

    ids_candidatos = [int(ids[i]) for i in I[0] if int(ids[i]) != base_id]
    data_candidatos = obtener_candidatos(ids_candidatos)

    candidatos_alineados = []
    pares_cross_encoder = []

    for pos, faiss_idx in enumerate(I[0]):
        cid = int(ids[faiss_idx])

        if cid != base_id and cid in data_candidatos:
            m1_faiss = 1 / (1 + D[0][pos])

            candidatos_alineados.append(
                {
                    "id": cid,
                    "faiss_score": m1_faiss,
                    "data": data_candidatos[cid],
                }
            )

            texto_candidato = data_candidatos[cid]["texto_metadata"] or ""
            pares_cross_encoder.append([texto_base, texto_candidato])

    if not candidatos_alineados:
        return []

    scores_cross = cross_encoder.predict(pares_cross_encoder)

    resultados_finales = []

    for idx, item in enumerate(candidatos_alineados):
        d = item["data"]

        m3_cross = sigmoid(scores_cross[idx])

        m2_jaccard = (
            calcular_jaccard(gen_base, d["generos"])
            + calcular_jaccard(cat_base, d["categorias"])
        ) / 2

        m4_sentiment = (float(d["sentimiento"] or 0) + 1) / 2
        m5_popularity = min(np.log1p(d["reviews"] or 0) / 15, 1)

        score_total = (
            (item["faiss_score"] * 0.40)
            + (m3_cross * 0.20)
            + (m2_jaccard * 0.25)
            + (m4_sentiment * 0.05)
            + (m5_popularity * 0.10)
        )

        resultados_finales.append(
            {
                "app_id": int(item["id"]),
                "nombre": d["nombre"],
                "score": float(round(score_total, 4)),
                "metricas": {
                    "semantica": float(round(m3_cross, 3)),
                    "vectorial": float(round(item["faiss_score"], 3)),
                    "jaccard": float(round(m2_jaccard, 3)),
                    "sentimiento": float(round(m4_sentiment, 3)),
                    "popularidad": float(round(m5_popularity, 3)),
                },
            }
        )

    salida = sorted(resultados_finales, key=lambda x: x["score"], reverse=True)[:top_k]

    return salida


def recomendar_por_juego(steam_app_id: int, top_k=TOP_K):
    return recomendar(steam_app_id, top_k)


# ---------------- RECOMENDACIÓN POR DESCRIPCIÓN TEXTUAL ----------------
def recomendar_por_texto(consulta: str, top_k=TOP_K):
    index, ids, bi_encoder, cross_encoder = cargar_recursos()

    if not consulta or not consulta.strip():
        return {"error": "La consulta no puede estar vacía"}

    texto_base = consulta.strip()

    vector = bi_encoder.encode([texto_base], normalize_embeddings=True).astype("float32")

    D, I = index.search(vector, 40)

    ids_candidatos = [int(ids[i]) for i in I[0]]
    data_candidatos = obtener_candidatos(ids_candidatos)

    candidatos_alineados = []
    pares_cross_encoder = []

    for pos, faiss_idx in enumerate(I[0]):
        cid = int(ids[faiss_idx])

        if cid in data_candidatos:
            m1_faiss = 1 / (1 + D[0][pos])

            candidatos_alineados.append(
                {
                    "id": cid,
                    "faiss_score": m1_faiss,
                    "data": data_candidatos[cid],
                }
            )

            texto_candidato = data_candidatos[cid]["texto_metadata"] or ""
            pares_cross_encoder.append([texto_base, texto_candidato])

    if not candidatos_alineados:
        return []

    scores_cross = cross_encoder.predict(pares_cross_encoder)

    resultados_finales = []
    def calcular_keywords(consulta, texto_juego, generos, categorias):
        consulta = (consulta or "").lower()
        texto_total = f"{texto_juego or ''} {generos or ''} {categorias or ''}".lower()

        score = 0

        if any(p in consulta for p in ["disparo", "disparos", "shooter", "fps"]):
            if any(p in texto_total for p in ["shooter", "fps", "acción", "action", "disparos"]):
                score += 0.30

        if any(p in consulta for p in ["online", "multijugador", "multiplayer"]):
            if any(p in texto_total for p in ["online", "multiplayer", "multijugador", "cooperativo", "co-op"]):
                score += 0.25

        if any(p in consulta for p in ["gratis", "gratuito", "free", "free to play"]):
            if any(p in texto_total for p in ["free to play", "gratis", "free"]):
                score += 0.25

        if any(p in consulta for p in ["competitivo", "competitiva", "pvp"]):
            if any(p in texto_total for p in ["competitive", "competitivo", "pvp", "versus"]):
                score += 0.20

        return min(score, 1)
    
    for idx, item in enumerate(candidatos_alineados):
        d = item["data"]

        m3_cross = sigmoid(scores_cross[idx])
        m4_sentiment = (float(d["sentimiento"] or 0) + 1) / 2
        m5_popularity = min(np.log1p(d["reviews"] or 0) / 15, 1)

        score_total = (
            (item["faiss_score"] * 0.40)
            + (m3_cross * 0.35)
            + (m4_sentiment * 0.10)
            + (m5_popularity * 0.15)
        )

        resultados_finales.append(
            {
                "app_id": int(item["id"]),
                "nombre": d["nombre"],
                "score": float(round(score_total, 4)),
                "metricas": {
                    "semantica": float(round(m3_cross, 3)),
                    "vectorial": float(round(item["faiss_score"], 3)),
                    "sentimiento": float(round(m4_sentiment, 3)),
                    "popularidad": float(round(m5_popularity, 3)),
                },
            }
        )

    salida = sorted(resultados_finales, key=lambda x: x["score"], reverse=True)[:top_k]

    return salida


# ---------------- PRUEBAS POR CONSOLA ----------------
if __name__ == "__main__":
    try:
        if len(sys.argv) > 1:
            modo = sys.argv[1]

            if modo == "juego":
                steam_app_id = int(sys.argv[2])
                resultado = recomendar_por_juego(steam_app_id)

            elif modo == "texto":
                consulta = " ".join(sys.argv[2:])
                resultado = recomendar_por_texto(consulta)

            else:
                steam_app_id = int(sys.argv[1])
                resultado = recomendar_por_juego(steam_app_id)

            print(json.dumps(resultado, ensure_ascii=False, indent=2))

        else:
            resultado = recomendar_por_juego(10)
            print(json.dumps(resultado, ensure_ascii=False, indent=2))

    except Exception as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False, indent=2))