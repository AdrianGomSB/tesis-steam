import type { Recomendacion } from "../types";

interface Props {
  game: Recomendacion;
}

export const GameCard = ({ game }: Props) => {
  return (
    <div className="bg-steam-gray/20 p-5 rounded-xl border border-steam-blue/10 hover:border-steam-blue/50 transition-all group shadow-lg">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-bold text-white group-hover:text-steam-blue transition-colors">
          {game.nombre}
        </h3>
        <span className="bg-steam-blue/10 text-steam-blue text-[10px] font-mono px-2 py-1 rounded border border-steam-blue/20">
          ID: {game.app_id}
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Match de IA:</span>
          <span className="text-green-400 font-bold">
            {(game.score * 100).toFixed(1)}%
          </span>
        </div>

        <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-steam-blue to-blue-400 h-full transition-all duration-700"
            style={{ width: `${game.score * 100}%` }}
          />
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-gray-800 flex gap-2 flex-wrap">
        <span className="text-[9px] uppercase font-bold tracking-widest bg-gray-900 text-gray-500 px-2 py-1 rounded">
          Semántica: {game.metricas.semantica.toFixed(2)}
        </span>
      </div>
    </div>
  );
};
