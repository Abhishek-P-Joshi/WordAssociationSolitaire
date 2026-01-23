
import { WordCard, GameLevel } from '../types';

export const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export const createDeck = (level: GameLevel): WordCard[] => {
  const cards: WordCard[] = [];
  level.categories.forEach(category => {
    // Add the Master Card
    cards.push({
      id: `master-${category.name}-${Math.random()}`,
      word: category.name,
      category: category.name,
      color: category.color,
      isFaceUp: false,
      isMaster: true
    });
    
    // Add Associated Word Cards
    category.words.forEach(word => {
      cards.push({
        id: `word-${word}-${Math.random()}`,
        word,
        category: category.name,
        color: category.color,
        isFaceUp: false,
        isMaster: false
      });
    });
  });
  return shuffleArray(cards);
};

export const dealTableau = (deck: WordCard[], columnCount: number) => {
  const tableau: WordCard[][] = Array.from({ length: columnCount }, () => []);
  const shuffledDeck = shuffleArray([...deck]);
  
  // We want to leave some cards for the stock. 
  // Let's put roughly 2/3 of cards in tableau and 1/3 in stock.
  const tableauCardCount = Math.floor(shuffledDeck.length * 0.65);
  const tableauCards = shuffledDeck.slice(0, tableauCardCount);
  const stockCards = shuffledDeck.slice(tableauCardCount);

  // Distribute tableau cards randomly into columns
  tableauCards.forEach((card) => {
    const randomColumn = Math.floor(Math.random() * columnCount);
    tableau[randomColumn].push(card);
  });

  // Ensure every card in tableau is hidden except the top one
  tableau.forEach(pile => {
    pile.forEach((card, idx) => {
      card.isFaceUp = (idx === pile.length - 1);
    });
  });
  
  return { tableau, stock: stockCards };
};
