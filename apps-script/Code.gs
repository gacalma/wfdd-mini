/* WFDD Mini Scores API (Apps Script)
 * Accepts POST JSON: { date, email, score, timeLeft, revealsLetter, revealsWord, userAgent }
 * Rules:
 *  - One submission per email per date (keeps the best score).
 *  - Basic validation + CORS.
 */

const SHEET_NAME = 'WFDD Mini Scores'; // your sheet name
const ORIGINS = ['https://wfdd.org', 'http://localhost:8000', 'http://127.0.0.1:8000'];

function doOptions(e){
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders({
      'Access-Control-Allow-Origin': getOrigin(e),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
}

function doPost(e) {
  const origin = getOrigin(e);
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const { date, email, score, timeLeft, revealsLetter, revealsWord, userAgent } = sanitize(body);

    if (!date || !email) return json({ ok:false, error:'Missing date or email' }, corsHeaders);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ ok:false, error:'Bad date' }, corsHeaders);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok:false, error:'Bad email' }, corsHeaders);

    const sh = getSheet();
    const rows = sh.getDataRange().getValues(); // header + data
    const header = rows[0];
    const idx = {
      date: header.indexOf('date'),
      email: header.indexOf('email'),
      score: header.indexOf('score'),
      timeLeft: header.indexOf('timeLeft'),
      revealsLetter: header.indexOf('revealsLetter'),
      revealsWord: header.indexOf('revealsWord'),
      userAgent: header.indexOf('userAgent'),
      timestamp: header.indexOf('timestamp'),
    };

    // find existing row for (date,email)
    let rowNum = -1;
    let bestScore = Number(score) || 0;
    for (let r = 1; r < rows.length; r++) {
      if (rows[r][idx.date] === date && String(rows[r][idx.email]).toLowerCase() === email.toLowerCase()) {
        rowNum = r + 1; // 1-based
        break;
      }
    }

    const now = new Date();
    if (rowNum === -1) {
      // new row
      sh.appendRow([date, email, bestScore, Number(timeLeft)||0, Number(revealsLetter)||0, Number(revealsWord)||0, userAgent||'', now]);
    } else {
      // keep best of attempts for the day
      const existingScore = Number(sh.getRange(rowNum, idx.score+1).getValue()) || 0;
      if (bestScore > existingScore) {
        sh.getRange(rowNum, idx.score+1).setValue(bestScore);
        sh.getRange(rowNum, idx.timeLeft+1).setValue(Number(timeLeft)||0);
        sh.getRange(rowNum, idx.revealsLetter+1).setValue(Number(revealsLetter)||0);
        sh.getRange(rowNum, idx.revealsWord+1).setValue(Number(revealsWord)||0);
        sh.getRange(rowNum, idx.userAgent+1).setValue(userAgent||'');
        sh.getRange(rowNum, idx.timestamp+1).setValue(now);
      }
    }

    return json({ ok:true }, corsHeaders);
  } catch(err) {
    return json({ ok:false, error:String(err) }, corsHeaders);
  }
}

function doGet(e){
  // optional health check
  return json({ ok:true, service:'wfdd-mini-scores' }, { 'Access-Control-Allow-Origin': getOrigin(e) });
}

function getSheet(){
  const ss = SpreadsheetApp.openById(SpreadsheetApp.getActiveSpreadsheet().getId());
  const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  return sh;
}

function sanitize(obj){
  return {
    date: String(obj.date||'').slice(0,10),
    email: String(obj.email||'').trim(),
    score: Number(obj.score||0),
    timeLeft: Number(obj.timeLeft||0),
    revealsLetter: Number(obj.revealsLetter||0),
    revealsWord: Number(obj.revealsWord||0),
    userAgent: String(obj.userAgent||'').slice(0, 255),
  };
}

function getOrigin(e){
  const o = (e && e.parameter && e.parameter.origin) || (e && e.postData && e.postData.type && e.postData.type.indexOf('http')>=0 ? '' : '');
  // GAS can't always read Origin header; allow localhost + prod
  return ORIGINS[0] || '*';
}

function json(obj, headers){
  const out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  if (headers) Object.entries(headers).forEach(([k,v])=>out.setHeader(k, v));
  return out;
}