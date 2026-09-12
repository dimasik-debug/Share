/**
 * LitRes Downloader v45.0
 * 🎨 Тёмный UI (как Suno) · 🧹 Автоочистка · 🎯 ОДНА КНОПКА · 🚀 АВТОСТАРТ
 * 🔊 Звуки как в Suno · 🗕 Minimize · ✅ Баннер · 🔁 Повторить · ✅ Таб
 * 👤 Полный аккаунт · ☁️ GitHub push+pull · 🎬 Рука-анимация · 📦 Tools
 * 🔁 ZIP retry ×5 · ⏱ Таймауты · 🛡 Guard · 🎨 Цветные логи
 * 📦 Всё → ZIP (FB2/EPUB/ZIP как есть, PDF→ZIP, JSON→ZIP/HTML, JPG→ZIP+tools)
 * (c) 2026 Diminssoft
 */

(function fullDownloaderV45() {
    console.log('%c🚀 LitRes Downloader v45.0', 'color:#4a8af4;font-size:16px;font-weight:bold;');
    document.getElementById('litres_downloader_ui')?.remove();
    document.getElementById('litres_mini')?.remove();

    // 🧹 Автоочистка
    (function autoPurge() {
        try {
            ['litres-downloader.js','litres-downloader-v29.js','litres-downloader-v30.js','litres-downloader-v31.js',
             'litres-downloader-v32.js','litres-downloader-v33.js','litres-downloader-v34.js','litres-downloader-v35.js',
             'litres-downloader-v36.js','litres-downloader-v37.js','litres-downloader-v38.js','litres-downloader-v40.js',
             'litres-downloader-v40.7.js','litres-downloader-v42.js','litres-downloader-v43.js','litres-downloader-v44.js'
            ].forEach(function(f) {
                fetch('https://purge.jsdelivr.net/gh/dimasik-debug/Share@main/' + f, { mode: 'no-cors' })
                    .then(function(){ console.log('✅ Purge:', f.split('/').pop()); })
                    .catch(function(){});
            });
        } catch(e) {}
    })();

    // ═══════════════════════════════════════════════════════════
    // 🔊 SOUND (как в Suno)
    // ═══════════════════════════════════════════════════════════
    const Sound = {
        ctx: null, enabled: true, masterGain: null,
        init() {
            if (this.ctx) return;
            try {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
                this.masterGain = this.ctx.createGain();
                this.masterGain.gain.value = 0.35;
                this.masterGain.connect(this.ctx.destination);
            } catch(e) { this.enabled = false; }
        },
        note(f, d = 0.35, v = 0.15, delay = 0, type = 'sine') {
            if (!this.enabled) return;
            this.init(); if (!this.ctx) return;
            try {
                if (this.ctx.state === 'suspended') this.ctx.resume();
                const t = this.ctx.currentTime + delay;
                const o = this.ctx.createOscillator(), g = this.ctx.createGain(), fl = this.ctx.createBiquadFilter();
                fl.type = 'lowpass'; fl.frequency.value = 3500; fl.Q.value = 0.7;
                o.type = type; o.frequency.setValueAtTime(f, t);
                g.gain.setValueAtTime(0, t);
                g.gain.linearRampToValueAtTime(v, t + 0.04);
                g.gain.setValueAtTime(v, t + d * 0.6);
                g.gain.exponentialRampToValueAtTime(0.0001, t + d);
                o.connect(fl); fl.connect(g); g.connect(this.masterGain);
                o.start(t); o.stop(t + d + 0.05);
            } catch(e) {}
        },
        chord(fs, d = 0.5, v = 0.12, type = 'sine') { fs.forEach((f, i) => this.note(f, d + i * 0.05, v * (1 - i * 0.15), i * 0.03, type)); },
        glide(a, b, d = 0.3, v = 0.12) {
            if (!this.enabled) return; this.init(); if (!this.ctx) return;
            try {
                if (this.ctx.state === 'suspended') this.ctx.resume();
                const t = this.ctx.currentTime;
                const o = this.ctx.createOscillator(), g = this.ctx.createGain();
                o.type = 'sine'; o.frequency.setValueAtTime(a, t);
                o.frequency.exponentialRampToValueAtTime(b, t + d);
                g.gain.setValueAtTime(0, t);
                g.gain.linearRampToValueAtTime(v, t + 0.05);
                g.gain.exponentialRampToValueAtTime(0.0001, t + d);
                o.connect(g); g.connect(this.masterGain);
                o.start(t); o.stop(t + d + 0.05);
            } catch(e) {}
        },
        click()      { this.note(587, 0.12, 0.08, 0, 'sine'); },
        start()      { this.chord([349, 440, 523], 0.5, 0.10); },
        pageDone()   { this.note(784, 0.25, 0.10, 0, 'sine'); this.note(988, 0.25, 0.08, 0.06, 'sine'); },
        chapterDone(){ this.note(880, 0.2, 0.09, 0, 'sine'); this.note(1109, 0.25, 0.07, 0.05, 'sine'); },
        trackDone()  { this.note(784, 0.3, 0.12, 0, 'sine'); this.note(988, 0.3, 0.10, 0.08, 'sine'); this.note(1175, 0.4, 0.08, 0.16, 'sine'); },
        complete()   { this.chord([523, 659, 784, 1047], 0.8, 0.10, 'triangle'); this.glide(523, 1047, 0.6, 0.06); },
        error()      { this.note(294, 0.35, 0.09, 0, 'sine'); this.note(247, 0.5, 0.07, 0.15, 'sine'); },
        save()       { this.note(1047, 0.15, 0.06, 0, 'triangle'); },
        stall()      { this.note(220, 0.4, 0.07, 0, 'sawtooth'); this.note(196, 0.5, 0.06, 0.2, 'sawtooth'); },
        zip()        { this.note(1319, 0.12, 0.06, 0, 'triangle'); this.note(1568, 0.18, 0.05, 0.06, 'triangle'); },
        warn()       { this.note(440, 0.2, 0.07, 0, 'triangle'); this.note(349, 0.3, 0.06, 0.1, 'triangle'); }
    };

    // ═══════════════════════════════════════════════════════════
    // 🛡️ ЗАЩИТА ОТ ПОКУПОК
    // ═══════════════════════════════════════════════════════════
    const FORBIDDEN_TEXTS = [
        'купить и скачать','купить и читать','купить за','купить сразу',
        'оформить покупку','оплатить','добавить в корзину','перейти в корзину',
        'купить в подарок','купить сейчас','приобрести','подтвердить покупку','оплатить картой'
    ];
    const PRICE_PATTERN = /(\d[\d\s]*\s*(₽|руб|rub|р\.))/i;

    function isForbiddenClick(el) {
        if (!el || !el.textContent) return false;
        if (el.closest && el.closest('#litres_downloader_ui')) return false;
        if (el.closest && el.closest('#litres_mini')) return false;
        const text = (el.textContent || '').trim().toLowerCase();
        for (const bad of FORBIDDEN_TEXTS) {
            if (text === bad || text.startsWith(bad + ' ') || text.startsWith(bad + '\n')) return true;
        }
        try {
            let parent = el.closest('div, section, article, aside, form, li, main');
            let maxUp = 4;
            while (parent && maxUp > 0) {
                if (parent.id === 'litres_downloader_ui' || parent.id === 'litres_mini') break;
                const pt = (parent.textContent || '').toLowerCase();
                if (PRICE_PATTERN.test(pt) && (pt.includes('купить') || pt.includes('корзин') || pt.includes('оплат'))) {
                    if (el.tagName === 'BUTTON' || el.role === 'button') return true;
                }
                parent = parent.parentElement;
                maxUp--;
            }
        } catch(e) {}
        const testid = (el.getAttribute && el.getAttribute('data-testid')) || '';
        if (testid && /sale|buy|cart|purchase|payment/i.test(testid)) return true;
        return false;
    }

    const _origClick = HTMLElement.prototype.click;
    HTMLElement.prototype.click = function() {
        if (isForbiddenClick(this)) return;
        return _origClick.apply(this, arguments);
    };
    const _origAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
        if (type === 'click' && this instanceof HTMLElement && isForbiddenClick(this)) return;
        return _origAddEventListener.apply(this, arguments);
    };
    document.addEventListener('click', (e) => {
        const target = e.target.closest('button, [role="button"], a');
        if (!target) return;
        if (isForbiddenClick(target)) {
            e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
            return false;
        }
    }, true);
    new MutationObserver((mutations) => {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.nodeType === 1) {
                    const buttons = node.matches?.('button, [role="button"], a') ? [node]
                        : Array.from(node.querySelectorAll?.('button, [role="button"], a') || []);
                    for (const btn of buttons) {
                        if (isForbiddenClick(btn)) {
                            btn.style.pointerEvents = 'none';
                            btn.style.opacity = '0.5';
                        }
                    }
                }
            }
        }
    }).observe(document.body, { childList: true, subtree: true });
    console.log('🛡️ Защита от покупок активна!');

    // ═══════════════════════════════════════════════════════════
    // CONFIG
    // ═══════════════════════════════════════════════════════════
    const TOOLS_URLS = [
        'https://cdn.jsdelivr.net/gh/dimasik-debug/Share@main/x64.rar',
        'https://raw.githubusercontent.com/dimasik-debug/Share/main/x64.rar'
    ];
    const TOOLS_PATH = 'tools/x64.rar';
    const GITHUB_CONFIG = {
        repo: 'dimasik-debug/Share',
        path: 'books/progress/',
        token: localStorage.getItem('github_token') || ''
    };
    const ADD_TOOLS_KEY = 'litres_add_tools';
    const SOUND_KEY = 'litres_sound_enabled';
    const MINI_KEY = 'litres_minimized';
    const AUTOSTART_KEY = 'litres_autostart';
    const addToolsDefault = localStorage.getItem(ADD_TOOLS_KEY) !== 'false';

    // ═══════════════════════════════════════════════════════════
    // ☁️ GITHUB SYNC
    // ═══════════════════════════════════════════════════════════
    function askForGitHubToken() {
        const token = prompt(
            '🔑 GitHub Personal Access Token:\n\n' +
            'Settings → Developer settings → Personal access tokens → Tokens (classic)',
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
        const encoded = new TextEncoder().encode(jsonString);
        let binary = '';
        for (let i = 0; i < encoded.length; i++) binary += String.fromCharCode(encoded[i]);
        const content = btoa(binary);
        try {
            let sha = '';
            try {
                const r = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.repo}/contents/${path}`,
                    { headers: { 'Authorization': `token ${GITHUB_CONFIG.token}` } });
                if (r.ok) sha = (await r.json()).sha;
            } catch(e) {}
            const resp = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.repo}/contents/${path}`, {
                method: 'PUT',
                headers: { 'Authorization': `token ${GITHUB_CONFIG.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: `📚 ${data.book_title}`, content, sha: sha || undefined })
            });
            return resp.ok;
        } catch(e) { return false; }
    }

    async function loadProgressFromGitHub(bookId) {
        if (!GITHUB_CONFIG.token) return null;
        const path = `${GITHUB_CONFIG.path}${bookId}.json`;
        try {
            const r = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.repo}/contents/${path}`,
                { headers: { 'Authorization': `token ${GITHUB_CONFIG.token}` } });
            if (r.ok) {
                const f = await r.json();
                const bin = atob(f.content);
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                return JSON.parse(new TextDecoder('utf-8').decode(bytes));
            }
        } catch(e) {}
        return null;
    }

    // ═══════════════════════════════════════════════════════════
    // 📦 JSZip
    // ═══════════════════════════════════════════════════════════
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    document.head.appendChild(script);
    let JSZipLoaded = false;
    script.onload = () => { JSZipLoaded = true; console.log('✅ JSZip'); };

    // ═══════════════════════════════════════════════════════════
    // URL / Session
    // ═══════════════════════════════════════════════════════════
    const urlParams = new URLSearchParams(window.location.search);
    let fileId = urlParams.get('file');
    let artId = urlParams.get('art');
    let pageType = 'unknown';
    if (fileId && artId) pageType = 'reader';
    else {
        const m = window.location.pathname.match(/-(\d+)\/?$/);
        if (m) { artId = m[1]; fileId = null; pageType = 'book'; }
    }
    if (!artId) { alert('❌ Не нашёл artId'); return; }

    function getCookie(n) {
        const v = `; ${document.cookie}`;
        const p = v.split(`; ${n}=`);
        return p.length === 2 ? p.pop().split(';').shift() : null;
    }
    let sessionData = { sessionId: getCookie('SID') || '', supersid: getCookie('supersid') || '' };
    function updateSession() {
        const s = getCookie('SID'); const ss = getCookie('supersid');
        if (s) sessionData.sessionId = s;
        if (ss) sessionData.supersid = ss;
    }
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

    // ═══════════════════════════════════════════════════════════
    // BOOK INFO / FORMAT DETECT
    // ═══════════════════════════════════════════════════════════
    let bookInfo = {
        title: 'Неизвестная книга', author: 'Неизвестный автор',
        pages: 0, fileId: fileId, artId: artId, source: '', format: null
    };

    function detectFormatFromName(fname) {
        if (!fname) return null;
        let s = String(fname).toLowerCase();
        try { s = decodeURIComponent(s); } catch(e) {}
        if (s.includes('/fb2/') || s.includes('.fb2') || s.includes('fb2.zip')) return { icon: '📚', name: 'FB2' };
        if (s.includes('/epub/') || s.includes('.epub') || s.includes('epub.zip')) return { icon: '📖', name: 'EPUB' };
        if (s.includes('/pdf/') || s.includes('.pdf')) return { icon: '📕', name: 'PDF' };
        if (s.includes('/mobi/') || s.includes('.mobi')) return { icon: '📘', name: 'MOBI' };
        if (s.includes('/txt/') || s.includes('.txt')) return { icon: '📄', name: 'TXT' };
        if (s.includes('.zip')) return { icon: '📦', name: 'ZIP' };
        return null;
    }
    function detectFormatFromMime(mime) {
        if (!mime) return null;
        const m = String(mime).toLowerCase();
        if (m.includes('fb2')) return { icon: '📚', name: 'FB2' };
        if (m.includes('epub')) return { icon: '📖', name: 'EPUB' };
        if (m.includes('pdf')) return { icon: '📕', name: 'PDF' };
        if (m.includes('mobi')) return { icon: '📘', name: 'MOBI' };
        if (m.includes('zip')) return { icon: '📦', name: 'ZIP' };
        return null;
    }

    async function fetchWithTimeout(url, opts = {}, ms = 15000) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), ms);
        try {
            const r = await fetch(url, { ...opts, signal: ctrl.signal });
            clearTimeout(t);
            return r;
        } catch(e) {
            clearTimeout(t);
            if (e.name === 'AbortError') throw new Error(`timeout ${ms}ms`);
            throw e;
        }
    }

    async function fetchBookInfo() {
        try {
            const r = await fetchWithTimeout(`https://api.litres.ru/foundation/api/arts/${artId}`,
                { credentials: 'include', headers: getHeaders() }, 12000);
            if (!r.ok) return false;
            const d = await r.json();
            const p = d?.payload?.data;
            if (!p) return false;

            let pages = 0;
            const symbols = p.symbols_count || 0;
            if (p.files?.length) {
                const main = p.files.find(f => !f.is_additional);
                if (main?.pages) pages = main.pages;
                if (main) {
                    const fmt = detectFormatFromName(main.filename) ||
                                detectFormatFromMime(main.mime) ||
                                detectFormatFromName(main.extension);
                    if (fmt) bookInfo.format = fmt;
                }
            }
            if (!pages && p.additional_info?.current_pages_or_seconds) pages = p.additional_info.current_pages_or_seconds;
            if (!pages && symbols > 0) pages = Math.round(symbols / 2800);

            let author = 'Неизвестный автор';
            if (p.persons?.length) {
                const a = p.persons.find(x => x.role === 'author');
                author = a?.full_name || p.persons[0].full_name || author;
            }
            bookInfo.title = p.title || bookInfo.title;
            bookInfo.author = author;
            bookInfo.pages = pages;
            bookInfo.fileId = p.release_file_id || fileId;
            bookInfo.artId = p.id || artId;
            bookInfo.source = 'API LitRes';
            console.log(`✅ "${bookInfo.title}" (${bookInfo.pages} стр.)`);
            return true;
        } catch(e) { console.error('❌', e); return false; }
    }

    async function fetchUserInfo() {
        try {
            const r = await fetchWithTimeout(`https://api.litres.ru/foundation/api/users/me/detailed`,
                { credentials: 'include', headers: getHeaders() }, 10000);
            if (!r.ok) return null;
            const d = await r.json();
            const p = d?.payload?.data;
            if (!p) return null;
            const sub = p.subscription || {};
            const acc = p.account || {};
            const prof = p.profile || {};
            const loyalty = p.loyalty || {};
            const bi = loyalty.bonuses_info || {};
            return {
                id: p.id, login: p.login,
                email: prof.email || null,
                isEmailConfirmed: prof.is_email_confirmed || false,
                subscription: sub.is_active ? {
                    isTrial: sub.is_trial_period || false,
                    validTill: sub.valid_till,
                    price: sub.price || null,
                    planName: sub.plan_name || null,
                    autoRenew: sub.prolongation_status === 'enabled'
                } : null,
                account: { display: acc.display || 0, real: acc.real || 0, bonus: acc.bonus || 0 },
                loyalty: loyalty.is_loyalty_user ? {
                    cashbackPercent: bi.current_cashback_percent || 0,
                    purchaseForNext: bi.purchase_amount_for_next_level || 0
                } : null
            };
        } catch(e) { return null; }
    }

    async function activatePdfjs() {
        if (!state.fileId) return false;
        try {
            const r = await fetchWithTimeout(
                `https://api.litres.ru/foundation/api/arts/files/${state.fileId}/link?index=1&is_trial=false`,
                { credentials: 'include', headers: getHeaders() }, 10000);
            if (!r.ok) return false;
            const d = await r.json();
            const jsUrl = d?.payload?.data?.link || d?.payload?.link;
            if (!jsUrl) return false;
            const jr = await fetchWithTimeout(jsUrl, { credentials: 'omit' }, 10000);
            if (!jr.ok) return false;
            const text = await jr.text();
            const exts = [...text.matchAll(/ext\s*:\s*['"](\w+)['"]/g)].map(m => m[1]);
            if (exts.length === 0) return false;
            state.pageFormats = exts;
            state.totalPages = exts.length;
            state.drmActivated = true;
            console.log(`✅ PDF: ${exts.length} стр.`);
            return true;
        } catch(e) { return false; }
    }

    function downloadWholeFile(url, filename) {
        if (!filename) {
            const m = url.match(/fname=([^&]+)/);
            filename = m ? decodeURIComponent(m[1]) : 'book.zip';
        }
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 1000);
    }

    // ═══════════════════════════════════════════════════════════
    // 🔁 FIND ZIP LINK С РЕТРАЯМИ
    // ═══════════════════════════════════════════════════════════
    async function findZipLink(maxRetries = 5) {
        const fid = state.fileId || bookInfo.fileId;
        if (!fid) return null;
        const urls = [
            `https://api.litres.ru/foundation/api/arts/files/${fid}/link?is_trial=false`,
            `https://api.litres.ru/foundation/api/arts/files/${fid}/link?resource=bin&is_trial=false`,
            `https://api.litres.ru/foundation/api/arts/files/${fid}/link?resource=zip&is_trial=false`
        ];
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            let got401 = false;
            for (const url of urls) {
                try {
                    const r = await fetchWithTimeout(url, { credentials: 'include', headers: getHeaders() }, 10000);
                    if (r.status === 401 || r.status === 403) { got401 = true; continue; }
                    if (!r.ok) continue;
                    const d = await r.json();
                    const link = d?.payload?.data?.link || d?.payload?.link || d?.data?.link || d?.link;
                    if (link && (link.includes('.bin') || link.includes('application/zip') || link.includes('download_book'))) {
                        const fmt = detectFormatFromName(link);
                        console.log('📦 URL:', link);
                        console.log('🔍 Detect:', fmt);
                        if (fmt && (!bookInfo.format || bookInfo.format.name !== fmt.name)) {
                            bookInfo.format = fmt;
                            updateFormatDisplay();
                            addLog(`Формат: ${fmt.icon} ${fmt.name}`, 'step');
                        }
                        console.log(`✅ ZIP найден (попытка ${attempt})`);
                        return link;
                    }
                } catch(e) {}
            }
            if (attempt < maxRetries) {
                const wait = got401 ? 2000 : 1200;
                addLog(got401 ? `ZIP 401 — ждём (${attempt}/${maxRetries})...` : `ZIP retry ${attempt}/${maxRetries}...`, 'warn');
                await new Promise(res => setTimeout(res, wait));
            }
        }
        addLog(`ZIP не найден за ${maxRetries} попыток`, 'warn');
        return null;
    }

    async function fetchZipBlob(url) {
        try {
            console.log('📥 fetch(omit):', url.substring(0, 100));
            const r = await fetchWithTimeout(url, { credentials: 'omit', mode: 'cors' }, 60000);
            console.log('📥 response:', r.status, r.type);
            if (!r.ok) return null;
            const blob = await r.blob();
            if (blob.size < 100) return null;
            console.log('✅ blob:', (blob.size/1024/1024).toFixed(2), 'MB');
            return blob;
        } catch(e) {
            console.log('⚠️ fetch failed:', e.message);
            return null;
        }
    }

    async function detectContentType(url) {
        try {
            console.log('🔍 detect:', url.substring(0, 80));
            const r = await fetchWithTimeout(url, { credentials: 'include' }, 15000);
            if (!r.ok) return { type: 'error', status: r.status };
            const blob = await r.blob();
            const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
            const headStr = String.fromCharCode(...head);
            console.log('🔍 head:', headStr, 'size:', (blob.size/1024/1024).toFixed(2), 'MB');
            if (headStr === '%PDF-') return { type: 'pdf', blob };
            const text = await blob.text();
            const trimmed = text.trim();
            if (trimmed.startsWith('[')) return { type: 'json', text };
            if (trimmed.startsWith('{')) return { type: 'json-obj', text };
            return { type: 'unknown', text: trimmed.substring(0, 100) };
        } catch(e) {
            return { type: e.message.includes('timeout') ? 'timeout' : 'fetch-error', error: e.message };
        }
    }

    // ═══════════════════════════════════════════════════════════
    // HTML / JSON PARSING
    // ═══════════════════════════════════════════════════════════
    function parseLitFile(text) {
        const clean = text.trim().replace(/;\s*$/, '');
        try { return new Function('return (' + clean + ')')(); }
        catch(e) {
            const s = clean.indexOf('['); const e2 = clean.lastIndexOf(']');
            if (s >= 0 && e2 > s) return new Function('return (' + clean.slice(s, e2 + 1) + ')')();
            throw e;
        }
    }
    function escHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
    }
    function litJsonToHtml(nodes) {
        if (!Array.isArray(nodes)) {
            if (typeof nodes === 'string') return escHtml(nodes);
            if (nodes && typeof nodes === 'object') return litJsonToHtml(nodes.c || []);
            return '';
        }
        return nodes.map(n => {
            if (typeof n === 'string') return escHtml(n);
            if (!n || !n.t) return '';
            const inner = litJsonToHtml(n.c || []);
            switch (n.t) {
                case 'title': return `<h2>${inner}</h2>`;
                case 'subtitle': return `<h3>${inner}</h3>`;
                case 'p': return `<p>${inner}</p>`;
                case 'em': return `<em>${inner}</em>`;
                case 'strong': return `<strong>${inner}</strong>`;
                case 'br': return '<br>';
                default: return inner;
            }
        }).join('');
    }
    async function fetchJsonChapter(num) {
        const fid = state.fileId;
        if (!fid) return null;
        const n = String(num).padStart(3, '0');
        try {
            const r = await fetchWithTimeout(`https://www.litres.ru/download_book_subscr/${state.artId}/${fid}/json/${n}.js`,
                { credentials: 'include' }, 10000);
            if (!r.ok) return null;
            const text = await r.text();
            if (!text || text.length < 10) return null;
            return litJsonToHtml(parseLitFile(text));
        } catch(e) { return null; }
    }

    function buildBookHtml(chapters, meta) {
        const safeTitle = escHtml(meta.title || 'Книга');
        const safeAuthor = escHtml(meta.author || 'Неизвестный автор');
        return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><title>${safeTitle}</title>
<style>
* { box-sizing: border-box; }
body { font-family: Georgia, 'Times New Roman', serif; font-size: 18px; line-height: 1.7; max-width: 720px; margin: 0 auto; padding: 60px 30px; background: #fafafa; color: #222; }
h1.book-title { font-size: 32px; margin: 0 0 10px; color: #1a2a4a; border-bottom: 3px solid #1a5a9a; padding-bottom: 15px; }
h2 { font-size: 24px; margin: 50px 0 20px; color: #1a2a4a; page-break-before: always; }
h2:first-of-type { page-break-before: auto; }
h3 { font-size: 20px; margin: 30px 0 15px; color: #2a4a6a; }
p { margin: 14px 0; text-align: justify; }
em { font-style: italic; } strong { font-weight: bold; }
.meta { color: #6a8aaa; font-size: 14px; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid #ddd; }
.footer { margin-top: 80px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #aab8c4; text-align: center; }
@media print { body { padding: 0; background: #fff; } h2 { page-break-before: always; } }
</style></head><body>
<h1 class="book-title">${safeTitle}</h1>
<div class="meta">✍️ ${safeAuthor}</div>
${chapters.map((h, i) => `<!-- Глава ${String(i).padStart(3,'0')} -->\n${h}`).join('\n')}
<div class="footer">📚 LitRes Downloader v45.0<br>Всего глав: ${chapters.length} • © 2026 Diminssoft</div>
</body></html>`;
    }

    // ═══════════════════════════════════════════════════════════
    // TOOLS
    // ═══════════════════════════════════════════════════════════
    let toolsBlob = null;
    async function downloadTools() {
        if (toolsBlob) return toolsBlob;
        for (const url of TOOLS_URLS) {
            try {
                const r = await fetchWithTimeout(url, { credentials: 'omit', mode: 'cors' }, 30000);
                if (!r.ok) continue;
                toolsBlob = await r.blob();
                return toolsBlob;
            } catch(e) {}
        }
        return null;
    }

    function triggerDownload(blob, filename) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 3000);
    }

    // ═══════════════════════════════════════════════════════════
    // 🎨 UI (тёмная тема как в Suno)
    // ═══════════════════════════════════════════════════════════
    document.body.insertAdjacentHTML('beforeend', `
        <style>
            @keyframes ldl-mini-in{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
            @keyframes ldl-in{from{opacity:0;transform:translateY(20px) scale(.96);}to{opacity:1;transform:translateY(0) scale(1);}}

            #litres_mini{
                animation: ldl-mini-in .3s cubic-bezier(.16,1,.3,1);
                position: fixed; bottom: 16px; right: 16px; z-index: 99999;
                background: #000; border: 1px solid rgba(255,255,255,.08);
                border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,.7);
                display: none; align-items: center; gap: 10px;
                padding: 10px 14px; cursor: pointer;
                transition: all .2s ease;
                font-family: 'Segoe UI', Arial, sans-serif;
            }
            #litres_mini:hover{ box-shadow: 0 16px 48px rgba(74,138,244,.4); transform: translateY(-1px); }

            #litres_downloader_ui{
                animation: ldl-in .35s cubic-bezier(.16,1,.3,1);
                position: fixed; bottom: 16px; right: 16px; z-index: 99999;
                background: #0e0e10; color: #fff;
                font-family: 'Segoe UI', Arial, sans-serif;
                width: 400px; max-width: calc(100vw - 32px);
                border-radius: 20px;
                border: 1px solid rgba(255,255,255,.08);
                box-shadow: 0 24px 80px rgba(0,0,0,.8), 0 0 0 1px rgba(255,255,255,.02) inset;
                overflow: hidden;
                display: flex; flex-direction: column;
                max-height: calc(100vh - 32px);
                user-select: none;
                font-size: 13px;
            }
            #litres_downloader_ui *{ box-sizing: border-box; }
            #litres_downloader_ui ::-webkit-scrollbar{ width: 6px; }
            #litres_downloader_ui ::-webkit-scrollbar-thumb{ background: rgba(255,255,255,.1); border-radius: 3px; }
            #litres_downloader_ui ::-webkit-scrollbar-track{ background: transparent; }

            .ldl-header{
                display: flex; align-items: center; gap: 12px;
                padding: 14px 16px;
                border-bottom: 1px solid rgba(255,255,255,.08);
                flex-shrink: 0;
            }
            .ldl-logo{
                width: 36px; height: 36px; border-radius: 10px;
                background: linear-gradient(135deg, #1a5a9a, #4a8af4);
                display: flex; align-items: center; justify-content: center;
                font-size: 18px;
                box-shadow: 0 4px 16px rgba(74,138,244,.35);
                flex-shrink: 0;
            }
            .ldl-title{ font-weight: 700; font-size: 15px; letter-spacing: -.2px; line-height: 1.15; }
            .ldl-title .accent{ color: #4a8af4; }
            .ldl-subtitle{ font-size: 10px; color: rgba(255,255,255,.4); letter-spacing: .3px; text-transform: uppercase; margin-top: 2px; }

            .ldl-icon-btn{
                width: 30px; height: 30px; padding: 0;
                border-radius: 9px;
                background: rgba(255,255,255,.06);
                color: rgba(255,255,255,.7);
                border: none; cursor: pointer;
                transition: all .2s;
                display: inline-flex; align-items: center; justify-content: center;
                font-size: 13px;
                flex-shrink: 0;
            }
            .ldl-icon-btn:hover{ background: rgba(255,255,255,.12); color: #fff; }

            .ldl-body{
                padding: 12px 16px;
                overflow-y: auto;
                flex: 1;
                display: flex; flex-direction: column; gap: 10px;
            }

            .ldl-card{
                background: rgba(255,255,255,.03);
                border: 1px solid rgba(255,255,255,.06);
                border-radius: 12px;
                padding: 10px 12px;
                font-size: 11px;
                line-height: 1.5;
            }
            .ldl-card.book-card{
                background: linear-gradient(135deg, rgba(74,138,244,.08), rgba(74,138,244,.03));
                border-left: 3px solid #4a8af4;
            }
            .ldl-card-title{ font-weight: 700; font-size: 12px; margin-bottom: 4px; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .ldl-card-row{ color: rgba(255,255,255,.6); font-size: 11px; margin-top: 2px; }
            .ldl-card-row .hl{ color: #4a8af4; font-weight: 600; }
            .ldl-card-label{ font-size: 10px; color: rgba(255,255,255,.4); text-transform: uppercase; letter-spacing: .4px; font-weight: 700; margin-bottom: 6px; }

            .ldl-progress-box{
                background: rgba(255,255,255,.03);
                border: 1px solid rgba(255,255,255,.06);
                border-radius: 12px;
                padding: 12px;
            }
            .ldl-status-row{ display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
            .ldl-hand{
                font-size: 22px; width: 32px; text-align: center;
                transition: transform .8s cubic-bezier(.34,1.56,.64,1);
                flex-shrink: 0;
            }
            .ldl-status-text{ flex: 1; min-width: 0; }
            .ldl-status-main{
                font-weight: 600; font-size: 12px; color: #fff;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            }
            .ldl-status-phase{ font-size: 10px; color: rgba(255,255,255,.4); font-family: 'SF Mono', Consolas, monospace; margin-top: 1px; }
            .ldl-counter{
                font-size: 15px; font-weight: 700; color: #4a8af4;
                font-family: 'SF Mono', Consolas, monospace;
                flex-shrink: 0;
            }

            .ldl-bar{
                width: 100%; height: 6px;
                background: rgba(255,255,255,.06);
                border-radius: 3px; overflow: hidden;
                margin-bottom: 8px;
            }
            .ldl-bar-fill{
                height: 100%; width: 0%;
                background: linear-gradient(90deg, #1a5a9a, #4a8af4);
                border-radius: 3px;
                transition: width .4s ease;
            }

            .ldl-progress-info{
                display: flex; justify-content: space-between;
                font-size: 10px; color: rgba(255,255,255,.5);
                font-family: 'SF Mono', Consolas, monospace;
                margin-bottom: 8px;
            }
            .ldl-progress-info .pct{ font-weight: 700; color: #4a8af4; }

            .ldl-log{
                font-size: 10px;
                color: rgba(255,255,255,.55);
                background: rgba(0,0,0,.4);
                padding: 8px 10px;
                border-radius: 8px;
                max-height: 70px;
                overflow-y: auto;
                font-family: 'SF Mono', Consolas, monospace;
                line-height: 1.5;
                border: 1px solid rgba(255,255,255,.05);
                word-break: break-word;
            }

            .ldl-result{
                display: none;
                padding: 12px 14px;
                background: linear-gradient(135deg, rgba(39,174,96,.15), rgba(46,204,113,.08));
                border: 1.5px solid rgba(39,174,96,.4);
                border-radius: 12px;
                font-size: 11px;
                line-height: 1.6;
            }
            .ldl-result-title{
                font-weight: 800; font-size: 13px; color: #2ecc71;
                margin-bottom: 6px;
            }
            .ldl-result-line{ color: rgba(255,255,255,.8); }
            .ldl-result-line b{ color: #fff; }
            .ldl-result-line .fmt{ color: #4a8af4; }

            .ldl-buttons{
                display: flex; gap: 6px;
                padding: 0 16px 12px;
                flex-shrink: 0;
            }
            .ldl-btn{
                padding: 12px 14px;
                border-radius: 10px;
                border: none;
                font-family: inherit;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                transition: all .2s;
                display: inline-flex; align-items: center; justify-content: center;
                gap: 6px;
                white-space: nowrap;
            }
            .ldl-btn-main{
                flex: 3;
                background: linear-gradient(135deg, #27ae60, #2ecc71);
                color: #fff;
                box-shadow: 0 4px 16px rgba(46,204,113,.35);
            }
            .ldl-btn-main:hover:not(:disabled){ box-shadow: 0 6px 20px rgba(46,204,113,.5); transform: translateY(-1px); }
            .ldl-btn-main.repeat{
                background: linear-gradient(135deg, #1a5a9a, #4a8af4);
                box-shadow: 0 4px 16px rgba(74,138,244,.4);
            }
            .ldl-btn-main.repeat:hover:not(:disabled){ box-shadow: 0 6px 20px rgba(74,138,244,.55); }
            .ldl-btn-main:disabled{ opacity: .4; cursor: not-allowed; transform: none; box-shadow: none; }
            .ldl-btn-pause{
                flex: 1;
                background: rgba(255,255,255,.06);
                color: rgba(255,255,255,.7);
                border: 1px solid rgba(255,255,255,.08);
            }
            .ldl-btn-pause:hover:not(:disabled){ background: rgba(240,165,0,.15); color: #f0a500; }
            .ldl-btn-pause.active{ background: linear-gradient(135deg, #f0a500, #f39c12); color: #fff; border-color: transparent; }
            .ldl-btn-pause:disabled{ opacity: .3; cursor: not-allowed; }
            .ldl-btn-stop{
                flex: 1;
                background: rgba(255,255,255,.06);
                color: rgba(255,255,255,.7);
                border: 1px solid rgba(255,255,255,.08);
            }
            .ldl-btn-stop:hover:not(:disabled){ background: rgba(231,76,60,.15); color: #e74c3c; }
            .ldl-btn-stop:disabled{ opacity: .3; cursor: not-allowed; }

            .ldl-toggles{
                display: flex; align-items: center; gap: 12px;
                padding: 10px 14px;
                background: rgba(255,255,255,.03);
                border: 1px solid rgba(255,255,255,.06);
                border-radius: 10px;
                margin: 0 16px 10px;
                font-size: 11px;
                flex-wrap: wrap;
                flex-shrink: 0;
            }
            .ldl-toggle{
                display: inline-flex; align-items: center; gap: 6px;
                cursor: pointer; font-weight: 600;
                color: rgba(255,255,255,.75);
                transition: color .2s;
                user-select: none;
            }
            .ldl-toggle:hover{ color: #fff; }
            .ldl-toggle input{
                width: 14px; height: 14px;
                cursor: pointer; margin: 0;
                accent-color: #4a8af4;
            }
            .ldl-toggle.force input{ accent-color: #e74c3c; }
            .ldl-toggle.auto input{ accent-color: #27ae60; }
            .ldl-toggle.tools input{ accent-color: #27ae60; }
            .ldl-force-status{
                margin-left: auto;
                font-size: 10px; color: rgba(255,255,255,.5);
                background: rgba(255,255,255,.06);
                padding: 2px 8px;
                border-radius: 8px;
                font-family: 'SF Mono', Consolas, monospace;
                transition: all .2s;
            }
            .ldl-force-status.on{ color: #e74c3c; background: rgba(231,76,60,.15); }

            .ldl-footer{
                padding: 0 16px 14px;
                display: flex; justify-content: space-between; align-items: center;
                font-size: 10px; color: rgba(255,255,255,.4);
                flex-shrink: 0;
                gap: 8px;
            }
            #ldl-status-line{ flex: 1; text-align: center; font-family: 'SF Mono', Consolas, monospace; }
            #ldl-zip-info{ color: rgba(255,255,255,.5); font-family: 'SF Mono', Consolas, monospace; display: none; }
        </style>

        <div id="litres_mini" title="Развернуть LitRes Downloader">
            <div style="width:30px;height:30px;border-radius:9px;background:linear-gradient(135deg,#1a5a9a,#4a8af4);display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 4px 12px rgba(74,138,244,.4);flex-shrink:0;">📚</div>
            <div style="display:flex;flex-direction:column;line-height:1.25;min-width:0;">
                <div style="font-size:11px;color:#fff;font-weight:700;">LitRes DL</div>
                <div id="litres_mini_status" style="font-size:9px;color:rgba(255,255,255,.5);font-family:'SF Mono',Consolas,monospace;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">готов</div>
            </div>
            <div id="litres_mini_badge" style="display:none;background:#4a8af4;color:#fff;font-size:9px;font-weight:bold;padding:2px 7px;border-radius:8px;font-family:'SF Mono',Consolas,monospace;">0%</div>
            <div style="font-size:13px;color:rgba(255,255,255,.4);">▲</div>
        </div>

        <div id="litres_downloader_ui">
            <div class="ldl-header">
                <div class="ldl-logo">📚</div>
                <div style="flex:1;min-width:0;">
                    <div class="ldl-title">LitRes <span class="accent">Downloader</span></div>
                    <div class="ldl-subtitle">v45.0 · autostart · retry ×5</div>
                </div>
                <button id="btn_sound" class="ldl-icon-btn" title="Звук">🔊</button>
                <button id="btn_github" class="ldl-icon-btn" title="GitHub токен">🔑</button>
                <button id="btn_minimize" class="ldl-icon-btn" title="Свернуть">—</button>
                <button id="close_ui" class="ldl-icon-btn" title="Закрыть">✕</button>
            </div>

            <div class="ldl-body">
                <div class="ldl-card book-card">
                    <div class="ldl-card-title" id="preview_book_title">${bookInfo.title}</div>
                    <div class="ldl-card-row">✍️ <span id="preview_book_author">${bookInfo.author}</span></div>
                    <div class="ldl-card-row">📄 <span id="preview_total_pages">${bookInfo.pages || '—'}</span> стр. • <span id="preview_formats">⏳</span></div>
                </div>

                <div class="ldl-card" id="user_info_block">
                    <div class="ldl-card-label">👤 Аккаунт</div>
                    <div id="user_info_text">⏳ Загрузка...</div>
                </div>

                <div class="ldl-progress-box">
                    <div class="ldl-status-row">
                        <div class="ldl-hand" id="hand_animation">🖐️</div>
                        <div class="ldl-status-text">
                            <div class="ldl-status-main" id="reading_status">📖 Готов к старту</div>
                            <div class="ldl-status-phase" id="reading_phase">Фаза: idle</div>
                        </div>
                        <div class="ldl-counter" id="page_counter">0/0</div>
                    </div>
                    <div class="ldl-bar"><div class="ldl-bar-fill" id="progress_bar"></div></div>
                    <div class="ldl-progress-info">
                        <span id="progress_text">📥 0 из 0</span>
                        <span class="pct" id="percent_text">0%</span>
                    </div>
                    <div class="ldl-log" id="litres_log">⏳ Загрузка...</div>
                </div>

                <div class="ldl-result" id="result_banner">
                    <div class="ldl-result-title">✅ Файл скачан!</div>
                    <div id="result_text"></div>
                </div>
            </div>

            <div class="ldl-buttons">
                <button id="btn_start" class="ldl-btn ldl-btn-main">▶ Старт</button>
                <button id="btn_pause" class="ldl-btn ldl-btn-pause" disabled>⏸</button>
                <button id="btn_stop" class="ldl-btn ldl-btn-stop" disabled>⏹</button>
            </div>

            <div class="ldl-toggles">
                <label class="ldl-toggle force">
                    <input type="checkbox" id="force_mode">
                    ⚡ FORCE
                </label>
                <label class="ldl-toggle auto" title="Автоматически нажать Старт при загрузке страницы">
                    <input type="checkbox" id="autostart_mode">
                    🚀 АВТО
                </label>
                <label class="ldl-toggle tools" id="tools_label" title="Добавить x64.rar в ZIP">
                    <input type="checkbox" id="add_tools" ${addToolsDefault ? 'checked' : ''}>
                    📦 Tools
                </label>
                <div class="ldl-force-status" id="force_status">⏸ выкл</div>
            </div>

            <div class="ldl-footer">
                <span id="ldl-status-line">⏳ Загрузка...</span>
                <span id="ldl-zip-info">📦 ...</span>
            </div>
        </div>
    `);

    const $ = id => document.getElementById(id);
    const ui = $('litres_downloader_ui');
    const mini = $('litres_mini');
    const miniStatus = $('litres_mini_status');
    const miniBadge = $('litres_mini_badge');

    // ═══════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════
    let state = {
        phase: 'idle',
        isRunning: false, isPaused: false, isStopped: false, isStarting: false,
        downloaded: 0, total: 0, startPage: 1, endPage: 10,
        bookTitle: bookInfo.title, bookAuthor: bookInfo.author,
        totalPages: bookInfo.pages || 0,
        errors: 0, zip: null, failedPages: [], consecutiveErrors: 0,
        fileId: fileId, artId: artId,
        lastSaveTime: 0, forceMode: false,
        bookInfoLoaded: false, directLink: null, zipUnavailable: false,
        pdfMetadata: null, pageFormats: null, drmActivated: false,
        autoInterval: null, mode: 'zip',
        jsonChapters: [], jsonEmptyStreak: 0, skippedChapters: [],
        minimized: false,
        resultFormat: null, resultFilename: null, resultSize: 0,
        currentPhaseText: 'idle',
        addTools: addToolsDefault
    };
    try { state.minimized = localStorage.getItem(MINI_KEY) === '1'; } catch(e) {}
    Sound.enabled = localStorage.getItem(SOUND_KEY) !== 'false';
    $('btn_sound').textContent = Sound.enabled ? '🔊' : '🔇';

    // ═══════════════════════════════════════════════════════════
    // 🎨 ЦВЕТНЫЕ ЛОГИ
    // ═══════════════════════════════════════════════════════════
    const LOG_COLORS = { info:'rgba(255,255,255,.55)', ok:'#2ecc71', err:'#e74c3c', warn:'#f0a500', step:'#4a8af4', net:'#7c5cff', db:'#38bdf8' };

    function updateTabTitle() {
        try {
            const p = state.total > 0 ? Math.round((state.downloaded / state.total) * 100) : 0;
            const s = state.bookTitle.length > 25 ? state.bookTitle.substring(0, 25) + '...' : state.bookTitle;
            if (state.phase === 'done') document.title = `✅ ${s}`;
            else if (state.phase === 'error') document.title = `❌ ${s}`;
            else if (state.isRunning && state.downloaded > 0) document.title = `[${p}%] ${s}`;
            else if (state.isRunning || state.phase === 'starting') document.title = `⏳ ${s}`;
            else document.title = s;
        } catch(e) {}
    }
    function updateMini() {
        if (!mini) return;
        if (state.minimized) { ui.style.display = 'none'; mini.style.display = 'flex'; }
        else { ui.style.display = 'flex'; mini.style.display = 'none'; }
        try { localStorage.setItem(MINI_KEY, state.minimized ? '1' : '0'); } catch(e) {}
        if (state.phase === 'done') {
            miniStatus.textContent = `✅ ${state.resultFormat || 'готово'}`;
            miniBadge.style.display = 'block'; miniBadge.textContent = '✅'; miniBadge.style.background = '#27ae60';
        } else if (state.phase === 'error') {
            miniStatus.textContent = '❌ ошибка'; miniBadge.style.display = 'none';
        } else if (state.isRunning) {
            miniStatus.textContent = `${state.downloaded}/${state.total} · ${state.currentPhaseText}`;
            if (state.total > 0) { miniBadge.style.display = 'block'; miniBadge.textContent = `${Math.round(state.downloaded/state.total*100)}%`; miniBadge.style.background = '#4a8af4'; }
        } else {
            miniStatus.textContent = 'готов'; miniBadge.style.display = 'none';
        }
    }
    function setPhase(phase, text) {
        state.phase = phase;
        state.currentPhaseText = text || phase;
        const el = $('reading_phase');
        if (el) el.textContent = `Фаза: ${state.currentPhaseText}`;
        updateMini(); updateTabTitle();
    }
    function addLog(text, kind = 'info') {
        const el = $('litres_log');
        const color = LOG_COLORS[kind] || LOG_COLORS.info;
        const icons = { ok:'✓', err:'✕', warn:'⚠', step:'▸', net:'🌐', db:'💾', info:'ℹ️' };
        const icon = icons[kind] || 'ℹ️';
        el.textContent = `${icon} [${new Date().toLocaleTimeString()}] ${text}`;
        el.style.color = color;
        console.log(`[LOG:${kind}] ${text}`);
    }
    const logOk = t => addLog(t, 'ok');
    const logErr = t => addLog(t, 'err');
    const logWarn = t => addLog(t, 'warn');
    const logStep = t => addLog(t, 'step');
    const logNet = t => addLog(t, 'net');
    const logDb = t => addLog(t, 'db');

    function setStatus(text, kind = 'info') {
        const el = $('ldl-status-line');
        el.textContent = text;
        el.style.color = kind === 'err' ? '#e74c3c' : kind === 'ok' ? '#2ecc71' : 'rgba(255,255,255,.4)';
        addLog(text, kind === 'err' ? 'err' : kind === 'ok' ? 'ok' : 'info');
    }
    function setReadingStatus(t) { $('reading_status').textContent = t; }

    function updateFormatDisplay() {
        const el = $('preview_formats');
        if (!el) return;
        if (bookInfo.format) {
            el.innerHTML = `${bookInfo.format.icon} <b style="color:#4a8af4;">${bookInfo.format.name}</b>`;
            const isPage = state.pageFormats && state.pageFormats.length > 0;
            const isReady = ['FB2','EPUB','PDF','MOBI','TXT','ZIP'].includes(bookInfo.format.name);
            if (isReady && !isPage) {
                $('tools_label').style.display = 'none';
            } else {
                $('tools_label').style.display = 'inline-flex';
            }
        } else if (state.pageFormats && state.pageFormats.length > 0) {
            el.innerHTML = `📕 <b style="color:#4a8af4;">PDF</b> (${state.pageFormats.length} стр.)`;
            $('tools_label').style.display = 'inline-flex';
        } else {
            el.innerHTML = '⏳';
        }
    }

    function animateHand(a) {
        const h = $('hand_animation');
        if (!h) return;
        if (a === 'turn') {
            h.style.transform = 'translateX(30px) rotate(20deg)';
            setTimeout(() => h.style.transform = 'translateX(-10px) rotate(-10deg)', 400);
            setTimeout(() => h.style.transform = 'translateX(0) rotate(0deg)', 800);
        } else if (a === 'hover') {
            h.style.transform = 'translateX(10px) scale(1.1)';
            setTimeout(() => h.style.transform = 'translateX(0) scale(1)', 600);
        } else if (a === 'wait') {
            h.style.transform = 'rotate(-5deg)';
            setTimeout(() => h.style.transform = 'rotate(5deg)', 500);
            setTimeout(() => h.style.transform = 'rotate(0deg)', 1000);
        } else {
            h.textContent = a;
            h.style.transform = 'scale(1.3)';
            setTimeout(() => h.style.transform = 'scale(1)', 250);
        }
    }
    function getReadingDelay() {
        if (state.forceMode) return Math.random() * 300 + 200;
        const base = Math.random() * 5000 + 3000;
        if (Math.random() < 0.15) return base + Math.random() * 10000 + 5000;
        return base;
    }
    function getRandomPause() {
        if (state.forceMode) return Math.random() * 200 + 100;
        if (Math.random() < 0.2) return Math.random() * 10000 + 5000;
        return Math.random() * 3000 + 1000;
    }
    function updateProgress() {
        const p = state.total > 0 ? Math.round((state.downloaded / state.total) * 100) : 0;
        $('progress_bar').style.width = `${Math.min(p, 100)}%`;
        $('progress_text').textContent = `📥 ${state.downloaded} из ${state.total}`;
        $('percent_text').textContent = `${p}%`;
        $('page_counter').textContent = `${state.downloaded}/${state.total}`;
        updateTabTitle(); updateMini();
    }
    function updateButtons() {
        const bS = $('btn_start'), bP = $('btn_pause'), bT = $('btn_stop');
        const repeat = state.phase === 'done' || state.phase === 'error';
        if (repeat) {
            bS.disabled = false;
            bS.textContent = '🔁 Повторить';
            bS.classList.add('repeat');
            bP.disabled = true;
            bT.disabled = true;
        } else if (state.isRunning && !state.isPaused) {
            bS.disabled = true;
            bS.textContent = '⏳ Идёт...';
            bS.classList.remove('repeat');
            bP.disabled = false;
            bP.classList.remove('active');
            bT.disabled = false;
        } else if (state.isRunning && state.isPaused) {
            bS.disabled = false;
            bS.textContent = '▶ Продолжить';
            bS.classList.remove('repeat');
            bP.disabled = true;
            bP.classList.add('active');
            bT.disabled = false;
        } else {
            bS.disabled = false;
            bS.textContent = '▶ Старт';
            bS.classList.remove('repeat');
            bP.disabled = true;
            bP.classList.remove('active');
            bT.disabled = true;
        }
    }
    function showResult(format, filename, size) {
        state.resultFormat = format;
        state.resultFilename = filename;
        state.resultSize = size;
        const sz = size > 1048576 ? (size/1048576).toFixed(2)+' MB' : (size/1024).toFixed(0)+' KB';
        $('result_text').innerHTML = `
            <div class="ldl-result-line">📁 <b>${filename}</b></div>
            <div class="ldl-result-line">📄 Формат: <span class="fmt"><b>${format}</b></span></div>
            <div class="ldl-result-line">📦 Размер: <b>${sz}</b></div>
            <div style="margin-top:6px;font-size:10px;color:rgba(255,255,255,.5);">Файл в папке «Загрузки»</div>
        `;
        $('result_banner').style.display = 'block';
        setPhase('done', 'готово');
        setReadingStatus('✅ Файл скачан');
        animateHand('✅');
        updateButtons(); updateTabTitle();
        Sound.complete();
    }
    function resetForRepeat() {
        $('result_banner').style.display = 'none';
        Object.assign(state, {
            downloaded: 0, errors: 0, consecutiveErrors: 0, failedPages: [],
            jsonChapters: [], jsonEmptyStreak: 0, skippedChapters: [], zip: null,
            isStopped: false, isPaused: false, isRunning: false, isStarting: false,
            resultFormat: null, resultFilename: null
        });
        setPhase('idle', 'idle');
        $('progress_bar').style.width = '0%';
        $('progress_text').textContent = '📥 0 из 0';
        $('percent_text').textContent = '0%';
        $('page_counter').textContent = '0/0';
        setReadingStatus('📖 Готов к старту');
        animateHand('🖐️');
        updateButtons(); updateTabTitle();
        setStatus('Готов к повторному запуску');
    }

    async function saveProgress(force = false) {
        if (state.downloaded === 0 || !GITHUB_CONFIG.token) return;
        const now = Date.now();
        if (!force && now - state.lastSaveTime < 30000) return;
        state.lastSaveTime = now;
        await saveProgressToGitHub(state.artId, {
            book_id: state.artId, book_title: state.bookTitle, book_author: state.bookAuthor,
            file_id: state.fileId, total_pages: state.total, downloaded_pages: state.downloaded,
            mode: state.mode, last_update: new Date().toISOString()
        });
    }

    // ═══════════════════════════════════════════════════════════
    // PAGE DOWNLOAD
    // ═══════════════════════════════════════════════════════════
    async function getImageUrl(pageNum) {
        if (!state.fileId) return null;
        const apiPage = pageNum - 1;
        const formats = (state.pageFormats && state.pageFormats[apiPage]) ? [state.pageFormats[apiPage]] : ['gif','jpg'];
        for (const ext of formats) {
            try {
                const r = await fetchWithTimeout(`https://api.litres.ru/foundation/api/arts/files/${state.fileId}/link?page_id=${apiPage}&is_trial=false&resolution=w1900&image_type=${ext}`,
                    { credentials: 'include', headers: getHeaders() }, 15000);
                if (!r.ok) continue;
                const d = await r.json();
                const url = d?.payload?.data?.link || d?.payload?.link || d?.data?.link || d?.link;
                if (url) return { url, ext };
            } catch(e) {}
        }
        return null;
    }
    async function downloadPageToZip(pageNum) {
        const result = await getImageUrl(pageNum);
        if (!result) return { success: false, error: 'Нет формата' };
        const { url, ext } = result;
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            const timeout = setTimeout(() => { Sound.stall(); resolve({ success: false, error: 'Таймаут' }); }, 25000);
            img.onload = function() {
                clearTimeout(timeout);
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;
                    canvas.getContext('2d').drawImage(img, 0, 0);
                    canvas.toBlob((blob) => {
                        if (blob) {
                            state.zip.file(`page_${String(pageNum).padStart(3,'0')}.${ext}`, blob);
                            resolve({ success: true, size: blob.size, ext });
                        } else resolve({ success: false, error: 'Конвертация' });
                    }, 'image/jpeg', 0.95);
                } catch(e) { resolve({ success: false, error: e.message }); }
            };
            img.onerror = function() { clearTimeout(timeout); resolve({ success: false, error: 'Ошибка загрузки' }); };
            img.src = url;
        });
    }

    function isBookFinished() {
        if (state.consecutiveErrors >= 20) return true;
        if (state.downloaded >= state.total) return true;
        if (state.errors >= 50) return true;
        return false;
    }

    async function finalizePageZip() {
        if (!state.zip) return;
        setPhase('running', 'сборка ZIP');
        setStatus('📦 Формируем ZIP...');
        animateHand('📦');
        $('ldl-zip-info').style.display = 'inline';
        Sound.zip();

        if (state.addTools) {
            addLog('Скачиваем x64.rar...', 'net');
            const t = await downloadTools();
            if (t) { state.zip.file(TOOLS_PATH, t); logDb(`Tools: ${(t.size/1048576).toFixed(2)} MB`); }
            state.zip.file('tools/README.txt', `LitRes PDF Converter\n1. Распакуй tools/x64.rar\n2. run_auto.bat\n3. ZIP в IN\n4. PDF в OUT\n© 2026 Diminssoft`);
        }
        state.zip.file('book_info.txt',
            `Название: ${state.bookTitle}\n` +
            `Автор: ${state.bookAuthor}\n` +
            `artId: ${state.artId}\n` +
            `fileId: ${state.fileId}\n` +
            `Страниц: ${state.downloaded}/${state.total}\n` +
            `Формат: JPG/GIF постранично\n` +
            `Дата: ${new Date().toLocaleString('ru-RU')}\n` +
            `Скачано через LitRes Downloader v45.0`);

        try {
            const zipBlob = await state.zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
            const safe = state.bookTitle.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100);
            const fileName = `${safe}(${state.startPage}-${state.endPage}).zip`;
            triggerDownload(zipBlob, fileName);
            $('ldl-zip-info').textContent = `✅ ZIP: ${Math.round(zipBlob.size/1048576)} MB`;
            $('ldl-zip-info').style.color = '#4a8af4';
            const extUsed = state.pageFormats && state.pageFormats[0] ? state.pageFormats[0].toUpperCase() : 'JPG';
            showResult(`JPG/GIF (${extUsed})`, fileName, zipBlob.size);
            await saveProgress(true);
        } catch(e) {
            setStatus(`❌ ${e.message}`, 'err');
            setPhase('error', 'ошибка ZIP');
            Sound.error();
        }
        state.isRunning = false; updateButtons();
    }

    async function downloadLoop() {
        if (state.isStopped) return;
        if (state.isPaused) {
            setPhase('paused', 'пауза');
            setTimeout(() => { if (!state.isPaused && state.isRunning) downloadLoop(); }, 1000);
            return;
        }
        if (isBookFinished()) { await finalizePageZip(); return; }
        const pageNum = state.startPage + state.downloaded;
        if (pageNum > state.endPage) { await finalizePageZip(); return; }

        setReadingStatus(`📖 Страница ${pageNum}...`);
        setPhase('running', `стр. ${pageNum}`);
        animateHand('wait');

        await new Promise(r => setTimeout(r, getReadingDelay()));
        animateHand('turn');
        await new Promise(r => setTimeout(r, 800));

        const result = await downloadPageToZip(pageNum);
        if (!result.success) {
            state.failedPages.push(pageNum); state.errors++; state.consecutiveErrors++;
            logWarn(`Стр. ${pageNum}: ${result.error}`);
            Sound.warn();
        } else {
            state.consecutiveErrors = 0; state.downloaded++; updateProgress();
            logOk(`Стр. ${pageNum} (${Math.round(result.size/1024)} KB)`);
            Sound.pageDone();
        }
        if (state.downloaded % 5 === 0 && state.downloaded > 0) await saveProgress();
        await new Promise(r => setTimeout(r, getRandomPause()));
        state.autoInterval = setTimeout(() => {
            if (!state.isStopped && !state.isPaused && state.isRunning) downloadLoop();
        }, 500);
    }

    async function jsonDownloadLoop() {
        if (state.isStopped) return;
        if (state.isPaused) {
            setPhase('paused', 'пауза');
            setTimeout(() => { if (!state.isPaused && state.isRunning) jsonDownloadLoop(); }, 1000);
            return;
        }
        if (state.total > 0 && state.downloaded >= state.total) { await finalizeJsonBook(); return; }

        const n = String(state.downloaded).padStart(3, '0');
        setReadingStatus(`📖 Глава ${n}...`);
        setPhase('running', `глава ${n}`);
        animateHand('hover');

        const html = await fetchJsonChapter(state.downloaded);

        if (html && html.startsWith('%PDF')) {
            logWarn(`Вместо глав пришёл PDF → упаковываем в ZIP`);
            if (!state.zip) state.zip = new JSZip();
            const safe = state.bookTitle.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100);
            state.zip.file(`${safe}.pdf`, new Blob([html], { type: 'application/pdf' }));
            try {
                const zb = await state.zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
                triggerDownload(zb, `${safe}.zip`);
                showResult('PDF (в ZIP)', `${safe}.zip`, zb.size);
            } catch(e) { setStatus('❌ ' + e.message, 'err'); }
            state.isRunning = false; updateButtons();
            return;
        }

        if (html === null) {
            state.jsonEmptyStreak++;
            logWarn(`Глава ${n} пустая (${state.jsonEmptyStreak}/50)`);
            if (state.jsonEmptyStreak >= 50) {
                logWarn('Конец книги (50 пустых подряд)');
                await finalizeJsonBook();
                return;
            }
            await new Promise(r => setTimeout(r, 500));
            state.skippedChapters.push(state.downloaded);
            state.downloaded++;
            updateProgress();
        } else {
            state.jsonEmptyStreak = 0;
            state.jsonChapters.push(html);
            state.downloaded++; updateProgress();
            logOk(`Глава ${n} — ${html.length} символов`);
            Sound.chapterDone();
        }
        if (state.downloaded > 2000) { await finalizeJsonBook(); return; }
        state.autoInterval = setTimeout(() => {
            if (!state.isStopped && !state.isPaused && state.isRunning) jsonDownloadLoop();
        }, state.forceMode ? 100 : 300);
    }

    async function finalizeJsonBook() {
        if (state.isStopped || !state.jsonChapters.length) { state.isRunning = false; updateButtons(); return; }
        setPhase('running', 'сборка HTML');
        setStatus('📦 HTML → ZIP...');
        Sound.zip();
        $('ldl-zip-info').style.display = 'inline';
        if (state.skippedChapters.length > 0) logWarn(`Пропущено: ${state.skippedChapters.length}`);

        const html = buildBookHtml(state.jsonChapters, { title: state.bookTitle, author: state.bookAuthor });
        const safe = state.bookTitle.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100);

        if (!state.zip) state.zip = new JSZip();
        state.zip.file(`${safe}.html`, html);
        state.zip.file('book_info.txt',
            `Название: ${state.bookTitle}\nАвтор: ${state.bookAuthor}\nartId: ${state.artId}\nfileId: ${state.fileId}\n` +
            `Глав: ${state.jsonChapters.length}\nПропущено: ${state.skippedChapters.length}\n` +
            `Формат: HTML (из JSON LitRes)\nДата: ${new Date().toLocaleString('ru-RU')}\nСкачано через LitRes Downloader v45.0`);

        try {
            const zb = await state.zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
            const zn = `${safe}.zip`;
            triggerDownload(zb, zn);
            $('ldl-zip-info').textContent = `✅ ${zn} (${(zb.size/1048576).toFixed(2)} MB)`;
            $('ldl-zip-info').style.color = '#4a8af4';
            showResult(`HTML (JSON, ${state.jsonChapters.length} глав)`, zn, zb.size);
            await saveProgress(true);
        } catch(e) {
            setStatus('❌ ' + e.message, 'err');
            setPhase('error', 'ошибка');
            Sound.error();
        }
        state.isRunning = false; updateButtons();
    }

    async function finalizePdfToZip(pdfBlob) {
        setPhase('running', 'PDF → ZIP');
        setStatus('📦 PDF → ZIP...');
        Sound.zip();
        const safe = state.bookTitle.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100);
        const zip = new JSZip();
        zip.file(`${safe}.pdf`, pdfBlob);
        zip.file('book_info.txt',
            `Название: ${state.bookTitle}\nАвтор: ${state.bookAuthor}\nartId: ${state.artId}\nfileId: ${state.fileId}\n` +
            `Формат: PDF\nДата: ${new Date().toLocaleString('ru-RU')}\nСкачано через LitRes Downloader v45.0`);
        try {
            const zb = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
            const zn = `${safe}.zip`;
            triggerDownload(zb, zn);
            $('ldl-zip-info').style.display = 'inline';
            $('ldl-zip-info').textContent = `✅ ${zn} (${(zb.size/1048576).toFixed(2)} MB)`;
            $('ldl-zip-info').style.color = '#4a8af4';
            showResult('PDF (в ZIP)', zn, zb.size);
        } catch(e) {
            setStatus('❌ ' + e.message, 'err');
            setPhase('error', 'ошибка');
            Sound.error();
        }
    }

    // ═══════════════════════════════════════════════════════════
    // 🎯 START SMART
    // ═══════════════════════════════════════════════════════════
    async function startSmart() {
        if (state.isStarting) { console.log('⚠️ startSmart уже в процессе'); return; }
        if (state.phase === 'done' || state.phase === 'error') { resetForRepeat(); }
        if (state.isRunning && state.isPaused) {
            state.isPaused = false; updateButtons(); Sound.click();
            if (state.mode === 'json') jsonDownloadLoop(); else downloadLoop();
            return;
        }
        if (state.isRunning) return;

        state.isStarting = true;
        setPhase('starting', 'подготовка');

        try {
            Sound.start();
            if (!JSZipLoaded) {
                setStatus('⏳ JSZip...');
                await new Promise(resolve => {
                    const c = setInterval(() => { if (JSZipLoaded) { clearInterval(c); resolve(); } }, 200);
                    setTimeout(() => { clearInterval(c); resolve(); }, 5000);
                });
            }
            updateSession();
            if (!sessionData.sessionId) { setStatus('⚠️ Нет session-id. F5!', 'err'); setPhase('error', 'нет сессии'); Sound.error(); return; }
            if (!state.fileId) { if (!state.bookInfoLoaded) await fetchBookInfo(); state.fileId = bookInfo.fileId; }
            if (!state.fileId) { setStatus('❌ Нет fileId!', 'err'); setPhase('error', 'нет fileId'); Sound.error(); return; }

            if (!state.drmActivated) {
                try { await Promise.race([ activatePdfjs(), new Promise(r => setTimeout(() => r(false), 8000)) ]); } catch(e) {}
                if (state.totalPages) $('preview_total_pages').textContent = state.totalPages;
                updateFormatDisplay();
            }

            const fmtName = bookInfo.format?.name || '';
            const isPdfPageByPage = state.pageFormats && state.pageFormats.length > 0;

            logStep(`Формат=${fmtName || '?'}, ZIP=${!!state.directLink}, страничек=${state.pageFormats?.length || 0}`);

            // 🥇 Прямой ZIP
            if (!state.directLink && !isPdfPageByPage) {
                setStatus('🔍 Поиск ZIP...');
                state.directLink = await findZipLink(5);
                if (state.directLink) { state.zipUnavailable = false; logOk('ZIP найден при старте'); }
            }

            if (state.directLink && !isPdfPageByPage) {
                logStep(`ZIP в приоритете → как есть`);
                const freshLink = await findZipLink(2);
                if (freshLink) state.directLink = freshLink;
                state.isRunning = true; updateButtons();
                setPhase('running', 'скачивание ZIP');

                const blob = await fetchZipBlob(state.directLink);
                if (blob) {
                    logNet(`Blob: ${(blob.size/1048576).toFixed(1)} MB`);
                    const m = state.directLink.match(/fname=([^&]+)/);
                    const fn = m ? decodeURIComponent(m[1]) : `${state.bookTitle.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100)}.zip`;
                    triggerDownload(blob, fn);
                    logOk(`${fn}`);
                    const fmtLabel = bookInfo.format ? `${bookInfo.format.icon} ${bookInfo.format.name} (в ZIP)` : 'ZIP';
                    showResult(fmtLabel, fn, blob.size);
                    state.isRunning = false; updateButtons();
                    return;
                }
                logWarn(`ZIP недоступен → PDF/JSON`);
                state.isRunning = false; updateButtons();
            }

            // 🥈 000.js
            logStep(`Проверка 000.js...`);
            setStatus('🔍 Проверка 000.js...');
            const chUrl = `https://www.litres.ru/download_book_subscr/${state.artId}/${state.fileId}/json/000.js`;
            const detected = await detectContentType(chUrl);
            console.log('🔍 detected:', detected.type, detected.status || '');

            if (detected.type === 'pdf') {
                logStep(`PDF → ZIP`);
                state.isRunning = true; updateButtons();
                try { await finalizePdfToZip(detected.blob); } catch(e) { logErr(e.message); }
                state.isRunning = false; updateButtons();
                return;
            }
            if (detected.type === 'json' || detected.type === 'json-obj') {
                logStep(`JSON главы → HTML → ZIP`);
                state.mode = 'json'; state.jsonChapters = []; state.jsonEmptyStreak = 0; state.skippedChapters = [];
                state.downloaded = 0; state.total = 999;
                state.isRunning = true; state.isPaused = false; state.isStopped = false;
                state.startPage = 0; state.endPage = 999; state.zip = new JSZip();
                updateProgress();
                setStatus('📖 Загрузка глав...');
                setReadingStatus('📖 Открываем читалку...'); animateHand('hover');
                updateButtons();
                setTimeout(jsonDownloadLoop, 500);
                return;
            }
            if (isPdfPageByPage) {
                logStep(`PDF постраничка (${state.pageFormats.length} стр.)`);
                const totalPages = state.totalPages || state.pageFormats.length;
                state.startPage = 1; state.endPage = totalPages; state.total = totalPages;
                state.downloaded = 0; state.errors = 0; state.consecutiveErrors = 0; state.failedPages = [];
                state.isRunning = true; state.isPaused = false; state.isStopped = false;
                state.mode = 'zip'; state.zip = new JSZip();
                updateProgress();
                setStatus(`🚀 1-${totalPages}`);
                setReadingStatus('📖 Открываем книгу...'); animateHand('hover');
                updateButtons();
                setTimeout(downloadLoop, 1500);
                return;
            }

            if (detected.type === 'timeout' || detected.type === 'fetch-error' || detected.type === 'error') {
                logWarn(`000.js не ответил (${detected.type}) → постранично JPG`);
                Sound.warn();
                state.pageFormats = Array(999).fill('jpg'); state.totalPages = 999;
                state.startPage = 1; state.endPage = 999; state.total = 999;
                state.downloaded = 0; state.errors = 0; state.consecutiveErrors = 0; state.failedPages = [];
                state.isRunning = true; state.mode = 'zip'; state.zip = new JSZip();
                updateProgress();
                setStatus('🆘 Постранично JPG (стоп после 20 ошибок)');
                updateButtons();
                setTimeout(downloadLoop, 1000);
                return;
            }

            setStatus(`❌ Не удалось определить способ: ${detected.type}`, 'err');
            setPhase('error', 'неизвестный формат');
            Sound.error();
            state.isRunning = false; updateButtons();
        } finally {
            state.isStarting = false;
        }
    }

    function stopDownload() {
        state.isStopped = true; state.isRunning = false; state.isPaused = false;
        if (state.autoInterval) { clearTimeout(state.autoInterval); state.autoInterval = null; }
        setStatus(`⏹ Стоп. ${state.downloaded}`);
        setReadingStatus('⏹ Прервано');
        setPhase('idle', 'остановлено');
        Sound.warn();
        if (state.downloaded > 0) saveProgress(true);
        updateButtons();
    }
    function pauseDownload() {
        if (state.isRunning && !state.isPaused) {
            state.isPaused = true;
            if (state.autoInterval) { clearTimeout(state.autoInterval); state.autoInterval = null; }
            setStatus('⏸ Пауза');
            setReadingStatus('⏸ Пауза');
            setPhase('paused', 'пауза');
            animateHand('wait'); Sound.click(); updateButtons();
            saveProgress();
        }
    }
    function setupGitHub() {
        if (askForGitHubToken()) { logOk('GitHub токен сохранён'); }
    }

    // ═══════════════════════════════════════════════════════════
    // HANDLERS
    // ═══════════════════════════════════════════════════════════
    $('btn_start').addEventListener('click', startSmart);
    $('btn_pause').addEventListener('click', pauseDownload);
    $('btn_stop').addEventListener('click', stopDownload);
    $('btn_github').addEventListener('click', setupGitHub);
    $('btn_sound').addEventListener('click', () => {
        Sound.enabled = !Sound.enabled;
        $('btn_sound').textContent = Sound.enabled ? '🔊' : '🔇';
        localStorage.setItem(SOUND_KEY, Sound.enabled ? 'true' : 'false');
        if (Sound.enabled) Sound.click();
    });
    $('btn_minimize').addEventListener('click', () => { state.minimized = true; updateMini(); Sound.click(); });
    $('litres_mini').addEventListener('click', () => { state.minimized = false; updateMini(); Sound.click(); });
    $('close_ui').addEventListener('click', () => {
        stopDownload();
        ui.remove(); mini.remove();
    });
    $('force_mode').addEventListener('change', function() {
        state.forceMode = this.checked;
        $('force_status').textContent = this.checked ? '⚡ вкл' : '⏸ выкл';
        if (this.checked) $('force_status').classList.add('on');
        else $('force_status').classList.remove('on');
        Sound.click();
    });
    try { $('autostart_mode').checked = localStorage.getItem(AUTOSTART_KEY) === 'true'; } catch(e) {}
    $('autostart_mode').addEventListener('change', function() {
        try { localStorage.setItem(AUTOSTART_KEY, this.checked ? 'true' : 'false'); } catch(e) {}
        Sound.click();
        addLog(this.checked ? '🚀 Автостарт ВКЛ' : '🚀 Автостарт ВЫКЛ', 'ok');
    });
    $('add_tools').addEventListener('change', function() {
        state.addTools = this.checked;
        try { localStorage.setItem(ADD_TOOLS_KEY, this.checked ? 'true' : 'false'); } catch(e) {}
        Sound.click();
    });

    window.downloaderUI = {
        version: 'v45.0',
        start: startSmart,
        pause: pauseDownload,
        stop: stopDownload,
        state: state,
        Sound: Sound,
        addLog: addLog,
        findZipLink: findZipLink,
        fetchBookInfo: fetchBookInfo,
        fetchUserInfo: fetchUserInfo,
        activatePdfjs: activatePdfjs,
        fetchZipBlob: fetchZipBlob,
        detectContentType: detectContentType,
        parseLitFile: parseLitFile,
        litJsonToHtml: litJsonToHtml,
        fetchJsonChapter: fetchJsonChapter,
        buildBookHtml: buildBookHtml,
        saveProgressToGitHub: saveProgressToGitHub,
        loadProgressFromGitHub: loadProgressFromGitHub
    };

    async function init() {
        setStatus('⏳ Загрузка...');
        logStep(`Тип: ${pageType}`);
        updateMini();

        const ok = await fetchBookInfo();
        if (ok) {
            $('preview_book_title').textContent = bookInfo.title;
            $('preview_book_author').textContent = bookInfo.author;
            $('preview_total_pages').textContent = bookInfo.pages;
            state.bookTitle = bookInfo.title;
            state.bookAuthor = bookInfo.author;
            state.totalPages = bookInfo.pages;
            state.bookInfoLoaded = true;
            if (bookInfo.fileId) state.fileId = bookInfo.fileId;
            setStatus(`✅ "${bookInfo.title}"`, 'ok');
            logOk(`${bookInfo.pages} стр.`);
            if (bookInfo.format) {
                updateFormatDisplay();
                logStep(`Формат: ${bookInfo.format.name}`);
            }
        }

        setTimeout(async () => {
            const u = await fetchUserInfo();
            if (u) {
                let h = `<div>👤 <b>${u.id}</b>`;
                if (u.login) h += ` • ${u.login}`;
                h += `</div>`;
                if (u.email) h += `<div style="font-size:10px;">📧 ${u.email} ${u.isEmailConfirmed ? '✅' : '⚠️'}</div>`;
                if (u.subscription) {
                    const till = new Date(u.subscription.validTill);
                    const dl = Math.ceil((till - new Date()) / 86400000);
                    const dc = dl < 3 ? '#e74c3c' : (dl < 7 ? '#f0a500' : '#2ecc71');
                    h += `<div style="margin-top:6px; padding-top:6px; border-top:1px dashed rgba(255,255,255,.1);">`;
                    h += `<div><b>${u.subscription.isTrial ? '🎁 Trial' : '⭐ Активна'}</b>`;
                    if (u.subscription.planName) h += ` · ${u.subscription.planName}`;
                    if (u.subscription.autoRenew) h += ` 🔄`;
                    h += `</div>`;
                    h += `<div style="font-size:10px;">📅 ${till.toLocaleDateString('ru-RU')} • <span style="color:${dc};font-weight:700;">${dl} дн.</span></div>`;
                    if (u.subscription.price) h += `<div style="font-size:10px;">💳 ${u.subscription.price} ₽/мес</div>`;
                    h += `</div>`;
                }
                if (u.account) h += `<div style="margin-top:4px; font-size:10px;">💰 Баланс: <b>${u.account.display}</b> (реал ${u.account.real} + бонус ${u.account.bonus})</div>`;
                if (u.loyalty) h += `<div style="font-size:10px;">🎁 Кешбэк: <b>${u.loyalty.cashbackPercent}%</b>${u.loyalty.purchaseForNext > 0 ? ` · до след. ур.: ${u.loyalty.purchaseForNext} ₽` : ''}</div>`;
                $('user_info_text').innerHTML = h;
            } else {
                $('user_info_text').innerHTML = '<div>⚠️ Нет данных</div>';
            }
        }, 500);

        setTimeout(async () => {
            if (state.fileId) {
                await activatePdfjs();
                if (state.totalPages) $('preview_total_pages').textContent = state.totalPages;
                updateFormatDisplay();
            }
        }, 2500);

        setTimeout(async () => {
            logStep('Поиск ZIP-ссылки (retry ×5)...');
            const link = await findZipLink(5);
            if (link) {
                state.directLink = link;
                logOk('ZIP найден');
                setStatus(`📦 Готов — жми "▶ Старт"`, 'ok');
            } else {
                logStep('ZIP нет → PDF/JSON');
                setStatus(`📖 Готов — жми "▶ Старт"`);
            }
            updateFormatDisplay();
        }, 3000);

        updateButtons();
        console.log('%c✅ LitRes Downloader v45.0 загружен!', 'color:#4a8af4;font-weight:bold;font-size:14px;');
    }

    // ═══════════════════════════════════════════════════════════
    // URL WATCHER
    // ═══════════════════════════════════════════════════════════
    let currentArtId = artId;
    let urlWatcherLock = false;
    function getArtIdFromUrl() {
        const p = new URLSearchParams(window.location.search);
        const u = p.get('art');
        if (u) return u;
        const m = window.location.pathname.match(/-(\d+)\/?$/);
        return m ? m[1] : null;
    }
    async function handleUrlChange() {
        if (urlWatcherLock) return;
        urlWatcherLock = true;
        try {
            const newArtId = getArtIdFromUrl();
            if (!newArtId || newArtId === currentArtId) { urlWatcherLock = false; return; }
            logStep('Переход на другую книгу...');
            currentArtId = newArtId; artId = newArtId; fileId = null;
            if (state.autoInterval) { clearTimeout(state.autoInterval); state.autoInterval = null; }
            Object.assign(state, {
                isRunning: false, isPaused: false, isStopped: true,
                downloaded: 0, total: 0, totalPages: 0,
                pageFormats: null, drmActivated: false,
                fileId: null, artId: newArtId, directLink: null,
                bookInfoLoaded: false, jsonChapters: [], mode: 'zip', zipUnavailable: false
            });
            bookInfo.format = null;
            $('preview_book_title').textContent = '⏳ Загрузка...';
            $('preview_book_author').textContent = '...';
            $('preview_total_pages').textContent = '—';
            $('preview_formats').textContent = '⏳';
            $('result_banner').style.display = 'none';
            $('progress_bar').style.width = '0%';
            setPhase('idle', 'idle');
            updateButtons();
            const ok = await fetchBookInfo();
            if (ok) {
                $('preview_book_title').textContent = bookInfo.title;
                $('preview_book_author').textContent = bookInfo.author;
                $('preview_total_pages').textContent = bookInfo.pages;
                state.bookTitle = bookInfo.title; state.bookAuthor = bookInfo.author;
                state.totalPages = bookInfo.pages; state.fileId = bookInfo.fileId;
                state.bookInfoLoaded = true;
                updateFormatDisplay();
            }
            if (state.fileId) {
                await activatePdfjs();
                updateFormatDisplay();
                const link = await findZipLink(5);
                if (link) state.directLink = link;
            }
            updateTabTitle();
        } catch(e) {}
        setTimeout(() => { urlWatcherLock = false; }, 500);
    }
    const _ps = history.pushState;
    history.pushState = function() { _ps.apply(this, arguments); setTimeout(handleUrlChange, 700); };
    const _rs = history.replaceState;
    history.replaceState = function() { _rs.apply(this, arguments); setTimeout(handleUrlChange, 700); };
    window.addEventListener('popstate', () => setTimeout(handleUrlChange, 700));
    let lt = document.title;
    setInterval(() => { if (document.title !== lt) { lt = document.title; handleUrlChange(); } }, 1500);

    // ═══════════════════════════════════════════════════════════
    // INIT + АВТОСТАРТ
    // ═══════════════════════════════════════════════════════════
    init().then(() => {
        const params = new URLSearchParams(window.location.search);
        const urlAuto = params.get('autostart_litres') === '1';
        let lsAuto = false;
        try { lsAuto = localStorage.getItem(AUTOSTART_KEY) === 'true'; } catch(e) {}

        if (urlAuto || lsAuto) {
            console.log(`🚀 Автозапуск (${urlAuto ? 'URL флаг' : 'настройка'})`);
            logStep('Автостарт через 2 сек...');
            setStatus('🚀 Автостарт...');
            const waitAndStart = async () => {
                let tries = 0;
                while (!state.bookInfoLoaded && tries < 30) {
                    await new Promise(r => setTimeout(r, 200));
                    tries++;
                }
                await new Promise(r => setTimeout(r, 2000));
                if (state.isRunning || state.isStarting) {
                    console.log('⚠️ Уже запущено, автозапуск пропущен');
                    return;
                }
                startSmart();
            };
            setTimeout(waitAndStart, 1500);
        }
    });

})();
