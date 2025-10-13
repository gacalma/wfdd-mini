import Parser from 'rss-parser';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { generateClueLLM, selectCrosswordWordsLLM } from './llmClues.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(__dirname);

const WFDD_LOCAL = "https://www.wfdd.org/local.rss";
const NPR_TOP = "https://www.wfdd.org/tags/npr-top-stories.rss";

// Multiple 5x5 crossword patterns for variety
const GRID_TEMPLATES = {
  // Template 1: Standard cross (1x4-letter, 2x5-letter)
  cross: {
    pattern: [
      '.', '.', '.', '.', '.',
      '#', '#', '.', '#', '#',
      '.', '.', '.', '.', '.',
      '#', '#', '.', '#', '#',
      '.', '.', '.', '.', '.'
    ],
    words: [
      { type: 'across', row: 0, col: 0, length: 4, number: 1 },
      { type: 'across', row: 2, col: 0, length: 5, number: 6 },
      { type: 'down', row: 0, col: 2, length: 5, number: 3 }
    ]
  },

  // Template 2: L-shape (3x3-letter, 1x5-letter)
  lshape: {
    pattern: [
      '.', '.', '.', '#', '#',
      '.', '#', '.', '#', '#',
      '.', '#', '.', '.', '.',
      '.', '#', '#', '#', '.',
      '.', '.', '.', '.', '.'
    ],
    words: [
      { type: 'across', row: 0, col: 0, length: 3, number: 1 },
      { type: 'across', row: 2, col: 2, length: 3, number: 5 },
      { type: 'across', row: 4, col: 0, length: 5, number: 8 },
      { type: 'down', row: 0, col: 0, length: 5, number: 1 }
    ]
  },

  // Template 3: Plus sign (5x3-letter words)
  plus: {
    pattern: [
      '#', '#', '.', '#', '#',
      '#', '#', '.', '#', '#',
      '.', '.', '.', '.', '.',
      '#', '#', '.', '#', '#',
      '#', '#', '.', '#', '#'
    ],
    words: [
      { type: 'across', row: 2, col: 0, length: 5, number: 3 },
      { type: 'down', row: 0, col: 2, length: 5, number: 1 }
    ]
  },

  // Template 4: Diagonal (2x3-letter, 2x4-letter) 
  diagonal: {
    pattern: [
      '.', '.', '.', '#', '#',
      '.', '#', '.', '.', '#',
      '.', '#', '#', '.', '.',
      '#', '.', '.', '.', '.',
      '#', '#', '.', '.', '.'
    ],
    words: [
      { type: 'across', row: 0, col: 0, length: 3, number: 1 },
      { type: 'across', row: 1, col: 2, length: 3, number: 4 },
      { type: 'across', row: 3, col: 1, length: 4, number: 7 },
      { type: 'down', row: 0, col: 0, length: 3, number: 1 },
      { type: 'down', row: 1, col: 3, length: 4, number: 6 }
    ]
  },

  // Template 5: Mini themeless (1x3, 2x4, 1x5)
  themeless: {
    pattern: [
      '.', '.', '.', '.', '#',
      '#', '.', '#', '.', '.',
      '#', '.', '#', '.', '#',
      '.', '.', '.', '.', '.',
      '#', '.', '#', '#', '#'
    ],
    words: [
      { type: 'across', row: 0, col: 0, length: 4, number: 1 },
      { type: 'across', row: 1, col: 3, length: 2, number: 5 }, // Very short
      { type: 'across', row: 3, col: 0, length: 5, number: 7 },
      { type: 'down', row: 0, col: 1, length: 3, number: 2 },
      { type: 'down', row: 1, col: 3, length: 3, number: 5 }
    ]
  }
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
    
    // Prioritize title words (often better crossword material)
    const titleWords = titleText
      .split(/\s+/)
      .map(normalizeWord)
      .filter(w => w.length >= 3 && w.length <= 7)
      .filter(w => !stopwords.has(w))
      .filter(w => /^[A-Z]+$/.test(w));
    
    // Get summary words
    const summaryWords = summaryText
      .split(/\s+/)
      .map(normalizeWord)
      .filter(w => w.length >= 3 && w.length <= 7)
      .filter(w => !stopwords.has(w))
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

  console.log(`Enhanced word extraction: ${sorted.length} candidates, ${Object.keys(wordSources).filter(w => wordSources[w].priority === 1).length} from titles`);
  
  return { words: uniqueByOrder(sorted), wordSources };
}

function buildCrosswordGrid(llmWords, candidates, wordSources = {}, preselectedTemplate = null) {
  // Use preselected template or randomly select one
  const templateName = preselectedTemplate || Object.keys(GRID_TEMPLATES)[Math.floor(Math.random() * Object.keys(GRID_TEMPLATES).length)];
  const template = GRID_TEMPLATES[templateName];
  
  console.log(`Selected template: ${templateName} with ${template.words.length} words`);
  
  let selectedWords = llmWords;
  const requiredLengths = template.words.map(w => w.length).sort((a,b) => b-a);
  
  // Fallback to heuristic selection if LLM fails
  if (!selectedWords || selectedWords.length !== template.words.length) {
    console.log('LLM word selection failed, using heuristic fallback');
    
    // Group candidates by length
    const byLength = {};
    candidates.forEach(word => {
      if (!byLength[word.length]) byLength[word.length] = [];
      byLength[word.length].push(word);
    });
    
    // Fallback words by length
    const fallbackWords = {
      2: ['NO', 'GO', 'UP'],
      3: ['THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'HAD', 'DAY', 'GET', 'USE', 'MAN', 'NEW', 'NOW', 'WAY', 'MAY', 'SAY'],
      4: ['NEWS', 'CITY', 'TIME', 'WORK', 'YEAR', 'AREA', 'PLAN', 'TEAM'],
      5: ['RADIO', 'STATE', 'COURT', 'MONEY', 'HOUSE', 'WATER', 'BOARD']
    };
    
    selectedWords = [];
    for (const length of requiredLengths) {
      const available = byLength[length] || fallbackWords[length] || [];
      const word = available.find(w => !selectedWords.includes(w)) || 
                   fallbackWords[length]?.[0] || 'A'.repeat(length);
      selectedWords.push(word);
    }
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
    
    const { grid, usedWords, usedWordSources, template: selectedTemplate } = buildCrosswordGrid(llmWords, candidates, wordSources, randomTemplate);
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