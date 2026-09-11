/**
 * Suno Downloader v11.4 — IndexedDB + Suffix Number + Live Progress
 * ✅ IndexedDB база скачанных треков (по clip.id)
 * ✅ При запуске — статус "уже скачано" в списке (зелёная подсветка)
 * ✅ Фильтр "только новые" / "перекачать"
 * ✅ Префикс номера [01] в КОНЦЕ имени файла
 * ✅ Живой прогресс + net-diag + stall-abort
 * ✅ Все треки через пагинацию (next_cursor + has_more)
 */
(function sunoDownloaderV114() {
    const VERSION = '11.4';
    const MAX_ATTEMPTS = 3;
    const STALL_THRESHOLD_MS = 5000;
    const HEARTBEAT_MS = 1000;
    const UI_THROTTLE_MS = 40;
    const LOG_PCT_STEP = 10;
    const FIRST_CHUNK_TIMEOUT = 30000;
    const GLOBAL_STALL_TIMEOUT = 60000;
    const DB_NAME = 'sunodl_db';
    const DB_VERSION = 1;
    const STORE_NAME = 'downloaded';

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
        stall:'color:#ff8c42;font-weight:bold;', hb:'color:#5a6a7a;', db:'color:#38bdf8;'
    };

    // ===== Мягкие звуки =====
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
        stall(){ this.note(220,0.4,0.07,0,'sawtooth'); this.note(196,0.5,0.06,0.2,'sawtooth'); }
    };

    const state = {
        jwt:null, isBatch:false, batchCancel:false,
        batchTotal:0, batchDone:0, batchErrors:0, batchSkipped:0,
        allClips:[], selected:new Set(),
        downloadedIds:new Set(),
        downloadedMeta:new Map(),
        phase:'idle',
        batchBytesTotal:0,
        batchBytesDone:0,
        batchStartTime:0,
        filterOnlyNew:false
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
                if (!d.objectStoreNames.contains(STORE_NAME)) {
                    const store = d.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('title', 'title', { unique: false });
                    store.createIndex('downloadedAt', 'downloadedAt', { unique: false });
                }
            };
        });
    }

    async function dbGetAll() {
        if (!db) await dbInit();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    async function dbAdd(record) {
        if (!db) await dbInit();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.put(record);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function dbClear() {
        if (!db) await dbInit();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async function dbRemove(id) {
        if (!db) await dbInit();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async function dbLoadDownloaded() {
        try {
            const all = await dbGetAll();
            state.downloadedIds.clear();
            state.downloadedMeta.clear();
            for (const rec of all) {
                state.downloadedIds.add(rec.id);
                state.downloadedMeta.set(rec.id, rec);
            }
            log(`📚 IndexedDB: ${all.length} скачанных треков`, '#38bdf8', CS.db);
            return all;
        } catch(e) {
            logWarn(`IndexedDB недоступен: ${e.message}`);
            return [];
        }
    }

    // ===== DEVICE ID + BROWSER TOKEN =====
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

    // ===== УТИЛИТЫ =====
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

    // ===== JWT =====
    async function getJwt(force=false) {
        if (state.jwt && !force) return state.jwt;
        try {
            if (window.Clerk?.session?.getToken) {
                const t = await window.Clerk.session.getToken({skipCache:force});
                if (t && typeof t==='string' && t.length>50) { state.jwt=t; return t; }
            }
        } catch(e){}
        try {
            const m = document.cookie.match(/(?:^|;\s*)__session=([^;]+)/);
            if (m) {
                const v = decodeURIComponent(m[1]);
                if (v.length>100 && v.split('.').length===3) { state.jwt=v; return v; }
            }
        } catch(e){}
        return state.jwt;
    }

    // ===== СЕТЬ =====
    async function timedFetch(url, opts={}, timeoutMs=300000, label='fetch') {
        const c = new AbortController();
        const t = setTimeout(()=>c.abort(), timeoutMs);
        const tStart = performance.now();
        try {
            const r = await fetch(url,{...opts, signal:c.signal});
            clearTimeout(t);
            const ms = (performance.now()-tStart).toFixed(0);
            if (!navigator.onLine) log(`  ⚠ navigator.onLine=false (ответ за ${ms}ms)`, SUNO.warning, CS.warn);
            return r;
        }
        catch(e){
            clearTimeout(t);
            const ms = (performance.now()-tStart).toFixed(0);
            if (e.name==='AbortError') throw new Error(`⏱ TIMEOUT ${timeoutMs}ms (${label}, шло ${ms}ms)`);
            if (!navigator.onLine) throw new Error(`📡 OFFLINE (${label}, ${ms}ms): ${e.message}`);
            throw new Error(`🌐 NETWORK (${label}, ${ms}ms): ${e.name} — ${e.message}`);
        }
    }

    // ===== UI =====
    document.body.insertAdjacentHTML('beforeend', `
        <link rel="preload" href="https://suno.com/static-p/PPNeueMontreal-Regular.7a832673.woff" as="font" type="font/woff" crossorigin>
        <style>
            @font-face{font-family:'PP Neue Montreal';src:url('https://suno.com/static-p/PPNeueMontreal-Regular.7a832673.woff') format('woff');font-weight:400;font-display:swap;}
            @font-face{font-family:'PP Neue Montreal';src:url('https://suno.com/static-p/PPNeueMontreal-Medium.8b97a885.woff') format('woff');font-weight:500;font-display:swap;}
            #sunodl{animation:sunodl-in 0.4s cubic-bezier(0.16,1,0.3,1);}
            @keyframes sunodl-in{from{opacity:0;transform:translateY(20px) scale(0.96);}to{opacity:1;transform:translateY(0) scale(1);}}
            .sunodl-btn{padding:10px 16px;border-radius:999px;font-family:'PP Neue Montreal',sans-serif;font-size:13px;font-weight:500;border:1px solid transparent;cursor:pointer;transition:all 0.2s;display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;}
            .sunodl-btn-accent{background:linear-gradient(135deg,#a994ff,#7c5cff);color:#fff;box-shadow:0 4px 20px rgba(124,92,255,0.35);}
            .sunodl-btn-accent:hover{box-shadow:0 6px 24px rgba(124,92,255,0.5);transform:translateY(-1px);}
            .sunodl-btn-accent:disabled{opacity:0.4;cursor:not-allowed;transform:none;}
            .sunodl-btn-danger{background:rgba(248,113,113,0.15);color:#f87171;border:1px solid rgba(248,113,113,0.2);}
            .sunodl-btn-ghost{background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.08);}
            .sunodl-btn-ghost:hover{background:rgba(255,255,255,0.1);color:#fff;}
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
            .sunodl-track-row.downloaded:hover{background:rgba(74,222,128,0.1);}
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
        </style>

        <div id="sunodl" style="position:fixed;bottom:16px;right:16px;z-index:99999;background:${SUNO.bgPrimary};color:${SUNO.textPrimary};font-family:${SUNO.font};width:620px;max-width:calc(100vw - 32px);border-radius:20px;border:1px solid ${SUNO.border};box-shadow:0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.02) inset;overflow:hidden;display:flex;flex-direction:column;max-height:calc(100vh - 32px);">
            <div style="display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid ${SUNO.border};flex-shrink:0;">
                <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,${SUNO.accent},#7c5cff);display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 16px rgba(124,92,255,0.3);">🎵</div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:500;font-size:15px;letter-spacing:-0.2px;">Suno Downloader</div>
                    <div style="font-size:11px;color:${SUNO.textTertiary};letter-spacing:0.3px;margin-top:1px;">v${VERSION} · IndexedDB · live · net-diag</div>
                </div>
                <button id="sunodl-sound" class="sunodl-icon-btn" title="Звук">🔊</button>
                <button id="sunodl-clear" class="sunodl-icon-btn" title="Очистить лог">🗑</button>
                <button id="sunodl-close" class="sunodl-icon-btn" title="Закрыть">✕</button>
            </div>

            <div id="sunodl-status" style="padding:14px 18px;border-bottom:1px solid ${SUNO.border};display:flex;align-items:center;gap:10px;flex-shrink:0;">
                <div id="sunodl-status-dot" class="sunodl-pulse" style="width:8px;height:8px;border-radius:50%;background:${SUNO.accent};flex-shrink:0;"></div>
                <div id="sunodl-status-text" style="font-size:13px;color:${SUNO.textSecondary};">Инициализация...</div>
            </div>

            <!-- СПИСОК ТРЕКОВ -->
            <div id="sunodl-list-panel" style="display:none;padding:14px 18px;border-bottom:1px solid ${SUNO.border};flex-shrink:0;">
                <div id="sunodl-db-summary" class="sunodl-db-summary" style="display:none;">
                    <div class="dot" style="background:#38bdf8;"></div>
                    <div style="flex:1;">
                        <span style="color:#38bdf8;font-weight:500;">IndexedDB</span> · <span id="sunodl-db-count">0</span> скачано
                    </div>
                    <button id="sunodl-db-clear" class="sunodl-btn sunodl-btn-ghost" style="padding:4px 10px;font-size:10px;" title="Очистить базу скачанных">🗑 база</button>
                </div>

                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px;">
                    <div style="font-size:12px;color:${SUNO.textSecondary};letter-spacing:0.2px;">ВЫБЕРИ ТРЕКИ</div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        <button id="sunodl-filter-new" class="sunodl-btn sunodl-btn-ghost" style="padding:5px 10px;font-size:11px;" title="Скрыть уже скачанные">Только новые</button>
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

            <!-- ОБЩИЙ ПРОГРЕСС -->
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

            <!-- ТЕКУЩИЙ ТРЕК -->
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

    function setStatus(text, kind='idle') {
        statusText.textContent = text;
        const c = {idle:SUNO.accent, ok:SUNO.success, err:SUNO.danger, warn:SUNO.warning, stall:'#ff8c42'};
        statusDot.style.background = c[kind] || SUNO.accent;
        statusDot.classList.toggle('sunodl-pulse', kind==='idle');
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
        $('sunodl-batch-eta').textContent =
            `⏱ ETA ${fmtEta(etaSec)} · avg ${fmtSpeed(avgSpeed)} · elapsed ${fmtEta(elapsed)}`;
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

    function sanitizeName(n) {
        return (n||'suno_track').replace(/[\\/:*?"<>|]/g,'_').replace(/[\x00-\x1f]/g,'').replace(/\s+/g,' ').trim().slice(0,80)||'suno_track';
    }

    // ===== СПИСОК =====
    function renderList(clips) {
        listEl.innerHTML = '';

        // фильтр "только новые"
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

            // бейдж
            let badgeText = 'FULL', badgeClass = '';
            if (isPreview) { badgeText = 'PREVIEW'; badgeClass = 'bad'; }
            else if (!isFull) { badgeText = 'PART'; badgeClass = 'bad'; }
            else if (isDownloaded) { badgeText = '✓ ЕСТЬ'; badgeClass = 'downloaded'; }
            else { badgeText = 'NEW'; badgeClass = 'new'; }

            // мета скачанного
            let metaHtml = '';
            if (isDownloaded) {
                const rec = state.downloadedMeta.get(c.id);
                if (rec) {
                    const sizeStr = rec.size ? fmtBytes(rec.size) : '';
                    const agoStr = rec.downloadedAt ? fmtAgo(rec.downloadedAt) : '';
                    metaHtml = `<div class="sunodl-track-meta">${sizeStr}${sizeStr&&agoStr?' · ':''}${agoStr}</div>`;
                }
            }

            row.innerHTML = `
                <div class="sunodl-checkbox ${checked?(isDownloaded?'downloaded-checked':'checked'):''}">${checked?'✓':''}</div>
                <div class="sunodl-track-idx">${String(i+1).padStart(2,'0')}</div>
                <div class="sunodl-track-title" title="${(c.title||'—').replace(/"/g,'&quot;')}">${c.title||'—'}${isPreview?' · 60s':''}</div>
                ${metaHtml}
                <div class="sunodl-track-badge ${badgeClass}">${badgeText}</div>
            `;

            row.onclick = () => {
                if (!canDownload) {
                    logWarn(isPreview ? 'Preview — только 60s, пропускаю' : 'Неполный трек');
                    Sound.error();
                    return;
                }
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
            empty.textContent = '🎉 Все треки уже скачаны! Выключи "Только новые" чтобы перекачать.';
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
        listInfo.innerHTML = `Выбрано: <span style="color:${SUNO.accent};font-weight:bold;">${state.selected.size}</span> · Всего: ${allClips.length} · Скачиваемых: ${full} · <span style="color:${SUNO.success};">✓ ${downloadedCount}</span> · <span style="color:${SUNO.accent};">🆕 ${newCount}</span>`;
        $('sunodl-start-batch').disabled = state.selected.size === 0;
    }

    // ===== API =====
    async function fetchAllClips(onPage) {
        const jwt = await getJwt();
        if (!jwt) throw new Error('Нет JWT');

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
        let cursor = null;
        let page = 0;
        let hasMore = true;
        const tStart = performance.now();

        while (page < 50 && hasMore) {
            page++;
            headers['browser-token'] = makeBrowserToken();

            const body = cursor ? { cursor, limit: 30 } : { limit: 30 };
            logNet(`POST feed/v3 · page ${page}${cursor?' · cursor='+cursor.slice(0,8)+'…':''}`);

            const tPage = performance.now();
            let r;
            try {
                r = await timedFetch('https://studio-api-prod.suno.com/api/feed/v3', {
                    method: 'POST', headers, credentials: 'same-origin',
                    body: JSON.stringify(body)
                }, 30000, `feed/v3 p${page}`);
            } catch(e) {
                logErr(`page ${page}: ${e.message}`);
                break;
            }

            const ms = (performance.now()-tPage).toFixed(0);
            log(`  ← HTTP ${r.status} · ${ms}ms`,
                r.ok ? SUNO.success : SUNO.danger, r.ok ? CS.ok : CS.err);
            if (!r.ok) break;

            const data = await r.json();

            if (page === 1) {
                log(`  🔍 keys: ${Object.keys(data).join(', ')}`, SUNO.accent, CS.accent);
                console.log('🔍 feed/v3 page1 full:', data);
            }

            const clips = (data?.clips || [])
                .filter(c => c && c.id && (c.status === 'complete' || !c.status));

            if (clips.length === 0) {
                logWarn(`page ${page}: пусто`);
                break;
            }

            let added = 0, previewCount = 0, lockedCount = 0, alreadyHave = 0;
            for (const c of clips) {
                if (seen.has(c.id)) continue;
                seen.add(c.id);
                all.push(c);
                added++;
                if (c.type === 'preview' || c.preview_seconds) previewCount++;
                if (c.is_download_unlocked === false) lockedCount++;
                if (state.downloadedIds.has(c.id)) alreadyHave++;
            }

            const nextCursor = data.next_cursor || data.cursor || null;
            hasMore = data.has_more === true && !!nextCursor;

            logOk(`page ${page}: +${added} · всего ${all.length} · has_more=${data.has_more}` +
                  (previewCount ? ` · ⚠ ${previewCount} preview` : '') +
                  (lockedCount ? ` · 🔒 ${lockedCount} locked` : '') +
                  (alreadyHave ? ` · ✓ ${alreadyHave} уже есть` : ''));

            if (onPage) onPage(page, all.length, hasMore);

            if (!hasMore) {
                log(`  ⏹ конец (has_more=${data.has_more})`, SUNO.textTertiary, CS.dim);
                break;
            }
            if (seen.has(nextCursor)) {
                logWarn(`  ⚠ курсор уже видели — стоп`);
                break;
            }

            cursor = nextCursor;
        }

        const totalMs = (performance.now()-tStart).toFixed(0);
        logOk(`📦 ИТОГО: ${all.length} треков · ${page} стр. · ${(totalMs/1000).toFixed(1)}s`);
        return all;
    }

    async function fetchLicense(clipId) {
        const t = performance.now();
        const jwt = await getJwt();
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

    // ===== РАСШИФРОВКА =====
    async function decryptClip(clipId, cdnUrl, license, onProgress) {
        const jwt = await getJwt();
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
        try {
            r = await fetch(cdnUrl, { signal: ctrl.signal });
        } catch(e) {
            clearTimeout(hardTimeout);
            if (e.name === 'AbortError') throw new Error('⏱ CDN HARD TIMEOUT 300s');
            throw new Error(`🌐 CDN fetch: ${e.message}`);
        }
        if (!r.ok) { clearTimeout(hardTimeout); throw new Error(`CDN HTTP ${r.status}`); }

        const total = parseInt(r.headers.get('content-length') || '0', 10);
        const hdrMs = (performance.now()-t1).toFixed(0);
        logNet(`CDN headers OK · ${hdrMs}ms · ${total>0?(total/1048576).toFixed(2)+' MB':'unknown size'}`);

        if (onProgress) onProgress(0, total, 0, 0, 0, false,
            `📦 Заголовки OK · ${fmtBytes(total)} · ждём данные...`,
            'ожидание первого чанка', '');

        const reader = r.body.getReader();
        const chunks = [];
        let loaded = 0;
        let lastTick = 0;
        let lastChunkAt = performance.now();
        let lastPct = 0;
        let stallWarned = false;
        let chunkCount = 0;
        let speedSamples = [];
        const SAMPLE_WINDOW = 5;

        const firstChunkTimeout = setTimeout(() => {
            if (loaded === 0) {
                logWarn(`⚠ Нет ни байта за ${FIRST_CHUNK_TIMEOUT/1000}s после headers — рвём, retry`);
                ctrl.abort();
            }
        }, FIRST_CHUNK_TIMEOUT);

        const hb = setInterval(() => {
            const now = performance.now();
            const sinceChunk = now - lastChunkAt;
            const sec = (now - t1) / 1000;
            const sp = sec > 0 ? (loaded/1048576/sec) : 0;
            const pct = total > 0 ? (loaded/total*100) : 0;

            if (sinceChunk > STALL_THRESHOLD_MS && !stallWarned) {
                stallWarned = true;
                logStall(`STALL ${(sinceChunk/1000).toFixed(1)}s · нет чанков · загружено ${fmtBytes(loaded)} · ${fmtSpeed(sp)}`);
                Sound.stall();
                if (onProgress) onProgress(loaded, total, sp, pct, sinceChunk, true,
                    `🐌 STALL ${(sinceChunk/1000).toFixed(0)}s · ${fmtBytes(loaded)}/${fmtBytes(total)}`,
                    `нет данных ${(sinceChunk/1000).toFixed(1)}s`, '');

                if (sinceChunk > GLOBAL_STALL_TIMEOUT && loaded > 0) {
                    logWarn(`⚠ Глобальный stall ${(sinceChunk/1000).toFixed(0)}s — рвём, retry`);
                    ctrl.abort();
                }
            } else if (sinceChunk < 1500 && stallWarned) {
                stallWarned = false;
                logOk(`сеть ожила · +${fmtBytes(loaded)}`);
            } else if (!stallWarned && chunkCount > 0) {
                logHb(`hb · ${fmtBytes(loaded)} · ${fmtSpeed(sp)} · last-chunk ${(sinceChunk/1000).toFixed(1)}s ago · chunks ${chunkCount}`);
            }
        }, HEARTBEAT_MS);

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                if (loaded === 0 && firstChunkTimeout) {
                    clearTimeout(firstChunkTimeout);
                    logOk(`первый чанк получен · ${fmtBytes(value.byteLength)}`);
                }

                chunks.push(value);
                loaded += value.byteLength;
                lastChunkAt = performance.now();
                chunkCount++;

                const now = performance.now();
                if (lastTick === 0 || now - lastTick > UI_THROTTLE_MS) {
                    lastTick = now;
                    const sec = (now - t1) / 1000;
                    const instantSp = sec > 0 ? (loaded/1048576/sec) : 0;

                    speedSamples.push(instantSp);
                    if (speedSamples.length > SAMPLE_WINDOW) speedSamples.shift();
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
                if (loaded === 0) throw new Error(`⏱ Нет данных за ${FIRST_CHUNK_TIMEOUT/1000}s после headers`);
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
            `🔓 Расшифровка ${fmtBytes(enc.byteLength)}...`, 'AES-CTR decrypt', '');

        log(`  🔓 Decrypt ${fmtBytes(enc.byteLength)}...`, SUNO.accent, CS.accent);
        const t2 = performance.now();
        const dec = await crypto.subtle.decrypt(
            { name:'AES-CTR', counter:new Uint8Array(aiv), length:128 },
            ctr,
            enc
        );
        const decMs = (performance.now()-t2).toFixed(0);
        logOk(`Расшифровано за ${decMs}ms · ${fmtBytes(dec.byteLength)}`);

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

    // ===== СОХРАНЕНИЕ: [01] В КОНЦЕ ИМЕНИ =====
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

    // ===== ОДИН ТРЕК =====
    async function processTrack(clip, seqNum, idxInBatch, totalInBatch) {
        const title = clip.title || `suno_${clip.id.slice(0,8)}`;
        const cdnUrl = clip.media_urls[0].url;
        const tT0 = performance.now();

        logStep(`[${idxInBatch+1}/${totalInBatch}] [${String(seqNum).padStart(2,'0')}] "${title.slice(0,40)}"`);
        setCurrent(title, idxInBatch, totalInBatch, 'Начинаем...', 0, 'idle', 'init', '');

        for (let attempt=1; attempt<=MAX_ATTEMPTS; attempt++) {
            if (state.batchCancel) return;

            if (attempt > 1) {
                log(`  🔄 Попытка ${attempt}/${MAX_ATTEMPTS}`, SUNO.warning, CS.warn);
                await new Promise(r=>setTimeout(r, 800*attempt));
            }

            try {
                setCurrent(title, idxInBatch, totalInBatch, '🔑 License...', 2, 'license', 'ожидание /api/mango/rights', '');
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
                    const net = netInfo || `${fmtBytes(loaded)}/${fmtBytes(totalBytes)} · ${fmtSpeed(speed)}`;
                    const eta = etaInfo || '';

                    setCurrent(title, idxInBatch, totalInBatch, stage, dispPct, st, net, eta);
                });

                state.batchBytesDone += size;

                setCurrent(title, idxInBatch, totalInBatch, '💾 Сохранение в Загрузки...', 96, 'idle', `${fmtBytes(size)} записывается`, '');
                Sound.save();
                saveToDownloads(blob, title, seqNum);
                setCurrent(title, idxInBatch, totalInBatch, '✅ Готово', 100, 'done', `${fmtBytes(size)} сохранено`, '');

                // ⚡ запись в IndexedDB
                try {
                    await dbAdd({
                        id: clip.id,
                        title: clip.title || '',
                        size: size,
                        downloadedAt: Date.now(),
                        filename: sanitizeName(title) + ` [${String(seqNum).padStart(2,'0')}].` + (blob.type.includes('webm') ? 'webm' : 'm4a'),
                        model: clip.major_model_version || '',
                        duration: clip.metadata?.duration || 0
                    });
                    state.downloadedIds.add(clip.id);
                    state.downloadedMeta.set(clip.id, {
                        id: clip.id, title: clip.title, size, downloadedAt: Date.now()
                    });
                    logDb(`записан в базу: ${clip.id.slice(0,8)}…`);
                } catch(e) {
                    logWarn(`IndexedDB write fail: ${e.message}`);
                }

                const tMs = (performance.now()-tT0).toFixed(0);
                logOk(`ГОТОВО · ${(tMs/1000).toFixed(1)}s · ${fmtBytes(size)}`);

                state.batchDone++;
                updateBatchProgress();
                setTimeout(()=>Sound.trackDone(), 100);
                return;

            } catch(e) {
                console.log(`%c   ⚠ Попытка ${attempt}: ${e.message}`, 'color:#fbbf24;');
                if (attempt >= MAX_ATTEMPTS) {
                    state.batchErrors++;
                    logErr(`"${title.slice(0,40)}" — ${e.message}`);
                    setCurrent(title, idxInBatch, totalInBatch, `❌ ${e.message.slice(0,60)}`, 100, 'error', 'ошибка', '');
                    updateBatchProgress();
                    Sound.error();
                }
            }
        }
    }

    // ===== ПОДГОТОВКА СПИСКА =====
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

        try {
            const jwt = await getJwt(true);
            if (!jwt) { logErr('Нет JWT'); Sound.error(); state.phase='idle'; $('sunodl-all').disabled=false; return; }
            logOk(`JWT · ${jwt.length} символов`);

            const clips = await fetchAllClips((page, count, hasMore) => {
                setStatus(`Стр. ${page} · собрано ${count}${hasMore?' · ещё...':' · всё'}`, 'idle');
            });
            if (clips.length === 0) throw new Error('Список пуст');

            state.allClips = clips;
            logOk(`Получено ${clips.length} треков`);

            const full = clips.filter(c => {
                const isFull = c?.media_urls?.[0]?.url?.includes('cloudfront');
                const isPreview = c.type === 'preview' || !!c.preview_seconds;
                return isFull && !isPreview;
            });
            logOk(`Скачиваемых (полные + не-preview): ${full.length}`);

            const alreadyDownloaded = clips.filter(c => state.downloadedIds.has(c.id)).length;
            const newTracks = full.length - clips.filter(c => state.downloadedIds.has(c.id) && c?.media_urls?.[0]?.url?.includes('cloudfront') && !(c.type==='preview'||c.preview_seconds)).length;
            logOk(`✓ уже скачано: ${alreadyDownloaded} · 🆕 новых: ${newTracks}`, '#38bdf8', CS.db);

            // показываем DB summary
            if (state.downloadedIds.size > 0) {
                dbSummary.style.display = 'flex';
                $('sunodl-db-count').textContent = state.downloadedIds.size;
            }

            // авто-выбор только новых (не скачанных)
            clips.forEach((c, i) => {
                const isFull = c?.media_urls?.[0]?.url?.includes('cloudfront');
                const isPreview = c.type === 'preview' || !!c.preview_seconds;
                if (isFull && !isPreview && !state.downloadedIds.has(c.id)) {
                    state.selected.add(i);
                }
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

    // ===== СТАРТ БАТЧА =====
    async function startBatch() {
        if (state.isBatch) return;
        if (state.selected.size === 0) { logWarn('Ничего не выбрано'); Sound.error(); return; }

        const idxs = Array.from(state.selected).sort((a,b)=>a-b);
        const clipsToDownload = idxs.map(i => state.allClips[i]);

        console.log(`\n%c╔════════════════════════════════════════╗`, 'color:#a994ff;font-weight:bold;');
        console.log(`%c║  🚀 SUNO BATCH v${VERSION} · ${clipsToDownload.length} tracks`, 'color:#a994ff;font-weight:bold;');
        console.log(`%c╚════════════════════════════════════════╝`, 'color:#a994ff;font-weight:bold;');

        Sound.start();
        logStep(`СТАРТ БАТЧА · ${clipsToDownload.length} треков`);

        state.isBatch = true;
        state.batchCancel = false;
        state.batchErrors = 0;
        state.batchDone = 0;
        state.batchSkipped = 0;
        state.batchTotal = clipsToDownload.length;
        state.batchBytesDone = 0;
        state.batchStartTime = performance.now();
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
            console.log(`\n%c╔════════════════════════════════════════╗`, 'color:#4ade80;font-weight:bold;');
            console.log(`%c║  🎉 BATCH COMPLETE                     ║`, 'color:#4ade80;font-weight:bold;');
            console.log(`%c║  ✅ ${state.batchDone}/${state.batchTotal} · ${state.batchErrors} ошибок · ${(tMs/1000).toFixed(1)}s`, 'color:#4ade80;font-weight:bold;');
            console.log(`%c╚════════════════════════════════════════╝`, 'color:#4ade80;font-weight:bold;');

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

        state.isBatch = false;
        state.phase = 'done';
        $('sunodl-all').disabled = false;
        $('sunodl-all').innerHTML = '<span style="font-size:15px;">⬇</span> Обновить список';
        $('sunodl-stop').style.display = 'none';
    }

    // ===== ОБРАБОТЧИКИ =====
    $('sunodl-sound').onclick = () => {
        Sound.enabled=!Sound.enabled;
        $('sunodl-sound').textContent=Sound.enabled?'🔊':'🔇';
        if (Sound.enabled) Sound.click();
    };
    $('sunodl-clear').onclick = () => { logEl.innerHTML=''; console.clear(); };
    $('sunodl-close').onclick = () => {
        if (state.isBatch && !confirm('Батч идёт. Закрыть?')) return;
        state.batchCancel=true;
        $('sunodl').remove();
    };
    $('sunodl-all').onclick = () => {
        if (state.phase === 'done') {
            state.phase = 'idle';
            state.selected.clear();
            listEl.innerHTML = '';
            prepareList();
        } else {
            prepareList();
        }
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

    // ⚡ фильтр "только новые"
    $('sunodl-filter-new').onclick = () => {
        state.filterOnlyNew = !state.filterOnlyNew;
        $('sunodl-filter-new').classList.toggle('active', state.filterOnlyNew);
        renderList(state.allClips);
        Sound.click();
    };

    // ⚡ очистка IndexedDB
    $('sunodl-db-clear').onclick = async () => {
        if (!confirm('Очистить базу скачанных треков? Файлы в Загрузках останутся, но скрипт перестанет их "узнавать".')) return;
        try {
            await dbClear();
            state.downloadedIds.clear();
            state.downloadedMeta.clear();
            logDb('база очищена');
            dbSummary.style.display = 'none';
            renderList(state.allClips);
            Sound.click();
        } catch(e) {
            logErr(`db clear: ${e.message}`);
        }
    };

    // ===== INIT =====
    log(`Suno Downloader v${VERSION}`, SUNO.accent, CS.accent);
    log(`IndexedDB · live · net-diag · suffix number`, SUNO.textTertiary, CS.dim);
    log(`device-id: ${DEVICE_ID.slice(0,8)}…`, SUNO.textTertiary, CS.dim);

    (async () => {
        // ⚡ грузим IndexedDB сразу при старте
        try {
            await dbInit();
            await dbLoadDownloaded();
        } catch(e) {
            logWarn(`IndexedDB init fail: ${e.message}`);
        }

        const j = await getJwt();
        if (j) { logOk('JWT готов'); setStatus('Нажми "Загрузить список"', 'ok'); }
        else { logWarn('Ждём JWT...'); setStatus('Открой любой трек', 'warn'); }
    })();

    console.log(`%c✅ Suno Downloader v${VERSION} готов`, 'color:#4ade80;font-weight:bold;font-size:14px;');
})();
