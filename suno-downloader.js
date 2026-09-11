/**
 * Suno Downloader v5.0 — правильный AES-CTR (по sw.js)
 */
(function sunoDownloaderV5() {
    console.log('🎵 Suno Downloader v5.0 — правильный AES-CTR');

    const S = 1.25;
    const px = v => `${Math.round(v * S * 100) / 100}px`;

    const state = {
        clipId: null,
        cdnUrl: null,
        licenseKey: null,
        licenseIv: null,
        glt: null,
        jwt: null,
        resultBlob: null,
        isRunning: false
    };

    // ===== Base64 → Uint8Array =====
    function b64(b) {
        const bin = atob(b);
        const u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        return u;
    }

    // ===== Извлечение JWT из заголовков =====
    function extractAuth(headers) {
        if (!headers) return null;
        let auth = null;
        if (headers instanceof Headers) {
            auth = headers.get('Authorization') || headers.get('authorization');
        } else if (Array.isArray(headers)) {
            for (const [k, v] of headers) if (k.toLowerCase() === 'authorization') auth = v;
        } else if (typeof headers === 'object') {
            auth = headers['Authorization'] || headers['authorization'] || headers['AUTHORIZATION'];
        }
        if (typeof auth === 'string') return auth.replace(/^Bearer\s+/i, '');
        return null;
    }

    // ===== Перехват =====
    const origFetch = window.fetch;
    window.fetch = function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
        const opts = args[1] || {};

        // JWT
        const auth = extractAuth(opts.headers);
        if (auth && auth.length > 50 && !state.jwt) {
            state.jwt = auth;
            log('🔐 JWT перехвачен');
            updateStats();
        }

        // CDN (напрямую или через SW HLS-параметр)
        if ((url.includes('cloudfront.net') && url.includes('.m4a')) || url.includes('/_sw-mango/')) {
            try {
                const u = new URL(url);
                const src = u.searchParams.get('src') || url;
                const cid = u.searchParams.get('contentId');
                if (src.includes('cloudfront') && !state.cdnUrl) {
                    state.cdnUrl = src;
                    const m = src.match(/\/clip\/([0-9a-f-]{36})/);
                    if (m) state.clipId = m[1];
                    else if (cid) state.clipId = cid;
                    log(`🔒 CDN: ${src.split('/').pop()}`);
                    updateStats();
                }
            } catch(e) {}
        }

        // License response
        if (url.includes('/api/mango/rights')) {
            return origFetch.apply(this, args).then(resp => {
                resp.clone().json().then(d => {
                    state.licenseKey = d.key;
                    state.licenseIv = d.iv;
                    state.glt = d.glt;
                    log('🔑 License OK');
                    updateStats();
                }).catch(()=>{});
                return resp;
            });
        }

        return origFetch.apply(this, args);
    };

    // ===== UI =====
    document.body.insertAdjacentHTML('beforeend', `
        <div id="sd6_ui" style="position:fixed;bottom:${px(16)};right:${px(16)};z-index:99999;
            background:#fff;color:#1a2a4a;border-radius:${px(14)};padding:${px(14)} ${px(16)};
            font-family:'Segoe UI',Arial,sans-serif;font-size:${px(12)};width:${px(400)};
            box-shadow:0 ${px(8)} ${px(32)} rgba(0,0,0,0.15);border:1px solid rgba(26,42,74,0.08);">

            <div style="display:flex;align-items:center;gap:${px(8)};margin-bottom:${px(10)};">
                <div style="font-size:${px(20)};">🎵</div>
                <div style="flex:1;">
                    <div style="font-weight:800;font-size:${px(14)};">Suno <span style="color:#1a5a9a;">Downloader</span></div>
                    <div style="font-size:${px(9)};color:#8a9aaa;text-transform:uppercase;">v5.0 • AES-CTR</div>
                </div>
                <button id="sd6_close" style="background:rgba(26,42,74,0.05);border:none;color:#8a9aaa;cursor:pointer;font-size:${px(14)};padding:${px(3)} ${px(7)};border-radius:${px(6)};">✕</button>
            </div>

            <div id="sd6_stats" style="background:#f0f7ff;border-radius:${px(8)};padding:${px(8)} ${px(10)};margin-bottom:${px(8)};border-left:${px(3)} solid #1a5a9a;font-size:${px(11)};line-height:1.5;">
                ⏳ Ждём данные... Включи трек.
            </div>

            <div style="background:#f0f4fa;border-radius:${px(8)};padding:${px(8)} ${px(10)};margin-bottom:${px(8)};">
                <div id="sd6_log" style="font-size:${px(10)};color:#6a8aaa;background:#e8eef4;padding:${px(6)};border-radius:${px(4)};max-height:${px(140)};overflow-y:auto;font-family:'Courier New',monospace;line-height:1.4;white-space:pre-wrap;">⏳ Готов</div>
            </div>

            <div style="display:flex;gap:${px(4)};">
                <button id="sd6_go" style="flex:2;padding:${px(10)};background:#27ae60;color:#fff;border:none;border-radius:${px(6)};cursor:pointer;font-weight:700;font-size:${px(12)};">⬇ Скачать</button>
                <button id="sd6_save" style="flex:1;padding:${px(10)};background:#1a3a6a;color:#fff;border:none;border-radius:${px(6)};cursor:pointer;font-weight:700;font-size:${px(11)};opacity:0.5;">💾</button>
            </div>

            <div id="sd6_status" style="font-size:${px(10)};color:#6a8aaa;text-align:center;padding:${px(4)} 0;border-top:1px solid #e8eef4;margin-top:${px(8)};">⏳ Готов</div>
        </div>
    `);

    const $ = id => document.getElementById(id);
    const logEl = $('sd6_log');
    const statsEl = $('sd6_stats');
    const statusEl = $('sd6_status');

    function log(t) {
        const ts = new Date().toLocaleTimeString();
        logEl.textContent += `\n[${ts}] ${t}`;
        logEl.scrollTop = logEl.scrollHeight;
        console.log('[SD6]', t);
    }
    function updateStats() {
        const b = [];
        if (state.jwt) b.push('🔐 JWT');
        if (state.cdnUrl) b.push('🔒 CDN');
        if (state.licenseKey) b.push('🔑 Key');
        if (state.licenseIv) b.push('🎲 IV');
        if (state.clipId) b.push(`🆔 ${state.clipId.slice(0,8)}`);
        statsEl.textContent = b.join(' • ') || '⏳ Ждём данные...';
    }
    function status(t, err) {
        statusEl.textContent = t;
        statusEl.style.color = err ? '#e74c3c' : '#6a8aaa';
    }

    // ===== License fetch (если не перехватили) =====
    async function fetchLicense() {
        if (state.licenseKey && state.licenseIv) return;
        if (!state.clipId) throw new Error('Нет clipId');

        const headers = { 'Content-Type': 'application/json' };
        let credentials = 'include';
        if (state.jwt) {
            headers['Authorization'] = 'Bearer ' + state.jwt;
            credentials = 'same-origin';
        }

        log(`📡 Запрос license ${state.jwt ? '(auth)' : '(anon)'}`);
        const resp = await fetch('https://studio-api-prod.suno.com/api/mango/rights', {
            method: 'POST',
            headers,
            credentials,
            body: JSON.stringify({
                content_params: {
                    content_id: state.clipId,
                    content_type: 'clip'
                }
            })
        });
        if (!resp.ok) throw new Error('license HTTP ' + resp.status);
        const d = await resp.json();
        state.licenseKey = d.key;
        state.licenseIv = d.iv;
        state.glt = d.glt;
        log('🔑 License OK');
        updateStats();
    }

    // ===== Расшифровка + скачивание =====
    async function download() {
        if (state.isRunning) return;
        state.isRunning = true;
        logEl.textContent = '▶ Запуск';
        status('⏳ Подготовка...');

        try {
            // Ждём CDN + clipId
            if (!state.cdnUrl || !state.clipId) {
                log('⏳ Ждём CDN... Включи трек на 3-5 сек');
                const t0 = Date.now();
                while ((!state.cdnUrl || !state.clipId) && Date.now() - t0 < 15000) {
                    await new Promise(r => setTimeout(r, 200));
                }
            }
            if (!state.cdnUrl) throw new Error('CDN не перехвачен');
            if (!state.clipId) throw new Error('clipId не найден');

            // Ждём JWT
            if (!state.jwt) {
                log('⏳ Ждём JWT...');
                const t0 = Date.now();
                while (!state.jwt && Date.now() - t0 < 8000) {
                    await new Promise(r => setTimeout(r, 200));
                }
            }

            await fetchLicense();
            if (!state.licenseKey) throw new Error('License не получен');

            // ===== Шаг 1: декодируем base64 =====
            const wrappedKey = b64(state.licenseKey);
            const wrappedIv = b64(state.licenseIv);
            log(`📦 wrappedKey: ${wrappedKey.length} байт`);
            log(`📦 wrappedIv:  ${wrappedIv.length} байт`);

            // ===== Шаг 2: userKey = SHA-256(JWT) или SHA-256(glt) =====
            let userKeyRaw;
            if (state.jwt) {
                log('🔐 userKey = SHA-256(JWT)');
                userKeyRaw = await crypto.subtle.digest(
                    'SHA-256',
                    new TextEncoder().encode(state.jwt)
                );
            } else if (state.glt) {
                log('🔐 userKey = SHA-256(glt)');
                userKeyRaw = await crypto.subtle.digest(
                    'SHA-256',
                    new TextEncoder().encode(state.glt)
                );
            } else {
                throw new Error('Нет JWT и нет glt');
            }

            const userKey = await crypto.subtle.importKey(
                'raw', userKeyRaw,
                { name: 'AES-GCM' },
                false, ['decrypt']
            );

            const contentIdBytes = new TextEncoder().encode(state.clipId);

            // ===== Шаг 3: расшифровываем wrappedKey → AES-CTR ключ =====
            const aesKeyRaw = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: wrappedKey.slice(0, 12),
                    additionalData: contentIdBytes,
                    tagLength: 128
                },
                userKey,
                wrappedKey.slice(12)
            );
            log(`🔑 contentKey: ${aesKeyRaw.byteLength} байт`);

            // ===== Шаг 4: расшифровываем wrappedIv → AES-CTR counter =====
            const aesIvRaw = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: wrappedIv.slice(0, 12),
                    additionalData: contentIdBytes,
                    tagLength: 128
                },
                userKey,
                wrappedIv.slice(12)
            );
            log(`🎲 contentIv:  ${aesIvRaw.byteLength} байт`);

            // ===== Шаг 5: импорт AES-CTR ключа =====
            const aesCtrKey = await crypto.subtle.importKey(
                'raw', aesKeyRaw,
                { name: 'AES-CTR' },
                false, ['decrypt']
            );

            // ===== Шаг 6: скачиваем зашифрованный файл =====
            log(`📥 Скачиваем ${state.cdnUrl.split('/').pop()}`);
            const cdnResp = await fetch(state.cdnUrl);
            if (!cdnResp.ok) throw new Error('CDN HTTP ' + cdnResp.status);
            const encData = await cdnResp.arrayBuffer();
            log(`📦 Зашифровано: ${(encData.byteLength/1048576).toFixed(2)} MB`);

            // ===== Шаг 7: AES-CTR расшифровка =====
            const decData = await crypto.subtle.decrypt(
                {
                    name: 'AES-CTR',
                    counter: new Uint8Array(aesIvRaw),
                    length: 128
                },
                aesCtrKey,
                encData
            );
            log(`🎉 Расшифровано: ${(decData.byteLength/1048576).toFixed(2)} MB`);

            // Проверка заголовка
            const head = new Uint8Array(decData.slice(0, 12));
            const ascii = Array.from(head).map(b => (b>=32&&b<127)?String.fromCharCode(b):'.').join('');
            log(`🔍 Header: ${ascii}`);

            const mime = ascii.includes('ftyp') ? 'audio/mp4' :
                         (head[0]===0x1a ? 'audio/webm' : 'audio/mp4');
            state.resultBlob = new Blob([decData], { type: mime });
            status('✅ Готово! Жми Сохранить');
            $('sd6_save').style.opacity = '1';
            log(`✅ Файл готов`);

        } catch(e) {
            log(`❌ Ошибка: ${e.message}`);
            status('❌ Ошибка', true);
            console.error(e);
        }
        state.isRunning = false;
    }

    function save() {
        if (!state.resultBlob) return log('❌ Нет данных');
        const title = (document.querySelector('h1')?.textContent?.trim() || 'suno_track')
            .replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
        const url = URL.createObjectURL(state.resultBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.m4a`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        log(`💾 Сохранено: ${title}.m4a`);
    }

    $('sd6_go').onclick = download;
    $('sd6_save').onclick = save;
    $('sd6_close').onclick = () => $('sd6_ui').remove();

    updateStats();
    log('✅ Готов. Включи трек, потом жми «Скачать»');
    status('⏳ Ждём данные');
    console.log('✅ Suno Downloader v5.0 запущен');
})();
