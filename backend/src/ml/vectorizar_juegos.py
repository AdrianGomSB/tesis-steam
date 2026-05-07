import os
import psycopg2
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer

# ==========================
# CONFIGURACIÓN
# ==========================

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "database": os.getenv("DB_NAME", "steam_recomendador"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "pokemonblack2"),
}

MODELO_BI = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RUTA_MODELOS = os.path.join(BASE_DIR, "modelos")

ARCHIVO_FAISS = os.path.join(RUTA_MODELOS, "faiss.index")
ARCHIVO_IDS = os.path.join(RUTA_MODELOS, "ids.npy")


# ==========================
# 1. CARGAR DATOS
# ==========================

def cargar_datos():
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT steam_app_id, texto_metadata
        FROM caracteristicas_juegos
        WHERE texto_metadata IS NOT NULL
          AND LENGTH(TRIM(texto_metadata)) > 0
        ORDER BY steam_app_id
    """)

    rows = cursor.fetchall()

    cursor.close()
    conn.close()

    app_ids = []
    textos = []

    for app_id, texto in rows:
        app_ids.append(int(app_id))
        textos.append(texto)

    return app_ids, textos


# ==========================
# 2. GENERAR EMBEDDINGS
# ==========================

def generar_embeddings(textos):
    modelo = SentenceTransformer(MODELO_BI)

    embeddings = modelo.encode(
        textos,
        batch_size=32,
        show_progress_bar=True,
        normalize_embeddings=True
    )

    return embeddings.astype("float32")


# ==========================
# 3. CREAR ÍNDICE FAISS
# ==========================

def crear_indice(embeddings):
    dimension = embeddings.shape[1]

    index = faiss.IndexFlatIP(dimension)
    index.add(embeddings)

    return index


# ==========================
# 4. GUARDAR MODELOS
# ==========================

def guardar(index, app_ids):
    os.makedirs(RUTA_MODELOS, exist_ok=True)

    faiss.write_index(index, ARCHIVO_FAISS)
    np.save(ARCHIVO_IDS, np.array(app_ids, dtype=np.int64))

    print(f"Índice FAISS guardado en: {ARCHIVO_FAISS}")
    print(f"IDs guardados en: {ARCHIVO_IDS}")


# ==========================
# MAIN
# ==========================

def main():
    print("Cargando datos desde PostgreSQL...")
    app_ids, textos = cargar_datos()

    print(f"Total juegos cargados: {len(textos)}")

    if len(textos) == 0:
        print("No hay textos para vectorizar.")
        return

    print("Generando embeddings con SentenceTransformer...")
    embeddings = generar_embeddings(textos)

    print(f"Dimensión embeddings: {embeddings.shape}")

    print("Creando índice FAISS...")
    index = crear_indice(embeddings)

    print("Guardando archivos...")
    guardar(index, app_ids)

    print("Vectorización completada correctamente.")


if __name__ == "__main__":
    main()