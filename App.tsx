
import React, { useState, useEffect, useCallback } from 'react';
import { GameState, GameLevel, WordCard, DifficultyLevel } from './types.ts';
import { generateLevel } from './services/levelService.ts';
import { createDeck, dealTableau } from './utils/gameLogic.ts';
import { GAME_THEMES, DIFFICULTY_CONFIG } from './constants.ts';
import Card from './components/Card.tsx';

const FOUNDATION_SLOTS = 4;

const App: React.FC = () => {
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('Easy');
  const [gameState, setGameState] = useState<GameState>({
    tableau: [],
    foundations: [],
    stock: [],
    waste: [],
    selectedCard: null,
    status: 'loading',
    moves: 0,
    targetMoves: 0,
    solvedCategories: 0
  });

  const [currentLevel, setCurrentLevel] = useState<GameLevel | null>(null);
  const [clearingSlot, setClearingSlot] = useState<number | null>(null);
  const [dragOverPile, setDragOverPile] = useState<{ type: 'tableau' | 'foundation'; index: number } | null>(null);

  const startNewGame = useCallback(async (selectedTheme?: string, selectedDifficulty?: DifficultyLevel) => {
    const targetTheme = selectedTheme || GAME_THEMES[Math.floor(Math.random() * GAME_THEMES.length)];
    const targetDiff = selectedDifficulty || difficulty;
    
    setGameState(prev => ({ ...prev, status: 'loading', selectedCard: null }));
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
        solvedCategories: 0
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

  const checkGameOver = useCallback((state: GameState) => {
    if (state.status !== 'playing' || clearingSlot !== null) return;
    
    const totalToSolve = currentLevel?.categories.length || 0;
    if (state.solvedCategories >= totalToSolve) return;

    const hasAnyCardsLeft = state.tableau.some(p => p.length > 0) || state.waste.length > 0 || state.stock.length > 0;
    if (!hasAnyCardsLeft && state.solvedCategories < totalToSolve) {
        setGameState(prev => ({ ...prev, status: 'won' }));
        return;
    }

    if (state.stock.length > 0) return;

    const canMoveToFoundation = (card: WordCard) => {
      for (let fIdx = 0; fIdx < state.foundations.length; fIdx++) {
        const foundation = state.foundations[fIdx];
        if (foundation.length === 0 && card.isMaster) return true;
        if (foundation.length > 0) {
          const targetTotalWords = getTargetCountForCategory(foundation[0].category);
          if (foundation.length < targetTotalWords + 1 && foundation[0].category === card.category) return true;
        }
      }
      return false;
    };

    const canMoveToTableau = (card: WordCard, currentPileIdx: number | null) => {
      for (let pIdx = 0; pIdx < state.tableau.length; pIdx++) {
        if (pIdx === currentPileIdx) continue;
        const pile = state.tableau[pIdx];
        if (pile.length === 0) return true;
        if (pile[pile.length - 1].category === card.category) return true;
      }
      return false;
    };

    if (state.waste.length > 0) {
      const wasteTop = state.waste[state.waste.length - 1];
      if (canMoveToFoundation(wasteTop) || canMoveToTableau(wasteTop, null)) return;
    }

    for (let pIdx = 0; pIdx < state.tableau.length; pIdx++) {
      const pile = state.tableau[pIdx];
      if (pile.length === 0) continue;
      const topCard = pile[pile.length - 1];
      if (canMoveToFoundation(topCard)) return;
      
      const firstFaceUpIdx = pile.findIndex(c => c.isFaceUp);
      if (firstFaceUpIdx !== -1) {
        const movingGroupHead = pile[firstFaceUpIdx];
        if (canMoveToTableau(movingGroupHead, pIdx)) return;
      }
    }

    setGameState(prev => ({ ...prev, status: 'gameOver' }));
  }, [currentLevel, clearingSlot, getTargetCountForCategory]);

  const handleStockClick = () => {
    if (gameState.status !== 'playing') return;
    setGameState(prev => {
      const newState = { ...prev };
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

  const handleWasteCardClick = () => {
    if (gameState.status !== 'playing') return;
    if (gameState.waste.length === 0) return;

    if (gameState.selectedCard?.source === 'waste') {
      setGameState(prev => ({ ...prev, selectedCard: null }));
    } else {
      setGameState(prev => ({
        ...prev,
        selectedCard: { pileIndex: 0, cardIndex: prev.waste.length - 1, source: 'waste' }
      }));
    }
  };

  const executeMoveToTableau = (targetPileIndex: number, sP: number, sC: number, source: 'tableau' | 'waste' | 'foundation') => {
    setGameState(prev => {
      const next = { ...prev, tableau: prev.tableau.map(p => [...p]), foundations: prev.foundations.map(f => [...f]) };
      let moved: WordCard[] = [];
      
      if (source === 'tableau') {
        moved = next.tableau[sP].splice(sC);
        if (next.tableau[sP].length > 0) next.tableau[sP][next.tableau[sP].length - 1].isFaceUp = true;
      } else if (source === 'waste') {
        moved = [next.waste.pop()!];
      } else if (source === 'foundation') {
        moved = [next.foundations[sP].pop()!];
      }
      
      next.tableau[targetPileIndex].push(...moved);
      next.selectedCard = null;
      next.moves += 1;
      return next;
    });
  };

  const executeMoveToFoundation = (fIdx: number, sP: number, sC: number, source: 'tableau' | 'waste' | 'foundation') => {
    setGameState(prev => {
      const next = { ...prev, foundations: prev.foundations.map(f => [...f]), tableau: prev.tableau.map(p => [...p]) };
      let moved: WordCard[] = [];
      
      if (source === 'tableau') {
        moved = next.tableau[sP].splice(sC);
        if (next.tableau[sP].length > 0) next.tableau[sP][next.tableau[sP].length - 1].isFaceUp = true;
      } else if (source === 'waste') {
        moved = [next.waste.pop()!];
      } else if (source === 'foundation') {
        moved = [next.foundations[sP].pop()!];
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
      const allSameCategory = subSequence.every(c => c.isFaceUp && c.category === card.category);
      if (allSameCategory) {
        setGameState(prev => ({
          ...prev,
          selectedCard: { pileIndex, cardIndex, source: 'tableau' }
        }));
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
    if (source === 'tableau') {
      movingCards = gameState.tableau[sP].slice(sC);
    } else if (source === 'waste') {
      movingCards = [gameState.waste[gameState.waste.length - 1]];
    }

    if (cardIndex === pile.length - 1 && targetTop.category === movingCards[0].category) {
      executeMoveToTableau(pileIndex, sP, sC, source);
    }
  };

  const handleFoundationClick = (fIdx: number) => {
    if (gameState.status !== 'playing' || clearingSlot !== null) return;
    const foundationPile = gameState.foundations[fIdx];
    
    if (foundationPile.length > 0) {
      const targetWords = getTargetCountForCategory(foundationPile[0].category);
      if (foundationPile.length === targetWords + 1) {
        finalizeFoundation(fIdx);
        return;
      }
    }

    if (!gameState.selectedCard) return;

    const { pileIndex: sP, cardIndex: sC, source } = gameState.selectedCard;
    let movingCards: WordCard[] = [];
    if (source === 'tableau') {
      movingCards = gameState.tableau[sP].slice(sC);
    } else if (source === 'waste') {
      movingCards = [gameState.waste[gameState.waste.length - 1]];
    }

    if (movingCards.length === 0) return;
    const movingCard = movingCards[0];

    if (foundationPile.length === 0) {
      if (movingCard.isMaster && movingCards.length === 1) {
        executeMoveToFoundation(fIdx, sP, sC, source);
      }
    } else {
      const masterCard = foundationPile[0];
      const targetWords = getTargetCountForCategory(masterCard.category);
      
      if (movingCards.every(c => !c.isMaster && c.category === masterCard.category) && (foundationPile.length + movingCards.length <= targetWords + 1)) {
        executeMoveToFoundation(fIdx, sP, sC, source);
      }
    }
  };

  const handleEmptyTableauClick = (pIdx: number) => {
    if (gameState.status !== 'playing' || !gameState.selectedCard) return;
    const { pileIndex: sP, cardIndex: sC, source } = gameState.selectedCard;
    executeMoveToTableau(pIdx, sP, sC, source);
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, pileIndex: number, cardIndex: number, source: 'tableau' | 'waste' | 'foundation') => {
    if (gameState.status !== 'playing') {
      e.preventDefault();
      return;
    }

    let canDrag = false;
    if (source === 'tableau') {
      const pile = gameState.tableau[pileIndex];
      const subSequence = pile.slice(cardIndex);
      canDrag = subSequence.every(c => c.isFaceUp && c.category === subSequence[0].category);
    } else if (source === 'waste') {
      canDrag = true;
    }

    if (!canDrag) {
      e.preventDefault();
      return;
    }

    setGameState(prev => ({
      ...prev,
      selectedCard: { pileIndex, cardIndex, source }
    }));
    
    // Set custom drag image if needed, for now use default browser one
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, type: 'tableau' | 'foundation', index: number) => {
    e.preventDefault();
    if (dragOverPile?.type !== type || dragOverPile?.index !== index) {
      setDragOverPile({ type, index });
    }
  };

  const handleDragLeave = () => {
    setDragOverPile(null);
  };

  const handleDrop = (e: React.DragEvent, type: 'tableau' | 'foundation', index: number) => {
    e.preventDefault();
    setDragOverPile(null);
    if (type === 'tableau') {
      const pile = gameState.tableau[index];
      if (pile.length === 0) {
        handleEmptyTableauClick(index);
      } else {
        handleTableauCardClick(index, pile.length - 1);
      }
    } else {
      handleFoundationClick(index);
    }
  };

  const handleDragEnd = () => {
    setGameState(prev => ({ ...prev, selectedCard: null }));
    setDragOverPile(null);
  };

  useEffect(() => {
    if (gameState.status === 'playing') {
        gameState.foundations.forEach((pile, idx) => {
            if (pile.length > 0) {
                const target = getTargetCountForCategory(pile[0].category);
                if (pile.length === target + 1 && clearingSlot === null) {
                    finalizeFoundation(idx);
                }
            }
        });
    }
  }, [gameState.foundations, getTargetCountForCategory, clearingSlot, gameState.status, finalizeFoundation]);

  useEffect(() => {
    if (gameState.status === 'playing' && clearingSlot === null) {
      const timer = setTimeout(() => checkGameOver(gameState), 1500);
      return () => clearTimeout(timer);
    }
  }, [gameState, checkGameOver, clearingSlot]);

  const totalCategories = currentLevel?.categories.length || 0;

  return (
    <div className="min-h-screen text-white select-none bg-slate-950 flex flex-col h-screen overflow-hidden">
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 pb-32">
        <header className="flex flex-col xl:flex-row justify-between items-center gap-6 mb-10 max-w-7xl mx-auto">
          <div className="text-center xl:text-left">
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-indigo-400 uppercase">
              Semantic <span className="text-white">Solitaire</span>
            </h1>
            <p className="text-indigo-200 opacity-60 font-medium tracking-tight uppercase text-[10px] tracking-[0.3em]">Word Association Journey</p>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-4 bg-slate-900/50 p-4 rounded-3xl border border-slate-800 backdrop-blur-sm">
            <div className="flex bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800">
              {(['Easy', 'Medium', 'Hard'] as DifficultyLevel[]).map((d) => (
                <button
                  key={d}
                  onClick={() => { setDifficulty(d); startNewGame(undefined, d); }}
                  className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase transition-all ${
                    difficulty === d ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="w-px h-8 bg-slate-700 hidden sm:block"></div>
            <div className="flex items-center gap-6 px-4 font-black">
              <div className="text-center">
                <span className="block text-[10px] uppercase opacity-40 mb-0.5">Moves</span>
                <span className="text-2xl tracking-tighter">{gameState.moves}</span>
              </div>
              <div className="w-px h-8 bg-slate-700"></div>
              <div className="text-center">
                <span className="block text-[10px] uppercase opacity-40 mb-0.5">Solved</span>
                <span className="text-2xl text-amber-400 tracking-tighter">{gameState.solvedCategories}/{totalCategories}</span>
              </div>
            </div>
            <button onClick={() => startNewGame()} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95">
              New Game
            </button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto space-y-12">
          {gameState.status === 'loading' ? (
            <div className="h-[50vh] flex flex-col items-center justify-center space-y-6 text-center">
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 border-8 border-indigo-500/10 rounded-full"></div>
                <div className="absolute inset-0 border-8 border-indigo-500 border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(79,70,229,0.2)]"></div>
              </div>
              <p className="text-2xl font-black text-indigo-200 animate-pulse uppercase tracking-[0.2em]">Preparing Journey...</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 items-start justify-center">
                <div className="flex flex-col items-center gap-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 opacity-60">Deck</span>
                  <section className="flex gap-6 bg-slate-900/30 p-6 rounded-[2.5rem] border border-slate-800/50 shadow-2xl backdrop-blur-md">
                    <div onClick={handleStockClick} className="relative cursor-pointer group">
                      <div className={`w-24 h-36 md:w-28 md:h-40 rounded-3xl border-4 transition-all duration-300 flex items-center justify-center overflow-hidden
                        ${gameState.stock.length > 0 
                          ? 'bg-indigo-800 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.3)] group-hover:scale-105' 
                          : 'bg-slate-900 border-slate-800 cursor-default'}
                      `}>
                         {gameState.stock.length > 0 ? (
                           <>
                             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500 to-indigo-900 opacity-50"></div>
                             <span className="relative z-10 text-xl font-black text-white drop-shadow-md">
                               {gameState.stock.length}
                             </span>
                           </>
                         ) : (
                           <div className="flex flex-col items-center opacity-30 text-indigo-400">
                             <div className="text-3xl mb-1">↻</div>
                             <span className="text-[8px] font-black uppercase tracking-widest">Empty</span>
                           </div>
                         )}
                      </div>
                    </div>
                    <div onClick={handleWasteCardClick} className="relative cursor-pointer">
                      {gameState.waste.length === 0 ? (
                        <div className="w-24 h-36 md:w-28 md:h-40 rounded-3xl border-4 border-dashed border-slate-800/20 bg-slate-950/20 flex items-center justify-center">
                          <span className="text-[8px] font-black uppercase text-slate-800 tracking-widest opacity-30 text-center">Empty<br/>Waste</span>
                        </div>
                      ) : (
                        <div className="relative group">
                          <Card 
                            card={gameState.waste[gameState.waste.length - 1]} 
                            onClick={handleWasteCardClick} 
                            onDragStart={(e) => handleDragStart(e, 0, gameState.waste.length - 1, 'waste')}
                            onDragEnd={handleDragEnd}
                            isSelected={gameState.selectedCard?.source === 'waste'}
                            isDragging={gameState.selectedCard?.source === 'waste'}
                          />
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                <div className="flex flex-col items-center gap-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 opacity-60">Foundations (4 Slots)</span>
                  <section className="bg-slate-900/40 p-6 rounded-[3rem] border border-slate-800/50 shadow-inner flex flex-wrap justify-center gap-4 min-h-[160px] max-w-4xl">
                    {gameState.foundations.map((pile, fIdx) => {
                      const targetWords = pile.length > 0 ? getTargetCountForCategory(pile[0].category) : 0;
                      const currentWords = pile.length > 0 ? pile.length - 1 : 0;
                      const isFull = pile.length > 0 && currentWords === targetWords;
                      const isClearing = clearingSlot === fIdx;
                      const isDragOver = dragOverPile?.type === 'foundation' && dragOverPile.index === fIdx;

                      return (
                        <div 
                          key={fIdx} 
                          onClick={() => handleFoundationClick(fIdx)} 
                          onDragOver={(e) => handleDragOver(e, 'foundation', fIdx)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, 'foundation', fIdx)}
                          className={`relative flex flex-col items-center min-h-[160px] transition-all duration-500 
                            ${isClearing ? 'scale-0 opacity-0 blur-lg -translate-y-12' : ''}
                            ${isDragOver ? 'scale-110' : ''}
                          `}
                        >
                          {pile.length === 0 ? (
                            <div className={`w-24 h-36 md:w-28 md:h-40 rounded-3xl border-4 border-dashed flex items-center justify-center group transition-all bg-slate-950/20 shadow-inner
                              ${gameState.selectedCard || isDragOver ? 'border-indigo-500/60 animate-pulse scale-105' : 'border-slate-800/40'}`}>
                              <span className="text-2xl opacity-10">★</span>
                            </div>
                          ) : (
                            <div className={`relative transition-all ${isDragOver ? 'ring-4 ring-indigo-500 rounded-3xl' : ''}`}>
                               <Card 
                                 card={pile[0]} 
                                 onClick={() => {}} 
                                 targetCount={targetWords}
                                 currentCount={currentWords}
                               />
                               {isFull && (
                                <div className="absolute inset-0 flex items-center justify-center z-[60] bg-black/40 rounded-xl backdrop-blur-sm border-2 border-emerald-500 animate-pulse">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-white bg-emerald-500 px-3 py-1 rounded-full shadow-lg">SOLVED</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </section>
                </div>
              </div>

              <div className="flex items-center justify-center gap-6 opacity-20 py-4">
                <div className="h-px w-full max-w-[200px] bg-gradient-to-r from-transparent to-indigo-500"></div>
                <span className="text-[11px] font-black uppercase tracking-[0.6em] whitespace-nowrap italic tracking-[1em] pl-[1em]">WORD FIELD</span>
                <div className="h-px w-full max-w-[200px] bg-gradient-to-l from-transparent to-indigo-500"></div>
              </div>

              <section className="px-2">
                <div className="flex flex-wrap gap-4 md:gap-6 justify-center max-w-[1400px] mx-auto items-start">
                  {gameState.tableau.map((pile, pIdx) => {
                    const isDragOver = dragOverPile?.type === 'tableau' && dragOverPile.index === pIdx;
                    return (
                      <div 
                        key={pIdx} 
                        onDragOver={(e) => handleDragOver(e, 'tableau', pIdx)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, 'tableau', pIdx)}
                        className={`flex flex-col items-center min-h-[400px] transition-all rounded-3xl p-1 ${isDragOver ? 'bg-indigo-500/10 ring-2 ring-indigo-500/30' : ''}`}
                      >
                        {pile.length === 0 ? (
                          <div 
                            onClick={() => handleEmptyTableauClick(pIdx)} 
                            className={`w-24 h-36 md:w-28 md:h-40 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all
                              ${gameState.selectedCard || isDragOver
                                ? 'border-indigo-500 bg-indigo-500/5 shadow-[0_0_20px_rgba(99,102,241,0.2)] scale-105' 
                                : 'border-slate-800/60 bg-slate-900/10 hover:border-slate-600'}
                            `}
                          >
                            <span className={`text-[10px] font-black uppercase tracking-widest transition-opacity mb-2 ${gameState.selectedCard ? 'text-indigo-400 opacity-100' : 'text-slate-700 opacity-40'}`}>
                              {gameState.selectedCard ? 'Drop Here' : 'Open'}
                            </span>
                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${gameState.selectedCard ? 'border-indigo-500 text-indigo-400' : 'border-slate-800 text-slate-800'}`}>
                               {gameState.selectedCard ? '↓' : '+'}
                            </div>
                          </div>
                        ) : (
                          pile.map((card, cIdx) => (
                            <Card 
                              key={card.id} 
                              card={card} 
                              onClick={() => handleTableauCardClick(pIdx, cIdx)} 
                              onDragStart={(e) => handleDragStart(e, pIdx, cIdx, 'tableau')}
                              onDragEnd={handleDragEnd}
                              isSelected={gameState.selectedCard?.source === 'tableau' && gameState.selectedCard.pileIndex === pIdx && cIdx >= gameState.selectedCard.cardIndex} 
                              isDragging={gameState.selectedCard?.source === 'tableau' && gameState.selectedCard.pileIndex === pIdx && cIdx >= gameState.selectedCard.cardIndex}
                              stacked={cIdx > 0} 
                            />
                          ))
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </main>
      </div>

      {/* Overlays */}
      {gameState.status === 'gameOver' && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[100] animate-in fade-in duration-500">
          <div className="bg-slate-900 p-12 rounded-[3rem] border-2 border-rose-500/50 shadow-[0_0_50px_rgba(244,63,94,0.1)] text-center max-w-sm transform animate-in zoom-in duration-300">
            <div className="text-7xl mb-6 grayscale opacity-50">🎲</div>
            <h2 className="text-4xl font-black mb-4 text-white uppercase italic tracking-tighter">No Moves Left</h2>
            <p className="text-rose-200 opacity-60 mb-10 text-sm font-bold uppercase tracking-widest leading-relaxed">The word associations have reached a dead end.</p>
            <button onClick={() => startNewGame()} className="w-full py-5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-lg font-black uppercase tracking-widest transition-all shadow-xl active:scale-95">
              Try Again
            </button>
          </div>
        </div>
      )}

      {gameState.status === 'won' && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center z-[100] animate-in fade-in duration-700">
          <div className="bg-slate-900 p-12 rounded-[3.5rem] border-2 border-emerald-500/50 shadow-[0_0_60px_rgba(16,185,129,0.2)] text-center max-w-lg transform animate-in zoom-in duration-500">
            <div className="text-8xl mb-8 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]">✨</div>
            <h2 className="text-5xl font-black mb-2 text-white italic uppercase tracking-tighter leading-none">Brilliant!</h2>
            <p className="text-emerald-300 opacity-60 mb-10 text-sm font-bold uppercase tracking-widest">You solved all the semantic groups!</p>
            <div className="bg-slate-950/60 p-8 rounded-[2.5rem] mb-12 border border-slate-800 flex justify-around items-center shadow-inner">
               <div className="text-center">
                 <span className="block text-[10px] uppercase text-slate-500 font-black mb-2 tracking-widest">Final Moves</span>
                 <span className="text-5xl font-black text-white">{gameState.moves}</span>
              </div>
            </div>
            <button onClick={() => startNewGame()} className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[1.5rem] text-xl font-black uppercase tracking-widest transition-all shadow-xl active:scale-95">
              Next Journey
            </button>
          </div>
        </div>
      )}

      <footer className="bg-slate-950/90 backdrop-blur-xl p-4 text-center border-t border-slate-800/50 z-50">
         <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-[9px] font-black uppercase tracking-[0.25em]">
            <p className="text-indigo-400/60">Semantic Puzzle &bull; Find {totalCategories} Logical Groups</p>
            <p className="text-slate-600">Tip: Link the word's meaning to the <span className="text-indigo-400">Master Card's</span> category!</p>
         </div>
      </footer>
    </div>
  );
};

export default App;
