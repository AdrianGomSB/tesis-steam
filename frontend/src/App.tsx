import { useState, useEffect, useRef } from "react";

interface Metricas {
  semantica: number;
  vectorial: number;
  jaccard?: number;
  sentimiento: number;
  popularidad: number;
  jaccard_generos?: number;
  jaccard_categorias?: number;
  jaccard_tags?: number;
}

interface Recomendacion {
  app_id: number;
  nombre: string;
  score: number;
  metricas: Metricas;
}

interface JuegoSugerido {
  app_id: number;
  nombre: string;
}

const API_BASE = "http://localhost:8000";

const STATS_POPULARES = [
  { label: "Juegos en cat�logo", value: "2,000+" },
  { label: "Modelos de IA", value: "3" },
  { label: "Reviews analizadas", value: "500K+" },
  { label: "Idiomas soportados", value: "50+" },
];

const COMO_FUNCIONA = [
  {
    icon: "=",
    titulo: "Vectorizaci�n",
    desc: "Cada juego se convierte en un vector de 384 dimensiones usando NLP multiling�e.",
  },
  {
    icon: "�",
    titulo: "B�squeda FAISS",
    desc: "Encontramos los 40 candidatos m�s cercanos en milisegundos con �ndice vectorial.",
  },
  {
    icon: ">�",
    titulo: "Cross-Encoder",
    desc: "Un modelo reordena los candidatos evaluando la relevancia sem�ntica par a par.",
  },
  {
    icon: "<�",
    titulo: "Score h�brido",
    desc: "Combinamos sem�ntica, tags, sentimiento y popularidad en un score final.",
  },
];

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const pct = Math.round(score * 100);
  const r = size / 2 - 7;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct >= 65 ? "#00ff9d" : pct >= 45 ? "#ffe600" : "#ff4d6d";

  return (
    <div
      style={{ position: "relative", width: size, height: size, flexShrink: 0 }}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#ffffff12"
          strokeWidth="5"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{
            transition: "stroke-dasharray 1s ease",
            filter: `drop-shadow(0 0 4px ${color})`,
          }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
        }}
      >
        <span
          style={{
            fontSize: size * 0.2,
            fontWeight: 900,
            color,
            lineHeight: 1,
            fontFamily: "'Rajdhani', sans-serif",
          }}
        >
          {pct}%
        </span>
        <span
          style={{
            fontSize: size * 0.1,
            color: "#ffffff44",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          match
        </span>
      </div>
    </div>
  );
}

function MetricBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: "#ffffff66",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        <span style={{ fontSize: 11, color, fontWeight: 700 }}>
          {(value * 100).toFixed(0)}%
        </span>
      </div>
      <div
        style={{
          height: 3,
          background: "#ffffff0d",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${value * 100}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            borderRadius: 2,
            transition: "width 0.9s ease",
            boxShadow: `0 0 8px ${color}66`,
          }}
        />
      </div>
    </div>
  );
}

function GameCard({ game, index }: { game: Recomendacion; index: number }) {
  const [imgOk, setImgOk] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const imgUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${game.app_id}/header.jpg`;
  const storeUrl = `https://store.steampowered.com/app/${game.app_id}`;

  const rankLabel =
    index === 0
      ? ">G"
      : index === 1
        ? ">H"
        : index === 2
          ? ">I"
          : `#${index + 1}`;
  const pct = Math.round(game.score * 100);
  const scoreColor = pct >= 65 ? "#00ff9d" : pct >= 45 ? "#ffe600" : "#ff4d6d";

  return (
    <div
      style={{
        background: "linear-gradient(145deg, #0f0f1f 0%, #0a0a16 100%)",
        border: "1px solid #ffffff12",
        borderRadius: 16,
        overflow: "hidden",
        transition: "transform 0.25s, border-color 0.25s, box-shadow 0.25s",
        animation: `fadeUp 0.5s ease ${index * 0.08}s both`,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = "translateY(-6px)";
        el.style.borderColor = scoreColor + "66";
        el.style.boxShadow = `0 20px 40px #00000066, 0 0 20px ${scoreColor}22`;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = "translateY(0)";
        el.style.borderColor = "#ffffff12";
        el.style.boxShadow = "none";
      }}
    >
      <div style={{ position: "relative", overflow: "hidden" }}>
        {imgOk ? (
          <img
            src={imgUrl}
            alt={game.nombre}
            onError={() => setImgOk(false)}
            style={{
              width: "100%",
              height: 140,
              objectFit: "cover",
              display: "block",
              transition: "transform 0.4s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.transform = "scale(1.05)")
            }
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          />
        ) : (
          <div
            style={{
              height: 140,
              background: "linear-gradient(135deg, #1a1a3e, #0d0d2e)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
            }}
          >
            <�
          </div>
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, transparent 40%, #0a0a16 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            background: "#00000099",
            backdropFilter: "blur(8px)",
            borderRadius: 8,
            padding: "4px 10px",
            fontSize: 13,
            fontWeight: 800,
            border: "1px solid #ffffff22",
          }}
        >
          {rankLabel}
        </div>
        <div style={{ position: "absolute", top: 8, right: 8 }}>
          <ScoreRing score={game.score} size={72} />
        </div>
      </div>

      <div style={{ padding: "14px 18px 18px" }}>
        <h3
          style={{
            margin: "0 0 4px",
            fontSize: 16,
            fontWeight: 700,
            color: "#fff",
            fontFamily: "'Rajdhani', sans-serif",
            lineHeight: 1.2,
            letterSpacing: 0.5,
          }}
        >
          {game.nombre}
        </h3>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 14,
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: "#ffffff44",
              fontFamily: "monospace",
              letterSpacing: 1,
            }}
          >
            APP {game.app_id}
          </span>
          <span style={{ color: "#ffffff22", fontSize: 10 }}>"</span>
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 11,
              color: "#00b4ff",
              textDecoration: "none",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#66d4ff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#00b4ff")}
          >
            Ver en Steam �
          </a>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            marginBottom: 14,
            background: "#ffffff06",
            borderRadius: 10,
            padding: "10px 12px",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, marginBottom: 2 }}>
              {game.metricas.sentimiento >= 0.8
                ? "="
                : game.metricas.sentimiento >= 0.6
                  ? "=
"
                  : game.metricas.sentimiento >= 0.5
                    ? "="
                    : "="}
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: game.metricas.sentimiento >= 0.7 ? "#00ff9d" : "#ffe600",
              }}
            >
              {(game.metricas.sentimiento * 100).toFixed(0)}%
            </div>
            <div style={{ fontSize: 10, color: "#ffffff44", letterSpacing: 1 }}>
              POSITIVO
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, marginBottom: 2 }}>=�</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#bf5af2" }}>
              {(game.metricas.popularidad * 100).toFixed(0)}%
            </div>
            <div style={{ fontSize: 10, color: "#ffffff44", letterSpacing: 1 }}>
              POPULAR
            </div>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            width: "100%",
            background: "transparent",
            border: "1px solid #ffffff14",
            borderRadius: 8,
            color: "#ffffff55",
            fontSize: 11,
            padding: "7px",
            cursor: "pointer",
            letterSpacing: 2,
            textTransform: "uppercase",
            fontFamily: "'Barlow', sans-serif",
            transition: "all 0.2s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              "#ffe60044";
            (e.currentTarget as HTMLButtonElement).style.color = "#ffe600";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              "#ffffff14";
            (e.currentTarget as HTMLButtonElement).style.color = "#ffffff55";
          }}
        >
          <span>{expanded ? "�" : "�"}</span>
          <span>{expanded ? "Ocultar m�tricas IA" : "Ver m�tricas IA"}</span>
        </button>

        {expanded && (
          <div
            style={{
              marginTop: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              animation: "fadeUp 0.2s ease both",
            }}
          >
            <MetricBar
              label="Sem�ntica"
              value={game.metricas.semantica}
              color="#00ff9d"
            />
            <MetricBar
              label="Vectorial"
              value={game.metricas.vectorial}
              color="#00b4ff"
            />
            {game.metricas.jaccard !== undefined && (
              <MetricBar
                label="Jaccard tags"
                value={game.metricas.jaccard}
                color="#ffe600"
              />
            )}
            {game.metricas.jaccard_generos !== undefined && (
              <MetricBar
                label="G�neros"
                value={game.metricas.jaccard_generos}
                color="#ff9500"
              />
            )}
            {game.metricas.jaccard_categorias !== undefined && (
              <MetricBar
                label="Categor�as"
                value={game.metricas.jaccard_categorias}
                color="#ff6b35"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AutocompleteJuego({
  onSelect,
}: {
  onSelect: (j: JuegoSugerido) => void;
}) {
  const [query, setQuery] = useState("");
  const [sugerencias, setSugerencias] = useState<JuegoSugerido[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [seleccionado, setSeleccionado] = useState<JuegoSugerido | null>(null);
  const [idx, setIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (seleccionado) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setSugerencias([]);
      setAbierto(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/juegos/buscar?q=${encodeURIComponent(query)}`,
        );
        const data = await res.json();
        setSugerencias(data);
        setAbierto(data.length > 0);
        setIdx(-1);
      } catch {
        setSugerencias([]);
      }
    }, 280);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, seleccionado]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      )
        setAbierto(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const elegir = (j: JuegoSugerido) => {
    setQuery(j.nombre);
    setSeleccionado(j);
    setAbierto(false);
    onSelect(j);
  };

  const limpiar = () => {
    setQuery("");
    setSeleccionado(null);
    setSugerencias([]);
    setAbierto(false);
  };

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", flex: 1, zIndex: 300 }}
    >
      <div style={{ position: "relative" }}>
        <input
          className="gg-input"
          type="text"
          placeholder='Busca un juego  (ej: "Counter-Strike", "Dota 2"...)'
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSeleccionado(null);
          }}
          onFocus={() => {
            if (sugerencias.length > 0) setAbierto(true);
          }}
          onKeyDown={(e) => {
            if (!abierto) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIdx((i) => Math.min(i + 1, sugerencias.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIdx((i) => Math.max(i - 1, 0));
            }
            if (e.key === "Enter" && idx >= 0) {
              e.preventDefault();
              elegir(sugerencias[idx]);
            }
            if (e.key === "Escape") setAbierto(false);
          }}
          style={{ width: "100%", paddingRight: seleccionado ? 40 : 18 }}
        />
        {seleccionado && (
          <button
            onClick={limpiar}
            style={{
              position: "absolute",
              right: 14,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              color: "#ffffff44",
              cursor: "pointer",
              fontSize: 20,
              lineHeight: 1,
              padding: 0,
            }}
          >
            �
          </button>
        )}
      </div>

      {abierto && sugerencias.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "#0d0d1f",
            border: "1px solid #ffffff18",
            borderRadius: 10,
            overflow: "hidden",
            zIndex: 400,
            boxShadow: "0 16px 48px #000000cc",
          }}
        >
          {sugerencias.map((j, i) => (
            <div
              key={j.app_id}
              onMouseDown={() => elegir(j)}
              onMouseEnter={() => setIdx(i)}
              style={{
                padding: "11px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                background: i === idx ? "#ffffff0a" : "transparent",
                borderBottom:
                  i < sugerencias.length - 1 ? "1px solid #ffffff08" : "none",
                transition: "background 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <img
                  src={`https://cdn.akamai.steamstatic.com/steam/apps/${j.app_id}/capsule_sm_120.jpg`}
                  alt=""
                  style={{
                    width: 32,
                    height: 15,
                    objectFit: "cover",
                    borderRadius: 3,
                    opacity: 0.8,
                  }}
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
                <span style={{ fontSize: 13, color: "#e0e0e0" }}>
                  {j.nombre}
                </span>
              </div>
              <span
                style={{
                  fontSize: 10,
                  color: "#ffffff33",
                  fontFamily: "monospace",
                }}
              >
                {j.app_id}
              </span>
            </div>
          ))}
        </div>
      )}

      {seleccionado && (
        <div style={{ marginTop: 6 }}>
          <span
            style={{
              fontSize: 11,
              color: "#00ff9d",
              background: "#00ff9d0f",
              border: "1px solid #00ff9d22",
              borderRadius: 4,
              padding: "2px 10px",
              display: "inline-block",
            }}
          >
             App ID {seleccionado.app_id} seleccionado
          </span>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [modo, setModo] = useState<"juego" | "texto">("juego");
  const [juegoSeleccionado, setJuegoSeleccionado] =
    useState<JuegoSugerido | null>(null);
  const [consulta, setConsulta] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<Recomendacion[]>([]);
  const [error, setError] = useState("");

  const buscar = async () => {
    if (modo === "juego" && !juegoSeleccionado) {
      setError("Selecciona un juego de la lista.");
      return;
    }
    if (modo === "texto" && !consulta.trim()) {
      setError("Escribe una descripci�n.");
      return;
    }
    setLoading(true);
    setError("");
    setResultados([]);

    try {
      const body =
        modo === "juego"
          ? { steam_app_id: juegoSeleccionado!.app_id }
          : { consulta: consulta.trim() };
      const endpoint =
        modo === "juego"
          ? `${API_BASE}/api/recomendar/por-juego`
          : `${API_BASE}/api/recomendar/por-texto`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setResultados(data.recomendaciones ?? data);
    } catch {
      setError(
        "No se pudo conectar con la API. �Est� corriendo en localhost:8000?",
      );
    } finally {
      setLoading(false);
    }
  };

  const cambiarModo = (m: "juego" | "texto") => {
    setModo(m);
    setResultados([]);
    setError("");
    setJuegoSeleccionado(null);
    setConsulta("");
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Barlow:ital,wght@0,400;0,500;0,600;1,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: #07071a; color: #e0e0e0; font-family: 'Barlow', sans-serif; min-height: 100vh; overflow-x: hidden; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes gradientShift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        @keyframes float { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-12px) rotate(3deg); } }
        @keyframes scanPulse { 0%,100% { opacity: 0.3; } 50% { opacity: 0.9; } }
        .gg-input {
          width: 100%; background: #0d0d22; border: 1px solid #ffffff18; color: #fff;
          padding: 15px 18px; font-family: 'Barlow', sans-serif; font-size: 15px;
          border-radius: 10px; outline: none; transition: border-color 0.2s, box-shadow 0.2s;
        }
        .gg-input:focus { border-color: #ffe600aa; box-shadow: 0 0 0 3px #ffe60012; }
        .gg-input::placeholder { color: #ffffff33; }
        .btn-mode {
          padding: 9px 22px; border-radius: 8px; border: 1px solid #ffffff14;
          background: transparent; color: #ffffff55; font-family: 'Barlow', sans-serif;
          font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s;
          letter-spacing: 1px; text-transform: uppercase;
        }
        .btn-mode:hover { border-color: #ffe60055; color: #ffe600; }
        .btn-mode.active { background: #ffe600; border-color: #ffe600; color: #000; font-weight: 700; }
        .btn-buscar {
          background: linear-gradient(135deg, #ffe600, #ffaa00); border: none; color: #000;
          font-family: 'Rajdhani', sans-serif; font-size: 16px; font-weight: 700;
          padding: 15px 32px; border-radius: 10px; cursor: pointer; letter-spacing: 2px;
          text-transform: uppercase; transition: all 0.2s; white-space: nowrap;
          box-shadow: 0 4px 20px #ffe60033;
        }
        .btn-buscar:hover { transform: translateY(-2px); box-shadow: 0 8px 28px #ffe60055; }
        .btn-buscar:active { transform: translateY(0); }
        .btn-buscar:disabled { background: #1e1e3a; color: #ffffff33; cursor: not-allowed; transform: none; box-shadow: none; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 22px; }
        .stat-card { background: #0d0d22; border: 1px solid #ffffff0a; border-radius: 12px; padding: 20px 24px; text-align: center; transition: border-color 0.2s, transform 0.2s; }
        .stat-card:hover { border-color: #ffe60033; transform: translateY(-3px); }
        .how-card { background: #0d0d22; border: 1px solid #ffffff0a; border-radius: 12px; padding: 22px; transition: border-color 0.2s, transform 0.2s; }
        .how-card:hover { border-color: #00ff9d33; transform: translateY(-3px); }
      `}</style>

      {/* Fondo */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 600,
            height: 600,
            borderRadius: "50%",
            left: "-200px",
            top: "-200px",
            background:
              "radial-gradient(circle, #ffe60008 0%, transparent 70%)",
            animation: "float 8s ease-in-out infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 500,
            height: 500,
            borderRadius: "50%",
            right: "-150px",
            bottom: "20%",
            background:
              "radial-gradient(circle, #00ff9d06 0%, transparent 70%)",
            animation: "float 10s ease-in-out 2s infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 400,
            height: 400,
            borderRadius: "50%",
            left: "40%",
            bottom: "-100px",
            background:
              "radial-gradient(circle, #bf5af208 0%, transparent 70%)",
            animation: "float 7s ease-in-out 4s infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(#ffffff03 1px, transparent 1px), linear-gradient(90deg, #ffffff03 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Barra top */}
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

      {/* Navbar */}
      <nav
        style={{
          position: "fixed",
          top: 3,
          left: 0,
          right: 0,
          zIndex: 99,
          background: "#07071aee",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #ffffff08",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 32px",
        }}
      >
        <div
          style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: 20,
            fontWeight: 700,
            color: "#fff",
            letterSpacing: -0.5,
          }}
        >
          GG<span style={{ color: "#ffe600" }}>.</span>
        </div>
        <a
          href="/admin"
          style={{
            fontSize: 12,
            color: "#ffffff44",
            letterSpacing: 2,
            textTransform: "uppercase",
            textDecoration: "none",
            border: "1px solid #ffffff14",
            borderRadius: 6,
            padding: "5px 14px",
            transition: "all 0.2s",
            fontFamily: "'Barlow', sans-serif",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.borderColor =
              "#ffe60044";
            (e.currentTarget as HTMLAnchorElement).style.color = "#ffe600";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.borderColor =
              "#ffffff14";
            (e.currentTarget as HTMLAnchorElement).style.color = "#ffffff44";
          }}
        >
          Panel Admin
        </a>
      </nav>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1140,
          margin: "0 auto",
          padding: "0 24px 80px",
        }}
      >
        {/* Hero */}
        <header
          style={{
            textAlign: "center",
            padding: "120px 0 64px",
            animation: "fadeUp 0.6s ease both",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#ffe60012",
              border: "1px solid #ffe60033",
              borderRadius: 100,
              padding: "5px 16px",
              marginBottom: 24,
              fontSize: 12,
              color: "#ffe600",
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#ffe600",
                display: "inline-block",
                animation: "scanPulse 2s ease infinite",
              }}
            />
            Sistema de Recomendaci�n � NLP + IA
          </div>

          <h1
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: "clamp(56px, 10vw, 96px)",
              fontWeight: 700,
              lineHeight: 0.9,
              letterSpacing: -2,
              marginBottom: 16,
              color: "#fff",
            }}
          >
            GG<span style={{ color: "#ffe600" }}>.</span>
            <span style={{ color: "#ffffff" }}>RECOMENDADOR</span>
          </h1>

          <p
            style={{
              color: "#ffffff55",
              fontSize: 17,
              maxWidth: 480,
              margin: "0 auto",
              lineHeight: 1.6,
            }}
          >
            Descubre tu pr�ximo juego favorito con inteligencia artificial y
            procesamiento de lenguaje natural
          </p>
        </header>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 14,
            marginBottom: 48,
            animation: "fadeUp 0.6s ease 0.1s both",
          }}
        >
          {STATS_POPULARES.map((s, i) => (
            <div key={i} className="stat-card">
              <div
                style={{
                  fontFamily: "'Rajdhani', sans-serif",
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#ffe600",
                  lineHeight: 1,
                }}
              >
                {s.value}
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
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Search box */}
        <div
          style={{
            background: "linear-gradient(145deg, #0d0d22, #0a0a1a)",
            border: "1px solid #ffffff0e",
            borderRadius: 18,
            padding: "32px",
            marginBottom: 48,
            boxShadow: "0 24px 64px #00000055",
            animation: "fadeUp 0.6s ease 0.2s both",
            position: "relative",
            zIndex: 50,
          }}
        >
          <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
            <button
              className={`btn-mode ${modo === "juego" ? "active" : ""}`}
              onClick={() => cambiarModo("juego")}
            >
              <� Por Nombre
            </button>
            <button
              className={`btn-mode ${modo === "texto" ? "active" : ""}`}
              onClick={() => cambiarModo("texto")}
            >
              =� Por Descripci�n
            </button>
          </div>

          <div
            style={{
              marginBottom: 8,
              fontSize: 12,
              color: "#ffffff33",
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            {modo === "juego"
              ? "Busca un juego de tu biblioteca de Steam"
              : "Describe el tipo de juego que buscas"}
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            {modo === "juego" ? (
              <AutocompleteJuego onSelect={setJuegoSeleccionado} />
            ) : (
              <input
                className="gg-input"
                type="text"
                placeholder='Ej: "shooter t�ctico multijugador competitivo", "RPG de fantas�a con magia"...'
                value={consulta}
                onChange={(e) => setConsulta(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && buscar()}
                style={{ flex: 1 }}
              />
            )}
            <button className="btn-buscar" onClick={buscar} disabled={loading}>
              {loading ? "� Analizando..." : "BUSCAR �"}
            </button>
          </div>

          {error && (
            <div
              style={{
                marginTop: 14,
                fontSize: 13,
                color: "#ff4d6d",
                background: "#ff4d6d0a",
                border: "1px solid #ff4d6d22",
                borderRadius: 8,
                padding: "10px 14px",
              }}
            >
              � {error}
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div
              style={{
                display: "inline-flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 20,
              }}
            >
              <div style={{ position: "relative", width: 56, height: 56 }}>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    border: "3px solid #ffffff08",
                    borderTop: "3px solid #ffe600",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 8,
                    border: "2px solid #ffffff05",
                    borderTop: "2px solid #00ff9d",
                    borderRadius: "50%",
                    animation: "spin 1.2s linear reverse infinite",
                  }}
                />
              </div>
              <div>
                <p
                  style={{
                    color: "#ffe600",
                    letterSpacing: 3,
                    fontSize: 12,
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  Procesando vectores
                </p>
                <p style={{ color: "#ffffff33", fontSize: 11 }}>
                  Consultando modelos de IA...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Resultados */}
        {!loading && resultados.length > 0 && (
          <div style={{ animation: "fadeUp 0.4s ease both" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginBottom: 28,
              }}
            >
              <div
                style={{
                  height: 1,
                  flex: 1,
                  background: "linear-gradient(90deg, transparent, #ffffff14)",
                }}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#ffe60012",
                  border: "1px solid #ffe60022",
                  borderRadius: 100,
                  padding: "6px 18px",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#00ff9d",
                    display: "inline-block",
                    animation: "scanPulse 1.5s ease infinite",
                  }}
                />
                <span
                  style={{
                    fontFamily: "'Rajdhani', sans-serif",
                    fontSize: 13,
                    color: "#ffe600",
                    letterSpacing: 3,
                    textTransform: "uppercase",
                  }}
                >
                  {resultados.length} recomendaciones encontradas
                </span>
              </div>
              <div
                style={{
                  height: 1,
                  flex: 1,
                  background: "linear-gradient(90deg, #ffffff14, transparent)",
                }}
              />
            </div>
            <div className="grid">
              {resultados.map((juego, i) => (
                <GameCard key={juego.app_id} game={juego} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && resultados.length === 0 && !error && (
          <div style={{ animation: "fadeUp 0.6s ease 0.3s both" }}>
            <div style={{ marginBottom: 48 }}>
              <h2
                style={{
                  fontFamily: "'Rajdhani', sans-serif",
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#fff",
                  textAlign: "center",
                  marginBottom: 8,
                  letterSpacing: 1,
                }}
              >
                �C�mo funciona?
              </h2>
              <p
                style={{
                  textAlign: "center",
                  color: "#ffffff33",
                  fontSize: 14,
                  marginBottom: 28,
                }}
              >
                Pipeline de recomendaci�n h�brida con 3 modelos de IA
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                  gap: 16,
                }}
              >
                {COMO_FUNCIONA.map((c, i) => (
                  <div key={i} className="how-card">
                    <div style={{ fontSize: 28, marginBottom: 10 }}>
                      {c.icon}
                    </div>
                    <h3
                      style={{
                        fontFamily: "'Rajdhani', sans-serif",
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#00ff9d",
                        marginBottom: 6,
                        letterSpacing: 1,
                      }}
                    >
                      {c.titulo}
                    </h3>
                    <p
                      style={{
                        fontSize: 13,
                        color: "#ffffff55",
                        lineHeight: 1.6,
                      }}
                    >
                      {c.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div
              style={{
                textAlign: "center",
                padding: "40px",
                background: "#0d0d22",
                border: "1px dashed #ffffff14",
                borderRadius: 16,
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}><�</div>
              <p
                style={{
                  fontFamily: "'Rajdhani', sans-serif",
                  fontSize: 20,
                  color: "#ffffff44",
                  letterSpacing: 2,
                  textTransform: "uppercase",
                }}
              >
                Busca un juego o describe lo que quieres jugar
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
