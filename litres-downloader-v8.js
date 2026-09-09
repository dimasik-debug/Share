/**
 * LitRes Downloader v8.0
 * Прямые ссылки в окне + постраничная загрузка
 * (c) 2026 Diminssoft
 */

(function fullDownloaderV8() {
    console.log('🚀 LitRes Downloader v8.0 — Прямые ссылки в окне');

    // ============================================================
    // 1. НАСТРОЙКИ GITHUB
    // ============================================================
    const GITHUB_CONFIG = {
        repo: 'dimasik-debug/Share',
        path: 'books/progress/',
        token: localStorage.getItem('github_token') || ''
    };

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
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
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
                for (let i = 0; i < binary.length; i++) {
                    bytes[i] = binary.charCodeAt(i);
                }
                const decoder = new TextDecoder('utf-8');
                const jsonString = decoder.decode(bytes);
                return JSON.parse(jsonString);
            }
        } catch(e) {
            console.warn('⚠️ Прогресс не найден:', e);
        }
        return null;
    }

    // ============================================================
    // 2. ПОДКЛЮЧАЕМ JSZip
    // ============================================================
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    document.head.appendChild(script);

    let JSZipLoaded = false;
    script.onload = () => {
        JSZipLoaded = true;
        console.log('✅ JSZip загружен!');
    };
    script.onerror = () => {
        alert('❌ Не удалось загрузить JSZip. Проверьте интернет.');
    };

    // ============================================================
    // 3. ПОЛУЧАЕМ ПАРАМЕТРЫ
    // ============================================================
    const urlParams = new URLSearchParams(window.location.search);
    const fileId = urlParams.get('file');
    const artId = urlParams.get('art');

    if (!fileId || !artId) {
        alert('❌ Не удалось определить ID книги!');
        return;
    }

    // ============================================================
    // 4. РАБОТА С СЕССИЕЙ
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
            'accept': '*/*',
            'accept-language': 'ru,en;q=0.9',
            'app-id': '115',
            'client-host': 'www.litres.ru',
            'session-id': sessionData.sessionId,
            'supersid': sessionData.supersid,
            'ui-language-code': 'ru'
        };
    }

    // ============================================================
    // 5. ОПРЕДЕЛЯЕМ КНИГУ
    // ============================================================
    let totalPages = 0;
    const pagerMax = document.getElementById('pager-max');
    if (pagerMax) {
        totalPages = parseInt(pagerMax.innerText) || 0;
    }

    if (!totalPages) {
        const totalParam = urlParams.get('total');
        if (totalParam) {
            totalPages = parseInt(totalParam) || 0;
        }
    }

    if (!totalPages) {
        for (let key in window) {
            try {
                const obj = window[key];
                if (obj && typeof obj === 'object' && obj.pageData && obj.pageData.pages) {
                    totalPages = obj.pageData.pages.length;
                    break;
                }
            } catch(e) {}
        }
    }

    if (!totalPages || totalPages < 1) {
        const userInput = prompt(
            '📖 Не удалось автоматически определить количество страниц.\n\n' +
            'Введите ОБЩЕЕ КОЛИЧЕСТВО СТРАНИЦ в книге:',
            '570'
        );
        if (userInput === null) {
            alert('❌ Операция отменена пользователем');
            return;
        }
        totalPages = parseInt(userInput) || 570;
    }

    console.log(`📄 Определено страниц: ${totalPages}`);

    let bookTitle = urlParams.get('title') || document.title || 'book';
    bookTitle = bookTitle.replace(/[^a-zA-Zа-яА-Я0-9 ]/g, '').trim().slice(0, 50) || 'book';

    // ============================================================
    // 6. ПОИСК ПРЯМЫХ ССЫЛОК
    // ============================================================
    async function findDirectLinks() {
        const links = [];
        
        try {
            // Пробуем разные варианты
            const resources = ['full', 'download', 'zip', 'bin'];
            for (const res of resources) {
                try {
                    const resp = await fetch(
                        `https://api.litres.ru/foundation/api/arts/files/${fileId}/link?resource=${res}&is_trial=false`,
                        {
                            method: 'GET',
                            credentials: 'include',
                            headers: getHeaders()
                        }
                    );
                    if (!resp.ok) continue;
                    const data = await resp.json();
                    const url = data?.payload?.data?.link || data?.payload?.link || data?.data?.link || data?.link;
                    if (url && (url.includes('.zip') || url.includes('.fb2') || url.includes('.epub') || url.includes('.bin'))) {
                        links.push({ type: res, url: url });
                    }
                } catch(e) {}
            }
        } catch(e) {}

        // Если ничего не нашли, пробуем через прямой запрос к content.litres.ru
        if (links.length === 0) {
            try {
                const resp = await fetch(
                    `https://api.litres.ru/foundation/api/arts/files/${fileId}/link?is_trial=false`,
                    {
                        method: 'GET',
                        credentials: 'include',
                        headers: getHeaders()
                    }
                );
                if (resp.ok) {
                    const data = await resp.json();
                    const url = data?.payload?.data?.link || data?.payload?.link || data?.data?.link || data?.link;
                    if (url && (url.includes('.zip') || url.includes('.fb2') || url.includes('.epub') || url.includes('.bin'))) {
                        links.push({ type: 'default', url: url });
                    }
                }
            } catch(e) {}
        }

        return links;
    }

    // ============================================================
    // 7. UI С ПРЯМЫМИ ССЫЛКАМИ
    // ============================================================
    const uiHTML = `
        <div id="litres_downloader_ui" style="
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 99999;
            background: #ffffff;
            color: #1a2a4a;
            border-radius: 20px;
            padding: 24px 28px;
            font-family: 'Segoe UI', -apple-system, Arial, sans-serif;
            font-size: 14px;
            min-width: 360px;
            max-width: 420px;
            box-shadow: 0 12px 48px rgba(0,0,0,0.15);
            border: 1px solid rgba(26, 42, 74, 0.08);
            user-select: none;
        ">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="32" height="32" rx="8" fill="#1a3a6a"/>
                    <path d="M16 4L4 12v8l12 8 12-8v-8L16 4z" stroke="#ffffff" stroke-width="2" fill="none"/>
                    <path d="M10 12v8l6 4 6-4v-8l-6-4-6 4z" fill="#ffffff" opacity="0.9"/>
                    <circle cx="16" cy="16" r="4" fill="#1a3a6a"/>
                    <path d="M12 16l4-4 4 4-4 4-4-4z" fill="#ffffff"/>
                </svg>
                <div>
                    <div style="font-weight: 800; font-size: 18px; color: #1a2a4a; letter-spacing: -0.5px; line-height: 1.2;">
                        📚 LitRes <span style="color: #1a5a9a;">Downloader</span>
                    </div>
                    <div style="font-size: 10px; color: #6a8aaa; letter-spacing: 0.5px; text-transform: uppercase; font-weight: 600;">
                        📖 v8.0 — Прямые ссылки в окне
                    </div>
                </div>
                <button id="close_ui" style="
                    margin-left: auto;
                    background: rgba(26, 42, 74, 0.05);
                    border: none;
                    color: #8a9aaa;
                    cursor: pointer;
                    font-size: 18px;
                    padding: 4px 8px;
                    border-radius: 8px;
                ">✕</button>
            </div>

            <!-- ИНФОРМАЦИЯ О КНИГЕ -->
            <div style="
                background: #f0f7ff;
                border-radius: 12px;
                padding: 12px 16px;
                margin-bottom: 14px;
                border-left: 4px solid #1a5a9a;
            ">
                <div style="font-weight: 700; font-size: 14px; color: #1a2a4a; margin-bottom: 4px;">
                    📖 <span id="preview_book_title">${bookTitle}</span>
                </div>
                <div style="font-size: 12px; color: #4a6a8a;">
                    📄 Всего страниц: <span id="preview_total_pages">${totalPages}</span>
                </div>
                <div style="font-size: 12px; color: #4a6a8a; margin-top: 4px;">
                    ☁️ GitHub: <span id="github_status" style="color: #1a5a9a;">не настроен</span>
                </div>
            </div>

            <!-- ПРЯМЫЕ ССЫЛКИ -->
            <div id="direct_links_container" style="
                background: #f8fafc;
                border-radius: 12px;
                padding: 12px 16px;
                margin-bottom: 14px;
                border: 1px solid #e8eef4;
                display: none;
            ">
                <div style="font-weight: 600; font-size: 13px; color: #1a2a4a; margin-bottom: 8px;">
                    🔗 Доступно прямое скачивание:
                </div>
                <div id="direct_links_list"></div>
                <div style="font-size: 11px; color: #6a8aaa; margin-top: 8px;">
                    💡 Нажмите на ссылку, чтобы скачать ZIP-файл
                </div>
            </div>

            <!-- СТАТУС -->
            <div style="
                background: #f0f4fa;
                border-radius: 12px;
                padding: 12px 16px;
                margin-bottom: 14px;
                display: flex;
                flex-direction: column;
                gap: 4px;
                min-height: 60px;
            ">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div id="hand_animation" style="
                        font-size: 32px;
                        transition: transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
                        transform: translateX(0) rotate(0deg);
                        width: 48px;
                        text-align: center;
                    ">
                        🖐️
                    </div>
                    <div style="flex: 1;">
                        <div id="reading_status" style="
                            font-weight: 600;
                            font-size: 14px;
                            color: #1a2a4a;
                        ">
                            📖 Готов к чтению
                        </div>
                        <div id="reading_progress_text" style="
                            font-size: 12px;
                            color: #6a8aaa;
                        ">
                            Прогресс: 0%
                        </div>
                    </div>
                    <div id="page_counter" style="
                        font-size: 20px;
                        font-weight: 700;
                        color: #1a5a9a;
                        min-width: 50px;
                        text-align: right;
                    ">
                        0/0
                    </div>
                </div>
                <div id="log_status" style="
                    font-size: 11px;
                    color: #6a8aaa;
                    background: #e8eef4;
                    padding: 4px 8px;
                    border-radius: 4px;
                    max-height: 60px;
                    overflow-y: auto;
                    font-family: 'Courier New', monospace;
                ">
                    ⏳ Ожидание запуска...
                </div>
            </div>

            <!-- ПРОГРЕСС -->
            <div style="margin-bottom: 14px;">
                <div style="display: flex; justify-content: space-between; font-size: 13px; color: #4a6a8a; margin-bottom: 6px;">
                    <span id="progress_text">📥 Страниц: 0 из 0</span>
                    <span id="percent_text" style="font-weight: 700; color: #1a5a9a;">0%</span>
                </div>
                <div style="
                    width: 100%;
                    height: 8px;
                    background: #e8eef4;
                    border-radius: 4px;
                    overflow: hidden;
                ">
                    <div id="progress_bar" style="
                        width: 0%;
                        height: 100%;
                        background: linear-gradient(90deg, #1a5a9a, #4a8af4);
                        border-radius: 4px;
                        transition: width 0.6s ease;
                    "></div>
                </div>
            </div>

            <!-- КНОПКИ -->
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
                <button id="btn_github" style="
                    padding: 10px 12px;
                    background: #24292e;
                    color: #ffffff;
                    border: none;
                    border-radius: 10px;
                    cursor: pointer;
                    font-weight: 700;
                    font-size: 13px;
                    transition: all 0.2s;
                    min-width: 70px;
                ">🔑 GitHub</button>

                <button id="btn_start" style="
                    flex: 1;
                    padding: 10px 12px;
                    background: #1a3a6a;
                    color: #ffffff;
                    border: none;
                    border-radius: 10px;
                    cursor: pointer;
                    font-weight: 700;
                    font-size: 13px;
                    transition: all 0.2s;
                    min-width: 70px;
                    box-shadow: 0 4px 12px rgba(26, 58, 106, 0.2);
                ">▶ Старт</button>

                <button id="btn_pause" style="
                    flex: 1;
                    padding: 10px 12px;
                    background: #e8eef4;
                    color: #6a8aaa;
                    border: none;
                    border-radius: 10px;
                    cursor: pointer;
                    font-weight: 700;
                    font-size: 13px;
                    transition: all 0.2s;
                    min-width: 70px;
                ">⏸ Пауза</button>

                <button id="btn_stop" style="
                    flex: 1;
                    padding: 10px 12px;
                    background: #f0f2f4;
                    color: #8a9aaa;
                    border: 1px solid #dce2e8;
                    border-radius: 10px;
                    cursor: pointer;
                    font-weight: 700;
                    font-size: 13px;
                    transition: all 0.2s;
                    min-width: 70px;
                ">⏹ Стоп</button>
            </div>

            <div id="status_text" style="
                font-size: 12px;
                color: #6a8aaa;
                text-align: center;
                padding: 8px 0 4px;
                border-top: 1px solid #e8eef4;
                min-height: 22px;
            ">
                ⏳ Готов к чтению
            </div>

            <div id="zip_info" style="
                font-size: 11px;
                color: #8aaaac;
                text-align: center;
                margin-top: 4px;
                display: none;
            ">
                📦 Архивация...
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', uiHTML);

    // ============================================================
    // 8. ПОЛУЧАЕМ ЭЛЕМЕНТЫ
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
    const githubStatus = document.getElementById('github_status');
    const previewTotalPages = document.getElementById('preview_total_pages');
    const directLinksContainer = document.getElementById('direct_links_container');
    const directLinksList = document.getElementById('direct_links_list');

    // ============================================================
    // 9. СОСТОЯНИЕ
    // ============================================================
    let state = {
        isRunning: false,
        isPaused: false,
        isStopped: false,
        downloaded: 0,
        total: 0,
        startPage: 1,
        endPage: 10,
        bookTitle: bookTitle,
        totalPages: totalPages,
        errors: 0,
        maxErrors: 5,
        zip: null,
        failedPages: [],
        consecutiveErrors: 0,
        fileId: fileId,
        artId: artId,
        lastSaveTime: 0,
        isCancelled: false
    };

    // ============================================================
    // 10. ФУНКЦИИ
    // ============================================================
    function addLog(text, isError = false) {
        const time = new Date().toLocaleTimeString();
        const prefix = isError ? '❌' : 'ℹ️';
        logStatus.textContent = `${prefix} [${time}] ${text}`;
        console.log(`[LOG] ${text}`);
        logStatus.style.color = isError ? '#e74c3c' : '#6a8aaa';
    }

    function setStatus(text, isError = false) {
        statusText.textContent = text;
        statusText.style.color = isError ? '#e74c3c' : '#6a8aaa';
        addLog(text, isError);
    }

    function setReadingStatus(text) {
        readingStatus.textContent = text;
    }

    // ============================================================
    // 11. АНИМАЦИЯ РУКИ
    // ============================================================
    function animateHand(action) {
        if (action === 'turn') {
            handAnimation.style.transform = 'translateX(30px) rotate(20deg)';
            setTimeout(() => {
                handAnimation.style.transform = 'translateX(-10px) rotate(-10deg)';
            }, 400);
            setTimeout(() => {
                handAnimation.style.transform = 'translateX(0) rotate(0deg)';
            }, 800);
        } else if (action === 'hover') {
            handAnimation.style.transform = 'translateX(10px) scale(1.1)';
            setTimeout(() => {
                handAnimation.style.transform = 'translateX(0) scale(1)';
            }, 600);
        } else if (action === 'wait') {
            handAnimation.style.transform = 'rotate(-5deg)';
            setTimeout(() => {
                handAnimation.style.transform = 'rotate(5deg)';
            }, 500);
            setTimeout(() => {
                handAnimation.style.transform = 'rotate(0deg)';
            }, 1000);
        }
    }

    // ============================================================
    // 12. РЕАЛИСТИЧНЫЕ ПАУЗЫ
    // ============================================================
    function getReadingDelay() {
        const baseDelay = Math.random() * 5000 + 3000;
        if (Math.random() < 0.15) {
            return baseDelay + Math.random() * 10000 + 5000;
        }
        if (Math.random() < 0.1) {
            return Math.random() * 1000 + 500;
        }
        return baseDelay;
    }

    function getRandomPause() {
        if (Math.random() < 0.2) {
            return Math.random() * 10000 + 5000;
        }
        if (Math.random() < 0.1) {
            return Math.random() * 30000 + 15000;
        }
        return Math.random() * 3000 + 1000;
    }

    // ============================================================
    // 13. ПРОГРЕСС
    // ============================================================
    function updateProgress() {
        const percent = state.total > 0 ? Math.round((state.downloaded / state.total) * 100) : 0;
        progressBar.style.width = `${Math.min(percent, 100)}%`;
        progressText.textContent = `📥 Страниц: ${state.downloaded} из ${state.total}`;
        percentText.textContent = `${percent}%`;
        pageCounter.textContent = `${state.downloaded}/${state.total}`;
        readingProgressText.textContent = `Прогресс: ${percent}%`;
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
    // 14. РАБОТА С ПРОГРЕССОМ
    // ============================================================
    async function saveProgress() {
        if (!state.zip || state.downloaded === 0) return;
        if (!GITHUB_CONFIG.token) {
            githubStatus.textContent = '⚠️ нет токена';
            return;
        }
        const now = Date.now();
        if (now - state.lastSaveTime < 30000) return;
        state.lastSaveTime = now;

        const progressData = {
            book_id: state.artId,
            book_title: state.bookTitle,
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

        githubStatus.textContent = '⏳ сохраняю...';
        const success = await saveProgressToGitHub(state.artId, progressData);
        githubStatus.textContent = success ? '✅ сохранён' : '❌ ошибка';
        if (success) {
            addLog(`💾 Прогресс сохранён на GitHub (${state.downloaded}/${state.total})`);
        }
    }

    async function loadProgress() {
        if (!GITHUB_CONFIG.token) {
            githubStatus.textContent = '⚠️ нет токена';
            return null;
        }
        githubStatus.textContent = '⏳ загрузка...';
        const data = await loadProgressFromGitHub(state.artId);
        if (data) {
            githubStatus.textContent = `✅ ${data.downloaded_pages}/${data.total_pages}`;
            addLog(`📖 Загружен прогресс: ${data.downloaded_pages}/${data.total_pages}`);
            return data;
        } else {
            githubStatus.textContent = '❌ не найден';
            return null;
        }
    }

    async function checkForSavedProgress() {
        if (!GITHUB_CONFIG.token) {
            const hasToken = askForGitHubToken();
            if (!hasToken) {
                addLog('⚠️ GitHub токен не указан', true);
                return false;
            }
        }
        const progress = await loadProgress();
        if (progress && progress.downloaded_pages > 0 && progress.downloaded_pages < progress.total_pages) {
            const resume = confirm(
                `📖 Найдено сохранение для "${progress.book_title}"\n\n` +
                `📄 Страниц: ${progress.downloaded_pages} из ${progress.total_pages}\n` +
                `📅 Последнее обновление: ${new Date(progress.last_update).toLocaleString()}\n\n` +
                `Продолжить с того же места?`
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
                addLog(`🔄 Восстановлен прогресс: ${state.downloaded}/${state.total}`);
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
    // 15. СКАЧИВАНИЕ С ПАУЗАМИ
    // ============================================================
    async function downloadAndAddToZip(pageNum) {
        const apiPage = pageNum - 1;
        const ext = apiPage === 0 ? 'jpg' : 'gif';

        try {
            addLog(`📥 Стр. ${pageNum}...`);
            
            updateSession();
            if (!sessionData.sessionId) {
                addLog(`⚠️ Сессия потеряна! Обновите страницу (F5)`, true);
                setStatus(`⚠️ Сессия потеряна! Обновите страницу`, true);
                return false;
            }

            const linkResp = await fetch(
                `https://api.litres.ru/foundation/api/arts/files/${state.fileId}/link?page_id=${apiPage}&is_trial=false&resolution=w1900&image_type=${ext}`,
                {
                    method: 'GET',
                    credentials: 'include',
                    headers: getHeaders()
                }
            );

            if (!linkResp.ok) {
                if (linkResp.status === 401) {
                    addLog(`⚠️ Ошибка 401! Сессия устарела. Обновите страницу (F5)`, true);
                    setStatus(`⚠️ Сессия устарела! Обновите страницу (F5)`, true);
                    state.consecutiveErrors = 3;
                    return false;
                }
                addLog(`⚠️ Ошибка API стр. ${pageNum}: ${linkResp.status}`, true);
                if (linkResp.status === 404) {
                    state.consecutiveErrors++;
                }
                return false;
            }

            const linkData = await linkResp.json();
            const imageUrl = linkData?.payload?.data?.link || 
                            linkData?.payload?.link || 
                            linkData?.data?.link ||
                            linkData?.link;

            if (!imageUrl) {
                addLog(`⚠️ Нет ссылки для стр. ${pageNum}`, true);
                state.consecutiveErrors++;
                return false;
            }

            const imgBlob = await new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                const timeout = setTimeout(() => {
                    reject(new Error(`Таймаут загрузки стр. ${pageNum}`));
                }, 30000);
                img.onload = function() {
                    clearTimeout(timeout);
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.naturalWidth || img.width;
                        canvas.height = img.naturalHeight || img.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        canvas.toBlob((blob) => {
                            if (blob) resolve(blob);
                            else reject(new Error('Не удалось конвертировать изображение'));
                        }, 'image/jpeg', 0.95);
                    } catch(e) { reject(e); }
                };
                img.onerror = function() {
                    clearTimeout(timeout);
                    reject(new Error(`Ошибка загрузки изображения стр. ${pageNum}`));
                };
                img.src = imageUrl;
            });

            if (!imgBlob) {
                addLog(`⚠️ Не удалось получить изображение стр. ${pageNum}`, true);
                state.consecutiveErrors++;
                return false;
            }

            const fileName = `${String(pageNum).padStart(3, '0')}.${ext}`;
            if (state.zip) {
                state.zip.file(fileName, imgBlob);
            }

            state.downloaded++;
            state.errors = 0;
            state.consecutiveErrors = 0;
            updateProgress();
            addLog(`✅ Стр. ${pageNum} → архив (${Math.round(imgBlob.size / 1024)} KB)`);
            
            if (state.downloaded % 5 === 0) {
                await saveProgress();
            }
            
            return true;

        } catch(e) {
            addLog(`⚠️ Ошибка стр. ${pageNum}: ${e.message}`, true);
            state.consecutiveErrors++;
            return false;
        }
    }

    // ============================================================
    // 16. ОСНОВНОЙ ЦИКЛ С ПАУЗАМИ
    // ============================================================
    function isBookFinished() {
        if (state.consecutiveErrors >= 3) {
            addLog(`📌 3 ошибки подряд — вероятно, книга закончилась`, true);
            return true;
        }
        if (state.downloaded >= state.total) {
            return true;
        }
        if (state.errors >= state.maxErrors) {
            return true;
        }
        return false;
    }

    async function finalizeZip() {
        if (!state.zip) return;

        setStatus('📦 Формируем ZIP-архив...');
        zipInfo.style.display = 'block';
        zipInfo.textContent = '📦 Архивирование...';
        zipInfo.style.color = '#f0a500';
        addLog('📦 Архивируем...');

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

            if (state.failedPages.length > 0) {
                addLog(`⚠️ Пропущенные страницы: ${state.failedPages.join(', ')}`, true);
            }

            state.downloaded = state.total;
            await saveProgress();
            
            state.isRunning = false;
            updateButtons();

        } catch(e) {
            setStatus(`❌ Ошибка создания ZIP: ${e.message}`, true);
        }
    }

    async function downloadLoop() {
        if (state.isStopped) {
            addLog('⏹ Остановлено пользователем');
            return;
        }

        if (state.isPaused) {
            setStatus('⏸ На паузе');
            setTimeout(() => {
                if (!state.isPaused && state.isRunning) {
                    downloadLoop();
                }
            }, 1000);
            return;
        }

        if (isBookFinished()) {
            addLog('📌 Книга закончилась или превышен лимит ошибок', true);
            await finalizeZip();
            state.isRunning = false;
            updateButtons();
            return;
        }

        if (state.downloaded >= state.total) {
            await finalizeZip();
            state.isRunning = false;
            updateButtons();
            return;
        }

        const pageNum = state.startPage + state.downloaded;
        if (pageNum > state.endPage) {
            await finalizeZip();
            state.isRunning = false;
            updateButtons();
            return;
        }

        setReadingStatus(`📖 Читаем стр. ${pageNum}...`);
        animateHand('wait');

        const readDelay = getReadingDelay();
        const minutes = Math.floor(readDelay / 60000);
        const seconds = Math.floor((readDelay % 60000) / 1000);
        const timeStr = minutes > 0 ? `${minutes}м ${seconds}с` : `${seconds}с`;
        setStatus(`📖 Читаем стр. ${pageNum} (${timeStr})`);
        
        await new Promise(resolve => setTimeout(resolve, readDelay));

        setReadingStatus(`🔄 Перелистываем стр. ${pageNum}...`);
        animateHand('turn');
        await new Promise(resolve => setTimeout(resolve, 800));

        const success = await downloadAndAddToZip(pageNum);

        if (!success) {
            state.failedPages.push(pageNum);
            state.errors++;
            
            if (state.errors >= state.maxErrors) {
                setStatus(`⚠️ Слишком много ошибок (${state.errors}). Сохраняем частичный архив...`, true);
                await saveProgress();
                state.isRunning = false;
                updateButtons();
                return;
            }
            
            if (state.consecutiveErrors >= 3) {
                setStatus(`📌 3 ошибки подряд! Вероятно, книга закончилась. Сохраняем частичный архив...`, true);
                await saveProgress();
                state.isRunning = false;
                updateButtons();
                return;
            }
        }

        updateProgress();

        const pauseDelay = getRandomPause();
        if (pauseDelay > 5000) {
            setStatus(`☕ Пауза ${Math.round(pauseDelay/1000)}с...`);
            setReadingStatus(`☕ Отдыхаем...`);
            animateHand('wait');
            await new Promise(resolve => setTimeout(resolve, pauseDelay));
        }

        setReadingStatus(`✅ Стр. ${pageNum} прочитана`);

        const delay = Math.random() * 1500 + 500;
        state.autoInterval = setTimeout(() => {
            if (!state.isStopped && !state.isPaused && state.isRunning) {
                downloadLoop();
            }
        }, delay);
    }

    // ============================================================
    // 17. ЗАПУСК С ПОИСКОМ ССЫЛОК
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
                    if (JSZipLoaded) {
                        clearInterval(check);
                        resolve();
                    }
                }, 200);
            });
        }

        const hasProgress = await checkForSavedProgress();
        if (hasProgress) return;

        updateSession();
        if (!sessionData.sessionId) {
            setStatus('⚠️ Не найден session-id. Обновите страницу (F5)!', true);
            addLog('💡 Нужно обновить страницу (F5) и запустить скрипт заново', true);
            return;
        }

        addLog(`🔑 session-id: ${sessionData.sessionId.substring(0, 10)}...`);

        // ============================================================
        // ПОИСК ПРЯМЫХ ССЫЛОК
        // ============================================================
        addLog('🔍 Ищем прямые ссылки для скачивания...');
        setStatus('🔍 Поиск прямых ссылок...');
        
        const links = await findDirectLinks();
        
        if (links.length > 0) {
            // Показываем блок со ссылками
            directLinksContainer.style.display = 'block';
            directLinksList.innerHTML = '';
            
            // Сортируем: сначала bin, потом zip, потом остальные
            const sortedLinks = links.sort((a, b) => {
                const priority = { 'bin': 0, 'full': 1, 'zip': 2, 'download': 3, 'default': 4 };
                return (priority[a.type] || 5) - (priority[b.type] || 5);
            });
            
            let linkHtml = '';
            for (let i = 0; i < sortedLinks.length; i++) {
                const link = sortedLinks[i];
                const label = link.type === 'bin' ? '📦 Полная книга' :
                             link.type === 'full' ? '📖 Полная книга (JSON)' :
                             link.type === 'zip' ? '📦 ZIP-архив' :
                             link.type === 'download' ? '⬇️ Скачать' :
                             '🔗 Прямая ссылка';
                
                // Создаём ссылку с кнопкой копирования
                linkHtml += `
                    <div style="
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        margin-bottom: 6px;
                        background: #ffffff;
                        border-radius: 6px;
                        padding: 6px 10px;
                        border: 1px solid #e8eef4;
                    ">
                        <span style="font-size: 12px; font-weight: 600; min-width: 80px; color: #1a5a9a;">${label}</span>
                        <a href="${link.url}" target="_blank" style="
                            flex: 1;
                            font-size: 11px;
                            color: #1a5a9a;
                            text-decoration: none;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            white-space: nowrap;
                            padding: 4px 8px;
                            background: #f0f7ff;
                            border-radius: 4px;
                        ">${link.url.substring(0, 60)}...</a>
                        <button onclick="navigator.clipboard.writeText('${link.url}')" style="
                            background: #e8eef4;
                            border: none;
                            border-radius: 4px;
                            padding: 4px 8px;
                            cursor: pointer;
                            font-size: 12px;
                            color: #1a2a4a;
                        ">📋</button>
                    </div>
                `;
            }
            
            directLinksList.innerHTML = linkHtml;
            
            // Показываем уведомление
            setStatus(`✅ Найдено ${links.length} прямых ссылок! Кликните для скачивания.`);
            addLog(`✅ Найдено ${links.length} прямых ссылок для скачивания`);
        } else {
            directLinksContainer.style.display = 'none';
            addLog('ℹ️ Прямые ссылки не найдены');
        }

        // ============================================================
        // ПОСТРАНИЧНАЯ ЗАГРУЗКА
        // ============================================================
        const start = parseInt(prompt(
            `📖 Книга: "${state.bookTitle}"\n` +
            `📄 Всего страниц: ${state.totalPages}\n\n` +
            `С какой страницы начать? (1-${state.totalPages})`,
            state.startPage
        )) || state.startPage;

        if (start < 1 || start > state.totalPages) {
            setStatus(`❌ Страница должна быть от 1 до ${state.totalPages}`, true);
            return;
        }

        const end = parseInt(prompt(
            `📖 Книга: "${state.bookTitle}"\n` +
            `📄 Всего страниц: ${state.totalPages}\n` +
            `Начинаем с: ${start}\n\n` +
            `По какую страницу читать? (${start}-${state.totalPages})`,
            state.endPage
        )) || state.endPage;

        if (end < start || end > state.totalPages) {
            setStatus(`❌ Диапазон должен быть от ${start} до ${state.totalPages}`, true);
            return;
        }

        state.startPage = start;
        state.endPage = end;
        state.total = end - start + 1;
        state.downloaded = 0;
        state.errors = 0;
        state.consecutiveErrors = 0;
        state.failedPages = [];
        state.isRunning = true;
        state.isPaused = false;
        state.isStopped = false;
        state.zip = new JSZip();

        updateProgress();
        setStatus(`🚀 Загружаем ${start}-${end}...`);
        setReadingStatus('📖 Открываем книгу...');
        animateHand('hover');
        updateButtons();
        addLog(`🚀 Запуск: ${start}-${end} (${state.total} стр.)`);

        setTimeout(downloadLoop, 1500);
    }

    // ============================================================
    // 18. УПРАВЛЕНИЕ
    // ============================================================
    function stopDownload() {
        state.isStopped = true;
        state.isRunning = false;
        state.isPaused = false;
        if (state.autoInterval) {
            clearTimeout(state.autoInterval);
            state.autoInterval = null;
        }
        setStatus(`⏹ Остановлено. Скачано: ${state.downloaded} стр.`);
        setReadingStatus('⏹ Чтение прервано');
        addLog(`⏹ Остановлено. Скачано: ${state.downloaded} стр.`);
        
        if (state.downloaded > 0 && state.downloaded < state.total) {
            saveProgress();
        }
        
        updateButtons();
    }

    function pauseDownload() {
        if (state.isRunning && !state.isPaused) {
            state.isPaused = true;
            if (state.autoInterval) {
                clearTimeout(state.autoInterval);
                state.autoInterval = null;
            }
            setStatus('⏸ Пауза');
            setReadingStatus('⏸ Чтение на паузе');
            animateHand('wait');
            updateButtons();
            addLog('⏸ Пауза');
            saveProgress();
        }
    }

    function setupGitHub() {
        if (askForGitHubToken()) {
            addLog('✅ GitHub токен сохранён');
            githubStatus.textContent = '✅ готов';
            checkForSavedProgress();
        } else {
            addLog('⚠️ GitHub токен не указан', true);
            githubStatus.textContent = '⚠️ нет токена';
        }
    }

    // ============================================================
    // 19. ОБРАБОТЧИКИ
    // ============================================================
    btnStart.addEventListener('click', startDownload);
    btnPause.addEventListener('click', pauseDownload);
    btnStop.addEventListener('click', stopDownload);
    btnGitHub.addEventListener('click', setupGitHub);
    
    closeBtn.addEventListener('click', () => {
        if (state.isRunning && !confirm('Загрузка ещё идёт. Закрыть?')) return;
        stopDownload();
        ui.style.display = 'none';
    });

    // ============================================================
    // 20. ЭКСПОРТ
    // ============================================================
    window.downloaderUI = {
        start: startDownload,
        pause: pauseDownload,
        stop: stopDownload,
        state: state,
        addLog: addLog,
        saveProgress: saveProgress,
        loadProgress: loadProgress,
        setupGitHub: setupGitHub,
        updateSession: (sid, ssid) => {
            if (sid) sessionData.sessionId = sid;
            if (ssid) sessionData.supersid = ssid;
            addLog('✅ Сессия обновлена');
            setStatus('✅ Сессия обновлена');
        }
    };

    // ============================================================
    // 21. ИНИЦИАЛИЗАЦИЯ
    // ============================================================
    updateButtons();
    setStatus(`📖 Готов (${totalPages} стр.)`);
    setReadingStatus('📚 Настройте GitHub для сохранения');
    addLog(`📖 "${bookTitle}", ${totalPages} страниц`);
    
    if (GITHUB_CONFIG.token) {
        githubStatus.textContent = '✅ готов';
        checkForSavedProgress();
    } else {
        githubStatus.textContent = '⚠️ нажмите GitHub';
    }
    
    // Запускаем поиск ссылок при загрузке
    setTimeout(async () => {
        addLog('🔍 Автоматический поиск прямых ссылок...');
        const links = await findDirectLinks();
        if (links.length > 0) {
            directLinksContainer.style.display = 'block';
            directLinksList.innerHTML = '';
            
            const sortedLinks = links.sort((a, b) => {
                const priority = { 'bin': 0, 'full': 1, 'zip': 2, 'download': 3, 'default': 4 };
                return (priority[a.type] || 5) - (priority[b.type] || 5);
            });
            
            let linkHtml = '';
            for (let i = 0; i < sortedLinks.length; i++) {
                const link = sortedLinks[i];
                const label = link.type === 'bin' ? '📦 Полная книга' :
                             link.type === 'full' ? '📖 Полная книга (JSON)' :
                             link.type === 'zip' ? '📦 ZIP-архив' :
                             link.type === 'download' ? '⬇️ Скачать' :
                             '🔗 Прямая ссылка';
                
                linkHtml += `
                    <div style="
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        margin-bottom: 6px;
                        background: #ffffff;
                        border-radius: 6px;
                        padding: 6px 10px;
                        border: 1px solid #e8eef4;
                    ">
                        <span style="font-size: 12px; font-weight: 600; min-width: 80px; color: #1a5a9a;">${label}</span>
                        <a href="${link.url}" target="_blank" style="
                            flex: 1;
                            font-size: 11px;
                            color: #1a5a9a;
                            text-decoration: none;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            white-space: nowrap;
                            padding: 4px 8px;
                            background: #f0f7ff;
                            border-radius: 4px;
                        ">${link.url.substring(0, 60)}...</a>
                        <button onclick="navigator.clipboard.writeText('${link.url}')" style="
                            background: #e8eef4;
                            border: none;
                            border-radius: 4px;
                            padding: 4px 8px;
                            cursor: pointer;
                            font-size: 12px;
                            color: #1a2a4a;
                        ">📋</button>
                    </div>
                `;
            }
            directLinksList.innerHTML = linkHtml;
            setStatus(`✅ Найдено ${links.length} прямых ссылок!`);
            addLog(`✅ Найдено ${links.length} прямых ссылок`);
        }
    }, 2000);
    
    console.log(`✅ LitRes Downloader v8.0 загружен!`);
    console.log(`📖 Книга: ${bookTitle} (${totalPages} стр.)`);
    console.log(`🔑 GitHub: ${GITHUB_CONFIG.token ? '✅ настроен' : '❌ не настроен'}`);
})();
