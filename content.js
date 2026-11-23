// Creator Stats for YouTube: reads only what is already rendered on the page you are viewing. Nothing is fetched or sent.
(() => {
  const HOST = 'yt-creator-stats-host';
  const q = (r, s) => r.querySelector(s);
  const txt = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const meta = (n, attr) => { const e = document.querySelector(`meta[${attr || 'name'}="${n}"]`); return e ? e.getAttribute('content') : null; };
  let state = { sig: '', pro: false, mode: null, rows: [], watch: null };

  function scrapeWatch() {
    const title = meta('title') || txt(q(document, 'h1'));
    if (!title) return null;
    const views = parseCount(meta('interactionCount', 'itemprop')) ?? parseCount(txt(q(document, '#info-container, ytd-watch-info-text, #info')).split('views')[0] + ' views');
    const iso = meta('datePublished', 'itemprop') || meta('uploadDate', 'itemprop');
    const days = iso ? daysSince(iso) : null;
    let likes = null;
    const lb = q(document, 'like-button-view-model button, button[aria-label*="like this video"]');
    if (lb) { const m = /with\s+([\d,\.]+\s*[KMB]?)\s+other/i.exec(lb.getAttribute('aria-label') || ''); likes = m ? parseCount(m[1]) : parseCount(txt(lb)); }
    const kw = (meta('keywords') || '').split(',').map(s => s.trim()).filter(Boolean);
    const exp = q(document, '#description-inline-expander, ytd-text-inline-expander');
    const desc = exp ? txt(exp) : (meta('description') || '');
    return { title, views, days, likes, tags: kw.length, titleChars: title.length, titleWords: words(title), descWords: words(desc),
      descSource: exp ? 'the description text on the page' : 'the page meta description, which YouTube may shorten',
      viewsPerDay: perDay(views, days), likeRatio: ratio(likes, views) };
  }
  function scrapeChannel() {
    return Array.from(document.querySelectorAll('ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer')).map(el => {
      const t = q(el, '#video-title, a#video-title-link');
      const spans = Array.from(el.querySelectorAll('#metadata-line span, .inline-metadata-item')).map(txt);
      const views = parseCount(spans.find(s => /views?$/i.test(s)));
      const days = parseAgo(spans.find(s => /ago$/i.test(s)));
      return { title: txt(t), url: t && t.href ? t.href : '', views, ageDays: days, viewsPerDay: perDay(views, days), likes: null };
    }).filter(r => r.title);
  }
  function scrapeStudio() {
    return Array.from(document.querySelectorAll('ytcp-video-row')).map(el => {
      const t = q(el, '#video-title, .video-title-wrapper a, a.ytcp-video-list-cell-video');
      const views = parseCount(txt(q(el, '.tablecell-views')));
      const dateT = txt(q(el, '.tablecell-date')).split(/\s{2,}|Published|Uploaded|Scheduled/i)[0].trim();
      const dm = /([A-Z][a-z]{2,8}\.? \d{1,2}, \d{4})/.exec(txt(q(el, '.tablecell-date')));
      const days = dm ? daysSince(dm[1]) : parseAgo(dateT);
      const likes = parseCount(txt(q(el, '.tablecell-likes')));
      return { title: txt(t), url: '', views, ageDays: days, viewsPerDay: perDay(views, days), likes, likeRatio: ratio(likes, views) };
    }).filter(r => r.title);
  }

  function detect() {
    if (location.hostname === 'studio.youtube.com') return 'studio';
    if (location.pathname === '/watch') return 'watch';
    if (/\/(videos|streams|shorts)\/?$/.test(location.pathname)) return 'channel';
    return null;
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const CSS = `:host{all:initial}.p{position:fixed;right:16px;bottom:16px;z-index:2147483647;width:340px;max-height:70vh;overflow:auto;background:#fff;color:#1c2330;font:13px/1.4 system-ui,sans-serif;border:1px solid #c4ccd8;border-radius:10px;box-shadow:0 6px 24px #0003}
  .h{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid #e3e7ee;font-weight:600}.h button{border:0;background:none;cursor:pointer;font-size:16px}
  .b{padding:8px 12px}.k{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #f0f2f6}.k b{font-variant-numeric:tabular-nums}
  .n{color:#5a6577;font-size:11.5px;margin-top:6px}table{width:100%;border-collapse:collapse;font-size:12px}td,th{padding:3px 4px;text-align:right;border-bottom:1px solid #f0f2f6}td:first-child,th:first-child{text-align:left;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  button.a{margin-top:8px;padding:6px 10px;border:1px solid #c4ccd8;background:#f4f6fa;border-radius:6px;cursor:pointer;font:inherit}.pro{color:#b3261e;font-size:11.5px}.min .b{display:none}`;

  function render() {
    const mode = detect();
    let host = document.getElementById(HOST);
    if (!mode) { if (host) host.remove(); state.sig = ''; return; }
    let watch = null, rows = [];
    if (mode === 'watch') watch = scrapeWatch(); else rows = mode === 'studio' ? scrapeStudio() : scrapeChannel();
    if (mode === 'watch' ? !watch : !rows.length) return;
    const sig = JSON.stringify([mode, location.href, watch, rows.map(r => [r.title, r.views, r.ageDays]), state.pro]);
    if (sig === state.sig && host) return;
    state = { ...state, sig, mode, rows, watch };
    if (!host) { host = document.createElement('div'); host.id = HOST; host.attachShadow({ mode: 'open' }); document.documentElement.appendChild(host); }
    const minimized = host.dataset.min === '1';
    let body = '';
    if (mode === 'watch') {
      const w = watch;
      body = `<div class="k"><span>Views per day since publish</span><b id="m-vpd">${fmt(w.viewsPerDay, 1)}</b></div>
      <div class="k"><span>Views / days since publish</span><b>${fmt(w.views)} / ${w.days == null ? 'n/a' : fmt(w.days, 1)}</b></div>
      <div class="k"><span>Like-to-view ratio</span><b id="m-ratio">${w.likeRatio == null ? 'n/a' : fmt(w.likeRatio * 100, 2) + '%'}</b></div>
      <div class="k"><span>Title length</span><b id="m-title">${w.titleChars} chars, ${w.titleWords} words</b></div>
      <div class="k"><span>Tags listed on the page</span><b id="m-tags">${w.tags}</b></div>
      <div class="k"><span>Description words</span><b id="m-desc">${w.descWords}</b></div>
      <div class="n">Computed from the visible page. Likes come from the like button label (YouTube may hide or round them). Description words are counted from ${esc(w.descSource)}. Views per day uses the publish date on the page.</div>`;
      if (state.pro) body += `<button class="a" id="csv">Export these stats (CSV)</button>`;
      else body += `<div class="pro">Pro: export to CSV.</div>`;
    } else {
      const sorted = rows.slice().sort((a, b) => (b.viewsPerDay ?? -1) - (a.viewsPerDay ?? -1));
      const med = median(rows.map(r => r.viewsPerDay));
      body = `<div class="k"><span>Videos visible on this page</span><b id="m-count">${rows.length}</b></div>
      <div class="k"><span>Median views per day (visible)</span><b id="m-med">${fmt(med, 1)}</b></div>
      <table id="tbl"><tr><th>Video (ranked by views/day)</th><th>Views/day</th>${state.pro ? '<th>vs median</th>' : ''}</tr>` +
        sorted.slice(0, state.pro ? 100 : 10).map(r => `<tr><td title="${esc(r.title)}">${esc(r.title)}</td><td>${fmt(r.viewsPerDay, 1)}</td>${state.pro ? `<td>${r.viewsPerDay == null || !med ? 'n/a' : fmt(r.viewsPerDay / med, 2) + 'x'}</td>` : ''}</tr>`).join('') + `</table>
      <div class="n">Computed from the visible page: only videos already loaded here are counted (scroll to load more). Ages like "3 months ago" are rounded by YouTube, so views per day is approximate.</div>`;
      body += state.pro ? `<button class="a" id="csv">Export visible videos (CSV)</button>` : `<div class="pro">Free shows the top 10. Pro: all visible videos, vs-median column and CSV export.</div>`;
    }
    const html = `<div class="p ${minimized ? 'min' : ''}"><div class="h"><span>Creator Stats${state.pro ? ' Pro' : ''}</span><button id="tog" aria-label="Minimize">${minimized ? '+' : '&minus;'}</button></div><div class="b">${body}</div></div>`;
    const st = document.createElement('style'); st.textContent = CSS;
    host.shadowRoot.replaceChildren(st, ...new DOMParser().parseFromString(html, 'text/html').body.childNodes);
    host.shadowRoot.getElementById('tog').onclick = () => { host.dataset.min = host.dataset.min === '1' ? '0' : '1'; state.sig = ''; render(); };
    const csv = host.shadowRoot.getElementById('csv');
    if (csv) csv.onclick = () => {
      let out;
      if (mode === 'watch') { const w = state.watch; out = toCSV([{ title: w.title, url: location.href, views: w.views, days_since_publish: w.days == null ? '' : w.days.toFixed(2), views_per_day: w.viewsPerDay == null ? '' : w.viewsPerDay.toFixed(2), likes: w.likes ?? '', like_to_view_ratio: w.likeRatio == null ? '' : w.likeRatio.toFixed(5), title_chars: w.titleChars, tags: w.tags, description_words: w.descWords, source: 'computed from the visible page' }],
        ['title', 'url', 'views', 'days_since_publish', 'views_per_day', 'likes', 'like_to_view_ratio', 'title_chars', 'tags', 'description_words', 'source']); }
      else out = toCSV(state.rows.map(r => ({ title: r.title, url: r.url, views: r.views ?? '', age_days: r.ageDays == null ? '' : r.ageDays.toFixed(1), views_per_day: r.viewsPerDay == null ? '' : r.viewsPerDay.toFixed(2), likes: r.likes ?? '', source: 'computed from the visible page' })),
        ['title', 'url', 'views', 'age_days', 'views_per_day', 'likes', 'source']);
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out], { type: 'text/csv' })); a.download = 'creator-stats-' + mode + '.csv'; document.body.appendChild(a); a.click(); a.remove();
    };
  }
  const refresh = async () => { state.pro = await isPro(); state.sig = ''; render(); };
  refresh(); api.storage.onChanged.addListener(refresh);
  let t = null; new MutationObserver(() => { clearTimeout(t); t = setTimeout(render, 400); }).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('yt-navigate-finish', () => setTimeout(render, 300));
})();
