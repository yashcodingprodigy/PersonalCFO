/**
 * Money Personality game → Google Sheet (no server needed).
 *
 * Setup (5 minutes, once):
 * 1. Create a new Google Sheet (e.g. "Money Personality — Responses").
 * 2. Extensions → Apps Script → delete everything → paste this file → Save.
 * 3. Deploy → New deployment → type "Web app"
 *      Execute as: Me      Who has access: Anyone
 *    → Deploy → allow permissions → copy the Web app URL (ends with /exec).
 * 4. Paste that URL into ENDPOINT at the top of index.html's <script>.
 *
 * Every game play adds rows: event = start / complete / share / optin.
 */
const COLUMNS = [
  'ts', 'event', 'sid', 'lang', 'src', 'ref', 'device', 'secs', 'type', 'now_score', 'plan_score',
  'p_bonus', 'p_phone', 'p_money', 'p_track', 'p_monthend', 'p_sale', 'p_goal',
  'dream', 'how', 'blocker', 'would_use', 'contact',
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sheet.getLastRow() === 0) sheet.appendRow(COLUMNS);
    const d = JSON.parse(e.postData.contents || '{}');
    // Contact details only on opt-in rows, trimmed; everything else is anonymous.
    sheet.appendRow(COLUMNS.map((c) => (d[c] === undefined || d[c] === null ? '' : String(d[c]).slice(0, 120))));
    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('error');
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return ContentService.createTextOutput('Money Personality collector is running.');
}
