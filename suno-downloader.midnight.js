/**
 * Suno Downloader v12.0 — Lyrics + Tags Export
 * ✅ TXT: текст песни + теги + метаданные (читаемый формат)
 * ✅ JSON: полное сырьё для программ
 * ✅ Multi-Account + IndexedDB + GitHub Sync (AES-GCM-256)
 * ✅ Minimize + Live progress + stall-abort + net-diag
 * ✅ Суффикс [01] в конце имени · галочка 📝 TXT+JSON
 */
(function sunoDownloaderV120() {
    'use strict';
    const VERSION = '12.0';
    const MAX_ATTEMPTS = 3;
    const STALL_THRESHOLD_MS = 5000;
    const HEARTBEAT_MS = 1000;
    const UI_THROTTLE_MS = 40;
    const LOG_PCT_STEP = 10;
    const FIRST_CHUNK_TIMEOUT = 30000;
    const GLOBAL_STALL_TIMEOUT = 25000;
    const DB_NAME = 'sunodl_db';
    const DB_VERSION = 2;
    const STORE_DOWNLOADED = 'downloaded';
    const STORE_ACCOUNTS = 'accounts';

    const SYNC_REPO = 'dimasik-debug/Share';
    const SYNC_PATH = 'suno/accounts.enc.json';
    const SYNC_TKEY = 'sunodl_github_token';
    const SYNC_PKEY = 'sunodl_pass_enc';
    const SYNC_SKEY = 'sunodl_sync_secrets';

    console.log(`%c🎵 Suno Downloader v${VERSION}`, 'color:#a994ff;font-size:16px;font-weight:bold;');

    const T0 = performance.now();
    const ts = () => `+${((performance.now() - T0) / 1000).toFixed(2)}s`;

    const SUNO = {
        bgPrimary:'#000', bgSecondary:'#0e0e10',
        border:'rgba(255,255,255,0.08)', textPrimary:'#fff',
        textSecondary:'rgba(255,255,255,0.6)', textTertiary:'rgba(255,255,255,0.4)',
        accent:'#a994ff', success:'#4ade80', danger:'#f87171', warning:'#fbbf24',
        font:"'PP Neue Montreal', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    };
    const CS = {
        accent:'color:#a994ff;font-weight:bold;', ok:'color:#4ade80;',
        err:'color:#f87171;', warn:'color:#fbbf24;', dim:'color:#8a9aaa;',
        ts:'color:#6a7a8a;font-style:italic;', net:'color:#7c5cff;', step:'color:#a994ff;font-weight:500;',
        stall:'color:#ff8c42;font-weight:bold;', hb:'color:#5a6a7a;', db:'color:#38bdf8;',
        sync:'color:#7c5cff;', txt:'color:#4ade80;'
    };

    const Sound = {
        ctx:null, enabled:true, masterGain:null,
        init() {
            if (this.ctx) return;
            try {
                this.ctx = new (window.AudioContext||window.webkitAudioContext)();
                this.masterGain = this.ctx.createGain();
                this.masterGain.gain.value = 0.35;
                this.masterGain.connect(this.ctx.destination);
            } catch(e){ this.enabled=false; }
        },
        note(f, d=0.35, v=0.15, delay=0, type='sine') {
            if (!this.enabled) return;
            this.init(); if (!this.ctx) return;
            try {
                if (this.ctx.state==='suspended') this.ctx.resume();
                const t = this.ctx.currentTime + delay;
                const o = this.ctx.createOscillator(), g = this.ctx.createGain(), fl = this.ctx.createBiquadFilter();
                fl.type='lowpass'; fl.frequency.value=3500; fl.Q.value=0.7;
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
        glide(a,b,d=0.3,v=0.12){
            if (!this.enabled) return;
            this.init(); if (!this.ctx) return;
            try {
                if (this.ctx.state==='suspended') this.ctx.resume();
                const t=this.ctx.currentTime;
                const o=this.ctx.createOscillator(), g=this.ctx.createGain();
                o.type='sine'; o.frequency.setValueAtTime(a,t);
                o.frequency.exponentialRampToValueAtTime(b,t+d);
                g.gain.setValueAtTime(0,t);
                g.gain.linearRampToValueAtTime(v,t+0.05);
                g.gain.exponentialRampToValueAtTime(0.0001,t+d);
                o.connect(g); g.connect(this.masterGain);
                o.start(t); o.stop(t+d+0.05);
            } catch(e){}
        },
        click(){ this.note(587,0.12,0.08,0,'sine'); },
        start(){ this.chord([349,440,523],0.5,0.10); },
        trackDone(){ this.note(784,0.3,0.12,0,'sine'); this.note(988,0.3,0.10,0.08,'sine'); this.note(1175,0.4,0.08,0.16,'sine'); },
        complete(){ this.chord([523,659,784,1047],0.8,0.10,'triangle'); this.glide(523,1047,0.6,0.06); },
        error(){ this.note(294,0.35,0.09,0,'sine'); this.note(247,0.5,0.07,0.15,'sine'); },
        save(){ this.note(1047,0.15,0.06,0,'triangle'); },
        stall(){ this.note(220,0.4,0.07,0,'sawtooth'); this.note(196,0.5,0.06,0.2,'sawtooth'); },
        txt(){ this.note(1319,0.1,0.05,0,'triangle'); }
    };

    const state = {
        activeJwt:null, activeAccountId:null,
        accounts:[],
        isBatch:false, batchCancel:false,
        batchTotal:0, batchDone:0, batchErrors:0, batchSkipped:0,
        allClips:[], selected:new Set(),
        downloadedIds:new Set(), downloadedMeta:new Map(),
        phase:'idle',
        batchBytesDone:0, batchStartTime:0,
        filterOnlyNew:false,
        minimized:false
    };

    const SAVE_TXT_KEY = 'sunodl_save_txt';
    const saveTxtEnabled = () => localStorage.getItem(SAVE_TXT_KEY) !== 'false';

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
                    const s = d.createObjectStore(STORE_DOWNLOADED, { keyPath: 'id' });
                    s.createIndex('title', 'title', { unique: false });
                    s.createIndex('downloadedAt', 'downloadedAt', { unique: false });
                }
                if (!d.objectStoreNames.contains(STORE_ACCOUNTS)) {
                    const s = d.createObjectStore(STORE_ACCOUNTS, { keyPath: 'id' });
                    s.createIndex('email', 'email', { unique: false });
                }
            };
        });
    }
    function dbTx(store, mode, fn) {
        return new Promise(async (resolve, reject) => {
            if (!db) await dbInit();
            const tx = db.transaction(store, mode);
            const s = tx.objectStore(store);
            const req = fn(s);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    const dbGetAll = (store) => dbTx(store, 'readonly', s => s.getAll());
    const dbAdd = (store, rec) => dbTx(store, 'readwrite', s => s.put(rec));
    const dbClear = (store) => dbTx(store, 'readwrite', s => s.clear());
    const dbRemove = (store, id) => dbTx(store, 'readwrite', s => s.delete(id));

    const DEVICE_ID = (() => {
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k.includes('device-id') || k.includes('deviceId')) {
                    const v = localStorage.getItem(k);
                    if (v && v.length > 20) return v.replace(/"/g, '');
                }
            }
        } catch(e){}
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random()*16|0, v = c=='x' ? r : (r&0x3|0x8);
            return v.toString(16);
        });
    })();
    function makeBrowserToken() {
        const payload = JSON.stringify({ timestamp: Date.now() });
        return JSON.stringify({ token: btoa(payload) });
    }
    function b64(b) {
        const bin = atob(b); const u = new Uint8Array(bin.length);
        for (let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
        return u;
    }

    function fmtBytes(b) {
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
        const sec = (Date.now() - tsMs) / 1000;
        if (sec < 60) return 'только что';
        if (sec < 3600) return Math.floor(sec/60) + ' мин назад';
        if (sec < 86400) return Math.floor(sec/3600) + ' ч назад';
        return Math.floor(sec/86400) + ' дн назад';
    }
    function parseJwt(token) {
        try {
            const p = token.split('.')[1];
            return JSON.parse(atob(p.replace(/-/g,'+').replace(/_/g,'/')));
        } catch(e) { return null; }
    }
    function sanitizeName(n) {
        return (n||'suno_track').replace(/[\\/:*?"<>|]/g,'_').replace(/[\x00-\x1f]/g,'').replace(/\s+/g,' ').trim().slice(0,80)||'suno_track';
    }

    function collectCookies() {
        const out = {};
        try {
            document.cookie.split(';').forEach(pair => {
                const [k, ...v] = pair.trim().split('=');
                if (k) out[k] = decodeURIComponent(v.join('='));
            });
        } catch(e){}
        return out;
    }
    function collectSunoLocalStorage() {
        const out = {};
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (!k) continue;
                if (/suno|clerk|auth|session|device|browser-token|user/i.test(k)) {
                    const v = localStorage.getItem(k);
                    if (v && v.length < 100000) out[k] = v;
                }
            }
        } catch(e){}
        return out;
    }
    function collectSunoSessionStorage() {
        const out = {};
        try {
            for (let i = 0; i < sessionStorage.length; i++) {
                const k = sessionStorage.key(i);
                if (!k) continue;
                const v = sessionStorage.getItem(k);
                if (v && v.length < 50000) out[k] = v;
            }
        } catch(e){}
        return out;
    }

    async function getClerkJwt(force=false) {
        try {
            if (window.Clerk?.session?.getToken) {
                const t = await window.Clerk.session.getToken({skipCache:force});
                if (t && typeof t==='string' && t.length>50) return t;
            }
        } catch(e){}
        try {
            const m = document.cookie.match(/(?:^|;\s*)__session=([^;]+)/);
            if (m) {
                const v = decodeURIComponent(m[1]);
                if (v.length>100 && v.split('.').length===3) return v;
            }
        } catch(e){}
        return null;
    }

    async function captureCurrentAccount() {
        logStep('📸 Захват текущего аккаунта...');
        const jwt = await getClerkJwt(true);
        if (!jwt) { logErr('JWT не получен'); return null; }
        const payload = parseJwt(jwt);
        if (!payload) { logErr('JWT повреждён'); return null; }

        const userId = payload['suno.com/claims/user_id'] || payload.sub;
        const email = payload['suno.com/claims/email'] || payload['https://suno.ai/claims/email'] || '—';
        const handle = payload['suno/handle'] || '—';
        const sunoUserId = payload['suno/user_id'] || userId;
        const clerkId = payload['https://suno.ai/claims/clerk_id'] || '—';
        const sessionId = payload.sid || '—';

        let avatar = null;
        try {
            const img = document.querySelector('img[src*="cdn1.suno.ai"], img[alt*="avatar"]');
            if (img && img.src) avatar = img.src;
        } catch(e){}

        const cookies = collectCookies();
        const localStorageSuno = collectSunoLocalStorage();
        const sessionStorageSuno = collectSunoSessionStorage();

        const rec = {
            id: userId, userId, sunoUserId, clerkId,
            email, handle, avatar, jwt, sessionId,
            deviceId: DEVICE_ID, browserToken: makeBrowserToken(),
            cookies, localStorage: localStorageSuno, sessionStorage: sessionStorageSuno,
            jwtExp: payload.exp || 0, jwtIat: payload.iat || 0,
            savedAt: Date.now(), lastSeenAt: Date.now(),
            cookiesCount: Object.keys(cookies).length,
            localStorageCount: Object.keys(localStorageSuno).length
        };

        await dbAdd(STORE_ACCOUNTS, rec);
        const idx = state.accounts.findIndex(a => a.id === userId);
        if (idx >= 0) state.accounts[idx] = rec;
        else state.accounts.push(rec);

        state.activeAccountId = userId;
        state.activeJwt = jwt;

        logDb(`✅ аккаунт сохранён`);
        log(`  📧 ${email}`, SUNO.textSecondary, CS.dim);
        log(`  👤 ${handle} · id ${userId.slice(0,8)}…`, SUNO.textTertiary, CS.dim);
        log(`  🔑 JWT ${jwt.length} симв · exp ${new Date(payload.exp*1000).toLocaleString()}`, SUNO.textTertiary, CS.dim);
        log(`  🍪 cookies: ${Object.keys(cookies).length} · LS: ${Object.keys(localStorageSuno).length}`, SUNO.textTertiary, CS.dim);

        renderAccountSelect();
        return rec;
    }

    async function switchAccount(userId) {
        const acc = state.accounts.find(a => a.id === userId);
        if (!acc) return;
        state.activeAccountId = userId;
        state.activeJwt = acc.jwt;
        const now = Math.floor(Date.now()/1000);
        if (acc.jwtExp && acc.jwtExp < now) {
            const mins = Math.round((now - acc.jwtExp)/60);
            logWarn(`⚠ JWT просрочен ${mins} мин назад`);
            setStatus(`JWT просрочен · зайди под ${acc.handle}`, 'warn');
        } else {
            const mins = Math.round((acc.jwtExp - now)/60);
            logDb(`активный: ${acc.email} (${acc.handle}) · JWT ещё ${mins} мин`);
            setStatus(`Аккаунт: ${acc.handle}`, 'ok');
        }
        state.allClips = [];
        state.selected.clear();
        listEl.innerHTML = '';
        listPanel.style.display = 'none';
        batchEl.style.display = 'none';
        currentEl.style.display = 'none';
        $('sunodl-all').innerHTML = '<span style="font-size:15px;">⬇</span> Загрузить список';
        $('sunodl-all').disabled = false;
        state.phase = 'idle';
    }

    async function removeAccount(userId) {
        const acc = state.accounts.find(a => a.id === userId);
        if (!acc) return;
        if (!confirm(`Удалить аккаунт ${acc.email}?`)) return;
        await dbRemove(STORE_ACCOUNTS, userId);
        state.accounts = state.accounts.filter(a => a.id !== userId);
        if (state.activeAccountId === userId) {
            state.activeJwt = null;
            state.activeAccountId = null;
            if (state.accounts[0]) await switchAccount(state.accounts[0].id);
        }
        renderAccountSelect();
        logDb(`аккаунт ${acc.email} удалён`);
    }

    function renderAccountSelect() {
        const sel = $('sunodl-account-select');
        if (!sel) return;
        sel.innerHTML = '';
        if (state.accounts.length === 0) {
            const opt = document.createElement('option');
            opt.value = ''; opt.textContent = '— нет аккаунтов —';
            sel.appendChild(opt);
        } else {
            for (const a of state.accounts) {
                const opt = document.createElement('option');
                opt.value = a.id;
                const now = Math.floor(Date.now()/1000);
                const expired = a.jwtExp && a.jwtExp < now;
                opt.textContent = `${a.handle} · ${a.email.length>22 ? a.email.slice(0,19)+'…' : a.email}${expired?' ⚠':''}`;
                if (a.id === state.activeAccountId) opt.selected = true;
                sel.appendChild(opt);
            }
        }
        $('sunodl-acc-count').textContent = state.accounts.length;
    }

    async function timedFetch(url, opts={}, timeoutMs=300000, label='fetch') {
        const c = new AbortController();
        const t = setTimeout(()=>c.abort(), timeoutMs);
        const tStart = performance.now();
        try {
            const r = await fetch(url,{...opts, signal:c.signal});
            clearTimeout(t);
            return r;
        } catch(e){
            clearTimeout(t);
            const ms = (performance.now()-tStart).toFixed(0);
            if (e.name==='AbortError') throw new Error(`⏱ TIMEOUT ${timeoutMs}ms (${label}, шло ${ms}ms)`);
            if (!navigator.onLine) throw new Error(`📡 OFFLINE (${label}, ${ms}ms): ${e.message}`);
            throw new Error(`🌐 NETWORK (${label}, ${ms}ms): ${e.name} — ${e.message}`);
        }
    }

    function saveMinimized() {
        try { localStorage.setItem('sunodl_minimized', state.minimized ? '1' : '0'); } catch(e){}
    }
    function loadMinimized() {
        try { return localStorage.getItem('sunodl_minimized') === '1'; } catch(e){ return false; }
    }
    function applyMinimized() {
        const box = $('sunodl');
        const mini = $('sunodl-mini');
        if (!box || !mini) return;
        if (state.minimized) { box.style.display = 'none'; mini.style.display = 'flex'; }
        else { box.style.display = 'flex'; mini.style.display = 'none'; }
        saveMinimized();
    }

    document.body.insertAdjacentHTML('beforeend', `
        <link rel="preload" href="https://suno.com/static-p/PPNeueMontreal-Regular.7a832673.woff" as="font" type="font/woff" crossorigin>
        <style>
            @font-face{font-family:'PP Neue Montreal';src:url('https://suno.com/static-p/PPNeueMontreal-Regular.7a832673.woff') format('woff');font-weight:400;font-display:swap;}
            @font-face{font-family:'PP Neue Montreal';src:url('https://suno.com/static-p/PPNeueMontreal-Medium.8b97a885.woff') format('woff');font-weight:500;font-display:swap;}
            #sunodl{animation:sunodl-in 0.4s cubic-bezier(0.16,1,0.3,1);}
            @keyframes sunodl-in{from{opacity:0;transform:translateY(20px) scale(0.96);}to{opacity:1;transform:translateY(0) scale(1);}}
            #sunodl-mini{animation:sunodl-mini-in 0.3s ease-out;position:fixed;bottom:16px;right:16px;z-index:99999;background:#000;border:1px solid rgba(255,255,255,0.08);border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,0.7);display:none;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;transition:all 0.2s;font-family:'PP Neue Montreal',sans-serif;}
            #sunodl-mini:hover{box-shadow:0 16px 48px rgba(124,92,255,0.4);transform:translateY(-1px);}
            @keyframes sunodl-mini-in{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
            .sunodl-btn{padding:10px 16px;border-radius:999px;font-family:'PP Neue Montreal',sans-serif;font-size:13px;font-weight:500;border:1px solid transparent;cursor:pointer;transition:all 0.2s;display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;}
            .sunodl-btn-accent{background:linear-gradient(135deg,#a994ff,#7c5cff);color:#fff;box-shadow:0 4px 20px rgba(124,92,255,0.35);}
            .sunodl-btn-accent:hover{box-shadow:0 6px 24px rgba(124,92,255,0.5);transform:translateY(-1px);}
            .sunodl-btn-accent:disabled{opacity:0.4;cursor:not-allowed;transform:none;}
            .sunodl-btn-danger{background:rgba(248,113,113,0.15);color:#f87171;border:1px solid rgba(248,113,113,0.2);}
            .sunodl-btn-ghost{background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.08);}
            .sunodl-btn-ghost:hover{background:rgba(255,255,255,0.1);color:#fff;}
            .sunodl-btn-ghost:disabled{opacity:0.3;cursor:not-allowed;}
            .sunodl-btn-ghost.active{background:rgba(169,148,255,0.15);color:#a994ff;border-color:rgba(169,148,255,0.3);}
            .sunodl-icon-btn{width:32px;height:32px;padding:0;border-radius:10px;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.6);border:none;cursor:pointer;transition:all 0.2s;display:inline-flex;align-items:center;justify-content:center;font-size:14px;}
            .sunodl-icon-btn:hover{background:rgba(255,255,255,0.1);color:#fff;}
            #sunodl-log::-webkit-scrollbar{width:6px;}
            #sunodl-log::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px;}
            #sunodl-list::-webkit-scrollbar{width:6px;}
            #sunodl-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px;}
            .sunodl-pulse{animation:sunodl-pulse 2s ease-in-out infinite;}
            @keyframes sunodl-pulse{0%,100%{opacity:1;}50%{opacity:0.5;}}
            .sunodl-progress-bar{width:100%;height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;}
            .sunodl-progress-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,#a994ff,#7c5cff);transition:width 0.15s ease;}
            .sunodl-progress-fill.done{background:linear-gradient(90deg,#4ade80,#22c55e);}
            .sunodl-progress-fill.error{background:linear-gradient(90deg,#f87171,#dc2626);}
            .sunodl-progress-fill.license{background:linear-gradient(90deg,#fbbf24,#f59e0b);}
            .sunodl-progress-fill.stall{background:linear-gradient(90deg,#ff8c42,#ff5722);animation:sunodl-pulse 1s infinite;}
            .sunodl-track-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;transition:background 0.15s;border:1px solid transparent;}
            .sunodl-track-row:hover{background:rgba(255,255,255,0.04);}
            .sunodl-track-row.selected{background:rgba(169,148,255,0.08);border-color:rgba(169,148,255,0.2);}
            .sunodl-track-row.bad{opacity:0.4;}
            .sunodl-track-row.downloaded{background:rgba(74,222,128,0.06);border-color:rgba(74,222,128,0.15);}
            .sunodl-track-row.downloaded.selected{background:rgba(169,148,255,0.12);border-color:rgba(169,148,255,0.35);}
            .sunodl-checkbox{width:16px;height:16px;border-radius:4px;border:1.5px solid rgba(255,255,255,0.25);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;transition:all 0.15s;background:transparent;}
            .sunodl-checkbox.checked{background:linear-gradient(135deg,#a994ff,#7c5cff);border-color:transparent;}
            .sunodl-checkbox.downloaded-checked{background:linear-gradient(135deg,#4ade80,#22c55e);border-color:transparent;}
            .sunodl-track-idx{font-size:10px;color:rgba(255,255,255,0.3);font-family:'SF Mono',monospace;width:24px;flex-shrink:0;}
            .sunodl-track-title{font-size:12px;color:rgba(255,255,255,0.85);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
            .sunodl-track-row.downloaded .sunodl-track-title{color:rgba(74,222,128,0.9);}
            .sunodl-track-meta{font-size:9px;color:rgba(255,255,255,0.35);font-family:'SF Mono',monospace;flex-shrink:0;margin-right:4px;}
            .sunodl-track-badge{font-size:9px;padding:2px 6px;border-radius:4px;background:rgba(74,222,128,0.15);color:#4ade80;flex-shrink:0;font-family:'SF Mono',monospace;min-width:56px;text-align:center;}
            .sunodl-track-badge.bad{background:rgba(248,113,113,0.15);color:#f87171;}
            .sunodl-track-badge.warn{background:rgba(251,191,36,0.15);color:#fbbf24;}
            .sunodl-track-badge.downloaded{background:rgba(74,222,128,0.25);color:#4ade80;}
            .sunodl-track-badge.new{background:rgba(169,148,255,0.2);color:#a994ff;}
            .sunodl-stat-line{font-family:'SF Mono',Consolas,monospace;font-size:10px;color:rgba(255,255,255,0.5);letter-spacing:0.1px;}
            .sunodl-db-summary{display:flex;gap:12px;align-items:center;font-size:11px;font-family:'SF Mono',monospace;padding:8px 10px;background:rgba(56,189,248,0.06);border:1px solid rgba(56,189,248,0.15);border-radius:8px;margin-bottom:10px;}
            .sunodl-db-summary .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
            .sunodl-account-bar{display:flex;gap:8px;align-items:center;padding:8px 10px;background:rgba(56,189,248,0.06);border:1px solid rgba(56,189,248,0.15);border-radius:8px;margin-bottom:10px;}
            .sunodl-account-bar select{flex:1;background:rgba(0,0,0,0.4);color:#fff;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:6px 8px;font-size:11px;font-family:'SF Mono',monospace;outline:none;cursor:pointer;min-width:0;}
            .sunodl-account-bar select:focus{border-color:#38bdf8;}
        </style>

        <div id="sunodl-mini" title="Развернуть Suno Downloader">
            <div style="width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#a994ff,#7c5cff);display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 4px 12px rgba(124,92,255,0.4);">🎵</div>
            <div style="display:flex;flex-direction:column;line-height:1.2;">
                <div style="font-size:11px;color:#fff;font-weight:500;">Suno Downloader</div>
                <div id="sunodl-mini-status" style="font-size:9px;color:rgba(255,255,255,0.5);font-family:'SF Mono',monospace;">готов</div>
            </div>
            <div id="sunodl-mini-badge" style="display:none;background:#4ade80;color:#000;font-size:9px;font-weight:bold;padding:2px 6px;border-radius:8px;font-family:'SF Mono',monospace;">0</div>
            <div style="font-size:14px;color:rgba(255,255,255,0.4);">▲</div>
        </div>

        <div id="sunodl" style="position:fixed;bottom:16px;right:16px;z-index:99999;background:${SUNO.bgPrimary};color:${SUNO.textPrimary};font-family:${SUNO.font};width:620px;max-width:calc(100vw - 32px);border-radius:20px;border:1px solid ${SUNO.border};box-shadow:0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.02) inset;overflow:hidden;display:flex;flex-direction:column;max-height:calc(100vh - 32px);">
            <div style="display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid ${SUNO.border};flex-shrink:0;">
                <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,${SUNO.accent},#7c5cff);display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 16px rgba(124,92,255,0.3);">🎵</div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:500;font-size:15px;letter-spacing:-0.2px;">Suno Downloader</div>
                    <div style="font-size:11px;color:${SUNO.textTertiary};letter-spacing:0.3px;margin-top:1px;">v${VERSION} · Lyrics · Sync</div>
                </div>
                <button id="sunodl-sound" class="sunodl-icon-btn" title="Звук">🔊</button>
                <button id="sunodl-clear" class="sunodl-icon-btn" title="Очистить лог">🗑</button>
                <button id="sunodl-minimize" class="sunodl-icon-btn" title="Свернуть">—</button>
                <button id="sunodl-close" class="sunodl-icon-btn" title="Закрыть">✕</button>
            </div>

            <div id="sunodl-status" style="padding:14px 18px;border-bottom:1px solid ${SUNO.border};display:flex;align-items:center;gap:10px;flex-shrink:0;">
                <div id="sunodl-status-dot" class="sunodl-pulse" style="width:8px;height:8px;border-radius:50%;background:${SUNO.accent};flex-shrink:0;"></div>
                <div id="sunodl-status-text" style="font-size:13px;color:${SUNO.textSecondary};">Инициализация...</div>
            </div>

            <div id="sunodl-list-panel" style="display:none;padding:14px 18px;border-bottom:1px solid ${SUNO.border};flex-shrink:0;">
                <div class="sunodl-account-bar">
                    <div style="width:8px;height:8px;border-radius:50%;background:#38bdf8;flex-shrink:0;"></div>
                    <div style="font-size:11px;color:#38bdf8;font-family:'SF Mono',monospace;font-weight:500;flex-shrink:0;">АККАУНТ</div>
                    <select id="sunodl-account-select"></select>
                    <button id="sunodl-acc-add" class="sunodl-btn sunodl-btn-ghost" style="padding:4px 10px;font-size:10px;" title="Добавить текущий аккаунт">+ добавить</button>
                    <button id="sunodl-acc-del" class="sunodl-btn sunodl-btn-ghost" style="padding:4px 10px;font-size:10px;" title="Удалить выбранный">🗑</button>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:10px;color:rgba(255,255,255,0.35);font-family:'SF Mono',monospace;margin-bottom:8px;padding:0 4px;">
                    <span>Аккаунтов: <span id="sunodl-acc-count">0</span></span>
                    <span>💡 Переключи → "Загрузить список"</span>
                </div>

                <div class="sunodl-account-bar" style="margin-top:0;background:rgba(124,92,255,0.06);border-color:rgba(124,92,255,0.15);">
                    <div style="width:8px;height:8px;border-radius:50%;background:#7c5cff;flex-shrink:0;"></div>
                    <div style="font-size:11px;color:#7c5cff;font-family:'SF Mono',monospace;font-weight:500;flex-shrink:0;">SYNC</div>
                    <span id="sunodl-sync-status" style="flex:1;font-size:10px;color:rgba(255,255,255,0.4);font-family:'SF Mono',monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">— не настроено —</span>
                    <button id="sunodl-sync-token" class="sunodl-btn sunodl-btn-ghost" style="padding:4px 8px;font-size:10px;" title="GitHub Personal Access Token">🔑</button>
                    <button id="sunodl-sync-pass" class="sunodl-btn sunodl-btn-ghost" style="padding:4px 8px;font-size:10px;" title="Пароль шифрования">🔒</button>
                    <button id="sunodl-sync-push" class="sunodl-btn sunodl-btn-ghost" style="padding:4px 8px;font-size:10px;" disabled title="Загрузить на GitHub">⬆</button>
                    <button id="sunodl-sync-pull" class="sunodl-btn sunodl-btn-ghost" style="padding:4px 8px;font-size:10px;" disabled title="Загрузить с GitHub">⬇</button>
                </div>

                <div id="sunodl-db-summary" class="sunodl-db-summary" style="display:none;">
                    <div class="dot" style="background:#38bdf8;"></div>
                    <div style="flex:1;">
                        <span style="color:#38bdf8;font-weight:500;">IndexedDB</span> · <span id="sunodl-db-count">0</span> скачано
                    </div>
                    <button id="sunodl-db-clear" class="sunodl-btn sunodl-btn-ghost" style="padding:4px 10px;font-size:10px;">🗑 база</button>
                </div>

                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px;">
                    <div style="font-size:12px;color:${SUNO.textSecondary};letter-spacing:0.2px;">ВЫБЕРИ ТРЕКИ</div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        <button id="sunodl-filter-new" class="sunodl-btn sunodl-btn-ghost" style="padding:5px 10px;font-size:11px;">Только новые</button>
                        <button id="sunodl-save-txt" class="sunodl-btn sunodl-btn-ghost" style="padding:5px 10px;font-size:11px;" title="Сохранять текст и теги рядом с аудио">📝 TXT+JSON</button>
                        <button id="sunodl-sel-all" class="sunodl-btn sunodl-btn-ghost" style="padding:5px 10px;font-size:11px;">Все</button>
                        <button id="sunodl-sel-none" class="sunodl-btn sunodl-btn-ghost" style="padding:5px 10px;font-size:11px;">Ничего</button>
                    </div>
                </div>
                <div id="sunodl-list" style="max-height:300px;overflow-y:auto;background:${SUNO.bgSecondary};border-radius:10px;padding:6px;border:1px solid ${SUNO.border};"></div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
                    <div id="sunodl-list-info" style="font-size:11px;color:${SUNO.textTertiary};">—</div>
                    <button id="sunodl-start-batch" class="sunodl-btn sunodl-btn-accent" style="padding:9px 18px;">▶ Старт</button>
                </div>
            </div>

            <div id="sunodl-batch" style="display:none;padding:14px 18px;border-bottom:1px solid ${SUNO.border};flex-shrink:0;">
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
                    <div style="font-size:12px;color:${SUNO.textSecondary};letter-spacing:0.2px;">ОБЩИЙ ПРОГРЕСС</div>
                    <div style="display:flex;align-items:baseline;gap:6px;">
                        <span id="sunodl-batch-done" style="font-size:20px;font-weight:500;color:${SUNO.textPrimary};">0</span>
                        <span style="font-size:13px;color:${SUNO.textTertiary};">/ <span id="sunodl-batch-total">0</span></span>
                    </div>
                </div>
                <div class="sunodl-progress-bar" style="margin-bottom:8px;">
                    <div id="sunodl-batch-bar" class="sunodl-progress-fill done" style="width:0%;"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:10px;color:${SUNO.textTertiary};font-family:'SF Mono',monospace;margin-bottom:4px;">
                    <span id="sunodl-batch-ok">✓ 0 OK</span>
                    <span id="sunodl-batch-skip">⏭ 0 skip</span>
                    <span id="sunodl-batch-bytes">📦 0 MB</span>
                    <span id="sunodl-batch-err">✕ 0 errors</span>
                </div>
                <div class="sunodl-stat-line" id="sunodl-batch-eta">⏱ ETA — · avg — MB/s · elapsed 0s</div>
            </div>

            <div id="sunodl-current" style="display:none;padding:14px 18px;border-bottom:1px solid ${SUNO.border};flex-shrink:0;">
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;gap:10px;">
                    <div id="sunodl-current-title" style="font-size:13px;color:${SUNO.textPrimary};font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;">—</div>
                    <div id="sunodl-current-pct" style="font-size:16px;color:${SUNO.accent};font-weight:500;font-family:'SF Mono',monospace;flex-shrink:0;">0%</div>
                </div>
                <div class="sunodl-progress-bar" style="margin-bottom:10px;"><div id="sunodl-current-bar" class="sunodl-progress-fill" style="width:0%;"></div></div>
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;gap:10px;">
                    <div id="sunodl-current-stage" style="font-size:12px;color:${SUNO.textPrimary};font-family:'SF Mono',monospace;font-weight:500;">—</div>
                    <div id="sunodl-current-count" style="font-size:11px;color:${SUNO.textTertiary};font-family:'SF Mono',monospace;flex-shrink:0;">0/0</div>
                </div>
                <div class="sunodl-stat-line" id="sunodl-current-net">net: —</div>
                <div class="sunodl-stat-line" id="sunodl-current-eta" style="margin-top:2px;color:rgba(255,255,255,0.35);">eta: —</div>
            </div>

            <div style="padding:14px 18px;border-bottom:1px solid ${SUNO.border};flex-shrink:0;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="font-size:11px;color:${SUNO.textTertiary};letter-spacing:0.3px;font-weight:500;">DIAG LOG</span>
                    <span style="font-size:10px;color:${SUNO.textTertiary};">live · console too</span>
                </div>
                <div id="sunodl-log" style="font-size:11px;color:${SUNO.textSecondary};background:${SUNO.bgSecondary};padding:12px 14px;border-radius:12px;max-height:240px;overflow-y:auto;font-family:'SF Mono',Consolas,'Courier New',monospace;line-height:1.6;border:1px solid ${SUNO.border};"></div>
            </div>

            <div style="display:flex;gap:8px;padding:16px 18px;flex-shrink:0;">
                <button id="sunodl-all" class="sunodl-btn sunodl-btn-accent" style="flex:1;padding:12px;"><span style="font-size:15px;">⬇</span> Загрузить список</button>
                <button id="sunodl-stop" class="sunodl-btn sunodl-btn-danger" style="display:none;">⏹ Стоп</button>
            </div>

            <div style="padding:0 18px 14px;display:flex;justify-content:space-between;font-size:10px;color:${SUNO.textTertiary};letter-spacing:0.2px;flex-shrink:0;">
                <span id="sunodl-net-status">🌐 online</span>
                <span id="sunodl-timer">+0.00s</span>
            </div>
        </div>
    `);

    const $ = id => document.getElementById(id);
    const logEl = $('sunodl-log');
    const statusDot = $('sunodl-status-dot');
    const statusText = $('sunodl-status-text');
    const batchEl = $('sunodl-batch');
    const currentEl = $('sunodl-current');
    const timerEl = $('sunodl-timer');
    const netStatusEl = $('sunodl-net-status');
    const listPanel = $('sunodl-list-panel');
    const listEl = $('sunodl-list');
    const listInfo = $('sunodl-list-info');
    const dbSummary = $('sunodl-db-summary');
    const miniStatus = $('sunodl-mini-status');
    const miniBadge = $('sunodl-mini-badge');

    setInterval(()=>{ timerEl.textContent = ts(); }, 100);
    setInterval(()=>{
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
    const logNet = t => log('🌐 '+t, '#8a7cff', CS.net);
    const logStall = t => log('🐌 '+t, '#ff8c42', CS.stall);
    const logHb = t => log('· '+t, '#5a6a7a', CS.hb);
    const logDb = t => log('💾 '+t, '#38bdf8', CS.db);
    const logSync = t => log('☁ '+t, '#7c5cff', CS.sync);
    const logTxt = t => log('📝 '+t, '#4ade80', CS.txt);

    function setStatus(text, kind='idle') {
        statusText.textContent = text;
        const c = {idle:SUNO.accent, ok:SUNO.success, err:SUNO.danger, warn:SUNO.warning, stall:'#ff8c42', sync:'#7c5cff'};
        statusDot.style.background = c[kind] || SUNO.accent;
        statusDot.classList.toggle('sunodl-pulse', kind==='idle');
        if (miniStatus) miniStatus.textContent = text;
    }

    function updateBatchProgress() {
        batchEl.style.display = 'block';
        const { batchDone, batchTotal, batchErrors, batchSkipped, batchBytesDone, batchStartTime } = state;
        $('sunodl-batch-done').textContent = batchDone;
        $('sunodl-batch-total').textContent = batchTotal;
        $('sunodl-batch-bar').style.width = batchTotal > 0 ? `${Math.round(batchDone/batchTotal*100)}%` : '0%';
        $('sunodl-batch-ok').textContent = `✓ ${batchDone} OK`;
        $('sunodl-batch-skip').textContent = `⏭ ${batchSkipped} skip`;
        $('sunodl-batch-err').textContent = `✕ ${batchErrors} errors`;
        $('sunodl-batch-bytes').textContent = `📦 ${fmtBytes(batchBytesDone)}`;
        const elapsed = (performance.now() - batchStartTime) / 1000;
        const avgSpeed = elapsed > 0 ? (batchBytesDone/1048576/elapsed) : 0;
        const remaining = batchTotal - batchDone;
        const perTrack = batchDone > 0 ? elapsed/batchDone : 0;
        const etaSec = remaining * perTrack;
        $('sunodl-batch-eta').textContent = `⏱ ETA ${fmtEta(etaSec)} · avg ${fmtSpeed(avgSpeed)} · elapsed ${fmtEta(elapsed)}`;
        if (batchDone > 0 && state.isBatch) {
            miniBadge.style.display = 'block';
            miniBadge.textContent = `${batchDone}/${batchTotal}`;
        } else {
            miniBadge.style.display = 'none';
        }
    }

    function setCurrent(title, done, total, stage, pct, state_, netInfo, etaInfo) {
        currentEl.style.display = 'block';
        $('sunodl-current-title').textContent = title;
        $('sunodl-current-count').textContent = `${done}/${total}`;
        $('sunodl-current-stage').textContent = stage;
        $('sunodl-current-pct').textContent = Math.round(pct) + '%';
        if (netInfo !== undefined) $('sunodl-current-net').textContent = 'net: ' + netInfo;
        if (etaInfo !== undefined) $('sunodl-current-eta').textContent = 'eta: ' + etaInfo;
        const bar = $('sunodl-current-bar');
        bar.style.width = pct+'%';
        bar.className = 'sunodl-progress-fill' + (state_ === 'error' ? ' error' : state_ === 'done' ? ' done' : state_ === 'license' ? ' license' : state_ === 'stall' ? ' stall' : '');
    }

    // ===== LIST =====
    function renderList(clips) {
        listEl.innerHTML = '';
        const visible = clips.map((c, i) => ({c, i})).filter(({c}) => {
            if (!state.filterOnlyNew) return true;
            return !state.downloadedIds.has(c.id);
        });
        visible.forEach(({c, i}) => {
            const isFull = c?.media_urls?.[0]?.url?.includes('cloudfront');
            const isPreview = c.type === 'preview' || !!c.preview_seconds;
            const isDownloaded = state.downloadedIds.has(c.id);
            const canDownload = isFull && !isPreview;
            const row = document.createElement('div');
            row.className = 'sunodl-track-row' + (!canDownload ? ' bad' : '') + (isDownloaded ? ' downloaded' : '');
            row.dataset.idx = i;
            const checked = state.selected.has(i);
            if (checked) row.classList.add('selected');
            let badgeText = 'FULL', badgeClass = '';
            if (isPreview) { badgeText = 'PREVIEW'; badgeClass = 'bad'; }
            else if (!isFull) { badgeText = 'PART'; badgeClass = 'bad'; }
            else if (isDownloaded) { badgeText = '✓ ЕСТЬ'; badgeClass = 'downloaded'; }
            else { badgeText = 'NEW'; badgeClass = 'new'; }
            let metaHtml = '';
            if (isDownloaded) {
                const rec = state.downloadedMeta.get(c.id);
                if (rec) {
                    const sizeStr = rec.size ? fmtBytes(rec.size) : '';
                    const agoStr = rec.downloadedAt ? fmtAgo(rec.downloadedAt) : '';
                    metaHtml = `<div class="sunodl-track-meta">${sizeStr}${sizeStr&&agoStr?' · ':''}${agoStr}</div>`;
                }
            }
            const hasLyrics = !!(c.metadata?.prompt && c.metadata.prompt.trim());
            const lyricsBadge = hasLyrics ? '<span style="font-size:9px;color:#4ade80;font-family:\'SF Mono\',monospace;flex-shrink:0;margin-right:4px;" title="Есть текст песни">📝</span>' : '';
            row.innerHTML = `
                <div class="sunodl-checkbox ${checked?(isDownloaded?'downloaded-checked':'checked'):''}">${checked?'✓':''}</div>
                <div class="sunodl-track-idx">${String(i+1).padStart(2,'0')}</div>
                <div class="sunodl-track-title" title="${(c.title||'—').replace(/"/g,'&quot;')}">${c.title||'—'}${isPreview?' · 60s':''}</div>
                ${lyricsBadge}
                ${metaHtml}
                <div class="sunodl-track-badge ${badgeClass}">${badgeText}</div>
            `;
            row.onclick = () => {
                if (!canDownload) { logWarn(isPreview ? 'Preview — только 60s' : 'Неполный трек'); Sound.error(); return; }
                if (state.selected.has(i)) state.selected.delete(i); else state.selected.add(i);
                Sound.click();
                row.classList.toggle('selected');
                const cb = row.querySelector('.sunodl-checkbox');
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
        const { allClips, downloadedIds } = state;
        const full = allClips.filter(c => {
            const isFull = c?.media_urls?.[0]?.url?.includes('cloudfront');
            const isPreview = c.type === 'preview' || !!c.preview_seconds;
            return isFull && !isPreview;
        }).length;
        const downloadedCount = allClips.filter(c => downloadedIds.has(c.id)).length;
        const newCount = full - allClips.filter(c => downloadedIds.has(c.id) && c?.media_urls?.[0]?.url?.includes('cloudfront') && !(c.type==='preview'||c.preview_seconds)).length;
        const withLyrics = allClips.filter(c => c.metadata?.prompt && c.metadata.prompt.trim()).length;
        listInfo.innerHTML = `Выбрано: <span style="color:${SUNO.accent};font-weight:bold;">${state.selected.size}</span> · Всего: ${allClips.length} · Скачиваемых: ${full} · <span style="color:${SUNO.success};">✓ ${downloadedCount}</span> · <span style="color:${SUNO.accent};">🆕 ${newCount}</span> · <span style="color:${SUNO.success};">📝 ${withLyrics}</span>`;
        $('sunodl-start-batch').disabled = state.selected.size === 0;
    }

    // ===== API =====
    async function fetchAllClips(onPage) {
        if (!state.activeJwt) throw new Error('Нет активного JWT');
        const jwt = state.activeJwt;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + jwt,
            'browser-token': makeBrowserToken(),
            'device-id': DEVICE_ID,
            'origin': 'https://suno.com',
            'referer': 'https://suno.com/',
            'accept': '*/*'
        };
        const all = [];
        const seen = new Set();
        let cursor = null, page = 0, hasMore = true;
        const tStart = performance.now();
        while (page < 50 && hasMore) {
            page++;
            headers['browser-token'] = makeBrowserToken();
            const body = cursor ? { cursor, limit: 30 } : { limit: 30 };
            logNet(`POST feed/v3 · page ${page}`);
            const tPage = performance.now();
            let r;
            try {
                r = await timedFetch('https://studio-api-prod.suno.com/api/feed/v3', {
                    method: 'POST', headers, credentials: 'same-origin',
                    body: JSON.stringify(body)
                }, 30000, `feed p${page}`);
            } catch(e) { logErr(`page ${page}: ${e.message}`); break; }
            const ms = (performance.now()-tPage).toFixed(0);
            log(`  ← HTTP ${r.status} · ${ms}ms`, r.ok?SUNO.success:SUNO.danger, r.ok?CS.ok:CS.err);
            if (!r.ok) break;
            const data = await r.json();
            if (page === 1) {
                log(`  🔍 keys: ${Object.keys(data).join(', ')}`, SUNO.accent, CS.accent);
                console.log('🔍 feed/v3 page1:', data);
            }
            const clips = (data?.clips || []).filter(c => c && c.id && (c.status === 'complete' || !c.status));
            if (clips.length === 0) { logWarn(`page ${page}: пусто`); break; }
            let added = 0, previewCount = 0, alreadyHave = 0, lyricsCount = 0;
            for (const c of clips) {
                if (seen.has(c.id)) continue;
                seen.add(c.id); all.push(c); added++;
                if (c.type === 'preview' || c.preview_seconds) previewCount++;
                if (state.downloadedIds.has(c.id)) alreadyHave++;
                if (c.metadata?.prompt && c.metadata.prompt.trim()) lyricsCount++;
            }
            const nextCursor = data.next_cursor || data.cursor || null;
            hasMore = data.has_more === true && !!nextCursor;
            logOk(`page ${page}: +${added} · всего ${all.length} · has_more=${data.has_more}` +
                  (previewCount ? ` · ⚠ ${previewCount} preview` : '') +
                  (lyricsCount ? ` · 📝 ${lyricsCount} с текстом` : '') +
                  (alreadyHave ? ` · ✓ ${alreadyHave} уже есть` : ''));
            if (onPage) onPage(page, all.length, hasMore);
            if (!hasMore) break;
            if (seen.has(nextCursor)) break;
            cursor = nextCursor;
        }
        logOk(`📦 ИТОГО: ${all.length} треков · ${page} стр. · ${((performance.now()-tStart)/1000).toFixed(1)}s`);
        return all;
    }

    async function fetchLicense(clipId) {
        const t = performance.now();
        const jwt = state.activeJwt;
        const r = await timedFetch('https://studio-api-prod.suno.com/api/mango/rights', {
            method:'POST',
            headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+jwt },
            credentials:'same-origin',
            body:JSON.stringify({ content_params:{ content_id:clipId, content_type:'clip' } })
        }, 15000, 'license');
        const ms = (performance.now()-t).toFixed(0);
        if (!r.ok) throw new Error(`License HTTP ${r.status}`);
        log(`  🔑 License · ${ms}ms`, SUNO.success, CS.ok);
        return await r.json();
    }

    async function decryptClip(clipId, cdnUrl, license, onProgress) {
        const jwt = state.activeJwt;
        const wk = b64(license.key), wiv = b64(license.iv);
        let ukr;
        if (jwt) ukr = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(jwt));
        else if (license.glt) ukr = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(license.glt));
        else throw new Error('Нет JWT/glt');
        const uk = await crypto.subtle.importKey('raw', ukr, { name:'AES-GCM' }, false, ['decrypt']);
        const cidB = new TextEncoder().encode(clipId);
        const ak = await crypto.subtle.decrypt({ name:'AES-GCM', iv:wk.slice(0,12), additionalData:cidB, tagLength:128 }, uk, wk.slice(12));
        const aiv = await crypto.subtle.decrypt({ name:'AES-GCM', iv:wiv.slice(0,12), additionalData:cidB, tagLength:128 }, uk, wiv.slice(12));
        const ctr = await crypto.subtle.importKey('raw', ak, { name:'AES-CTR' }, false, ['decrypt']);

        logNet('CDN GET');
        if (onProgress) onProgress(0, 0, 0, 0, 0, false, '🌐 Подключение к CDN...', 'ждём ответа', '');

        const t1 = performance.now();
        const ctrl = new AbortController();
        const hardTimeout = setTimeout(()=>ctrl.abort(), 300000);
        let r;
        try { r = await fetch(cdnUrl, { signal: ctrl.signal }); }
        catch(e) {
            clearTimeout(hardTimeout);
            if (e.name === 'AbortError') throw new Error('⏱ CDN HARD TIMEOUT 300s');
            throw new Error(`🌐 CDN fetch: ${e.message}`);
        }
        if (!r.ok) { clearTimeout(hardTimeout); throw new Error(`CDN HTTP ${r.status}`); }

        const total = parseInt(r.headers.get('content-length') || '0', 10);
        const hdrMs = (performance.now()-t1).toFixed(0);
        logNet(`CDN headers OK · ${hdrMs}ms · ${total>0?(total/1048576).toFixed(2)+' MB':'unknown size'}`);
        if (onProgress) onProgress(0, total, 0, 0, 0, false,
            `📦 Заголовки OK · ${fmtBytes(total)} · ждём данные...`, 'первый чанк', '');

        const reader = r.body.getReader();
        const chunks = [];
        let loaded = 0, lastTick = 0, lastChunkAt = performance.now();
        let lastPct = 0, stallWarned = false, chunkCount = 0;
        let speedSamples = [];

        const firstChunkTimeout = setTimeout(() => {
            if (loaded === 0) { logWarn(`⚠ Нет данных за ${FIRST_CHUNK_TIMEOUT/1000}s — рвём`); ctrl.abort(); }
        }, FIRST_CHUNK_TIMEOUT);

        const hb = setInterval(() => {
            const now = performance.now();
            const sinceChunk = now - lastChunkAt;
            const sec = (now - t1) / 1000;
            const sp = sec > 0 ? (loaded/1048576/sec) : 0;
            const pct = total > 0 ? (loaded/total*100) : 0;
            if (sinceChunk > GLOBAL_STALL_TIMEOUT && loaded > 0) {
                logWarn(`⚠ Глобальный stall ${(sinceChunk/1000).toFixed(0)}s — рвём`);
                ctrl.abort();
                return;
            }
            if (sinceChunk > STALL_THRESHOLD_MS) {
                if (!stallWarned) {
                    stallWarned = true;
                    logStall(`STALL ${(sinceChunk/1000).toFixed(1)}s · нет чанков · ${fmtBytes(loaded)} · ${fmtSpeed(sp)}`);
                    Sound.stall();
                }
                if (onProgress) onProgress(loaded, total, sp, pct, sinceChunk, true,
                    `🐌 STALL ${(sinceChunk/1000).toFixed(0)}s · ${fmtBytes(loaded)}/${fmtBytes(total)}`,
                    `нет ${(sinceChunk/1000).toFixed(1)}s`, '');
            } else {
                if (stallWarned) { stallWarned = false; logOk(`сеть ожила`); }
                else if (chunkCount > 0) {
                    logHb(`hb · ${fmtBytes(loaded)} · ${fmtSpeed(sp)} · last-chunk ${(sinceChunk/1000).toFixed(1)}s ago · chunks ${chunkCount}`);
                }
            }
        }, HEARTBEAT_MS);

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (loaded === 0 && firstChunkTimeout) {
                    clearTimeout(firstChunkTimeout);
                    logOk(`первый чанк · ${fmtBytes(value.byteLength)}`);
                }
                chunks.push(value);
                loaded += value.byteLength;
                lastChunkAt = performance.now();
                chunkCount++;
                const now = performance.now();
                if (lastTick === 0 || now - lastTick > UI_THROTTLE_MS) {
                    lastTick = now;
                    const sec = (now - t1) / 1000;
                    const instSp = sec > 0 ? (loaded/1048576/sec) : 0;
                    speedSamples.push(instSp);
                    if (speedSamples.length > 5) speedSamples.shift();
                    const sp = speedSamples.reduce((a,b)=>a+b,0) / speedSamples.length;
                    const pct = total > 0 ? (loaded/total*100) : 0;
                    const remaining = total - loaded;
                    const etaSec = sp > 0.01 ? (remaining/1048576/sp) : 0;
                    const stage = `⬇ ${fmtBytes(loaded)} / ${fmtBytes(total)} · ${fmtSpeed(sp)}`;
                    const netInfo = `${fmtBytes(loaded)}/${fmtBytes(total)} · ${fmtSpeed(sp)} · last-chunk ${((now-lastChunkAt)/1000).toFixed(1)}s · ${chunkCount} chunks`;
                    const etaInfo = `осталось ${fmtBytes(remaining)} · ETA ${fmtEta(etaSec)}`;
                    if (onProgress) onProgress(loaded, total, sp, pct, 0, false, stage, netInfo, etaInfo);
                    if (pct - lastPct >= LOG_PCT_STEP) {
                        lastPct = Math.floor(pct/LOG_PCT_STEP)*LOG_PCT_STEP;
                        log(`  ⬇ ${Math.round(pct)}% · ${fmtBytes(loaded)}/${fmtBytes(total)} · ${fmtSpeed(sp)} · ETA ${fmtEta(etaSec)}`, SUNO.textTertiary, CS.dim);
                    }
                }
            }
        } catch(e) {
            if (e.name === 'AbortError') {
                if (loaded === 0) throw new Error(`⏱ Нет данных за ${FIRST_CHUNK_TIMEOUT/1000}s`);
                throw new Error(`⏱ Глобальный stall > ${GLOBAL_STALL_TIMEOUT/1000}s · скачано ${fmtBytes(loaded)}/${fmtBytes(total)}`);
            }
            throw e;
        } finally {
            clearInterval(hb);
            clearTimeout(hardTimeout);
            if (firstChunkTimeout) clearTimeout(firstChunkTimeout);
        }

        const enc = new Uint8Array(loaded);
        let off = 0;
        for (const c of chunks) { enc.set(c, off); off += c.byteLength; }
        const dlMs = (performance.now()-t1).toFixed(0);
        const dlMBps = (enc.byteLength/1048576/(dlMs/1000)).toFixed(2);
        logOk(`Скачано ${fmtBytes(enc.byteLength)} за ${(dlMs/1000).toFixed(1)}s (${fmtSpeed(parseFloat(dlMBps))}) · ${chunkCount} chunks`);

        if (onProgress) onProgress(loaded, total, 0, 95, 0, false,
            `🔓 Расшифровка ${fmtBytes(enc.byteLength)}...`, 'AES-CTR', '');
        log(`  🔓 Decrypt ${fmtBytes(enc.byteLength)}...`, SUNO.accent, CS.accent);
        const t2 = performance.now();
        const dec = await crypto.subtle.decrypt(
            { name:'AES-CTR', counter:new Uint8Array(aiv), length:128 },
            ctr, enc
        );
        logOk(`Расшифровано за ${(performance.now()-t2).toFixed(0)}ms · ${fmtBytes(dec.byteLength)}`);
        const head = new Uint8Array(dec.slice(0, 16));
        const boxType = String.fromCharCode(head[4], head[5], head[6], head[7]);
        const isFtyp = boxType === 'ftyp';
        const isWebm = head[0]===0x1a && head[1]===0x45;
        if (!isFtyp && !isWebm) {
            const hex = Array.from(head).map(b=>b.toString(16).padStart(2,'0')).join(' ');
            throw new Error(`Битый файл: "${boxType}" · HEX: ${hex}`);
        }
        const mime = isFtyp ? 'audio/mp4' : 'audio/webm';
        return { blob: new Blob([dec], { type: mime }), isFtyp, size: dec.byteLength };
    }

    // ===== SAVE AUDIO =====
    function saveToDownloads(blob, title, numPrefix) {
        const safe = sanitizeName(title);
        const ext = blob.type.includes('webm') ? 'webm' : 'm4a';
        const suffix = numPrefix ? ` [${String(numPrefix).padStart(2,'0')}]` : '';
        const fn = `${safe}${suffix}.${ext}`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fn; a.style.display = 'none';
        document.body.appendChild(a); a.click();
        setTimeout(()=>{ a.remove(); URL.revokeObjectURL(url); }, 3000);
        logOk(`💾 ${fn} (${fmtBytes(blob.size)})`);
        return fn;
    }

    // ===== SAVE TXT + JSON =====
    function buildLyricsTxt(clip, seqNum) {
        const m = clip.metadata || {};
        const sep = '═'.repeat(64);
        const L = [];
        L.push(sep);
        L.push(`🎵 ${clip.title || '—'}`);
        L.push(sep);
        L.push(`ID:       ${clip.id}`);
        L.push(`Автор:    ${clip.display_name || '—'} (@${clip.handle || '—'})`);
        L.push(`Создано:  ${clip.created_at ? new Date(clip.created_at).toLocaleString('ru-RU') : '—'}`);
        L.push(`Модель:   ${clip.major_model_version || '—'} (${clip.model_name || '—'})`);
        if (m.duration) L.push(`Длительность: ${Math.floor(m.duration/60)}:${String(Math.round(m.duration%60)).padStart(2,'0')} (${m.duration.toFixed(1)} сек)`);
        L.push(`Плей:     ${clip.play_count || 0} · Лайк: ${clip.upvote_count || 0} · Комм: ${clip.comment_count || 0}`);
        L.push(`Публично: ${clip.is_public ? 'да' : 'нет'}`);
        L.push(`Скачано:  ${new Date().toLocaleString('ru-RU')}`);

        if (m.tags) {
            L.push('');
            L.push('🏷️  ТЕГИ');
            L.push('─'.repeat(64));
            L.push(m.tags);
        }
        if (clip.display_tags) {
            L.push('');
            L.push(`Кратко: ${clip.display_tags}`);
        }

        L.push('');
        L.push(sep);
        L.push('📝 ТЕКСТ ПЕСНИ');
        L.push(sep);

        const prompt = (m.prompt || '').trim();
        if (prompt) {
            L.push(prompt);
        } else {
            L.push('(текст не задан — инструментал)');
        }

        if (m.gpt_description_prompt) {
            L.push('');
            L.push('─'.repeat(64));
            L.push('📋 GPT-описание:');
            L.push(m.gpt_description_prompt);
        }

        L.push('');
        L.push(sep);
        L.push(`© Suno Downloader v${VERSION} · ${new Date().toISOString().slice(0,10)}`);
        L.push(sep);
        return L.join('\n');
    }

    function buildMetadataJson(clip, seqNum, size, ext) {
        const m = clip.metadata || {};
        return {
            _meta: {
                savedBy: `Suno Downloader v${VERSION}`,
                savedAt: new Date().toISOString(),
                seqNum: seqNum,
                filename: `${sanitizeName(clip.title||'track')} [${String(seqNum).padStart(2,'0')}].${ext}`,
                size: size
            },
            id: clip.id,
            title: clip.title || '',
            display_name: clip.display_name,
            handle: clip.handle,
            user_id: clip.user_id,
            created_at: clip.created_at,
            is_public: clip.is_public,
            is_download_unlocked: clip.is_download_unlocked,
            play_count: clip.play_count,
            upvote_count: clip.upvote_count,
            comment_count: clip.comment_count,
            model: { major: clip.major_model_version, name: clip.model_name },
            metadata: {
                duration: m.duration,
                tags: m.tags || '',
                prompt: m.prompt || '',
                gpt_description_prompt: m.gpt_description_prompt || '',
                type: m.type,
                make_instrumental: m.make_instrumental,
                stream: m.stream
            },
            display_tags: clip.display_tags,
            image_url: clip.image_url,
            image_large_url: clip.image_large_url,
            media_urls: clip.media_urls,
            action_config: clip.action_config
        };
    }

    function triggerDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.style.display = 'none';
        document.body.appendChild(a); a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 3000);
    }

    function saveTxtAndJson(clip, blob, size, seqNum) {
        if (!saveTxtEnabled()) return;
        const safe = sanitizeName(clip.title || 'track');
        const suffix = ` [${String(seqNum).padStart(2,'0')}]`;
        const ext = blob.type.includes('webm') ? 'webm' : 'm4a';

        try {
            const txt = buildLyricsTxt(clip, seqNum);
            const txtBlob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
            triggerDownload(txtBlob, `${safe}${suffix}.txt`);
            const hasLyrics = !!(clip.metadata?.prompt && clip.metadata.prompt.trim());
            logTxt(`${safe}${suffix}.txt (${(txtBlob.size/1024).toFixed(1)} KB)${hasLyrics?' · с текстом':' · инструментал'}`);
        } catch(e) { logWarn(`TXT fail: ${e.message}`); }

        try {
            const json = buildMetadataJson(clip, seqNum, size, ext);
            const jsonStr = JSON.stringify(json, null, 2);
            const jsonBlob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
            triggerDownload(jsonBlob, `${safe}${suffix}.json`);
            logTxt(`${safe}${suffix}.json (${(jsonBlob.size/1024).toFixed(1)} KB)`);
        } catch(e) { logWarn(`JSON fail: ${e.message}`); }
    }

    // ===== TRACK =====
    async function processTrack(clip, seqNum, idxInBatch, totalInBatch) {
        const title = clip.title || `suno_${clip.id.slice(0,8)}`;
        const cdnUrl = clip.media_urls[0].url;
        const tT0 = performance.now();
        const hasLyrics = !!(clip.metadata?.prompt && clip.metadata.prompt.trim());
        logStep(`[${idxInBatch+1}/${totalInBatch}] [${String(seqNum).padStart(2,'0')}] "${title.slice(0,40)}"${hasLyrics?' 📝':''}`);
        setCurrent(title, idxInBatch, totalInBatch, 'Начинаем...', 0, 'idle', 'init', '');
        for (let attempt=1; attempt<=MAX_ATTEMPTS; attempt++) {
            if (state.batchCancel) return;
            if (attempt > 1) {
                log(`  🔄 Попытка ${attempt}/${MAX_ATTEMPTS}`, SUNO.warning, CS.warn);
                await new Promise(r=>setTimeout(r, 800*attempt));
            }
            try {
                setCurrent(title, idxInBatch, totalInBatch, '🔑 License...', 2, 'license', 'ждём /api/mango/rights', '');
                const lic = await fetchLicense(clip.id);
                setCurrent(title, idxInBatch, totalInBatch, '🔑 License OK', 10, 'license', 'license получен', '');
                const { blob, size } = await decryptClip(clip.id, cdnUrl, lic, (loaded, totalBytes, speed, pct, sinceChunk, isStall, customStage, netInfo, etaInfo) => {
                    let dispPct;
                    if (customStage && customStage.includes('Расшифровка')) dispPct = 92;
                    else if (loaded === 0 && totalBytes === 0) dispPct = 12;
                    else if (loaded === 0 && totalBytes > 0) dispPct = 15;
                    else dispPct = 15 + pct * 0.75;
                    let st = 'idle';
                    if (isStall) st = 'stall';
                    const stage = customStage || `⬇ ${fmtBytes(loaded)} / ${fmtBytes(totalBytes)} · ${fmtSpeed(speed)}`;
                    setCurrent(title, idxInBatch, totalInBatch, stage, dispPct, st, netInfo || '', etaInfo || '');
                });
                state.batchBytesDone += size;
                setCurrent(title, idxInBatch, totalInBatch, '💾 Сохранение...', 96, 'idle', `${fmtBytes(size)}`, '');
                Sound.save();
                saveToDownloads(blob, title, seqNum);
                saveTxtAndJson(clip, blob, size, seqNum);
                setCurrent(title, idxInBatch, totalInBatch, '✅ Готово', 100, 'done', `${fmtBytes(size)}`, '');
                try {
                    await dbAdd(STORE_DOWNLOADED, {
                        id: clip.id, title: clip.title || '', size: size,
                        downloadedAt: Date.now(), accountId: state.activeAccountId,
                        filename: sanitizeName(title) + ` [${String(seqNum).padStart(2,'0')}].` + (blob.type.includes('webm') ? 'webm' : 'm4a'),
                        model: clip.major_model_version || '',
                        duration: clip.metadata?.duration || 0,
                        hasLyrics: hasLyrics
                    });
                    state.downloadedIds.add(clip.id);
                    state.downloadedMeta.set(clip.id, { id: clip.id, title: clip.title, size, downloadedAt: Date.now() });
                    logDb(`записан: ${clip.id.slice(0,8)}…`);
                } catch(e) { logWarn(`IndexedDB write: ${e.message}`); }
                const tMs = (performance.now()-tT0).toFixed(0);
                logOk(`ГОТОВО · ${(tMs/1000).toFixed(1)}s · ${fmtBytes(size)}${hasLyrics?' · с текстом':''}`);
                state.batchDone++;
                updateBatchProgress();
                setTimeout(()=>Sound.trackDone(), 100);
                return;
            } catch(e) {
                console.log(`%c   ⚠ Попытка ${attempt}: ${e.message}`, 'color:#fbbf24;');
                if (attempt >= MAX_ATTEMPTS) {
                    state.batchErrors++;
                    logErr(`"${title.slice(0,40)}" — ${e.message}`);
                    setCurrent(title, idxInBatch, totalInBatch, `❌ ${e.message.slice(0,60)}`, 100, 'error', '', '');
                    updateBatchProgress();
                    Sound.error();
                }
            }
        }
    }

    // ===== PREPARE =====
    async function prepareList() {
        if (state.phase !== 'idle' && state.phase !== 'done') return;
        Sound.click();
        state.phase = 'list';
        listPanel.style.display = 'block';
        batchEl.style.display = 'none';
        currentEl.style.display = 'none';
        state.selected.clear();
        $('sunodl-all').disabled = true;
        setStatus('Загрузка списка...', 'idle');
        if (!state.activeJwt) {
            const currentJwt = await getClerkJwt(true);
            if (currentJwt) {
                await captureCurrentAccount();
            } else {
                logErr('Нет JWT — залогинься на suno.com');
                state.phase = 'idle'; $('sunodl-all').disabled = false; return;
            }
        }
        try {
            const acc = state.accounts.find(a => a.id === state.activeAccountId);
            logOk(`Аккаунт: ${acc ? acc.handle + ' · ' + acc.email : '—'}`);
            const clips = await fetchAllClips((page, count, hasMore) => {
                setStatus(`Стр. ${page} · ${count}${hasMore?' · ещё...':' · всё'}`, 'idle');
            });
            if (clips.length === 0) throw new Error('Список пуст');
            state.allClips = clips;
            logOk(`Получено ${clips.length} треков`);
            const full = clips.filter(c => {
                const isFull = c?.media_urls?.[0]?.url?.includes('cloudfront');
                const isPreview = c.type === 'preview' || !!c.preview_seconds;
                return isFull && !isPreview;
            });
            logOk(`Скачиваемых: ${full.length}`);
            const withLyrics = clips.filter(c => c.metadata?.prompt && c.metadata.prompt.trim()).length;
            if (withLyrics) logTxt(`с текстом: ${withLyrics} треков`);
            const alreadyDownloaded = clips.filter(c => state.downloadedIds.has(c.id)).length;
            const newTracks = full.length - clips.filter(c => state.downloadedIds.has(c.id) && c?.media_urls?.[0]?.url?.includes('cloudfront') && !(c.type==='preview'||c.preview_seconds)).length;
            logOk(`✓ уже скачано: ${alreadyDownloaded} · 🆕 новых: ${newTracks}`, '#38bdf8', CS.db);
            if (state.downloadedIds.size > 0) {
                dbSummary.style.display = 'flex';
                $('sunodl-db-count').textContent = state.downloadedIds.size;
            }
            clips.forEach((c, i) => {
                const isFull = c?.media_urls?.[0]?.url?.includes('cloudfront');
                const isPreview = c.type === 'preview' || !!c.preview_seconds;
                if (isFull && !isPreview && !state.downloadedIds.has(c.id)) state.selected.add(i);
            });
            renderList(clips);
            setStatus(`Выбрано ${state.selected.size} новых из ${clips.length}`, 'ok');
            Sound.chord([523,659],0.4,0.08);
        } catch(e) {
            logErr(`Ошибка: ${e.message}`);
            setStatus('Ошибка: '+e.message, 'err');
            Sound.error();
            state.phase = 'idle';
            $('sunodl-all').disabled = false;
        }
    }

    async function startBatch() {
        if (state.isBatch) return;
        if (state.selected.size === 0) { logWarn('Ничего не выбрано'); Sound.error(); return; }
        const idxs = Array.from(state.selected).sort((a,b)=>a-b);
        const clipsToDownload = idxs.map(i => state.allClips[i]);
        Sound.start();
        logStep(`СТАРТ БАТЧА · ${clipsToDownload.length} треков · TXT+JSON ${saveTxtEnabled()?'вкл':'выкл'}`);
        state.isBatch = true; state.batchCancel = false;
        state.batchErrors = 0; state.batchDone = 0; state.batchSkipped = 0;
        state.batchTotal = clipsToDownload.length;
        state.batchBytesDone = 0; state.batchStartTime = performance.now();
        state.phase = 'downloading';
        listPanel.style.display = 'none';
        batchEl.style.display = 'block';
        currentEl.style.display = 'block';
        updateBatchProgress();
        $('sunodl-all').disabled = true;
        $('sunodl-stop').style.display = 'inline-flex';
        setStatus('Скачивание...', 'idle');
        const bT0 = performance.now();
        let seqNum = 1;
        try {
            for (let i=0; i<clipsToDownload.length; i++) {
                if (state.batchCancel) { logWarn('Отменено'); break; }
                await processTrack(clipsToDownload[i], seqNum, i, clipsToDownload.length);
                seqNum++;
            }
            const tMs = (performance.now()-bT0).toFixed(0);
            logOk(`ЗАВЕРШЕНО · ${(tMs/1000).toFixed(1)}s · ${fmtBytes(state.batchBytesDone)}`);
            logOk(`Успешно: ${state.batchDone}/${state.batchTotal}`);
            if (state.batchErrors) logErr(`Ошибок: ${state.batchErrors}`);
            setStatus(`Готово! ${state.batchDone}/${state.batchTotal}`, state.batchErrors?'warn':'ok');
            Sound.complete();
        } catch(e) {
            logErr(`КРИТИЧЕСКАЯ: ${e.message}`);
            setStatus('Ошибка: '+e.message, 'err');
            Sound.error();
        }
        state.isBatch = false; state.phase = 'done';
        $('sunodl-all').disabled = false;
        $('sunodl-all').innerHTML = '<span style="font-size:15px;">⬇</span> Обновить список';
        $('sunodl-stop').style.display = 'none';
        miniBadge.style.display = 'none';
    }

    // ═══════════════════════════════════════════════════════════
    // GITHUB SYNC
    // ═══════════════════════════════════════════════════════════
    async function syncDeriveKey(pass, salt) {
        const enc = new TextEncoder();
        const km = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' },
            km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
        );
    }
    function syncB64e(bytes) {
        let s = ''; const u = new Uint8Array(bytes);
        for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
        return btoa(s);
    }
    function syncB64d(str) {
        const bin = atob(str); const u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        return u;
    }
    async function syncEncrypt(plaintext, pass) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await syncDeriveKey(pass, salt);
        const ct = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
        return { v:1, algo:'AES-GCM-256/PBKDF2-200k', salt:syncB64e(salt), iv:syncB64e(iv), data:syncB64e(ct), created:new Date().toISOString() };
    }
    async function syncDecrypt(blob, pass) {
        const salt = syncB64d(blob.salt), iv = syncB64d(blob.iv), data = syncB64d(blob.data);
        const key = await syncDeriveKey(pass, salt);
        const pt = await crypto.subtle.decrypt({ name:'AES-GCM', iv }, key, data);
        return new TextDecoder().decode(pt);
    }
    async function ghFetch(path, method='GET', body=null) {
        const token = localStorage.getItem(SYNC_TKEY);
        if (!token) throw new Error('Нет GitHub токена');
        const opts = {
            method,
            headers: {
                'Authorization': 'token ' + token,
                'Accept': 'application/vnd.github.v3+json',
                'X-GitHub-Api-Version': '2022-11-28'
            }
        };
        if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
        const r = await fetch(`https://api.github.com/repos/${SYNC_REPO}/contents/${path}`, opts);
        if (r.status === 404) return null;
        if (!r.ok) { const t = await r.text(); throw new Error(`GitHub ${r.status}: ${t.slice(0,150)}`); }
        return r.json();
    }

    const SunoSync = {
        getToken: () => localStorage.getItem(SYNC_TKEY) || '',
        setToken: (t) => localStorage.setItem(SYNC_TKEY, (t||'').trim()),
        hasToken: () => !!localStorage.getItem(SYNC_TKEY),
        getPass: () => localStorage.getItem(SYNC_PKEY) || '',
        setPass: (p) => localStorage.setItem(SYNC_PKEY, p||''),
        hasPass: () => !!localStorage.getItem(SYNC_PKEY),
        getSyncSecrets: () => localStorage.getItem(SYNC_SKEY) === '1',
        setSyncSecrets: (v) => localStorage.setItem(SYNC_SKEY, v ? '1' : '0'),

        async push() {
            if (!this.hasToken()) throw new Error('Нет GitHub токена');
            if (!this.hasPass()) throw new Error('Нет пароля');
            const inc = this.getSyncSecrets();
            const payload = {
                version: 1, pushedAt: Date.now(),
                pushedFrom: navigator.userAgent.slice(0,80),
                accounts: state.accounts.map(a => ({
                    id: a.id, userId: a.userId, sunoUserId: a.sunoUserId, clerkId: a.clerkId,
                    email: a.email, handle: a.handle, avatar: a.avatar,
                    jwtExp: a.jwtExp, jwtIat: a.jwtIat, savedAt: a.savedAt,
                    cookiesCount: a.cookiesCount, localStorageCount: a.localStorageCount,
                    ...(inc ? { jwt: a.jwt, sessionId: a.sessionId, cookies: a.cookies, localStorage: a.localStorage } : {})
                })),
                tracks: Array.from(state.downloadedMeta.values()).slice(0, 5000)
            };
            const plain = JSON.stringify(payload);
            const blob = await syncEncrypt(plain, this.getPass());
            const existing = await ghFetch(SYNC_PATH);
            await ghFetch(SYNC_PATH, 'PUT', {
                message: `sync suno (${payload.accounts.length} acc, ${payload.tracks.length} tracks)`,
                content: btoa(JSON.stringify(blob, null, 2)),
                sha: existing?.sha
            });
            return { accounts: payload.accounts.length, tracks: payload.tracks.length, bytes: plain.length };
        },

        async pull() {
            if (!this.hasToken()) throw new Error('Нет GitHub токена');
            if (!this.hasPass()) throw new Error('Нет пароля');
            const existing = await ghFetch(SYNC_PATH);
            if (!existing) throw new Error('Файла нет — сначала push с другого компа');
            const content = atob(existing.content.replace(/\n/g, ''));
            const blob = JSON.parse(content);
            if (!blob.salt || !blob.iv || !blob.data) throw new Error('Формат не распознан');
            const plain = await syncDecrypt(blob, this.getPass());
            return JSON.parse(plain);
        }
    };

    function updateSyncUI() {
        const t = SunoSync.hasToken(), p = SunoSync.hasPass();
        const st = $('sunodl-sync-status');
        if (!st) return;
        if (!t && !p) st.textContent = '— не настроено —';
        else if (t && !p) st.textContent = '🔑 токен есть · ⚠ нет пароля';
        else if (!t && p) st.textContent = '⚠ нет токена · 🔒 пароль есть';
        else st.textContent = '✅ готов · AES-GCM-256' + (SunoSync.getSyncSecrets() ? ' · +секреты' : '');
        st.style.color = (t && p) ? '#4ade80' : 'rgba(255,255,255,0.4)';
        const pb = $('sunodl-sync-push'), pl = $('sunodl-sync-pull');
        if (pb) pb.disabled = !(t && p);
        if (pl) pl.disabled = !(t && p);
    }

    // ===== HANDLERS =====
    $('sunodl-sound').onclick = () => {
        Sound.enabled=!Sound.enabled;
        $('sunodl-sound').textContent=Sound.enabled?'🔊':'🔇';
        if (Sound.enabled) Sound.click();
    };
    $('sunodl-clear').onclick = () => { logEl.innerHTML=''; console.clear(); };
    $('sunodl-minimize').onclick = () => { state.minimized = true; applyMinimized(); Sound.click(); };
    $('sunodl-mini').onclick = () => { state.minimized = false; applyMinimized(); Sound.click(); };
    $('sunodl-close').onclick = () => {
        if (state.isBatch && !confirm('Батч идёт. Закрыть?')) return;
        state.batchCancel = true;
        $('sunodl').remove();
        $('sunodl-mini').remove();
    };
    $('sunodl-all').onclick = () => {
        if (state.phase === 'done') {
            state.phase = 'idle';
            state.selected.clear();
            listEl.innerHTML = '';
            prepareList();
        } else prepareList();
    };
    $('sunodl-stop').onclick = () => { Sound.error(); state.batchCancel=true; logWarn('⏹ Стоп...'); };

    $('sunodl-sel-all').onclick = () => {
        state.allClips.forEach((c, i) => {
            const isFull = c?.media_urls?.[0]?.url?.includes('cloudfront');
            const isPreview = c.type === 'preview' || !!c.preview_seconds;
            if (isFull && !isPreview) state.selected.add(i);
        });
        renderList(state.allClips);
        Sound.click();
    };
    $('sunodl-sel-none').onclick = () => {
        state.selected.clear();
        renderList(state.allClips);
        Sound.click();
    };
    $('sunodl-start-batch').onclick = () => { Sound.click(); startBatch(); };
    $('sunodl-filter-new').onclick = () => {
        state.filterOnlyNew = !state.filterOnlyNew;
        $('sunodl-filter-new').classList.toggle('active', state.filterOnlyNew);
        renderList(state.allClips);
        Sound.click();
    };

    // TXT+JSON toggle
    (function initSaveTxt() {
        const btn = $('sunodl-save-txt');
        if (!btn) return;
        const upd = () => {
            const on = saveTxtEnabled();
            btn.classList.toggle('active', on);
            btn.style.color = on ? '#4ade80' : '';
            btn.textContent = on ? '📝 TXT+JSON ✓' : '📝 TXT+JSON';
        };
        btn.onclick = () => {
            const cur = saveTxtEnabled();
            localStorage.setItem(SAVE_TXT_KEY, cur ? 'false' : 'true');
            upd();
            Sound.click();
            log(cur ? '📝 TXT+JSON выключен' : '📝 TXT+JSON включён', '#4ade80', CS.txt);
        };
        upd();
    })();

    $('sunodl-db-clear').onclick = async () => {
        if (!confirm('Очистить базу скачанных?')) return;
        try {
            await dbClear(STORE_DOWNLOADED);
            state.downloadedIds.clear();
            state.downloadedMeta.clear();
            logDb('база скачанных очищена');
            dbSummary.style.display = 'none';
            renderList(state.allClips);
        } catch(e) { logErr(`db clear: ${e.message}`); }
    };
    $('sunodl-acc-add').onclick = async () => {
        Sound.click();
        await captureCurrentAccount();
        state.allClips = [];
        state.selected.clear();
        listEl.innerHTML = '';
    };
    $('sunodl-acc-del').onclick = () => {
        const sel = $('sunodl-account-select');
        if (!sel.value) { logWarn('Аккаунт не выбран'); return; }
        Sound.click();
        removeAccount(sel.value);
    };
    $('sunodl-account-select').onchange = async (e) => {
        Sound.click();
        if (e.target.value) await switchAccount(e.target.value);
    };

    $('sunodl-sync-token').onclick = () => {
        const cur = SunoSync.getToken();
        const t = prompt('🔑 GitHub Personal Access Token\n\nСоздай: github.com/settings/tokens (classic)\nScope: repo', cur);
        if (t !== null) {
            SunoSync.setToken(t);
            updateSyncUI();
            logSync(t ? 'токен сохранён' : 'токен удалён');
        }
    };
    $('sunodl-sync-pass').onclick = () => {
        const cur = SunoSync.getPass();
        const p = prompt('🔒 Пароль шифрования (≥8 символов)\n\n⚠️ ЗАПОМНИ! Без него данные не расшифруются.', cur);
        if (p !== null) {
            if (p && p.length < 8) { alert('Минимум 8 символов'); return; }
            SunoSync.setPass(p);
            updateSyncUI();
            logSync(p ? 'пароль сохранён' : 'пароль удалён');
        }
    };
    $('sunodl-sync-push').onclick = async () => {
        try {
            setStatus('⬆ push...', 'sync');
            const r = await SunoSync.push();
            logSync(`⬆ push: ${r.accounts} акк · ${r.tracks} треков · ${(r.bytes/1024).toFixed(1)} KB`);
            setStatus(`✅ Синхр. на GitHub`, 'ok');
        } catch(e) { logErr(`push: ${e.message}`); setStatus('❌ push fail', 'err'); }
    };
    $('sunodl-sync-pull').onclick = async () => {
        try {
            setStatus('⬇ pull...', 'sync');
            const data = await SunoSync.pull();
            if (!data) { logWarn('пусто'); return; }
            let mergedAcc = 0, newAcc = 0, newTr = 0;
            for (const acc of (data.accounts || [])) {
                const idx = state.accounts.findIndex(a => a.id === acc.id);
                if (idx >= 0) {
                    const cur = state.accounts[idx];
                    state.accounts[idx] = { ...cur, email: acc.email||cur.email, handle: acc.handle||cur.handle, avatar: acc.avatar||cur.avatar, ...(acc.jwt ? { jwt: acc.jwt, jwtExp: acc.jwtExp } : {}) };
                    await dbAdd(STORE_ACCOUNTS, state.accounts[idx]);
                    mergedAcc++;
                } else {
                    await dbAdd(STORE_ACCOUNTS, acc);
                    state.accounts.push(acc);
                    newAcc++;
                }
            }
            for (const t of (data.tracks || [])) {
                if (!state.downloadedIds.has(t.id)) {
                    state.downloadedIds.add(t.id);
                    state.downloadedMeta.set(t.id, t);
                    await dbAdd(STORE_DOWNLOADED, t);
                    newTr++;
                }
            }
            logSync(`⬇ pull: ${newAcc} новых · ${mergedAcc} обновл. · +${newTr} треков`);
            setStatus(`✅ +${newAcc} акк · +${newTr} трек`, 'ok');
            renderAccountSelect(); updateListInfo();
        } catch(e) { logErr(`pull: ${e.message}`); setStatus('❌ pull fail', 'err'); }
    };

    // ===== INIT =====
    log(`Suno Downloader v${VERSION}`, SUNO.accent, CS.accent);
    log(`Lyrics + Tags · Multi-Account · IndexedDB · GitHub Sync`, SUNO.textTertiary, CS.dim);

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

        const currentJwt = await getClerkJwt(true);
        if (currentJwt) {
            const payload = parseJwt(currentJwt);
            const uid = payload && (payload['suno.com/claims/user_id'] || payload.sub);
            const existing = uid && state.accounts.find(a => a.id === uid);
            if (existing) {
                existing.jwt = currentJwt;
                existing.jwtExp = payload.exp;
                existing.lastSeenAt = Date.now();
                await dbAdd(STORE_ACCOUNTS, existing);
                state.activeJwt = currentJwt;
                state.activeAccountId = existing.id;
                logOk(`Аккаунт: ${existing.handle} · ${existing.email}`, SUNO.success, CS.ok);
            } else {
                log(`🆕 Новый аккаунт — сохраняю...`, SUNO.accent, CS.accent);
                await captureCurrentAccount();
            }
            renderAccountSelect();
            setStatus('Готов к загрузке', 'ok');
        } else {
            setStatus('Открой suno.com (залогинься)', 'warn');
        }

        updateSyncUI();
        applyMinimized();
    })();

    console.log(`%c✅ Suno Downloader v${VERSION} готов`, 'color:#4ade80;font-weight:bold;font-size:14px;');
})();
