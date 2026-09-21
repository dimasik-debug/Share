/* VK Music Console Hook v1.0 — вставь в DevTools Console на vk.ru
 * Перехват access_token + m3u8 + метаданных треков + скачивание HLS
 */
(function VKMusicConsoleHook() {
  'use strict';

  if (window.__VKHook) return console.log('%c[VKHook] уже запущен. Используй window.__VKHook', 'color:#4a9eff');

  const VERSION = '1.0';
  const T0 = performance.now();
  const now = () => '+' + ((performance.now() - T0) / 1000).toFixed(2) + 's';

  const state = {
    accessToken: null, userId: null,
    tracks: new Map(), m3u8: [],
    logs: [], isDownloading: false, currentJob: null
  };

  // ============================================================================
  // UTILS
  // ============================================================================
  const sanitize = n => (n || 'track').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'track';
  const fmtBytes = b => !b ? '0 B' : b < 1024 ? b + ' B' : b < 1048576 ? (b/1024).toFixed(1) + ' KB' : (b/1048576).toFixed(2) + ' MB';
  const hexToBytes = h => { const a = new Uint8Array(h.length/2); for (let i=0;i<a.length;i++) a[i]=parseInt(h.substr(i*2,2),16); return a; };
  const seqToIv = s => { const iv = new Uint8Array(16); let x = BigInt(s); for (let i=15;i>=0;i--){iv[i]=Number(x&0xffn);x>>=8n;} return iv; };

  function log(msg, color) {
    state.logs.push({ t: Date.now(), msg });
    if (state.logs.length > 500) state.logs.shift();
    const el = document.getElementById('vkh-log');
    if (el) {
      const line = document.createElement('div');
      line.innerHTML = `<span style="color:rgba(255,255,255,.35);">[${now()}]</span> <span style="color:${color||'rgba(255,255,255,.75)'};">${msg}</span>`;
      el.appendChild(line);
      el.scrollTop = el.scrollHeight;
      while (el.children.length > 400) el.removeChild(el.firstChild);
    }
    console.log('%c[VKHook] %c' + msg, 'color:#6a7a8a;font-style:italic;', 'color:' + (color || '#ccc'));
  }

  // ============================================================================
  // TOKEN SCAN
  // ============================================================================
  function scanToken() {
    if (state.accessToken) return state.accessToken;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const v = localStorage.getItem(k);
        if (typeof v !== 'string') continue;
        if (v.startsWith('vk1.a.') && v.length > 80) { state.accessToken = v; return v; }
        if (v.startsWith('{') || v.startsWith('[')) {
          const m = v.match(/vk1\.a\.[A-Za-z0-9_\-]{60,}/);
          if (m) { state.accessToken = m[0]; return m[0]; }
        }
      }
    } catch(e) {}
    try {
      const m = document.cookie.match(/vk_access_token=([^;]+)/);
      if (m && m[1].startsWith('vk1.')) state.accessToken = decodeURIComponent(m[1]);
    } catch(e) {}
    return state.accessToken;
  }

  // ============================================================================
  // HOOKS
  // ============================================================================
  const origFetch = window.fetch;
  window.fetch = async function(input, init) {
    let url = '', method = 'GET', bodyStr = null;
    try {
      if (typeof input === 'string') url = input;
      else if (input instanceof Request) { url = input.url; method = input.method || 'GET'; }
      else url = String(input);
      if (init?.method) method = init.method;
      if (init?.body && typeof init.body === 'string') bodyStr = init.body;
      else if (input instanceof Request && method !== 'GET' && method !== 'HEAD') {
        try { bodyStr = await input.clone().text(); } catch(e) {}
      }
    } catch(e) {}

    // capture token from request
    const blob = (bodyStr || '') + ' ' + url;
    const tm = blob.match(/access_token=([^&\s]+)/) || blob.match(/Bearer\s+(vk1\.[A-Za-z0-9_\-\.]+)/);
    if (tm) {
      const tok = decodeURIComponent(tm[1]);
      if (tok.startsWith('vk1.') && tok !== state.accessToken) {
        state.accessToken = tok;
        renderStats();
      }
    }

    const resp = await origFetch.apply(this, arguments);

    // capture response
    try {
      if (url.includes('web.api.vk.ru/method') || url.includes('api.vk.com/method') || url.includes('api.vk.ru/method')) {
        resp.clone().json().then(d => handleApiResp(url, d)).catch(() => {});
      } else if (url.includes('al_audio.php')) {
        resp.clone().text().then(t => handleLegacyAudio(url, t)).catch(() => {});
      } else if (url.includes('.m3u8')) {
        const u = url.split('?')[0].split('/').slice(-2).join('/');
        if (!state.m3u8.find(x => x.url === url)) {
          state.m3u8.push({ url, ts: Date.now() });
          log('🎵 m3u8: ' + u, '#a78bfa');
        }
      }
    } catch(e) {}

    return resp;
  };

  const OrigXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function() {
    const xhr = new OrigXHR();
    const origOpen = xhr.open, origSend = xhr.send;
    let _url = '', _method = 'GET';
    xhr.open = function(m, u) { _url = String(u); _method = (m || 'GET').toUpperCase(); return origOpen.apply(this, arguments); };
    xhr.send = function(body) {
      if (body && typeof body === 'string') {
        const tm = body.match(/access_token=([^&]+)/);
        if (tm && tm[1].startsWith('vk1.')) state.accessToken = decodeURIComponent(tm[1]);
      }
      xhr.addEventListener('load', function() {
        try {
          if (_url.includes('web.api.vk.ru/method') || _url.includes('api.vk.com/method')) {
            handleApiResp(_url, JSON.parse(xhr.responseText));
          } else if (_url.includes('al_audio.php')) {
            handleLegacyAudio(_url, xhr.responseText);
          }
        } catch(e) {}
      });
      return origSend.apply(this, arguments);
    };
    return xhr;
  };
  window.XMLHttpRequest.prototype = OrigXHR.prototype;

  // ============================================================================
  // RESPONSE PARSING
  // ============================================================================
  function handleApiResp(url, data) {
    // batch.call → вложенные ответы
    if (Array.isArray(data?.response)) {
      for (const it of data.response) {
        if (it && it.body) handleApiResp(url, it.body);
      }
    }
    // ищем аудио-объекты рекурсивно
    const items = [];
    (function walk(o) {
      if (!o) return;
      if (Array.isArray(o)) { o.forEach(walk); return; }
      if (typeof o !== 'object') return;
      // признак аудио: есть url + (id|audio_id) + artist/title
      const hasId = o.id || o.audio_id;
      const isAudio = o.url && hasId && (o.artist !== undefined || o.title !== undefined);
      if (isAudio) items.push(o);
      for (const k in o) {
        const v = o[k];
        if (v && typeof v === 'object') walk(v);
      }
    })(data);
    for (const it of items) registerTrack(it);
  }

  function handleLegacyAudio(url, text) {
    // legacy: vk отдаёт JS с JSON-массивами типа {"payload":[1,[audios]]}
    try {
      if (text.startsWith('{')) handleApiResp(url, JSON.parse(text));
    } catch(e) {}
  }

  function registerTrack(t) {
    const id = String(t.id || t.audio_id || '');
    const ownerId = t.owner_id || t.ownerId || null;
    if (!id) return;
    const key = ownerId ? `${ownerId}_${id}` : id;
    const prev = state.tracks.get(key) || {};
    state.tracks.set(key, {
      ...prev,
      key, id, ownerId,
      accessKey: t.access_key || t.accessKey || prev.accessKey,
      title: (t.title || prev.title || '—').toString().trim(),
      artist: (t.artist || prev.artist || '—').toString().trim(),
      duration: t.duration || prev.duration || 0,
      url: t.url || prev.url,
      isHls: (t.url || prev.url || '').includes('.m3u8'),
      addedAt: Date.now()
    });
    renderTracks();
    renderStats();
  }

  // ============================================================================
  // VK API CALL
  // ============================================================================
  async function vkApi(method, params = {}) {
    if (!state.accessToken) throw new Error('нет access_token');
    const body = new URLSearchParams({ v: '5.289', client_id: '6287487', access_token: state.accessToken });
    for (const [k, v] of Object.entries(params)) if (v !== undefined) body.set(k, String(v));
    const r = await origFetch.call(window, 'https://web.api.vk.ru/method/' + method, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      credentials: 'include'
    });
    const data = await r.json();
    if (data.error) throw new Error(`${data.error.error_code}: ${data.error.error_msg}`);
    return data.response;
  }

  async function refreshMyAudios() {
    if (!state.accessToken) { log('✕ нет токена', '#f87171'); return; }
    try {
      let offset = 0;
      const total = [];
      for (let page = 0; page < 30; page++) {
        const r = await vkApi('audio.get', { count: 100, offset });
        const items = r?.items || [];
        if (!items.length) break;
        items.forEach(registerTrack);
        total.push(...items);
        if (items.length < 100) break;
        offset += 100;
      }
      log(`✅ Загружено ${total.length} треков через audio.get`, '#4ade80');
    } catch(e) {
      log('✕ audio.get: ' + e.message, '#f87171');
    }
  }

  // ============================================================================
  // HLS DOWNLOAD
  // ============================================================================
  async function fetchBytes(url) {
    const r = await origFetch.call(window, url, { credentials: 'omit' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return new Uint8Array(await r.arrayBuffer());
  }
  async function fetchText(url) {
    const r = await origFetch.call(window, url, { credentials: 'omit' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  }

  function parseM3u8(text, baseUrl) {
    const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const segs = [];
    let dur = 0, key = null;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l.startsWith('#EXT-X-KEY:')) {
        const kv = {};
        l.slice(11).split(',').forEach(p => { const idx = p.indexOf('='); if (idx>0) kv[p.slice(0,idx).trim()] = p.slice(idx+1).replace(/"/g,'').trim(); });
        if (kv.METHOD && kv.METHOD !== 'NONE' && kv.URI) {
          key = {
            method: kv.METHOD,
            uri: new URL(kv.URI, baseUrl).href,
            iv: kv.IV ? hexToBytes(kv.IV.replace(/^0x/i,'')) : null
          };
        }
      } else if (l.startsWith('#EXTINF:')) {
        dur = parseFloat(l.slice(8));
      } else if (!l.startsWith('#')) {
        segs.push({ url: new URL(l, baseUrl).href, duration: dur, key });
        dur = 0;
      }
    }
    return segs;
  }

  async function decryptAES128(data, keyBytes, iv) {
    const k = await crypto.subtle.importKey('raw', keyBytes.slice(0, 16), { name: 'AES-CBC' }, false, ['decrypt']);
    const dec = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, k, data);
    return new Uint8Array(dec);
  }

  async function downloadHls(m3u8Url, onProgress) {
    log('⬇ HLS: ' + m3u8Url.slice(0, 90) + '…', '#4a9eff');
    let text = await fetchText(m3u8Url);
    let segs = parseM3u8(text, m3u8Url);

    // master playlist → выбираем лучший вариант
    if (text.includes('#EXT-X-STREAM-INF')) {
      const variants = [];
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
          const next = (lines[i+1] || '').trim();
          if (next && !next.startsWith('#')) variants.push(next);
        }
      }
      if (variants.length) {
        const vurl = new URL(variants[variants.length-1], m3u8Url).href;
        log('  → variant: ' + vurl.split('/').slice(-2).join('/'), '#a78bfa');
        text = await fetchText(vurl);
        segs = parseM3u8(text, vurl);
      }
    }

    if (!segs.length) throw new Error('пустой плейлист');
    log(`  сегментов: ${segs.length}`, '#4a9eff');

    const keyCache = new Map();
    const chunks = [];
    let seq = 0;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      let data = await fetchBytes(s.url);
      if (s.key) {
        let kb = keyCache.get(s.key.uri);
        if (!kb) {
          kb = await fetchBytes(s.key.uri);
          keyCache.set(s.key.uri, kb);
          log(`  🔑 AES key: ${kb.length} B`, '#fbbf24');
        }
        try {
          data = await decryptAES128(data, kb, s.key.iv || seqToIv(seq));
        } catch(e) {
          log('  ✕ decrypt: ' + e.message, '#f87171');
        }
      }
      chunks.push(data);
      seq++;
      onProgress && onProgress(i + 1, segs.length, data.byteLength);
    }

    let total = 0;
    for (const c of chunks) total += c.byteLength;
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.byteLength; }
    return out;
  }

  // ============================================================================
  // SAVE
  // ============================================================================
  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 8000);
  }

  async function downloadTrack(key) {
    const t = state.tracks.get(key);
    if (!t) return log('✕ трек не найден: ' + key, '#f87171');
    if (!t.url) {
      log('✕ нет url, жми "Обновить" пока не подгрузятся URL', '#fbbf24');
      return;
    }
    state.currentJob = { title: t.title, artist: t.artist };
    const safeA = sanitize(t.artist || 'unknown');
    const safeT = sanitize(t.title || 'track');
    try {
      let bytes, ext;
      if (t.isHls) {
        bytes = await downloadHls(t.url, (i, n, size) => setProgress(`${t.artist} — ${t.title}`, i, n, size));
        ext = 'ts';
      } else {
        log('⬇ MP3: ' + t.url.slice(0, 90), '#4a9eff');
        bytes = await fetchBytes(t.url);
        ext = 'mp3';
      }
      const fname = `${safeA} - ${safeT}.${ext}`;
      saveBlob(new Blob([bytes]), fname);
      log(`💾 ${fname} (${fmtBytes(bytes.byteLength)})`, '#4ade80');
    } catch(e) {
      log(`✕ "${t.title}": ${e.message}`, '#f87171');
    } finally {
      state.currentJob = null;
      setProgress('', 0, 0, 0);
    }
  }

  async function downloadAll() {
    if (state.isDownloading) return;
    state.isDownloading = true;
    const list = [...state.tracks.values()].filter(t => t.url);
    log(`▶ Пакетная загрузка: ${list.length} треков`, '#4ade80');
    for (let i = 0; i < list.length; i++) {
      log(`[${i+1}/${list.length}] ${list[i].artist} — ${list[i].title}`, '#4a9eff');
      await downloadTrack(list[i].key);
      await new Promise(r => setTimeout(r, 1200));
    }
    log(`✅ Готово: ${list.length} треков`, '#4ade80');
    state.isDownloading = false;
  }

  // ============================================================================
  // UI
  // ============================================================================
  const CSS = `
    #vkh{position:fixed;bottom:16px;right:16px;z-index:2147483647;background:#0c0c0f;color:#fff;
      font-family:-apple-system,'Segoe UI',sans-serif;width:560px;max-width:calc(100vw - 32px);
      border-radius:16px;border:1px solid rgba(255,255,255,.08);
      box-shadow:0 24px 80px rgba(0,0,0,.75);overflow:hidden;display:flex;flex-direction:column;
      max-height:calc(100vh - 32px);}
    #vkh-head{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.08);}
    #vkh-body{display:flex;flex-direction:column;overflow:hidden;flex:1;}
    .vkh-btn{padding:7px 12px;border-radius:8px;font-size:11px;font-weight:500;border:none;cursor:pointer;
      background:rgba(255,255,255,.06);color:rgba(255,255,255,.8);font-family:inherit;transition:.15s;}
    .vkh-btn:hover{background:rgba(255,255,255,.12);color:#fff;}
    .vkh-btn.pri{background:linear-gradient(135deg,#4a9eff,#2b7fff);color:#fff;}
    .vkh-btn.pri:hover{filter:brightness(1.1);}
    .vkh-btn.dng{background:rgba(248,113,113,.15);color:#f87171;}
    .vkh-btn:disabled{opacity:.4;cursor:not-allowed;}
    #vkh-stats{padding:8px 14px;font-size:10px;font-family:'SF Mono',monospace;color:rgba(255,255,255,.5);
      border-bottom:1px solid rgba(255,255,255,.06);display:flex;gap:12px;flex-wrap:wrap;}
    #vkh-tracks{max-height:220px;overflow-y:auto;background:#0e0e10;padding:6px;border-bottom:1px solid rgba(255,255,255,.06);}
    #vkh-tracks::-webkit-scrollbar{width:6px;}
    #vkh-tracks::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:3px;}
    .vkh-row{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:11px;}
    .vkh-row:hover{background:rgba(74,158,255,.08);}
    .vkh-row .vkh-t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:rgba(255,255,255,.85);}
    .vkh-row .vkh-dl{font-size:9px;padding:2px 6px;border-radius:4px;background:rgba(74,158,255,.15);color:#4a9eff;font-family:'SF Mono',monospace;}
    .vkh-row .vkh-dl.ready{background:rgba(74,222,128,.15);color:#4ade80;}
    #vkh-log{font-size:10px;font-family:'SF Mono',monospace;background:#0a0a0c;padding:8px 12px;max-height:160px;
      overflow-y:auto;line-height:1.5;color:rgba(255,255,255,.65);border-bottom:1px solid rgba(255,255,255,.06);}
    #vkh-log::-webkit-scrollbar{width:6px;}
    #vkh-log::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:3px;}
    #vkh-prog{display:none;padding:8px 14px;border-bottom:1px solid rgba(255,255,255,.06);font-size:10px;font-family:'SF Mono',monospace;}
    #vkh-prog .bar{height:5px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden;margin-top:5px;}
    #vkh-prog .fill{height:100%;background:linear-gradient(90deg,#4a9eff,#2b7fff);width:0%;transition:width .15s;}
    #vkh-foot{padding:10px 14px;display:flex;gap:8px;flex-wrap:wrap;}
  `;

  function ensureUI() {
    if (document.getElementById('vkh')) return;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const html = `
      <div id="vkh">
        <div id="vkh-head">
          <div style="width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,#4a9eff,#2b7fff);
            display:flex;align-items:center;justify-content:center;font-size:16px;">🎵</div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:14px;">VK Music Hook</div>
            <div style="font-size:10px;color:rgba(255,255,255,.4);">v${VERSION} · HLS + AES-128</div>
          </div>
          <button id="vkh-min" class="vkh-btn">—</button>
          <button id="vkh-x" class="vkh-btn dng">✕</button>
        </div>
        <div id="vkh-body">
          <div id="vkh-stats">—</div>
          <div id="vkh-tracks"><div style="padding:20px;text-align:center;color:rgba(255,255,255,.3);font-size:11px;">
            Треки появятся после того, как VK загрузит их (открой «Моя музыка» / нажми ▶ на треке)
          </div></div>
          <div id="vkh-prog"><div class="txt">—</div><div class="bar"><div class="fill"></div></div></div>
          <div id="vkh-log"></div>
          <div id="vkh-foot">
            <button id="vkh-refresh" class="vkh-btn pri">⟳ Обновить my.audio</button>
            <button id="vkh-dlall" class="vkh-btn">⬇ Скачать всё</button>
            <button id="vkh-vkapi" class="vkh-btn">🔑 Test VK API</button>
            <button id="vkh-clr" class="vkh-btn">🗑 Clear</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);

    document.getElementById('vkh-x').onclick = () => {
      document.getElementById('vkh').remove();
      delete window.__VKHook;
      console.log('%c[VKHook] выгружен', 'color:#f87171');
    };
    document.getElementById('vkh-min').onclick = () => {
      const b = document.getElementById('vkh-body');
      b.style.display = b.style.display === 'none' ? 'flex' : 'none';
    };
    document.getElementById('vkh-clr').onclick = () => { document.getElementById('vkh-log').innerHTML = ''; };
    document.getElementById('vkh-refresh').onclick = refreshMyAudios;
    document.getElementById('vkh-dlall').onclick = downloadAll;
    document.getElementById('vkh-vkapi').onclick = async () => {
      try {
        const u = await vkApi('users.get');
        const uu = Array.isArray(u) ? u[0] : u;
        log(`✅ VK API OK: ${uu.first_name} ${uu.last_name} (id=${uu.id})`, '#4ade80');
      } catch(e) { log('✕ VK API: ' + e.message, '#f87171'); }
    };
  }

  function renderStats() {
    const el = document.getElementById('vkh-stats');
    if (!el) return;
    const tok = state.accessToken;
    el.innerHTML = `
      <span>🔑 ${tok ? tok.slice(0,14) + '…' : 'нет токена'}</span>
      <span>🎵 треков: ${state.tracks.size}</span>
      <span>📼 m3u8: ${state.m3u8.length}</span>
      <span>✅ с URL: ${[...state.tracks.values()].filter(t=>t.url).length}</span>
    `;
  }

  function renderTracks() {
    const el = document.getElementById('vkh-tracks');
    if (!el) return;
    const items = [...state.tracks.values()].sort((a,b) => b.addedAt - a.addedAt).slice(0, 200);
    if (!items.length) return;
    el.innerHTML = '';
    for (const t of items) {
      const row = document.createElement('div');
      row.className = 'vkh-row';
      const dur = t.duration ? `${Math.floor(t.duration/60)}:${String(t.duration%60).padStart(2,'0')}` : '';
      row.innerHTML = `
        <div class="vkh-t" title="${(t.artist+' — '+t.title).replace(/"/g,'&quot;')}">
          ${t.artist} — ${t.title}
        </div>
        <div style="font-size:10px;color:rgba(255,255,255,.35);font-family:'SF Mono',monospace;">${dur}</div>
        <div class="vkh-dl ${t.url ? 'ready' : ''}">${t.isHls ? 'HLS' : (t.url ? 'MP3' : '…')}</div>
      `;
      row.onclick = () => downloadTrack(t.key);
      el.appendChild(row);
    }
  }

  function setProgress(title, done, total, bytes) {
    const el = document.getElementById('vkh-prog');
    if (!el) return;
    if (!title || total === 0) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.querySelector('.txt').textContent = `${title} — ${done}/${total} (${fmtBytes(bytes)})`;
    el.querySelector('.fill').style.width = (done / total * 100) + '%';
  }

  // ============================================================================
  // BOOT
  // ============================================================================
  scanToken();
  ensureUI();
  renderStats();

  log('🎵 VK Music Console Hook v' + VERSION + ' запущен', '#4ade80');
  log(state.accessToken
    ? '🔑 Токен: ' + state.accessToken.slice(0,25) + '…'
    : '🔑 Токен не найден — открой «Моя музыка», VK сам подсунет его в запросах', state.accessToken ? '#4ade80' : '#fbbf24');

  // авто-рефреш my.audios если токен уже есть
  if (state.accessToken) {
    setTimeout(() => {
      log('⟳ Автозагрузка через audio.get…', '#4a9eff');
      refreshMyAudios();
    }, 800);
  }

  // экспорт в window
  window.__VKHook = {
    version: VERSION,
    state,
    scanToken, refreshMyAudios, downloadTrack, downloadAll, downloadHls,
    vkApi,
    getTracks: () => [...state.tracks.values()],
    log
  };

  console.log(
    '%c🎵 VK Music Hook v' + VERSION + '%c готов. Используй window.__VKHook для API.',
    'background:linear-gradient(135deg,#4a9eff,#2b7fff);color:#fff;padding:4px 10px;border-radius:6px;font-weight:bold;',
    'color:#4ade80;font-weight:bold;margin-left:8px;'
  );
})();
