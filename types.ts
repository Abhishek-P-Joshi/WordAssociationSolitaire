
export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';

export interface WordCard {
  id: string;
  word: string;
  category: string;
  isFaceUp: boolean;
  color: string;
  isMaster: boolean;
}

export interface WordCategory {
  name: string;
  words: string[];
  color: string;
}

export interface GameLevel {
  theme: string;
  categories: WordCategory[];
  targetMoves: number;
  difficulty: DifficultyLevel;
}

export interface GameState {
  tableau: WordCard[][];
  foundations: WordCard[][];
  stock: WordCard[];
  waste: WordCard[];
  selectedCard: { pileIndex: number; cardIndex: number; source: 'tableau' | 'foundation' | 'waste' } | null;
  status: 'loading' | 'playing' | 'won' | 'gameOver' | 'finished';
  moves: number;
  targetMoves: number;
  solvedCategories: number;
  hintsRemaining: number;
  undosRemaining: number;
  hintHighlight: {
    source: { type: 'tableau' | 'waste' | 'stock'; pileIndex: number; cardIndex: number } | null;
    target: { type: 'tableau' | 'foundation'; index: number } | null;
  } | null;
}
