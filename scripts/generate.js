import Parser from 'rss-parser';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { generateClueLLM, selectCrosswordWordsLLM } from './llmClues.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(__dirname);

const WFDD_LOCAL = "https://www.wfdd.org/mini.rss";
const NPR_TOP = "https://feeds.npr.org/1001/rss.xml";

// Multiple 5x5 crossword patterns for variety (substantial puzzles only)
const GRID_TEMPLATES = {
  // Template 0: Simple separate words (no intersections for debugging)
  simple: {
    pattern: [
      '.', '.', '.', '.', '.',
      '#', '#', '#', '#', '#',
      '.', '.', '.', '.', '.',
      '#', '#', '#', '#', '#',
      '.', '.', '.', '.', '.'
    ],
    words: [
      { type: 'across', row: 0, col: 0, length: 5, number: 1 },
      { type: 'across', row: 2, col: 0, length: 5, number: 6 },
      { type: 'across', row: 4, col: 0, length: 5, number: 11 }
    ]
  }

  // Template 1: Dense mini (6 words: mix of 3,4,5 letters)
  /*dense: {
    pattern: [
      '.', '.', '.', '.', '.',
      '.', '#', '.', '#', '.',
      '.', '.', '.', '.', '.',
      '.', '#', '.', '#', '.',
      '.', '.', '.', '.', '.'
    ],
    words: [
      { type: 'across', row: 0, col: 0, length: 5, number: 1 },
      { type: 'across', row: 2, col: 0, length: 5, number: 6 },
      { type: 'across', row: 4, col: 0, length: 5, number: 11 },
      { type: 'down', row: 0, col: 0, length: 5, number: 1 },
      { type: 'down', row: 0, col: 2, length: 5, number: 3 },
      { type: 'down', row: 0, col: 4, length: 5, number: 5 }
    ]
  },

  // Template 2: Staggered (7 words: varied lengths)
  staggered: {
    pattern: [
      '.', '.', '.', '#', '#',
      '#', '.', '.', '.', '.',
      '.', '.', '#', '.', '#',
      '.', '.', '.', '.', '.',
      '#', '#', '.', '.', '.'
    ],
    words: [
      { type: 'across', row: 0, col: 0, length: 3, number: 1 },
      { type: 'across', row: 1, col: 1, length: 4, number: 4 },
      { type: 'across', row: 3, col: 0, length: 5, number: 8 },
      { type: 'across', row: 4, col: 2, length: 3, number: 13 },
      { type: 'down', row: 0, col: 0, length: 4, number: 1 },
      { type: 'down', row: 0, col: 2, length: 3, number: 3 },
      { type: 'down', row: 1, col: 4, length: 4, number: 7 }
    ]
  },

  // Template 3: Corners (8 words: corner-focused design)
  corners: {
    pattern: [
      '.', '.', '#', '.', '.',
      '.', '#', '#', '#', '.',
      '#', '#', '.', '#', '#',
      '.', '#', '#', '#', '.',
      '.', '.', '#', '.', '.'
    ],
    words: [
      { type: 'across', row: 0, col: 0, length: 2, number: 1 },
      { type: 'across', row: 0, col: 3, length: 2, number: 3 },
      { type: 'across', row: 2, col: 2, length: 1, number: 5 }, // Single letter intersection
      { type: 'across', row: 4, col: 0, length: 2, number: 6 },
      { type: 'across', row: 4, col: 3, length: 2, number: 8 },
      { type: 'down', row: 0, col: 0, length: 2, number: 1 },
      { type: 'down', row: 0, col: 2, length: 5, number: 2 },
      { type: 'down', row: 0, col: 4, length: 2, number: 4 }
    ]
  },

  // Template 4: Simple grid (4 words: minimal crossings)  
  mini: {
    pattern: [
      '.', '.', '.', '.', '.',
      '#', '#', '#', '#', '#',
      '.', '.', '.', '.', '.',
      '#', '#', '#', '#', '#',
      '.', '.', '.', '.', '.'
    ],
    words: [
      { type: 'across', row: 0, col: 0, length: 5, number: 1 },
      { type: 'across', row: 2, col: 0, length: 5, number: 6 },
      { type: 'across', row: 4, col: 0, length: 5, number: 11 },
      { type: 'down', row: 0, col: 2, length: 5, number: 3 }
    ]
  },

  // Template 5: Overlapping (8 words: maximum intersections)
  overlapping: {
    pattern: [
      '.', '.', '.', '.', '.',
      '#', '.', '.', '.', '#',
      '.', '.', '.', '.', '.',
      '#', '.', '.', '.', '#',
      '.', '.', '.', '.', '.'
    ],
    words: [
      { type: 'across', row: 0, col: 0, length: 5, number: 1 },
      { type: 'across', row: 1, col: 1, length: 3, number: 6 },
      { type: 'across', row: 2, col: 0, length: 5, number: 8 },
      { type: 'across', row: 3, col: 1, length: 3, number: 13 },
      { type: 'across', row: 4, col: 0, length: 5, number: 15 },
      { type: 'down', row: 0, col: 1, length: 5, number: 2 },
      { type: 'down', row: 0, col: 2, length: 5, number: 3 },
      { type: 'down', row: 0, col: 3, length: 5, number: 4 }
    ]
  }*/
};

// Fallback words if RSS fails or no good candidates
const FALLBACK_WORDS = {
  5: ['RADIO', 'WFDD', 'GRANT', 'STATE', 'LOCAL'],
  4: ['NEWS', 'CITY', 'VOTE', 'BILL', 'FUND'],
  3: ['NPR', 'LAW', 'TAX', 'ICE', 'CBD']
};

function normalizeWord(w) {
  return w.replace(/[^A-Z]/g, '').toUpperCase();
}

function loadStopwords() {
  try {
    const content = readFileSync(join(projectRoot, 'data/stopwords.txt'), 'utf-8');
    return new Set(content.split('\n').map(w => w.trim().toUpperCase()).filter(w => w));
  } catch (e) {
    console.warn('Could not load stopwords.txt, using empty set');
    return new Set();
  }
}

function uniqueByOrder(arr) {
  const seen = new Set();
  return arr.filter(item => {
    if (seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}

function computeNumbering(grid, size) {
  const starts = { across: {}, down: {} };
  const numMap = {};
  let num = 0;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const i = r * size + c;
      if (grid[i] === '#') continue;

      const startAcross = (c === 0 || grid[r * size + c - 1] === '#');
      const startDown = (r === 0 || grid[(r - 1) * size + c] === '#');

      if (startAcross || startDown) {
        num++;
        numMap[i] = num;

        if (startAcross) {
          const cells = [];
          let cc = c;
          while (cc < size && grid[r * size + cc] !== '#') {
            cells.push(r * size + cc);
            cc++;
          }
          if (cells.length > 1) starts.across[num] = cells;
        }

        if (startDown) {
          const cells = [];
          let rr = r;
          while (rr < size && grid[rr * size + c] !== '#') {
            cells.push(rr * size + c);
            rr++;
          }
          if (cells.length > 1) starts.down[num] = cells;
        }
      }
    }
  }

  return { starts, numMap };
}

async function fetchRSSFeeds() {
  const parser = new Parser();
  const feeds = [];

  try {
    console.log('Fetching WFDD local RSS...');
    const wfddFeed = await parser.parseURL(WFDD_LOCAL);
    const wfddItems = wfddFeed.items.slice(0, 20).map(item => ({
      title: item.title || '',
      link: item.link || '',
      summary: item.contentSnippet || item.content || '',
      source: 'wfdd'
    }));
    feeds.push(...wfddItems);
    console.log(`Got ${wfddItems.length} WFDD items`);
  } catch (e) {
    console.warn('Failed to fetch WFDD RSS:', e.message);
  }

  try {
    console.log('Fetching NPR top stories RSS...');
    const nprFeed = await parser.parseURL(NPR_TOP);
    const nprItems = nprFeed.items.slice(0, 20).map(item => ({
      title: item.title || '',
      link: item.link || '',
      summary: item.contentSnippet || item.content || '',
      source: 'npr'
    }));
    feeds.push(...nprItems);
    console.log(`Got ${nprItems.length} NPR items`);
  } catch (e) {
    console.warn('Failed to fetch NPR RSS:', e.message);
  }

  return feeds;
}

function pickStories(feeds) {
  const wfddItems = feeds.filter(item => item.source === 'wfdd');
  const nprItems = feeds.filter(item => item.source === 'npr');
  
  const selected = [];
  const sourceUrls = [];

  // Pick 4 WFDD local items
  for (let i = 0; i < Math.min(4, wfddItems.length); i++) {
    selected.push(wfddItems[i]);
    sourceUrls.push(wfddItems[i].link);
  }

  // Pick 1 NPR item
  if (nprItems.length > 0) {
    selected.push(nprItems[0]);
    sourceUrls.push(nprItems[0].link);
  }

  return { selected, sourceUrls: sourceUrls.slice(0, 5) };
}

function extractCandidateWords(stories, stopwords) {
  const wordSources = {}; // track which story each word came from
  const allWords = [];
  
  // Common crossword-friendly news words to look for
  const newsKeywords = new Set([
    'GRANT', 'CITY', 'STATE', 'COUNTY', 'LOCAL', 'BILL', 'LAW', 'VOTE', 
    'FUND', 'MONEY', 'COURT', 'JUDGE', 'MAYOR', 'BOARD', 'HOUSE', 'SENATE',
    'SCHOOL', 'CHILD', 'FAMILY', 'WORK', 'JOB', 'PLAN', 'ROAD', 'PARK',
    'WATER', 'FIRE', 'POLICE', 'HEALTH', 'CARE', 'HELP', 'NEED', 'YEAR',
    'TIME', 'AREA', 'GROUP', 'TEAM', 'GAME', 'PLAY', 'WIN', 'LOSS'
  ]);
  
  // Enhanced word extraction with smarter filtering for LLM usage
  stories.forEach((story, storyIndex) => {
    const titleText = story.title || '';
    const summaryText = story.summary || '';
    
    // Extract ALL words from title and summary (be more liberal)
    const titleWords = titleText
      .split(/\s+/)
      .map(normalizeWord)
      .filter(w => w.length >= 3 && w.length <= 8) // Allow longer words
      .filter(w => !stopwords.has(w.toLowerCase())) // Check lowercase stopwords
      .filter(w => /^[A-Z]+$/.test(w));
    
    // Get summary words (extract more aggressively)
    const summaryWords = summaryText
      .split(/\s+/)
      .map(normalizeWord)  
      .filter(w => w.length >= 3 && w.length <= 8) // Allow longer words
      .filter(w => !stopwords.has(w.toLowerCase())) // Check lowercase stopwords  
      .filter(w => /^[A-Z]+$/.test(w));
    
    // Process title words first (higher priority)
    titleWords.forEach(word => {
      if (!wordSources[word]) {
        wordSources[word] = { 
          ...story, 
          wordContext: 'title',
          priority: 1
        };
        allWords.push(word);
      }
    });
    
    // Then summary words (lower priority, skip if already in title)
    summaryWords.forEach(word => {
      if (!wordSources[word]) {
        wordSources[word] = { 
          ...story, 
          wordContext: 'summary',
          priority: 2
        };
        allWords.push(word);
      }
    });
  });

  // Enhanced sorting: prioritize title words and proper nouns
  const counts = {};
  const allText = stories.map(s => `${s.title} ${s.summary}`).join(' ');
  
  allWords.forEach(word => {
    // Count total occurrences
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    counts[word] = (allText.match(regex) || []).length;
  });

  // Smart sorting for better crossword words
  const sorted = Object.keys(counts).sort((a, b) => {
    // First priority: local WFDD stories over national NPR
    const aIsLocal = wordSources[a]?.source === 'wfdd';
    const bIsLocal = wordSources[b]?.source === 'wfdd';
    if (aIsLocal !== bIsLocal) return bIsLocal - aIsLocal;
    
    // Second priority: crossword-friendly news words
    const aIsFriendly = newsKeywords.has(a);
    const bIsFriendly = newsKeywords.has(b);
    if (aIsFriendly !== bIsFriendly) return bIsFriendly - aIsFriendly;
    
    // Third priority: words from titles
    const aPriority = wordSources[a]?.priority || 3;
    const bPriority = wordSources[b]?.priority || 3;
    if (aPriority !== bPriority) return aPriority - bPriority;
    
    // Third priority: uniqueness (prefer words appearing once)
    if (counts[a] !== counts[b]) return counts[a] - counts[b];
    
    // Fourth priority: alphabetical
    return a.localeCompare(b);
  });

  // If we have very few candidates, extract more aggressively
  let finalWords = uniqueByOrder(sorted);
  // Remove ambiguous directional or non-useful single words that often break clues
  const BAD_SINGLE_WORDS = new Set(['NORTH','SOUTH','EAST','WEST','NEW','OLD','THE','A','AN']);
  finalWords = finalWords.filter(w => !(w.length <= 4 && BAD_SINGLE_WORDS.has(w)));
  if (finalWords.length < 15) {
    console.log(`Only ${finalWords.length} candidates found, extracting more words...`);
    
    // Extract more words with looser restrictions
    stories.forEach(story => {
      const allText = `${story.title} ${story.summary}`.toUpperCase();
      const moreWords = allText
        .split(/\W+/)
        .filter(w => w.length >= 3 && w.length <= 6)
        .filter(w => /^[A-Z]+$/.test(w))
        .filter(w => !stopwords.has(w.toLowerCase()))
        .filter(w => !finalWords.includes(w));
      
      moreWords.forEach(word => {
        if (!wordSources[word]) {
          wordSources[word] = { ...story, priority: 3 };
          finalWords.push(word);
        }
      });
    });
  }

  console.log(`Enhanced word extraction: ${finalWords.length} candidates, ${Object.keys(wordSources).filter(w => wordSources[w].priority === 1).length} from titles`);
  
  return { words: finalWords, wordSources };
}

function buildCrosswordGrid(llmWords, candidates, wordSources = {}, preselectedTemplate = null) {
  // Use preselected template or randomly select one
  const templateName = preselectedTemplate || Object.keys(GRID_TEMPLATES)[Math.floor(Math.random() * Object.keys(GRID_TEMPLATES).length)];
  const template = GRID_TEMPLATES[templateName];
  
  console.log(`Selected template: ${templateName} with ${template.words.length} words`);
  
  let selectedWords = llmWords;
  
  // Fallback to heuristic selection if LLM fails
  if (!selectedWords || selectedWords.length !== template.words.length) {
    console.log('LLM word selection failed, using heuristic fallback');
    
    // Group candidates by length
    const byLength = {};
    candidates.forEach(word => {
      if (!byLength[word.length]) byLength[word.length] = [];
      byLength[word.length].push(word);
    });
    
    // Fallback words by length (diverse vocabulary)
    const fallbackWords = {
      2: ['NO', 'GO', 'UP', 'IN', 'ON', 'AT', 'TO', 'OF', 'IT', 'IS', 'WE', 'MY'],
      3: ['THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'HAD', 'DAY', 'GET', 'USE', 'MAN', 'NEW', 'NOW', 'WAY', 'MAY', 'SAY', 'CAR', 'BOY', 'SUN', 'DOG', 'CAT', 'RUN', 'WIN', 'LAW', 'WAR', 'AIR', 'SEA'],
      4: ['NEWS', 'CITY', 'TIME', 'WORK', 'YEAR', 'AREA', 'PLAN', 'TEAM', 'PARK', 'ROAD', 'FOOD', 'GAME', 'BOOK', 'WORD', 'LIFE', 'FIRE', 'WIND', 'RAIN', 'SNOW', 'TREE', 'DOOR', 'WALL', 'HOME', 'LOVE'],
      5: ['RADIO', 'STATE', 'COURT', 'MONEY', 'HOUSE', 'WATER', 'BOARD', 'MUSIC', 'WORLD', 'STORY', 'LIGHT', 'SOUND', 'VOICE', 'PLACE', 'POWER', 'PEACE', 'HAPPY', 'SMILE', 'LAUGH', 'DANCE', 'HEART', 'DREAM', 'TRUTH', 'HONOR']
    };
    
    selectedWords = [];
    // Select words in the exact order needed by template
    template.words.forEach((wordSpec, index) => {
      const requiredLength = wordSpec.length;
      
      // First try extracted candidates of the right length
      const available = byLength[requiredLength] || [];
      let word = available.find(w => !selectedWords.includes(w));
      
      // If no candidates available, try fallback words
      if (!word) {
        const fallbacks = fallbackWords[requiredLength] || [];
        word = fallbacks.find(w => !selectedWords.includes(w));
      }
      
      // If still no word, generate a unique placeholder
      if (!word) {
        word = 'WORD' + (selectedWords.length + 1);
        // Pad or trim to correct length
        if (word.length < requiredLength) {
          word = word.padEnd(requiredLength, 'X');
        } else if (word.length > requiredLength) {
          word = word.slice(0, requiredLength);
        }
      }
      
      selectedWords.push(word);
    });
  }
  
  console.log('Using crossword words:', selectedWords);
  
  // Build grid using template
  const grid = [...template.pattern];
  const usedWords = [];
  
  // Place words according to template
  template.words.forEach((wordSpec, index) => {
    const word = selectedWords[index] || 'A'.repeat(wordSpec.length);
    usedWords.push(word);
    
    if (wordSpec.type === 'across') {
      for (let i = 0; i < wordSpec.length; i++) {
        const pos = wordSpec.row * 5 + wordSpec.col + i;
        grid[pos] = word[i];
      }
    } else if (wordSpec.type === 'down') {
      for (let i = 0; i < wordSpec.length; i++) {
        const pos = (wordSpec.row + i) * 5 + wordSpec.col;
        grid[pos] = word[i];
      }
    }
  });
  
  const usedWordSources = {};
  
  // Map sources for used words
  for (const word of usedWords) {
    if (wordSources[word]) {
      usedWordSources[word] = wordSources[word];
    }
  }
  
  return { 
    grid, 
    usedWords, 
    usedWordSources, 
    template: templateName,
    wordSpecs: template.words
  };
}

async function generateClues(grid, stories, usedWords, usedWordSources, wordSpecs) {
  const clues = { across: {}, down: {} };

  // Helper to create heuristic clue text (fallback)
  function makeHeuristicClue(word) {
    // Try to extract a sensible short clue by finding a sentence in the story content
    // that contains the answer word, then replace the answer with a blank (____).
    function stripHtml(s){ return s ? s.replace(/<[^>]+>/g, ' ') : ''; }
    function escapeRegExp(str){ return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    const wordRe = new RegExp('\\b' + escapeRegExp(word) + '\\b', 'i');

    // US states list to detect "North Carolina" style matches
    const US_STATES = [
      'ALABAMA','ALASKA','ARIZONA','ARKANSAS','CALIFORNIA','COLORADO','CONNECTICUT','DELAWARE',
      'FLORIDA','GEORGIA','HAWAII','IDAHO','ILLINOIS','INDIANA','IOWA','KANSAS','KENTUCKY','LOUISIANA',
      'MAINE','MARYLAND','MASSACHUSETTS','MICHIGAN','MINNESOTA','MISSISSIPPI','MISSOURI','MONTANA',
      'NEBRASKA','NEVADA','NEW HAMPSHIRE','NEW JERSEY','NEW MEXICO','NEW YORK','NORTH CAROLINA','NORTH DAKOTA',
      'OHIO','OKLAHOMA','OREGON','PENNSYLVANIA','RHODE ISLAND','SOUTH CAROLINA','SOUTH DAKOTA','TENNESSEE',
      'TEXAS','UTAH','VERMONT','VIRGINIA','WASHINGTON','WEST VIRGINIA','WISCONSIN','WYOMING'
    ];

    const actionVerbs = new Set(['VOTE','VOTES','VOTED','VOTING','PLAN','PLANS','PLANNED','ANNOUNCE','ANNOUNCED','ANNOUNCES']);

    for (const story of stories) {
      const hay = stripHtml(story.content || story['content:encoded'] || story.contentSnippet || story.description || story.title || '');
      if (!hay) continue;

      // Split into sentences and search for a sentence containing the word
      const sentences = hay.split(/(?<=[.!?])\s+/);
      for (const s of sentences) {
        if (wordRe.test(s)) {
          const U = word.toUpperCase();

          // 1) If this word is part of a US state name nearby (e.g., "North Carolina"), return a state-focused clue
          const mState = s.toUpperCase().match(new RegExp("([A-Z]+\\s+" + escapeRegExp(U) + "|" + escapeRegExp(U) + "\\s+[A-Z]+)", 'i'));
          if (mState) {
            // search for any full state name in the sentence
            const up = s.toUpperCase();
            for (const st of US_STATES) {
              if (up.includes(st)) {
                return `U.S. state mentioned in story: ${st.split(' ').slice(0,2).join(' ')}`;
              }
            }
            // generic state clue
            return 'U.S. state mentioned in this story';
          }

          // 2) If the word is an action verb and sentence mentions GOP/Republican, craft an action clue
          if (actionVerbs.has(U) && /\b(GOP|REPUBLICAN|REPUBLICANS)\b/i.test(s)) {
            return `Action Republicans plan regarding the U.S. House map`;
          }

          // 3) Try to replace a multiword proper noun (up to 2 adjacent capitalized words) to avoid awkward blanks
          const multiWordRe = new RegExp('([A-Z][a-z]+(?:\\s+[A-Z][a-z]+){0,2})', 'g');
          const capitalMatches = s.match(multiWordRe) || [];
          for (const cap of capitalMatches) {
            if (new RegExp('\\b' + escapeRegExp(word) + '\\b', 'i').test(cap)) {
              const clue = s.replace(cap, '____').replace(/\s+/g, ' ').trim();
              return clue.length > 80 ? clue.slice(0,77).trim() + '...' : clue;
            }
          }

          // Default: replace the answer word with blank
          const replaced = s.replace(wordRe, '____');
          const clean = replaced.replace(/\s+/g, ' ').trim();
          const clue = clean.length > 80 ? clean.slice(0, 77).trim() + '...' : clean;
          const title = story.title || '';
          if (title && title.length < 60) return `${clue} — From: ${title}`;
          return clue;
        }
      }
    }

    // If no sentence match, try matching word in titles (but hide the word)
    for (const story of stories) {
      const title = story.title || '';
      if (title && wordRe.test(title)) {
        const clue = title.replace(wordRe, '____');
        return clue.length > 80 ? clue.slice(0,77).trim() + '...' : clue;
      }
    }

    // Friendly small fallbacks
    const fallbackClues = {
      'RIVER': 'Flows through the Triad',
      'RADIO': 'WFDD medium',
      'WFDD': 'Local public radio',
      'CITY': 'Urban area in coverage',
      'NEWS': 'What WFDD reports',
      'PARK': 'Green space',
      'AIR': 'Radio waves travel through this',
      'NPR': 'Public radio network',
      'WIN': 'Victory'
    };

    return fallbackClues[word] || 'In today\'s coverage';
  }

  // Collect clue entries based on template word specifications
  const acrossEntries = [];
  const downEntries = [];

  wordSpecs.forEach((wordSpec, index) => {
    const word = usedWords[index];
    if (!word) return;

    const source = usedWordSources[word];
    const entry = {
      number: wordSpec.number,
      answer: word,
      sourceTitle: source?.title || '',
      sourceUrl: source?.link || ''
    };

    if (wordSpec.type === 'across') {
      acrossEntries.push(entry);
    } else if (wordSpec.type === 'down') {
      downEntries.push(entry);
    }
  });

  // Helper for concurrent LLM calls with limits
  async function generateCluesWithLLM(entries, maxLLMCalls) {
    let llmCallCount = 0;
    const results = {};
    const isLLMEnabled = process.env.LLM_ENABLED === 'true';
    
    // Process in batches of 2 (concurrency limit)
    const batchSize = 2;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      const promises = batch.map(async (entry) => {
        if (llmCallCount >= maxLLMCalls || !isLLMEnabled) {
          return { ...entry, clue: makeHeuristicClue(entry.answer) };
        }
        
        llmCallCount++;
        console.log(`Generating LLM clue for ${entry.answer} (${llmCallCount}/${maxLLMCalls})`);
        
        try {
          const llmClue = await generateClueLLM({
            answer: entry.answer,
            title: entry.sourceTitle,
            url: entry.sourceUrl
          });
          
          return {
            ...entry,
            clue: llmClue || makeHeuristicClue(entry.answer)
          };
        } catch (error) {
          console.warn(`LLM clue generation failed for ${entry.answer}:`, error.message);
          return { ...entry, clue: makeHeuristicClue(entry.answer) };
        }
      });
      
      const batchResults = await Promise.all(promises);
      batchResults.forEach(result => {
        results[result.number] = result.clue;
      });
    }
    
    return results;
  }

  // Generate clues with LLM (max 8 calls total, prefer Across first)
  const maxLLMCalls = 8;
  const acrossClues = await generateCluesWithLLM(acrossEntries, Math.min(acrossEntries.length, maxLLMCalls));
  const remainingLLMCalls = Math.max(0, maxLLMCalls - acrossEntries.length);
  const downClues = await generateCluesWithLLM(downEntries, remainingLLMCalls);

  return { across: acrossClues, down: downClues };
}

async function generatePuzzle() {
  try {
    console.log('Starting puzzle generation...');
    
    const stopwords = loadStopwords();
    const feeds = await fetchRSSFeeds();
    
    if (feeds.length === 0) {
      console.log('No feeds available, using fallback mode');
    }
    
    const { selected: stories, sourceUrls } = pickStories(feeds);
    console.log(`Selected ${stories.length} stories`);
    
    // First, randomly select a template to determine word requirements
    const templateNames = Object.keys(GRID_TEMPLATES);
    const randomTemplate = templateNames[Math.floor(Math.random() * templateNames.length)];
    const template = GRID_TEMPLATES[randomTemplate];
    
    // Use LLM to intelligently select crossword words based on template
    console.log('Using LLM to select crossword words from stories...');
    const llmWords = await selectCrosswordWordsLLM(stories, template);
    if (llmWords) {
      console.log('LLM selected words:', llmWords);
    }
    
    const { words: candidates, wordSources } = extractCandidateWords(stories, stopwords);
    console.log(`Extracted ${candidates.length} candidate words:`, candidates.slice(0, 10));
    
    const { grid, usedWords, usedWordSources, template: selectedTemplate, wordSpecs } = buildCrosswordGrid(llmWords, candidates, wordSources, randomTemplate);
    console.log(`Built grid with words:`, usedWords);
    
    const clues = await generateClues(grid, stories, usedWords, usedWordSources, wordSpecs);
    
    // Create puzzle object
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    
    const puzzle = {
      id: `wfdd-mini-${dateStr}`,
      date: dateStr,
      title: "WFDD One-Minute Crossword",
      size: 5,
      grid,
      clues,
      meta: {
        source_urls: sourceUrls
      }
    };
    
    // Ensure output directory exists
    const outputDir = join(projectRoot, 'public/puzzles');
    const outputPath = join(outputDir, `${dateStr}.json`);
    
    try {
      // Create directories if they don't exist
      const fs = await import('fs/promises');
      await fs.mkdir(outputDir, { recursive: true });
      
      // Write puzzle file
      writeFileSync(outputPath, JSON.stringify(puzzle, null, 2));
      
      console.log(`✅ Puzzle generated successfully: ${outputPath}`);
      console.log(`📰 Used ${sourceUrls.length} source URLs`);
      
      // Verify file was written correctly
      const fileSize = (await fs.stat(outputPath)).size;
      console.log(`📊 Puzzle file size: ${fileSize} bytes`);
      
    } catch (writeError) {
      console.error('❌ Failed to write puzzle file:', writeError.message);
      console.error('❌ Output path:', outputPath);
      console.error('❌ Project root:', projectRoot);
      throw writeError;
    }
    
  } catch (error) {
    console.error('❌ Puzzle generation failed:', error.message);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Current working directory:', process.cwd());
    console.error('❌ Environment variables:', {
      LLM_ENABLED: process.env.LLM_ENABLED,
      NODE_ENV: process.env.NODE_ENV,
      hasAPIKey: !!process.env.OPENAI_API_KEY
    });
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generatePuzzle().catch(error => {
    console.error('❌ Unhandled error in puzzle generation:', error);
    process.exit(1);
  });
}

export { generatePuzzle };