// ==UserScript==
// @name         VK Music Downloader v2.0
// @namespace    dimasik-debug
// @version      2.0
// @description  🎵 VK · GM-upload через CORS-proxy · 2 прогресс-бара · 4 фазы · название альбома
// @author       Neurosha
// @match        https://vk.com/*
// @match        https://vk.ru/*
// @match        https://m.vk.com/*
// @match        https://m.vk.ru/*
// @match        https://web.vk.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @run-at       document-idle
// ==/UserScript==

/* Converted by Neurosha · 2026-09-22T16:37:10.677Z */

/* === GM-shim (Neurosha) === */
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
// @name         VK Music Downloader v2.0
// @namespace    vkdl
// @version      2.0
// @description  🎵 VK · GM-upload через CORS-proxy · 2 прогресс-бара · 4 фазы · название альбома
// @author       Neurosha
// @match        https://vk.com/*
// @match        https://vk.ru/*
// @match        https://m.vk.com/*
// @match        https://m.vk.ru/*
// @match        https://web.vk.com/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @connect      *
// ==/UserScript==

(function VKMusicDownloaderV20() {
    'use strict';

    if (window.__vkdlLoaded) { document.getElementById('yamdl')?.remove(); document.getElementById('yamdl-mini')?.remove(); }
    window.__vkdlLoaded = true;

    const W = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;

    const VERSION = '2.0';
    const VK_API = 'https://web.api.vk.ru/method';
    const VK_VER = '5.289';
    const VK_CLIENT = '6287487';
    const YADISK_API = 'https://cloud-api.yandex.net/v1/disk';
    const DEFAULT_YADISK_TOKEN = 'y0__wgBEMXcidgEGJnTSSDArYGFGTDc-af4CH7vlk1BioDBW34XQuLc6fTutZI';
    const PAUSE_TRACKS = 1200;
    const MAX_ATTEMPTS = 2;
    const DB_NAME = 'vkdl_db', DB_VERSION = 1, STORE = 'downloaded';
    const UI_WIDTH = 480;

    const LS = {
        yadiskToken:'vkdl_yadisk_token', yadiskFolder:'vkdl_yadisk_folder',
        ghToken:'vkdl_gh_token', ghRepo:'vkdl_gh_repo', ghRepoPath:'vkdl_gh_repo_path',
        saveTxt:'vkdl_save_txt', minimized:'vkdl_minimized', uiPos:'vkdl_ui_pos',
        createArtistFolder:'vkdl_create_artist_folder', uploadDisk:'vkdl_upload_disk',
        keepLocal:'vkdl_keep_local', autoSync:'vkdl_auto_sync', sound:'vkdl_sound_enabled',
        vkToken:'vkdl_vk_token', savings:'vkdl_savings', ivMode:'vkdl_iv_mode'
    };

    const T0 = performance.now();
    const ts = () => `+${((performance.now()-T0)/1000).toFixed(2)}s`;

    // ═══ TOKEN INTERCEPTOR ═══
    const TokenHunter = {
        current: null, listeners: [],
        onToken(fn){ this.listeners.push(fn); },
        _fire(tok){
            if(!tok || !tok.startsWith('vk1.')) return;
            if(tok === this.current) return;
            this.current = tok;
            try{ W.localStorage.setItem(LS.vkToken, tok); }catch(e){}
            this.listeners.forEach(fn=>{ try{ fn(tok); }catch(e){} });
        },
        _fromUrl(u){ const m = (u||'').match(/[?&]access_token=([^&\s]+)/); return m ? decodeURIComponent(m[1]) : null; },
        _fromBody(b){
            if(!b || typeof b !== 'string') return null;
            let m = b.match(/access_token=([^&\s]+)/); if(m) return decodeURIComponent(m[1]);
            m = b.match(/"access_token"\s*:\s*"([^"]+)"/); if(m) return m[1];
            return null;
        },
        _fromHeaders(h){
            if(!h) return null;
            try{
                if(typeof Headers !== 'undefined' && h instanceof Headers){
                    const a = h.get('authorization') || h.get('Authorization');
                    if(a){ const m = a.match(/Bearer\s+(vk1\.[A-Za-z0-9_\-\.]+)/); if(m) return m[1]; }
                } else {
                    for(const k of Object.keys(h)){
                        if(k.toLowerCase() === 'authorization'){
                            const v = h[k];
                            if(typeof v === 'string'){ const m = v.match(/Bearer\s+(vk1\.[A-Za-z0-9_\-\.]+)/); if(m) return m[1]; }
                        }
                    }
                }
            }catch(e){}
            return null;
        }
    };

    try{
        const _origFetch = W.fetch;
        W.fetch = function(input, init){
            try{
                let url = '', body = null, headers = null;
                if(typeof input === 'string') url = input;
                else if(input instanceof W.Request) url = input.url;
                else if(input && input.url) url = input.url;
                if(init){ body = init.body; headers = init.headers; }
                if(!headers && input && input.headers){ try{ headers = input.headers; }catch(e){} }
                if(url && /web\.api\.vk\.ru|api\.vk\.(com|ru)|login\.vk|\.vk\.ru\/method|\.vk\.com\/method/.test(url)){
                    let tok = TokenHunter._fromUrl(url);
                    if(!tok) tok = TokenHunter._fromHeaders(headers);
                    if(!tok && body) tok = TokenHunter._fromBody(body);
                    if(tok) TokenHunter._fire(tok);
                }
            }catch(e){}
            return _origFetch.apply(this, arguments);
        };
    }catch(e){ console.warn('[VKDL] fetch hook fail:', e); }

    try{
        const X = W.XMLHttpRequest;
        const oOpen = X.prototype.open, oSetH = X.prototype.setRequestHeader, oSend = X.prototype.send;
        X.prototype.open = function(m,u){ this.__vkdl_url = u; this.__vkdl_h = {}; return oOpen.apply(this, arguments); };
        X.prototype.setRequestHeader = function(n,v){
            try{
                if(!this.__vkdl_h) this.__vkdl_h = {};
                this.__vkdl_h[n] = v;
                if((n||'').toLowerCase() === 'authorization' && typeof v === 'string'){
                    const m = v.match(/Bearer\s+(vk1\.[A-Za-z0-9_\-\.]+)/);
                    if(m) TokenHunter._fire(m[1]);
                }
            }catch(e){}
            return oSetH.apply(this, arguments);
        };
        X.prototype.send = function(body){
            try{
                const u = this.__vkdl_url || '';
                if(/web\.api\.vk\.ru|api\.vk\.(com|ru)|\.vk\.ru\/method/.test(u)){
                    let t = TokenHunter._fromUrl(u);
                    if(!t && body) t = TokenHunter._fromBody(body);
                    if(!t) t = TokenHunter._fromHeaders(this.__vkdl_h);
                    if(t) TokenHunter._fire(t);
                }
            }catch(e){}
            return oSend.apply(this, arguments);
        };
    }catch(e){ console.warn('[VKDL] xhr hook fail:', e); }

    setInterval(()=>{
        try{
            const ls = W.localStorage;
            for(let i=0;i<ls.length;i++){
                const v = ls.getItem(ls.key(i));
                if(typeof v !== 'string') continue;
                if(v.startsWith('vk1.a.') && v.length > 80){ TokenHunter._fire(v); return; }
                const m = v.match(/vk1\.a\.[A-Za-z0-9_\-]{60,}/);
                if(m){ TokenHunter._fire(m[0]); return; }
            }
        }catch(e){}
    }, 2000);

    // ═══ SOUND ═══
    const Sound = {
        ctx:null, enabled:true, masterGain:null,
        init(){ if(this.ctx)return; try{ this.ctx=new (window.AudioContext||window.webkitAudioContext)(); this.masterGain=this.ctx.createGain(); this.masterGain.gain.value=0.35; this.masterGain.connect(this.ctx.destination);}catch(e){this.enabled=false;} },
        note(f,d=0.35,v=0.15,delay=0,type='sine'){
            if(!this.enabled)return; if(this.ctx&&this.ctx.state==='closed')return;
            this.init(); if(!this.ctx)return;
            try{ if(this.ctx.state==='suspended')this.ctx.resume();
                const t=this.ctx.currentTime+delay;
                const o=this.ctx.createOscillator(),g=this.ctx.createGain(),fl=this.ctx.createBiquadFilter();
                fl.type='lowpass'; fl.frequency.value=3500; fl.Q.value=0.7;
                o.type=type; o.frequency.setValueAtTime(f,t);
                g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v,t+0.04);
                g.gain.setValueAtTime(v,t+d*0.6); g.gain.exponentialRampToValueAtTime(0.0001,t+d);
                o.connect(fl); fl.connect(g); g.connect(this.masterGain);
                o.start(t); o.stop(t+d+0.05);
            }catch(e){}
        },
        chord(fs,d=0.5,v=0.12,type='sine'){fs.forEach((f,i)=>this.note(f,d+i*0.05,v*(1-i*0.15),i*0.03,type));},
        glide(a,b,d=0.3,v=0.12){ if(!this.enabled)return; this.init(); if(!this.ctx)return;
            try{ if(this.ctx.state==='suspended')this.ctx.resume();
                const t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();
                o.type='sine'; o.frequency.setValueAtTime(a,t); o.frequency.exponentialRampToValueAtTime(b,t+d);
                g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v,t+0.05);
                g.gain.exponentialRampToValueAtTime(0.0001,t+d);
                o.connect(g); g.connect(this.masterGain); o.start(t); o.stop(t+d+0.05);
            }catch(e){} },
        click(){this.note(587,0.12,0.08,0,'sine');},
        start(){this.chord([349,440,523],0.5,0.10);},
        trackDone(){this.note(880,0.3,0.12,0);this.note(1175,0.4,0.08,0.08);},
        complete(){this.chord([523,659,784,1047],0.8,0.10,'triangle');this.glide(523,1047,0.6,0.06);},
        error(){this.note(294,0.35,0.09,0);this.note(247,0.5,0.07,0.15);},
        save(){this.note(1047,0.15,0.06,0,'triangle');},
        warn(){this.note(440,0.2,0.07,0,'triangle');this.note(349,0.3,0.06,0.1,'triangle');},
        stall(){this.note(220,0.4,0.07,0,'sawtooth');this.note(196,0.5,0.06,0.2,'sawtooth');},
        diag(){this.note(659,0.15,0.06,0,'triangle');this.note(880,0.15,0.05,0.08,'triangle');},
        cloud(){this.chord([659,880,1047],0.5,0.09,'triangle');},
        cloudDone(){this.chord([880,1047,1319,1568],0.6,0.10,'triangle');},
        local(){this.note(698,0.15,0.07,0,'triangle');this.note(880,0.2,0.06,0.08,'triangle');},
        github(){this.chord([784,988],0.4,0.08);},
        batchStart(){this.chord([440,554,659,880],0.6,0.10);},
        batchDone(){this.chord([523,659,784,1047,1319],0.9,0.11,'triangle');this.glide(523,1319,0.8,0.07);},
        token(){this.note(1319,0.15,0.08,0,'triangle');this.note(1568,0.2,0.07,0.08,'triangle');}
    };
    window.addEventListener('beforeunload',()=>{try{Sound.ctx?.close();}catch(e){}});

    // ═══ STATE ═══
    const state = {
        isBatch:false, batchCancel:false, batchTotal:0, batchDone:0, batchErrors:0,
        allTracks:[], selected:new Set(),
        downloadedIds:new Set(), downloadedMeta:new Map(),
        phase:'idle', batchBytesDone:0, batchStartTime:0,
        filterOnlyNew:false, minimized:false,
        uid:null, login:null, firstName:null, lastName:null,
        saveTxt:true, createArtistFolder:true, uploadDisk:true,
        keepLocal:true, autoSync:true,
        yadiskToken:DEFAULT_YADISK_TOKEN, yadiskFolder:'Music',
        ghToken:'', ghRepo:'', ghRepoPath:'',
        vkToken:'',
        resolvedDiskBase:null, resolvedDownloadsBase:null,
        ghSyncTimer:null, ghSyncPending:false, lastGhSyncAt:0,
        cryptoScheme:null, bootStep:'init',
        startTime:0, currentMode:null, ivMode:'seq',
        tokenOk:false, tokenChecked:false, sourceName:'—',
        currentIdx:0, currentTotal:0, currentTitle:''
    };

    const SAVINGS = {
        total:0, books:0,
        load(){ try{const r=W.localStorage.getItem(LS.savings); if(r){const d=JSON.parse(r); this.total=d.total||0; this.books=d.books||0;}}catch(e){} },
        save(){ try{W.localStorage.setItem(LS.savings, JSON.stringify({total:this.total, books:this.books}));}catch(e){} },
        add(bytes){ this.total += bytes||0; this.books += 1; this.save(); },
        reset(){ this.total=0; this.books=0; this.save(); }
    };

    function loadSettings(){
        try{
            const g=k=>W.localStorage.getItem(k);
            const s=g(LS.saveTxt); if(s!==null)state.saveTxt=s!=='false';
            if(g(LS.minimized)==='1')state.minimized=true;
            const caf=g(LS.createArtistFolder); if(caf!==null)state.createArtistFolder=caf!=='false';
            const ud=g(LS.uploadDisk); if(ud!==null)state.uploadDisk=ud!=='false';
            const kl=g(LS.keepLocal); if(kl!==null)state.keepLocal=kl!=='false';
            const as=g(LS.autoSync); if(as!==null)state.autoSync=as!=='false';
            const sd=g(LS.sound); if(sd!==null)Sound.enabled=sd!=='false';
            const yt=g(LS.yadiskToken); if(yt)state.yadiskToken=yt;
            const yf=g(LS.yadiskFolder); if(yf)state.yadiskFolder=yf;
            const gt=g(LS.ghToken); if(gt)state.ghToken=gt;
            const gr=g(LS.ghRepo); if(gr)state.ghRepo=gr;
            const grp=g(LS.ghRepoPath); if(grp)state.ghRepoPath=grp;
            const vt=g(LS.vkToken); if(vt)state.vkToken=vt;
            const im=g(LS.ivMode); if(im)state.ivMode=im;
        }catch(e){}
    }
    const saveLS=(k,v)=>{try{W.localStorage.setItem(k,String(v));}catch(e){}};

    // ═══ UTILS ═══
    const fmtBytes = b => !b||b<0?'0 B':b<1024?b+' B':b<1048576?(b/1024).toFixed(1)+' KB':(b/1048576).toFixed(2)+' MB';
    const fmtSpeed = m => !m||m<0.01?'—':m<1?(m*1024).toFixed(0)+' KB/s':m.toFixed(2)+' MB/s';
    const fmtEta = s => !isFinite(s)||s<=0?'—':s<60?s.toFixed(0)+'s':Math.floor(s/60)+'m '+Math.round(s%60)+'s';
    const fmtAgo = t => {const s=(Date.now()-t)/1000;return s<60?'только что':s<3600?Math.floor(s/60)+' мин':s<86400?Math.floor(s/3600)+' ч':Math.floor(s/86400)+' дн';};
    const sanitizeName = n => (n||'track').replace(/[\\/:*?"<>|]/g,'_').replace(/[\x00-\x1f]/g,'').replace(/\s+/g,' ').trim().slice(0,120)||'track';
    const hexToBytes = h => {const c=String(h).replace(/[^0-9a-fA-F]/g,'');const a=new Uint8Array(c.length/2);for(let i=0;i<a.length;i++)a[i]=parseInt(c.substr(i*2,2),16);return a;};
    const ivToHex = iv => [...iv].map(x=>x.toString(16).padStart(2,'0')).join('');
    function seqToIV(seq){const iv=new Uint8Array(16);let x=BigInt(seq||0);for(let i=15;i>=0;i--){iv[i]=Number(x&0xffn);x>>=8n;}return iv;}
    function hexToIV(hex){const out=new Uint8Array(16);if(!hex)return out;const b=hexToBytes(hex);if(b.length<=16)out.set(b,16-b.length);else out.set(b.slice(b.length-16),0);return out;}
    function errStr(e){
        if(e==null)return String(e);
        if(typeof e==='string')return e;
        if(e.name&&e.message)return `${e.name}: ${e.message}`;
        if(e.message)return String(e.message);
        try{return JSON.stringify(e);}catch(x){return Object.prototype.toString.call(e);}
    }
    function withTimeout(p,ms,label){
        return Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error(`timeout ${ms}ms${label?' ('+label+')':''}`)),ms))]);
    }
    function gmRequest(opts){
        return new Promise((resolve,reject)=>{
            try{
                const cfg={
                    method:opts.method||'GET', url:opts.url,
                    headers:opts.headers||{}, data:opts.data,
                    responseType:opts.responseType||'text',
                    timeout:opts.timeout||300000,
                    onprogress:opts.onprogress,
                    onload:resolve,
                    onerror:e=>reject(new Error('GM: '+errStr(e))),
                    ontimeout:()=>reject(new Error('timeout '+opts.timeout)),
                    onabort:()=>reject(new Error('abort'))
                };
                if(opts.responseType==='arraybuffer')cfg.binary=true;
                GM_xmlhttpRequest(cfg);
            }catch(e){reject(e);}
        });
    }

    // ═══ VK TOKEN ═══
    function findVkToken(){
        if(TokenHunter.current && TokenHunter.current.startsWith('vk1.')) return TokenHunter.current;
        if(state.vkToken && state.vkToken.startsWith('vk1.')) return state.vkToken;
        try{
            const ls = W.localStorage;
            for(let i=0;i<ls.length;i++){
                const v=ls.getItem(ls.key(i));
                if(typeof v!=='string')continue;
                if(v.startsWith('vk1.a.')&&v.length>80)return v;
                const m=v.match(/vk1\.a\.[A-Za-z0-9_\-]{60,}/);
                if(m)return m[0];
            }
        }catch(e){}
        try{ const m=document.cookie.match(/vk_access_token=([^;]+)/); if(m&&m[1].startsWith('vk1.'))return decodeURIComponent(m[1]); }catch(e){}
        return null;
    }
    function ensureToken(){ const t=findVkToken(); if(t){ state.vkToken=t; saveLS(LS.vkToken,t); return t; } return null; }

    // ═══ VK API ═══
    async function vkApi(method,params={}){
        const token=ensureToken();
        if(!token) throw new Error('нет VK токена');
        const body=new URLSearchParams();
        body.set('v',VK_VER); body.set('client_id',VK_CLIENT);
        body.set('access_token',token);
        for(const [k,v] of Object.entries(params)){
            if(v===undefined||v===null)continue;
            body.set(k, typeof v==='object'?JSON.stringify(v):String(v));
        }
        const r=await gmRequest({method:'POST', url:`${VK_API}/${method}`,
            headers:{'content-type':'application/x-www-form-urlencoded'},
            data:body.toString(), timeout:30000});
        if(r.status!==200)throw new Error(`HTTP ${r.status}`);
        let data; try{data=JSON.parse(r.responseText);}catch(e){throw new Error('bad json');}
        if(data.error){
            const msg = data.error.error_msg || '';
            if(/expired|authorization failed/i.test(msg)){
                state.tokenOk = false; TokenHunter.current = null;
                try{ W.localStorage.removeItem(LS.vkToken); }catch(e){}
                state.vkToken = '';
                throw new Error(`API ${data.error.error_code}: ${msg}`);
            }
            throw new Error(`API ${data.error.error_code}: ${msg}`);
        }
        state.tokenOk = true;
        return data.response;
    }
    async function vkApiCheck(method,params={}){
        try{
            const token=ensureToken();
            if(!token) return {ok:false, err:'нет токена'};
            const body=new URLSearchParams();
            body.set('v',VK_VER); body.set('client_id',VK_CLIENT);
            body.set('access_token',token);
            for(const [k,v] of Object.entries(params)){
                if(v===undefined||v===null)continue;
                body.set(k, typeof v==='object'?JSON.stringify(v):String(v));
            }
            const r=await gmRequest({method:'POST', url:`${VK_API}/${method}`,
                headers:{'content-type':'application/x-www-form-urlencoded'},
                data:body.toString(), timeout:15000});
            if(r.status!==200) return {ok:false, err:`HTTP ${r.status}`};
            const data=JSON.parse(r.responseText);
            if(data.error) return {ok:false, err:`${data.error.error_code}: ${data.error.error_msg}`, expired:/expired|authorization/i.test(data.error.error_msg||'')};
            return {ok:true, data:data.response};
        }catch(e){ return {ok:false, err:errStr(e)}; }
    }

    // ═══ TRACK ═══
    function isRealAudioUrl(u){
        if(!u||typeof u!=='string')return false;
        if(!/^https?:\/\//.test(u))return false;
        if(u.includes('vk.ru/audios')||u.includes('vk.com/audios'))return false;
        if(u.includes('{query}'))return false;
        return /\.(mp3|m3u8|aac|ts)|vkuser|vkuseraudio|mycdn|audio/.test(u);
    }
    function normalizeVkTrack(t){
        if(!t||(!t.id&&!t.audio_id))return null;
        const id=String(t.id||t.audio_id);
        const ownerId=t.owner_id||t.ownerId||null;
        const key=ownerId?`${ownerId}_${id}`:id;
        const goodUrl=isRealAudioUrl(t.url)?t.url:null;
        return {
            id:key, audioId:id, ownerId, accessKey:t.access_key||null,
            title:(t.title||'untitled').trim(), artist:(t.artist||'—').trim(),
            album:t.album?.title||t.album||'', durationSec:t.duration||0,
            url:goodUrl, isHls:(goodUrl||'').includes('.m3u8'), date:t.date||0
        };
    }

    // ═══ HLS + AES ═══
    function looksLikeAudio(buf){
        if(!buf||buf.length<4)return false;
        if(buf[0]===0x47){ if(buf.length>=189&&buf[188]===0x47)return true; if(buf.length>=377&&buf[376]===0x47)return true; if(buf.length<189)return true; }
        if(buf[0]===0x49&&buf[1]===0x44&&buf[2]===0x33)return true;
        if(buf[0]===0xFF&&(buf[1]&0xF6)===0xF0)return true;
        if(buf[0]===0xFF&&(buf[1]&0xE0)===0xE0)return true;
        if(buf[4]===0x66&&buf[5]===0x74&&buf[6]===0x79&&buf[7]===0x70)return true;
        return false;
    }
    async function decryptCBCNoPadding(ct,kb,iv){
        if(ct.length%16!==0||ct.length<16) throw new Error(`CBC-nopad: ${ct.length} не кратно 16`);
        const kDec=await crypto.subtle.importKey('raw',kb,{name:'AES-CBC'},false,['decrypt']);
        const kEnc=await crypto.subtle.importKey('raw',kb,{name:'AES-CBC'},false,['encrypt']);
        const N=ct.length;
        const lastBlock=ct.slice(N-16,N);
        const Wb=new Uint8Array(16);
        for(let i=0;i<16;i++) Wb[i]=lastBlock[i]^0x10;
        const Zfull=new Uint8Array(await crypto.subtle.encrypt({name:'AES-CBC',iv:Wb},kEnc,new Uint8Array(16)));
        const Z=Zfull.slice(0,16);
        const input=new Uint8Array(16+N+16);
        input.set(iv,0); input.set(ct,16); input.set(Z,16+N);
        const dec=new Uint8Array(await crypto.subtle.decrypt({name:'AES-CBC',iv},kDec,input));
        return dec.slice(16);
    }
    async function probeDecryption(sample,kb,ivs,logFn){
        const attempts=[];
        for(const iv of ivs){
            const ivHex=ivToHex(iv);
            try{
                if(sample.length%16===0){
                    const k=await crypto.subtle.importKey('raw',kb.slice(0,16),{name:'AES-CBC'},false,['decrypt']);
                    const dec=new Uint8Array(await crypto.subtle.decrypt({name:'AES-CBC',iv},k,sample));
                    if(looksLikeAudio(dec)){ logFn&&logFn(`✅ AES-CBC+PKCS7 IV=${ivHex.slice(0,32)}`,'ok'); return {method:'AES-CBC+PKCS7'}; }
                }
            }catch(e){}
            try{
                let w=sample;
                if(sample.length%16!==0){
                    const pad=16-(sample.length%16);
                    w=new Uint8Array(sample.length+pad);
                    w.set(sample,0);
                }
                const dec=await decryptCBCNoPadding(w,kb.slice(0,16),iv);
                const cut=dec.slice(0,sample.length);
                if(looksLikeAudio(cut)){ logFn&&logFn(`✅ AES-CBC-nopad IV=${ivHex.slice(0,32)}`,'ok'); return {method:'AES-CBC-nopad'}; }
            }catch(e){}
            try{
                const k=await crypto.subtle.importKey('raw',kb.slice(0,16),{name:'AES-CTR'},false,['decrypt']);
                const dec=new Uint8Array(await crypto.subtle.decrypt({name:'AES-CTR',counter:iv,length:128},k,sample));
                if(looksLikeAudio(dec)){ logFn&&logFn(`✅ AES-CTR IV=${ivHex.slice(0,32)}`,'ok'); return {method:'AES-CTR'}; }
            }catch(e){}
        }
        logFn&&logFn('❌ Схема не найдена','err');
        return null;
    }
    function parseM3u8(text,baseUrl){
        const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
        const segs=[]; let dur=0,key=null,mediaSeq=0;
        let baseQuery='';
        try{ baseQuery=new URL(baseUrl).search; }catch(e){}
        for(let i=0;i<lines.length;i++){
            const l=lines[i];
            if(l.startsWith('#EXT-X-MEDIA-SEQUENCE:')) mediaSeq=parseInt(l.slice(22).trim(),10)||0;
            else if(l.startsWith('#EXT-X-KEY:')){
                const kv={};
                l.slice(11).split(',').forEach(p=>{const idx=p.indexOf('='); if(idx>0){let v=p.slice(idx+1).trim().replace(/^"|"$/g,'');kv[p.slice(0,idx).trim()]=v;}});
                if(kv.METHOD&&kv.METHOD!=='NONE'&&kv.URI){
                    key={method:kv.METHOD,uri:new URL(kv.URI,baseUrl).href,
                         explicitIVHex:kv.IV?kv.IV.replace(/^0x/i,''):null};
                }
            }
            else if(l.startsWith('#EXTINF:')) dur=parseFloat(l.slice(8));
            else if(!l.startsWith('#')){
                let abs=new URL(l,baseUrl).href;
                if(baseQuery && !abs.includes('?')) abs+=baseQuery;
                const seq=mediaSeq+segs.length;
                let iv;
                if(key && key.explicitIVHex) iv=hexToIV(key.explicitIVHex);
                else if(state.ivMode==='zero') iv=new Uint8Array(16);
                else iv=seqToIV(seq);
                segs.push({url:abs,duration:dur,key,seq,iv});
                dur=0;
            }
        }
        return segs;
    }
    async function downloadHls(url,onProgress,logFn){
        const L=(m,k)=>{ if(logFn)try{logFn(m,k);}catch(e){} };
        const textResp=await gmRequest({method:'GET',url,timeout:30000});
        if(textResp.status!==200)throw new Error(`m3u8 HTTP ${textResp.status}`);
        let text=textResp.responseText;
        let segs=parseM3u8(text,url);
        if(text.includes('#EXT-X-STREAM-INF')){
            const variants=[];
            const lines=text.split(/\r?\n/);
            for(let i=0;i<lines.length;i++){
                if(lines[i].startsWith('#EXT-X-STREAM-INF')){
                    const next=(lines[i+1]||'').trim();
                    if(next&&!next.startsWith('#'))variants.push(next);
                }
            }
            if(variants.length){
                const vurl=new URL(variants[variants.length-1],url).href;
                const vResp=await gmRequest({method:'GET',url:vurl,timeout:30000});
                text=vResp.responseText;
                segs=parseM3u8(text,vurl);
            }
        }
        if(!segs.length)throw new Error('пустой плейлист');
        const fetchBin=async(u,label)=>{
            let lastErr=null;
            for(let attempt=1;attempt<=3;attempt++){
                try{
                    const r=await gmRequest({method:'GET',url:u,responseType:'arraybuffer',timeout:120000});
                    if(r.status!==200&&r.status!==206)throw new Error(`HTTP ${r.status}`);
                    if(!r.response||!(r.response instanceof ArrayBuffer))throw new Error('bad response');
                    if(r.response.byteLength===0)throw new Error('0 байт');
                    return new Uint8Array(r.response);
                }catch(e){
                    lastErr=e;
                    if(attempt<3){ L(`  ⚠ ${label} ${attempt}/3: ${errStr(e)}`,'warn'); await new Promise(r=>setTimeout(r,400*attempt)); }
                }
            }
            throw new Error(`${label}: ${errStr(lastErr)}`);
        };
        const firstSegBytes=await fetchBin(segs[0].url,'seg[0]');
        let scheme=state.cryptoScheme, keyBytes=null;
        if(segs[0].key){
            keyBytes=await fetchBin(segs[0].key.uri,'key');
            L(`  🔑 key.pub (${keyBytes.byteLength} B)`,'warn');
            if(!scheme){
                const ivs=[segs[0].iv];
                if(!ivs.some(iv=>ivToHex(iv)==='00000000000000000000000000000000')) ivs.push(new Uint8Array(16));
                scheme=await probeDecryption(firstSegBytes,keyBytes,ivs,L);
                if(scheme){ state.cryptoScheme=scheme; L(`  🔐 cached: ${scheme.method}`,'debug'); }
            } else { L(`  🔐 cached: ${scheme.method}`,'debug'); }
        }
        if(!scheme)throw new Error('схема шифрования не определена');
        const decryptOne=async(data,iv,label)=>{
            if(!keyBytes)return data;
            if(data.byteLength===0)throw new Error(`${label}: 0 байт`);
            const kb16=keyBytes.slice(0,16);
            const rem=data.byteLength%16;
            try{
                if(scheme.method==='AES-CBC+PKCS7'){
                    if(rem===0 && data.byteLength>=16){
                        const k=await crypto.subtle.importKey('raw',kb16,{name:'AES-CBC'},false,['decrypt']);
                        return new Uint8Array(await crypto.subtle.decrypt({name:'AES-CBC',iv},k,data));
                    }
                    const pad=16-rem;
                    const work=new Uint8Array(data.byteLength+pad);
                    work.set(data,0);
                    const decFull=await decryptCBCNoPadding(work,kb16,iv);
                    return decFull.slice(0,data.byteLength);
                }
                if(scheme.method==='AES-CBC-nopad'){
                    let work=data;
                    if(rem!==0){
                        const pad=16-rem;
                        work=new Uint8Array(data.byteLength+pad);
                        work.set(data,0);
                    }
                    const decFull=await decryptCBCNoPadding(work,kb16,iv);
                    return decFull.slice(0,data.byteLength);
                }
                if(scheme.method==='AES-CTR'){
                    const k=await crypto.subtle.importKey('raw',kb16,{name:'AES-CTR'},false,['decrypt']);
                    return new Uint8Array(await crypto.subtle.decrypt({name:'AES-CTR',counter:iv,length:128},k,data));
                }
                return data;
            }catch(e){ throw new Error(`${label}: ${errStr(e)}`); }
        };
        const chunks=[];
        const dec0=await decryptOne(firstSegBytes,segs[0].iv,'seg[0]');
        chunks.push(dec0);
        onProgress&&onProgress(1,segs.length,dec0.byteLength);
        for(let i=1;i<segs.length;i++){
            if(state.batchCancel)throw new Error('aborted');
            const raw=await fetchBin(segs[i].url,`seg[${i}]`);
            const dec=await decryptOne(raw,segs[i].iv,`seg[${i}]`);
            chunks.push(dec);
            onProgress&&onProgress(i+1,segs.length,dec.byteLength);
        }
        let total=0; for(const c of chunks)total+=c.byteLength;
        const out=new Uint8Array(total); let off=0;
        for(const c of chunks){out.set(c,off);off+=c.byteLength;}
        return out;
    }

    // ═══ DB ═══
    let db=null, dbReady=false;
    async function dbInit(){
        if(dbReady&&db)return db;
        return new Promise((res,rej)=>{
            let settled=false;
            const timer=setTimeout(()=>{if(!settled){settled=true;rej(new Error('IDB timeout'));}},8000);
            let req; try{req=indexedDB.open(DB_NAME,DB_VERSION);}catch(e){clearTimeout(timer);return rej(e);}
            req.onerror=()=>{if(!settled){settled=true;clearTimeout(timer);rej(req.error||new Error('err'));}};
            req.onsuccess=()=>{if(!settled){settled=true;clearTimeout(timer);db=req.result;dbReady=true;res(db);}};
            req.onupgradeneeded=e=>{try{const d=e.target.result;if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE,{keyPath:'id'});}catch(e){}};
        });
    }
    function dbTx(store,mode,fn){
        return new Promise(async (res,rej)=>{
            let settled=false;
            const timer=setTimeout(()=>{if(!settled){settled=true;rej(new Error('dbTx timeout'));}},10000);
            const done=v=>{if(!settled){settled=true;clearTimeout(timer);res(v);}};
            const fail=e=>{if(!settled){settled=true;clearTimeout(timer);rej(e);}};
            try{ if(!db)await dbInit(); }catch(e){return fail(e);}
            try{
                const tx=db.transaction(store,mode);
                tx.onerror=()=>fail(tx.error); tx.onabort=()=>fail(tx.error);
                const req=fn(tx.objectStore(store));
                req.onsuccess=()=>done(req.result); req.onerror=()=>fail(req.error);
            }catch(e){fail(e);}
        });
    }
    const dbGetAll=s=>dbTx(s,'readonly',st=>st.getAll());
    const dbAdd=(s,rec)=>dbTx(s,'readwrite',st=>st.put(rec));

    // ═══ YANDEX.DISK ═══
    const Yadisk={
        _folderCache:new Set(),
        async request(method,url,body,headers={}){
            const h={'Authorization':`OAuth ${state.yadiskToken}`,...headers};
            return await gmRequest({method,url,headers:h,data:body,timeout:300000});
        },
        async findBaseFolder(){
            if(state.resolvedDiskBase)return state.resolvedDiskBase;
            try{
                const r=await this.request('GET',`${YADISK_API}/resources?path=/&limit=200`);
                if(r.status===200){
                    const d=JSON.parse(r.responseText);
                    const target=state.yadiskFolder.toLowerCase();
                    for(const it of (d?._embedded?.items||[])){
                        if(it.type==='dir'&&(it.name||'').toLowerCase()===target){ state.resolvedDiskBase=it.name; return it.name; }
                    }
                    const cr=await this.request('PUT',`${YADISK_API}/resources?path=${encodeURIComponent('/'+state.yadiskFolder)}`);
                    if(cr.status===201||cr.status===409){state.resolvedDiskBase=state.yadiskFolder;return state.yadiskFolder;}
                }
            }catch(e){}
            state.resolvedDiskBase=state.yadiskFolder; return state.yadiskFolder;
        },
        async findDownloadsFolder(base){
            if(state.resolvedDownloadsBase)return state.resolvedDownloadsBase;
            try{
                const r=await this.request('GET',`${YADISK_API}/resources?path=${encodeURIComponent('/'+base)}&limit=200`);
                if(r.status===200){
                    const d=JSON.parse(r.responseText);
                    for(const it of (d?._embedded?.items||[])){
                        if(it.type==='dir'&&(it.name||'').toLowerCase()==='@downloads'){ state.resolvedDownloadsBase=it.name; return it.name; }
                    }
                }
            }catch(e){}
            state.resolvedDownloadsBase='@downloads'; return '@downloads';
        },
        async ensureFolder(path){
            if(!path||path==='/')return true;
            path='/'+path.replace(/^\/+|\/+$/g,'');
            if(this._folderCache.has(path))return true;
            try{ const r=await this.request('GET',`${YADISK_API}/resources?path=${encodeURIComponent(path)}&limit=1`); if(r.status===200){this._folderCache.add(path);return true;} }catch(e){}
            let cur='';
            for(const p of path.replace(/^\//,'').split('/')){
                if(!p)continue; cur+='/'+p;
                for(let i=1;i<=3;i++){
                    try{
                        const r=await this.request('PUT',`${YADISK_API}/resources?path=${encodeURIComponent(cur)}`);
                        if(r.status===201||r.status===409)break;
                        if(i===3)return false;
                        await new Promise(res=>setTimeout(res,500*i));
                    }catch(e){ if(i===3)return false; await new Promise(res=>setTimeout(res,500*i)); }
                }
            }
            this._folderCache.add(path); return true;
        },
        async getUploadHref(path){
            for(let i=1;i<=5;i++){
                try{
                    const r=await this.request('GET',`${YADISK_API}/resources/upload?path=${encodeURIComponent(path)}&overwrite=true`);
                    if(r.status===200)return JSON.parse(r.responseText).href;
                    if([429,500,502,503,504].includes(r.status))await new Promise(res=>setTimeout(res,1000*i));
                    else return null;
                }catch(e){await new Promise(res=>setTimeout(res,1000*i));}
            }
            return null;
        },
        // ⭐ v2.0: GM_xmlhttpRequest (обходит CORS) + fake-progress по таймеру
        async uploadBlob(blob, path, onProgress){
            const href = await this.getUploadHref(path);
            if(!href) return {ok:false, error:'no href'};

            for(let i = 1; i <= 5; i++){
                let lastError = '';
                try{
                    const res = await new Promise((resolve)=>{
                        let done = false;
                        let fakeTimer = null;
                        let fakePct = 0;
                        let lastRealPct = 0;
                        const t0 = performance.now();

                        const startFake = ()=>{
                            fakeTimer = setInterval(()=>{
                                if(done) return;
                                const sec = (performance.now() - t0) / 1000;
                                // плавный рост до 90% за ~60 сек
                                const target = Math.min(90, (sec / 60) * 90);
                                fakePct = Math.max(fakePct, target);
                                if(onProgress && fakePct > lastRealPct){
                                    const fakeSpeed = sec > 0.5 ? (blob.size * (fakePct/100) / 1048576 / sec) : 0;
                                    try{ onProgress({loaded:0, total:blob.size, pct:fakePct, speed:fakeSpeed, eta:0, fake:true}); }catch(e){}
                                }
                            }, 500);
                        };
                        const stopFake = ()=>{ if(fakeTimer){ clearInterval(fakeTimer); fakeTimer = null; } };

                        const handleProgress = (e)=>{
                            if(!e || !e.lengthComputable) return;
                            const realPct = (e.loaded / e.total) * 100;
                            if(realPct <= lastRealPct) return;
                            lastRealPct = realPct;
                            if(onProgress){
                                try{ onProgress({loaded:e.loaded, total:e.total, pct:realPct, speed:0, eta:0}); }catch(e){}
                            }
                        };

                        startFake();

                        try{
                            GM_xmlhttpRequest({
                                method: 'PUT',
                                url: href,
                                data: blob,
                                headers: {'Content-Type':'application/octet-stream'},
                                timeout: 900000,
                                onprogress: handleProgress,
                                onload: (r)=>{
                                    done = true; stopFake();
                                    if(r.status >= 200 && r.status < 300){
                                        if(onProgress) try{ onProgress({loaded:blob.size, total:blob.size, pct:100, speed:0, eta:0}); }catch(e){}
                                        resolve({status: r.status});
                                    } else {
                                        resolve({status: r.status, err: `HTTP ${r.status}`});
                                    }
                                },
                                onerror: ()=>{ done=true; stopFake(); resolve({status:0, err:'network'}); },
                                ontimeout: ()=>{ done=true; stopFake(); resolve({status:0, err:'timeout'}); },
                                onabort: ()=>{ done=true; stopFake(); resolve({status:0, err:'abort'}); }
                            });
                        }catch(e){
                            done = true; stopFake();
                            resolve({status:0, err: errStr(e)});
                        }
                    });

                    if(res.status >= 200 && res.status < 300) return {ok:true};
                    lastError = res.err || `HTTP ${res.status}`;
                }catch(e){
                    lastError = errStr(e);
                }

                if(i < 5){
                    logWarn(`Диск попытка ${i}/5: ${lastError}, retry...`);
                    await new Promise(r=>setTimeout(r, 1500*i));
                }
            }
            return {ok:false, error: lastError || 'upload failed'};
        },
        async buildPath(track,ext){
            const base=await this.findBaseFolder();
            const dl=await this.findDownloadsFolder(base);
            const year=String(new Date().getFullYear());
            const artist=sanitizeName(track.artist||'Unknown');
            const title=sanitizeName(track.title||'Untitled').replace(/\.(mp3|m4a|flac|aac|ogg|opus|wav|ts)$/i,'');
            let folder='';
            if(track.album)folder=sanitizeName(track.album);
            else if(state.createArtistFolder)folder=artist;
            if(folder)return `/${base}/${dl}/${year}/${folder}/${title}.${ext}`;
            return `/${base}/${dl}/${year}/${[artist,title].filter(Boolean).join(' - ')}.${ext}`;
        },
        async uploadTrack(track,blob,ext,onProgress){
            try{
                const path=await this.buildPath(track,ext);
                const folder=path.substring(0,path.lastIndexOf('/'));
                if(!await this.ensureFolder(folder))return {ok:false,error:'mkdir failed'};
                const up=await this.uploadBlob(blob,path,onProgress);
                if(!up.ok)return {ok:false,error:up.error};
                return {ok:true,diskPath:path};
            }catch(e){return {ok:false,error:errStr(e)};}
        }
    };

    // ═══ GITHUB ═══
    const GhState={
        async api(method,url,body){
            if(!state.ghToken)throw new Error('no token');
            return await gmRequest({
                method,url,
                headers:{ 'Authorization':`token ${state.ghToken}`,
                    'Accept':'application/vnd.github+json',
                    'X-GitHub-Api-Version':'2022-11-28',
                    ...(body?{'Content-Type':'application/json'}:{}) },
                data:body?JSON.stringify(body):undefined, timeout:30000
            });
        },
        buildPayload(){
            const meta={};
            for(const [k,v] of state.downloadedMeta)meta[k]=v;
            return { version:VERSION, updatedAt:new Date().toISOString(),
                downloadedIds:Array.from(state.downloadedIds), downloadedMeta:meta,
                settings:{ saveTxt:state.saveTxt, createArtistFolder:state.createArtistFolder,
                    uploadDisk:state.uploadDisk, keepLocal:state.keepLocal,
                    autoSync:state.autoSync, yadiskFolder:state.yadiskFolder, ivMode:state.ivMode },
                account:{uid:state.uid, login:state.login} };
        },
        b64e(s){const b=new TextEncoder().encode(s);let x='';for(let i=0;i<b.length;i++)x+=String.fromCharCode(b[i]);return btoa(x);},
        b64d(s){const bin=atob(s.replace(/\s/g,''));const b=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)b[i]=bin.charCodeAt(i);return new TextDecoder().decode(b);},
        url(){return `https://api.github.com/repos/${state.ghRepo}/contents/${state.ghRepoPath}`;},
        async load(){
            if(!state.ghToken||!state.ghRepo||!state.ghRepoPath)return false;
            try{
                const r=await this.api('GET',this.url());
                if(r.status===404)return await this.save()!==false;
                if(r.status!==200)return false;
                const d=JSON.parse(r.responseText);
                const remote=JSON.parse(this.b64d(d.content));
                for(const id of (remote.downloadedIds||[]))state.downloadedIds.add(String(id));
                if(remote.downloadedMeta){
                    for(const [k,v] of Object.entries(remote.downloadedMeta)){
                        if(!state.downloadedMeta.has(k))state.downloadedMeta.set(k,v);
                    }
                }
                if(remote.settings){
                    const s=remote.settings;
                    if(s.createArtistFolder!==undefined)state.createArtistFolder=!!s.createArtistFolder;
                    if(s.saveTxt!==undefined)state.saveTxt=!!s.saveTxt;
                    if(s.uploadDisk!==undefined)state.uploadDisk=!!s.uploadDisk;
                    if(s.keepLocal!==undefined)state.keepLocal=!!s.keepLocal;
                    if(s.autoSync!==undefined)state.autoSync=!!s.autoSync;
                    if(s.ivMode!==undefined)state.ivMode=s.ivMode;
                }
                logGh(`📥 Загружено: ${state.downloadedIds.size} ID`);
                return true;
            }catch(e){logErr(`Repo load: ${errStr(e)}`);return false;}
        },
        async save(){
            if(!state.ghToken||!state.ghRepo||!state.ghRepoPath)return false;
            try{
                const url=this.url();
                let sha=null;
                const getR=await this.api('GET',url);
                if(getR.status===200){try{sha=JSON.parse(getR.responseText).sha;}catch(e){}}
                const body={ message:`VKDL v${VERSION} · ${new Date().toISOString()}`,
                    content:this.b64e(JSON.stringify(this.buildPayload(),null,2)), ...(sha?{sha}:{}) };
                const r=await this.api('PUT',url,body);
                if(r.status===200||r.status===201){
                    state.lastGhSyncAt=Date.now();
                    logGh(`💾 Сохранено (${state.downloadedIds.size} ID)`);
                    Sound.github();
                    return true;
                }
                return false;
            }catch(e){logErr(`Repo save: ${errStr(e)}`);return false;}
        },
        schedule(){
            if(!state.ghToken||!state.autoSync)return;
            state.ghSyncPending=true;
            if(state.ghSyncTimer)clearTimeout(state.ghSyncTimer);
            state.ghSyncTimer=setTimeout(async()=>{
                state.ghSyncTimer=null;
                if(state.ghSyncPending){state.ghSyncPending=false;await this.save();}
            },5000);
        },
        async test(){
            if(!state.ghToken){logErr('Токен не задан');return false;}
            try{
                const r=await this.api('GET','https://api.github.com/user');
                if(r.status===200){logGh(`✅ GitHub: @${JSON.parse(r.responseText).login}`);return true;}
                return false;
            }catch(e){logErr(`GitHub: ${errStr(e)}`);return false;}
        }
    };

    // ═══ UI ═══
    const UI_HTML = `
<style>
#yamdl{position:fixed;bottom:16px;right:16px;z-index:2147483647;background:#000;color:#fff;font-family:'Yandex Sans Text',-apple-system,'Segoe UI',sans-serif;width:${UI_WIDTH}px;max-width:calc(100vw - 32px);border-radius:20px;border:1px solid rgba(255,255,255,.08);box-shadow:0 24px 80px rgba(0,0,0,.8);overflow:hidden;display:flex;flex-direction:column;max-height:calc(100vh - 32px);}
#yamdl-mini{position:fixed;bottom:16px;right:16px;z-index:2147483647;background:#000;border:1px solid rgba(255,255,255,.08);border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.7);display:none;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;}
.ydl-btn{padding:9px 15px;border-radius:999px;font-size:12px;font-weight:500;border:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .15s;font-family:inherit;}
.ydl-btn:hover{transform:translateY(-1px);}
.ydl-btn:disabled{opacity:.4;cursor:not-allowed;transform:none;}
.ydl-accent{background:linear-gradient(135deg,#ffdb4d,#ffcc00);color:#000;font-weight:600;}
.ydl-ghost{background:rgba(255,255,255,.06);color:rgba(255,255,255,.7);border:1px solid rgba(255,255,255,.08);}
.ydl-ghost:hover{background:rgba(255,255,255,.1);color:#fff;}
.ydl-icon{width:32px;height:32px;border-radius:10px;background:rgba(255,255,255,.06);color:rgba(255,255,255,.6);border:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-size:14px;}
.ydl-icon:hover{background:rgba(255,255,255,.1);color:#fff;}
.ydl-icon.token-warn{background:rgba(248,113,113,.2);color:#f87171;animation:ydlp 1.2s ease-in-out infinite;}
.ydl-icon.token-ok{background:rgba(74,222,128,.15);color:#4ade80;}
#ymdl-log::-webkit-scrollbar,#ymdl-list::-webkit-scrollbar{width:6px;}
#ymdl-log::-webkit-scrollbar-thumb,#ymdl-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:3px;}
.ydl-row{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;cursor:pointer;border:1px solid transparent;}
.ydl-row:hover{background:rgba(255,255,255,.04);}
.ydl-row.sel{background:rgba(255,219,77,.08);border-color:rgba(255,219,77,.2);}
.ydl-row.dl{background:rgba(74,222,128,.06);border-color:rgba(74,222,128,.15);}
.ydl-cb{width:16px;height:16px;border-radius:4px;border:1.5px solid rgba(255,255,255,.25);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;color:#000;}
.ydl-cb.on{background:linear-gradient(135deg,#ffdb4d,#ffcc00);border-color:transparent;font-weight:bold;}
.ydl-cb.dlon{background:linear-gradient(135deg,#4ade80,#22c55e);border-color:transparent;font-weight:bold;color:#000;}
.ydl-pbar{width:100%;height:6px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden;}
.ydl-pfill{height:100%;border-radius:3px;background:linear-gradient(90deg,#ffdb4d,#ffcc00);transition:width .15s;}
.ydl-pfill.done{background:linear-gradient(90deg,#4ade80,#22c55e);}
.ydl-pfill.err{background:linear-gradient(90deg,#f87171,#dc2626);}
.ydl-pfill.disk{background:linear-gradient(90deg,#ff8c00,#ff6600);}
.ydl-inp{width:100%;background:rgba(0,0,0,.4);color:#fff;border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:8px 10px;font-size:11px;font-family:'SF Mono',monospace;outline:none;box-sizing:border-box;}
.ydl-inp:focus{border-color:#ffdb4d;}
.ydl-toggle{display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(255,255,255,.03);border-radius:8px;cursor:pointer;user-select:none;font-size:11px;color:rgba(255,255,255,.6);}
.ydl-toggle input{accent-color:#ffdb4d;cursor:pointer;}
.ydl-pulse{animation:ydlp 2s ease-in-out infinite;}
@keyframes ydlp{0%,100%{opacity:1;}50%{opacity:.5;}}
.ydl-actions{display:flex;gap:6px;padding:0 14px 12px;flex-shrink:0}
.ydl-action{flex:1;padding:10px 6px;border-radius:12px;border:none;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;transition:all .15s;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:52px;line-height:1.1}
.ydl-action .ico{font-size:16px}
.ydl-action .lbl{font-size:10px;letter-spacing:.2px}
.ydl-action:disabled{opacity:.35;cursor:not-allowed;transform:none!important;box-shadow:none!important}
.ydl-action:hover:not(:disabled){transform:translateY(-1px)}
.ydl-action.local{background:linear-gradient(135deg,#27ae60,#2ecc71);color:#fff;box-shadow:0 3px 10px rgba(46,204,113,.3)}
.ydl-action.disk{background:linear-gradient(135deg,#d35400,#e67e22);color:#fff;box-shadow:0 3px 10px rgba(230,126,34,.3)}
.ydl-action.both{background:linear-gradient(135deg,#8e44ad,#9c27b0);color:#fff;box-shadow:0 3px 10px rgba(156,39,176,.3)}
.ydl-action.stop{background:rgba(231,76,60,.15);color:#e74c3c;border:1px solid rgba(231,76,60,.3);flex:.55;min-width:56px}
.ymdl-stage{opacity:.35;transition:opacity .2s;font-size:10px;font-family:'SF Mono',monospace;}
.ymdl-stage.active{opacity:1}
.ymdl-stage.done{opacity:.75}
.ymdl-stage.fail{opacity:1}
.ymdl-stage-lbl{display:flex;justify-content:space-between;color:rgba(255,255,255,.7);margin-bottom:2px;gap:8px;}
.ymdl-stage.active .ymdl-stage-lbl > span:first-child{color:#ffdb4d;font-weight:600}
.ymdl-stage.done .ymdl-stage-lbl > span:first-child{color:#4ade80}
.ymdl-stage.fail .ymdl-stage-lbl > span:first-child{color:#f87171}
.ymdl-stage-pct{color:rgba(255,255,255,.6);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60%;}
.ymdl-stage-bar{height:3px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden}
.ymdl-stage-fill{height:100%;width:0%;background:#4a9eff;border-radius:2px;transition:width .2s}
.ymdl-stage.active .ymdl-stage-fill{background:linear-gradient(90deg,#ffdb4d,#ffcc00)}
.ymdl-stage.done .ymdl-stage-fill{background:linear-gradient(90deg,#4ade80,#22c55e)}
.ymdl-stage.fail .ymdl-stage-fill{background:linear-gradient(90deg,#f87171,#dc2626)}
</style>

<div id="yamdl-mini">
    <div style="width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#ffdb4d,#ffcc00);display:flex;align-items:center;justify-content:center;font-size:14px;">🎵</div>
    <div style="display:flex;flex-direction:column;line-height:1.2;">
        <div style="font-size:11px;color:#fff;font-weight:500;">VK DL v${VERSION}</div>
        <div id="ymdl-mini-status" style="font-size:9px;color:rgba(255,255,255,.5);font-family:'SF Mono',monospace;">готов</div>
    </div>
    <div id="ymdl-mini-badge" style="display:none;background:#4ade80;color:#000;font-size:9px;font-weight:bold;padding:2px 6px;border-radius:8px;font-family:'SF Mono',monospace;">0</div>
    <div style="font-size:14px;color:rgba(255,255,255,.4);">▲</div>
</div>

<div id="yamdl">
    <div style="display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.08);">
        <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#ffdb4d,#ffcc00);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">🎵</div>
        <div style="flex:1;min-width:0;">
            <div style="font-weight:500;font-size:15px;">VK Music DL</div>
            <div id="ymdl-src" style="font-size:11px;color:#4a9eff;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px;" title="">—</div>
            <div style="font-size:9px;color:rgba(255,255,255,.35);">v${VERSION} · авто-токен</div>
        </div>
        <button id="ymdl-tok" class="ydl-icon" title="Обновить VK токен">🔄</button>
        <button id="ymdl-set" class="ydl-icon" title="Настройки">⚙️</button>
        <button id="ymdl-snd" class="ydl-icon" title="Звук">🔊</button>
        <button id="ymdl-min" class="ydl-icon" title="Свернуть">—</button>
        <button id="ymdl-x" class="ydl-icon" title="Закрыть">✕</button>
    </div>

    <div style="padding:12px 18px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:10px;">
        <div id="ymdl-dot" class="ydl-pulse" style="width:8px;height:8px;border-radius:50%;background:#ffdb4d;flex-shrink:0;"></div>
        <div id="ymdl-stat" style="font-size:12px;color:rgba(255,255,255,.6);">Инициализация...</div>
    </div>

    <div id="ymdl-set-panel" style="display:none;padding:12px 18px;border-bottom:1px solid rgba(255,255,255,.08);">
        <div class="ydl-row" style="padding:0;gap:8px;"><label style="font-size:11px;color:rgba(255,255,255,.6);min-width:120px;">🔑 VK token</label><input type="password" id="ymdl-vt" class="ydl-inp" placeholder="vk1.a... (авто)"></div>
        <div class="ydl-row" style="padding:0;gap:8px;margin-top:8px;"><label style="font-size:11px;color:rgba(255,255,255,.6);min-width:120px;">🟠 Яндекс.Диск</label><input type="password" id="ymdl-dt" class="ydl-inp" placeholder="OAuth токен"></div>
        <div class="ydl-row" style="padding:0;gap:8px;margin-top:8px;"><label style="font-size:11px;color:rgba(255,255,255,.6);min-width:120px;">📁 Папка Диска</label><input type="text" id="ymdl-df" class="ydl-inp" placeholder="Music"></div>
        <div class="ydl-row" style="padding:0;gap:8px;margin-top:8px;"><label style="font-size:11px;color:rgba(255,255,255,.6);min-width:120px;">🐙 GitHub токен</label><input type="password" id="ymdl-gt" class="ydl-inp" placeholder="ghp_..."></div>
        <div class="ydl-row" style="padding:0;gap:8px;margin-top:8px;"><label style="font-size:11px;color:rgba(255,255,255,.6);min-width:120px;">📦 Репозиторий</label><input type="text" id="ymdl-gr" class="ydl-inp" placeholder="owner/repo"></div>
        <div class="ydl-row" style="padding:0;gap:8px;margin-top:8px;"><label style="font-size:11px;color:rgba(255,255,255,.6);min-width:120px;">📁 Путь</label><input type="text" id="ymdl-grp" class="ydl-inp" placeholder="vk/state.json"></div>
        <div class="ydl-row" style="padding:0;gap:8px;margin-top:8px;"><label style="font-size:11px;color:rgba(255,255,255,.6);min-width:120px;">🔐 IV режим</label>
            <select id="ymdl-iv" class="ydl-inp"><option value="seq">Media sequence</option><option value="zero">Zero IV</option></select>
        </div>
        <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">
            <button id="ymdl-save" class="ydl-btn ydl-accent" style="padding:6px 12px;font-size:11px;">💾 Сохранить</button>
            <button id="ymdl-td" class="ydl-btn ydl-ghost" style="padding:6px 12px;font-size:11px;">🧪 Диск</button>
            <button id="ymdl-tg" class="ydl-btn ydl-ghost" style="padding:6px 12px;font-size:11px;">🧪 GitHub</button>
            <button id="ymdl-sync" class="ydl-btn ydl-ghost" style="padding:6px 12px;font-size:11px;">🔄 Синк</button>
            <button id="ymdl-tvk" class="ydl-btn ydl-ghost" style="padding:6px 12px;font-size:11px;">🔑 VK test</button>
            <button id="ymdl-probe" class="ydl-btn ydl-ghost" style="padding:6px 12px;font-size:11px;">🔬 Re-probe</button>
            <button id="ymdl-tsound" class="ydl-btn ydl-ghost" style="padding:6px 12px;font-size:11px;">🎼 Звук</button>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.08);">
            <label class="ydl-toggle" id="t1"><input type="checkbox" id="cb-txt">📝 TXT</label>
            <label class="ydl-toggle" id="t2"><input type="checkbox" id="cb-artist">📁 Папка</label>
            <label class="ydl-toggle" id="t3"><input type="checkbox" id="cb-disk">☁️ Диск</label>
            <label class="ydl-toggle" id="t4"><input type="checkbox" id="cb-local">💾 Локально</label>
            <label class="ydl-toggle" id="t5"><input type="checkbox" id="cb-sync">🔄 Автосинк</label>
            <label class="ydl-toggle" id="t6"><input type="checkbox" id="cb-sound">🔊 Звуки</label>
        </div>
        <div id="ymdl-state" style="font-family:'SF Mono',monospace;font-size:10px;color:rgba(255,255,255,.5);margin-top:8px;">📊 —</div>
    </div>

    <div id="ymdl-list-panel" style="display:none;padding:12px 18px;border-bottom:1px solid rgba(255,255,255,.08);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px;">
            <div style="font-size:11px;color:rgba(255,255,255,.6);">ВЫБЕРИ ТРЕКИ</div>
            <div style="display:flex;gap:6px;">
                <button id="ymdl-fn" class="ydl-btn ydl-ghost" style="padding:4px 9px;font-size:10px;">Только новые</button>
                <button id="ymdl-sa" class="ydl-btn ydl-ghost" style="padding:4px 9px;font-size:10px;">Все</button>
                <button id="ymdl-sn" class="ydl-btn ydl-ghost" style="padding:4px 9px;font-size:10px;">Ничего</button>
            </div>
        </div>
        <div id="ymdl-list" style="max-height:240px;overflow-y:auto;background:#0e0e10;border-radius:10px;padding:6px;border:1px solid rgba(255,255,255,.08);"></div>
        <div id="ymdl-li" style="font-size:10px;color:rgba(255,255,255,.4);margin-top:10px;">—</div>
    </div>

    <div id="ymdl-batch" style="display:none;padding:12px 18px;border-bottom:1px solid rgba(255,255,255,.08);">
        <div style="font-size:10px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin-bottom:6px;">Общий прогресс батча</div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
            <div style="display:flex;align-items:baseline;gap:6px;">
                <span id="ymdl-bd" style="font-size:22px;font-weight:600;color:#ffdb4d;">0</span>
                <span style="font-size:12px;color:rgba(255,255,255,.4);">/ <span id="ymdl-bt">0</span></span>
            </div>
            <div id="ymdl-beta" style="font-family:'SF Mono',monospace;font-size:10px;color:rgba(255,255,255,.5);">⏱ —</div>
        </div>
        <div class="ydl-pbar" style="margin-bottom:8px;height:8px;"><div id="ymdl-bbar" class="ydl-pfill done" style="width:0%;"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:rgba(255,255,255,.4);font-family:'SF Mono',monospace;">
            <span id="ymdl-bok">✓ 0 OK</span>
            <span id="ymdl-bb">📦 0 B</span>
            <span id="ymdl-berr">✕ 0 err</span>
        </div>
    </div>

    <div id="ymdl-cur" style="display:none;padding:12px 18px;border-bottom:1px solid rgba(255,255,255,.08);">
        <div style="font-size:10px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin-bottom:6px;">Текущий трек</div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;gap:10px;">
            <div id="ymdl-ct" style="font-size:12px;color:#fff;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;">—</div>
            <div id="ymdl-cp" style="font-size:14px;color:#ffdb4d;font-weight:600;font-family:'SF Mono',monospace;">0%</div>
        </div>
        <div class="ydl-pbar" style="margin-bottom:10px;height:8px;"><div id="ymdl-cbar" class="ydl-pfill" style="width:0%;"></div></div>
        <div id="ymdl-stages" style="display:flex;flex-direction:column;gap:6px;">
            <div class="ymdl-stage" data-stage="dl"><div class="ymdl-stage-lbl"><span>⬇ Скачивание</span><span class="ymdl-stage-pct">—</span></div><div class="ymdl-stage-bar"><div class="ymdl-stage-fill"></div></div></div>
            <div class="ymdl-stage" data-stage="dec"><div class="ymdl-stage-lbl"><span>🔓 Расшифровка</span><span class="ymdl-stage-pct">—</span></div><div class="ymdl-stage-bar"><div class="ymdl-stage-fill"></div></div></div>
            <div class="ymdl-stage" data-stage="disk"><div class="ymdl-stage-lbl"><span>☁️ Яндекс.Диск</span><span class="ymdl-stage-pct">—</span></div><div class="ymdl-stage-bar"><div class="ymdl-stage-fill"></div></div></div>
            <div class="ymdl-stage" data-stage="local"><div class="ymdl-stage-lbl"><span>💾 Локально</span><span class="ymdl-stage-pct">—</span></div><div class="ymdl-stage-bar"><div class="ymdl-stage-fill"></div></div></div>
        </div>
    </div>

    <div style="padding:12px 18px;border-bottom:1px solid rgba(255,255,255,.08);">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:10px;color:rgba(255,255,255,.4);font-weight:500;">DIAG LOG</span>
            <span style="font-size:9px;color:rgba(255,255,255,.3);">live</span>
        </div>
        <div id="ymdl-log" style="font-size:10px;color:rgba(255,255,255,.6);background:#0e0e10;padding:10px 12px;border-radius:10px;max-height:150px;overflow-y:auto;font-family:'SF Mono',monospace;line-height:1.55;border:1px solid rgba(255,255,255,.08);"></div>
    </div>

    <div class="ydl-actions">
        <button id="ymdl-loc" class="ydl-action local" disabled><span class="ico">💾</span><span class="lbl">Локально</span></button>
        <button id="ymdl-dsk" class="ydl-action disk" disabled><span class="ico">☁️</span><span class="lbl">На Диск</span></button>
        <button id="ymdl-bth" class="ydl-action both" disabled><span class="ico">🚀</span><span class="lbl">Оба</span></button>
        <button id="ymdl-stop" class="ydl-action stop" disabled><span class="ico">⏹</span><span class="lbl">Стоп</span></button>
    </div>

    <div style="padding:0 18px 12px;display:flex;gap:8px;">
        <button id="ymdl-all" class="ydl-btn ydl-accent" style="flex:1;padding:11px;"><span style="font-size:15px;">⬇</span> Загрузить список</button>
    </div>

    <div style="padding:0 18px 12px;display:flex;justify-content:space-between;font-size:9px;color:rgba(255,255,255,.3);">
        <span id="ymdl-net">🌐 online</span>
        <span id="ymdl-timer">+0.00s</span>
    </div>
</div>`;

    function ensureUI(){
        if(document.getElementById('yamdl'))return true;
        if(!document.body)return false;
        try{document.body.insertAdjacentHTML('beforeend',UI_HTML);}
        catch(e){console.error('[VKDL] UI fail:',e);return false;}
        return !!document.getElementById('yamdl');
    }
    if(!ensureUI())document.addEventListener('DOMContentLoaded',ensureUI,{once:true});

    const $=id=>document.getElementById(id);
    function safeOn(id,fn){const el=document.getElementById(id);if(!el)return;el.onclick=fn;}
    function safeChange(id,fn){const el=document.getElementById(id);if(!el)return;el.addEventListener('change',fn);}
    function safeAddClass(id,cls,on){const el=document.getElementById(id);if(el)el.classList.toggle(cls,on);}

    const logEl=$('ymdl-log');
    setInterval(()=>{const t=$('ymdl-timer');if(t)t.textContent=ts();},100);
    setInterval(()=>{
        const el=$('ymdl-net'); if(!el)return;
        el.textContent=navigator.onLine?'🌐 online':'📡 OFFLINE';
        el.style.color=navigator.onLine?'rgba(255,255,255,.3)':'#f87171';
    },500);

    function log(t,color='rgba(255,255,255,.6)',cs='color:#8a9aaa;'){
        if(!logEl){console.log('[VKDL]',t);return;}
        const line=document.createElement('div');
        line.innerHTML=`<span style="color:rgba(255,255,255,.4);">[${ts()}]</span> <span style="color:${color};">${t}</span>`;
        logEl.appendChild(line); logEl.scrollTop=logEl.scrollHeight;
        while(logEl.children.length>1500)logEl.removeChild(logEl.firstChild);
        console.log(`%c[${ts()}] %c${t}`,'color:#6a7a8a;font-style:italic;',cs);
    }
    const logOk=t=>log('✓ '+t,'#4ade80');
    const logErr=t=>log('✕ '+t,'#f87171');
    const logWarn=t=>log('⚠ '+t,'#fbbf24');
    const logStep=t=>log('▸ '+t,'#ffdb4d');
    const logNet=t=>log('🌐 '+t,'#ffcc00');
    const logDisk=t=>log('☁️ '+t,'#ff8c00');
    const logGh=t=>log('🐙 '+t,'#a78bfa');
    const logDbg=t=>log('🔬 '+t,'#f472b6');
    const logBoot=t=>log('🚀 '+t,'#38bdf8');
    const logTok=t=>log('🔑 '+t,'#4ade80');

    function setStatus(text,kind='idle'){
        const s=$('ymdl-stat'); if(s)s.textContent=text;
        const d=$('ymdl-dot');
        if(d){
            const c={idle:'#ffdb4d',ok:'#4ade80',err:'#f87171',warn:'#fbbf24',disk:'#ff8c00'};
            d.style.background=c[kind]||'#ffdb4d';
            d.classList.toggle('ydl-pulse',kind==='idle');
        }
        const ms=$('ymdl-mini-status'); if(ms)ms.textContent=text;
    }

    let _stageP = {dl:0, dec:0, disk:0, local:0};
    function _setStagePct(key, pct, detail, state_){
        const el = document.querySelector(`#ymdl-stages .ymdl-stage[data-stage="${key}"]`);
        if(!el) return;
        _stageP[key] = Math.min(100, Math.max(0, pct));
        if(state_ === 'done') el.className = 'ymdl-stage done';
        else if(state_ === 'fail') el.className = 'ymdl-stage fail';
        else if(state_ === 'skip') el.className = 'ymdl-stage done';
        else if(state_ === 'active') el.className = 'ymdl-stage active';
        const f = el.querySelector('.ymdl-stage-fill'); if(f) f.style.width = _stageP[key] + '%';
        const p = el.querySelector('.ymdl-stage-pct');
        if(p) p.textContent = detail != null ? detail : (Math.round(_stageP[key]) + '%');
        const total = (_stageP.dl + _stageP.dec + _stageP.disk + _stageP.local) / 4;
        const cbar = $('ymdl-cbar'); if(cbar) cbar.style.width = Math.min(100, total) + '%';
        const cp = $('ymdl-cp'); if(cp) cp.textContent = Math.round(total) + '%';
    }
    function resetStages(){
        _stageP = {dl:0, dec:0, disk:0, local:0};
        document.querySelectorAll('#ymdl-stages .ymdl-stage').forEach(el=>{
            el.className = 'ymdl-stage';
            const f = el.querySelector('.ymdl-stage-fill'); if(f) f.style.width = '0%';
            const p = el.querySelector('.ymdl-stage-pct'); if(p) p.textContent = '—';
        });
        const cbar = $('ymdl-cbar'); if(cbar){ cbar.style.width = '0%'; cbar.className = 'ydl-pfill'; }
        const cp = $('ymdl-cp'); if(cp) cp.textContent = '0%';
    }
    function setStage(key, pct, detail){ _setStagePct(key, pct, detail, 'active'); }
    function completeStage(key, detail){ _setStagePct(key, 100, detail != null ? detail : '✓', 'done'); }
    function failStage(key, detail){ _setStagePct(key, _stageP[key] || 0, detail != null ? detail : '✕', 'fail'); }
    function skipStage(key, detail){ _setStagePct(key, 100, detail != null ? detail : '—', 'skip'); }

    function setCurTitle(t, idx, total){
        const ct = $('ymdl-ct'); if(ct) ct.textContent = t || '—';
        state.currentIdx = idx; state.currentTotal = total; state.currentTitle = t;
    }
    function updateBatch(){
        const el=$('ymdl-batch'); if(el)el.style.display='block';
        const {batchDone,batchTotal,batchErrors,batchBytesDone,batchStartTime}=state;
        const bd=$('ymdl-bd'); if(bd)bd.textContent=batchDone;
        const bt=$('ymdl-bt'); if(bt)bt.textContent=batchTotal;
        const bbar=$('ymdl-bbar'); if(bbar)bbar.style.width=batchTotal>0?`${Math.round(batchDone/batchTotal*100)}%`:'0%';
        const bok=$('ymdl-bok'); if(bok)bok.textContent=`✓ ${batchDone} OK`;
        const berr=$('ymdl-berr'); if(berr)berr.textContent=`✕ ${batchErrors} err`;
        const bb=$('ymdl-bb'); if(bb)bb.textContent=`📦 ${fmtBytes(batchBytesDone)}`;
        const el2=(performance.now()-batchStartTime)/1000;
        const avg=el2>0?(batchBytesDone/1048576/el2):0;
        const perTrack=batchDone>0?el2/batchDone:0;
        const beta=$('ymdl-beta');
        if(beta)beta.textContent=`⏱ ETA ${fmtEta((batchTotal-batchDone)*perTrack)} · avg ${fmtSpeed(avg)} · ${fmtEta(el2)}`;
        const mb=$('ymdl-mini-badge');
        if(mb){if(batchDone>0&&state.isBatch){mb.style.display='block';mb.textContent=`${batchDone}/${batchTotal}`;}else mb.style.display='none';}
    }
    function updateTokenBadge(){
        const b=$('ymdl-tok'); if(!b)return;
        b.className='ydl-icon';
        if(!state.vkToken){ b.classList.add('token-warn'); b.title='VK токен не найден'; }
        else if(!state.tokenChecked){ b.title='Токен есть, ещё не проверен'; }
        else if(state.tokenOk){ b.classList.add('token-ok'); b.title='VK токен живой ✓'; }
        else { b.classList.add('token-warn'); b.title='Токен протух'; }
    }
    function updateStateInfo(){
        const el=$('ymdl-state'); if(!el)return;
        const srcEl = $('ymdl-src');
        if(srcEl){
            srcEl.textContent = state.sourceName || '—';
            srcEl.title = state.sourceName || '';
            srcEl.style.color = (state.sourceName && state.sourceName!=='—') ? '#4a9eff' : 'rgba(255,255,255,.4)';
        }
        const tokState = state.vkToken ? (state.tokenChecked ? (state.tokenOk?'✓':'✗') : '?') : '∅';
        el.textContent=[
            `📊 ${state.downloadedIds.size}`,
            `🔑 ${tokState}`,
            `🟠 ${state.yadiskToken?'✓':'✗'}`,
            `🐙 ${state.ghToken?'✓':'✗'}${state.ghRepo?' '+state.ghRepo:''}`,
            `🔐 ${state.cryptoScheme?state.cryptoScheme.method:'—'}`,
            `🎯 IV:${state.ivMode}`,
            `🔊 ${Sound.enabled?'✓':'✗'}`,
            state.lastGhSyncAt?`💾 ${fmtAgo(state.lastGhSyncAt)}`:'💾 —'
        ].join(' · ');
        updateTokenBadge();
    }
    function renderList(tracks){
        const listEl=$('ymdl-list'); if(!listEl)return;
        listEl.innerHTML='';
        const visible=tracks.map((t,i)=>({t,i})).filter(({t})=>!state.filterOnlyNew||!state.downloadedIds.has(t.id));
        visible.forEach(({t,i})=>{
            const isDL=state.downloadedIds.has(t.id);
            const row=document.createElement('div');
            row.className='ydl-row'+(isDL?' dl':'');
            const checked=state.selected.has(i);
            if(checked)row.classList.add('sel');
            const title=((t.artist||'')+' — '+(t.title||'')).replace(/"/g,'&quot;');
            const meta=state.downloadedMeta.get(t.id);
            const isDisk=meta?.diskPath;
            const badge=isDisk?'✓ ДИСК':(isDL?'✓ ЕСТЬ':'NEW');
            const dur=t.durationSec?`${Math.floor(t.durationSec/60)}:${String(t.durationSec%60).padStart(2,'0')}`:'';
            const noUrl=!t.url?'<span style="color:#f87171;font-size:9px;">no-url</span>':'';
            row.innerHTML=`
                <div class="ydl-cb ${checked?(isDL?'dlon':'on'):''}">${checked?'✓':''}</div>
                <div style="font-size:10px;color:rgba(255,255,255,.3);font-family:'SF Mono',monospace;width:20px;">${String(i+1).padStart(2,'0')}</div>
                <div style="font-size:11px;color:rgba(255,255,255,.85);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${title}">${title}</div>
                <div style="font-size:9px;color:rgba(255,255,255,.35);font-family:'SF Mono',monospace;">${dur}</div>
                ${noUrl}
                <div style="font-size:8px;padding:2px 5px;border-radius:4px;background:rgba(255,219,77,.15);color:#ffdb4d;font-family:'SF Mono',monospace;">${badge}</div>
            `;
            row.onclick=()=>{
                if(state.selected.has(i))state.selected.delete(i);else state.selected.add(i);
                Sound.click();
                row.classList.toggle('sel');
                const cb=row.querySelector('.ydl-cb');
                cb.classList.toggle('on'); cb.classList.toggle('dlon');
                cb.textContent=state.selected.has(i)?'✓':'';
                updateListInfo();
            };
            listEl.appendChild(row);
        });
        updateListInfo();
    }
    function updateListInfo(){
        const dl=state.allTracks.filter(t=>state.downloadedIds.has(t.id)).length;
        const nw=state.allTracks.length-dl;
        const li=$('ymdl-li');
        if(li)li.innerHTML=`Выбрано: <b style="color:#ffdb4d;">${state.selected.size}</b> · Всего: ${state.allTracks.length} · <span style="color:#4ade80;">✓ ${dl}</span> · <span style="color:#ffdb4d;">🆕 ${nw}</span>`;
        const has=state.selected.size>0;
        const loc=$('ymdl-loc'); if(loc)loc.disabled=!has||state.isBatch;
        const dsk=$('ymdl-dsk'); if(dsk)dsk.disabled=!has||state.isBatch;
        const bth=$('ymdl-bth'); if(bth)bth.disabled=!has||state.isBatch;
        const stp=$('ymdl-stop'); if(stp)stp.disabled=!state.isBatch;
    }

    // ═══ DISCOVERY ═══
    async function fetchMyAudios(){
        state.sourceName = '🎵 Моя музыка';
        updateStateInfo();
        const out=[],seen=new Set();
        const push=t=>{if(t&&t.id&&!seen.has(t.id)){seen.add(t.id);out.push(t);}};
        let offset=0;
        for(let page=0;page<40;page++){
            let resp;
            try{resp=await vkApi('audio.get',{count:100,offset});}
            catch(e){logErr(`audio.get: ${errStr(e)}`);break;}
            const items=resp?.items||[];
            if(!items.length)break;
            let added=0;
            for(const it of items){const n=normalizeVkTrack(it);if(n){push(n);added++;}}
            logOk(`стр. ${page+1}: +${added} (всего ${out.length})`);
            setStatus(`Аудио стр. ${page+1} · ${out.length}`);
            if(items.length<100)break;
            offset+=100;
            await new Promise(r=>setTimeout(r,250));
        }
        return out;
    }
    async function fetchPlaylist(ownerId, playlistId, accessKey){
        const out=[],seen=new Set();
        const push=t=>{if(t&&t.id&&!seen.has(t.id)){seen.add(t.id);out.push(t);}};
        let plTitle='', plArtist='', plYear='', plGenre='';
        try{
            const params = { owner_id: ownerId, playlist_id: playlistId };
            if(accessKey) params.access_key = accessKey;
            logNet(`audio.getPlaylistById owner=${ownerId} pl=${playlistId}${accessKey?' ak='+accessKey.slice(0,8)+'…':''}`);
            const pl = await vkApi('audio.getPlaylistById', params);
            const P = pl?.playlist || pl;
            if(P){
                plTitle = (P.title || '').trim();
                plYear = P.year || '';
                if(Array.isArray(P.genres) && P.genres.length) plGenre = P.genres.map(g=>g.name||g).filter(Boolean).join(', ');
                if(Array.isArray(P.main_artists) && P.main_artists.length)
                    plArtist = P.main_artists.map(a=>a.name).filter(Boolean).join(', ');
                logOk(`API: "${plTitle}" / "${plArtist}" / ${plYear||'—'} / ${plGenre||'—'}`);
            } else logWarn('API пусто');
        }catch(e){ logErr(`getPlaylistById: ${errStr(e)}`); }

        if(!plTitle){
            try{
                const dt = document.title || '';
                const parts = dt.split(/\s*[|—–·]\s*/).map(s=>s.trim()).filter(Boolean);
                if(parts.length){
                    plTitle = parts[0] || '';
                    if(!plArtist && parts[1] && !/ВКонтакте|VK/i.test(parts[1])) plArtist = parts[1];
                    logOk(`Fallback <title>: "${plTitle}" / "${plArtist}"`);
                }
            }catch(e){}
        }
        if(!plTitle){
            try{
                const og = document.querySelector('meta[property="og:title"]');
                if(og && og.content){ plTitle = og.content.trim(); logOk(`Fallback og:title: "${plTitle}"`); }
            }catch(e){}
        }
        if(!plArtist && ownerId){
            try{
                if(String(ownerId).startsWith('-')){
                    const g = await vkApi('groups.getById',{group_id:String(ownerId).replace('-',''),fields:'name'});
                    const gg = Array.isArray(g) ? g[0] : (g?.groups?.[0] || g?.[0]);
                    plArtist = gg?.name || '';
                } else {
                    const u = await vkApi('users.get',{user_ids:ownerId,fields:'screen_name'});
                    const uu = Array.isArray(u) ? u[0] : u;
                    if(uu) plArtist = [uu.first_name, uu.last_name].filter(Boolean).join(' ');
                }
            }catch(e){}
        }
        if(!plTitle) plTitle = `Альбом ${ownerId}_${playlistId}`;
        state.sourceName = `💿 ${plTitle}${plArtist ? ' · ' + plArtist : ''}${plYear ? ' · ' + plYear : ''}`;
        updateStateInfo();
        logStep(`📋 Источник: ${state.sourceName}`);
        if(plGenre) logStep(`🏷️ Жанр: ${plGenre}`);

        let offset=0;
        for(let page=0;page<40;page++){
            let resp;
            try{
                const params = { owner_id:ownerId, playlist_id:playlistId, count:100, offset };
                if(accessKey) params.access_key = accessKey;
                resp = await vkApi('audio.get', params);
            }catch(e){ logErr(`playlist: ${errStr(e)}`); break; }
            const items=resp?.items||[];
            if(!items.length)break;
            for(const it of items){ const n=normalizeVkTrack(it); if(n){ n.album=plTitle; push(n); } }
            if(items.length<100)break;
            offset+=100;
        }
        return out;
    }
    function detectPageKind(){
        const p=location.pathname;
        let m=p.match(/^\/audios(-?\d+)?/); if(m)return {kind:'audios',ownerId:m[1]?m[1].replace(/^-/,''):null};
        m=p.match(/^\/audio(-?\d+)?/); if(m)return {kind:'audios',ownerId:m[1]?m[1].replace(/^-/,''):null};
        return {kind:'audios',ownerId:null};
    }
    async function fetchPageTracks(){
        const kind=detectPageKind();
        logStep(`Страница: ${kind.kind}${kind.ownerId?` owner=${kind.ownerId}`:''}`);
        const q=new URLSearchParams(location.search);
        const z = q.get('z') || '';
        let m = z.match(/audio_playlist(-?\d+)_(\d+)(?:_([a-f0-9]+))?/);
        if(!m) m = z.match(/audio_album(-?\d+)_(\d+)(?:_([a-f0-9]+))?/);
        if(m){ logNet(`playlist ${m[1]}_${m[2]}${m[3]?'_'+m[3]:''}`); return await fetchPlaylist(m[1], m[2], m[3]||null); }
        const pathM = location.pathname.match(/\/(?:music\/)?(?:playlist|album)\/(-?\d+)_(\d+)(?:_([a-f0-9]+))?/);
        if(pathM){ logNet(`playlist from path ${pathM[1]}_${pathM[2]}${pathM[3]?'_'+pathM[3]:''}`); return await fetchPlaylist(pathM[1], pathM[2], pathM[3]||null); }
        if(kind.ownerId){
            state.sourceName = `👤 Треки профиля ${kind.ownerId}`;
            updateStateInfo();
            const out=[],seen=new Set();
            const push=t=>{if(t&&t.id&&!seen.has(t.id)){seen.add(t.id);out.push(t);}};
            let offset=0;
            for(let page=0;page<40;page++){
                let resp;
                try{resp=await vkApi('audio.get',{owner_id:kind.ownerId,count:100,offset});}
                catch(e){logErr(`owner ${kind.ownerId}: ${errStr(e)}`);break;}
                const items=resp?.items||[];
                if(!items.length)break;
                for(const it of items){const n=normalizeVkTrack(it);if(n)push(n);}
                if(items.length<100)break;
                offset+=100;
            }
            return out;
        }
        return await fetchMyAudios();
    }

    // ═══ DOWNLOAD ═══
    async function downloadOne(track,idx,total,mode){
        const title=track.title;
        const tT0=performance.now();
        logStep(`[${idx+1}/${total}] "${title.slice(0,50)}" [${mode}]`);

        resetStages();
        const curPanel=$('ymdl-cur'); if(curPanel)curPanel.style.display='block';
        setCurTitle(track.artist+' — '+title, idx, total);

        for(let attempt=1;attempt<=MAX_ATTEMPTS;attempt++){
            if(state.batchCancel)return;
            if(attempt>1){logWarn(`Попытка ${attempt}/${MAX_ATTEMPTS}`);await new Promise(r=>setTimeout(r,2000));}
            resetStages();

            try{
                setStage('dl', 3, '🔗 getById...');
                let trackUrl=track.url;
                if(!trackUrl){
                    try{
                        const resp=await vkApi('audio.getById',{audios:track.ownerId?`${track.ownerId}_${track.audioId}`:track.audioId});
                        const item=Array.isArray(resp)?resp[0]:(resp?.items?.[0]||resp);
                        if(item?.url&&isRealAudioUrl(item.url)){
                            trackUrl=item.url; track.url=item.url;
                            track.isHls=trackUrl.includes('.m3u8');
                        }
                    }catch(e){ logWarn(`getById: ${errStr(e)}`); }
                }
                if(!trackUrl)throw new Error('нет URL (Premium-only?)');

                let bytes, format;
                if(track.isHls || trackUrl.includes('.m3u8')){
                    const hlsStart = performance.now();
                    let totalSegBytes = 0;
                    bytes = await downloadHls(trackUrl, (done,tot,segBytes)=>{
                        totalSegBytes += segBytes;
                        const pct = 5 + 90*(done/tot);
                        const sec = (performance.now()-hlsStart)/1000;
                        const sp = sec > 0.3 ? (totalSegBytes/1048576/sec) : 0;
                        setStage('dl', pct, `${done}/${tot} · ${fmtBytes(totalSegBytes)} · ${fmtSpeed(sp)}`);
                    }, (m,k)=>{
                        if(k==='ok')logOk(m); else if(k==='warn')logWarn(m); else if(k==='err')logErr(m); else logDbg(m);
                    });
                    format='ts';
                    completeStage('dl', '✓ ' + fmtBytes(bytes.byteLength));
                    completeStage('dec', 'встроено');
                } else {
                    const tDl = performance.now();
                    const r = await gmRequest({
                        method:'GET', url:trackUrl, responseType:'arraybuffer', timeout:600000,
                        onprogress: e => {
                            if(!e.lengthComputable) return;
                            const sec = (performance.now()-tDl)/1000;
                            const sp = sec > 0.3 ? (e.loaded/1048576/sec) : 0;
                            const pct = 5 + 90*(e.loaded/e.total);
                            setStage('dl', pct, `${fmtBytes(e.loaded)}/${fmtBytes(e.total)} · ${fmtSpeed(sp)}`);
                        }
                    });
                    if(r.status!==200&&r.status!==206)throw new Error(`HTTP ${r.status}`);
                    bytes = new Uint8Array(r.response);
                    format='mp3';
                    if(bytes[0]===0x49&&bytes[1]===0x44&&bytes[2]===0x33)format='mp3';
                    else if(bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0)format='mp3';
                    else if(bytes[4]===0x66&&bytes[5]===0x74&&bytes[6]===0x79&&bytes[7]===0x70)format='m4a';
                    completeStage('dl', '✓ ' + fmtBytes(bytes.byteLength));
                    skipStage('dec', 'n/a');
                }

                const blob=new Blob([bytes]);
                const size=bytes.byteLength;
                const safeA=sanitizeName(track.artist||'unknown');
                const safeT=sanitizeName(track.title||'track');
                const filename=`${safeA} - ${safeT}.${format}`;

                let diskOk=false, diskPath=null;
                if((mode==='disk'||mode==='both') && state.yadiskToken){
                    setStage('disk', 2, 'получаю URL...');
                    let diskError = null;
                    try{
                        const up=await Yadisk.uploadTrack(track,blob,format, ev=>{
                            const pct = Math.max(2, ev.pct || 0);
                            const extra = ev.fake ? ' ⏳' : '';
                            const sizeTxt = ev.fake
                                ? fmtBytes(size) + extra
                                : `${fmtBytes(ev.loaded||0)}/${fmtBytes(ev.total||size)}${extra}`;
                            setStage('disk', pct, sizeTxt);
                        });
                        if(up.ok){
                            diskOk=true; diskPath=up.diskPath;
                            completeStage('disk','✓');
                            logDisk(`✅ ${diskPath}`);
                        } else {
                            diskError = up.error || 'unknown';
                            failStage('disk', diskError.slice(0,24));
                            logWarn(`Диск: ${diskError}`);
                        }
                    }catch(e){
                        diskError = errStr(e);
                        failStage('disk', 'error');
                        logWarn(`Диск: ${diskError}`);
                    }
                    if(!diskOk && mode === 'disk'){
                        throw new Error('Диск не сохранился: ' + (diskError || 'unknown'));
                    }
                } else {
                    skipStage('disk', (mode==='local')?'не нужен':'—');
                }

                if((mode==='local'||mode==='both') && state.keepLocal){
                    setStage('local', 30, 'сохраняю файл...');
                    try{
                        const url=URL.createObjectURL(blob);
                        const a=document.createElement('a');
                        a.href=url; a.download=filename;
                        document.body.appendChild(a); a.click();
                        setTimeout(()=>{a.remove();URL.revokeObjectURL(url);},5000);
                        completeStage('local', '✓');
                        logOk(`💾 ${filename} (${fmtBytes(size)})`);
                        if(state.saveTxt)saveTxtJson(track,size,format);
                        Sound.local();
                    }catch(e){
                        failStage('local', 'error');
                        logWarn(`local: ${errStr(e)}`);
                    }
                } else {
                    skipStage('local','—');
                }

                try{
                    const meta={id:track.id,title:track.title,artist:track.artist,size,
                        downloadedAt:Date.now(),filename,ext:format,
                        diskPath:diskPath||undefined,mode};
                    await dbAdd(STORE,meta);
                    state.downloadedIds.add(track.id);
                    state.downloadedMeta.set(track.id,meta);
                }catch(e){logWarn(`DB: ${errStr(e)}`);}

                state.batchBytesDone+=size;
                SAVINGS.add(size);
                const elapsed=((performance.now()-tT0)/1000).toFixed(1);
                logOk(`ГОТОВО · ${elapsed}s · ${fmtBytes(size)}${diskOk?' · ☁️':''}`);
                state.batchDone++;
                updateBatch();
                updateStateInfo();
                Sound.trackDone();
                GhState.schedule();
                return;
            }catch(e){
                const order = ['dl','dec','disk','local'];
                let failedOn = 'dl';
                for(const k of order){
                    const el = document.querySelector(`#ymdl-stages .ymdl-stage[data-stage="${k}"]`);
                    if(el && el.className.indexOf('active') !== -1){ failedOn = k; break; }
                }
                failStage(failedOn, '✕ ' + errStr(e).slice(0,20));
                if(attempt>=MAX_ATTEMPTS){
                    state.batchErrors++;
                    logErr(`"${title.slice(0,40)}" — ${errStr(e)}`);
                    updateBatch(); Sound.error();
                }
            }
        }
    }
    async function startBatch(mode){
        if(state.isBatch)return;
        if(state.selected.size===0){logWarn('Ничего не выбрано');Sound.error();return;}
        if((mode==='disk'||mode==='both')&&!state.yadiskToken){logErr('Не задан токен Диска');Sound.error();return;}
        const idxs=Array.from(state.selected).sort((a,b)=>a-b);
        const tracks=idxs.map(i=>state.allTracks[i]).filter(Boolean);
        Sound.batchStart();
        logStep(`▶ Батч [${mode}] · ${tracks.length} треков`);
        state.isBatch=true; state.batchCancel=false;
        state.batchErrors=0; state.batchDone=0;
        state.batchTotal=tracks.length;
        state.batchBytesDone=0; state.batchStartTime=performance.now();
        state.phase='downloading';
        state.currentMode=mode;
        const lp=$('ymdl-list-panel'); if(lp)lp.style.display='none';
        const bp=$('ymdl-batch'); if(bp)bp.style.display='block';
        const cp=$('ymdl-cur'); if(cp)cp.style.display='block';
        updateBatch(); updateListInfo();
        setStatus(`Скачивание [${mode}]...`);
        const bT0=performance.now();
        for(let i=0;i<tracks.length;i++){
            if(state.batchCancel){logWarn('Отменено');break;}
            await downloadOne(tracks[i],i,tracks.length,mode);
            if(i<tracks.length-1&&!state.batchCancel)await new Promise(r=>setTimeout(r,PAUSE_TRACKS));
        }
        logOk(`ЗАВЕРШЕНО · ${((performance.now()-bT0)/1000).toFixed(1)}s · ${fmtBytes(state.batchBytesDone)}`);
        logOk(`Успешно: ${state.batchDone}/${state.batchTotal}`);
        if(state.batchErrors)logErr(`Ошибок: ${state.batchErrors}`);
        setStatus(`Готово! ${state.batchDone}/${state.batchTotal}`,state.batchErrors?'warn':'ok');
        Sound.batchDone();
        GhState.schedule();
        state.isBatch=false; state.phase='done';
        const mb=$('ymdl-mini-badge'); if(mb)mb.style.display='none';
        updateListInfo(); updateStateInfo();
    }

    function saveTxtJson(track,size,ext){
        if(!state.saveTxt)return;
        const a=sanitizeName(track.artist||'unknown');
        const t=sanitizeName(track.title||'track');
        const sfx=` [${track.id}]`;
        const sep='═'.repeat(64);
        const L=[sep,`🎵 ${track.title}`,sep];
        L.push(`ID:        ${track.id}`);
        L.push(`Исполнитель: ${track.artist}`);
        if(track.album)L.push(`Альбом:    ${track.album}`);
        if(track.durationSec)L.push(`Длительность: ${track.durationSec}s`);
        if(state.sourceName && state.sourceName!=='—') L.push(`Источник:  ${state.sourceName}`);
        L.push(`Скачано:   ${new Date().toLocaleString('ru-RU')}`);
        L.push(''); L.push(sep); L.push(`© VK Music Downloader v${VERSION}`); L.push(sep);
        try{
            const blob=new Blob([L.join('\n')],{type:'text/plain;charset=utf-8'});
            const url=URL.createObjectURL(blob);
            const a2=document.createElement('a');
            a2.href=url; a2.download=`${a} - ${t}${sfx}.txt`;
            document.body.appendChild(a2); a2.click();
            setTimeout(()=>{a2.remove();URL.revokeObjectURL(url);},3000);
        }catch(e){}
    }

    async function prepareList(){
        if(state.isBatch)return;
        Sound.click();
        const lp=$('ymdl-list-panel'); if(lp)lp.style.display='block';
        const bp=$('ymdl-batch'); if(bp)bp.style.display='none';
        const cp=$('ymdl-cur'); if(cp)cp.style.display='none';
        state.selected.clear();
        const allBtn=$('ymdl-all'); if(allBtn)allBtn.disabled=true;
        setStatus('Проверка токена...');
        let tok = ensureToken();
        if(!tok){
            logWarn('VK токен не найден. Жду 3 сек...');
            setStatus('Ждём токен от VK...','warn');
            await new Promise(r=>setTimeout(r,3000));
            tok = ensureToken();
        }
        if(!tok){
            logErr('VK токен не найден. Жми 🔄 в шапке.');
            setStatus('Нет VK токена','err');
            if(allBtn)allBtn.disabled=false;
            Sound.error(); return;
        }
        logTok(`VK токен: ${tok.slice(0,20)}...`);
        const check = await vkApiCheck('users.get');
        if(!check.ok){
            state.tokenOk = false; state.tokenChecked = true;
            logErr(`Токен мёртв: ${check.err}`);
            setStatus('Токен протух — жми 🔄','err');
            updateStateInfo();
            if(allBtn)allBtn.disabled=false;
            Sound.error(); return;
        }
        state.tokenOk = true; state.tokenChecked = true;
        updateStateInfo();
        setStatus('Сбор треков...');
        try{
            let tracks=await fetchPageTracks();
            logStep(`📋 Источник: ${state.sourceName}`);
            const seen=new Set();
            tracks=tracks.filter(t=>t&&t.id&&!seen.has(t.id)&&seen.add(t.id));
            if(tracks.length===0){
                logWarn('Треков не найдено');
                setStatus('Нет треков','warn');
                if(allBtn)allBtn.disabled=false;
                Sound.error(); return;
            }
            state.allTracks=tracks;
            tracks.forEach((t,i)=>{if(!state.downloadedIds.has(t.id))state.selected.add(i);});
            renderList(tracks);
            setStatus(`Выбрано ${state.selected.size} из ${tracks.length}`,'ok');
            logOk(`📋 ${tracks.length} треков`);
            Sound.diag();
        }catch(e){
            logErr(`Ошибка: ${errStr(e)}`);
            setStatus('Ошибка','err');
            if(allBtn)allBtn.disabled=false;
            Sound.error();
        }
    }

    function applySettingsToUI(){
        const vt=$('ymdl-vt'); if(vt)vt.value=state.vkToken||'';
        const dt=$('ymdl-dt'); if(dt)dt.value=state.yadiskToken||'';
        const df=$('ymdl-df'); if(df)df.value=state.yadiskFolder||'Music';
        const gt=$('ymdl-gt'); if(gt)gt.value=state.ghToken||'';
        const gr=$('ymdl-gr'); if(gr)gr.value=state.ghRepo||'';
        const grp=$('ymdl-grp'); if(grp)grp.value=state.ghRepoPath||'';
        const iv=$('ymdl-iv'); if(iv)iv.value=state.ivMode||'seq';
        const cbt=$('cb-txt'); if(cbt)cbt.checked=state.saveTxt;
        const cba=$('cb-artist'); if(cba)cba.checked=state.createArtistFolder;
        const cbd=$('cb-disk'); if(cbd)cbd.checked=state.uploadDisk;
        const cbl=$('cb-local'); if(cbl)cbl.checked=state.keepLocal;
        const cbs=$('cb-sync'); if(cbs)cbs.checked=state.autoSync;
        const cbsnd=$('cb-sound'); if(cbsnd)cbsnd.checked=Sound.enabled;
        safeAddClass('t1','on',state.saveTxt);
        safeAddClass('t2','on',state.createArtistFolder);
        safeAddClass('t3','on',state.uploadDisk);
        safeAddClass('t4','on',state.keepLocal);
        safeAddClass('t5','on',state.autoSync);
        safeAddClass('t6','on',Sound.enabled);
        const snd=$('ymdl-snd'); if(snd)snd.textContent=Sound.enabled?'🔊':'🔇';
        updateStateInfo();
    }
    function readSettingsFromUI(){
        const vt=$('ymdl-vt'); if(vt&&vt.value.trim())state.vkToken=vt.value.trim();
        const dt=$('ymdl-dt'); if(dt)state.yadiskToken=dt.value.trim();
        const df=$('ymdl-df'); if(df)state.yadiskFolder=df.value.trim().replace(/^\/+|\/+$/g,'')||'Music';
        const gt=$('ymdl-gt'); if(gt)state.ghToken=gt.value.trim();
        const gr=$('ymdl-gr'); if(gr)state.ghRepo=gr.value.trim().replace(/^https?:\/\/github\.com\//,'').replace(/\/$/,'');
        const grp=$('ymdl-grp'); if(grp)state.ghRepoPath=grp.value.trim().replace(/^\//,'');
        const iv=$('ymdl-iv'); if(iv)state.ivMode=iv.value;
        const cbt=$('cb-txt'); if(cbt)state.saveTxt=cbt.checked;
        const cba=$('cb-artist'); if(cba)state.createArtistFolder=cba.checked;
        const cbd=$('cb-disk'); if(cbd)state.uploadDisk=cbd.checked;
        const cbl=$('cb-local'); if(cbl)state.keepLocal=cbl.checked;
        const cbs=$('cb-sync'); if(cbs)state.autoSync=cbs.checked;
        const cbsnd=$('cb-sound'); if(cbsnd)Sound.enabled=cbsnd.checked;
        state.resolvedDiskBase=null; state.resolvedDownloadsBase=null;
        Yadisk._folderCache=new Set();
    }
    function persistSettings(){
        if(state.vkToken)saveLS(LS.vkToken,state.vkToken);
        saveLS(LS.yadiskToken,state.yadiskToken);
        saveLS(LS.yadiskFolder,state.yadiskFolder);
        saveLS(LS.ghToken,state.ghToken);
        saveLS(LS.ghRepo,state.ghRepo);
        saveLS(LS.ghRepoPath,state.ghRepoPath);
        saveLS(LS.saveTxt,state.saveTxt?'true':'false');
        saveLS(LS.createArtistFolder,state.createArtistFolder?'true':'false');
        saveLS(LS.uploadDisk,state.uploadDisk?'true':'false');
        saveLS(LS.keepLocal,state.keepLocal?'true':'false');
        saveLS(LS.autoSync,state.autoSync?'true':'false');
        saveLS(LS.sound,Sound.enabled?'true':'false');
        saveLS(LS.ivMode,state.ivMode);
    }
    function applyMin(){
        const box=$('yamdl'),mini=$('yamdl-mini');
        if(!box||!mini)return;
        if(state.minimized){box.style.display='none';mini.style.display='flex';}
        else{box.style.display='flex';mini.style.display='none';}
        saveLS(LS.minimized,state.minimized?'1':'0');
    }

    safeOn('ymdl-snd',()=>{
        Sound.enabled=!Sound.enabled;
        const snd=$('ymdl-snd'); if(snd)snd.textContent=Sound.enabled?'🔊':'🔇';
        const cbs=$('cb-sound'); if(cbs)cbs.checked=Sound.enabled;
        safeAddClass('t6','on',Sound.enabled);
        saveLS(LS.sound,Sound.enabled?'true':'false');
        if(Sound.enabled)Sound.click();
        updateStateInfo();
    });
    safeOn('ymdl-min',()=>{state.minimized=true;applyMin();Sound.click();});
    safeOn('ymdl-mini',()=>{state.minimized=false;applyMin();Sound.click();});
    safeOn('ymdl-x',()=>{
        if(state.isBatch&&!confirm('Батч идёт. Закрыть?'))return;
        state.batchCancel=true;
        try{Sound.ctx?.close();}catch(e){}
        const b=$('yamdl'); if(b)b.remove();
        const m=$('yamdl-mini'); if(m)m.remove();
    });
    safeOn('ymdl-set',()=>{
        const p=$('ymdl-set-panel');
        if(p)p.style.display=p.style.display==='none'?'block':'none';
        Sound.click();
    });

    safeOn('ymdl-tok', async () => {
        Sound.click();
        logStep('🔄 Ищу живой токен...');
        let tok = TokenHunter.current || ensureToken();
        if(tok){
            state.vkToken = tok; saveLS(LS.vkToken, tok);
            logTok(`Проверяю: ${tok.slice(0,25)}...`);
            const check = await vkApiCheck('users.get', { fields: 'screen_name' });
            if(check.ok){
                state.tokenOk = true; state.tokenChecked = true;
                const u = Array.isArray(check.data) ? check.data[0] : check.data;
                if(u){
                    state.uid = String(u.id);
                    state.login = u.screen_name || u.first_name;
                    state.firstName = u.first_name; state.lastName = u.last_name;
                    logOk(`✅ Токен живой: ${u.first_name} ${u.last_name}`);
                } else logOk('✅ Токен живой');
                Sound.token(); updateStateInfo();
                return;
            }
            state.tokenOk = false; state.tokenChecked = true;
            updateStateInfo();
            logWarn(`Токен протух: ${check.err}`);
        }
        const go = confirm('🔑 Живой VK токен не найден.\n\nПерейти на vk.ru/audios, чтобы VK сделал запросы и я перехватил токен?');
        if(!go) return;
        logStep('🧭 Переход на /audios...');
        TokenHunter.current = null; state.vkToken = '';
        try{ W.localStorage.removeItem(LS.vkToken); }catch(e){}
        W.location.href = 'https://vk.ru/audios' + (state.uid || '');
    });

    safeOn('ymdl-save',async()=>{
        readSettingsFromUI(); persistSettings();
        logOk('Настройки сохранены'); Sound.save(); updateStateInfo();
    });
    safeOn('ymdl-probe',()=>{state.cryptoScheme=null;log('🔬 Схема AES сброшена','#fbbf24');Sound.diag();});
    safeOn('ymdl-tvk',async()=>{
        readSettingsFromUI(); persistSettings();
        const tok = ensureToken();
        if(!tok){logErr('Нет токена');return;}
        logStep('Проверяю VK токен...');
        const check = await vkApiCheck('users.get',{fields:'screen_name'});
        if(check.ok){
            state.tokenOk = true; state.tokenChecked = true;
            const u = Array.isArray(check.data) ? check.data[0] : check.data;
            if(u){
                state.uid = String(u.id);
                state.login = u.screen_name || u.first_name;
                state.firstName = u.first_name; state.lastName = u.last_name;
                logOk(`VK OK: ${u.first_name} ${u.last_name}`);
            }
            Sound.diag();
        } else { state.tokenOk = false; state.tokenChecked = true; logErr(`VK: ${check.err}`); }
        updateStateInfo();
    });
    safeOn('ymdl-td',async()=>{
        readSettingsFromUI(); persistSettings();
        if(!state.yadiskToken){logErr('Нет токена');return;}
        logDisk('Проверяю Диск...');
        try{
            const r=await withTimeout(Yadisk.request('GET',`${YADISK_API}/`),12000);
            if(r.status===200){
                const d=JSON.parse(r.responseText);
                logDisk(`✅ ${d.user?.display_name||d.user?.login} · ${fmtBytes(d.free_space)} free`);
                const base=await Yadisk.findBaseFolder();
                const dl=await Yadisk.findDownloadsFolder(base);
                logDisk(`📂 /${base}/${dl}/${new Date().getFullYear()}/`);
                Sound.cloudDone();
            }else logErr(`Диск HTTP ${r.status}`);
        }catch(e){logErr(`Диск: ${errStr(e)}`);}
    });
    safeOn('ymdl-tg',async()=>{readSettingsFromUI();persistSettings();const ok=await GhState.test();if(ok)Sound.github();});
    safeOn('ymdl-sync',async()=>{
        readSettingsFromUI(); persistSettings();
        if(!state.ghToken||!state.ghRepo||!state.ghRepoPath){logErr('Задай токен/репо/путь');return;}
        await GhState.save(); updateStateInfo();
    });
    safeOn('ymdl-tsound',()=>{
        logStep('🎼 Тест звуков');
        Sound.diag();
        setTimeout(()=>Sound.start(),300);
        setTimeout(()=>Sound.trackDone(),1000);
        setTimeout(()=>Sound.cloud(),1600);
        setTimeout(()=>Sound.cloudDone(),2200);
        setTimeout(()=>Sound.local(),2900);
        setTimeout(()=>Sound.github(),4100);
        setTimeout(()=>Sound.warn(),4600);
        setTimeout(()=>Sound.error(),5600);
        setTimeout(()=>Sound.batchStart(),6400);
        setTimeout(()=>Sound.batchDone(),7400);
        setTimeout(()=>Sound.complete(),8600);
    });
    ['cb-txt','cb-artist','cb-disk','cb-local','cb-sync','cb-sound'].forEach(id=>{
        safeChange(id,()=>{ readSettingsFromUI(); persistSettings(); applySettingsToUI(); GhState.schedule(); Sound.click(); });
    });
    safeChange('ymdl-iv',()=>{
        const iv=$('ymdl-iv'); if(iv)state.ivMode=iv.value;
        saveLS(LS.ivMode,state.ivMode);
        state.cryptoScheme=null;
        logOk(`IV режим: ${state.ivMode} · схема сброшена`);
        updateStateInfo(); Sound.click();
    });

    safeOn('ymdl-loc',()=>{Sound.click();startBatch('local');});
    safeOn('ymdl-dsk',()=>{Sound.click();startBatch('disk');});
    safeOn('ymdl-bth',()=>{Sound.click();startBatch('both');});
    safeOn('ymdl-stop',()=>{Sound.warn();state.batchCancel=true;logWarn('⏹ Стоп...');});

    safeOn('ymdl-all',()=>{
        if(state.phase==='done'){state.phase='idle';state.selected.clear();const l=$('ymdl-list');if(l)l.innerHTML='';}
        prepareList();
    });
    safeOn('ymdl-sa',()=>{state.allTracks.forEach((t,i)=>state.selected.add(i));renderList(state.allTracks);Sound.click();});
    safeOn('ymdl-sn',()=>{state.selected.clear();renderList(state.allTracks);Sound.click();});
    safeOn('ymdl-fn',()=>{
        state.filterOnlyNew=!state.filterOnlyNew;
        safeAddClass('ymdl-fn','active',state.filterOnlyNew);
        renderList(state.allTracks); Sound.click();
    });

    TokenHunter.onToken((tok)=>{
        if(tok === state.vkToken) return;
        state.vkToken = tok; state.tokenOk = true; state.tokenChecked = false;
        logTok(`🕸️ Перехвачен живой токен: ${tok.slice(0,25)}...`);
        Sound.token(); updateStateInfo();
        setTimeout(async ()=>{
            const check = await vkApiCheck('users.get',{fields:'screen_name'});
            if(check.ok){
                state.tokenOk = true; state.tokenChecked = true;
                const u = Array.isArray(check.data) ? check.data[0] : check.data;
                if(u){
                    state.uid = String(u.id);
                    state.login = u.screen_name || u.first_name;
                    state.firstName = u.first_name; state.lastName = u.last_name;
                    logOk(`✅ Токен подтверждён: ${u.first_name} ${u.last_name}`);
                }
                setStatus('Готов к загрузке','ok'); Sound.diag();
            } else {
                state.tokenOk = false; state.tokenChecked = true;
                logWarn(`Перехвачен, но не работает: ${check.err}`);
            }
            updateStateInfo();
        }, 500);
    });

    let _lastPath=location.pathname+location.search;
    setInterval(()=>{
        const cur=location.pathname+location.search;
        if(cur!==_lastPath){
            _lastPath=cur;
            if(state.phase!=='downloading'){
                log(`📍 ${location.pathname}${location.search}`,'rgba(255,255,255,.4)');
                if(state.phase==='list'||state.phase==='done'){
                    state.phase='idle'; state.allTracks=[]; state.selected.clear();
                    const l=$('ymdl-list'); if(l)l.innerHTML='';
                    const lp=$('ymdl-list-panel'); if(lp)lp.style.display='none';
                }
            }
        }
    },500);

    // ═══ BOOT ═══
    logBoot(`VK Music Downloader v${VERSION}`);
    logBoot(`host = ${location.host}`);
    loadSettings();
    SAVINGS.load();
    applySettingsToUI();
    updateStateInfo();
    if(state.vkToken) TokenHunter.current = state.vkToken;

    const bootWatchdog=setTimeout(()=>{
        const s=$('ymdl-stat')?.textContent||'';
        if(s.includes('Инициализация')) setStatus('Boot завис','err');
    },25000);

    (async()=>{
        try{
            state.bootStep='dbInit';
            logBoot('[boot] 1/4: IndexedDB...');
            try{await withTimeout(dbInit(),10000);logOk('[boot] IndexedDB OK');}
            catch(e){logWarn(`[boot] IndexedDB: ${errStr(e)}`);}

            state.bootStep='dbGetAll';
            logBoot('[boot] 2/4: чтение БД...');
            try{
                const all=await withTimeout(dbGetAll(STORE),11000);
                state.downloadedIds.clear(); state.downloadedMeta.clear();
                for(const rec of all){ state.downloadedIds.add(String(rec.id)); state.downloadedMeta.set(String(rec.id),rec); }
                logOk(`[boot] ${all.length} скачанных`);
            }catch(e){logWarn(`[boot] dbGetAll: ${errStr(e)}`);}

            state.bootStep='vk';
            logBoot('[boot] 3/4: VK токен...');
            const tok=ensureToken();
            if(tok){
                logTok(`[boot] Токен: ${tok.slice(0,20)}...`);
                const check = await vkApiCheck('users.get',{fields:'screen_name'});
                if(check.ok){
                    state.tokenOk = true; state.tokenChecked = true;
                    const uu = Array.isArray(check.data) ? check.data[0] : check.data;
                    if(uu){
                        state.uid=String(uu.id); state.login=uu.screen_name||uu.first_name;
                        state.firstName=uu.first_name; state.lastName=uu.last_name;
                        logOk(`[boot] ✅ ${uu.first_name} ${uu.last_name}`);
                    }
                    setStatus('Готов к загрузке','ok'); Sound.diag();
                } else {
                    state.tokenOk = false; state.tokenChecked = true;
                    logWarn(`[boot] Токен протух (${check.err})`);
                    logWarn('[boot] Жми 🔄 в шапке');
                    setStatus('Токен протух — жми 🔄','warn');
                }
            }else{
                logWarn('[boot] VK токен не найден. Жми 🔄');
                setStatus('Ждём токен — жми 🔄','warn');
            }
            updateStateInfo();

            state.bootStep='github';
            logBoot('[boot] 4/4: GitHub...');
            if(state.ghToken&&state.ghRepo&&state.ghRepoPath){
                try{
                    const ok=await withTimeout(GhState.test(),15000);
                    if(ok){
                        const loaded=await withTimeout(GhState.load(),15000);
                        if(loaded)try{await withTimeout(GhState.save(),15000);}catch(e){}
                        updateStateInfo();
                    }
                }catch(e){logWarn(`[boot] GitHub: ${errStr(e)}`);}
            }

            state.bootStep='done';
            logBoot('[boot] готов ✅');
            clearTimeout(bootWatchdog);
        }catch(e){
            logErr(`[boot] FATAL "${state.bootStep}": ${errStr(e)}`);
            setStatus(`Boot ошибка`,'err');
            clearTimeout(bootWatchdog);
        }
    })();

    console.log(`%c✅ VK Music Downloader v${VERSION}`, 'color:#4ade80;font-weight:bold;font-size:14px;');
    console.log(`%c💡 v2.0: GM-upload + fake-progress · 2 бара · 4 фазы · Диск теперь сохраняется`, 'color:#ffdb4d;font-weight:bold;');
})();