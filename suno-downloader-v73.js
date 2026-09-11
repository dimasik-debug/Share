/**
 * Suno Downloader v7.3 — SaveFilePicker + Verbose
 */
(function sunoDownloaderV73() {
    console.log('🎵 Suno Downloader v7.3');

    const S = 1.25;
    const px = v => `${Math.round(v * S * 100) / 100}px`;

    // 🔊 Звуки
    const Sound = {
        ctx: null, enabled: true,
        init() { if (this.ctx) return; try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { this.enabled = false; } },
        beep(freq, dur = 0.08, type = 'sine', vol = 0.15, delay = 0) {
            if (!this.enabled) return; this.init(); if (!this.ctx) return;
            try {
                if (this.ctx.state === 'suspended') this.ctx.resume();
                const t = this.ctx.currentTime + delay;
                const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
                osc.type = type; osc.frequency.setValueAtTime(freq, t);
                gain.gain.setValueAtTime(0, t);
                gain.gain.linearRampToValueAtTime(vol, t + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
                osc.connect(gain).connect(this.ctx.destination);
                osc.start(t); osc.stop(t + dur);
            } catch(e) {}
        },
        chord(f, d=0.15, t='sine', v=0.1) { f.forEach((x,i)=>this.beep(x,d,t,v,i*0.02)); },
        start() { this.chord([523,659],0.12,'sine',0.09); },
        complete() { this.chord([659,784,988,1319],0.25,'triangle',0.11); },
        error() { this.beep(220,0.15,'sawtooth',0.1); },
        batch() { this.beep(440,0.04,'square',0.06); }
    };

    const state = {
        clipId: null, cdnUrl: null, title: null,
        licenseKey: null, licenseIv: null, glt: null, jwt: null,
        titleFetched: false, lastProcessed: null,
        isBatch: false, batchCancel: false,
        batchQueue: [], batchDone: 0, batchTotal: 0, batchErrors: 0,
        savedFiles: [],           // для fallback-режима
        dirHandle: null,          // File System Access
        useFS: false,             // включаем если поддерживается
        isRunning: false, autoTimer: null
    };

    function b64(b) {
        const bin = atob(b); const u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        return u;
    }
    function extractAuth(headers) {
        if (!headers) return null;
        let auth = null;
        if (headers instanceof Headers) auth = headers.get('Authorization') || headers.get('authorization');
        else if (Array.isArray(headers)) { for (const [k,v] of headers) if (k.toLowerCase()==='authorization') auth = v; }
        else if (typeof headers === 'object') auth = headers['Authorization'] || headers['authorization'];
        if (typeof auth === 'string') return auth.replace(/^Bearer\s+/i, '');
        return null;
    }

    async function getJwt(force = false) {
        if (state.jwt && !force) return state.jwt;
        try {
            if (window.Clerk?.session?.getToken) {
                const t = await window.Clerk.session.getToken({ skipCache: force });
                if (t && typeof t === 'string' && t.length > 50) { state.jwt = t; return t; }
            }
        } catch(e) {}
        try {
            const m = document.cookie.match(/(?:^|;\s*)__session=([^;]+)/);
            if (m) {
                const v = decodeURIComponent(m[1]);
                if (v.length > 100 && v.split('.').length === 3) { state.jwt = v; return v; }
            }
        } catch(e) {}
        if (force) {
            try {
                if (window.Clerk?.session?.touch) {
                    await window.Clerk.session.touch();
                    const t = await window.Clerk.session.getToken({ skipCache: true });
                    if (t && t.length > 50) { state.jwt = t; return t; }
                }
            } catch(e) {}
        }
        return state.jwt;
    }

    async function timedFetch(url, opts = {}, timeoutMs = 15000) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
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

    // UI
    document.body.insertAdjacentHTML('beforeend', `
        <div id="sdc_ui" style="position:fixed;bottom:${px(16)};right:${px(16)};z-index:99999;
            background:#fff;color:#1a2a4a;border-radius:${px(14)};padding:${px(14)} ${px(16)};
            font-family:'Segoe UI',Arial,sans-serif;font-size:${px(12)};width:${px(480)};
            box-shadow:0 ${px(8)} ${px(32)} rgba(0,0,0,0.15);border:1px solid rgba(26,42,74,0.08);">

            <div style="display:flex;align-items:center;gap:${px(8)};margin-bottom:${px(10)};">
                <div style="font-size:${px(20)};">🎵</div>
                <div style="flex:1;">
                    <div style="font-weight:800;font-size:${px(14)};">Suno <span style="color:#1a5a9a;">Downloader</span></div>
                    <div style="font-size:${px(9)};color:#8a9aaa;text-transform:uppercase;">v7.3 • FS API</div>
                </div>
                <button id="sdc_sound" style="background:rgba(26,42,74,0.05);border:none;color:#8a9aaa;cursor:pointer;font-size:${px(13)};padding:${px(3)} ${px(7)};border-radius:${px(6)};">🔊</button>
                <button id="sdc_clear" style="background:rgba(26,42,74,0.05);border:none;color:#8a9aaa;cursor:pointer;font-size:${px(13)};padding:${px(3)} ${px(7)};border-radius:${px(6)};">🗑</button>
                <button id="sdc_close" style="background:rgba(26,42,74,0.05);border:none;color:#8a9aaa;cursor:pointer;font-size:${px(13)};padding:${px(3)} ${px(7)};border-radius:${px(6)};">✕</button>
            </div>

            <div id="sdc_stats" style="background:#f0f7ff;border-radius:${px(8)};padding:${px(7)} ${px(9)};margin-bottom:${px(8)};border-left:${px(3)} solid #1a5a9a;font-size:${px(11)};">
                ⏳ Инициализация...
            </div>

            <div id="sdc_batch" style="display:none;background:#eaf7ee;border-radius:${px(8)};padding:${px(7)} ${px(9)};margin-bottom:${px(8)};border-left:${px(3)} solid #27ae60;font-size:${px(11)};">
                <div style="display:flex;justify-content:space-between;">
                    <span id="sdc_batch_text">📦 Загрузка...</span>
                    <span id="sdc_batch_count" style="font-weight:700;color:#27ae60;">0/0</span>
                </div>
                <div style="width:100%;height:${px(5)};background:#d0e8da;border-radius:${px(3)};overflow:hidden;margin-top:${px(5)};">
                    <div id="sdc_batch_bar" style="width:0%;height:100%;background:#27ae60;transition:width 0.3s;"></div>
                </div>
                <div id="sdc_batch_stage" style="font-size:${px(10)};color:#4a6a8a;margin-top:${px(4)};">—</div>
            </div>

            <div style="background:#f0f4fa;border-radius:${px(8)};padding:${px(7)} ${px(9)};margin-bottom:${px(8)};">
                <div id="sdc_log" style="font-size:${px(10)};color:#4a6a8a;background:#e8eef4;padding:${px(6)};border-radius:${px(4)};max-height:${px(280)};overflow-y:auto;font-family:'Courier New',monospace;line-height:1.4;white-space:pre-wrap;">⏳ Ожидание...</div>
            </div>

            <div style="display:flex;gap:${px(4)};flex-wrap:wrap;">
                <button id="sdc_all" style="flex:2;padding:${px(10)};background:#27ae60;color:#fff;border:none;border-radius:${px(6)};cursor:pointer;font-weight:700;font-size:${px(12)};">📥 Скачать всё (FS API)</button>
                <button id="sdc_all2" style="flex:1;padding:${px(10)};background:#1a3a6a;color:#fff;border:none;border-radius:${px(6)};cursor:pointer;font-weight:700;font-size:${px(11)};">📥 Classic</button>
                <button id="sdc_stop" style="flex:1;padding:${px(10)};background:#e74c3c;color:#fff;border:none;border-radius:${px(6)};cursor:pointer;font-weight:700;font-size:${px(11)};display:none;">⏹ Стоп</button>
            </div>
        </div>
    `);

    const $ = id => document.getElementById(id);
    const logEl = $('sdc_log');
    const statsEl = $('sdc_stats');
    const batchEl = $('sdc_batch');

    function log(t) {
        const ts = new Date().toLocaleTimeString();
        logEl.textContent += `\n[${ts}] ${t}`;
        logEl.scrollTop = logEl.scrollHeight;
        console.log('[SDC]', t);
    }
    function updateStats(t) {
        if (t) { statsEl.textContent = t; return; }
        const b = [];
        if (state.jwt) b.push('🔐 JWT');
        if (state.clipId) b.push(`🆔 ${state.clipId.slice(0,8)}`);
        statsEl.textContent = b.join(' • ') || '⏳ Ждём...';
    }
    function updateBatch(done, total, text, stage) {
        batchEl.style.display = 'block';
        $('sdc_batch_count').textContent = `${done}/${total}`;
        $('sdc_batch_bar').style.width = total > 0 ? `${Math.round(done/total*100)}%` : '0%';
        if (text) $('sdc_batch_text').textContent = text;
        if (stage) $('sdc_batch_stage').textContent = stage;
    }

    function sanitizeName(n) {
        return (n || 'suno_track')
            .replace(/[\\/:*?"<>|]/g, '_').replace(/[\x00-\x1f]/g, '')
            .replace(/\s+/g, ' ').trim().slice(0, 80) || 'suno_track';
    }

    // ============================================================
    // 🆕 СОХРАНЕНИЕ ЧЕРЕЗ FS API
    // ============================================================
    async function pickDirectory() {
        if (!window.showDirectoryPicker) return null;
        try {
            log('📂 Выбери папку для сохранения всех треков...');
            const dir = await window.showDirectoryPicker({ mode: 'readwrite', id: 'suno-downloads' });
            state.dirHandle = dir;
            state.useFS = true;
            log(`✅ Папка: "${dir.name}"`);
            return dir;
        } catch(e) {
            log(`⚠️ FS API отменён/недоступен: ${e.message}`);
            return null;
        }
    }

    async function saveWithFS(blob, fileName) {
        if (!state.dirHandle) throw new Error('Нет dirHandle');
        const fh = await state.dirHandle.getFileHandle(fileName, { create: true });
        const w = await fh.createWritable();
        await w.write(blob);
        await w.close();
        return fileName;
    }

    function saveClassic(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 3000);
        return fileName;
    }

    async function saveBlobAsync(blob, title) {
        const safe = sanitizeName(title);
        const ext = blob.type.includes('webm') ? 'webm' : 'm4a';
        const fileName = `${safe}.${ext}`;
        if (state.useFS && state.dirHandle) {
            try { return await saveWithFS(blob, fileName); }
            catch(e) { log(`   ⚠️ FS save failed: ${e.message} → classic`); return saveClassic(blob, fileName); }
        }
        return saveClassic(blob, fileName);
    }

    // ============================================================
    // API
    // ============================================================
    async function fetchAllClips() {
        const jwt = await getJwt();
        if (!jwt) throw new Error('Нет JWT');
        const headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwt };
        const tries = [
            { method: 'POST', url: 'https://studio-api-prod.suno.com/api/feed/v3', body: JSON.stringify({}) },
            { method: 'POST', url: 'https://studio-api-prod.suno.com/api/feed/v3', body: JSON.stringify({ limit: 200 }) },
        ];
        for (const t of tries) {
            try {
                log(`📡 ${t.method} feed/v3`);
                const r = await timedFetch(t.url, { method: t.method, headers, credentials: 'same-origin', body: t.body }, 20000);
                log(`   → HTTP ${r.status}`);
                if (!r.ok) continue;
                const data = await r.json();
                const clips = data?.clips || data?.data || data?.items || [];
                if (Array.isArray(clips) && clips.length > 0) {
                    log(`   ✅ ${clips.length} клипов`);
                    return clips;
                }
            } catch(e) { log(`   ❌ ${e.message}`); }
        }
        return [];
    }

    async function fetchLicense(clipId) {
        const jwt = await getJwt();
        if (!jwt) throw new Error('Нет JWT');
        const t0 = Date.now();
        const r = await timedFetch('https://studio-api-prod.suno.com/api/mango/rights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwt },
            credentials: 'same-origin',
            body: JSON.stringify({ content_params: { content_id: clipId, content_type: 'clip' } })
        }, 15000);
        const ms = Date.now() - t0;
        if (!r.ok) throw new Error(`License HTTP ${r.status} (${ms}ms)`);
        log(`   🔑 License ${ms}ms`);
        return await r.json();
    }

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

        const t1 = Date.now();
        const r = await timedFetch(cdnUrl, {}, 30000);
        if (!r.ok) throw new Error(`CDN HTTP ${r.status}`);
        const enc = await r.arrayBuffer();
        log(`   📥 CDN ${Date.now()-t1}ms, ${(enc.byteLength/1048576).toFixed(2)} MB`);

        const t2 = Date.now();
        const dec = await crypto.subtle.decrypt({ name:'AES-CTR', counter:new Uint8Array(aiv), length:128 }, ctr, enc);
        log(`   🔓 Decrypt ${Date.now()-t2}ms`);

        const head = new Uint8Array(dec.slice(0, 12));
        const ascii = Array.from(head).map(b => (b>=32&&b<127)?String.fromCharCode(b):'.').join('');
        const mime = ascii.includes('ftyp') ? 'audio/mp4' : (head[0]===0x1a ? 'audio/webm' : 'audio/mp4');
        return { blob: new Blob([dec], { type: mime }), header: ascii };
    }

    // ============================================================
    // 📥 БАТЧ
    // ============================================================
    async function downloadAll(useFS = true) {
        if (state.isBatch) { log('⚠️ Батч уже идёт'); return; }

        log('══════════════════════════════');
        log(`🚀 БАТЧ (${useFS ? 'FS API' : 'Classic'})`);
        log('══════════════════════════════');

        const jwt = await getJwt(true);
        if (!jwt) { log('❌ Нет JWT'); Sound.error(); return; }

        // FS API — выбираем папку один раз ДО старта
        if (useFS && window.showDirectoryPicker) {
            const dir = await pickDirectory();
            if (!dir) { log('⚠️ Папка не выбрана, переключаюсь на Classic'); useFS = false; }
        } else if (useFS) {
            log('⚠️ FS API не поддерживается → Classic');
            useFS = false;
        }
        state.useFS = useFS;

        state.isBatch = true;
        state.batchCancel = false;
        state.batchErrors = 0;
        $('sdc_all').style.display = 'none';
        $('sdc_all2').style.display = 'none';
        $('sdc_stop').style.display = 'block';
        Sound.start();

        try {
            updateBatch(0, 0, '📡 Список...', 'Получаем клипы');
            const clips = await fetchAllClips();
            if (clips.length === 0) throw new Error('Список пуст');

            const full = clips.filter(c => c?.media_urls?.[0]?.url?.includes('cloudfront'));
            log(`📦 Найдено: ${clips.length}, полных: ${full.length}`);
            if (full.length === 0) throw new Error('Нет полных треков');

            state.batchTotal = full.length;
            state.batchDone = 0;
            updateBatch(0, full.length, '📦 Начинаем...', 'Подготовка');

            const used = new Set();
            const t0 = Date.now();

            for (let i = 0; i < full.length; i++) {
                if (state.batchCancel) { log('⏹ Отменено'); break; }

                const clip = full[i];
                const idx = `[${i+1}/${full.length}]`;
                const title = clip.title || `suno_${clip.id.slice(0,8)}`;
                const short = title.slice(0, 45);
                const cdnUrl = clip.media_urls[0].url;

                log(`\n▶ ${idx} "${short}"`);
                log(`   🆔 ${clip.id}`);
                updateBatch(i, full.length, `📥 ${short}`, 'Начинаем');

                try {
                    log(`   [1/4] License...`);
                    updateBatch(i, full.length, `📥 ${short}`, 'Шаг 1/4: License');
                    const lic = await fetchLicense(clip.id);

                    log(`   [2/4] Расшифровка...`);
                    updateBatch(i, full.length, `📥 ${short}`, 'Шаг 2/4: Расшифровка');
                    const { blob, header } = await decryptClip(clip.id, cdnUrl, lic);
                    log(`   📄 Header: "${header}"`);

                    let finalName = title, n = 1;
                    while (used.has(finalName)) finalName = `${title} (${n++})`;
                    used.add(finalName);

                    log(`   [3/4] Сохранение → "${sanitizeName(finalName)}"`);
                    updateBatch(i, full.length, `💾 ${short}`, 'Шаг 3/4: Сохранение');
                    const savedName = await saveBlobAsync(blob, finalName);
                    log(`   ✅ Сохранён: ${savedName}`);

                    state.batchDone++;
                    updateBatch(i+1, full.length, `✅ ${short}`, 'Готово');
                    Sound.batch();

                    log(`   ⏸ 400ms...`);
                    await new Promise(r => setTimeout(r, 400));

                } catch(e) {
                    state.batchErrors++;
                    log(`   ❌ ОШИБКА: ${e.message}`);
                    updateBatch(i+1, full.length, `❌ ${short}`, `Ошибка: ${e.message}`);
                    Sound.error();
                    await new Promise(r => setTimeout(r, 500));
                }
            }

            const totalMs = Date.now() - t0;
            log('\n══════════════════════════════');
            log(`🎉 ЗАВЕРШЕНО за ${(totalMs/1000).toFixed(1)}s`);
            log(`   ✅ ${state.batchDone}/${state.batchTotal}`);
            log(`   ❌ ${state.batchErrors}`);
            log('══════════════════════════════');
            updateBatch(state.batchDone, state.batchTotal, `🎉 ${state.batchDone}/${state.batchTotal} (ошибок: ${state.batchErrors})`, 'Завершено');
            Sound.complete();

        } catch(e) {
            log(`\n❌ КРИТИЧЕСКАЯ: ${e.message}`);
            Sound.error();
        }

        state.isBatch = false;
        $('sdc_all').style.display = 'block';
        $('sdc_all2').style.display = 'block';
        $('sdc_stop').style.display = 'none';
    }

    // Обработчики
    $('sdc_sound').onclick = () => { Sound.enabled = !Sound.enabled; $('sdc_sound').textContent = Sound.enabled ? '🔊' : '🔇'; };
    $('sdc_clear').onclick = () => { logEl.textContent = '🗑 Очищено'; };
    $('sdc_close').onclick = () => { if (state.isBatch && !confirm('Идёт батч. Закрыть?')) return; state.batchCancel = true; $('sdc_ui').remove(); };
    $('sdc_all').onclick = () => { Sound.beep(660,0.05,'square',0.08); downloadAll(true); };
    $('sdc_all2').onclick = () => { Sound.beep(660,0.05,'square',0.08); downloadAll(false); };
    $('sdc_stop').onclick = () => { Sound.beep(220,0.1,'sawtooth',0.1); state.batchCancel = true; log('⏹ Стоп...'); };

    // INIT
    log('✅ v7.3 готов');
    if (window.showDirectoryPicker) {
        log('📂 FS API доступен — папку выберешь один раз, все файлы туда');
    } else {
        log('⚠️ FS API нет — используем Classic (Chrome может спросить разрешение)');
    }

    (async () => {
        const j = await getJwt();
        if (j) { log('🔐 JWT есть'); updateStats('🔐 Готов'); }
        else log('⏳ Ждём JWT (открой любой трек)');
    })();

    console.log('✅ v7.3 запущен');
})();
