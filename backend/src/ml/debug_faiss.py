import faiss
import numpy as np
import psycopg2
import os
from sentence_transformers import SentenceTransformer

RUTA_MODELOS = "src/ml/modelos"

index = faiss.read_index(f"{RUTA_MODELOS}/faiss.index")
ids = np.load(f"{RUTA_MODELOS}/ids.npy")
modelo = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")

conn = psycopg2.connect(
    host="localhost",
    database="steam_recomendador",
    user="postgres",
    password="pokemonblack2"
)
cur = conn.cursor()
cur.execute("SELECT texto_consolidado FROM features_juegos WHERE steam_app_id = 10")
texto_cs = cur.fetchone()[0]
cur.close()
conn.close()

vector = modelo.encode([texto_cs], normalize_embeddings=True).astype("float32")
D, I = index.search(vector, 2000)

ids_resultado = [int(ids[i]) for i in I[0]]
targets = {730: "CS2", 240: "CS:Source", 80: "CS:CZ"}

print("Posiciones de las otras entregas de CS en el ranking completo:")
for pos, (idx, dist) in enumerate(zip(ids_resultado, D[0])):
    if idx in targets:
        print(f"  Posición {pos+1}/{len(ids_resultado)}: {targets[idx]} (appid={idx}) | similitud={dist:.4f}")

print("\nTop 15 más similares a CS original:")
for pos in range(15):
    print(f"  {pos+1}. appid={ids_resultado[pos]} | similitud={D[0][pos]:.4f}")