/**
 * Suno Downloader v10.0 — Final
 * ✅ Working method from v7.3 (single decrypt call)
 * 🎨 Suno UI · 🔊 Soft sounds · 🛡 Verify + Retry
 * 💾 Auto-save to Downloads
 */
(function sunoDownloaderV100() {
    const VERSION = '10.0';
    const MAX_ATTEMPTS = 3;

    console.log(`%c🎵 Suno Downloader v${VERSION} — Final`, 'color:#a994ff;font-size:16px;font-weight:bold;');
    console.log('%c✨ working decrypt · suno ui · no folder picker · soft sounds', 'color:#8a9aaa;font-size:11px;');

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
        ts:'color:#6a7a8a;font-style:italic;', net:'color:#7c5cff;', step:'color:#a994ff;font-weight:500;'
    };

    // ============================================================
    // 🔊 Мягкие звуки
    // ============================================================
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
        save(){ this.note(1047,0.15,0.06,0,'triangle'); }
    };

    const state = {
        jwt: null, isBatch: false, batchCancel: false,
        batchTotal: 0, batchDone: 0, batchErrors: 0
    };

    function b64(b) {
        const bin = atob(b); const u = new Uint8Array(bin.length);
        for (let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
        return u;
    }

    async function getJwt(force = false) {
        if (state.jwt && !force) return state.jwt;
        try {
            if (window.Clerk?.session?.getToken) {
                const t = await window.Clerk.session.getToken({ skipCache: force });
                if (t && typeof t === 'string' && t.length > 50) { state.jwt = t; return t; }
            }
        } catch(e){}
        try {
            const m = document.cookie.match(/(?:^|;\s*)__session=([^;]+)/);
            if (m) {
                const v = decodeURIComponent(m[1]);
                if (v.length > 100 && v.split('.').length === 3) { state.jwt = v; return v; }
            }
        } catch(e){}
        return state.jwt;
    }

    async function timedFetch(url, opts = {}, timeoutMs = 30000) {
        const ctrl = new AbortController();
        const timer = setTimeout(()=>ctrl.abort(), timeoutMs);
        try {
            const r = await fetch(url, { ...opts, signal: ctrl.signal });
            clearTimeout(timer);
            return r;
        } catch(e) {
            clearTimeout(timer);
            if (e.name === 'AbortError') throw new Error(`Timeout ${timeoutMs}ms`);
            throw e;
        }
    }

    // ============================================================
    // 🎨 UI
    // ============================================================
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
            .sunodl-icon-btn{width:32px;height:32px;padding:0;border-radius:10px;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.6);border:none;cursor:pointer;transition:all 0.2s;display:inline-flex;align-items:center;justify-content:center;font-size:14px;}
            .sunodl-icon-btn:hover{background:rgba(255,255,255,0.1);color:#fff;}
            #sunodl-log::-webkit-scrollbar{width:6px;}
            #sunodl-log::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px;}
            .sunodl-pulse{animation:sunodl-pulse 2s ease-in-out infinite;}
            @keyframes sunodl-pulse{0%,100%{opacity:1;}50%{opacity:0.5;}}
            .sunodl-progress-bar{width:100%;height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;}
            .sunodl-progress-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,#a994ff,#7c5cff);transition:width 0.3s ease;}
            .sunodl-progress-fill.done{background:linear-gradient(90deg,#4ade80,#22c55e);}
            .sunodl-progress-fill.error{background:linear-gradient(90deg,#f87171,#dc2626);}
            .sunodl-progress-fill.license{background:linear-gradient(90deg,#fbbf24,#f59e0b);}
        </style>

        <div id="sunodl" style="position:fixed;bottom:16px;right:16px;z-index:99999;background:${SUNO.bgPrimary};color:${SUNO.textPrimary};font-family:${SUNO.font};width:520px;max-width:calc(100vw - 32px);border-radius:20px;border:1px solid ${SUNO.border};box-shadow:0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.02) inset;overflow:hidden;">
            <div style="display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid ${SUNO.border};">
                <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,${SUNO.accent},#7c5cff);display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 16px rgba(124,92,255,0.3);">🎵</div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:500;font-size:15px;letter-spacing:-0.2px;">Suno Downloader</div>
                    <div style="font-size:11px;color:${SUNO.textTertiary};letter-spacing:0.3px;margin-top:1px;">v${VERSION} · final · auto-save</div>
                </div>
                <button id="sunodl-sound" class="sunodl-icon-btn" title="Звук">🔊</button>
                <button id="sunodl-clear" class="sunodl-icon-btn" title="Очистить">🗑</button>
                <button id="sunodl-close" class="sunodl-icon-btn" title="Закрыть">✕</button>
            </div>

            <div id="sunodl-status" style="padding:14px 18px;border-bottom:1px solid ${SUNO.border};display:flex;align-items:center;gap:10px;">
                <div id="sunodl-status-dot" class="sunodl-pulse" style="width:8px;height:8px;border-radius:50%;background:${SUNO.accent};flex-shrink:0;"></div>
                <div id="sunodl-status-text" style="font-size:13px;color:${SUNO.textSecondary};">Инициализация...</div>
            </div>

            <div id="sunodl-current" style="display:none;padding:14px 18px;border-bottom:1px solid ${SUNO.border};">
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;">
                    <div id="sunodl-current-title" style="font-size:13px;color:${SUNO.textPrimary};font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:340px;">—</div>
                    <div id="sunodl-current-count" style="font-size:13px;color:${SUNO.textTertiary};">0/0</div>
                </div>
                <div class="sunodl-progress-bar" style="margin-bottom:8px;"><div id="sunodl-current-bar" class="sunodl-progress-fill" style="width:0%;"></div></div>
                <div id="sunodl-current-stage" style="font-size:11px;color:${SUNO.textSecondary};font-family:'SF Mono',monospace;">—</div>
            </div>

            <div style="padding:14px 18px;border-bottom:1px solid ${SUNO.border};">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="font-size:11px;color:${SUNO.textTertiary};letter-spacing:0.3px;font-weight:500;">LOG</span>
                    <span style="font-size:10px;color:${SUNO.textTertiary};">live · console too</span>
                </div>
                <div id="sunodl-log" style="font-size:11px;color:${SUNO.textSecondary};background:${SUNO.bgSecondary};padding:12px 14px;border-radius:12px;max-height:220px;overflow-y:auto;font-family:'SF Mono',Consolas,'Courier New',monospace;line-height:1.6;border:1px solid ${SUNO.border};"></div>
            </div>

            <div style="display:flex;gap:8px;padding:16px 18px;">
                <button id="sunodl-all" class="sunodl-btn sunodl-btn-accent" style="flex:1;padding:12px;">
                    <span style="font-size:15px;">⬇</span> Скачать всё
                </button>
                <button id="sunodl-stop" class="sunodl-btn sunodl-btn-danger" style="display:none;">⏹ Стоп</button>
            </div>

            <div style="padding:0 18px 14px;display:flex;justify-content:space-between;font-size:10px;color:${SUNO.textTertiary};letter-spacing:0.2px;">
                <span>💾 в Загрузки</span>
                <span id="sunodl-timer">+0.00s</span>
            </div>
        </div>
    `);

    const $ = id => document.getElementById(id);
    const logEl = $('sunodl-log');
    const statusDot = $('sunodl-status-dot');
    const statusText = $('sunodl-status-text');
    const currentEl = $('sunodl-current');
    const timerEl = $('sunodl-timer');

    setInterval(()=>{ timerEl.textContent = ts(); }, 100);

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

    function setStatus(text, kind='idle') {
        statusText.textContent = text;
        const c = {idle:SUNO.accent, ok:SUNO.success, err:SUNO.danger, warn:SUNO.warning};
        statusDot.style.background = c[kind] || SUNO.accent;
        statusDot.classList.toggle('sunodl-pulse', kind==='idle');
    }

    function setCurrent(title, done, total, stage, pct, state_) {
        currentEl.style.display = 'block';
        $('sunodl-current-title').textContent = title;
        $('sunodl-current-count').textContent = `${done}/${total}`;
        $('sunodl-current-stage').textContent = stage;
        const bar = $('sunodl-current-bar');
        bar.style.width = pct+'%';
        bar.className = 'sunodl-progress-fill' + (state_ === 'error' ? ' error' : state_ === 'done' ? ' done' : state_ === 'license' ? ' license' : '');
    }

    function sanitizeName(n) {
        return (n||'suno_track').replace(/[\\/:*?"<>|]/g,'_').replace(/[\x00-\x1f]/g,'').replace(/\s+/g,' ').trim().slice(0,80)||'suno_track';
    }

    // ============================================================
    // 📡 API
    // ============================================================
    async function fetchAllClips() {
        const jwt = await getJwt();
        if (!jwt) throw new Error('Нет JWT');
        const headers = { 'Content-Type':'application/json', 'Authorization':'Bearer '+jwt };
        const tries = [
            { method:'POST', url:'https://studio-api-prod.suno.com/api/feed/v3', body:JSON.stringify({}) },
            { method:'POST', url:'https://studio-api-prod.suno.com/api/feed/v3', body:JSON.stringify({ limit:200 }) },
        ];
        for (const t of tries) {
            try {
                logNet('POST feed/v3');
                const r = await timedFetch(t.url, { method:t.method, headers, credentials:'same-origin', body:t.body }, 20000);
                log(`  ← HTTP ${r.status}`, r.ok?SUNO.success:SUNO.danger, r.ok?CS.ok:CS.err);
                if (!r.ok) continue;
                const data = await r.json();
                const clips = data?.clips || data?.data || data?.items || [];
                if (Array.isArray(clips) && clips.length>0) { logOk(`${clips.length} клипов`); return clips; }
            } catch(e){ logErr(e.message); }
        }
        return [];
    }

    async function fetchLicense(clipId) {
        const t = performance.now();
        const jwt = await getJwt();
        const r = await timedFetch('https://studio-api-prod.suno.com/api/mango/rights', {
            method:'POST',
            headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+jwt },
            credentials:'same-origin',
            body:JSON.stringify({ content_params:{ content_id:clipId, content_type:'clip' } })
        }, 15000);
        const ms = (performance.now()-t).toFixed(0);
        if (!r.ok) throw new Error(`License HTTP ${r.status}`);
        log(`  🔑 License · ${ms}ms`, SUNO.success, CS.ok);
        return await r.json();
    }

    // ============================================================
    // 🔓 РАСШИФРОВКА (метод из v7.3 — работает!)
    // ============================================================
    async function decryptClip(clipId, cdnUrl, license) {
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

        // ⚡ Загрузка целиком
        logNet('CDN fetch');
        const t1 = performance.now();
        const r = await timedFetch(cdnUrl, {}, 300000);
        if (!r.ok) throw new Error(`CDN HTTP ${r.status}`);

        const total = parseInt(r.headers.get('content-length') || '0', 10);
        if (total > 0) log(`  📦 ${(total/1048576).toFixed(2)} MB`, SUNO.accent, CS.accent);

        const enc = await r.arrayBuffer();
        const dlMs = (performance.now()-t1).toFixed(0);
        const dlMBps = (enc.byteLength/1048576/(dlMs/1000)).toFixed(2);
        logOk(`Скачано ${(enc.byteLength/1048576).toFixed(2)} MB за ${(dlMs/1000).toFixed(1)}s (${dlMBps} MB/s)`);

        // ⚡ Расшифровка одним вызовом (Chrome сам инкрементирует counter!)
        log(`  🔓 Decrypt ${(enc.byteLength/1048576).toFixed(2)} MB...`, SUNO.accent, CS.accent);
        const t2 = performance.now();
        const dec = await crypto.subtle.decrypt(
            { name:'AES-CTR', counter:new Uint8Array(aiv), length:128 },
            ctr,
            enc
        );
        logOk(`Расшифровано за ${(performance.now()-t2).toFixed(0)}ms`);

        // 🔍 Verify
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

    // ============================================================
    // 💾 СОХРАНЕНИЕ → Загрузки
    // ============================================================
    function saveToDownloads(blob, title) {
        const safe = sanitizeName(title);
        const ext = blob.type.includes('webm') ? 'webm' : 'm4a';
        const fn = `${safe}.${ext}`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fn; a.style.display = 'none';
        document.body.appendChild(a); a.click();
        setTimeout(()=>{ a.remove(); URL.revokeObjectURL(url); }, 3000);
        logOk(`💾 ${fn} (${(blob.size/1048576).toFixed(2)} MB)`);
        return fn;
    }

    // ============================================================
    // 📥 ОДИН ТРЕК
    // ============================================================
    async function processTrack(clip, index, total) {
        const title = clip.title || `suno_${clip.id.slice(0,8)}`;
        const cdnUrl = clip.media_urls[0].url;
        const tT0 = performance.now();

        console.log(`\n%c═══════════════════════════════════════`, 'color:#a994ff;');
        console.log(`%c▶ [${index+1}/${total}] "${title}"`, 'color:#a994ff;font-weight:bold;');
        console.log(`%c   🆔 ${clip.id}`, 'color:#6a7a8a;');

        logStep(`[${index+1}/${total}] "${title.slice(0,35)}"`);
        setCurrent(title, index, total, 'Начинаем...', 0, 'idle');

        for (let attempt=1; attempt<=MAX_ATTEMPTS; attempt++) {
            if (state.batchCancel) return;

            if (attempt > 1) {
                log(`  🔄 Попытка ${attempt}/${MAX_ATTEMPTS}`, SUNO.warning, CS.warn);
                await new Promise(r=>setTimeout(r, 800*attempt));
            }

            try {
                // 1) License
                setCurrent(title, index, total, `License...`, 5, 'license');
                const lic = await fetchLicense(clip.id);

                // 2) Download + Decrypt
                setCurrent(title, index, total, '📥 Скачивание + расшифровка...', 30, 'idle');
                const { blob, size } = await decryptClip(clip.id, cdnUrl, lic);

                // 3) Save
                setCurrent(title, index, total, '💾 Сохранение...', 90, 'idle');
                Sound.save();
                saveToDownloads(blob, title);
                setCurrent(title, index, total, '✅ Готово', 100, 'done');

                const tMs = (performance.now()-tT0).toFixed(0);
                console.log(`%c▶ [DONE] "${title}" · ${(size/1048576).toFixed(2)} MB · ${(tMs/1000).toFixed(1)}s`, 'color:#4ade80;font-weight:bold;');
                logOk(`ГОТОВО · ${(tMs/1000).toFixed(1)}s`);

                state.batchDone++;
                setTimeout(()=>Sound.trackDone(), 100);
                return;

            } catch(e) {
                console.log(`%c   ⚠ Попытка ${attempt}: ${e.message}`, 'color:#fbbf24;');
                if (attempt >= MAX_ATTEMPTS) {
                    state.batchErrors++;
                    logErr(`"${title.slice(0,35)}" — ${e.message}`);
                    setCurrent(title, index, total, `❌ ${e.message.slice(0,40)}`, 100, 'error');
                    Sound.error();
                }
            }
        }
    }

    // ============================================================
    // 🚀 БАТЧ
    // ============================================================
    async function downloadAll() {
        if (state.isBatch) { logWarn('Батч идёт'); return; }

        console.log(`\n%c╔════════════════════════════════════════╗`, 'color:#a994ff;font-weight:bold;');
        console.log(`%c║  🚀 SUNO BATCH · v${VERSION}                     ║`, 'color:#a994ff;font-weight:bold;');
        console.log(`%c╚════════════════════════════════════════╝`, 'color:#a994ff;font-weight:bold;');

        Sound.start();
        logStep('СТАРТ БАТЧА');

        const jwt = await getJwt(true);
        if (!jwt) { logErr('Нет JWT'); Sound.error(); return; }
        logOk(`JWT · ${jwt.length} символов`);

        state.isBatch = true;
        state.batchCancel = false;
        state.batchErrors = 0;
        state.batchDone = 0;
        $('sunodl-all').disabled = true;
        $('sunodl-stop').style.display = 'inline-flex';
        setStatus('Загрузка списка...', 'idle');

        try {
            const clips = await fetchAllClips();
            if (clips.length === 0) throw new Error('Список пуст');
            const full = clips.filter(c => c?.media_urls?.[0]?.url?.includes('cloudfront'));
            if (full.length === 0) throw new Error('Нет полных треков');
            state.batchTotal = full.length;
            logOk(`Треков: ${full.length}`);

            const bT0 = performance.now();
            for (let i=0; i<full.length; i++) {
                if (state.batchCancel) { logWarn('Отменено'); break; }
                await processTrack(full[i], i, full.length);
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
        $('sunodl-all').disabled = false;
        $('sunodl-stop').style.display = 'none';
    }

    // ============================================================
    // ОБРАБОТЧИКИ
    // ============================================================
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
    $('sunodl-all').onclick = () => { Sound.click(); downloadAll(); };
    $('sunodl-stop').onclick = () => { Sound.error(); state.batchCancel=true; logWarn('⏹ Стоп...'); };

    // ============================================================
    // INIT
    // ============================================================
    log(`Suno Downloader v${VERSION}`, SUNO.accent, CS.accent);
    log(`Working decrypt · Suno UI · auto-save`, SUNO.textTertiary, CS.dim);

    (async () => {
        const j = await getJwt();
        if (j) { logOk('JWT готов'); setStatus('Готов к загрузке', 'ok'); }
        else { logWarn('Ждём JWT...'); setStatus('Открой любой трек', 'warn'); }
    })();

    console.log(`%c✅ Suno Downloader v${VERSION} готов`, 'color:#4ade80;font-weight:bold;font-size:14px;');
})();
