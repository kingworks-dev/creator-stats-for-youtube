// Shared logic for Creator Stats for YouTube. No network access anywhere in this extension.
// Every number is computed from text that is already rendered on the page the user is viewing.
const api = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);
async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}
// Honor-system key: YTCS-XXXX-XXXX-CCCC, CCCC = checksum of the first two groups.
async function validKey(k) {
  const m = /^YTCS-([0-9A-F]{4})-([0-9A-F]{4})-([0-9A-F]{4})$/.exec((k || '').trim().toUpperCase());
  if (!m) return false;
  return (await sha('YTCS' + m[1] + m[2] + 'KAI')).slice(0, 4) === m[3];
}
async function isPro() { const d = await api.storage.local.get(['proKey']); return !!d.proKey && await validKey(d.proKey); }
// "1,234 views", "12K views", "1.2M views", "No views" -> number or null
function parseCount(s) {
  if (s == null) return null;
  s = String(s).replace(/ /g, ' ').trim();
  if (/^no\s+views/i.test(s)) return 0;
  const m = /([\d][\d,.\s]*)\s*([KMB])?/i.exec(s); if (!m) return null;
  let n = parseFloat(m[1].replace(/,/g, '').replace(/\s/g, '')); if (isNaN(n)) return null;
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] || '').toUpperCase()] || 1;
  return Math.round(n * mult);
}
// "3 days ago", "Streamed 2 weeks ago", "1 year ago" -> approximate days (null if unreadable)
function parseAgo(s) {
  const m = /(\d+)\s*(second|minute|hour|day|week|month|year)s?\s+ago/i.exec(s || ''); if (!m) return null;
  const n = +m[1], u = m[2].toLowerCase();
  return n * { second: 1 / 86400, minute: 1 / 1440, hour: 1 / 24, day: 1, week: 7, month: 30, year: 365 }[u];
}
function daysSince(iso, now) {
  const t = Date.parse(iso); if (isNaN(t)) return null;
  return Math.max(0, ((now || Date.now()) - t) / 86400000);
}
function perDay(views, days) { if (views == null || days == null) return null; return views / Math.max(days, 1); }
function ratio(likes, views) { if (likes == null || !views) return null; return likes / views; }
function words(s) { return (String(s || '').trim().match(/\S+/g) || []).length; }
function fmt(n, d) { return n == null ? 'n/a' : n.toLocaleString('en-US', { maximumFractionDigits: d == null ? 0 : d }); }
function csvCell(v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
function toCSV(rows, cols) { return [cols.join(',')].concat(rows.map(r => cols.map(c => csvCell(r[c])).join(','))).join('\n') + '\n'; }
function median(a) { a = a.filter(x => x != null).sort((x, y) => x - y); if (!a.length) return null; const h = a.length >> 1; return a.length % 2 ? a[h] : (a[h - 1] + a[h]) / 2; }
if (typeof module !== 'undefined') module.exports = { parseCount, parseAgo, daysSince, perDay, ratio, words, toCSV, median };
