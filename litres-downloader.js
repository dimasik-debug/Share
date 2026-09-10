/**
 * LitRes Downloader v23.0
 * 🔥 РАБОТАЕТ ВЕЗДЕ — активация DRM на странице книги!
 * 👤 Инфо о пользователе + подписка
 * 🛡️ Защита от покупок
 * 📦 Автоупаковка x64.rar
 * (c) 2026 Diminssoft
 */

(function fullDownloaderV23() {
    console.log('🚀 LitRes Downloader v23.0 — DRM-активация + подписка!');

    // ============================================================
    // 🛡️ ЗАЩИТА ОТ ПОКУПОК
    // ============================================================
    const FORBIDDEN_TEXTS = [
        'купить и скачать', 'купить и читать', 'купить за', 'купить сразу',
        'оформить покупку', 'оплатить', 'добавить в корзину', 'перейти в корзину',
        'купить в подарок', 'купить сейчас', 'приобрести', 'подтвердить покупку',
        'оплатить картой'
    ];
    const PRICE_PATTERN = /(\d[\d\s]*\s*(₽|руб|rub|р\.))/i;

    function isForbiddenClick(el) {
        if (!el || !el.textContent) return false;
        if (el.closest && el.closest('#litres_downloader_ui')) return false;

        const text = (el.textContent || '').trim().toLowerCase();
        for (const bad of FORBIDDEN_TEXTS) {
            if (text === bad || text.startsWith(bad + ' ') || text.startsWith(bad + '\n')) return true;
        }

        try {
            let parent = el.closest('div, section, article, aside, form, li, main');
            let maxUp = 4;
            while (parent && maxUp > 0) {
                if (parent.id === 'litres_downloader_ui') break;
                const pt = (parent.textContent || '').toLowerCase();
                if (PRICE_PATTERN.test(pt) && (pt.includes('купить') || pt.includes('корзин') || pt.includes('оплат'))) {
                    if (el.tagName === 'BUTTON' || el.role === 'button') return true;
                }
                parent = parent.parentElement;
                maxUp--;
            }
        } catch(e) {}

        const testid = (el.getAttribute && el.getAttribute('data-testid')) || '';
        if (testid && (
            testid.toLowerCase().includes('sale') ||
            testid.toLowerCase().includes('buy') ||
            testid.toLowerCase().includes('cart') ||
            testid.toLowerCase().includes('purchase') ||
            testid.toLowerCase().includes('payment')
        )) return true;

        return false;
    }

    const _origClick = HTMLElement.prototype.click;
    HTMLElement.prototype.click = function() {
        if (isForbiddenClick(this)) {
            console.warn('🛑 ЗАБЛОКИРОВАН клик (покупка):', this.textContent?.trim().slice(0, 50));
            return;
        }
        return _origClick.apply(this, arguments);
    };

    const _origAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
        if (type === 'click' && this instanceof HTMLElement && isForbiddenClick(this)) {
            console.warn('🛑 ЗАБЛОКИРОВАН addEventListener');
            return;
        }
        return _origAddEventListener.apply(this, arguments);
    };

    document.addEventListener('click', (e) => {
        const target = e.target.closest('button, [role="button"], a');
        if (!target) return;
        if (isForbiddenClick(target)) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.warn('🛑 Заблокировано на уровне события');
            return false;
        }
    }, true);

    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.nodeType === 1) {
                    const buttons = node.matches?.('button, [role="button"], a')
                        ? [node]
                        : Array.from(node.querySelectorAll?.('button, [role="button"], a') || []);
                    for (const btn of buttons) {
                        if (isForbiddenClick(btn)) {
                            btn.style.pointerEvents = 'none';
                            btn.style.opacity = '0.5';
                            btn.title = '🛑 Заблокировано: кнопка покупки';
                        }
                    }
                }
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    console.log('🛡️ Защита от покупок активна!');

    // ============================================================
    // 1. НАСТРОЙКИ
    // ============================================================
    const TOOLS_URL = 'https://github.com/dimasik-debug/Share/raw/main/x64.rar';
    const TOOLS_PATH = 'tools/x64.rar';

    const GITHUB_CONFIG = {
        repo: 'dimasik-debug/Share',
        path: 'books/progress/',
        token: localStorage.getItem('github_token') || ''
    };

    // ============================================================
    // 2. GITHUB
    // ============================================================
    function askForGitHubToken() {
        const token = prompt(
            '🔑 Введите GitHub Personal Access Token:\n\n' +
            'Как получить:\n' +
            '1. GitHub → Settings → Developer settings\n' +
            '2. Personal access tokens → Tokens (classic)\n' +
            '3. Generate new token → repo (полный доступ)\n' +
            '4. Скопируйте токен',
            localStorage.getItem('github_token') || ''
        );
        if (token && token.trim()) {
            GITHUB_CONFIG.token = token.trim();
            localStorage.setItem('github_token', token.trim());
            return true;
        }
        return false;
    }

    async function saveProgressToGitHub(bookId, data) {
        if (!GITHUB_CONFIG.token) return false;
        const path = `${GITHUB_CONFIG.path}${bookId}.json`;
        const jsonString = JSON.stringify(data, null, 2);
        const encoder = new TextEncoder();
        const encoded = encoder.encode(jsonString);
        let binary = '';
        const bytes = new Uint8Array(encoded);
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const content = btoa(binary);
        try {
            let sha = '';
            try {
                const resp = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.repo}/contents/${path}`, {
                    headers: { 'Authorization': `token ${GITHUB_CONFIG.token}` }
                });
                if (resp.ok) {
                    const file = await resp.json();
                    sha = file.sha;
                }
            } catch(e) {}

            const response = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.repo}/contents/${path}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${GITHUB_CONFIG.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `📚 Прогресс: ${data.book_title} (${data.downloaded_pages}/${data.total_pages})`,
                    content: content,
                    sha: sha || undefined
                })
            });
            return response.ok;
        } catch(e) {
            console.error('❌ Ошибка сохранения:', e);
            return false;
        }
    }

    async function loadProgressFromGitHub(bookId) {
        if (!GITHUB_CONFIG.token) return null;
        const path = `${GITHUB_CONFIG.path}${bookId}.json`;
        try {
            const resp = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.repo}/contents/${path}`, {
                headers: { 'Authorization': `token ${GITHUB_CONFIG.token}` }
            });
            if (resp.ok) {
                const file = await resp.json();
                const binary = atob(file.content);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                const decoder = new TextDecoder('utf-8');
                return JSON.parse(decoder.decode(bytes));
            }
        } catch(e) {
            console.warn('⚠️ Прогресс не найден:', e);
        }
        return null;
    }

    // ============================================================
    // 3. JSZip
    // ============================================================
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    document.head.appendChild(script);

    let JSZipLoaded = false;
    script.onload = () => { JSZipLoaded = true; console.log('✅ JSZip загружен!'); };
    script.onerror = () => { alert('❌ Не удалось загрузить JSZip.'); };

    // ============================================================
    // 4. ТИП СТРАНИЦЫ
    // ============================================================
    const urlParams = new URLSearchParams(window.location.search);
    let fileId = urlParams.get('file');
    let artId = urlParams.get('art');
    let pageType = 'unknown';

    if (fileId && artId) {
        pageType = 'reader';
        console.log(`📖 Тип: СТРАНИЦА ЧТЕНИЯ`);
    } else {
        const match = window.location.pathname.match(/-(\d+)\/?$/);
        if (match) {
            artId = match[1];
            fileId = null;
            pageType = 'book';
            console.log(`📖 Тип: СТРАНИЦА КНИГИ`);
        }
    }

    if (!artId) {
        alert('❌ Не удалось определить ID книги!');
        return;
    }
    console.log(`🆔 artId: ${artId}, fileId: ${fileId || '(из API)'}`);

    // ============================================================
    // 5. СЕССИЯ
    // ============================================================
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    function updateSession() {
        const newSid = getCookie('SID');
        const newSupersid = getCookie('supersid');
        if (newSid) sessionData.sessionId = newSid;
        if (newSupersid) sessionData.supersid = newSupersid;
        return sessionData.sessionId;
    }

    let sessionData = {
        sessionId: getCookie('SID') || '',
        supersid: getCookie('supersid') || ''
    };

    function getHeaders() {
        return {
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'ru,en;q=0.9',
            'accept-version': '2',
            'app-id': '115',
            'client-host': 'www.litres.ru',
            'session-id': sessionData.sessionId,
            'supersid': sessionData.supersid,
            'ui-currency': 'RUB',
            'ui-language-code': 'ru',
            'x-request-id': Date.now().toString(36) + Math.random().toString(36).substring(2)
        };
    }

    // ============================================================
    // 6. API-ОПРЕДЕЛЕНИЕ КНИГИ
    // ============================================================
    let bookInfo = {
        title: 'Неизвестная книга',
        author: 'Неизвестный автор',
        pages: 0,
        symbols: 0,
        fileId: fileId,
        artId: artId,
        source: 'не определено'
    };

    async function fetchBookInfo() {
        try {
            console.log('🔍 Запрашиваем информацию о книге...');
            const resp = await fetch(
                `https://api.litres.ru/foundation/api/arts/${artId}`,
                { method: 'GET', credentials: 'include', headers: getHeaders() }
            );
            if (!resp.ok) return false;
            const data = await resp.json();
            const payload = data?.payload?.data;
            if (!payload) return false;

            let pages = 0;
            const symbols = payload.symbols_count || 0;
            if (payload.files && payload.files.length > 0) {
                const mainFile = payload.files.find(f => !f.is_additional);
                if (mainFile && mainFile.pages) pages = mainFile.pages;
            }
            if (!pages && payload.additional_info?.current_pages_or_seconds) {
                pages = payload.additional_info.current_pages_or_seconds;
            }
            if (!pages && symbols > 0) pages = Math.round(symbols / 2800);
            if (!pages && payload.release_file_id) {
                try {
                    const fileResp = await fetch(
                        `https://api.litres.ru/foundation/api/arts/files/${payload.release_file_id}/info`,
                        { method: 'GET', credentials: 'include', headers: getHeaders() }
                    );
                    if (fileResp.ok) {
                        const fileData = await fileResp.json();
                        if (fileData?.payload?.data?.pages) pages = fileData.payload.data.pages;
                    }
                } catch(e) {}
            }
            if (!pages) pages = symbols > 0 ? Math.round(symbols / 2800) : 0;

            let author = 'Неизвестный автор';
            if (payload.persons && payload.persons.length > 0) {
                const ap = payload.persons.find(p => p.role === 'author');
                author = ap?.full_name || payload.persons[0].full_name || author;
            }

            bookInfo.title = payload.title || 'Неизвестная книга';
            bookInfo.author = author;
            bookInfo.pages = pages;
            bookInfo.symbols = symbols;
            bookInfo.fileId = payload.release_file_id || fileId;
            bookInfo.artId = payload.id || artId;
            bookInfo.source = 'API LitRes';

            console.log(`✅ Книга: "${bookInfo.title}" (${bookInfo.pages} стр.)`);
            console.log(`🆔 fileId: ${bookInfo.fileId}`);
            return true;
        } catch(e) {
            console.error('❌ Ошибка:', e);
            return false;
        }
    }

    // ============================================================
    // 7. 👤 ИНФО О ПОЛЬЗОВАТЕЛЕ И ПОДПИСКЕ
    // ============================================================
    async function fetchUserInfo() {
        try {
            const resp = await fetch(
                `https://api.litres.ru/foundation/api/users/me/detailed`,
                { method: 'GET', credentials: 'include', headers: getHeaders() }
            );
            if (!resp.ok) return null;
            const data = await resp.json();
            const p = data?.payload?.data;
            if (!p) return null;

            const sub = p.subscription || {};
            const acc = p.account || {};

            return {
                id: p.id,
                login: p.login,
                subscription: sub.is_active ? {
                    isTrial: sub.is_trial_period,
                    validTill: sub.valid_till,
                    price: sub.price,
                    planName: sub.plan_name || null,
                    autoRenew: sub.prolongation_status === 'enabled'
                } : null,
                account: {
                    display: acc.display || 0,
                    bonus: acc.bonus || 0
                },
                basket: p.basket || { items_count: 0 }
            };
        } catch(e) {
            console.warn('⚠️ Инфо о пользователе:', e);
            return null;
        }
    }

    // ============================================================
    // 8. 🔥 АКТИВАЦИЯ PDF.js (открывает DRM!)
    // ============================================================
    async function activatePdfjs() {
        if (!state.fileId) return false;
        
        try {
            console.log('🔓 Активация PDF.js (index=1)...');
            
            // 1. Запрос index=1 — активирует DRM
            const resp = await fetch(
                `https://api.litres.ru/foundation/api/arts/files/${state.fileId}/link?index=1&is_trial=false`,
                { method: 'GET', credentials: 'include', headers: getHeaders() }
            );
            
            if (!resp.ok) {
                console.warn(`⚠️ Активация: ${resp.status}`);
                return false;
            }
            
            const data = await resp.json();
            const jsUrl = data?.payload?.data?.link || data?.payload?.link;
            if (!jsUrl) return false;
            
            console.log('📥 Скачиваем метаданные PDF.js...');
            
            // 2. Скачиваем .js
            const jsResp = await fetch(jsUrl, { credentials: 'omit' });
            if (!jsResp.ok) return false;
            
            const jsText = await jsResp.text();
            
            // 3. 🔥 ИСПРАВЛЕННЫЙ парсинг: находим от первой { до последней }
            const firstBrace = jsText.indexOf('{');
            const lastBrace = jsText.lastIndexOf('}');
            
            if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
                console.warn('⚠️ Не найдены { } в метаданных');
                return false;
            }
            
            const jsonStr = jsText.substring(firstBrace, lastBrace + 1);
            
            let pdfData;
            try {
                pdfData = JSON.parse(jsonStr);
            } catch(e) {
                console.warn('⚠️ Ошибка JSON:', e.message);
                console.warn('📄 Первые 200 символов:', jsonStr.substring(0, 200));
                return false;
            }
            
            const pagesArr = pdfData.pages?.[0]?.p || [];
            
            state.pdfMetadata = {
                title: pdfData.Meta?.Title,
                authors: pdfData.Meta?.Authors || [],
                uuid: pdfData.Meta?.UUID,
                totalPages: pagesArr.length,
                width: pdfData.pages?.[0]?.w,
                height: pdfData.pages?.[0]?.h,
                pageFormats: pagesArr.map(p => p.ext || 'jpg')
            };
            
            state.totalPages = state.pdfMetadata.totalPages;
            state.pageFormats = state.pdfMetadata.pageFormats;
            state.drmActivated = true;
            
            console.log(`✅ DRM активирован! Страниц: ${state.pdfMetadata.totalPages}`);
            console.log(`🖼️ Формат 1-й: ${state.pageFormats[0]}`);
            return true;
            
        } catch(e) {
            console.error('❌ Ошибка активации:', e);
            return false;
        }
    }
    

    // ============================================================
    // 9. ПОИСК ZIP-ССЫЛКИ
    // ============================================================
    async function findZipLink() {
        const fid = state.fileId || bookInfo.fileId;
        if (!fid) return null;
        const endpoints = [
            `https://api.litres.ru/foundation/api/arts/files/${fid}/link?is_trial=false`,
            `https://api.litres.ru/foundation/api/arts/files/${fid}/link?resource=bin&is_trial=false`
        ];
        for (const url of endpoints) {
            try {
                const resp = await fetch(url, { method: 'GET', credentials: 'include', headers: getHeaders() });
                if (!resp.ok) continue;
                const data = await resp.json();
                const link = data?.payload?.data?.link || data?.payload?.link || data?.data?.link || data?.link;
                if (link && (link.includes('.bin') || link.includes('application/zip'))) return link;
            } catch(e) {}
        }
        return null;
    }

    // ============================================================
    // 10. ИНСТРУМЕНТЫ
    // ============================================================
    let toolsBlob = null;
    async function downloadTools() {
        if (toolsBlob) return toolsBlob;
        try {
            const resp = await fetch(TOOLS_URL, { credentials: 'omit' });
            if (!resp.ok) return null;
            toolsBlob = await resp.blob();
            return toolsBlob;
        } catch(e) { return null; }
    }

    // ============================================================
    // 11. UI
    // ============================================================
      const uiHTML = `
        <div id="litres_downloader_ui" style="
            position: fixed;
            bottom: 16px;
            right: 16px;
            z-index: 99999;
            background: #ffffff;
            color: #1a2a4a;
            border-radius: 14px;
            padding: 14px 16px;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 12px;
            width: 340px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.15);
            border: 1px solid rgba(26, 42, 74, 0.08);
            user-select: none;
        ">
            <!-- ЗАГОЛОВОК -->
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                <div style="font-size: 20px;">📚</div>
                <div style="flex: 1;">
                    <div style="font-weight: 800; font-size: 14px; line-height: 1.1;">
                        LitRes <span style="color: #1a5a9a;">Downloader</span>
                    </div>
                    <div style="font-size: 9px; color: #8a9aaa; text-transform: uppercase; letter-spacing: 0.3px;">
                        v23.0 • DRM
                    </div>
                </div>
                <button id="close_ui" style="
                    background: rgba(26,42,74,0.05);
                    border: none;
                    color: #8a9aaa;
                    cursor: pointer;
                    font-size: 14px;
                    padding: 3px 7px;
                    border-radius: 6px;
                ">✕</button>
            </div>

            <!-- КНИГА + ЮЗЕР (объединено, компактно) -->
            <div style="
                background: #f0f7ff;
                border-radius: 8px;
                padding: 8px 10px;
                margin-bottom: 8px;
                border-left: 3px solid #1a5a9a;
                font-size: 11px;
                line-height: 1.4;
            ">
                <div style="font-weight: 700; color: #1a2a4a; margin-bottom: 2px;" id="preview_book_title">
                    ${bookInfo.title}
                </div>
                <div style="color: #4a6a8a;">
                    ✍️ <span id="preview_book_author">${bookInfo.author}</span>
                    • 📄 <span id="preview_total_pages">${bookInfo.pages || '—'}</span> стр.
                    • 🖼️ <span id="preview_formats">—</span>
                </div>
                <div style="color: #6a8aaa; font-size: 10px; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #d4e2f0;">
                    <span id="user_info_text">👤 Загрузка...</span>
                </div>
            </div>

            <!-- БАЛАНС (только если есть) -->
            <div id="account_block" style="
                background: #fff8e8;
                border-radius: 6px;
                padding: 5px 8px;
                margin-bottom: 8px;
                border: 1px solid #f0e0b8;
                font-size: 10px;
                color: #6a5a2a;
                display: none;
            "></div>

            <!-- ZIP ССЫЛКА -->
            <div id="direct_links_container" style="
                background: #f8fafc;
                border-radius: 6px;
                padding: 6px 8px;
                margin-bottom: 8px;
                border: 1px solid #e8eef4;
                display: none;
                font-size: 10px;
            ">
                <div id="direct_links_list"></div>
            </div>

            <!-- СТАТУС + ПРОГРЕСС -->
            <div style="
                background: #f0f4fa;
                border-radius: 8px;
                padding: 8px 10px;
                margin-bottom: 8px;
            ">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                    <div id="hand_animation" style="
                        font-size: 20px;
                        width: 28px;
                        text-align: center;
                        transition: transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
                    ">🖐️</div>
                    <div style="flex: 1; min-width: 0;">
                        <div id="reading_status" style="
                            font-weight: 600;
                            font-size: 11px;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                        ">📖 Готов</div>
                        <div id="reading_progress_text" style="
                            font-size: 10px;
                            color: #6a8aaa;
                        ">Прогресс: 0%</div>
                    </div>
                    <div id="page_counter" style="
                        font-size: 14px;
                        font-weight: 700;
                        color: #1a5a9a;
                    ">0/0</div>
                </div>

                <div style="
                    width: 100%;
                    height: 6px;
                    background: #e8eef4;
                    border-radius: 3px;
                    overflow: hidden;
                    margin-bottom: 6px;
                ">
                    <div id="progress_bar" style="
                        width: 0%;
                        height: 100%;
                        background: linear-gradient(90deg, #1a5a9a, #4a8af4);
                        border-radius: 3px;
                        transition: width 0.4s ease;
                    "></div>
                </div>

                <div style="display: flex; justify-content: space-between; font-size: 10px; color: #6a8aaa; margin-bottom: 4px;">
                    <span id="progress_text">📥 0 из 0</span>
                    <span id="percent_text" style="font-weight: 700; color: #1a5a9a;">0%</span>
                </div>

                <div id="log_status" style="
                    font-size: 10px;
                    color: #6a8aaa;
                    background: #e8eef4;
                    padding: 3px 6px;
                    border-radius: 4px;
                    max-height: 42px;
                    overflow-y: auto;
                    font-family: 'Courier New', monospace;
                    line-height: 1.3;
                ">⏳ Загрузка...</div>
            </div>

            <!-- КНОПКИ -->
            <div style="display: flex; gap: 4px; margin-bottom: 6px;">
                <button id="btn_github" style="
                    padding: 6px 8px;
                    background: #24292e;
                    color: #fff;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 700;
                    font-size: 11px;
                ">🔑</button>

                <button id="btn_start" style="
                    flex: 1;
                    padding: 6px 8px;
                    background: #1a3a6a;
                    color: #fff;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 700;
                    font-size: 11px;
                ">▶ Старт</button>

                <button id="btn_pause" style="
                    flex: 1;
                    padding: 6px 8px;
                    background: #e8eef4;
                    color: #6a8aaa;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 700;
                    font-size: 11px;
                ">⏸</button>

                <button id="btn_stop" style="
                    flex: 1;
                    padding: 6px 8px;
                    background: #f0f2f4;
                    color: #8a9aaa;
                    border: 1px solid #dce2e8;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 700;
                    font-size: 11px;
                ">⏹</button>
            </div>

            <!-- FORCE -->
            <div style="
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 5px 8px;
                background: #f8faff;
                border-radius: 6px;
                border: 1px solid #e8eef4;
                margin-bottom: 6px;
                font-size: 11px;
            ">
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: 600;">
                    <input type="checkbox" id="force_mode" style="
                        width: 14px;
                        height: 14px;
                        accent-color: #e74c3c;
                        cursor: pointer;
                    ">
                    ⚡ FORCE
                </label>
                <div id="force_status" style="
                    margin-left: auto;
                    font-size: 10px;
                    color: #8a9aaa;
                    background: #e8eef4;
                    padding: 1px 6px;
                    border-radius: 8px;
                ">⏸ выкл</div>
            </div>

            <!-- ФИНАЛЬНЫЙ СТАТУС -->
            <div id="status_text" style="
                font-size: 10px;
                color: #6a8aaa;
                text-align: center;
                padding: 4px 0 2px;
                border-top: 1px solid #e8eef4;
                min-height: 16px;
            ">⏳ Загрузка...</div>

            <div id="zip_info" style="
                font-size: 10px;
                color: #8aaaac;
                text-align: center;
                margin-top: 2px;
                display: none;
            ">📦 Архивация...</div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', uiHTML);

    // ============================================================
    // 12. ЭЛЕМЕНТЫ
    // ============================================================
    const ui = document.getElementById('litres_downloader_ui');
    const closeBtn = document.getElementById('close_ui');
    const btnGitHub = document.getElementById('btn_github');
    const btnStart = document.getElementById('btn_start');
    const btnPause = document.getElementById('btn_pause');
    const btnStop = document.getElementById('btn_stop');
    const progressBar = document.getElementById('progress_bar');
    const progressText = document.getElementById('progress_text');
    const percentText = document.getElementById('percent_text');
    const statusText = document.getElementById('status_text');
    const zipInfo = document.getElementById('zip_info');
    const handAnimation = document.getElementById('hand_animation');
    const readingStatus = document.getElementById('reading_status');
    const readingProgressText = document.getElementById('reading_progress_text');
    const pageCounter = document.getElementById('page_counter');
    const logStatus = document.getElementById('log_status');
    const previewTotalPages = document.getElementById('preview_total_pages');
    const previewBookTitle = document.getElementById('preview_book_title');
    const previewBookAuthor = document.getElementById('preview_book_author');
    const previewFormats = document.getElementById('preview_formats');
    const bookSource = document.getElementById('book_source');
    const directLinksContainer = document.getElementById('direct_links_container');
    const directLinksList = document.getElementById('direct_links_list');
    const forceMode = document.getElementById('force_mode');
    const forceStatus = document.getElementById('force_status');
    const userInfoText = document.getElementById('user_info_text');
    const accountBlock = document.getElementById('account_block');

    // ============================================================
    // 13. СОСТОЯНИЕ
    // ============================================================
    let state = {
        isRunning: false,
        isPaused: false,
        isStopped: false,
        downloaded: 0,
        total: 0,
        startPage: 1,
        endPage: 10,
        bookTitle: bookInfo.title,
        bookAuthor: bookInfo.author,
        totalPages: bookInfo.pages || 0,
        errors: 0,
        maxErrors: 20,
        zip: null,
        failedPages: [],
        consecutiveErrors: 0,
        fileId: fileId,
        artId: artId,
        lastSaveTime: 0,
        forceMode: false,
        bookInfoLoaded: false,
        directLink: null,
        pdfMetadata: null,
        pageFormats: null,
        drmActivated: false
    };

    // ============================================================
    // 14. ОБНОВЛЕНИЕ ЗАГОЛОВКА
    // ============================================================
    function updateTabTitle() {
        try {
            const percent = state.total > 0 ? Math.round((state.downloaded / state.total) * 100) : 0;
            const short = state.bookTitle.length > 25 ? state.bookTitle.substring(0, 25) + '...' : state.bookTitle;
            if (state.isRunning && state.downloaded > 0) document.title = `[${percent}%] ${short}`;
            else if (state.isRunning) document.title = `⏳ ${short}`;
            else if (state.downloaded === state.total && state.total > 0) document.title = `✅ ${short}`;
            else document.title = short;
        } catch(e) {}
    }

    // ============================================================
    // 15. UI-ФУНКЦИИ
    // ============================================================
    function addLog(text, isError = false) {
        const time = new Date().toLocaleTimeString();
        logStatus.textContent = `${isError ? '❌' : 'ℹ️'} [${time}] ${text}`;
        console.log(`[LOG] ${text}`);
        logStatus.style.color = isError ? '#e74c3c' : '#6a8aaa';
    }

    function setStatus(text, isError = false) {
        statusText.textContent = text;
        statusText.style.color = isError ? '#e74c3c' : '#6a8aaa';
        addLog(text, isError);
    }

    function setReadingStatus(text) { readingStatus.textContent = text; }

    function animateHand(action) {
        if (action === 'turn') {
            handAnimation.style.transform = 'translateX(30px) rotate(20deg)';
            setTimeout(() => handAnimation.style.transform = 'translateX(-10px) rotate(-10deg)', 400);
            setTimeout(() => handAnimation.style.transform = 'translateX(0) rotate(0deg)', 800);
        } else if (action === 'hover') {
            handAnimation.style.transform = 'translateX(10px) scale(1.1)';
            setTimeout(() => handAnimation.style.transform = 'translateX(0) scale(1)', 600);
        } else if (action === 'wait') {
            handAnimation.style.transform = 'rotate(-5deg)';
            setTimeout(() => handAnimation.style.transform = 'rotate(5deg)', 500);
            setTimeout(() => handAnimation.style.transform = 'rotate(0deg)', 1000);
        }
    }

    function getReadingDelay() {
        if (state.forceMode) return Math.random() * 300 + 200;
        const base = Math.random() * 5000 + 3000;
        if (Math.random() < 0.15) return base + Math.random() * 10000 + 5000;
        if (Math.random() < 0.1) return Math.random() * 1000 + 500;
        return base;
    }

    function getRandomPause() {
        if (state.forceMode) return Math.random() * 200 + 100;
        if (Math.random() < 0.2) return Math.random() * 10000 + 5000;
        if (Math.random() < 0.1) return Math.random() * 30000 + 15000;
        return Math.random() * 3000 + 1000;
    }

    function updateProgress() {
        const percent = state.total > 0 ? Math.round((state.downloaded / state.total) * 100) : 0;
        progressBar.style.width = `${Math.min(percent, 100)}%`;
        progressText.textContent = `📥 Страниц: ${state.downloaded} из ${state.total}`;
        percentText.textContent = `${percent}%`;
        pageCounter.textContent = `${state.downloaded}/${state.total}`;
        readingProgressText.textContent = `Прогресс: ${percent}%`;
        updateTabTitle();
    }

    function updateButtons() {
        if (state.isRunning && !state.isPaused) {
            btnStart.disabled = true;
            btnStart.textContent = '▶ Читаем...';
            btnStart.style.background = '#b0c4d8';
            btnStart.style.color = '#8a9aaa';
            btnPause.disabled = false;
            btnPause.textContent = '⏸ Пауза';
            btnPause.style.background = '#f0a500';
            btnPause.style.color = '#ffffff';
            btnStop.disabled = false;
            btnStop.textContent = '⏹ Стоп';
            btnStop.style.background = '#fce4e4';
            btnStop.style.color = '#e74c3c';
        } else if (state.isRunning && state.isPaused) {
            btnStart.disabled = false;
            btnStart.textContent = '▶ Продолжить';
            btnStart.style.background = '#1a3a6a';
            btnStart.style.color = '#ffffff';
            btnPause.disabled = true;
            btnPause.textContent = '⏸ На паузе';
            btnPause.style.background = '#e8eef4';
            btnPause.style.color = '#8a9aaa';
            btnStop.disabled = false;
            btnStop.textContent = '⏹ Стоп';
            btnStop.style.background = '#fce4e4';
            btnStop.style.color = '#e74c3c';
        } else {
            btnStart.disabled = false;
            btnStart.textContent = '▶ Старт';
            btnStart.style.background = '#1a3a6a';
            btnStart.style.color = '#ffffff';
            btnPause.disabled = true;
            btnPause.textContent = '⏸ Пауза';
            btnPause.style.background = '#e8eef4';
            btnPause.style.color = '#8a9aaa';
            btnStop.disabled = true;
            btnStop.textContent = '⏹ Стоп';
            btnStop.style.background = '#f0f2f4';
            btnStop.style.color = '#b0c0d0';
        }
    }

    // ============================================================
    // 16. GITHUB-ПРОГРЕСС
    // ============================================================
    async function saveProgress() {
        if (!state.zip || state.downloaded === 0) return;
        if (!GITHUB_CONFIG.token) { return; }
        const now = Date.now();
        if (now - state.lastSaveTime < 30000) return;
        state.lastSaveTime = now;

        const progressData = {
            book_id: state.artId,
            book_title: state.bookTitle,
            book_author: state.bookAuthor,
            file_id: state.fileId,
            total_pages: state.total,
            downloaded_pages: state.downloaded,
            start_page: state.startPage,
            end_page: state.endPage,
            last_page: state.startPage + state.downloaded - 1,
            failed_pages: state.failedPages,
            status: state.isRunning ? 'in_progress' : (state.isPaused ? 'paused' : 'stopped'),
            last_update: new Date().toISOString()
        };

        const success = await saveProgressToGitHub(state.artId, progressData);
        if (success) addLog(`💾 Прогресс сохранён (${state.downloaded}/${state.total})`);
    }

    async function checkForSavedProgress() {
        if (!GITHUB_CONFIG.token) {
            const hasToken = askForGitHubToken();
            if (!hasToken) return false;
        }
        const progress = await loadProgressFromGitHub(state.artId);
        if (progress && progress.downloaded_pages > 0 && progress.downloaded_pages < progress.total_pages) {
            const resume = confirm(
                `📖 Найдено сохранение для "${progress.book_title}"\n\n` +
                `📄 Страниц: ${progress.downloaded_pages} из ${progress.total_pages}\n` +
                `📅 ${new Date(progress.last_update).toLocaleString()}\n\n` +
                `Продолжить?`
            );
            if (resume) {
                state.downloaded = progress.downloaded_pages;
                state.startPage = progress.start_page;
                state.endPage = progress.end_page;
                state.total = progress.total_pages;
                state.failedPages = progress.failed_pages || [];
                state.zip = new JSZip();
                updateProgress();
                setStatus(`📖 Продолжаем с ${state.downloaded + 1} страницы...`);
                state.isRunning = true;
                state.isPaused = false;
                state.isStopped = false;
                updateButtons();
                setTimeout(downloadLoop, 1000);
                return true;
            }
        }
        return false;
    }

    // ============================================================
    // 17. ПОКАЗ ПРЯМОЙ ССЫЛКИ
    // ============================================================
    function showDirectLink(url) {
        directLinksContainer.style.display = 'block';
        const exp = (() => { try { const m = url.match(/expires=(\d+)/); return m ? new Date(parseInt(m[1]) * 1000) : null; } catch(e) { return null; } })();
        directLinksList.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; background: #ffffff; border-radius: 6px; padding: 6px 10px; border: 1px solid #e8eef4;">
                <span style="font-size: 12px; font-weight: 600; min-width: 60px; color: #1a5a9a;">📦 ZIP</span>
                <a href="${url}" target="_blank" style="flex: 1; font-size: 11px; color: #1a5a9a; text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 4px 8px; background: #f0f7ff; border-radius: 4px;">${url.substring(0, 60)}...</a>
                <button onclick="navigator.clipboard.writeText('${url}')" style="background: #e8eef4; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 12px;">📋</button>
            </div>
            ${exp ? `<div style="font-size: 10px; color: ${(exp.getTime() - Date.now() < 600000) ? '#e74c3c' : '#6a8aaa'}; margin-top: 6px; text-align: center;">⏰ Действует до: ${exp.toLocaleTimeString('ru-RU')}</div>` : ''}
        `;
        addLog(`✅ Найдена прямая ZIP-ссылка`);
    }

    // ============================================================
    // 18. ПОЛУЧЕНИЕ URL КАРТИНКИ
    // ============================================================
    async function getImageUrl(pageNum) {
        if (!state.fileId) return null;
        const apiPage = pageNum - 1;
        const formats = (state.pageFormats && state.pageFormats[apiPage])
            ? [state.pageFormats[apiPage]]
            : ['gif', 'jpg'];

        for (const ext of formats) {
            try {
                const resp = await fetch(
                    `https://api.litres.ru/foundation/api/arts/files/${state.fileId}/link?page_id=${apiPage}&is_trial=false&resolution=w1900&image_type=${ext}`,
                    { method: 'GET', credentials: 'include', headers: getHeaders() }
                );
                if (!resp.ok) continue;
                const data = await resp.json();
                const url = data?.payload?.data?.link || data?.payload?.link || data?.data?.link || data?.link;
                if (!url) continue;
                // Если знаем формат — возвращаем сразу
                if (state.pageFormats && state.pageFormats[apiPage]) return { url, ext };
                // Проверяем
                try {
                    const check = await fetch(url, { method: 'HEAD', credentials: 'omit' });
                    if (check.ok) return { url, ext };
                } catch(e) {}
            } catch(e) {}
        }
        return null;
    }

    // ============================================================
    // 19. СКАЧИВАНИЕ СТРАНИЦЫ
    // ============================================================
    async function downloadPageToZip(pageNum) {
        const result = await getImageUrl(pageNum);
        if (!result) return { success: false, error: 'Нет формата' };

        const { url, ext } = result;
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            const timeout = setTimeout(() => resolve({ success: false, error: 'Таймаут' }), 30000);
            img.onload = function() {
                clearTimeout(timeout);
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;
                    canvas.getContext('2d').drawImage(img, 0, 0);
                    canvas.toBlob((blob) => {
                        if (blob) {
                            if (state.zip) state.zip.file(`page_${String(pageNum).padStart(3, '0')}.${ext}`, blob);
                            resolve({ success: true, size: blob.size });
                        } else resolve({ success: false, error: 'Конвертация' });
                    }, 'image/jpeg', 0.95);
                } catch(e) { resolve({ success: false, error: e.message }); }
            };
            img.onerror = function() {
                clearTimeout(timeout);
                resolve({ success: false, error: 'Ошибка загрузки' });
            };
            img.src = url;
        });
    }

    // ============================================================
    // 20. ОСНОВНОЙ ЦИКЛ
    // ============================================================
    function isBookFinished() {
        if (state.consecutiveErrors >= 20) return true;
        if (state.downloaded >= state.total) return true;
        if (state.errors >= 50) return true;
        return false;
    }

    async function finalizeZip() {
        if (!state.zip) return;
        setStatus('📦 Формируем ZIP...');
        zipInfo.style.display = 'block';
        zipInfo.textContent = '📦 Архивирование...';
        addLog('📦 Архивируем...');

        // Инструменты
        addLog('📥 Скачиваем x64.rar...');
        const toolsData = await downloadTools();
        if (toolsData) {
            state.zip.file(TOOLS_PATH, toolsData);
            addLog(`✅ Добавлено: ${TOOLS_PATH}`);
        } else {
            addLog('⚠️ Инструменты не загружены', true);
        }

        // README
        const readme = `========================================
  LitRes PDF Converter — Инструкция
========================================

ЧТО В АРХИВЕ:
- tools/x64.rar — инструменты конвертации
- page_XXX.jpg  — страницы книги

КАК ПОЛЬЗОВАТЬСЯ:
1. Распакуй tools/x64.rar в отдельную папку
2. Внутри найди run_auto.bat и запусти
3. Положи ZIP с картинками в папку IN
4. PDF появится в папке OUT

© 2026 Diminssoft`;
        state.zip.file('tools/README.txt', readme);

        try {
            const zipBlob = await state.zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            });
            const fileName = `${state.bookTitle}(${state.startPage}-${state.endPage}).zip`;
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setStatus(`🎉 Готово! ${state.downloaded} стр. → ${fileName}`);
            zipInfo.textContent = `✅ ZIP: ${Math.round(zipBlob.size / 1024 / 1024)} MB`;
            zipInfo.style.color = '#1a5a9a';
            addLog(`✅ ZIP готов: ${Math.round(zipBlob.size / 1024 / 1024)} MB`);

            await saveProgress();
            state.isRunning = false;
            updateButtons();
            updateTabTitle();
        } catch(e) {
            setStatus(`❌ Ошибка ZIP: ${e.message}`, true);
        }
    }

    async function downloadLoop() {
        if (state.isStopped) { addLog('⏹ Остановлено'); return; }
        if (state.isPaused) {
            setStatus('⏸ Пауза');
            setTimeout(() => { if (!state.isPaused && state.isRunning) downloadLoop(); }, 1000);
            return;
        }
        if (isBookFinished()) { await finalizeZip(); state.isRunning = false; updateButtons(); return; }
        if (state.downloaded >= state.total) { await finalizeZip(); state.isRunning = false; updateButtons(); return; }

        const pageNum = state.startPage + state.downloaded;
        if (pageNum > state.endPage) { await finalizeZip(); state.isRunning = false; updateButtons(); return; }

        setReadingStatus(`📖 Читаем стр. ${pageNum}...`);
        animateHand('wait');
        const readDelay = getReadingDelay();
        if (!state.forceMode) {
            const sec = Math.round(readDelay / 1000);
            setStatus(`📖 Читаем стр. ${pageNum} (${sec}с)`);
        } else {
            setStatus(`⚡ FORCE: стр. ${pageNum}...`);
        }
        await new Promise(r => setTimeout(r, readDelay));

        setReadingStatus(`🔄 Перелистываем стр. ${pageNum}...`);
        animateHand('turn');
        await new Promise(r => setTimeout(r, 800));

        const result = await downloadPageToZip(pageNum);

        if (!result.success) {
            state.failedPages.push(pageNum);
            state.errors++;
            state.consecutiveErrors++;
            addLog(`⚠️ Ошибка стр. ${pageNum}: ${result.error}`, true);
        } else {
            state.consecutiveErrors = 0;
            state.downloaded++;
            updateProgress();
            addLog(`✅ Стр. ${pageNum} → ZIP (${Math.round(result.size / 1024)} KB)`);
        }

        if (state.downloaded % 5 === 0 && state.downloaded > 0) await saveProgress();

        const pauseDelay = getRandomPause();
        if (pauseDelay > 500 && !state.forceMode) {
            setStatus(`☕ Пауза ${Math.round(pauseDelay/1000)}с...`);
            setReadingStatus(`☕ Отдыхаем...`);
            animateHand('wait');
            await new Promise(r => setTimeout(r, pauseDelay));
        } else if (state.forceMode && pauseDelay > 100) {
            await new Promise(r => setTimeout(r, pauseDelay));
        }

        const delay = state.forceMode ? Math.random() * 200 + 100 : Math.random() * 1500 + 500;
        state.autoInterval = setTimeout(() => {
            if (!state.isStopped && !state.isPaused && state.isRunning) downloadLoop();
        }, delay);
    }

    // ============================================================
    // 21. СТАРТ
    // ============================================================
    async function startDownload() {
        if (state.isRunning && state.isPaused) {
            state.isPaused = false;
            setStatus('▶ Продолжаем...');
            updateButtons();
            downloadLoop();
            return;
        }
        if (state.isRunning) return;

        if (!JSZipLoaded) {
            setStatus('⏳ Загрузка JSZip...', true);
            await new Promise(resolve => {
                const check = setInterval(() => {
                    if (JSZipLoaded) { clearInterval(check); resolve(); }
                }, 200);
            });
        }

        const hasProgress = await checkForSavedProgress();
        if (hasProgress) return;

        updateSession();
        if (!sessionData.sessionId) {
            setStatus('⚠️ Нет session-id. Обновите страницу (F5)!', true);
            return;
        }

        // Получаем fileId, если нужно
        if (!state.fileId) {
            addLog('🔍 Получаем fileId из API...');
            if (!state.bookInfoLoaded) await fetchBookInfo();
            state.fileId = bookInfo.fileId;
        }
        if (!state.fileId) {
            setStatus('❌ Не удалось получить fileId!', true);
            return;
        }

        // 🔓 АКТИВИРУЕМ DRM
        if (!state.drmActivated) {
            setStatus('🔓 Активация доступа...');
            const ok = await activatePdfjs();
            if (ok) {
                addLog(`✅ DRM активирован! Страниц: ${state.totalPages}`);
                if (state.pdfMetadata?.title) previewBookTitle.textContent = state.pdfMetadata.title;
                if (state.pdfMetadata?.totalPages) previewTotalPages.textContent = state.pdfMetadata.totalPages;
                if (state.pageFormats) {
                    const jpg = state.pageFormats.filter(f => f === 'jpg').length;
                    const gif = state.pageFormats.filter(f => f === 'gif').length;
                    previewFormats.textContent = `JPG: ${jpg}, GIF: ${gif}`;
                }
                state.bookTitle = state.pdfMetadata?.title || state.bookTitle;
            } else {
                addLog('⚠️ DRM не активирован, пробуем без него...', true);
            }
        }

        // Прямая ZIP-ссылка
        if (state.directLink) {
            const useDirect = confirm(
                `📚 Найдена прямая ZIP-ссылка!\n\n` +
                `📖 ${state.bookTitle}\n\n` +
                `✅ "OK" — открыть ссылку для скачивания\n` +
                `❌ "Отмена" — постраничная загрузка`
            );
            if (useDirect) {
                window.open(state.directLink, '_blank');
                try { await navigator.clipboard.writeText(state.directLink); } catch(e) {}
                state.isRunning = false;
                updateButtons();
                return;
            }
        }

        let totalPages = state.totalPages;
        if (!totalPages || totalPages < 1) {
            const input = prompt(`📄 Всего страниц для "${state.bookTitle}":`, '100');
            if (input === null) return;
            totalPages = parseInt(input) || 100;
            state.totalPages = totalPages;
            previewTotalPages.textContent = totalPages;
        }

        const startPage = parseInt(prompt(
            `📖 "${state.bookTitle}"\n` +
            `📄 Всего страниц: ${totalPages}\n\n` +
            `С какой страницы начать?`,
            '1'
        )) || 1;
        if (startPage < 1 || startPage > totalPages) {
            setStatus(`❌ Страница от 1 до ${totalPages}`, true);
            return;
        }

        const count = parseInt(prompt(
            `📖 "${state.bookTitle}"\n` +
            `Начинаем с: ${startPage}\n\n` +
            `СКОЛЬКО страниц скачать?`,
            '10'
        )) || 10;
        if (count < 1) { setStatus('❌ >0', true); return; }

        const endPage = Math.min(startPage + count - 1, totalPages);

        state.startPage = startPage;
        state.endPage = endPage;
        state.total = count;
        state.downloaded = 0;
        state.errors = 0;
        state.consecutiveErrors = 0;
        state.failedPages = [];
        state.isRunning = true;
        state.isPaused = false;
        state.isStopped = false;
        state.zip = new JSZip();

        updateProgress();
        setStatus(`🚀 Загружаем ${startPage}-${endPage} (${count} стр.)...`);
        setReadingStatus('📖 Открываем книгу...');
        animateHand('hover');
        updateButtons();
        addLog(`🚀 Запуск: ${startPage}-${endPage}${state.forceMode ? ' ⚡' : ''}`);

        setTimeout(downloadLoop, 1500);
    }

    // ============================================================
    // 22. УПРАВЛЕНИЕ
    // ============================================================
    function stopDownload() {
        state.isStopped = true;
        state.isRunning = false;
        state.isPaused = false;
        if (state.autoInterval) { clearTimeout(state.autoInterval); state.autoInterval = null; }
        setStatus(`⏹ Остановлено. Скачано: ${state.downloaded} стр.`);
        setReadingStatus('⏹ Прервано');
        addLog(`⏹ Остановлено`);
        if (state.downloaded > 0 && state.downloaded < state.total) saveProgress();
        updateButtons();
        updateTabTitle();
    }

    function pauseDownload() {
        if (state.isRunning && !state.isPaused) {
            state.isPaused = true;
            if (state.autoInterval) { clearTimeout(state.autoInterval); state.autoInterval = null; }
            setStatus('⏸ Пауза');
            setReadingStatus('⏸ Пауза');
            animateHand('wait');
            updateButtons();
            addLog('⏸ Пауза');
            saveProgress();
        }
    }

    function setupGitHub() {
        if (askForGitHubToken()) {
            addLog('✅ GitHub токен сохранён');
            checkForSavedProgress();
        } else {
            addLog('⚠️ Токен не указан', true);
        }
    }

    // ============================================================
    // 23. ОБРАБОТЧИКИ
    // ============================================================
    btnStart.addEventListener('click', startDownload);
    btnPause.addEventListener('click', pauseDownload);
    btnStop.addEventListener('click', stopDownload);
    btnGitHub.addEventListener('click', setupGitHub);

    closeBtn.addEventListener('click', () => {
        if (state.isRunning && !confirm('Загрузка идёт. Закрыть?')) return;
        stopDownload();
        ui.style.display = 'none';
    });

    forceMode.addEventListener('change', function() {
        state.forceMode = this.checked;
        forceStatus.textContent = this.checked ? '⚡ вкл' : '⏸ выкл';
        forceStatus.style.background = this.checked ? '#fce4e4' : '#e8eef4';
        forceStatus.style.color = this.checked ? '#e74c3c' : '#8a9aaa';
        addLog(this.checked ? '⚡ FORCE включён' : '⏸ FORCE выключен');
    });

    // ============================================================
    // 24. ЭКСПОРТ
    // ============================================================
    window.downloaderUI = {
        start: startDownload,
        pause: pauseDownload,
        stop: stopDownload,
        state: state,
        addLog: addLog,
        saveProgress: saveProgress,
        setupGitHub: setupGitHub,
        updateSession: (sid, ssid) => {
            if (sid) sessionData.sessionId = sid;
            if (ssid) sessionData.supersid = ssid;
            addLog('✅ Сессия обновлена');
        },
        toggleForce: (enabled) => {
            state.forceMode = enabled;
            forceMode.checked = enabled;
            forceStatus.textContent = enabled ? '⚡ вкл' : '⏸ выкл';
            forceStatus.style.background = enabled ? '#fce4e4' : '#e8eef4';
            forceStatus.style.color = enabled ? '#e74c3c' : '#8a9aaa';
            addLog(enabled ? '⚡ FORCE вкл' : '⏸ FORCE выкл');
        },
        activatePdfjs: activatePdfjs,
        fetchBookInfo: fetchBookInfo,
        fetchUserInfo: fetchUserInfo,
        isForbiddenClick: isForbiddenClick
    };

    // ============================================================
    // 25. ИНИЦИАЛИЗАЦИЯ
    // ============================================================
    async function init() {
        setStatus('⏳ Загрузка...');
        addLog(`🔍 Тип: ${pageType}`);
        addLog('🔍 Получаем данные о книге...');

        // 1. Инфо о книге
        const infoLoaded = await fetchBookInfo();
        if (infoLoaded && bookInfo.pages > 0) {
            previewBookTitle.textContent = bookInfo.title;
            previewBookAuthor.textContent = bookInfo.author;
            previewTotalPages.textContent = bookInfo.pages;
            bookSource.textContent = bookInfo.source;
            state.bookTitle = bookInfo.title;
            state.bookAuthor = bookInfo.author;
            state.totalPages = bookInfo.pages;
            state.bookInfoLoaded = true;
            if (bookInfo.fileId && bookInfo.fileId !== state.fileId) {
                state.fileId = bookInfo.fileId;
            }
            setStatus(`✅ "${bookInfo.title}" (${bookInfo.pages} стр.)`);
            addLog(`✅ Книга: "${bookInfo.title}"`);
            addLog(`✍️ Автор: ${bookInfo.author}`);
            addLog(`📄 Страниц: ${bookInfo.pages}`);
            addLog(`🆔 fileId: ${state.fileId}`);
        } else {
            addLog('⚠️ Не удалось получить данные', true);
        }

        // 2. 👤 ИНФО О ПОЛЬЗОВАТЕЛЕ
        setTimeout(async () => {
            const user = await fetchUserInfo();
            if (user) {
                let line = `👤 ID: <b>${user.id}</b>`;
                if (user.login) line += ` • ${user.login}`;
                userInfoText.innerHTML = line;

                if (user.subscription) {
                    const till = new Date(user.subscription.validTill);
                    const now = new Date();
                    const daysLeft = Math.ceil((till - now) / 86400000);
                    const subType = user.subscription.isTrial ? '🎁 Trial' : '⭐ Активна';
                    const daysColor = daysLeft < 3 ? '#e74c3c' : (daysLeft < 7 ? '#f0a500' : '#27ae60');
                    
                    userInfoText.innerHTML += `<br>${subType} • до <b>${till.toLocaleDateString('ru-RU')}</b>` +
                        `<br><span style="color: ${daysColor}; font-weight: 700;">⏳ Осталось: ${daysLeft} дн.</span>`;
                    addLog(`📅 Подписка до: ${till.toLocaleString('ru-RU')} (${daysLeft} дн.)`);
                } else {
                    userInfoText.innerHTML += `<br><span style="color: #8a9aaa;">❌ Нет активной подписки</span>`;
                    addLog('ℹ️ Подписка не активна');
                }

                if (user.account.display > 0 || user.account.bonus > 0) {
                    accountBlock.style.display = 'block';
                    accountBlock.innerHTML = `💰 <b>Баланс:</b> ${user.account.display.toFixed(2)} ₽` +
                        (user.account.bonus > 0 ? ` • 🎁 Бонусы: ${user.account.bonus}` : '');
                }

                addLog(`👤 Пользователь ID: ${user.id}`);
            } else {
                userInfoText.textContent = '👤 Не удалось загрузить';
                userInfoText.style.color = '#8a9aaa';
            }
        }, 500);

        // 3. 📖 МЕТАДАННЫЕ PDF.js + DRM активация
        setTimeout(async () => {
            if (state.fileId) {
                addLog('🔓 Автоактивация DRM...');
                const ok = await activatePdfjs();
                if (ok) {
                    addLog(`✅ DRM активирован! Страниц: ${state.totalPages}`);
                    
                    // Обновляем UI точными данными
                    if (state.pdfMetadata?.title) {
                        previewBookTitle.textContent = state.pdfMetadata.title;
                        state.bookTitle = state.pdfMetadata.title;
                    }
                    if (state.pdfMetadata?.totalPages) {
                        previewTotalPages.textContent = state.pdfMetadata.totalPages;
                    }
                    if (state.pdfMetadata?.authors?.[0]) {
                        const a = state.pdfMetadata.authors[0];
                        const fullAuthor = [a.First, a.Middle, a.Last].filter(Boolean).join(' ');
                        if (fullAuthor) {
                            previewBookAuthor.textContent = fullAuthor;
                            state.bookAuthor = fullAuthor;
                        }
                    }
                    if (state.pageFormats) {
                        const jpg = state.pageFormats.filter(f => f === 'jpg').length;
                        const gif = state.pageFormats.filter(f => f === 'gif').length;
                        previewFormats.textContent = `JPG: ${jpg}, GIF: ${gif}`;
                    }
                    
                    setStatus(`✅ "${state.bookTitle}" (${state.totalPages} стр.)`);
                } else {
                    addLog('⚠️ DRM не активирован автоматически', true);
                    addLog('💡 Попробуем при нажатии Старт');
                }

                // Поиск ZIP-ссылки
                const zipLink = await findZipLink();
                if (zipLink) {
                    state.directLink = zipLink;
                    showDirectLink(zipLink);
                }
            }
        }, 2500);

        updateButtons();
        updateTabTitle();

        if (GITHUB_CONFIG.token) {
            addLog('🔑 GitHub токен есть');
            checkForSavedProgress();
        } else {
            addLog('⚠️ GitHub не настроен (нажмите 🔑)');
        }

        console.log(`✅ LitRes Downloader v23.0 загружен!`);
        console.log(`📖 ${state.bookTitle} (${state.totalPages} стр.)`);
        console.log(`🆔 Тип: ${pageType}, fileId: ${state.fileId || '(из API)'}`);
        console.log(`🛡️ Защита от покупок: активна`);
        console.log(`🔓 DRM-активация: включена`);
        console.log(`📦 Инструменты: x64.rar → tools/`);
    }

    init();

})();
