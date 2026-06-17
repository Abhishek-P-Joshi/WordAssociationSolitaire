
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { GameState, GameLevel, WordCard, DifficultyLevel } from './types.ts';
import { generateLevel } from './services/levelService.ts';
import { createDeck, dealTableau } from './utils/gameLogic.ts';
import { GAME_THEMES, DIFFICULTY_CONFIG } from './constants.ts';
import Card from './components/Card.tsx';

const FOUNDATION_SLOTS = 4;
const INITIAL_HINTS = 5;
const INITIAL_UNDOS = 5;

const App: React.FC = () => {
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('Easy');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('app-theme');
    return (saved as 'dark' | 'light') || 'dark';
  });

  const [gameState, setGameState] = useState<GameState>({
    tableau: [],
    foundations: [],
    stock: [],
    waste: [],
    selectedCard: null,
    status: 'loading',
    moves: 0,
    targetMoves: 0,
    solvedCategories: 0,
    hintsRemaining: INITIAL_HINTS,
    undosRemaining: INITIAL_UNDOS,
    hintHighlight: null
  });

  const [currentLevel, setCurrentLevel] = useState<GameLevel | null>(null);
  const [clearingSlot, setClearingSlot] = useState<number | null>(null);
  const [dragOverPile, setDragOverPile] = useState<{ type: 'tableau' | 'foundation'; index: number } | null>(null);
  
  // History for Undos
  const historyRef = useRef<GameState[]>([]);

  useEffect(() => {
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  const pushToHistory = (state: GameState) => {
    const newState = JSON.parse(JSON.stringify(state));
    historyRef.current = [...historyRef.current, newState].slice(-10); // Keep last 10 moves
  };

  const startNewGame = useCallback(async (selectedTheme?: string, selectedDifficulty?: DifficultyLevel) => {
    const targetTheme = selectedTheme || GAME_THEMES[Math.floor(Math.random() * GAME_THEMES.length)];
    const targetDiff = selectedDifficulty || difficulty;
    
    setGameState(prev => ({ ...prev, status: 'loading', selectedCard: null }));
    historyRef.current = [];

    try {
      const level = await generateLevel(targetTheme, targetDiff);
      setCurrentLevel(level);
      const deck = createDeck(level);
      const config = DIFFICULTY_CONFIG[targetDiff];
      const { tableau, stock } = dealTableau(deck, config.columnCount);
      
      setGameState({
        tableau,
        foundations: Array.from({ length: FOUNDATION_SLOTS }, () => []), 
        stock: stock.map(c => ({ ...c, isFaceUp: false })),
        waste: [],
        selectedCard: null,
        status: 'playing',
        moves: 0,
        targetMoves: level.targetMoves,
        solvedCategories: 0,
        hintsRemaining: INITIAL_HINTS,
        undosRemaining: INITIAL_UNDOS,
        hintHighlight: null
      });
    } catch (err) {
      console.error(err);
      alert("Failed to load level. Please try again.");
    }
  }, [difficulty]);

  useEffect(() => {
    startNewGame();
  }, [startNewGame]);

  const getTargetCountForCategory = useCallback((categoryName: string) => {
    if (!currentLevel) return 0;
    const cat = currentLevel.categories.find(c => c.name === categoryName);
    return cat ? cat.words.length : 0; 
  }, [currentLevel]);

  // Efficiency calculation
  const efficiency = useMemo(() => {
    if (!currentLevel || gameState.moves === 0) return 0;
    const eff = (currentLevel.optimalMoves / gameState.moves) * 100;
    return Math.min(Math.round(eff), 100);
  }, [gameState.moves, currentLevel]);

  // Check if any move is possible on the board
  const findPossibleMove = useCallback((state: GameState) => {
    // 1. Waste to Foundation
    if (state.waste.length > 0) {
      const topWaste = state.waste[state.waste.length - 1];
      for (let fIdx = 0; fIdx < state.foundations.length; fIdx++) {
        const fPile = state.foundations[fIdx];
        if (fPile.length === 0) {
          if (topWaste.isMaster) return { source: { type: 'waste', pileIndex: 0, cardIndex: state.waste.length - 1 }, target: { type: 'foundation', index: fIdx } };
        } else {
          const master = fPile[0];
          const targetCount = getTargetCountForCategory(master.category);
          if (!topWaste.isMaster && topWaste.category === master.category && fPile.length <= targetCount) {
             return { source: { type: 'waste', pileIndex: 0, cardIndex: state.waste.length - 1 }, target: { type: 'foundation', index: fIdx } };
          }
        }
      }
    }

    // 2. Tableau to Foundation
    for (let pIdx = 0; pIdx < state.tableau.length; pIdx++) {
      const pile = state.tableau[pIdx];
      if (pile.length === 0) continue;
      const topCard = pile[pile.length - 1];
      for (let fIdx = 0; fIdx < state.foundations.length; fIdx++) {
        const fPile = state.foundations[fIdx];
        if (fPile.length === 0) {
          if (topCard.isMaster) return { source: { type: 'tableau', pileIndex: pIdx, cardIndex: pile.length - 1 }, target: { type: 'foundation', index: fIdx } };
        } else {
          const master = fPile[0];
          const targetCount = getTargetCountForCategory(master.category);
          if (!topCard.isMaster && topCard.category === master.category && fPile.length <= targetCount) {
             return { source: { type: 'tableau', pileIndex: pIdx, cardIndex: pile.length - 1 }, target: { type: 'foundation', index: fIdx } };
          }
        }
      }
    }

    // 3. Waste to Tableau
    if (state.waste.length > 0) {
      const topWaste = state.waste[state.waste.length - 1];
      for (let tIdx = 0; tIdx < state.tableau.length; tIdx++) {
        const targetPile = state.tableau[tIdx];
        if (targetPile.length === 0) return { source: { type: 'waste', pileIndex: 0, cardIndex: state.waste.length - 1 }, target: { type: 'tableau', index: tIdx } };
        const targetTop = targetPile[targetPile.length - 1];
        if (targetTop.isFaceUp && targetTop.category === topWaste.category) {
           return { source: { type: 'waste', pileIndex: 0, cardIndex: state.waste.length - 1 }, target: { type: 'tableau', index: tIdx } };
        }
      }
    }

    // 4. Tableau to Tableau
    for (let pIdx = 0; pIdx < state.tableau.length; pIdx++) {
      const pile = state.tableau[pIdx];
      if (pile.length === 0) continue;
      const firstFaceUpIdx = pile.findIndex(c => c.isFaceUp);
      if (firstFaceUpIdx === -1) continue;

      const movingSubStack = pile.slice(firstFaceUpIdx);
      const movingCard = movingSubStack[0];

      for (let tIdx = 0; tIdx < state.tableau.length; tIdx++) {
        if (pIdx === tIdx) continue;
        const targetPile = state.tableau[tIdx];
        if (targetPile.length === 0) return { source: { type: 'tableau', pileIndex: pIdx, cardIndex: firstFaceUpIdx }, target: { type: 'tableau', index: tIdx } };
        const targetTop = targetPile[targetPile.length - 1];
        if (targetTop.isFaceUp && targetTop.category === movingCard.category) {
            if (movingSubStack.every(c => c.category === movingCard.category)) {
               return { source: { type: 'tableau', pileIndex: pIdx, cardIndex: firstFaceUpIdx }, target: { type: 'tableau', index: tIdx } };
            }
        }
      }
    }

    // 5. Stock (Last resort)
    if (state.stock.length > 0) {
        return { source: { type: 'stock', pileIndex: 0, cardIndex: 0 }, target: null };
    }

    return null;
  }, [getTargetCountForCategory]);

  const hasPossibleMoves = useCallback((state: GameState): boolean => {
    return findPossibleMove(state) !== null;
  }, [findPossibleMove]);

  // Observer for Win/Loss state
  useEffect(() => {
    if (gameState.status !== 'playing' || clearingSlot !== null) return;

    const checkState = () => {
      const totalCats = currentLevel?.categories.length || 0;
      if (gameState.solvedCategories >= totalCats && totalCats > 0) {
        setGameState(prev => ({ ...prev, status: 'won' }));
        return;
      }
      if (!hasPossibleMoves(gameState)) {
        const totalCardsRemaining = gameState.tableau.reduce((acc, p) => acc + p.length, 0) + 
                                   gameState.waste.length + 
                                   gameState.stock.length;
        if (totalCardsRemaining === 0) setGameState(prev => ({ ...prev, status: 'won' }));
        else setGameState(prev => ({ ...prev, status: 'gameOver' }));
      }
    };

    const timer = setTimeout(checkState, 1500); 
    return () => clearTimeout(timer);
  }, [gameState.solvedCategories, gameState.tableau, gameState.waste, gameState.stock, gameState.status, currentLevel, clearingSlot, hasPossibleMoves]);

  const handleUndo = () => {
    if (gameState.undosRemaining <= 0 || historyRef.current.length === 0) return;
    const previousState = historyRef.current.pop();
    if (previousState) {
      setGameState({
        ...previousState,
        undosRemaining: gameState.undosRemaining - 1,
        hintHighlight: null // Clear hints on undo
      });
    }
  };

  const handleHint = () => {
    if (gameState.hintsRemaining <= 0 || gameState.status !== 'playing') return;
    const move = findPossibleMove(gameState);
    if (move) {
      setGameState(prev => ({
        ...prev,
        hintsRemaining: prev.hintsRemaining - 1,
        hintHighlight: {
          source: move.source as any,
          target: move.target as any
        }
      }));
      // Auto-clear hint after 3 seconds
      setTimeout(() => {
        setGameState(prev => ({ ...prev, hintHighlight: null }));
      }, 3000);
    }
  };

  const finalizeFoundation = useCallback((fIdx: number) => {
    setClearingSlot(fIdx);
    setTimeout(() => {
      setGameState(prev => {
        const newFoundations = prev.foundations.map((f, idx) => idx === fIdx ? [] : [...f]);
        const newSolved = prev.solvedCategories + 1;
        const totalCats = currentLevel?.categories.length || 0;
        
        return {
          ...prev,
          foundations: newFoundations,
          solvedCategories: newSolved,
          status: newSolved === totalCats ? 'won' : 'playing'
        };
      });
      setClearingSlot(null);
    }, 600);
  }, [currentLevel]);

  const handleStockClick = () => {
    if (gameState.status !== 'playing') return;
    pushToHistory(gameState);
    setGameState(prev => {
      const newState = { ...prev, hintHighlight: null };
      if (newState.stock.length === 0) {
        if (newState.waste.length === 0) return prev;
        newState.stock = [...newState.waste].reverse().map(c => ({ ...c, isFaceUp: false }));
        newState.waste = [];
      } else {
        const drawn = { ...newState.stock.pop()!, isFaceUp: true };
        newState.waste.push(drawn);
      }
      newState.moves += 1;
      newState.selectedCard = null;
      return newState;
    });
  };

  const executeMoveToTableau = (targetPileIndex: number, sP: number, sC: number, source: 'tableau' | 'waste' | 'foundation') => {
    pushToHistory(gameState);
    setGameState(prev => {
      const next = { ...prev, tableau: prev.tableau.map(p => [...p]), foundations: prev.foundations.map(f => [...f]), hintHighlight: null };
      let moved: WordCard[] = [];
      if (source === 'tableau') {
        moved = next.tableau[sP].splice(sC);
        if (next.tableau[sP].length > 0) next.tableau[sP][next.tableau[sP].length - 1].isFaceUp = true;
      } else if (source === 'waste') {
        moved = [next.waste.pop()!];
      }
      next.tableau[targetPileIndex].push(...moved);
      next.selectedCard = null;
      next.moves += 1;
      return next;
    });
  };

  const executeMoveToFoundation = (fIdx: number, sP: number, sC: number, source: 'tableau' | 'waste' | 'foundation') => {
    pushToHistory(gameState);
    setGameState(prev => {
      const next = { ...prev, foundations: prev.foundations.map(f => [...f]), tableau: prev.tableau.map(p => [...p]), hintHighlight: null };
      let moved: WordCard[] = [];
      if (source === 'tableau') {
        moved = next.tableau[sP].splice(sC);
        if (next.tableau[sP].length > 0) next.tableau[sP][next.tableau[sP].length - 1].isFaceUp = true;
      } else if (source === 'waste') {
        moved = [next.waste.pop()!];
      }
      next.foundations[fIdx].push(...moved);
      next.selectedCard = null;
      next.moves += 1;
      return next;
    });
  };

  const handleTableauCardClick = (pileIndex: number, cardIndex: number) => {
    if (gameState.status !== 'playing') return;
    const pile = gameState.tableau[pileIndex];
    if (!pile) return;
    const card = pile[cardIndex];
    if (!card || !card.isFaceUp) return;
    if (!gameState.selectedCard) {
      const subSequence = pile.slice(cardIndex);
      if (subSequence.every(c => c.isFaceUp && c.category === card.category)) {
        setGameState(prev => ({ ...prev, selectedCard: { pileIndex, cardIndex, source: 'tableau' } }));
      }
      return;
    }
    const { pileIndex: sP, cardIndex: sC, source } = gameState.selectedCard;
    if (source === 'tableau' && sP === pileIndex && sC === cardIndex) {
      setGameState(prev => ({ ...prev, selectedCard: null }));
      return;
    }
    const targetTop = pile[pile.length - 1];
    let movingCards: WordCard[] = [];
    if (source === 'tableau') movingCards = gameState.tableau[sP].slice(sC);
    else if (source === 'waste') movingCards = [gameState.waste[gameState.waste.length - 1]];
    
    if (cardIndex === pile.length - 1 && targetTop.category === movingCards[0].category) {
      executeMoveToTableau(pileIndex, sP, sC, source);
    }
  };

  const handleFoundationClick = (fIdx: number) => {
    if (gameState.status !== 'playing' || clearingSlot !== null) return;
    const foundationPile = gameState.foundations[fIdx];
    if (foundationPile.length > 0) {
      const target = getTargetCountForCategory(foundationPile[0].category);
      if (foundationPile.length === target + 1) { finalizeFoundation(fIdx); return; }
    }
    if (!gameState.selectedCard) return;
    const { pileIndex: sP, cardIndex: sC, source } = gameState.selectedCard;
    let movingCards: WordCard[] = [];
    if (source === 'tableau') movingCards = gameState.tableau[sP].slice(sC);
    else if (source === 'waste') movingCards = [gameState.waste[gameState.waste.length - 1]];
    if (movingCards.length === 0) return;
    const movingCard = movingCards[0];
    if (foundationPile.length === 0) {
      if (movingCard.isMaster && movingCards.length === 1) executeMoveToFoundation(fIdx, sP, sC, source);
    } else {
      const master = foundationPile[0];
      const target = getTargetCountForCategory(master.category);
      if (movingCards.every(c => !c.isMaster && c.category === master.category) && (foundationPile.length + movingCards.length <= target + 1)) {
        executeMoveToFoundation(fIdx, sP, sC, source);
      }
    }
  };

  const handleEmptyTableauClick = (pIdx: number) => {
    if (gameState.status !== 'playing' || !gameState.selectedCard) return;
    const { pileIndex: sP, cardIndex: sC, source = 'tableau' } = gameState.selectedCard;
    executeMoveToTableau(pIdx, sP, sC, source);
  };

  const handleDragStart = (e: React.DragEvent, pileIndex: number, cardIndex: number, source: 'tableau' | 'waste') => {
    if (gameState.status !== 'playing') { e.preventDefault(); return; }
    let canDrag = false;
    if (source === 'tableau') {
      const sub = gameState.tableau[pileIndex].slice(cardIndex);
      canDrag = sub.every(c => c.isFaceUp && c.category === sub[0].category);
    } else if (source === 'waste') canDrag = true;
    if (!canDrag) { e.preventDefault(); return; }
    setGameState(prev => ({ ...prev, selectedCard: { pileIndex, cardIndex, source } }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, type: 'tableau' | 'foundation', index: number) => {
    e.preventDefault();
    if (dragOverPile?.type !== type || dragOverPile?.index !== index) setDragOverPile({ type, index });
  };

  const handleDrop = (e: React.DragEvent, type: 'tableau' | 'foundation', index: number) => {
    e.preventDefault();
    setDragOverPile(null);
    if (type === 'tableau') {
      const pile = gameState.tableau[index];
      if (pile.length === 0) handleEmptyTableauClick(index);
      else handleTableauCardClick(index, pile.length - 1);
    } else handleFoundationClick(index);
  };

  const totalCategories = currentLevel?.categories.length || 0;

  return (
    <div className={`min-h-screen transition-colors duration-500 select-none flex flex-col h-screen overflow-hidden ${theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-[#f8fafc] text-slate-900'}`}>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 pb-32">
        
        {/* Win/Loss Overlays */}
        {(gameState.status === 'won' || gameState.status === 'gameOver') && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 backdrop-blur-xl bg-black/50 animate-in fade-in duration-500">
            <div className={`max-w-md w-full p-10 rounded-[4rem] shadow-2xl border text-center transform animate-in zoom-in-95 slide-in-from-bottom-12 duration-500 ${theme === 'dark' ? 'bg-slate-900 border-indigo-500/20 shadow-indigo-500/10' : 'bg-white border-slate-200 shadow-slate-200'}`}>
              
              <h2 className={`text-5xl font-black mb-2 uppercase tracking-tighter ${gameState.status === 'won' ? 'text-amber-500' : 'text-rose-500'}`}>
                {gameState.status === 'won' ? 'Victory' : 'Stopped'}
              </h2>

              {gameState.status === 'won' && (
                <div className="mb-8 flex flex-col items-center">
                   <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-2">Efficiency Rating</div>
                   <div className="flex items-baseline gap-2">
                     <span className="text-6xl font-black text-white tracking-tighter">{efficiency}%</span>
                     <span className="text-indigo-400 font-bold uppercase text-xs">Optimal</span>
                   </div>
                   <div className="w-full h-1.5 bg-slate-800 rounded-full mt-4 overflow-hidden max-w-[200px]">
                      <div className="h-full bg-indigo-500 transition-all duration-1000 ease-out" style={{ width: `${efficiency}%` }} />
                   </div>
                </div>
              )}
              
              <p className={`mb-10 text-lg font-medium leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                {gameState.status === 'won' 
                  ? `Incredible mastery! You deciphered all associations in ${gameState.moves} moves. Theoretical best was ${currentLevel?.optimalMoves}.`
                  : "No more logical connections found. The journey ends here... for now."}
              </p>

              <div className="flex flex-col gap-4">
                <button 
                  onClick={() => startNewGame()} 
                  className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-3xl font-black text-sm uppercase tracking-widest transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 group"
                >
                  <span>New Journey</span>
                  <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </button>
                
                {gameState.status === 'gameOver' && (
                  <button 
                    onClick={() => setGameState(prev => ({...prev, status: 'finished'}))} 
                    className={`w-full py-5 rounded-3xl font-black text-sm uppercase tracking-widest transition-all ${theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    Inspect Board
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <header className="flex flex-col xl:flex-row justify-between items-center gap-6 mb-10 max-w-7xl mx-auto relative">
          <div className="text-center xl:text-left">
            <h1 className={`text-4xl md:text-5xl font-black tracking-tighter uppercase ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}>
              Semantic <span className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>Solitaire</span>
            </h1>
            <p className={`${theme === 'dark' ? 'text-indigo-200 opacity-60' : 'text-slate-500'} font-medium tracking-tight uppercase text-[10px] tracking-[0.3em]`}>Word Association Journey</p>
          </div>

          <div className={`flex flex-wrap justify-center items-center gap-4 p-4 rounded-3xl border backdrop-blur-sm shadow-sm ${theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-white/90 border-slate-200'}`}>
            <div className="flex gap-2">
              <button 
                onClick={handleUndo} 
                disabled={gameState.undosRemaining <= 0 || historyRef.current.length === 0}
                className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl border transition-all ${gameState.undosRemaining > 0 && historyRef.current.length > 0 ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/20' : 'opacity-20 cursor-not-allowed border-slate-700 text-slate-500'}`}
                title="Undo move"
              >
                <svg className="w-5 h-5 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                <span className="text-[9px] font-black">{gameState.undosRemaining}</span>
              </button>
              <button 
                onClick={handleHint} 
                disabled={gameState.hintsRemaining <= 0 || gameState.status !== 'playing'}
                className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl border transition-all ${gameState.hintsRemaining > 0 && gameState.status === 'playing' ? 'bg-amber-600/10 border-amber-500/30 text-amber-400 hover:bg-amber-600/20' : 'opacity-20 cursor-not-allowed border-slate-700 text-slate-500'}`}
                title="Show hint"
              >
                <svg className="w-5 h-5 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                <span className="text-[9px] font-black">{gameState.hintsRemaining}</span>
              </button>
            </div>

            <div className={`w-px h-8 hidden sm:block ${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'}`}></div>

            <div className={`flex p-1 rounded-2xl border ${theme === 'dark' ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-200/50 border-slate-200'}`}>
              {(['Easy', 'Medium', 'Hard'] as DifficultyLevel[]).map((d) => (
                <button key={d} onClick={() => { setDifficulty(d); startNewGame(undefined, d); }} className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase transition-all ${difficulty === d ? 'bg-indigo-600 text-white shadow-lg' : theme === 'dark' ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-900'}`}>
                  {d}
                </button>
              ))}
            </div>
            
            <div className={`w-px h-8 hidden sm:block ${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
            <div className="flex items-center gap-6 px-4 font-black">
              <div className="text-center">
                <span className="block text-[10px] uppercase opacity-40 mb-0.5">Moves / Par</span>
                <span className="text-2xl tracking-tighter">
                  {gameState.moves} <span className="text-indigo-500/50 mx-1">/</span> {currentLevel?.optimalMoves || '--'}
                </span>
              </div>
              <div className={`w-px h-8 ${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
              <div className="text-center">
                <span className="block text-[10px] uppercase opacity-40 mb-0.5">Solved</span>
                <span className="text-2xl text-amber-500 tracking-tighter">{gameState.solvedCategories}/{totalCategories}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => startNewGame()} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95">
                New Game
              </button>
              <button 
                onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
                className={`p-3 rounded-2xl transition-all border ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-yellow-400 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:text-indigo-600'}`}
                title="Toggle Theme"
              >
                {theme === 'dark' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto space-y-12">
          {gameState.status === 'loading' ? (
            <div className="h-[50vh] flex flex-col items-center justify-center space-y-6 text-center">
              <div className="relative w-24 h-24">
                <div className={`absolute inset-0 border-8 rounded-full ${theme === 'dark' ? 'border-indigo-500/10' : 'border-indigo-100'}`}></div>
                <div className="absolute inset-0 border-8 border-indigo-500 border-t-transparent rounded-full animate-spin shadow-lg"></div>
              </div>
              <p className={`text-2xl font-black animate-pulse uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-indigo-200' : 'text-indigo-600'}`}>Preparing Journey...</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 items-start justify-center">
                <div className="flex flex-col items-center gap-4">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Deck</span>
                  <section className={`flex gap-6 p-6 rounded-[2.5rem] border backdrop-blur-md transition-all ${theme === 'dark' ? 'bg-slate-900/30 border-slate-800/50 shadow-2xl' : 'bg-white border-slate-200 shadow-xl shadow-slate-200'}`}>
                    <div onClick={handleStockClick} className={`relative cursor-pointer group transition-all duration-300 hover:scale-105 hover:-translate-y-1 ${gameState.hintHighlight?.source?.type === 'stock' ? 'ring-4 ring-amber-400 rounded-3xl z-20' : ''}`}>
                      
                      {/* Depth Layers */}
                      {gameState.stock.length > 2 && <div className="absolute top-1 left-1 w-24 h-36 md:w-28 md:h-40 rounded-3xl bg-black/10 z-0 transition-transform group-hover:translate-x-0.5 group-hover:translate-y-0.5"></div>}
                      {gameState.stock.length > 1 && <div className="absolute top-0.5 left-0.5 w-24 h-36 md:w-28 md:h-40 rounded-3xl bg-black/5 z-0 transition-transform group-hover:translate-x-0.5 group-hover:translate-y-0.5"></div>}
                      
                      <div className={`w-24 h-36 md:w-28 md:h-40 rounded-3xl border-4 transition-all duration-300 flex items-center justify-center overflow-hidden relative z-10 shadow-2xl bg-indigo-700 border-white/50 group-hover:shadow-indigo-500/40 ${gameState.hintHighlight?.source?.type === 'stock' ? 'shadow-[0_0_30px_rgba(251,191,36,1)]' : ''}`}>
                         {gameState.stock.length > 0 ? (
                           <>
                             <div className="absolute inset-0 opacity-10 rounded-xl" 
                               style={{ 
                                 backgroundImage: `radial-gradient(circle, #fff 1.5px, transparent 1.5px)`,
                                 backgroundSize: '16px 16px'
                               }}>
                             </div>
                             
                             <div className="relative z-10 flex flex-col items-center gap-3">
                                <div className="w-14 h-14 rounded-full border-4 border-white/60 flex items-center justify-center bg-white shadow-xl transition-transform group-hover:scale-110">
                                  <span className="text-2xl font-black text-indigo-700">{gameState.stock.length}</span>
                                </div>
                             </div>
                           </>
                         ) : <div className="text-3xl opacity-20">↻</div>}
                      </div>
                    </div>
                    <div className="relative">
                      {gameState.waste.length === 0 ? (
                        <div className={`w-24 h-36 md:w-28 md:h-40 rounded-3xl border-4 border-dashed flex items-center justify-center ${theme === 'dark' ? 'border-slate-800/20' : 'border-slate-300'}`}>
                          <span className="text-[8px] font-black uppercase opacity-20">Empty</span>
                        </div>
                      ) : (
                        <Card 
                          card={gameState.waste[gameState.waste.length - 1]} 
                          onClick={() => {}} 
                          onDragStart={(e) => handleDragStart(e, 0, gameState.waste.length - 1, 'waste')}
                          isSelected={gameState.selectedCard?.source === 'waste'}
                          isHintSource={gameState.hintHighlight?.source?.type === 'waste'}
                          theme={theme}
                        />
                      )}
                    </div>
                  </section>
                </div>

                <div className="flex flex-col items-center gap-4">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Foundations</span>
                  <section className={`p-6 rounded-[3rem] border shadow-inner flex flex-wrap justify-center gap-4 min-h-[160px] ${theme === 'dark' ? 'bg-slate-900/40 border-slate-800/50' : 'bg-slate-200/40 border-slate-200'}`}>
                    {gameState.foundations.map((pile, fIdx) => (
                      <div key={fIdx} onClick={() => handleFoundationClick(fIdx)} onDragOver={(e) => handleDragOver(e, 'foundation', fIdx)} onDrop={(e) => handleDrop(e, 'foundation', fIdx)}
                        className={`relative flex flex-col items-center min-h-[160px] transition-all duration-500 ${clearingSlot === fIdx ? 'scale-0 opacity-0 blur-lg' : ''} ${dragOverPile?.type === 'foundation' && dragOverPile.index === fIdx ? 'scale-110' : ''}`}
                      >
                        {pile.length === 0 ? (
                          <div className={`w-24 h-36 md:w-28 md:h-40 rounded-3xl border-4 border-dashed flex items-center justify-center transition-all ${theme === 'dark' ? 'bg-slate-950/20 border-slate-800/40' : 'bg-white border-slate-300'} ${gameState.hintHighlight?.target?.type === 'foundation' && gameState.hintHighlight.target.index === fIdx ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_20px_rgba(52,211,153,0.4)]' : ''}`}>
                            <span className="text-2xl opacity-10">★</span>
                          </div>
                        ) : (
                          <Card 
                            card={pile[0]} 
                            onClick={() => {}} 
                            targetCount={getTargetCountForCategory(pile[0].category)} 
                            currentCount={pile.length - 1} 
                            theme={theme}
                            isHintTarget={gameState.hintHighlight?.target?.type === 'foundation' && gameState.hintHighlight.target.index === fIdx}
                          />
                        )}
                      </div>
                    ))}
                  </section>
                </div>
              </div>

              <section className="px-2">
                <div className="flex flex-wrap gap-4 md:gap-6 justify-center max-w-[1400px] mx-auto items-start pb-12">
                  {gameState.tableau.map((pile, pIdx) => (
                    <div key={pIdx} onDragOver={(e) => handleDragOver(e, 'tableau', pIdx)} onDrop={(e) => handleDrop(e, 'tableau', pIdx)}
                      className={`flex flex-col items-center min-h-[400px] transition-all rounded-3xl p-1 ${dragOverPile?.type === 'tableau' && dragOverPile.index === pIdx ? 'bg-indigo-500/10 ring-2 ring-indigo-500/30' : ''}`}
                    >
                      {pile.length === 0 ? (
                        <div onClick={() => handleEmptyTableauClick(pIdx)} className={`w-24 h-36 md:w-28 md:h-40 rounded-3xl border-2 border-dashed flex items-center justify-center transition-all ${theme === 'dark' ? 'border-slate-800/60 bg-slate-900/10' : 'border-slate-300 bg-white/40'} ${gameState.hintHighlight?.target?.type === 'tableau' && gameState.hintHighlight.target.index === pIdx ? 'border-emerald-400 bg-emerald-500/10' : ''}`}>
                          <div className="text-xl opacity-20">+</div>
                        </div>
                      ) : (
                        pile.map((card, cIdx) => (
                          <Card key={card.id} card={card} onClick={() => handleTableauCardClick(pIdx, cIdx)} onDragStart={(e) => handleDragStart(e, pIdx, cIdx, 'tableau')}
                            isSelected={gameState.selectedCard?.source === 'tableau' && gameState.selectedCard.pileIndex === pIdx && cIdx >= gameState.selectedCard.cardIndex}
                            isHintSource={gameState.hintHighlight?.source?.type === 'tableau' && gameState.hintHighlight.source.pileIndex === pIdx && gameState.hintHighlight.source.cardIndex === cIdx}
                            isHintTarget={gameState.hintHighlight?.target?.type === 'tableau' && gameState.hintHighlight.target.index === pIdx && cIdx === pile.length - 1}
                            stacked={cIdx > 0} theme={theme}
                          />
                        ))
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </main>
      </div>

      <footer className={`p-4 text-center border-t transition-colors duration-500 ${theme === 'dark' ? 'bg-slate-950/90 border-slate-800/50 text-slate-500' : 'bg-white border-slate-200 text-slate-400'}`}>
         <div className="max-w-7xl mx-auto text-[9px] font-black uppercase tracking-[0.25em]">
            Semantic Puzzle &bull; Find Logical Groups &bull; Link the Word to the <span className="text-indigo-500">Master</span>
         </div>
      </footer>
      <Analytics />
    </div>
  );
};

export default App;
