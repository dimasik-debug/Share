/**
 * LitRes Downloader v45.3
 * 🔥 База: v42 (проверенная — всё качает!)
 * ➕ Добавлено: 🗕 Minimize · ✅ Баннер с форматом · 🔁 Повторить · ✅ Таб · 🚀 АВТО
 * ❌ Логика загрузки НЕ ТРОНУТА
 * (c) 2026 Diminssoft
 */

(function fullDownloaderV453() {
    console.log('%c🚀 LitRes Downloader v45.3 (based on v42)', 'color:#4a8af4;font-size:16px;font-weight:bold;');
    document.getElementById('litres_downloader_ui')?.remove();
    document.getElementById('litres_mini')?.remove();

    // 🧹 Автоочистка
    (function autoPurge() {
        try {
            ['litres-downloader.js','litres-downloader-v29.js','litres-downloader-v30.js',
             'litres-downloader-v31.js','litres-downloader-v32.js','litres-downloader-v33.js',
             'litres-downloader-v34.js','litres-downloader-v35.js','litres-downloader-v36.js',
             'litres-downloader-v37.js','litres-downloader-v38.js','litres-downloader-v40.js',
             'litres-downloader-v40.7.js','litres-downloader-v42.js','litres-downloader-v43.js',
             'litres-downloader-v44.js','litres-downloader-v45.js'
            ].forEach(function(f) {
                fetch('https://purge.jsdelivr.net/gh/dimasik-debug/Share@main/' + f, { mode: 'no-cors' })
                    .then(function(){ console.log('✅ Purge:', f.split('/').pop()); })
                    .catch(function(){});
            });
        } catch(e) {}
    })();

    const S = 1.25;
    const px = (v) => `${Math.round(v * S * 100) / 100}px`;

    // ═══ 🔊 ЗВУКИ ═══
    const Sound = {
        ctx: null, enabled: true, masterGain: null,
        init() { if (this.ctx) return; try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.masterGain = this.ctx.createGain(); this.masterGain.gain.value = 0.35; this.masterGain.connect(this.ctx.destination); } catch(e) { this.enabled = false; } },
        note(f, d = 0.35, v = 0.15, delay = 0, type = 'sine') { if (!this.enabled) return; this.init(); if (!this.ctx) return; try { if (this.ctx.state === 'suspended') this.ctx.resume(); const t = this.ctx.currentTime + delay; const o = this.ctx.createOscillator(), g = this.ctx.createGain(), fl = this.ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 3500; fl.Q.value = 0.7; o.type = type; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.04); g.gain.setValueAtTime(v, t + d * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(fl); fl.connect(g); g.connect(this.masterGain); o.start(t); o.stop(t + d + 0.05); } catch(e) {} },
        chord(fs, d = 0.5, v = 0.12, type = 'sine') { fs.forEach((f, i) => this.note(f, d + i * 0.05, v * (1 - i * 0.15), i * 0.03, type)); },
        glide(a, b, d = 0.3, v = 0.12) { if (!this.enabled) return; this.init(); if (!this.ctx) return; try { if (this.ctx.state === 'suspended') this.ctx.resume(); const t = this.ctx.currentTime; const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(a, t); o.frequency.exponentialRampToValueAtTime(b, t + d); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(this.masterGain); o.start(t); o.stop(t + d + 0.05); } catch(e) {} },
        click()     { this.note(587, 0.12, 0.08, 0, 'sine'); },
        start()     { this.chord([349, 440, 523], 0.5, 0.10); },
        pageDone()  { this.note(784, 0.25, 0.10, 0, 'sine'); this.note(988, 0.25, 0.08, 0.06, 'sine'); },
        chapterDone(){ this.note(880, 0.2, 0.09, 0, 'sine'); this.note(1109, 0.25, 0.07, 0.05, 'sine'); },
        trackDone() { this.note(784, 0.3, 0.12, 0, 'sine'); this.note(988, 0.3, 0.10, 0.08, 'sine'); this.note(1175, 0.4, 0.08, 0.16, 'sine'); },
        complete()  { this.chord([523, 659, 784, 1047], 0.8, 0.10, 'triangle'); this.glide(523, 1047, 0.6, 0.06); },
        error()     { this.note(294, 0.35, 0.09, 0, 'sine'); this.note(247, 0.5, 0.07, 0.15, 'sine'); },
        save()      { this.note(1047, 0.15, 0.06, 0, 'triangle'); },
        stall()     { this.note(220, 0.4, 0.07, 0, 'sawtooth'); this.note(196, 0.5, 0.06, 0.2, 'sawtooth'); },
        zip()       { this.note(1319, 0.12, 0.06, 0, 'triangle'); this.note(1568, 0.18, 0.05, 0.06, 'triangle'); },
        warn()      { this.note(440, 0.2, 0.07, 0, 'triangle'); this.note(349, 0.3, 0.06, 0.1, 'triangle'); }
    };

    // 🛡️ Защита от покупок
    const FORBIDDEN_TEXTS = ['купить и скачать','купить и читать','купить за','купить сразу','оформить покупку','оплатить','добавить в корзину','перейти в корзину','купить в подарок','купить сейчас','приобрести','подтвердить покупку','оплатить картой'];
    const PRICE_PATTERN = /(\d[\d\s]*\s*(₽|руб|rub|р\.))/i;
    function isForbiddenClick(el) {
        if (!el || !el.textContent) return false;
        if (el.closest && (el.closest('#litres_downloader_ui') || el.closest('#litres_mini'))) return false;
        const text = (el.textContent || '').trim().toLowerCase();
        for (const bad of FORBIDDEN_TEXTS) if (text === bad || text.startsWith(bad + ' ') || text.startsWith(bad + '\n')) return true;
        try {
            let parent = el.closest('div, section, article, aside, form, li, main'); let maxUp = 4;
            while (parent && maxUp > 0) {
                if (parent.id === 'litres_downloader_ui' || parent.id === 'litres_mini') break;
                const pt = (parent.textContent || '').toLowerCase();
                if (PRICE_PATTERN.test(pt) && (pt.includes('купить') || pt.includes('корзин') || pt.includes('оплат'))) if (el.tagName === 'BUTTON' || el.role === 'button') return true;
                parent = parent.parentElement; maxUp--;
            }
        } catch(e) {}
        const testid = (el.getAttribute && el.getAttribute('data-testid')) || '';
        if (testid && /sale|buy|cart|purchase|payment/i.test(testid)) return true;
        return false;
    }
    const _origClick = HTMLElement.prototype.click;
    HTMLElement.prototype.click = function() { if (isForbiddenClick(this)) return; return _origClick.apply(this, arguments); };
    const _origAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
        if (type === 'click' && this instanceof HTMLElement && isForbiddenClick(this)) return;
        return _origAddEventListener.apply(this, arguments);
    };
    document.addEventListener('click', (e) => {
        const target = e.target.closest('button, [role="button"], a'); if (!target) return;
        if (isForbiddenClick(target)) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); return false; }
    }, true);
    new MutationObserver((mutations) => {
        for (const m of mutations) for (const node of m.addedNodes) {
            if (node.nodeType === 1) {
                const buttons = node.matches?.('button, [role="button"], a') ? [node] : Array.from(node.querySelectorAll?.('button, [role="button"], a') || []);
                for (const btn of buttons) if (isForbiddenClick(btn)) { btn.style.pointerEvents = 'none'; btn.style.opacity = '0.5'; }
            }
        }
    }).observe(document.body, { childList: true, subtree: true });
    console.log('🛡️ Защита от покупок активна!');

    // Настройки
    const TOOLS_URLS = ['https://cdn.jsdelivr.net/gh/dimasik-debug/Share@main/x64.rar','https://raw.githubusercontent.com/dimasik-debug/Share/main/x64.rar'];
    const TOOLS_PATH = 'tools/x64.rar';
    const GITHUB_CONFIG = { repo: 'dimasik-debug/Share', path: 'books/progress/', token: localStorage.getItem('github_token') || '' };
    const SOUND_KEY = 'litres_sound_enabled';
    const MINI_KEY = 'litres_minimized';
    const AUTOSTART_KEY = 'litres_autostart';

    function askForGitHubToken() {
        const token = prompt('🔑 GitHub Personal Access Token:\n\nSettings → Developer settings → Personal access tokens → Tokens (classic)', localStorage.getItem('github_token') || '');
        if (token && token.trim()) { GITHUB_CONFIG.token = token.trim(); localStorage.setItem('github_token', token.trim()); return true; }
        return false;
    }
    async function saveProgressToGitHub(bookId, data) {
        if (!GITHUB_CONFIG.token) return false;
        const path = `${GITHUB_CONFIG.path}${bookId}.json`;
        const jsonString = JSON.stringify(data, null, 2);
        const encoded = new TextEncoder().encode(jsonString);
        let binary = ''; for (let i = 0; i < encoded.length; i++) binary += String.fromCharCode(encoded[i]);
        const content = btoa(binary);
        try {
            let sha = '';
            try { const r = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.repo}/contents/${path}`, { headers: { 'Authorization': `token ${GITHUB_CONFIG.token}` } }); if (r.ok) sha = (await r.json()).sha; } catch(e) {}
            const resp = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.repo}/contents/${path}`, { method: 'PUT', headers: { 'Authorization': `token ${GITHUB_CONFIG.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `📚 ${data.book_title}`, content, sha: sha || undefined }) });
            return resp.ok;
        } catch(e) { return false; }
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
    else { const m = window.location.pathname.match(/-(\d+)\/?$/); if (m) { artId = m[1]; fileId = null; pageType = 'book'; } }
    if (!artId) { alert('❌ Не нашёл artId'); return; }

    function getCookie(n) { const v = `; ${document.cookie}`; const p = v.split(`; ${n}=`); return p.length === 2 ? p.pop().split(';').shift() : null; }
    let sessionData = { sessionId: getCookie('SID') || '', supersid: getCookie('supersid') || '' };
    function updateSession() { const s = getCookie('SID'); const ss = getCookie('supersid'); if (s) sessionData.sessionId = s; if (ss) sessionData.supersid = ss; return sessionData.sessionId; }
    function getHeaders() {
        return {
            'accept': 'application/json, text/plain, */*', 'accept-language': 'ru,en;q=0.9', 'accept-version': '2',
            'app-id': '115', 'client-host': 'www.litres.ru',
            'session-id': sessionData.sessionId, 'supersid': sessionData.supersid,
            'ui-currency': 'RUB', 'ui-language-code': 'ru',
            'x-request-id': Date.now().toString(36) + Math.random().toString(36).substring(2)
        };
    }

    let bookInfo = { title: 'Неизвестная книга', author: 'Неизвестный автор', pages: 0, fileId: fileId, artId: artId, source: '', format: null };

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
            const r = await fetch(`https://api.litres.ru/foundation/api/arts/${artId}`, { credentials: 'include', headers: getHeaders() });
            if (!r.ok) return false;
            const d = await r.json(); const p = d?.payload?.data; if (!p) return false;
            let pages = 0; const symbols = p.symbols_count || 0;
            if (p.files?.length) {
                const main = p.files.find(f => !f.is_additional);
                if (main?.pages) pages = main.pages;
                if (main) { const fmt = detectFormatFromName(main.filename) || detectFormatFromMime(main.mime) || detectFormatFromName(main.extension); if (fmt) bookInfo.format = fmt; }
            }
            if (!pages && p.additional_info?.current_pages_or_seconds) pages = p.additional_info.current_pages_or_seconds;
            if (!pages && symbols > 0) pages = Math.round(symbols / 2800);
            let author = 'Неизвестный автор';
            if (p.persons?.length) { const a = p.persons.find(x => x.role === 'author'); author = a?.full_name || p.persons[0].full_name || author; }
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
            const r = await fetch(`https://api.litres.ru/foundation/api/users/me/detailed`, { credentials: 'include', headers: getHeaders() });
            if (!r.ok) return null;
            const d = await r.json(); const p = d?.payload?.data; if (!p) return null;
            const sub = p.subscription || {}, acc = p.account || {}, prof = p.profile || {};
            return {
                id: p.id, login: p.login,
                email: prof.email || null, isEmailConfirmed: prof.is_email_confirmed || false,
                subscription: sub.is_active ? { isTrial: sub.is_trial_period || false, validTill: sub.valid_till, price: sub.price || null, planName: sub.plan_name || null, autoRenew: sub.prolongation_status === 'enabled' } : null,
                account: { display: acc.display || 0, real: acc.real || 0, bonus: acc.bonus || 0 }
            };
        } catch(e) { return null; }
    }

    // PDF активация (как в v42 — С index=1)
    async function activatePdfjs() {
        if (!state.fileId) return false;
        try {
            const r = await fetch(`https://api.litres.ru/foundation/api/arts/files/${state.fileId}/link?index=1&is_trial=false`, { credentials: 'include', headers: getHeaders() });
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

    // Поиск ZIP-ссылки — КАК В v42 БЕЗ ИЗМЕНЕНИЙ
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
                    if (fmt && (!bookInfo.format || bookInfo.format.name !== fmt.name)) { bookInfo.format = fmt; updateFormatDisplay(); addLog(`📖 Формат: ${fmt.icon} ${fmt.name}`); }
                    return link;
                }
            } catch(e) {}
        }
        return null;
    }

    // ZIP через fetch с omit — КАК В v42
    async function fetchZipBlob(url) {
        try {
            const r = await fetch(url, { credentials: 'omit', mode: 'cors' });
            if (!r.ok) return null;
            const blob = await r.blob();
            if (blob.size < 100) return null;
            return blob;
        } catch(e) { return null; }
    }

    // Детект контента — КАК В v42
    async function detectContentType(url) {
        try {
            const r = await fetch(url, { credentials: 'include' });
            if (!r.ok) return { type: 'error', status: r.status };
            const blob = await r.blob();
            const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
            const headStr = String.fromCharCode(...head);
            if (headStr === '%PDF-') return { type: 'pdf', blob };
            const text = await blob.text();
            const trimmed = text.trim();
            if (trimmed.startsWith('[')) return { type: 'json', text };
            if (trimmed.startsWith('{')) return { type: 'json-obj', text };
            return { type: 'unknown', text: trimmed.substring(0, 100) };
        } catch(e) { return { type: 'fetch-error', error: e.message }; }
    }

    function parseLitFile(text) {
        const clean = text.trim().replace(/;\s*$/, '');
        try { return new Function('return (' + clean + ')')(); }
        catch(e) { const s = clean.indexOf('['); const e2 = clean.lastIndexOf(']'); if (s >= 0 && e2 > s) return new Function('return (' + clean.slice(s, e2 + 1) + ')')(); throw e; }
    }
    function escHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
    function litJsonToHtml(nodes) {
        if (!Array.isArray(nodes)) { if (typeof nodes === 'string') return escHtml(nodes); if (nodes && typeof nodes === 'object') return litJsonToHtml(nodes.c || []); return ''; }
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
        const fid = state.fileId; if (!fid) return null;
        const n = String(num).padStart(3, '0');
        try {
            const r = await fetch(`https://www.litres.ru/download_book_subscr/${state.artId}/${fid}/json/${n}.js`, { credentials: 'include' });
            if (!r.ok) return null;
            const text = await r.text();
            if (!text || text.length < 10) return null;
            return litJsonToHtml(parseLitFile(text));
        } catch(e) { return null; }
    }
    function buildBookHtml(chapters, meta) {
        const safeTitle = escHtml(meta.title || 'Книга');
        const safeAuthor = escHtml(meta.author || 'Неизвестный автор');
        return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>${safeTitle}</title><style>*{box-sizing:border-box;}body{font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.7;max-width:720px;margin:0 auto;padding:60px 30px;background:#fafafa;color:#222;}h1.book-title{font-size:32px;margin:0 0 10px;color:#1a2a4a;border-bottom:3px solid #1a5a9a;padding-bottom:15px;}h2{font-size:24px;margin:50px 0 20px;color:#1a2a4a;page-break-before:always;}h2:first-of-type{page-break-before:auto;}h3{font-size:20px;margin:30px 0 15px;color:#2a4a6a;}p{margin:14px 0;text-align:justify;}em{font-style:italic;}strong{font-weight:bold;}.meta{color:#6a8aaa;font-size:14px;margin-bottom:40px;padding-bottom:20px;border-bottom:1px solid #ddd;}.footer{margin-top:80px;padding-top:20px;border-top:1px solid #ddd;font-size:12px;color:#aab8c4;text-align:center;}@media print{body{padding:0;background:#fff;}h2{page-break-before:always;}}</style></head><body><h1 class="book-title">${safeTitle}</h1><div class="meta">✍️ ${safeAuthor}</div>${chapters.map((h, i) => `<!-- Глава ${String(i).padStart(3,'0')} -->\n${h}`).join('\n')}<div class="footer">📚 LitRes Downloader v45.3<br>Всего глав: ${chapters.length} • © 2026 Diminssoft</div></body></html>`;
    }

    let toolsBlob = null;
    async function downloadTools() {
        if (toolsBlob) return toolsBlob;
        for (const url of TOOLS_URLS) { try { const r = await fetch(url, { credentials: 'omit', mode: 'cors' }); if (!r.ok) continue; toolsBlob = await r.blob(); return toolsBlob; } catch(e) {} }
        return null;
    }
    function triggerDownload(blob, filename) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename; a.style.display = 'none';
        document.body.appendChild(a); a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 3000);
    }

    // ═══════════════════════════════════════════════════════════
    // UI (тёмная тема как в Suno + minimize + баннер + авто)
    // ═══════════════════════════════════════════════════════════
    document.body.insertAdjacentHTML('beforeend', `
        <style>
            @keyframes ldl-mini-in{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
            @keyframes ldl-in{from{opacity:0;transform:translateY(20px) scale(.96);}to{opacity:1;transform:translateY(0) scale(1);}}
            #litres_mini{animation:ldl-mini-in .3s cubic-bezier(.16,1,.3,1);position:fixed;bottom:16px;right:16px;z-index:99999;background:#000;border:1px solid rgba(255,255,255,.08);border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.7);display:none;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;transition:all .2s ease;font-family:'Segoe UI',Arial,sans-serif;}
            #litres_mini:hover{box-shadow:0 16px 48px rgba(74,138,244,.4);transform:translateY(-1px);}
            #litres_downloader_ui{animation:ldl-in .35s cubic-bezier(.16,1,.3,1);position:fixed;bottom:16px;right:16px;z-index:99999;background:#0e0e10;color:#fff;font-family:'Segoe UI',Arial,sans-serif;width:400px;max-width:calc(100vw - 32px);border-radius:20px;border:1px solid rgba(255,255,255,.08);box-shadow:0 24px 80px rgba(0,0,0,.8);overflow:hidden;display:flex;flex-direction:column;max-height:calc(100vh - 32px);user-select:none;font-size:13px;}
            #litres_downloader_ui *{box-sizing:border-box;}
            #litres_downloader_ui ::-webkit-scrollbar{width:6px;}
            #litres_downloader_ui ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:3px;}
            .ldl-header{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.08);flex-shrink:0;}
            .ldl-logo{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#1a5a9a,#4a8af4);display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 16px rgba(74,138,244,.35);flex-shrink:0;}
            .ldl-title{font-weight:700;font-size:15px;letter-spacing:-.2px;line-height:1.15;}
            .ldl-title .accent{color:#4a8af4;}
            .ldl-subtitle{font-size:10px;color:rgba(255,255,255,.4);letter-spacing:.3px;text-transform:uppercase;margin-top:2px;}
            .ldl-icon-btn{width:30px;height:30px;padding:0;border-radius:9px;background:rgba(255,255,255,.06);color:rgba(255,255,255,.7);border:none;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;}
            .ldl-icon-btn:hover{background:rgba(255,255,255,.12);color:#fff;}
            .ldl-body{padding:12px 16px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:10px;}
            .ldl-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:10px 12px;font-size:11px;line-height:1.5;}
            .ldl-card.book-card{background:linear-gradient(135deg,rgba(74,138,244,.08),rgba(74,138,244,.03));border-left:3px solid #4a8af4;}
            .ldl-card-title{font-weight:700;font-size:12px;margin-bottom:4px;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
            .ldl-card-row{color:rgba(255,255,255,.6);font-size:11px;margin-top:2px;}
            .ldl-card-label{font-size:10px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin-bottom:6px;}
            .ldl-progress-box{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:12px;}
            .ldl-status-row{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
            .ldl-hand{font-size:22px;width:32px;text-align:center;transition:transform .8s cubic-bezier(.34,1.56,.64,1);flex-shrink:0;}
            .ldl-status-text{flex:1;min-width:0;}
            .ldl-status-main{font-weight:600;font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
            .ldl-status-phase{font-size:10px;color:rgba(255,255,255,.4);font-family:'SF Mono',Consolas,monospace;margin-top:1px;}
            .ldl-counter{font-size:15px;font-weight:700;color:#4a8af4;font-family:'SF Mono',Consolas,monospace;flex-shrink:0;}
            .ldl-bar{width:100%;height:6px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden;margin-bottom:8px;}
            .ldl-bar-fill{height:100%;width:0%;background:linear-gradient(90deg,#1a5a9a,#4a8af4);border-radius:3px;transition:width .4s ease;}
            .ldl-progress-info{display:flex;justify-content:space-between;font-size:10px;color:rgba(255,255,255,.5);font-family:'SF Mono',Consolas,monospace;margin-bottom:8px;}
            .ldl-progress-info .pct{font-weight:700;color:#4a8af4;}
            .ldl-log{font-size:10px;color:rgba(255,255,255,.55);background:rgba(0,0,0,.4);padding:8px 10px;border-radius:8px;max-height:70px;overflow-y:auto;font-family:'SF Mono',Consolas,monospace;line-height:1.5;border:1px solid rgba(255,255,255,.05);word-break:break-word;}
            .ldl-result{display:none;padding:12px 14px;background:linear-gradient(135deg,rgba(39,174,96,.15),rgba(46,204,113,.08));border:1.5px solid rgba(39,174,96,.4);border-radius:12px;font-size:11px;line-height:1.6;}
            .ldl-result-title{font-weight:800;font-size:13px;color:#2ecc71;margin-bottom:6px;}
            .ldl-result-line{color:rgba(255,255,255,.8);}
            .ldl-result-line b{color:#fff;}
            .ldl-result-line .fmt{color:#4a8af4;}
            .ldl-buttons{display:flex;gap:6px;padding:0 16px 12px;flex-shrink:0;}
            .ldl-btn{padding:12px 14px;border-radius:10px;border:none;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;}
            .ldl-btn-main{flex:3;background:linear-gradient(135deg,#27ae60,#2ecc71);color:#fff;box-shadow:0 4px 16px rgba(46,204,113,.35);}
            .ldl-btn-main:hover:not(:disabled){box-shadow:0 6px 20px rgba(46,204,113,.5);transform:translateY(-1px);}
            .ldl-btn-main.repeat{background:linear-gradient(135deg,#1a5a9a,#4a8af4);box-shadow:0 4px 16px rgba(74,138,244,.4);}
            .ldl-btn-main.repeat:hover:not(:disabled){box-shadow:0 6px 20px rgba(74,138,244,.55);}
            .ldl-btn-main:disabled{opacity:.4;cursor:not-allowed;transform:none;box-shadow:none;}
            .ldl-btn-pause{flex:1;background:rgba(255,255,255,.06);color:rgba(255,255,255,.7);border:1px solid rgba(255,255,255,.08);}
            .ldl-btn-pause:hover:not(:disabled){background:rgba(240,165,0,.15);color:#f0a500;}
            .ldl-btn-pause:disabled{opacity:.3;cursor:not-allowed;}
            .ldl-btn-stop{flex:1;background:rgba(255,255,255,.06);color:rgba(255,255,255,.7);border:1px solid rgba(255,255,255,.08);}
            .ldl-btn-stop:hover:not(:disabled){background:rgba(231,76,60,.15);color:#e74c3c;}
            .ldl-btn-stop:disabled{opacity:.3;cursor:not-allowed;}
            .ldl-toggles{display:flex;align-items:center;gap:12px;padding:10px 14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px;margin:0 16px 10px;font-size:11px;flex-wrap:wrap;flex-shrink:0;}
            .ldl-toggle{display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-weight:600;color:rgba(255,255,255,.75);transition:color .2s;user-select:none;}
            .ldl-toggle:hover{color:#fff;}
            .ldl-toggle input{width:14px;height:14px;cursor:pointer;margin:0;accent-color:#4a8af4;}
            .ldl-toggle.force input{accent-color:#e74c3c;}
            .ldl-toggle.auto input{accent-color:#27ae60;}
            .ldl-force-status{margin-left:auto;font-size:10px;color:rgba(255,255,255,.5);background:rgba(255,255,255,.06);padding:2px 8px;border-radius:8px;font-family:'SF Mono',Consolas,monospace;}
            .ldl-force-status.on{color:#e74c3c;background:rgba(231,76,60,.15);}
            .ldl-footer{padding:0 16px 14px;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:rgba(255,255,255,.4);flex-shrink:0;gap:8px;}
            #status_text{flex:1;text-align:center;font-family:'SF Mono',Consolas,monospace;}
            #zip_info{color:rgba(255,255,255,.5);font-family:'SF Mono',Consolas,monospace;display:none;}
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
                    <div class="ldl-subtitle">v45.3 · based on v42</div>
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
                            <div class="ldl-status-main" id="reading_status">📖 Готов</div>
                            <div class="ldl-status-phase" id="reading_progress_text">Прогресс: 0%</div>
                        </div>
                        <div class="ldl-counter" id="page_counter">0/0</div>
                    </div>
                    <div class="ldl-bar"><div class="ldl-bar-fill" id="progress_bar"></div></div>
                    <div class="ldl-progress-info"><span id="progress_text">📥 0 из 0</span><span class="pct" id="percent_text">0%</span></div>
                    <div class="ldl-log" id="log_status">⏳ Загрузка...</div>
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
                <label class="ldl-toggle force"><input type="checkbox" id="force_mode">⚡ FORCE</label>
                <label class="ldl-toggle auto" title="Автоматически нажать Старт при загрузке страницы"><input type="checkbox" id="autostart_mode">🚀 АВТО</label>
                <div class="ldl-force-status" id="force_status">⏸ выкл</div>
            </div>

            <div class="ldl-footer">
                <span id="status_text">⏳ Загрузка...</span>
                <span id="zip_info">📦 ...</span>
            </div>
        </div>
    `);

    const $ = id => document.getElementById(id);
    const ui = $('litres_downloader_ui');
    const mini = $('litres_mini');
    const miniStatus = $('litres_mini_status');
    const miniBadge = $('litres_mini_badge');
    const btnSound = $('btn_sound');
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

    Sound.enabled = localStorage.getItem(SOUND_KEY) !== 'false';
    btnSound.textContent = Sound.enabled ? '🔊' : '🔇';

    let state = {
        isRunning: false, isPaused: false, isStopped: false, isStarting: false,
        phase: 'idle',
        downloaded: 0, total: 0, startPage: 1, endPage: 10,
        bookTitle: bookInfo.title, bookAuthor: bookInfo.author, totalPages: bookInfo.pages || 0,
        errors: 0, zip: null, failedPages: [], consecutiveErrors: 0,
        fileId: fileId, artId: artId, lastSaveTime: 0, forceMode: false,
        bookInfoLoaded: false, directLink: null,
        pdfMetadata: null, pageFormats: null, drmActivated: false,
        autoInterval: null, mode: 'zip', jsonChapters: [], jsonEmptyStreak: 0, skippedChapters: [],
        minimized: false, resultFormat: null, resultFilename: null
    };
    try { state.minimized = localStorage.getItem(MINI_KEY) === '1'; } catch(e) {}

    function updateTabTitle() {
        try {
            const p = state.total > 0 ? Math.round((state.downloaded / state.total) * 100) : 0;
            const s = state.bookTitle.length > 25 ? state.bookTitle.substring(0, 25) + '...' : state.bookTitle;
            if (state.phase === 'done') document.title = `✅ ${s}`;
            else if (state.phase === 'error') document.title = `❌ ${s}`;
            else if (state.isRunning && state.downloaded > 0) document.title = `[${p}%] ${s}`;
            else if (state.isRunning) document.title = `⏳ ${s}`;
            else document.title = s;
        } catch(e) {}
    }
    function updateMini() {
        if (!mini) return;
        if (state.minimized) { ui.style.display = 'none'; mini.style.display = 'flex'; }
        else { ui.style.display = 'flex'; mini.style.display = 'none'; }
        try { localStorage.setItem(MINI_KEY, state.minimized ? '1' : '0'); } catch(e) {}
        if (state.phase === 'done') { miniStatus.textContent = `✅ ${state.resultFormat || 'готово'}`; miniBadge.style.display = 'block'; miniBadge.textContent = '✅'; miniBadge.style.background = '#27ae60'; }
        else if (state.phase === 'error') { miniStatus.textContent = '❌ ошибка'; miniBadge.style.display = 'none'; }
        else if (state.isRunning) { miniStatus.textContent = `${state.downloaded}/${state.total}`; if (state.total > 0) { miniBadge.style.display = 'block'; miniBadge.textContent = `${Math.round(state.downloaded/state.total*100)}%`; miniBadge.style.background = '#4a8af4'; } }
        else { miniStatus.textContent = 'готов'; miniBadge.style.display = 'none'; }
    }
    function setPhase(phase) { state.phase = phase; updateMini(); updateTabTitle(); }
    function addLog(text, isError = false) {
        const time = new Date().toLocaleTimeString();
        logStatus.textContent = `${isError ? '❌' : 'ℹ️'} [${time}] ${text}`;
        console.log(`[LOG] ${text}`);
        logStatus.style.color = isError ? '#e74c3c' : 'rgba(255,255,255,.55)';
    }
    function setStatus(text, isError = false) {
        statusText.textContent = text;
        statusText.style.color = isError ? '#e74c3c' : (state.phase === 'done' ? '#2ecc71' : 'rgba(255,255,255,.4)');
        addLog(text, isError);
    }
    function setReadingStatus(t) { readingStatus.textContent = t; }

    function updateFormatDisplay() {
        const el = previewFormats; if (!el) return;
        if (bookInfo.format) { el.innerHTML = `${bookInfo.format.icon} <b style="color:#4a8af4;">${bookInfo.format.name}</b>`; }
        else if (state.pageFormats && state.pageFormats.length > 0) { el.innerHTML = `📕 <b style="color:#4a8af4;">PDF</b> (${state.pageFormats.length} стр.)`; }
        else { el.innerHTML = '⏳'; }
    }
    function animateHand(a) {
        if (a === 'turn') { handAnimation.style.transform = 'translateX(30px) rotate(20deg)'; setTimeout(() => handAnimation.style.transform = 'translateX(-10px) rotate(-10deg)', 400); setTimeout(() => handAnimation.style.transform = 'translateX(0) rotate(0deg)', 800); }
        else if (a === 'hover') { handAnimation.style.transform = 'translateX(10px) scale(1.1)'; setTimeout(() => handAnimation.style.transform = 'translateX(0) scale(1)', 600); }
        else if (a === 'wait') { handAnimation.style.transform = 'rotate(-5deg)'; setTimeout(() => handAnimation.style.transform = 'rotate(5deg)', 500); setTimeout(() => handAnimation.style.transform = 'rotate(0deg)', 1000); }
        else { handAnimation.textContent = a; handAnimation.style.transform = 'scale(1.3)'; setTimeout(() => handAnimation.style.transform = 'scale(1)', 250); }
    }
    function getReadingDelay() { if (state.forceMode) return Math.random() * 300 + 200; const base = Math.random() * 5000 + 3000; if (Math.random() < 0.15) return base + Math.random() * 10000 + 5000; return base; }
    function getRandomPause() { if (state.forceMode) return Math.random() * 200 + 100; if (Math.random() < 0.2) return Math.random() * 10000 + 5000; return Math.random() * 3000 + 1000; }
    function updateProgress() {
        const p = state.total > 0 ? Math.round((state.downloaded / state.total) * 100) : 0;
        progressBar.style.width = `${Math.min(p, 100)}%`;
        progressText.textContent = `📥 ${state.downloaded} из ${state.total}`;
        percentText.textContent = `${p}%`;
        pageCounter.textContent = `${state.downloaded}/${state.total}`;
        readingProgressText.textContent = `Прогресс: ${p}%`;
        updateTabTitle(); updateMini();
    }
    function updateButtons() {
        const repeat = state.phase === 'done' || state.phase === 'error';
        if (repeat) {
            btnStart.disabled = false; btnStart.textContent = '🔁 Повторить'; btnStart.classList.add('repeat');
            btnPause.disabled = true; btnStop.disabled = true;
        } else if (state.isRunning && !state.isPaused) {
            btnStart.disabled = true; btnStart.textContent = '⏳ Идёт...'; btnStart.classList.remove('repeat');
            btnPause.disabled = false; btnStop.disabled = false;
        } else if (state.isRunning && state.isPaused) {
            btnStart.disabled = false; btnStart.textContent = '▶ Продолжить'; btnStart.classList.remove('repeat');
            btnPause.disabled = true; btnStop.disabled = false;
        } else {
            btnStart.disabled = false; btnStart.textContent = '▶ Старт'; btnStart.classList.remove('repeat');
            btnPause.disabled = true; btnStop.disabled = true;
        }
    }
    function showResult(format, filename, size) {
        state.resultFormat = format; state.resultFilename = filename;
        const sz = size > 1048576 ? (size/1048576).toFixed(2)+' MB' : (size/1024).toFixed(0)+' KB';
        $('result_text').innerHTML = `<div class="ldl-result-line">📁 <b>${filename}</b></div><div class="ldl-result-line">📄 Формат: <span class="fmt"><b>${format}</b></span></div><div class="ldl-result-line">📦 Размер: <b>${sz}</b></div><div style="margin-top:6px;font-size:10px;color:rgba(255,255,255,.5);">Файл в папке «Загрузки»</div>`;
        $('result_banner').style.display = 'block';
        setPhase('done'); setReadingStatus('✅ Файл скачан'); animateHand('✅');
        updateButtons(); updateTabTitle(); Sound.complete();
    }
    function resetForRepeat() {
        $('result_banner').style.display = 'none';
        Object.assign(state, { downloaded: 0, errors: 0, consecutiveErrors: 0, failedPages: [], jsonChapters: [], jsonEmptyStreak: 0, skippedChapters: [], zip: null, isStopped: false, isPaused: false, isRunning: false, isStarting: false, resultFormat: null, resultFilename: null });
        setPhase('idle');
        progressBar.style.width = '0%'; progressText.textContent = '📥 0 из 0'; percentText.textContent = '0%'; pageCounter.textContent = '0/0';
        setReadingStatus('📖 Готов'); animateHand('🖐️');
        updateButtons(); updateTabTitle(); setStatus('Готов к повторному запуску');
    }

    async function saveProgress(force = false) {
        if (state.downloaded === 0 || !GITHUB_CONFIG.token) return;
        const now = Date.now();
        if (!force && now - state.lastSaveTime < 30000) return;
        state.lastSaveTime = now;
        await saveProgressToGitHub(state.artId, { book_id: state.artId, book_title: state.bookTitle, book_author: state.bookAuthor, file_id: state.fileId, total_pages: state.total, downloaded_pages: state.downloaded, mode: state.mode, last_update: new Date().toISOString() });
    }

    async function getImageUrl(pageNum) {
        if (!state.fileId) return null;
        const apiPage = pageNum - 1;
        const formats = (state.pageFormats && state.pageFormats[apiPage]) ? [state.pageFormats[apiPage]] : ['gif','jpg'];
        for (const ext of formats) {
            try {
                const r = await fetch(`https://api.litres.ru/foundation/api/arts/files/${state.fileId}/link?page_id=${apiPage}&is_trial=false&resolution=w1900&image_type=${ext}`, { credentials: 'include', headers: getHeaders() });
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
            const img = new Image(); img.crossOrigin = 'anonymous';
            const timeout = setTimeout(() => resolve({ success: false, error: 'Таймаут' }), 30000);
            img.onload = function() {
                clearTimeout(timeout);
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth || img.width; canvas.height = img.naturalHeight || img.height;
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
    function isBookFinished() { return state.consecutiveErrors >= 20 || state.downloaded >= state.total || state.errors >= 50; }

    async function finalizePageZip() {
        if (!state.zip) return;
        setStatus('📦 Формируем ZIP со страницами...');
        Sound.zip();
        zipInfo.style.display = 'inline';
        addLog('📥 Скачиваем x64.rar...');
        const t = await downloadTools();
        if (t) { state.zip.file(TOOLS_PATH, t); addLog(`✅ Tools: ${(t.size/1048576).toFixed(2)} MB`); }
        state.zip.file('tools/README.txt', `LitRes PDF Converter\n1. Распакуй tools/x64.rar\n2. run_auto.bat\n3. ZIP в IN\n4. PDF в OUT\n© 2026 Diminssoft`);
        state.zip.file('book_info.txt', `Название: ${state.bookTitle}\nАвтор: ${state.bookAuthor}\nartId: ${state.artId}\nfileId: ${state.fileId}\nСтраниц: ${state.downloaded}/${state.total}\nФормат: JPG/GIF постранично\nДата: ${new Date().toLocaleString('ru-RU')}\nСкачано через LitRes Downloader v45.3`);
        try {
            const zipBlob = await state.zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
            const safe = state.bookTitle.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100);
            const fileName = `${safe}(${state.startPage}-${state.endPage}).zip`;
            triggerDownload(zipBlob, fileName);
            zipInfo.textContent = `✅ ZIP: ${Math.round(zipBlob.size/1048576)} MB`;
            const extUsed = state.pageFormats && state.pageFormats[0] ? state.pageFormats[0].toUpperCase() : 'JPG';
            showResult(`JPG/GIF (${extUsed})`, fileName, zipBlob.size);
            await saveProgress(true);
        } catch(e) { setStatus(`❌ ${e.message}`, true); setPhase('error'); Sound.error(); }
        state.isRunning = false; updateButtons();
    }

    async function downloadLoop() {
        if (state.isStopped) return;
        if (state.isPaused) { setStatus('⏸ Пауза'); setTimeout(() => { if (!state.isPaused && state.isRunning) downloadLoop(); }, 1000); return; }
        if (isBookFinished()) { await finalizePageZip(); state.isRunning = false; updateButtons(); return; }
        const pageNum = state.startPage + state.downloaded;
        if (pageNum > state.endPage) { await finalizePageZip(); state.isRunning = false; updateButtons(); return; }
        setReadingStatus(`📖 Стр. ${pageNum}...`);
        animateHand('wait');
        setStatus(!state.forceMode ? `📖 Стр. ${pageNum}` : `⚡ ${pageNum}`);
        await new Promise(r => setTimeout(r, getReadingDelay()));
        animateHand('turn');
        await new Promise(r => setTimeout(r, 800));
        const result = await downloadPageToZip(pageNum);
        if (!result.success) { state.failedPages.push(pageNum); state.errors++; state.consecutiveErrors++; addLog(`⚠️ Стр. ${pageNum}`, true); Sound.warn(); }
        else { state.consecutiveErrors = 0; state.downloaded++; updateProgress(); addLog(`✅ Стр. ${pageNum} (${Math.round(result.size/1024)} KB)`); Sound.pageDone(); }
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
        if (html && html.startsWith('%PDF')) {
            addLog(`⚠️ Вместо глав — PDF → сохраняем в ZIP`, true);
            const blob = new Blob([html], { type: 'application/pdf' });
            const safe = state.bookTitle.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100);
            if (!state.zip) state.zip = new JSZip();
            state.zip.file(`${safe}.pdf`, blob);
            try {
                const zipBlob = await state.zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
                triggerDownload(zipBlob, `${safe}.zip`);
                showResult('PDF (в ZIP)', `${safe}.zip`, zipBlob.size);
            } catch(e) { setStatus('❌ ' + e.message, true); }
            state.isRunning = false; updateButtons();
            return;
        }
        if (html === null) {
            state.jsonEmptyStreak++;
            addLog(`⚠️ Глава ${n} пустая (${state.jsonEmptyStreak}/50)`);
            if (state.jsonEmptyStreak >= 50) { addLog('🛑 Конец книги (50 пустых подряд)'); await finalizeJsonBook(); return; }
            await new Promise(r => setTimeout(r, 500));
            state.skippedChapters.push(state.downloaded); state.downloaded++; updateProgress();
        } else {
            state.jsonEmptyStreak = 0;
            state.jsonChapters.push(html); state.downloaded++; updateProgress();
            addLog(`✅ Глава ${n} — ${html.length} символов`);
            Sound.chapterDone();
        }
        if (state.downloaded > 2000) { await finalizeJsonBook(); return; }
        state.autoInterval = setTimeout(() => { if (!state.isStopped && !state.isPaused && state.isRunning) jsonDownloadLoop(); }, state.forceMode ? 100 : 300);
    }

    async function finalizeJsonBook() {
        if (state.isStopped || !state.jsonChapters.length) { state.isRunning = false; updateButtons(); return; }
        setStatus('📦 Сборка HTML → ZIP...');
        Sound.zip();
        zipInfo.style.display = 'inline';
        if (state.skippedChapters.length > 0) addLog(`⚠️ Пропущено: ${state.skippedChapters.length}`, true);
        const html = buildBookHtml(state.jsonChapters, { title: state.bookTitle, author: state.bookAuthor });
        const safe = state.bookTitle.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100);
        if (!state.zip) state.zip = new JSZip();
        state.zip.file(`${safe}.html`, html);
        state.zip.file('book_info.txt', `Название: ${state.bookTitle}\nАвтор: ${state.bookAuthor}\nartId: ${state.artId}\nfileId: ${state.fileId}\nГлав: ${state.jsonChapters.length}\nПропущено: ${state.skippedChapters.length}\nФормат: HTML (собран из JSON-глав LitRes)\nДата: ${new Date().toLocaleString('ru-RU')}\nСкачано через LitRes Downloader v45.3`);
        try {
            const zipBlob = await state.zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
            const zipName = `${safe}.zip`;
            triggerDownload(zipBlob, zipName);
            zipInfo.textContent = `✅ ${zipName} (${(zipBlob.size/1048576).toFixed(2)} MB)`;
            showResult(`HTML (${state.jsonChapters.length} глав)`, zipName, zipBlob.size);
            await saveProgress(true);
        } catch(e) { setStatus('❌ ' + e.message, true); setPhase('error'); Sound.error(); }
        state.isRunning = false; updateButtons();
    }

    async function finalizePdfToZip(pdfBlob) {
        setStatus('📦 PDF → ZIP...');
        Sound.zip();
        const safe = state.bookTitle.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100);
        const zip = new JSZip();
        zip.file(`${safe}.pdf`, pdfBlob);
        zip.file('book_info.txt', `Название: ${state.bookTitle}\nАвтор: ${state.bookAuthor}\nartId: ${state.artId}\nfileId: ${state.fileId}\nФормат: PDF\nДата: ${new Date().toLocaleString('ru-RU')}\nСкачано через LitRes Downloader v45.3`);
        try {
            const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
            const zipName = `${safe}.zip`;
            triggerDownload(zipBlob, zipName);
            zipInfo.style.display = 'inline';
            zipInfo.textContent = `✅ ${zipName} (${(zipBlob.size/1048576).toFixed(2)} MB)`;
            showResult('PDF (в ZIP)', zipName, zipBlob.size);
        } catch(e) { setStatus('❌ ' + e.message, true); setPhase('error'); Sound.error(); }
    }

    // 🎯 ГЛАВНАЯ ФУНКЦИЯ — логика КАК В v42, только добавлен guard + updateButtons
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
        try {
            Sound.start();
            if (!JSZipLoaded) {
                setStatus('⏳ JSZip...', true);
                await new Promise(resolve => { const c = setInterval(() => { if (JSZipLoaded) { clearInterval(c); resolve(); } }, 200); setTimeout(() => { clearInterval(c); resolve(); }, 5000); });
            }
            updateSession();
            if (!sessionData.sessionId) { setStatus('⚠️ Нет session-id. F5!', true); Sound.error(); return; }
            if (!state.fileId) { if (!state.bookInfoLoaded) await fetchBookInfo(); state.fileId = bookInfo.fileId; }
            if (!state.fileId) { setStatus('❌ Нет fileId!', true); Sound.error(); return; }
            if (!state.drmActivated) {
                await activatePdfjs();
                if (state.totalPages) previewTotalPages.textContent = state.totalPages;
                updateFormatDisplay();
            }
            const fmtName = bookInfo.format?.name || '';
            const isPdfPageByPage = state.pageFormats && state.pageFormats.length > 0;
            addLog(`🔍 Формат=${fmtName || '?'}, ZIP=${!!state.directLink}`);

            // 🥇 ZIP
            if (state.directLink && !isPdfPageByPage) {
                addLog(`📦 ZIP в приоритете → сохраняем как есть`);
                const freshLink = await findZipLink();
                if (freshLink) state.directLink = freshLink;
                state.isRunning = true; updateButtons();
                const blob = await fetchZipBlob(state.directLink);
                if (blob) {
                    addLog(`✅ Blob: ${(blob.size/1048576).toFixed(1)} MB`);
                    const m = state.directLink.match(/fname=([^&]+)/);
                    const fn = m ? decodeURIComponent(m[1]) : `${state.bookTitle.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100)}.zip`;
                    triggerDownload(blob, fn);
                    zipInfo.style.display = 'inline';
                    zipInfo.textContent = `✅ ${fn} (${(blob.size/1048576).toFixed(1)} MB)`;
                    const fmtLabel = bookInfo.format ? `${bookInfo.format.icon} ${bookInfo.format.name} (в ZIP)` : 'ZIP';
                    showResult(fmtLabel, fn, blob.size);
                    state.isRunning = false; updateButtons();
                    return;
                }
                addLog(`⚠️ ZIP недоступен → PDF/JSON`);
                state.isRunning = false; updateButtons();
            }

            // 🥈 000.js
            addLog(`🔍 Проверка 000.js...`);
            setStatus('🔍 Проверка 000.js...');
            const chUrl = `https://www.litres.ru/download_book_subscr/${state.artId}/${state.fileId}/json/000.js`;
            const detected = await detectContentType(chUrl);
            console.log('🔍 detected:', detected.type, detected.status || '');

            if (detected.type === 'pdf') {
                addLog(`📕 PDF-книга → упаковываем в ZIP`);
                state.isRunning = true; updateButtons();
                try { await finalizePdfToZip(detected.blob); } catch(e) { addLog(`⚠️ PDF: ${e.message}`, true); Sound.error(); }
                state.isRunning = false; updateButtons();
                return;
            }
            if (detected.type === 'json' || detected.type === 'json-obj') {
                addLog(`📖 JSON главы → HTML → ZIP`);
                state.mode = 'json'; state.jsonChapters = []; state.jsonEmptyStreak = 0; state.skippedChapters = [];
                state.downloaded = 0; state.total = 999;
                state.isRunning = true; state.isPaused = false; state.isStopped = false;
                state.startPage = 0; state.endPage = 999; state.zip = new JSZip();
                updateProgress();
                setStatus(`📖 Загрузка глав...`);
                setReadingStatus('📖 Открываем читалку...'); animateHand('hover');
                updateButtons();
                setTimeout(jsonDownloadLoop, 500);
                return;
            }
            if (isPdfPageByPage) {
                addLog(`📕 PDF постраничка (${state.pageFormats.length} стр.) — все автоматом`);
                const totalPages = state.totalPages || state.pageFormats.length;
                state.startPage = 1; state.endPage = totalPages; state.total = totalPages;
                state.downloaded = 0; state.errors = 0; state.consecutiveErrors = 0; state.failedPages = [];
                state.isRunning = true; state.isPaused = false; state.isStopped = false;
                state.mode = 'zip'; state.zip = new JSZip();
                updateProgress();
                setStatus(`🚀 1-${totalPages}`);
                setReadingStatus('📖 Открываем книгу...'); animateHand('hover'); updateButtons();
                setTimeout(downloadLoop, 1500);
                return;
            }
            setStatus(`❌ Не удалось определить способ`, true);
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
        Sound.warn();
        if (state.downloaded > 0) saveProgress(true);
        updateButtons();
    }
    function pauseDownload() {
        if (state.isRunning && !state.isPaused) {
            state.isPaused = true;
            if (state.autoInterval) { clearTimeout(state.autoInterval); state.autoInterval = null; }
            setStatus('⏸ Пауза'); setReadingStatus('⏸ Пауза');
            animateHand('wait'); updateButtons(); Sound.click();
            saveProgress();
        }
    }
    function setupGitHub() { if (askForGitHubToken()) { addLog('✅ GitHub токен сохранён'); Sound.save(); } }

    // Handlers
    btnStart.addEventListener('click', startSmart);
    btnPause.addEventListener('click', pauseDownload);
    btnStop.addEventListener('click', stopDownload);
    $('btn_github').addEventListener('click', setupGitHub);
    btnSound.addEventListener('click', () => {
        Sound.enabled = !Sound.enabled;
        btnSound.textContent = Sound.enabled ? '🔊' : '🔇';
        localStorage.setItem(SOUND_KEY, Sound.enabled ? 'true' : 'false');
        if (Sound.enabled) Sound.click();
    });
    $('btn_minimize').addEventListener('click', () => { state.minimized = true; updateMini(); Sound.click(); });
    mini.addEventListener('click', () => { state.minimized = false; updateMini(); Sound.click(); });
    $('close_ui').addEventListener('click', () => { stopDownload(); ui.remove(); mini.remove(); });
    forceMode.addEventListener('change', function() {
        state.forceMode = this.checked;
        forceStatus.textContent = this.checked ? '⚡ вкл' : '⏸ выкл';
        if (this.checked) forceStatus.classList.add('on'); else forceStatus.classList.remove('on');
        Sound.click();
    });
    try { $('autostart_mode').checked = localStorage.getItem(AUTOSTART_KEY) === 'true'; } catch(e) {}
    $('autostart_mode').addEventListener('change', function() {
        try { localStorage.setItem(AUTOSTART_KEY, this.checked ? 'true' : 'false'); } catch(e) {}
        Sound.click();
        addLog(this.checked ? '🚀 Автостарт ВКЛ' : '🚀 Автостарт ВЫКЛ');
    });

    window.downloaderUI = {
        version: 'v45.3',
        start: startSmart, pause: pauseDownload, stop: stopDownload,
        state: state, Sound: Sound, addLog: addLog,
        findZipLink: findZipLink, fetchBookInfo: fetchBookInfo, fetchUserInfo: fetchUserInfo,
        activatePdfjs: activatePdfjs, fetchZipBlob: fetchZipBlob, detectContentType: detectContentType,
        parseLitFile: parseLitFile, litJsonToHtml: litJsonToHtml, fetchJsonChapter: fetchJsonChapter, buildBookHtml: buildBookHtml
    };

    async function init() {
        setStatus('⏳ Загрузка...');
        addLog(`🔍 Тип: ${pageType}`);
        updateMini();
        const ok = await fetchBookInfo();
        if (ok) {
            previewBookTitle.textContent = bookInfo.title;
            previewBookAuthor.textContent = bookInfo.author;
            previewTotalPages.textContent = bookInfo.pages;
            state.bookTitle = bookInfo.title; state.bookAuthor = bookInfo.author;
            state.totalPages = bookInfo.pages; state.bookInfoLoaded = true;
            if (bookInfo.fileId) state.fileId = bookInfo.fileId;
            setStatus(`✅ "${bookInfo.title}"`);
            addLog(`✅ ${bookInfo.pages} стр.`);
            if (bookInfo.format) { updateFormatDisplay(); addLog(`📖 Формат: ${bookInfo.format.name}`); }
        }
        setTimeout(async () => {
            const u = await fetchUserInfo();
            if (u) {
                let h = `<div>👤 <b>${u.id}</b>${u.login ? ' • ' + u.login : ''}</div>`;
                if (u.email) h += `<div style="font-size:10px;">📧 ${u.email} ${u.isEmailConfirmed ? '✅' : '⚠️'}</div>`;
                if (u.subscription) {
                    const till = new Date(u.subscription.validTill);
                    const dl = Math.ceil((till - new Date()) / 86400000);
                    const dc = dl < 3 ? '#e74c3c' : (dl < 7 ? '#f0a500' : '#2ecc71');
                    h += `<div style="margin-top:6px; padding-top:6px; border-top:1px dashed rgba(255,255,255,.1);">`;
                    h += `<div><b>${u.subscription.isTrial ? '🎁 Trial' : '⭐ Активна'}</b>${u.subscription.planName ? ' · ' + u.subscription.planName : ''}</div>`;
                    h += `<div style="font-size:10px;">📅 ${till.toLocaleDateString('ru-RU')} • <span style="color:${dc};font-weight:700;">${dl} дн.</span></div>`;
                    h += `</div>`;
                }
                if (u.account) h += `<div style="margin-top:4px;font-size:10px;">💰 Баланс: <b>${u.account.display}</b></div>`;
                userInfoText.innerHTML = h;
            } else { userInfoText.innerHTML = '<div>⚠️ Нет данных</div>'; }
        }, 500);
        setTimeout(async () => {
            if (state.fileId) { await activatePdfjs(); if (state.totalPages) previewTotalPages.textContent = state.totalPages; updateFormatDisplay(); }
        }, 2500);
        setTimeout(async () => {
            addLog('🔍 Поиск ZIP-ссылки...');
            const link = await findZipLink();
            if (link) { state.directLink = link; addLog(`✅ ZIP найден`); setStatus(`📦 Готов — жми "▶ Старт"`); }
            else { addLog('ℹ️ ZIP нет → PDF/JSON'); setStatus(`📖 Готов — жми "▶ Старт"`); }
            updateFormatDisplay();
        }, 3000);
        updateButtons();
        console.log(`%c✅ LitRes Downloader v45.3 загружен!`, 'color:#4ade80;font-weight:bold;font-size:14px;');
    }

    let currentArtId = artId;
    let urlWatcherLock = false;
    function getArtIdFromUrl() { const p = new URLSearchParams(window.location.search); const u = p.get('art'); if (u) return u; const m = window.location.pathname.match(/-(\d+)\/?$/); return m ? m[1] : null; }
    async function handleUrlChange() {
        if (urlWatcherLock) return;
        urlWatcherLock = true;
        try {
            const newArtId = getArtIdFromUrl();
            if (!newArtId || newArtId === currentArtId) { urlWatcherLock = false; return; }
            addLog('🔄 Переход...');
            currentArtId = newArtId; artId = newArtId; fileId = null;
            if (state.autoInterval) { clearTimeout(state.autoInterval); state.autoInterval = null; }
            Object.assign(state, { isRunning: false, isPaused: false, isStopped: true, downloaded: 0, total: 0, totalPages: 0, pageFormats: null, drmActivated: false, fileId: null, artId: newArtId, directLink: null, bookInfoLoaded: false, jsonChapters: [], mode: 'zip', phase: 'idle' });
            bookInfo.format = null;
            previewBookTitle.textContent = '⏳ Загрузка...'; previewBookAuthor.textContent = '...'; previewTotalPages.textContent = '—'; previewFormats.textContent = '⏳';
            progressBar.style.width = '0%';
            updateButtons();
            const ok = await fetchBookInfo();
            if (ok) { previewBookTitle.textContent = bookInfo.title; previewBookAuthor.textContent = bookInfo.author; previewTotalPages.textContent = bookInfo.pages; state.bookTitle = bookInfo.title; state.bookAuthor = bookInfo.author; state.totalPages = bookInfo.pages; state.fileId = bookInfo.fileId; state.bookInfoLoaded = true; updateFormatDisplay(); }
            if (state.fileId) { await activatePdfjs(); updateFormatDisplay(); const link = await findZipLink(); if (link) state.directLink = link; }
            updateTabTitle();
        } catch(e) {}
        setTimeout(() => { urlWatcherLock = false; }, 500);
    }
    const _ps = history.pushState; history.pushState = function() { _ps.apply(this, arguments); setTimeout(handleUrlChange, 700); };
    const _rs = history.replaceState; history.replaceState = function() { _rs.apply(this, arguments); setTimeout(handleUrlChange, 700); };
    window.addEventListener('popstate', () => setTimeout(handleUrlChange, 700));
    let lt = document.title;
    setInterval(() => { if (document.title !== lt) { lt = document.title; handleUrlChange(); } }, 1500);

    init().then(() => {
        const params = new URLSearchParams(window.location.search);
        const urlAuto = params.get('autostart_litres') === '1';
        let lsAuto = false;
        try { lsAuto = localStorage.getItem(AUTOSTART_KEY) === 'true'; } catch(e) {}
        if (urlAuto || lsAuto) {
            console.log(`🚀 Автозапуск (${urlAuto ? 'URL' : 'настройка'})`);
            addLog('🚀 Автостарт через 2 сек...');
            setStatus('🚀 Автостарт...');
            const waitAndStart = async () => {
                let tries = 0;
                while (!state.bookInfoLoaded && tries < 30) { await new Promise(r => setTimeout(r, 200)); tries++; }
                await new Promise(r => setTimeout(r, 2000));
                if (state.isRunning || state.isStarting) { console.log('⚠️ Уже запущено'); return; }
                startSmart();
            };
            setTimeout(waitAndStart, 1500);
        }
    });

})();
