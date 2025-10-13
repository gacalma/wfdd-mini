import 'dotenv/config';
import OpenAI from 'openai';
import crypto from 'node:crypto';
import { JSDOM } from 'jsdom';
import fs from 'node:fs/promises';

const client = process.env.LLM_ENABLED === 'true' && process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';
const CACHE_PATH = 'data/clue-cache.json';

async function loadCache(){
  try { return JSON.parse(await fs.readFile(CACHE_PATH, 'utf8')); } catch { return {}; }
}
async function saveCache(obj){
  await fs.mkdir('data', { recursive: true });
  await fs.writeFile(CACHE_PATH, JSON.stringify(obj, null, 2));
}

function hash(s){ return crypto.createHash('sha256').update(s).digest('hex').slice(0,16); }

function extractReadable(html){
  try {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    // naively strip script/style/nav
    doc.querySelectorAll('script,style,nav,header,footer').forEach(n=>n.remove());
    const text = doc.body.textContent || '';
    return text.replace(/\s+/g,' ').trim().slice(0, 2000);
  } catch {
    return '';
  }
}

export async function generateClueLLM({ answer, title, url }) {
  if(!client) return null; // LLM disabled
  const urlKey = hash(url || '');
  const key = `${answer.toUpperCase()}|${urlKey}|${new Date().toISOString().slice(0,10)}`;
  const cache = await loadCache();
  if(cache[key]) return cache[key];

  // fetch article text (best effort)
  let article = '';
  try {
    const r = await fetch(url, { redirect: 'follow' });
    if (r.ok) {
      const html = await r.text();
      article = extractReadable(html);
    }
  } catch {}

  const sys = `You write specific crossword clues for WFDD public radio's daily mini puzzle, based on current local Winston-Salem/Triad news stories.

Rules:
- Max 60 characters total
- Reference SPECIFIC details from the actual news story
- Mention locations, people, organizations, or events from the story
- Do NOT use generic phrases like "In today's coverage" or "Sound waves"
- Do NOT include the answer word or obvious anagrams
- Be factual and specific to the story content
- No quotes or end punctuation`;

  const user = `ANSWER: ${answer.toUpperCase()}
NEWS HEADLINE: "${title || 'WFDD story'}"
STORY DETAILS: ${article || title || 'Local news story'}

Write a specific crossword clue that references actual details from this news story - locations, people, events, or organizations mentioned. Avoid generic descriptions.

Examples:
- Instead of "Sound waves" → "What WFDD uses to reach Triad listeners"  
- Instead of "In today's coverage" → "Forsyth County commissioners discussed this"
- Instead of "Rules governing society" → "What city council updated regarding parking"

SPECIFIC CLUE (max 60 chars):`;

  try {
    const ctrl = AbortSignal.timeout(5000);
    const resp = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role:'system', content: sys }, { role:'user', content: user }],
      temperature: 0.5,
      max_tokens: 50,
    }, { signal: ctrl });

    let clue = (resp.choices?.[0]?.message?.content || '').trim();
    // sanitize to one line, strip quotes and trailing punctuation
    clue = clue.replace(/[\r\n]+/g,' ').replace(/^["'""'']|["'""'']$/g,'').replace(/[.?!]\s*$/,'').slice(0, 60);
    if(!clue) return null;
    cache[key] = clue;
    await saveCache(cache);
    return clue;
  } catch (error) {
    console.warn(`LLM API call failed for ${answer}: ${error.message}`);
    return null;
  }
}

export async function selectCrosswordWordsLLM(stories, template) {
  if (!client) return null; // LLM disabled
  
  // Analyze template to determine needed word lengths
  const wordLengths = template.words.map(w => w.length).sort((a,b) => b-a);
  const lengthCounts = {};
  wordLengths.forEach(len => {
    lengthCounts[len] = (lengthCounts[len] || 0) + 1;
  });
  
  // Create cache key from story titles, date, and template
  const storyTitles = stories.slice(0, 5).map(s => s.title).join('|');
  const templateKey = JSON.stringify(wordLengths);
  const cacheKey = `words|${hash(storyTitles)}|${hash(templateKey)}|${new Date().toISOString().slice(0,10)}`;
  const cache = await loadCache();
  if (cache[cacheKey]) return cache[cacheKey];

  // Prepare story content for LLM
  const storyText = stories.slice(0, 5).map((story, i) => 
    `STORY ${i+1}: "${story.title}"\n${(story.summary || '').slice(0, 200)}`
  ).join('\n\n');

  // Build requirements string
  const reqText = Object.entries(lengthCounts)
    .map(([len, count]) => `${count} word${count > 1 ? 's' : ''} of exactly ${len} letters`)
    .join(', ');

  const sys = `You are a crossword constructor for WFDD public radio. Select words from today's news stories to create a crossword puzzle.

CRITICAL REQUIREMENTS:
- ONLY use words that appear EXACTLY in the provided story headlines or summaries
- Must select exactly ${wordLengths.length} words: ${reqText}
- Words must be common English words (nouns, proper nouns, verbs, adjectives)
- Avoid abbreviations, acronyms, or very obscure terms
- Choose words that clearly relate to the news content
- Words should be suitable for a general audience crossword
- Double-check that each word appears verbatim in the story text

Return ONLY a JSON array with exactly ${wordLengths.length} words in this format:
["WORD1", "WORD2", ...]

Order words from longest to shortest.`;

  const user = `TODAY'S WFDD STORIES:
${storyText}

Select exactly ${wordLengths.length} crossword-suitable words (${reqText}) that appear in these stories. Return only the JSON array, ordered longest to shortest:`;

  try {
    const ctrl = AbortSignal.timeout(8000);
    const resp = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role:'system', content: sys }, { role:'user', content: user }],
      temperature: 0.3,
      max_tokens: 150,
    }, { signal: ctrl });

    let content = (resp.choices?.[0]?.message?.content || '').trim();
    
    // Extract JSON array from response
    const match = content.match(/\[.*?\]/);
    if (!match) return null;
    
    const words = JSON.parse(match[0]);
    
    // Validate format
    if (!Array.isArray(words) || words.length !== wordLengths.length) {
      console.warn(`LLM returned wrong array length: ${words.length}, expected ${wordLengths.length}`);
      return null;
    }
    
    const validWords = words.map(w => w.toUpperCase()).filter(w => /^[A-Z]+$/.test(w));
    if (validWords.length !== wordLengths.length) {
      console.warn('LLM returned non-alphabetic words');
      return null;
    }
    
    // Validate lengths match template requirements  
    const actualLengths = validWords.map(w => w.length).sort((a,b) => b-a);
    if (JSON.stringify(actualLengths) !== JSON.stringify(wordLengths)) {
      console.warn(`LLM returned wrong word lengths: ${actualLengths}, expected ${wordLengths}`);
      return null;
    }
    
    cache[cacheKey] = validWords;
    await saveCache(cache);
    return validWords;
  } catch (error) {
    console.warn(`LLM word selection failed: ${error.message}`);
    return null;
  }
}