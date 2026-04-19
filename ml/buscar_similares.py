import json
import faiss
import numpy as np
import psycopg2
from sklearn.feature_extraction.text import HashingVectorizer
from sklearn.preprocessing import normalize

DB_CONFIG = {
    "host": "localhost",
    "database": "steam_recomendador",
    "user": "postgres",
    "password": "pokemonblack2"
}

N_FEATURES = 1024
TOP_K = 10

def conectar():
    return psycopg2.connect(**DB_CONFIG)

def cargar_mapping():
    with open("ml/mapping.json", "r", encoding="utf-8") as f:
        return json.load(f)

def cargar_indice():
    return faiss.read_index("ml/index.faiss")

def obtener_texto_y_nombre_por_appid(steam_app_id: int):
    conn = conectar()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT nombre, texto_consolidado
        FROM features_juegos
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
        SELECT steam_app_id, nombre
        FROM juegos
        WHERE steam_app_id = ANY(%s)
        """,
        (ids,),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return {row[0]: row[1] for row in rows}

def vectorizar_texto(texto: str):
    vectorizer = HashingVectorizer(
        n_features=N_FEATURES,
        alternate_sign=False,
        norm=None
    )
    X = vectorizer.transform([texto])
    X = normalize(X, norm="l2", axis=1)
    return X.toarray().astype(np.float32)

def buscar_similares_por_appid(steam_app_id: int, top_k: int = TOP_K):
    mapping = cargar_mapping()
    index = cargar_indice()

    row = obtener_texto_y_nombre_por_appid(steam_app_id)
    if not row:
        print(f"No se encontró el juego con steam_app_id={steam_app_id} en features_juegos")
        return

    nombre_base, texto = row
    query_vector = vectorizar_texto(texto)

    distancias, indices = index.search(query_vector, top_k + 1)

    ids_encontrados = []
    for idx in indices[0]:
        if idx < 0:
            continue
        candidato_id = mapping[idx]
        if candidato_id != steam_app_id:
            ids_encontrados.append(candidato_id)

    ids_encontrados = ids_encontrados[:top_k]
    nombres = obtener_juegos_por_ids(ids_encontrados)

    print(f"\nJuego base: {nombre_base} ({steam_app_id})")
    print("\nSimilares:")
    for pos, candidato_id in enumerate(ids_encontrados, start=1):
        print(f"{pos}. {nombres.get(candidato_id, 'Desconocido')} ({candidato_id})")

if __name__ == "__main__":
    # Cambia este ID para probar otros juegos
    buscar_similares_por_appid(10, top_k=10)