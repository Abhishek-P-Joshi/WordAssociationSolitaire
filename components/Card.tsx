
import React from 'react';
import { WordCard } from '../types.ts';

interface CardProps {
  card: WordCard;
  onClick: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isSelected?: boolean;
  isHintSource?: boolean;
  isHintTarget?: boolean;
  isDragging?: boolean;
  stacked?: boolean;
  targetCount?: number;
  currentCount?: number;
  theme?: 'dark' | 'light';
}

const Card: React.FC<CardProps> = ({ 
  card, 
  onClick, 
  onDragStart, 
  onDragEnd, 
  isSelected, 
  isHintSource,
  isHintTarget,
  isDragging,
  stacked, 
  targetCount, 
  currentCount,
  theme = 'dark'
}) => {
  const isFaceUp = card.isFaceUp;
  const isMaster = card.isMaster;
  const color = card.color || 'bg-slate-700';

  // Strict hover rule: Only face-up cards that aren't being dragged should react to hover
  const canHover = isFaceUp && !isDragging;

  return (
    <div 
      onClick={onClick}
      draggable={isFaceUp && !isDragging}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`
        relative w-24 h-36 md:w-28 md:h-40 cursor-pointer 
        transition-all duration-300 transform perspective-1000
        ${isSelected ? '-translate-y-4 scale-105 z-[60] shadow-2xl' : 'z-10'}
        ${isHintSource ? 'ring-4 ring-amber-400 scale-105 z-[70] shadow-[0_0_20px_rgba(251,191,36,0.8)]' : ''}
        ${isHintTarget ? 'ring-4 ring-emerald-400 scale-105 z-[70] shadow-[0_0_20px_rgba(52,211,153,0.8)]' : ''}
        ${isDragging ? 'opacity-20 grayscale' : 'opacity-100'}
        ${stacked ? '-mt-28 md:-mt-32' : ''}
        ${canHover ? 'hover:z-[100] hover:scale-105 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/40' : ''}
        ${!isFaceUp ? 'cursor-default' : 'cursor-pointer'}
      `}
    >
      <div className={`
        card-flip-inner relative w-full h-full rounded-2xl transition-transform duration-500
        ${isFaceUp ? '' : 'card-flip-flipped'}
      `}>
        {/* Front Face */}
        <div 
          style={{ visibility: isFaceUp ? 'visible' : 'hidden' }}
          className={`
            card-face absolute inset-0 w-full h-full rounded-2xl border-2
            ${isMaster 
              ? 'bg-slate-900 border-slate-700 shadow-xl' 
              : theme === 'dark' ? 'bg-white border-slate-300' : 'bg-white border-slate-200 shadow-lg'}
            flex flex-col items-center justify-center p-2
            ${isSelected ? '!border-indigo-500 ring-4 ring-indigo-500/20' : ''}
          `}
        >
          <div className={`w-full h-full rounded-xl flex flex-col items-center justify-center relative overflow-hidden ${isMaster ? 'bg-slate-800/40' : 'bg-transparent'}`}>
            
            {isMaster ? (
              <>
                <div className={`w-10 h-10 rounded-full ${color} mb-3 flex items-center justify-center shadow-lg relative z-10 border-2 border-white/20`}>
                  <div className="w-3 h-3 bg-white rounded-full animate-pulse shadow-[0_0_8px_white]"></div>
                </div>
                
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white text-center px-1 relative z-10 leading-tight">
                  {card.word}
                </span>
                
                {targetCount !== undefined && (
                  <div className="mt-3 flex flex-col items-center gap-1 z-10 w-full px-2">
                    <div className="px-2 py-0.5 bg-slate-950/80 rounded-full border border-slate-700 text-[10px] font-black text-indigo-400 whitespace-nowrap scale-90">
                      {currentCount ?? 0} <span className="text-slate-600 mx-0.5">/</span> {targetCount}
                    </div>
                    <div className="w-full max-w-[50px] h-1 bg-slate-950 rounded-full overflow-hidden mt-1">
                       <div className={`h-full ${color} transition-all duration-700`} style={{ width: `${((currentCount ?? 0) / (targetCount ?? 1)) * 100}%` }} />
                    </div>
                  </div>
                )}
                <div className={`absolute inset-0 ${color} opacity-5 blur-2xl`}></div>
              </>
            ) : (
              <span className={`text-sm font-bold text-center px-2 break-words leading-tight tracking-tight text-slate-800`}>
                {card.word}
              </span>
            )}
          </div>
        </div>

        {/* Back Face - Ultra Simple Dot Pattern */}
        <div 
          style={{ visibility: isFaceUp ? 'hidden' : 'visible' }}
          className={`card-face card-back absolute inset-0 w-full h-full rounded-2xl border-4 transition-colors duration-500 shadow-xl bg-indigo-700 border-white/50`}
        >
          <div className="w-full h-full relative flex items-center justify-center overflow-hidden rounded-xl">
             {/* Simple Dot Pattern - Kept for texture but clean */}
             <div className="absolute inset-0 opacity-10" 
               style={{ 
                 backgroundImage: `radial-gradient(circle, #fff 1.5px, transparent 1.5px)`,
                 backgroundSize: '16px 16px'
               }}>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Card;
