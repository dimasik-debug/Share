// ==UserScript==
// @name         Yandex Music Downloader v1.0
// @namespace    yamdl
// @version      1.0
// @description  Скачивание треков с Яндекс.Музыки + текст + теги + мульти-аккаунт + IndexedDB
// @match        https://music.yandex.ru/*
// @match        https://music.yandex.com/*
// @match        https://music.yandex.kz/*
// @match        https://music.yandex.by/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function YandexMusicDownloaderV1() {
    'use strict';

    const VERSION = '1.0';
    const MAX_ATTEMPTS = 5;
    const STALL_THRESHOLD_MS = 5000;
    const HEARTBEAT_MS = 1000;
    const UI_THROTTLE_MS = 40;
    const FIRST_CHUNK_TIMEOUT = 30000;
    const GLOBAL_STALL_TIMEOUT = 25000;
    const LOG_PCT_STEP = 10;

    const DB_NAME = 'yamdl_db';
    const DB_VERSION = 1;
    const STORE_DOWNLOADED = 'downloaded';
    const STORE_ACCOUNTS = 'accounts';

    const SAVE_TXT_KEY = 'yamdl_save_txt';
    const MINIMIZED_KEY = 'yamdl_minimized';
    const saveTxtEnabled = () => localStorage.getItem(SAVE_TXT_KEY) !== 'false';

    // Ротация ключей как в yandex_diagnostic.py v9
    const SECRET_KEYS = [
        { name: 'web',    value: '7tvSmFbyf5hJnIHhCimDDD' },
        { name: 'win32',  value: 'kzqU4XhfCaY6B6JTHODeq5' },
        { name: 'darwin', value: 'uz0zSpaYCLmgk6C7YLdo5F' },
    ];
    const API_BASE = location.host.includes('yandex.com')
        ? 'https://api.music.yandex.net'
        : 'https://api.music.yandex.ru';
    const UA = navigator.userAgent;

    console.log(`%c🎵 Yandex Music Downloader v${VERSION}`, 'color:#ffdb4d;font-size:16px;font-weight:bold;');

    const T0 = performance.now();
    const ts = () => `+${((performance.now() - T0) / 1000).toFixed(2)}s`;

    const SUNO = {
        bgPrimary:'#000', bgSecondary:'#0e0e10',
        border:'rgba(255,255,255,0.08)', textPrimary:'#fff',
        textSecondary:'rgba(255,255,255,0.6)', textTertiary:'rgba(255,255,255,0.4)',
        accent:'#ffdb4d', accent2:'#ffcc00', success:'#4ade80', danger:'#f87171', warning:'#fbbf24',
        font:"'Yandex Sans Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    };
    const CS = {
        accent:'color:#ffdb4d;font-weight:bold;', ok:'color:#4ade80;',
        err:'color:#f87171;', warn:'color:#fbbf24;', dim:'color:#8a9aaa;',
        ts:'color:#6a7a8a;font-style:italic;', net:'color:#ffcc00;', step:'color:#ffdb4d;font-weight:500;',
        stall:'color:#ff8c42;font-weight:bold;', hb:'color:#5a6a7a;', db:'color:#38bdf8;',
        txt:'color:#4ade80;'
    };

    // ===== SOUND =====
    const Sound = {
        ctx:null, enabled:true, masterGain:null,
        init() {
            if (this.ctx) return;
            try {
                this.ctx = new (window.AudioContext||window.webkitAudioContext)();
                this.masterGain = this.ctx.createGain();
                this.masterGain.gain.value = 0.3;
                this.masterGain.connect(this.ctx.destination);
            } catch(e){ this.enabled = false; }
        },
        note(f, d=0.35, v=0.15, delay=0, type='sine') {
            if (!this.enabled) return;
            this.init(); if (!this.ctx) return;
            try {
                if (this.ctx.state==='suspended') this.ctx.resume();
                const t = this.ctx.currentTime + delay;
                const o = this.ctx.createOscillator(), g = this.ctx.createGain(), fl = this.ctx.createBiquadFilter();
                fl.type='lowpass'; fl.frequency.value=3500;
                o.type=type; o.frequency.setValueAtTime(f,t);
                g.gain.setValueAtTime(0,t);
                g.gain.linearRampToValueAtTime(v,t+0.04);
                g.gain.setValueAtTime(v,t+d*0.6);
                g.gain.exponentialRampToValueAtTime(0.0001,t+d);
                o.connect(fl); fl.connect(g); g.connect(this.masterGain);
                o.start(t); o.stop(t+d+0.05);
            } catch(e){}
        },
        chord(fs,d=0.5,v=0.12,type='sine'){ fs.forEach((f,i)=>this.note(f,d+i*0.05,v*(1-i*0.15),i*0.03,type)); },
        click(){ this.note(587,0.1,0.06,0,'sine'); },
        start(){ this.chord([440,554,659],0.5,0.09); },
        trackDone(){ this.note(880,0.3,0.12,0); this.note(1175,0.4,0.08,0.08); },
        complete(){ this.chord([523,659,784,1047],0.8,0.10,'triangle'); },
        error(){ this.note(294,0.35,0.09,0); this.note(247,0.5,0.07,0.15); },
        stall(){ this.note(220,0.4,0.07,0,'sawtooth'); },
        save(){ this.note(1047,0.15,0.06,0,'triangle'); },
        txt(){ this.note(1319,0.1,0.05,0,'triangle'); }
    };

    // ===== STATE =====
    const state = {
        activeAccountId: null,
        accounts: [],
        isBatch: false, batchCancel: false,
        batchTotal: 0, batchDone: 0, batchErrors: 0, batchSkipped: 0,
        allTracks: [], selected: new Set(),
        downloadedIds: new Set(), downloadedMeta: new Map(),
        phase: 'idle',
        batchBytesDone: 0, batchStartTime: 0,
        filterOnlyNew: false,
        minimized: false,
        uid: null, cookies: ''
    };

    // ===== INDEXEDDB =====
    let db = null;
    async function dbInit() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onerror = () => reject(req.error);
            req.onsuccess = () => { db = req.result; resolve(db); };
            req.onupgradeneeded = (e) => {
                const d = e.target.result;
                if (!d.objectStoreNames.contains(STORE_DOWNLOADED)) {
                    d.createObjectStore(STORE_DOWNLOADED, { keyPath: 'id' });
                }
                if (!d.objectStoreNames.contains(STORE_ACCOUNTS)) {
                    d.createObjectStore(STORE_ACCOUNTS, { keyPath: 'id' });
                }
            };
        });
    }
    function dbTx(store, mode, fn) {
        return new Promise(async (resolve, reject) => {
            if (!db) await dbInit();
            const tx = db.transaction(store, mode);
            const req = fn(tx.objectStore(store));
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    const dbGetAll = (s) => dbTx(s, 'readonly', st => st.getAll());
    const dbAdd = (s, rec) => dbTx(s, 'readwrite', st => st.put(rec));
    const dbClear = (s) => dbTx(s, 'readwrite', st => st.clear());
    const dbRemove = (s, id) => dbTx(s, 'readwrite', st => st.delete(id));

    // ===== UTILS =====
    function fmtBytes(b) {
        if (!b || b < 0) return '0 B';
        if (b < 1024) return b + ' B';
        if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
        return (b/1048576).toFixed(2) + ' MB';
    }
    function fmtSpeed(mbps) {
        if (mbps < 0.01) return '—';
        if (mbps < 1) return (mbps*1024).toFixed(0) + ' KB/s';
        return mbps.toFixed(2) + ' MB/s';
    }
    function fmtEta(sec) {
        if (!isFinite(sec) || sec <= 0) return '—';
        if (sec < 60) return sec.toFixed(0) + 's';
        const m = Math.floor(sec/60), s = Math.round(sec%60);
        return m + 'm ' + s + 's';
    }
    function fmtAgo(tsMs) {
        const sec = (Date.now() - tsMs)/1000;
        if (sec < 60) return 'только что';
        if (sec < 3600) return Math.floor(sec/60) + ' мин назад';
        if (sec < 86400) return Math.floor(sec/3600) + ' ч назад';
        return Math.floor(sec/86400) + ' дн назад';
    }
    function sanitizeName(n) {
        return (n||'track').replace(/[\\/:*?"<>|]/g,'_').replace(/[\x00-\x1f]/g,'').replace(/\s+/g,' ').trim().slice(0,120)||'track';
    }
    function parseCookies() {
        const out = {};
        try {
            document.cookie.split(';').forEach(p => {
                const [k, ...v] = p.trim().split('=');
                if (k) out[k.trim()] = decodeURIComponent(v.join('='));
            });
        } catch(e){}
        return out;
    }
    function extractUidFromCookies(cookieStr) {
        const m = cookieStr.match(/\|(\d{6,})\.-1\./) || cookieStr.match(/\|(\d{6,})\./);
        return m ? m[1] : null;
    }
    function getSessionCookies() {
        const c = parseCookies();
        const keys = ['session_id','sessionid2','yandexuid','yuidss','i','L','Session_id','sessionid2','_yasc','my'];
        const parts = [];
        for (const k of keys) if (c[k]) parts.push(`${k}=${c[k]}`);
        return parts.join('; ');
    }
    function getUidFromPage() {
        // Yandex Music хранит uid в window или в localStorage
        try {
            if (window.__INITIAL_STATE__?.user?.uid) return String(window.__INITIAL_STATE__.user.uid);
            if (window.__INITIAL_STATE__?.account?.uid) return String(window.__INITIAL_STATE__.account.uid);
        } catch(e){}
        try {
            const uid = extractUidFromCookies(document.cookie);
            if (uid) return uid;
        } catch(e){}
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (/uid|user/i.test(k)) {
                    const v = localStorage.getItem(k);
                    const m = v && v.match(/\d{5,}/);
                    if (m) return m[0];
                }
            }
        } catch(e){}
        return null;
    }

    // ===== SIGN =====
    async function generateSign(trackId, quality, codecs, transport, tsSec, secret) {
        const base = `${tsSec}${trackId}${quality}${codecs.join('')}${transport}`;
        const key = await crypto.subtle.importKey(
            'raw', new TextEncoder().encode(secret),
            { name:'HMAC', hash:'SHA-256' }, false, ['sign']
        );
        const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(base));
        let b64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
        return b64.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    }

    async function buildHeaders(retpath) {
        const h = {
            'Accept': '*/*',
            'Accept-Language': 'ru',
            'Origin': 'https://music.yandex.ru',
            'Referer': 'https://music.yandex.ru/',
            'User-Agent': UA,
            'X-Requested-With': 'XMLHttpRequest',
            'X-Yandex-Music-Client': 'YandexMusicWebNext/1.0.0',
            'X-Yandex-Music-Without-Invocation-Info': '1',
        };
        if (state.uid) h['X-Yandex-Music-Multi-Auth-User-Id'] = String(state.uid);
        if (retpath) h['X-Retpath-Y'] = retpath;
        return h;
    }

    // ===== TRACK DISCOVERY =====
    function collectTracksFromDOM() {
        const seen = new Set();
        const out = [];
        // Yandex Music разнообразен в разметке — пробуем несколько селекторов
        const nodes = document.querySelectorAll('[data-track-id], .d-track, [class*="Track_root"]');
        nodes.forEach(el => {
            try {
                let id = el.getAttribute('data-track-id');
                if (!id) {
                    const sub = el.querySelector('[data-track-id]');
                    id = sub && sub.getAttribute('data-track-id');
                }
                if (!id || seen.has(id)) return;
                seen.add(id);

                let title = '';
                let artist = '';
                const titleEl = el.querySelector('.d-track__title, [class*="TrackTitle"], [class*="track-title"]');
                const artistEl = el.querySelector('.d-track__artists, [class*="TrackArtists"], [class*="track-artist"]');
                if (titleEl) title = titleEl.textContent.trim();
                if (artistEl) artist = artistEl.textContent.trim();
                if (!title) {
                    const links = el.querySelectorAll('a');
                    if (links.length >= 2) { artist = links[0].textContent.trim(); title = links[1].textContent.trim(); }
                }

                let durationMs = 0;
                const durEl = el.querySelector('.d-track__duration, [class*="duration"]');
                if (durEl) {
                    const m = durEl.textContent.trim().match(/^(\d+):(\d+)$/);
                    if (m) durationMs = (parseInt(m[1])*60 + parseInt(m[2])) * 1000;
                }

                let albumId = null;
                const albumLink = el.querySelector('a[href*="/album/"]');
                if (albumLink) {
                    const m = albumLink.getAttribute('href').match(/\/album\/(\d+)/);
                    if (m) albumId = m[1];
                }
                if (!albumId) {
                    const href = el.querySelector('a')?.getAttribute('href') || '';
                    const m = href.match(/\/album\/(\d+)/);
                    if (m) albumId = m[1];
                }

                out.push({
                    id: String(id), title: title || `track_${id}`,
                    artist: artist || '—', durationMs, albumId,
                    source: 'dom'
                });
            } catch(e){}
        });
        return out;
    }

    async function fetchTrackMeta(trackId) {
        try {
            const headers = await buildHeaders();
            const r = await fetch(`${API_BASE}/tracks/${trackId}`, { headers, credentials: 'include' });
            if (!r.ok) return null;
            const data = await r.json();
            const t = Array.isArray(data.result) ? data.result[0] : data.result;
            if (!t) return null;
            return {
                id: String(t.id),
                title: t.title,
                artist: (t.artists || []).map(a => a.name).join(', '),
                album: t.albums && t.albums[0] ? t.albums[0].title : '',
                albumId: t.albums && t.albums[0] ? String(t.albums[0].id) : null,
                durationMs: t.durationMs || 0,
                year: t.albums && t.albums[0] ? t.albums[0].year : null,
                lyrics: null,
                lyricsId: t.lyricsId || null,
                coverUri: t.coverUri || (t.albums && t.albums[0] ? t.albums[0].coverUri : null),
                raw: t
            };
        } catch(e) { return null; }
    }

    async function fetchLyrics(trackId) {
        try {
            const headers = await buildHeaders();
            const r = await fetch(`${API_BASE}/tracks/${trackId}/lyrics`, { headers, credentials: 'include' });
            if (!r.ok) return null;
            const data = await r.json();
            return data?.result?.lyrics || null;
        } catch(e) { return null; }
    }

    // ===== GET-FILE-INFO + DECRYPT =====
    async function getFileInfo(trackId, albumId) {
        const codecs = ['aac-mp4','aac','he-aac','mp3','flac-mp4','flac'];
        const baseTs = Math.floor(Date.now()/1000);
        for (const transport of ['encraw','raw']) {
            for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
                const tsSec = baseTs + attempt;
                const keyObj = SECRET_KEYS[(attempt - 1) % SECRET_KEYS.length];
                let sign;
                try { sign = await generateSign(trackId, 'nq', codecs, transport, tsSec, keyObj.value); }
                catch(e) { logErr(`sign: ${e.message}`); break; }

                const url = `${API_BASE}/get-file-info?ts=${tsSec}&trackId=${trackId}&quality=nq`
                    + `&codecs=${codecs.join(',')}&transports=${transport}&sign=${sign}`;
                const headers = await buildHeaders();
                try {
                    logNet(`get-file-info ${transport} #${attempt} key=${keyObj.name}`);
                    const r = await fetch(url, { headers, credentials: 'include' });
                    if (r.status === 200) {
                        const data = await r.json();
                        const info = data.downloadInfo || data.result?.downloadInfo;
                        if (info && info.urls && info.urls.length) {
                            logOk(`✓ ${transport} #${attempt} [${keyObj.name}] codec=${info.codec} bitrate=${info.bitrate}${info.key?' +key':''}`);
                            return { ...info, transport, key_used: keyObj.name };
                        }
                        logWarn(`200 но нет urls`);
                    } else if (r.status === 403) {
                        logWarn(`403 [${keyObj.name}] — пауза`);
                        await new Promise(res => setTimeout(res, 3000 + attempt*500));
                    } else if ([429,502,503,504].includes(r.status)) {
                        await new Promise(res => setTimeout(res, 3000));
                    } else {
                        logWarn(`HTTP ${r.status}`);
                        await new Promise(res => setTimeout(res, 1000));
                    }
                } catch(e) {
                    logErr(`${transport} #${attempt}: ${e.message}`);
                    await new Promise(res => setTimeout(res, 1000));
                }
            }
        }
        return null;
    }

    function hexToBytes(hex) {
        const out = new Uint8Array(hex.length / 2);
        for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i*2, 2), 16);
        return out;
    }
    function bigEndianCounter(val) {
        const b = new Uint8Array(16);
        let v = BigInt(val);
        for (let i = 15; i >= 0; i--) { b[i] = Number(v & 0xffn); v >>= 8n; }
        return b;
    }
    async function aesCtrDecrypt(keyBytes, counter, data) {
        const key = await crypto.subtle.importKey('raw', keyBytes, { name:'AES-CTR' }, false, ['decrypt']);
        return crypto.subtle.decrypt({ name:'AES-CTR', counter, length:128 }, key, data);
    }
    async function tryDecrypt(data, keyHex) {
        const keyBytes = hexToBytes(keyHex);
        const candidates = [0, 1, 256, 65536, 16777216];
        for (const init of candidates) {
            try {
                const dec = await aesCtrDecrypt(keyBytes, bigEndianCounter(init), data);
                const h = new Uint8Array(dec.slice(0, 16));
                const isFtyp = h[4]===0x66 && h[5]===0x74 && h[6]===0x79 && h[7]===0x70;
                const isId3 = h[0]===0x49 && h[1]===0x44 && h[2]===0x33;
                const isMp3 = h[0]===0xff && (h[1]&0xe0)===0xe0;
                if (isFtyp) return { buf: dec, type: 'mp4' };
                if (isId3 || isMp3) return { buf: dec, type: 'mp3' };
            } catch(e){}
        }
        return null;
    }

    async function downloadTrack(clip, seqNum, idxInBatch, totalInBatch, onProgress) {
        const title = clip.title || `track_${clip.id}`;
        const albumId = clip.albumId || '';
        const tT0 = performance.now();

        logStep(`[${idxInBatch+1}/${totalInBatch}] [${String(seqNum).padStart(2,'0')}] "${title.slice(0,50)}"`);

        const info = await getFileInfo(clip.id, albumId);
        if (!info) throw new Error('Не удалось получить ссылку');

        const cdnUrl = info.urls[0];
        const headers = {
            'User-Agent': UA,
            'Referer': 'https://music.yandex.ru/',
            'Accept-Encoding': 'identity',
        };

        const ctrl = new AbortController();
        const hardTimeout = setTimeout(() => ctrl.abort(), 300000);
        const t1 = performance.now();

        let r;
        try {
            r = await fetch(cdnUrl, { headers, signal: ctrl.signal });
        } catch(e) {
            clearTimeout(hardTimeout);
            throw new Error(`CDN fetch: ${e.message}`);
        }
        if (!r.ok) { clearTimeout(hardTimeout); throw new Error(`CDN HTTP ${r.status}`); }

        const total = parseInt(r.headers.get('content-length') || '0', 10);
        const reader = r.body.getReader();
        const chunks = [];
        let loaded = 0, lastTick = 0, lastChunkAt = performance.now();
        let lastPct = 0, stallWarned = false, chunkCount = 0;

        const hb = setInterval(() => {
            const now = performance.now();
            const sinceChunk = now - lastChunkAt;
            const sec = (now - t1) / 1000;
            const sp = sec > 0 ? (loaded/1048576/sec) : 0;
            const pct = total > 0 ? (loaded/total*100) : 0;
            if (sinceChunk > GLOBAL_STALL_TIMEOUT && loaded > 0) { ctrl.abort(); return; }
            if (sinceChunk > STALL_THRESHOLD_MS) {
                if (!stallWarned) { stallWarned = true; logStall(`STALL ${(sinceChunk/1000).toFixed(1)}s`); Sound.stall(); }
                if (onProgress) onProgress(loaded, total, sp, pct, sinceChunk, true);
            } else {
                if (stallWarned) { stallWarned = false; logOk(`сеть ожила`); }
                else if (chunkCount > 0 && onProgress) onProgress(loaded, total, sp, pct, 0, false);
            }
        }, HEARTBEAT_MS);

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                loaded += value.byteLength;
                lastChunkAt = performance.now();
                chunkCount++;
                const now = performance.now();
                if (lastTick === 0 || now - lastTick > UI_THROTTLE_MS) {
                    lastTick = now;
                    const sec = (now - t1) / 1000;
                    const sp = sec > 0 ? (loaded/1048576/sec) : 0;
                    const pct = total > 0 ? (loaded/total*100) : 0;
                    if (onProgress) onProgress(loaded, total, sp, pct, 0, false);
                    if (pct - lastPct >= LOG_PCT_STEP) {
                        lastPct = Math.floor(pct/LOG_PCT_STEP)*LOG_PCT_STEP;
                        log(`  ⬇ ${Math.round(pct)}% · ${fmtBytes(loaded)}/${fmtBytes(total)} · ${fmtSpeed(sp)}`, SUNO.textTertiary, CS.dim);
                    }
                }
            }
        } catch(e) {
            if (e.name === 'AbortError') throw new Error(`stall/timeout · ${fmtBytes(loaded)}/${fmtBytes(total)}`);
            throw e;
        } finally {
            clearInterval(hb);
            clearTimeout(hardTimeout);
        }

        const enc = new Uint8Array(loaded);
        let off = 0;
        for (const c of chunks) { enc.set(c, off); off += c.byteLength; }
        logOk(`Скачано ${fmtBytes(enc.byteLength)} · ${chunkCount} chunks`);

        // Проверка сигнатуры
        let final = enc, ftype = null;
        if (enc[4]===0x66 && enc[5]===0x74 && enc[6]===0x79 && enc[7]===0x70) ftype = 'mp4';
        else if (enc[0]===0x49 && enc[1]===0x44 && enc[2]===0x33) ftype = 'mp3';
        else if (enc[0]===0xff && (enc[1]&0xe0)===0xe0) ftype = 'mp3';

        if (!ftype) {
            if (!info.key) throw new Error('Файл зашифрован, но ключа нет');
            if (onProgress) onProgress(loaded, total, 0, 92, 0, false);
            log(`  🔓 AES-CTR decrypt...`, SUNO.accent, CS.accent);
            const res = await tryDecrypt(enc, info.key);
            if (!res) throw new Error('Не удалось расшифровать (все counter не подошли)');
            final = new Uint8Array(res.buf);
            ftype = res.type;
            logOk(`Расшифровано · ${ftype} · ${fmtBytes(final.byteLength)}`);
        }

        const mime = ftype === 'mp3' ? 'audio/mpeg' : 'audio/mp4';
        const tMs = (performance.now() - tT0).toFixed(0);
        logOk(`ГОТОВО · ${(tMs/1000).toFixed(1)}s · ${fmtBytes(final.byteLength)} · codec=${info.codec} bitrate=${info.bitrate}`);
        return { buf: final, mime, ext: ftype === 'mp3' ? 'mp3' : 'm4a', size: final.byteLength, info };
    }

    // ===== SAVE =====
    function triggerDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.style.display = 'none';
        document.body.appendChild(a); a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 3000);
    }

    function buildTxt(track, lyrics, seqNum) {
        const sep = '═'.repeat(64);
        const L = [];
        L.push(sep);
        L.push(`🎵 ${track.title || '—'}`);
        L.push(sep);
        L.push(`ID:        ${track.id}`);
        L.push(`Исполнитель: ${track.artist || '—'}`);
        if (track.album) L.push(`Альбом:    ${track.album}`);
        if (track.year) L.push(`Год:       ${track.year}`);
        if (track.durationMs) {
            const total = Math.round(track.durationMs/1000);
            const m = Math.floor(total/60), s = total % 60;
            L.push(`Длительность: ${m}:${String(s).padStart(2,'0')}`);
        }
        L.push(`Скачано:   ${new Date().toLocaleString('ru-RU')}`);
        L.push('');
        L.push(sep);
        L.push('📝 ТЕКСТ ПЕСНИ');
        L.push(sep);
        if (lyrics && lyrics.fullLyrics) {
            L.push(lyrics.fullLyrics);
        } else if (lyrics && lyrics.text) {
            L.push(lyrics.text);
        } else {
            L.push('(текст не найден — возможно, инструментал или недоступен)');
        }
        L.push('');
        L.push(sep);
        L.push(`© Yandex Music Downloader v${VERSION} · ${new Date().toISOString().slice(0,10)}`);
        L.push(sep);
        return L.join('\n');
    }

    function buildJson(track, lyrics, size, ext, seqNum) {
        return {
            _meta: {
                savedBy: `Yandex Music Downloader v${VERSION}`,
                savedAt: new Date().toISOString(),
                seqNum: seqNum,
                filename: `${sanitizeName(track.artist||'')} - ${sanitizeName(track.title||'')} [${String(seqNum).padStart(2,'0')}].${ext}`,
                size: size
            },
            id: track.id,
            title: track.title,
            artist: track.artist,
            album: track.album,
            albumId: track.albumId,
            year: track.year,
            durationMs: track.durationMs,
            coverUri: track.coverUri,
            lyrics: lyrics ? { fullLyrics: lyrics.fullLyrics || lyrics.text || '', hasRights: lyrics.hasRights, textLanguage: lyrics.textLanguage } : null,
            raw: track.raw || null
        };
    }

    function saveTxtJson(track, lyrics, size, ext, seqNum) {
        if (!saveTxtEnabled()) return;
        const artistPart = sanitizeName(track.artist || 'unknown');
        const titlePart = sanitizeName(track.title || 'track');
        const suffix = ` [${String(seqNum).padStart(2,'0')}]`;
        try {
            const txt = buildTxt(track, lyrics, seqNum);
            const blob = new Blob([txt], { type:'text/plain;charset=utf-8' });
            triggerDownload(blob, `${artistPart} - ${titlePart}${suffix}.txt`);
            logTxt(`${artistPart} - ${titlePart}${suffix}.txt (${(blob.size/1024).toFixed(1)} KB)${lyrics?' · с текстом':''}`);
        } catch(e) { logWarn(`TXT: ${e.message}`); }
        try {
            const json = buildJson(track, lyrics, size, ext, seqNum);
            const blob = new Blob([JSON.stringify(json, null, 2)], { type:'application/json;charset=utf-8' });
            triggerDownload(blob, `${artistPart} - ${titlePart}${suffix}.json`);
            logTxt(`${artistPart} - ${titlePart}${suffix}.json (${(blob.size/1024).toFixed(1)} KB)`);
        } catch(e) { logWarn(`JSON: ${e.message}`); }
    }

    // ===== UI =====
    document.body.insertAdjacentHTML('beforeend', `
        <style>
            @font-face{font-family:'Yandex Sans Text';src:local('Yandex Sans Text'),local('Arial');}
            #yamdl{position:fixed;bottom:16px;right:16px;z-index:2147483647;background:#000;color:#fff;
                font-family:${SUNO.font};width:620px;max-width:calc(100vw - 32px);border-radius:20px;
                border:1px solid rgba(255,255,255,0.08);box-shadow:0 24px 80px rgba(0,0,0,0.8);
                overflow:hidden;display:flex;flex-direction:column;max-height:calc(100vh - 32px);
                animation:yamdl-in 0.4s cubic-bezier(0.16,1,0.3,1);}
            @keyframes yamdl-in{from{opacity:0;transform:translateY(20px) scale(0.96);}to{opacity:1;transform:translateY(0) scale(1);}}
            #yamdl-mini{position:fixed;bottom:16px;right:16px;z-index:2147483647;background:#000;
                border:1px solid rgba(255,255,255,0.08);border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,0.7);
                display:none;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;transition:all 0.2s;
                font-family:${SUNO.font};}
            #yamdl-mini:hover{box-shadow:0 16px 48px rgba(255,219,77,0.3);transform:translateY(-1px);}
            .yamdl-btn{padding:10px 16px;border-radius:999px;font-family:${SUNO.font};font-size:13px;
                font-weight:500;border:1px solid transparent;cursor:pointer;transition:all 0.2s;
                display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;}
            .yamdl-btn-accent{background:linear-gradient(135deg,#ffdb4d,#ffcc00);color:#000;
                box-shadow:0 4px 20px rgba(255,204,0,0.35);font-weight:600;}
            .yamdl-btn-accent:hover{box-shadow:0 6px 24px rgba(255,204,0,0.5);transform:translateY(-1px);}
            .yamdl-btn-accent:disabled{opacity:0.4;cursor:not-allowed;transform:none;}
            .yamdl-btn-danger{background:rgba(248,113,113,0.15);color:#f87171;border:1px solid rgba(248,113,113,0.2);}
            .yamdl-btn-ghost{background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.08);}
            .yamdl-btn-ghost:hover{background:rgba(255,255,255,0.1);color:#fff;}
            .yamdl-btn-ghost:disabled{opacity:0.3;cursor:not-allowed;}
            .yamdl-btn-ghost.active{background:rgba(255,219,77,0.15);color:#ffdb4d;border-color:rgba(255,219,77,0.3);}
            .yamdl-icon-btn{width:32px;height:32px;padding:0;border-radius:10px;background:rgba(255,255,255,0.06);
                color:rgba(255,255,255,0.6);border:none;cursor:pointer;transition:all 0.2s;
                display:inline-flex;align-items:center;justify-content:center;font-size:14px;}
            .yamdl-icon-btn:hover{background:rgba(255,255,255,0.1);color:#fff;}
            #yamdl-log::-webkit-scrollbar{width:6px;}
            #yamdl-log::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px;}
            #yamdl-list::-webkit-scrollbar{width:6px;}
            #yamdl-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px;}
            .yamdl-pulse{animation:yamdl-pulse 2s ease-in-out infinite;}
            @keyframes yamdl-pulse{0%,100%{opacity:1;}50%{opacity:0.5;}}
            .yamdl-progress-bar{width:100%;height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;}
            .yamdl-progress-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,#ffdb4d,#ffcc00);transition:width 0.15s ease;}
            .yamdl-progress-fill.done{background:linear-gradient(90deg,#4ade80,#22c55e);}
            .yamdl-progress-fill.error{background:linear-gradient(90deg,#f87171,#dc2626);}
            .yamdl-progress-fill.stall{background:linear-gradient(90deg,#ff8c42,#ff5722);animation:yamdl-pulse 1s infinite;}
            .yamdl-track-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;
                cursor:pointer;transition:background 0.15s;border:1px solid transparent;}
            .yamdl-track-row:hover{background:rgba(255,255,255,0.04);}
            .yamdl-track-row.selected{background:rgba(255,219,77,0.08);border-color:rgba(255,219,77,0.2);}
            .yamdl-track-row.downloaded{background:rgba(74,222,128,0.06);border-color:rgba(74,222,128,0.15);}
            .yamdl-track-row.downloaded.selected{background:rgba(255,219,77,0.12);border-color:rgba(255,219,77,0.35);}
            .yamdl-checkbox{width:16px;height:16px;border-radius:4px;border:1.5px solid rgba(255,255,255,0.25);
                flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;color:#000;
                transition:all 0.15s;background:transparent;}
            .yamdl-checkbox.checked{background:linear-gradient(135deg,#ffdb4d,#ffcc00);border-color:transparent;font-weight:bold;}
            .yamdl-checkbox.downloaded-checked{background:linear-gradient(135deg,#4ade80,#22c55e);border-color:transparent;color:#000;font-weight:bold;}
            .yamdl-track-idx{font-size:10px;color:rgba(255,255,255,0.3);font-family:'SF Mono',monospace;width:24px;flex-shrink:0;}
            .yamdl-track-title{font-size:12px;color:rgba(255,255,255,0.85);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
            .yamdl-track-row.downloaded .yamdl-track-title{color:rgba(74,222,128,0.9);}
            .yamdl-track-meta{font-size:9px;color:rgba(255,255,255,0.35);font-family:'SF Mono',monospace;flex-shrink:0;margin-right:4px;}
            .yamdl-track-badge{font-size:9px;padding:2px 6px;border-radius:4px;background:rgba(255,219,77,0.15);
                color:#ffdb4d;flex-shrink:0;font-family:'SF Mono',monospace;min-width:56px;text-align:center;}
            .yamdl-track-badge.downloaded{background:rgba(74,222,128,0.25);color:#4ade80;}
            .yamdl-track-badge.new{background:rgba(255,219,77,0.2);color:#ffdb4d;}
            .yamdl-stat-line{font-family:'SF Mono',Consolas,monospace;font-size:10px;color:rgba(255,255,255,0.5);letter-spacing:0.1px;}
            .yamdl-account-bar{display:flex;gap:8px;align-items:center;padding:8px 10px;background:rgba(255,219,77,0.06);
                border:1px solid rgba(255,219,77,0.15);border-radius:8px;margin-bottom:10px;}
            .yamdl-account-bar select{flex:1;background:rgba(0,0,0,0.4);color:#fff;border:1px solid rgba(255,255,255,0.1);
                border-radius:6px;padding:6px 8px;font-size:11px;font-family:'SF Mono',monospace;outline:none;cursor:pointer;min-width:0;}
        </style>

        <div id="yamdl-mini" title="Развернуть Yandex Music Downloader">
            <div style="width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#ffdb4d,#ffcc00);
                display:flex;align-items:center;justify-content:center;font-size:14px;">🎵</div>
            <div style="display:flex;flex-direction:column;line-height:1.2;">
                <div style="font-size:11px;color:#fff;font-weight:500;">Yandex Music DL</div>
                <div id="yamdl-mini-status" style="font-size:9px;color:rgba(255,255,255,0.5);font-family:'SF Mono',monospace;">готов</div>
            </div>
            <div id="yamdl-mini-badge" style="display:none;background:#4ade80;color:#000;font-size:9px;font-weight:bold;
                padding:2px 6px;border-radius:8px;font-family:'SF Mono',monospace;">0</div>
            <div style="font-size:14px;color:rgba(255,255,255,0.4);">▲</div>
        </div>

        <div id="yamdl">
            <div style="display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid ${SUNO.border};flex-shrink:0;">
                <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,${SUNO.accent},${SUNO.accent2});
                    display:flex;align-items:center;justify-content:center;font-size:18px;">🎵</div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:500;font-size:15px;letter-spacing:-0.2px;">Yandex Music Downloader</div>
                    <div style="font-size:11px;color:${SUNO.textTertiary};letter-spacing:0.3px;margin-top:1px;">v${VERSION} · Lyrics · AES-CTR</div>
                </div>
                <button id="yamdl-sound" class="yamdl-icon-btn" title="Звук">🔊</button>
                <button id="yamdl-clear" class="yamdl-icon-btn" title="Очистить лог">🗑</button>
                <button id="yamdl-minimize" class="yamdl-icon-btn" title="Свернуть">—</button>
                <button id="yamdl-close" class="yamdl-icon-btn" title="Закрыть">✕</button>
            </div>

            <div id="yamdl-status" style="padding:14px 18px;border-bottom:1px solid ${SUNO.border};display:flex;align-items:center;gap:10px;flex-shrink:0;">
                <div id="yamdl-status-dot" class="yamdl-pulse" style="width:8px;height:8px;border-radius:50%;background:${SUNO.accent};flex-shrink:0;"></div>
                <div id="yamdl-status-text" style="font-size:13px;color:${SUNO.textSecondary};">Инициализация...</div>
            </div>

            <div id="yamdl-list-panel" style="display:none;padding:14px 18px;border-bottom:1px solid ${SUNO.border};flex-shrink:0;">
                <div class="yamdl-account-bar">
                    <div style="width:8px;height:8px;border-radius:50%;background:#ffdb4d;flex-shrink:0;"></div>
                    <div style="font-size:11px;color:#ffdb4d;font-family:'SF Mono',monospace;font-weight:500;flex-shrink:0;">АККАУНТ</div>
                    <select id="yamdl-account-select"></select>
                    <button id="yamdl-acc-add" class="yamdl-btn yamdl-btn-ghost" style="padding:4px 10px;font-size:10px;">+ добавить</button>
                    <button id="yamdl-acc-del" class="yamdl-btn yamdl-btn-ghost" style="padding:4px 10px;font-size:10px;">🗑</button>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:10px;color:rgba(255,255,255,0.35);
                    font-family:'SF Mono',monospace;margin-bottom:8px;padding:0 4px;">
                    <span>Аккаунтов: <span id="yamdl-acc-count">0</span></span>
                    <span>💡 Переключи → "Загрузить список"</span>
                </div>
                <div id="yamdl-db-summary" style="display:none;padding:8px 10px;background:rgba(56,189,248,0.06);
                    border:1px solid rgba(56,189,248,0.15);border-radius:8px;margin-bottom:10px;
                    font-size:11px;font-family:'SF Mono',monospace;align-items:center;gap:12px;">
                    <div style="width:8px;height:8px;border-radius:50%;background:#38bdf8;"></div>
                    <div style="flex:1;"><span style="color:#38bdf8;font-weight:500;">IndexedDB</span> · <span id="yamdl-db-count">0</span> скачано</div>
                    <button id="yamdl-db-clear" class="yamdl-btn yamdl-btn-ghost" style="padding:4px 10px;font-size:10px;">🗑 база</button>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px;">
                    <div style="font-size:12px;color:${SUNO.textSecondary};letter-spacing:0.2px;">ВЫБЕРИ ТРЕКИ</div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        <button id="yamdl-filter-new" class="yamdl-btn yamdl-btn-ghost" style="padding:5px 10px;font-size:11px;">Только новые</button>
                        <button id="yamdl-save-txt" class="yamdl-btn yamdl-btn-ghost" style="padding:5px 10px;font-size:11px;">📝 TXT+JSON</button>
                        <button id="yamdl-sel-all" class="yamdl-btn yamdl-btn-ghost" style="padding:5px 10px;font-size:11px;">Все</button>
                        <button id="yamdl-sel-none" class="yamdl-btn yamdl-btn-ghost" style="padding:5px 10px;font-size:11px;">Ничего</button>
                    </div>
                </div>
                <div id="yamdl-list" style="max-height:300px;overflow-y:auto;background:${SUNO.bgSecondary};
                    border-radius:10px;padding:6px;border:1px solid ${SUNO.border};"></div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
                    <div id="yamdl-list-info" style="font-size:11px;color:${SUNO.textTertiary};">—</div>
                    <button id="yamdl-start-batch" class="yamdl-btn yamdl-btn-accent" style="padding:9px 18px;">▶ Старт</button>
                </div>
            </div>

            <div id="yamdl-batch" style="display:none;padding:14px 18px;border-bottom:1px solid ${SUNO.border};flex-shrink:0;">
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
                    <div style="font-size:12px;color:${SUNO.textSecondary};letter-spacing:0.2px;">ОБЩИЙ ПРОГРЕСС</div>
                    <div style="display:flex;align-items:baseline;gap:6px;">
                        <span id="yamdl-batch-done" style="font-size:20px;font-weight:500;">0</span>
                        <span style="font-size:13px;color:${SUNO.textTertiary};">/ <span id="yamdl-batch-total">0</span></span>
                    </div>
                </div>
                <div class="yamdl-progress-bar" style="margin-bottom:8px;">
                    <div id="yamdl-batch-bar" class="yamdl-progress-fill done" style="width:0%;"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:10px;color:${SUNO.textTertiary};
                    font-family:'SF Mono',monospace;margin-bottom:4px;">
                    <span id="yamdl-batch-ok">✓ 0 OK</span>
                    <span id="yamdl-batch-skip">⏭ 0 skip</span>
                    <span id="yamdl-batch-bytes">📦 0 MB</span>
                    <span id="yamdl-batch-err">✕ 0 errors</span>
                </div>
                <div class="yamdl-stat-line" id="yamdl-batch-eta">⏱ ETA — · avg — MB/s</div>
            </div>

            <div id="yamdl-current" style="display:none;padding:14px 18px;border-bottom:1px solid ${SUNO.border};flex-shrink:0;">
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;gap:10px;">
                    <div id="yamdl-current-title" style="font-size:13px;color:${SUNO.textPrimary};font-weight:500;
                        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;">—</div>
                    <div id="yamdl-current-pct" style="font-size:16px;color:${SUNO.accent};font-weight:500;
                        font-family:'SF Mono',monospace;flex-shrink:0;">0%</div>
                </div>
                <div class="yamdl-progress-bar" style="margin-bottom:10px;">
                    <div id="yamdl-current-bar" class="yamdl-progress-fill" style="width:0%;"></div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;gap:10px;">
                    <div id="yamdl-current-stage" style="font-size:12px;color:${SUNO.textPrimary};
                        font-family:'SF Mono',monospace;font-weight:500;">—</div>
                    <div id="yamdl-current-count" style="font-size:11px;color:${SUNO.textTertiary};
                        font-family:'SF Mono',monospace;flex-shrink:0;">0/0</div>
                </div>
                <div class="yamdl-stat-line" id="yamdl-current-net">net: —</div>
            </div>

            <div style="padding:14px 18px;border-bottom:1px solid ${SUNO.border};flex-shrink:0;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="font-size:11px;color:${SUNO.textTertiary};letter-spacing:0.3px;font-weight:500;">DIAG LOG</span>
                    <span style="font-size:10px;color:${SUNO.textTertiary};">live · console too</span>
                </div>
                <div id="yamdl-log" style="font-size:11px;color:${SUNO.textSecondary};background:${SUNO.bgSecondary};
                    padding:12px 14px;border-radius:12px;max-height:240px;overflow-y:auto;
                    font-family:'SF Mono',Consolas,'Courier New',monospace;line-height:1.6;border:1px solid ${SUNO.border};"></div>
            </div>

            <div style="display:flex;gap:8px;padding:16px 18px;flex-shrink:0;">
                <button id="yamdl-all" class="yamdl-btn yamdl-btn-accent" style="flex:1;padding:12px;">
                    <span style="font-size:15px;">⬇</span> Загрузить список
                </button>
                <button id="yamdl-stop" class="yamdl-btn yamdl-btn-danger" style="display:none;">⏹ Стоп</button>
            </div>

            <div style="padding:0 18px 14px;display:flex;justify-content:space-between;font-size:10px;
                color:${SUNO.textTertiary};letter-spacing:0.2px;flex-shrink:0;">
                <span id="yamdl-net-status">🌐 online</span>
                <span id="yamdl-timer">+0.00s</span>
            </div>
        </div>
    `);

    const $ = id => document.getElementById(id);
    const logEl = $('yamdl-log');
    const statusDot = $('yamdl-status-dot');
    const statusText = $('yamdl-status-text');
    const batchEl = $('yamdl-batch');
    const currentEl = $('yamdl-current');
    const timerEl = $('yamdl-timer');
    const netStatusEl = $('yamdl-net-status');
    const listPanel = $('yamdl-list-panel');
    const listEl = $('yamdl-list');
    const listInfo = $('yamdl-list-info');
    const dbSummary = $('yamdl-db-summary');
    const miniStatus = $('yamdl-mini-status');
    const miniBadge = $('yamdl-mini-badge');

    setInterval(() => { timerEl.textContent = ts(); }, 100);
    setInterval(() => {
        netStatusEl.textContent = navigator.onLine ? '🌐 online' : '📡 OFFLINE';
        netStatusEl.style.color = navigator.onLine ? SUNO.textTertiary : SUNO.danger;
    }, 500);

    function log(t, color=SUNO.textSecondary, cs=CS.dim) {
        const line = document.createElement('div');
        line.innerHTML = `<span style="color:${SUNO.textTertiary};">[${ts()}]</span> <span style="color:${color};">${t}</span>`;
        logEl.appendChild(line);
        logEl.scrollTop = logEl.scrollHeight;
        console.log(`%c[${ts()}] %c${t}`, CS.ts, cs);
    }
    const logOk = t => log('✓ '+t, SUNO.success, CS.ok);
    const logErr = t => log('✕ '+t, SUNO.danger, CS.err);
    const logWarn = t => log('⚠ '+t, SUNO.warning, CS.warn);
    const logStep = t => log('▸ '+t, SUNO.accent, CS.step);
    const logNet = t => log('🌐 '+t, '#ffcc00', CS.net);
    const logStall = t => log('🐌 '+t, '#ff8c42', CS.stall);
    const logDb = t => log('💾 '+t, '#38bdf8', CS.db);
    const logTxt = t => log('📝 '+t, '#4ade80', CS.txt);

    function setStatus(text, kind='idle') {
        statusText.textContent = text;
        const c = {idle:SUNO.accent, ok:SUNO.success, err:SUNO.danger, warn:SUNO.warning, stall:'#ff8c42'};
        statusDot.style.background = c[kind] || SUNO.accent;
        statusDot.classList.toggle('yamdl-pulse', kind==='idle');
        if (miniStatus) miniStatus.textContent = text;
    }

    function setCurrent(title, done, total, stage, pct, st, netInfo) {
        currentEl.style.display = 'block';
        $('yamdl-current-title').textContent = title;
        $('yamdl-current-count').textContent = `${done}/${total}`;
        $('yamdl-current-stage').textContent = stage;
        $('yamdl-current-pct').textContent = Math.round(pct) + '%';
        if (netInfo !== undefined) $('yamdl-current-net').textContent = 'net: ' + netInfo;
        const bar = $('yamdl-current-bar');
        bar.style.width = pct + '%';
        bar.className = 'yamdl-progress-fill' + (st === 'error' ? ' error' : st === 'done' ? ' done' : st === 'stall' ? ' stall' : '');
    }

    function updateBatchProgress() {
        batchEl.style.display = 'block';
        const { batchDone, batchTotal, batchErrors, batchSkipped, batchBytesDone, batchStartTime } = state;
        $('yamdl-batch-done').textContent = batchDone;
        $('yamdl-batch-total').textContent = batchTotal;
        $('yamdl-batch-bar').style.width = batchTotal > 0 ? `${Math.round(batchDone/batchTotal*100)}%` : '0%';
        $('yamdl-batch-ok').textContent = `✓ ${batchDone} OK`;
        $('yamdl-batch-skip').textContent = `⏭ ${batchSkipped} skip`;
        $('yamdl-batch-err').textContent = `✕ ${batchErrors} errors`;
        $('yamdl-batch-bytes').textContent = `📦 ${fmtBytes(batchBytesDone)}`;
        const elapsed = (performance.now() - batchStartTime) / 1000;
        const avgSpeed = elapsed > 0 ? (batchBytesDone/1048576/elapsed) : 0;
        const remaining = batchTotal - batchDone;
        const perTrack = batchDone > 0 ? elapsed/batchDone : 0;
        const etaSec = remaining * perTrack;
        $('yamdl-batch-eta').textContent = `⏱ ETA ${fmtEta(etaSec)} · avg ${fmtSpeed(avgSpeed)} · elapsed ${fmtEta(elapsed)}`;
        if (batchDone > 0 && state.isBatch) {
            miniBadge.style.display = 'block';
            miniBadge.textContent = `${batchDone}/${batchTotal}`;
        } else {
            miniBadge.style.display = 'none';
        }
    }

    // ===== ACCOUNTS =====
    async function captureCurrentAccount() {
        logStep('📸 Захват текущего аккаунта...');
        const cookieStr = getSessionCookies();
        if (!cookieStr) { logErr('Куки сессии не найдены'); return null; }
        const uid = getUidFromPage();
        if (!uid) { logErr('UID не найден (открой свой профиль?)'); return null; }

        // Проверка через API
        const headers = await buildHeaders();
        let login = '—', hasPlus = false, ok = false;
        try {
            const r = await fetch(`${API_BASE}/account/status`, { headers, credentials: 'include' });
            if (r.ok) {
                const d = await r.json();
                const acc = d.result?.account || d.account || {};
                login = acc.login || acc.displayName || '—';
                hasPlus = (d.result?.plus || d.plus || {}).hasPlus || false;
                ok = true;
            }
        } catch(e){}

        const rec = {
            id: String(uid), uid: String(uid), login,
            hasPlus, cookies: cookieStr,
            cookieCount: Object.keys(parseCookies()).length,
            savedAt: Date.now(), lastSeenAt: Date.now(),
            userAgent: UA
        };
        await dbAdd(STORE_ACCOUNTS, rec);
        const idx = state.accounts.findIndex(a => a.id === rec.id);
        if (idx >= 0) state.accounts[idx] = rec; else state.accounts.push(rec);
        state.activeAccountId = rec.id;
        state.uid = rec.uid;
        state.cookies = rec.cookies;
        logDb(`аккаунт сохранён`);
        log(`  👤 ${login} · uid ${uid}${hasPlus?' · ⭐ Plus':''}`, SUNO.textSecondary, CS.dim);
        renderAccountSelect();
        return rec;
    }

    async function switchAccount(userId) {
        const acc = state.accounts.find(a => a.id === userId);
        if (!acc) return;
        state.activeAccountId = userId;
        state.uid = acc.uid;
        state.cookies = acc.cookies;
        state.allTracks = [];
        state.selected.clear();
        listEl.innerHTML = '';
        listPanel.style.display = 'none';
        batchEl.style.display = 'none';
        currentEl.style.display = 'none';
        $('yamdl-all').innerHTML = '<span style="font-size:15px;">⬇</span> Загрузить список';
        $('yamdl-all').disabled = false;
        state.phase = 'idle';
        logDb(`активный: ${acc.login} (uid ${acc.uid})`);
        setStatus(`Аккаунт: ${acc.login}`, 'ok');
    }

    async function removeAccount(userId) {
        const acc = state.accounts.find(a => a.id === userId);
        if (!acc) return;
        if (!confirm(`Удалить аккаунт ${acc.login}?`)) return;
        await dbRemove(STORE_ACCOUNTS, userId);
        state.accounts = state.accounts.filter(a => a.id !== userId);
        if (state.activeAccountId === userId) {
            state.activeAccountId = null;
            if (state.accounts[0]) await switchAccount(state.accounts[0].id);
        }
        renderAccountSelect();
        logDb(`аккаунт ${acc.login} удалён`);
    }

    function renderAccountSelect() {
        const sel = $('yamdl-account-select');
        if (!sel) return;
        sel.innerHTML = '';
        if (state.accounts.length === 0) {
            const o = document.createElement('option');
            o.value = ''; o.textContent = '— нет аккаунтов —';
            sel.appendChild(o);
        } else {
            for (const a of state.accounts) {
                const o = document.createElement('option');
                o.value = a.id;
                o.textContent = `${a.login} · uid ${a.uid}${a.hasPlus?' ⭐':''}`;
                if (a.id === state.activeAccountId) o.selected = true;
                sel.appendChild(o);
            }
        }
        $('yamdl-acc-count').textContent = state.accounts.length;
    }

    // ===== LIST =====
    function renderList(tracks) {
        listEl.innerHTML = '';
        const visible = tracks.map((t, i) => ({t, i})).filter(({t}) => {
            if (!state.filterOnlyNew) return true;
            return !state.downloadedIds.has(t.id);
        });
        visible.forEach(({t, i}) => {
            const isDownloaded = state.downloadedIds.has(t.id);
            const row = document.createElement('div');
            row.className = 'yamdl-track-row' + (isDownloaded ? ' downloaded' : '');
            const checked = state.selected.has(i);
            if (checked) row.classList.add('selected');
            let badgeText = isDownloaded ? '✓ ЕСТЬ' : 'NEW';
            let badgeClass = isDownloaded ? 'downloaded' : 'new';
            let metaHtml = '';
            if (isDownloaded) {
                const rec = state.downloadedMeta.get(t.id);
                if (rec) {
                    const sizeStr = rec.size ? fmtBytes(rec.size) : '';
                    const agoStr = rec.downloadedAt ? fmtAgo(rec.downloadedAt) : '';
                    metaHtml = `<div class="yamdl-track-meta">${sizeStr}${sizeStr&&agoStr?' · ':''}${agoStr}</div>`;
                }
            }
            const safeTitle = (t.artist || '') + ' — ' + (t.title || '');
            row.innerHTML = `
                <div class="yamdl-checkbox ${checked?(isDownloaded?'downloaded-checked':'checked'):''}">${checked?'✓':''}</div>
                <div class="yamdl-track-idx">${String(i+1).padStart(2,'0')}</div>
                <div class="yamdl-track-title" title="${safeTitle.replace(/"/g,'&quot;')}">${safeTitle}</div>
                ${metaHtml}
                <div class="yamdl-track-badge ${badgeClass}">${badgeText}</div>
            `;
            row.onclick = () => {
                if (state.selected.has(i)) state.selected.delete(i); else state.selected.add(i);
                Sound.click();
                row.classList.toggle('selected');
                const cb = row.querySelector('.yamdl-checkbox');
                cb.classList.toggle('checked');
                cb.classList.toggle('downloaded-checked');
                cb.textContent = state.selected.has(i) ? '✓' : '';
                updateListInfo();
            };
            listEl.appendChild(row);
        });
        if (visible.length === 0 && state.filterOnlyNew) {
            const empty = document.createElement('div');
            empty.style.cssText = 'padding:20px;text-align:center;font-size:12px;color:rgba(255,255,255,0.4);';
            empty.textContent = '🎉 Все треки уже скачаны!';
            listEl.appendChild(empty);
        }
        updateListInfo();
    }
    function updateListInfo() {
        const downloadedCount = state.allTracks.filter(t => state.downloadedIds.has(t.id)).length;
        const newCount = state.allTracks.length - downloadedCount;
        listInfo.innerHTML = `Выбрано: <span style="color:${SUNO.accent};font-weight:bold;">${state.selected.size}</span> · Всего: ${state.allTracks.length} · <span style="color:${SUNO.success};">✓ ${downloadedCount}</span> · <span style="color:${SUNO.accent};">🆕 ${newCount}</span>`;
        $('yamdl-start-batch').disabled = state.selected.size === 0;
    }

    async function prepareList() {
        if (state.phase !== 'idle' && state.phase !== 'done') return;
        Sound.click();
        state.phase = 'list';
        listPanel.style.display = 'block';
        batchEl.style.display = 'none';
        currentEl.style.display = 'none';
        state.selected.clear();
        $('yamdl-all').disabled = true;
        setStatus('Сбор треков со страницы...', 'idle');

        if (!state.uid) {
            const uid = getUidFromPage();
            const cookieStr = getSessionCookies();
            if (!uid || !cookieStr) {
                logErr('Нет авторизации — залогинься на music.yandex.ru');
                state.phase = 'idle'; $('yamdl-all').disabled = false;
                return;
            }
            state.uid = uid; state.cookies = cookieStr;
            await captureCurrentAccount();
        }

        try {
            // Собираем треки с текущей страницы
            let tracks = collectTracksFromDOM();
            logOk(`Со страницы собрано: ${tracks.length}`);

            // Обогащаем метаданными через API (с ограничением параллелизма)
            if (tracks.length > 0) {
                logStep(`Загрузка метаданных через API...`);
                const CONCURRENCY = 4;
                for (let i = 0; i < tracks.length; i += CONCURRENCY) {
                    const batch = tracks.slice(i, i + CONCURRENCY);
                    await Promise.all(batch.map(async t => {
                        const meta = await fetchTrackMeta(t.id);
                        if (meta) {
                            t.title = meta.title || t.title;
                            t.artist = meta.artist || t.artist;
                            t.album = meta.album || t.album;
                            t.albumId = meta.albumId || t.albumId;
                            t.durationMs = meta.durationMs || t.durationMs;
                            t.year = meta.year;
                            t.coverUri = meta.coverUri;
                            t.raw = meta.raw;
                        }
                    }));
                    setStatus(`Метаданные ${Math.min(i + CONCURRENCY, tracks.length)}/${tracks.length}...`, 'idle');
                }
            }

            if (tracks.length === 0) {
                logWarn('На странице не найдено треков. Открой плейлист/альбом/мой плейс.');
                setStatus('Нет треков на странице', 'warn');
                state.phase = 'idle'; $('yamdl-all').disabled = false;
                return;
            }

            state.allTracks = tracks;
            const alreadyDownloaded = tracks.filter(t => state.downloadedIds.has(t.id)).length;
            logOk(`Треков: ${tracks.length} · ✓ уже скачано: ${alreadyDownloaded} · 🆕 новых: ${tracks.length - alreadyDownloaded}`);
            if (state.downloadedIds.size > 0) {
                dbSummary.style.display = 'flex';
                $('yamdl-db-count').textContent = state.downloadedIds.size;
            }

            tracks.forEach((t, i) => {
                if (!state.downloadedIds.has(t.id)) state.selected.add(i);
            });
            renderList(tracks);
            setStatus(`Выбрано ${state.selected.size} новых из ${tracks.length}`, 'ok');
            Sound.chord([523,659],0.4,0.08);
        } catch(e) {
            logErr(`Ошибка: ${e.message}`);
            setStatus('Ошибка: ' + e.message, 'err');
            Sound.error();
            state.phase = 'idle';
            $('yamdl-all').disabled = false;
        }
    }

    // ===== PROCESS TRACK =====
    async function processTrack(track, seqNum, idxInBatch, totalInBatch) {
        const title = track.title || `track_${track.id}`;
        const tT0 = performance.now();
        const hasLyricsKnown = !!(track.raw && track.raw.lyricsId);
        logStep(`[${idxInBatch+1}/${totalInBatch}] [${String(seqNum).padStart(2,'0')}] "${title.slice(0,50)}"${hasLyricsKnown?' 📝':''}`);
        setCurrent(title, idxInBatch, totalInBatch, 'Загрузка...', 0, 'idle', 'init');

        for (let attempt = 1; attempt <= 2; attempt++) {
            if (state.batchCancel) return;
            if (attempt > 1) {
                log(`  🔄 Попытка ${attempt}/2`, SUNO.warning, CS.warn);
                await new Promise(r => setTimeout(r, 1000));
            }
            try {
                setCurrent(title, idxInBatch, totalInBatch, '🔗 get-file-info...', 5, 'idle', '');
                const { buf, mime, ext, size, info } = await downloadTrack(
                    track, seqNum, idxInBatch, totalInBatch,
                    (loaded, totalBytes, speed, pct, sinceChunk, isStall) => {
                        const dispPct = 10 + pct * 0.75;
                        const stage = isStall
                            ? `🐌 STALL ${(sinceChunk/1000).toFixed(0)}s · ${fmtBytes(loaded)}/${fmtBytes(totalBytes)}`
                            : `⬇ ${fmtBytes(loaded)} / ${fmtBytes(totalBytes)} · ${fmtSpeed(speed)}`;
                        setCurrent(title, idxInBatch, totalInBatch, stage,
                            dispPct, isStall ? 'stall' : 'idle',
                            `${fmtBytes(loaded)}/${fmtBytes(totalBytes)} · ${fmtSpeed(speed)}`);
                    }
                );

                // Текст песни
                let lyrics = null;
                try {
                    setCurrent(title, idxInBatch, totalInBatch, '📝 Текст...', 88, 'idle', '');
                    lyrics = await fetchLyrics(track.id);
                } catch(e){}

                setCurrent(title, idxInBatch, totalInBatch, '💾 Сохранение...', 95, 'idle', fmtBytes(size));
                Sound.save();
                const artistPart = sanitizeName(track.artist || 'unknown');
                const titlePart = sanitizeName(track.title || 'track');
                const suffix = ` [${String(seqNum).padStart(2,'0')}]`;
                const filename = `${artistPart} - ${titlePart}${suffix}.${ext}`;
                const blob = new Blob([buf], { type: mime });
                triggerDownload(blob, filename);
                logOk(`💾 ${filename} (${fmtBytes(size)})`);
                saveTxtJson(track, lyrics, size, ext, seqNum);

                // IndexedDB
                try {
                    await dbAdd(STORE_DOWNLOADED, {
                        id: track.id, title: track.title, artist: track.artist,
                        size, downloadedAt: Date.now(), accountId: state.activeAccountId,
                        filename, ext, codec: info.codec, bitrate: info.bitrate,
                        hasLyrics: !!lyrics
                    });
                    state.downloadedIds.add(track.id);
                    state.downloadedMeta.set(track.id, {
                        id: track.id, title: track.title, artist: track.artist,
                        size, downloadedAt: Date.now(), hasLyrics: !!lyrics
                    });
                    logDb(`записан: ${track.id}`);
                } catch(e) { logWarn(`IndexedDB: ${e.message}`); }

                state.batchBytesDone += size;
                setCurrent(title, idxInBatch, totalInBatch, '✅ Готово', 100, 'done', fmtBytes(size));
                const tMs = (performance.now() - tT0).toFixed(0);
                logOk(`ГОТОВО · ${(tMs/1000).toFixed(1)}s · ${fmtBytes(size)}${lyrics?' · 📝':''}`);
                state.batchDone++;
                updateBatchProgress();
                Sound.trackDone();
                return;
            } catch(e) {
                console.log(`%c   ⚠ ${e.message}`, 'color:#fbbf24;');
                if (attempt >= 2) {
                    state.batchErrors++;
                    logErr(`"${title.slice(0,40)}" — ${e.message}`);
                    setCurrent(title, idxInBatch, totalInBatch, `❌ ${e.message.slice(0,60)}`, 100, 'error', '');
                    updateBatchProgress();
                    Sound.error();
                }
            }
        }
    }

    async function startBatch() {
        if (state.isBatch) return;
        if (state.selected.size === 0) { logWarn('Ничего не выбрано'); Sound.error(); return; }
        const idxs = Array.from(state.selected).sort((a,b)=>a-b);
        const toDownload = idxs.map(i => state.allTracks[i]).filter(Boolean);
        Sound.start();
        logStep(`СТАРТ БАТЧА · ${toDownload.length} треков · TXT+JSON ${saveTxtEnabled()?'вкл':'выкл'}`);
        state.isBatch = true; state.batchCancel = false;
        state.batchErrors = 0; state.batchDone = 0; state.batchSkipped = 0;
        state.batchTotal = toDownload.length;
        state.batchBytesDone = 0; state.batchStartTime = performance.now();
        state.phase = 'downloading';
        listPanel.style.display = 'none';
        batchEl.style.display = 'block';
        currentEl.style.display = 'block';
        updateBatchProgress();
        $('yamdl-all').disabled = true;
        $('yamdl-stop').style.display = 'inline-flex';
        setStatus('Скачивание...', 'idle');
        const bT0 = performance.now();
        let seqNum = 1;
        try {
            for (let i = 0; i < toDownload.length; i++) {
                if (state.batchCancel) { logWarn('Отменено'); break; }
                await processTrack(toDownload[i], seqNum, i, toDownload.length);
                seqNum++;
                await new Promise(r => setTimeout(r, 400 + Math.random()*400));
            }
            const tMs = (performance.now() - bT0).toFixed(0);
            logOk(`ЗАВЕРШЕНО · ${(tMs/1000).toFixed(1)}s · ${fmtBytes(state.batchBytesDone)}`);
            logOk(`Успешно: ${state.batchDone}/${state.batchTotal}`);
            if (state.batchErrors) logErr(`Ошибок: ${state.batchErrors}`);
            setStatus(`Готово! ${state.batchDone}/${state.batchTotal}`, state.batchErrors?'warn':'ok');
            Sound.complete();
        } catch(e) {
            logErr(`КРИТИЧЕСКАЯ: ${e.message}`);
            setStatus('Ошибка: ' + e.message, 'err');
            Sound.error();
        }
        state.isBatch = false; state.phase = 'done';
        $('yamdl-all').disabled = false;
        $('yamdl-all').innerHTML = '<span style="font-size:15px;">⬇</span> Обновить список';
        $('yamdl-stop').style.display = 'none';
        miniBadge.style.display = 'none';
    }

    // ===== MINIMIZE =====
    function saveMinimized() {
        try { localStorage.setItem(MINIMIZED_KEY, state.minimized ? '1' : '0'); } catch(e){}
    }
    function loadMinimized() {
        try { return localStorage.getItem(MINIMIZED_KEY) === '1'; } catch(e){ return false; }
    }
    function applyMinimized() {
        const box = $('yamdl');
        const mini = $('yamdl-mini');
        if (state.minimized) { box.style.display = 'none'; mini.style.display = 'flex'; }
        else { box.style.display = 'flex'; mini.style.display = 'none'; }
        saveMinimized();
    }

    // ===== HANDLERS =====
    $('yamdl-sound').onclick = () => {
        Sound.enabled = !Sound.enabled;
        $('yamdl-sound').textContent = Sound.enabled ? '🔊' : '🔇';
        if (Sound.enabled) Sound.click();
    };
    $('yamdl-clear').onclick = () => { logEl.innerHTML = ''; console.clear(); };
    $('yamdl-minimize').onclick = () => { state.minimized = true; applyMinimized(); Sound.click(); };
    $('yamdl-mini').onclick = () => { state.minimized = false; applyMinimized(); Sound.click(); };
    $('yamdl-close').onclick = () => {
        if (state.isBatch && !confirm('Батч идёт. Закрыть?')) return;
        state.batchCancel = true;
        $('yamdl').remove();
        $('yamdl-mini').remove();
    };
    $('yamdl-all').onclick = () => {
        if (state.phase === 'done') {
            state.phase = 'idle';
            state.selected.clear();
            listEl.innerHTML = '';
        }
        prepareList();
    };
    $('yamdl-stop').onclick = () => { Sound.error(); state.batchCancel = true; logWarn('⏹ Стоп...'); };
    $('yamdl-sel-all').onclick = () => {
        state.allTracks.forEach((t, i) => state.selected.add(i));
        renderList(state.allTracks); Sound.click();
    };
    $('yamdl-sel-none').onclick = () => {
        state.selected.clear();
        renderList(state.allTracks); Sound.click();
    };
    $('yamdl-start-batch').onclick = () => { Sound.click(); startBatch(); };
    $('yamdl-filter-new').onclick = () => {
        state.filterOnlyNew = !state.filterOnlyNew;
        $('yamdl-filter-new').classList.toggle('active', state.filterOnlyNew);
        renderList(state.allTracks); Sound.click();
    };

    // TXT toggle
    (function initSaveTxt() {
        const btn = $('yamdl-save-txt');
        const upd = () => {
            const on = saveTxtEnabled();
            btn.classList.toggle('active', on);
            btn.style.color = on ? '#4ade80' : '';
            btn.textContent = on ? '📝 TXT+JSON ✓' : '📝 TXT+JSON';
        };
        btn.onclick = () => {
            const cur = saveTxtEnabled();
            localStorage.setItem(SAVE_TXT_KEY, cur ? 'false' : 'true');
            upd(); Sound.click();
            log(cur ? '📝 TXT+JSON выключен' : '📝 TXT+JSON включён', '#4ade80', CS.txt);
        };
        upd();
    })();

    $('yamdl-db-clear').onclick = async () => {
        if (!confirm('Очистить базу скачанных?')) return;
        try {
            await dbClear(STORE_DOWNLOADED);
            state.downloadedIds.clear();
            state.downloadedMeta.clear();
            logDb('база очищена');
            dbSummary.style.display = 'none';
            renderList(state.allTracks);
        } catch(e) { logErr(`db clear: ${e.message}`); }
    };
    $('yamdl-acc-add').onclick = async () => {
        Sound.click();
        await captureCurrentAccount();
        state.allTracks = [];
        state.selected.clear();
        listEl.innerHTML = '';
    };
    $('yamdl-acc-del').onclick = () => {
        const sel = $('yamdl-account-select');
        if (!sel.value) { logWarn('Аккаунт не выбран'); return; }
        Sound.click();
        removeAccount(sel.value);
    };
    $('yamdl-account-select').onchange = async (e) => {
        Sound.click();
        if (e.target.value) await switchAccount(e.target.value);
    };

    // ===== INIT =====
    log(`Yandex Music Downloader v${VERSION}`, SUNO.accent, CS.accent);
    log(`Lyrics + AES-CTR · Multi-Account · IndexedDB`, SUNO.textTertiary, CS.dim);

    state.minimized = loadMinimized();

    (async () => {
        try { await dbInit(); }
        catch(e) { logWarn(`IndexedDB init: ${e.message}`); }

        try {
            const all = await dbGetAll(STORE_DOWNLOADED);
            state.downloadedIds.clear();
            state.downloadedMeta.clear();
            for (const rec of all) {
                state.downloadedIds.add(rec.id);
                state.downloadedMeta.set(rec.id, rec);
            }
            log(`📚 IndexedDB: ${all.length} скачанных треков`, '#38bdf8', CS.db);
        } catch(e) { logWarn(`IndexedDB downloaded: ${e.message}`); }

        try {
            const all = await dbGetAll(STORE_ACCOUNTS);
            state.accounts = all || [];
            log(`👥 IndexedDB: ${state.accounts.length} аккаунтов`, '#38bdf8', CS.db);
        } catch(e) { logWarn(`IndexedDB accounts: ${e.message}`); }

        // Текущий аккаунт из кук
        const uid = getUidFromPage();
        const cookieStr = getSessionCookies();
        if (uid && cookieStr) {
            const existing = state.accounts.find(a => a.id === String(uid));
            if (existing) {
                existing.cookies = cookieStr;
                existing.lastSeenAt = Date.now();
                await dbAdd(STORE_ACCOUNTS, existing);
                state.uid = String(uid);
                state.activeAccountId = existing.id;
                state.cookies = cookieStr;
                logOk(`Аккаунт: ${existing.login} · uid ${uid}${existing.hasPlus?' ⭐':''}`);
            } else {
                log(`🆕 Новый аккаунт — сохраняю...`, SUNO.accent, CS.accent);
                await captureCurrentAccount();
            }
            renderAccountSelect();
            setStatus('Готов к загрузке', 'ok');
        } else {
            setStatus('Открой music.yandex.ru (залогинься)', 'warn');
        }

        applyMinimized();
    })();

    console.log(`%c✅ Yandex Music Downloader v${VERSION} готов`, 'color:#4ade80;font-weight:bold;font-size:14px;');
})();
