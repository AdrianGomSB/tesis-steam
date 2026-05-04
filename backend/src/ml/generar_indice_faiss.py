import os
import numpy as np
import faiss
import psycopg2
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "steam_recomendador")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

MODELO = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

RUTA_SALIDA = "src/ml/modelos"
os.makedirs(RUTA_SALIDA, exist_ok=True)

RUTA_EMBEDDINGS = f"{RUTA_SALIDA}/embeddings.npy"
RUTA_IDS = f"{RUTA_SALIDA}/ids.npy"
RUTA_FAISS = f"{RUTA_SALIDA}/faiss.index"


def conectar_db():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )


def obtener_juegos():
    conn = conectar_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT steam_app_id, texto_metadata
        FROM caracteristicas_juegos
        WHERE texto_metadata IS NOT NULL
          AND LENGTH(TRIM(texto_metadata)) > 0
        ORDER BY steam_app_id;
    """)

    filas = cursor.fetchall()
    cursor.close()
    conn.close()

    ids = [fila[0] for fila in filas]
    textos = [fila[1] for fila in filas]

    return ids, textos


def registrar_indice(total_juegos, dimension):
    conn = conectar_db()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO embeddings_juegos (
            modelo_embedding,
            dimension_embedding,
            ruta_embeddings,
            ruta_ids,
            ruta_indice_faiss,
            total_juegos,
            generado_en
        )
        VALUES (%s, %s, %s, %s, %s, %s, NOW());
    """, (
        MODELO,
        dimension,
        RUTA_EMBEDDINGS,
        RUTA_IDS,
        RUTA_FAISS,
        total_juegos
    ))

    conn.commit()
    cursor.close()
    conn.close()


def main():
    print("Obteniendo juegos desde PostgreSQL...")
    ids, textos = obtener_juegos()

    print(f"Total de juegos encontrados: {len(ids)}")

    if len(ids) == 0:
        raise ValueError("No hay juegos con texto_metadata válido.")

    print("Cargando modelo multilingüe...")
    modelo = SentenceTransformer(MODELO)

    print("Generando embeddings...")
    embeddings = modelo.encode(
        textos,
        show_progress_bar=True,
        convert_to_numpy=True,
        normalize_embeddings=True
    )

    embeddings = embeddings.astype("float32")
    ids_np = np.array(ids)

    dimension = embeddings.shape[1]

    print(f"Dimensión de embeddings: {dimension}")

    print("Creando índice FAISS...")
    index = faiss.IndexFlatIP(dimension)
    index.add(embeddings)

    print("Guardando archivos...")
    np.save(RUTA_EMBEDDINGS, embeddings)
    np.save(RUTA_IDS, ids_np)
    faiss.write_index(index, RUTA_FAISS)

    registrar_indice(
        total_juegos=len(ids),
        dimension=dimension
    )

    print("Índice FAISS generado correctamente.")
    print(f"Embeddings: {RUTA_EMBEDDINGS}")
    print(f"IDs: {RUTA_IDS}")
    print(f"FAISS index: {RUTA_FAISS}")


if __name__ == "__main__":
    main()