/**
 * Suno Downloader v2.0
 * 🎵 Три режима: буфер / публичный / CDN+AES
 * (c) 2026
 */
(function sunoDownloaderV2() {
    console.log('🎵 Suno Downloader v2.0 — 3 режима');

    const S = 1.25;
    const px = v => `${Math.round(v * S * 100) / 100}px`;

    // ========== ID ТРЕКА ==========
    const clipId = (() => {
        const m = location.pathname.match(/\/(?:song|s)\/([a-zA-Z0-9_-]+)/);
        return m ? m[1] : null;
    })();
    if (!clipId) return alert('❌ Открой страницу трека Suno');
    console.log(`🆔 Clip ID: ${clipId}`);

    // ========== СОСТОЯНИЕ ==========
    const state = {
        title: '...',
        author: '...',
        clipId,
        mode: 'buffer',       // buffer | public | cdn
        // буфер
        chunks: [],
        totalBytes: 0,
        isRunning: false,
        isPaused: false,
        isStopped: false,
        lastChunkTime: Date.now(),
        checkInterval: null,
        audioElement: null,
        audioEnded: false,
        // CDN
        cdnUrl: null,
        licenseKey: null,
        licenseIv: null,
        licenseCaptured: false,
        cdnBlob: null
    };

    // ========== ЗАГОЛОВОК ==========
    function getTitle() {
        const h1 = document.querySelector('h1');
        if (h1?.textContent?.trim()) return h1.textContent.trim();
        const el = document.querySelector('[data-testid="clip-title"]');
        if (el?.textContent?.trim()) return el.textContent.trim();
        const t = document.title.replace(/\s*[|·]\s*Suno.*$/i, '').trim();
        if (t && t !== 'Suno | AI Music') return t;
        return `suno_${clipId.slice(0, 8)}`;
    }
    function getAuthor() {
        const el = document.querySelector('[data-testid="clip-author"]') ||
                   document.querySelector('a[href*="/@"]');
        return el?.textContent?.trim() || 'Suno AI';
    }
    state.title = getTitle();
    state.author = getAuthor();
    const safeTitle = state.title.replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 80)
        || `suno_${clipId.slice(0,8)}`;

    // ========== ПЕРЕХВАТ FETCH (CDN + ключ) ==========
    const origFetch = window.fetch;
    window.fetch = function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
        const opts = args[1] || {};

        // 1) Зашифрованный файл с CDN
        if (url.includes('cloudfront.net') && url.includes('.m4a')) {
            state.cdnUrl = url;
            console.log('🔒 CDN:', url);
            log(`🔒 CDN: ${url.split('/').pop()}`, false);
            updateStats();
        }

        // 2) Лицензионный запрос (ключ + IV)
        if (url.includes('/api/mango/rights') || url.includes('/license')) {
            return origFetch.apply(this, args).then(resp => {
                const clone = resp.clone();
                clone.json().then(data => {
                    const k = data.key || data.licenseKey || data.data?.key || data.payload?.key;
                    const iv = data.iv || data.initializationVector || data.data?.iv || data.payload?.iv;
                    if (k && iv) {
                        state.licenseKey = k;
                        state.licenseIv = iv;
                        state.licenseCaptured = true;
                        console.log('🔑 Ключ + IV получены');
                        log('🔑 Ключ перехвачен', false);
                        updateStats();
                    }
                }).catch(() => {});
                return resp;
            });
        }

        return origFetch.apply(this, args);
    };

    // ========== ПЕРЕХВАТ SourceBuffer ==========
    if (window.SourceBuffer?.prototype?.appendBuffer) {
        const origAppend = SourceBuffer.prototype.appendBuffer;
        SourceBuffer.prototype.appendBuffer = function(buffer) {
            if (state.mode === 'buffer' && state.isRunning
                && !state.isStopped && !state.isPaused) {
                try {
                    const copy = new Uint8Array(buffer);
                    state.chunks.push(copy);
                    state.totalBytes += copy.length;
                    state.lastChunkTime = Date.now();
                    updateProgress();
                } catch(e) {}
            }
            return origAppend.call(this, buffer);
        };
    }

    // ========== UI ==========
    document.body.insertAdjacentHTML('beforeend', `
        <div id="sd_ui" style="position:fixed;bottom:${px(16)};right:${px(16)};z-index:99999;
            background:#fff;color:#1a2a4a;border-radius:${px(14)};padding:${px(14)} ${px(16)};
            font-family:'Segoe UI',Arial,sans-serif;font-size:${px(12)};width:${px(380)};
            box-shadow:0 ${px(8)} ${px(32)} rgba(0,0,0,0.15);border:1px solid rgba(26,42,74,0.08);">

            <div style="display:flex;align-items:center;gap:${px(8)};margin-bottom:${px(10)};">
                <div style="font-size:${px(20)};">🎵</div>
                <div style="flex:1;">
                    <div style="font-weight:800;font-size:${px(14)};">Suno <span style="color:#1a5a9a;">Downloader</span></div>
                    <div style="font-size:${px(9)};color:#8a9aaa;text-transform:uppercase;">v2.0 • 3 режима</div>
                </div>
                <button id="sd_close" style="background:rgba(26,42,74,0.05);border:none;color:#8a9aaa;cursor:pointer;font-size:${px(14)};padding:${px(3)} ${px(7)};border-radius:${px(6)};">✕</button>
            </div>

            <div style="background:#f0f7ff;border-radius:${px(8)};padding:${px(8)} ${px(10)};margin-bottom:${px(8)};border-left:${px(3)} solid #1a5a9a;font-size:${px(11)};line-height:1.4;">
                <div style="font-weight:700;" id="sd_title">${state.title}</div>
                <div style="color:#4a6a8a;" id="sd_author">${state.author}</div>
                <div style="color:#4a6a8a;margin-top:${px(2)};" id="sd_stats">—</div>
            </div>

            <div style="background:#fafbfc;border:${px(1)} solid #e8eef4;border-radius:${px(8)};padding:${px(8)} ${px(10)};margin-bottom:${px(8)};">
                <div style="font-weight:700;font-size:${px(11)};color:#1a2a4a;margin-bottom:${px(6)};">🎛 Режим:</div>
                <label style="display:flex;align-items:center;gap:${px(6)};padding:${px(4)} 0;cursor:pointer;font-size:${px(11)};">
                    <input type="radio" name="sd_mode" value="buffer" checked style="cursor:pointer;">
                    <span><b>🎧 Буфер</b> <span style="color:#8a9aaa;">— перехват плеера (нужно доиграть)</span></span>
                </label>
                <label style="display:flex;align-items:center;gap:${px(6)};padding:${px(4)} 0;cursor:pointer;font-size:${px(11)};">
                    <input type="radio" name="sd_mode" value="public" style="cursor:pointer;">
                    <span><b>🔗 Публичный</b> <span style="color:#8a9aaa;">— прямой URL (без DRM)</span></span>
                </label>
                <label style="display:flex;align-items:center;gap:${px(6)};padding:${px(4)} 0;cursor:pointer;font-size:${px(11)};">
                    <input type="radio" name="sd_mode" value="cdn" style="cursor:pointer;">
                    <span><b>🔒 CDN + AES</b> <span style="color:#8a9aaa;">— быстро, без воспроизведения</span></span>
                </label>
            </div>

            <div style="background:#f0f4fa;border-radius:${px(8)};padding:${px(8)} ${px(10)};margin-bottom:${px(8)};">
                <div style="width:100%;height:${px(6)};background:#e8eef4;border-radius:${px(3)};overflow:hidden;margin-bottom:${px(6)};">
                    <div id="sd_bar" style="width:0%;height:100%;background:linear-gradient(90deg,#1a5a9a,#4a8af4);border-radius:${px(3)};transition:width 0.4s;"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:${px(10)};color:#6a8aaa;margin-bottom:${px(4)};">
                    <span id="sd_progress">📥 0 MB</span>
                    <span id="sd_percent" style="font-weight:700;color:#1a5a9a;">0%</span>
                </div>
                <div id="sd_log" style="font-size:${px(10)};color:#6a8aaa;background:#e8eef4;padding:${px(3)} ${px(6)};border-radius:${px(4)};max-height:${px(58)};overflow-y:auto;font-family:'Courier New',monospace;line-height:1.3;">⏳ Готов к работе</div>
            </div>

            <div style="display:flex;gap:${px(4)};margin-bottom:${px(6)};">
                <button id="sd_start" style="flex:2;padding:${px(9)} ${px(6)};background:#27ae60;color:#fff;border:none;border-radius:${px(6)};cursor:pointer;font-weight:700;font-size:${px(11)};">▶ Старт</button>
                <button id="sd_save" style="flex:1;padding:${px(9)} ${px(6)};background:#1a3a6a;color:#fff;border:none;border-radius:${px(6)};cursor:pointer;font-weight:700;font-size:${px(11)};opacity:0.5;">💾 Сохранить</button>
            </div>

            <div style="display:flex;gap:${px(4)};margin-bottom:${px(6)};">
                <button id="sd_pause" disabled style="flex:1;padding:${px(6)};background:#e8eef4;color:#8a9aaa;border:none;border-radius:${px(6)};cursor:pointer;font-weight:700;font-size:${px(11)};">⏸ Пауза</button>
                <button id="sd_stop" disabled style="flex:1;padding:${px(6)};background:#f0f2f4;color:#b0c0d0;border:none;border-radius:${px(6)};cursor:pointer;font-weight:700;font-size:${px(11)};">⏹ Стоп</button>
            </div>

            <div id="sd_status" style="font-size:${px(10)};color:#6a8aaa;text-align:center;padding:${px(4)} 0 ${px(2)};border-top:1px solid #e8eef4;min-height:${px(16)};">⏳ Готов</div>
        </div>
    `);

    const $ = id => document.getElementById(id);
    const ui = $('sd_ui');
    const btnStart = $('sd_start');
    const btnSave = $('sd_save');
    const btnPause = $('sd_pause');
    const btnStop = $('sd_stop');
    const bar = $('sd_bar');
    const progress = $('sd_progress');
    const percent = $('sd_percent');
    const logEl = $('sd_log');
    const statusEl = $('sd_status');
    const radios = document.querySelectorAll('input[name="sd_mode"]');

    // ========== ХЕЛПЕРЫ ==========
    function log(text, isErr = false) {
        const t = new Date().toLocaleTimeString();
        logEl.textContent = `${isErr ? '❌' : 'ℹ️'} [${t}] ${text}`;
        logEl.style.color = isErr ? '#e74c3c' : '#6a8aaa';
        logEl.scrollTop = logEl.scrollHeight;
        console.log('[SD]', text);
    }
    function status(text, isErr = false) {
        statusEl.textContent = text;
        statusEl.style.color = isErr ? '#e74c3c' : '#6a8aaa';
    }
    function fmt(s) {
        if (!s || !isFinite(s)) return '—';
        return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
    }
    function updateStats() {
        const bits = [];
        if (state.cdnUrl) bits.push('🔒 CDN есть');
        if (state.licenseCaptured) bits.push('🔑 Ключ есть');
        if (state.chunks.length) bits.push(`🎧 ${state.chunks.length} чанков`);
        const audio = state.audioElement;
        const dur = audio && isFinite(audio.duration) ? fmt(audio.duration) : '—';
        bits.push(`⏱️ ${dur}`);
        $('sd_stats').textContent = bits.join(' • ');
    }
    function updateProgress() {
        const mb = (state.totalBytes / 1048576).toFixed(1);
        progress.textContent = `📥 ${mb} MB`;
        let pct = 0;
        const audio = state.audioElement;
        if (audio && audio.duration && isFinite(audio.duration)) {
            pct = Math.round((audio.currentTime / audio.duration) * 100);
        } else if (state.mode === 'cdn' && state.cdnBlob) {
            pct = 100;
        } else {
            pct = Math.min(state.chunks.length * 2, 95);
        }
        bar.style.width = `${Math.min(pct, 100)}%`;
        percent.textContent = `${pct}%`;
        updateStats();
    }
    function updateButtons() {
        const run = state.isRunning && !state.isStopped;
        btnStart.disabled = run;
        btnPause.disabled = !run || state.mode !== 'buffer';
        btnStop.disabled = !run;
        const hasData = state.chunks.length > 0 || state.cdnBlob;
        btnSave.disabled = !hasData;
        btnStart.style.opacity = run ? '0.5' : '1';
        btnStart.style.cursor = run ? 'not-allowed' : 'pointer';
        btnSave.style.opacity = hasData ? '1' : '0.5';
        btnSave.style.cursor = hasData ? 'pointer' : 'not-allowed';
    }

    // ========== СОХРАНЕНИЕ ==========
    function downloadBlob(blob, ext = 'm4a') {
        const url = URL.createObjectURL(blob);
        const fname = `${safeTitle}.${ext}`;
        const a = document.createElement('a');
        a.href = url;
        a.download = fname;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 1000);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        const mb = (blob.size / 1048576).toFixed(1);
        log(`✅ Сохранено: ${fname} (${mb} MB)`);
        status(`✅ Готово! ${mb} MB`);
    }

    function detectExt(buf) {
        if (buf.length >= 12) {
            const t = String.fromCharCode(buf[4], buf[5], buf[6], buf[7]);
            if (t === 'webm') return { ext: 'webm', mime: 'audio/webm' };
            if (t === 'ftyp') return { ext: 'm4a', mime: 'audio/mp4' };
        }
        return { ext: 'm4a', mime: 'audio/mp4' };
    }

    function saveBuffer() {
        if (!state.chunks.length) return log('❌ Нет данных буфера', true);
        const totalLen = state.chunks.reduce((s, c) => s + c.length, 0);
        const merged = new Uint8Array(totalLen);
        let off = 0;
        for (const c of state.chunks) { merged.set(c, off); off += c.length; }
        const { ext, mime } = detectExt(merged);
        downloadBlob(new Blob([merged], { type: mime }), ext);
    }

    function saveCdn() {
        if (!state.cdnBlob) return log('❌ Нет данных CDN', true);
        const { ext, mime } = detectExt(new Uint8Array(state.cdnBlob.slice(0, 12)));
        downloadBlob(state.cdnBlob, ext);
    }

    function savePublic() {
        const audio = findAudio();
        if (!audio) return log('❌ Аудио не найдено', true);
        const src = audio.src || audio.currentSrc;
        if (!src || src.startsWith('blob:')) {
            return log('⚠️ Прямая ссылка недоступна, используй буфер', true);
        }
        log(`🔗 Прямой URL: ${src.split('/').pop()}`);
        const a = document.createElement('a');
        a.href = src;
        a.download = `${safeTitle}.m4a`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 1000);
        status('✅ Скачивание запущено');
    }

    // ========== РЕЖИМ: БУФЕР ==========
    function findAudio() {
        const audios = document.querySelectorAll('audio');
        if (!audios.length) return null;
        for (const a of audios) if (!a.paused) return a;
        return audios[0];
    }

    function startBuffer() {
        state.chunks = [];
        state.totalBytes = 0;
        state.isRunning = true;
        state.isPaused = false;
        state.isStopped = false;
        updateProgress();
        updateButtons();
        status('🎧 Буфер: захват активен');
        log('▶ Включи трек и дай ему доиграть до конца');

        state.audioElement = findAudio();
        if (state.audioElement) {
            const audio = state.audioElement;
            log(`🔊 Аудио найдено (${audio.duration ? fmt(audio.duration) : '?'})`);
            audio.addEventListener('ended', () => {
                if (state.isRunning && !state.isStopped) {
                    log('🏁 Трек доигран, завершаем захват...');
                    setTimeout(() => {
                        if (state.isRunning) {
                            state.isRunning = false;
                            updateButtons();
                            log('💾 Нажми «Сохранить»');
                            status('✅ Захват завершён');
                        }
                    }, 1500);
                }
            }, { once: true });
            if (audio.paused) audio.play().catch(() => log('⚠️ Нажми Play вручную', true));
        } else {
            log('⚠️ Аудиоэлемент не найден', true);
        }
        state.checkInterval = setInterval(updateProgress, 500);
    }

    // ========== РЕЖИМ: ПУБЛИЧНЫЙ ==========
    async function startPublic() {
        state.isRunning = true;
        updateButtons();
        status('🔗 Публичный режим');
        log('🔍 Ищем прямой URL...');

        const audio = findAudio();
        if (!audio) {
            log('❌ Аудио не найдено', true);
            state.isRunning = false;
            updateButtons();
            return;
        }
        state.audioElement = audio;

        if (audio.src && !audio.src.startsWith('blob:')) {
            log(`✅ Прямой URL: ${audio.src.split('/').pop()}`);
            state.cdnBlob = null; // не blob, просто прямой
            status('✅ Нажми «Сохранить»');
        } else {
            log('⚠️ Аудио использует blob (MSE). Попробуй CDN режим.', true);
            status('⚠️ Blob URL — используй CDN', true);
        }
        state.isRunning = false;
        updateButtons();
    }

    // ========== РЕЖИМ: CDN + AES ==========
    async function startCdn() {
        state.isRunning = true;
        updateButtons();
        status('🔒 CDN режим');

        // 1. Нужен CDN URL
        if (!state.cdnUrl) {
            log('⏳ Ждём CDN URL... Запусти трек на 2 сек.', false);
            if (!state.audioElement) state.audioElement = findAudio();
            if (state.audioElement?.paused) state.audioElement?.play().catch(()=>{});

            // Ждём до 10 сек
            const start = Date.now();
            while (!state.cdnUrl && Date.now() - start < 10000) {
                await new Promise(r => setTimeout(r, 200));
            }
            if (!state.cdnUrl) {
                log('❌ CDN URL не перехвачен', true);
                state.isRunning = false;
                updateButtons();
                return;
            }
        }

        // 2. Нужен ключ
        if (!state.licenseCaptured) {
            log('⏳ Ждём ключ лицензии...', false);
            const start = Date.now();
            while (!state.licenseCaptured && Date.now() - start < 8000) {
                await new Promise(r => setTimeout(r, 200));
            }
            if (!state.licenseCaptured) {
                log('⚠️ Ключ не перехвачен. Попробуем без расшифровки...', true);
            }
        }

        // 3. Скачиваем CDN
        log(`📥 Качаем: ${state.cdnUrl.split('/').pop()}`);
        try {
            const resp = await fetch(state.cdnUrl, { credentials: 'omit' });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const rawBlob = await resp.blob();
            const mb = (rawBlob.size / 1048576).toFixed(1);
            log(`✅ Скачано ${mb} MB`);

            // 4. Расшифровка если есть ключ
            if (state.licenseCaptured) {
                log('🔓 Расшифровка AES-GCM...');
                const encBuf = await rawBlob.arrayBuffer();

                // декодируем key/iv (base64 или hex)
                const toBuf = str => {
                    try { return Uint8Array.from(atob(str), c => c.charCodeAt(0)); } catch(e) {}
                    if (typeof str === 'string' && str.length % 2 === 0 && /^[0-9a-f]+$/i.test(str)) {
                        return new Uint8Array(str.match(/.{1,2}/g).map(b => parseInt(b, 16)));
                    }
                    return new Uint8Array(str);
                };
                const keyBuf = toBuf(state.licenseKey);
                const ivBuf = toBuf(state.licenseIv);

                const cryptoKey = await crypto.subtle.importKey(
                    'raw', keyBuf, { name: 'AES-GCM' }, false, ['decrypt']
                );
                const decrypted = await crypto.subtle.decrypt(
                    { name: 'AES-GCM', iv: ivBuf, tagLength: 128 },
                    cryptoKey,
                    encBuf
                );
                state.cdnBlob = new Blob([decrypted], { type: 'audio/mp4' });
                log(`✅ Расшифровано: ${(decrypted.byteLength / 1048576).toFixed(1)} MB`);
            } else {
                state.cdnBlob = rawBlob;
                log('⚠️ Сохранено как есть (без расшифровки)', true);
            }

            updateProgress();
            status('✅ Нажми «Сохранить»');
        } catch(e) {
            log(`❌ Ошибка CDN: ${e.message}`, true);
            status('❌ Ошибка CDN', true);
        }
        state.isRunning = false;
        updateButtons();
    }

    // ========== СТАРТ ==========
    function start() {
        state.isStopped = false;
        if (state.mode === 'buffer') return startBuffer();
        if (state.mode === 'public') return startPublic();
        if (state.mode === 'cdn') return startCdn();
    }

    // ========== ПАУЗА / СТОП ==========
    function pause() {
        if (!state.isRunning || state.mode !== 'buffer') return;
        state.isPaused = !state.isPaused;
        btnPause.textContent = state.isPaused ? '▶ Далее' : '⏸ Пауза';
        status(state.isPaused ? '⏸ Пауза' : '▶ Продолжаем');
    }
    function stop() {
        if (!state.isRunning) return;
        state.isStopped = true;
        state.isRunning = false;
        state.isPaused = false;
        if (state.checkInterval) clearInterval(state.checkInterval);
        updateButtons();
        status('⏹ Остановлено');
        log(`⏹ Собрано: ${state.chunks.length} чанков`);
    }

    // ========== СОХРАНЕНИЕ ==========
    function save() {
        if (state.mode === 'buffer') return saveBuffer();
        if (state.mode === 'cdn') return saveCdn();
        if (state.mode === 'public') return savePublic();
    }

    // ========== ОБРАБОТЧИКИ ==========
    radios.forEach(r => r.addEventListener('change', e => {
        state.mode = e.target.value;
        log(`🎛 Режим: ${state.mode}`);
        updateButtons();
    }));
    btnStart.addEventListener('click', start);
    btnSave.addEventListener('click', save);
    btnPause.addEventListener('click', pause);
    btnStop.addEventListener('click', stop);
    $('sd_close').addEventListener('click', () => {
        if (state.isRunning && !confirm('Захват идёт. Закрыть?')) return;
        state.isStopped = true;
        if (state.checkInterval) clearInterval(state.checkInterval);
        ui.remove();
    });

    // ========== INIT ==========
    updateButtons();
    status('⏳ Готов. Выбери режим и нажми «Старт».');
    log(`🎵 ${state.title}`);

    // Автоопределение режима по URL
    setTimeout(() => {
        if (location.pathname.startsWith('/s/')) {
            log('💡 Похоже, это публичная ссылка — попробуй режим «Публичный»');
        }
        state.title = getTitle();
        state.author = getAuthor();
        $('sd_title').textContent = state.title;
        $('sd_author').textContent = state.author;
        updateStats();
    }, 1500);

    window.sunoDL = { state, start, stop, save };
    console.log('✅ Suno Downloader v2.0 запущен');
})();
