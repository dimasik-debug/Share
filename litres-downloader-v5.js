/**
 * LitRes Downloader v5.0
 * С сохранением прогресса на GitHub + полный фикс UI
 * (c) 2026 Diminssoft
 */

(function fullDownloaderV5() {
    console.log('🚀 LitRes Downloader v5.0 — С сохранением на GitHub');

    // ============================================================
    // 1. НАСТРОЙКИ GITHUB
    // ============================================================
    const GITHUB_CONFIG = {
        repo: 'dimasik-debug/Share',
        path: 'books/progress/',
        token: localStorage.getItem('github_token') || ''
    };

    // ============================================================
    // 2. РАБОТА С GITHUB API
    // ============================================================
    
    function askForGitHubToken() {
        const token = prompt(
            '🔑 Введите GitHub Personal Access Token:\n\n' +
            'Как получить:\n' +
            '1. GitHub → Settings → Developer settings\n' +
            '2. Personal access tokens → Tokens (classic)\n' +
            '3. Generate new token → repo (полный доступ)\n' +
            '4. Скопируйте токен\n\n' +
            'Токен будет сохранён локально в браузере.',
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
        if (!GITHUB_CONFIG.token) {
            console.warn('⚠️ Нет GitHub токена, прогресс не сохранён');
            return false;
        }

        const path = `${GITHUB_CONFIG.path}${bookId}.json`;
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
        
        try {
            let sha = '';
            try {
                const resp = await fetch(
                    `https://api.github.com/repos/${GITHUB_CONFIG.repo}/contents/${path}`,
                    { headers: { 'Authorization': `token ${GITHUB_CONFIG.token}` } }
                );
                if (resp.ok) {
                    const file = await resp.json();
                    sha = file.sha;
                }
            } catch(e) {}

            const response = await fetch(
                `https://api.github.com/repos/${GITHUB_CONFIG.repo}/contents/${path}`,
                {
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
                }
            );

            if (response.ok) {
                console.log(`✅ Прогресс сохранён: ${path}`);
                return true;
            } else {
                const error = await response.json();
                console.error('❌ Ошибка сохранения:', error);
                return false;
            }
        } catch(e) {
            console.error('❌ Ошибка сохранения:', e);
            return false;
        }
    }

    async function loadProgressFromGitHub(bookId) {
        if (!GITHUB_CONFIG.token) {
            return null;
        }

        const path = `${GITHUB_CONFIG.path}${bookId}.json`;
        
        try {
            const resp = await fetch(
                `https://api.github.com/repos/${GITHUB_CONFIG.repo}/contents/${path}`,
                { headers: { 'Authorization': `token ${GITHUB_CONFIG.token}` } }
            );
            
            if (resp.ok) {
                const file = await resp.json();
                const content = JSON.parse(atob(file.content));
                console.log(`📖 Загружен прогресс для ${content.book_title}`);
                return content;
            }
        } catch(e) {
            console.warn('⚠️ Прогресс не найден:', e);
        }
        return null;
    }

    // ============================================================
    // 3. ОСНОВНАЯ ЛОГИКА СКРИПТА
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
        console.error('❌ Ошибка загрузки JSZip!');
        alert('❌ Не удалось загрузить библиотеку JSZip. Проверьте интернет.');
    };

    const urlParams = new URLSearchParams(window.location.search);
    const fileId = urlParams.get('file');
    const artId = urlParams.get('art');

    if (!fileId || !artId) {
        alert('❌ Не удалось определить ID книги!');
        return;
    }

    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
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
        totalPages = parseInt(userInput) || 570;
    }

    console.log(`📄 Определено страниц: ${totalPages}`);

    let bookTitle = urlParams.get('title') || document.title || 'book';
    bookTitle = bookTitle.replace(/[^a-zA-Zа-яА-Я0-9 ]/g, '').trim().slice(0, 50) || 'book';

    // ============================================================
    // 4. СОЗДАНИЕ UI (ИСПРАВЛЕНО)
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
            min-width: 340px;
            max-width: 400px;
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
                        📖 v5.0 — GitHub синхронизация
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
                    &nbsp;|&nbsp; 📥 Диапазон: <span id="preview_range">...</span>
                </div>
                <div style="font-size: 12px; color: #4a6a8a; margin-top: 4px;">
                    📦 Имя файла: <span id="preview_filename" style="font-weight: 600; color: #1a5a9a;">...</span>
                </div>
                <div style="font-size: 12px; color: #4a6a8a; margin-top: 4px; border-top: 1px solid #e8eef4; padding-top: 4px;">
                    ☁️ GitHub: <span id="github_status" style="color: #1a5a9a;">не настроен</span>
                </div>
            </div>

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
    // 5. ПОЛУЧАЕМ ЭЛЕМЕНТЫ
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
    
    // Элементы для обновления
    const previewBookTitle = document.getElementById('preview_book_title');
    const previewTotalPages = document.getElementById('preview_total_pages');
    const previewRange = document.getElementById('preview_range');
    const previewFilename = document.getElementById('preview_filename');

    // ============================================================
    // 6. СОСТОЯНИЕ
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
        hasSavedPartial: false,
        fileId: fileId,
        artId: artId,
        currentPage: 1,
        progressSaved: false,
        lastSaveTime: 0
    };

    // ============================================================
    // 7. ФУНКЦИИ UI
    // ============================================================

    function addLog(text, isError = false) {
        const time = new Date().toLocaleTimeString();
        const prefix = isError ? '❌' : 'ℹ️';
        logStatus.textContent = `${prefix} [${time}] ${text}`;
        console.log(`[LOG] ${text}`);
        if (isError) {
            logStatus.style.color = '#e74c3c';
        } else {
            logStatus.style.color = '#6a8aaa';
        }
    }

    function showError(text) {
        addLog(text, true);
        statusText.textContent = `❌ ${text}`;
        statusText.style.color = '#e74c3c';
    }

    function setStatus(text, isError = false) {
        statusText.textContent = text;
        statusText.style.color = isError ? '#e74c3c' : '#6a8aaa';
        addLog(text, isError);
    }

    function setReadingStatus(text) {
        readingStatus.textContent = text;
    }

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

    function updateProgress() {
        const percent = state.total > 0 ? Math.round((state.downloaded / state.total) * 100) : 0;
        progressBar.style.width = `${Math.min(percent, 100)}%`;
        progressText.textContent = `📥 Страниц: ${state.downloaded} из ${state.total}`;
        percentText.textContent = `${percent}%`;
        pageCounter.textContent = `${state.downloaded}/${state.total}`;
        readingProgressText.textContent = `Прогресс: ${percent}%`;
        updateFileNameDisplay();
    }

    function updateFileNameDisplay() {
        if (state.bookTitle && state.startPage && state.endPage) {
            const fileName = `${state.bookTitle}(${state.startPage}-${state.endPage})`;
            if (previewRange) previewRange.textContent = `${state.startPage} - ${state.endPage}`;
            if (previewFilename) previewFilename.textContent = fileName + '.zip';
        }
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
    // 8. РАБОТА С ПРОГРЕССОМ НА GITHUB
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
            state.progressSaved = true;
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
                addLog('⚠️ GitHub токен не указан, прогресс не будет сохраняться', true);
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
    // 9. ОСНОВНАЯ ФУНКЦИЯ СКАЧИВАНИЯ
    // ============================================================

    async function downloadAndAddToZip(pageNum) {
        const apiPage = pageNum - 1;
        const ext = apiPage === 0 ? 'jpg' : 'gif';

        try {
            addLog(`📥 Стр. ${pageNum}...`);
            
            const linkResp = await fetch(
                `https://api.litres.ru/foundation/api/arts/files/${state.fileId}/link?page_id=${apiPage}&is_trial=false&resolution=w1900&image_type=${ext}`,
                {
                    method: 'GET',
                    credentials: 'include',
                    headers: getHeaders()
                }
            );

            if (!linkResp.ok) {
                const errorText = await linkResp.text();
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
                            if (blob) {
                                resolve(blob);
                            } else {
                                reject(new Error('Не удалось конвертировать изображение'));
                            }
                        }, 'image/jpeg', 0.95);
                    } catch(e) {
                        reject(e);
                    }
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
            state.currentPage = pageNum;
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
    // 10. ОСНОВНОЙ ЦИКЛ
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
            showError(`Ошибка создания ZIP: ${e.message}`);
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

        setReadingStatus(`📖 Загрузка стр. ${pageNum}...`);
        animateHand('wait');

        const success = await downloadAndAddToZip(pageNum);

        if (!success) {
            state.failedPages.push(pageNum);
            state.errors++;
            
            if (state.errors >= state.maxErrors) {
                showError(`⚠️ Слишком много ошибок (${state.errors}). Сохраняем частичный архив...`);
                await saveProgress();
                state.isRunning = false;
                updateButtons();
                return;
            }
            
            if (state.consecutiveErrors >= 3) {
                showError(`📌 3 ошибки подряд! Вероятно, книга закончилась. Сохраняем частичный архив...`);
                await saveProgress();
                state.isRunning = false;
                updateButtons();
                return;
            }
        }

        updateProgress();

        const delay = Math.random() * 3000 + 1500;
        state.autoInterval = setTimeout(() => {
            if (!state.isStopped && !state.isPaused && state.isRunning) {
                downloadLoop();
            }
        }, delay);
    }

    // ============================================================
    // 11. ЗАПУСК
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

        // Проверяем сохранённый прогресс
        const hasProgress = await checkForSavedProgress();
        if (hasProgress) return;

        // Проверка сессии
        if (!sessionData.sessionId) {
            showError('⚠️ Не найден session-id. Обновите страницу (F5)!');
            addLog('💡 Нужно обновить страницу (F5) и запустить скрипт заново', true);
            return;
        }

        addLog(`🔑 session-id: ${sessionData.sessionId.substring(0, 10)}...`);

        const start = parseInt(prompt(
            `📖 Книга: "${state.bookTitle}"\n` +
            `📄 Всего страниц: ${state.totalPages}\n\n` +
            `С какой страницы начать? (1-${state.totalPages})`,
            state.startPage
        )) || state.startPage;

        if (start < 1 || start > state.totalPages) {
            showError(`❌ Страница должна быть от 1 до ${state.totalPages}`);
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
            showError(`❌ Диапазон должен быть от ${start} до ${state.totalPages}`);
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
        state.progressSaved = false;
        state.lastSaveTime = 0;

        updateFileNameDisplay();
        updateProgress();
        setStatus(`🚀 Загружаем ${start}-${end}...`);
        setReadingStatus('📖 Начинаем...');
        animateHand('hover');
        updateButtons();
        addLog(`🚀 Запуск: ${start}-${end} (${state.total} стр.)`);

        setTimeout(downloadLoop, 1000);
    }

    // ============================================================
    // 12. УПРАВЛЕНИЕ
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
        setReadingStatus('⏹ Остановлено');
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
            setReadingStatus('⏸ Пауза...');
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
    // 13. ОБРАБОТЧИКИ
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
    // 14. ЭКСПОРТ
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
    // 15. ИНИЦИАЛИЗАЦИЯ
    // ============================================================

    updateButtons();
    setStatus(`📖 Готов (${totalPages} стр.)`);
    setReadingStatus('📚 Настройте GitHub для сохранения');
    updateFileNameDisplay();
    addLog(`📖 "${bookTitle}", ${totalPages} страниц`);
    
    if (GITHUB_CONFIG.token) {
        githubStatus.textContent = '✅ готов';
        checkForSavedProgress();
    } else {
        githubStatus.textContent = '⚠️ нажмите GitHub';
    }
    
    console.log(`✅ LitRes Downloader v5.0 загружен!`);
    console.log(`📖 Книга: ${bookTitle} (${totalPages} стр.)`);
    console.log(`🔑 GitHub: ${GITHUB_CONFIG.token ? '✅ настроен' : '❌ не настроен'}`);
})();
