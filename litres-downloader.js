/**
 * LitRes Downloader v31.3
 * 🧹 Автоочистка кэша jsDelivr
 * 📦 ZIP + 📖 FB2/EPUB→HTML + JSON fallback
 * 🎯 Автоопределение формата
 * (c) 2026 Diminssoft
 */

(function fullDownloaderV31() {
    console.log('🚀 LitRes Downloader v31.3');

    // ============================================================
    // 🧹 АВТООЧИСТКА КЭША jsDelivr
    // ============================================================
    (function autoPurge() {
        try {
            const filesToPurge = [
                'gh/dimasik-debug/Share@main/litres-downloader.js',
                'gh/dimasik-debug/Share@main/litres-downloader-v29.js',
                'gh/dimasik-debug/Share@main/litres-downloader-v30.js',
                'gh/dimasik-debug/Share@main/litres-downloader-v31.js'
            ];
            filesToPurge.forEach(function(f) {
                fetch('https://purge.jsdelivr.net/' + f, { mode: 'no-cors' })
                    .then(function(){ console.log('✅ Purge OK:', f.split('/').pop()); })
                    .catch(function(){});
            });
        } catch(e) {}
    })();

    const S = 1.25;
    const px = (v) => `${Math.round(v * S * 100) / 100}px`;

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
                            btn.title = '🛑 Заблокировано';
                        }
                    }
                }
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // ============================================================
    // 1. НАСТРОЙКИ
    // ============================================================
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
    const addToolsDefault = localStorage.getItem(ADD_TOOLS_KEY) !== 'false';

    // ============================================================
    // 2. GITHUB
    // ============================================================
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
                const resp = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.repo}/contents/${path}`, {
                    headers: { 'Authorization': `token ${GITHUB_CONFIG.token}` }
                });
                if (resp.ok) sha = (await resp.json()).sha;
            } catch(e) {}
            const response = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.repo}/contents/${path}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${GITHUB_CONFIG.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `📚 ${data.book_title} (${data.downloaded_pages}/${data.total_pages})`,
                    content: content,
                    sha: sha || undefined
                })
            });
            return response.ok;
        } catch(e) { return false; }
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
                return JSON.parse(new TextDecoder('utf-8').decode(bytes));
            }
        } catch(e) {}
        return null;
    }

    // ============================================================
    // 3. JSZip
    // ============================================================
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    document.head.appendChild(script);
    let JSZipLoaded = false;
    script.onload = () => { JSZipLoaded = true; };
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
    } else {
        const match = window.location.pathname.match(/-(\d+)\/?$/);
        if (match) {
            artId = match[1];
            fileId = null;
            pageType = 'book';
        }
    }
    if (!artId) { alert('❌ Не удалось определить ID книги!'); return; }

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
    // 6. ИНФО О КНИГЕ + ФОРМАТ
    // ============================================================
    let bookInfo = {
        title: 'Неизвестная книга',
        author: 'Неизвестный автор',
        pages: 0,
        fileId: fileId,
        artId: artId,
        source: 'не определено',
        format: null
    };

    function detectFormatFromName(fname) {
        if (!fname) return null;
        const s = String(fname).toLowerCase();
        if (s.includes('.fb2.zip') || s.endsWith('.fb2')) return { icon: '📚', name: 'FB2' };
        if (s.includes('.epub.zip') || s.endsWith('.epub')) return { icon: '📖', name: 'EPUB' };
        if (s.includes('.pdf.zip') || s.endsWith('.pdf')) return { icon: '📕', name: 'PDF' };
        if (s.includes('.mobi')) return { icon: '📘', name: 'MOBI' };
        if (s.includes('.txt')) return { icon: '📄', name: 'TXT' };
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

    async function fetchBookInfo() {
        try {
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
            if (payload.files?.length) {
                const main = payload.files.find(f => !f.is_additional);
                if (main?.pages) pages = main.pages;
                if (main) {
                    const fmt = detectFormatFromName(main.filename) ||
                                detectFormatFromMime(main.mime) ||
                                detectFormatFromName(main.extension);
                    if (fmt) bookInfo.format = fmt;
                }
            }
            if (!pages && payload.additional_info?.current_pages_or_seconds) {
                pages = payload.additional_info.current_pages_or_seconds;
            }
            if (!pages && symbols > 0) pages = Math.round(symbols / 2800);
            if (!pages && payload.release_file_id) {
                try {
                    const fr = await fetch(
                        `https://api.litres.ru/foundation/api/arts/files/${payload.release_file_id}/info`,
                        { method: 'GET', credentials: 'include', headers: getHeaders() }
                    );
                    if (fr.ok) {
                        const fd = await fr.json();
                        if (fd?.payload?.data?.pages) pages = fd.payload.data.pages;
                    }
                } catch(e) {}
            }
            if (!pages) pages = symbols > 0 ? Math.round(symbols / 2800) : 0;

            let author = 'Неизвестный автор';
            if (payload.persons?.length) {
                const ap = payload.persons.find(p => p.role === 'author');
                author = ap?.full_name || payload.persons[0].full_name || author;
            }

            bookInfo.title = payload.title || 'Неизвестная книга';
            bookInfo.author = author;
            bookInfo.pages = pages;
            bookInfo.fileId = payload.release_file_id || fileId;
            bookInfo.artId = payload.id || artId;
            bookInfo.source = 'API LitRes';
            return true;
        } catch(e) { return false; }
    }

    // ============================================================
    // 7. ИНФО О ПОЛЬЗОВАТЕЛЕ
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
            const prof = p.profile || {};
            const loyalty = p.loyalty || {};
            const bi = loyalty.bonuses_info || {};
            return {
                id: p.id,
                login: p.login,
                email: prof.email || null,
                isEmailConfirmed: prof.is_email_confirmed || false,
                registeredAt: prof.registered_at || null,
                subscription: sub.is_active ? {
                    isTrial: sub.is_trial_period || false,
                    validTill: sub.valid_till,
                    startDate: sub.start_date,
                    price: sub.price || null,
                    planName: sub.plan_name || null,
                    autoRenew: sub.prolongation_status === 'enabled'
                } : null,
                account: {
                    display: acc.display || 0,
                    real: acc.real || 0,
                    bonus: acc.bonus || 0
                },
                loyalty: loyalty.is_loyalty_user ? {
                    cashbackPercent: bi.current_cashback_percent || 0,
                    purchaseForNext: bi.purchase_amount_for_next_level || 0
                } : null
            };
        } catch(e) { return null; }
    }

    // ============================================================
    // 8. PDF АКТИВАЦИЯ
    // ============================================================
    async function activatePdfjs() {
        if (!state.fileId) return false;
        try {
            const resp = await fetch(
                `https://api.litres.ru/foundation/api/arts/files/${state.fileId}/link?index=1&is_trial=false`,
                { method: 'GET', credentials: 'include', headers: getHeaders() }
            );
            if (!resp.ok) return false;
            const data = await resp.json();
            const jsUrl = data?.payload?.data?.link || data?.payload?.link;
            if (!jsUrl) return false;
            const jsResp = await fetch(jsUrl, { credentials: 'omit' });
            if (!jsResp.ok) return false;
            const jsText = await jsResp.text();

            let title = null, authors = [], uuid = null;
            const metaMatch = jsText.match(/Meta\s*:\s*(\{[\s\S]*?\})\s*,\s*pages\s*:/);
            if (metaMatch) {
                try {
                    const meta = JSON.parse(metaMatch[1]);
                    title = meta.Title || null;
                    authors = meta.Authors || [];
                    uuid = meta.UUID || null;
                } catch(e) {}
            }
            const extMatches = [...jsText.matchAll(/ext\s*:\s*['"](\w+)['"]/g)];
            const pageFormats = extMatches.map(m => m[1]);
            if (pageFormats.length === 0) return false;

            state.pdfMetadata = {
                title: title || state.bookTitle,
                authors, uuid,
                totalPages: pageFormats.length,
                pageFormats
            };
            state.totalPages = pageFormats.length;
            state.pageFormats = pageFormats;
            state.drmActivated = true;
            return true;
        } catch(e) { return false; }
    }

    // ============================================================
    // 9. СКАЧИВАНИЕ ZIP
    // ============================================================
    function downloadWholeFile(url, filename) {
        if (!filename) {
            const m = url.match(/fname=([^&]+)/);
            filename = m ? decodeURIComponent(m[1]) : 'book.zip';
        }
        if (!bookInfo.format) {
            const fmt = detectFormatFromName(filename);
            if (fmt) { bookInfo.format = fmt; updateFormatDisplay(); }
        }
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(function() { a.remove(); }, 1000);
        addLog('📦 Скачивается: ' + filename);
        setStatus('📦 ' + filename);
    }

    // ============================================================
    // 10. ПОИСК ZIP-ССЫЛКИ
    // ============================================================
    async function findZipLink() {
        const fid = state.fileId || bookInfo.fileId;
        if (!fid) return null;
        const endpoints = [
            `https://api.litres.ru/foundation/api/arts/files/${fid}/link?is_trial=false`,
            `https://api.litres.ru/foundation/api/arts/files/${fid}/link?resource=bin&is_trial=false`,
            `https://api.litres.ru/foundation/api/arts/files/${fid}/link?resource=zip&is_trial=false`
        ];
        for (const url of endpoints) {
            try {
                const resp = await fetch(url, { method: 'GET', credentials: 'include', headers: getHeaders() });
                if (!resp.ok) continue;
                const data = await resp.json();
                const link = data?.payload?.data?.link || data?.payload?.link || data?.data?.link || data?.link;
                if (link && (link.includes('.bin') || link.includes('application/zip') || link.includes('download_book'))) {
                    const fmt = detectFormatFromName(link);
                    if (fmt && !bookInfo.format) { bookInfo.format = fmt; updateFormatDisplay(); }
                    return link;
                }
            } catch(e) {}
        }
        return null;
    }

    // ============================================================
    // 10.1 JSON-ПАРСЕР ГЛАВ
    // ============================================================
    function parseLitFile(text) {
        const clean = text.trim().replace(/;\s*$/, '');
        try { return new Function('return (' + clean + ')')(); }
        catch(e) {
            const s = clean.indexOf('[');
            const e2 = clean.lastIndexOf(']');
            if (s >= 0 && e2 > s) return new Function('return (' + clean.slice(s, e2 + 1) + ')')();
            throw e;
        }
    }
    function escHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        }[c]));
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
                case 'a': return `<a>${inner}</a>`;
                default: return inner;
            }
        }).join('');
    }
    async function fetchJsonChapter(num) {
        const fid = state.fileId;
        if (!fid) return null;
        const n = String(num).padStart(3, '0');
        const url = `https://www.litres.ru/download_book_subscr/${state.artId}/${fid}/json/${n}.js`;
        try {
            const r = await fetch(url, { credentials: 'include' });
            if (!r.ok) return null;
            const text = await r.text();
            if (!text || text.length < 10) return null;
            return litJsonToHtml(parseLitFile(text));
        } catch(e) { return null; }
    }

    // 🆕 TOC — оглавление (для реального прогресса)
    async function fetchToc() {
        const fid = state.fileId;
        if (!fid) return null;
        try {
            const url = `https://www.litres.ru/download_book_subscr/${state.artId}/${fid}/json/toc.js`;
            const r = await fetch(url, { credentials: 'include' });
            if (!r.ok) return null;
            const text = await r.text();
            if (!text || text.length < 5) return null;
            return parseLitFile(text);
        } catch(e) { return null; }
    }

    // ============================================================
    // 10.2 FB2 → HTML ПАРСЕР
    // ============================================================
    async function convertFb2ZipToHtml(zipBlob) {
        setStatus('📦 Распаковка FB2...');
        addLog(`📦 Распаковка ZIP (${(zipBlob.size / 1024 / 1024).toFixed(1)} MB)...`);
        const zip = await JSZip.loadAsync(zipBlob);

        let fb2File = null;
        zip.forEach((path, file) => {
            if (!file.dir && path.toLowerCase().endsWith('.fb2')) fb2File = file;
        });
        if (!fb2File) throw new Error('FB2 не найден в ZIP');

        addLog(`📖 Парсим FB2...`);
        const xmlText = await fb2File.async('text');
        addLog(`📄 XML: ${(xmlText.length / 1024).toFixed(0)} KB`);

        const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
        if (doc.querySelector('parsererror')) throw new Error('Ошибка XML');

        const titleInfo = doc.querySelector('description > title-info');
        const bTitle = titleInfo?.querySelector('book-title')?.textContent?.trim() || state.bookTitle;
        const authors = [];
        titleInfo?.querySelectorAll('author').forEach(a => {
            const fn = a.querySelector('first-name')?.textContent || '';
            const mn = a.querySelector('middle-name')?.textContent || '';
            const ln = a.querySelector('last-name')?.textContent || '';
            const nk = a.querySelector('nickname')?.textContent || '';
            const name = [fn, mn, ln].filter(Boolean).join(' ') || nk;
            if (name) authors.push(name);
        });
        const bAuthor = authors.join(', ') || state.bookAuthor;

        const images = {};
        doc.querySelectorAll('binary').forEach(bin => {
            const id = bin.getAttribute('id');
            const ct = bin.getAttribute('content-type') || 'image/jpeg';
            const b64 = (bin.textContent || '').replace(/\s/g, '');
            if (id && b64) images[id] = `data:${ct};base64,${b64}`;
        });
        addLog(`🖼️ Картинок: ${Object.keys(images).length}`);

        let bodyHtml = '';
        const bodies = doc.querySelectorAll('body');
        if (bodies.length > 0) bodyHtml = parseFb2Section(bodies[0], images);

        return buildFb2Html(bTitle, bAuthor, bodyHtml, authors);
    }

    function parseFb2Section(node, images) {
        if (!node) return '';
        let out = '';
        for (const child of node.children || []) {
            const tag = (child.tagName || '').toLowerCase();
            switch (tag) {
                case 'section': out += parseFb2Section(child, images); break;
                case 'title': { const t = child.textContent.trim(); if (t) out += `<h2>${escHtml(t)}</h2>`; break; }
                case 'subtitle': out += `<h3>${escHtml(child.textContent)}</h3>`; break;
                case 'p': out += `<p>${parseFb2Inline(child, images)}</p>`; break;
                case 'empty-line': out += '<br>'; break;
                case 'image': {
                    const href = child.getAttribute('xlink:href') || child.getAttribute('href') || '';
                    const id = href.replace('#', '');
                    if (id && images[id]) out += `<div style="text-align:center;margin:20px 0;"><img src="${images[id]}" style="max-width:100%;height:auto;"></div>`;
                    break;
                }
                case 'epigraph': out += `<blockquote>${parseFb2Section(child, images)}</blockquote>`; break;
                case 'cite': out += `<blockquote class="cite">${parseFb2Section(child, images)}</blockquote>`; break;
                case 'poem': case 'stanza': out += `<div class="poem">${parseFb2Section(child, images)}</div>`; break;
                case 'v': out += `<p style="text-align:center;font-style:italic;margin:4px 0;">${parseFb2Inline(child, images)}</p>`; break;
                case 'annotation': out += `<div class="annotation"><b>Аннотация</b>${parseFb2Section(child, images)}</div>`; break;
                case 'table': out += `<table>${parseFb2Section(child, images)}</table>`; break;
                case 'tr': out += `<tr>${parseFb2Section(child, images)}</tr>`; break;
                case 'td': out += `<td>${parseFb2Section(child, images)}</td>`; break;
                case 'th': out += `<th>${parseFb2Section(child, images)}</th>`; break;
                default: out += parseFb2Section(child, images);
            }
        }
        return out;
    }
    function parseFb2Inline(node, images) {
        let out = '';
        for (const child of node.childNodes || []) {
            if (child.nodeType === 3) out += escHtml(child.textContent);
            else if (child.nodeType === 1) {
                const tag = (child.tagName || '').toLowerCase();
                switch (tag) {
                    case 'emphasis': out += `<em>${parseFb2Inline(child, images)}</em>`; break;
                    case 'strong': out += `<strong>${parseFb2Inline(child, images)}</strong>`; break;
                    case 'strikethrough': out += `<s>${parseFb2Inline(child, images)}</s>`; break;
                    case 'sub': out += `<sub>${parseFb2Inline(child, images)}</sub>`; break;
                    case 'sup': out += `<sup>${parseFb2Inline(child, images)}</sup>`; break;
                    case 'code': out += `<code>${parseFb2Inline(child, images)}</code>`; break;
                    case 'style': out += `<span>${parseFb2Inline(child, images)}</span>`; break;
                    case 'a': { const href = child.getAttribute('xlink:href') || child.getAttribute('href') || '#'; out += `<a href="${escHtml(href)}">${parseFb2Inline(child, images)}</a>`; break; }
                    case 'image': {
                        const href = child.getAttribute('xlink:href') || child.getAttribute('href') || '';
                        const id = href.replace('#', '');
                        if (id && images[id]) out += `<img src="${images[id]}" style="max-width:100%;height:auto;">`;
                        break;
                    }
                    default: out += parseFb2Inline(child, images);
                }
            }
        }
        return out;
    }
    function buildFb2Html(title, author, bodyHtml, authors) {
        const st = escHtml(title), sa = escHtml(author);
        return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><title>${st}</title>
<style>
* { box-sizing: border-box; }
body { font-family: Georgia, 'Times New Roman', serif; font-size: 18px; line-height: 1.7; max-width: 720px; margin: 0 auto; padding: 60px 30px; background: #fafafa; color: #222; }
h1.book-title { font-size: 32px; margin: 0 0 10px; color: #1a2a4a; border-bottom: 3px solid #1a5a9a; padding-bottom: 15px; }
h2 { font-size: 24px; margin: 50px 0 20px; color: #1a2a4a; page-break-before: always; }
h2:first-of-type { page-break-before: auto; }
h3 { font-size: 20px; margin: 30px 0 15px; color: #2a4a6a; }
p { margin: 14px 0; text-align: justify; }
em { font-style: italic; } strong { font-weight: bold; }
blockquote { margin: 20px 0; padding: 10px 20px; border-left: 4px solid #1a5a9a; background: #f0f7ff; font-style: italic; }
.cite { background: #fff8e8; border-left-color: #f0a500; }
.poem { text-align: center; margin: 20px 0; }
.annotation { background: #f8faff; padding: 15px 20px; border-radius: 8px; border: 1px solid #e8eef4; margin: 20px 0; font-size: 16px; }
table { width: 100%; border-collapse: collapse; margin: 20px 0; }
td, th { padding: 8px; border: 1px solid #ddd; }
th { background: #f0f4fa; }
img { border-radius: 4px; }
.meta { color: #6a8aaa; font-size: 14px; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid #ddd; }
.footer { margin-top: 80px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #aab8c4; text-align: center; }
@media (max-width: 600px) { body { padding: 30px 15px; font-size: 16px; } h1.book-title { font-size: 24px; } h2 { font-size: 20px; } }
@media print { body { padding: 0; background: #fff; } h2 { page-break-before: always; } }
</style></head><body>
<h1 class="book-title">${st}</h1>
<div class="meta">✍️ ${sa}</div>
${bodyHtml}
<div class="footer">📚 LitRes Downloader v31.3<br>${authors.length ? 'Автор: ' + authors.map(escHtml).join(', ') + '<br>' : ''}© 2026 Diminssoft</div>
</body></html>`;
    }

    // 🆕 Конвертация + скачивание HTML
    async function convertAndDownloadHtml() {
        setStatus(`📥 Скачиваем ${bookInfo.format?.name || 'ZIP'}...`);
        try {
            const r = await fetch(state.directLink, { credentials: 'include' });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const zipBlob = await r.blob();
            addLog(`✅ Скачано: ${(zipBlob.size / 1024 / 1024).toFixed(1)} MB`);

            const html = await convertFb2ZipToHtml(zipBlob);

            const safeTitle = state.bookTitle.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100);
            const fileName = `${safeTitle}.html`;
            const htmlBlob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(htmlBlob);
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => a.remove(), 2000);

            const sizeMb = (htmlBlob.size / 1024 / 1024).toFixed(2);
            setStatus(`🎉 Готово: ${fileName} (${sizeMb} MB)`);
            zipInfo.style.display = 'block';
            zipInfo.textContent = `✅ ${fileName} (${sizeMb} MB)`;
            zipInfo.style.color = '#1a5a9a';
            addLog(`✅ ${fileName} (${sizeMb} MB)`);
            state.isRunning = false;
            updateButtons();
            updateTabTitle();
            return true;
        } catch(e) {
            setStatus(`⚠️ Ошибка: ${e.message} → качаем оригинал`, true);
            state.isRunning = false;
            updateButtons();
            downloadWholeFile(state.directLink);
            return false;
        }
    }

    // ============================================================
    // 10.3 СБОРКА HTML ИЗ JSON-ГЛАВ
    // ============================================================
    function buildBookHtml(chapters, meta) {
        const st = escHtml(meta.title || 'Книга');
        const sa = escHtml(meta.author || 'Неизвестный автор');
        return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><title>${st}</title>
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
@media (max-width: 600px) { body { padding: 30px 15px; font-size: 16px; } h1.book-title { font-size: 24px; } h2 { font-size: 20px; } }
@media print { body { padding: 0; background: #fff; } h2 { page-break-before: always; } }
</style></head><body>
<h1 class="book-title">${st}</h1>
<div class="meta">✍️ ${sa}</div>
${chapters.map((h, i) => `<!-- Глава ${String(i).padStart(3,'0')} -->\n${h}`).join('\n')}
<div class="footer">📚 LitRes Downloader v31.3<br>Всего глав: ${chapters.length} • © 2026 Diminssoft</div>
</body></html>`;
    }

    // ============================================================
    // 11. ИНСТРУМЕНТЫ
    // ============================================================
    let toolsBlob = null;
    async function downloadTools() {
        if (toolsBlob) return toolsBlob;
        for (const url of TOOLS_URLS) {
            try {
                const resp = await fetch(url, { method: 'GET', credentials: 'omit', mode: 'cors' });
                if (!resp.ok) continue;
                toolsBlob = await resp.blob();
                return toolsBlob;
            } catch(e) {}
        }
        return null;
    }

    // ============================================================
    // 12. UI
    // ============================================================
    const uiHTML = `
        <div id="litres_downloader_ui" style="position: fixed; bottom: ${px(16)}; right: ${px(16)}; z-index: 99999; background: #ffffff; color: #1a2a4a; border-radius: ${px(14)}; padding: ${px(14)} ${px(16)}; font-family: 'Segoe UI', Arial, sans-serif; font-size: ${px(12)}; width: ${px(380)}; box-shadow: 0 ${px(8)} ${px(32)} rgba(0,0,0,0.15); border: 1px solid rgba(26, 42, 74, 0.08); user-select: none; max-height: 95vh; overflow-y: auto;">
            <div style="display: flex; align-items: center; gap: ${px(8)}; margin-bottom: ${px(10)};">
                <div style="font-size: ${px(20)};">📚</div>
                <div style="flex: 1;">
                    <div style="font-weight: 800; font-size: ${px(14)}; line-height: 1.1;">LitRes <span style="color: #1a5a9a;">Downloader</span></div>
                    <div style="font-size: ${px(9)}; color: #8a9aaa; text-transform: uppercase; letter-spacing: 0.3px;">v31.3 • Авто формат</div>
                </div>
                <button id="btn_github" style="background: #24292e; color: #fff; border: none; cursor: pointer; font-size: ${px(12)}; padding: ${px(4)} ${px(8)}; border-radius: ${px(6)}; font-weight: 700;" title="GitHub токен">🔑</button>
                <button id="close_ui" style="background: rgba(26,42,74,0.05); border: none; color: #8a9aaa; cursor: pointer; font-size: ${px(14)}; padding: ${px(3)} ${px(7)}; border-radius: ${px(6)};">✕</button>
            </div>
            <div style="background: #f0f7ff; border-radius: ${px(8)}; padding: ${px(8)} ${px(10)}; margin-bottom: ${px(8)}; border-left: ${px(3)} solid #1a5a9a; font-size: ${px(11)}; line-height: 1.4;">
                <div style="font-weight: 700; color: #1a2a4a; margin-bottom: ${px(2)};" id="preview_book_title">${bookInfo.title}</div>
                <div style="color: #4a6a8a;">✍️ <span id="preview_book_author">${bookInfo.author}</span></div>
                <div style="color: #4a6a8a; margin-top: ${px(2)};">📄 <span id="preview_total_pages">${bookInfo.pages || '—'}</span> стр. • <span id="preview_formats">⏳</span></div>
            </div>
            <div id="user_info_block" style="background: #f8faff; border-radius: ${px(8)}; padding: ${px(8)} ${px(10)}; margin-bottom: ${px(8)}; border: 1px solid #e8eef4; font-size: ${px(10)}; color: #4a6a8a; line-height: 1.5;">
                <div style="font-weight: 700; font-size: ${px(11)}; color: #1a2a4a; margin-bottom: ${px(4)};">👤 Аккаунт</div>
                <div id="user_info_text">⏳ Загрузка...</div>
            </div>
            <div style="background: #f0f4fa; border-radius: ${px(8)}; padding: ${px(8)} ${px(10)}; margin-bottom: ${px(8)};">
                <div style="display: flex; align-items: center; gap: ${px(8)}; margin-bottom: ${px(6)};">
                    <div id="hand_animation" style="font-size: ${px(20)}; width: ${px(28)}; text-align: center; transition: transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);">🖐️</div>
                    <div style="flex: 1; min-width: 0;">
                        <div id="reading_status" style="font-weight: 600; font-size: ${px(11)}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">📖 Готов</div>
                        <div id="reading_progress_text" style="font-size: ${px(10)}; color: #6a8aaa;">Прогресс: 0%</div>
                    </div>
                    <div id="page_counter" style="font-size: ${px(14)}; font-weight: 700; color: #1a5a9a;">0/0</div>
                </div>
                <div style="width: 100%; height: ${px(6)}; background: #e8eef4; border-radius: ${px(3)}; overflow: hidden; margin-bottom: ${px(6)};">
                    <div id="progress_bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #1a5a9a, #4a8af4); border-radius: ${px(3)}; transition: width 0.4s ease;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: ${px(10)}; color: #6a8aaa; margin-bottom: ${px(4)};">
                    <span id="progress_text">📥 0 из 0</span>
                    <span id="percent_text" style="font-weight: 700; color: #1a5a9a;">0%</span>
                </div>
                <div id="log_status" style="font-size: ${px(10)}; color: #6a8aaa; background: #e8eef4; padding: ${px(3)} ${px(6)}; border-radius: ${px(4)}; max-height: ${px(52)}; overflow-y: auto; font-family: 'Courier New', monospace; line-height: 1.3;">⏳ Загрузка...</div>
            </div>
            <div style="display: flex; gap: ${px(4)}; margin-bottom: ${px(6)};">
                <button id="btn_start_all" style="flex: 1; padding: ${px(8)} ${px(6)}; background: #27ae60; color: #fff; border: none; border-radius: ${px(6)}; cursor: pointer; font-weight: 700; font-size: ${px(11)};">▶▶ Старт</button>
                <button id="btn_start" style="flex: 1; padding: ${px(8)} ${px(6)}; background: #1a3a6a; color: #fff; border: none; border-radius: ${px(6)}; cursor: pointer; font-weight: 700; font-size: ${px(11)};">▶ Старт</button>
                <button id="btn_pause" style="flex: 1; padding: ${px(8)} ${px(6)}; background: #e8eef4; color: #6a8aaa; border: none; border-radius: ${px(6)}; cursor: pointer; font-weight: 700; font-size: ${px(11)};">⏸ Пауза</button>
                <button id="btn_stop" style="flex: 1; padding: ${px(8)} ${px(6)}; background: #f0f2f4; color: #8a9aaa; border: 1px solid #dce2e8; border-radius: ${px(6)}; cursor: pointer; font-weight: 700; font-size: ${px(11)};">⏹ Стоп</button>
            </div>
            <div style="display: flex; align-items: center; gap: ${px(8)}; padding: ${px(5)} ${px(8)}; background: #f8faff; border-radius: ${px(6)}; border: 1px solid #e8eef4; margin-bottom: ${px(6)}; font-size: ${px(11)};">
                <label style="display: flex; align-items: center; gap: ${px(6)}; cursor: pointer; font-weight: 600;">
                    <input type="checkbox" id="force_mode" style="width: ${px(14)}; height: ${px(14)}; accent-color: #e74c3c; cursor: pointer;">
                    ⚡ FORCE
                </label>
                <label id="tools_label" style="display: flex; align-items: center; gap: ${px(6)}; cursor: pointer; font-weight: 600;" title="x64.rar (только для постраничной PDF-сборки)">
                    <input type="checkbox" id="add_tools" ${addToolsDefault ? 'checked' : ''} style="width: ${px(14)}; height: ${px(14)}; accent-color: #27ae60; cursor: pointer;">
                    📦 Tools
                </label>
                <div id="force_status" style="margin-left: auto; font-size: ${px(10)}; color: #8a9aaa; background: #e8eef4; padding: ${px(1)} ${px(6)}; border-radius: ${px(8)};">⏸ выкл</div>
            </div>
            <div id="status_text" style="font-size: ${px(10)}; color: #6a8aaa; text-align: center; padding: ${px(4)} 0 ${px(2)}; border-top: 1px solid #e8eef4; min-height: ${px(16)};">⏳ Загрузка...</div>
            <div id="zip_info" style="font-size: ${px(10)}; color: #8aaaac; text-align: center; margin-top: ${px(2)}; display: none;">📦 Архивация...</div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', uiHTML);

    // ============================================================
    // 13. ЭЛЕМЕНТЫ
    // ============================================================
    const ui = document.getElementById('litres_downloader_ui');
    const closeBtn = document.getElementById('close_ui');
    const btnGitHub = document.getElementById('btn_github');
    const btnStart = document.getElementById('btn_start');
    const btnStartAll = document.getElementById('btn_start_all');
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
    const forceMode = document.getElementById('force_mode');
    const forceStatus = document.getElementById('force_status');
    const userInfoText = document.getElementById('user_info_text');
    const addToolsCheckbox = document.getElementById('add_tools');
    const toolsLabel = document.getElementById('tools_label');

    // ============================================================
    // 14. СОСТОЯНИЕ
    // ============================================================
    let state = {
        isRunning: false, isPaused: false, isStopped: false,
        downloaded: 0, total: 0, startPage: 1, endPage: 10,
        bookTitle: bookInfo.title, bookAuthor: bookInfo.author,
        totalPages: bookInfo.pages || 0,
        errors: 0, zip: null,
        failedPages: [], consecutiveErrors: 0,
        fileId: fileId, artId: artId,
        lastSaveTime: 0, forceMode: false,
        bookInfoLoaded: false, directLink: null,
        pdfMetadata: null, pageFormats: null, drmActivated: false,
        addTools: addToolsDefault,
        autoInterval: null,
        mode: 'zip',
        jsonChapters: [],
        jsonEmptyStreak: 0
    };

    // ============================================================
    // 15. UI-ФУНКЦИИ
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

    // 🆕 Формат в шапке + авто-скрытие Tools для готовых форматов
    function updateFormatDisplay() {
        const el = previewFormats;
        if (!el) return;
        if (bookInfo.format) {
            el.innerHTML = `${bookInfo.format.icon} <b>${bookInfo.format.name}</b>`;
            el.style.color = '#1a5a9a';
            const isPageByPage = (state.pageFormats && state.pageFormats.length > 0);
            const isReadyFile = ['FB2', 'EPUB', 'PDF', 'MOBI', 'TXT', 'ZIP'].includes(bookInfo.format.name);
            const hideTools = isReadyFile && !isPageByPage;
            if (hideTools) {
                toolsLabel.style.display = 'none';
                state.addTools = false;
            } else {
                toolsLabel.style.display = 'flex';
            }
        } else if (state.pageFormats && state.pageFormats.length > 0) {
            const jpg = state.pageFormats.filter(f => f === 'jpg').length;
            const gif = state.pageFormats.filter(f => f === 'gif').length;
            el.innerHTML = `📕 <b>PDF</b> • JPG: ${jpg}, GIF: ${gif}`;
            el.style.color = '#1a5a9a';
            toolsLabel.style.display = 'flex';
        } else {
            el.innerHTML = '⏳';
            el.style.color = '#8a9aaa';
        }
    }
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
        progressText.textContent = `📥 ${state.downloaded} из ${state.total}`;
        percentText.textContent = `${percent}%`;
        pageCounter.textContent = `${state.downloaded}/${state.total}`;
        readingProgressText.textContent = `Прогресс: ${percent}%`;
        updateTabTitle();
    }
    function updateButtons() {
        if (state.isRunning && !state.isPaused) {
            btnStart.disabled = true; btnStart.style.background = '#b0c4d8'; btnStart.style.color = '#8a9aaa';
            btnStartAll.disabled = true; btnStartAll.style.background = '#b0d4b8'; btnStartAll.style.color = '#8a9aaa';
            btnPause.disabled = false; btnPause.style.background = '#f0a500'; btnPause.style.color = '#fff';
            btnStop.disabled = false; btnStop.style.background = '#fce4e4'; btnStop.style.color = '#e74c3c';
        } else if (state.isRunning && state.isPaused) {
            btnStart.disabled = false; btnStart.textContent = '▶ Продолжить';
            btnStart.style.background = '#1a3a6a'; btnStart.style.color = '#fff';
            btnStartAll.disabled = true; btnStartAll.style.background = '#b0d4b8'; btnStartAll.style.color = '#8a9aaa';
            btnPause.disabled = true; btnPause.style.background = '#e8eef4'; btnPause.style.color = '#8a9aaa';
            btnStop.disabled = false; btnStop.style.background = '#fce4e4'; btnStop.style.color = '#e74c3c';
        } else {
            btnStart.disabled = false; btnStart.textContent = '▶ Старт';
            btnStart.style.background = '#1a3a6a'; btnStart.style.color = '#fff';
            btnStartAll.disabled = false; btnStartAll.textContent = '▶▶ Старт';
            btnStartAll.style.background = '#27ae60'; btnStartAll.style.color = '#fff';
            btnPause.disabled = true; btnPause.style.background = '#e8eef4'; btnPause.style.color = '#8a9aaa';
            btnStop.disabled = true; btnStop.style.background = '#f0f2f4'; btnStop.style.color = '#b0c0d0';
        }
    }

    // ============================================================
    // 16. GITHUB ПРОГРЕСС
    // ============================================================
    async function saveProgress(force = false) {
        if (state.downloaded === 0) return;
        if (!GITHUB_CONFIG.token) return;
        const now = Date.now();
        if (!force && now - state.lastSaveTime < 30000) return;
        state.lastSaveTime = now;
        const progressData = {
            book_id: state.artId, book_title: state.bookTitle, book_author: state.bookAuthor,
            file_id: state.fileId, total_pages: state.total, downloaded_pages: state.downloaded,
            start_page: state.startPage, end_page: state.endPage, failed_pages: state.failedPages,
            mode: state.mode,
            status: state.isRunning ? 'in_progress' : (state.isPaused ? 'paused' : 'stopped'),
            last_update: new Date().toISOString()
        };
        const success = await saveProgressToGitHub(state.artId, progressData);
        if (success) addLog(`💾 Прогресс сохранён (${state.downloaded}/${state.total})`);
    }
    async function checkForSavedProgress() {
        if (!GITHUB_CONFIG.token) { if (!askForGitHubToken()) return false; }
        const progress = await loadProgressFromGitHub(state.artId);
        if (progress && progress.downloaded_pages > 0 && progress.downloaded_pages < progress.total_pages) {
            const resume = confirm(`📖 Найдено сохранение: "${progress.book_title}"\n\n📄 ${progress.downloaded_pages} из ${progress.total_pages}\n\nПродолжить?`);
            if (resume) {
                state.downloaded = progress.downloaded_pages;
                state.startPage = progress.start_page;
                state.endPage = progress.end_page;
                state.total = progress.total_pages;
                state.failedPages = progress.failed_pages || [];
                state.mode = progress.mode || 'zip';
                state.zip = new JSZip();
                updateProgress(); state.isRunning = true; updateButtons();
                setTimeout(() => { if (state.mode === 'json') jsonDownloadLoop(); else downloadLoop(); }, 1000);
                return true;
            }
        }
        return false;
    }

    // ============================================================
    // 17. URL КАРТИНКИ + СКАЧИВАНИЕ СТРАНИЦЫ
    // ============================================================
    async function getImageUrl(pageNum) {
        if (!state.fileId) return null;
        const apiPage = pageNum - 1;
        const formats = (state.pageFormats && state.pageFormats[apiPage]) ? [state.pageFormats[apiPage]] : ['gif', 'jpg'];
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
                if (state.pageFormats && state.pageFormats[apiPage]) return { url, ext };
                try {
                    const check = await fetch(url, { method: 'HEAD', credentials: 'omit' });
                    if (check.ok) return { url, ext };
                } catch(e) {}
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
            const timeout = setTimeout(() => resolve({ success: false, error: 'Таймаут' }), 30000);
            img.onload = function() {
                clearTimeout(timeout);
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;
                    canvas.getContext('2d').drawImage(img, 0, 0);
                    canvas.toBlob((blob) => {
                        if (blob) { if (state.zip) state.zip.file(`page_${String(pageNum).padStart(3, '0')}.${ext}`, blob); resolve({ success: true, size: blob.size }); }
                        else resolve({ success: false, error: 'Конвертация' });
                    }, 'image/jpeg', 0.95);
                } catch(e) { resolve({ success: false, error: e.message }); }
            };
            img.onerror = function() { clearTimeout(timeout); resolve({ success: false, error: 'Ошибка загрузки' }); };
            img.src = url;
        });
    }

    // ============================================================
    // 18. ЦИКЛЫ
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
        if (state.addTools) {
            addLog('📥 Скачиваем x64.rar...');
            const toolsData = await downloadTools();
            if (toolsData) { state.zip.file(TOOLS_PATH, toolsData); addLog(`✅ Инструменты: ${(toolsData.size / 1024 / 1024).toFixed(2)} MB`); }
            const readme = `LitRes PDF Converter\n1. Распакуй tools/x64.rar\n2. Запусти run_auto.bat\n3. ZIP с картинками в папку IN\n4. PDF будет в OUT\n© 2026 Diminssoft`;
            state.zip.file('tools/README.txt', readme);
        }
        try {
            const zipBlob = await state.zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
            const safeTitle = state.bookTitle.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100);
            const fileName = `${safeTitle}(${state.startPage}-${state.endPage}).zip`;
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = fileName;
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
            setStatus(`🎉 Готово! ${state.downloaded} стр. → ${fileName}`);
            zipInfo.textContent = `✅ ZIP: ${Math.round(zipBlob.size / 1024 / 1024)} MB`;
            zipInfo.style.color = '#1a5a9a';
            await saveProgress(true);
            state.isRunning = false; updateButtons(); updateTabTitle();
        } catch(e) { setStatus(`❌ Ошибка ZIP: ${e.message}`, true); }
    }
    async function downloadLoop() {
        if (state.isStopped) return;
        if (state.isPaused) { setStatus('⏸ Пауза'); setTimeout(() => { if (!state.isPaused && state.isRunning) downloadLoop(); }, 1000); return; }
        if (isBookFinished()) { await finalizeZip(); state.isRunning = false; updateButtons(); return; }
        if (state.downloaded >= state.total) { await finalizeZip(); state.isRunning = false; updateButtons(); return; }
        const pageNum = state.startPage + state.downloaded;
        if (pageNum > state.endPage) { await finalizeZip(); state.isRunning = false; updateButtons(); return; }
        setReadingStatus(`📖 Читаем стр. ${pageNum}...`);
        animateHand('wait');
        const readDelay = getReadingDelay();
        if (!state.forceMode) { const sec = Math.round(readDelay / 1000); setStatus(`📖 Стр. ${pageNum} (${sec}с)`); }
        else { setStatus(`⚡ FORCE: стр. ${pageNum}...`); }
        await new Promise(r => setTimeout(r, readDelay));
        setReadingStatus(`🔄 Перелистываем стр. ${pageNum}...`);
        animateHand('turn');
        await new Promise(r => setTimeout(r, 800));
        const result = await downloadPageToZip(pageNum);
        if (!result.success) { state.failedPages.push(pageNum); state.errors++; state.consecutiveErrors++; addLog(`⚠️ Ошибка стр. ${pageNum}`, true); }
        else { state.consecutiveErrors = 0; state.downloaded++; updateProgress(); addLog(`✅ Стр. ${pageNum} → ZIP (${Math.round(result.size / 1024)} KB)`); }
        if (state.downloaded % 5 === 0 && state.downloaded > 0) await saveProgress();
        const pauseDelay = getRandomPause();
        if (pauseDelay > 500 && !state.forceMode) {
            setStatus(`☕ Пауза ${Math.round(pauseDelay/1000)}с...`);
            setReadingStatus(`☕ Отдыхаем...`);
            animateHand('wait');
            await new Promise(r => setTimeout(r, pauseDelay));
        } else if (state.forceMode && pauseDelay > 100) { await new Promise(r => setTimeout(r, pauseDelay)); }
        const delay = state.forceMode ? Math.random() * 200 + 100 : Math.random() * 1500 + 500;
        state.autoInterval = setTimeout(() => { if (!state.isStopped && !state.isPaused && state.isRunning) downloadLoop(); }, delay);
    }

    // 🆕 JSON-цикл с реальным прогрессом
    async function jsonDownloadLoop() {
        if (state.isStopped) return;
        if (state.isPaused) { setStatus('⏸ Пауза'); setTimeout(() => { if (!state.isPaused && state.isRunning) jsonDownloadLoop(); }, 1000); return; }
        if (state.total > 0 && state.downloaded >= state.total) {
            addLog(`🎉 Скачано ${state.downloaded} глав`);
            await finalizeJsonBook();
            return;
        }
        const currentNum = state.downloaded;
        const n = String(currentNum).padStart(3, '0');
        setReadingStatus(`📖 Глава ${n}...`);
        animateHand('wait');
        setStatus(`📖 Глава ${n} (${state.downloaded}/${state.total || '?'})...`);
        const html = await fetchJsonChapter(currentNum);
        if (html === null) {
            state.jsonEmptyStreak++;
            addLog(`⚠️ Глава ${n} пустая (${state.jsonEmptyStreak}/3)`);
            if (state.jsonEmptyStreak >= 3) {
                addLog('🛑 Конец книги (3 пустые подряд)');
                await finalizeJsonBook();
                return;
            }
        } else {
            state.jsonEmptyStreak = 0;
            state.jsonChapters.push(html);
            state.downloaded++;
            updateProgress();
            addLog(`✅ Глава ${n} — ${html.length} символов`);
        }
        if (state.downloaded > 2000) { addLog('🛑 Лимит 2000 глав'); await finalizeJsonBook(); return; }
        const delay = state.forceMode ? 50 : Math.random() * 300 + 150;
        state.autoInterval = setTimeout(() => { if (!state.isStopped && !state.isPaused && state.isRunning) jsonDownloadLoop(); }, delay);
    }

    async function finalizeJsonBook() {
        if (state.isStopped) { state.isRunning = false; updateButtons(); return; }
        if (!state.jsonChapters || state.jsonChapters.length === 0) {
            setStatus('❌ Не удалось скачать ни одной главы', true);
            state.isRunning = false; updateButtons(); return;
        }
        setStatus('📦 Собираем HTML...');
        zipInfo.style.display = 'block';
        zipInfo.textContent = '📦 Сборка HTML...';
        addLog(`📦 Сборка HTML из ${state.jsonChapters.length} глав`);
        try {
            const html = buildBookHtml(state.jsonChapters, { title: state.bookTitle, author: state.bookAuthor });
            const safeTitle = state.bookTitle.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100);
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const fileName = `${safeTitle}.html`;
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = fileName;
            document.body.appendChild(a); a.click();
            setTimeout(() => a.remove(), 2000);
            const sizeMb = (blob.size / 1024 / 1024).toFixed(2);
            setStatus(`🎉 Готово: ${state.jsonChapters.length} глав, ${sizeMb} MB`);
            zipInfo.textContent = `✅ ${fileName} (${sizeMb} MB)`;
            zipInfo.style.color = '#1a5a9a';
            await saveProgress(true);
            state.isRunning = false; updateButtons(); updateTabTitle();
        } catch(e) { setStatus(`❌ Ошибка: ${e.message}`, true); state.isRunning = false; updateButtons(); }
    }

    // ============================================================
    // 19. АВТО-СТАРТ JSON (с реальным total из toc.js)
    // ============================================================
    async function startJsonDownload() {
        if (state.isRunning) return;

        addLog(`📖 JSON fallback: старт`);

        // Пробуем узнать реальное число глав
        setStatus('📖 Загрузка оглавления...');
        const toc = await fetchToc();
        let totalChapters = 0;
        if (Array.isArray(toc)) totalChapters = toc.length;
        else if (toc && typeof toc === 'object') {
            const arr = toc.chapters || toc.items || toc.toc || [];
            if (Array.isArray(arr)) totalChapters = arr.length;
        }
        if (!totalChapters && state.totalPages > 0) totalChapters = state.totalPages;
        if (!totalChapters) totalChapters = 999;

        addLog(`✅ Глав: ${totalChapters}`);

        state.mode = 'json';
        state.jsonChapters = [];
        state.jsonEmptyStreak = 0;
        state.downloaded = 0;
        state.total = totalChapters;
        state.isRunning = true;
        state.isPaused = false;
        state.isStopped = false;
        state.startPage = 0;
        state.endPage = totalChapters;
        updateProgress();
        setStatus(`📖 Загрузка ${totalChapters} глав...`);
        setReadingStatus('📖 Открываем читалку...');
        animateHand('hover');
        updateButtons();
        setTimeout(jsonDownloadLoop, 500);
    }

    // ============================================================
    // 20. ▶▶ СТАРТ ВСЁ (авто)
    // ============================================================
    async function startDownloadAll() {
        if (state.isRunning && state.isPaused) {
            state.isPaused = false; updateButtons();
            if (state.mode === 'json') jsonDownloadLoop(); else downloadLoop();
            return;
        }
        if (state.isRunning) return;

        if (!JSZipLoaded) {
            setStatus('⏳ JSZip...', true);
            await new Promise(resolve => { const c = setInterval(() => { if (JSZipLoaded) { clearInterval(c); resolve(); } }, 200); });
        }
        const hasProgress = await checkForSavedProgress();
        if (hasProgress) return;
        updateSession();
        if (!sessionData.sessionId) { setStatus('⚠️ Нет session-id. F5!', true); return; }
        if (!state.fileId) { if (!state.bookInfoLoaded) await fetchBookInfo(); state.fileId = bookInfo.fileId; }
        if (!state.fileId) { setStatus('❌ Нет fileId!', true); return; }

        if (!state.drmActivated && state.mode !== 'json') {
            const ok = await activatePdfjs();
            if (ok) {
                addLog(`✅ PDF: ${state.totalPages} стр.`);
                if (state.totalPages) previewTotalPages.textContent = state.totalPages;
                updateFormatDisplay();
            }
        }

        // 🔥 СЦЕНАРИЙ 1: Прямая ZIP-ссылка
        if (state.directLink) {
            const isText = bookInfo.format && ['FB2', 'EPUB'].includes(bookInfo.format.name);
            if (isText) {
                addLog(`📖 ${bookInfo.format.name} → HTML`);
                state.isRunning = true;
                updateButtons();
                return convertAndDownloadHtml();
            }
            addLog(`📦 Скачиваем готовый ZIP...`);
            downloadWholeFile(state.directLink);
            state.isRunning = false; updateButtons();
            return;
        }

        // 🔥 СЦЕНАРИЙ 2: JSON fallback
        if (!state.pageFormats || state.pageFormats.length === 0) {
            addLog(`📖 ZIP не найден → JSON fallback`);
            return startJsonDownload();
        }

        // 🔥 СЦЕНАРИЙ 3: Постраничка PDF
        let totalPages = state.totalPages;
        if (!totalPages || totalPages < 1) {
            const input = prompt(`📄 Всего страниц:`, '100');
            if (input === null) return;
            totalPages = parseInt(input) || 100;
            state.totalPages = totalPages;
            previewTotalPages.textContent = totalPages;
        }
        addLog(`🚀▶▶ ВСЕ ${totalPages} стр.`);
        state.startPage = 1; state.endPage = totalPages; state.total = totalPages;
        state.downloaded = 0; state.errors = 0; state.consecutiveErrors = 0;
        state.failedPages = []; state.isRunning = true; state.isPaused = false; state.isStopped = false;
        state.mode = 'zip'; state.zip = new JSZip();
        updateProgress();
        setStatus(`🚀▶▶ 1-${totalPages}`);
        setReadingStatus('📖 Открываем книгу...');
        animateHand('hover'); updateButtons();
        setTimeout(downloadLoop, 1500);
    }

    // ============================================================
    // 21. ▶ СТАРТ (с запросом)
    // ============================================================
    async function startDownload() {
        if (state.isRunning && state.isPaused) {
            state.isPaused = false; updateButtons();
            if (state.mode === 'json') jsonDownloadLoop(); else downloadLoop();
            return;
        }
        if (state.isRunning) return;

        if (!JSZipLoaded) {
            await new Promise(resolve => { const c = setInterval(() => { if (JSZipLoaded) { clearInterval(c); resolve(); } }, 200); });
        }
        const hasProgress = await checkForSavedProgress();
        if (hasProgress) return;
        updateSession();
        if (!sessionData.sessionId) { setStatus('⚠️ Нет session-id. F5!', true); return; }
        if (!state.fileId) { if (!state.bookInfoLoaded) await fetchBookInfo(); state.fileId = bookInfo.fileId; }
        if (!state.fileId) { setStatus('❌ Нет fileId!', true); return; }

        if (!state.drmActivated) {
            const ok = await activatePdfjs();
            if (ok) {
                if (state.totalPages) previewTotalPages.textContent = state.totalPages;
                updateFormatDisplay();
            }
        }

        // 🔥 Прямая ZIP-ссылка
        if (state.directLink) {
            const isPdf = state.pageFormats && state.pageFormats.length > 0;
            const isText = bookInfo.format && ['FB2', 'EPUB'].includes(bookInfo.format.name);

            if (isText && !isPdf) {
                const asHtml = confirm(
                    `📖 Обнаружен ${bookInfo.format.name}\n\n` +
                    `OK → конвертировать в HTML (одним файлом, с картинками)\n` +
                    `Отмена → скачать оригинальный ${bookInfo.format.name}.zip`
                );
                state.isRunning = true; updateButtons();
                if (asHtml) return convertAndDownloadHtml();
                downloadWholeFile(state.directLink);
                state.isRunning = false; updateButtons();
                return;
            }

            if (!isPdf) {
                addLog(`📦 Скачиваем архив напрямую...`);
                downloadWholeFile(state.directLink);
                state.isRunning = false; updateButtons();
                return;
            }
            const useDirect = confirm(`📦 Найдена прямая ссылка. Скачать ZIP?`);
            if (useDirect) {
                downloadWholeFile(state.directLink);
                state.isRunning = false; updateButtons();
                return;
            }
        }

        // 📖 JSON fallback
        if (!state.pageFormats || state.pageFormats.length === 0) {
            const useJson = confirm(`📖 ZIP не найден.\n\nСкачать через JSON-главы читалки?\nРезультат: HTML-файл`);
            if (useJson) return startJsonDownload();
            return;
        }

        // Постраничка PDF
        let totalPages = state.totalPages;
        if (!totalPages || totalPages < 1) {
            const input = prompt(`📄 Всего страниц:`, '100');
            if (input === null) return;
            totalPages = parseInt(input) || 100;
            state.totalPages = totalPages;
            previewTotalPages.textContent = totalPages;
        }
        const startPage = parseInt(prompt(`📖 "${state.bookTitle}"\n📄 Всего: ${totalPages}\n\nС какой страницы?`, '1')) || 1;
        const count = parseInt(prompt(`📖 "${state.bookTitle}"\nНачинаем с: ${startPage}\n\nСколько страниц?`, '10')) || 10;
        const endPage = Math.min(startPage + count - 1, totalPages);

        state.startPage = startPage; state.endPage = endPage; state.total = count;
        state.downloaded = 0; state.errors = 0; state.consecutiveErrors = 0;
        state.failedPages = []; state.isRunning = true; state.isPaused = false; state.isStopped = false;
        state.mode = 'zip'; state.zip = new JSZip();
        updateProgress();
        setStatus(`🚀 ${startPage}-${endPage} (${count} стр.)`);
        setReadingStatus('📖 Открываем книгу...');
        animateHand('hover'); updateButtons();
        setTimeout(downloadLoop, 1500);
    }

    // ============================================================
    // 22. УПРАВЛЕНИЕ
    // ============================================================
    function stopDownload() {
        state.isStopped = true; state.isRunning = false; state.isPaused = false;
        if (state.autoInterval) { clearTimeout(state.autoInterval); state.autoInterval = null; }
        setStatus(`⏹ Стоп. ${state.downloaded} ${state.mode === 'json' ? 'глав' : 'стр.'}`);
        setReadingStatus('⏹ Прервано');
        if (state.downloaded > 0) saveProgress(true);
        updateButtons();
    }
    function pauseDownload() {
        if (state.isRunning && !state.isPaused) {
            state.isPaused = true;
            if (state.autoInterval) { clearTimeout(state.autoInterval); state.autoInterval = null; }
            setStatus('⏸ Пауза'); setReadingStatus('⏸ Пауза');
            animateHand('wait'); updateButtons();
            saveProgress();
        }
    }
    function setupGitHub() {
        if (askForGitHubToken()) {
            addLog('✅ GitHub токен сохранён');
            checkForSavedProgress();
        }
    }

    // ============================================================
    // 23. ОБРАБОТЧИКИ
    // ============================================================
    btnStart.addEventListener('click', startDownload);
    btnStartAll.addEventListener('click', startDownloadAll);
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
    });
    addToolsCheckbox.addEventListener('change', function() {
        state.addTools = this.checked;
        localStorage.setItem(ADD_TOOLS_KEY, this.checked ? 'true' : 'false');
    });

    // ============================================================
    // 24. ЭКСПОРТ
    // ============================================================
    window.downloaderUI = {
        version: 'v31.3',
        start: startDownload, startAll: startDownloadAll,
        pause: pauseDownload, stop: stopDownload,
        state: state, addLog: addLog,
        findZipLink: findZipLink, fetchBookInfo: fetchBookInfo,
        fetchUserInfo: fetchUserInfo, activatePdfjs: activatePdfjs,
        downloadWholeFile: downloadWholeFile,
        parseLitFile: parseLitFile, litJsonToHtml: litJsonToHtml,
        fetchJsonChapter: fetchJsonChapter, fetchToc: fetchToc,
        buildBookHtml: buildBookHtml,
        convertFb2ZipToHtml: convertFb2ZipToHtml,
        convertAndDownloadHtml: convertAndDownloadHtml
    };

    // ============================================================
    // 25. ИНИЦИАЛИЗАЦИЯ
    // ============================================================
    async function init() {
        setStatus('⏳ Загрузка...');
        addLog(`🔍 Тип: ${pageType}`);

        const infoLoaded = await fetchBookInfo();
        if (infoLoaded && bookInfo.pages > 0) {
            previewBookTitle.textContent = bookInfo.title;
            previewBookAuthor.textContent = bookInfo.author;
            previewTotalPages.textContent = bookInfo.pages;
            state.bookTitle = bookInfo.title;
            state.bookAuthor = bookInfo.author;
            state.totalPages = bookInfo.pages;
            state.bookInfoLoaded = true;
            if (bookInfo.fileId) state.fileId = bookInfo.fileId;
            setStatus(`✅ "${bookInfo.title}"`);
            addLog(`✅ "${bookInfo.title}" — ${bookInfo.pages} стр.`);
            if (bookInfo.format) {
                updateFormatDisplay();
                addLog(`📖 Формат: ${bookInfo.format.name}`);
            }
        }

        setTimeout(async () => {
            const user = await fetchUserInfo();
            if (user) {
                let html = `<div>👤 <b>${user.id}</b>`;
                if (user.login) html += ` • ${user.login}`;
                html += `</div>`;
                if (user.email) html += `<div style="font-size: ${px(9)};">📧 ${user.email} ${user.isEmailConfirmed ? '✅' : '⚠️'}</div>`;
                if (user.subscription) {
                    const till = new Date(user.subscription.validTill);
                    const daysLeft = Math.ceil((till - new Date()) / 86400000);
                    const daysColor = daysLeft < 3 ? '#e74c3c' : (daysLeft < 7 ? '#f0a500' : '#27ae60');
                    html += `<div style="margin-top: ${px(6)}; padding-top: ${px(6)}; border-top: 1px dashed #d4e2f0;">`;
                    html += `<div><b>${user.subscription.isTrial ? '🎁 Trial' : '⭐ Активна'}</b></div>`;
                    html += `<div style="font-size: ${px(9)};">📅 ${till.toLocaleDateString('ru-RU')} • <span style="color: ${daysColor}; font-weight: 700;">${daysLeft} дн.</span></div>`;
                    if (user.subscription.price) html += `<div style="font-size: ${px(9)}; color: #8a9aaa;">💰 ${user.subscription.price} ₽</div>`;
                    html += `</div>`;
                }
                if (user.account && (user.account.display || user.account.bonus)) {
                    html += `<div style="margin-top: ${px(6)}; padding-top: ${px(6)}; border-top: 1px dashed #d4e2f0; font-size: ${px(9)};">`;
                    if (user.account.display) html += `<div>💰 Баланс: ${user.account.display} ₽</div>`;
                    if (user.account.bonus) html += `<div>🎁 Бонусов: ${user.account.bonus}</div>`;
                    html += `</div>`;
                }
                if (user.loyalty) {
                    html += `<div style="margin-top: ${px(6)}; padding-top: ${px(6)}; border-top: 1px dashed #d4e2f0; font-size: ${px(9)};">`;
                    html += `<div>💸 Кэшбэк: ${user.loyalty.cashbackPercent}%</div>`;
                    html += `</div>`;
                }
                userInfoText.innerHTML = html;
            }
        }, 500);

        setTimeout(async () => {
            if (state.fileId) {
                const ok = await activatePdfjs();
                if (ok) {
                    if (state.totalPages) previewTotalPages.textContent = state.totalPages;
                    updateFormatDisplay();
                }
            }
        }, 2500);

        setTimeout(async () => {
            addLog('🔍 Поиск прямой ZIP-ссылки...');
            const zipLink = await findZipLink();
            if (zipLink) {
                state.directLink = zipLink;
                addLog(`✅ ZIP найден`);
                setStatus(`📦 Готов — жми "▶▶ Старт"`);
            } else {
                addLog('ℹ️ ZIP нет → JSON fallback');
                setStatus(`📖 Готов (JSON fallback)`);
            }
            updateFormatDisplay();
        }, 3000);

        updateButtons();
        updateTabTitle();
        if (GITHUB_CONFIG.token) addLog('🔑 GitHub токен есть');
    }

    // ============================================================
    // 26. SPA
    // ============================================================
    let currentArtId = artId;
    let urlWatcherLock = false;
    function getArtIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const urlArt = params.get('art');
        if (urlArt) return urlArt;
        const match = window.location.pathname.match(/-(\d+)\/?$/);
        return match ? match[1] : null;
    }
    async function handleUrlChange() {
        if (urlWatcherLock) return;
        urlWatcherLock = true;
        try {
            const newArtId = getArtIdFromUrl();
            if (!newArtId || newArtId === currentArtId) { urlWatcherLock = false; return; }
            addLog(`🔄 Переход...`);
            currentArtId = newArtId; artId = newArtId; fileId = null;
            if (state.autoInterval) { clearTimeout(state.autoInterval); state.autoInterval = null; }
            state.isRunning = false; state.isPaused = false; state.isStopped = true;
            state.downloaded = 0; state.total = 0; state.totalPages = 0;
            state.pageFormats = null; state.pdfMetadata = null;
            state.drmActivated = false; state.fileId = null;
            state.artId = newArtId; state.directLink = null;
            state.bookInfoLoaded = false; state.jsonChapters = []; state.mode = 'zip';
            bookInfo.format = null;
            previewBookTitle.textContent = '⏳ Загрузка...';
            previewBookAuthor.textContent = '...';
            previewTotalPages.textContent = '—';
            previewFormats.textContent = '⏳';
            progressBar.style.width = '0%';
            updateButtons();
            const ok = await fetchBookInfo();
            if (ok) {
                previewBookTitle.textContent = bookInfo.title;
                previewBookAuthor.textContent = bookInfo.author;
                previewTotalPages.textContent = bookInfo.pages;
                state.bookTitle = bookInfo.title; state.bookAuthor = bookInfo.author;
                state.totalPages = bookInfo.pages; state.fileId = bookInfo.fileId;
                state.bookInfoLoaded = true;
                updateFormatDisplay();
                addLog(`✅ "${bookInfo.title}"`);
            }
            if (state.fileId) {
                const drmOk = await activatePdfjs();
                if (drmOk) {
                    if (state.totalPages) previewTotalPages.textContent = state.totalPages;
                    updateFormatDisplay();
                }
                const zipLink = await findZipLink();
                if (zipLink) { state.directLink = zipLink; addLog(`📦 ZIP готов`); }
            }
            updateTabTitle();
        } catch(e) {}
        setTimeout(() => { urlWatcherLock = false; }, 500);
    }
    const _origPushState = history.pushState;
    history.pushState = function() { _origPushState.apply(this, arguments); setTimeout(handleUrlChange, 700); };
    const _origReplaceState = history.replaceState;
    history.replaceState = function() { _origReplaceState.apply(this, arguments); setTimeout(handleUrlChange, 700); };
    window.addEventListener('popstate', () => setTimeout(handleUrlChange, 700));
    let lastTitle = document.title;
    setInterval(() => {
        if (document.title !== lastTitle) { lastTitle = document.title; handleUrlChange(); }
    }, 1500);

    init();
})();
