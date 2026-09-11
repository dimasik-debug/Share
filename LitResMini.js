/**
 * LitRes Reader Mini v1.0
 * 📖 Скачивание книг через JSON-главы читалки
 * Работает когда ZIP-ссылка 404
 * (c) 2026 Diminssoft
 */
(function litReaderMini() {
    console.log('📖 LitRes Reader Mini v1.0');
    document.getElementById('lrm_ui')?.remove();

    const S = 1.25;
    const px = v => `${Math.round(v * S * 100) / 100}px`;

    // ID из URL
    const m = location.pathname.match(/-(\d+)\/?$/);
    const artId = m ? m[1] : null;
    if (!artId) return alert('❌ Не нашёл artId');

    const state = {
        title: document.title.split('—')[0].trim() || 'Книга',
        author: '...',
        fileId: null,
        chapters: [],      // HTML глав
        total: 0,
        downloaded: 0,
        isRunning: false,
        isPaused: false,
        isStopped: false
    };

    // ========== API ==========
    async function getCookies() {
        return {
            'session-id': (document.cookie.match(/SID=([^;]+)/) || [])[1] || '',
            'supersid': (document.cookie.match(/supersid=([^;]+)/) || [])[1] || ''
        };
    }

    async function getHeaders() {
        const c = await getCookies();
        return {
            'accept': 'application/json, text/plain, */*',
            'accept-version': '2',
            'app-id': '115',
            'client-host': 'www.litres.ru',
            'session-id': c['session-id'],
            'supersid': c['supersid'],
            'ui-currency': 'RUB',
            'ui-language-code': 'ru',
            'x-request-id': Date.now().toString(36) + Math.random().toString(36).slice(2)
        };
    }

    async function fetchBookInfo() {
        const r = await fetch(`https://api.litres.ru/foundation/api/arts/${artId}`, {
            credentials: 'include',
            headers: await getHeaders()
        });
        if (!r.ok) throw new Error(`API ${r.status}`);
        const d = await r.json();
        const p = d?.payload?.data;
        if (!p) throw new Error('Нет payload');

        state.title = p.title || state.title;
        const a = p.persons?.find(x => x.role === 'author');
        if (a?.full_name) state.author = a.full_name;
        state.fileId = p.release_file_id;

        if (!state.fileId) throw new Error('Нет fileId');
        return true;
    }

    // ========== ПАРСЕР ==========
    function parseLitFile(text) {
        const clean = text.trim().replace(/;\s*$/, '');
        try {
            return new Function('return (' + clean + ')')();
        } catch(e) {
            const s = clean.indexOf('[');
            const e2 = clean.lastIndexOf(']');
            if (s >= 0 && e2 > s) {
                return new Function('return (' + clean.slice(s, e2 + 1) + ')')();
            }
            throw e;
        }
    }

    function esc(s) {
        return String(s).replace(/[&<>"']/g, c => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        }[c]));
    }

    function litJsonToHtml(nodes) {
        if (!Array.isArray(nodes)) {
            if (typeof nodes === 'string') return esc(nodes);
            if (nodes && typeof nodes === 'object') return litJsonToHtml(nodes.c || []);
            return '';
        }
        return nodes.map(n => {
            if (typeof n === 'string') return esc(n);
            if (!n || !n.t) return '';
            const inner = litJsonToHtml(n.c || []);
            switch (n.t) {
                case 'title': return `<h2>${inner}</h2>`;
                case 'subtitle': return `<h3>${inner}</h3>`;
                case 'p': return `<p>${inner}</p>`;
                case 'em': return `<em>${inner}</em>`;
                case 'strong': return `<strong>${inner}</strong>`;
                case 'br': return '<br>';
                case 'a': return `<a>${inner}</a>`;
                default: return inner;
            }
        }).join('');
    }

    // ========== СКАЧИВАНИЕ ГЛАВ ==========
    async function downloadChapter(num) {
        const n = String(num).padStart(3, '0');
        const url = `https://www.litres.ru/download_book_subscr/${artId}/${state.fileId}/json/${n}.js`;
        const r = await fetch(url, { credentials: 'include' });
        if (!r.ok) return null; // конец книги
        const text = await r.text();
        if (!text || text.length < 10) return null;
        try {
            const json = parseLitFile(text);
            return litJsonToHtml(json);
        } catch(e) {
            console.warn(`⚠️ Глава ${n} не распарсилась:`, e.message);
            return null;
        }
    }

    // ========== HTML СБОРКА ==========
    function buildHtml(chapters) {
        const safeTitle = esc(state.title);
        const safeAuthor = esc(state.author);
        return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>${safeTitle}</title>
<style>
    * { box-sizing: border-box; }
    body {
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 18px;
        line-height: 1.7;
        max-width: 720px;
        margin: 0 auto;
        padding: 60px 30px;
        background: #fafafa;
        color: #222;
    }
    h1.book-title {
        font-size: 32px;
        margin: 0 0 10px;
        color: #1a2a4a;
        border-bottom: 3px solid #1a5a9a;
        padding-bottom: 15px;
    }
    h2 {
        font-size: 24px;
        margin: 50px 0 20px;
        color: #1a2a4a;
        page-break-before: always;
    }
    h2:first-of-type { page-break-before: auto; }
    h3 {
        font-size: 20px;
        margin: 30px 0 15px;
        color: #2a4a6a;
    }
    p { margin: 14px 0; text-align: justify; }
    em { font-style: italic; }
    strong { font-weight: bold; }
    .meta {
        color: #6a8aaa;
        font-size: 14px;
        margin-bottom: 40px;
        padding-bottom: 20px;
        border-bottom: 1px solid #ddd;
    }
    .footer {
        margin-top: 80px;
        padding-top: 20px;
        border-top: 1px solid #ddd;
        font-size: 12px;
        color: #aab8c4;
        text-align: center;
    }
    @media (max-width: 600px) {
        body { padding: 30px 15px; font-size: 16px; }
        h1.book-title { font-size: 24px; }
        h2 { font-size: 20px; }
    }
    @media print {
        body { padding: 0; background: #fff; }
        h2 { page-break-before: always; }
    }
</style>
</head>
<body>
<h1 class="book-title">${safeTitle}</h1>
<div class="meta">✍️ ${safeAuthor}</div>
${chapters.map((html, i) => `<!-- Глава ${String(i).padStart(3,'0')} -->\n${html}`).join('\n')}
<div class="footer">
    📚 Скачано через LitRes Reader Mini<br>
    Всего глав: ${chapters.length} • © 2026 Diminssoft
</div>
</body>
</html>`;
    }

    // ========== UI ==========
    document.body.insertAdjacentHTML('beforeend', `
        <div id="lrm_ui" style="position:fixed;bottom:${px(16)};right:${px(16)};z-index:2147483647;
            background:#fff;color:#1a2a4a;border-radius:${px(14)};padding:${px(14)} ${px(16)};
            font-family:'Segoe UI',Arial,sans-serif;font-size:${px(12)};width:${px(360)};
            box-shadow:0 ${px(8)} ${px(32)} rgba(0,0,0,0.2);border:1px solid rgba(26,42,74,0.08);">
            <div style="display:flex;align-items:center;gap:${px(8)};margin-bottom:${px(10)};">
                <div style="font-size:${px(20)};">📖</div>
                <div style="flex:1;">
                    <div style="font-weight:800;font-size:${px(14)};">LitRes <span style="color:#1a5a9a;">Reader</span></div>
                    <div style="font-size:${px(9)};color:#8a9aaa;text-transform:uppercase;">v1.0 • JSON fallback</div>
                </div>
                <button id="lrm_close" type="button" style="background:rgba(26,42,74,0.05);border:none;color:#8a9aaa;cursor:pointer;font-size:${px(14)};padding:${px(3)} ${px(7)};border-radius:${px(6)};">✕</button>
            </div>

            <div style="background:#f0f7ff;border-radius:${px(8)};padding:${px(8)} ${px(10)};margin-bottom:${px(8)};border-left:${px(3)} solid #1a5a9a;font-size:${px(11)};line-height:1.4;">
                <div style="font-weight:700;" id="lrm_title">⏳ Загрузка...</div>
                <div style="color:#4a6a8a;" id="lrm_author">...</div>
                <div style="color:#4a6a8a;margin-top:${px(2)};" id="lrm_stats">—</div>
            </div>

            <div style="background:#f0f4fa;border-radius:${px(8)};padding:${px(8)} ${px(10)};margin-bottom:${px(8)};">
                <div style="width:100%;height:${px(6)};background:#e8eef4;border-radius:${px(3)};overflow:hidden;margin-bottom:${px(6)};">
                    <div id="lrm_bar" style="width:0%;height:100%;background:linear-gradient(90deg,#1a5a9a,#4a8af4);border-radius:${px(3)};transition:width 0.3s;"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:${px(10)};color:#6a8aaa;margin-bottom:${px(4)};">
                    <span id="lrm_progress">📖 0 глав</span>
                    <span id="lrm_percent" style="font-weight:700;color:#1a5a9a;">0%</span>
                </div>
                <div id="lrm_log" style="font-size:${px(10)};color:#6a8aaa;background:#e8eef4;padding:${px(3)} ${px(6)};border-radius:${px(4)};max-height:${px(60)};overflow-y:auto;font-family:'Courier New',monospace;line-height:1.3;">⏳ Загрузка инфо...</div>
            </div>

            <div style="display:flex;gap:${px(4)};">
                <button id="lrm_start" type="button" style="flex:1;padding:${px(10)} ${px(6)};background:#27ae60;color:#fff;border:none;border-radius:${px(6)};cursor:pointer;font-weight:700;font-size:${px(11)};">📥 Скачать книгу</button>
                <button id="lrm_pause" type="button" disabled style="flex:0 0 auto;padding:${px(10)} ${px(12)};background:#e8eef4;color:#8a9aaa;border:none;border-radius:${px(6)};cursor:pointer;font-weight:700;font-size:${px(11)};">⏸</button>
                <button id="lrm_stop" type="button" disabled style="flex:0 0 auto;padding:${px(10)} ${px(12)};background:#f0f2f4;color:#b0c0d0;border:none;border-radius:${px(6)};cursor:pointer;font-weight:700;font-size:${px(11)};">⏹</button>
            </div>

            <div id="lrm_status" style="font-size:${px(10)};color:#6a8aaa;text-align:center;padding:${px(4)} 0 ${px(2)};border-top:1px solid #e8eef4;margin-top:${px(6)};min-height:${px(16)};">⏳ Загрузка...</div>
        </div>
    `);

    const $ = id => document.getElementById(id);
    const ui = $('lrm_ui');
    const logEl = $('lrm_log');
    const barEl = $('lrm_bar');
    const progEl = $('lrm_progress');
    const pctEl = $('lrm_percent');
    const statEl = $('lrm_status');
    const btnStart = $('lrm_start');
    const btnPause = $('lrm_pause');
    const btnStop = $('lrm_stop');

    function log(t, err) {
        const time = new Date().toLocaleTimeString();
        logEl.textContent = `${err ? '❌' : 'ℹ️'} [${time}] ${t}`;
        logEl.style.color = err ? '#e74c3c' : '#6a8aaa';
        console.log('[LRM]', t);
    }
    function status(t, err) {
        statEl.textContent = t;
        statEl.style.color = err ? '#e74c3c' : '#6a8aaa';
    }
    function updProgress() {
        progEl.textContent = `📖 ${state.downloaded} глав`;
        const p = state.total > 0 ? Math.round(state.downloaded / state.total * 100) : 0;
        barEl.style.width = p + '%';
        pctEl.textContent = p + '%';
    }

    // ========== ОСНОВНОЙ ЦИКЛ ==========
    async function downloadAll() {
        if (state.isRunning) return;

        state.chapters = [];
        state.downloaded = 0;
        state.total = 999; // неизвестно заранее
        state.isRunning = true;
        state.isPaused = false;
        state.isStopped = false;

        btnStart.disabled = true;
        btnStart.style.opacity = '0.5';
        btnPause.disabled = false;
        btnStop.disabled = false;

        log('📖 Начинаем скачивание...');
        status('📖 Загрузка глав...');

        let num = 0;
        let emptyStreak = 0;

        while (!state.isStopped) {
            while (state.isPaused && !state.isStopped) {
                await new Promise(r => setTimeout(r, 500));
            }
            if (state.isStopped) break;

            const n = String(num).padStart(3, '0');
            log(`📥 Глава ${n}...`);

            const html = await downloadChapter(num);

            if (html === null) {
                emptyStreak++;
                log(`⚠️ Глава ${n} пустая (${emptyStreak}/3)`);
                if (emptyStreak >= 3) {
                    log(`🛑 Конец книги (3 пустые подряд)`);
                    break;
                }
            } else {
                emptyStreak = 0;
                state.chapters.push(html);
                state.downloaded++;
                updProgress();
                log(`✅ Глава ${n} — ${html.length} символов`);
            }

            num++;
            await new Promise(r => setTimeout(r, 100));

            // Предохранитель от бесконечного цикла
            if (num > 2000) {
                log('🛑 Достигнут лимит 2000 глав');
                break;
            }
        }

        state.total = state.downloaded;
        updProgress();

        if (state.isStopped) {
            status('⏹ Остановлено');
            state.isRunning = false;
            btnStart.disabled = false;
            btnStart.style.opacity = '1';
            btnPause.disabled = true;
            btnStop.disabled = true;
            return;
        }

        if (state.chapters.length === 0) {
            status('❌ Не удалось скачать ни одной главы', true);
            state.isRunning = false;
            btnStart.disabled = false;
            btnStart.style.opacity = '1';
            btnPause.disabled = true;
            btnStop.disabled = true;
            return;
        }

        // Сборка HTML и скачивание
        status('📦 Собираем HTML...');
        log(`📦 Сборка HTML из ${state.chapters.length} глав`);

        const html = buildHtml(state.chapters);
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const safeName = state.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100);
        const fileName = `${safeName}.html`;

        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 2000);

        const sizeMb = (blob.size / 1024 / 1024).toFixed(2);
        status(`🎉 Готово: ${state.chapters.length} глав, ${sizeMb} MB`);
        log(`✅ ${fileName} (${sizeMb} MB)`);

        state.isRunning = false;
        btnStart.disabled = false;
        btnStart.style.opacity = '1';
        btnStart.textContent = '📥 Скачать заново';
        btnPause.disabled = true;
        btnStop.disabled = true;
    }

    // ========== ОБРАБОТЧИКИ ==========
    btnStart.addEventListener('click', downloadAll);
    btnPause.addEventListener('click', () => {
        if (!state.isRunning) return;
        state.isPaused = !state.isPaused;
        btnPause.textContent = state.isPaused ? '▶' : '⏸';
        status(state.isPaused ? '⏸ Пауза' : '▶ Продолжаем');
    });
    btnStop.addEventListener('click', () => {
        if (!state.isRunning) return;
        state.isStopped = true;
        status('⏹ Остановлено');
    });
    $('lrm_close').addEventListener('click', () => {
        if (state.isRunning && !confirm('Скачивание идёт. Закрыть?')) return;
        state.isStopped = true;
        ui.remove();
    });

    // ========== INIT ==========
    (async () => {
        try {
            status('⏳ Загрузка инфо...');
            await fetchBookInfo();
            $('lrm_title').textContent = state.title;
            $('lrm_author').textContent = state.author;
            $('lrm_stats').textContent = `🆔 artId: ${artId} • fileId: ${state.fileId}`;
            log(`✅ "${state.title}" — ${state.author}`);
            log(`🔑 fileId: ${state.fileId}`);
            status('✅ Готово — жми "Скачать книгу"');
        } catch(e) {
            status(`❌ ${e.message}`, true);
            log(`❌ Ошибка: ${e.message}`, true);
            btnStart.disabled = true;
            btnStart.style.opacity = '0.4';
        }
    })();

    window.litReaderMini = { state, downloadAll };
    console.log('📖 LitRes Reader Mini готов!');
})();
