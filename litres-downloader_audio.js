/**
 * LitRes Audio Mini v1.1
 * 🎧 Скачивание аудиокниг LitRes
 * (c) 2026 Diminssoft
 */
(function litAudioMini() {
    console.log('🎧 LitRes Audio Mini v1.1');
    
    // Убираем старый UI если был
    document.getElementById('la_ui')?.remove();

    const S = 1.25;
    const px = (v) => `${Math.round(v * S * 100) / 100}px`;

    const artId = (() => {
        const m = window.location.pathname.match(/-(\d+)\/?$/);
        return m ? m[1] : null;
    })();
    if (!artId) return alert('❌ Не удалось определить ID книги');
    const isAudio = window.location.pathname.includes('/audiobook/');
    console.log(`🆔 artId: ${artId}, аудио: ${isAudio}`);

    function getCookie(n) {
        const v = `; ${document.cookie}`;
        const p = v.split(`; ${n}=`);
        return p.length === 2 ? p.pop().split(';').shift() : null;
    }
    function headers() {
        return {
            'accept': 'application/json, text/plain, */*',
            'accept-version': '2',
            'app-id': '115',
            'client-host': 'www.litres.ru',
            'session-id': getCookie('SID') || '',
            'supersid': getCookie('supersid') || '',
            'ui-currency': 'RUB',
            'ui-language-code': 'ru',
            'x-request-id': Date.now().toString(36) + Math.random().toString(36).slice(2)
        };
    }

    const state = {
        title: '...',
        author: '...',
        chapters: [],
        zipFile: null,
        m4bFile: null,
        bonusFile: null,
        totalSec: 0,
        isRunning: false,
        isPaused: false,
        isStopped: false,
        downloaded: 0,
        total: 0,
        zip: null
    };

    async function fetchInfo() {
        try {
            const ar = await fetch(
                `https://api.litres.ru/foundation/api/arts/${artId}`,
                { credentials: 'include', headers: headers() }
            );
            if (ar.ok) {
                const d = await ar.json();
                const p = d?.payload?.data;
                if (p) {
                    state.title = p.title || state.title;
                    const a = p.persons?.find(x => x.role === 'author');
                    if (a?.full_name) state.author = a.full_name;
                }
            }
            const gr = await fetch(
                `https://api.litres.ru/foundation/api/arts/${artId}/files/grouped`,
                { credentials: 'include', headers: headers() }
            );
            if (!gr.ok) throw new Error(`files/grouped: ${gr.status}`);
            const gd = await gr.json();
            const groups = gd?.payload?.data || [];
            for (const g of groups) {
                const files = g.files || [];
                if (g.file_type === 'standard_quality_mp3') {
                    state.chapters = files
                        .filter(f => !f.is_additional)
                        .map((f, i) => ({
                            index: i + 1,
                            id: f.id,
                            filename: f.filename,
                            size: f.size || 0,
                            seconds: f.seconds || 0
                        }))
                        .sort((a, b) => a.filename.localeCompare(b.filename));
                } else if (g.file_type === 'zip_with_mp3' && files[0]) {
                    state.zipFile = { id: files[0].id, filename: files[0].filename, size: files[0].size || 0 };
                } else if (g.file_type === 'mobile_version_mp4' && files[0]) {
                    state.m4bFile = { id: files[0].id, filename: files[0].filename, size: files[0].size || 0 };
                } else if (g.file_type === 'additional_materials_mp3' && files[0]) {
                    state.bonusFile = { id: files[0].id, filename: files[0].filename, size: files[0].size || 0 };
                }
            }
            state.totalSec = state.chapters.reduce((s, c) => s + c.seconds, 0);
            return true;
        } catch(e) {
            console.error('[LA] fetchInfo error:', e);
            return false;
        }
    }

    function fileUrl(fileId, filename) {
        return `https://www.litres.ru/download_book_subscr/${artId}/${fileId}/${encodeURIComponent(filename)}`;
    }

    // ========== СКАЧИВАНИЕ НАПРЯМУЮ (2 способа + fallback) ==========
    function dlDirect(fileId, filename) {
        const url = fileUrl(fileId, filename);
        console.log('[LA] 📥 URL:', url);

        // Способ 1: anchor с download
        try {
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.rel = 'noopener';
            a.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
            document.body.appendChild(a);
            a.click();
            console.log('[LA] ✅ anchor.click() — вызван');
            setTimeout(() => a.remove(), 3000);
        } catch(e) {
            console.error('[LA] ❌ anchor failed:', e);
        }

        // Способ 2: window.open через 500мс если не сработал
        setTimeout(() => {
            console.log('[LA] 🔄 Fallback: window.open');
            const w = window.open(url, '_blank', 'noopener');
            if (!w) {
                console.warn('[LA] ⚠️ window.open заблокирован — используй прямую ссылку:');
                console.log(url);
            }
        }, 800);

        log(`📥 ${filename}`);
        status(`📥 ${filename}`);
    }

    async function dlChapter(ch) {
        try {
            const r = await fetch(fileUrl(ch.id, ch.filename), {
                credentials: 'include',
                headers: { 'referer': window.location.href }
            });
            if (!r.ok) return { ok: false, err: `HTTP ${r.status}` };
            const b = await r.blob();
            if (!b.size) return { ok: false, err: 'Пусто' };
            const name = ch.filename || `${String(ch.index).padStart(2,'0')}.mp3`;
            state.zip.file(`audio/${name}`, b);
            return { ok: true, size: b.size };
        } catch(e) {
            return { ok: false, err: e.message };
        }
    }

    // ========== TOAST ==========
    function toast(msg, ok = true) {
        const t = document.createElement('div');
        t.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);
            background:${ok ? '#27ae60' : '#e74c3c'};color:#fff;padding:10px 20px;
            border-radius:8px;font-family:'Segoe UI',sans-serif;font-size:14px;
            z-index:2147483647;box-shadow:0 4px 20px rgba(0,0,0,0.3);pointer-events:none;`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2500);
    }

    // ========== UI (z-index МАКСИМАЛЬНЫЙ, pointer-events явно) ==========
    document.body.insertAdjacentHTML('beforeend', `
        <div id="la_ui" style="position:fixed;bottom:${px(16)};right:${px(16)};z-index:2147483647;
            background:#fff;color:#1a2a4a;border-radius:${px(14)};padding:${px(14)} ${px(16)};
            font-family:'Segoe UI',Arial,sans-serif;font-size:${px(12)};width:${px(380)};
            box-shadow:0 ${px(8)} ${px(32)} rgba(0,0,0,0.25);border:1px solid rgba(26,42,74,0.08);
            pointer-events:auto !important;">
            <div style="display:flex;align-items:center;gap:${px(8)};margin-bottom:${px(10)};">
                <div style="font-size:${px(20)};">🎧</div>
                <div style="flex:1;">
                    <div style="font-weight:800;font-size:${px(14)};">LitRes <span style="color:#1a5a9a;">Audio</span></div>
                    <div style="font-size:${px(9)};color:#8a9aaa;text-transform:uppercase;">v1.1 • mini</div>
                </div>
                <button id="la_close" type="button" style="background:rgba(26,42,74,0.05);border:none;color:#8a9aaa;cursor:pointer;font-size:${px(14)};padding:${px(3)} ${px(7)};border-radius:${px(6)};">✕</button>
            </div>

            <div style="background:#f0f7ff;border-radius:${px(8)};padding:${px(8)} ${px(10)};margin-bottom:${px(8)};border-left:${px(3)} solid #1a5a9a;font-size:${px(11)};line-height:1.4;">
                <div style="font-weight:700;" id="la_title">⏳ Загрузка...</div>
                <div style="color:#4a6a8a;" id="la_author">...</div>
                <div style="color:#4a6a8a;margin-top:${px(2)};" id="la_stats">—</div>
            </div>

            <div style="background:#f0f4fa;border-radius:${px(8)};padding:${px(8)} ${px(10)};margin-bottom:${px(8)};">
                <div style="width:100%;height:${px(6)};background:#e8eef4;border-radius:${px(3)};overflow:hidden;margin-bottom:${px(6)};">
                    <div id="la_bar" style="width:0%;height:100%;background:linear-gradient(90deg,#1a5a9a,#4a8af4);border-radius:${px(3)};transition:width 0.4s;"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:${px(10)};color:#6a8aaa;margin-bottom:${px(4)};">
                    <span id="la_progress">📥 0 / 0</span>
                    <span id="la_percent" style="font-weight:700;color:#1a5a9a;">0%</span>
                </div>
                <div id="la_log" style="font-size:${px(10)};color:#6a8aaa;background:#e8eef4;padding:${px(3)} ${px(6)};border-radius:${px(4)};max-height:${px(52)};overflow-y:auto;font-family:'Courier New',monospace;line-height:1.3;">⏳ Загрузка...</div>
            </div>

            <div style="display:flex;gap:${px(4)};margin-bottom:${px(6)};">
                <button id="la_zip" type="button" style="flex:1;padding:${px(10)} ${px(6)};background:#27ae60;color:#fff;border:none;border-radius:${px(6)};cursor:pointer;font-weight:700;font-size:${px(11)};pointer-events:auto !important;">📦 ZIP</button>
                <button id="la_m4b" type="button" style="flex:1;padding:${px(10)} ${px(6)};background:#8e44ad;color:#fff;border:none;border-radius:${px(6)};cursor:pointer;font-weight:700;font-size:${px(11)};pointer-events:auto !important;">🎵 M4B</button>
                <button id="la_ch" type="button" style="flex:1;padding:${px(10)} ${px(6)};background:#1a3a6a;color:#fff;border:none;border-radius:${px(6)};cursor:pointer;font-weight:700;font-size:${px(11)};pointer-events:auto !important;">🎧 Главы</button>
            </div>

            <div style="display:flex;gap:${px(4)};margin-bottom:${px(6)};">
                <button id="la_pause" type="button" disabled style="flex:1;padding:${px(6)};background:#e8eef4;color:#8a9aaa;border:none;border-radius:${px(6)};cursor:pointer;font-weight:700;font-size:${px(11)};">⏸ Пауза</button>
                <button id="la_stop" type="button" disabled style="flex:1;padding:${px(6)};background:#f0f2f4;color:#b0c0d0;border:none;border-radius:${px(6)};cursor:pointer;font-weight:700;font-size:${px(11)};">⏹ Стоп</button>
            </div>

            <div id="la_status" style="font-size:${px(10)};color:#6a8aaa;text-align:center;padding:${px(4)} 0 ${px(2)};border-top:1px solid #e8eef4;min-height:${px(16)};">⏳ Загрузка...</div>
        </div>
    `);

    const $ = id => document.getElementById(id);
    const ui = $('la_ui');
    const btnZip = $('la_zip');
    const btnM4b = $('la_m4b');
    const btnCh = $('la_ch');
    const btnPause = $('la_pause');
    const btnStop = $('la_stop');
    const bar = $('la_bar');
    const progress = $('la_progress');
    const percent = $('la_percent');
    const logEl = $('la_log');
    const statusEl = $('la_status');

    function log(text, isErr = false) {
        const t = new Date().toLocaleTimeString();
        logEl.textContent = `${isErr ? '❌' : 'ℹ️'} [${t}] ${text}`;
        logEl.style.color = isErr ? '#e74c3c' : '#6a8aaa';
        console.log('[LA]', text);
    }
    function status(text, isErr = false) {
        statusEl.textContent = text;
        statusEl.style.color = isErr ? '#e74c3c' : '#6a8aaa';
        log(text, isErr);
    }
    function updProgress() {
        const p = state.total > 0 ? Math.round((state.downloaded / state.total) * 100) : 0;
        bar.style.width = `${Math.min(p, 100)}%`;
        progress.textContent = `📥 ${state.downloaded} / ${state.total}`;
        percent.textContent = `${p}%`;
    }
    function updButtons() {
        const run = state.isRunning && !state.isPaused;
        btnZip.disabled = run;
        btnM4b.disabled = run;
        btnCh.disabled = run;
        btnPause.disabled = !state.isRunning;
        btnStop.disabled = !state.isRunning;
        [btnZip, btnM4b, btnCh].forEach(b => {
            if (!run) {
                b.style.opacity = '1';
                b.style.cursor = 'pointer';
            }
        });
    }

    // ========== ОБРАБОТЧИКИ ==========
    btnZip.addEventListener('click', function(e) {
        console.log('[LA] 🖱️ ZIP click');
        e.preventDefault();
        e.stopPropagation();
        if (!state.zipFile) { toast('❌ ZIP недоступен', false); return; }
        toast(`📦 Старт: ${(state.zipFile.size/1048576).toFixed(0)} MB`);
        dlDirect(state.zipFile.id, state.zipFile.filename);
    });

    btnM4b.addEventListener('click', function(e) {
        console.log('[LA] 🖱️ M4B click');
        e.preventDefault();
        e.stopPropagation();
        if (!state.m4bFile) { toast('❌ M4B недоступен', false); return; }
        toast(`🎵 Старт: ${(state.m4bFile.size/1048576).toFixed(0)} MB`);
        dlDirect(state.m4bFile.id, state.m4bFile.filename);
    });

    btnCh.addEventListener('click', async function(e) {
        console.log('[LA] 🖱️ Главы click');
        e.preventDefault();
        e.stopPropagation();
        if (state.isRunning) return;
        if (!state.chapters.length) { toast('❌ Главы не найдены', false); return; }

        const inp = prompt(
            `🎧 "${state.title}"\n📄 Глав: ${state.chapters.length}\n\nДиапазон (например "1-55" или "1-10"):`,
            `1-${state.chapters.length}`
        );
        if (inp === null) return;
        const m = inp.match(/^(\d+)\s*-\s*(\d+)$/);
        let start = 1, end = state.chapters.length;
        if (m) {
            start = Math.max(1, parseInt(m[1]));
            end = Math.min(state.chapters.length, parseInt(m[2]));
        } else {
            const n = parseInt(inp);
            if (!isNaN(n) && n > 0) end = Math.min(state.chapters.length, n);
        }
        if (start > end) { toast('❌ Неверный диапазон', false); return; }

        if (typeof JSZip === 'undefined') {
            status('⏳ Загрузка JSZip...');
            await new Promise(res => {
                const s = document.createElement('script');
                s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
                s.onload = res;
                s.onerror = res;
                document.head.appendChild(s);
            });
        }

        state.zip = new JSZip();
        state.downloaded = 0;
        state.total = end - start + 1;
        state.isRunning = true;
        state.isPaused = false;
        state.isStopped = false;

        updProgress();
        updButtons();
        status(`🎧 Главы ${start}-${end}`);
        toast(`🎧 ${state.total} глав`);

        for (let i = start; i <= end; i++) {
            if (state.isStopped) break;
            while (state.isPaused && !state.isStopped) {
                await new Promise(r => setTimeout(r, 500));
            }
            if (state.isStopped) break;

            const ch = state.chapters[i - 1];
            if (!ch) continue;
            const mb = (ch.size / 1048576).toFixed(1);
            status(`🎧 Глава ${i} (${mb} MB)...`);

            const res = await dlChapter(ch);
            if (res.ok) {
                state.downloaded++;
                updProgress();
                log(`✅ Глава ${i} → ${(res.size/1048576).toFixed(1)} MB`);
            } else {
                log(`⚠️ Глава ${i}: ${res.err}`, true);
            }
            await new Promise(r => setTimeout(r, 300));
        }

        if (!state.isStopped) {
            status('📦 Формируем ZIP...');
            try {
                const blob = await state.zip.generateAsync({
                    type: 'blob', compression: 'DEFLATE',
                    compressionOptions: { level: 3 }
                });
                const safe = state.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100);
                const fname = `${safe}(audio ${start}-${end}).zip`;
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = fname;
                a.style.cssText = 'position:fixed;left:-9999px;';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => a.remove(), 2000);
                status(`🎉 Готово! ${state.downloaded} глав → ${fname}`);
                toast(`✅ Готово: ${state.downloaded} глав`);
            } catch(err) {
                status(`❌ Ошибка ZIP: ${err.message}`, true);
                toast('❌ Ошибка ZIP', false);
            }
        }

        state.isRunning = false;
        state.isPaused = false;
        updButtons();
    });

    btnPause.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (!state.isRunning) return;
        state.isPaused = !state.isPaused;
        btnPause.textContent = state.isPaused ? '▶ Далее' : '⏸ Пауза';
        status(state.isPaused ? '⏸ Пауза' : '▶ Продолжаем');
    });

    btnStop.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (!state.isRunning) return;
        state.isStopped = true;
        state.isPaused = false;
        status('⏹ Стоп');
        toast('⏹ Остановлено');
        setTimeout(() => { state.isRunning = false; updButtons(); }, 500);
    });

    $('la_close').addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (state.isRunning && !confirm('Загрузка идёт. Закрыть?')) return;
        state.isStopped = true;
        ui.remove();
    });

    // ========== INIT ==========
    (async () => {
        if (!isAudio) {
            status('ℹ️ Это не аудиокнига', true);
            $('la_title').textContent = '⚠️ Не аудиокнига';
            $('la_author').textContent = 'Открой /audiobook/...';
            [btnZip, btnM4b, btnCh].forEach(b => { b.disabled = true; b.style.opacity = '0.4'; });
            return;
        }

        const ok = await fetchInfo();
        if (!ok) {
            status('❌ Ошибка загрузки инфо', true);
            return;
        }

        $('la_title').textContent = state.title;
        $('la_author').textContent = state.author;

        const h = Math.floor(state.totalSec / 3600);
        const mn = Math.round((state.totalSec % 3600) / 60);
        const bits = [`📄 ${state.chapters.length} глав`];
        if (h) bits.push(`⏱️ ${h}ч ${mn}м`);
        if (state.zipFile) bits.push(`📦 ${(state.zipFile.size/1048576).toFixed(0)} MB`);
        if (state.m4bFile) bits.push(`🎵 ${(state.m4bFile.size/1048576).toFixed(0)} MB`);
        $('la_stats').textContent = bits.join(' • ');

        btnZip.disabled = !state.zipFile;
        btnM4b.disabled = !state.m4bFile;
        if (!state.zipFile) btnZip.style.opacity = '0.4';
        if (!state.m4bFile) btnM4b.style.opacity = '0.4';

        updProgress();
        status(`✅ Готово: ${state.chapters.length} глав`);
        log(`✅ "${state.title}"`);
        console.log('[LA] state:', state);
    })();

    window.litAudioMini = { state, fetchInfo, fileUrl, dlDirect };
})();
