import { useState } from "react";
import type { Recomendacion } from "./types";
import { GameCard } from "./components/GameCard";

function App() {
  const [appId, setAppId] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<Recomendacion[]>([]);

  const fetchIA = async () => {
    if (!appId) return;
    setLoading(true);
    try {
      // Conexión con tu API de Tesis
      const response = await fetch(
        `http://localhost:3000/api/recomendaciones/${appId}`,
      );
      const data = await response.json();
      setResultados(data);
    } catch (error) {
      console.error("Error en la conexión con el servidor:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-12">
      <header className="max-w-4xl mx-auto text-center mb-16">
        <h1 className="text-5xl font-black text-white mb-4 tracking-tight">
          Steam <span className="text-steam-blue">AI</span> Explorer
        </h1>
        <p className="text-gray-500 text-lg font-medium">
          Sistema de Recomendación basado en Grafos y NLP
        </p>
      </header>

      <div className="max-w-xl mx-auto mb-16 flex gap-3">
        <input
          type="text"
          placeholder="AppID de Steam (ej. 400)"
          className="flex-1 bg-steam-gray/30 border border-gray-800 px-5 py-3 rounded-xl focus:outline-none focus:border-steam-blue text-white transition-all shadow-inner"
          value={appId}
          onChange={(e) => setAppId(e.target.value)}
        />
        <button
          onClick={fetchIA}
          disabled={loading}
          className="bg-steam-blue hover:bg-blue-400 text-steam-dark font-black px-8 py-3 rounded-xl transition-all active:scale-95 disabled:opacity-50"
        >
          {loading ? "Analizando..." : "Consultar"}
        </button>
      </div>

      <main className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {resultados.map((juego) => (
          <GameCard key={juego.app_id} game={juego} />
        ))}
      </main>

      {resultados.length === 0 && !loading && (
        <div className="text-center py-20 opacity-20">
          <p className="text-2xl font-bold">Esperando consulta de AppID...</p>
        </div>
      )}
    </div>
  );
}

export default App;
