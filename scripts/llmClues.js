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