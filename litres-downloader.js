(function fullDownloaderWithRangeInName() {
    console.log('🚀 Запускаем загрузчик с именем файла + диапазон...');
    
    // --- 1. Подключаем JSZip ---
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    document.head.appendChild(script);
    
    let JSZipLoaded = false;
    script.onload = () => {
        JSZipLoaded = true;
        console.log('✅ JSZip загружен!');
    };
    
    // --- 2. Получаем параметры книги ---
    const urlParams = new URLSearchParams(window.location.search);
    const fileId = urlParams.get('file');
    const artId = urlParams.get('art');
    
    if (!fileId || !artId) {
        alert('❌ Не удалось определить ID книги!');
        return;
    }
    
    // --- 3. Функции для работы с сессией ---
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }
    
    let sessionData = {
        sessionId: getCookie('SID') || '6r2aa62j7bd50vfj3yb9ev6kcac54s9f',
        supersid: getCookie('supersid') || '467510eb-3fb3-448e-9b9c-b3e89203d48b'
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
    
    // --- 4. Создаём UI ---
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
            <!-- Шапка -->
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
                        📖 Имя файла + диапазон страниц
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
            
            <!-- Статус чтения -->
            <div style="
                background: #f0f4fa;
                border-radius: 12px;
                padding: 12px 16px;
                margin-bottom: 14px;
                display: flex;
                align-items: center;
                gap: 12px;
                min-height: 60px;
            ">
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
                        📖 Читаем страницу...
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
            
            <!-- Прогресс -->
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
            
            <!-- Кнопки -->
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
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
            
            <!-- Имя файла -->
            <div style="
                background: #f8fafc;
                border-radius: 8px;
                padding: 8px 12px;
                margin-bottom: 8px;
                font-size: 12px;
                color: #4a6a8a;
                text-align: center;
                border: 1px dashed #dce2e8;
            ">
                📄 Имя файла: <span id="file_name_display" style="font-weight: 600; color: #1a5a9a;">...</span>
            </div>
            
            <!-- Статус -->
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
            
            <!-- ZIP информация -->
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
    
    // --- 5. Получаем элементы ---
    const ui = document.getElementById('litres_downloader_ui');
    const closeBtn = document.getElementById('close_ui');
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
    const fileNameDisplay = document.getElementById('file_name_display');
    
    // --- 6. Состояние ---
    let state = {
        isRunning: false,
        isPaused: false,
        isStopped: false,
        downloaded: 0,
        total: 0,
        startPage: 1,
        endPage: 10,
        bookTitle: '',
        errors: 0,
        zip: null,
        isZipping: false,
        currentPageReading: 0,
        fileName: ''
    };
    
    // --- 7. Функции анимации ---
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
    
    function updateReadingProgress(pageNum, total) {
        const percent = total > 0 ? Math.round((pageNum / total) * 100) : 0;
        readingProgressText.textContent = `Прогресс: ${percent}%`;
        pageCounter.textContent = `${pageNum}/${total}`;
    }
    
    function setReadingStatus(text) {
        readingStatus.textContent = text;
    }
    
    function updateFileNameDisplay() {
        if (state.bookTitle && state.startPage && state.endPage) {
            state.fileName = `${state.bookTitle}(${state.startPage}-${state.endPage})`;
            fileNameDisplay.textContent = state.fileName + '.zip';
        } else {
            fileNameDisplay.textContent = '...';
        }
    }
    
    // --- 8. Функции UI ---
    function updateProgress() {
        const percent = state.total > 0 ? Math.round((state.downloaded / state.total) * 100) : 0;
        progressBar.style.width = `${Math.min(percent, 100)}%`;
        progressText.textContent = `📥 Страниц: ${state.downloaded} из ${state.total}`;
        percentText.textContent = `${percent}%`;
        updateReadingProgress(state.downloaded, state.total);
        updateFileNameDisplay();
    }
    
    function setStatus(text, isError = false) {
        statusText.textContent = text;
        statusText.style.color = isError ? '#e74c3c' : '#6a8aaa';
    }
    
    function updateButtons() {
        if (state.isRunning && !state.isPaused) {
            btnStart.disabled = true;
            btnStart.textContent = '▶ Читаем...';
            btnStart.style.background = '#b0c4d8';
            btnStart.style.color = '#8a9aaa';
            btnStart.style.boxShadow = 'none';
            
            btnPause.disabled = false;
            btnPause.textContent = '⏸ Пауза';
            btnPause.style.background = '#f0a500';
            btnPause.style.color = '#ffffff';
            btnPause.style.boxShadow = '0 4px 12px rgba(240, 165, 0, 0.25)';
            
            btnStop.disabled = false;
            btnStop.textContent = '⏹ Стоп';
            btnStop.style.background = '#fce4e4';
            btnStop.style.color = '#e74c3c';
            btnStop.style.borderColor = '#fce4e4';
            btnStop.style.boxShadow = 'none';
        } else if (state.isRunning && state.isPaused) {
            btnStart.disabled = false;
            btnStart.textContent = '▶ Продолжить';
            btnStart.style.background = '#1a3a6a';
            btnStart.style.color = '#ffffff';
            btnStart.style.boxShadow = '0 4px 12px rgba(26, 58, 106, 0.2)';
            
            btnPause.disabled = true;
            btnPause.textContent = '⏸ Пауза';
            btnPause.style.background = '#e8eef4';
            btnPause.style.color = '#8a9aaa';
            btnPause.style.boxShadow = 'none';
            
            btnStop.disabled = false;
            btnStop.textContent = '⏹ Стоп';
            btnStop.style.background = '#fce4e4';
            btnStop.style.color = '#e74c3c';
            btnStop.style.borderColor = '#fce4e4';
            btnStop.style.boxShadow = 'none';
        } else {
            btnStart.disabled = false;
            btnStart.textContent = '▶ Старт';
            btnStart.style.background = '#1a3a6a';
            btnStart.style.color = '#ffffff';
            btnStart.style.boxShadow = '0 4px 12px rgba(26, 58, 106, 0.2)';
            
            btnPause.disabled = true;
            btnPause.textContent = '⏸ Пауза';
            btnPause.style.background = '#e8eef4';
            btnPause.style.color = '#8a9aaa';
            btnPause.style.boxShadow = 'none';
            
            btnStop.disabled = true;
            btnStop.textContent = '⏹ Стоп';
            btnStop.style.background = '#f0f2f4';
            btnStop.style.color = '#b0c0d0';
            btnStop.style.borderColor = '#e0e4e8';
            btnStop.style.boxShadow = 'none';
        }
    }
    
    // --- 9. Реалистичные задержки ---
    function getReadingDelay() {
        const baseDelay = Math.random() * 15000 + 5000;
        if (Math.random() < 0.15) {
            return baseDelay + Math.random() * 30000 + 15000;
        }
        if (Math.random() < 0.2) {
            return baseDelay + Math.random() * 10000;
        }
        if (Math.random() < 0.1) {
            return Math.random() * 3000 + 1500;
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
    
    // --- 10. Скачивание и добавление в ZIP ---
    async function downloadAndAddToZip(pageNum) {
        try {
            const apiPage = pageNum - 1;
            const ext = apiPage === 0 ? 'jpg' : 'gif';
            
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
            
            const linkResp = await fetch(
                `https://api.litres.ru/foundation/api/arts/files/${fileId}/link?page_id=${apiPage}&is_trial=false&resolution=w1900&image_type=${ext}`,
                {
                    method: 'GET',
                    credentials: 'include',
                    headers: getHeaders()
                }
            );
            
            if (linkResp.status === 401) {
                setStatus(`⚠️ Ошибка 401! Обновите сессию.`, true);
                state.errors++;
                return false;
            }
            
            if (!linkResp.ok) {
                setStatus(`⚠️ Ошибка ${linkResp.status}`, true);
                state.errors++;
                return false;
            }
            
            const linkData = await linkResp.json();
            const imageUrl = linkData?.payload?.data?.link || 
                            linkData?.payload?.link || 
                            linkData?.data?.link ||
                            linkData?.link;
            
            if (!imageUrl) {
                setStatus(`⚠️ Нет ссылки для стр. ${pageNum}`, true);
                state.errors++;
                return false;
            }
            
            const imgResp = await fetch(imageUrl, { credentials: 'omit' });
            if (!imgResp.ok) {
                setStatus(`⚠️ Ошибка загрузки стр. ${pageNum}`, true);
                state.errors++;
                return false;
            }
            
            const blob = await imgResp.blob();
            const fileName = `${String(pageNum).padStart(3, '0')}.${ext}`;
            
            if (state.zip) {
                state.zip.file(fileName, blob);
                zipInfo.style.display = 'block';
                zipInfo.textContent = `📦 Добавлена стр. ${pageNum} (${Math.round(blob.size / 1024)} KB)`;
                zipInfo.style.color = '#1a5a9a';
            }
            
            state.downloaded++;
            state.errors = 0;
            updateProgress();
            
            const pauseDelay = getRandomPause();
            if (pauseDelay > 5000) {
                setStatus(`☕ Пауза ${Math.round(pauseDelay/1000)}с...`);
                setReadingStatus(`☕ Отдыхаем...`);
                animateHand('wait');
                await new Promise(resolve => setTimeout(resolve, pauseDelay));
            }
            
            setReadingStatus(`✅ Стр. ${pageNum} прочитана`);
            setStatus(`✅ Стр. ${pageNum} → архив`);
            
            return true;
            
        } catch(e) {
            setStatus(`❌ Ошибка: ${e.message}`, true);
            state.errors++;
            return false;
        }
    }
    
    // --- 11. Сборка и скачивание ZIP с именем + диапазон ---
    async function finalizeZip() {
        if (!state.zip) return;
        
        setStatus('📦 Формируем ZIP-архив...');
        setReadingStatus('📦 Архивируем книгу...');
        zipInfo.textContent = '📦 Архивирование...';
        zipInfo.style.color = '#f0a500';
        
        try {
            const zipBlob = await state.zip.generateAsync({ 
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            });
            
            // Имя файла: Название книги(диапазон).zip
            const fileName = `${state.bookTitle}(${state.startPage}-${state.endPage}).zip`;
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setStatus(`🎉 Скачано: ${fileName} (${state.downloaded} стр.)`);
            setReadingStatus('🎉 Чтение завершено!');
            zipInfo.textContent = `✅ ZIP: ${Math.round(zipBlob.size / 1024 / 1024)} MB`;
            zipInfo.style.color = '#1a5a9a';
            
            // Обновляем отображение имени файла
            state.fileName = fileName;
            updateFileNameDisplay();
            
        } catch(e) {
            setStatus(`❌ Ошибка создания ZIP: ${e.message}`, true);
        }
    }
    
    // --- 12. Основной цикл ---
    async function downloadLoop() {
        if (state.isStopped || state.downloaded >= state.total) {
            if (state.downloaded >= state.total && state.zip) {
                await finalizeZip();
                state.isRunning = false;
                updateButtons();
            }
            return;
        }
        
        if (state.isPaused) {
            setStatus('⏸ На паузе');
            setReadingStatus('⏸ Пауза...');
            return;
        }
        
        const pageNum = state.startPage + state.downloaded;
        if (pageNum > state.endPage) {
            await finalizeZip();
            state.isRunning = false;
            updateButtons();
            return;
        }
        
        const success = await downloadAndAddToZip(pageNum);
        
        if (!success && state.errors >= 3) {
            setStatus(`❌ Слишком много ошибок (${state.errors}). Остановлено.`, true);
            state.isRunning = false;
            updateButtons();
            return;
        }
        
        const shortPause = Math.random() * 1500 + 500;
        state.autoInterval = setTimeout(() => {
            if (!state.isStopped && !state.isPaused && state.isRunning) {
                downloadLoop();
            }
        }, shortPause);
    }
    
    // --- 13. Запуск ---
    async function startDownload() {
        if (state.isRunning && state.isPaused) {
            state.isPaused = false;
            setStatus('▶ Продолжаем чтение...');
            setReadingStatus('▶ Продолжаем...');
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
        
        state.bookTitle = urlParams.get('title') || document.title || 'book';
        state.bookTitle = state.bookTitle.replace(/[^a-zA-Zа-яА-Я0-9 ]/g, '').trim().slice(0, 50) || 'book';
        
        let totalPages = 570;
        const pagerMax = document.getElementById('pager-max');
        if (pagerMax) {
            totalPages = parseInt(pagerMax.innerText) || 570;
        }
        
        const start = parseInt(prompt(`📖 Книга: "${state.bookTitle}"\nВсего: ${totalPages} стр.\n\nС какой страницы начать чтение?`, '1')) || 1;
        if (start < 1) { setStatus('❌ Неверный номер!', true); return; }
        
        const end = parseInt(prompt(`📖 Книга: "${state.bookTitle}"\nВсего: ${totalPages} стр.\nНачинаем с: ${start}\n\nПо какую страницу читать?`, `${Math.min(start + 9, totalPages)}`)) || Math.min(start + 9, totalPages);
        if (end < start) { setStatus('❌ Конечная страница меньше начальной!', true); return; }
        if (end > totalPages) { setStatus(`⚠️ Максимум ${totalPages} страниц.`, true); return; }
        
        state.startPage = start;
        state.endPage = end;
        state.total = end - start + 1;
        state.downloaded = 0;
        state.errors = 0;
        state.isRunning = true;
        state.isPaused = false;
        state.isStopped = false;
        state.zip = new JSZip();
        
        // Обновляем имя файла
        state.fileName = `${state.bookTitle}(${start}-${end})`;
        updateFileNameDisplay();
        
        zipInfo.style.display = 'block';
        zipInfo.textContent = `📦 Архив: ${state.fileName}.zip (${state.total} стр.)`;
        zipInfo.style.color = '#1a5a9a';
        
        updateProgress();
        setStatus(`🚀 Начинаем чтение ${start}-${end}...`);
        setReadingStatus('📖 Открываем книгу...');
        animateHand('hover');
        updateButtons();
        
        setTimeout(downloadLoop, 2000);
    }
    
    // --- 14. Управление ---
    function stopDownload() {
        state.isStopped = true;
        state.isRunning = false;
        state.isPaused = false;
        if (state.autoInterval) {
            clearTimeout(state.autoInterval);
            state.autoInterval = null;
        }
        setStatus(`⏹ Остановлено. Прочитано: ${state.downloaded} стр.`);
        setReadingStatus('⏹ Чтение прервано');
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
        }
    }
    
    // --- 15. Обработчики ---
    btnStart.addEventListener('click', startDownload);
    btnPause.addEventListener('click', pauseDownload);
    btnStop.addEventListener('click', stopDownload);
    closeBtn.addEventListener('click', () => {
        if (state.isRunning && !confirm('Чтение ещё идёт. Закрыть?')) return;
        stopDownload();
        ui.style.display = 'none';
    });
    
    // --- 16. Экспорт ---
    window.downloaderUI = {
        start: startDownload,
        pause: pauseDownload,
        stop: stopDownload,
        state: state,
        updateSession: (sid, ssid) => {
            if (sid) sessionData.sessionId = sid;
            if (ssid) sessionData.supersid = ssid;
            setStatus('✅ Сессия обновлена');
        }
    };
    
    updateButtons();
    setStatus('📖 Готов к чтению. Нажмите "Старт"');
    setReadingStatus('📚 Выберите диапазон страниц');
    updateFileNameDisplay();
    console.log('✅ UI с именем файла + диапазон создан!');
})();
