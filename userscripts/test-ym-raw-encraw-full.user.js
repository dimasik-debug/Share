// ==UserScript==
// @name         TEST YM RAW+ENCRAW full
// @namespace    dimasik-debug
// @version      8.0
// @description  Полный цикл: raw и encraw раздельно, скачивание + AES decrypt
// @author       Neurosha
// @match        https://music.yandex.ru/*
// @match        https://music.yandex.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_addStyle
// @grant        GM_openInTab
// @grant        GM_setClipboard
// @grant        GM_download
// @grant        GM_info
// @grant        unsafeWindow
// @run-at       document-idle
// ==/UserScript==

/* Converted by Neurosha · 2026-09-22T16:37:10.649Z */

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
// @name         TEST YM RAW+ENCRAW full
// @namespace    dimasik-debug
// @version      8.0
// @description  Полный цикл: raw и encraw раздельно, скачивание + AES decrypt
// @author       Neurosha
// @match        https://music.yandex.ru/*
// @match        https://music.yandex.com/*
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// ==/UserScript==

/* Converted by Neurosha · 2026-09-20T18:17:59.290Z */

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

/* Converted by Neurosha · 2026-09-20T11:09:00.392Z */

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
// @name         TEST YM RAW+ENCRAW full
// @namespace    ymtest
// @version      8.0
// @description  Полный цикл: raw и encraw раздельно, скачивание + AES decrypt
// @match        https://music.yandex.ru/*
// @match        https://music.yandex.com/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      *
// ==/UserScript==

(function() {
    'use strict';

    const TRACK_ID = '155398253';
    const ALBUM_ID = '43799705';
    const QUALITY = 'nq';
    const CODECS = 'flac,aac,he-aac,mp3,flac-mp4,aac-mp4,he-aac-mp4';
    const SECRET = '7tvSmFbyf5hJnIHhCimDDD';

    const MAX_ROUNDS = 10;
    const PAUSE_ROUND = 5000;
    const PAUSE_BIG = 15000;

    document.body.insertAdjacentHTML('beforeend', `
        <div id="ymtest" style="position:fixed;bottom:20px;right:20px;z-index:2147483647;background:#000;color:#fff;
            font-family:'Segoe UI',sans-serif;font-size:12px;border-radius:12px;padding:16px;width:560px;
            border:1px solid rgba(255,255,255,0.15);box-shadow:0 16px 48px rgba(0,0,0,0.9);">
            <div style="font-weight:bold;font-size:14px;margin-bottom:10px;color:#ffdb4d;">🎯 Track ${TRACK_ID} · full cycle</div>
            <div style="display:flex;gap:6px;margin-bottom:10px;">
                <button id="ymtest-raw" style="flex:1;padding:12px;background:#4ade80;color:#000;
                    border:none;border-radius:8px;cursor:pointer;font-weight:bold;">▶ RAW</button>
                <button id="ymtest-encraw" style="flex:1;padding:12px;background:#a78bfa;color:#fff;
                    border:none;border-radius:8px;cursor:pointer;font-weight:bold;">▶ ENCRAW</button>
            </div>
            <div id="ymtest-log" style="padding:10px;background:rgba(0,0,0,0.6);
                border-radius:6px;font-size:10px;line-height:1.5;max-height:500px;overflow-y:auto;color:#ccc;
                white-space:pre-wrap;word-break:break-all;border:1px solid rgba(255,255,255,0.08);"></div>
        </div>
    `);

    const logEl = document.getElementById('ymtest-log');
    function L(msg, color = '#ccc') {
        const line = document.createElement('div');
        line.style.color = color;
        line.textContent = msg;
        logEl.appendChild(line);
        logEl.scrollTop = logEl.scrollHeight;
        console.log(msg);
    }

    function uuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }

    async function genSign(base) {
        const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(base));
        let b64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
        return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    function buildHeaders() {
        return {
            'accept': '*/*',
            'accept-language': 'ru',
            'x-request-id': uuid(),
            'x-requested-with': 'XMLHttpRequest',
            'x-retpath-y': `https://music.yandex.ru/album/${ALBUM_ID}`,
            'x-yandex-music-client': 'YandexMusicWebNext/1.0.0',
            'x-yandex-music-multi-auth-user-id': (window.__ymUid || ''),
            'x-yandex-music-without-invocation-info': '1'
        };
    }

    async function getUid() {
        if (window.__ymUid) return window.__ymUid;
        try {
            const r = await fetch('https://api.music.yandex.ru/account/status', { credentials: 'include' });
            const d = await r.json();
            const uid = d?.result?.account?.uid;
            if (uid) { window.__ymUid = String(uid); return window.__ymUid; }
        } catch(e) {}
        return null;
    }

    // ========== один запрос get-file-info с заданным транспортом ==========
    async function tryOnce(transport) {
        const ts = Math.floor(Date.now() / 1000);
        const codecsNoComma = CODECS.replace(/,/g, '');
        const base = `${ts}${TRACK_ID}${QUALITY}${codecsNoComma}${transport}`;
        const sign = await genSign(base);
        const url = `https://api.music.yandex.ru/get-file-info?ts=${ts}&trackId=${TRACK_ID}&quality=${QUALITY}&codecs=${encodeURIComponent(CODECS)}&transports=${transport}&sign=${sign}`;

        try {
            const r = await fetch(url, { credentials: 'include', headers: buildHeaders() });
            if (r.status !== 200) return { ok: false, status: r.status };
            const d = await r.json();
            const info = d.downloadInfo || d.result?.downloadInfo || d.result;
            if (info?.urls?.length) return { ok: true, info };
            return { ok: false, status: 200, reason: 'no-urls' };
        } catch(e) {
            return { ok: false, status: 0, error: e.message };
        }
    }

    // ========== retry с конкретным транспортом ==========
    async function getFileInfoWithRetry(transport) {
        const t0 = performance.now();
        for (let round = 1; round <= MAX_ROUNDS; round++) {
            L(`  round ${round}/${MAX_ROUNDS}: ${transport}...`, '#888');
            const r = await tryOnce(transport);
            if (r.ok) {
                const dt = ((performance.now() - t0) / 1000).toFixed(1);
                L(`  ✅ ${transport} round ${round} (${dt}s)`, '#4ade80');
                return { ok: true, info: r.info, round, seconds: dt };
            }
            L(`  ✗ ${transport} → HTTP ${r.status}`, '#fbbf24');

            if (round < MAX_ROUNDS) {
                const waitMs = round <= 2 ? PAUSE_ROUND : PAUSE_BIG;
                L(`  ⏳ пауза ${(waitMs/1000).toFixed(0)}s...`, '#888');
                await new Promise(res => setTimeout(res, waitMs));
            }
        }
        return { ok: false };
    }

    // ========== скачивание CDN через GM ==========
    function gmGet(url, onProgress) {
        return new Promise((resolve, reject) => {
            let lastTick = 0;
            const t0 = performance.now();
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                responseType: 'arraybuffer',
                timeout: 300000,
                onprogress: (e) => {
                    const now = performance.now();
                    if (e.lengthComputable && onProgress && now - lastTick > 500) {
                        lastTick = now;
                        const sec = (now - t0) / 1000;
                        const speed = sec > 0 ? (e.loaded / 1048576 / sec) : 0;
                        const pct = e.total > 0 ? (e.loaded / e.total * 100) : 0;
                        onProgress(e.loaded, e.total, speed, pct);
                    }
                },
                onload: resolve,
                onerror: (err) => reject(new Error('GM: ' + JSON.stringify(err))),
                ontimeout: () => reject(new Error('timeout')),
                onabort: () => reject(new Error('abort'))
            });
        });
    }

    // ========== AES-CTR расшифровка ==========
    function hexToBytes(hex) {
        const out = new Uint8Array(hex.length / 2);
        for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
        return out;
    }
    function bigEndianCounter(val) {
        const b = new Uint8Array(16);
        let v = BigInt(val);
        for (let i = 15; i >= 0; i--) { b[i] = Number(v & 0xffn); v >>= 8n; }
        return b;
    }
    async function tryDecrypt(data, keyHex) {
        const keyBytes = hexToBytes(keyHex);
        // расширенный список инициализаций
        const inits = [0, 1, 2, 16, 256, 65536, 16777216, 4294967296];
        for (const init of inits) {
            try {
                const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-CTR' }, false, ['decrypt']);
                const dec = await crypto.subtle.decrypt({ name: 'AES-CTR', counter: bigEndianCounter(init), length: 128 }, key, data);
                const h = new Uint8Array(dec.slice(0, 16));
                const isFtyp = h[4] === 0x66 && h[5] === 0x74 && h[6] === 0x79 && h[7] === 0x70;
                const isId3 = h[0] === 0x49 && h[1] === 0x44 && h[2] === 0x33;
                const isMp3 = h[0] === 0xff && (h[1] & 0xe0) === 0xe0;
                const isFlac = h[0] === 0x66 && h[1] === 0x4c && h[2] === 0x61 && h[3] === 0x63;
                const isOgg = h[0] === 0x4f && h[1] === 0x67 && h[2] === 0x67 && h[3] === 0x53;
                if (isFtyp) return { buf: dec, type: 'm4a', init };
                if (isId3 || isMp3) return { buf: dec, type: 'mp3', init };
                if (isFlac) return { buf: dec, type: 'flac', init };
                if (isOgg) return { buf: dec, type: 'ogg', init };
            } catch(e) {}
        }
        return null;
    }

    function detectFormat(bytes) {
        if (bytes.length < 16) return 'unknown';
        if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return 'mp3';
        if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return 'mp3';
        if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return 'm4a';
        if (bytes[0] === 0x66 && bytes[1] === 0x6c && bytes[2] === 0x61 && bytes[3] === 0x63) return 'flac';
        if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return 'ogg';
        return 'unknown';
    }

    // ========== полный цикл с одним транспортом ==========
    async function runFullCycle(transport) {
        logEl.innerHTML = '';
        L(`═══ FULL CYCLE: ${transport.toUpperCase()} ═══`, transport === 'raw' ? '#4ade80' : '#a78bfa');

        const uid = await getUid();
        L(`uid: ${uid}  trackId: ${TRACK_ID}  albumId: ${ALBUM_ID}\n`, '#888');

        // 1. get-file-info с retry
        L(`[1/3] get-file-info с retry...`, '#ffcc00');
        const result = await getFileInfoWithRetry(transport);
        if (!result.ok) {
            L(`\n❌ ${transport}: не удалось за ${MAX_ROUNDS} раундов`, '#f87171');
            return;
        }

        const info = result.info;
        L(`\n  codec: ${info.codec}`, '#aaa');
        L(`  bitrate: ${info.bitrate}kbps`, '#aaa');
        L(`  urls: ${info.urls.length}`, '#aaa');
        L(`  key: ${info.key || 'НЕТ (файл не зашифрован)'}`, info.key ? '#fbbf24' : '#4ade80');

        const cdnUrl = info.urls[0];
        const isCrypt = cdnUrl.includes('/crypt/') || cdnUrl.includes('/music-v2/crypt');
        L(`  url: ${cdnUrl.slice(0, 130)}...`, '#888');
        L(`  path: ${isCrypt ? '🔐 /crypt/' : '📦 /raw/'}`, isCrypt ? '#ff8c00' : '#4ade80');

        // 2. Скачивание
        L(`\n[2/3] скачивание CDN...`, '#ffcc00');
        const t0 = performance.now();
        const resp = await gmGet(cdnUrl, (loaded, total, speed, pct) => {
            const bucket = Math.floor(pct / 25) * 25;
            if (bucket !== (runFullCycle._lastBucket || -1)) {
                runFullCycle._lastBucket = bucket;
                L(`  ⬇ ${Math.round(pct)}% · ${(loaded/1048576).toFixed(2)}/${(total/1048576).toFixed(2)} MB · ${speed.toFixed(2)} MB/s`, '#888');
            }
        });
        runFullCycle._lastBucket = -1;

        if (resp.status !== 200 && resp.status !== 206) {
            L(`  ❌ CDN HTTP ${resp.status}`, '#f87171');
            return;
        }

        let bytes = new Uint8Array(resp.response);
        L(`  📦 ${(bytes.length/1048576).toFixed(2)} MB`, '#4ade80');

        const headHex = Array.from(bytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
        L(`  hex head: ${headHex}`, '#aaa');

        // 3. Определение формата + расшифровка
        L(`\n[3/3] определение формата...`, '#ffcc00');
        let format = detectFormat(bytes);
        L(`  detected: ${format}`, format === 'unknown' ? '#fbbf24' : '#4ade80');

        if (format === 'unknown') {
            if (!info.key) {
                L(`  ❌ Формат неизвестен и ключа нет — трек не восстановить`, '#f87171');
                return;
            }

            L(`  🔐 Пробую AES-CTR decrypt...`, '#ffcc00');
            const dec = await tryDecrypt(bytes, info.key);
            if (!dec) {
                L(`  ❌ AES-CTR не сработал ни с одним counter (0,1,2,16,256,65536,16M,4G)`, '#f87171');
                L(`  Возможно нужен другой режим (CBC/GCM) или ключ в другом формате`, '#f87171');
                return;
            }
            bytes = new Uint8Array(dec.buf);
            format = dec.type;
            L(`  ✅ Расшифровано (init=${dec.init}) → ${format}`, '#4ade80');
        }

        // Сохранение
        const filename = `test_${transport}_${TRACK_ID}.${format}`;
        const blob = new Blob([bytes]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 5000);

        const dt = ((performance.now() - t0) / 1000).toFixed(1);
        L(`\n🎉🎉🎉 УСПЕХ! 🎉🎉🎉`, '#4ade80');
        L(`📁 ${filename} (${(bytes.length/1048576).toFixed(2)} MB) за ${dt}s`, '#4ade80');
        L(`Транспорт: ${transport} · раунд ${result.round} (${result.seconds}s до get-file-info)`, '#4ade80');
        L(`Кодек: ${info.codec}@${info.bitrate}kbps`, '#4ade80');
        if (info.key) L(`🔐 Файл был зашифрован и расшифрован`, '#4ade80');
        else L(`📦 Файл не зашифрован`, '#4ade80');
    }

    document.getElementById('ymtest-raw').onclick = () => runFullCycle('raw');
    document.getElementById('ymtest-encraw').onclick = () => runFullCycle('encraw');

    L('🚀 Нажми RAW или ENCRAW для полного цикла', '#ffdb4d');
    L(`Track ${TRACK_ID} · retry до ${MAX_ROUNDS} раундов, паузы 5/15s`, '#888');
    L(`Проверь оба варианта — увидим что отдаёт Яндекс для этого трека`, '#888');
})();