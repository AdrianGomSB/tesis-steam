import os
import faiss
import numpy as np
import psycopg2
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": os.getenv("DB_PORT", "5432"),
    "database": os.getenv("DB_NAME", "steam_recomendador"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "pokemonblack2"),
}

MODELO = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

RUTA_MODELOS = "src/ml/modelos"
RUTA_FAISS = f"{RUTA_MODELOS}/faiss.index"
RUTA_IDS = f"{RUTA_MODELOS}/ids.npy"

TOP_K = 10


def conectar():
    return psycopg2.connect(**DB_CONFIG)


def cargar_indice():
    return faiss.read_index(RUTA_FAISS)


def cargar_ids():
    return np.load(RUTA_IDS)


def obtener_juego_por_appid(steam_app_id: int):
    conn = conectar()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT steam_app_id, nombre, texto_metadata
        FROM caracteristicas_juegos
        WHERE steam_app_id = %s
        """,
        (steam_app_id,),
    )

    row = cur.fetchone()
    cur.close()
    conn.close()
    return row


def obtener_juegos_por_ids(ids):
    conn = conectar()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT 
            c.steam_app_id,
            c.nombre,
            c.generos_texto,
            c.categorias_texto,
            c.sentimiento_score,
            c.sentimiento_dinamico,
            c.total_resenas
        FROM caracteristicas_juegos c
        WHERE c.steam_app_id = ANY(%s)
        """,
        (list(map(int, ids)),),
    )

    rows = cur.fetchall()
    cur.close()
    conn.close()

    return {
        row[0]: {
            "nombre": row[1],
            "generos": row[2],
            "categorias": row[3],
            "sentimiento_score": row[4],
            "sentimiento_dinamico": row[5],
            "total_resenas": row[6],
        }
        for row in rows
    }


def buscar_similares_por_appid(steam_app_id: int, top_k: int = TOP_K):
    index = cargar_indice()
    ids = cargar_ids()
    modelo = SentenceTransformer(MODELO)

    juego = obtener_juego_por_appid(steam_app_id)

    if not juego:
        print(f"No se encontró el juego con steam_app_id={steam_app_id}")
        return

    app_id_base, nombre_base, texto_metadata = juego

    query_vector = modelo.encode(
        [texto_metadata],
        normalize_embeddings=True,
        convert_to_numpy=True
    ).astype("float32")

    distancias, indices = index.search(query_vector, top_k + 1)

    ids_encontrados = []

    for idx in indices[0]:
        if idx < 0:
            continue

        candidato_id = int(ids[idx])

        if candidato_id != app_id_base:
            ids_encontrados.append(candidato_id)

    ids_encontrados = ids_encontrados[:top_k]
    datos_juegos = obtener_juegos_por_ids(ids_encontrados)

    print(f"\nJuego base: {nombre_base} ({steam_app_id})")
    print("\nSimilares:")

    for pos, candidato_id in enumerate(ids_encontrados, start=1):
        datos = datos_juegos.get(candidato_id, {})

        print(
            f"{pos}. {datos.get('nombre', 'Desconocido')} ({candidato_id}) "
            f"| sentimiento={datos.get('sentimiento_score')} "
            f"| reviews={datos.get('total_resenas')}"
        )


if __name__ == "__main__":
    buscar_similares_por_appid(10, top_k=10)