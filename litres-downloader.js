/**
 * LitRes Downloader v20.1
 * API + Прямой ZIP-поиск + Автоупаковка инструментов
 * (c) 2026 Diminssoft
 */

(function fullDownloaderV20() {
    console.log('🚀 LitRes Downloader v20.1 — API + ZIP + Инструменты!');

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
    // 3. JSZip
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
    // 4. ПАРАМЕТРЫ
    // ============================================================
    const urlParams = new URLSearchParams(window.location.search);
    const fileId = urlParams.get('file');
    const artId = urlParams.get('art');

    if (!fileId || !artId) {
        alert('❌ Не удалось определить ID книги!');
        return;
    }

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
            console.log('🔍 Запрашиваем информацию о книге через API...');
            const resp = await fetch(
                `https://api.litres.ru/foundation/api/arts/${artId}`,
                {
                    method: 'GET',
                    credentials: 'include',
                    headers: getHeaders()
                }
            );

            if (!resp.ok) {
                console.warn(`⚠️ API вернул ${resp.status}`);
                return false;
            }

            const data = await resp.json();
            const payload = data?.payload?.data;

            if (!payload) {
                console.warn('⚠️ Нет данных в ответе API');
                return false;
            }

            let pages = 0;
            let symbols = payload.symbols_count || 0;

            if (payload.files && payload.files.length > 0) {
                const mainFile = payload.files.find(f => !f.is_additional);
                if (mainFile && mainFile.pages) {
                    pages = mainFile.pages;
                }
            }

            if (!pages && payload.additional_info?.current_pages_or_seconds) {
                pages = payload.additional_info.current_pages_or_seconds;
            }

            if (!pages && symbols > 0) {
                pages = Math.round(symbols / 2800);
            }

            if (!pages && payload.release_file_id) {
                try {
                    const fileResp = await fetch(
                        `https://api.litres.ru/foundation/api/arts/files/${payload.release_file_id}/info`,
                        {
                            method: 'GET',
                            credentials: 'include',
                            headers: getHeaders()
                        }
                    );
                    if (fileResp.ok) {
                        const fileData = await fileResp.json();
                        if (fileData?.payload?.data?.pages) {
                            pages = fileData.payload.data.pages;
                        }
                    }
                } catch(e) {}
            }

            if (!pages) {
                pages = symbols > 0 ? Math.round(symbols / 2800) : 0;
            }

            let author = 'Неизвестный автор';
            if (payload.persons && payload.persons.length > 0) {
                const authorPerson = payload.persons.find(p => p.role === 'author');
                if (authorPerson) {
                    author = authorPerson.full_name || author;
                } else {
                    author = payload.persons[0].full_name || author;
                }
            }

            bookInfo.title = payload.title || 'Неизвестная книга';
            bookInfo.author = author;
            bookInfo.pages = pages;
            bookInfo.symbols = symbols;
            bookInfo.fileId = payload.release_file_id || fileId;
            bookInfo.artId = payload.id || artId;
            bookInfo.source = 'API LitRes';

            console.log(`✅ Книга: "${bookInfo.title}"`);
            console.log(`✍️ Автор: ${bookInfo.author}`);
            console.log(`📄 Страниц: ${bookInfo.pages}`);
            console.log(`📝 Символов: ${bookInfo.symbols}`);

            return true;

        } catch(e) {
            console.error('❌ Ошибка получения информации:', e);
            return false;
        }
    }

    // ============================================================
    // 7. ПОИСК ПРЯМОЙ ZIP-ССЫЛКИ (БЕЗ toc.js!)
    // ============================================================
    async function findZipLink() {
        const endpoints = [
            `https://api.litres.ru/foundation/api/arts/files/${fileId}/link?is_trial=false`,
            `https://api.litres.ru/foundation/api/arts/files/${fileId}/link?resource=bin&is_trial=false`,
            `https://api.litres.ru/foundation/api/arts/files/${fileId}/link?resource=zip&is_trial=false`
        ];

        for (const url of endpoints) {
            try {
                console.log(`  ⏳ Пробуем: ${url.split('?')[1]}`);
                const resp = await fetch(url, {
                    method: 'GET',
                    credentials: 'include',
                    headers: getHeaders()
                });
                if (!resp.ok) continue;
                const data = await resp.json();
                const link = data?.payload?.data?.link || data?.payload?.link || data?.data?.link || data?.link;
                if (link && (link.includes('.bin') || link.includes('application/zip'))) {
                    console.log(`✅ ZIP-ссылка: ${link.substring(0, 80)}...`);
                    return link;
                }
            } catch(e) {}
        }
        return null;
    }

    // ============================================================
    // 8. ЗАГРУЗКА ИНСТРУМЕНТОВ
    // ============================================================
    let toolsBlob = null;

    async function downloadTools() {
        if (toolsBlob) {
            console.log('✅ Инструменты в кэше');
            return toolsBlob;
        }

        console.log('📥 Скачиваем x64.rar...');
        try {
            const resp = await fetch(TOOLS_URL, { credentials: 'omit' });
            if (!resp.ok) {
                console.warn(`⚠️ Не удалось скачать: ${resp.status}`);
                return null;
            }
            toolsBlob = await resp.blob();
            console.log(`✅ Инструменты: ${(toolsBlob.size / 1024 / 1024).toFixed(2)} MB`);
            return toolsBlob;
        } catch(e) {
            console.warn('⚠️ Ошибка загрузки:', e.message);
            return null;
        }
    }

    // ============================================================
    // 9. UI
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
            min-width: 380px;
            max-width: 440px;
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
                        📦 v20.1 — API + ZIP + Инструменты!
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
                    📖 <span id="preview_book_title">${bookInfo.title}</span>
                </div>
                <div style="font-size: 12px; color: #4a6a8a;">
                    ✍️ <span id="preview_book_author">${bookInfo.author}</span>
                </div>
                <div style="font-size: 12px; color: #4a6a8a; margin-top: 4px;">
                    📄 Страниц: <span id="preview_total_pages">${bookInfo.pages || 'определяется...'}</span>
                </div>
                <div style="font-size: 12px; color: #4a6a8a; margin-top: 4px;">
                    ☁️ GitHub: <span id="github_status" style="color: #1a5a9a;">не настроен</span>
                </div>
                <div style="font-size: 10px; color: #8a9aaa; margin-top: 4px; border-top: 1px solid #e8eef4; padding-top: 4px;">
                    📡 Источник: <span id="book_source">${bookInfo.source}</span>
                </div>
                <div style="font-size: 11px; color: #27ae60; margin-top: 6px; padding-top: 6px; border-top: 1px solid #e8eef4;">
                    📦 Инструменты будут добавлены в архив
                </div>
            </div>

            <div id="direct_links_container" style="
                background: #f8fafc;
                border-radius: 12px;
                padding: 12px 16px;
                margin-bottom: 14px;
                border: 1px solid #e8eef4;
                display: none;
            ">
                <div style="font-weight: 600; font-size: 13px; color: #1a2a4a; margin-bottom: 8px;">
                    📦 Прямая ZIP-ссылка:
                </div>
                <div id="direct_links_list"></div>
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
                    ⏳ Загрузка информации о книге...
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

            <div style="
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 8px 12px;
                background: #f8faff;
                border-radius: 10px;
                border: 1px solid #e8eef4;
                margin-bottom: 12px;
            ">
                <label style="
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 13px;
                    color: #1a2a4a;
                ">
                    <input type="checkbox" id="force_mode" style="
                        width: 18px;
                        height: 18px;
                        accent-color: #e74c3c;
                        cursor: pointer;
                    ">
                    ⚡ FORCE-режим
                    <span style="
                        font-size: 10px;
                        color: #8a9aaa;
                        font-weight: 400;
                    ">(без пауз)</span>
                </label>
                <div id="force_status" style="
                    margin-left: auto;
                    font-size: 11px;
                    color: #8a9aaa;
                    background: #e8eef4;
                    padding: 2px 10px;
                    border-radius: 12px;
                ">
                    ⏸ выкл
                </div>
            </div>

            <div id="status_text" style="
                font-size: 12px;
                color: #6a8aaa;
                text-align: center;
                padding: 8px 0 4px;
                border-top: 1px solid #e8eef4;
                min-height: 22px;
            ">
                ⏳ Загрузка информации о книге...
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
    // 10. ЭЛЕМЕНТЫ
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
    const previewBookTitle = document.getElementById('preview_book_title');
    const previewBookAuthor = document.getElementById('preview_book_author');
    const bookSource = document.getElementById('book_source');
    const directLinksContainer = document.getElementById('direct_links_container');
    const directLinksList = document.getElementById('direct_links_list');
    const forceMode = document.getElementById('force_mode');
    const forceStatus = document.getElementById('force_status');

    // ============================================================
    // 11. СОСТОЯНИЕ
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
        directLink: null
    };

    // ============================================================
    // 12. ОБНОВЛЕНИЕ ЗАГОЛОВКА ВКЛАДКИ
    // ============================================================
    function updateTabTitle() {
        try {
            const percent = state.total > 0 ? Math.round((state.downloaded / state.total) * 100) : 0;
            const shortTitle = state.bookTitle.length > 25 ? state.bookTitle.substring(0, 25) + '...' : state.bookTitle;
            
            if (state.isRunning && state.downloaded > 0) {
                document.title = `[${percent}%] ${shortTitle}`;
            } else if (state.isRunning && state.downloaded === 0) {
                document.title = `⏳ ${shortTitle}`;
            } else if (state.downloaded === state.total && state.total > 0) {
                document.title = `✅ ${shortTitle}`;
            } else {
                document.title = shortTitle;
            }
        } catch(e) {}
    }

    // ============================================================
    // 13. UI-ФУНКЦИИ
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

    function getReadingDelay() {
        if (state.forceMode) {
            return Math.random() * 300 + 200;
        }
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
        if (state.forceMode) {
            return Math.random() * 200 + 100;
        }
        if (Math.random() < 0.2) {
            return Math.random() * 10000 + 5000;
        }
        if (Math.random() < 0.1) {
            return Math.random() * 30000 + 15000;
        }
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
    // 14. ПРОГРЕСС В GITHUB
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
    // 15. ПОКАЗ ПРЯМОЙ ССЫЛКИ
    // ============================================================
    function showDirectLink(url) {
        directLinksContainer.style.display = 'block';
        directLinksList.innerHTML = `
            <div style="
                display: flex;
                align-items: center;
                gap: 8px;
                background: #ffffff;
                border-radius: 6px;
                padding: 6px 10px;
                border: 1px solid #e8eef4;
            ">
                <span style="font-size: 12px; font-weight: 600; min-width: 80px; color: #1a5a9a;">📦 ZIP</span>
                <a href="${url}" target="_blank" style="
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
                ">${url.substring(0, 60)}...</a>
                <button onclick="navigator.clipboard.writeText('${url}')" style="
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
        setStatus(`✅ Найдена прямая ZIP-ссылка! Нажмите для скачивания.`);
        addLog(`✅ Найдена прямая ZIP-ссылка`);
    }

    // ============================================================
    // 16. АВТООПРЕДЕЛЕНИЕ ФОРМАТА (JPG/GIF) с HEAD-проверкой
    // ============================================================
    async function getImageUrl(pageNum) {
        const apiPage = pageNum - 1;
        
        for (const ext of ['gif', 'jpg']) {
            try {
                const resp = await fetch(
                    `https://api.litres.ru/foundation/api/arts/files/${state.fileId}/link?page_id=${apiPage}&is_trial=false&resolution=w1900&image_type=${ext}`,
                    {
                        method: 'GET',
                        credentials: 'include',
                        headers: getHeaders()
                    }
                );
                
                if (!resp.ok) continue;
                
                const data = await resp.json();
                const url = data?.payload?.data?.link || 
                           data?.payload?.link || 
                           data?.data?.link ||
                           data?.link;
                
                if (!url) continue;
                
                try {
                    const check = await fetch(url, { 
                        method: 'HEAD', 
                        credentials: 'omit'
                    });
                    
                    if (check.ok) {
                        return { url, ext };
                    }
                } catch(e) {}
            } catch(e) {}
        }
        return null;
    }

    // ============================================================
    // 17. СКАЧИВАНИЕ СТРАНИЦЫ В ZIP
    // ============================================================
    async function downloadPageToZip(pageNum) {
        const result = await getImageUrl(pageNum);
        if (!result) {
            return { success: false, error: 'Нет доступного формата' };
        }

        const { url, ext } = result;

        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            const timeout = setTimeout(() => {
                console.warn(`⚠️ Таймаут стр. ${pageNum}`);
                resolve({ success: false, error: 'Таймаут' });
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
                            const fileName = `page_${String(pageNum).padStart(3, '0')}.${ext}`;
                            if (state.zip) {
                                state.zip.file(fileName, blob);
                            }
                            console.log(`✅ Стр. ${pageNum} → ZIP (${Math.round(blob.size / 1024)} KB)`);
                            resolve({ success: true, size: blob.size });
                        } else {
                            resolve({ success: false, error: 'Не удалось конвертировать' });
                        }
                    }, 'image/jpeg', 0.95);
                } catch(e) {
                    resolve({ success: false, error: e.message });
                }
            };
            
            img.onerror = function() {
                clearTimeout(timeout);
                resolve({ success: false, error: 'Ошибка загрузки изображения' });
            };
            
            img.src = url;
        });
    }

    // ============================================================
    // 18. ОСНОВНОЙ ЦИКЛ
    // ============================================================
    function isBookFinished() {
        if (state.consecutiveErrors >= 20) {
            addLog(`📌 ${state.consecutiveErrors} ошибок подряд. Останавливаем.`, true);
            return true;
        }
        if (state.downloaded >= state.total) {
            return true;
        }
        if (state.errors >= 50) {
            addLog(`📌 Слишком много ошибок (${state.errors}). Останавливаем.`, true);
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

        // ============================================================
        // 🔥 ВСЕГДА ДОБАВЛЯЕМ ИНСТРУМЕНТЫ
        // ============================================================
        addLog('📥 Скачиваем инструменты конвертера...');
        const toolsData = await downloadTools();

        if (toolsData) {
            state.zip.file(TOOLS_PATH, toolsData);
            addLog(`✅ Добавлено: ${TOOLS_PATH} (${(toolsData.size / 1024 / 1024).toFixed(2)} MB)`);
        } else {
            addLog('⚠️ Не удалось загрузить инструменты', true);
        }

        // README-инструкция
        const readme = `========================================
  LitRes PDF Converter — Инструкция
========================================

ЧТО В АРХИВЕ:
- tools/x64.rar — инструменты для конвертации
- page_XXX.jpg  — страницы книги

КАК ПОЛЬЗОВАТЬСЯ:
1. Распакуй tools/x64.rar в отдельную папку.
2. Внутри найди run_auto.bat и запусти его.
3. Положи ZIP с картинками (этот архив) в папку IN.
4. PDF появится в папке OUT.

ТРЕБОВАНИЯ:
- Windows 7/10/11
- PowerShell 3.0+
- Ничего устанавливать не нужно!

© 2026 Diminssoft
`;
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

            if (state.failedPages.length > 0) {
                addLog(`⚠️ Пропущенные страницы: ${state.failedPages.join(', ')}`, true);
            }

            await saveProgress();
            state.isRunning = false;
            updateButtons();
            updateTabTitle();

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
        if (!state.forceMode) {
            const minutes = Math.floor(readDelay / 60000);
            const seconds = Math.floor((readDelay % 60000) / 1000);
            const timeStr = minutes > 0 ? `${minutes}м ${seconds}с` : `${seconds}с`;
            setStatus(`📖 Читаем стр. ${pageNum} (${timeStr})`);
        } else {
            setStatus(`⚡ FORCE: стр. ${pageNum}...`);
        }
        await new Promise(resolve => setTimeout(resolve, readDelay));

        setReadingStatus(`🔄 Перелистываем стр. ${pageNum}...`);
        animateHand('turn');
        await new Promise(resolve => setTimeout(resolve, 800));

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
            addLog(`✅ Стр. ${pageNum} добавлена в ZIP (${Math.round(result.size / 1024)} KB)`);
        }

        if (state.downloaded % 5 === 0 && state.downloaded > 0) {
            await saveProgress();
        }

        const pauseDelay = getRandomPause();
        if (pauseDelay > 500 && !state.forceMode) {
            setStatus(`☕ Пауза ${Math.round(pauseDelay/1000)}с...`);
            setReadingStatus(`☕ Отдыхаем...`);
            animateHand('wait');
            await new Promise(resolve => setTimeout(resolve, pauseDelay));
        } else if (state.forceMode && pauseDelay > 100) {
            await new Promise(resolve => setTimeout(resolve, pauseDelay));
        }

        const delay = state.forceMode ? Math.random() * 200 + 100 : Math.random() * 1500 + 500;
        state.autoInterval = setTimeout(() => {
            if (!state.isStopped && !state.isPaused && state.isRunning) {
                downloadLoop();
            }
        }, delay);
    }

    // ============================================================
    // 19. ЗАПУСК
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

        if (state.directLink) {
            const useDirect = confirm(
                `📚 Найдена прямая ZIP-ссылка!\n\n` +
                `📖 ${state.bookTitle}\n` +
                `📦 Формат: ZIP-архив\n\n` +
                `✅ "OK" — открыть ссылку для скачивания\n` +
                `❌ "Отмена" — постраничная загрузка`
            );
            
            if (useDirect) {
                window.open(state.directLink, '_blank');
                setStatus(`✅ Ссылка открыта!`);
                addLog(`📎 Открыта ссылка`);
                
                const copyChoice = confirm(`📋 Скопировать ссылку в буфер обмена?`);
                if (copyChoice) {
                    try {
                        await navigator.clipboard.writeText(state.directLink);
                        setStatus('✅ Ссылка скопирована!');
                    } catch(e) {
                        prompt('📋 Скопируйте вручную:', state.directLink);
                    }
                }
                
                state.isRunning = false;
                updateButtons();
                return;
            }
        }

        let totalPages = state.totalPages;
        if (!totalPages || totalPages < 1) {
            const userInput = prompt(
                `📖 Не удалось определить количество страниц для "${state.bookTitle}"\n\n` +
                `Введите ОБЩЕЕ КОЛИЧЕСТВО СТРАНИЦ:`,
                '100'
            );
            if (userInput === null) {
                setStatus('❌ Операция отменена', true);
                return;
            }
            totalPages = parseInt(userInput) || 100;
            state.totalPages = totalPages;
            previewTotalPages.textContent = totalPages;
        }

        const startPage = parseInt(prompt(
            `📖 Книга: "${state.bookTitle}"\n` +
            `✍️ Автор: ${state.bookAuthor}\n` +
            `📄 Всего страниц: ${totalPages}\n\n` +
            `С какой страницы начать? (1-${totalPages})`,
            '1'
        )) || 1;

        if (startPage < 1 || startPage > totalPages) {
            setStatus(`❌ Страница должна быть от 1 до ${totalPages}`, true);
            return;
        }

        const pagesCount = parseInt(prompt(
            `📖 Книга: "${state.bookTitle}"\n` +
            `✍️ Автор: ${state.bookAuthor}\n` +
            `📄 Всего страниц: ${totalPages}\n` +
            `Начинаем с: ${startPage}\n\n` +
            `СКОЛЬКО страниц скачать?`,
            '10'
        )) || 10;

        const endPage = Math.min(startPage + pagesCount - 1, totalPages);

        if (pagesCount < 1) {
            setStatus('❌ Количество страниц должно быть больше 0', true);
            return;
        }

        addLog(`📥 Скачиваем ${pagesCount} страниц (${startPage}-${endPage})`);

        state.startPage = startPage;
        state.endPage = endPage;
        state.total = pagesCount;
        state.downloaded = 0;
        state.errors = 0;
        state.consecutiveErrors = 0;
        state.failedPages = [];
        state.isRunning = true;
        state.isPaused = false;
        state.isStopped = false;
        state.zip = new JSZip();

        updateProgress();
        setStatus(`🚀 Загружаем ${startPage}-${endPage} (${pagesCount} стр.)...`);
        setReadingStatus('📖 Открываем книгу...');
        animateHand('hover');
        updateButtons();
        addLog(`🚀 Запуск: ${startPage}-${endPage} (${pagesCount} стр.)`);

        setTimeout(downloadLoop, 1500);
    }

    // ============================================================
    // 20. УПРАВЛЕНИЕ
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
        updateTabTitle();
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
    // 21. ОБРАБОТЧИКИ
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

    forceMode.addEventListener('change', function() {
        state.forceMode = this.checked;
        forceStatus.textContent = this.checked ? '⚡ вкл' : '⏸ выкл';
        forceStatus.style.background = this.checked ? '#fce4e4' : '#e8eef4';
        forceStatus.style.color = this.checked ? '#e74c3c' : '#8a9aaa';
        addLog(this.checked ? '⚡ FORCE-режим ВКЛЮЧЁН' : '⏸ FORCE-режим ВЫКЛЮЧЁН');
    });

    // ============================================================
    // 22. ЭКСПОРТ
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
        },
        toggleForce: (enabled) => {
            state.forceMode = enabled;
            forceMode.checked = enabled;
            forceStatus.textContent = enabled ? '⚡ вкл' : '⏸ выкл';
            forceStatus.style.background = enabled ? '#fce4e4' : '#e8eef4';
            forceStatus.style.color = enabled ? '#e74c3c' : '#8a9aaa';
            addLog(enabled ? '⚡ FORCE-режим ВКЛЮЧЁН' : '⏸ FORCE-режим ВЫКЛЮЧЁН');
        },
        findZipLink: findZipLink,
        fetchBookInfo: fetchBookInfo
    };

    // ============================================================
    // 23. ИНИЦИАЛИЗАЦИЯ
    // ============================================================
    async function init() {
        setStatus('⏳ Загрузка информации о книге...');
        addLog('🔍 Получаем данные о книге через API...');
        
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
            
            setStatus(`✅ Книга: "${bookInfo.title}" (${bookInfo.pages} стр.)`);
            addLog(`✅ Книга: "${bookInfo.title}"`);
            addLog(`✍️ Автор: ${bookInfo.author}`);
            addLog(`📄 Страниц: ${bookInfo.pages}`);
            if (bookInfo.symbols > 0) {
                addLog(`📝 Символов: ${bookInfo.symbols}`);
            }
        } else {
            let titleFromUrl = urlParams.get('title') || document.title || 'Неизвестная книга';
            titleFromUrl = titleFromUrl.replace(/[^a-zA-Zа-яА-Я0-9 ]/g, '').trim().slice(0, 50) || 'Неизвестная книга';
            
            previewBookTitle.textContent = titleFromUrl;
            state.bookTitle = titleFromUrl;
            bookSource.textContent = 'Из URL/страницы';
            
            let totalFromUrl = 0;
            const pagerMax = document.getElementById('pager-max');
            if (pagerMax) {
                totalFromUrl = parseInt(pagerMax.innerText) || 0;
            }
            if (!totalFromUrl) {
                const totalParam = urlParams.get('total');
                if (totalParam) {
                    totalFromUrl = parseInt(totalParam) || 0;
                }
            }
            if (!totalFromUrl) {
                for (let key in window) {
                    try {
                        const obj = window[key];
                        if (obj && typeof obj === 'object' && obj.pageData && obj.pageData.pages) {
                            totalFromUrl = obj.pageData.pages.length;
                            break;
                        }
                    } catch(e) {}
                }
            }
            
            if (totalFromUrl > 0) {
                state.totalPages = totalFromUrl;
                previewTotalPages.textContent = totalFromUrl;
                setStatus(`📖 Книга: "${titleFromUrl}" (${totalFromUrl} стр.)`);
            } else {
                previewTotalPages.textContent = '❌ не определено';
                setStatus('⚠️ Не удалось определить количество страниц', true);
            }
        }
        
        updateButtons();
        updateTabTitle();
        
        if (GITHUB_CONFIG.token) {
            githubStatus.textContent = '✅ готов';
            checkForSavedProgress();
        } else {
            githubStatus.textContent = '⚠️ нажмите GitHub';
        }
        
        // Запускаем поиск ZIP-ссылки
        setTimeout(async () => {
            addLog('🔍 Поиск прямой ZIP-ссылки...');
            const zipLink = await findZipLink();
            if (zipLink) {
                state.directLink = zipLink;
                showDirectLink(zipLink);
                addLog(`✅ Найдена прямая ZIP-ссылка!`);
            } else {
                addLog('ℹ️ Прямая ZIP-ссылка не найдена');
            }
        }, 2000);
        
        console.log(`✅ LitRes Downloader v20.1 загружен!`);
        console.log(`📖 Книга: ${state.bookTitle} (${state.totalPages} стр.)`);
        console.log(`✍️ Автор: ${state.bookAuthor}`);
        console.log(`📦 Инструменты: будут добавлены в архив`);
        console.log(`🔍 Поиск ZIP-ссылки: запущен (без toc.js)`);
    }

    init();

})();
