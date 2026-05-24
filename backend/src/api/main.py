import os
import json
import subprocess
import psycopg2
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from src.ml.recomendar__hibrido import recomendar_por_juego, recomendar_por_texto

# ---------------- APP ----------------
app = FastAPI(
    title="API Sistema Recomendador Steam",
    description="API para recomendaciones de videojuegos por juego base o descripci�n textual.",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Archivo donde guardamos el estado del �ltimo sync
LOG_PATH = Path("src/api/sync_log.json")
RUTA_MODELOS = Path("src/ml/modelos")
BASE_DIR = Path(__file__).parent.parent.parent  # ra�z del backend


# ---------------- CONEXI�N ----------------
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


# ---------------- PIPELINE JOB ----------------
def leer_log() -> dict:
    if LOG_PATH.exists():
        with open(LOG_PATH, "r") as f:
            return json.load(f)
    return {
        "ultimo_sync": None,
        "proximo_sync": None,
        "ultimo_resultado": None,
        "errores": [],
        "pasos_completados": [],
        "juegos_nuevos_agregados": 0,
        "duracion_segundos": 0,
    }

def guardar_log(data: dict):
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_PATH, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def correr_paso_node(script_npm: str, descripcion: str, log: dict) -> bool:
    """Corre un paso del pipeline Node (npm run ...)"""
    print(f"[SYNC] Ejecutando: {descripcion}...")
    try:
        resultado = subprocess.run(
            ["npm", "run", script_npm],
            cwd=str(BASE_DIR),
            capture_output=True, text=True, timeout=1800  # 30 min max
        )
        if resultado.returncode != 0:
            log["errores"].append({
                "paso": descripcion,
                "error": resultado.stderr[-500:],
                "timestamp": datetime.now().isoformat()
            })
            print(f"[SYNC] ERROR en {descripcion}: {resultado.stderr[-200:]}")
            return False

        log["pasos_completados"].append(descripcion)
        print(f"[SYNC]  {descripcion} completado")
        return True

    except subprocess.TimeoutExpired:
        log["errores"].append({
            "paso": descripcion,
            "error": "Timeout despu�s de 30 minutos",
            "timestamp": datetime.now().isoformat()
        })
        return False
    except Exception as e:
        log["errores"].append({
            "paso": descripcion,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        })
        return False

def correr_paso_python(script: str, descripcion: str, log: dict) -> bool:
    """Corre un paso del pipeline Python"""
    print(f"[SYNC] Ejecutando: {descripcion}...")
    try:
        resultado = subprocess.run(
            ["python", script],
            cwd=str(BASE_DIR),
            capture_output=True, text=True, timeout=3600  # 1 hora max para vectorizaci�n
        )
        if resultado.returncode != 0:
            log["errores"].append({
                "paso": descripcion,
                "error": resultado.stderr[-500:],
                "timestamp": datetime.now().isoformat()
            })
            print(f"[SYNC] ERROR en {descripcion}: {resultado.stderr[-200:]}")
            return False

        log["pasos_completados"].append(descripcion)
        print(f"[SYNC]  {descripcion} completado")
        return True

    except subprocess.TimeoutExpired:
        log["errores"].append({
            "paso": descripcion,
            "error": "Timeout despu�s de 1 hora",
            "timestamp": datetime.now().isoformat()
        })
        return False
    except Exception as e:
        log["errores"].append({
            "paso": descripcion,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        })
        return False

def contar_juegos_antes() -> int:
    try:
        conn = conectar()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM juegos")
        count = cur.fetchone()[0]
        cur.close()
        conn.close()
        return count
    except:
        return 0

def ejecutar_pipeline_completo():
    """
    Pipeline completo que corre a las 3am:
    1. Cargar semilla de Steam
    2. Procesar detalles de juegos
    3. Descargar reviews
    4. Generar features
    5. Vectorizar con FAISS
    """
    inicio = datetime.now()
    print(f"\n[SYNC] ====== PIPELINE AUTOM�TICO INICIADO: {inicio.isoformat()} ======")

    log = leer_log()
    log["ultimo_sync"] = inicio.isoformat()
    log["pasos_completados"] = []
    log["errores"] = []

    # Calcular pr�ximo sync (ma�ana a las 3am)
    manana_3am = (inicio + timedelta(days=1)).replace(hour=3, minute=0, second=0, microsecond=0)
    log["proximo_sync"] = manana_3am.isoformat()

    juegos_antes = contar_juegos_antes()

    # Paso 1: Cargar semilla
    ok = correr_paso_node("semilla:cargar", "Cargar semilla Steam", log)
    if not ok:
        log["ultimo_resultado"] = "error"
        guardar_log(log)
        return

    # Paso 2: Procesar juegos (m�ximo 100 por noche para no sobrecargar)
    ok = correr_paso_node("juegos:procesar", "Procesar detalles de juegos", log)
    if not ok:
        log["ultimo_resultado"] = "error_parcial"
        guardar_log(log)

    # Paso 3: Descargar reviews
    ok = correr_paso_node("reviews:procesar", "Descargar reviews", log)
    if not ok:
        log["ultimo_resultado"] = "error_parcial"
        guardar_log(log)

    # Paso 4: Generar features
    ok = correr_paso_node("features:generar", "Generar features", log)
    if not ok:
        log["ultimo_resultado"] = "error_parcial"
        guardar_log(log)

    # Paso 5: Vectorizar con FAISS (solo si los pasos anteriores funcionaron)
    ok = correr_paso_python("src/ml/vectorizar_juegos.py", "Vectorizar con FAISS", log)

    # Calcular juegos nuevos
    juegos_despues = contar_juegos_antes()
    log["juegos_nuevos_agregados"] = max(0, juegos_despues - juegos_antes)

    fin = datetime.now()
    log["duracion_segundos"] = int((fin - inicio).total_seconds())
    log["ultimo_resultado"] = "exitoso" if not log["errores"] else "exitoso_con_errores"

    guardar_log(log)
    print(f"[SYNC] ====== PIPELINE COMPLETADO en {log['duracion_segundos']}s ======\n")


# ---------------- DRIFT DETECTION ----------------
def calcular_metricas_drift() -> dict:
    """
    Calcula m�tricas de salud del sistema para detectar data drift.
    """
    try:
        conn = conectar()
        cur = conn.cursor()

        # 1. Cobertura: juegos sin features
        cur.execute("""
            SELECT COUNT(*) FROM juegos j
            WHERE NOT EXISTS (
                SELECT 1 FROM features_juegos f WHERE f.steam_app_id = j.steam_app_id
            )
        """)
        juegos_sin_features = cur.fetchone()[0]

        # 2. Total juegos
        cur.execute("SELECT COUNT(*) FROM juegos")
        total_juegos = cur.fetchone()[0]

        # 3. Total features
        cur.execute("SELECT COUNT(*) FROM features_juegos")
        total_features = cur.fetchone()[0]

        # 4. Reviews por juego (promedio)
        cur.execute("""
            SELECT AVG(cnt) FROM (
                SELECT COUNT(*) as cnt FROM reviews GROUP BY steam_app_id
            ) sub
        """)
        avg_reviews = float(cur.fetchone()[0] or 0)

        # 5. Distribuci�n de g�neros
        cur.execute("""
            SELECT generos_texto, COUNT(*) as cnt
            FROM features_juegos
            WHERE generos_texto IS NOT NULL AND generos_texto != ''
            GROUP BY generos_texto
            ORDER BY cnt DESC
            LIMIT 10
        """)
        top_generos = [{"genero": r[0], "cantidad": r[1]} for r in cur.fetchall()]

        # 6. Juegos con reviews �tiles vs sin reviews
        cur.execute("""
            SELECT
                SUM(CASE WHEN cantidad_reviews_usadas > 0 THEN 1 ELSE 0 END) as con_reviews,
                SUM(CASE WHEN cantidad_reviews_usadas = 0 THEN 1 ELSE 0 END) as sin_reviews
            FROM features_juegos
        """)
        row = cur.fetchone()
        con_reviews = row[0] or 0
        sin_reviews = row[1] or 0

        # 7. Sentimiento promedio del cat�logo
        cur.execute("""
            SELECT
                AVG(positivas::float / NULLIF(positivas + negativas, 0)) as sentimiento_promedio,
                AVG(positivas + negativas) as reviews_promedio
            FROM juegos
            WHERE positivas IS NOT NULL
        """)
        row = cur.fetchone()
        sentimiento_promedio = float(row[0] or 0.5)
        reviews_promedio_comunidad = float(row[1] or 0)

        # 8. Edad del �ndice FAISS
        faiss_path = RUTA_MODELOS / "faiss.index"
        if faiss_path.exists():
            faiss_mtime = datetime.fromtimestamp(faiss_path.stat().st_mtime)
            dias_desde_ultimo_faiss = (datetime.now() - faiss_mtime).days
            faiss_timestamp = faiss_mtime.isoformat()
        else:
            dias_desde_ultimo_faiss = 999
            faiss_timestamp = None

        cur.close()
        conn.close()

        # Determinar alertas
        alertas = []

        cobertura_pct = (total_features / total_juegos * 100) if total_juegos > 0 else 0
        if juegos_sin_features > 100:
            alertas.append({
                "nivel": "rojo",
                "mensaje": f"{juegos_sin_features} juegos sin features  recomendaci�n degradada"
            })
        elif juegos_sin_features > 30:
            alertas.append({
                "nivel": "amarillo",
                "mensaje": f"{juegos_sin_features} juegos pendientes de procesar"
            })

        if dias_desde_ultimo_faiss > 30:
            alertas.append({
                "nivel": "rojo",
                "mensaje": f"�ndice FAISS tiene {dias_desde_ultimo_faiss} d�as sin regenerarse"
            })
        elif dias_desde_ultimo_faiss > 7:
            alertas.append({
                "nivel": "amarillo",
                "mensaje": f"�ndice FAISS tiene {dias_desde_ultimo_faiss} d�as sin actualizar"
            })

        if sentimiento_promedio < 0.5:
            alertas.append({
                "nivel": "amarillo",
                "mensaje": "Sentimiento promedio del cat�logo por debajo del 50%"
            })

        if not alertas:
            alertas.append({
                "nivel": "verde",
                "mensaje": "Sistema operando correctamente"
            })

        return {
            "resumen": {
                "total_juegos": total_juegos,
                "total_features": total_features,
                "juegos_sin_features": juegos_sin_features,
                "cobertura_pct": round(cobertura_pct, 1),
                "con_reviews": int(con_reviews),
                "sin_reviews": int(sin_reviews),
                "avg_reviews_por_juego": round(avg_reviews, 1),
                "sentimiento_promedio_catalogo": round(sentimiento_promedio * 100, 1),
                "reviews_promedio_comunidad": round(reviews_promedio_comunidad),
            },
            "faiss": {
                "dias_desde_ultimo_rebuild": dias_desde_ultimo_faiss,
                "ultimo_rebuild": faiss_timestamp,
                "estado": "ok" if dias_desde_ultimo_faiss <= 7 else "desactualizado"
            },
            "top_generos": top_generos,
            "alertas": alertas,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        return {"error": str(e), "timestamp": datetime.now().isoformat()}


# ---------------- SCHEDULER ----------------
scheduler = BackgroundScheduler(timezone="America/Lima")

scheduler.add_job(
    ejecutar_pipeline_completo,
    trigger=CronTrigger(hour=3, minute=0),  # todos los d�as a las 3:00 AM
    id="pipeline_sync",
    name="Pipeline completo Steam",
    replace_existing=True,
    misfire_grace_time=3600  # si se pierde el trigger, tiene 1h para ejecutarse
)

@app.on_event("startup")
async def startup():
    scheduler.start()
    print("[SCHEDULER] Pipeline programado para las 3:00 AM diariamente (Lima)")

@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown()
    print("[SCHEDULER] Scheduler detenido")


# ---------------- ENDPOINTS ----------------
@app.get("/")
def inicio():
    return {
        "ok": True,
        "mensaje": "API del sistema recomendador Steam funcionando",
        "version": "2.0.0"
    }


@app.get("/api/juegos/buscar")
def buscar_juegos(q: str = Query(default="", min_length=0), limite: int = 8):
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
                END, nombre
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
        return {"ok": True, "tipo": "juego", "steam_app_id": data.steam_app_id, "recomendaciones": resultado}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/recomendar/por-texto")
def recomendar_texto(data: RecomendarPorTextoRequest):
    try:
        resultado = recomendar_por_texto(data.consulta)
        return {"ok": True, "tipo": "texto", "consulta": data.consulta, "recomendaciones": resultado}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/sync/estado")
def estado_sync():
    """Estado del �ltimo y pr�ximo pipeline autom�tico."""
    log = leer_log()
    proximos = scheduler.get_jobs()
    proximo_job = proximos[0].next_run_time.isoformat() if proximos else None
    return {**log, "proximo_sync_scheduler": proximo_job}


@app.post("/api/admin/sync/ejecutar")
def ejecutar_sync_manual():
    """Dispara el pipeline manualmente sin esperar las 3am."""
    log = leer_log()
    if log.get("ultimo_resultado") == "corriendo":
        raise HTTPException(status_code=409, detail="Ya hay un pipeline corriendo")

    log["ultimo_resultado"] = "corriendo"
    guardar_log(log)

    # Corre en background para no bloquear la respuesta
    import threading
    thread = threading.Thread(target=ejecutar_pipeline_completo, daemon=True)
    thread.start()

    return {"ok": True, "mensaje": "Pipeline iniciado en background"}


@app.get("/api/admin/drift")
def reporte_drift():
    """
    Reporte de salud del sistema y detecci�n de data drift.
    Incluye cobertura, calidad de features, estado de FAISS y alertas.
    """
    return calcular_metricas_drift()
