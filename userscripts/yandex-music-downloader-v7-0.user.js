// ==UserScript==
// @name         Yandex Music Downloader v7.0
// @namespace    dimasik-debug
// @version      6.0
// @description  Яндекс.Музыка → локально + Яндекс.Диск + GitHub. RAW + умный retry. Звуки LitRes.
// @author       Neurosha
// @match        https://music.yandex.ru/*
// @match        https://music.yandex.com/*
// @match        https://music.yandex.kz/*
// @match        https://music.yandex.by/*
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// ==/UserScript==

/* Converted by Neurosha · 2026-09-20T08:51:10.412Z */

// ==UserScript==
// @name         Yandex Music Downloader v7.0
// @namespace    yamdl
// @version      6.0
// @description  Яндекс.Музыка → локально + Яндекс.Диск + GitHub. RAW + умный retry. Звуки LitRes.
// @match        https://music.yandex.ru/*
// @match        https://music.yandex.com/*
// @match        https://music.yandex.kz/*
// @match        https://music.yandex.by/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      *
// ==/UserScript==

(function YandexMusicDownloaderV60() {
    'use strict';

    const VERSION = '7.0';
    const QUALITY = 'nq';
    const CODECS = 'flac,aac,he-aac,mp3,flac-mp4,aac-mp4,he-aac-mp4';
    const SECRET = '7tvSmFbyf5hJnIHhCimDDD';
    const API_BASE = location.host.includes('yandex.com') ? 'https://api.music.yandex.net' : 'https://api.music.yandex.ru';
    const YADISK_API = 'https://cloud-api.yandex.net/v1/disk';
    const SEARCH_TYPES = 'album,artist,playlist,track,wave,podcast,podcast_episode,clip,concert,ugc_track';
    const DEFAULT_YADISK_TOKEN = 'y0__wgBEMXcidgEGJnTSSDArYGFGTDc-af4CH7vlk1BioDBW34XQuLc6fTutZI';

    const MAX_ROUNDS = 10;
    const PAUSES = [3000, 4000, 5000, 6000, 8000, 10000, 12000, 15000, 15000, 15000];
    const PAUSE_TRACKS = 3000;
    const DB_NAME = 'yamdl_db', DB_VERSION = 1, STORE_DOWNLOADED = 'downloaded';

    const LS = {
        yadiskToken: 'yamdl_yadisk_token', ghToken: 'yamdl_gh_token',
        ghRepo: 'yamdl_gh_repo', ghRepoPath: 'yamdl_gh_repo_path',
        saveTxt: 'yamdl_save_txt', minimized: 'yamdl_minimized',
        createArtistFolder: 'yamdl_create_artist_folder', uploadDisk: 'yamdl_upload_disk',
        keepLocal: 'yamdl_keep_local', autoSync: 'yamdl_auto_sync',
        sound: 'yamdl_sound_enabled', preferredQuality: 'yamdl_preferred_quality'
    };

    const T0 = performance.now();
    const ts = () => `+${((performance.now() - T0) / 1000).toFixed(2)}s`;

    // ============================================================================
    // 🔊 SOUND
    // ============================================================================
    const Sound = {
        ctx: null, enabled: true, masterGain: null,
        init() {
            if (this.ctx) return;
            try {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
                this.masterGain = this.ctx.createGain();
                this.masterGain.gain.value = 0.35;
                this.masterGain.connect(this.ctx.destination);
            } catch(e) { this.enabled = false; }
        },
        note(f, d = 0.35, v = 0.15, delay = 0, type = 'sine') {
            if (!this.enabled) return;
            if (this.ctx && this.ctx.state === 'closed') return;
            this.init(); if (!this.ctx) return;
            try {
                if (this.ctx.state === 'suspended') this.ctx.resume();
                const t = this.ctx.currentTime + delay;
                const o = this.ctx.createOscillator(), g = this.ctx.createGain(), fl = this.ctx.createBiquadFilter();
                fl.type = 'lowpass'; fl.frequency.value = 3500; fl.Q.value = 0.7;
                o.type = type; o.frequency.setValueAtTime(f, t);
                g.gain.setValueAtTime(0, t);
                g.gain.linearRampToValueAtTime(v, t + 0.04);
                g.gain.setValueAtTime(v, t + d * 0.6);
                g.gain.exponentialRampToValueAtTime(0.0001, t + d);
                o.connect(fl); fl.connect(g); g.connect(this.masterGain);
                o.start(t); o.stop(t + d + 0.05);
            } catch(e) {}
        },
        chord(fs, d = 0.5, v = 0.12, type = 'sine') { fs.forEach((f, i) => this.note(f, d + i * 0.05, v * (1 - i * 0.15), i * 0.03, type)); },
        glide(a, b, d = 0.3, v = 0.12) {
            if (!this.enabled) return;
            this.init(); if (!this.ctx) return;
            try {
                if (this.ctx.state === 'suspended') this.ctx.resume();
                const t = this.ctx.currentTime;
                const o = this.ctx.createOscillator(), g = this.ctx.createGain();
                o.type = 'sine'; o.frequency.setValueAtTime(a, t);
                o.frequency.exponentialRampToValueAtTime(b, t + d);
                g.gain.setValueAtTime(0, t);
                g.gain.linearRampToValueAtTime(v, t + 0.05);
                g.gain.exponentialRampToValueAtTime(0.0001, t + d);
                o.connect(g); g.connect(this.masterGain);
                o.start(t); o.stop(t + d + 0.05);
            } catch(e) {}
        },
        click() { this.note(587, 0.12, 0.08, 0, 'sine'); },
        start() { this.chord([349, 440, 523], 0.5, 0.10); },
        trackDone() { this.note(880, 0.3, 0.12, 0); this.note(1175, 0.4, 0.08, 0.08); },
        complete() { this.chord([523, 659, 784, 1047], 0.8, 0.10, 'triangle'); this.glide(523, 1047, 0.6, 0.06); },
        error() { this.note(294, 0.35, 0.09, 0); this.note(247, 0.5, 0.07, 0.15); },
        save() { this.note(1047, 0.15, 0.06, 0, 'triangle'); },
        warn() { this.note(440, 0.2, 0.07, 0, 'triangle'); this.note(349, 0.3, 0.06, 0.1, 'triangle'); },
        stall() { this.note(220, 0.4, 0.07, 0, 'sawtooth'); this.note(196, 0.5, 0.06, 0.2, 'sawtooth'); },
        diag() { this.note(659, 0.15, 0.06, 0, 'triangle'); this.note(880, 0.15, 0.05, 0.08, 'triangle'); },
        cloud() { this.chord([659, 880, 1047], 0.5, 0.09, 'triangle'); },
        cloudDone() { this.chord([880, 1047, 1319, 1568], 0.6, 0.10, 'triangle'); },
        local() { this.note(698, 0.15, 0.07, 0, 'triangle'); this.note(880, 0.2, 0.06, 0.08, 'triangle'); },
        diskDone() { this.cloudDone(); },
        github() { this.chord([784, 988], 0.4, 0.08); },
        batchStart() { this.chord([440, 554, 659, 880], 0.6, 0.10); },
        batchDone() { this.chord([523, 659, 784, 1047, 1319], 0.9, 0.11, 'triangle'); this.glide(523, 1319, 0.8, 0.07); }
    };
    window.addEventListener('beforeunload', () => { try { Sound.ctx?.close(); } catch(e) {} });

    // ============================================================================
    // STATE
    // ============================================================================
    const state = {
        isBatch: false, batchCancel: false, batchTotal: 0, batchDone: 0, batchErrors: 0,
        allTracks: [], selected: new Set(),
        downloadedIds: new Set(), downloadedMeta: new Map(),
        phase: 'idle', batchBytesDone: 0, batchStartTime: 0,
        filterOnlyNew: false, minimized: false,
        uid: null, login: null, hasPlus: false,
        saveTxt: true, createArtistFolder: true, uploadDisk: true,
        keepLocal: true, autoSync: true,
        yadiskToken: DEFAULT_YADISK_TOKEN, ghToken: '', ghRepo: '', ghRepoPath: '',
        resolvedDiskBase: null, resolvedDownloadsBase: null, settingsOpen: false,
        ghSyncTimer: null, ghSyncPending: false, lastGhSyncAt: 0,
        preferredQuality: 'best', bootStep: 'init'
    };

    function loadSettings() {
        try {
            const s = localStorage.getItem(LS.saveTxt); if (s !== null) state.saveTxt = s !== 'false';
            const m = localStorage.getItem(LS.minimized); if (m === '1') state.minimized = true;
            const caf = localStorage.getItem(LS.createArtistFolder); if (caf !== null) state.createArtistFolder = caf !== 'false';
            const ud = localStorage.getItem(LS.uploadDisk); if (ud !== null) state.uploadDisk = ud !== 'false';
            const kl = localStorage.getItem(LS.keepLocal); if (kl !== null) state.keepLocal = kl !== 'false';
            const as = localStorage.getItem(LS.autoSync); if (as !== null) state.autoSync = as !== 'false';
            const sd = localStorage.getItem(LS.sound); if (sd !== null) Sound.enabled = sd !== 'false';
            const yt = localStorage.getItem(LS.yadiskToken); if (yt) state.yadiskToken = yt;
            const gt = localStorage.getItem(LS.ghToken); if (gt) state.ghToken = gt;
            const gr = localStorage.getItem(LS.ghRepo); if (gr) state.ghRepo = gr;
            const grp = localStorage.getItem(LS.ghRepoPath); if (grp) state.ghRepoPath = grp;
            const pq = localStorage.getItem(LS.preferredQuality); if (pq) state.preferredQuality = pq;
        } catch(e) {}
    }
    const saveLS = (k, v) => { try { localStorage.setItem(k, String(v)); } catch(e) {} };

    // ============================================================================
    // UTILS
    // ============================================================================
    const fmtBytes = b => !b || b < 0 ? '0 B' : b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(2) + ' MB';
    const fmtSpeed = m => m < 0.01 ? '—' : m < 1 ? (m * 1024).toFixed(0) + ' KB/s' : m.toFixed(2) + ' MB/s';
    const fmtEta = s => !isFinite(s) || s <= 0 ? '—' : s < 60 ? s.toFixed(0) + 's' : Math.floor(s / 60) + 'm ' + Math.round(s % 60) + 's';
    const fmtAgo = t => { const s = (Date.now() - t) / 1000; return s < 60 ? 'только что' : s < 3600 ? Math.floor(s / 60) + ' мин' : s < 86400 ? Math.floor(s / 3600) + ' ч' : Math.floor(s / 86400) + ' дн'; };
    const sanitizeName = n => (n || 'track').replace(/[\\/:*?"<>|]/g, '_').replace(/[\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'track';
    const uuid4 = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });

    function fetchT(url, opts = {}, ms = 10000) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), ms);
        return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
    }
    function withTimeout(promise, ms, label) {
        return Promise.race([
            promise,
            new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout ${ms}ms${label ? ' ('+label+')' : ''}`)), ms))
        ]);
    }

    function detectPageKind() {
        const p = location.pathname, q = new URLSearchParams(location.search);
        if (p.startsWith('/search')) return { kind: 'search', text: q.get('text') || '' };
        let m = p.match(/^\/artist\/(\d+)/); if (m) return { kind: 'artist', id: m[1] };
        m = p.match(/^\/album\/(\d+)/); if (m) return { kind: 'album', id: m[1] };
        m = p.match(/^\/track\/(\d+)/); if (m) return { kind: 'track', id: m[1] };
        m = p.match(/^\/playlist\/(\d+)\/(\d+)/); if (m) return { kind: 'playlist', uid: m[1], kind_: m[2] };
        m = p.match(/^\/users\/([^\/]+)\/playlists\/(\d+)/); if (m) return { kind: 'playlist', uid: m[1], kind_: m[2] };
        m = p.match(/^\/collection/); if (m) return { kind: 'collection' };
        return { kind: 'unknown' };
    }

    function gmRequest(opts) {
        return new Promise((resolve, reject) => {
            try {
                GM_xmlhttpRequest({
                    method: opts.method || 'GET', url: opts.url,
                    headers: opts.headers || {}, data: opts.data,
                    responseType: opts.responseType || 'text',
                    timeout: opts.timeout || 300000,
                    onprogress: opts.onprogress,
                    onload: resolve,
                    onerror: (e) => reject(new Error('GM: ' + (e?.error || JSON.stringify(e)))),
                    ontimeout: () => reject(new Error('timeout')),
                    onabort: () => reject(new Error('abort'))
                });
            } catch(e) { reject(e); }
        });
    }

    // ============================================================================
    // API
    // ============================================================================
    async function genSign(base) {
        const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(base));
        let b64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
        return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    function buildHeaders(albumId) {
        const h = {
            'accept': '*/*', 'accept-language': 'ru',
            'x-request-id': uuid4(), 'x-requested-with': 'XMLHttpRequest',
            'x-retpath-y': `https://music.yandex.ru/album/${albumId || ''}`,
            'x-yandex-music-client': 'YandexMusicWebNext/1.0.0',
            'x-yandex-music-without-invocation-info': '1'
        };
        if (state.uid) h['x-yandex-music-multi-auth-user-id'] = String(state.uid);
        return h;
    }

    async function getUid() {
        if (state.uid) return state.uid;
        try {
            const r = await fetchT(`${API_BASE}/account/status`, { credentials: 'include' }, 8000);
            const d = await r.json();
            const uid = d?.result?.account?.uid;
            if (uid) { state.uid = String(uid); state.login = d?.result?.account?.login; }
            return state.uid;
        } catch(e) {
            console.warn('[YAMDL] getUid failed:', e.message);
            return null;
        }
    }

    async function tryGetFileInfo(trackId, albumId, transport) {
        const tsS = Math.floor(Date.now() / 1000);
        const codecsNoComma = CODECS.replace(/,/g, '');
        const base = `${tsS}${trackId}${QUALITY}${codecsNoComma}${transport}`;
        const sign = await genSign(base);
        const url = `${API_BASE}/get-file-info?ts=${tsS}&trackId=${trackId}&quality=${QUALITY}&codecs=${encodeURIComponent(CODECS)}&transports=${transport}&sign=${sign}`;
        try {
            const r = await fetch(url, { credentials: 'include', headers: buildHeaders(albumId) });
            if (r.status !== 200) return { ok: false, status: r.status };
            const d = await r.json();
            const info = d.downloadInfo || d.result?.downloadInfo || d.result;
            if (info?.urls?.length) return { ok: true, info };
            return { ok: false, status: 200 };
        } catch(e) { return { ok: false, status: 0 }; }
    }

    async function getFileInfoCascade(trackId, albumId, logFn) {
        for (let round = 1; round <= MAX_ROUNDS; round++) {
            if (logFn) logFn(`round ${round}/${MAX_ROUNDS} encraw`, 'dbg');
            let r = await tryGetFileInfo(trackId, albumId, 'encraw');
            if (r.ok) return { ok: true, info: r.info, used: 'encraw', round };

            if (logFn) logFn(`round ${round}/${MAX_ROUNDS} raw`, 'dbg');
            r = await tryGetFileInfo(trackId, albumId, 'raw');
            if (r.ok) return { ok: true, info: r.info, used: 'raw', round };

            if (round < MAX_ROUNDS) {
                const pause = PAUSES[Math.min(round - 1, PAUSES.length - 1)];
                if (logFn) logFn(`⏳ ${(pause/1000).toFixed(0)}s`, 'warn');
                await new Promise(res => setTimeout(res, pause));
            }
        }
        return { ok: false };
    }

    // ============================================================================
    // AES-CTR
    // ============================================================================
    function hexToBytes(hex) {
        const o = new Uint8Array(hex.length / 2);
        for (let i = 0; i < o.length; i++) o[i] = parseInt(hex.substr(i * 2, 2), 16);
        return o;
    }
    function bigEndianCounter(v) {
        const b = new Uint8Array(16); let x = BigInt(v);
        for (let i = 15; i >= 0; i--) { b[i] = Number(x & 0xffn); x >>= 8n; }
        return b;
    }
    async function tryDecrypt(data, keyHex) {
        const kb = hexToBytes(keyHex);
        for (const init of [0, 1, 2, 16, 256, 65536, 16777216, 4294967296]) {
            try {
                const k = await crypto.subtle.importKey('raw', kb, { name: 'AES-CTR' }, false, ['decrypt']);
                const dec = await crypto.subtle.decrypt({ name: 'AES-CTR', counter: bigEndianCounter(init), length: 128 }, k, data);
                const h = new Uint8Array(dec.slice(0, 16));
                if (h[4] === 0x66 && h[5] === 0x74 && h[6] === 0x79 && h[7] === 0x70) return { buf: dec, type: 'm4a', init };
                if ((h[0] === 0x49 && h[1] === 0x44 && h[2] === 0x33) || (h[0] === 0xff && (h[1] & 0xe0) === 0xe0)) return { buf: dec, type: 'mp3', init };
                if (h[0] === 0x66 && h[1] === 0x6c && h[2] === 0x61 && h[3] === 0x63) return { buf: dec, type: 'flac', init };
            } catch(e) {}
        }
        return null;
    }
    function detectFormat(b) {
        if (b.length < 16) return 'unknown';
        if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return 'mp3';
        if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return 'mp3';
        if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'm4a';
        if (b[0] === 0x66 && b[1] === 0x6c && b[2] === 0x61 && b[3] === 0x63) return 'flac';
        return 'unknown';
    }

    // ============================================================================
    // DB
    // ============================================================================
    let db = null, dbReady = false;
    async function dbInit() {
        if (dbReady && db) return db;
        return new Promise((res, rej) => {
            let settled = false;
            const timer = setTimeout(() => {
                if (!settled) { settled = true; rej(new Error('IndexedDB open timeout 8s')); }
            }, 8000);
            let req;
            try { req = indexedDB.open(DB_NAME, DB_VERSION); }
            catch(e) { clearTimeout(timer); return rej(e); }
            req.onerror = () => {
                if (!settled) { settled = true; clearTimeout(timer); rej(req.error || new Error('open error')); }
            };
            req.onsuccess = () => {
                if (!settled) { settled = true; clearTimeout(timer); db = req.result; dbReady = true; res(db); }
            };
            req.onblocked = () => { logWarn('DB: BLOCKED by another tab/version'); };
            req.onupgradeneeded = (e) => {
                try {
                    const d = e.target.result;
                    if (!d.objectStoreNames.contains(STORE_DOWNLOADED)) d.createObjectStore(STORE_DOWNLOADED, { keyPath: 'id' });
                } catch(err) {}
            };
        });
    }

    function dbTx(store, mode, fn) {
        return new Promise(async (res, rej) => {
            let settled = false;
            const timer = setTimeout(() => {
                if (!settled) { settled = true; rej(new Error('dbTx timeout 10s')); }
            }, 10000);
            const done = (v) => { if (!settled) { settled = true; clearTimeout(timer); res(v); } };
            const fail = (e) => { if (!settled) { settled = true; clearTimeout(timer); rej(e); } };
            try { if (!db) await dbInit(); } catch(e) { return fail(e); }
            try {
                const tx = db.transaction(store, mode);
                tx.onerror = () => fail(tx.error || new Error('tx error'));
                tx.onabort = () => fail(tx.error || new Error('tx abort'));
                const req = fn(tx.objectStore(store));
                req.onsuccess = () => done(req.result);
                req.onerror = () => fail(req.error);
            } catch(e) { fail(e); }
        });
    }
    const dbGetAll = (s) => dbTx(s, 'readonly', st => st.getAll());
    const dbAdd = (s, rec) => dbTx(s, 'readwrite', st => st.put(rec));

    // ============================================================================
    // ЯНДЕКС.ДИСК
    // ============================================================================
    const Yadisk = {
        _folderCache: new Set(),   // 🔧 кэш созданных папок
        async request(method, url, body, headers = {}) {
            const h = { 'Authorization': `OAuth ${state.yadiskToken}`, ...headers };
            return await gmRequest({ method, url, headers: h, data: body, timeout: 300000 });
        },
        async findBaseFolder() {
            if (state.resolvedDiskBase) return state.resolvedDiskBase;
            try {
                const r = await this.request('GET', `${YADISK_API}/resources?path=/&limit=200`);
                if (r.status === 200) {
                    const d = JSON.parse(r.responseText);
                    for (const it of (d?._embedded?.items || [])) {
                        if (it.type === 'dir' && (it.name || '').toLowerCase() === 'music') {
                            state.resolvedDiskBase = it.name;
                            logDisk(`📁 Базовая папка: /${it.name}`);
                            return it.name;
                        }
                    }
                    const cr = await this.request('PUT', `${YADISK_API}/resources?path=/music`);
                    if (cr.status === 201 || cr.status === 409) {
                        state.resolvedDiskBase = 'music';
                        logDisk(`📁 Создана папка /music`);
                        return 'music';
                    }
                }
            } catch(e) {}
            state.resolvedDiskBase = 'music';
            return 'music';
        },
        async findDownloadsFolder(base) {
            if (state.resolvedDownloadsBase) return state.resolvedDownloadsBase;
            try {
                const r = await this.request('GET', `${YADISK_API}/resources?path=${encodeURIComponent('/' + base)}&limit=200`);
                if (r.status === 200) {
                    const d = JSON.parse(r.responseText);
                    for (const it of (d?._embedded?.items || [])) {
                        if (it.type === 'dir' && (it.name || '').toLowerCase() === '@downloads') {
                            state.resolvedDownloadsBase = it.name;
                            logDisk(`📁 Папка загрузок: /${base}/${it.name}`);
                            return it.name;
                        }
                    }
                }
            } catch(e) {}
            state.resolvedDownloadsBase = '@downloads';
            logDisk(`📁 Папка загрузок: /${base}/@downloads`);
            return '@downloads';
        },
        async ensureFolder(path) {
            if (!path || path === '/') return true;
            path = '/' + path.replace(/^\/+|\/+$/g, '');
            // 🔧 кэш: если папку уже проверяли в этой сессии — не дёргаем API
            if (this._folderCache.has(path)) return true;
            try {
                const r = await this.request('GET', `${YADISK_API}/resources?path=${encodeURIComponent(path)}&limit=1`);
                if (r.status === 200) { this._folderCache.add(path); return true; }
            } catch(e) {}
            let cur = '';
            for (const p of path.replace(/^\//, '').split('/')) {
                if (!p) continue;
                cur += '/' + p;
                for (let i = 1; i <= 3; i++) {
                    try {
                        const r = await this.request('PUT', `${YADISK_API}/resources?path=${encodeURIComponent(cur)}`);
                        if (r.status === 201 || r.status === 409) break;
                        if (i === 3) return false;
                        await new Promise(res => setTimeout(res, 500 * i));
                    } catch(e) { if (i === 3) return false; await new Promise(res => setTimeout(res, 500 * i)); }
                }
            }
            this._folderCache.add(path);
            return true;
        },
        async getUploadHref(path) {
            for (let i = 1; i <= 5; i++) {
                try {
                    const r = await this.request('GET', `${YADISK_API}/resources/upload?path=${encodeURIComponent(path)}&overwrite=true`);
                    if (r.status === 200) return JSON.parse(r.responseText).href;
                    if ([429, 500, 502, 503, 504].includes(r.status)) await new Promise(res => setTimeout(res, 1000 * i));
                    else return null;
                } catch(e) { await new Promise(res => setTimeout(res, 1000 * i)); }
            }
            return null;
        },
        async uploadBlob(blob, path, onProgress) {
            const href = await this.getUploadHref(path);
            if (!href) return { ok: false, error: 'no href' };
            for (let i = 1; i <= 5; i++) {
                try {
                    const r = await gmRequest({
                        method: 'PUT', url: href, data: blob,
                        headers: { 'Content-Type': 'application/octet-stream' },
                        timeout: 900000, onprogress: onProgress
                    });
                    if (r.status === 201 || r.status === 202) return { ok: true };
                    if (r.status === 400) {
                        const h2 = await this.getUploadHref(path);
                        if (!h2) return { ok: false, error: 'no href after 400' };
                        const r2 = await gmRequest({ method: 'PUT', url: h2, data: blob, headers: { 'Content-Type': 'application/octet-stream' }, timeout: 900000 });
                        if (r2.status === 201 || r2.status === 202) return { ok: true };
                        return { ok: false, error: `HTTP ${r2.status}` };
                    }
                    if (i === 5) return { ok: false, error: `HTTP ${r.status}` };
                    await new Promise(res => setTimeout(res, 1000 * i));
                } catch(e) {
                    if (i === 5) return { ok: false, error: e.message };
                    await new Promise(res => setTimeout(res, 1000 * i));
                }
            }
            return { ok: false, error: 'upload failed' };
        },
        // 🔧 /Music/@Downloads/<год>/<папка>/<трек>.<ext>
        async buildPath(track, ext) {
            const base = await this.findBaseFolder();
            const downloads = await this.findDownloadsFolder(base);
            const year = String(new Date().getFullYear());
            const artist = sanitizeName(track.artist || 'Unknown');
            const title = sanitizeName(track.title || 'Untitled')
                .replace(/\.(mp3|m4a|flac|aac|ogg|opus|wav)$/i, '');
            let folderName = '';
            if (track.playlistName) folderName = sanitizeName(track.playlistName);
            else if (track.album) folderName = sanitizeName(track.album);
            else if (state.createArtistFolder) folderName = artist;
            if (folderName) return `/${base}/${downloads}/${year}/${folderName}/${title}.${ext}`;
            return `/${base}/${downloads}/${year}/${[artist, title].filter(Boolean).join(' - ')}.${ext}`;
        },
        async uploadTrack(track, blob, ext, onProgress) {
            try {
                const path = await this.buildPath(track, ext);
                const folder = path.substring(0, path.lastIndexOf('/'));
                if (!await this.ensureFolder(folder)) return { ok: false, error: 'mkdir failed' };
                const up = await this.uploadBlob(blob, path, onProgress);
                if (!up.ok) return { ok: false, error: up.error };
                return { ok: true, diskPath: path };
            } catch(e) { return { ok: false, error: e.message }; }
        }
    };

    // ============================================================================
    // GITHUB
    // ============================================================================
    const GhState = {
        async api(method, url, body) {
            if (!state.ghToken) throw new Error('no token');
            return await gmRequest({
                method, url,
                headers: {
                    'Authorization': `token ${state.ghToken}`,
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28',
                    ...(body ? { 'Content-Type': 'application/json' } : {})
                },
                data: body ? JSON.stringify(body) : undefined,
                timeout: 30000
            });
        },
        buildPayload() {
            const meta = {};
            for (const [k, v] of state.downloadedMeta) meta[k] = v;
            return {
                version: VERSION, updatedAt: new Date().toISOString(),
                downloadedIds: Array.from(state.downloadedIds),
                downloadedMeta: meta,
                settings: {
                    saveTxt: state.saveTxt, createArtistFolder: state.createArtistFolder,
                    uploadDisk: state.uploadDisk, keepLocal: state.keepLocal,
                    autoSync: state.autoSync, minimized: state.minimized,
                    preferredQuality: state.preferredQuality
                },
                account: { uid: state.uid, login: state.login, hasPlus: state.hasPlus }
            };
        },
        b64e(s) { const b = new TextEncoder().encode(s); let x = ''; for (let i = 0; i < b.length; i++) x += String.fromCharCode(b[i]); return btoa(x); },
        b64d(s) { const bin = atob(s.replace(/\s/g, '')); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return new TextDecoder().decode(b); },
        url() { return `https://api.github.com/repos/${state.ghRepo}/contents/${state.ghRepoPath}`; },
        async load() {
            if (!state.ghToken || !state.ghRepo || !state.ghRepoPath) return false;
            try {
                const r = await this.api('GET', this.url());
                if (r.status === 404) return await this.save(true) !== false;
                if (r.status !== 200) return false;
                const d = JSON.parse(r.responseText);
                const remote = JSON.parse(this.b64d(d.content));
                for (const id of (remote.downloadedIds || [])) state.downloadedIds.add(String(id));
                if (remote.downloadedMeta) {
                    for (const [k, v] of Object.entries(remote.downloadedMeta)) {
                        if (!state.downloadedMeta.has(k)) state.downloadedMeta.set(k, v);
                    }
                }
                if (remote.settings) {
                    const s = remote.settings;
                    if (s.createArtistFolder !== undefined) state.createArtistFolder = !!s.createArtistFolder;
                    if (s.saveTxt !== undefined) state.saveTxt = !!s.saveTxt;
                    if (s.uploadDisk !== undefined) state.uploadDisk = !!s.uploadDisk;
                    if (s.keepLocal !== undefined) state.keepLocal = !!s.keepLocal;
                    if (s.autoSync !== undefined) state.autoSync = !!s.autoSync;
                    if (s.preferredQuality !== undefined) state.preferredQuality = s.preferredQuality;
                }
                logGh(`📥 Загружено из репо: ${state.downloadedIds.size} ID`);
                return true;
            } catch(e) { logErr(`Repo load: ${e.message}`); return false; }
        },
        async save() {
            if (!state.ghToken || !state.ghRepo || !state.ghRepoPath) return false;
            try {
                const url = this.url();
                let sha = null;
                const getR = await this.api('GET', url);
                if (getR.status === 200) { try { sha = JSON.parse(getR.responseText).sha; } catch(e) {} }
                const body = {
                    message: `YAMDL v${VERSION} · ${new Date().toISOString()}`,
                    content: this.b64e(JSON.stringify(this.buildPayload(), null, 2)),
                    ...(sha ? { sha } : {})
                };
                const r = await this.api('PUT', url, body);
                if (r.status === 200 || r.status === 201) {
                    state.lastGhSyncAt = Date.now();
                    logGh(`💾 Сохранено (${state.downloadedIds.size} ID)`);
                    Sound.github();
                    return true;
                }
                return false;
            } catch(e) { logErr(`Repo save: ${e.message}`); return false; }
        },
        schedule() {
            if (!state.ghToken || !state.autoSync) return;
            state.ghSyncPending = true;
            if (state.ghSyncTimer) clearTimeout(state.ghSyncTimer);
            state.ghSyncTimer = setTimeout(async () => {
                state.ghSyncTimer = null;
                if (state.ghSyncPending) { state.ghSyncPending = false; await this.save(); }
            }, 5000);
        },
        async test() {
            if (!state.ghToken) { logErr('Токен не задан'); return false; }
            try {
                const r = await this.api('GET', 'https://api.github.com/user');
                if (r.status === 200) { logGh(`✅ GitHub OK: @${JSON.parse(r.responseText).login}`); return true; }
                return false;
            } catch(e) { logErr(`GitHub test: ${e.message}`); return false; }
        },
        async testRepo() {
            if (!state.ghToken || !state.ghRepo) { logErr('Токен или репо не заданы'); return false; }
            try {
                const r = await this.api('GET', `https://api.github.com/repos/${state.ghRepo}`);
                if (r.status === 200) { logGh(`✅ Репо: ${JSON.parse(r.responseText).full_name}`); return true; }
                return false;
            } catch(e) { logErr(`Repo test: ${e.message}`); return false; }
        }
    };

    // ============================================================================
    // UI
    // ============================================================================
    const UI_HTML = `
        <style>
            #yamdl{position:fixed;bottom:16px;right:16px;z-index:2147483647;background:#000;color:#fff;
                font-family:'Yandex Sans Text',-apple-system,sans-serif;width:700px;max-width:calc(100vw - 32px);
                border-radius:20px;border:1px solid rgba(255,255,255,0.08);
                box-shadow:0 24px 80px rgba(0,0,0,0.8);overflow:hidden;display:flex;flex-direction:column;
                max-height:calc(100vh - 32px);}
            #yamdl-mini{position:fixed;bottom:16px;right:16px;z-index:2147483647;background:#000;
                border:1px solid rgba(255,255,255,0.08);border-radius:16px;
                box-shadow:0 12px 40px rgba(0,0,0,0.7);display:none;align-items:center;gap:10px;
                padding:10px 14px;cursor:pointer;}
            .ydl-btn{padding:9px 15px;border-radius:999px;font-size:12px;font-weight:500;border:none;
                cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all 0.15s;font-family:inherit;}
            .ydl-btn:hover{transform:translateY(-1px);}
            .ydl-btn:disabled{opacity:0.4;cursor:not-allowed;transform:none;}
            .ydl-accent{background:linear-gradient(135deg,#ffdb4d,#ffcc00);color:#000;font-weight:600;}
            .ydl-disk{background:linear-gradient(135deg,#ff8c00,#ff6600);color:#fff;font-weight:600;}
            .ydl-danger{background:rgba(248,113,113,0.15);color:#f87171;border:1px solid rgba(248,113,113,0.2);}
            .ydl-ghost{background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.08);}
            .ydl-ghost:hover{background:rgba(255,255,255,0.1);color:#fff;}
            .ydl-icon{width:32px;height:32px;border-radius:10px;background:rgba(255,255,255,0.06);
                color:rgba(255,255,255,0.6);border:none;cursor:pointer;display:inline-flex;
                align-items:center;justify-content:center;font-size:14px;}
            .ydl-icon:hover{background:rgba(255,255,255,0.1);color:#fff;}
            #ymdl-log::-webkit-scrollbar,#ymdl-list::-webkit-scrollbar{width:6px;}
            #ymdl-log::-webkit-scrollbar-thumb,#ymdl-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px;}
            .ydl-row{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;
                cursor:pointer;border:1px solid transparent;}
            .ydl-row:hover{background:rgba(255,255,255,0.04);}
            .ydl-row.sel{background:rgba(255,219,77,0.08);border-color:rgba(255,219,77,0.2);}
            .ydl-row.dl{background:rgba(74,222,128,0.06);border-color:rgba(74,222,128,0.15);}
            .ydl-cb{width:16px;height:16px;border-radius:4px;border:1.5px solid rgba(255,255,255,0.25);
                flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;color:#000;}
            .ydl-cb.on{background:linear-gradient(135deg,#ffdb4d,#ffcc00);border-color:transparent;font-weight:bold;}
            .ydl-cb.dlon{background:linear-gradient(135deg,#4ade80,#22c55e);border-color:transparent;font-weight:bold;}
            .ydl-pbar{width:100%;height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;}
            .ydl-pfill{height:100%;border-radius:3px;background:linear-gradient(90deg,#ffdb4d,#ffcc00);transition:width 0.15s;}
            .ydl-pfill.done{background:linear-gradient(90deg,#4ade80,#22c55e);}
            .ydl-pfill.err{background:linear-gradient(90deg,#f87171,#dc2626);}
            .ydl-pfill.disk{background:linear-gradient(90deg,#ff8c00,#ff6600);}
            .ydl-inp{width:100%;background:rgba(0,0,0,0.4);color:#fff;border:1px solid rgba(255,255,255,0.1);
                border-radius:8px;padding:8px 10px;font-size:11px;font-family:'SF Mono',monospace;outline:none;box-sizing:border-box;}
            .ydl-inp:focus{border-color:#ffdb4d;}
            .ydl-toggle{display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(255,255,255,0.03);
                border-radius:8px;cursor:pointer;user-select:none;font-size:11px;color:rgba(255,255,255,0.6);}
            .ydl-toggle input{accent-color:#ffdb4d;cursor:pointer;}
            .ydl-toggle.on{background:rgba(255,219,77,0.1);color:#ffdb4d;}
            .ydl-badge{padding:2px 8px;border-radius:10px;font-size:9px;font-family:'SF Mono',monospace;
                background:rgba(167,139,250,0.15);color:#a78bfa;display:inline-flex;align-items:center;gap:4px;}
            .ydl-badge.ok{background:rgba(74,222,128,0.15);color:#4ade80;}
            .ydl-badge.err{background:rgba(248,113,113,0.15);color:#f87171;}
            .ydl-pulse{animation:ydlp 2s ease-in-out infinite;}
            @keyframes ydlp{0%,100%{opacity:1;}50%{opacity:0.5;}}
        </style>
        <div id="yamdl-mini">
            <div style="width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#ffdb4d,#ffcc00);
                display:flex;align-items:center;justify-content:center;font-size:14px;">🎵</div>
            <div style="display:flex;flex-direction:column;line-height:1.2;">
                <div style="font-size:11px;color:#fff;font-weight:500;">Yandex DL v${VERSION}</div>
                <div id="ymdl-mini-status" style="font-size:9px;color:rgba(255,255,255,0.5);font-family:'SF Mono',monospace;">готов</div>
            </div>
            <div id="ymdl-mini-badge" style="display:none;background:#4ade80;color:#000;font-size:9px;font-weight:bold;
                padding:2px 6px;border-radius:8px;font-family:'SF Mono',monospace;">0</div>
            <div style="font-size:14px;color:rgba(255,255,255,0.4);">▲</div>
        </div>
        <div id="yamdl">
            <div style="display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.08);">
                <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#ffdb4d,#ffcc00);
                    display:flex;align-items:center;justify-content:center;font-size:18px;">🎵</div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:500;font-size:15px;">Yandex Music DL</div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.4);">v${VERSION} · RAW+retry · Диск · GitHub</div>
                </div>
                <span id="ymdl-badge" class="ydl-badge">🐙 —</span>
                <button id="ymdl-set" class="ydl-icon" title="Настройки">⚙️</button>
                <button id="ymdl-snd" class="ydl-icon" title="Звук">🔊</button>
                <button id="ymdl-clr" class="ydl-icon" title="Очистить">🗑</button>
                <button id="ymdl-min" class="ydl-icon" title="Свернуть">—</button>
                <button id="ymdl-x" class="ydl-icon" title="Закрыть">✕</button>
            </div>
            <div style="padding:12px 18px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;gap:10px;">
                <div id="ymdl-dot" class="ydl-pulse" style="width:8px;height:8px;border-radius:50%;background:#ffdb4d;flex-shrink:0;"></div>
                <div id="ymdl-stat" style="font-size:12px;color:rgba(255,255,255,0.6);">Инициализация...</div>
            </div>
            <div id="ymdl-set-panel" style="display:none;padding:12px 18px;border-bottom:1px solid rgba(255,255,255,0.08);">
                <div class="ydl-row" style="padding:0;gap:8px;">
                    <label style="font-size:11px;color:rgba(255,255,255,0.6);min-width:130px;">🎚 Качество</label>
                    <select id="ymdl-q" class="ydl-inp">
                        <option value="best">Лучшее</option>
                        <option value="flac">FLAC</option>
                        <option value="320">320 kbps</option>
                        <option value="192">192 kbps</option>
                    </select>
                </div>
                <div class="ydl-row" style="padding:0;gap:8px;margin-top:8px;">
                    <label style="font-size:11px;color:rgba(255,255,255,0.6);min-width:130px;">🟠 Яндекс.Диск</label>
                    <input type="password" id="ymdl-dt" class="ydl-inp" placeholder="OAuth токен">
                </div>
                <div class="ydl-row" style="padding:0;gap:8px;margin-top:8px;">
                    <label style="font-size:11px;color:rgba(255,255,255,0.6);min-width:130px;">🐙 GitHub токен</label>
                    <input type="password" id="ymdl-gt" class="ydl-inp" placeholder="ghp_...">
                </div>
                <div class="ydl-row" style="padding:0;gap:8px;margin-top:8px;">
                    <label style="font-size:11px;color:rgba(255,255,255,0.6);min-width:130px;">📦 Репозиторий</label>
                    <input type="text" id="ymdl-gr" class="ydl-inp" placeholder="owner/repo">
                </div>
                <div class="ydl-row" style="padding:0;gap:8px;margin-top:8px;">
                    <label style="font-size:11px;color:rgba(255,255,255,0.6);min-width:130px;">📁 Путь</label>
                    <input type="text" id="ymdl-grp" class="ydl-inp" placeholder="books/progress/ym-state.json">
                </div>
                <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">
                    <button id="ymdl-save" class="ydl-btn ydl-accent" style="padding:6px 12px;font-size:11px;">💾 Сохранить</button>
                    <button id="ymdl-td" class="ydl-btn ydl-ghost" style="padding:6px 12px;font-size:11px;">🧪 Диск</button>
                    <button id="ymdl-tg" class="ydl-btn ydl-ghost" style="padding:6px 12px;font-size:11px;">🧪 GitHub</button>
                    <button id="ymdl-tr" class="ydl-btn ydl-ghost" style="padding:6px 12px;font-size:11px;">🧪 Репо</button>
                    <button id="ymdl-sync" class="ydl-btn ydl-ghost" style="padding:6px 12px;font-size:11px;">🔄 Синк</button>
                    <button id="ymdl-tsound" class="ydl-btn ydl-ghost" style="padding:6px 12px;font-size:11px;">🎼 Звук</button>
                    <button id="ymdl-reboot" class="ydl-btn ydl-ghost" style="padding:6px 12px;font-size:11px;">🔧 Boot-диаг</button>
                </div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);">
                    <label class="ydl-toggle" id="t1"><input type="checkbox" id="cb-txt">📝 TXT+JSON</label>
                    <label class="ydl-toggle" id="t2"><input type="checkbox" id="cb-artist">📁 Папка</label>
                    <label class="ydl-toggle" id="t3"><input type="checkbox" id="cb-disk">☁️ Диск</label>
                    <label class="ydl-toggle" id="t4"><input type="checkbox" id="cb-local">💾 Локально</label>
                    <label class="ydl-toggle" id="t5"><input type="checkbox" id="cb-sync">🔄 Автосинк</label>
                    <label class="ydl-toggle" id="t6"><input type="checkbox" id="cb-sound">🔊 Звуки</label>
                </div>
                <div id="ymdl-state" style="font-family:'SF Mono',monospace;font-size:10px;color:rgba(255,255,255,0.5);margin-top:8px;">📊 —</div>
            </div>
            <div id="ymdl-list-panel" style="display:none;padding:12px 18px;border-bottom:1px solid rgba(255,255,255,0.08);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px;">
                    <div style="font-size:11px;color:rgba(255,255,255,0.6);">ВЫБЕРИ ТРЕКИ</div>
                    <div style="display:flex;gap:6px;">
                        <button id="ymdl-fn" class="ydl-btn ydl-ghost" style="padding:4px 9px;font-size:10px;">Только новые</button>
                        <button id="ymdl-sa" class="ydl-btn ydl-ghost" style="padding:4px 9px;font-size:10px;">Все</button>
                        <button id="ymdl-sn" class="ydl-btn ydl-ghost" style="padding:4px 9px;font-size:10px;">Ничего</button>
                    </div>
                </div>
                <div id="ymdl-list" style="max-height:280px;overflow-y:auto;background:#0e0e10;
                    border-radius:10px;padding:6px;border:1px solid rgba(255,255,255,0.08);"></div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:6px;flex-wrap:wrap;">
                    <div id="ymdl-li" style="font-size:10px;color:rgba(255,255,255,0.4);flex:1;">—</div>
                    <div style="display:flex;gap:6px;">
                        <button id="ymdl-loc" class="ydl-btn ydl-accent" style="padding:9px 14px;">▶ Локально</button>
                        <button id="ymdl-dsk" class="ydl-btn ydl-disk" style="padding:9px 14px;">▶ На Диск</button>
                        <button id="ymdl-bth" class="ydl-btn ydl-accent" style="padding:9px 14px;background:linear-gradient(135deg,#a78bfa,#7c3aed);color:#fff;">▶ Оба</button>
                    </div>
                </div>
            </div>
            <div id="ymdl-batch" style="display:none;padding:12px 18px;border-bottom:1px solid rgba(255,255,255,0.08);">
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
                    <div style="font-size:11px;color:rgba(255,255,255,0.6);">ПРОГРЕСС</div>
                    <div style="display:flex;align-items:baseline;gap:6px;">
                        <span id="ymdl-bd" style="font-size:20px;font-weight:500;">0</span>
                        <span style="font-size:12px;color:rgba(255,255,255,0.4);">/ <span id="ymdl-bt">0</span></span>
                    </div>
                </div>
                <div class="ydl-pbar" style="margin-bottom:8px;">
                    <div id="ymdl-bbar" class="ydl-pfill done" style="width:0%;"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:10px;color:rgba(255,255,255,0.4);font-family:'SF Mono',monospace;">
                    <span id="ymdl-bok">✓ 0 OK</span>
                    <span id="ymdl-bb">📦 0 B</span>
                    <span id="ymdl-berr">✕ 0 err</span>
                </div>
                <div id="ymdl-beta" style="font-family:'SF Mono',monospace;font-size:10px;color:rgba(255,255,255,0.5);margin-top:4px;">⏱ ETA —</div>
            </div>
            <div id="ymdl-cur" style="display:none;padding:12px 18px;border-bottom:1px solid rgba(255,255,255,0.08);">
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;gap:10px;">
                    <div id="ymdl-ct" style="font-size:12px;color:#fff;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;">—</div>
                    <div id="ymdl-cp" style="font-size:15px;color:#ffdb4d;font-weight:500;font-family:'SF Mono',monospace;">0%</div>
                </div>
                <div class="ydl-pbar" style="margin-bottom:10px;">
                    <div id="ymdl-cbar" class="ydl-pfill" style="width:0%;"></div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;gap:10px;">
                    <div id="ymdl-cs" style="font-size:11px;color:#fff;font-family:'SF Mono',monospace;">—</div>
                    <div id="ymdl-cn" style="font-size:10px;color:rgba(255,255,255,0.4);font-family:'SF Mono',monospace;">0/0</div>
                </div>
                <div id="ymdl-cnet" style="font-family:'SF Mono',monospace;font-size:10px;color:rgba(255,255,255,0.5);">net: —</div>
            </div>
            <div style="padding:12px 18px;border-bottom:1px solid rgba(255,255,255,0.08);">
                <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                    <span style="font-size:10px;color:rgba(255,255,255,0.4);font-weight:500;">DIAG LOG</span>
                    <span style="font-size:9px;color:rgba(255,255,255,0.3);">live</span>
                </div>
                <div id="ymdl-log" style="font-size:10px;color:rgba(255,255,255,0.6);background:#0e0e10;
                    padding:10px 12px;border-radius:10px;max-height:220px;overflow-y:auto;
                    font-family:'SF Mono',monospace;line-height:1.55;border:1px solid rgba(255,255,255,0.08);"></div>
            </div>
            <div style="display:flex;gap:8px;padding:14px 18px;">
                <button id="ymdl-all" class="ydl-btn ydl-accent" style="flex:1;padding:11px;">
                    <span style="font-size:15px;">⬇</span> Загрузить список
                </button>
                <button id="ymdl-stop" class="ydl-btn ydl-danger" style="display:none;">⏹ Стоп</button>
            </div>
            <div style="padding:0 18px 12px;display:flex;justify-content:space-between;font-size:9px;color:rgba(255,255,255,0.3);">
                <span id="ymdl-net">🌐 online</span>
                <span id="ymdl-timer">+0.00s</span>
            </div>
        </div>
    `;

    function ensureUI() {
        if (document.getElementById('yamdl')) return true;
        if (!document.body) return false;
        try {
            document.body.insertAdjacentHTML('beforeend', UI_HTML);
        } catch(e) {
            console.error('[YAMDL] UI insert failed:', e);
            return false;
        }
        return !!document.getElementById('yamdl');
    }

    if (!ensureUI()) {
        console.warn('[YAMDL] body отсутствует, жду DOMContentLoaded...');
        document.addEventListener('DOMContentLoaded', ensureUI, { once: true });
    }

    const $ = id => document.getElementById(id);

    function safeOn(id, fn) {
        const el = document.getElementById(id);
        if (!el) { console.warn('[YAMDL] ⚠ элемент #' + id + ' не найден'); return; }
        el.onclick = fn;
    }
    function safeChange(id, fn) {
        const el = document.getElementById(id);
        if (!el) { console.warn('[YAMDL] ⚠ элемент #' + id + ' не найден (change)'); return; }
        el.addEventListener('change', fn);
    }
    function safeAddClass(id, cls, on) {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle(cls, on);
    }

    const logEl = $('ymdl-log');

    setInterval(() => { const t = $('ymdl-timer'); if (t) t.textContent = ts(); }, 100);
    setInterval(() => {
        const el = $('ymdl-net');
        if (!el) return;
        el.textContent = navigator.onLine ? '🌐 online' : '📡 OFFLINE';
        el.style.color = navigator.onLine ? 'rgba(255,255,255,0.3)' : '#f87171';
    }, 500);

    function log(t, color = 'rgba(255,255,255,0.6)', cs = 'color:#8a9aaa;') {
        if (!logEl) { console.log('[YAMDL]', t); return; }
        const line = document.createElement('div');
        line.innerHTML = `<span style="color:rgba(255,255,255,0.4);">[${ts()}]</span> <span style="color:${color};">${t}</span>`;
        logEl.appendChild(line);
        logEl.scrollTop = logEl.scrollHeight;
        while (logEl.children.length > 1500) logEl.removeChild(logEl.firstChild);
        console.log(`%c[${ts()}] %c${t}`, 'color:#6a7a8a;font-style:italic;', cs);
    }
    const logOk = t => log('✓ ' + t, '#4ade80', 'color:#4ade80;');
    const logErr = t => log('✕ ' + t, '#f87171', 'color:#f87171;');
    const logWarn = t => log('⚠ ' + t, '#fbbf24', 'color:#fbbf24;');
    const logStep = t => log('▸ ' + t, '#ffdb4d', 'color:#ffdb4d;font-weight:bold;');
    const logNet = t => log('🌐 ' + t, '#ffcc00', 'color:#ffcc00;');
    const logDisk = t => log('☁️ ' + t, '#ff8c00', 'color:#ff8c00;font-weight:bold;');
    const logGh = t => log('🐙 ' + t, '#a78bfa', 'color:#a78bfa;font-weight:bold;');
    const logDbg = t => log('🔬 ' + t, '#f472b6', 'color:#f472b6;');
    const logBoot = t => log('🚀 ' + t, '#38bdf8', 'color:#38bdf8;font-weight:bold;');

    function setStatus(text, kind = 'idle') {
        const s = $('ymdl-stat'); if (s) s.textContent = text;
        const d = $('ymdl-dot');
        if (d) {
            const c = { idle: '#ffdb4d', ok: '#4ade80', err: '#f87171', warn: '#fbbf24', disk: '#ff8c00' };
            d.style.background = c[kind] || '#ffdb4d';
            d.classList.toggle('ydl-pulse', kind === 'idle');
        }
        const ms = $('ymdl-mini-status'); if (ms) ms.textContent = text;
    }

    function setCurrent(title, done, total, stage, pct, st, netInfo) {
        const el = $('ymdl-cur'); if (el) el.style.display = 'block';
        const ct = $('ymdl-ct'); if (ct) ct.textContent = title;
        const cn = $('ymdl-cn'); if (cn) cn.textContent = `${done}/${total}`;
        const cs = $('ymdl-cs'); if (cs) cs.textContent = stage;
        const cp = $('ymdl-cp'); if (cp) cp.textContent = Math.round(pct) + '%';
        if (netInfo !== undefined) { const cn2 = $('ymdl-cnet'); if (cn2) cn2.textContent = 'net: ' + netInfo; }
        const bar = $('ymdl-cbar');
        if (bar) {
            bar.style.width = pct + '%';
            bar.className = 'ydl-pfill' + (st === 'error' ? ' err' : st === 'done' ? ' done' : st === 'disk' ? ' disk' : '');
        }
    }

    function updateBatch() {
        const el = $('ymdl-batch'); if (el) el.style.display = 'block';
        const { batchDone, batchTotal, batchErrors, batchBytesDone, batchStartTime } = state;
        const bd = $('ymdl-bd'); if (bd) bd.textContent = batchDone;
        const bt = $('ymdl-bt'); if (bt) bt.textContent = batchTotal;
        const bbar = $('ymdl-bbar'); if (bbar) bbar.style.width = batchTotal > 0 ? `${Math.round(batchDone / batchTotal * 100)}%` : '0%';
        const bok = $('ymdl-bok'); if (bok) bok.textContent = `✓ ${batchDone} OK`;
        const berr = $('ymdl-berr'); if (berr) berr.textContent = `✕ ${batchErrors} err`;
        const bb = $('ymdl-bb'); if (bb) bb.textContent = `📦 ${fmtBytes(batchBytesDone)}`;
        const el2 = (performance.now() - batchStartTime) / 1000;
        const avg = el2 > 0 ? (batchBytesDone / 1048576 / el2) : 0;
        const perTrack = batchDone > 0 ? el2 / batchDone : 0;
        const beta = $('ymdl-beta');
        if (beta) beta.textContent = `⏱ ETA ${fmtEta((batchTotal - batchDone) * perTrack)} · avg ${fmtSpeed(avg)} · ${fmtEta(el2)}`;
        const mb = $('ymdl-mini-badge');
        if (mb) {
            if (batchDone > 0 && state.isBatch) { mb.style.display = 'block'; mb.textContent = `${batchDone}/${batchTotal}`; }
            else mb.style.display = 'none';
        }
    }

    function updateStateInfo() {
        const el = $('ymdl-state');
        if (!el) return;
        el.textContent = [
            `📊 ${state.downloadedIds.size}`,
            `🎚 ${state.preferredQuality}`,
            `🟠 ${state.yadiskToken ? '✓' : '✗'}`,
            `🐙 ${state.ghToken ? '✓' : '✗'}${state.ghRepo ? ' ' + state.ghRepo : ''}`,
            `🔊 ${Sound.enabled ? '✓' : '✗'}`,
            state.lastGhSyncAt ? `💾 ${fmtAgo(state.lastGhSyncAt)}` : '💾 —'
        ].join(' · ');
    }

    function setBadge(kind, text) {
        const el = $('ymdl-badge');
        if (!el) return;
        el.className = 'ydl-badge ' + (kind || '');
        el.textContent = text || '🐙 —';
    }

    function renderList(tracks) {
        const listEl = $('ymdl-list');
        if (!listEl) return;
        listEl.innerHTML = '';
        const visible = tracks.map((t, i) => ({ t, i })).filter(({ t }) => !state.filterOnlyNew || !state.downloadedIds.has(t.id));
        visible.forEach(({ t, i }) => {
            const isDL = state.downloadedIds.has(t.id);
            const row = document.createElement('div');
            row.className = 'ydl-row' + (isDL ? ' dl' : '');
            const checked = state.selected.has(i);
            if (checked) row.classList.add('sel');
            const title = ((t.artist || '') + ' — ' + (t.title || '')).replace(/"/g, '&quot;');
            const meta = state.downloadedMeta.get(t.id);
            const isDisk = meta?.diskPath;
            const badge = isDisk ? '✓ ДИСК' : (isDL ? '✓ ЕСТЬ' : 'NEW');
            row.innerHTML = `
                <div class="ydl-cb ${checked ? (isDL ? 'dlon' : 'on') : ''}">${checked ? '✓' : ''}</div>
                <div style="font-size:10px;color:rgba(255,255,255,0.3);font-family:'SF Mono',monospace;width:24px;">${String(i + 1).padStart(2, '0')}</div>
                <div style="font-size:12px;color:rgba(255,255,255,0.85);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${title}">${title}</div>
                <div style="font-size:9px;padding:2px 6px;border-radius:4px;background:rgba(255,219,77,0.15);color:#ffdb4d;font-family:'SF Mono',monospace;">${badge}</div>
            `;
            row.onclick = () => {
                if (state.selected.has(i)) state.selected.delete(i); else state.selected.add(i);
                Sound.click();
                row.classList.toggle('sel');
                const cb = row.querySelector('.ydl-cb');
                cb.classList.toggle('on');
                cb.classList.toggle('dlon');
                cb.textContent = state.selected.has(i) ? '✓' : '';
                updateListInfo();
            };
            listEl.appendChild(row);
        });
        updateListInfo();
    }

    function updateListInfo() {
        const dl = state.allTracks.filter(t => state.downloadedIds.has(t.id)).length;
        const nw = state.allTracks.length - dl;
        const li = $('ymdl-li');
        if (li) li.innerHTML = `Выбрано: <b style="color:#ffdb4d;">${state.selected.size}</b> · Всего: ${state.allTracks.length} · <span style="color:#4ade80;">✓ ${dl}</span> · <span style="color:#ffdb4d;">🆕 ${nw}</span>`;
        const loc = $('ymdl-loc'); if (loc) loc.disabled = state.selected.size === 0;
        const dsk = $('ymdl-dsk'); if (dsk) dsk.disabled = state.selected.size === 0;
        const bth = $('ymdl-bth'); if (bth) bth.disabled = state.selected.size === 0;
    }

    // ============================================================================
    // DISCOVERY
    // ============================================================================
    function normalizeTrack(t) {
        if (!t) return null;
        if (t.track && typeof t.track === 'object' && t.track.id) t = t.track;
        if (t.track && typeof t.track === 'object' && t.track.id) t = t.track;
        if (!t.id) return null;
        const hasTitle = !!t.title, hasDuration = typeof t.durationMs === 'number';
        if (!hasTitle && !hasDuration) return null;
        if (!hasTitle) t.title = `track_${t.id}`;
        const alb = (t.albums && t.albums[0]) || null;
        return {
            id: String(t.id), title: t.title,
            artist: (Array.isArray(t.artists) ? t.artists.map(a => a.name).filter(Boolean).join(', ') : '—') || '—',
            album: alb ? alb.title : '', albumId: alb ? String(alb.id) : null,
            durationMs: t.durationMs || 0, year: alb ? alb.year : null,
            hasLyrics: !!(t.lyricsInfo?.hasAvailableText || t.lyricsId),
            playlistName: null,
            raw: t
        };
    }

    async function fetchPageTracks() {
        const kind = detectPageKind();
        const out = [], seen = new Set();
        const push = n => { if (n && n.id && !seen.has(n.id)) { seen.add(n.id); out.push(n); } };
        logStep(`Страница: ${kind.kind}${kind.text ? ` "${kind.text}"` : ''}${kind.id ? ` id=${kind.id}` : ''}`);
        try {
            if (kind.kind === 'search' && kind.text) {
                for (let page = 0; page < 10; page++) {
                    const url = `${API_BASE}/search/instant/mixed?text=${encodeURIComponent(kind.text)}&type=${encodeURIComponent(SEARCH_TYPES)}&page=${page}&pageSize=36`;
                    logNet(`search page=${page}`);
                    const r = await fetch(url, { credentials: 'include', headers: buildHeaders() });
                    if (!r.ok) break;
                    const d = await r.json();
                    const results = d?.results || [];
                    if (!results.length) break;
                    let got = 0;
                    for (const item of results) {
                        if (item.type === 'track' && item.track) { const n = normalizeTrack(item.track); if (n) { push(n); got++; } }
                    }
                    logOk(`стр. ${page + 1}: +${got} (всего ${out.length})`);
                    setStatus(`Поиск стр. ${page + 1} · ${out.length}`, 'idle');
                    if (d.lastPage || results.length < 36) break;
                }
            } else if (kind.kind === 'artist') {
                for (let page = 0; page < 20; page++) {
                    const url = `${API_BASE}/artists/${kind.id}/tracks?page=${page}`;
                    logNet(`artists/${kind.id}/tracks page=${page}`);
                    const r = await fetch(url, { credentials: 'include', headers: buildHeaders() });
                    if (!r.ok) break;
                    const d = await r.json();
                    const tracks = d?.tracks || [];
                    const pager = d?.pager || {};
                    if (!tracks.length) break;
                    const before = out.length;
                    tracks.forEach(x => { const n = normalizeTrack(x.track || x); if (n) push(n); });
                    logOk(`стр. ${page + 1}: +${out.length - before} (всего ${out.length})`);
                    setStatus(`Артист стр. ${page + 1} · ${out.length}`, 'idle');
                    if (tracks.length < (pager.perPage || 20)) break;
                }
            } else if (kind.kind === 'album') {
                const url = `${API_BASE}/albums/${kind.id}/with-tracks?richTracks=true&resumeStream=false&withListeningFinished=true`;
                logNet(`GET albums/${kind.id}/with-tracks`);
                const r = await fetch(url, { credentials: 'include', headers: buildHeaders(kind.id) });
                if (r.ok) {
                    const d = await r.json();
                    const alb = d?.result || d;
                    const vols = alb?.volumes || [];
                    const total = vols.reduce((s, v) => s + v.length, 0);
                    logDbg(`volumes=${vols.length}, треков=${total}`);
                    vols.forEach(vol => vol.forEach(x => {
                        const c = (x.track && typeof x.track === 'object') ? x.track : x;
                        const n = normalizeTrack(c);
                        if (n) push(n);
                    }));
                }
            } else if (kind.kind === 'track') {
                const r = await fetch(`${API_BASE}/tracks`, {
                    method: 'POST', credentials: 'include',
                    headers: { ...buildHeaders(), 'content-type': 'application/json' },
                    body: JSON.stringify({ trackIds: [kind.id] })
                });
                if (r.ok) { const arr = await r.json(); const t = Array.isArray(arr) ? arr[0] : arr.result?.[0]; const n = normalizeTrack(t); if (n) push(n); }
            } else if (kind.kind === 'playlist') {
                const url = `${API_BASE}/users/${kind.uid}/playlists/${kind.kind_}`;
                logNet(url);
                const r = await fetch(url, { credentials: 'include', headers: buildHeaders() });
                if (r.ok) {
                    const d = await r.json();
                    const pl = d?.result || d;
                    const plTitle = pl?.title || pl?.kind || 'Плейлист';
                    logDbg(`плейлист "${plTitle}" · треков ${pl?.tracks?.length || 0}`);
                    (pl?.tracks || []).forEach(x => {
                        const n = normalizeTrack(x.track || x);
                        if (n) { n.playlistName = plTitle; push(n); }
                    });
                }
            } else if (kind.kind === 'collection') {
                if (state.uid) {
                    const url = `${API_BASE}/users/${state.uid}/playlists/3`;
                    const r = await fetch(url, { credentials: 'include', headers: buildHeaders() });
                    if (r.ok) {
                        const d = await r.json();
                        const pl = d?.result || d;
                        const plTitle = pl?.title || 'Мне нравится';
                        (pl?.tracks || []).forEach(x => {
                            const n = normalizeTrack(x.track || x);
                            if (n) { n.playlistName = plTitle; push(n); }
                        });
                    }
                }
            }
        } catch(e) { logErr(`fetch: ${e.message}`); }
        return out;
    }

    async function fetchLyrics(trackId, hasLyrics) {
        if (hasLyrics === false) return null;
        try {
            const r = await fetch(`${API_BASE}/tracks/${trackId}/lyrics`, { credentials: 'include', headers: buildHeaders() });
            if (!r.ok) return null;
            const data = await r.json();
            const res = data?.result || data;
            if (!res) return null;
            if (typeof res.lyrics === 'string') return { fullLyrics: res.lyrics };
            return res.lyrics || res;
        } catch(e) { return null; }
    }

    // ============================================================================
    // СКАЧИВАНИЕ
    // ============================================================================
    async function downloadOne(track, idx, total, mode) {
        const title = track.title;
        const tT0 = performance.now();
        logStep(`[${idx + 1}/${total}] "${title.slice(0, 50)}" [${mode}]`);

        for (let attempt = 1; attempt <= 2; attempt++) {
            if (state.batchCancel) return;
            if (attempt > 1) { logWarn(`Попытка ${attempt}/2`); await new Promise(r => setTimeout(r, 2000)); }
            try {
                setCurrent(title, idx, total, '🔗 get-file-info...', 5, 'idle', '');
                const result = await getFileInfoCascade(track.id, track.albumId, (m, k) => {
                    if (k === 'dbg') logDbg(`${track.id} ${m}`);
                    else if (k === 'warn') logWarn(`  ${m}`);
                });
                if (!result.ok) throw new Error(`get-file-info: ${MAX_ROUNDS} раундов провалились`);

                const info = result.info;
                logOk(`get-file-info OK через ${result.used} (round ${result.round}) · ${info.codec}@${info.bitrate}kbps${info.key ? ' 🔐 key' : ''}`);

                setCurrent(title, idx, total, '⬇ Скачивание CDN...', 15, 'idle', 'init');
                const cdnUrl = info.urls[0];
                const tDl = performance.now();
                const resp = await gmRequest({
                    method: 'GET', url: cdnUrl, responseType: 'arraybuffer', timeout: 600000,
                    onprogress: (e) => {
                        if (!e.lengthComputable) return;
                        const sec = (performance.now() - tDl) / 1000;
                        const sp = sec > 0 ? (e.loaded / 1048576 / sec) : 0;
                        const pct = 15 + (e.loaded / e.total * 55);
                        setCurrent(title, idx, total, `⬇ ${fmtBytes(e.loaded)}/${fmtBytes(e.total)} · ${fmtSpeed(sp)}`, pct, 'idle', `${fmtBytes(e.loaded)}/${fmtBytes(e.total)} · ${fmtSpeed(sp)}`);
                    }
                });
                if (resp.status !== 200 && resp.status !== 206) throw new Error(`CDN HTTP ${resp.status}`);

                let bytes = new Uint8Array(resp.response);
                let format = detectFormat(bytes);

                if (format === 'unknown' && info.key) {
                    logDbg(`🔐 AES-CTR decrypt (${bytes.byteLength} B)...`);
                    setCurrent(title, idx, total, '🔐 Расшифровка...', 72, 'idle', '');
                    const dec = await tryDecrypt(bytes, info.key);
                    if (!dec) throw new Error('AES-CTR не сработал');
                    bytes = new Uint8Array(dec.buf);
                    format = dec.type;
                    logOk(`Расшифровано (init=${dec.init}) → ${format}`);
                }
                if (format === 'unknown') {
                    const hex = Array.from(bytes.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ');
                    throw new Error(`unknown format hex: ${hex}`);
                }

                const blob = new Blob([bytes]);
                const size = bytes.length;

                let lyrics = null;
                try { setCurrent(title, idx, total, '📝 Текст...', 78, 'idle', ''); lyrics = await fetchLyrics(track.id, track.hasLyrics); } catch(e) {}

                const safeA = sanitizeName(track.artist || 'unknown');
                const safeT = sanitizeName(track.title || 'track');
                const filename = `${safeA} - ${safeT}.${format}`;

                let diskOk = false, diskPath = null;

                if ((mode === 'disk' || mode === 'both') && state.yadiskToken) {
                    setCurrent(title, idx, total, '☁️ Диск...', 82, 'disk', '');
                    const up = await Yadisk.uploadTrack(track, blob, format, (e) => {
                        if (!e.lengthComputable) return;
                        const sec = (performance.now() - tDl) / 1000;
                        const sp = sec > 0 ? (e.loaded / 1048576 / sec) : 0;
                        setCurrent(title, idx, total, `☁️ ${fmtBytes(e.loaded)}/${fmtBytes(e.total)} · ${fmtSpeed(sp)}`, 82 + (e.loaded / e.total * 12), 'disk', `${fmtBytes(e.loaded)}/${fmtBytes(e.total)}`);
                    });
                    if (up.ok) { diskOk = true; diskPath = up.diskPath; logDisk(`✅ ${diskPath}`); }
                    else { logWarn(`Диск: ${up.error}`); }
                }

                if ((mode === 'local' || mode === 'both') && state.keepLocal) {
                    setCurrent(title, idx, total, '💾 В файл...', 94, 'idle', '');
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = filename;
                    document.body.appendChild(a); a.click();
                    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 5000);
                    logOk(`💾 ${filename} (${fmtBytes(size)})`);
                    saveTxtJson(track, lyrics, size, format, info);
                    Sound.local();
                }

                try {
                    const meta = { id: track.id, title: track.title, artist: track.artist, size, downloadedAt: Date.now(), filename, ext: format, codec: info.codec, bitrate: info.bitrate, hasLyrics: !!lyrics, diskPath: diskPath || undefined, mode };
                    await dbAdd(STORE_DOWNLOADED, meta);
                    state.downloadedIds.add(track.id);
                    state.downloadedMeta.set(track.id, meta);
                } catch(e) { logWarn(`DB: ${e.message}`); }

                state.batchBytesDone += size;
                const elapsed = ((performance.now() - tT0) / 1000).toFixed(1);
                setCurrent(title, idx, total, diskOk ? '✅ Диск + Готово' : '✅ Готово', 100, 'done', fmtBytes(size));
                logOk(`ГОТОВО · ${elapsed}s · ${fmtBytes(size)}${diskOk ? ' · ☁️' : ''}`);
                state.batchDone++;
                updateBatch();
                Sound.trackDone();
                GhState.schedule();
                return;
            } catch(e) {
                if (attempt >= 2) {
                    state.batchErrors++;
                    logErr(`"${title.slice(0, 40)}" — ${e.message}`);
                    setCurrent(title, idx, total, `❌ ${e.message.slice(0, 60)}`, 100, 'error', '');
                    updateBatch();
                    Sound.error();
                }
            }
        }
    }

    async function startBatch(mode) {
        if (state.isBatch) return;
        if (state.selected.size === 0) { logWarn('Ничего не выбрано'); Sound.error(); return; }
        if ((mode === 'disk' || mode === 'both') && !state.yadiskToken) { logErr('Не задан токен Диска'); Sound.error(); return; }
        const idxs = Array.from(state.selected).sort((a, b) => a - b);
        const tracks = idxs.map(i => state.allTracks[i]).filter(Boolean);
        Sound.batchStart();
        logStep(`▶ Батч [${mode}] · ${tracks.length} треков`);
        state.isBatch = true; state.batchCancel = false;
        state.batchErrors = 0; state.batchDone = 0;
        state.batchTotal = tracks.length;
        state.batchBytesDone = 0; state.batchStartTime = performance.now();
        state.phase = 'downloading';
        const lp = $('ymdl-list-panel'); if (lp) lp.style.display = 'none';
        const bp = $('ymdl-batch'); if (bp) bp.style.display = 'block';
        const cp = $('ymdl-cur'); if (cp) cp.style.display = 'block';
        updateBatch();
        const allBtn = $('ymdl-all'); if (allBtn) allBtn.disabled = true;
        const stopBtn = $('ymdl-stop'); if (stopBtn) stopBtn.style.display = 'inline-flex';
        setStatus(`Скачивание [${mode}]...`, 'idle');
        const bT0 = performance.now();
        for (let i = 0; i < tracks.length; i++) {
            if (state.batchCancel) { logWarn('Отменено'); break; }
            await downloadOne(tracks[i], i, tracks.length, mode);
            if (i < tracks.length - 1 && !state.batchCancel) await new Promise(r => setTimeout(r, PAUSE_TRACKS));
        }
        logOk(`ЗАВЕРШЕНО · ${((performance.now() - bT0) / 1000).toFixed(1)}s · ${fmtBytes(state.batchBytesDone)}`);
        logOk(`Успешно: ${state.batchDone}/${state.batchTotal}`);
        if (state.batchErrors) logErr(`Ошибок: ${state.batchErrors}`);
        setStatus(`Готово! ${state.batchDone}/${state.batchTotal}`, state.batchErrors ? 'warn' : 'ok');
        Sound.batchDone();
        GhState.schedule();
        state.isBatch = false; state.phase = 'done';
        if (allBtn) { allBtn.disabled = false; allBtn.innerHTML = '<span style="font-size:15px;">⬇</span> Обновить список'; }
        if (stopBtn) stopBtn.style.display = 'none';
        const mb = $('ymdl-mini-badge'); if (mb) mb.style.display = 'none';
        updateStateInfo();
    }

    // ============================================================================
    // SAVE TXT+JSON
    // ============================================================================
    function saveTxtJson(track, lyrics, size, ext, info) {
        if (!state.saveTxt) return;
        const a = sanitizeName(track.artist || 'unknown');
        const t = sanitizeName(track.title || 'track');
        const sfx = ` [${track.id}]`;
        const sep = '═'.repeat(64);
        const L = [sep, `🎵 ${track.title}`, sep];
        L.push(`ID:        ${track.id}`);
        L.push(`Исполнитель: ${track.artist}`);
        if (track.album) L.push(`Альбом:    ${track.album}`);
        if (track.year) L.push(`Год:       ${track.year}`);
        if (info) L.push(`Качество:  ${info.codec} @ ${info.bitrate}kbps`);
        L.push(`Скачано:   ${new Date().toLocaleString('ru-RU')}`);
        L.push(''); L.push(sep); L.push('📝 ТЕКСТ ПЕСНИ'); L.push(sep);
        if (lyrics?.fullLyrics) L.push(lyrics.fullLyrics);
        else if (lyrics?.text) L.push(lyrics.text);
        else L.push('(текст не найден)');
        L.push(''); L.push(sep); L.push(`© Yandex Music Downloader v${VERSION}`); L.push(sep);
        try {
            const blob = new Blob([L.join('\n')], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a2 = document.createElement('a');
            a2.href = url; a2.download = `${a} - ${t}${sfx}.txt`;
            document.body.appendChild(a2); a2.click();
            setTimeout(() => { a2.remove(); URL.revokeObjectURL(url); }, 3000);
        } catch(e) {}
        try {
            const json = { _meta: { savedBy: `YMDL v${VERSION}`, savedAt: new Date().toISOString(), size }, id: track.id, title: track.title, artist: track.artist, album: track.album, albumId: track.albumId, year: track.year, durationMs: track.durationMs, quality: info ? { codec: info.codec, bitrate: info.bitrate } : null, lyrics: lyrics ? { fullLyrics: lyrics.fullLyrics || lyrics.text || '' } : null };
            const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a2 = document.createElement('a');
            a2.href = url; a2.download = `${a} - ${t}${sfx}.json`;
            document.body.appendChild(a2); a2.click();
            setTimeout(() => { a2.remove(); URL.revokeObjectURL(url); }, 3000);
        } catch(e) {}
    }

    // ============================================================================
    // INIT
    // ============================================================================
    async function prepareList() {
        if (state.phase !== 'idle' && state.phase !== 'done') return;
        Sound.click();
        state.phase = 'list';
        const lp = $('ymdl-list-panel'); if (lp) lp.style.display = 'block';
        const bp = $('ymdl-batch'); if (bp) bp.style.display = 'none';
        const cp = $('ymdl-cur'); if (cp) cp.style.display = 'none';
        state.selected.clear();
        const allBtn = $('ymdl-all'); if (allBtn) allBtn.disabled = true;
        setStatus('Проверка авторизации...', 'idle');

        if (!state.uid) {
            const uid = await getUid();
            if (!uid) {
                logErr('Нет авторизации');
                setStatus('Нет авторизации', 'err');
                state.phase = 'idle'; if (allBtn) allBtn.disabled = false;
                Sound.error();
                return;
            }
            logOk(`Аккаунт: ${state.login} · uid ${state.uid}`);
        }

        setStatus('Сбор треков...', 'idle');
        try {
            let tracks = await fetchPageTracks();
            const seen = new Set();
            tracks = tracks.filter(t => t && t.id && !seen.has(t.id) && seen.add(t.id));
            if (tracks.length === 0) {
                logWarn('Треков не найдено');
                setStatus('Нет треков', 'warn');
                state.phase = 'idle'; if (allBtn) allBtn.disabled = false;
                Sound.error();
                return;
            }
            state.allTracks = tracks;
            tracks.forEach((t, i) => { if (!state.downloadedIds.has(t.id)) state.selected.add(i); });
            renderList(tracks);
            setStatus(`Выбрано ${state.selected.size} из ${tracks.length}`, 'ok');
            logOk(`📋 ${tracks.length} треков`);
            Sound.diag();
        } catch(e) {
            logErr(`Ошибка: ${e.message}`);
            setStatus('Ошибка', 'err');
            state.phase = 'idle'; if (allBtn) allBtn.disabled = false;
            Sound.error();
        }
    }

    function applySettingsToUI() {
        const q = $('ymdl-q'); if (q) q.value = state.preferredQuality;
        const dt = $('ymdl-dt'); if (dt) dt.value = state.yadiskToken || '';
        const gt = $('ymdl-gt'); if (gt) gt.value = state.ghToken || '';
        const gr = $('ymdl-gr'); if (gr) gr.value = state.ghRepo || '';
        const grp = $('ymdl-grp'); if (grp) grp.value = state.ghRepoPath || '';
        const cbt = $('cb-txt'); if (cbt) cbt.checked = state.saveTxt;
        const cba = $('cb-artist'); if (cba) cba.checked = state.createArtistFolder;
        const cbd = $('cb-disk'); if (cbd) cbd.checked = state.uploadDisk;
        const cbl = $('cb-local'); if (cbl) cbl.checked = state.keepLocal;
        const cbs = $('cb-sync'); if (cbs) cbs.checked = state.autoSync;
        const cbsnd = $('cb-sound'); if (cbsnd) cbsnd.checked = Sound.enabled;
        safeAddClass('t1', 'on', state.saveTxt);
        safeAddClass('t2', 'on', state.createArtistFolder);
        safeAddClass('t3', 'on', state.uploadDisk);
        safeAddClass('t4', 'on', state.keepLocal);
        safeAddClass('t5', 'on', state.autoSync);
        safeAddClass('t6', 'on', Sound.enabled);
        const snd = $('ymdl-snd'); if (snd) snd.textContent = Sound.enabled ? '🔊' : '🔇';
        updateStateInfo();
    }

    function readSettingsFromUI() {
        const q = $('ymdl-q'); if (q) state.preferredQuality = q.value;
        const dt = $('ymdl-dt'); if (dt) state.yadiskToken = dt.value.trim();
        const gt = $('ymdl-gt'); if (gt) state.ghToken = gt.value.trim();
        const gr = $('ymdl-gr'); if (gr) state.ghRepo = gr.value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
        const grp = $('ymdl-grp'); if (grp) state.ghRepoPath = grp.value.trim().replace(/^\//, '');
        const cbt = $('cb-txt'); if (cbt) state.saveTxt = cbt.checked;
        const cba = $('cb-artist'); if (cba) state.createArtistFolder = cba.checked;
        const cbd = $('cb-disk'); if (cbd) state.uploadDisk = cbd.checked;
        const cbl = $('cb-local'); if (cbl) state.keepLocal = cbl.checked;
        const cbs = $('cb-sync'); if (cbs) state.autoSync = cbs.checked;
        const cbsnd = $('cb-sound'); if (cbsnd) Sound.enabled = cbsnd.checked;
        state.resolvedDiskBase = null;
        state.resolvedDownloadsBase = null;
        Yadisk._folderCache = new Set();
    }

    function persistSettings() {
        saveLS(LS.preferredQuality, state.preferredQuality);
        saveLS(LS.yadiskToken, state.yadiskToken);
        saveLS(LS.ghToken, state.ghToken);
        saveLS(LS.ghRepo, state.ghRepo);
        saveLS(LS.ghRepoPath, state.ghRepoPath);
        saveLS(LS.saveTxt, state.saveTxt ? 'true' : 'false');
        saveLS(LS.createArtistFolder, state.createArtistFolder ? 'true' : 'false');
        saveLS(LS.uploadDisk, state.uploadDisk ? 'true' : 'false');
        saveLS(LS.keepLocal, state.keepLocal ? 'true' : 'false');
        saveLS(LS.autoSync, state.autoSync ? 'true' : 'false');
        saveLS(LS.sound, Sound.enabled ? 'true' : 'false');
    }

    function applyMin() {
        const box = $('yamdl'), mini = $('yamdl-mini');
        if (!box || !mini) return;
        if (state.minimized) { box.style.display = 'none'; mini.style.display = 'flex'; }
        else { box.style.display = 'flex'; mini.style.display = 'none'; }
        saveLS(LS.minimized, state.minimized ? '1' : '0');
    }

    // ============================================================================
    // HANDLERS
    // ============================================================================
    safeOn('ymdl-snd', () => {
        Sound.enabled = !Sound.enabled;
        const snd = $('ymdl-snd'); if (snd) snd.textContent = Sound.enabled ? '🔊' : '🔇';
        const cbs = $('cb-sound'); if (cbs) cbs.checked = Sound.enabled;
        safeAddClass('t6', 'on', Sound.enabled);
        saveLS(LS.sound, Sound.enabled ? 'true' : 'false');
        if (Sound.enabled) Sound.click();
        updateStateInfo();
    });
    safeOn('ymdl-clr', () => { if (logEl) logEl.innerHTML = ''; console.clear(); Sound.click(); });
    safeOn('ymdl-min', () => { state.minimized = true; applyMin(); Sound.click(); });
    safeOn('ymdl-mini', () => { state.minimized = false; applyMin(); Sound.click(); });
    safeOn('ymdl-x', () => {
        if (state.isBatch && !confirm('Батч идёт. Закрыть?')) return;
        state.batchCancel = true;
        try { Sound.ctx?.close(); } catch(e) {}
        const b = $('yamdl'); if (b) b.remove();
        const m = $('yamdl-mini'); if (m) m.remove();
    });
    safeOn('ymdl-set', () => {
        const p = $('ymdl-set-panel');
        if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
        Sound.click();
    });
    safeOn('ymdl-save', async () => {
        readSettingsFromUI(); persistSettings();
        logOk('Настройки сохранены');
        Sound.save();
        updateStateInfo();
        if (state.ghToken) {
            const ok = await GhState.test();
            setBadge(ok ? 'ok' : 'err', ok ? '🐙 ✓' : '🐙 ✗');
        }
    });
    safeOn('ymdl-reboot', async () => {
        logBoot('=== BOOT-ДИАГНОСТИКА ===');
        logBoot(`navigator.onLine: ${navigator.onLine}`);
        logBoot(`location: ${location.href}`);
        logBoot(`API_BASE: ${API_BASE}`);
        logBoot(`DB ready: ${dbReady ? 'yes' : 'no'}`);
        logBoot(`IndexedDB exists: ${!!window.indexedDB}`);
        logBoot(`crypto.subtle: ${!!crypto?.subtle}`);
        logBoot(`uid/login: ${state.uid || '—'} / ${state.login || '—'}`);
        logBoot(`ghToken set: ${!!state.ghToken}, ghRepo: ${state.ghRepo || '—'}`);
        logBoot(`ydToken set: ${!!state.yadiskToken}`);
        logBoot('→ getUid()...');
        try { const u = await withTimeout(getUid(), 9000, 'getUid'); logBoot(`getUid вернул: ${u || 'null'}`); }
        catch(e) { logErr(`getUid: ${e.message}`); }
        logBoot('→ dbInit()...');
        try { await withTimeout(dbInit(), 9000, 'dbInit'); logBoot('dbInit OK'); }
        catch(e) { logErr(`dbInit: ${e.message}`); }
        logBoot('→ dbGetAll()...');
        try { const all = await withTimeout(dbGetAll(STORE_DOWNLOADED), 11000, 'dbGetAll'); logBoot(`dbGetAll: ${all?.length || 0} записей`); }
        catch(e) { logErr(`dbGetAll: ${e.message}`); }
        if (state.yadiskToken) {
            logBoot('→ Yandex Disk /...');
            try {
                const r = await withTimeout(Yadisk.request('GET', `${YADISK_API}/`), 12000, 'yd/');
                logBoot(`Yandex Disk: HTTP ${r.status}`);
                if (r.status === 200) {
                    const base = await Yadisk.findBaseFolder();
                    const dl = await Yadisk.findDownloadsFolder(base);
                    logBoot(`Путь загрузки: /${base}/${dl}/<год>/`);
                }
            } catch(e) { logErr(`Yandex Disk: ${e.message}`); }
        }
        logBoot('=== END BOOT-ДИАГ ===');
        Sound.diag();
    });
    safeOn('ymdl-tsound', () => {
        logStep('🎼 Тест всех звуков');
        Sound.diag();
        setTimeout(() => Sound.start(), 300);
        setTimeout(() => Sound.trackDone(), 1000);
        setTimeout(() => Sound.cloud(), 1600);
        setTimeout(() => Sound.cloudDone(), 2200);
        setTimeout(() => Sound.local(), 2900);
        setTimeout(() => Sound.diskDone(), 3500);
        setTimeout(() => Sound.github(), 4100);
        setTimeout(() => Sound.warn(), 4600);
        setTimeout(() => Sound.stall(), 5000);
        setTimeout(() => Sound.error(), 5600);
        setTimeout(() => Sound.batchStart(), 6400);
        setTimeout(() => Sound.batchDone(), 7400);
        setTimeout(() => Sound.complete(), 8600);
    });
    safeOn('ymdl-td', async () => {
        readSettingsFromUI(); persistSettings();
        if (!state.yadiskToken) { logErr('Нет токена'); return; }
        logDisk('Проверяю Диск...');
        try {
            const r = await withTimeout(Yadisk.request('GET', `${YADISK_API}/`), 12000, 'yd/');
            if (r.status === 200) {
                const d = JSON.parse(r.responseText);
                logDisk(`✅ ${d.user?.display_name || d.user?.login || '?'} · ${fmtBytes(d.free_space)} free`);
                const base = await Yadisk.findBaseFolder();
                const downloads = await Yadisk.findDownloadsFolder(base);
                logDisk(`📂 Путь: /${base}/${downloads}/${new Date().getFullYear()}/`);
                Sound.cloudDone();
            } else logErr(`Диск HTTP ${r.status}`);
        } catch(e) { logErr(`Диск: ${e.message}`); }
    });
    safeOn('ymdl-tg', async () => {
        readSettingsFromUI(); persistSettings();
        const ok = await GhState.test();
        setBadge(ok ? 'ok' : 'err', ok ? '🐙 ✓' : '🐙 ✗');
        if (ok) Sound.github();
    });
    safeOn('ymdl-tr', async () => {
        readSettingsFromUI(); persistSettings();
        const ok = await GhState.testRepo();
        if (ok) Sound.github();
    });
    safeOn('ymdl-sync', async () => {
        readSettingsFromUI(); persistSettings();
        if (!state.ghToken || !state.ghRepo || !state.ghRepoPath) { logErr('Задай токен/репо/путь'); return; }
        setBadge('', '🐙 syncing');
        const ok = await GhState.save();
        setBadge(ok ? 'ok' : 'err', ok ? '🐙 ✓' : '🐙 ✗');
    });

    ['cb-txt', 'cb-artist', 'cb-disk', 'cb-local', 'cb-sync', 'cb-sound'].forEach(id => {
        safeChange(id, () => {
            readSettingsFromUI(); persistSettings(); applySettingsToUI();
            GhState.schedule();
            Sound.click();
        });
    });
    safeChange('ymdl-q', () => {
        const q = $('ymdl-q'); if (q) state.preferredQuality = q.value;
        saveLS(LS.preferredQuality, state.preferredQuality);
        logOk(`Качество: ${state.preferredQuality}`);
        updateStateInfo();
        Sound.click();
    });

    safeOn('ymdl-all', () => {
        if (state.phase === 'done') { state.phase = 'idle'; state.selected.clear(); const l = $('ymdl-list'); if (l) l.innerHTML = ''; }
        prepareList();
    });
    safeOn('ymdl-stop', () => { Sound.warn(); state.batchCancel = true; logWarn('⏹ Стоп...'); });
    safeOn('ymdl-sa', () => { state.allTracks.forEach((t, i) => state.selected.add(i)); renderList(state.allTracks); Sound.click(); });
    safeOn('ymdl-sn', () => { state.selected.clear(); renderList(state.allTracks); Sound.click(); });
    safeOn('ymdl-fn', () => {
        state.filterOnlyNew = !state.filterOnlyNew;
        safeAddClass('ymdl-fn', 'active', state.filterOnlyNew);
        renderList(state.allTracks);
        Sound.click();
    });
    safeOn('ymdl-loc', () => { Sound.click(); startBatch('local'); });
    safeOn('ymdl-dsk', () => { Sound.click(); startBatch('disk'); });
    safeOn('ymdl-bth', () => { Sound.click(); startBatch('both'); });

    // SPA navigation
    let _lastPath = location.pathname + location.search;
    setInterval(() => {
        const cur = location.pathname + location.search;
        if (cur !== _lastPath) {
            _lastPath = cur;
            if (state.phase !== 'downloading') {
                log(`📍 ${location.pathname}${location.search}`, 'rgba(255,255,255,0.4)');
                if (state.phase === 'list' || state.phase === 'done') {
                    state.phase = 'idle';
                    state.allTracks = [];
                    state.selected.clear();
                    const l = $('ymdl-list'); if (l) l.innerHTML = '';
                    const lp = $('ymdl-list-panel'); if (lp) lp.style.display = 'none';
                }
            }
        }
    }, 500);

    // ============================================================================
    // BOOT
    // ============================================================================
    logBoot(`Yandex Music Downloader v${VERSION}`);
    logBoot(`location.host = ${location.host}`);
    logBoot(`API_BASE = ${API_BASE}`);

    loadSettings();
    applySettingsToUI();

    const bootWatchdog = setTimeout(() => {
        const s = $('ymdl-stat')?.textContent || '';
        if (s.includes('Инициализация')) {
            logWarn('⏰ BOOT ЗАВИС на 25с! Жми ⚙️ → 🔧 Boot-диаг');
            setStatus('Boot завис — смотри лог', 'err');
        }
    }, 25000);

    (async () => {
        try {
            state.bootStep = 'sleep';
            await new Promise(r => setTimeout(r, 1000));

            state.bootStep = 'dbInit';
            logBoot('[boot] 1/4: IndexedDB...');
            try { await withTimeout(dbInit(), 10000, 'dbInit'); logOk('[boot] IndexedDB OK'); }
            catch(e) { logWarn(`[boot] IndexedDB: ${e.message}`); }

            state.bootStep = 'dbGetAll';
            logBoot('[boot] 2/4: чтение БД...');
            try {
                const all = await withTimeout(dbGetAll(STORE_DOWNLOADED), 11000, 'dbGetAll');
                state.downloadedIds.clear();
                state.downloadedMeta.clear();
                for (const rec of all) {
                    state.downloadedIds.add(String(rec.id));
                    state.downloadedMeta.set(String(rec.id), rec);
                }
                logOk(`[boot] ${all.length} скачанных`);
            } catch(e) { logWarn(`[boot] dbGetAll: ${e.message}`); }

            state.bootStep = 'getUid';
            logBoot('[boot] 3/4: getUid...');
            let uid = null;
            try { uid = await withTimeout(getUid(), 9000, 'getUid'); }
            catch(e) { logWarn(`[boot] getUid: ${e.message}`); }
            if (uid) {
                logOk(`[boot] Аккаунт: ${state.login} · uid ${uid}`);
                setStatus('Готов к загрузке', 'ok');
                Sound.diag();
            } else {
                logWarn('[boot] Не авторизован. Залогинься и F5.');
                setStatus('Требуется авторизация', 'warn');
            }

            state.bootStep = 'github';
            logBoot('[boot] 4/4: GitHub...');
            if (state.ghToken && state.ghRepo && state.ghRepoPath) {
                setBadge('', '🐙 testing');
                try {
                    const ok = await withTimeout(GhState.test(), 15000, 'ghTest');
                    if (ok) {
                        setBadge('', '🐙 loading');
                        const loaded = await withTimeout(GhState.load(), 15000, 'ghLoad');
                        setBadge(loaded ? 'ok' : 'err', loaded ? '🐙 ✓' : '🐙 ✗');
                        if (loaded) try { await withTimeout(GhState.save(), 15000, 'ghSave'); } catch(e) {}
                    } else setBadge('err', '🐙 ✗');
                } catch(e) { logWarn(`[boot] GitHub: ${e.message}`); setBadge('err', '🐙 ✗'); }
            } else if (state.ghToken) setBadge('', '🐙 no repo');
            else setBadge('', '🐙 no token');

            updateStateInfo();
            applyMin();

            state.bootStep = 'done';
            logBoot('[boot] готов ✅');
            const curStat = $('ymdl-stat')?.textContent || '';
            if (curStat.includes('Инициализация')) {
                setStatus(uid ? 'Готов к загрузке' : 'Требуется авторизация', uid ? 'ok' : 'warn');
            }
            clearTimeout(bootWatchdog);
        } catch(e) {
            logErr(`[boot] FATAL на шаге "${state.bootStep}": ${e.message}`);
            console.error('[YAMDL] boot fatal', e);
            setStatus(`Boot ошибка: ${state.bootStep}`, 'err');
            clearTimeout(bootWatchdog);
        }
    })();

    console.log(`%c✅ Yandex Music Downloader v${VERSION}`, 'color:#4ade80;font-weight:bold;font-size:14px;');
})();