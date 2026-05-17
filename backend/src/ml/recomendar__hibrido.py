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
def normalizar_lista(valor):
    """
    Convierte géneros, categorías o tags a un set comparable.
    - Si ya es lista Python (ej: tags text[] de PostgreSQL) → directo.
    - Si es string separado por espacios (ej: generos_texto, categorias_texto) → divide por espacio.
    - Si tiene comas, punto y coma o pipes también los considera separadores.
    """
    if not valor:
        return set()

    if isinstance(valor, list):
        return {str(v).lower().strip() for v in valor if str(v).strip()}

    texto = str(valor).lower()

    for char in ["{", "}", "[", "]", '"', "'"]:
        texto = texto.replace(char, "")

    # FIX: incluir espacio como separador para generos_texto y categorias_texto
    partes = re.split(r",|;|\||\s+", texto)

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

    # FIX sentimiento: ratio real de reviews positivas en lugar de 0 hardcodeado
    # FIX popularidad: total real de reviews en lugar de cantidad_reviews_usadas (máx 15-30)
    cur.execute(
        """
        SELECT
            f.steam_app_id,
            f.nombre,
            f.texto_consolidado,
            f.generos_texto,
            f.categorias_texto,
            COALESCE(
                (SELECT COUNT(*) FILTER (WHERE r.voted_up = TRUE)::float
                 / NULLIF(COUNT(*), 0)
                 FROM reviews r
                 WHERE r.steam_app_id = f.steam_app_id),
                0.5
            ) AS ratio_positivo,
            (SELECT COUNT(*) FROM reviews r WHERE r.steam_app_id = f.steam_app_id) AS total_reviews,
            COALESCE(j.tags, ARRAY[]::text[]) AS tags
        FROM features_juegos f
        LEFT JOIN juegos j ON j.steam_app_id = f.steam_app_id
        WHERE f.steam_app_id = %s
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
            f.steam_app_id,
            f.nombre,
            f.texto_consolidado,
            f.generos_texto,
            f.categorias_texto,
            COALESCE(
                (SELECT COUNT(*) FILTER (WHERE r.voted_up = TRUE)::float
                 / NULLIF(COUNT(*), 0)
                 FROM reviews r
                 WHERE r.steam_app_id = f.steam_app_id),
                0.5
            ) AS ratio_positivo,
            (SELECT COUNT(*) FROM reviews r WHERE r.steam_app_id = f.steam_app_id) AS total_reviews,
            COALESCE(j.tags, ARRAY[]::text[]) AS tags
        FROM features_juegos f
        LEFT JOIN juegos j ON j.steam_app_id = f.steam_app_id
        WHERE f.steam_app_id = ANY(%s)
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
            "sentimiento": r[5],   # ahora es ratio real [0, 1]
            "reviews": r[6],       # ahora es el total real de reviews
            "tags": r[7],
        }
        for r in rows
    }


# ---------------- RECOMENDACIÓN POR JUEGO BASE ----------------
def recomendar(app_id, top_k=TOP_K):
    index, ids, bi_encoder, cross_encoder = cargar_recursos()

    base = obtener_juego(app_id)

    if not base:
        return {"error": "Juego base no encontrado"}

    base_id, nombre_base, texto_base, gen_base, cat_base, sent_base, rev_base, tags_base = base

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

        m2_generos = calcular_jaccard(gen_base, d["generos"])
        m2_categorias = calcular_jaccard(cat_base, d["categorias"])
        m2_tags = calcular_jaccard(tags_base, d["tags"])

        m2_jaccard = (
            (m2_generos * 0.05)
            + (m2_categorias * 0.15)
            + (m2_tags * 0.80)
        )

        # FIX: sentimiento ya viene como ratio [0,1], no necesita transformación
        m4_sentiment = float(d["sentimiento"] or 0.5)

        # FIX: reviews ahora es el total real (no las usadas para features)
        m5_popularity = min(np.log1p(d["reviews"] or 0) / 15, 1)

        score_total = (
            (item["faiss_score"] * 0.30)
            + (m3_cross * 0.25)   # subir — es más preciso que FAISS
            + (m2_jaccard * 0.40) # bajar un poco — los tags ya aportan bastante
            + (m4_sentiment * 0.03)
            + (m5_popularity * 0.02)
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
                    "jaccard_generos": float(round(m2_generos, 3)),
                    "jaccard_categorias": float(round(m2_categorias, 3)),
                    "jaccard_tags": float(round(m2_tags, 3)),
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

    for idx, item in enumerate(candidatos_alineados):
        d = item["data"]

        m3_cross = sigmoid(scores_cross[idx])

        # FIX: mismo arreglo de sentimiento y popularidad
        m4_sentiment = float(d["sentimiento"] or 0.5)
        m5_popularity = min(np.log1p(d["reviews"] or 0) / 15, 1)

        score_total = (
            (item["faiss_score"] * 0.40)
            + (m3_cross * 0.50)   # era 0.35 — el cross-encoder es el más preciso
            + (m4_sentiment * 0.05)
            + (m5_popularity * 0.05)
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


import faiss, numpy as np
from sentence_transformers import SentenceTransformer
import psycopg2, os

BASE_DIR = os.path.dirname(os.path.abspath("__file__"))
RUTA_MODELOS = "src/ml/modelos"

index = faiss.read_index(f"{RUTA_MODELOS}/faiss.index")
ids = np.load(f"{RUTA_MODELOS}/ids.npy")
modelo = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")

# Obtener texto de CS (app 10) desde tu DB
conn = psycopg2.connect(host="localhost", database="steam_recomendador", 
                         user="postgres", password="pokemonblack2")
cur = conn.cursor()
cur.execute("SELECT texto_consolidado FROM features_juegos WHERE steam_app_id = 10")
texto_cs = cur.fetchone()[0]

# Ver en qué posición aparecen CS:GO (730) y CS:Source (240)
vector = modelo.encode([texto_cs], normalize_embeddings=True).astype("float32")
D, I = index.search(vector, 100)  # buscar top 100

ids_resultado = [int(ids[i]) for i in I[0]]
distancias = D[0]

targets = {730: "CS2", 240: "CS:Source", 80: "CS:CZ", 10: "CS original"}
for pos, (idx, dist) in enumerate(zip(ids_resultado, distancias)):
    if idx in targets:
        print(f"Posición {pos+1}: {targets[idx]} (appid={idx}) | distancia FAISS={dist:.4f}")