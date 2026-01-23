
import { GameLevel, DifficultyLevel } from "../types.ts";
import { CATEGORY_COLORS, DIFFICULTY_CONFIG, MIN_WORDS_PER_CATEGORY, MAX_WORDS_PER_CATEGORY } from "../constants.ts";
import { WORD_DATABASE } from "../data/wordDatabase.ts";
import { shuffleArray } from "../utils/gameLogic.ts";

export const generateLevel = async (theme: string, difficulty: DifficultyLevel): Promise<GameLevel> => {
  // Simulate a tiny delay for UX transitions
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const config = DIFFICULTY_CONFIG[difficulty];
  const allCategories = Object.keys(WORD_DATABASE);
  const selectedCategoryNames = shuffleArray(allCategories).slice(0, config.categoryCount);
  
  const categories = selectedCategoryNames.map((name, index) => {
    const allWordsFromDB = WORD_DATABASE[name];
    
    // Randomize word count for THIS specific category (3 to 8)
    const randomWordCount = Math.floor(Math.random() * (MAX_WORDS_PER_CATEGORY - MIN_WORDS_PER_CATEGORY + 1)) + MIN_WORDS_PER_CATEGORY;
    
    // Pick unique words from the DB
    const selectedWords = shuffleArray(allWordsFromDB).slice(0, Math.min(randomWordCount, allWordsFromDB.length));
    
    return {
      name,
      words: selectedWords,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length]
    };
  });

  return {
    theme,
    difficulty,
    categories,
    targetMoves: Math.round(config.categoryCount * 15) // Slightly increased move budget for potentially larger categories
  };
};