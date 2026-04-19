import psycopg2
import numpy as np
import faiss
import json
from sklearn.feature_extraction.text import HashingVectorizer
from sklearn.preprocessing import normalize

# ==========================
# CONFIG DB
# ==========================

DB_CONFIG = {
    "host": "localhost",
    "database": "steam_recomendador",
    "user": "postgres",
    "password": "pokemonblack2"
}

# ==========================
# PARÁMETROS
# ==========================

N_FEATURES = 1024

# ==========================
# 1. CARGAR DATOS
# ==========================

def cargar_datos():
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT steam_app_id, texto_consolidado
        FROM features_juegos
        WHERE texto_consolidado IS NOT NULL
    """)

    rows = cursor.fetchall()

    cursor.close()
    conn.close()

    app_ids = []
    textos = []

    for row in rows:
        app_ids.append(row[0])
        textos.append(row[1])

    return app_ids, textos


# ==========================
# 2. VECTORIZAR
# ==========================

def vectorizar(textos):
    vectorizer = HashingVectorizer(
        n_features=N_FEATURES,
        alternate_sign=False,
        norm=None
    )

    X = vectorizer.transform(textos)

    return X


# ==========================
# 3. NORMALIZAR
# ==========================

def normalizar(X):
    X_norm = normalize(X, norm="l2", axis=1)
    return X_norm.toarray().astype(np.float32)


# ==========================
# 4. CREAR FAISS
# ==========================

def crear_indice(vectores):
    dimension = vectores.shape[1]

    index = faiss.IndexFlatIP(dimension)
    index.add(vectores)

    return index

# ==========================
# 5. GUARDAR
# ==========================

def guardar(index, app_ids):
    faiss.write_index(index, "ml/index.faiss")

    with open("ml/mapping.json", "w", encoding="utf-8") as f:
        json.dump(app_ids, f)

    print("Índice y mapping guardados correctamente")


# ==========================
# MAIN
# ==========================

def main():
    print("Cargando datos desde PostgreSQL...")
    app_ids, textos = cargar_datos()

    print(f"Total juegos: {len(textos)}")

    print("Vectorizando...")
    X = vectorizar(textos)

    print("Normalizando...")
    X = normalizar(X)

    print("Creando índice FAISS...")
    index = crear_indice(X)

    print("Guardando índice...")
    guardar(index, app_ids)

    print("Proceso completado 🚀")


if __name__ == "__main__":
    main()