/* === GM-shim (Neurosha auto) === */
(function(){
  if(typeof unsafeWindow==='undefined') window.unsafeWindow=window;
  if(typeof GM_info==='undefined') window.GM_info={script:{name:'converted',version:'1.0'},scriptHandler:'bookmarklet',version:'1.0'};
  if(typeof GM_xmlhttpRequest==='undefined') window.GM_xmlhttpRequest=function(o){
    var m=(o.method||'GET').toUpperCase(),h=o.headers||{},body=o.data;
    fetch(o.url,{method:m,headers:h,body:body,credentials:'include'}).then(function(r){
      return r.text().then(function(t){return{responseText:t,status:r.status,statusText:r.statusText,responseHeaders:'',finalUrl:r.url,r:r};});
    }).then(function(resp){if(o.onload)try{o.onload(resp);}catch(e){}})
     .catch(function(e){if(o.onerror)try{o.onerror(e);}catch(x){}});
    return{abort:function(){}};
  };
  if(typeof GM_setValue==='undefined') window.GM_setValue=function(k,v){try{localStorage.setItem('__gmshim_'+k,JSON.stringify(v));}catch(e){}};
  if(typeof GM_getValue==='undefined') window.GM_getValue=function(k,d){try{var s=localStorage.getItem('__gmshim_'+k);return s==null?d:JSON.parse(s);}catch(e){return d;}};
  if(typeof GM_deleteValue==='undefined') window.GM_deleteValue=function(k){try{localStorage.removeItem('__gmshim_'+k);}catch(e){}};
  if(typeof GM_listValues==='undefined') window.GM_listValues=function(){var r=[];for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf('__gmshim_')===0)r.push(k.slice(9));}return r;};
  if(typeof GM_addStyle==='undefined') window.GM_addStyle=function(css){var s=document.createElement('style');s.textContent=css;(document.head||document.documentElement).appendChild(s);return s;};
  if(typeof GM_openInTab==='undefined') window.GM_openInTab=function(u){return window.open(u,'_blank');};
  if(typeof GM_setClipboard==='undefined') window.GM_setClipboard=function(t){try{navigator.clipboard.writeText(t);}catch(e){}};
  if(typeof GM_download==='undefined') window.GM_download=function(o){var url=typeof o==='string'?o:o.url;var name=(typeof o==='object'&&o.name)||'download';var a=document.createElement('a');a.href=url;a.download=name;a.style.display='none';document.body.appendChild(a);a.click();setTimeout(function(){a.remove();},3000);};
})();
/* === /GM-shim === */

// ==UserScript==
// @name         LitRes Downloader v98
// @namespace    https://github.com/dimasik-debug/Share
// @version      98.0.0
// @description  📚 EPUB по умолчанию · 📖 FB2 опционально · 📦 ZIP опционально · 📕 PDF приоритет · 🎧 аудио в ZIP · ☁️ Яндекс.Диск
// @author       Diminssoft
// @match        https://www.litres.ru/*
// @match        https://litres.ru/*
// @icon         https://www.litres.ru/favicon.ico
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @connect      litres.ru
// @connect      www.litres.ru
// @connect      api.litres.ru
// @connect      cdn.litres.ru
// @connect      cloud-api.yandex.net
// @connect      api.github.com
// @connect      raw.githubusercontent.com
// @connect      cdn.jsdelivr.net
// @connect      cdnjs.cloudflare.com
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function() {
    'use strict';

    // ═══ ЗАЩИТА ОТ ДВОЙНОГО ЗАПУСКА ═══
    if (window.__litresDownloaderLoaded) {
        console.log('%c⚠️ LitRes Downloader уже загружен — перезапускаю', 'color:#f0a500;font-weight:bold;');
        document.getElementById('litres_downloader_ui')?.remove();
        document.getElementById('litres_mini')?.remove();
    }
    window.__litresDownloaderLoaded = true;

    // ═══ ОЖИДАНИЕ DOM И artId ═══
    function boot(fn) {
        const tryStart = () => {
            // Проверяем наличие artId (в URL ?art=... или slug-12345)
            try {
                const p = new URLSearchParams(location.search);
                const hasArt = p.get('art') || location.pathname.match(/-\d+\/?$/);
                if (hasArt) { fn(); return true; }
            } catch (e) {}
            return false;
        };

        if (document.readyState !== 'loading') {
            if (!tryStart()) {
                let waited = 0;
                const t = setInterval(() => {
                    if (tryStart() || (waited += 500) > 15000) clearInterval(t);
                }, 500);
            }
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                if (!tryStart()) {
                    let waited = 0;
                    const t = setInterval(() => {
                        if (tryStart() || (waited += 500) > 15000) clearInterval(t);
                    }, 500);
                }
            }, { once: true });
        }
    }

    // ═══ ЗАПУСК ═══
    boot(() => {
        try {
/**
 * LitRes Downloader v98 — EPUB по умолчанию + ZIP опционально
 * 📖 FB2: HTML-главы + картинки → .fb2 (опционально, заменяет EPUB/ZIP)
 * 📚 EPUB: ПО УМОЛЧАНИЮ для всех текстовых стратегий
 * 📦 ZIP: только если включён чекбокс (или если litres отдаёт ZIP как есть)
 * 🎧 Аудио: всегда в ZIP с метаданными
 * 🎨 Cover вшивается в EPUB + ZIP
 * ☁️ Яндекс.Диск + 🏷️ Жанры + 🚀 автозапуск
 * (c) 2026 Diminssoft
 */

(function fullDownloaderV98() {
    console.log('%c🚀 LitRes Downloader v98', 'color:#4a8af4;font-size:16px;font-weight:bold;');
    console.log('%c📚 EPUB по умолчанию · 📦 ZIP опционально · 🎧 аудио в ZIP', 'color:#9c27b0;font-size:14px;font-weight:bold;');
    document.getElementById('litres_downloader_ui')?.remove();
    document.getElementById('litres_mini')?.remove();

    ['litres-downloader.js','litres-downloader-v95.js','litres-downloader-v96.js','litres-downloader-v97.js','litres-downloader-v97.1.js','litres-downloader-v97.2.js','litres-downloader-v97.3.js'
    ].forEach(f => fetch('https://purge.jsdelivr.net/gh/dimasik-debug/Share@main/' + f, { mode: 'no-cors' }).catch(()=>{}));

    // ═══ 🔊 SOUND ═══
    const Sound = {
        ctx:null, enabled:true, masterGain:null,
        init(){ if(this.ctx) return; try{ this.ctx=new (window.AudioContext||window.webkitAudioContext)(); this.masterGain=this.ctx.createGain(); this.masterGain.gain.value=0.35; this.masterGain.connect(this.ctx.destination);}catch(e){this.enabled=false;} },
        note(f,d=0.35,v=0.15,delay=0,type='sine'){ if(!this.enabled) return; if(this.ctx && this.ctx.state === 'closed') return; this.init(); if(!this.ctx) return; try{ if(this.ctx.state==='suspended') this.ctx.resume(); const t=this.ctx.currentTime+delay; const o=this.ctx.createOscillator(),g=this.ctx.createGain(),fl=this.ctx.createBiquadFilter(); fl.type='lowpass'; fl.frequency.value=3500; fl.Q.value=0.7; o.type=type; o.frequency.setValueAtTime(f,t); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v,t+0.04); g.gain.setValueAtTime(v,t+d*0.6); g.gain.exponentialRampToValueAtTime(0.0001,t+d); o.connect(fl); fl.connect(g); g.connect(this.masterGain); o.start(t); o.stop(t+d+0.05); }catch(e){} },
        chord(fs,d=0.5,v=0.12,type='sine'){ fs.forEach((f,i)=>this.note(f,d+i*0.05,v*(1-i*0.15),i*0.03,type)); },
        glide(a,b,d=0.3,v=0.12){ if(!this.enabled) return; this.init(); if(!this.ctx) return; try{ if(this.ctx.state==='suspended') this.ctx.resume(); const t=this.ctx.currentTime; const o=this.ctx.createOscillator(),g=this.ctx.createGain(); o.type='sine'; o.frequency.setValueAtTime(a,t); o.frequency.exponentialRampToValueAtTime(b,t+d); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v,t+0.05); g.gain.exponentialRampToValueAtTime(0.0001,t+d); o.connect(g); g.connect(this.masterGain); o.start(t); o.stop(t+d+0.05); }catch(e){} },
        click(){ this.note(587,0.12,0.08,0,'sine'); },
        start(){ this.chord([349,440,523],0.5,0.10); },
        pageDone(){ this.note(784,0.25,0.10,0,'sine'); this.note(988,0.25,0.08,0.06,'sine'); },
        chapterDone(){ this.note(880,0.2,0.09,0,'sine'); this.note(1109,0.25,0.07,0.05,'sine'); },
        complete(){ this.chord([523,659,784,1047],0.8,0.10,'triangle'); this.glide(523,1047,0.6,0.06); },
        error(){ this.note(294,0.35,0.09,0,'sine'); this.note(247,0.5,0.07,0.15,'sine'); },
        save(){ this.note(1047,0.15,0.06,0,'triangle'); },
        stall(){ this.note(220,0.4,0.07,0,'sawtooth'); this.note(196,0.5,0.06,0.2,'sawtooth'); },
        zip(){ this.note(1319,0.12,0.06,0,'triangle'); this.note(1568,0.18,0.05,0.06,'triangle'); },
        warn(){ this.note(440,0.2,0.07,0,'triangle'); this.note(349,0.3,0.06,0.1,'triangle'); },
        money(){ this.chord([1047,1319,1568],0.4,0.08,'triangle'); },
        diag(){ this.note(659,0.15,0.06,0,'triangle'); this.note(880,0.15,0.05,0.08,'triangle'); },
        pdf(){ this.note(740,0.2,0.08,0,'triangle'); this.note(988,0.25,0.07,0.1,'triangle'); },
        print(){ this.chord([523,698,880],0.6,0.10,'sine'); },
        cloud(){ this.chord([659,880,1047],0.5,0.09,'triangle'); },
        cloudDone(){ this.chord([880,1047,1319,1568],0.6,0.10,'triangle'); },
        local(){ this.note(698,0.15,0.07,0,'triangle'); this.note(880,0.2,0.06,0.08,'triangle'); },
        recenter(){ this.glide(440,880,0.25,0.08); },
        genre(){ this.chord([587,740,880],0.4,0.09,'triangle'); },
        fb2(){ this.chord([698,880,1047],0.4,0.09,'triangle'); },
        epub(){ this.chord([784,988,1175],0.4,0.09,'triangle'); }
    };
    window.addEventListener('beforeunload', () => { try{ Sound.ctx?.close(); }catch(e){} });

    // ═══ 🛡️ Защита от покупок ═══
    const FORBIDDEN = ['купить и скачать','купить и читать','купить за','купить сразу','оформить покупку','оплатить','добавить в корзину','перейти в корзину','купить в подарок','купить сейчас','приобрести','подтвердить покупку','оплатить картой'];
    const PRICE = /(\d[\d\s]*\s*(₽|руб|rub|р\.))/i;
    function isForbiddenClick(el) {
        if(!el||!el.textContent) return false;
        if(el.closest && (el.closest('#litres_downloader_ui')||el.closest('#litres_mini'))) return false;
        const text=(el.textContent||'').trim().toLowerCase();
        for(const bad of FORBIDDEN) if(text===bad||text.startsWith(bad+' ')||text.startsWith(bad+'\n')) return true;
        try{ let p=el.closest('div, section, article, aside, form, li, main'); let n=4;
            while(p&&n>0){ if(p.id==='litres_downloader_ui'||p.id==='litres_mini') break;
                const pt=(p.textContent||'').toLowerCase();
                if(PRICE.test(pt)&&(pt.includes('купить')||pt.includes('корзин')||pt.includes('оплат'))) if(el.tagName==='BUTTON'||el.role==='button') return true;
                p=p.parentElement; n--; }
        }catch(e){}
        const tid=(el.getAttribute&&el.getAttribute('data-testid'))||'';
        if(tid&&/sale|buy|cart|purchase|payment/i.test(tid)) return true;
        return false;
    }
    const _oc = HTMLElement.prototype.click;
    HTMLElement.prototype.click = function(){ try{ if(isForbiddenClick(this)) return; }catch(e){} return _oc.apply(this,arguments); };
    document.addEventListener('click', e => { const t=e.target.closest('button, [role="button"], a'); if(!t) return; if(isForbiddenClick(t)){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); return false; } }, true);

    // ═══ CONFIG ═══
    const TOOLS_URLS = ['https://cdn.jsdelivr.net/gh/dimasik-debug/Share@main/x64.rar','https://raw.githubusercontent.com/dimasik-debug/Share/main/x64.rar'];
    const TOOLS_PATH = 'tools/x64.rar';
    const GITHUB = { repo:'dimasik-debug/Share', path:'books/progress/', token: localStorage.getItem('github_token')||'' };
    const SOUND_KEY='litres_sound_enabled', MINI_KEY='litres_minimized', AUTOSTART_KEY='litres_autostart';
    const SAVINGS_KEY = 'litres_saved_money';
    const PRINT_MODE_KEY = 'litres_print_pdf_mode';
    const UI_POS_KEY = 'litres_ui_pos';
    const LOCAL_MODE_KEY = 'litres_local_mode';
    const JSON_CHECKPOINT_KEY = 'litres_json_checkpoint';
    const FB2_MODE_KEY = 'litres_fb2_mode';
    const ZIP_MODE_KEY = 'litres_zip_mode';
    const YADISK_TOKEN_KEY = 'litres_yadisk_token';
    const YADISK_FOLDER_KEY = 'litres_yadisk_folder';
    const YADISK_MODE_KEY = 'litres_yadisk_mode';
    const YADISK_PUBLISH_KEY = 'litres_yadisk_publish';
    const YADISK_YEAR_KEY = 'litres_yadisk_year';
    const YADISK_GENRE_KEY = 'litres_yadisk_genre';

    // ═══ SAVINGS ═══
    const SAVINGS = {
        total: 0, currency: 'RUB', books: 0, history: [],
        load(){ try{ const raw = localStorage.getItem(SAVINGS_KEY); if(raw){ const d = JSON.parse(raw); this.total = d.total || 0; this.currency = d.currency || 'RUB'; this.books = d.books || 0; this.history = Array.isArray(d.history) ? d.history : []; console.log(`💰 SAVINGS: ${this.total.toFixed(2)} ${this.currency} (${this.books} книг)`); } }catch(e){} },
        save(){ try{ localStorage.setItem(SAVINGS_KEY, JSON.stringify({ total: this.total, currency: this.currency, books: this.books, history: this.history.slice(-100) })); }catch(e){} },
        add(artId, title, price){ try{ if(!price || price <= 0) return; this.total += price; this.books += 1; this.history.push({ artId, title, price, date: new Date().toISOString() }); this.save(); addLog(`💰 +${formatPrice(price)} · всего ${formatPrice(this.total)}`, 'ok'); try{ Sound.money(); }catch(e){} updateSavingsDisplay(); }catch(e){} },
        reset(){ this.total = 0; this.books = 0; this.history = []; this.save(); updateSavingsDisplay(); addLog('💰 Счётчик сброшен', 'warn'); }
    };

    // ═══ ☁️ YANDEX.DISK ═══
    const YaDisk = {
        token: '', baseFolder: 'Books',
        useYearFolders: true, useGenreFolders: false,
        enabled: false, publish: false,
        apiBase: 'https://cloud-api.yandex.net/v1/disk',

        init(){
            try{
                this.token = localStorage.getItem(YADISK_TOKEN_KEY) || '';
                this.baseFolder = localStorage.getItem(YADISK_FOLDER_KEY) || 'Books';
                this.useYearFolders = localStorage.getItem(YADISK_YEAR_KEY) !== 'false';
                this.useGenreFolders = localStorage.getItem(YADISK_GENRE_KEY) === 'true';
                this.enabled = localStorage.getItem(YADISK_MODE_KEY) === 'true';
                this.publish = localStorage.getItem(YADISK_PUBLISH_KEY) === 'true';
            }catch(e){}
            this.baseFolder = this.baseFolder.replace(/^\/?/, '/').replace(/\/?$/, '');
            console.log(`☁️ YaDisk: токен ${this.token?'✅':'❌'}, база "${this.baseFolder}", год ${this.useYearFolders?'ВКЛ':'ВЫКЛ'}, жанры ${this.useGenreFolders?'ВКЛ':'ВЫКЛ'}, режим ${this.enabled?'ВКЛ':'ВЫКЛ'}`);
        },

        getYearFolder(){ return `${this.baseFolder}/${new Date().getFullYear()}`; },

        getGenreFolder(){
            try{
                const g = (typeof bookInfo !== 'undefined' && bookInfo?.genres?.length) ? bookInfo.genres[0] : null;
                if(!g) return null;
                const clean = String(g).replace(/[\\/:*?"<>|]/g,'_').replace(/\s+/g,' ').trim().slice(0,60);
                return clean || null;
            }catch(e){ return null; }
        },

        getTargetFolder(){
            let folder = this.useYearFolders ? this.getYearFolder() : this.baseFolder;
            if(this.useGenreFolders){
                const genre = this.getGenreFolder();
                if(genre) folder += '/' + genre;
            }
            return folder;
        },

        async request(path, opts={}){
            if(!this.token) throw new Error('нет токена Яндекс.Диска');
            const url = path.startsWith('http') ? path : `${this.apiBase}${path}`;
            const headers = { 'Authorization': `OAuth ${this.token}`, ...(opts.headers||{}) };
            let body = opts.body;
            if(body && typeof body === 'object' && !(body instanceof Blob)){ headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
            return fetch(url, { ...opts, headers, body });
        },

        async checkToken(){
            try{ const r = await this.request('/'); if(!r.ok){ const err = await r.json().catch(()=>({})); return { ok:false, error:`HTTP ${r.status}: ${err.message||''}` }; } const d = await r.json(); return { ok:true, totalSpace: d.total_space, usedSpace: d.used_space }; }
            catch(e){ return { ok:false, error: e.message }; }
        },

        async ensureFolder(folderPath){
            if(!this.token) return false;
            const path = encodeURIComponent(folderPath);
            const r = await this.request(`/resources?path=${path}`);
            if(r.ok) return true;
            if(r.status === 404){
                const cr = await this.request(`/resources?path=${path}`, { method:'PUT' });
                if(!cr.ok){ const err = await cr.json().catch(()=>({})); console.warn(`⚠️ Не создана ${folderPath}:`, err.message); return false; }
                console.log(`✅ YaDisk: создана ${folderPath}`);
                return true;
            }
            return false;
        },

        async ensureFullPath(){
            const target = this.getTargetFolder();
            const parts = target.split('/').filter(Boolean);
            let current = '';
            for(const part of parts){ current += '/' + part; if(!await this.ensureFolder(current)) return false; }
            return true;
        },

        async uploadFile(filename, blob, onProgress){
            if(!this.token) throw new Error('нет токена');
            if(!await this.ensureFullPath()) throw new Error('не удалось создать папки');
            const targetFolder = this.getTargetFolder();
            const fullPath = `${targetFolder}/${filename}`;
            const path = encodeURIComponent(fullPath);
            addLog(`☁️ Папка: ${targetFolder}/`, 'net');
            addLog(`☁️ Получаем URL...`, 'net');
            const urlResp = await this.request(`/resources/upload?path=${path}&overwrite=true`);
            if(!urlResp.ok){ const err = await urlResp.json().catch(()=>({})); throw new Error(`upload URL: HTTP ${urlResp.status}`); }
            const { href } = await urlResp.json();
            const totalSize = blob.size;
            addLog(`☁️ Загружаем ${fmtBytes(totalSize)} → ${fullPath}`, 'net');
            console.log(`☁️ uploadFile START: ${filename} (${fmtBytes(totalSize)}) → ${fullPath}`);
            const startTime = performance.now();
            let lastLogPct = 0, lastUiUpdate = 0, lastLoaded = 0;
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('PUT', href, true);
                xhr.timeout = 0;
                const STALL_MS = 180000;
                let stallTimer = null, stallCount = 0;
                const armStall = () => {
                    if(stallTimer) clearTimeout(stallTimer);
                    stallTimer = setTimeout(() => {
                        stallCount++;
                        console.warn(`☁️ stall ${STALL_MS/1000}s без прогресса (раз ${stallCount}), abort`);
                        addLog(`☁️ Нет прогресса ${STALL_MS/1000}s → прерываем`, 'warn');
                        try{ xhr.abort(); }catch(e){}
                    }, STALL_MS);
                };
                const disarmStall = () => { if(stallTimer){ clearTimeout(stallTimer); stallTimer = null; } };
                armStall();
                xhr.upload.onprogress = (e) => {
                    armStall();
                    const total = (e.lengthComputable && e.total > 0) ? e.total : totalSize;
                    const loaded = e.loaded || lastLoaded;
                    if(total <= 0) return;
                    lastLoaded = loaded;
                    const pct = (loaded / total) * 100;
                    const now = performance.now();
                    const elapsed = (now - startTime) / 1000;
                    const speed = elapsed > 0.3 ? (loaded / 1048576 / elapsed) : 0;
                    const eta = (speed > 0.01 && total > 0) ? ((total - loaded) / 1048576 / speed) : 0;
                    if(onProgress && (now - lastUiUpdate > 100 || pct >= 100)){ lastUiUpdate = now; onProgress(loaded, total, pct, speed, eta); }
                    if(pct - lastLogPct >= 10 || pct >= 100){ lastLogPct = Math.floor(pct/10)*10; addLog(`☁️ ${Math.round(pct)}% · ${fmtBytes(loaded)}/${fmtBytes(total)} · ${fmtSpeed(speed)}${eta>0?` · ETA ${fmtEta(eta)}`:''}`, 'cloud'); }
                };
                xhr.onload = async () => {
                    disarmStall();
                    if(xhr.status >= 200 && xhr.status < 300){
                        console.log(`☁️ uploadFile OK: ${filename} (${fmtBytes(totalSize)})`);
                        let publicUrl = null;
                        if(this.publish){
                            try{ const pr = await this.request(`/resources/publish?path=${path}`, { method:'PUT' }); if(pr.ok){ const mr = await this.request(`/resources?path=${path}&fields=public_url`); if(mr.ok){ const m = await mr.json(); publicUrl = m.public_url; } } }catch(e){}
                        }
                        resolve({ ok:true, path: fullPath, folder: targetFolder, publicUrl });
                    } else reject(new Error(`PUT failed: HTTP ${xhr.status}`));
                };
                xhr.onerror = () => { disarmStall(); console.error('☁️ uploadFile network error'); reject(new Error('XHR network error')); };
                xhr.ontimeout = () => { disarmStall(); console.error('☁️ uploadFile timeout'); reject(new Error('XHR timeout')); };
                xhr.onabort = () => { disarmStall(); console.error('☁️ uploadFile aborted (stall)'); reject(new Error(`stall > ${STALL_MS/1000}s без прогресса`)); };
                xhr.send(blob);
            });
        },

        async listFolder(folderPath){
            try{ const path = encodeURIComponent(folderPath); const r = await this.request(`/resources?path=${path}&limit=100&sort=-created`); if(!r.ok) return []; const d = await r.json(); return d._embedded?.items || []; }
            catch(e){ return []; }
        },

        async setToken(token){ this.token = token.trim(); try{ localStorage.setItem(YADISK_TOKEN_KEY, this.token); }catch(e){} },
        setBaseFolder(folder){ this.baseFolder = folder.trim().replace(/^\/?/, '/').replace(/\/?$/, ''); try{ localStorage.setItem(YADISK_FOLDER_KEY, this.baseFolder); }catch(e){} },
        setUseYearFolders(use){ this.useYearFolders = !!use; try{ localStorage.setItem(YADISK_YEAR_KEY, use ? 'true' : 'false'); }catch(e){} },
        setUseGenreFolders(use){ this.useGenreFolders = !!use; try{ localStorage.setItem(YADISK_GENRE_KEY, use ? 'true' : 'false'); }catch(e){} },
        setEnabled(enabled){ this.enabled = enabled; try{ localStorage.setItem(YADISK_MODE_KEY, enabled ? 'true' : 'false'); }catch(e){} },
        setPublish(publish){ this.publish = publish; try{ localStorage.setItem(YADISK_PUBLISH_KEY, publish ? 'true' : 'false'); }catch(e){} }
    };

    // ═══ 📚 Библиотеки ═══
    let JSZipLoaded = false, JSPDFLoaded = false;
    function loadScript(urls, onSuccess, onFail, name){
        let idx = 0;
        (function tryNext(){
            if(idx >= urls.length){ console.warn(`❌ ${name}: все источники не сработали`); if(onFail) onFail(); return; }
            const url = urls[idx++];
            const s = document.createElement('script');
            let done = false;
            const timer = setTimeout(() => { if(done) return; done = true; console.warn(`⚠️ ${name}: timeout`); try{ s.remove(); }catch(e){} tryNext(); }, 12000);
            s.src = url;
            s.onload = () => { if(done) return; done = true; clearTimeout(timer); console.log(`✅ ${name}`); onSuccess(); };
            s.onerror = () => { if(done) return; done = true; clearTimeout(timer); tryNext(); };
            document.head.appendChild(s);
        })();
    }
    loadScript(['https://cdn.jsdelivr.net/gh/dimasik-debug/Share@main/lib/jszip.min.js','https://raw.githubusercontent.com/dimasik-debug/Share/main/lib/jszip.min.js','https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'], () => { JSZipLoaded = true; }, () => { console.error('❌ JSZip'); }, 'JSZip');
    loadScript(['https://cdn.jsdelivr.net/gh/dimasik-debug/Share@main/lib/jspdf.umd.min.js','https://raw.githubusercontent.com/dimasik-debug/Share/main/lib/jspdf.umd.min.js','https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'], () => { JSPDFLoaded = true; }, () => { console.warn('⚠️ jsPDF'); }, 'jsPDF');

    // ═══ URL / Session ═══
    const urlParams = new URLSearchParams(window.location.search);
    let fileId = urlParams.get('file');
    let artId = urlParams.get('art');
    let pageType = 'unknown';
    if(fileId && artId) pageType='reader';
    else { const m=window.location.pathname.match(/-(\d+)\/?$/); if(m){ artId=m[1]; fileId=null; pageType='book'; } }
    if(!artId){ alert('❌ Не нашёл artId'); return; }

    function getCookie(n){ const v=`; ${document.cookie}`; const p=v.split(`; ${n}=`); if(p.length===2) return p.pop().split(';').shift(); return null; }
    let sessionData = { sessionId:getCookie('SID')||'', supersid:getCookie('supersid')||'' };
    function updateSession(){ const s=getCookie('SID'), ss=getCookie('supersid'); if(s) sessionData.sessionId=s; if(ss) sessionData.supersid=ss; }
    function getHeaders(){ return { 'accept':'application/json, text/plain, */*','accept-language':'ru,en;q=0.9','accept-version':'2','app-id':'115','client-host':'www.litres.ru','session-id':sessionData.sessionId,'supersid':sessionData.supersid,'ui-currency':'RUB','ui-language-code':'ru','x-request-id': (crypto?.randomUUID?.() || (Date.now().toString(36)+Math.random().toString(36).substring(2))) }; }

    let bookInfo = { title:'Неизвестная книга', author:'Неизвестный автор', pages:0, fileId:fileId, artId:artId, format:null, isAudio:false,
                     annotation:'', reviewsCount:0, genres:[], isbn:null, publicationDate:null, publisher:null, rating:null, url:null,
                     price:null, imagesCount:0, isDraft:false };

    function detectFormatFromName(f){
        if(!f) return null;
        let s=String(f).toLowerCase();
        try{ s=decodeURIComponent(s); }catch(e){}
        if(s.includes('/fb2/')||s.includes('.fb2')) return { icon:'📚', name:'FB2' };
        if(s.includes('/epub/')||s.includes('.epub')) return { icon:'📖', name:'EPUB' };
        if(s.includes('/pdf/')||s.includes('.pdf')) return { icon:'📕', name:'PDF' };
        if(s.includes('/mobi/')||s.includes('.mobi')) return { icon:'📘', name:'MOBI' };
        if(s.includes('/txt/')||s.includes('.txt')) return { icon:'📄', name:'TXT' };
        if(s.includes('.mp3')) return { icon:'🎵', name:'MP3' };
        if(s.includes('.m4b')) return { icon:'🎧', name:'M4B' };
        if(s.includes('.m4a')) return { icon:'🎵', name:'M4A' };
        if(s.includes('.flac')) return { icon:'🎼', name:'FLAC' };
        if(s.includes('.ogg')) return { icon:'🎵', name:'OGG' };
        if(s.includes('.wav')) return { icon:'🎵', name:'WAV' };
        if(s.includes('.mp4')) return { icon:'🎬', name:'MP4' };
        if(s.includes('.webm')) return { icon:'🎬', name:'WEBM' };
        if(s.includes('.mkv')) return { icon:'🎬', name:'MKV' };
        if(s.includes('.zip')) return { icon:'📦', name:'ZIP' };
        return null;
    }
    function detectFormatFromMime(mime){
        if(!mime) return null;
        const m=String(mime).toLowerCase();
        if(m.includes('fb2')) return { icon:'📚', name:'FB2' };
        if(m.includes('epub')) return { icon:'📖', name:'EPUB' };
        if(m.includes('pdf')) return { icon:'📕', name:'PDF' };
        if(m.includes('mobipocket')||m.includes('mobi')) return { icon:'📘', name:'MOBI' };
        if(m.includes('mpeg')||m.includes('mp3')) return { icon:'🎵', name:'MP3' };
        if(m.includes('m4b')) return { icon:'🎧', name:'M4B' };
        if(m.includes('m4a')||m.includes('mp4a')) return { icon:'🎵', name:'M4A' };
        if(m.includes('flac')) return { icon:'🎼', name:'FLAC' };
        if(m.includes('ogg')) return { icon:'🎵', name:'OGG' };
        if(m.includes('wav')) return { icon:'🎵', name:'WAV' };
        if(m.includes('mp4')||m.includes('video')) return { icon:'🎬', name:'MP4' };
        if(m.includes('webm')) return { icon:'🎬', name:'WEBM' };
        if(m.includes('zip')) return { icon:'📦', name:'ZIP' };
        return null;
    }

    async function fetchWithTimeout(url, opts={}, ms=15000){
        const c= new AbortController(); const t=setTimeout(()=>c.abort(), ms);
        try{ const r=await fetch(url,{...opts,signal:c.signal}); clearTimeout(t); return r; }
        catch(e){ clearTimeout(t); if(e.name==='AbortError') throw new Error(`timeout ${ms}ms`); throw e; }
    }

    async function fetchBookInfo(){
        try{
            const r=await fetchWithTimeout(`https://api.litres.ru/foundation/api/arts/${artId}`,{credentials:'include',headers:getHeaders()},12000);
            if(!r.ok) return false;
            const d=await r.json(); const p=d?.payload?.data; if(!p) return false;
            let pages=0; const sym=p.symbols_count||0;
            if(p.files?.length){
                const main=p.files.find(f=>!f.is_additional);
                if(main?.pages) pages=main.pages;
                if(main){
                    const fmt=detectFormatFromName(main.filename)||detectFormatFromMime(main.mime)||detectFormatFromName(main.extension);
                    if(fmt){ bookInfo.format=fmt; if(['MP3','M4B','M4A','FLAC','OGG','WAV','MP4','WEBM','MKV'].includes(fmt.name)) bookInfo.isAudio=true; }
                }
            }
            if(!pages&&p.additional_info?.current_pages_or_seconds) pages=p.additional_info.current_pages_or_seconds;
            if(!pages&&sym>0) pages=Math.round(sym/2800);
            let author='Неизвестный автор';
            if(p.persons?.length){ const a=p.persons.find(x=>x.role==='author'); author=a?.full_name||p.persons[0].full_name||author; }
            bookInfo.title=p.title||bookInfo.title;
            bookInfo.author=author;
            bookInfo.pages=pages;
            bookInfo.artId=p.id||artId;
            bookInfo.annotation = p.html_annotation || p.original_html_annotation || '';
            bookInfo.reviewsCount = p.reviews_count || 0;
            bookInfo.genres = (p.genres||[]).map(g=>g.name);
            bookInfo.isbn = p.isbn || null;
            bookInfo.publicationDate = p.publication_date || null;
            bookInfo.publisher = p.copyrighter?.name || null;
            bookInfo.rating = p.rating || null;
            bookInfo.url = p.url ? 'https://www.litres.ru' + p.url : null;
            bookInfo.price = p.prices?.final_price || p.prices?.full_price || null;
            bookInfo.imagesCount = p.images_count || 0;
            bookInfo.isDraft = !!(p.is_draft || p.art_type === 1 || (p.my_art_status === 0 && !p.files?.length));
            let realFileId = p.release_file_id || null;
            if(!realFileId && p.files?.length){ const main = p.files.find(f => !f.is_additional) || p.files[0]; realFileId = main?.id || main?.file_id || null; }
            if(!realFileId && p.preview_file_id) realFileId = p.preview_file_id;
            if(!realFileId && p.additional_info?.release_file_id) realFileId = p.additional_info.release_file_id;
            bookInfo.fileId = realFileId || fileId;
            console.log(`🆔 fileId=${bookInfo.fileId||'—'}, жанры=[${bookInfo.genres.join(', ')}]`);
            console.log(`✅ "${bookInfo.title}" (${bookInfo.pages} ${bookInfo.isAudio?'сек':'стр.'}) · ${bookInfo.reviewsCount} рец. · ${bookInfo.genres.length} 🏷️ · ${bookInfo.price ? bookInfo.price+'₽' : 'бесплатно'}`);
            return true;
        }catch(e){ console.error('❌',e); return false; }
    }

    async function fetchUserInfo(){
        try{
            const r = await fetchWithTimeout(`https://api.litres.ru/foundation/api/users/me/detailed`,{credentials:'include',headers:getHeaders()},10000);
            if(!r.ok) return null;
            const d = await r.json(); const p = d?.payload?.data; if(!p) return null;
            const prof = p.profile||{};
            return { id:p.id, login:p.login, email:prof.email||null, isEmailConfirmed:prof.is_email_confirmed||false };
        }catch(e){ return null; }
    }

    function formatPrice(value, currency = 'RUB'){
        if(value == null || isNaN(value)) return '—';
        const num = Number(value);
        const symbol = currency === 'RUB' ? '₽' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency;
        const fixed = num.toFixed(2).replace('.', ',');
        const [intPart, decPart] = fixed.split(',');
        return `${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${decPart} ${symbol}`;
    }

    function sanitizeHtml(html){
        if(!html) return '';
        const ALLOWED = new Set(['p','br','em','strong','i','b','u','span','div']);
        try{
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const walk = (node) => {
                for(const child of [...node.childNodes]){
                    if(child.nodeType === Node.ELEMENT_NODE){
                        const tag = child.tagName.toLowerCase();
                        if(!ALLOWED.has(tag)){
                            const frag = document.createDocumentFragment();
                            while(child.firstChild) frag.appendChild(child.firstChild);
                            child.replaceWith(frag);
                            continue;
                        }
                        for(const attr of [...child.attributes]) child.removeAttribute(attr.name);
                        walk(child);
                    } else if(child.nodeType === Node.COMMENT_NODE) child.remove();
                }
            };
            walk(doc.body);
            return doc.body.innerHTML;
        }catch(e){ return escHtml(html).replace(/\n/g, '<br>'); }
    }

    async function getZipAudioTag(zipBlob){
        try{
            if(typeof JSZip === 'undefined') return { tag:'', count:0, total:0, ext:null };
            const zip = await JSZip.loadAsync(zipBlob);
            const files = Object.keys(zip.files).filter(f => !zip.files[f].dir);
            const audioFiles = files.filter(f => /\.(mp3|m4b|m4a|flac|ogg|wav)$/i.test(f));
            if(audioFiles.length === 0) return { tag:'', count:0, total:files.length, ext:null };
            const counts = {};
            audioFiles.forEach(f => { const m = f.toLowerCase().match(/\.([a-z0-9]+)$/); if(m) counts[m[1]] = (counts[m[1]]||0)+1; });
            const ext = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
            return { tag:'_audio', count:audioFiles.length, total:files.length, ext };
        }catch(e){ return { tag:'', count:0, total:0, ext:null }; }
    }

    async function detectBlobType(blob){
        if(!blob || blob.size < 12) return { type:'unknown', size:blob?.size||0 };
        const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
        const hex = Array.from(head.slice(0, 12)).map(b=>b.toString(16).padStart(2,'0')).join(' ');
        const str = (start, len) => String.fromCharCode(...head.slice(start, start+len));
        if(head[0]===0x50 && head[1]===0x4B) return { type:'zip', icon:'📦', name:'ZIP', mime:'application/zip', hex };
        if(str(0,5)==='%PDF-') return { type:'pdf', icon:'📕', name:'PDF', mime:'application/pdf', hex };
        if(str(0,3)==='ID3') return { type:'audio-mp3', icon:'🎵', name:'MP3', mime:'audio/mpeg', hex };
        if(head[0]===0xFF && (head[1] & 0xE0) === 0xE0) return { type:'audio-mp3', icon:'🎵', name:'MP3', mime:'audio/mpeg', hex };
        if(str(0,4)==='fLaC') return { type:'audio-flac', icon:'🎼', name:'FLAC', mime:'audio/flac', hex };
        if(str(0,4)==='OggS') return { type:'audio-ogg', icon:'🎵', name:'OGG', mime:'audio/ogg', hex };
        if(str(0,4)==='RIFF' && str(8,4)==='WAVE') return { type:'audio-wav', icon:'🎵', name:'WAV', mime:'audio/wav', hex };
        if(str(4,4)==='ftyp'){
            const brand = str(8, 4).toLowerCase();
            if(brand.includes('m4b')) return { type:'audio-m4b', icon:'🎧', name:'M4B', mime:'audio/mp4', hex };
            if(brand.includes('m4a')) return { type:'audio-m4a', icon:'🎵', name:'M4A', mime:'audio/mp4', hex };
            if(brand.includes('isom')||brand.includes('mp42')||brand.includes('mp41')) return { type:'video-mp4', icon:'🎬', name:'MP4', mime:'video/mp4', hex };
            return { type:'audio-m4a', icon:'🎵', name:'M4A/MP4', mime:'audio/mp4', hex };
        }
        if(head[0]===0x1A && head[1]===0x45 && head[2]===0xDF && head[3]===0xA3) return { type:'video-webm', icon:'🎬', name:'WEBM', mime:'video/webm', hex };
        if(str(0,1)==='[') return { type:'json', icon:'📖', name:'JSON (главы)', mime:'application/json', hex };
        if(str(0,1)==='{') return { type:'json-obj', icon:'📖', name:'JSON', mime:'application/json', hex };
        return { type:'unknown', size:blob.size, hex, name:'?' };
    }

    async function downloadWithProgress(url, opts={}, label='файла', expectedTypes=null){
        const MAX_ATTEMPTS = 100;
        const chunks = [];
        let loaded = 0, total = 0, attempt = 0, consecutiveShortFails = 0;
        const t0 = performance.now();
        while(attempt < MAX_ATTEMPTS){
            if(state.isStopped){ addLog(`⏹ ${label}: остановлено (${fmtBytes(loaded)})`, 'warn'); return null; }
            attempt++;
            if(attempt > 1){
                let delay = 2000;
                if(attempt > 3) delay = 5000;
                if(attempt > 10) delay = 10000;
                if(attempt > 30) delay = 15000;
                if(consecutiveShortFails > 3) delay = Math.min(delay * 2, 30000);
                addLog(`🔄 ${label}: попытка ${attempt} — докачиваем с ${fmtBytes(loaded)} (пауза ${(delay/1000).toFixed(0)}с)`, 'warn');
                await new Promise(r=>setTimeout(r, delay));
            }
            const attemptStart = performance.now();
            let attemptLoaded = 0;
            try{
                const headers = { ...(opts.headers||{}) };
                if(loaded > 0) headers['Range'] = `bytes=${loaded}-`;
                const ctrl = new AbortController();
                const attemptTimeout = setTimeout(()=>ctrl.abort(), 600000);
                const r = await fetch(url, { ...opts, headers, signal: ctrl.signal });
                if(r.status === 403 || r.status === 401){ clearTimeout(attemptTimeout); addLog(`🚫 ${label}: нет доступа (${r.status})`, 'err'); return null; }
                if(loaded > 0){
                    if(r.status === 200){ addLog(`⚠️ ${label}: 200 вместо 206`, 'warn'); chunks.length = 0; loaded = 0; }
                    else if(r.status !== 206) throw new Error(`HTTP ${r.status}`);
                } else if(!r.ok) throw new Error(`HTTP ${r.status}`);
                const cr = r.headers.get('content-range');
                if(cr){
                    const m = cr.match(/bytes\s+(\d+)-(\d+)\/(\d+)/);
                    if(m){
                        const start = parseInt(m[1], 10);
                        if(loaded > 0 && start !== loaded){ chunks.length = 0; loaded = 0; }
                        total = parseInt(m[3], 10);
                    }
                } else {
                    const cl = parseInt(r.headers.get('content-length')||'0', 10);
                    if(cl > 0) total = loaded + cl;
                }
                if(!r.body || !r.body.getReader){
                    const blob = await r.blob();
                    clearTimeout(attemptTimeout);
                    chunks.push(blob); loaded += blob.size; attemptLoaded += blob.size;
                    if(total === 0 || loaded >= total) break;
                    throw new Error(`недокачано`);
                }
                const reader = r.body.getReader();
                let lastUpdate = performance.now(), lastPct = 0;
                const speedSamples = [];
                const startLoaded = loaded, startTime = performance.now();
                while(true){
                    if(state.isStopped){ try{ reader.cancel(); }catch(e){} clearTimeout(attemptTimeout); return null; }
                    const { done, value } = await reader.read();
                    if(done) break;
                    chunks.push(value);
                    loaded += value.byteLength;
                    attemptLoaded += value.byteLength;
                    const now = performance.now();
                    if(now - lastUpdate > 200){
                        lastUpdate = now;
                        const sec = (now - startTime)/1000;
                        const instSp = sec>0 ? ((loaded-startLoaded)/1048576/sec) : 0;
                        speedSamples.push(instSp);
                        if(speedSamples.length > 5) speedSamples.shift();
                        const sp = speedSamples.reduce((a,b)=>a+b,0)/speedSamples.length;
                        const pct = total>0 ? (loaded/total*100) : 0;
                        const eta = (total>0 && sp>0.01) ? ((total-loaded)/1048576/sp) : 0;
                        updateBlobProgress(loaded, total, sp, pct, eta, label);
                        if(total>0 && pct-lastPct >= 10){
                            lastPct = Math.floor(pct/10)*10;
                            addLog(`⬇ ${Math.round(pct)}% · ${fmtBytes(loaded)}/${fmtBytes(total)} · ${fmtSpeed(sp)} · ETA ${fmtEta(eta)}`, 'net');
                        }
                    }
                }
                clearTimeout(attemptTimeout);
                if(total === 0 || loaded >= total) break;
                throw new Error(`недокачано`);
            }catch(e){
                const msg = e.message || String(e);
                const dur = (performance.now() - attemptStart) / 1000;
                console.log(`⚠️ ${label}: попытка ${attempt} (${dur.toFixed(1)}s): ${msg}`);
                if(dur < 5 && attemptLoaded < 1024*1024) consecutiveShortFails++;
                else consecutiveShortFails = 0;
                if(attempt >= MAX_ATTEMPTS){
                    addLog(`❌ ${label}: ${MAX_ATTEMPTS} попыток`, 'err');
                    if(loaded > 0 && total > 0 && loaded/total > 0.9) break;
                    return null;
                }
            }
        }
        const blob = new Blob(chunks);
        const sec = (performance.now()-t0)/1000;
        const info = await detectBlobType(blob);
        if(expectedTypes && !expectedTypes.includes(info.type)){ addLog(`⚠️ ${label}: тип "${info.name}" не подходит`, 'warn'); return null; }
        addLog(`✅ ${label}: ${fmtBytes(blob.size)} за ${sec.toFixed(1)}s${attempt>1?` [${attempt} попыток]`:''}`, 'ok');
        blob._detected = info;
        return blob;
    }

    function fmtBytes(b){
        if(b < 1024) return b+' B';
        if(b < 1048576) return (b/1024).toFixed(1)+' KB';
        if(b < 1073741824) return (b/1048576).toFixed(2)+' MB';
        return (b/1073741824).toFixed(2)+' GB';
    }
    function fmtSpeed(mbps){ if(mbps<0.01) return '—'; if(mbps<1) return (mbps*1024).toFixed(0)+' KB/s'; return mbps.toFixed(2)+' MB/s'; }
    function fmtEta(sec){ if(!isFinite(sec)||sec<=0) return '—'; if(sec<60) return sec.toFixed(0)+'s'; const m=Math.floor(sec/60), s=Math.round(sec%60); return m+'m '+s+'s'; }

    function updateBlobProgress(loaded, total, speed, pct, eta, label){
        const p = total>0 ? pct : 0;
        progressBar.style.width = `${Math.min(p,100)}%`;
        progressText.textContent = `📥 ${fmtBytes(loaded)} / ${total>0?fmtBytes(total):'?'}`;
        percentText.textContent = `${Math.round(p)}%`;
        readingProgressText.textContent = `${fmtSpeed(speed)} · ETA ${fmtEta(eta)}`;
        setReadingStatus(`📥 ${label}...`);
        updateMini();
    }

    // ═══ СТРАТЕГИИ ═══
    async function checkStrategy_Pdf(fid){
        const r = { ok:false, link:null, note:'', name:'📕 PDF (прямой)' };
        try{
            const resp = await fetchWithTimeout(`https://api.litres.ru/foundation/api/arts/files/${fid}/link?is_trial=false`, {credentials:'include', headers:getHeaders()}, 8000);
            if(!resp.ok){ r.note = `HTTP ${resp.status}`; return r; }
            const d = await resp.json();
            const link = d?.payload?.data?.link || d?.payload?.link || '';
            if(!link){ r.note = 'нет link'; return r; }
            const m = link.match(/fname=([^&]+)/);
            const fname = m ? decodeURIComponent(m[1]) : '';
            if(/\.pdf$/i.test(fname) || /fname=[^&]*\.pdf/i.test(link)){ r.ok = true; r.link = link; r.note = fname || 'PDF'; }
            else r.note = `не PDF`;
        }catch(e){ r.note = e.message; }
        return r;
    }
    async function checkStrategy_ZipToc(fid){
        const r = { ok:false, link:null, note:'', name:'📦 ZIP (toc.js)' };
        try{
            const resp = await fetchWithTimeout(`https://api.litres.ru/foundation/api/arts/files/${fid}/link?resource=toc.js&is_trial=false`, {credentials:'include', headers:getHeaders()}, 8000);
            if(!resp.ok){ r.note = `HTTP ${resp.status}`; return r; }
            const d = await resp.json();
            const link = d?.payload?.data?.link || d?.payload?.link || '';
            if(!link){ r.note = 'нет link'; return r; }
            const mimeMatch = link.match(/mimetype=([^&]+)/);
            const mimetype = mimeMatch ? decodeURIComponent(mimeMatch[1]) : '';
            const realMatch = link.match(/real_url=([^&]+)/);
            const realUrl = realMatch ? decodeURIComponent(realMatch[1]) : '';
            if(mimetype.includes('json') || realUrl.includes('/json/')){ r.note = `маскировка`; return r; }
            if(mimetype.includes('zip') || /\.(zip|fb2|epub)$/i.test(realUrl)){ r.ok = true; r.link = link; r.note = realUrl.split('/').pop() || 'ZIP'; return r; }
            r.note = `непонятный link`;
        }catch(e){ r.note = e.message; }
        return r;
    }
    async function checkStrategy_ZipDirect(fid){
        const r = { ok:false, link:null, note:'', name:'📦 ZIP (direct)' };
        try{
            const urls = [`https://api.litres.ru/foundation/api/arts/files/${fid}/link?resource=bin&is_trial=false`,`https://api.litres.ru/foundation/api/arts/files/${fid}/link?resource=zip&is_trial=false`];
            for(const url of urls){
                const resp = await fetchWithTimeout(url, {credentials:'include', headers:getHeaders()}, 6000);
                if(!resp.ok) continue;
                const d = await resp.json();
                const link = d?.payload?.data?.link || d?.payload?.link || '';
                if(!link) continue;
                const mimeMatch = link.match(/mimetype=([^&]+)/);
                const mimetype = mimeMatch ? decodeURIComponent(mimeMatch[1]) : '';
                const realMatch = link.match(/real_url=([^&]+)/);
                const realUrl = realMatch ? decodeURIComponent(realMatch[1]) : '';
                if(mimetype.includes('json') || realUrl.includes('/json/')) continue;
                if(mimetype.includes('zip') || /\.(zip|fb2|epub)$/i.test(realUrl)){ r.ok = true; r.link = link; r.note = realUrl.split('/').pop() || 'ZIP'; return r; }
            }
            if(!r.note) r.note = 'не найдено';
        }catch(e){ r.note = e.message; }
        return r;
    }
    async function checkStrategy_Audio(fid){
        const r = { ok:false, link:null, note:'', name:'🎵 Audio/Video' };
        try{
            const urls = [`https://api.litres.ru/foundation/api/arts/files/${fid}/link?resource=mp3&is_trial=false`,`https://api.litres.ru/foundation/api/arts/files/${fid}/link?resource=m4b&is_trial=false`,`https://api.litres.ru/foundation/api/arts/files/${fid}/link?resource=m4a&is_trial=false`,`https://api.litres.ru/foundation/api/arts/files/${fid}/link?resource=mp4&is_trial=false`];
            for(const url of urls){
                const resp = await fetchWithTimeout(url, {credentials:'include', headers:getHeaders()}, 6000);
                if(!resp.ok) continue;
                const d = await resp.json();
                const link = d?.payload?.data?.link || d?.payload?.link || '';
                if(!link) continue;
                const fmt = detectFormatFromName(link);
                if(fmt && ['MP3','M4B','M4A','FLAC','OGG','WAV','MP4','WEBM','MKV'].includes(fmt.name)){ r.ok = true; r.link = link; r.note = `${fmt.icon} ${fmt.name}`; r.format = fmt; return r; }
            }
            r.note = 'не найдено';
        }catch(e){ r.note = e.message; }
        return r;
    }
    async function checkStrategy_000js(fid){
        const r = { ok:false, link:null, note:'', name:'📖 000.js', type:null };
        try{
            const chUrl = `https://www.litres.ru/download_book_subscr/${artId}/${fid}/json/000.js`;
            let rHead;
            try{ rHead = await fetchWithTimeout(chUrl, { credentials:'include', headers:{ 'Range':'bytes=0-15' } }, 4000); }
            catch(e){ rHead = await fetchWithTimeout(chUrl, { credentials:'include' }, 5000); }
            if(rHead.status === 403 || rHead.status === 401){ r.note = `HTTP ${rHead.status}`; return r; }
            if(rHead.status === 404){ r.note = 'HTTP 404'; return r; }
            if(!rHead.ok && rHead.status !== 206){ r.note = `HTTP ${rHead.status}`; return r; }
            let head;
            try{
                if(rHead.body && rHead.body.getReader){
                    const reader = rHead.body.getReader();
                    const { value } = await reader.read();
                    try{ reader.cancel(); }catch(e){}
                    head = value || new Uint8Array(0);
                } else { const buf = await rHead.arrayBuffer(); head = new Uint8Array(buf.slice(0, 16)); }
            }catch(e){ head = new Uint8Array(0); }
            if(!head || head.length === 0){ r.ok = true; r.type = 'json'; r.link = chUrl; r.note = 'файл существует'; return r; }
            const hex = Array.from(head.slice(0,8)).map(b=>b.toString(16).padStart(2,'0')).join(' ');
            const str = (s,l) => String.fromCharCode(...head.slice(s,s+l));
            let type = 'unknown';
            if(str(0,5)==='%PDF-') type = 'pdf';
            else if(str(0,3)==='ID3') type = 'audio-mp3';
            else if(str(0,4)==='fLaC') type = 'audio-flac';
            else if(str(0,4)==='OggS') type = 'audio-ogg';
            else if(str(4,4)==='ftyp') type = 'audio-m4a';
            else if(head[0]===0x1A && head[1]===0x45) type = 'video-webm';
            else if(str(0,1)==='[') type = 'json';
            else if(str(0,1)==='{') type = 'json-obj';
            else if(head[0]===0xFF && (head[1]&0xE0)===0xE0) type = 'audio-mp3';
            else if(head[0]===0x50 && head[1]===0x4B) type = 'zip';
            if(type === 'unknown') type = 'json';
            r.ok = true; r.type = type; r.link = chUrl;
            r.note = `${type} [${hex}]`;
        }catch(e){ r.note = e.message; }
        return r;
    }
    // 🆕 Новая стратегия /pub/t/{artId}.json/ — для draft_free / бесплатных книг
    async function checkStrategy_PubT(){
        const r = { ok:false, note:'', name:'📚 /pub/t/ (draft_free)', chapters:0, base:null };
        try{
            const base = `https://www.litres.ru/pub/t/${artId}.json`;
            const tr = await fetchWithTimeout(`${base}/toc.js`, { credentials:'omit' }, 8000);
            if(!tr.ok){ r.note = `toc.js HTTP ${tr.status}`; return r; }
            const toc = await tr.text();
            if(!toc || toc.length < 10){ r.note = 'toc пустой'; return r; }
            let count = 0;
            try{
                const parsed = parseLitFile(toc);
                if(Array.isArray(parsed)) count = parsed.length;
                else if(parsed?.chapters && Array.isArray(parsed.chapters)) count = parsed.chapters.length;
                else if(parsed?.data && Array.isArray(parsed.data)) count = parsed.data.length;
                else if(parsed?.toc && Array.isArray(parsed.toc)) count = parsed.toc.length;
            }catch(e){}
            if(count === 0){
                const m = toc.match(/"(\d{3})"/g);
                if(m) count = m.length;
            }
            const hr = await fetchWithTimeout(`${base}/000.js`, { credentials:'omit' }, 6000);
            if(!hr.ok){ r.note = `000.js HTTP ${hr.status}`; return r; }
            const head = await hr.text();
            if(!head || head.length < 5){ r.note = '000.js пустой'; return r; }
            const probe = head.slice(0, 30).replace(/\s+/g,' ');
            r.ok = true;
            r.base = base;
            r.chapters = count || 0;
            r.note = `${count || '?'} глав · "${probe.slice(0,20)}..."`;
        }catch(e){ r.note = e.message; }
        return r;
    }
    async function checkStrategy_Pdfjs(fid){
        const r = { ok:false, link:null, note:'', name:'📕 PDFjs (постранично)', pages:0, pageFormats:null };
        try{
            const resp = await fetchWithTimeout(`https://api.litres.ru/foundation/api/arts/files/${fid}/link?index=1&is_trial=false`, {credentials:'include', headers:getHeaders()}, 8000);
            if(!resp.ok){ r.note = `HTTP ${resp.status}`; return r; }
            const d = await resp.json();
            const jsUrl = d?.payload?.data?.link || d?.payload?.link || '';
            if(!jsUrl){ r.note = 'нет link'; return r; }
            if(!jsUrl.includes('/pdfjs/')){ r.note = 'link не pdfjs'; return r; }
            if(/fname=[^&]*\.pdf/i.test(jsUrl)){ r.note = 'это прямой PDF'; return r; }
            const jr = await fetchWithTimeout(jsUrl, {credentials:'omit'}, 8000);
            if(!jr.ok){ r.note = `pdfjs HTTP ${jr.status}`; return r; }
            const text = await jr.text();
            if(text.startsWith('%PDF')){ r.note = 'это прямой PDF'; return r; }
            const exts = [...text.matchAll(/ext\s*:\s*['"](\w+)['"]/g)].map(m=>m[1]);
            if(exts.length === 0){ r.note = 'нет ext'; return r; }
            r.ok = true; r.link = jsUrl; r.pages = exts.length; r.pageFormats = exts;
            r.note = `${exts.length} стр.`;
        }catch(e){ r.note = e.message; }
        return r;
    }

    async function diagnoseStrategies(){
        const fid = state.fileId || bookInfo.fileId;
        console.log('%c═══════════════════════════════════', 'color:#4a8af4');
        console.log('%c🔬 ДИАГНОСТИКА v98', 'color:#4a8af4;font-size:14px;font-weight:bold;');
        console.log('%c═══════════════════════════════════', 'color:#4a8af4');
        console.log(`📖 "${bookInfo.title}" · 🏷️ ${bookInfo.genres.join(', ')||'—'}`);
        console.log(`🆔 artId=${artId}, fileId=${fid||'—'}`);
        addLog('🔬 Диагностика...', 'step');
        setReadingStatus('🔬 Проверка...');
        try{ Sound.diag(); }catch(e){}
        const t0 = performance.now();
        const results = {};
        const strategies = [];
        if(fid){
            strategies.push(
                ['pdf', '📕 PDF', () => checkStrategy_Pdf(fid)],
                ['zipToc', '📦 ZIP (toc)', () => checkStrategy_ZipToc(fid)],
                ['zipDirect', '📦 ZIP (direct)', () => checkStrategy_ZipDirect(fid)],
                ['audio', '🎵 Audio', () => checkStrategy_Audio(fid)],
                ['json', '📖 000.js', () => checkStrategy_000js(fid)]
            );
        }
        strategies.push(['pubT', '📚 /pub/t/', () => checkStrategy_PubT()]);
        if(fid) strategies.push(['pdfjs', '📕 PDFjs', () => checkStrategy_Pdfjs(fid)]);

        for(const [key, label, fn] of strategies){
            setReadingStatus(`🔬 ${label}...`);
            try{ results[key] = await fn(); }
            catch(e){ results[key] = { ok:false, note:e.message, name:label }; }
        }
        const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
        const tableData = {};
        for(const [key, r] of Object.entries(results)) tableData[key] = { 'Стратегия': r.name, 'Статус': r.ok ? '✅' : '❌', 'Инфо': r.note || '—' };
        console.table(tableData);
        const available = Object.values(results).filter(r => r.ok);
        if(available.length === 0) addLog(`❌ Все стратегии провалились (${elapsed}s)`, 'err');
        else addLog(`✅ Доступно: ${available.length} стратегий (${elapsed}s)`, 'ok');
        if(results.pdf?.ok && !bookInfo.format){ bookInfo.format = { icon:'📕', name:'PDF' }; updateFormatDisplay(); }
        else if(results.zipToc?.ok && !bookInfo.format){ bookInfo.format = { icon:'📦', name:'ZIP' }; updateFormatDisplay(); }
        else if(results.audio?.ok && !bookInfo.format){ bookInfo.format = results.audio.format; updateFormatDisplay(); }
        return results;
    }

    // ═══ PARSERS ═══
    function parseLitFile(t){ const c=t.trim().replace(/;\s*$/,''); try{ return new Function('return ('+c+')')(); }catch(e){ const s=c.indexOf('['), e2=c.lastIndexOf(']'); if(s>=0&&e2>s) return new Function('return ('+c.slice(s,e2+1)+')')(); throw e; } }
    function escHtml(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

    function litJsonToHtml(n, opts = {}){
        const imgPrefix = opts.imgPrefix || 'images/';
        if(!Array.isArray(n)){
            if(typeof n==='string') return escHtml(n);
            if(n&&typeof n==='object') return litJsonToHtml(n.c||[], opts);
            return '';
        }
        return n.map(x=>{
            if(typeof x==='string') return escHtml(x);
            if(!x||!x.t) return '';
            if(x.t === 'img'){
                let file = x.s || '';
                if(!file && x.src && /\.(?:jpe?g|png|gif|webp|svg|bmp)$/i.test(x.src)) file = x.src;
                if(!file) return '';
                if(!/\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(file)) file += '.jpg';
                const cleanName = normalizeImgName(file);
                const w = x.w ? ` width="${x.w}"` : '';
                const h = x.h ? ` height="${x.h}"` : '';
                return `<img src="${escHtml(imgPrefix + cleanName)}" alt="" loading="lazy"${w}${h} class="litres-img">`;
            }
            const i = litJsonToHtml(x.c||[], opts);
            switch(x.t){
                case 'title': return `<h2>${i}</h2>`;
                case 'subtitle': return `<h3>${i}</h3>`;
                case 'p': return `<p>${i}</p>`;
                case 'em': return `<em>${i}</em>`;
                case 'strong': return `<strong>${i}</strong>`;
                case 'br': return '<br>';
                default: return i;
            }
        }).join('');
    }

    // Универсальный загрузчик главы — пробует /download_book_subscr/ и /pub/t/
    async function fetchJsonChapter(num){
        const n = String(num).padStart(3,'0');
        const attempts = [];
        if(state.fileId) attempts.push({ url: `https://www.litres.ru/download_book_subscr/${state.artId}/${state.fileId}/json/${n}.js`, cred: 'include' });
        attempts.push({ url: `https://www.litres.ru/pub/t/${state.artId}.json/${n}.js`, cred: 'omit' });

        let lastStatus = 'notfound';
        for(const { url, cred } of attempts){
            try{
                const r = await fetchWithTimeout(url, { credentials: cred }, 12000);
                if(r.status === 404) continue;
                if(r.status === 401 || r.status === 403){ lastStatus = 'forbidden'; continue; }
                if(!r.ok){ lastStatus = 'error'; continue; }
                const t = await r.text();
                if(!t || t.length < 10){ lastStatus = 'empty'; continue; }
                return { status:'ok', html: litJsonToHtml(parseLitFile(t), { imgPrefix:'images/' }) };
            }catch(e){ lastStatus = 'error'; }
        }
        return { status: lastStatus };
    }

    // ============================================================
    // HTML-шапка БЕЗ жёстких шрифтов — читалка Digma задаёт сама
    // ============================================================
    function buildBookHtml(ch, m, opts = {}){
        const st = escHtml(m.title||'Книга');
        const sa = escHtml(m.author||'Неизвестный автор');
        const totalImgs = ch.reduce((sum,h) => sum + extractImageNames(h).length, 0);
        return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${st}</title>
<style>
*{box-sizing:border-box;}
body{margin:0;padding:8px;}
h1.book-title{font-size:1.5em;margin:0 0 10px;border-bottom:2px solid #1a5a9a;padding-bottom:10px;}
h2{font-size:1.25em;margin:30px 0 15px;page-break-before:always;}
h2:first-of-type{page-break-before:auto;}
h3{font-size:1.1em;margin:20px 0 10px;}
p{margin:12px 0;text-align:justify;}
em{font-style:italic;}
strong{font-weight:bold;}
img.litres-img{max-width:100%;height:auto;display:block;margin:16px auto;}
.meta{font-size:0.9em;margin-bottom:30px;padding-bottom:15px;border-bottom:1px solid #ddd;opacity:0.75;}
.footer{margin-top:60px;padding-top:15px;border-top:1px solid #ddd;font-size:0.75em;text-align:center;opacity:0.6;}
@media print{body{padding:0;}h2{page-break-after:avoid;}h3{page-break-after:avoid;}p{orphans:3;widows:3;}img,.litres-img{page-break-inside:avoid!important;break-inside:avoid!important;}}
</style></head><body>
<h1 class="book-title">${st}</h1>
<div class="meta">✍️ ${sa}</div>
${ch.map((h,i)=>`<!-- Глава ${String(i).padStart(3,'0')} -->\n${h}`).join('\n')}
<div class="footer">📚 LitRes Downloader v98<br>Глав: ${ch.length} · Картинок: ${totalImgs}</div>
</body></html>`;
    }

    // ============================================================
    // Единая нормализация имени картинки
    // ============================================================
    const IMG_EXT_RE = /\.(jpe?g|png|gif|webp|svg|bmp)$/i;
    function normalizeImgName(raw){
        if(!raw) return '';
        let s = String(raw).trim();
        if(s.startsWith('data:') || s.startsWith('blob:') || s.startsWith('http')){
            s = s.split('/').pop().split('?')[0];
        }
        s = s.replace(/^\.\//, '').replace(/^.*\//, '').trim();
        if(!s || s.length < 2) return '';
        if(!IMG_EXT_RE.test(s)) s += '.jpg';
        return s;
    }

    async function detectImageMime(blob){
        try{
            const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
            if(head[0]===0x89 && head[1]===0x50 && head[2]===0x4E && head[3]===0x47) return 'image/png';
            if(head[0]===0xFF && head[1]===0xD8) return 'image/jpeg';
            if(head[0]===0x47 && head[1]===0x49 && head[2]===0x46) return 'image/gif';
            if(head[0]===0x52 && head[1]===0x49 && head[2]===0x46 && head[3]===0x46 && head[8]===0x57) return 'image/webp';
            if(head[0]===0x42 && head[1]===0x4D) return 'image/bmp';
            if(head[0]===0x3C && head[1]===0x73) return 'image/svg+xml';
        }catch(e){}
        return 'image/jpeg';
    }

    const IMG_RE = /<img[^>]+src\s*=\s*["']([^"']+)["']/gi;
    function extractImageNames(html){
        const names = new Set();
        IMG_RE.lastIndex = 0;
        let m;
        while((m = IMG_RE.exec(html)) !== null){
            const name = normalizeImgName(m[1]);
            if(name) names.add(name);
        }
        return [...names];
    }

    // EPUB всегда включён (EPUB — дефолтный формат текстовых стратегий)
    // FB2 — опционально (заменяет EPUB, когда включён)
    function isFb2Enabled(){ try{ return localStorage.getItem(FB2_MODE_KEY) === 'true'; }catch(e){ return false; } }
    function isZipEnabled(){ try{ return localStorage.getItem(ZIP_MODE_KEY) === 'true'; }catch(e){ return false; } }
    function isEpubEnabled(){ return true; } // всегда

    // ============================================================
    // buildFb2FromChapters — HTML-главы + картинки → FB2 (XML)
    // ============================================================
    async function buildFb2FromChapters(chapters, imagesMap, meta){
        const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

        function htmlToFb2Sections(html){
            const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
            const root = doc.body.firstChild;
            const out = [];
            let buf = [], opened = false;
            const flushP = () => { if(buf.length){ out.push(buf.join('\n')); buf = []; } };
            const ensureOpen = () => { if(!opened){ out.push('<section>'); opened = true; } };
            const cleanImgName = raw => normalizeImgName(raw);

            for(const node of root.childNodes){
                if(node.nodeType === 3){
                    if(node.textContent.trim()){
                        ensureOpen();
                        buf.push(`<p>${esc(node.textContent.trim())}</p>`);
                    }
                    continue;
                }
                if(node.nodeType !== 1) continue;
                const tag = node.tagName.toLowerCase();

                if(tag === 'h2'){
                    flushP();
                    if(opened) out.push('</section>');
                    out.push(`<section><title><p>${esc(node.textContent)}</p></title>`);
                    opened = true;
                }
                else if(tag === 'h3'){
                    ensureOpen(); flushP();
                    out.push(`<subtitle>${esc(node.textContent)}</subtitle>`);
                }
                else if(tag === 'p'){
                    ensureOpen();
                    let s = '';
                    for(const ch of node.childNodes){
                        if(ch.nodeType === 3) s += esc(ch.textContent);
                        else if(ch.tagName === 'EM' || ch.tagName === 'I') s += `<emphasis>${esc(ch.textContent)}</emphasis>`;
                        else if(ch.tagName === 'STRONG' || ch.tagName === 'B') s += `<strong>${esc(ch.textContent)}</strong>`;
                        else if(ch.tagName === 'IMG'){
                            const nm = cleanImgName(ch.getAttribute('src'));
                            if(nm){ flushP(); out.push(`<p><image l:href="#${esc(nm)}"/></p>`); }
                            continue;
                        }
                        else s += esc(ch.textContent);
                    }
                    if(s) buf.push(`<p>${s}</p>`);
                }
                else if(tag === 'img'){
                    ensureOpen(); flushP();
                    const name = cleanImgName(node.getAttribute('src'));
                    if(name) out.push(`<p><image l:href="#${esc(name)}"/></p>`);
                }
                else if(tag === 'br'){
                    ensureOpen(); buf.push('<empty-line/>');
                }
                else {
                    const inner = htmlToFb2Sections(node.outerHTML);
                    if(inner){ ensureOpen(); out.push(inner); }
                }
            }
            flushP();
            if(opened) out.push('</section>');
            if(!opened){ out.unshift('<section>'); out.push('</section>'); }
            return out.join('\n');
        }

        const sections = chapters.map(htmlToFb2Sections).join('\n');
        const binaries = [];
        for(const [name, blob] of imagesMap){
            const b64 = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
            const ct = await detectImageMime(blob);
            binaries.push(`<binary id="${esc(name)}" content-type="${ct}">${b64}</binary>`);
        }
        let coverXml = '';
        const coverEntry = [...imagesMap.entries()].find(([n]) => /^cover/i.test(n));
        if(coverEntry) coverXml = `<coverpage><image l:href="#${esc(coverEntry[0])}"/></coverpage>`;

        const uid = `litres-${meta.artId}-${Date.now()}`;
        const authorParts = (meta.author||'').trim().split(/\s+/);
        const fn = authorParts[0]||'', ln = authorParts.slice(1).join(' ')||'';
        const genreMap = { 'фантастика':'sf','фэнтези':'sf','детектив':'detective','роман':'love','проза':'prose','триллер':'thriller','ужасы':'horror','программирование':'comp_www','компьютеры':'comp_www' };
        const genre = genreMap[(meta.genres?.[0]||'').toLowerCase()] || 'prose';
        const cleanAnn = (meta.annotation||'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim().slice(0, 5000);

        return new Blob([`<?xml version="1.0" encoding="utf-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:l="http://www.w3.org/1999/xlink">
<description><title-info>
<genre>${genre}</genre>
<author><first-name>${esc(fn)}</first-name><last-name>${esc(ln)}</last-name></author>
<book-title>${esc(meta.title)}</book-title>
${cleanAnn ? `<annotation><p>${esc(cleanAnn)}</p></annotation>` : ''}
${coverXml}
<lang>ru</lang>
</title-info><document-info>
<author><nickname>LitRes Downloader</nickname></author>
<program-used>LitRes Downloader v98</program-used>
<date value="${new Date().toISOString().slice(0,10)}">${new Date().toLocaleDateString('ru-RU')}</date>
<id>${uid}</id>
<version>1.0</version>
</document-info></description>
<body>
${sections}
</body>
${binaries.join('\n')}
</FictionBook>`], { type: 'application/xml' });
    }

    // ============================================================
    // buildEpubFromChapters — HTML-главы + картинки → EPUB 3
    // ============================================================
    async function buildEpubFromChapters(chapters, imagesMap, meta){
        const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        const escAttr = s => String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');

        const uid = `litres-${meta.artId}-${Date.now()}`;
        const zip = new JSZip();
        zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

        zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`);

        zip.file('OEBPS/styles/style.css', `body{margin:0;padding:8px;line-height:1.5;}
h1.book-title{font-size:1.5em;margin:0 0 10px;border-bottom:2px solid #1a5a9a;padding-bottom:10px;}
h2{font-size:1.25em;margin:30px 0 15px;page-break-before:always;}
h2:first-of-type{page-break-before:auto;}
h3{font-size:1.1em;margin:20px 0 10px;}
p{margin:12px 0;text-align:justify;text-indent:1.2em;}
p.no-indent{text-indent:0;}
em{font-style:italic;}
strong{font-weight:bold;}
img{max-width:100%;height:auto;display:block;margin:16px auto;}
.cover-page{text-align:center;margin:0;padding:0;text-indent:0;}
.cover-page img{max-width:100%;height:auto;}`);

        const xhtmlFiles = [];
        const ncxPoints = [];

        const coverEntry = [...imagesMap.entries()].find(([n]) => /^cover/i.test(n));
        if(coverEntry){
            zip.file(`OEBPS/images/${coverEntry[0]}`, coverEntry[1]);
            zip.file('OEBPS/cover.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Обложка</title><link rel="stylesheet" type="text/css" href="styles/style.css"/></head>
<body><div class="cover-page"><img src="images/${escAttr(coverEntry[0])}" alt="Обложка"/></div></body>
</html>`);
            xhtmlFiles.push({ id:'cover', href:'cover.xhtml', mediaType:'application/xhtml+xml', properties:'svg', title:'Обложка', linear:'yes' });
        }

        for(let i = 0; i < chapters.length; i++){
            const num = String(i).padStart(3, '0');
            let html = chapters[i];
            const title = `Глава ${num}`;
            html = html.replace(/<img\s+([^>]*?)src="images\/([^"]+)"/gi, (m, pre, name) => {
                const cleanName = normalizeImgName(name);
                return `<img ${pre}src="images/${cleanName}"`;
            });
            html = html.replace(/<br\s*\/?>/gi, '<br/>');
            html = html.replace(/<img([^>]*[^\/])>/gi, '<img$1/>');

            const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
<title>${esc(title)}</title>
<link rel="stylesheet" type="text/css" href="styles/style.css"/>
</head>
<body>
${html}
</body>
</html>`;
            zip.file(`OEBPS/chapter_${num}.xhtml`, xhtml);
            xhtmlFiles.push({ id:`chapter_${num}`, href:`chapter_${num}.xhtml`, mediaType:'application/xhtml+xml', title, linear:'yes' });
            ncxPoints.push({ id:`chapter_${num}`, playOrder: i+1, title, src:`chapter_${num}.xhtml` });
        }

        for(const [name, blob] of imagesMap){
            if(coverEntry && name === coverEntry[0]) continue;
            zip.file(`OEBPS/images/${name}`, blob);
        }

        const manifestItems = [
            `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
            `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
            `<item id="css" href="styles/style.css" media-type="text/css"/>`
        ];
        for(const x of xhtmlFiles){
            const extraProps = x.properties ? ` properties="${x.properties}"` : '';
            manifestItems.push(`<item id="${escAttr(x.id)}" href="${escAttr(x.href)}" media-type="${escAttr(x.mediaType)}"${extraProps}/>`);
        }
        for(const [name, blob] of imagesMap){
            const mt = await detectImageMime(blob);
            manifestItems.push(`<item id="img_${escAttr(name.replace(/[^a-zA-Z0-9._-]/g,'_'))}" href="images/${escAttr(name)}" media-type="${mt}"/>`);
        }
        const spineItems = xhtmlFiles.map(x => `<itemref idref="${escAttr(x.id)}"${x.linear==='no'?' linear="no"':''}/>`).join('\n');

        const authorParts = (meta.author||'').trim().split(/\s+/);
        const cleanAnn = (meta.annotation||'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim().slice(0, 2000);

        zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="ru">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
<dc:identifier id="bookid">${esc(uid)}</dc:identifier>
<dc:title>${esc(meta.title)}</dc:title>
<dc:creator>${esc(meta.author)}</dc:creator>
<dc:language>ru</dc:language>
<dc:publisher>LitRes</dc:publisher>
${cleanAnn ? `<dc:description>${esc(cleanAnn)}</dc:description>` : ''}
<meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/,'Z')}</meta>
${coverEntry ? `<meta name="cover" content="img_${escAttr(coverEntry[0].replace(/[^a-zA-Z0-9._-]/g,'_'))}"/>` : ''}
</metadata>
<manifest>
${manifestItems.join('\n')}
</manifest>
<spine toc="ncx">
${spineItems}
</spine>
</package>`);

        zip.file('OEBPS/toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head>
<meta name="dtb:uid" content="${esc(uid)}"/>
<meta name="dtb:depth" content="1"/>
<meta name="dtb:totalPageCount" content="0"/>
<meta name="dtb:maxPageNumber" content="0"/>
</head>
<docTitle><text>${esc(meta.title)}</text></docTitle>
<docAuthor><text>${esc(meta.author)}</text></docAuthor>
<navMap>
${ncxPoints.map(p => `<navPoint id="nav_${escAttr(p.id)}" playOrder="${p.playOrder}">
<navLabel><text>${esc(p.title)}</text></navLabel>
<content src="${escAttr(p.src)}"/>
</navPoint>`).join('\n')}
</navMap>
</ncx>`);

        zip.file('OEBPS/nav.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Оглавление</title><link rel="stylesheet" type="text/css" href="styles/style.css"/></head>
<body>
<nav epub:type="toc" id="toc">
<h1>Оглавление</h1>
<ol>
${ncxPoints.map(p => `<li><a href="${escAttr(p.src)}">${esc(p.title)}</a></li>`).join('\n')}
</ol>
</nav>
</body>
</html>`);

        return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 }, mimeType: 'application/epub+zip' });
    }

    // ============================================================
    // 🆕 buildEpubFromPageImages — PDFjs-страницы → EPUB
    // (каждая страница = отдельная XHTML с <img>)
    // ============================================================
    async function buildEpubFromPageImages(pageBlobs, meta){
        const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        const uid = `litres-${meta.artId}-${Date.now()}`;
        const zip = new JSZip();
        zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
        zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`);
        zip.file('OEBPS/styles/style.css', `html,body{margin:0;padding:0;} img{max-width:100%;height:auto;display:block;margin:0 auto;}`);

        const xhtmlFiles = [];
        const ncxPoints = [];
        for(let i = 0; i < pageBlobs.length; i++){
            const num = String(i+1).padStart(3,'0');
            const name = `page_${num}.jpg`;
            zip.file(`OEBPS/images/${name}`, pageBlobs[i]);
            const title = `Стр. ${i+1}`;
            zip.file(`OEBPS/page_${num}.xhtml`, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${esc(title)}</title>
<link rel="stylesheet" type="text/css" href="styles/style.css"/></head>
<body><img src="images/${name}" alt=""/></body></html>`);
            xhtmlFiles.push({ id:`page_${num}`, href:`page_${num}.xhtml`, title });
            ncxPoints.push({ id:`page_${num}`, playOrder:i+1, title, src:`page_${num}.xhtml` });
        }

        const manifestItems = [
            `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
            `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
            `<item id="css" href="styles/style.css" media-type="text/css"/>`
        ];
        for(const x of xhtmlFiles) manifestItems.push(`<item id="${x.id}" href="${x.href}" media-type="application/xhtml+xml"/>`);
        for(let i = 0; i < pageBlobs.length; i++){
            const num = String(i+1).padStart(3,'0');
            manifestItems.push(`<item id="img_page_${num}" href="images/page_${num}.jpg" media-type="image/jpeg"/>`);
        }
        const spineItems = xhtmlFiles.map(x => `<itemref idref="${x.id}"/>`).join('\n');

        zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="ru">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">${esc(uid)}</dc:identifier>
<dc:title>${esc(meta.title||'Книга')}</dc:title>
<dc:creator>${esc(meta.author||'')}</dc:creator>
<dc:language>ru</dc:language>
<meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/,'Z')}</meta>
</metadata>
<manifest>${manifestItems.join('\n')}</manifest>
<spine toc="ncx">${spineItems}</spine>
</package>`);

        zip.file('OEBPS/toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head><meta name="dtb:uid" content="${esc(uid)}"/><meta name="dtb:depth" content="1"/></head>
<docTitle><text>${esc(meta.title||'Книга')}</text></docTitle>
<navMap>${ncxPoints.map(p => `<navPoint id="nav_${p.id}" playOrder="${p.playOrder}"><navLabel><text>${esc(p.title)}</text></navLabel><content src="${p.src}"/></navPoint>`).join('\n')}</navMap>
</ncx>`);

        zip.file('OEBPS/nav.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Оглавление</title></head>
<body><nav epub:type="toc" id="toc"><h1>Оглавление</h1>
<ol>${ncxPoints.map(p => `<li><a href="${p.src}">${p.title}</a></li>`).join('\n')}</ol>
</nav></body></html>`);

        return await zip.generateAsync({ type:'blob', compression:'DEFLATE', compressionOptions:{level:6}, mimeType:'application/epub+zip' });
    }

    async function fetchBookImage(imgName){
        const cleanName = normalizeImgName(imgName);
        if(!cleanName) return null;
        const bases = [];
        if(state.fileId) bases.push(`https://www.litres.ru/download_book_subscr/${state.artId}/${state.fileId}/json`);
        bases.push(`https://www.litres.ru/pub/t/${state.artId}.json`);
        const nameNoExt = cleanName.replace(IMG_EXT_RE, '');
        const paths = [cleanName, nameNoExt, `images/${cleanName}`, `images/${nameNoExt}`, `img/${cleanName}`, `img/${nameNoExt}`];
        for(const base of bases){
            for(const path of paths){
                try{
                    const r = await fetchWithTimeout(`${base}/${path}`, { credentials:'include' }, 18000);
                    if(!r.ok) continue;
                    const blob = await r.blob();
                    if(blob.size < 100) continue;
                    const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
                    const isImg = (head[0]===0xFF && head[1]===0xD8) || (head[0]===0x89 && head[1]===0x50) || (head[0]===0x47 && head[1]===0x49) || (head[0]===0x52 && head[1]===0x49);
                    if(!isImg) continue;
                    return { name: cleanName, blob };
                }catch(e){}
            }
        }
        return null;
    }

    async function downloadAllBookImages(chapters){
        const allNames = new Set();
        for(const html of chapters){ for(const n of extractImageNames(html)) allNames.add(n); }
        if(allNames.size === 0){ addLog('🖼️ Картинок не найдено', 'info'); return new Map(); }
        const list = [...allNames];
        addLog(`🖼️ Найдено: ${list.length}`, 'net');
        setReadingStatus(`🖼️ 0/${list.length}`);
        animateHand('wait');
        const result = new Map();
        const failed = [];
        let done = 0;
        const CONCURRENCY = (navigator.connection?.effectiveType === '4g') ? 6 : 4;
        for(let i = 0; i < list.length; i += CONCURRENCY){
            if(state.isStopped) break;
            const batch = list.slice(i, i + CONCURRENCY);
            const blobs = await Promise.all(batch.map(n => fetchBookImage(n)));
            blobs.forEach((b, idx) => { if(b){ result.set(b.name, b.blob); done++; } else { failed.push(batch[idx]); logWarn(`🖼️ Не скачалась: ${batch[idx]}`); } });
            const pct = Math.round((done + failed.length) / list.length * 100);
            setReadingStatus(`🖼️ ${done}/${list.length} (${pct}%)`);
            readingProgressText.textContent = `🖼️ ${done} ok · ${failed.length} fail`;
            progressBar.style.width = `${pct}%`;
            percentText.textContent = `${pct}%`;
            updateMini();
        }
        addLog(`✅ Картинок: ${done}/${list.length}`, done>0?'ok':'warn');
        return result;
    }

    async function fetchCoverBlob(artId){
        const tries = [`https://cdn.litres.ru/pub/c/cover_415/${artId}.jpg`,`https://cdn.litres.ru/pub/c/cover_415/${artId}.png`,`https://cdn.litres.ru/pub/c/cover/${artId}.jpg`,`https://cdn.litres.ru/pub/c/cover/${artId}.png`];
        for(const url of tries){
            try{
                const r = await fetchWithTimeout(url, { credentials:'omit', mode:'cors' }, 8000);
                if(!r.ok) continue;
                const blob = await r.blob();
                if(blob.size < 500) continue;
                const ext = url.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
                return { blob, ext, url };
            }catch(e){}
        }
        return null;
    }

    async function fetchReviews(artId, limit=20){
        try{
            const r = await fetchWithTimeout(`https://api.litres.ru/foundation/api/arts/${artId}/reviews?limit=${limit}&o=popular&pinned_first=true`, { credentials:'include', headers:getHeaders() }, 10000);
            if(!r.ok) return [];
            const d = await r.json();
            const arr = d?.payload?.data || d?.payload || d?.data || [];
            return Array.isArray(arr) ? arr : [];
        }catch(e){ return []; }
    }

    function buildAboutHtml(book, reviews){
        const st = escHtml(book.title || 'Книга');
        const cleanAnn = sanitizeHtml(book.annotation || '').trim();
        const metaParts = [];
        if(book.author) metaParts.push(`✍️ ${escHtml(book.author)}`);
        if(book.genres?.length) metaParts.push(`🏷️ ${book.genres.map(escHtml).join(', ')}`);
        if(book.publisher) metaParts.push(`🏢 ${escHtml(book.publisher)}`);
        if(book.publicationDate) metaParts.push(`📅 ${escHtml(book.publicationDate)}`);
        if(book.isbn) metaParts.push(`#️⃣ ISBN ${escHtml(book.isbn)}`);
        if(book.rating?.rated_avg) metaParts.push(`⭐ ${book.rating.rated_avg} (${book.rating.rated_total_count} оценок)`);
        if(book.url) metaParts.push(`🔗 <a href="${escHtml(book.url)}" target="_blank">${escHtml(book.url)}</a>`);
        let revHtml = '';
        if(reviews && reviews.length){
            revHtml = reviews.map(r => {
                const person = r.user || r.person || {};
                const name = escHtml(person.name || person.full_name || person.login || r.user_name || r.author_name || 'Читатель');
                const dateStr = r.created_at || r.date || r.updated_at || null;
                const date = dateStr ? new Date(dateStr).toLocaleDateString('ru-RU') : '';
                const rating = r.rating ? '★'.repeat(Math.max(0,Math.min(5,r.rating))) + '☆'.repeat(Math.max(0,5-r.rating)) : '';
                const rawText = (r.text || r.body || r.review || '').replace(/<[^>]+>/g,'');
                const text = escHtml(rawText).replace(/\n/g,'<br>');
                return `<article class="review"><header><b>${name}</b>${rating?` <span class="stars">${rating}</span>`:''}${date?` <time>${date}</time>`:''}</header><div class="rev-body">${text || '<i>—</i>'}</div></article>`;
            }).join('\n');
        } else revHtml = '<div class="empty">Рецензий пока нет</div>';
        return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>${st} — О книге</title>
<style>*{box-sizing:border-box}body{font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.7;max-width:760px;margin:0 auto;padding:40px 30px;background:#fafafa;color:#222}.cover{text-align:center;margin-bottom:30px}.cover img{max-width:320px;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.25)}h1{font-size:28px;margin:0 0 10px;color:#1a2a4a;border-bottom:3px solid #1a5a9a;padding-bottom:15px}h2{font-size:22px;margin:40px 0 18px;color:#1a2a4a;border-left:4px solid #4a8af4;padding-left:12px}.meta{color:#5a6a7a;font-size:14px;margin:14px 0 30px;line-height:1.9}.meta a{color:#1a5a9a;word-break:break-all}.annotation{background:#fff;border:1px solid #e0e6ec;border-radius:10px;padding:20px 24px;margin-bottom:30px}.review{background:#fff;border:1px solid #e0e6ec;border-radius:10px;padding:16px 20px;margin-bottom:14px}.review header{margin-bottom:8px;font-size:14px;color:#5a6a7a}.review header b{color:#1a2a4a;font-size:15px}.review .stars{color:#f0a500;margin-left:6px;letter-spacing:1px}.review time{margin-left:10px;font-size:12px;color:#8a9aaa}.rev-body{color:#2a3a4a;font-size:16px}.empty{color:#8a9aaa;font-style:italic;padding:20px;text-align:center;background:#fff;border:1px dashed #d0d8e0;border-radius:10px}.footer{margin-top:60px;padding-top:20px;border-top:1px solid #ddd;font-size:12px;color:#aab8c4;text-align:center}</style></head><body>
<div class="cover"><img src="cover.jpg" alt="${st}" onerror="this.parentElement.style.display='none'"></div>
<h1>${st}</h1>
<div class="meta">${metaParts.join(' · ')}</div>
<h2>📖 Аннотация</h2>
<div class="annotation">${cleanAnn || '<i>Аннотация отсутствует</i>'}</div>
<h2>💬 Рецензии (${reviews.length})</h2>
${revHtml}
<div class="footer">📚 LitRes Downloader v98<br>Скачано: ${new Date().toLocaleString('ru-RU')}</div>
</body></html>`;
    }

    let toolsBlob = null;
    async function downloadTools(){
        if(toolsBlob) return toolsBlob;
        for(const url of TOOLS_URLS){ try{ const r=await fetchWithTimeout(url,{credentials:'omit',mode:'cors'},30000); if(!r.ok) continue; toolsBlob=await r.blob(); return toolsBlob; }catch(e){} }
        return null;
    }

    function isLocalEnabled(){ try{ return localStorage.getItem(LOCAL_MODE_KEY) === 'true'; }catch(e){ return false; } }
    function saveToBrowser(blob, filename){
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(()=>{ a.remove(); URL.revokeObjectURL(a.href); }, 3000);
    }

    async function triggerDownload(blob, filename){
        const yadiskOn = YaDisk.enabled && YaDisk.token;
        const localOn = isLocalEnabled();
        const results = { yadisk: null, local: false };

        if(yadiskOn){
            addLog(`☁️ Отправляем на Яндекс.Диск: ${filename}`, 'step');
            setReadingStatus(`☁️ ${filename} → Диск`);
            progressBar.style.width = '0%';
            percentText.textContent = '0%';
            progressText.textContent = `☁️ ${filename}`;
            try{
                const result = await YaDisk.uploadFile(filename, blob, (loaded, total, pct, speed, eta) => {
                    progressBar.style.width = `${Math.min(pct, 100)}%`;
                    percentText.textContent = `${Math.round(pct)}%`;
                    progressText.textContent = `☁️ ${fmtBytes(loaded)} / ${fmtBytes(total)}`;
                    if(speed && speed > 0.01) readingProgressText.textContent = `☁️ ${fmtSpeed(speed)}${eta > 0 ? ` · ETA ${fmtEta(eta)}` : ''}`;
                    else readingProgressText.textContent = `☁️ ${Math.round(pct)}%`;
                    updateMini();
                });
                results.yadisk = result;
                addLog(`✅ Яндекс.Диск: ${result.path}`, 'ok');
                try{ Sound.cloudDone(); }catch(e){}
                if(result.publicUrl) addLog(`🔗 ${result.publicUrl}`, 'ok');
                zipInfo.style.display = 'inline';
                zipInfo.textContent = `☁️ ${filename}`;
                zipInfo.style.color = '#2ecc71';
                let extra = result.publicUrl ? `<div class="ldl-result-line">🔗 <a href="${result.publicUrl}" target="_blank" style="color:#4a8af4;">${result.publicUrl}</a></div>` : '';
                $('result_text').innerHTML += `<div class="ldl-result-line" style="color:#2ecc71;font-weight:700;margin-top:6px;">☁️ Загружено на Яндекс.Диск</div><div class="ldl-result-line">📁 ${result.path}</div>${extra}`;
            }catch(e){
                addLog(`❌ Яндекс.Диск: ${e.message}`, 'err');
                try{ Sound.error(); }catch(e2){}
            }
        }

        const needLocal = localOn || !yadiskOn;
        if(needLocal){
            if(localOn && yadiskOn){ addLog(`💾 Дублируем локально: ${filename}`, 'step'); try{ Sound.local(); }catch(e){} }
            else if(localOn){ addLog(`💾 Локально: ${filename}`, 'step'); try{ Sound.local(); }catch(e){} }
            else addLog(`💾 Fallback → Загрузки`, 'step');
            saveToBrowser(blob, filename);
            results.local = true;
        }
        return { ok: true, method: yadiskOn ? (localOn ? 'yadisk+local' : 'yadisk') : 'local', ...results };
    }

    async function downloadViaAnchor(url, fallbackFilename, label='файла'){
        addLog(`🌐 ${label}: <a download>...`, 'net');
        setReadingStatus(`📥 ${label} (навигация)...`);
        const a = document.createElement('a');
        a.href = url;
        a.download = fallbackFilename || 'litres-book.zip';
        a.target = '_self';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 2000);
        addLog(`✅ ${label}: браузер начал скачивание`, 'ok');
        return { ok:true, method:'anchor' };
    }

    async function buildPdfViaPrint(htmlContent, title = 'Книга', imagesMap = null){
        addLog(`🖨️ Готовим печать...`, 'step');
        try{ Sound.print(); }catch(e){}
        const objUrls = [];
        let html = htmlContent;
        if(imagesMap && imagesMap.size > 0){
            for(const [name, blob] of imagesMap){
                if(!blob || blob.size < 100) continue;
                const objUrl = URL.createObjectURL(blob);
                objUrls.push(objUrl);
                const candidates = [`src="images/${name}"`,`src="images/${name.replace(/^images\//,'')}"`,`src="${name}"`,`src='images/${name}'`,`src='${name}'`];
                for(const cand of candidates){
                    if(html.includes(cand)){
                        const quote = cand.startsWith(`src="`) ? '"' : "'";
                        html = html.split(cand).join(`src=${quote}${objUrl}${quote}`);
                        break;
                    }
                }
            }
        }
        const w = window.open('', '_blank');
        if(!w){
            addLog('⚠️ Попап заблокирован!', 'err');
            for(const u of objUrls){ try{ URL.revokeObjectURL(u); }catch(e){} }
            return { ok:false, reason:'popup-blocked' };
        }
        w.document.open();
        w.document.write(html);
        w.document.close();
        await new Promise(resolve => { const checkReady = () => { if(w.document.readyState === 'complete') resolve(); else setTimeout(checkReady, 100); }; checkReady(); setTimeout(resolve, 5000); });
        await new Promise(r => setTimeout(r, 800));
        try{ w.focus(); w.print(); addLog('🖨️ Диалог печати открыт', 'ok'); }
        catch(e){ addLog(`⚠️ print() ${e.message}`, 'err'); return { ok:false, reason:'print-failed' }; }
        setTimeout(() => { for(const u of objUrls){ try{ URL.revokeObjectURL(u); }catch(e){} } }, 60000);
        return { ok: true, method: 'print' };
    }

    async function buildPdfFromImages(imageBlobs, title='Книга'){
        if(!JSPDFLoaded){ await new Promise(res => { const c = setInterval(() => { if(JSPDFLoaded){ clearInterval(c); res(); } }, 200); setTimeout(() => { clearInterval(c); res(); }, 8000); }); }
        if(!JSPDFLoaded || !window.jspdf?.jsPDF) throw new Error('jsPDF не загрузился');
        const { jsPDF } = window.jspdf;
        let pdf = null;
        try{ Sound.pdf(); }catch(e){}
        for(let i = 0; i < imageBlobs.length; i++){
            if(state.isStopped) throw new Error('остановлено');
            const blob = imageBlobs[i];
            const dataUrl = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
            const isPng = blob.type.includes('png') || dataUrl.startsWith('data:image/png');
            const format = isPng ? 'PNG' : 'JPEG';
            const dim = await new Promise(res => { const img = new Image(); img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight }); img.onerror = () => res({ w: 595, h: 842 }); img.src = dataUrl; });
            const orientation = dim.w > dim.h ? 'l' : 'p';
            const pw = dim.w, ph = dim.h;
            if(i === 0) pdf = new jsPDF({ orientation, unit: 'px', format: [pw, ph], hotfixes: ['px_scaling'] });
            else pdf.addPage([pw, ph], orientation);
            pdf.addImage(dataUrl, format, 0, 0, pw, ph);
            if(i > 0 && i % 5 === 0){
                const pct = Math.round((i / imageBlobs.length) * 100);
                setReadingStatus(`📕 PDF: ${i}/${imageBlobs.length} (${pct}%)`);
                progressBar.style.width = `${pct}%`;
                percentText.textContent = `${pct}%`;
            }
        }
        return pdf.output('blob');
    }

    function openReaderInNewTab(){
        if(!state.fileId){ alert('❌ fileId неизвестен'); return; }
        const url = `https://www.litres.ru/static/reader/text/index.html?baseurl=/download_book_subscr/${state.artId}/${state.fileId}/&file=${state.fileId}&art=${state.artId}&uilang=ru`;
        const w = window.open(url, '_blank');
        if(!w) addLog(`⚠️ Попап заблокирован`, 'warn');
        else addLog(`🔗 Ридер открыт`, 'step');
    }

    // ═══ UI ═══
    document.body.insertAdjacentHTML('beforeend', `
<style>
@keyframes ldl-in{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}
@keyframes ldl-pulse{50%{opacity:.55}}
@keyframes ldl-glow{50%{box-shadow:0 0 14px rgba(46,204,113,.55)}}
#litres_mini{animation:ldl-in .25s;position:fixed;bottom:10px;right:10px;z-index:99999;background:#000;border:1px solid rgba(255,255,255,.08);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.7);display:none;align-items:center;gap:6px;padding:6px 10px;cursor:pointer;font-family:Segoe UI,Arial,sans-serif;transition:box-shadow .2s}
#litres_mini:hover{box-shadow:0 10px 28px rgba(74,138,244,.4)}
#litres_downloader_ui{animation:ldl-in .3s;position:fixed;bottom:10px;right:10px;z-index:99999;background:#0e0e10;color:#fff;font-family:Segoe UI,Arial,sans-serif;width:380px;max-width:calc(100vw - 20px);border-radius:14px;border:1px solid rgba(255,255,255,.08);box-shadow:0 16px 48px rgba(0,0,0,.8);overflow:hidden;display:flex;flex-direction:column;max-height:calc(100vh - 20px);user-select:none;font-size:12px;line-height:1.35}
#litres_downloader_ui *{box-sizing:border-box}
#litres_downloader_ui ::-webkit-scrollbar{width:5px;height:5px}
#litres_downloader_ui ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:3px}
.ldl-header{display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.08);flex-shrink:0;cursor:move}
.ldl-logo{width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#1a5a9a,#4a8af4);display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 3px 10px rgba(74,138,244,.35);flex-shrink:0}
.ldl-title{font-weight:700;font-size:13px;line-height:1.1}
.ldl-title .accent{color:#9c27b0}
.ldl-subtitle{font-size:9px;color:rgba(255,255,255,.4);text-transform:uppercase;margin-top:1px;letter-spacing:.3px}
.ldl-icon-btn{width:24px;height:24px;padding:0;border-radius:7px;background:rgba(255,255,255,.06);color:rgba(255,255,255,.7);border:none;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0}
.ldl-icon-btn:hover{background:rgba(255,255,255,.12);color:#fff}
.ldl-icon-btn.yadisk-btn:hover{background:rgba(252,63,29,.15);color:#fc3f1d}
.ldl-icon-btn.pos-btn:hover{background:rgba(240,165,0,.15);color:#f0a500}
.ldl-body{padding:8px 10px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:6px}
.ldl-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:6px 8px;font-size:10px;line-height:1.4}
.ldl-card.book-card{background:linear-gradient(135deg,rgba(74,138,244,.08),rgba(74,138,244,.03));border-left:2px solid #4a8af4}
.ldl-card.savings-card{background:linear-gradient(135deg,rgba(46,204,113,.12),rgba(46,204,113,.04));border-left:2px solid #2ecc71}
.ldl-card.savings-card.pulse{animation:ldl-glow 1.1s ease}
.ldl-card-title{font-weight:700;font-size:11px;margin-bottom:2px;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ldl-card-row{color:rgba(255,255,255,.6);font-size:10px;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ldl-card-row.genre-row{color:#7c9cff;cursor:help}
.ldl-card-label{font-size:9px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.3px;font-weight:700;margin-bottom:3px}
.ldl-savings-row{display:flex;align-items:center;justify-content:space-between;gap:6px}
.ldl-savings-amount{font-size:15px;font-weight:800;color:#2ecc71;font-family:'SF Mono',Consolas,monospace;line-height:1.05}
.ldl-savings-meta{font-size:9px;color:rgba(255,255,255,.5);margin-top:1px}
.ldl-savings-reset{background:rgba(255,255,255,.06);color:rgba(255,255,255,.5);border:none;border-radius:6px;padding:3px 6px;font-size:9px;cursor:pointer;transition:all .15s;flex-shrink:0}
.ldl-savings-reset:hover{background:rgba(231,76,60,.15);color:#e74c3c}
.ldl-progress-box{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:8px}
.ldl-status-row{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.ldl-hand{font-size:18px;width:24px;text-align:center;transition:transform .6s cubic-bezier(.34,1.56,.64,1);flex-shrink:0}
.ldl-hand.downloading{animation:ldl-pulse 1.4s infinite}
.ldl-status-text{flex:1;min-width:0}
.ldl-status-main{font-weight:600;font-size:11px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ldl-status-phase{font-size:9px;color:rgba(255,255,255,.4);font-family:'SF Mono',Consolas,monospace;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ldl-counter{font-size:12px;font-weight:700;color:#4a8af4;font-family:'SF Mono',Consolas,monospace;flex-shrink:0}
.ldl-bar{width:100%;height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden;margin-bottom:5px}
.ldl-bar-fill{height:100%;width:0%;background:linear-gradient(90deg,#1a5a9a,#4a8af4);border-radius:2px;transition:width .3s ease}
.ldl-progress-info{display:flex;justify-content:space-between;font-size:9px;color:rgba(255,255,255,.5);font-family:'SF Mono',Consolas,monospace;margin-bottom:6px}
.ldl-progress-info .pct{font-weight:700;color:#4a8af4}
.ldl-log{font-size:9px;color:rgba(255,255,255,.55);background:rgba(0,0,0,.4);padding:5px 7px;border-radius:6px;max-height:44px;overflow-y:auto;font-family:'SF Mono',Consolas,monospace;line-height:1.4;border:1px solid rgba(255,255,255,.05);word-break:break-word}
.ldl-result{display:none;padding:8px 10px;background:linear-gradient(135deg,rgba(39,174,96,.15),rgba(46,204,113,.08));border:1px solid rgba(39,174,96,.4);border-radius:8px;font-size:10px;line-height:1.5;position:relative}
.ldl-result-title{font-weight:800;font-size:11px;color:#2ecc71;margin-bottom:4px;padding-right:18px}
.ldl-result-close{position:absolute;top:5px;right:5px;background:transparent;border:none;color:rgba(255,255,255,.5);cursor:pointer;font-size:12px;padding:2px 5px;border-radius:5px}
.ldl-result-close:hover{background:rgba(255,255,255,.1);color:#fff}
.ldl-result-line{color:rgba(255,255,255,.8);overflow-wrap:break-word}
.ldl-result-line b{color:#fff}
.ldl-result-line .fmt{color:#9c27b0}
.ldl-result-line .money{color:#2ecc71;font-weight:700}
.ldl-buttons{display:flex;gap:5px;padding:0 10px 8px;flex-shrink:0}
.ldl-btn{padding:9px;border-radius:7px;border:none;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;justify-content:center;gap:5px;white-space:nowrap}
.ldl-btn-main{flex:3;background:linear-gradient(135deg,#27ae60,#2ecc71);color:#fff;box-shadow:0 3px 10px rgba(46,204,113,.3)}
.ldl-btn-main:hover:not(:disabled){box-shadow:0 5px 14px rgba(46,204,113,.5);transform:translateY(-1px)}
.ldl-btn-main.pause-mode{background:linear-gradient(135deg,#f0a500,#f39c12);box-shadow:0 3px 10px rgba(240,165,0,.3)}
.ldl-btn-main.continue-mode,.ldl-btn-main.repeat-mode{background:linear-gradient(135deg,#1a5a9a,#4a8af4);box-shadow:0 3px 10px rgba(74,138,244,.4)}
.ldl-btn-main:disabled{opacity:.4;cursor:not-allowed;transform:none;box-shadow:none}
.ldl-btn-stop{flex:1;background:rgba(255,255,255,.06);color:rgba(255,255,255,.7);border:1px solid rgba(255,255,255,.08);font-size:11px}
.ldl-btn-stop:hover:not(:disabled){background:rgba(231,76,60,.15);color:#e74c3c}
.ldl-btn-stop:disabled{opacity:.3;cursor:not-allowed}
.ldl-toggles{display:flex;align-items:center;gap:6px;padding:6px 10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:7px;margin:0 10px 6px;font-size:10px;flex-wrap:wrap;flex-shrink:0}
.ldl-toggle{display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-weight:600;color:rgba(255,255,255,.75);user-select:none}
.ldl-toggle:hover{color:#fff}
.ldl-toggle input{width:12px;height:12px;cursor:pointer;margin:0;accent-color:#4a8af4}
.ldl-toggle.force input{accent-color:#e74c3c}
.ldl-toggle.auto input{accent-color:#27ae60}
.ldl-toggle.print input{accent-color:#f0a500}
.ldl-toggle.yadisk input{accent-color:#fc3f1d}
.ldl-toggle.local input{accent-color:#2ecc71}
.ldl-toggle.genre input{accent-color:#7c9cff}
.ldl-toggle.fb2 input{accent-color:#f0a500}
.ldl-toggle.zip input{accent-color:#9c27b0}
.ldl-force-status{margin-left:auto;font-size:9px;color:rgba(255,255,255,.5);background:rgba(255,255,255,.06);padding:2px 6px;border-radius:6px;font-family:'SF Mono',Consolas,monospace}
.ldl-force-status.on{color:#e74c3c;background:rgba(231,76,60,.15)}
.ldl-force-status.cloud-on{color:#fc3f1d;background:rgba(252,63,29,.15)}
.ldl-force-status.local-on{color:#2ecc71;background:rgba(46,204,113,.15)}
.ldl-force-status.genre-on{color:#7c9cff;background:rgba(124,156,255,.15)}
.ldl-force-status.fb2-on{color:#f0a500;background:rgba(240,165,0,.15)}
.ldl-force-status.zip-on{color:#9c27b0;background:rgba(156,39,176,.15)}
.ldl-footer{padding:0 10px 8px;display:flex;justify-content:space-between;align-items:center;font-size:9px;color:rgba(255,255,255,.4);flex-shrink:0;gap:6px}
#status_text{flex:1;text-align:center;font-family:'SF Mono',Consolas,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#zip_info{color:rgba(255,255,255,.5);font-family:'SF Mono',Consolas,monospace;display:none}
</style>

<div id="litres_mini" title="Развернуть">
  <div style="width:24px;height:24px;border-radius:7px;background:linear-gradient(135deg,#1a5a9a,#4a8af4);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0">📚</div>
  <div style="display:flex;flex-direction:column;line-height:1.2;min-width:0">
    <div style="font-size:10px;color:#fff;font-weight:700">LitRes DL</div>
    <div id="litres_mini_status" style="font-size:9px;color:rgba(255,255,255,.5);font-family:'SF Mono',Consolas,monospace;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">готов</div>
  </div>
  <div id="litres_mini_badge" style="display:none;background:#4a8af4;color:#fff;font-size:9px;font-weight:bold;padding:1px 6px;border-radius:6px;font-family:'SF Mono',Consolas,monospace">0%</div>
  <div style="font-size:11px;color:rgba(255,255,255,.4)">▲</div>
</div>

<div id="litres_downloader_ui">
  <div class="ldl-header" id="ldl_drag_handle">
    <div class="ldl-logo">📚</div>
    <div style="flex:1;min-width:0">
      <div class="ldl-title">LitRes <span class="accent">Downloader</span></div>
      <div class="ldl-subtitle">v98 · epub by default</div>
    </div>
    <button id="btn_sound" class="ldl-icon-btn" title="Звук">🔊</button>
    <button id="btn_github" class="ldl-icon-btn" title="GitHub">🔑</button>
    <button id="btn_yadisk" class="ldl-icon-btn yadisk-btn" title="Яндекс.Диск">☁️</button>
    <button id="btn_recenter" class="ldl-icon-btn pos-btn" title="Сброс позиции">📍</button>
    <button id="btn_reader" class="ldl-icon-btn" title="Ридер">📖</button>
    <button id="btn_minimize" class="ldl-icon-btn" title="Свернуть">—</button>
    <button id="close_ui" class="ldl-icon-btn" title="Закрыть">✕</button>
  </div>

  <div class="ldl-body">
    <div class="ldl-card book-card">
      <div class="ldl-card-title" id="preview_book_title">⏳ Загрузка...</div>
      <div class="ldl-card-row">✍️ <span id="preview_book_author">—</span></div>
      <div class="ldl-card-row">📄 <span id="preview_total_pages">—</span> • <span id="preview_formats">⏳</span> • <span id="preview_price">—</span></div>
      <div class="ldl-card-row genre-row" id="preview_genres_row" style="display:none">🏷️ <span id="preview_genres">—</span></div>
    </div>

    <div class="ldl-card savings-card" id="savings_block">
      <div class="ldl-card-label">💰 Сэкономлено</div>
      <div class="ldl-savings-row">
        <div>
          <div class="ldl-savings-amount" id="savings_amount">0,00 ₽</div>
          <div class="ldl-savings-meta" id="savings_meta">0 книг</div>
        </div>
        <button class="ldl-savings-reset" id="btn_savings_reset" title="Сброс">Сброс</button>
      </div>
    </div>

    <div class="ldl-card" id="user_info_block">
      <div class="ldl-card-label">👤 Аккаунт</div>
      <div id="user_info_text">⏳ Загрузка...</div>
    </div>

    <div class="ldl-progress-box">
      <div class="ldl-status-row">
        <div class="ldl-hand" id="hand_animation">🖐️</div>
        <div class="ldl-status-text">
          <div class="ldl-status-main" id="reading_status">⏳ Инициализация...</div>
          <div class="ldl-status-phase" id="reading_progress_text">Скрипт загружается</div>
        </div>
        <div class="ldl-counter" id="page_counter">0/0</div>
      </div>
      <div class="ldl-bar"><div class="ldl-bar-fill" id="progress_bar"></div></div>
      <div class="ldl-progress-info"><span id="progress_text">📥 0 из 0</span><span class="pct" id="percent_text">0%</span></div>
      <div class="ldl-log" id="log_status">⏳ Загрузка...</div>
    </div>

    <div class="ldl-result" id="result_banner">
      <button class="ldl-result-close" id="result_close" title="Закрыть">✕</button>
      <div class="ldl-result-title">✅ Готово!</div>
      <div id="result_text"></div>
    </div>
  </div>

  <div class="ldl-buttons">
    <button id="btn_start" class="ldl-btn ldl-btn-main" disabled>⏳ Инициализация...</button>
    <button id="btn_stop" class="ldl-btn ldl-btn-stop" disabled>⏹ Стоп</button>
  </div>

  <div class="ldl-toggles">
    <label class="ldl-toggle force" title="FORCE — быстрый режим"><input type="checkbox" id="force_mode">⚡</label>
    <label class="ldl-toggle auto" title="Автостарт"><input type="checkbox" id="autostart_mode">🚀</label>
    <label class="ldl-toggle print" title="PDF через печать"><input type="checkbox" id="print_mode">🖨️</label>
    <label class="ldl-toggle yadisk" title="Грузить на Яндекс.Диск"><input type="checkbox" id="yadisk_mode">☁️</label>
    <label class="ldl-toggle local" title="Сохранять также в «Загрузки»"><input type="checkbox" id="local_mode">💾</label>
    <label class="ldl-toggle genre" title="Разбивать по жанрам на Диске"><input type="checkbox" id="genre_mode">🏷️</label>
    <label class="ldl-toggle fb2" title="Собрать FB2 (заменяет EPUB, ZIP отключается)"><input type="checkbox" id="fb2_mode">📖</label>
    <label class="ldl-toggle zip" title="Дополнительно упаковать в ZIP (HTML + images)"><input type="checkbox" id="zip_mode">📦</label>
    <div class="ldl-force-status" id="force_status">📚 epub</div>
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
    const previewPrice = $('preview_price');
    const forceMode = $('force_mode');
    const forceStatus = $('force_status');
    const userInfoText = $('user_info_text');
    const savingsAmount = $('savings_amount');
    const savingsMeta = $('savings_meta');
    const savingsBlock = $('savings_block');
    const btnSavingsReset = $('btn_savings_reset');
    const printModeCheckbox = $('print_mode');

    Sound.enabled = localStorage.getItem(SOUND_KEY) !== 'false';
    btnSound.textContent = Sound.enabled ? '🔊' : '🔇';

    let state = {
        isReady:false, isRunning:false, isPaused:false, isStopped:false, isStarting:false,
        phase:'loading', downloaded:0, total:0, startPage:1, endPage:10,
        bookTitle:bookInfo.title, bookAuthor:bookInfo.author, totalPages:bookInfo.pages||0,
        errors:0, zip:null, failedPages:[], consecutiveErrors:0,
        fileId:fileId, artId:artId, lastSaveTime:0, forceMode:false,
        bookInfoLoaded:false, directLink:null, pageFormats:null, drmActivated:false,
        autoInterval:null, mode:'zip', jsonChapters:[], jsonEmptyStreak:0, skippedChapters:[],
        jsonNotFoundStreak:0, jsonErrorStreak:0,
        minimized:false, resultFormat:null, resultFilename:null,
        savingsApplied:false, diagnostics:null, startTime:0, jsonCheckpointKey:null,
        printMode: false, fb2Mode: false, zipMode: false,
        pubtBase: null, textBase: null
    };
    try{ state.minimized = localStorage.getItem(MINI_KEY)==='1'; }catch(e){}

    const UI_MARGIN = 16;

    function resetUiPosition(animate = true){
        try{ ui.style.transition = animate ? 'left .35s cubic-bezier(.16,1,.3,1), top .35s cubic-bezier(.16,1,.3,1), right .35s, bottom .35s' : 'none'; }catch(e){}
        ui.style.left = 'auto'; ui.style.top = 'auto';
        ui.style.right = UI_MARGIN + 'px'; ui.style.bottom = UI_MARGIN + 'px';
        try{ localStorage.removeItem(UI_POS_KEY); }catch(e){}
        if(animate) setTimeout(() => { try{ ui.style.transition = ''; }catch(e){} }, 400);
    }

    function clampUiPosition(){
        const r = ui.getBoundingClientRect();
        const w = window.innerWidth, h = window.innerHeight;
        const visible = r.right > 40 && r.left < w - 40 && r.bottom > 40 && r.top < h - 40;
        if(!visible){ resetUiPosition(true); return false; }
        let newLeft = r.left, newTop = r.top, changed = false;
        if(r.left < 0){ newLeft = 0; changed = true; }
        if(r.top < 0){ newTop = 0; changed = true; }
        if(r.right > w){ newLeft = Math.max(0, w - r.width); changed = true; }
        if(r.bottom > h){ newTop = Math.max(0, h - r.height); changed = true; }
        if(changed){
            ui.style.left = newLeft + 'px'; ui.style.top = newTop + 'px';
            ui.style.right = 'auto'; ui.style.bottom = 'auto';
            try{ localStorage.setItem(UI_POS_KEY, JSON.stringify({ left: newLeft, top: newTop })); }catch(e){}
            return false;
        }
        return true;
    }

    function restoreUiPosition(){
        try{
            const saved = JSON.parse(localStorage.getItem(UI_POS_KEY) || 'null');
            if(saved && typeof saved.left === 'number' && typeof saved.top === 'number'){
                const w = window.innerWidth, h = window.innerHeight;
                if(saved.left > w - 80 || saved.top > h - 80 || saved.left < -40 || saved.top < -40){ resetUiPosition(false); return; }
                ui.style.left = saved.left + 'px'; ui.style.top = saved.top + 'px';
                ui.style.right = 'auto'; ui.style.bottom = 'auto';
            }
        }catch(e){}
    }

    (function makeDraggable(){
        const handle = $('ldl_drag_handle');
        if(!handle) return;
        let sx=0, sy=0, ox=0, oy=0, dragging=false;
        restoreUiPosition();
        handle.addEventListener('mousedown', (e) => {
            if(e.target.closest('button')) return;
            dragging = true;
            const r = ui.getBoundingClientRect();
            sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
            ui.style.left = ox + 'px'; ui.style.top = oy + 'px';
            ui.style.right = 'auto'; ui.style.bottom = 'auto';
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if(!dragging) return;
            let nx = ox + (e.clientX - sx);
            let ny = oy + (e.clientY - sy);
            const w = window.innerWidth, h = window.innerHeight;
            const rw = ui.offsetWidth || 380, rh = ui.offsetHeight || 200;
            nx = Math.max(-rw + 80, Math.min(w - 80, nx));
            ny = Math.max(0, Math.min(h - 40, ny));
            ui.style.left = nx + 'px'; ui.style.top = ny + 'px';
        });
        document.addEventListener('mouseup', () => {
            if(!dragging) return;
            dragging = false;
            const r = ui.getBoundingClientRect();
            try{ localStorage.setItem(UI_POS_KEY, JSON.stringify({ left: r.left, top: r.top })); }catch(e){}
        });
    })();

    let resizeTimer = null;
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if(!state.minimized) clampUiPosition(); }, 200); });

    const LOG_COLORS = { info:'rgba(255,255,255,.55)', ok:'#2ecc71', err:'#e74c3c', warn:'#f0a500', step:'#4a8af4', net:'#7c5cff', db:'#38bdf8', money:'#2ecc71', cloud:'#fc3f1d', local:'#2ecc71', audio:'#2ecc71', genre:'#7c9cff', fb2:'#f0a500', epub:'#9c27b0', zip:'#9c27b0' };
    function addLog(text, kind='info'){
        logStatus.textContent = `${({ok:'✓',err:'✕',warn:'⚠',step:'▸',net:'🌐',db:'💾',info:'ℹ️',money:'💰',cloud:'☁️',local:'💾',audio:'🎧',genre:'🏷️',fb2:'📖',epub:'📚',zip:'📦'})[kind]||'ℹ️'} [${new Date().toLocaleTimeString()}] ${text}`;
        logStatus.style.color = LOG_COLORS[kind] || LOG_COLORS.info;
        console.log(`[LOG:${kind}] ${text}`);
    }
    const logOk = t => addLog(t,'ok'), logErr = t => addLog(t,'err'), logWarn = t => addLog(t,'warn'), logStep = t => addLog(t,'step'), logNet = t => addLog(t,'net'), logAudio = t => addLog(t,'audio'), logGenre = t => addLog(t,'genre'), logFb2 = t => addLog(t,'fb2'), logEpub = t => addLog(t,'epub'), logZip = t => addLog(t,'zip');
    function setStatus(text, kind='info'){ statusText.textContent=text; statusText.style.color = kind==='err'?'#e74c3c':kind==='ok'?'#2ecc71':'rgba(255,255,255,.4)'; addLog(text, kind==='err'?'err':kind==='ok'?'ok':'info'); }
    function setReadingStatus(t){ readingStatus.textContent = t; }
    function setPhase(p){ state.phase = p; updateMini(); updateTabTitle(); }

    function updateSavingsDisplay(){
        try{
            if(savingsAmount) savingsAmount.textContent = formatPrice(SAVINGS.total, SAVINGS.currency);
            if(savingsMeta){
                const word = SAVINGS.books === 1 ? 'книга' : (SAVINGS.books >= 2 && SAVINGS.books <= 4) ? 'книги' : 'книг';
                savingsMeta.textContent = `${SAVINGS.books} ${word}`;
            }
        }catch(e){}
    }
    function pulseSavings(){
        try{ if(!savingsBlock) return; savingsBlock.classList.remove('pulse'); void savingsBlock.offsetWidth; savingsBlock.classList.add('pulse'); setTimeout(()=>savingsBlock.classList.remove('pulse'), 1300); }catch(e){}
    }
    function updateTabTitle(){
        try{
            const s = state.bookTitle.length>25 ? state.bookTitle.substring(0,25)+'...' : state.bookTitle;
            if(state.phase==='done') document.title = `✅ ${s}`;
            else if(state.phase==='error') document.title = `❌ ${s}`;
            else if(state.isRunning) document.title = `⏳ ${s}`;
            else document.title = s;
        }catch(e){}
    }
    function updateMini(){
        if(!mini) return;
        if(state.minimized){ ui.style.display='none'; mini.style.display='flex'; } else { ui.style.display='flex'; mini.style.display='none'; }
        try{ localStorage.setItem(MINI_KEY, state.minimized?'1':'0'); }catch(e){}
        if(state.phase==='done'){ miniStatus.textContent=`✅ ${state.resultFormat||'готово'}`; miniBadge.style.display='block'; miniBadge.textContent='✅'; miniBadge.style.background='#27ae60'; }
        else if(state.phase==='error'){ miniStatus.textContent='❌ ошибка'; miniBadge.style.display='none'; }
        else if(state.isRunning){ miniStatus.textContent=`${state.downloaded}/${state.total}`; if(state.total>0){ miniBadge.style.display='block'; miniBadge.textContent=`${Math.round(state.downloaded/state.total*100)}%`; miniBadge.style.background='#4a8af4'; } }
        else { miniStatus.textContent='готов'; miniBadge.style.display='none'; }
    }
    function updateFormatDisplay(){
        const el = previewFormats; if(!el) return;
        if(bookInfo.format) el.innerHTML = `${bookInfo.format.icon} <b style="color:#4a8af4;">${bookInfo.format.name}</b>${bookInfo.isAudio?' 🎧':''}`;
        else if(state.pageFormats && state.pageFormats.length>0) el.innerHTML = `📕 <b style="color:#4a8af4;">PDF</b> (${state.pageFormats.length} стр.)`;
        else el.innerHTML = '⏳';
    }
    function updatePriceDisplay(){
        const el = previewPrice; if(!el) return;
        if(bookInfo.price && bookInfo.price > 0) el.innerHTML = `💰 <b style="color:#2ecc71;">${formatPrice(bookInfo.price)}</b>`;
        else if(bookInfo.price === 0) el.innerHTML = `🆓 <b style="color:#2ecc71;">бесплатно</b>`;
        else el.innerHTML = '';
    }
    function updateGenresDisplay(){
        const row = $('preview_genres_row');
        const el = $('preview_genres');
        if(!row || !el) return;
        if(bookInfo.genres?.length){
            const shown = bookInfo.genres.slice(0, 3).map(g => escHtml(g)).join(', ');
            const more = bookInfo.genres.length > 3 ? ` +${bookInfo.genres.length - 3}` : '';
            el.innerHTML = `${shown}${more}`;
            row.title = bookInfo.genres.join(', ');
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    }
    function animateHand(a){
        if(a==='turn'){ handAnimation.style.transform='translateX(30px) rotate(20deg)'; setTimeout(()=>handAnimation.style.transform='translateX(-10px) rotate(-10deg)',400); setTimeout(()=>handAnimation.style.transform='translateX(0) rotate(0deg)',800); }
        else if(a==='hover'){ handAnimation.style.transform='translateX(10px) scale(1.1)'; setTimeout(()=>handAnimation.style.transform='translateX(0) scale(1)',600); }
        else if(a==='wait'){ handAnimation.style.transform='rotate(-5deg)'; setTimeout(()=>handAnimation.style.transform='rotate(5deg)',500); setTimeout(()=>handAnimation.style.transform='rotate(0deg)',1000); }
        else { handAnimation.textContent=a; handAnimation.style.transform='scale(1.3)'; setTimeout(()=>handAnimation.style.transform='scale(1)',250); }
    }
    function updateProgress(){
        const p = state.total>0 ? Math.round((state.downloaded/state.total)*100) : 0;
        progressBar.style.width = `${Math.min(p,100)}%`;
        progressText.textContent = `📥 ${state.downloaded} из ${state.total}`;
        percentText.textContent = `${p}%${state.errors>0?` (${state.errors} err)`:''}`;
        percentText.style.color = state.consecutiveErrors > 3 ? '#e74c3c' : '#4a8af4';
        pageCounter.textContent = `${state.downloaded}/${state.total}`;
        readingProgressText.textContent = `Прогресс: ${p}%`;
        updateTabTitle(); updateMini();
    }
    function updateButtons(){
        btnStart.classList.remove('pause-mode','continue-mode','repeat-mode');
        if(!state.isReady){ btnStart.disabled=true; btnStart.textContent='⏳ Инициализация...'; btnStop.disabled=true; return; }
        if(state.phase==='done'||state.phase==='error'){ btnStart.disabled=false; btnStart.textContent='🔁 Повторить'; btnStart.classList.add('repeat-mode'); btnStop.disabled=true; return; }
        if(state.isStarting){ btnStart.disabled=true; btnStart.textContent='⏳ Подготовка...'; btnStop.disabled=true; return; }
        if(state.isRunning && !state.isPaused){ btnStart.disabled=false; btnStart.textContent='⏸ Пауза'; btnStart.classList.add('pause-mode'); btnStop.disabled=false; return; }
        if(state.isRunning && state.isPaused){ btnStart.disabled=false; btnStart.textContent='▶ Продолжить'; btnStart.classList.add('continue-mode'); btnStop.disabled=false; return; }
        btnStart.disabled=false; btnStart.textContent='▶ Старт'; btnStop.disabled=true;
    }
    function showResult(format, filename, size){
        state.resultFormat = format; state.resultFilename = filename;
        const sz = size>1048576 ? (size/1048576).toFixed(2)+' MB' : size>0 ? (size/1024).toFixed(0)+' KB' : '—';
        const yadiskOn = YaDisk.enabled && YaDisk.token;
        const localOn = isLocalEnabled();
        let moneyLine = '';
        if(!state.savingsApplied && bookInfo.price && bookInfo.price > 0){
            try{ SAVINGS.add(state.artId, state.bookTitle, bookInfo.price); pulseSavings(); moneyLine = `<div class="ldl-result-line">💰 Сэкономлено: <span class="money">${formatPrice(bookInfo.price)}</span></div>`; }catch(e){}
            state.savingsApplied = true;
        } else if(!state.savingsApplied && bookInfo.price === 0){
            moneyLine = `<div class="ldl-result-line">🆓 Книга бесплатная</div>`;
            state.savingsApplied = true;
        }
        let dest = '';
        if(yadiskOn && localOn) dest = '☁️ Яндекс.Диск + 💾 Загрузки';
        else if(yadiskOn) dest = `☁️ Яндекс.Диск${YaDisk.useGenreFolders ? ' (жанры)' : ''}`;
        else dest = '💾 Папка «Загрузки»';
        const genreLine = bookInfo.genres?.length ? `<div class="ldl-result-line">🏷️ ${bookInfo.genres.map(escHtml).join(', ')}</div>` : '';
        $('result_text').innerHTML = `<div class="ldl-result-line">📁 <b>${filename}</b></div><div class="ldl-result-line">📄 Формат: <span class="fmt"><b>${format}</b></span></div>${genreLine}<div class="ldl-result-line">📦 Размер: <b>${sz}</b></div><div class="ldl-result-line">📂 Куда: <b>${dest}</b></div>${moneyLine}`;
        $('result_banner').style.display = 'block';
        setPhase('done'); setReadingStatus('✅ Готово'); animateHand('✅');
        updateButtons(); Sound.complete();
    }
    function resetForRepeat(){
        $('result_banner').style.display = 'none';
        Object.assign(state, { downloaded:0, errors:0, consecutiveErrors:0, failedPages:[], jsonChapters:[], jsonEmptyStreak:0, jsonNotFoundStreak:0, jsonErrorStreak:0, skippedChapters:[], zip:null, isStopped:false, isPaused:false, isRunning:false, isStarting:false, resultFormat:null, resultFilename:null, phase:'idle', savingsApplied:false, diagnostics:null, startTime:0, pubtBase:null, textBase:null });
        progressBar.style.width='0%'; progressText.textContent='📥 0 из 0'; percentText.textContent='0%'; pageCounter.textContent='0/0';
        setReadingStatus('📖 Готов'); animateHand('🖐️');
        updateButtons(); updateTabTitle();
        setStatus('Готов к повторному запуску');
    }

    async function saveProgress(force=false){
        if(state.downloaded===0 || !GITHUB.token) return;
        const now = Date.now();
        if(!force && now-state.lastSaveTime<30000) return;
        state.lastSaveTime = now;
        await saveProgressToGitHub(state.artId, { book_id:state.artId, book_title:state.bookTitle, book_author:state.bookAuthor, file_id:state.fileId, total_pages:state.total, downloaded_pages:state.downloaded, mode:state.mode, last_update:new Date().toISOString() });
    }
    async function saveProgressToGitHub(bookId, data){
        if(!GITHUB.token) return false;
        const path=`${GITHUB.path}${bookId}.json`;
        const enc=new TextEncoder().encode(JSON.stringify(data,null,2));
        let b=''; for(let i=0;i<enc.length;i++) b+=String.fromCharCode(enc[i]);
        const content=btoa(b);
        try{
            let sha='';
            try{ const r=await fetch(`https://api.github.com/repos/${GITHUB.repo}/contents/${path}`,{headers:{'Authorization':`token ${GITHUB.token}`}}); if(r.ok) sha=(await r.json()).sha; }catch(e){}
            const resp=await fetch(`https://api.github.com/repos/${GITHUB.repo}/contents/${path}`,{method:'PUT',headers:{'Authorization':`token ${GITHUB.token}`,'Content-Type':'application/json'},body:JSON.stringify({message:`📚 ${data.book_title}`,content,sha:sha||undefined})});
            return resp.ok;
        }catch(e){ return false; }
    }
    function askForGitHubToken(){ const t=prompt('🔑 GitHub PAT:',localStorage.getItem('github_token')||''); if(t&&t.trim()){ GITHUB.token=t.trim(); localStorage.setItem('github_token',t.trim()); return true; } return false; }

    async function getImageUrl(pageNum){
        if(!state.fileId) return null;
        const apiPage = pageNum-1;
        const fmts = (state.pageFormats && state.pageFormats[apiPage]) ? [state.pageFormats[apiPage]] : ['gif','jpg'];
        for(const ext of fmts){
            try{
                const r = await fetchWithTimeout(`https://api.litres.ru/foundation/api/arts/files/${state.fileId}/link?page_id=${apiPage}&is_trial=false&resolution=w1900&image_type=${ext}`, { credentials:'include', headers:getHeaders() }, 15000);
                if(!r.ok) continue;
                const d = await r.json();
                const url = d?.payload?.data?.link || d?.payload?.link || d?.data?.link || d?.link;
                if(url) return { url, ext };
            }catch(e){}
        }
        return null;
    }
    async function downloadPageToBlob(pageNum){
        const result = await getImageUrl(pageNum);
        if(!result) return { success:false, error:'Нет формата' };
        const { url, ext } = result;
        return new Promise(resolve => {
            const img = new Image(); img.crossOrigin='anonymous';
            const t = setTimeout(()=>{ Sound.stall(); resolve({success:false, error:'Таймаут'}); }, 25000);
            img.onload = function(){
                clearTimeout(t);
                try{
                    const c = document.createElement('canvas');
                    c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
                    c.getContext('2d').drawImage(img, 0, 0);
                    c.toBlob(blob => {
                        if(blob){ resolve({ success:true, blob, ext }); }
                        else resolve({ success:false, error:'Конвертация' });
                    }, 'image/jpeg', 0.95);
                }catch(e){ resolve({ success:false, error:e.message }); }
            };
            img.onerror = function(){ clearTimeout(t); resolve({ success:false, error:'Ошибка загрузки' }); };
            img.src = url;
        });
    }

    // Накапливаем страницы для последующей сборки EPUB
    const pageBlobs = [];
    async function downloadPageCollect(pageNum){
        const r = await downloadPageToBlob(pageNum);
        if(r.success){ pageBlobs.push(r.blob); return { success:true, size:r.blob.size }; }
        return r;
    }
    function isBookFinished(){ return state.consecutiveErrors>=20 || state.downloaded>=state.total || state.errors>=50; }

    // ============================================================
    // Финальная сборка для pdfjs-постраничной загрузки
    // → EPUB по умолчанию (или ZIP если чекбокс)
    // ============================================================
    async function finalizePageBook(){
        if(pageBlobs.length === 0){ state.isRunning = false; updateButtons(); return; }
        setStatus('📚 Собираем EPUB...'); Sound.epub();
        zipInfo.style.display = 'inline';
        const wantZip = isZipEnabled();
        const safe = state.bookTitle.replace(/[\\/:*?"<>|]/g,'_').slice(0,100);
        const meta = { title: state.bookTitle, author: state.bookAuthor, artId: state.artId };

        try{
            const epubBlob = await buildEpubFromPageImages(pageBlobs, meta);
            const epubName = `${safe}.epub`;
            await triggerDownload(epubBlob, epubName);
            zipInfo.textContent = `✅ ${epubName} (${(epubBlob.size/1048576).toFixed(2)} MB)`;
            zipInfo.style.color = '#9c27b0';
            logEpub(`📚 EPUB: ${epubName} (${(epubBlob.size/1048576).toFixed(2)} MB)`);

            if(wantZip){
                setStatus('📦 Дополнительно ZIP...');
                const zip = new JSZip();
                zip.file(epubName, epubBlob);
                for(let i = 0; i < pageBlobs.length; i++){
                    const num = String(i+1).padStart(3,'0');
                    zip.file(`pages/page_${num}.jpg`, pageBlobs[i]);
                }
                await packMetaIntoZip(zip, state.artId, {
                    title: state.bookTitle, author: state.bookAuthor,
                    annotation: bookInfo.annotation, genres: bookInfo.genres,
                    publisher: bookInfo.publisher, publicationDate: bookInfo.publicationDate,
                    isbn: bookInfo.isbn, rating: bookInfo.rating, url: bookInfo.url
                });
                const zb = await zip.generateAsync({type:'blob', compression:'DEFLATE', compressionOptions:{level:1}});
                const zn = `${safe}.zip`;
                await triggerDownload(zb, zn);
                logZip(`📦 ${zn} (${(zb.size/1048576).toFixed(2)} MB)`);
            }

            const resFmt = `📚 EPUB${wantZip?' + 📦 ZIP':''} (${pageBlobs.length} стр.)`;
            showResult(resFmt, epubName, epubBlob.size);
            await saveProgress(true);
        }catch(e){ setStatus('❌ ' + e.message, 'err'); setPhase('error'); Sound.error(); }
        state.isRunning = false; updateButtons();
    }

    async function downloadLoop(){
        if(state.isStopped) return;
        if(state.isPaused){ setTimeout(()=>{ if(!state.isPaused && state.isRunning) downloadLoop(); },1000); return; }
        if(isBookFinished()){ await finalizePageBook(); return; }
        const pageNum = state.startPage + state.downloaded;
        if(pageNum > state.endPage){ await finalizePageBook(); return; }
        setReadingStatus(`📖 Стр. ${pageNum}...`);
        animateHand('wait');
        setStatus(!state.forceMode ? `📖 Стр. ${pageNum}` : `⚡ ${pageNum}`);
        await new Promise(r=>setTimeout(r, state.forceMode?Math.random()*300+200:Math.random()*5000+3000));
        animateHand('turn');
        await new Promise(r=>setTimeout(r, 800));
        const result = await downloadPageCollect(pageNum);
        if(!result.success){ state.failedPages.push(pageNum); state.errors++; state.consecutiveErrors++; logWarn(`Стр. ${pageNum}`); Sound.warn(); }
        else { state.consecutiveErrors=0; state.downloaded++; updateProgress(); logOk(`Стр. ${pageNum} (${Math.round(result.size/1024)} KB)`); Sound.pageDone(); }
        if(state.downloaded%5===0 && state.downloaded>0) await saveProgress();
        await new Promise(r=>setTimeout(r, state.forceMode?Math.random()*200+100:Math.random()*3000+1000));
        state.autoInterval = setTimeout(()=>{ if(!state.isStopped && !state.isPaused && state.isRunning) downloadLoop(); }, 500);
    }

    function loadJsonCheckpoint(artId){
        try{
            const raw = localStorage.getItem(`${JSON_CHECKPOINT_KEY}_${artId}`);
            if(!raw) return null;
            const data = JSON.parse(raw);
            if(!data || typeof data.downloaded !== 'number') return null;
            if(Date.now() - (data.ts||0) > 7 * 24 * 3600 * 1000) return null;
            return data;
        }catch(e){ return null; }
    }
    function saveJsonCheckpoint(){ try{ localStorage.setItem(`${JSON_CHECKPOINT_KEY}_${state.artId}`, JSON.stringify({ downloaded: state.downloaded, ts: Date.now() })); }catch(e){} }
    function clearJsonCheckpoint(){ try{ localStorage.removeItem(`${JSON_CHECKPOINT_KEY}_${state.artId}`); }catch(e){} }

    async function jsonDownloadLoop(){
        if(state.isStopped) return;
        if(state.isPaused){ setTimeout(()=>{ if(!state.isPaused && state.isRunning) jsonDownloadLoop(); },1000); return; }
        if(state.total>0 && state.downloaded>=state.total){ await finalizeJsonBook(); return; }
        const n = String(state.downloaded).padStart(3,'0');
        setReadingStatus(`📖 Глава ${n}...`);
        animateHand('hover');
        setStatus(`📖 ${state.downloaded}/${state.total>0?state.total:'?'}`);
        if(state.downloaded > 0 && state.startTime){
            const elapsed = (Date.now() - state.startTime) / 1000;
            const avg = elapsed / state.downloaded;
            const eta = state.total > 0 ? avg * (state.total - state.downloaded) : 0;
            readingProgressText.textContent = `📖 ${state.downloaded} · ETA ${fmtEta(eta)}`;
        }
        const res = await fetchJsonChapter(state.downloaded);
        if(res.status === 'notfound'){
            state.jsonNotFoundStreak++;
            logWarn(`Глава ${n}: 404 (${state.jsonNotFoundStreak}/5)`);
            if(state.jsonNotFoundStreak >= 5){ logStep(`🏁 Конец — глав: ${state.jsonChapters.length}`); await finalizeJsonBook(); return; }
            state.skippedChapters.push(state.downloaded);
            state.downloaded++;
            updateProgress();
        }
        else if(res.status === 'empty'){
            state.jsonEmptyStreak++;
            logWarn(`Глава ${n} пустая (${state.jsonEmptyStreak}/10)`);
            if(state.jsonEmptyStreak >= 10){ await finalizeJsonBook(); return; }
            state.skippedChapters.push(state.downloaded);
            state.downloaded++;
            updateProgress();
        }
        else if(res.status === 'forbidden'){
            logErr(`🚫 Глава ${n}: нет доступа`);
            await finalizeJsonBook();
            return;
        }
        else if(res.status === 'error'){
            state.jsonErrorStreak++;
            logWarn(`Глава ${n}: ошибка сети (${state.jsonErrorStreak}/10)`);
            if(state.jsonErrorStreak >= 10){ await finalizeJsonBook(); return; }
            state.skippedChapters.push(state.downloaded);
            state.downloaded++;
            updateProgress();
        }
        else if(res.status === 'ok'){
            state.jsonEmptyStreak = 0; state.jsonNotFoundStreak = 0; state.jsonErrorStreak = 0;
            state.jsonChapters.push(res.html);
            state.downloaded++;
            updateProgress();
            const imgs = extractImageNames(res.html);
            const imgTag = imgs.length ? ` · 🖼️ ${imgs.length}` : '';
            logOk(`Глава ${n} — ${res.html.length} симв.${imgTag}`);
            Sound.chapterDone();
            if(state.downloaded % 20 === 0) saveJsonCheckpoint();
        }
        if(state.downloaded > 2000){ await finalizeJsonBook(); return; }
        state.autoInterval = setTimeout(()=>{ if(!state.isStopped && !state.isPaused && state.isRunning) jsonDownloadLoop(); }, state.forceMode ? 100 : 300);
    }

    // ============================================================
    // finalizeJsonBook v98 — EPUB по умолчанию, FB2 если чекбокс,
    // ZIP только если чекбокс (и FB2 выключен)
    // ============================================================
    async function finalizeJsonBook(){
        if(state.isStopped || !state.jsonChapters.length){ state.isRunning = false; updateButtons(); return; }
        setStatus('📦 Финализация...'); Sound.zip();
        zipInfo.style.display = 'inline';
        if(state.skippedChapters.length > 0) logWarn(`Пропущено: ${state.skippedChapters.length}`);

        const wantFb2 = isFb2Enabled();
        const wantZip = isZipEnabled();
        const wantEpub = !wantFb2; // EPUB — дефолт, если не выбран FB2
        console.log(`%c📦 Финализация: глав=${state.jsonChapters.length}, FB2=${wantFb2?'ВКЛ':'ВЫКЛ'}, EPUB=${wantEpub?'ВКЛ':'—'}, ZIP=${wantZip?'ВКЛ':'ВЫКЛ'}`, 'color:#f0a500;font-weight:bold');

        let imagesMap = new Map();
        try{ imagesMap = await downloadAllBookImages(state.jsonChapters); }
        catch(e){ logWarn(`🖼️ Ошибка: ${e.message}`); }

        try{
            const cover = await fetchCoverBlob(state.artId);
            if(cover && cover.blob.size > 500){
                const coverName = `cover.${cover.ext}`;
                imagesMap.set(coverName, cover.blob);
                logOk(`🖼️ Cover: ${coverName} (${(cover.blob.size/1024).toFixed(1)} KB)`);
            } else logWarn('⚠️ Cover не получен');
        }catch(e){ logWarn(`⚠️ Cover: ${e.message}`); }

        if(state.isStopped){ state.isRunning = false; updateButtons(); return; }
        const safe = state.bookTitle.replace(/[\\/:*?"<>|]/g,'_').slice(0,100);
        const imgCount = imagesMap.size;
        const chapterCount = state.jsonChapters.length;

        const metaForBuild = {
            title: state.bookTitle, author: state.bookAuthor,
            annotation: bookInfo.annotation, genres: bookInfo.genres,
            publisher: bookInfo.publisher, publicationDate: bookInfo.publicationDate,
            isbn: bookInfo.isbn, rating: bookInfo.rating, url: bookInfo.url,
            artId: state.artId
        };

        let fb2Blob = null, epubBlob = null;
        const savedFiles = [];

        // ─── FB2: если включён — единственный формат ───
        if(wantFb2){
            setStatus('📖 Собираем FB2...');
            try{
                try{ Sound.fb2(); }catch(e){}
                logFb2(`📖 FB2: ${chapterCount} глав + ${imgCount} 🖼️`);
                fb2Blob = await buildFb2FromChapters(state.jsonChapters, imagesMap, metaForBuild);
                const fn = `${safe}.fb2`;
                await triggerDownload(fb2Blob, fn);
                logFb2(`✅ ${fn} — ${(fb2Blob.size/1024).toFixed(1)} KB`);
                savedFiles.push({ name: fn, size: fb2Blob.size, kind: 'FB2' });
            }catch(e){ logErr(`❌ FB2 упал: ${e.message}`); console.error(e); fb2Blob = null; }
        }
        // ─── EPUB: по умолчанию ───
        else if(wantEpub){
            setStatus('📚 Собираем EPUB...');
            try{
                try{ Sound.epub(); }catch(e){}
                logEpub(`📚 EPUB: ${chapterCount} глав + ${imgCount} 🖼️`);
                epubBlob = await buildEpubFromChapters(state.jsonChapters, imagesMap, metaForBuild);
                const fn = `${safe}.epub`;
                await triggerDownload(epubBlob, fn);
                logEpub(`✅ ${fn} — ${(epubBlob.size/1024).toFixed(1)} KB`);
                savedFiles.push({ name: fn, size: epubBlob.size, kind: 'EPUB' });
            }catch(e){ logErr(`❌ EPUB упал: ${e.message}`); console.error(e); epubBlob = null; }
        }

        // ─── ZIP: только если чекбокс включён И FB2 выключен ───
        if(wantZip && !wantFb2){
            setStatus('📦 Собираем ZIP...');
            try{ Sound.zip(); }catch(e){}
            const zip = new JSZip();
            const html = buildBookHtml(state.jsonChapters, { title: state.bookTitle, author: state.bookAuthor });
            zip.file(`${safe}.html`, html);
            for(const [name, blob] of imagesMap){ zip.file(`images/${name}`, blob); }
            if(epubBlob) zip.file(`${safe}.epub`, epubBlob);
            await packMetaIntoZip(zip, state.artId, {
                title: state.bookTitle, author: state.bookAuthor,
                annotation: bookInfo.annotation, genres: bookInfo.genres,
                publisher: bookInfo.publisher, publicationDate: bookInfo.publicationDate,
                isbn: bookInfo.isbn, rating: bookInfo.rating, url: bookInfo.url
            });
            zip.file('book_info.txt',
                `Название: ${state.bookTitle}\nАвтор: ${state.bookAuthor}\nЖанры: ${bookInfo.genres?.join(', ') || '—'}\n` +
                `artId: ${state.artId}\nfileId: ${state.fileId || '—'}\n` +
                `Глав: ${chapterCount}\nПропущено: ${state.skippedChapters.length}\nКартинок: ${imgCount}\n` +
                `Форматы: HTML${epubBlob?' + EPUB':''} + images\n` +
                `Цена: ${bookInfo.price ? formatPrice(bookInfo.price) : '—'}\n` +
                `Дата: ${new Date().toLocaleString('ru-RU')}\nСкачано через LitRes Downloader v98`
            );
            try{
                const zb = await zip.generateAsync({type:'blob', compression:'DEFLATE', compressionOptions:{level:6}});
                const zn = `${safe}.zip`;
                await triggerDownload(zb, zn);
                logZip(`📦 ${zn} (${(zb.size/1048576).toFixed(2)} MB)`);
                zipInfo.textContent = `✅ ${zn} (${(zb.size/1048576).toFixed(2)} MB)`;
                zipInfo.style.color = '#9c27b0';
                savedFiles.push({ name: zn, size: zb.size, kind: 'ZIP' });
            }catch(e){ logWarn(`⚠️ ZIP: ${e.message}`); }
        }

        // Результат
        const fmtLabel = wantFb2 ? '📖 FB2' : ('📚 EPUB' + (wantZip ? ' + 📦 ZIP' : ''));
        const first = savedFiles[0];
        const totalSize = savedFiles.reduce((s, f) => s + f.size, 0);
        showResult(`${fmtLabel} (${chapterCount} глав, ${imgCount} 🖼️)`, first ? first.name : `${safe}.epub`, first ? first.size : 0);
        if(savedFiles.length > 1){
            $('result_text').innerHTML += `<div class="ldl-result-line">📁 Ещё: ${savedFiles.slice(1).map(f => `<b>${f.name}</b>`).join(', ')}</div>`;
        }
        await saveProgress(true);
        clearJsonCheckpoint();
        state.isRunning = false; updateButtons();
    }

    // ============================================================
    // finalizePdf — PDF сохраняем как есть (при желании + ZIP с мета)
    // ============================================================
    async function finalizePdf(pdfBlob){
        const safe = state.bookTitle.replace(/[\\/:*?"<>|"]/g,'_').replace(/[\\/:*?"<>|]/g,'_').slice(0,100);
        // Сохраняем PDF напрямую
        const pdfName = `${safe}.pdf`;
        setStatus('📕 Сохраняем PDF...');
        await triggerDownload(pdfBlob, pdfName);
        zipInfo.style.display = 'inline';
        zipInfo.textContent = `✅ ${pdfName} (${(pdfBlob.size/1048576).toFixed(2)} MB)`;
        zipInfo.style.color = '#4a8af4';
        logOk(`📕 ${pdfName} (${(pdfBlob.size/1048576).toFixed(2)} MB)`);

        // ZIP — только если чекбокс
        if(isZipEnabled()){
            setStatus('📦 Дополнительно ZIP...'); Sound.zip();
            const zip = new JSZip();
            zip.file(pdfName, pdfBlob, { compression: 'STORE' });
            await packMetaIntoZip(zip, state.artId, {
                title: state.bookTitle, author: state.bookAuthor,
                annotation: bookInfo.annotation, genres: bookInfo.genres,
                publisher: bookInfo.publisher, publicationDate: bookInfo.publicationDate,
                isbn: bookInfo.isbn, rating: bookInfo.rating, url: bookInfo.url
            });
            zip.file('book_info.txt',
                `Название: ${state.bookTitle}\nАвтор: ${state.bookAuthor}\nЖанры: ${bookInfo.genres?.join(', ') || '—'}\n` +
                `artId: ${state.artId}\nfileId: ${state.fileId || '—'}\nФормат: PDF\n` +
                `Цена: ${bookInfo.price ? formatPrice(bookInfo.price) : '—'}\n` +
                `Дата: ${new Date().toLocaleString('ru-RU')}\nСкачано через LitRes Downloader v98`
            );
            try{
                const zb = await zip.generateAsync({type:'blob', compression:'DEFLATE', compressionOptions:{level:1}});
                const zn = `${safe}.zip`;
                await triggerDownload(zb, zn);
                logZip(`📦 ${zn} (${(zb.size/1048576).toFixed(2)} MB)`);
            }catch(e){ logWarn(`⚠️ ZIP: ${e.message}`); }
        }

        showResult(`📕 PDF${isZipEnabled()?' + 📦 ZIP':''}`, pdfName, pdfBlob.size);
        await saveProgress(true);
    }

    async function saveMultimedia(blob, formatInfo){
        const safe = state.bookTitle.replace(/[\\/:*?"<>|]/g,'_').slice(0,100);
        const extMap = { 'MP3':'mp3','M4B':'m4b','M4A':'m4a','M4A/MP4':'m4a','FLAC':'flac','OGG':'ogg','WAV':'wav','MP4':'mp4','WEBM':'webm','MKV':'mkv','PDF':'pdf','ZIP':'zip' };
        const ext = extMap[formatInfo.name] || 'bin';
        const isAudio = ['MP3','M4B','M4A','M4A/MP4','FLAC','OGG','WAV'].includes(formatInfo.name);
        const mediaName = isAudio ? `${safe}_audio.${ext}` : `${safe}.${ext}`;
        const zipName  = `${safe}${isAudio ? '_audio' : ''}.zip`;
        console.log('%c═══════════════════════════════════════', 'color:#2ecc71;font-weight:bold');
        console.log('%c🎬 saveMultimedia START (audio всегда в ZIP)', 'color:#2ecc71;font-weight:bold;font-size:14px');
        console.log('%c═══════════════════════════════════════', 'color:#2ecc71;font-weight:bold');
        setStatus(`📦 Упаковка ${formatInfo.name} + метаданные...`);
        try{ Sound.zip(); }catch(e){}
        zipInfo.style.display = 'inline';
        zipInfo.textContent = `📦 Упаковка...`;
        zipInfo.style.color = '#f0a500';
        addLog(`📦 Упаковка ${formatInfo.icon} ${formatInfo.name} + cover + about.html + book_info.txt`, 'step');
        try{
            if(!JSZipLoaded){ await new Promise(res => { const c = setInterval(()=>{ if(JSZipLoaded){ clearInterval(c); res(); } }, 200); setTimeout(()=>{ clearInterval(c); res(); }, 5000); }); }
            if(typeof JSZip === 'undefined') throw new Error('JSZip не загружен');
            const zip = new JSZip();
            zip.file(mediaName, blob, { compression: 'STORE' });
            addLog(`➕ ${mediaName} (${(blob.size/1048576).toFixed(2)} MB) — STORE`, 'db');
            const packed = await packMetaIntoZip(zip, state.artId, {
                title: state.bookTitle, author: state.bookAuthor,
                annotation: bookInfo.annotation, genres: bookInfo.genres,
                publisher: bookInfo.publisher, publicationDate: bookInfo.publicationDate,
                isbn: bookInfo.isbn, rating: bookInfo.rating, url: bookInfo.url
            });
            zip.file('book_info.txt',
                `Название: ${state.bookTitle}\nАвтор: ${state.bookAuthor}\nЖанры: ${bookInfo.genres?.join(', ') || '—'}\n` +
                `artId: ${state.artId}\nfileId: ${state.fileId || '—'}\nФормат: ${formatInfo.name}${isAudio ? ' (аудио)' : ''}\n` +
                `Файл: ${mediaName}\nРазмер медиа: ${(blob.size/1048576).toFixed(2)} MB\n` +
                `Цена: ${bookInfo.price ? formatPrice(bookInfo.price) : '—'}\n` +
                `Обложка: ${packed.cover ? 'cover.'+packed.cover : 'нет'}\n` +
                `Рецензий: ${packed.about ? 'да (about.html)' : 'нет'}\n` +
                `Дата: ${new Date().toLocaleString('ru-RU')}\nСкачано через LitRes Downloader v98`
            );
            const zb = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 1 } });
            await triggerDownload(zb, zipName);
            zipInfo.textContent = `✅ ${zipName} (${(zb.size/1048576).toFixed(2)} MB)`;
            zipInfo.style.color = '#4a8af4';
            if(isAudio) logAudio(`🎧 ${mediaName} → ${zipName} (${(zb.size/1048576).toFixed(2)} MB)`);
            else addLog(`🎬 ${mediaName} → ${zipName}`, 'ok');
            showResult(`${formatInfo.icon} ${formatInfo.name} + метаданные`, zipName, zb.size);
        }catch(e){
            console.error('❌ saveMultimedia упал:', e);
            logWarn(`⚠️ ZIP не удался (${e.message}) → прямое скачивание`);
            await triggerDownload(blob, mediaName);
            zipInfo.textContent = `✅ ${mediaName} (${(blob.size/1048576).toFixed(2)} MB)`;
            zipInfo.style.color = '#4a8af4';
            showResult(`${formatInfo.icon} ${formatInfo.name}`, mediaName, blob.size);
        }
    }

    async function repackAudioZipWithMeta(sourceBlob, audioTag){
        const safe = state.bookTitle.replace(/[\\/:*?"<>|]/g,'_').slice(0,100);
        const zipName = `${safe}${audioTag.tag || '_audio'}.zip`;
        console.log('%c═══════════════════════════════════════', 'color:#e67e22;font-weight:bold');
        console.log('%c📦 repackAudioZipWithMeta START', 'color:#e67e22;font-weight:bold;font-size:14px');
        console.log('%c═══════════════════════════════════════', 'color:#e67e22;font-weight:bold');
        setStatus(`📦 Распаковка + метаданные...`);
        try{ Sound.zip(); }catch(e){}
        zipInfo.style.display = 'inline';
        zipInfo.textContent = `📦 Распаковка...`;
        zipInfo.style.color = '#f0a500';
        addLog(`📦 Распаковка ZIP + cover + about.html + book_info.txt`, 'step');
        try{
            if(!JSZipLoaded){ await new Promise(res => { const c = setInterval(()=>{ if(JSZipLoaded){ clearInterval(c); res(); } }, 200); setTimeout(()=>{ clearInterval(c); res(); }, 5000); }); }
            if(typeof JSZip === 'undefined') throw new Error('JSZip не загружен');
            const sourceZip = await JSZip.loadAsync(sourceBlob);
            const sourceFiles = Object.keys(sourceZip.files).filter(p => !sourceZip.files[p].dir);
            const newZip = new JSZip();
            let mediaCount = 0;
            for(const path of sourceFiles){
                const content = await sourceZip.files[path].async('blob');
                const isMedia = /\.(mp3|m4b|m4a|flac|ogg|wav|mp4|webm|mkv)$/i.test(path);
                if(isMedia){ newZip.file(path, content, { compression: 'STORE' }); mediaCount++; }
                else { newZip.file(path, content); }
            }
            const packed = await packMetaIntoZip(newZip, state.artId, {
                title: state.bookTitle, author: state.bookAuthor,
                annotation: bookInfo.annotation, genres: bookInfo.genres,
                publisher: bookInfo.publisher, publicationDate: bookInfo.publicationDate,
                isbn: bookInfo.isbn, rating: bookInfo.rating, url: bookInfo.url
            });
            newZip.file('book_info.txt',
                `Название: ${state.bookTitle}\nАвтор: ${state.bookAuthor}\nЖанры: ${bookInfo.genres?.join(', ') || '—'}\n` +
                `artId: ${state.artId}\nfileId: ${state.fileId || '—'}\nФормат: ZIP (аудио)\n` +
                `Аудиофайлов: ${audioTag.count} .${audioTag.ext || '?'}\n` +
                `Цена: ${bookInfo.price ? formatPrice(bookInfo.price) : '—'}\n` +
                `Дата: ${new Date().toLocaleString('ru-RU')}\nСкачано через LitRes Downloader v98`
            );
            const zb = await newZip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 1 } });
            await triggerDownload(zb, zipName);
            zipInfo.textContent = `✅ ${zipName} (${(zb.size/1048576).toFixed(2)} MB)`;
            zipInfo.style.color = '#4a8af4';
            logAudio(`🎧 ${zipName} (${(zb.size/1048576).toFixed(2)} MB) · ${mediaCount} медиа`);
            showResult(`🎧 ZIP (аудио + метаданные)`, zipName, zb.size);
        }catch(e){
            logWarn(`⚠️ Переупаковка не удалась (${e.message}) → исходный ZIP`);
            await triggerDownload(sourceBlob, zipName);
            showResult(`🎧 ZIP (аудио)`, zipName, sourceBlob.size);
        }
    }

    async function packMetaIntoZip(zip, artId, book){
        const packed = { cover: null, about: false };
        try{
            const cov = await fetchCoverBlob(artId);
            if(cov){ zip.file(`cover.${cov.ext}`, cov.blob); packed.cover = cov.ext; addLog(`➕ cover.${cov.ext} (${(cov.blob.size/1024).toFixed(1)} KB)`, 'db'); }
            else logWarn('⚠️ Обложка не найдена');
        }catch(e){ logWarn(`⚠️ Обложка: ${e.message}`); }
        try{
            const reviews = await fetchReviews(artId, 20);
            const aboutHtml = buildAboutHtml(book, reviews || []);
            zip.file('about.html', aboutHtml);
            packed.about = true;
            addLog('➕ about.html (аннотация + рецензии)', 'db');
        }catch(e){ logWarn(`⚠️ about.html: ${e.message}`); }
        return packed;
    }

    async function startSmart(){
        if(!state.isReady) return;
        if(state.phase==='done'||state.phase==='error') resetForRepeat();
        state.printMode = false;
        try{ state.printMode = localStorage.getItem(PRINT_MODE_KEY) === 'true'; }catch(e){}
        console.log(`📚 EPUB: ВСЕГДА (дефолт)`);
        console.log(`📖 FB2: ${isFb2Enabled() ? 'ВКЛ (заменит EPUB)' : 'ВЫКЛ'}`);
        console.log(`📦 ZIP: ${isZipEnabled() ? 'ВКЛ' : 'ВЫКЛ'}`);
        console.log(`🖨️ PDF принт: ${state.printMode ? 'ВКЛ' : 'ВЫКЛ'}`);
        console.log(`☁️ Яндекс.Диск: ${YaDisk.enabled ? 'ВКЛ → ' + YaDisk.getTargetFolder() + '/' : 'ВЫКЛ'}`);
        console.log(`💾 Локально: ${isLocalEnabled() ? 'ВКЛ' : 'ВЫКЛ'}`);
        if(state.isRunning && state.isPaused){
            state.isPaused=false; updateButtons(); Sound.click();
            setStatus('▶ Продолжаем...');
            if(state.mode==='json') jsonDownloadLoop(); else downloadLoop();
            return;
        }
        if(state.isRunning && !state.isPaused){
            state.isPaused=true;
            if(state.autoInterval){ clearTimeout(state.autoInterval); state.autoInterval=null; }
            updateButtons(); Sound.click();
            setStatus('⏸ Пауза'); setReadingStatus('⏸ Пауза');
            saveProgress();
            return;
        }
        if(state.isStarting) return;
        state.isStarting = true;
        updateButtons();
        setPhase('starting');
        try{
            Sound.start();
            if(!JSZipLoaded){ setStatus('⏳ JSZip...'); await new Promise(res => { const c=setInterval(()=>{ if(JSZipLoaded){ clearInterval(c); res(); } },200); setTimeout(()=>{ clearInterval(c); res(); }, 5000); }); }
            updateSession();
            if(!sessionData.sessionId){ setStatus('⚠️ Нет session-id. F5!', 'err'); Sound.error(); return; }
            if(!state.fileId){ if(!state.bookInfoLoaded) await fetchBookInfo(); state.fileId = bookInfo.fileId; fileId = bookInfo.fileId; }

            logStep('🔬 Этап 1: Диагностика...');
            const diag = await diagnoseStrategies();
            state.diagnostics = diag;
            if(!diag){ setStatus('❌ Диагностика провалилась', 'err'); Sound.error(); return; }
            logStep('🎯 Этап 2: Выбор стратегии...');
            const safe = state.bookTitle.replace(/[\\/:*?"<>|]/g,'_').slice(0,100);

            // ═══ 1. PDF прямой — ПРИОРИТЕТ ═══
            if(diag.pdf?.ok){
                logStep('📕 PDF — прямой');
                state.isRunning = true; updateButtons();
                bookInfo.format = { icon:'📕', name:'PDF' }; updateFormatDisplay();
                const fnameMatch = diag.pdf.link.match(/fname=([^&]+)/);
                const pdfFname = fnameMatch ? decodeURIComponent(fnameMatch[1]) : `${safe}.pdf`;
                let blob = null;
                try{ blob = await downloadWithProgress(diag.pdf.link, { credentials:'omit', mode:'cors' }, 'PDF', ['pdf']); }catch(e){}
                if(blob && blob.size > 1024){ logOk(`✅ PDF: ${fmtBytes(blob.size)}`); await finalizePdf(blob); state.isRunning = false; updateButtons(); return; }
                logWarn('⚠️ fetch не сработал → <a download>');
                await downloadViaAnchor(diag.pdf.link, pdfFname, 'PDF');
                showResult(`📕 PDF (навигация)`, pdfFname, 0);
                state.isRunning = false; updateButtons(); return;
            }

            // ═══ 2. ZIP toc ═══
            if(diag.zipToc?.ok){
                logStep('📦 ZIP через toc.js');
                state.isRunning = true; updateButtons();
                bookInfo.format = { icon:'📦', name:'ZIP' }; updateFormatDisplay();
                let blob = null;
                if(!/content\.litres\.ru/i.test(diag.zipToc.link)){
                    try{ blob = await downloadWithProgress(diag.zipToc.link, { credentials:'omit', mode:'cors' }, 'ZIP', ['zip']); }catch(e){}
                }
                if(blob && blob.size > 1024){
                    const at = await getZipAudioTag(blob);
                    if(at.count > 0){ logAudio(`🎧 Аудио: ${at.count} .${at.ext}`); await repackAudioZipWithMeta(blob, at); state.isRunning = false; updateButtons(); return; }
                    const fn = `${safe}${at.tag}.zip`;
                    await triggerDownload(blob, fn);
                    zipInfo.style.display='inline';
                    zipInfo.textContent = `✅ ${fn}`;
                    zipInfo.style.color = '#4a8af4';
                    showResult('📦 ZIP (как есть с LitRes)', fn, blob.size);
                    state.isRunning = false; updateButtons(); return;
                }
                logStep('📥 Попытка 2: 000.js...');
                const chUrl = `https://www.litres.ru/download_book_subscr/${state.artId}/${state.fileId}/json/000.js`;
                try{
                    const blob000 = await downloadWithProgress(chUrl, { credentials:'include' }, 'ZIP', ['zip','audio-mp3','audio-m4b','audio-m4a','audio-flac','audio-ogg','audio-wav']);
                    if(blob000 && blob000.size > 1024){
                        const info000 = blob000._detected || await detectBlobType(blob000);
                        if(info000.type === 'zip'){
                            const at = await getZipAudioTag(blob000);
                            if(at.count > 0){ logAudio(`🎧 Аудио: ${at.count} .${at.ext}`); await repackAudioZipWithMeta(blob000, at); state.isRunning = false; updateButtons(); return; }
                            const fn = `${safe}${at.tag}.zip`;
                            await triggerDownload(blob000, fn);
                            showResult('📦 ZIP (как есть с LitRes)', fn, blob000.size);
                            state.isRunning = false; updateButtons(); return;
                        }
                        if(['audio-mp3','audio-m4b','audio-m4a','audio-flac','audio-ogg','audio-wav'].includes(info000.type)){ await saveMultimedia(blob000, info000); state.isRunning = false; updateButtons(); return; }
                        if(info000.type === 'pdf'){ await finalizePdf(blob000); state.isRunning = false; updateButtons(); return; }
                    }
                }catch(e){}
                const m = diag.zipToc.link.match(/fname=([^&]+)/);
                const fname = m ? decodeURIComponent(m[1]) : `${safe}.zip`;
                await downloadViaAnchor(diag.zipToc.link, fname, 'ZIP');
                showResult('📦 ZIP (навигация)', fname, 0);
                state.isRunning = false; updateButtons(); return;
            }

            // ═══ 3. ZIP direct ═══
            if(diag.zipDirect?.ok){
                logStep('📦 ZIP напрямую');
                state.isRunning = true; updateButtons();
                bookInfo.format = { icon:'📦', name:'ZIP' }; updateFormatDisplay();
                let blob = null;
                if(!/content\.litres\.ru/i.test(diag.zipDirect.link)){
                    try{ blob = await downloadWithProgress(diag.zipDirect.link, { credentials:'omit', mode:'cors' }, 'ZIP', ['zip']); }catch(e){}
                }
                if(blob && blob.size > 1024){
                    const at = await getZipAudioTag(blob);
                    if(at.count > 0){ logAudio(`🎧 Аудио: ${at.count} .${at.ext}`); await repackAudioZipWithMeta(blob, at); state.isRunning = false; updateButtons(); return; }
                    const fn = `${safe}${at.tag}.zip`;
                    await triggerDownload(blob, fn);
                    showResult('📦 ZIP (как есть с LitRes)', fn, blob.size);
                    state.isRunning = false; updateButtons(); return;
                }
                const chUrl = `https://www.litres.ru/download_book_subscr/${state.artId}/${state.fileId}/json/000.js`;
                try{
                    const blob000 = await downloadWithProgress(chUrl, { credentials:'include' }, 'ZIP', ['zip','audio-mp3','audio-m4b','audio-m4a','audio-flac','audio-ogg','audio-wav']);
                    if(blob000 && blob000.size > 1024){
                        const info000 = blob000._detected || await detectBlobType(blob000);
                        if(info000.type === 'zip'){
                            const at = await getZipAudioTag(blob000);
                            if(at.count > 0){ logAudio(`🎧 Аудио: ${at.count} .${at.ext}`); await repackAudioZipWithMeta(blob000, at); state.isRunning = false; updateButtons(); return; }
                            const fn = `${safe}${at.tag}.zip`;
                            await triggerDownload(blob000, fn);
                            showResult('📦 ZIP (как есть с LitRes)', fn, blob000.size);
                            state.isRunning = false; updateButtons(); return;
                        }
                        if(['audio-mp3','audio-m4b','audio-m4a','audio-flac','audio-ogg','audio-wav'].includes(info000.type)){ await saveMultimedia(blob000, info000); state.isRunning = false; updateButtons(); return; }
                        if(info000.type === 'pdf'){ await finalizePdf(blob000); state.isRunning = false; updateButtons(); return; }
                    }
                }catch(e){}
                const m = diag.zipDirect.link.match(/fname=([^&]+)/);
                const fname = m ? decodeURIComponent(m[1]) : `${safe}.zip`;
                await downloadViaAnchor(diag.zipDirect.link, fname, 'ZIP');
                showResult('📦 ZIP (навигация)', fname, 0);
                state.isRunning = false; updateButtons(); return;
            }

            // ═══ 4. Audio/Video — ВСЕГДА в ZIP ═══
            if(diag.audio?.ok){
                logStep(`${diag.audio.format.icon} ${diag.audio.format.name} — мультимедиа (ZIP)`);
                state.isRunning = true; updateButtons();
                bookInfo.format = diag.audio.format; bookInfo.isAudio = true; updateFormatDisplay();
                const expected = ['audio-mp3','audio-m4b','audio-m4a','audio-flac','audio-ogg','audio-wav','video-mp4','video-webm'];
                let blob = null;
                try{ blob = await downloadWithProgress(diag.audio.link, { credentials:'omit', mode:'cors' }, diag.audio.format.name, expected); }catch(e){}
                if(blob && blob.size > 1024){ const info = blob._detected || diag.audio.format; await saveMultimedia(blob, info); state.isRunning = false; updateButtons(); return; }
                const chUrl = `https://www.litres.ru/download_book_subscr/${state.artId}/${state.fileId}/json/000.js`;
                try{
                    const blob000 = await downloadWithProgress(chUrl, { credentials:'include' }, diag.audio.format.name, null);
                    if(blob000 && blob000.size > 1024){
                        const info000 = blob000._detected || await detectBlobType(blob000);
                        if(expected.includes(info000.type)){ await saveMultimedia(blob000, info000); state.isRunning = false; updateButtons(); return; }
                        if(info000.type === 'zip'){
                            const at = await getZipAudioTag(blob000);
                            if(at.count > 0){ logAudio(`🎧 Аудио: ${at.count} .${at.ext}`); await repackAudioZipWithMeta(blob000, at); state.isRunning = false; updateButtons(); return; }
                            const fn = `${safe}${at.tag}.zip`;
                            await triggerDownload(blob000, fn);
                            showResult('📦 ZIP', fn, blob000.size);
                            state.isRunning = false; updateButtons(); return;
                        }
                        if(info000.type === 'pdf'){ await finalizePdf(blob000); state.isRunning = false; updateButtons(); return; }
                    }
                }catch(e){}
                const fnameMatch = diag.audio.link.match(/fname=([^&]+)/);
                const ext = diag.audio.format.name.toLowerCase();
                const audioFname = fnameMatch ? decodeURIComponent(fnameMatch[1]) : `${safe}_audio.${ext}`;
                await downloadViaAnchor(diag.audio.link, audioFname, diag.audio.format.name);
                showResult(`${diag.audio.format.icon} ${diag.audio.format.name} (навигация)`, audioFname, 0);
                state.isRunning = false; updateButtons(); return;
            }

            // ═══ 5. Текстовые стратегии → EPUB (или FB2) ═══
            // 5a. Классический 000.js
            if(diag.json?.ok){
                const jtype = diag.json.type;
                const chUrl = `https://www.litres.ru/download_book_subscr/${state.artId}/${state.fileId}/json/000.js`;
                logStep(`📥 000.js (тип: ${jtype})...`);
                if(jtype === 'pdf'){
                    state.isRunning = true; updateButtons();
                    bookInfo.format = { icon:'📕', name:'PDF' }; updateFormatDisplay();
                    const blob = await downloadWithProgress(chUrl, { credentials:'include' }, 'PDF', ['pdf']);
                    if(blob && blob.size > 1024){ await finalizePdf(blob); state.isRunning = false; updateButtons(); return; }
                }
                else if(jtype === 'zip'){
                    state.isRunning = true; updateButtons();
                    bookInfo.format = { icon:'📦', name:'ZIP' }; updateFormatDisplay();
                    const blob = await downloadWithProgress(chUrl, { credentials:'include' }, 'ZIP', ['zip']);
                    if(blob && blob.size > 1024){
                        const at = await getZipAudioTag(blob);
                        if(at.count > 0){ logAudio(`🎧 Аудио: ${at.count} .${at.ext}`); await repackAudioZipWithMeta(blob, at); state.isRunning = false; updateButtons(); return; }
                        const fn = `${safe}${at.tag}.zip`;
                        await triggerDownload(blob, fn);
                        showResult('📦 ZIP (как есть с LitRes)', fn, blob.size);
                        state.isRunning = false; updateButtons(); return;
                    }
                }
                else if(['audio-mp3','audio-m4b','audio-m4a','audio-flac','audio-ogg','audio-wav','video-mp4','video-webm'].includes(jtype)){
                    state.isRunning = true; updateButtons();
                    const fmtMap = { 'audio-mp3':{icon:'🎵',name:'MP3'},'audio-m4b':{icon:'🎧',name:'M4B'},'audio-m4a':{icon:'🎵',name:'M4A'},'audio-flac':{icon:'🎼',name:'FLAC'},'audio-ogg':{icon:'🎵',name:'OGG'},'audio-wav':{icon:'🎵',name:'WAV'},'video-mp4':{icon:'🎬',name:'MP4'},'video-webm':{icon:'🎬',name:'WEBM'} };
                    const fmt = fmtMap[jtype];
                    bookInfo.format = fmt; bookInfo.isAudio = true; updateFormatDisplay();
                    const blob = await downloadWithProgress(chUrl, { credentials:'include' }, fmt.name);
                    if(blob && blob.size > 1024){ const info = blob._detected || fmt; await saveMultimedia(blob, info); state.isRunning = false; updateButtons(); return; }
                }
                else if(jtype === 'json' || jtype === 'json-obj' || jtype === 'unknown'){
                    return startJsonText();
                }
            }

            // 5b. /pub/t/ (draft_free / бесплатные)
            if(diag.pubT?.ok){
                logStep(`📚 /pub/t/: ${diag.pubT.note}`);
                state.pubtBase = diag.pubT.base;
                if(typeof diag.pubT.chapters === 'number' && diag.pubT.chapters > 0) state.total = diag.pubT.chapters;
                return startJsonText();
            }

            // ═══ 6. PDFjs постранично → EPUB ═══
            if(diag.pdfjs?.ok){
                logStep(`📕 JPG/GIF постранично — ${diag.pdfjs.pages} стр. → EPUB`);
                state.pageFormats = diag.pdfjs.pageFormats;
                state.totalPages = diag.pdfjs.pages; state.drmActivated = true;
                bookInfo.format = { icon:'📕', name:'PDF→EPUB' }; updateFormatDisplay();
                const tp = diag.pdfjs.pages;
                state.startPage=1; state.endPage=tp; state.total=tp;
                state.downloaded=0; state.errors=0; state.consecutiveErrors=0; state.failedPages=[];
                pageBlobs.length = 0;
                state.isRunning=true; state.isPaused=false; state.isStopped=false;
                state.mode='zip'; state.zip = null;
                state.startTime = Date.now();
                updateProgress();
                setStatus(`🚀 1-${tp}`);
                setReadingStatus('📖 Открываем книгу...'); animateHand('hover');
                updateButtons();
                setTimeout(downloadLoop, 1000); return;
            }

            setStatus('❌ Все стратегии провалились', 'err');
            Sound.error();
        } finally {
            state.isStarting = false;
            if(!state.isRunning) updateButtons();
        }

        // ─── Текстовые стратегии в EPUB (или FB2) ───
        function startJsonText(){
            const wantFb2On = isFb2Enabled();
            const wantZipOn = isZipEnabled();
            const fmtLabel = wantFb2On ? 'FB2' : ('EPUB' + (wantZipOn ? '+ZIP' : ''));
            bookInfo.format = { icon: wantFb2On ? '📖' : '📚', name: fmtLabel }; updateFormatDisplay();
            state.mode = 'json';
            state.jsonChapters=[]; state.jsonEmptyStreak=0; state.jsonNotFoundStreak=0; state.jsonErrorStreak=0; state.skippedChapters=[];
            state.downloaded=0;
            if(!state.total || state.total > 5000) state.total = 999;
            state.isRunning=true; state.isPaused=false; state.isStopped=false;
            state.startPage=0; state.endPage=state.total;
            state.zip = new JSZip();
            state.startTime = Date.now();
            const cp = loadJsonCheckpoint(state.artId);
            if(cp && cp.downloaded > 0 && cp.downloaded < 2000){
                if(confirm(`💾 Чекпоинт: глава ${cp.downloaded}. Продолжить?`)){ state.downloaded = cp.downloaded; logStep(`💾 Продолжаем с ${cp.downloaded}`); }
                else clearJsonCheckpoint();
            }
            updateProgress();
            setStatus(`📖 Загрузка глав (→ ${wantFb2On ? 'FB2' : 'EPUB'})...`);
            setReadingStatus('📖 Читаем главы...'); animateHand('hover');
            updateButtons();
            setTimeout(jsonDownloadLoop, 500);
        }
    }

    function stopDownload(){
        if(!state.isReady) return;
        state.isStopped=true; state.isRunning=false; state.isPaused=false;
        if(state.autoInterval){ clearTimeout(state.autoInterval); state.autoInterval=null; }
        setStatus(`⏹ Стоп. ${state.downloaded}`);
        setReadingStatus('⏹ Прервано');
        Sound.warn();
        if(state.downloaded>0) saveProgress(true);
        updateButtons();
    }

    // ═══ HANDLERS ═══
    btnStart.addEventListener('click', startSmart);
    btnStop.addEventListener('click', stopDownload);
    $('btn_github').addEventListener('click', () => { if(askForGitHubToken()) logOk('GitHub токен сохранён'); });
    $('btn_reader').addEventListener('click', () => openReaderInNewTab());
    btnSound.addEventListener('click', () => { Sound.enabled = !Sound.enabled; btnSound.textContent = Sound.enabled?'🔊':'🔇'; localStorage.setItem(SOUND_KEY, Sound.enabled?'true':'false'); if(Sound.enabled) Sound.click(); });
    $('btn_minimize').addEventListener('click', () => { state.minimized=true; updateMini(); Sound.click(); });
    mini.addEventListener('click', () => { state.minimized=false; updateMini(); Sound.click(); });
    $('close_ui').addEventListener('click', () => { stopDownload(); ui.remove(); mini.remove(); });
    $('btn_recenter').addEventListener('click', () => { resetUiPosition(true); try{ Sound.recenter(); }catch(e){} addLog('📍 Окно в угол', 'ok'); });

    const resultCloseBtn = $('result_close');
    if(resultCloseBtn) resultCloseBtn.addEventListener('click', () => { $('result_banner').style.display = 'none'; Sound.click(); });

    if(btnSavingsReset) btnSavingsReset.addEventListener('click', () => { if(confirm('💰 Сбросить счётчик?')){ SAVINGS.reset(); pulseSavings(); Sound.warn(); } });

    forceMode.addEventListener('change', function(){
        state.forceMode=this.checked;
        updateForceStatusBadge();
        Sound.click();
    });

    if(printModeCheckbox){
        try{ printModeCheckbox.checked = localStorage.getItem(PRINT_MODE_KEY) === 'true'; }catch(e){}
        printModeCheckbox.addEventListener('change', function(){
            try{ localStorage.setItem(PRINT_MODE_KEY, this.checked ? 'true' : 'false'); }catch(e){}
            Sound.click();
            addLog(this.checked?'🖨️ PDF принт ВКЛ':'📦 PDF принт ВЫКЛ', 'ok');
        });
    }

    YaDisk.init();

    $('btn_yadisk').addEventListener('click', async () => {
        Sound.click();
        const target = YaDisk.getTargetFolder();
        const currentStatus = YaDisk.token ? '✅ токен есть' : '❌ токена нет';
        const choice = prompt(
            `☁️ Яндекс.Диск\n\n` +
            `Токен: ${currentStatus}\nСтруктура: ${target}/книга.zip\n` +
            `Годы: ${YaDisk.useYearFolders?'✅':'❌'} · Жанры: ${YaDisk.useGenreFolders?'✅':'❌'}\n` +
            `Публикация: ${YaDisk.publish?'✅':'❌'}\n\n` +
            `1 — ввести/сменить токен\n2 — сменить базовую папку\n3 — разбивать по годам\n4 — публиковать ссылки\n` +
            `5 — проверить токен\n6 — сбросить токен\n7 — посмотреть структуру\n` +
            `8 — 💾 локально (${isLocalEnabled()?'✅':'❌'})\n9 — 🏷️ жанры (${YaDisk.useGenreFolders?'✅':'❌'})`,
            '1'
        );

        if(choice === '1'){
            const t = prompt('🔑 OAuth-токен Яндекс.Диска:', YaDisk.token || '');
            if(t && t.trim()){
                await YaDisk.setToken(t);
                const check = await YaDisk.checkToken();
                if(check.ok) logOk(`✅ Токен валиден! ${fmtBytes(check.usedSpace)} / ${fmtBytes(check.totalSpace)}`);
                else logErr(`❌ ${check.error}`);
            }
        }
        else if(choice === '2'){ const f = prompt('📁 Базовая папка:', YaDisk.baseFolder); if(f && f.trim()){ YaDisk.setBaseFolder(f); logOk(`✅ База: ${YaDisk.baseFolder}/`); } }
        else if(choice === '3'){ YaDisk.setUseYearFolders(!YaDisk.useYearFolders); logOk(YaDisk.useYearFolders?'✅ Годы ВКЛ':'❌ Годы ВЫКЛ'); }
        else if(choice === '4'){ YaDisk.setPublish(!YaDisk.publish); logOk(YaDisk.publish?'✅ Публикация ВКЛ':'❌ Публикация ВЫКЛ'); }
        else if(choice === '5'){ if(!YaDisk.token){ alert('❌ Сначала токен'); return; } const check = await YaDisk.checkToken(); if(check.ok) logOk(`✅ ${fmtBytes(check.usedSpace)} / ${fmtBytes(check.totalSpace)}`); else logErr(`❌ ${check.error}`); }
        else if(choice === '6'){ if(confirm('Сбросить токен?')){ localStorage.removeItem(YADISK_TOKEN_KEY); YaDisk.token = ''; logWarn('🗑️ Токен сброшен'); } }
        else if(choice === '7'){
            if(!YaDisk.token){ alert('❌ Сначала токен'); return; }
            const base = YaDisk.baseFolder; const target = YaDisk.getTargetFolder();
            try{
                const baseExists = await YaDisk.ensureFolder(base);
                const targetExists = baseExists ? await YaDisk.ensureFolder(target) : false;
                if(baseExists) logOk(`✅ ${base}/`);
                if(targetExists){ logOk(`✅ ${target}/`); const items = await YaDisk.listFolder(target); const files = items.filter(x => x.type === 'file'); const folders = items.filter(x => x.type === 'dir'); addLog(`📊 ${files.length} файлов, ${folders.length} папок`, 'ok'); }
            }catch(e){ logErr(`❌ ${e.message}`); }
        }
        else if(choice === '8'){
            const now = !isLocalEnabled();
            try{ localStorage.setItem(LOCAL_MODE_KEY, now ? 'true' : 'false'); }catch(e){}
            const cb = $('local_mode'); if(cb) cb.checked = now;
            logOk(now ? '💾 Локально ВКЛ' : '💾 Локально ВЫКЛ');
            updateForceStatusBadge();
        }
        else if(choice === '9'){
            const now = !YaDisk.useGenreFolders;
            YaDisk.setUseGenreFolders(now);
            const cb = $('genre_mode'); if(cb) cb.checked = now;
            if(now){ try{ Sound.genre(); }catch(e){} logGenre(`🏷️ Жанры ВКЛ`); }
            else logOk('🏷️ Жанры ВЫКЛ');
            updateForceStatusBadge();
        }
    });

    const yadiskCheckbox = $('yadisk_mode');
    if(yadiskCheckbox){
        yadiskCheckbox.checked = YaDisk.enabled;
        yadiskCheckbox.addEventListener('change', function(){
            if(this.checked && !YaDisk.token){ alert('☁️ Сначала токен (кнопка ☁️)'); this.checked = false; return; }
            YaDisk.setEnabled(this.checked);
            Sound.click();
            if(this.checked){ try{ Sound.cloud(); }catch(e){} addLog(`☁️ Диск ВКЛ → ${YaDisk.getTargetFolder()}/`, 'ok'); }
            else addLog('🖥️ Диск ВЫКЛ', 'ok');
            updateForceStatusBadge();
        });
    }

    const localCheckbox = $('local_mode');
    if(localCheckbox){
        localCheckbox.checked = isLocalEnabled();
        localCheckbox.addEventListener('change', function(){
            try{ localStorage.setItem(LOCAL_MODE_KEY, this.checked ? 'true' : 'false'); }catch(e){}
            Sound.click();
            addLog(this.checked ? '💾 Локально ВКЛ' : '💾 Локально ВЫКЛ', 'ok');
            updateForceStatusBadge();
        });
    }

    const genreCheckbox = $('genre_mode');
    if(genreCheckbox){
        genreCheckbox.checked = YaDisk.useGenreFolders;
        genreCheckbox.addEventListener('change', function(){
            YaDisk.setUseGenreFolders(this.checked);
            Sound.click();
            if(this.checked){ try{ Sound.genre(); }catch(e){} logGenre(`🏷️ Жанры ВКЛ → ${YaDisk.getTargetFolder()}/`); }
            else addLog('🏷️ Жанры ВЫКЛ', 'ok');
            updateForceStatusBadge();
        });
    }

    // 📖 FB2 (заменяет EPUB и отключает ZIP)
    const fb2Checkbox = $('fb2_mode');
    if(fb2Checkbox){
        try{ fb2Checkbox.checked = isFb2Enabled(); }catch(e){}
        fb2Checkbox.addEventListener('change', function(){
            try{ localStorage.setItem(FB2_MODE_KEY, this.checked ? 'true' : 'false'); }catch(e){}
            Sound.click();
            if(this.checked){
                try{ Sound.fb2(); }catch(e){}
                logFb2('📖 FB2 ВКЛ → текст будет сохранён ТОЛЬКО как .fb2 (без EPUB и ZIP)');
                const zc = $('zip_mode'); if(zc) zc.checked = false;
                try{ localStorage.setItem(ZIP_MODE_KEY, 'false'); }catch(e){}
            } else {
                logOk('📚 FB2 ВЫКЛ → текст → EPUB');
            }
            updateForceStatusBadge();
        });
    }

    // 📦 ZIP (дополнительно)
    const zipCheckbox = $('zip_mode');
    if(zipCheckbox){
        try{ zipCheckbox.checked = isZipEnabled(); }catch(e){}
        zipCheckbox.addEventListener('change', function(){
            if(this.checked && isFb2Enabled()){
                alert('📖 FB2 включён — ZIP отключён (FB2 не пакуется). Отключите FB2 чтобы использовать ZIP.');
                this.checked = false;
                return;
            }
            try{ localStorage.setItem(ZIP_MODE_KEY, this.checked ? 'true' : 'false'); }catch(e){}
            Sound.click();
            if(this.checked){ try{ Sound.zip(); }catch(e){} logZip('📦 ZIP ВКЛ — дополнительно упакуем HTML + images (+ EPUB)'); }
            else logOk('📦 ZIP ВЫКЛ');
            updateForceStatusBadge();
        });
    }

    function updateForceStatusBadge(){
        const fs = $('force_status');
        if(!fs) return;
        fs.className = 'ldl-force-status';
        const y = YaDisk.enabled && YaDisk.token;
        const l = isLocalEnabled();
        const g = YaDisk.useGenreFolders;
        const f = isFb2Enabled();
        const z = isZipEnabled() && !f;
        const parts = [];
        if(state.forceMode){ parts.push('⚡'); fs.classList.add('on'); }
        if(y){ parts.push('☁️'); fs.classList.add('cloud-on'); }
        if(l){ parts.push('💾'); fs.classList.add('local-on'); }
        if(y && g){ parts.push('🏷️'); fs.classList.add('genre-on'); }
        if(f){ parts.push('📖'); fs.classList.add('fb2-on'); }
        else { parts.push('📚'); } // EPUB по умолчанию
        if(z){ parts.push('📦'); fs.classList.add('zip-on'); }
        fs.textContent = parts.length ? parts.join(' ') : '📚 epub';
    }

    try{ $('autostart_mode').checked = localStorage.getItem(AUTOSTART_KEY)==='true'; }catch(e){}
    $('autostart_mode').addEventListener('change', function(){ try{ localStorage.setItem(AUTOSTART_KEY, this.checked?'true':'false'); }catch(e){} Sound.click(); addLog(this.checked?'🚀 АВТО ВКЛ':'🚀 АВТО ВЫКЛ', 'ok'); });

    window.downloaderUI = {
        version: 'v98',
        start: startSmart, stop: stopDownload, state, Sound, addLog, SAVINGS, formatPrice,
        YaDisk, isLocalEnabled, isFb2Enabled, isZipEnabled, isEpubEnabled,
        resetUiPosition, clampUiPosition,
        getZipAudioTag, normalizeImgName, detectImageMime,
        diagnoseStrategies,
        checkStrategy_Pdf, checkStrategy_ZipToc, checkStrategy_ZipDirect,
        checkStrategy_Audio, checkStrategy_000js, checkStrategy_PubT, checkStrategy_Pdfjs,
        downloadWithProgress, detectBlobType, downloadViaAnchor,
        buildPdfFromImages, buildPdfViaPrint,
        buildFb2FromChapters, buildEpubFromChapters, buildEpubFromPageImages,
        fetchBookInfo, fetchUserInfo, fetchJsonChapter, buildBookHtml, parseLitFile,
        litJsonToHtml, saveProgressToGitHub, fetchCoverBlob, fetchReviews,
        buildAboutHtml, packMetaIntoZip, openReaderInNewTab,
        extractImageNames, fetchBookImage, downloadAllBookImages,
        updateSavingsDisplay, sanitizeHtml,
        JSPDFLoaded: () => JSPDFLoaded,
        JSZipLoaded: () => JSZipLoaded
    };

    async function init(){
        SAVINGS.load();
        updateSavingsDisplay();
        setStatus('⏳ Загрузка...');
        addLog(`🔍 Тип: ${pageType}`);
        updateMini(); updateButtons();
        previewBookTitle.textContent = '⏳ Загрузка...';
        const ok = await fetchBookInfo();
        if(ok){
            previewBookTitle.textContent = bookInfo.title;
            previewBookAuthor.textContent = bookInfo.author;
            previewTotalPages.textContent = bookInfo.pages;
            updatePriceDisplay();
            updateGenresDisplay();
            state.bookTitle = bookInfo.title; state.bookAuthor = bookInfo.author;
            state.totalPages = bookInfo.pages; state.bookInfoLoaded = true;
            if(bookInfo.fileId){ state.fileId = bookInfo.fileId; fileId = bookInfo.fileId; }
            addLog(`✅ ${bookInfo.pages} ${bookInfo.isAudio?'сек':'стр.'}${bookInfo.genres.length ? ' · 🏷️ '+bookInfo.genres.length : ''}`, 'ok');
            if(bookInfo.format){ updateFormatDisplay(); logStep(`Формат: ${bookInfo.format.icon} ${bookInfo.format.name}`); }
        } else setStatus('⚠️ Не удалось загрузить книгу', 'err');

        setTimeout(async () => {
            const u = await fetchUserInfo();
            if(u){
                let h = `<div>👤 <b>${u.id}</b>${u.login?' • '+u.login:''}</div>`;
                if(u.email) h += `<div style="font-size:10px;">📧 ${u.email} ${u.isEmailConfirmed?'✅':'⚠️'}</div>`;
                userInfoText.innerHTML = h;
            } else userInfoText.innerHTML = '<div>⚠️ Нет данных</div>';
        }, 300);

        state.isReady = true;
        setStatus('✅ Готов', 'ok');
        setReadingStatus('📖 Готов к старту');
        animateHand('🖐️');
        updateButtons();
        updateTabTitle();
        updateForceStatusBadge();
        console.log('%c✅ LitRes Downloader v98 готов!', 'color:#4ade80;font-weight:bold;font-size:14px;');
        console.log(`%c💰 ${formatPrice(SAVINGS.total)} (${SAVINGS.books} книг)`, 'color:#2ecc71;font-weight:bold;');
        if(YaDisk.token) console.log(`%c☁️ Диск: ${YaDisk.getTargetFolder()}/ ${YaDisk.useGenreFolders ? '🏷️' : ''}`, 'color:#fc3f1d;font-weight:bold;');
        if(isFb2Enabled()) console.log('%c📖 FB2 режим (заменяет EPUB и ZIP)', 'color:#f0a500;font-weight:bold;');
        else console.log('%c📚 EPUB режим (по умолчанию)', 'color:#9c27b0;font-weight:bold;');
        if(isZipEnabled()) console.log('%c📦 Доп. ZIP ВКЛ', 'color:#9c27b0;font-weight:bold;');
    }

    let currentArtId = artId;
    let urlLock = false;
    function getArtIdFromUrl(){ const p = new URLSearchParams(window.location.search); const u = p.get('art'); if(u) return u; const m = window.location.pathname.match(/-(\d+)\/?$/); return m?m[1]:null; }
    async function handleUrlChange(){
        if(urlLock) return;
        urlLock = true;
        try{
            const newArtId = getArtIdFromUrl();
            if(!newArtId || newArtId === currentArtId){ urlLock=false; return; }
            logStep('Переход...');
            currentArtId = newArtId; artId = newArtId; fileId = null;
            if(state.autoInterval){ clearTimeout(state.autoInterval); state.autoInterval=null; }
            state.isReady = false;
            Object.assign(state, { isRunning:false, isPaused:false, isStopped:true, downloaded:0, total:0, totalPages:0, pageFormats:null, drmActivated:false, fileId:null, artId:newArtId, directLink:null, bookInfoLoaded:false, jsonChapters:[], mode:'zip', phase:'loading', savingsApplied:false, diagnostics:null, startTime:0, pubtBase:null, textBase:null });
            bookInfo.format = null; bookInfo.isAudio = false; bookInfo.price = null; bookInfo.imagesCount = 0; bookInfo.genres = [];
            previewBookTitle.textContent = '⏳ Загрузка...'; previewBookAuthor.textContent = '...'; previewTotalPages.textContent = '—'; previewFormats.textContent = '⏳'; previewPrice.textContent = '';
            updateGenresDisplay();
            progressBar.style.width = '0%';
            updateButtons();
            const ok = await fetchBookInfo();
            if(ok){
                previewBookTitle.textContent = bookInfo.title; previewBookAuthor.textContent = bookInfo.author;
                previewTotalPages.textContent = bookInfo.pages; updatePriceDisplay(); updateGenresDisplay();
                state.bookTitle = bookInfo.title; state.bookAuthor = bookInfo.author;
                state.totalPages = bookInfo.pages; state.fileId = bookInfo.fileId; state.bookInfoLoaded = true;
                updateFormatDisplay();
            }
            state.isReady = true;
            setStatus('📖 Готов');
            updateButtons(); updateTabTitle();
        }catch(e){}
        setTimeout(()=>{ urlLock = false; }, 500);
    }
    const _ps = history.pushState; history.pushState = function(){ _ps.apply(this, arguments); setTimeout(handleUrlChange, 700); };
    const _rs = history.replaceState; history.replaceState = function(){ _rs.apply(this, arguments); setTimeout(handleUrlChange, 700); };
    window.addEventListener('popstate', () => setTimeout(handleUrlChange, 700));
    let lt = document.title;
    setInterval(() => { if(document.title !== lt){ lt = document.title; handleUrlChange(); } }, 1500);

    init().then(() => {
        const params = new URLSearchParams(window.location.search);
        const urlAuto = params.get('autostart_litres') === '1';
        let lsAuto = false;
        try{ lsAuto = localStorage.getItem(AUTOSTART_KEY)==='true'; }catch(e){}
        if(urlAuto || lsAuto){
            logStep('🚀 Автостарт через 2 сек...');
            setTimeout(() => { if(state.isReady && !state.isRunning && !state.isStarting) startSmart(); }, 2000);
        }
    });

})();

        } catch (e) {
            console.error('❌ LitRes Downloader: критическая ошибка', e);
            alert('❌ LitRes Downloader v98: ' + e.message + '\nСмотри консоль.');
        }
    });

})();