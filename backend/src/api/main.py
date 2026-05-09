from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from src.ml.recomendar__hibrido import recomendar_por_juego, recomendar_por_texto

app = FastAPI(
    title="API Sistema Recomendador Steam",
    description="API para recomendaciones de videojuegos por juego base o descripción textual.",
    version="1.0.0"
)


class RecomendarPorJuegoRequest(BaseModel):
    steam_app_id: int


class RecomendarPorTextoRequest(BaseModel):
    consulta: str


@app.get("/")
def inicio():
    return {
        "ok": True,
        "mensaje": "API del sistema recomendador Steam funcionando"
    }


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