import os
import psycopg2
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from src.ml.recomendar__hibrido import recomendar_por_juego, recomendar_por_texto

app = FastAPI(
    title="API Sistema Recomendador Steam",
    description="API para recomendaciones de videojuegos por juego base o descripción textual.",
    version="1.0.0"
)

# CORS — permite que el frontend en localhost:5173 (Vite) se conecte
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------- CONEXIÓN ----------------
def conectar():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        database=os.getenv("DB_NAME", "steam_recomendador"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "pokemonblack2"),
    )


# ---------------- MODELOS ----------------
class RecomendarPorJuegoRequest(BaseModel):
    steam_app_id: int


class RecomendarPorTextoRequest(BaseModel):
    consulta: str


# ---------------- ENDPOINTS ----------------
@app.get("/")
def inicio():
    return {
        "ok": True,
        "mensaje": "API del sistema recomendador Steam funcionando"
    }


@app.get("/api/juegos/buscar")
def buscar_juegos(q: str = Query(default="", min_length=0), limite: int = 8):
    """
    Busca juegos por nombre para el autocomplete del frontend.
    Devuelve app_id y nombre de los juegos que coincidan con la búsqueda.
    """
    if not q or len(q.strip()) < 2:
        return []

    try:
        conn = conectar()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT steam_app_id, nombre
            FROM juegos
            WHERE nombre ILIKE %s
            ORDER BY
                CASE WHEN LOWER(nombre) = LOWER(%s) THEN 0
                     WHEN LOWER(nombre) LIKE LOWER(%s) THEN 1
                     ELSE 2
                END,
                nombre
            LIMIT %s
            """,
            (f"%{q.strip()}%", q.strip(), f"{q.strip()}%", limite),
        )

        rows = cur.fetchall()
        cur.close()
        conn.close()

        return [{"app_id": r[0], "nombre": r[1]} for r in rows]

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/recomendar/por-juego")
def recomendar_juego(data: RecomendarPorJuegoRequest):
    try:
        resultado = recomendar_por_juego(data.steam_app_id)

        return {
            "ok": True,
            "tipo": "juego",
            "steam_app_id": data.steam_app_id,
            "recomendaciones": resultado
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/recomendar/por-texto")
def recomendar_texto(data: RecomendarPorTextoRequest):
    try:
        resultado = recomendar_por_texto(data.consulta)

        return {
            "ok": True,
            "tipo": "texto",
            "consulta": data.consulta,
            "recomendaciones": resultado
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
