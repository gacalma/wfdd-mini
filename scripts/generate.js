import Parser from 'rss-parser';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { generateClueLLM } from './llmClues.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(__dirname);

const WFDD_LOCAL = "https://www.wfdd.org/local.rss";
const NPR_TOP = "https://www.wfdd.org/tags/npr-top-stories.rss";

// Fixed 5x5 pattern for consistent 10-word puzzles
const GRID_PATTERN = [
  '.', '.', '.', '.', '.',
  '.', '#', '.', '.', '.',
  '.', '.', '.', '.', '.',
  '.', '.', '.', '#', '.',
  '.', '.', '.', '.', '.'
];

// Fallback words if RSS fails or no good candidates
const FALLBACK_WORDS = {
  5: ['RIVER', 'RADIO', 'WFDD'],
  4: ['CITY', 'NEWS', 'PARK'],
  3: ['AIR', 'NPR', 'WIN']
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
  
  // Extract words from each story individually to track sources
  stories.forEach((story, storyIndex) => {
    const text = `${story.title} ${story.summary}`;
    const words = text
      .split(/\s+/)
      .map(normalizeWord)
      .filter(w => w.length >= 3 && w.length <= 7)
      .filter(w => !stopwords.has(w))
      .filter(w => /^[A-Z]+$/.test(w));
    
    words.forEach(word => {
      if (!wordSources[word]) {
        wordSources[word] = story; // track first occurrence
        allWords.push(word);
      }
    });
  });

  // Count occurrences across all stories
  const counts = {};
  stories.forEach(story => {
    const text = `${story.title} ${story.summary}`;
    const words = text
      .split(/\s+/)
      .map(normalizeWord)
      .filter(w => w.length >= 3 && w.length <= 7)
      .filter(w => !stopwords.has(w))
      .filter(w => /^[A-Z]+$/.test(w));
    
    words.forEach(w => counts[w] = (counts[w] || 0) + 1);
  });

  // Sort by uniqueness (count=1 first), then alphabetically
  const sorted = Object.keys(counts).sort((a, b) => {
    if (counts[a] !== counts[b]) return counts[a] - counts[b];
    return a.localeCompare(b);
  });

  return { words: uniqueByOrder(sorted), wordSources };
}

function buildCrosswordGrid(candidates, wordSources = {}) {
  const size = 5;
  const grid = [...GRID_PATTERN];
  const { starts } = computeNumbering(grid, size);
  
  // Group candidates by length
  const byLength = {};
  candidates.forEach(word => {
    if (!byLength[word.length]) byLength[word.length] = [];
    byLength[word.length].push(word);
  });

  // Get slot requirements
  const acrossSlots = Object.values(starts.across);
  const downSlots = Object.values(starts.down);
  
  const solution = new Array(25).fill('');
  const usedWords = new Set();
  const usedWordSources = {}; // track sources of actually used words

  // Helper to check if word fits in slot
  function canPlace(word, slot) {
    if (usedWords.has(word)) return false;
    if (word.length !== slot.length) return false;
    
    for (let i = 0; i < slot.length; i++) {
      const pos = slot[i];
      if (solution[pos] && solution[pos] !== word[i]) {
        return false;
      }
    }
    return true;
  }

  // Helper to place word in slot
  function placeWord(word, slot) {
    for (let i = 0; i < slot.length; i++) {
      solution[slot[i]] = word[i];
    }
    usedWords.add(word);
    if (wordSources[word]) {
      usedWordSources[word] = wordSources[word];
    }
  }

  // Helper to remove word from slot
  function removeWord(word, slot) {
    for (let i = 0; i < slot.length; i++) {
      solution[slot[i]] = '';
    }
    usedWords.delete(word);
    delete usedWordSources[word];
  }

  // Try to fill slots with backtracking
  function fillSlots(slots, isAcross, depth = 0) {
    if (depth >= slots.length) return true;
    if (depth > 10) return false; // prevent infinite recursion
    
    const slot = slots[depth];
    const candidates = byLength[slot.length] || [];
    
    for (const word of candidates) {
      if (canPlace(word, slot)) {
        placeWord(word, slot);
        if (fillSlots(slots, isAcross, depth + 1)) {
          return true;
        }
        removeWord(word, slot);
      }
    }
    return false;
  }

  // Try to fill with candidates first
  let success = fillSlots(acrossSlots, true) && fillSlots(downSlots, false);

  // If failed, use fallback words
  if (!success) {
    console.log('Falling back to built-in words');
    solution.fill('');
    usedWords.clear();
    
    const allSlots = [...acrossSlots, ...downSlots];
    const fallbackCandidates = [];
    
    // Build fallback list
    Object.entries(FALLBACK_WORDS).forEach(([len, words]) => {
      words.forEach(word => {
        if (!fallbackCandidates.includes(word)) {
          fallbackCandidates.push(word);
        }
      });
    });

    // Simple greedy fill with fallbacks
    for (const slot of allSlots) {
      const len = slot.length;
      const available = fallbackCandidates.filter(w => 
        w.length === len && !usedWords.has(w)
      );
      
      if (available.length > 0) {
        const word = available[0];
        let canFit = true;
        
        // Check conflicts
        for (let i = 0; i < slot.length; i++) {
          const pos = slot[i];
          if (solution[pos] && solution[pos] !== word[i]) {
            canFit = false;
            break;
          }
        }
        
        if (canFit) {
          placeWord(word, slot);
        }
      }
    }
  }

  // Build final grid
  const finalGrid = new Array(25);
  for (let i = 0; i < 25; i++) {
    if (grid[i] === '#') {
      finalGrid[i] = '#';
    } else {
      finalGrid[i] = solution[i] || 'A'; // fallback letter
    }
  }

  return { grid: finalGrid, usedWords: Array.from(usedWords), usedWordSources };
}

async function generateClues(grid, stories, usedWords, usedWordSources) {
  const size = 5;
  const { starts, numMap } = computeNumbering(grid, size);
  const clues = { across: {}, down: {} };

  // Helper to create heuristic clue text (fallback)
  function makeHeuristicClue(word) {
    // Try to find word in story titles first
    for (const story of stories) {
      if (story.title.toUpperCase().includes(word)) {
        // Simple title truncation
        const title = story.title.length > 40 ? 
          story.title.substring(0, 37) + '...' : 
          story.title;
        return `From: ${title}`;
      }
    }
    
    // Fallback clues based on word
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

  // Collect all clue entries
  const acrossEntries = Object.entries(starts.across).map(([num, cells]) => {
    const answer = cells.map(i => grid[i]).join('');
    const source = usedWordSources[answer];
    return {
      number: num,
      answer,
      sourceTitle: source?.title || '',
      sourceUrl: source?.link || ''
    };
  });

  const downEntries = Object.entries(starts.down).map(([num, cells]) => {
    const answer = cells.map(i => grid[i]).join('');
    const source = usedWordSources[answer];
    return {
      number: num,
      answer,
      sourceTitle: source?.title || '',
      sourceUrl: source?.link || ''
    };
  });

  // Helper for concurrent LLM calls with limits
  async function generateCluesWithLLM(entries, maxLLMCalls) {
    let llmCallCount = 0;
    const results = {};
    
    // Process in batches of 2 (concurrency limit)
    const batchSize = 2;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      const promises = batch.map(async (entry) => {
        if (llmCallCount >= maxLLMCalls) {
          return { ...entry, clue: makeHeuristicClue(entry.answer) };
        }
        
        llmCallCount++;
        console.log(`Generating LLM clue for ${entry.answer} (${llmCallCount}/${maxLLMCalls})`);
        
        const llmClue = await generateClueLLM({
          answer: entry.answer,
          title: entry.sourceTitle,
          url: entry.sourceUrl
        });
        
        return {
          ...entry,
          clue: llmClue || makeHeuristicClue(entry.answer)
        };
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
    
    const { words: candidates, wordSources } = extractCandidateWords(stories, stopwords);
    console.log(`Extracted ${candidates.length} candidate words:`, candidates.slice(0, 10));
    
    const { grid, usedWords, usedWordSources } = buildCrosswordGrid(candidates, wordSources);
    console.log(`Built grid with words:`, usedWords);
    
    const clues = await generateClues(grid, stories, usedWords, usedWordSources);
    
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
    
    // Write to file
    const outputPath = join(projectRoot, 'public/puzzles', `${dateStr}.json`);
    writeFileSync(outputPath, JSON.stringify(puzzle, null, 2));
    
    console.log(`✅ Puzzle generated successfully: ${outputPath}`);
    console.log(`📰 Used ${sourceUrls.length} source URLs`);
    
  } catch (error) {
    console.error('❌ Puzzle generation failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generatePuzzle();
}

export { generatePuzzle };