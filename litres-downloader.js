
/**
 * LitRes Downloader v40.6
 * 🧹 Автоочистка кэша
 * 🎯 ОДНА КНОПКА СТАРТ
 * 🥇 ZIP → fetch(omit) → сохранить ZIP (без распаковки!)
 * 🥈 000.js → PDF сохранить / JSON главы → HTML
 * 🥉 PDF постраничка → JPG/GIF → ZIP
 * ❌ БЕЗ confirm/prompt — 100% автоматом!
 * (c) 2026 Diminssoft
 */

(function fullDownloaderV40() {
    console.log('🚀 LitRes Downloader v40.6');
    document.getElementById('litres_downloader_ui')?.remove();

    // 🧹 Автоочистка
    (function autoPurge() {
        try {
            ['litres-downloader.js','litres-downloader-v29.js','litres-downloader-v30.js',
             'litres-downloader-v31.js','litres-downloader-v32.js','litres-downloader-v33.js',
             'litres-downloader-v34.js','litres-downloader-v35.js','litres-downloader-v36.js',
             'litres-downloader-v37.js','litres-downloader-v38.js','litres-downloader-v40.js'
            ].forEach(function(f) {
                fetch('https://purge.jsdelivr.net/gh/dimasik-debug/Share@main/' + f, { mode: 'no-cors' })
                    .then(function(){ console.log('✅ Purge:', f.split('/').pop()); })
                    .catch(function(){});
            });
        } catch(e) {}
    })();

    const S = 1.25;
    const px = (v) => `${Math.round(v * S * 100) / 100}px`;

    // 🛡️ Защита от покупок
    const FORBIDDEN_TEXTS = [
        'купить и скачать','купить и читать','купить за','купить сразу',
        'оформить покупку','оплатить','добавить в корзину','перейти в корзину',
        'купить в подарок','купить сейчас','приобрести','подтвердить покупку','оплатить картой'
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

    // Настройки
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

    // GitHub
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

    // JSZip
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    document.head.appendChild(script);
    let JSZipLoaded = false;
    script.onload = () => { JSZipLoaded = true; console.log('✅ JSZip'); };

    // Тип страницы
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

    // Сессия
    function getCookie(n) {
        const v = `; ${document.cookie}`;
        const p = v.split(`; ${n}=`);
        return p.length === 2 ? p.pop().split(';').shift() : null;
    }
    function updateSession() {
        const s = getCookie('SID'); const ss = getCookie('supersid');
        if (s) sessionData.sessionId = s;
        if (ss) sessionData.supersid = ss;
        return sessionData.sessionId;
    }
    let sessionData = { sessionId: getCookie('SID') || '', supersid: getCookie('supersid') || '' };
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

    // Инфо о книге
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

    async function fetchBookInfo() {
        try {
            const r = await fetch(`https://api.litres.ru/foundation/api/arts/${artId}`,
                { credentials: 'include', headers: getHeaders() });
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

    // Инфо о пользователе
    async function fetchUserInfo() {
        try {
            const r = await fetch(`https://api.litres.ru/foundation/api/users/me/detailed`,
                { credentials: 'include', headers: getHeaders() });
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

    // PDF активация (постраничка)
    async function activatePdfjs() {
        if (!state.fileId) return false;
        try {
            const r = await fetch(
                `https://api.litres.ru/foundation/api/arts/files/${state.fileId}/link?index=1&is_trial=false`,
                { credentials: 'include', headers: getHeaders() });
            if (!r.ok) return false;
            const d = await r.json();
            const jsUrl = d?.payload?.data?.link || d?.payload?.link;
            if (!jsUrl) return false;
            const jr = await fetch(jsUrl, { credentials: 'omit' });
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

    // Скачивание файла
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

    // Поиск ZIP-ссылки
    async function findZipLink() {
        const fid = state.fileId || bookInfo.fileId;
        if (!fid) return null;
        for (const url of [
            `https://api.litres.ru/foundation/api/arts/files/${fid}/link?is_trial=false`,
            `https://api.litres.ru/foundation/api/arts/files/${fid}/link?resource=bin&is_trial=false`,
            `https://api.litres.ru/foundation/api/arts/files/${fid}/link?resource=zip&is_trial=false`
        ]) {
            try {
                const r = await fetch(url, { credentials: 'include', headers: getHeaders() });
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
                        addLog(`📖 Формат: ${fmt.icon} ${fmt.name}`);
                    }
                    return link;
                }
            } catch(e) {}
        }
        return null;
    }

    // ZIP через fetch с omit
    async function fetchZipBlob(url) {
        try {
            console.log('📥 fetch(omit):', url.substring(0, 100));
            const r = await fetch(url, { credentials: 'omit', mode: 'cors' });
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

    // Детект контента (PDF как Blob!)
    async function detectContentType(url) {
        try {
            console.log('🔍 detect:', url.substring(0, 80));
            const r = await fetch(url, { credentials: 'include' });
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
            return { type: 'fetch-error', error: e.message };
        }
    }

    // Парсер JSON
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
            const r = await fetch(`https://www.litres.ru/download_book_subscr/${state.artId}/${fid}/json/${n}.js`,
                { credentials: 'include' });
            if (!r.ok) return null;
            const text = await r.text();
            if (!text || text.length < 10) return null;
            return litJsonToHtml(parseLitFile(text));
        } catch(e) { return null; }
    }

    // HTML из JSON глав
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
<div class="footer">📚 LitRes Downloader v40.6<br>Всего глав: ${chapters.length} • © 2026 Diminssoft</div>
</body></html>`;
    }

    // Инструменты
    let toolsBlob = null;
    async function downloadTools() {
        if (toolsBlob) return toolsBlob;
        for (const url of TOOLS_URLS) {
            try {
                const r = await fetch(url, { credentials: 'omit', mode: 'cors' });
                if (!r.ok) continue;
                toolsBlob = await r.blob();
                return toolsBlob;
            } catch(e) {}
        }
        return null;
    }

    // UI
    document.body.insertAdjacentHTML('beforeend', `
        <div id="litres_downloader_ui" style="position: fixed; bottom: ${px(16)}; right: ${px(16)}; z-index: 99999; background: #fff; color: #1a2a4a; border-radius: ${px(14)}; padding: ${px(14)} ${px(16)}; font-family: 'Segoe UI', Arial, sans-serif; font-size: ${px(12)}; width: ${px(390)}; box-shadow: 0 ${px(8)} ${px(32)} rgba(0,0,0,0.15); border: 1px solid rgba(26,42,74,0.08); user-select: none; max-height: 95vh; overflow-y: auto;">
            <div style="display: flex; align-items: center; gap: ${px(8)}; margin-bottom: ${px(10)};">
                <div style="font-size: ${px(20)};">📚</div>
                <div style="flex: 1;">
                    <div style="font-weight: 800; font-size: ${px(14)}; line-height: 1.1;">LitRes <span style="color: #1a5a9a;">Downloader</span></div>
                    <div style="font-size: ${px(9)}; color: #8a9aaa; text-transform: uppercase;">v40.6 • 100% автоматом</div>
                </div>
                <button id="btn_github" style="background: #24292e; color: #fff; border: none; cursor: pointer; font-size: ${px(12)}; padding: ${px(4)} ${px(8)}; border-radius: ${px(6)}; font-weight: 700;" title="GitHub токен">🔑</button>
                <button id="close_ui" style="background: rgba(26,42,74,0.05); border: none; color: #8a9aaa; cursor: pointer; font-size: ${px(14)}; padding: ${px(3)} ${px(7)}; border-radius: ${px(6)};">✕</button>
            </div>

            <div style="background: #f0f7ff; border-radius: ${px(8)}; padding: ${px(8)} ${px(10)}; margin-bottom: ${px(8)}; border-left: ${px(3)} solid #1a5a9a; font-size: ${px(11)}; line-height: 1.4;">
                <div style="font-weight: 700; margin-bottom: ${px(2)};" id="preview_book_title">${bookInfo.title}</div>
                <div style="color: #4a6a8a;">✍️ <span id="preview_book_author">${bookInfo.author}</span></div>
                <div style="color: #4a6a8a; margin-top: ${px(2)};">📄 <span id="preview_total_pages">${bookInfo.pages || '—'}</span> стр. • <span id="preview_formats">⏳</span></div>
            </div>

            <div id="user_info_block" style="background: #f8faff; border-radius: ${px(8)}; padding: ${px(8)} ${px(10)}; margin-bottom: ${px(8)}; border: 1px solid #e8eef4; font-size: ${px(10)}; color: #4a6a8a; line-height: 1.5;">
                <div style="font-weight: 700; font-size: ${px(11)}; color: #1a2a4a; margin-bottom: ${px(4)};">👤 Аккаунт</div>
                <div id="user_info_text">⏳ Загрузка...</div>
            </div>

            <div style="background: #f0f4fa; border-radius: ${px(8)}; padding: ${px(8)} ${px(10)}; margin-bottom: ${px(8)};">
                <div style="display: flex; align-items: center; gap: ${px(8)}; margin-bottom: ${px(6)};">
                    <div id="hand_animation" style="font-size: ${px(20)}; width: ${px(28)}; text-align: center; transition: transform 0.8s cubic-bezier(0.34,1.56,0.64,1);">🖐️</div>
                    <div style="flex: 1; min-width: 0;">
                        <div id="reading_status" style="font-weight: 600; font-size: ${px(11)}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">📖 Готов</div>
                        <div id="reading_progress_text" style="font-size: ${px(10)}; color: #6a8aaa;">Прогресс: 0%</div>
                    </div>
                    <div id="page_counter" style="font-size: ${px(14)}; font-weight: 700; color: #1a5a9a;">0/0</div>
                </div>
                <div style="width: 100%; height: ${px(6)}; background: #e8eef4; border-radius: ${px(3)}; overflow: hidden; margin-bottom: ${px(6)};">
                    <div id="progress_bar" style="width: 0%; height: 100%; background: linear-gradient(90deg,#1a5a9a,#4a8af4); border-radius: ${px(3)}; transition: width 0.4s;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: ${px(10)}; color: #6a8aaa; margin-bottom: ${px(4)};">
                    <span id="progress_text">📥 0 из 0</span>
                    <span id="percent_text" style="font-weight: 700; color: #1a5a9a;">0%</span>
                </div>
                <div id="log_status" style="font-size: ${px(10)}; color: #6a8aaa; background: #e8eef4; padding: ${px(3)} ${px(6)}; border-radius: ${px(4)}; max-height: ${px(52)}; overflow-y: auto; font-family: 'Courier New', monospace; line-height: 1.3;">⏳ Загрузка...</div>
            </div>

            <div style="display: flex; gap: ${px(4)}; margin-bottom: ${px(6)};">
                <button id="btn_start" style="flex: 3; padding: ${px(12)} ${px(6)}; background: #27ae60; color: #fff; border: none; border-radius: ${px(6)}; cursor: pointer; font-weight: 700; font-size: ${px(13)};">▶ Старт</button>
                <button id="btn_pause" style="flex: 1; padding: ${px(12)} ${px(6)}; background: #e8eef4; color: #6a8aaa; border: none; border-radius: ${px(6)}; cursor: pointer; font-weight: 700; font-size: ${px(11)};">⏸</button>
                <button id="btn_stop" style="flex: 1; padding: ${px(12)} ${px(6)}; background: #f0f2f4; color: #8a9aaa; border: 1px solid #dce2e8; border-radius: ${px(6)}; cursor: pointer; font-weight: 700; font-size: ${px(11)};">⏹</button>
            </div>

            <div style="display: flex; align-items: center; gap: ${px(8)}; padding: ${px(5)} ${px(8)}; background: #f8faff; border-radius: ${px(6)}; border: 1px solid #e8eef4; margin-bottom: ${px(6)}; font-size: ${px(11)};">
                <label style="display: flex; align-items: center; gap: ${px(6)}; cursor: pointer; font-weight: 600;">
                    <input type="checkbox" id="force_mode" style="width: ${px(14)}; height: ${px(14)}; accent-color: #e74c3c; cursor: pointer;">
                    ⚡ FORCE
                </label>
                <label id="tools_label" style="display: flex; align-items: center; gap: ${px(6)}; cursor: pointer; font-weight: 600;">
                    <input type="checkbox" id="add_tools" ${addToolsDefault ? 'checked' : ''} style="width: ${px(14)}; height: ${px(14)}; accent-color: #27ae60; cursor: pointer;">
                    📦 Tools
                </label>
                <div id="force_status" style="margin-left: auto; font-size: ${px(10)}; color: #8a9aaa; background: #e8eef4; padding: ${px(1)} ${px(6)}; border-radius: ${px(8)};">⏸ выкл</div>
            </div>

            <div id="status_text" style="font-size: ${px(10)}; color: #6a8aaa; text-align: center; padding: ${px(4)} 0 ${px(2)}; border-top: 1px solid #e8eef4; min-height: ${px(16)};">⏳ Загрузка...</div>
            <div id="zip_info" style="font-size: ${px(10)}; color: #8aaaac; text-align: center; margin-top: ${px(2)}; display: none;">📦 ...</div>
        </div>
    `);

    const $ = id => document.getElementById(id);
    const ui = $('litres_downloader_ui');
    const closeBtn = $('close_ui');
    const btnGitHub = $('btn_github');
    const btnStart = $('btn_start');
    const btnPause = $('btn_pause');
    const btnStop = $('btn_stop');
    const progressBar = $('progress_bar');
    const progressText = $('progress_text');
    const percentText = $('percent_text');
    const statusText = $('status_text');
    const zipInfo = $('zip_info');
    const handAnimation = $('hand_animation');
    const readingStatus = $('reading_status');
    const readingProgressText = $('reading_progress_text');
    const pageCounter = $('page_counter');
    const logStatus = $('log_status');
    const previewTotalPages = $('preview_total_pages');
    const previewBookTitle = $('preview_book_title');
    const previewBookAuthor = $('preview_book_author');
    const previewFormats = $('preview_formats');
    const forceMode = $('force_mode');
    const forceStatus = $('force_status');
    const userInfoText = $('user_info_text');
    const addToolsCheckbox = $('add_tools');
    const toolsLabel = $('tools_label');

    let state = {
        isRunning: false, isPaused: false, isStopped: false,
        downloaded: 0, total: 0, startPage: 1, endPage: 10,
        bookTitle: bookInfo.title, bookAuthor: bookInfo.author,
        totalPages: bookInfo.pages || 0,
        errors: 0, zip: null, failedPages: [], consecutiveErrors: 0,
        fileId: fileId, artId: artId,
        lastSaveTime: 0, forceMode: false,
        bookInfoLoaded: false, directLink: null,
        pdfMetadata: null, pageFormats: null, drmActivated: false,
        addTools: addToolsDefault, autoInterval: null,
        mode: 'zip', jsonChapters: [], jsonEmptyStreak: 0,
        skippedChapters: []
    };

    function updateTabTitle() {
        try {
            const p = state.total > 0 ? Math.round((state.downloaded / state.total) * 100) : 0;
            const s = state.bookTitle.length > 25 ? state.bookTitle.substring(0, 25) + '...' : state.bookTitle;
            if (state.isRunning && state.downloaded > 0) document.title = `[${p}%] ${s}`;
            else if (state.isRunning) document.title = `⏳ ${s}`;
            else if (state.downloaded === state.total && state.total > 0) document.title = `✅ ${s}`;
            else document.title = s;
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
    function setReadingStatus(t) { readingStatus.textContent = t; }

    function updateFormatDisplay() {
        const el = previewFormats;
        if (!el) return;
        if (bookInfo.format) {
            el.innerHTML = `${bookInfo.format.icon} <b>${bookInfo.format.name}</b>`;
            el.style.color = '#1a5a9a';
            const isPage = state.pageFormats && state.pageFormats.length > 0;
            const isReady = ['FB2','EPUB','PDF','MOBI','TXT','ZIP'].includes(bookInfo.format.name);
            if (isReady && !isPage) {
                toolsLabel.style.display = 'none';
                state.addTools = false;
            } else {
                toolsLabel.style.display = 'flex';
            }
        } else if (state.pageFormats && state.pageFormats.length > 0) {
            el.innerHTML = `📕 <b>PDF</b> (${state.pageFormats.length} стр.)`;
            el.style.color = '#1a5a9a';
            toolsLabel.style.display = 'flex';
        } else {
            el.innerHTML = '⏳';
            el.style.color = '#8a9aaa';
        }
    }
    function animateHand(a) {
        if (a === 'turn') {
            handAnimation.style.transform = 'translateX(30px) rotate(20deg)';
            setTimeout(() => handAnimation.style.transform = 'translateX(-10px) rotate(-10deg)', 400);
            setTimeout(() => handAnimation.style.transform = 'translateX(0) rotate(0deg)', 800);
        } else if (a === 'hover') {
            handAnimation.style.transform = 'translateX(10px) scale(1.1)';
            setTimeout(() => handAnimation.style.transform = 'translateX(0) scale(1)', 600);
        } else if (a === 'wait') {
            handAnimation.style.transform = 'rotate(-5deg)';
            setTimeout(() => handAnimation.style.transform = 'rotate(5deg)', 500);
            setTimeout(() => handAnimation.style.transform = 'rotate(0deg)', 1000);
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
        progressBar.style.width = `${Math.min(p, 100)}%`;
        progressText.textContent = `📥 ${state.downloaded} из ${state.total}`;
        percentText.textContent = `${p}%`;
        pageCounter.textContent = `${state.downloaded}/${state.total}`;
        readingProgressText.textContent = `Прогресс: ${p}%`;
        updateTabTitle();
    }
    function updateButtons() {
        if (state.isRunning && !state.isPaused) {
            btnStart.disabled = true; btnStart.textContent = '⏳ Идёт...'; btnStart.style.background = '#b0d4b8';
            btnPause.disabled = false; btnPause.style.background = '#f0a500'; btnPause.style.color = '#fff';
            btnStop.disabled = false; btnStop.style.background = '#fce4e4'; btnStop.style.color = '#e74c3c';
        } else if (state.isRunning && state.isPaused) {
            btnStart.disabled = false; btnStart.textContent = '▶ Продолжить'; btnStart.style.background = '#1a3a6a'; btnStart.style.color = '#fff';
            btnPause.disabled = true; btnPause.style.background = '#e8eef4'; btnPause.style.color = '#8a9aaa';
            btnStop.disabled = false; btnStop.style.background = '#fce4e4'; btnStop.style.color = '#e74c3c';
        } else {
            btnStart.disabled = false; btnStart.textContent = '▶ Старт'; btnStart.style.background = '#27ae60'; btnStart.style.color = '#fff';
            btnPause.disabled = true; btnPause.style.background = '#e8eef4'; btnPause.style.color = '#8a9aaa';
            btnStop.disabled = true; btnStop.style.background = '#f0f2f4'; btnStop.style.color = '#b0c0d0';
        }
    }

    // 🆕 Прогресс в GitHub (без confirm!)
    async function saveProgress(force = false) {
        if (!state.zip && state.mode !== 'json') return;
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

    async function getImageUrl(pageNum) {
        if (!state.fileId) return null;
        const apiPage = pageNum - 1;
        const formats = (state.pageFormats && state.pageFormats[apiPage]) ? [state.pageFormats[apiPage]] : ['gif','jpg'];
        for (const ext of formats) {
            try {
                const r = await fetch(`https://api.litres.ru/foundation/api/arts/files/${state.fileId}/link?page_id=${apiPage}&is_trial=false&resolution=w1900&image_type=${ext}`,
                    { credentials: 'include', headers: getHeaders() });
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
            const timeout = setTimeout(() => resolve({ success: false, error: 'Таймаут' }), 30000);
            img.onload = function() {
                clearTimeout(timeout);
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;
                    canvas.getContext('2d').drawImage(img, 0, 0);
                    canvas.toBlob((blob) => {
                        if (blob) { state.zip.file(`page_${String(pageNum).padStart(3,'0')}.${ext}`, blob); resolve({ success: true, size: blob.size }); }
                        else resolve({ success: false, error: 'Конвертация' });
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
    async function finalizeZip() {
        if (!state.zip) return;
        setStatus('📦 Формируем ZIP...');
        zipInfo.style.display = 'block';
        if (state.addTools) {
            addLog('📥 Скачиваем x64.rar...');
            const t = await downloadTools();
            if (t) { state.zip.file(TOOLS_PATH, t); addLog(`✅ Tools: ${(t.size/1024/1024).toFixed(2)} MB`); }
            state.zip.file('tools/README.txt', `LitRes PDF Converter\n1. Распакуй tools/x64.rar\n2. run_auto.bat\n3. ZIP в IN\n4. PDF в OUT\n© 2026 Diminssoft`);
        }
        try {
            const zipBlob = await state.zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
            const safe = state.bookTitle.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100);
            const fileName = `${safe}(${state.startPage}-${state.endPage}).zip`;
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = fileName;
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
            setStatus(`🎉 ${state.downloaded} стр. → ${fileName}`);
            zipInfo.textContent = `✅ ZIP: ${Math.round(zipBlob.size/1024/1024)} MB`;
            zipInfo.style.color = '#1a5a9a';
            await saveProgress(true);
            state.isRunning = false; updateButtons(); updateTabTitle();
        } catch(e) { setStatus(`❌ ${e.message}`, true); }
    }
    async function downloadLoop() {
        if (state.isStopped) return;
        if (state.isPaused) { setStatus('⏸ Пауза'); setTimeout(() => { if (!state.isPaused && state.isRunning) downloadLoop(); }, 1000); return; }
        if (isBookFinished()) { await finalizeZip(); state.isRunning = false; updateButtons(); return; }
        const pageNum = state.startPage + state.downloaded;
        if (pageNum > state.endPage) { await finalizeZip(); state.isRunning = false; updateButtons(); return; }
        setReadingStatus(`📖 Стр. ${pageNum}...`);
        animateHand('wait');
        setStatus(!state.forceMode ? `📖 Стр. ${pageNum}` : `⚡ ${pageNum}`);
        await new Promise(r => setTimeout(r, getReadingDelay()));
        animateHand('turn');
        await new Promise(r => setTimeout(r, 800));
        const result = await downloadPageToZip(pageNum);
        if (!result.success) {
            state.failedPages.push(pageNum); state.errors++; state.consecutiveErrors++;
            addLog(`⚠️ Стр. ${pageNum}`, true);
        } else {
            state.consecutiveErrors = 0; state.downloaded++; updateProgress();
            addLog(`✅ Стр. ${pageNum} (${Math.round(result.size/1024)} KB)`);
        }
        if (state.downloaded % 5 === 0 && state.downloaded > 0) await saveProgress();
        await new Promise(r => setTimeout(r, getRandomPause()));
        state.autoInterval = setTimeout(() => { if (!state.isStopped && !state.isPaused && state.isRunning) downloadLoop(); }, 500);
    }
    async function jsonDownloadLoop() {
        if (state.isStopped) return;
        if (state.isPaused) { setStatus('⏸ Пауза'); setTimeout(() => { if (!state.isPaused && state.isRunning) jsonDownloadLoop(); }, 1000); return; }
        if (state.total > 0 && state.downloaded >= state.total) { await finalizeJsonBook(); return; }

        const n = String(state.downloaded).padStart(3, '0');
        setReadingStatus(`📖 Глава ${n}...`);
        animateHand('wait');
        setStatus(`📖 ${state.downloaded}/${state.total || '?'}`);

        const html = await fetchJsonChapter(state.downloaded);

        // PDF защита
        if (html && html.startsWith('%PDF')) {
            addLog(`⚠️ Вместо глав — PDF → сохраняем`, true);
            const blob = new Blob([html], { type: 'application/pdf' });
            const safe = state.bookTitle.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100);
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${safe}.pdf`;
            document.body.appendChild(a); a.click();
            setTimeout(() => a.remove(), 2000);
            setStatus(`🎉 ${safe}.pdf`);
            state.isRunning = false; updateButtons();
            return;
        }

        if (html === null) {
            state.jsonEmptyStreak++;
            addLog(`⚠️ Глава ${n} пустая (${state.jsonEmptyStreak}/50)`);
            if (state.jsonEmptyStreak >= 50) {
                addLog('🛑 Конец книги (50 пустых подряд)');
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
            addLog(`✅ Глава ${n} — ${html.length} символов`);
        }
        if (state.downloaded > 2000) { await finalizeJsonBook(); return; }
        state.autoInterval = setTimeout(() => { if (!state.isStopped && !state.isPaused && state.isRunning) jsonDownloadLoop(); }, state.forceMode ? 100 : 300);
    }
    async function finalizeJsonBook() {
        if (state.isStopped || !state.jsonChapters.length) { state.isRunning = false; updateButtons(); return; }
        setStatus('📦 Сборка HTML...');
        zipInfo.style.display = 'block';
        if (state.skippedChapters.length > 0) addLog(`⚠️ Пропущено: ${state.skippedChapters.length}`, true);
        const html = buildBookHtml(state.jsonChapters, { title: state.bookTitle, author: state.bookAuthor });
        const safe = state.bookTitle.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100);
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${safe}.html`;
        document.body.appendChild(a); a.click();
        setTimeout(() => a.remove(), 2000);
        const sizeMb = (blob.size/1024/1024).toFixed(2);
        setStatus(`🎉 ${state.jsonChapters.length} глав → ${safe}.html (${sizeMb} MB)`);
        zipInfo.textContent = `✅ ${safe}.html (${sizeMb} MB)`;
        zipInfo.style.color = '#1a5a9a';
        await saveProgress(true);
        state.isRunning = false; updateButtons(); updateTabTitle();
    }

    // 🎯 ГЛАВНАЯ ФУНКЦИЯ (без confirm!)
    async function startSmart() {
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

        updateSession();
        if (!sessionData.sessionId) { setStatus('⚠️ Нет session-id. F5!', true); return; }
        if (!state.fileId) { if (!state.bookInfoLoaded) await fetchBookInfo(); state.fileId = bookInfo.fileId; }
        if (!state.fileId) { setStatus('❌ Нет fileId!', true); return; }

        if (!state.drmActivated) {
            await activatePdfjs();
            if (state.totalPages) previewTotalPages.textContent = state.totalPages;
            updateFormatDisplay();
        }

        const fmtName = bookInfo.format?.name || '';
        const isText = ['FB2','EPUB','TXT','MOBI'].includes(fmtName);
        const isPdfPageByPage = state.pageFormats && state.pageFormats.length > 0;

        addLog(`🔍 Формат=${fmtName || '?'}, ZIP=${!!state.directLink}`);

        // 🥇 ZIP (сохраняем как есть!)
        if (state.directLink && !isPdfPageByPage) {
            addLog(`📦 ZIP в приоритете`);
            const freshLink = await findZipLink();
            if (freshLink) state.directLink = freshLink;
            state.isRunning = true; updateButtons();

            const blob = await fetchZipBlob(state.directLink);

            if (blob) {
                addLog(`✅ Blob: ${(blob.size/1024/1024).toFixed(1)} MB`);
                const m = state.directLink.match(/fname=([^&]+)/);
                const fn = m ? decodeURIComponent(m[1]) : `${state.bookTitle.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100)}.zip`;

                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = fn;
                document.body.appendChild(a); a.click();
                setTimeout(() => a.remove(), 2000);

                setStatus(`🎉 ${fn}`);
                zipInfo.style.display = 'block';
                zipInfo.textContent = `✅ ${fn} (${(blob.size/1024/1024).toFixed(1)} MB)`;
                zipInfo.style.color = '#1a5a9a';
                addLog(`✅ ${fn}`);
                state.isRunning = false; updateButtons();
                return;
            }
            addLog(`⚠️ ZIP недоступен → PDF/JSON`);
            state.isRunning = false; updateButtons();
        }

        // 🥈 000.js (PDF или JSON)
        addLog(`🔍 Проверка 000.js...`);
        setStatus('🔍 Проверка 000.js...');
        const chUrl = `https://www.litres.ru/download_book_subscr/${state.artId}/${state.fileId}/json/000.js`;
        const detected = await detectContentType(chUrl);
        console.log('🔍 detected:', detected.type, detected.status || '');

        // PDF
        if (detected.type === 'pdf') {
            addLog(`📕 PDF-книга → качаем`);
            state.isRunning = true; updateButtons();
            try {
                const blob = detected.blob;
                const safe = state.bookTitle.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100);
                const fileName = `${safe}.pdf`;
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = fileName;
                document.body.appendChild(a); a.click();
                setTimeout(() => a.remove(), 2000);
                const sizeMb = (blob.size/1024/1024).toFixed(2);
                setStatus(`🎉 ${fileName} (${sizeMb} MB)`);
                zipInfo.style.display = 'block';
                zipInfo.textContent = `✅ ${fileName} (${sizeMb} MB)`;
                zipInfo.style.color = '#1a5a9a';
                addLog(`✅ ${fileName}`);
                state.isRunning = false; updateButtons();
                return;
            } catch(e) {
                addLog(`⚠️ PDF: ${e.message}`, true);
                state.isRunning = false; updateButtons();
            }
        }

        // JSON главы
        if (detected.type === 'json' || detected.type === 'json-obj') {
            addLog(`📖 JSON главы → HTML`);
            state.mode = 'json';
            state.jsonChapters = [];
            state.jsonEmptyStreak = 0;
            state.skippedChapters = [];
            state.downloaded = 0;
            state.total = 999;
            state.isRunning = true; state.isPaused = false; state.isStopped = false;
            state.startPage = 0; state.endPage = 999;
            updateProgress();
            setStatus(`📖 Загрузка глав...`);
            setReadingStatus('📖 Открываем читалку...');
            animateHand('hover');
            updateButtons();
            setTimeout(jsonDownloadLoop, 500);
            return;
        }

        // 🥉 PDF постраничка (ВСЕ страницы автоматом!)
        if (isPdfPageByPage) {
            addLog(`📕 PDF постраничка (${state.pageFormats.length} стр.) — все автоматом`);
            const totalPages = state.totalPages || state.pageFormats.length;
            state.startPage = 1; state.endPage = totalPages; state.total = totalPages;
            state.downloaded = 0; state.errors = 0; state.consecutiveErrors = 0;
            state.failedPages = []; state.isRunning = true; state.isPaused = false; state.isStopped = false;
            state.mode = 'zip'; state.zip = new JSZip();
            updateProgress();
            setStatus(`🚀 1-${totalPages}`);
            setReadingStatus('📖 Открываем книгу...');
            animateHand('hover'); updateButtons();
            setTimeout(downloadLoop, 1500);
            return;
        }

        setStatus(`❌ Не удалось определить способ`, true);
        state.isRunning = false; updateButtons();
    }

    function stopDownload() {
        state.isStopped = true; state.isRunning = false; state.isPaused = false;
        if (state.autoInterval) { clearTimeout(state.autoInterval); state.autoInterval = null; }
        setStatus(`⏹ Стоп. ${state.downloaded}`);
        setReadingStatus('⏹ Прервано');
        if (state.downloaded > 0) saveProgress(true);
        updateButtons();
    }
    function pauseDownload() {
        if (state.isRunning && !state.isPaused) {
            state.isPaused = true;
            if (state.autoInterval) { clearTimeout(state.autoInterval); state.autoInterval = null; }
            setStatus('⏸ Пауза');
            setReadingStatus('⏸ Пауза');
            animateHand('wait'); updateButtons();
            saveProgress();
        }
    }
    function setupGitHub() {
        if (askForGitHubToken()) { addLog('✅ GitHub токен сохранён'); }
    }

    btnStart.addEventListener('click', startSmart);
    btnPause.addEventListener('click', pauseDownload);
    btnStop.addEventListener('click', stopDownload);
    btnGitHub.addEventListener('click', setupGitHub);
    closeBtn.addEventListener('click', () => {
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

    window.downloaderUI = {
        version: 'v40.6',
        start: startSmart,
        pause: pauseDownload,
        stop: stopDownload,
        state: state,
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
        buildBookHtml: buildBookHtml
    };

    async function init() {
        setStatus('⏳ Загрузка...');
        addLog(`🔍 Тип: ${pageType}`);

        const ok = await fetchBookInfo();
        if (ok) {
            previewBookTitle.textContent = bookInfo.title;
            previewBookAuthor.textContent = bookInfo.author;
            previewTotalPages.textContent = bookInfo.pages;
            state.bookTitle = bookInfo.title;
            state.bookAuthor = bookInfo.author;
            state.totalPages = bookInfo.pages;
            state.bookInfoLoaded = true;
            if (bookInfo.fileId) state.fileId = bookInfo.fileId;
            setStatus(`✅ "${bookInfo.title}"`);
            addLog(`✅ ${bookInfo.pages} стр.`);
            if (bookInfo.format) {
                updateFormatDisplay();
                addLog(`📖 Формат: ${bookInfo.format.name}`);
            }
        }

        setTimeout(async () => {
            const u = await fetchUserInfo();
            if (u) {
                let h = `<div>👤 <b>${u.id}</b>`;
                if (u.login) h += ` • ${u.login}`;
                h += `</div>`;
                if (u.email) h += `<div style="font-size: ${px(9)};">📧 ${u.email} ${u.isEmailConfirmed ? '✅' : '⚠️'}</div>`;
                if (u.subscription) {
                    const till = new Date(u.subscription.validTill);
                    const dl = Math.ceil((till - new Date()) / 86400000);
                    const dc = dl < 3 ? '#e74c3c' : (dl < 7 ? '#f0a500' : '#27ae60');
                    h += `<div style="margin-top: ${px(6)}; padding-top: ${px(6)}; border-top: 1px dashed #d4e2f0;">`;
                    h += `<div><b>${u.subscription.isTrial ? '🎁 Trial' : '⭐ Активна'}</b></div>`;
                    h += `<div style="font-size: ${px(9)};">📅 ${till.toLocaleDateString('ru-RU')} • <span style="color: ${dc}; font-weight: 700;">${dl} дн.</span></div>`;
                    h += `</div>`;
                }
                userInfoText.innerHTML = h;
            }
        }, 500);

        setTimeout(async () => {
            if (state.fileId) {
                await activatePdfjs();
                if (state.totalPages) previewTotalPages.textContent = state.totalPages;
                updateFormatDisplay();
            }
        }, 2500);

        setTimeout(async () => {
            addLog('🔍 Поиск ZIP-ссылки...');
            const link = await findZipLink();
            if (link) {
                state.directLink = link;
                addLog(`✅ ZIP найден`);
                setStatus(`📦 Готов — жми "▶ Старт"`);
            } else {
                addLog('ℹ️ ZIP нет → PDF/JSON');
                setStatus(`📖 Готов — жми "▶ Старт"`);
            }
            updateFormatDisplay();
        }, 3000);

        updateButtons();
        console.log(`✅ v40.6 загружен!`);
    }

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
            addLog('🔄 Переход...');
            currentArtId = newArtId; artId = newArtId; fileId = null;
            if (state.autoInterval) { clearTimeout(state.autoInterval); state.autoInterval = null; }
            state.isRunning = false; state.isPaused = false; state.isStopped = true;
            state.downloaded = 0; state.total = 0; state.totalPages = 0;
            state.pageFormats = null; state.drmActivated = false;
            state.fileId = null; state.artId = newArtId; state.directLink = null;
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
            }
            if (state.fileId) {
                await activatePdfjs();
                updateFormatDisplay();
                const link = await findZipLink();
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

    init();
})();
