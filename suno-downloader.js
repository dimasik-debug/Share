/**
 * Suno Downloader v11.0 — Network Diagnostics + Selection UI + Numbered Saves
 * 🔍 Живая диагностика сети (heartbeat, stall-detector, per-stage timers)
 * 📋 Список треков с чекбоксами
 * 🔢 Префикс номера [01] в имени файла
 * 📊 2 прогресса: общий батч + текущий трек (download / decrypt)
 */
(function sunoDownloaderV110() {
    const VERSION = '11.0';
    const MAX_ATTEMPTS = 3;
    const STALL_THRESHOLD_MS = 5000;   // нет чанков 5с = stall
    const HEARTBEAT_MS = 2000;         // heartbeat каждые 2с

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
        stall:'color:#ff8c42;font-weight:bold;', hb:'color:#5a6a7a;'
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
        batchTotal:0, batchDone:0, batchErrors:0,
        allClips:[], selected:new Set(),
        phase:'idle' // idle | list | downloading | done
    };

    function b64(b) {
        const bin = atob(b); const u = new Uint8Array(bin.length);
        for (let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
        return u;
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

    // ===== СЕТЬ: диагностический fetch =====
    async function timedFetch(url, opts={}, timeoutMs=300000, label='fetch') {
        const c = new AbortController();
        const t = setTimeout(()=>c.abort(), timeoutMs);
        const tStart = performance.now();
        try {
            const r = await fetch(url,{...opts, signal:c.signal});
            clearTimeout(t);
            const ms = (performance.now()-tStart).toFixed(0);
            if (!navigator.onLine) log(`  ⚠ navigator.onLine=false (ответ всё равно пришёл за ${ms}ms)`, SUNO.warning, CS.warn);
            return r;
        }
        catch(e){
            clearTimeout(t);
            const ms = (performance.now()-tStart).toFixed(0);
            if (e.name==='AbortError') {
                throw new Error(`⏱ TIMEOUT ${timeoutMs}ms (${label}, шло ${ms}ms)`);
            }
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
            .sunodl-icon-btn{width:32px;height:32px;padding:0;border-radius:10px;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.6);border:none;cursor:pointer;transition:all 0.2s;display:inline-flex;align-items:center;justify-content:center;font-size:14px;}
            .sunodl-icon-btn:hover{background:rgba(255,255,255,0.1);color:#fff;}
            #sunodl-log::-webkit-scrollbar{width:6px;}
            #sunodl-log::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px;}
            #sunodl-list::-webkit-scrollbar{width:6px;}
            #sunodl-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px;}
            .sunodl-pulse{animation:sunodl-pulse 2s ease-in-out infinite;}
            @keyframes sunodl-pulse{0%,100%{opacity:1;}50%{opacity:0.5;}}
            .sunodl-progress-bar{width:100%;height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;}
            .sunodl-progress-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,#a994ff,#7c5cff);transition:width 0.3s ease;}
            .sunodl-progress-fill.done{background:linear-gradient(90deg,#4ade80,#22c55e);}
            .sunodl-progress-fill.error{background:linear-gradient(90deg,#f87171,#dc2626);}
            .sunodl-progress-fill.license{background:linear-gradient(90deg,#fbbf24,#f59e0b);}
            .sunodl-progress-fill.stall{background:linear-gradient(90deg,#ff8c42,#ff5722);}
            .sunodl-track-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;transition:background 0.15s;border:1px solid transparent;}
            .sunodl-track-row:hover{background:rgba(255,255,255,0.04);}
            .sunodl-track-row.selected{background:rgba(169,148,255,0.08);border-color:rgba(169,148,255,0.2);}
            .sunodl-track-row.bad{opacity:0.5;}
            .sunodl-checkbox{width:16px;height:16px;border-radius:4px;border:1.5px solid rgba(255,255,255,0.25);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;transition:all 0.15s;background:transparent;}
            .sunodl-checkbox.checked{background:linear-gradient(135deg,#a994ff,#7c5cff);border-color:transparent;}
            .sunodl-track-idx{font-size:10px;color:rgba(255,255,255,0.3);font-family:'SF Mono',monospace;width:24px;flex-shrink:0;}
            .sunodl-track-title{font-size:12px;color:rgba(255,255,255,0.85);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
            .sunodl-track-badge{font-size:9px;padding:2px 6px;border-radius:4px;background:rgba(74,222,128,0.15);color:#4ade80;flex-shrink:0;font-family:'SF Mono',monospace;}
            .sunodl-track-badge.bad{background:rgba(248,113,113,0.15);color:#f87171;}
        </style>

        <div id="sunodl" style="position:fixed;bottom:16px;right:16px;z-index:99999;background:${SUNO.bgPrimary};color:${SUNO.textPrimary};font-family:${SUNO.font};width:560px;max-width:calc(100vw - 32px);border-radius:20px;border:1px solid ${SUNO.border};box-shadow:0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.02) inset;overflow:hidden;display:flex;flex-direction:column;max-height:calc(100vh - 32px);">
            <div style="display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid ${SUNO.border};flex-shrink:0;">
                <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,${SUNO.accent},#7c5cff);display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 16px rgba(124,92,255,0.3);">🎵</div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:500;font-size:15px;letter-spacing:-0.2px;">Suno Downloader</div>
                    <div style="font-size:11px;color:${SUNO.textTertiary};letter-spacing:0.3px;margin-top:1px;">v${VERSION} · net-diag · select UI</div>
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
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <div style="font-size:12px;color:${SUNO.textSecondary};letter-spacing:0.2px;">ВЫБЕРИ ТРЕКИ</div>
                    <div style="display:flex;gap:6px;">
                        <button id="sunodl-sel-all" class="sunodl-btn sunodl-btn-ghost" style="padding:5px 10px;font-size:11px;">Все</button>
                        <button id="sunodl-sel-none" class="sunodl-btn sunodl-btn-ghost" style="padding:5px 10px;font-size:11px;">Ничего</button>
                    </div>
                </div>
                <div id="sunodl-list" style="max-height:260px;overflow-y:auto;background:${SUNO.bgSecondary};border-radius:10px;padding:6px;border:1px solid ${SUNO.border};"></div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
                    <div id="sunodl-list-info" style="font-size:11px;color:${SUNO.textTertiary};">—</div>
                    <button id="sunodl-start-batch" class="sunodl-btn sunodl-btn-accent" style="padding:9px 18px;">▶ Старт</button>
                </div>
            </div>

            <!-- ОБЩИЙ ПРОГРЕСС БАТЧА -->
            <div id="sunodl-batch" style="display:none;padding:14px 18px;border-bottom:1px solid ${SUNO.border};flex-shrink:0;">
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;">
                    <div style="font-size:12px;color:${SUNO.textSecondary};letter-spacing:0.2px;">ОБЩИЙ ПРОГРЕСС</div>
                    <div style="display:flex;align-items:baseline;gap:6px;">
                        <span id="sunodl-batch-done" style="font-size:20px;font-weight:500;color:${SUNO.textPrimary};">0</span>
                        <span style="font-size:13px;color:${SUNO.textTertiary};">/ <span id="sunodl-batch-total">0</span></span>
                    </div>
                </div>
                <div class="sunodl-progress-bar" style="margin-bottom:10px;">
                    <div id="sunodl-batch-bar" class="sunodl-progress-fill done" style="width:0%;"></div>
                </div>
                <div id="sunodl-batch-stats" style="display:flex;justify-content:space-between;font-size:10px;color:${SUNO.textTertiary};font-family:'SF Mono',monospace;">
                    <span id="sunodl-batch-ok">✓ 0 OK</span>
                    <span id="sunodl-batch-err">✕ 0 errors</span>
                </div>
            </div>

            <!-- ТЕКУЩИЙ ТРЕК -->
            <div id="sunodl-current" style="display:none;padding:14px 18px;border-bottom:1px solid ${SUNO.border};flex-shrink:0;">
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;">
                    <div id="sunodl-current-title" style="font-size:13px;color:${SUNO.textPrimary};font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:380px;">—</div>
                    <div id="sunodl-current-count" style="font-size:13px;color:${SUNO.textTertiary};">0/0</div>
                </div>
                <div class="sunodl-progress-bar" style="margin-bottom:8px;"><div id="sunodl-current-bar" class="sunodl-progress-fill" style="width:0%;"></div></div>
                <div id="sunodl-current-stage" style="font-size:11px;color:${SUNO.textSecondary};font-family:'SF Mono',monospace;">—</div>
                <div id="sunodl-current-net" style="font-size:10px;color:${SUNO.textTertiary};font-family:'SF Mono',monospace;margin-top:4px;">net: —</div>
            </div>

            <div style="padding:14px 18px;border-bottom:1px solid ${SUNO.border};flex-shrink:0;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="font-size:11px;color:${SUNO.textTertiary};letter-spacing:0.3px;font-weight:500;">DIAG LOG</span>
                    <span style="font-size:10px;color:${SUNO.textTertiary};">live · console too</span>
                </div>
                <div id="sunodl-log" style="font-size:11px;color:${SUNO.textSecondary};background:${SUNO.bgSecondary};padding:12px 14px;border-radius:12px;max-height:220px;overflow-y:auto;font-family:'SF Mono',Consolas,'Courier New',monospace;line-height:1.6;border:1px solid ${SUNO.border};"></div>
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

    setInterval(()=>{ timerEl.textContent = ts(); }, 100);
    setInterval(()=>{ netStatusEl.textContent = navigator.onLine ? '🌐 online' : '📡 OFFLINE'; netStatusEl.style.color = navigator.onLine ? SUNO.textTertiary : SUNO.danger; }, 500);

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

    function setStatus(text, kind='idle') {
        statusText.textContent = text;
        const c = {idle:SUNO.accent, ok:SUNO.success, err:SUNO.danger, warn:SUNO.warning, stall:'#ff8c42'};
        statusDot.style.background = c[kind] || SUNO.accent;
        statusDot.classList.toggle('sunodl-pulse', kind==='idle');
    }

    function updateBatchProgress() {
        batchEl.style.display = 'block';
        $('sunodl-batch-done').textContent = state.batchDone;
        $('sunodl-batch-total').textContent = state.batchTotal;
        $('sunodl-batch-bar').style.width = state.batchTotal > 0
            ? `${Math.round(state.batchDone/state.batchTotal*100)}%`
            : '0%';
        $('sunodl-batch-ok').textContent = `✓ ${state.batchDone} OK`;
        $('sunodl-batch-err').textContent = `✕ ${state.batchErrors} errors`;
    }

    function setCurrent(title, done, total, stage, pct, state_, netInfo) {
        currentEl.style.display = 'block';
        $('sunodl-current-title').textContent = title;
        $('sunodl-current-count').textContent = `${done}/${total}`;
        $('sunodl-current-stage').textContent = stage;
        if (netInfo !== undefined) $('sunodl-current-net').textContent = 'net: ' + netInfo;
        const bar = $('sunodl-current-bar');
        bar.style.width = pct+'%';
        bar.className = 'sunodl-progress-fill' + (state_ === 'error' ? ' error' : state_ === 'done' ? ' done' : state_ === 'license' ? ' license' : state_ === 'stall' ? ' stall' : '');
    }

    function sanitizeName(n) {
        return (n||'suno_track').replace(/[\\/:*?"<>|]/g,'_').replace(/[\x00-\x1f]/g,'').replace(/\s+/g,' ').trim().slice(0,80)||'suno_track';
    }

    // ===== СПИСОК С ЧЕКБОКСАМИ =====
    function renderList(clips) {
        listEl.innerHTML = '';
        clips.forEach((c, i) => {
            const isFull = c?.media_urls?.[0]?.url?.includes('cloudfront');
            const row = document.createElement('div');
            row.className = 'sunodl-track-row' + (isFull ? '' : ' bad');
            row.dataset.idx = i;
            const checked = state.selected.has(i);
            if (checked) row.classList.add('selected');
            row.innerHTML = `
                <div class="sunodl-checkbox ${checked?'checked':''}">${checked?'✓':''}</div>
                <div class="sunodl-track-idx">${String(i+1).padStart(2,'0')}</div>
                <div class="sunodl-track-title" title="${(c.title||'—').replace(/"/g,'&quot;')}">${c.title||'—'}</div>
                <div class="sunodl-track-badge ${isFull?'':'bad'}">${isFull?'FULL':'PART'}</div>
            `;
            row.onclick = () => {
                if (!isFull) { logWarn('Трек неполный (нет cloudfront URL)'); Sound.error(); return; }
                if (state.selected.has(i)) state.selected.delete(i); else state.selected.add(i);
                Sound.click();
                row.classList.toggle('selected');
                const cb = row.querySelector('.sunodl-checkbox');
                cb.classList.toggle('checked');
                cb.textContent = state.selected.has(i) ? '✓' : '';
                updateListInfo();
            };
            listEl.appendChild(row);
        });
        updateListInfo();
    }

    function updateListInfo() {
        const full = state.allClips.filter(c => c?.media_urls?.[0]?.url?.includes('cloudfront')).length;
        listInfo.innerHTML = `Выбрано: <span style="color:${SUNO.accent};font-weight:bold;">${state.selected.size}</span> · Всего: ${state.allClips.length} · Полных: ${full}`;
        $('sunodl-start-batch').disabled = state.selected.size === 0;
    }

    // ===== API =====
    async function fetchAllClips() {
        const jwt = await getJwt();
        if (!jwt) throw new Error('Нет JWT');
        const headers = { 'Content-Type':'application/json', 'Authorization':'Bearer '+jwt };
        const all = [];
        let cursor = null;
        const seen = new Set();
        for (let page=0; page<20; page++) {
            const body = cursor ? { cursor, limit:200 } : { limit:200 };
            logNet(`POST feed/v3 (page ${page+1}${cursor?' cursor':''})`);
            const r = await timedFetch('https://studio-api-prod.suno.com/api/feed/v3', {
                method:'POST', headers, credentials:'same-origin', body:JSON.stringify(body)
            }, 20000, 'feed/v3');
            log(`  ← HTTP ${r.status}`, r.ok?SUNO.success:SUNO.danger, r.ok?CS.ok:CS.err);
            if (!r.ok) break;
            const data = await r.json();
            const clips = data?.clips || data?.data || data?.items || [];
            if (!Array.isArray(clips) || clips.length === 0) break;
            for (const c of clips) {
                if (c?.id && !seen.has(c.id)) { seen.add(c.id); all.push(c); }
            }
            logOk(`page ${page+1}: +${clips.length} (всего ${all.length})`);
            cursor = data?.next_cursor || data?.cursor || null;
            if (!cursor) break;
        }
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

    // ===== РАСШИФРОВКА с stall-детектором =====
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
        const t1 = performance.now();
        const ctrl = new AbortController();
        const hardTimeout = setTimeout(()=>ctrl.abort(), 600000);
        let r;
        try {
            r = await fetch(cdnUrl, { signal: ctrl.signal });
        } catch(e) {
            clearTimeout(hardTimeout);
            if (e.name === 'AbortError') throw new Error('⏱ CDN HARD TIMEOUT 600s');
            throw new Error(`🌐 CDN fetch: ${e.message}`);
        }
        if (!r.ok) { clearTimeout(hardTimeout); throw new Error(`CDN HTTP ${r.status}`); }

        const total = parseInt(r.headers.get('content-length') || '0', 10);
        const hdrMs = (performance.now()-t1).toFixed(0);
        logNet(`CDN headers OK · ${hdrMs}ms · ${total>0?(total/1048576).toFixed(2)+' MB':'unknown size'}`);

        const reader = r.body.getReader();
        const chunks = [];
        let loaded = 0;
        let lastTick = performance.now();
        let lastChunkAt = performance.now();
        let lastPct = 0;
        let stallWarned = false;

        // HEARTBEAT — каждые 2с пишем в лог что живы + stall check
        const hb = setInterval(() => {
            const now = performance.now();
            const sinceChunk = now - lastChunkAt;
            const sec = (now - t1) / 1000;
            const sp = sec > 0 ? (loaded/1048576/sec) : 0;
            const pct = total > 0 ? (loaded/total*100) : 0;

            if (onProgress) onProgress(loaded, total, sp, pct, sinceChunk);

            if (sinceChunk > STALL_THRESHOLD_MS && !stallWarned) {
                stallWarned = true;
                logStall(`STALL ${(sinceChunk/1000).toFixed(1)}s · нет чанков · загружено ${(loaded/1048576).toFixed(2)} MB · ${sp.toFixed(2)} MB/s`);
                Sound.stall();
                if (onProgress) onProgress(loaded, total, sp, pct, sinceChunk, true);
            } else if (sinceChunk < 1500 && stallWarned) {
                stallWarned = false;
                logOk(`сеть ожила · +${(loaded/1048576).toFixed(2)} MB`);
            } else if (!stallWarned) {
                // тихий heartbeat
                logHb(`hb · ${(loaded/1048576).toFixed(1)}MB · ${sp.toFixed(2)}MB/s · last-chunk ${(sinceChunk/1000).toFixed(1)}s ago`);
            }
        }, HEARTBEAT_MS);

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                loaded += value.byteLength;
                lastChunkAt = performance.now();

                const now = performance.now();
                if (now - lastTick > 200) {
                    lastTick = now;
                    const sec = (now - t1) / 1000;
                    const sp = sec > 0 ? (loaded/1048576/sec) : 0;
                    const pct = total > 0 ? (loaded/total*100) : 0;
                    if (onProgress) onProgress(loaded, total, sp, pct, 0);
                    if (pct - lastPct >= 25) {
                        lastPct = Math.floor(pct/25)*25;
                        log(`  ⬇ ${Math.round(pct)}% · ${sp.toFixed(2)} MB/s`, SUNO.textTertiary, CS.dim);
                    }
                }
            }
        } finally {
            clearInterval(hb);
            clearTimeout(hardTimeout);
        }

        const enc = new Uint8Array(loaded);
        let off = 0;
        for (const c of chunks) { enc.set(c, off); off += c.byteLength; }

        const dlMs = (performance.now()-t1).toFixed(0);
        const dlMBps = (enc.byteLength/1048576/(dlMs/1000)).toFixed(2);
        logOk(`Скачано ${(enc.byteLength/1048576).toFixed(2)} MB за ${(dlMs/1000).toFixed(1)}s (${dlMBps} MB/s)`);

        log(`  🔓 Decrypt ${(enc.byteLength/1048576).toFixed(2)} MB...`, SUNO.accent, CS.accent);
        const t2 = performance.now();
        const dec = await crypto.subtle.decrypt(
            { name:'AES-CTR', counter:new Uint8Array(aiv), length:128 },
            ctr,
            enc
        );
        logOk(`Расшифровано за ${(performance.now()-t2).toFixed(0)}ms`);

        const head = new Uint8Array(dec.slice(0, 16));
        const boxType = String.fromCharCode(head[4], head[5], head[6], head[7]);
        const isFtyp = boxType === 'ftyp';
        const isWebm = head[0]===0x1a && head[1]===0x45;

        console.log(`%c  🔍 Header: boxType="${boxType}" · ${isFtyp||isWebm?'✅':'❌'}`, isFtyp||isWebm?'color:#4ade80;':'color:#f87171;font-weight:bold;');

        if (!isFtyp && !isWebm) {
            const hex = Array.from(head).map(b=>b.toString(16).padStart(2,'0')).join(' ');
            throw new Error(`Битый файл: "${boxType}" · HEX: ${hex}`);
        }

        const mime = isFtyp ? 'audio/mp4' : 'audio/webm';
        return { blob: new Blob([dec], { type: mime }), isFtyp, size: dec.byteLength };
    }

    // ===== СОХРАНЕНИЕ С ПРЕФИКСОМ =====
    function saveToDownloads(blob, title, numPrefix) {
        const safe = sanitizeName(title);
        const ext = blob.type.includes('webm') ? 'webm' : 'm4a';
        const prefix = numPrefix ? `[${String(numPrefix).padStart(2,'0')}] ` : '';
        const fn = `${prefix}${safe}.${ext}`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fn; a.style.display = 'none';
        document.body.appendChild(a); a.click();
        setTimeout(()=>{ a.remove(); URL.revokeObjectURL(url); }, 3000);
        logOk(`💾 ${fn} (${(blob.size/1048576).toFixed(2)} MB)`);
        return fn;
    }

    // ===== ОДИН ТРЕК =====
    async function processTrack(clip, seqNum, idxInBatch, totalInBatch) {
        const title = clip.title || `suno_${clip.id.slice(0,8)}`;
        const cdnUrl = clip.media_urls[0].url;
        const tT0 = performance.now();

        console.log(`\n%c═══════════════════════════════════════`, 'color:#a994ff;');
        console.log(`%c▶ [${idxInBatch+1}/${totalInBatch}] [${String(seqNum).padStart(2,'0')}] "${title}"`, 'color:#a994ff;font-weight:bold;');

        logStep(`[${idxInBatch+1}/${totalInBatch}] [${String(seqNum).padStart(2,'0')}] "${title.slice(0,32)}"`);
        setCurrent(title, idxInBatch, totalInBatch, 'Начинаем...', 0, 'idle', `seq ${seqNum}`);

        for (let attempt=1; attempt<=MAX_ATTEMPTS; attempt++) {
            if (state.batchCancel) return;

            if (attempt > 1) {
                log(`  🔄 Попытка ${attempt}/${MAX_ATTEMPTS}`, SUNO.warning, CS.warn);
                await new Promise(r=>setTimeout(r, 800*attempt));
            }

            try {
                // 1) License
                setCurrent(title, idxInBatch, totalInBatch, 'License...', 2, 'license', 'ожидание ответа /api/mango/rights');
                const lic = await fetchLicense(clip.id);
                setCurrent(title, idxInBatch, totalInBatch, 'License OK', 8, 'license', 'license получен');

                // 2) Download + Decrypt
                const { blob, size } = await decryptClip(clip.id, cdnUrl, lic, (loaded, totalBytes, speed, pct, sinceChunk, isStall) => {
                    const dispPct = 8 + pct * 0.82;
                    const mb = (loaded/1048576).toFixed(1);
                    const tot = (totalBytes/1048576).toFixed(1);
                    let stage;
                    let st = 'idle';
                    if (isStall) { stage = `🐌 STALL ${(sinceChunk/1000).toFixed(0)}s · ${mb}/${tot} MB`; st = 'stall'; }
                    else { stage = `📥 ${mb} / ${tot} MB · ${speed.toFixed(2)} MB/s`; }
                    const net = `${(loaded/1048576).toFixed(2)}MB · ${speed.toFixed(2)}MB/s · last-chunk ${(sinceChunk/1000).toFixed(1)}s ago`;
                    setCurrent(title, idxInBatch, totalInBatch, stage, dispPct, st, net);
                });

                // 3) Save
                setCurrent(title, idxInBatch, totalInBatch, '💾 Сохранение...', 95, 'idle', 'запись в Загрузки');
                Sound.save();
                saveToDownloads(blob, title, seqNum);
                setCurrent(title, idxInBatch, totalInBatch, '✅ Готово', 100, 'done', `${(size/1048576).toFixed(2)} MB`);

                const tMs = (performance.now()-tT0).toFixed(0);
                console.log(`%c▶ [DONE] [${String(seqNum).padStart(2,'0')}] "${title}" · ${(size/1048576).toFixed(2)} MB · ${(tMs/1000).toFixed(1)}s`, 'color:#4ade80;font-weight:bold;');
                logOk(`ГОТОВО · ${(tMs/1000).toFixed(1)}s`);

                state.batchDone++;
                updateBatchProgress();
                setTimeout(()=>Sound.trackDone(), 100);
                return;

            } catch(e) {
                console.log(`%c   ⚠ Попытка ${attempt}: ${e.message}`, 'color:#fbbf24;');
                if (attempt >= MAX_ATTEMPTS) {
                    state.batchErrors++;
                    logErr(`"${title.slice(0,32)}" — ${e.message}`);
                    setCurrent(title, idxInBatch, totalInBatch, `❌ ${e.message.slice(0,50)}`, 100, 'error', 'ошибка');
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

            const clips = await fetchAllClips();
            if (clips.length === 0) throw new Error('Список пуст');

            state.allClips = clips;
            logOk(`Получено ${clips.length} треков`);
            const full = clips.filter(c => c?.media_urls?.[0]?.url?.includes('cloudfront'));
            logOk(`Полных (cloudfront): ${full.length}`);

            // авто-выбор полных
            clips.forEach((c, i) => {
                if (c?.media_urls?.[0]?.url?.includes('cloudfront')) state.selected.add(i);
            });

            renderList(clips);
            setStatus(`Выбрано ${state.selected.size} из ${clips.length}`, 'ok');
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
        console.log(`%c║  🚀 SUNO BATCH v${VERSION} · ${clipsToDownload.length} tracks          `, 'color:#a994ff;font-weight:bold;');
        console.log(`%c╚════════════════════════════════════════╝`, 'color:#a994ff;font-weight:bold;');

        Sound.start();
        logStep(`СТАРТ БАТЧА · ${clipsToDownload.length} треков`);

        state.isBatch = true;
        state.batchCancel = false;
        state.batchErrors = 0;
        state.batchDone = 0;
        state.batchTotal = clipsToDownload.length;
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

            logOk(`ЗАВЕРШЕНО · ${(tMs/1000).toFixed(1)}s`);
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
            // обновить список
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
            if (c?.media_urls?.[0]?.url?.includes('cloudfront')) state.selected.add(i);
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

    // ===== INIT =====
    log(`Suno Downloader v${VERSION}`, SUNO.accent, CS.accent);
    log(`Net-diag · select UI · numbered saves`, SUNO.textTertiary, CS.dim);

    (async () => {
        const j = await getJwt();
        if (j) { logOk('JWT готов'); setStatus('Нажми "Загрузить список"', 'ok'); }
        else { logWarn('Ждём JWT...'); setStatus('Открой любой трек', 'warn'); }
    })();

    console.log(`%c✅ Suno Downloader v${VERSION} готов`, 'color:#4ade80;font-weight:bold;font-size:14px;');
})();
