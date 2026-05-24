import { useState, useEffect } from "react";

const API_BASE = "http://localhost:8000";

interface Alerta {
  nivel: "verde" | "amarillo" | "rojo";
  mensaje: string;
}

interface DriftData {
  resumen: {
    total_juegos: number;
    total_features: number;
    juegos_sin_features: number;
    cobertura_pct: number;
    con_reviews: number;
    sin_reviews: number;
    avg_reviews_por_juego: number;
    sentimiento_promedio_catalogo: number;
    reviews_promedio_comunidad: number;
  };
  faiss: {
    dias_desde_ultimo_rebuild: number;
    ultimo_rebuild: string | null;
    estado: string;
  };
  top_generos: { genero: string; cantidad: number }[];
  alertas: Alerta[];
  timestamp: string;
}

interface SyncLog {
  ultimo_sync: string | null;
  proximo_sync: string | null;
  proximo_sync_scheduler: string | null;
  ultimo_resultado: string | null;
  errores: { paso: string; error: string; timestamp: string }[];
  pasos_completados: string[];
  juegos_nuevos_agregados: number;
  duracion_segundos: number;
}

function formatFecha(iso: string | null): string {
  if (!iso) return "Nunca";
  return new Date(iso).toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function colorAlerta(nivel: string) {
  if (nivel === "verde")
    return { bg: "#00ff9d0f", border: "#00ff9d33", text: "#00ff9d", icon: "✓" };
  if (nivel === "amarillo")
    return { bg: "#ffe6000f", border: "#ffe60033", text: "#ffe600", icon: "⚠" };
  return { bg: "#ff4d6d0f", border: "#ff4d6d33", text: "#ff4d6d", icon: "✕" };
}

function StatCard({
  label,
  value,
  sub,
  color = "#fff",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        background: "#0d0d22",
        border: "1px solid #ffffff0a",
        borderRadius: 12,
        padding: "18px 20px",
        transition: "border-color 0.2s, transform 0.2s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = color + "44";
        (e.currentTarget as HTMLDivElement).style.transform =
          "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "#ffffff0a";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
      }}
    >
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          color,
          fontFamily: "'Rajdhani', sans-serif",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#ffffff44",
          marginTop: 4,
          letterSpacing: 1,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "#ffffff33", marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function ProgressBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div
      style={{
        height: 6,
        background: "#ffffff0a",
        borderRadius: 3,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: color,
          borderRadius: 3,
          transition: "width 0.8s ease",
          boxShadow: `0 0 8px ${color}66`,
        }}
      />
    </div>
  );
}

export default function AdminDashboard() {
  const [drift, setDrift] = useState<DriftData | null>(null);
  const [sync, setSync] = useState<SyncLog | null>(null);
  const [loadingDrift, setLoadingDrift] = useState(true);
  const [loadingSync, setLoadingSync] = useState(true);
  const [ejecutando, setEjecutando] = useState(false);
  const [tab, setTab] = useState<"drift" | "sync">("drift");

  const cargarDrift = async () => {
    setLoadingDrift(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/drift`);
      setDrift(await res.json());
    } catch {}
    setLoadingDrift(false);
  };

  const cargarSync = async () => {
    setLoadingSync(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/sync/estado`);
      setSync(await res.json());
    } catch {}
    setLoadingSync(false);
  };

  const ejecutarSync = async () => {
    setEjecutando(true);
    try {
      await fetch(`${API_BASE}/api/admin/sync/ejecutar`, { method: "POST" });
      setTimeout(() => {
        cargarSync();
        setEjecutando(false);
      }, 2000);
    } catch {
      setEjecutando(false);
    }
  };

  useEffect(() => {
    cargarDrift();
    cargarSync();
    const interval = setInterval(() => {
      cargarDrift();
      cargarSync();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Barlow:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07071a; color: #e0e0e0; font-family: 'Barlow', sans-serif; min-height: 100vh; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes gradientShift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        .tab-btn {
          padding: 9px 22px; border-radius: 8px; border: 1px solid #ffffff14;
          background: transparent; color: #ffffff55;
          font-family: 'Barlow', sans-serif; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: all 0.2s; letter-spacing: 1px; text-transform: uppercase;
        }
        .tab-btn:hover { border-color: #ffe60055; color: #ffe600; }
        .tab-btn.active { background: #ffe600; border-color: #ffe600; color: #000; font-weight: 700; }
        .card {
          background: linear-gradient(145deg, #0f0f22, #0a0a1a);
          border: 1px solid #ffffff0a; border-radius: 14px; padding: 24px;
          animation: fadeUp 0.4s ease both;
        }
        .section-title {
          font-family: 'Rajdhani', sans-serif; font-size: 15px; font-weight: 700;
          color: #ffffff66; letter-spacing: 2px; text-transform: uppercase;
          margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid #ffffff08;
        }
      `}</style>

      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          zIndex: 100,
          background:
            "linear-gradient(90deg, #ffe600, #00ff9d, #00b4ff, #bf5af2, #ff4d6d, #ffe600)",
          backgroundSize: "200% 100%",
          animation: "gradientShift 4s ease infinite",
        }}
      />

      <div
        style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 80px" }}
      >
        {/* Header */}
        <div style={{ marginBottom: 36, animation: "fadeUp 0.4s ease both" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "#ffffff33",
                    letterSpacing: 2,
                    textTransform: "uppercase",
                  }}
                >
                  GG.RECOMENDADOR
                </span>
                <span style={{ color: "#ffffff14" }}>›</span>
                <span
                  style={{
                    fontSize: 11,
                    color: "#ffe600",
                    letterSpacing: 2,
                    textTransform: "uppercase",
                  }}
                >
                  Admin
                </span>
              </div>
              <h1
                style={{
                  fontFamily: "'Rajdhani', sans-serif",
                  fontSize: 36,
                  fontWeight: 700,
                  color: "#fff",
                }}
              >
                Panel de Control
              </h1>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => {
                  cargarDrift();
                  cargarSync();
                }}
                style={{
                  background: "#ffffff08",
                  border: "1px solid #ffffff14",
                  color: "#ffffff66",
                  padding: "8px 16px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "'Barlow', sans-serif",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                ↻ Actualizar
              </button>
              <button
                onClick={ejecutarSync}
                disabled={ejecutando}
                style={{
                  background: ejecutando
                    ? "#333"
                    : "linear-gradient(135deg, #ffe600, #ffaa00)",
                  border: "none",
                  color: ejecutando ? "#666" : "#000",
                  padding: "9px 20px",
                  borderRadius: 8,
                  cursor: ejecutando ? "not-allowed" : "pointer",
                  fontSize: 13,
                  fontFamily: "'Rajdhani', sans-serif",
                  fontWeight: 700,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                }}
              >
                {ejecutando ? "⏳ Ejecutando..." : "▶ Sync Manual"}
              </button>
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: "#ffffff22" }}>
            <span
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#00ff9d",
                marginRight: 6,
                animation: "pulse 2s ease infinite",
              }}
            />
            Actualización automática cada 30 segundos
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
          <button
            className={`tab-btn ${tab === "drift" ? "active" : ""}`}
            onClick={() => setTab("drift")}
          >
            📊 Salud del Sistema
          </button>
          <button
            className={`tab-btn ${tab === "sync" ? "active" : ""}`}
            onClick={() => setTab("sync")}
          >
            🔄 Estado del Pipeline
          </button>
        </div>

        {/* ===== TAB DRIFT ===== */}
        {tab === "drift" && (
          <div style={{ animation: "fadeUp 0.3s ease both" }}>
            {loadingDrift ? (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    border: "3px solid #ffffff08",
                    borderTop: "3px solid #ffe600",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                    margin: "0 auto 12px",
                  }}
                />
                <p
                  style={{ color: "#ffffff33", fontSize: 12, letterSpacing: 2 }}
                >
                  CARGANDO MÉTRICAS...
                </p>
              </div>
            ) : drift ? (
              <>
                {/* Alertas */}
                <div style={{ marginBottom: 24 }}>
                  {drift.alertas.map((a, i) => {
                    const c = colorAlerta(a.nivel);
                    return (
                      <div
                        key={i}
                        style={{
                          background: c.bg,
                          border: `1px solid ${c.border}`,
                          borderRadius: 10,
                          padding: "12px 16px",
                          marginBottom: 8,
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 16,
                            color: c.text,
                            fontWeight: 700,
                          }}
                        >
                          {c.icon}
                        </span>
                        <span style={{ fontSize: 13, color: c.text }}>
                          {a.mensaje}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Stats */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(180px, 1fr))",
                    gap: 14,
                    marginBottom: 24,
                  }}
                >
                  <StatCard
                    label="Total juegos"
                    value={drift.resumen.total_juegos.toLocaleString()}
                    color="#00b4ff"
                  />
                  <StatCard
                    label="Con features"
                    value={drift.resumen.total_features.toLocaleString()}
                    color="#00ff9d"
                  />
                  <StatCard
                    label="Sin features"
                    value={drift.resumen.juegos_sin_features}
                    color={
                      drift.resumen.juegos_sin_features > 100
                        ? "#ff4d6d"
                        : "#ffe600"
                    }
                  />
                  <StatCard
                    label="Cobertura"
                    value={`${drift.resumen.cobertura_pct}%`}
                    color="#00ff9d"
                  />
                  <StatCard
                    label="Sentimiento"
                    value={`${drift.resumen.sentimiento_promedio_catalogo}%`}
                    color="#bf5af2"
                    sub="promedio catálogo"
                  />
                  <StatCard
                    label="Reviews / juego"
                    value={drift.resumen.avg_reviews_por_juego.toFixed(1)}
                    color="#ff9500"
                    sub="promedio en DB"
                  />
                </div>

                {/* Cobertura + FAISS */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 20,
                    marginBottom: 20,
                  }}
                >
                  <div className="card">
                    <div className="section-title">Cobertura de Features</div>
                    <div style={{ marginBottom: 12 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 6,
                        }}
                      >
                        <span style={{ fontSize: 13, color: "#ffffff66" }}>
                          Con features
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            color: "#00ff9d",
                            fontWeight: 700,
                          }}
                        >
                          {drift.resumen.total_features}
                        </span>
                      </div>
                      <ProgressBar
                        value={drift.resumen.total_features}
                        max={drift.resumen.total_juegos}
                        color="#00ff9d"
                      />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 6,
                        }}
                      >
                        <span style={{ fontSize: 13, color: "#ffffff66" }}>
                          Con reviews útiles
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            color: "#00b4ff",
                            fontWeight: 700,
                          }}
                        >
                          {drift.resumen.con_reviews}
                        </span>
                      </div>
                      <ProgressBar
                        value={drift.resumen.con_reviews}
                        max={drift.resumen.total_features}
                        color="#00b4ff"
                      />
                    </div>
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 6,
                        }}
                      >
                        <span style={{ fontSize: 13, color: "#ffffff66" }}>
                          Sin reviews
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            color: "#ffe600",
                            fontWeight: 700,
                          }}
                        >
                          {drift.resumen.sin_reviews}
                        </span>
                      </div>
                      <ProgressBar
                        value={drift.resumen.sin_reviews}
                        max={drift.resumen.total_features}
                        color="#ffe600"
                      />
                    </div>
                  </div>

                  <div className="card">
                    <div className="section-title">Estado del Índice FAISS</div>
                    <div style={{ textAlign: "center", padding: "10px 0" }}>
                      <div
                        style={{
                          fontSize: 48,
                          fontWeight: 700,
                          fontFamily: "'Rajdhani', sans-serif",
                          color:
                            drift.faiss.dias_desde_ultimo_rebuild > 30
                              ? "#ff4d6d"
                              : drift.faiss.dias_desde_ultimo_rebuild > 7
                                ? "#ffe600"
                                : "#00ff9d",
                        }}
                      >
                        {drift.faiss.dias_desde_ultimo_rebuild === 999
                          ? "∞"
                          : drift.faiss.dias_desde_ultimo_rebuild}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#ffffff44",
                          letterSpacing: 1,
                          textTransform: "uppercase",
                          marginBottom: 12,
                        }}
                      >
                        días desde último rebuild
                      </div>
                      <div
                        style={{
                          display: "inline-block",
                          background:
                            drift.faiss.estado === "ok"
                              ? "#00ff9d0f"
                              : "#ff4d6d0f",
                          border: `1px solid ${drift.faiss.estado === "ok" ? "#00ff9d33" : "#ff4d6d33"}`,
                          borderRadius: 6,
                          padding: "4px 12px",
                          fontSize: 12,
                          color:
                            drift.faiss.estado === "ok" ? "#00ff9d" : "#ff4d6d",
                          letterSpacing: 1,
                          textTransform: "uppercase",
                        }}
                      >
                        {drift.faiss.estado === "ok"
                          ? "✓ Actualizado"
                          : "⚠ Desactualizado"}
                      </div>
                      {drift.faiss.ultimo_rebuild && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "#ffffff33",
                            marginTop: 10,
                          }}
                        >
                          Último: {formatFecha(drift.faiss.ultimo_rebuild)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Top géneros */}
                <div className="card">
                  <div className="section-title">
                    Distribución de Géneros en el Catálogo
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {drift.top_generos.slice(0, 6).map((g, i) => {
                      const max = drift.top_generos[0]?.cantidad || 1;
                      const colors = [
                        "#00ff9d",
                        "#00b4ff",
                        "#ffe600",
                        "#bf5af2",
                        "#ff9500",
                        "#ff4d6d",
                      ];
                      return (
                        <div key={i}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: 4,
                            }}
                          >
                            <span style={{ fontSize: 13, color: "#ffffff88" }}>
                              {g.genero || "Sin género"}
                            </span>
                            <span
                              style={{
                                fontSize: 13,
                                color: colors[i],
                                fontWeight: 700,
                              }}
                            >
                              {g.cantidad}
                            </span>
                          </div>
                          <ProgressBar
                            value={g.cantidad}
                            max={max}
                            color={colors[i]}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 12,
                    fontSize: 11,
                    color: "#ffffff22",
                    textAlign: "right",
                  }}
                >
                  Última actualización: {formatFecha(drift.timestamp)}
                </div>
              </>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 0",
                  color: "#ff4d6d",
                }}
              >
                No se pudo conectar con la API
              </div>
            )}
          </div>
        )}

        {/* ===== TAB SYNC ===== */}
        {tab === "sync" && (
          <div style={{ animation: "fadeUp 0.3s ease both" }}>
            {loadingSync ? (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    border: "3px solid #ffffff08",
                    borderTop: "3px solid #ffe600",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                    margin: "0 auto",
                  }}
                />
              </div>
            ) : sync ? (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: 14,
                    marginBottom: 24,
                  }}
                >
                  <StatCard
                    label="Último sync"
                    value={
                      sync.ultimo_sync ? formatFecha(sync.ultimo_sync) : "Nunca"
                    }
                    color="#00b4ff"
                  />
                  <StatCard
                    label="Próximo sync"
                    value={
                      sync.proximo_sync_scheduler
                        ? formatFecha(sync.proximo_sync_scheduler)
                        : "3:00 AM"
                    }
                    color="#ffe600"
                    sub="automático diario"
                  />
                  <StatCard
                    label="Juegos nuevos"
                    value={sync.juegos_nuevos_agregados}
                    color="#00ff9d"
                    sub="último sync"
                  />
                  <StatCard
                    label="Duración"
                    value={
                      sync.duracion_segundos
                        ? `${Math.floor(sync.duracion_segundos / 60)}m ${sync.duracion_segundos % 60}s`
                        : "—"
                    }
                    color="#bf5af2"
                    sub="último pipeline"
                  />
                </div>

                <div className="card" style={{ marginBottom: 20 }}>
                  <div className="section-title">
                    Estado del último pipeline
                  </div>

                  {sync.ultimo_resultado === "corriendo" && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 0",
                      }}
                    >
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          border: "2px solid #ffffff14",
                          borderTop: "2px solid #ffe600",
                          borderRadius: "50%",
                          animation: "spin 0.8s linear infinite",
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ color: "#ffe600", fontSize: 14 }}>
                        Pipeline ejecutándose...
                      </span>
                    </div>
                  )}

                  {sync.pasos_completados.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#ffffff33",
                          letterSpacing: 1,
                          textTransform: "uppercase",
                          marginBottom: 10,
                        }}
                      >
                        Pasos completados
                      </div>
                      {sync.pasos_completados.map((paso, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "8px 12px",
                            background: "#00ff9d08",
                            border: "1px solid #00ff9d14",
                            borderRadius: 8,
                            marginBottom: 6,
                          }}
                        >
                          <span style={{ color: "#00ff9d" }}>✓</span>
                          <span style={{ fontSize: 13, color: "#ffffff88" }}>
                            {paso}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {sync.errores.length > 0 && (
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#ffffff33",
                          letterSpacing: 1,
                          textTransform: "uppercase",
                          marginBottom: 10,
                        }}
                      >
                        Errores detectados
                      </div>
                      {sync.errores.map((e, i) => (
                        <div
                          key={i}
                          style={{
                            padding: "10px 14px",
                            background: "#ff4d6d08",
                            border: "1px solid #ff4d6d22",
                            borderRadius: 8,
                            marginBottom: 8,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 13,
                              color: "#ff4d6d",
                              fontWeight: 600,
                              marginBottom: 4,
                            }}
                          >
                            {e.paso}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "#ffffff44",
                              fontFamily: "monospace",
                              wordBreak: "break-all",
                            }}
                          >
                            {e.error}
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: "#ffffff22",
                              marginTop: 4,
                            }}
                          >
                            {formatFecha(e.timestamp)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!sync.ultimo_resultado && (
                    <p style={{ color: "#ffffff33", fontSize: 13 }}>
                      No se ha ejecutado ningún pipeline todavía. El primero
                      correrá automáticamente a las 3:00 AM.
                    </p>
                  )}
                </div>

                <div
                  style={{
                    background: "#ffe6000a",
                    border: "1px solid #ffe60022",
                    borderRadius: 12,
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  <span style={{ fontSize: 20 }}>🕐</span>
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#ffe600",
                        fontWeight: 600,
                        marginBottom: 4,
                      }}
                    >
                      Pipeline automático programado
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#ffffff55",
                        lineHeight: 1.6,
                      }}
                    >
                      El pipeline corre todos los días a las{" "}
                      <strong style={{ color: "#ffe600" }}>
                        3:00 AM (hora Lima)
                      </strong>{" "}
                      mientras la API esté activa. Descarga nuevos juegos,
                      procesa reviews, regenera features y actualiza el índice
                      FAISS automáticamente.
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 0",
                  color: "#ff4d6d",
                }}
              >
                No se pudo conectar con la API
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
