
import React from 'react';
import { WordCard } from '../types.ts';

interface CardProps {
  card: WordCard;
  onClick: () => void;
  isSelected?: boolean;
  stacked?: boolean;
  targetCount?: number;
  currentCount?: number;
}

const Card: React.FC<CardProps> = ({ card, onClick, isSelected, stacked, targetCount, currentCount }) => {
  const isFaceUp = card.isFaceUp;
  const color = card.color || 'bg-slate-700';
  const isMaster = card.isMaster;

  return (
    <div 
      onClick={onClick}
      className={`
        relative w-24 h-36 md:w-28 md:h-40 cursor-pointer 
        transition-all duration-300 transform perspective-1000
        ${isSelected ? '-translate-y-4 scale-105 z-50' : ''}
        ${stacked ? '-mt-28 md:-mt-32' : ''}
      `}
    >
      <div className={`
        card-flip-inner relative w-full h-full rounded-xl shadow-xl
        ${isFaceUp ? '' : 'card-flip-flipped'}
      `}>
        {/* Front Face */}
        <div className={`
          card-face absolute inset-0 w-full h-full rounded-xl border-2
          ${isMaster 
            ? 'bg-slate-900 border-slate-700 shadow-[0_0_20px_rgba(0,0,0,0.5)]' 
            : 'bg-white border-slate-200 shadow-sm'}
          flex flex-col items-center justify-center p-2
          ${isSelected ? '!border-indigo-500 ring-2 ring-indigo-500/50' : ''}
        `}>
          <div className={`w-full h-full rounded-lg flex flex-col items-center justify-center relative overflow-hidden ${isMaster ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
            
            {isMaster ? (
              <>
                {/* Master Card Visuals */}
                <div className={`w-10 h-10 rounded-full ${color} mb-3 flex items-center justify-center shadow-lg relative z-10 border-2 border-white/20`}>
                  <div className="w-3 h-3 bg-white rounded-full animate-pulse shadow-[0_0_8px_white]"></div>
                </div>
                
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white text-center px-1 relative z-10 leading-tight">
                  {card.word}
                </span>
                
                {targetCount !== undefined && (
                  <div className="mt-3 flex flex-col items-center gap-1 z-10 w-full px-2">
                    <div className="px-2 py-0.5 bg-slate-950/80 rounded-full border border-slate-700 text-[10px] font-black text-indigo-400 whitespace-nowrap">
                      {currentCount ?? 0} <span className="text-slate-600 mx-0.5">/</span> {targetCount}
                    </div>
                    <div className="w-full max-w-[50px] h-1 bg-slate-950 rounded-full overflow-hidden border border-slate-800 mt-1">
                       <div 
                         className={`h-full ${color} transition-all duration-700`}
                         style={{ width: `${((currentCount ?? 0) / (targetCount ?? 1)) * 100}%` }}
                       />
                    </div>
                  </div>
                )}

                {/* Subtle colored glow background for Master only */}
                <div className={`absolute inset-0 ${color} opacity-5 blur-2xl`}></div>
              </>
            ) : (
              <>
                {/* Regular Word Card - Absolutely No Color Indicators */}
                <span className="text-sm font-bold text-slate-800 text-center px-2 break-words leading-tight tracking-tight">
                  {card.word}
                </span>
              </>
            )}
          </div>
          
          {/* Corner decoration - neutral for word cards */}
          {!isMaster && (
            <div className="absolute top-1.5 right-1.5 opacity-5">
               <div className={`w-3 h-3 border-t border-r border-slate-900`}></div>
            </div>
          )}
        </div>

        {/* Back Face */}
        <div className="card-face card-back absolute inset-0 w-full h-full rounded-xl bg-indigo-700 border-4 border-indigo-300 shadow-inner overflow-hidden">
          <div className="w-full h-full flex items-center justify-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500 to-indigo-900">
             <div className="w-12 h-12 rounded-full border-2 border-indigo-400/20 animate-pulse"></div>
             <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Card;