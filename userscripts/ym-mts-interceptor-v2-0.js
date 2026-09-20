// ==UserScript==
// @name         YM+MTS Interceptor v2.0
// @namespace    dimasik-debug
// @version      2.0
// @description  Перехват API Яндекс.Музыки и MTS Music: fetch/XHR/cookies/secrets
// @author       Diminssoft
// @match        https://music.yandex.ru/*
// @match        https://music.mts.ru/*
// @icon         https://raw.githubusercontent.com/dimasik-debug/Images/main/icon_1.png
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function ymMtsInterceptorV2() {
    'use strict';

    console.log('%c🕵️ YM+MTS Interceptor v2.0', 'color:#ff0055;font-size:16px;font-weight:bold;');
    document.getElementById('ym_interceptor_ui')?.remove();
    document.getElementById('ym_mini')?.remove();

    // ═══════════════════════════════════════════════════════════
    // 🔊 SOUND
    // ═══════════════════════════════════════════════════════════
    const Sound = {
        ctx:null, enabled:true, masterGain:null,
        init(){ if(this.ctx) return; try{ this.ctx=new (window.AudioContext||window.webkitAudioContext)(); this.masterGain=this.ctx.createGain(); this.masterGain.gain.value=0.35; this.masterGain.connect(this.ctx.destination);}catch(e){this.enabled=false;} },
        note(f,d=0.35,v=0.15,delay=0,type='sine'){ if(!this.enabled) return; this.init(); if(!this.ctx) return; try{ if(this.ctx.state==='suspended') this.ctx.resume(); const t=this.ctx.currentTime+delay; const o=this.ctx.createOscillator(),g=this.ctx.createGain(),fl=this.ctx.createBiquadFilter(); fl.type='lowpass'; fl.frequency.value=3500; fl.Q.value=0.7; o.type=type; o.frequency.setValueAtTime(f,t); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v,t+0.04); g.gain.setValueAtTime(v,t+d*0.6); g.gain.exponentialRampToValueAtTime(0.0001,t+d); o.connect(fl); fl.connect(g); g.connect(this.masterGain); o.start(t); o.stop(t+d+0.05); }catch(e){} },
        chord(fs,d=0.5,v=0.12,type='sine'){ fs.forEach((f,i)=>this.note(f,d+i*0.05,v*(1-i*0.15),i*0.03,type)); },
        glide(a,b,d=0.3,v=0.12){ if(!this.enabled) return; this.init(); if(!this.ctx) return; try{ if(this.ctx.state==='suspended') this.ctx.resume(); const t=this.ctx.currentTime; const o=this.ctx.createOscillator(),g=this.ctx.createGain(); o.type='sine'; o.frequency.setValueAtTime(a,t); o.frequency.exponentialRampToValueAtTime(b,t+d); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v,t+0.05); g.gain.exponentialRampToValueAtTime(0.0001,t+d); o.connect(g); g.connect(this.masterGain); o.start(t); o.stop(t+d+0.05); }catch(e){} },
        click(){ this.note(587,0.12,0.08,0,'sine'); },
        start(){ this.chord([349,440,523],0.5,0.10); },
        request(){ this.note(523,0.08,0.05,0,'sine'); },
        response(){ this.note(659,0.10,0.05,0,'sine'); },
        secret(){ this.chord([784,988,1319],0.35,0.11,'triangle'); },
        important(){ this.chord([880,1108,1318],0.25,0.09,'triangle'); },
        error(){ this.note(294,0.35,0.09,0,'sine'); this.note(247,0.5,0.07,0.15,'sine'); },
        save(){ this.note(1047,0.15,0.06,0,'triangle'); },
        stop(){ this.chord([523,440,349],0.4,0.10); },
        clear(){ this.glide(880,220,0.4,0.08); },
        warn(){ this.note(440,0.2,0.07,0,'triangle'); this.note(349,0.3,0.06,0.1,'triangle'); }
    };

    // ═══════════════════════════════════════════════════════════
    // ⭐ ВАЖНЫЕ ЭНДПОИНТЫ
    // ═══════════════════════════════════════════════════════════
    const IMPORTANT_ENDPOINTS = [
        { re:/\/get-file-info\b/i, name:'get-file-info', service:'yandex', importance:3, desc:'Ссылка на mp3 (sign)' },
        { re:/\/download-info\b/i, name:'download-info', service:'yandex', importance:3, desc:'DownloadInfoUrl' },
        { re:/\/plays\b/i, name:'plays', service:'yandex', importance:3, desc:'Логирование прослушивания' },
        { re:/log\.strm\.yandex\.ru/i, name:'log.strm (beacon)', service:'yandex', importance:3, desc:'Плеер-беконы' },
        { re:/\/get-mp3\//i, name:'get-mp3 (CDN)', service:'yandex', importance:3, desc:'CDN-ссылка mp3' },
        { re:/\/account\/status\b/i, name:'account/status', service:'yandex', importance:3, desc:'Статус аккаунта' },
        { re:/\/account\/login/i, name:'account/login', service:'yandex', importance:3, desc:'Логин' },
        { re:/\/search\/instant\/mixed/i, name:'search/instant', service:'yandex', importance:2, desc:'Поиск' },
        { re:/\/tracks\/[^\/]+$/i, name:'tracks/{id}', service:'yandex', importance:2, desc:'Инфо о треке' },
        { re:/\/albums\/[^\/]+\/with-tracks/i, name:'albums/with-tracks', service:'yandex', importance:2, desc:'Альбом' },
        { re:/\/playlist\/[^\/]+/i, name:'playlist/{uuid}', service:'yandex', importance:2, desc:'Плейлист' },
        { re:/\/landing\//i, name:'landing/*', service:'yandex', importance:2, desc:'Лендинги' },
        { re:/\/chart\b/i, name:'chart', service:'yandex', importance:2, desc:'Чарты' },
        { re:/\/artists\/[^\/]+\/track-ids/i, name:'artist/track-ids', service:'yandex', importance:2, desc:'Топ артиста' },
        { re:/\/metatags\//i, name:'metatags', service:'yandex', importance:2, desc:'Метатеги' },
        { re:/\/non-music\//i, name:'non-music', service:'yandex', importance:2, desc:'Аудиокниги' },
        { re:/\/queues\b/i, name:'queues', service:'yandex', importance:2, desc:'Очередь' },
        { re:/\/likes\b/i, name:'likes', service:'yandex', importance:2, desc:'Лайки' },
        { re:/\/users\/[^\/]+\/playlists/i, name:'user/playlists', service:'yandex', importance:2, desc:'Плейлисты юзера' },
        { re:/\/music-history\b/i, name:'music-history', service:'yandex', importance:2, desc:'История' },
        { re:/\/wave\b/i, name:'wave', service:'yandex', importance:2, desc:'Моя волна' },
        { re:/passport\.yandex\.ru/i, name:'passport.yandex.ru', service:'yandex', importance:3, desc:'Авторизация' },
        { re:/oauth\.yandex\.ru/i, name:'oauth.yandex.ru', service:'yandex', importance:3, desc:'OAuth' },
        { re:/yandex\.ru\/user-id/i, name:'user-id', service:'yandex', importance:2, desc:'Получение uid' },
        { re:/captcha/i, name:'captcha', service:'yandex', importance:3, desc:'🚨 КАПЧА' },
        { re:/music\.mts\.ru\/ya-proxy/i, name:'MTS ya-proxy', service:'mts', importance:3, desc:'MTS прокси' },
        { re:/\/api\/account\/mts\/status/i, name:'MTS account/status', service:'mts', importance:3, desc:'Статус MTS' },
        { re:/api\.music\.yandex\.net\/tracks\/[^\/]+\/download-info/i, name:'MTS download-info', service:'mts', importance:3, desc:'MTS download info' },
        { re:/api\.music\.yandex\.net\/get-file-info/i, name:'MTS get-file-info', service:'mts', importance:3, desc:'MTS sign' },
        { re:/\/ya-proxy\/api\/get-mp3\//i, name:'MTS get-mp3 proxy', service:'mts', importance:3, desc:'MTS CDN' },
        { re:/music\.mts\.ru\/ya-proxy\/api\/search/i, name:'MTS search', service:'mts', importance:2, desc:'MTS поиск' },
        { re:/music\.mts\.ru\/ya-proxy\/api\/tracks/i, name:'MTS tracks', service:'mts', importance:2, desc:'MTS треки' },
        { re:/music\.mts\.ru\/ya-proxy\/api\/albums/i, name:'MTS albums', service:'mts', importance:2, desc:'MTS альбомы' },
        { re:/music\.mts\.ru\/ya-proxy\/api\/playlists/i, name:'MTS playlists', service:'mts', importance:2, desc:'MTS плейлисты' },
        { re:/music\.mts\.ru\/ya-proxy\/api\/account/i, name:'MTS account', service:'mts', importance:2, desc:'MTS account' },
        { re:/music\.mts\.ru\/ya-proxy\/api\/likes/i, name:'MTS likes', service:'mts', importance:2, desc:'MTS избранное' },
        { re:/login\.mts\.ru|auth\.mts\.ru/i, name:'MTS login', service:'mts', importance:3, desc:'Авторизация MTS' },
        { re:/music\.mts\.ru\/api\//i, name:'MTS /api/*', service:'mts', importance:1, desc:'MTS прочее' },
    ];

    const SECRET_PATTERNS = [
        /secret[_-]?key/i, /\bsign(ature)?\b/i, /\bhmac\b/i,
        /\btoken\b/i, /\baccess[_-]?token\b/i, /\brefresh[_-]?token\b/i,
        /\bapi[_-]?key\b/i, /\bclient[_-]?secret\b/i,
        /\bauth(entication)?[_-]?(key|token)\b/i,
        /\bsession[_-]?id\b/i, /\bcsrf\b/i, /\bxsrf\b/i,
        /\bprivate[_-]?key\b/i, /\bpassport[_-]?uid\b/i,
        /\bxyauth\b/i, /\bsession[_-]?uuid\b/i,
        /\bsigb\b/i,
    ];

    const TOKEN_COOKIE_NAMES = [
        'yandex_token', '_ym_uid', 'Session_id', 'sessionid2', 'supersid',
        'L', 'yandexuid', 'yuidss', 'i', 'yandex_login', 'MTS_AUTH', 'mts_token',
        'session_id', 'auth_token', 'csrftoken', 'XSRF-TOKEN',
    ];

    const SOUND_KEY = 'ym_sound_enabled';
    const MINI_KEY = 'ym_minimized';
    const FILTER_KEY = 'ym_filter_url';
    const ONLY_IMPORTANT_KEY = 'ym_only_important';

    const state = {
        running: false, paused: false,
        startedAt: null, stoppedAt: null,
        logs: [], secrets: [], cookies: new Map(),
        urlFilter: '', onlyImportant: false,
        counters: { requests:0, responses:0, errors:0, secrets:0, important:0, captcha:0 },
        endpointStats: new Map(),
        maxLogs: 5000,
        minimized: localStorage.getItem(MINI_KEY)==='1',
    };

    const ts = () => new Date().toISOString();
    const nowMs = () => performance.now();
    const shortUrl = u => { try{ const url=new URL(u,location.href); return url.pathname + (url.search?'?'+url.search.slice(0,150):''); }catch(e){ return String(u).slice(0,200); } };
    function safeStringify(obj, maxLen=50000){
        try{ const s=JSON.stringify(obj,(k,v)=>{ if(typeof v==='string'&&v.length>20000) return v.slice(0,20000)+'...[trunc]'; return v; },2); return s&&s.length>maxLen?s.slice(0,maxLen)+'...[trunc]':s; }
        catch(e){ try{ return String(obj); }catch(_){ return '[unserializable]'; } }
    }
    function classifyUrl(url) {
        if (!url) return null;
        for (const ep of IMPORTANT_ENDPOINTS) if (ep.re.test(url)) return ep;
        return null;
    }
    function matchesFilter(url, endpoint) {
        if (state.onlyImportant && !endpoint) return false;
        if (!state.urlFilter) return true;
        try { return new RegExp(state.urlFilter, 'i').test(url); }
        catch(e) { return url.includes(state.urlFilter); }
    }
    function recordEndpoint(endpoint, url) {
        if (!endpoint) return;
        let st = state.endpointStats.get(endpoint.name);
        if (!st) {
            st = { count:0, service:endpoint.service, importance:endpoint.importance, desc:endpoint.desc, lastUrl:'', lastTime:null };
            state.endpointStats.set(endpoint.name, st);
        }
        st.count++;
        st.lastUrl = url.slice(0, 200);
        st.lastTime = ts();
    }
    function findSecrets(obj, path='', depth=0){
        const found=[];
        if(depth>8||!obj||typeof obj!=='object') return found;
        try{
            for(const k of Object.keys(obj)){
                const v=obj[k];
                const fp=path?path+'.'+k:k;
                for(const re of SECRET_PATTERNS){
                    if(re.test(k)){
                        const valStr = typeof v==='string'?v:(typeof v==='number'?String(v):safeStringify(v,300));
                        found.push({ path:fp, key:k, value:valStr });
                        break;
                    }
                }
                if(v&&typeof v==='object') found.push(...findSecrets(v, fp, depth+1));
            }
        }catch(e){}
        return found;
    }
    function log(entry){
        if(!state.running && entry.type!=='system') return;
        entry.t = ts(); entry.ms = nowMs();
        state.logs.push(entry);
        if(state.logs.length > state.maxLogs) state.logs.shift();
        updateUI();
    }
    function recordSecrets(secrets, sourceUrl){
        if(!secrets||!secrets.length) return;
        for(const s of secrets){
            state.secrets.push({ t: ts(), source: sourceUrl, path: s.path, key: s.key, value: s.value });
            state.counters.secrets++;
        }
        log({ type:'secret_found', url: sourceUrl, count: secrets.length, secrets: secrets.slice(0,10) });
        Sound.secret();
        addLog(`🔑 Найдено ${secrets.length} секрет(ов) в ${shortUrl(sourceUrl)}`, 'secret');
    }
    function recordCookieHeader(setCookieStr, source){
        if(!setCookieStr) return;
        const parts = setCookieStr.split(/,(?=[^;]+?=)/);
        for(const part of parts){
            const m = part.match(/^\s*([^=;]+)=([^;]*)/);
            if(m) recordCookie(m[1].trim(), m[2].trim(), source);
        }
    }
    function recordCookie(name, value, source){
        if(!name) return;
        const existing = state.cookies.get(name);
        const isToken = TOKEN_COOKIE_NAMES.some(t => t.toLowerCase() === name.toLowerCase());
        if(existing){
            if(existing.value !== value){
                existing.lastSeen = ts();
                existing.value = value;
                existing.changes = (existing.changes||0) + 1;
                log({ type:'cookie_change', name, value, source });
            } else existing.lastSeen = ts();
        } else {
            state.cookies.set(name, { value, firstSeen: ts(), lastSeen: ts(), source, changes: 0, isToken });
            state.counters.cookies = (state.counters.cookies || 0) + 1;
            log({ type:'cookie_new', name, value: value.slice(0,100), source, isToken });
            if (isToken) addLog(`🔑 Найдена кука-токен: ${name}`, 'secret');
        }
    }
    function snapshotCookies(){
        try{
            document.cookie.split(';').forEach(c=>{
                const m=c.trim().match(/^([^=]+)=(.*)$/);
                if(m) recordCookie(m[1].trim(), m[2].trim(), 'document.cookie(init)');
            });
        }catch(e){}
    }

    // ═══════════════════════════════════════════════════════════
    // FETCH HOOK
    // ═══════════════════════════════════════════════════════════
    const originalFetch = window.fetch;
    window.fetch = async function(input, init){
        if(!state.running || state.paused) return originalFetch.apply(this, arguments);
        const url = typeof input==='string' ? input : (input&&input.url)||'';
        const method = (init&&init.method)||(input&&input.method)||'GET';
        const endpoint = classifyUrl(url);
        if(!matchesFilter(url, endpoint)) return originalFetch.apply(this, arguments);
        const reqHeaders = {};
        try{
            const h = (init&&init.headers) || (input&&input.headers);
            if(h instanceof Headers) h.forEach((v,k)=>reqHeaders[k]=v);
            else if(Array.isArray(h)) h.forEach(([k,v])=>reqHeaders[k]=v);
            else if(h&&typeof h==='object') Object.assign(reqHeaders,h);
        }catch(e){}
        let reqBody = null;
        try{
            if(init&&init.body){
                if(typeof init.body==='string') reqBody = init.body;
                else if(init.body instanceof URLSearchParams) reqBody = init.body.toString();
                else if(init.body instanceof FormData){ reqBody='[FormData]'; for(const [k,v] of init.body.entries()) reqBody += `\n  ${k}: ${typeof v==='string'?v.slice(0,500):'[file]'}`; }
                else if(init.body instanceof Blob || init.body instanceof ArrayBuffer) reqBody = '[binary]';
            }
        }catch(e){}
        state.counters.requests++;
        if (endpoint) {
            state.counters.important++;
            recordEndpoint(endpoint, url);
            Sound.important();
            addLog(`⭐ [${endpoint.service.toUpperCase()}] ${endpoint.name} — ${endpoint.desc}`, 'step');
            if (/captcha/i.test(url)) { state.counters.captcha++; addLog('🚨 КАПЧА!', 'err'); }
        } else Sound.request();
        log({ type:'fetch_request', url, method, headers:reqHeaders, body:reqBody, endpoint: endpoint ? {name:endpoint.name, service:endpoint.service, importance:endpoint.importance} : null });
        const urlSecrets = [];
        for(const re of SECRET_PATTERNS){
            const m = url.match(new RegExp(re.source+'=([^&]+)','i'));
            if(m) urlSecrets.push({ path:'url', key:re.source, value:m[1].slice(0,200) });
        }
        for(const [k,v] of Object.entries(reqHeaders)){
            for(const re of SECRET_PATTERNS){
                if(re.test(k)){ urlSecrets.push({ path:'header.'+k, key:k, value:String(v).slice(0,200) }); break; }
            }
        }
        if(urlSecrets.length) recordSecrets(urlSecrets, url+' [REQUEST]');
        const startTime = nowMs();
        try{
            const response = await originalFetch.apply(this, arguments);
            const elapsed = nowMs() - startTime;
            const clone = response.clone();
            const respHeaders = {};
            try{
                clone.headers.forEach((v,k)=>respHeaders[k]=v);
                if(clone.headers.get('set-cookie')) recordCookieHeader(clone.headers.get('set-cookie'), url);
            }catch(e){}
            (async ()=>{
                try{
                    const ct = (clone.headers.get('content-type')||'').toLowerCase();
                    let bodyText = null, bodyJson = null;
                    if(ct.includes('json')){ bodyJson = await clone.json(); bodyText = safeStringify(bodyJson); }
                    else if(ct.includes('text')||ct.includes('html')||ct.includes('xml')){ bodyText = await clone.text(); }
                    else { bodyText = '[binary]'; }
                    state.counters.responses++;
                    log({ type:'fetch_response', url, method, status:response.status, elapsed_ms:Math.round(elapsed), headers:respHeaders, body:bodyText ? bodyText.slice(0,50000) : null, endpoint: endpoint ? {name:endpoint.name, service:endpoint.service, importance:endpoint.importance} : null });
                    if (!endpoint) Sound.response();
                    if(bodyJson){
                        const found = findSecrets(bodyJson);
                        if(found.length) recordSecrets(found, url+' [RESPONSE]');
                    }
                }catch(e){ state.counters.errors++; log({ type:'fetch_body_error', url, error:String(e) }); }
            })();
            return response;
        }catch(err){
            state.counters.errors++;
            log({ type:'fetch_error', url, method, error:String(err) });
            Sound.error();
            throw err;
        }
    };

    // ═══════════════════════════════════════════════════════════
    // XHR HOOK
    // ═══════════════════════════════════════════════════════════
    const XHROpen = XMLHttpRequest.prototype.open;
    const XHRSend = XMLHttpRequest.prototype.send;
    const XHRSetHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.open = function(method, url, ...rest){
        this.__ym_method = method; this.__ym_url = url; this.__ym_headers = {};
        return XHROpen.apply(this, [method, url, ...rest]);
    };
    XMLHttpRequest.prototype.setRequestHeader = function(name, value){
        if(!this.__ym_headers) this.__ym_headers = {};
        this.__ym_headers[name] = value;
        return XHRSetHeader.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function(body){
        if(!state.running || state.paused) return XHRSend.apply(this, arguments);
        const url = this.__ym_url||'';
        const method = this.__ym_method||'GET';
        const endpoint = classifyUrl(url);
        if(!matchesFilter(url, endpoint)) return XHRSend.apply(this, arguments);
        state.counters.requests++;
        if (endpoint) {
            state.counters.important++;
            recordEndpoint(endpoint, url);
            Sound.important();
            addLog(`⭐ [XHR ${endpoint.service.toUpperCase()}] ${endpoint.name} — ${endpoint.desc}`, 'step');
        } else Sound.request();
        log({ type:'xhr_request', url, method, headers:this.__ym_headers||{}, body: typeof body==='string'?body:null, endpoint: endpoint ? {name:endpoint.name, service:endpoint.service, importance:endpoint.importance} : null });
        const startTime = nowMs();
        const onDone = ()=>{
            const elapsed = nowMs() - startTime;
            try{
                state.counters.responses++;
                const respHeaders = {};
                const rawHeaders = this.getAllResponseHeaders()||'';
                rawHeaders.split('\r\n').forEach(line=>{
                    const m = line.match(/^([^:]+):\s*(.*)$/);
                    if(m) respHeaders[m[1].toLowerCase()] = m[2];
                });
                if(respHeaders['set-cookie']) recordCookieHeader(respHeaders['set-cookie'], url);
                let bodyText = null, bodyJson = null;
                try{
                    if(this.responseType===''||this.responseType==='text'){ bodyText = this.responseText; try{ bodyJson = JSON.parse(bodyText); }catch(e){} }
                    else if(this.responseType==='json'){ bodyJson = this.response; bodyText = safeStringify(bodyJson); }
                }catch(e){}
                log({ type:'xhr_response', url, method, status:this.status, elapsed_ms:Math.round(elapsed), headers:respHeaders, body: bodyText ? bodyText.slice(0,50000) : null, endpoint: endpoint ? {name:endpoint.name, service:endpoint.service, importance:endpoint.importance} : null });
                if (!endpoint) Sound.response();
                if(bodyJson){
                    const found = findSecrets(bodyJson);
                    if(found.length) recordSecrets(found, url+' [XHR-RESPONSE]');
                }
            }catch(e){ state.counters.errors++; log({ type:'xhr_response_error', url, error:String(e) }); }
        };
        this.addEventListener('load', onDone);
        this.addEventListener('error', ()=>{ state.counters.errors++; log({ type:'xhr_error', url, method }); Sound.error(); });
        return XHRSend.apply(this, arguments);
    };

    // ═══════════════════════════════════════════════════════════
    // COOKIE HOOK
    // ═══════════════════════════════════════════════════════════
    try{
        const desc = Object.getOwnPropertyDescriptor(Document.prototype,'cookie') || Object.getOwnPropertyDescriptor(HTMLDocument.prototype,'cookie');
        if(desc && desc.set){
            const origSet = desc.set;
            Object.defineProperty(document, 'cookie', {
                get: desc.get,
                set: function(val){
                    if(state.running && !state.paused){
                        const m = String(val).match(/^([^=]+)=([^;]*)/);
                        if(m) recordCookie(m[1].trim(), m[2].trim(), 'document.cookie(setter)');
                    }
                    return origSet.call(this, val);
                },
                configurable: true,
            });
        }
    }catch(e){ console.warn('cookie hook failed:', e); }

    // ═══════════════════════════════════════════════════════════
    // ОТЧЁТ
    // ═══════════════════════════════════════════════════════════
    function indent(text){ return String(text).split('\n').map(l=>'     '+l).join('\n'); }
    function buildReport(){
        const L = [];
        L.push('═'.repeat(78));
        L.push('  YM+MTS INTERCEPTOR v2.0 — ОТЧЁТ');
        L.push('═'.repeat(78));
        L.push('Создан: ' + new Date().toLocaleString('ru-RU'));
        L.push('URL: ' + location.href);
        L.push('Старт: ' + (state.startedAt ? new Date(state.startedAt).toLocaleString('ru-RU') : '—'));
        L.push('Стоп: ' + (state.stoppedAt ? new Date(state.stoppedAt).toLocaleString('ru-RU') : '—'));
        L.push('');
        L.push('📊 СТАТИСТИКА:');
        L.push('  Запросов: ' + state.counters.requests);
        L.push('  Ответов: ' + state.counters.responses);
        L.push('  Ошибок: ' + state.counters.errors);
        L.push('  🔑 Секретов: ' + state.counters.secrets);
        L.push('  ⭐ Важных: ' + state.counters.important);
        L.push('  🚨 Капч: ' + state.counters.captcha);
        L.push('  🍪 Кук: ' + state.cookies.size);
        L.push('');
        L.push('⭐ СТАТИСТИКА ПО ЭНДПОИНТАМ:');
        if (state.endpointStats.size === 0) L.push('  (не найдено)');
        else {
            const sorted = Array.from(state.endpointStats.entries()).sort((a,b)=>{
                if (b[1].importance !== a[1].importance) return b[1].importance - a[1].importance;
                return b[1].count - a[1].count;
            });
            for (const [name, st] of sorted) L.push(`  ${'⭐'.repeat(st.importance)} [${st.service}] ${name.padEnd(28)} × ${st.count}`);
        }
        L.push('');
        L.push('🔑 СЕКРЕТЫ (' + state.secrets.length + '):');
        state.secrets.forEach((s,i)=>{
            L.push(`[${i+1}] ${s.source}`);
            L.push(`    ${s.path} = ${s.value.slice(0,200)}`);
        });
        L.push('');
        L.push('🍪 КУКИ (' + state.cookies.size + '):');
        for(const [name, info] of state.cookies.entries()) L.push(`  ${name}${info.isToken?' 🔑':''} = ${info.value.slice(0,100)}`);
        L.push('');
        L.push('📜 ЛОГ (' + state.logs.length + '):');
        state.logs.forEach((e,i)=>{
            const epMark = e.endpoint ? ` [⭐${e.endpoint.service}:${e.endpoint.name}]` : '';
            L.push(`[#${i+1}] ${e.t} ${e.type}${epMark}`);
            if (e.url) L.push(`    ${e.method||''} ${e.url.slice(0,150)}`);
            if (e.body) L.push(indent(String(e.body).slice(0, 3000)));
        });
        return L.join('\n');
    }
    function downloadTxt(){
        const report = buildReport();
        const blob = new Blob([report], { type:'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        const stamp = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
        a.href = URL.createObjectURL(blob);
        a.download = 'ym-mts-intercept-' + stamp + '.txt';
        document.body.appendChild(a); a.click();
        setTimeout(()=>{ a.remove(); URL.revokeObjectURL(a.href); }, 3000);
        Sound.save();
    }

    // ═══════════════════════════════════════════════════════════
    // UI
    // ═══════════════════════════════════════════════════════════
    document.body.insertAdjacentHTML('beforeend', `
        <style>
            @keyframes ym-mini-in{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
            @keyframes ym-in{from{opacity:0;transform:translateY(20px) scale(.96);}to{opacity:1;transform:translateY(0) scale(1);}}
            @keyframes ym-rec{0%,100%{box-shadow:0 0 0 0 rgba(255,0,85,.7);}50%{box-shadow:0 0 0 8px rgba(255,0,85,0);}}
            #ym_mini{animation:ym-mini-in .3s cubic-bezier(.16,1,.3,1);position:fixed;bottom:16px;right:16px;z-index:2147483646;background:#000;border:1px solid rgba(255,0,85,.3);border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.7);display:none;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;transition:all .2s;font-family:'Segoe UI',Arial,sans-serif;}
            #ym_mini:hover{box-shadow:0 16px 48px rgba(255,0,85,.5);transform:translateY(-1px);}
            #ym_interceptor_ui{animation:ym-in .35s cubic-bezier(.16,1,.3,1);position:fixed;bottom:16px;right:16px;z-index:2147483646;background:#0e0e10;color:#fff;font-family:'Segoe UI',Arial,sans-serif;width:440px;max-width:calc(100vw - 32px);border-radius:20px;border:1px solid rgba(255,0,85,.15);box-shadow:0 24px 80px rgba(0,0,0,.8);overflow:hidden;display:flex;flex-direction:column;max-height:calc(100vh - 32px);user-select:none;font-size:13px;}
            #ym_interceptor_ui *{box-sizing:border-box;}
            #ym_interceptor_ui ::-webkit-scrollbar{width:6px;}
            #ym_interceptor_ui ::-webkit-scrollbar-thumb{background:rgba(255,0,85,.15);border-radius:3px;}
            .ym-header{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.08);flex-shrink:0;}
            .ym-logo{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#8a0a2a,#ff0055);display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 16px rgba(255,0,85,.4);flex-shrink:0;}
            .ym-logo.rec{animation:ym-rec 2s infinite;}
            .ym-title{font-weight:700;font-size:15px;line-height:1.15;}
            .ym-title .accent{color:#ff0055;}
            .ym-subtitle{font-size:10px;color:rgba(255,255,255,.4);text-transform:uppercase;margin-top:2px;}
            .ym-icon-btn{width:30px;height:30px;padding:0;border-radius:9px;background:rgba(255,255,255,.06);color:rgba(255,255,255,.7);border:none;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;}
            .ym-icon-btn:hover{background:rgba(255,255,255,.12);color:#fff;}
            .ym-body{padding:12px 16px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:10px;}
            .ym-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:10px 12px;font-size:11px;line-height:1.5;}
            .ym-card.ctx-card{background:linear-gradient(135deg,rgba(255,0,85,.08),rgba(255,0,85,.03));border-left:3px solid #ff0055;}
            .ym-card-title{font-weight:700;font-size:12px;margin-bottom:4px;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
            .ym-card-row{color:rgba(255,255,255,.6);font-size:11px;margin-top:2px;word-break:break-all;}
            .ym-card-label{font-size:10px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin-bottom:6px;}
            .ym-stats{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
            .ym-stat{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:8px 10px;}
            .ym-stat-val{font-size:20px;font-weight:bold;font-family:'SF Mono',Consolas,monospace;line-height:1;}
            .ym-stat-lbl{font-size:9px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.5px;margin-top:2px;}
            .ym-stat.req .ym-stat-val{color:#ff0055;}
            .ym-stat.res .ym-stat-val{color:#00ff88;}
            .ym-stat.sec .ym-stat-val{color:#ffcc00;}
            .ym-stat.imp .ym-stat-val{color:#ff8c00;}
            .ym-progress-box{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:12px;}
            .ym-status-row{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
            .ym-pulse-dot{width:12px;height:12px;border-radius:50%;background:#666;flex-shrink:0;transition:all .3s;}
            .ym-pulse-dot.rec{background:#ff0055;animation:ym-rec 1.5s infinite;}
            .ym-status-text{flex:1;min-width:0;}
            .ym-status-main{font-weight:600;font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
            .ym-status-phase{font-size:10px;color:rgba(255,255,255,.4);font-family:'SF Mono',Consolas,monospace;margin-top:1px;}
            .ym-counter{font-size:15px;font-weight:700;color:#ff0055;font-family:'SF Mono',Consolas,monospace;flex-shrink:0;}
            .ym-bar{width:100%;height:4px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden;margin-bottom:8px;}
            .ym-bar-fill{height:100%;width:0%;background:linear-gradient(90deg,#8a0a2a,#ff0055);border-radius:3px;transition:width .3s ease;}
            .ym-log{font-size:10px;color:rgba(255,255,255,.65);background:rgba(0,0,0,.4);padding:8px 10px;border-radius:8px;max-height:110px;overflow-y:auto;font-family:'SF Mono',Consolas,monospace;line-height:1.5;border:1px solid rgba(255,255,255,.05);word-break:break-word;}
            .ym-log-line{padding:1px 0;}
            .ym-buttons{display:flex;gap:6px;padding:0 16px 8px;flex-shrink:0;}
            .ym-btn{padding:12px;border-radius:10px;border:none;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;}
            .ym-btn-main{flex:2;background:linear-gradient(135deg,#8a0a2a,#ff0055);color:#fff;box-shadow:0 4px 16px rgba(255,0,85,.35);}
            .ym-btn-main:hover:not(:disabled){box-shadow:0 6px 20px rgba(255,0,85,.5);transform:translateY(-1px);}
            .ym-btn-main.pause-mode{background:linear-gradient(135deg,#f0a500,#f39c12);}
            .ym-btn-main.continue-mode{background:linear-gradient(135deg,#1a5a9a,#4a8af4);}
            .ym-btn-main:disabled{opacity:.4;cursor:not-allowed;transform:none;box-shadow:none;}
            .ym-btn-stop{flex:1;background:rgba(255,255,255,.06);color:rgba(255,255,255,.7);border:1px solid rgba(255,255,255,.08);font-size:12px;}
            .ym-btn-stop:hover:not(:disabled){background:rgba(231,76,60,.15);color:#e74c3c;}
            .ym-btn-stop:disabled{opacity:.3;cursor:not-allowed;}
            .ym-btn-save{flex:1;background:linear-gradient(135deg,#1a5a9a,#4a8af4);color:#fff;font-size:12px;}
            .ym-btn-save:hover:not(:disabled){box-shadow:0 4px 16px rgba(74,138,244,.5);transform:translateY(-1px);}
            .ym-btn-save:disabled{opacity:.4;cursor:not-allowed;}
            .ym-btn-clear{flex:1;background:rgba(255,255,255,.06);color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.08);font-size:12px;}
            .ym-btn-clear:hover{background:rgba(255,255,255,.12);color:#fff;}
            .ym-toggles{display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px;margin:0 16px 8px;font-size:11px;flex-wrap:wrap;flex-shrink:0;}
            .ym-toggle{display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-weight:600;color:rgba(255,255,255,.75);user-select:none;}
            .ym-toggle:hover{color:#fff;}
            .ym-toggle input{width:14px;height:14px;cursor:pointer;margin:0;accent-color:#ff0055;}
            .ym-toggle.imp input{accent-color:#ff8c00;}
            .ym-filter-input{flex:1;min-width:80px;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.1);border-radius:6px;color:#fff;padding:4px 8px;font-size:10px;font-family:'SF Mono',Consolas,monospace;outline:none;}
            .ym-filter-input:focus{border-color:#ff0055;}
            .ym-filter-input::placeholder{color:rgba(255,255,255,.3);}
            .ym-footer{padding:0 16px 12px;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:rgba(255,255,255,.4);flex-shrink:0;gap:8px;}
            #ym_status_text{flex:1;text-align:center;font-family:'SF Mono',Consolas,monospace;}
            #ym_mem_info{color:rgba(255,255,255,.5);font-family:'SF Mono',Consolas,monospace;display:none;}
            .ym-endpoint-row{padding:2px 0;font-size:10px;font-family:'SF Mono',Consolas,monospace;display:flex;justify-content:space-between;gap:8px;}
            .ym-endpoint-row .name{color:#ff8c00;}
            .ym-endpoint-row .count{color:#fff;font-weight:bold;}
            .ym-endpoint-row.imp3 .name{color:#ff0055;text-shadow:0 0 6px #ff0055;}
            .ym-endpoint-row.imp2 .name{color:#ff8c00;}
            .ym-endpoint-row.imp1 .name{color:#00c8ff;}
        </style>

        <div id="ym_mini" title="Развернуть">
            <div id="ym_mini_logo" style="width:30px;height:30px;border-radius:9px;background:linear-gradient(135deg,#8a0a2a,#ff0055);display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 4px 12px rgba(255,0,85,.4);flex-shrink:0;">🕵️</div>
            <div style="display:flex;flex-direction:column;line-height:1.25;min-width:0;">
                <div style="font-size:11px;color:#fff;font-weight:700;">YM+MTS v2</div>
                <div id="ym_mini_status" style="font-size:9px;color:rgba(255,255,255,.5);font-family:'SF Mono',Consolas,monospace;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">готов</div>
            </div>
            <div id="ym_mini_badge" style="display:none;background:#ff0055;color:#fff;font-size:9px;font-weight:bold;padding:2px 7px;border-radius:8px;font-family:'SF Mono',Consolas,monospace;">REC</div>
            <div style="font-size:13px;color:rgba(255,255,255,.4);">▲</div>
        </div>

        <div id="ym_interceptor_ui">
            <div class="ym-header">
                <div class="ym-logo" id="ym_logo">🕵️</div>
                <div style="flex:1;min-width:0;">
                    <div class="ym-title">YM+MTS <span class="accent">Interceptor</span></div>
                    <div class="ym-subtitle">v2.0 · endpoints · cookies · secrets</div>
                </div>
                <button id="ym_btn_sound" class="ym-icon-btn" title="Звук">🔊</button>
                <button id="ym_btn_minimize" class="ym-icon-btn" title="Свернуть">—</button>
                <button id="ym_close" class="ym-icon-btn" title="Закрыть">✕</button>
            </div>

            <div class="ym-body">
                <div class="ym-card ctx-card">
                    <div class="ym-card-label">🌐 Контекст</div>
                    <div class="ym-card-title" id="ym_ctx_host">—</div>
                    <div class="ym-card-row">📍 <span id="ym_ctx_url">—</span></div>
                    <div class="ym-card-row">🍪 Стартовых кук: <b id="ym_ctx_cookies">0</b> · 🔑 токенов: <b id="ym_ctx_tokens">0</b></div>
                </div>

                <div class="ym-stats">
                    <div class="ym-stat req">
                        <div class="ym-stat-val" id="ym_cnt_req">0</div>
                        <div class="ym-stat-lbl">📤 Запросов</div>
                    </div>
                    <div class="ym-stat res">
                        <div class="ym-stat-val" id="ym_cnt_res">0</div>
                        <div class="ym-stat-lbl">📥 Ответов</div>
                    </div>
                    <div class="ym-stat imp">
                        <div class="ym-stat-val" id="ym_cnt_imp">0</div>
                        <div class="ym-stat-lbl">⭐ Важных</div>
                    </div>
                    <div class="ym-stat sec">
                        <div class="ym-stat-val" id="ym_cnt_sec">0</div>
                        <div class="ym-stat-lbl">🔑 Секретов</div>
                    </div>
                </div>

                <div class="ym-card" id="ym_endpoints_card">
                    <div class="ym-card-label">⭐ Важные эндпоинты</div>
                    <div id="ym_endpoints_list" style="max-height:100px;overflow-y:auto;">
                        <div style="color:#888;font-size:11px;">(пока ничего не поймано)</div>
                    </div>
                </div>

                <div class="ym-progress-box">
                    <div class="ym-status-row">
                        <div class="ym-pulse-dot" id="ym_pulse"></div>
                        <div class="ym-status-text">
                            <div class="ym-status-main" id="ym_status_main">⏸ Ожидание</div>
                            <div class="ym-status-phase" id="ym_status_phase">Нажми СТАРТ чтобы начать</div>
                        </div>
                        <div class="ym-counter" id="ym_timer">0с</div>
                    </div>
                    <div class="ym-bar"><div class="ym-bar-fill" id="ym_bar_fill"></div></div>
                    <div class="ym-log" id="ym_log">
                        <div class="ym-log-line">⏳ Ожидание запуска...</div>
                    </div>
                </div>
            </div>

            <div class="ym-buttons">
                <button id="ym_btn_start" class="ym-btn ym-btn-main">▶ СТАРТ</button>
                <button id="ym_btn_stop" class="ym-btn ym-btn-stop" disabled>⏹ СТОП</button>
            </div>

            <div class="ym-buttons">
                <button id="ym_btn_save" class="ym-btn ym-btn-save" disabled>💾 TXT</button>
                <button id="ym_btn_clear" class="ym-btn ym-btn-clear">🗑 СБРОС</button>
            </div>

            <div class="ym-toggles">
                <label class="ym-toggle imp"><input type="checkbox" id="ym_only_important">⭐ Только важные</label>
                <input type="text" id="ym_filter_input" class="ym-filter-input" placeholder="regex: get-file-info / ya-proxy / plays ...">
            </div>

            <div class="ym-footer">
                <span id="ym_status_text">⏳ Загрузка...</span>
                <span id="ym_mem_info">📦 ...</span>
            </div>
        </div>
    `);

    const $ = id => document.getElementById(id);
    const ui = $('ym_interceptor_ui');
    const mini = $('ym_mini');
    const miniStatus = $('ym_mini_status');
    const miniBadge = $('ym_mini_badge');
    const miniLogo = $('ym_mini_logo');
    const logo = $('ym_logo');
    const btnSound = $('ym_btn_sound');
    const btnStart = $('ym_btn_start');
    const btnStop = $('ym_btn_stop');
    const btnSave = $('ym_btn_save');
    const btnClear = $('ym_btn_clear');
    const pulse = $('ym_pulse');
    const statusMain = $('ym_status_main');
    const statusPhase = $('ym_status_phase');
    const timerEl = $('ym_timer');
    const barFill = $('ym_bar_fill');
    const logEl = $('ym_log');
    const statusText = $('ym_status_text');
    const memInfo = $('ym_mem_info');
    const filterInput = $('ym_filter_input');
    const onlyImportantCb = $('ym_only_important');
    const ctxHost = $('ym_ctx_host');
    const ctxUrl = $('ym_ctx_url');
    const ctxCookies = $('ym_ctx_cookies');
    const ctxTokens = $('ym_ctx_tokens');
    const endpointsList = $('ym_endpoints_list');

    Sound.enabled = localStorage.getItem(SOUND_KEY) !== 'false';
    btnSound.textContent = Sound.enabled ? '🔊' : '🔇';

    try{
        const savedFilter = localStorage.getItem(FILTER_KEY) || '';
        filterInput.value = savedFilter;
        state.urlFilter = savedFilter;
    }catch(e){}
    try{
        const savedOnly = localStorage.getItem(ONLY_IMPORTANT_KEY) === '1';
        onlyImportantCb.checked = savedOnly;
        state.onlyImportant = savedOnly;
    }catch(e){}

    let timerInterval = null;

    function addLog(text, kind='info'){
        const colors = { info:'rgba(255,255,255,.55)', ok:'#2ecc71', err:'#e74c3c', warn:'#f0a500', step:'#ff0055', secret:'#ffcc00', cookie:'#00c8ff', net:'#7c5cff', system:'#4a8af4', important:'#ff8c00' };
        const iconMap = { info:'ℹ️', ok:'✓', err:'✕', warn:'⚠', step:'⭐', secret:'🔑', cookie:'🍪', net:'🌐', system:'⚙️', important:'⭐' };
        const line = document.createElement('div');
        line.className = 'ym-log-line';
        line.style.color = colors[kind] || colors.info;
        const time = new Date().toLocaleTimeString('ru-RU');
        line.textContent = `${iconMap[kind]||'ℹ️'} [${time}] ${text}`;
        logEl.appendChild(line);
        while(logEl.children.length > 200) logEl.removeChild(logEl.firstChild);
        logEl.scrollTop = logEl.scrollHeight;
        console.log(`%c[${kind.toUpperCase()}] ${text}`, `color:${colors[kind]||'#fff'}`);
    }

    function escapeHtml(s){
        if (!s) return '';
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function renderEndpointStats(){
        if (!endpointsList) return;
        if (state.endpointStats.size === 0) {
            endpointsList.innerHTML = '<div style="color:#888;font-size:11px;">(пока ничего не поймано)</div>';
            return;
        }
        const items = Array.from(state.endpointStats.entries())
            .map(([name, st]) => ({name, ...st}))
            .sort((a,b) => {
                if (b.importance !== a.importance) return b.importance - a.importance;
                return b.count - a.count;
            })
            .slice(0, 10);
        let html = '';
        for (const it of items) {
            const cls = 'imp' + it.importance;
            const svcIcon = it.service === 'yandex' ? '🎵' : it.service === 'mts' ? '📱' : '❓';
            html += `<div class="ym-endpoint-row ${cls}"><span class="name">${svcIcon} ${escapeHtml(it.name)}</span><span class="count">×${it.count}</span></div>`;
        }
        endpointsList.innerHTML = html;
    }

    function updateUI(){
        $('ym_cnt_req').textContent = state.counters.requests;
        $('ym_cnt_res').textContent = state.counters.responses;
        $('ym_cnt_imp').textContent = state.counters.important;
        $('ym_cnt_sec').textContent = state.counters.secrets;
        if(state.running && !state.paused){
            pulse.classList.add('rec'); logo.classList.add('rec');
            statusMain.textContent = '● ИДЁТ ЗАПИСЬ'; statusMain.style.color = '#ff0055';
            statusPhase.textContent = `Зап:${state.counters.requests} · ⭐${state.counters.important} · 🔑${state.counters.secrets}`;
        } else if(state.paused){
            pulse.classList.remove('rec'); logo.classList.remove('rec');
            statusMain.textContent = '⏸ Пауза'; statusMain.style.color = '#f0a500';
            statusPhase.textContent = 'Нажми СТАРТ для продолжения';
        } else if(state.startedAt){
            pulse.classList.remove('rec'); logo.classList.remove('rec');
            statusMain.textContent = '⏹ Остановлен'; statusMain.style.color = '#666';
            statusPhase.textContent = 'Готов к экспорту';
        } else {
            pulse.classList.remove('rec'); logo.classList.remove('rec');
            statusMain.textContent = '⏸ Ожидание'; statusMain.style.color = '#888';
            statusPhase.textContent = 'Нажми СТАРТ чтобы начать';
        }
        const activity = Math.min(100, state.counters.requests);
        barFill.style.width = activity + '%';
        if(state.logs.length){
            memInfo.style.display = 'inline';
            memInfo.textContent = `📦 ${state.logs.length} логов · ⭐${state.counters.important} · 🔑${state.secrets.length}`;
        } else memInfo.style.display = 'none';
        renderEndpointStats();
        updateMini();
    }

    function updateMini(){
        if(state.minimized){ ui.style.display='none'; mini.style.display='flex'; }
        else { ui.style.display='flex'; mini.style.display='none'; }
        try{ localStorage.setItem(MINI_KEY, state.minimized?'1':'0'); }catch(e){}
        if(state.running && !state.paused){
            miniStatus.textContent = `${state.counters.requests}зап ⭐${state.counters.important} 🔑${state.counters.secrets}`;
            miniBadge.style.display = 'block'; miniBadge.textContent = 'REC'; miniBadge.style.background = '#ff0055';
            miniLogo.classList.add('rec');
        } else if(state.paused){
            miniStatus.textContent = '⏸ пауза'; miniBadge.style.display = 'none'; miniLogo.classList.remove('rec');
        } else if(state.startedAt){
            miniStatus.textContent = `⏹ ${state.counters.requests}зап ⭐${state.counters.important}`;
            miniBadge.style.display = 'none'; miniLogo.classList.remove('rec');
        } else {
            miniStatus.textContent = 'готов'; miniBadge.style.display = 'none'; miniLogo.classList.remove('rec');
        }
    }

    function updateButtons(){
        btnStart.classList.remove('pause-mode','continue-mode');
        if(!state.running){
            btnStart.textContent = state.startedAt ? '↻ ПРОДОЛЖИТЬ' : '▶ СТАРТ';
            btnStart.disabled = false; btnStop.disabled = true; btnSave.disabled = !state.logs.length;
            return;
        }
        if(state.paused){
            btnStart.textContent = '▶ ПРОДОЛЖИТЬ'; btnStart.classList.add('continue-mode');
        } else {
            btnStart.textContent = '⏸ ПАУЗА'; btnStart.classList.add('pause-mode');
        }
        btnStart.disabled = false; btnStop.disabled = false; btnSave.disabled = !state.logs.length;
    }

    function startTimer(){
        if(timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(()=>{
            if(state.running && state.startedAt){
                const sec = Math.round((Date.now() - state.startedAt) / 1000);
                timerEl.textContent = sec + 'с';
            }
        }, 500);
    }

    window.addEventListener('keydown', e => {
        if(e.altKey && e.shiftKey && (e.key === 'Y' || e.key === 'y' || e.code === 'KeyY')){
            state.minimized = !state.minimized;
            updateMini();
        }
    });

    btnStart.addEventListener('click', ()=>{
        if(!state.running){
            state.running = true; state.paused = false;
            state.startedAt = Date.now(); state.stoppedAt = null;
            snapshotCookies();
            const tokenCount = Array.from(state.cookies.values()).filter(c=>c.isToken).length;
            addLog(`▶ Перехват запущен. Найдено ${tokenCount} токенов`, 'ok');
            statusText.textContent = '🟢 ЗАПИСЬ'; statusText.style.color = '#2ecc71';
            startTimer(); Sound.start();
        } else if(state.paused){
            state.paused = false; addLog('▶ Продолжаем запись', 'ok');
            statusText.textContent = '🟢 ЗАПИСЬ'; statusText.style.color = '#2ecc71';
            Sound.click();
        } else {
            state.paused = true; addLog('⏸ Пауза', 'warn');
            statusText.textContent = '⏸ ПАУЗА'; statusText.style.color = '#f0a500';
            Sound.click();
        }
        updateUI(); updateButtons();
    });

    btnStop.addEventListener('click', ()=>{
        if(!state.running && !state.startedAt) return;
        state.running = false; state.paused = false; state.stoppedAt = Date.now();
        if(timerInterval){ clearInterval(timerInterval); timerInterval = null; }
        addLog(`⏹ Остановлен. Запросов: ${state.counters.requests}, важных: ${state.counters.important}`, 'warn');
        statusText.textContent = '⏹ ОСТАНОВЛЕН'; statusText.style.color = '#e74c3c';
        Sound.stop(); updateUI(); updateButtons();
    });

    btnSave.addEventListener('click', ()=>{
        if(!state.logs.length){ addLog('Нечего сохранять', 'warn'); return; }
        downloadTxt(); addLog('💾 Отчёт сохранён в TXT', 'ok');
    });

    btnClear.addEventListener('click', ()=>{
        if(!confirm('Очистить все собранные данные?')) return;
        state.logs = []; state.secrets = []; state.cookies.clear(); state.endpointStats.clear();
        state.counters = { requests:0, responses:0, errors:0, secrets:0, important:0, captcha:0 };
        state.startedAt = null; state.stoppedAt = null; state.running = false; state.paused = false;
        logEl.innerHTML = '<div class="ym-log-line" style="color:#888;">🗑 Очищено</div>';
        statusText.textContent = '🗑 СБРОШЕНО'; statusText.style.color = '#888';
        addLog('🗑 Данные очищены', 'system');
        Sound.clear(); updateUI(); updateButtons();
    });

    btnSound.addEventListener('click', ()=>{
        Sound.enabled = !Sound.enabled;
        btnSound.textContent = Sound.enabled ? '🔊' : '🔇';
        localStorage.setItem(SOUND_KEY, Sound.enabled ? 'true' : 'false');
        if(Sound.enabled) Sound.click();
    });

    $('ym_btn_minimize').addEventListener('click', ()=>{ state.minimized = true; updateMini(); Sound.click(); });
    mini.addEventListener('click', ()=>{ state.minimized = false; updateMini(); Sound.click(); });
    $('ym_close').addEventListener('click', ()=>{
        if(state.running) btnStop.click();
        ui.remove(); mini.remove();
    });

    filterInput.addEventListener('input', function(){
        state.urlFilter = this.value.trim();
        try{ localStorage.setItem(FILTER_KEY, state.urlFilter); }catch(e){}
    });
    onlyImportantCb.addEventListener('change', function(){
        state.onlyImportant = this.checked;
        try{ localStorage.setItem(ONLY_IMPORTANT_KEY, this.checked?'1':'0'); }catch(e){}
        addLog(this.checked ? '⭐ Только важные' : '🌐 Все запросы', 'step');
        Sound.click();
    });

    ctxHost.textContent = location.hostname;
    ctxUrl.textContent = location.pathname.slice(0, 80);
    setTimeout(()=>{
        const totalCookies = document.cookie.split(';').filter(c=>c.trim()).length;
        ctxCookies.textContent = totalCookies;
    }, 100);

    window.YM_MTS_INTERCEPTOR = {
        version: 'v2.0', state, Sound,
        start: ()=>{ btnStart.click(); }, stop: ()=>{ btnStop.click(); },
        save: ()=>{ btnSave.click(); }, clear: ()=>{ btnClear.click(); },
        report: ()=>buildReport(),
        show: ()=>{ state.minimized = false; updateMini(); },
        hide: ()=>{ state.minimized = true; updateMini(); },
        SECRET_PATTERNS, IMPORTANT_ENDPOINTS, classifyUrl, findSecrets,
        getEndpointHistory: (name)=>{
            if (!name) return state.logs.filter(l => l.endpoint);
            return state.logs.filter(l => l.endpoint && l.endpoint.name === name);
        },
        getEndpointStats: ()=>Object.fromEntries(state.endpointStats.entries()),
        getCookies: ()=>Object.fromEntries(state.cookies.entries()),
        getCookiesRaw: ()=>document.cookie,
        getTokenCookies: ()=>{
            const r = {};
            for (const [name, info] of state.cookies.entries()) if (info.isToken) r[name] = info.value;
            return r;
        },
        getSecrets: ()=>state.secrets.slice(),
        getStats: ()=>({
            requests: state.counters.requests,
            responses: state.counters.responses,
            important: state.counters.important,
            secrets: state.counters.secrets,
            captcha: state.counters.captcha,
            cookies: state.cookies.size,
            logs: state.logs.length,
            endpoints: state.endpointStats.size,
        }),
        lastResponseOf: (endpointName)=>{
            for (let i = state.logs.length - 1; i >= 0; i--) {
                const l = state.logs[i];
                if (l.endpoint && l.endpoint.name === endpointName && (l.type === 'fetch_response' || l.type === 'xhr_response')) return l;
            }
            return null;
        },
    };

    console.log(
        '%c🕵️ YM+MTS INTERCEPTOR v2.0 ЗАГРУЖЕН\n' +
        '%c⭐ Отслеживает ' + IMPORTANT_ENDPOINTS.length + ' важных эндпоинтов\n' +
        '%cAlt+Shift+Y — показать/скрыть · API: window.YM_MTS_INTERCEPTOR',
        'background:#ff0055;color:#fff;padding:6px 12px;border-radius:4px;font-weight:bold;font-size:14px;',
        'color:#ff8c00;padding:4px;',
        'color:#00ff88;font-family:monospace;'
    );

    snapshotCookies();
    setTimeout(()=>{
        const tokenCount = Array.from(state.cookies.values()).filter(c=>c.isToken).length;
        if (ctxTokens) ctxTokens.textContent = tokenCount;
    }, 200);
    updateUI();
    updateButtons();
    addLog(`⭐ ${IMPORTANT_ENDPOINTS.length} важных эндпоинтов. Нажми СТАРТ`, 'ok');
    statusText.textContent = '⏸ ОЖИДАНИЕ';
})();