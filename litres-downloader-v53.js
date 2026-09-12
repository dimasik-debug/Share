/**
 * LitRes Downloader v53.0 — MULTIMEDIA + PDF FIX
 * 🎵 Аудио: MP3, M4B, M4A, FLAC, OGG, WAV
 * 🎬 Видео: MP4, WEBM, MKV
 * 📚 Книги: ZIP, PDF, FB2, EPUB, TXT, MOBI
 * 📕 PDF постранично: JPG/GIF → ZIP
 * 📕 PDF прямой (pdfjs/*.js + fname=*.pdf) → скачивание ✅ FIX v53
 * 🔍 Универсальный детект через magic bytes
 * ⚡ Range-проверка 000.js (2.5с) + fallback с прогрессом
 * 📊 Прогресс-бар · 🚀 Автостарт · 🗕 Minimize · 🔊 Звуки
 * (c) 2026 Diminssoft
 */

(function fullDownloaderV53() {
    console.log('%c🚀 LitRes Downloader v53.0', 'color:#4a8af4;font-size:16px;font-weight:bold;');
    document.getElementById('litres_downloader_ui')?.remove();
    document.getElementById('litres_mini')?.remove();

    // 🧹 Автоочистка
    ['litres-downloader.js','litres-downloader-v29.js','litres-downloader-v30.js','litres-downloader-v31.js',
     'litres-downloader-v32.js','litres-downloader-v33.js','litres-downloader-v34.js','litres-downloader-v35.js',
     'litres-downloader-v36.js','litres-downloader-v37.js','litres-downloader-v38.js','litres-downloader-v40.js',
     'litres-downloader-v40.7.js','litres-downloader-v42.js','litres-downloader-v43.js','litres-downloader-v44.js',
     'litres-downloader-v45.js','litres-downloader-v46.js','litres-downloader-v47.js','litres-downloader-v48.js',
     'litres-downloader-v49.js','litres-downloader-v50.js','litres-downloader-v51.js','litres-downloader-v52.js'
    ].forEach(f => fetch('https://purge.jsdelivr.net/gh/dimasik-debug/Share@main/' + f, { mode: 'no-cors' }).catch(()=>{}));

    const S = 1.25;
    const px = v => `${Math.round(v * S * 100) / 100}px`;

    // ═══ 🔊 SOUND ═══
    const Sound = {
        ctx:null, enabled:true, masterGain:null,
        init(){ if(this.ctx) return; try{ this.ctx=new (window.AudioContext||window.webkitAudioContext)(); this.masterGain=this.ctx.createGain(); this.masterGain.gain.value=0.35; this.masterGain.connect(this.ctx.destination);}catch(e){this.enabled=false;} },
        note(f,d=0.35,v=0.15,delay=0,type='sine'){ if(!this.enabled) return; this.init(); if(!this.ctx) return; try{ if(this.ctx.state==='suspended') this.ctx.resume(); const t=this.ctx.currentTime+delay; const o=this.ctx.createOscillator(),g=this.ctx.createGain(),fl=this.ctx.createBiquadFilter(); fl.type='lowpass'; fl.frequency.value=3500; fl.Q.value=0.7; o.type=type; o.frequency.setValueAtTime(f,t); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v,t+0.04); g.gain.setValueAtTime(v,t+d*0.6); g.gain.exponentialRampToValueAtTime(0.0001,t+d); o.connect(fl); fl.connect(g); g.connect(this.masterGain); o.start(t); o.stop(t+d+0.05); }catch(e){} },
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
        warn(){ this.note(440,0.2,0.07,0,'triangle'); this.note(349,0.3,0.06,0.1,'triangle'); }
    };

    // ═══ 🛡️ Защита ═══
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
    HTMLElement.prototype.click = function(){ if(isForbiddenClick(this)) return; return _oc.apply(this,arguments); };
    document.addEventListener('click', e => { const t=e.target.closest('button, [role="button"], a'); if(!t) return; if(isForbiddenClick(t)){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); return false; } }, true);

    // ═══ CONFIG ═══
    const TOOLS_URLS = ['https://cdn.jsdelivr.net/gh/dimasik-debug/Share@main/x64.rar','https://raw.githubusercontent.com/dimasik-debug/Share/main/x64.rar'];
    const TOOLS_PATH = 'tools/x64.rar';
    const GITHUB = { repo:'dimasik-debug/Share', path:'books/progress/', token: localStorage.getItem('github_token')||'' };
    const SOUND_KEY='litres_sound_enabled', MINI_KEY='litres_minimized', AUTOSTART_KEY='litres_autostart';

    function askForGitHubToken(){ const t=prompt('🔑 GitHub Personal Access Token:',localStorage.getItem('github_token')||''); if(t&&t.trim()){ GITHUB.token=t.trim(); localStorage.setItem('github_token',t.trim()); return true; } return false; }
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

    // ═══ JSZip ═══
    const jzScript = document.createElement('script');
    jzScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    document.head.appendChild(jzScript);
    let JSZipLoaded = false;
    jzScript.onload = () => { JSZipLoaded = true; console.log('✅ JSZip'); };

    // ═══ URL / Session ═══
    const urlParams = new URLSearchParams(window.location.search);
    let fileId = urlParams.get('file');
    let artId = urlParams.get('art');
    let pageType = 'unknown';
    if(fileId && artId) pageType='reader';
    else { const m=window.location.pathname.match(/-(\d+)\/?$/); if(m){ artId=m[1]; fileId=null; pageType='book'; } }
    if(!artId){ alert('❌ Не нашёл artId'); return; }

    function getCookie(n){ const v=`; ${document.cookie}`; const p=v.split(`; ${n}=`); return p.length===2?p.pop().split(';').shift():null; }
    let sessionData = { sessionId:getCookie('SID')||'', supersid:getCookie('supersid')||'' };
    function updateSession(){ const s=getCookie('SID'), ss=getCookie('supersid'); if(s) sessionData.sessionId=s; if(ss) sessionData.supersid=ss; }
    function getHeaders(){ return { 'accept':'application/json, text/plain, */*','accept-language':'ru,en;q=0.9','accept-version':'2','app-id':'115','client-host':'www.litres.ru','session-id':sessionData.sessionId,'supersid':sessionData.supersid,'ui-currency':'RUB','ui-language-code':'ru','x-request-id':Date.now().toString(36)+Math.random().toString(36).substring(2) }; }

    let bookInfo = { title:'Неизвестная книга', author:'Неизвестный автор', pages:0, fileId:fileId, artId:artId, format:null, isAudio:false };

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
        if(m.includes('mobi')) return { icon:'📘', name:'MOBI' };
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
            bookInfo.fileId=p.release_file_id||fileId;
            bookInfo.artId=p.id||artId;
            console.log(`✅ "${bookInfo.title}" (${bookInfo.pages} ${bookInfo.isAudio?'сек':'стр.'})`);
            return true;
        }catch(e){ console.error('❌',e); return false; }
    }

    async function fetchUserInfo(){
        try{
            const r=await fetchWithTimeout(`https://api.litres.ru/foundation/api/users/me/detailed`,{credentials:'include',headers:getHeaders()},10000);
            if(!r.ok) return null;
            const d=await r.json(); const p=d?.payload?.data; if(!p) return null;
            const sub=p.subscription||{}, acc=p.account||{}, prof=p.profile||{}, loyalty=p.loyalty||{}, bi=loyalty.bonuses_info||{};
            return { id:p.id, login:p.login, email:prof.email||null, isEmailConfirmed:prof.is_email_confirmed||false,
                subscription:sub.is_active?{ isTrial:sub.is_trial_period||false, validTill:sub.valid_till, planName:sub.plan_name||null, autoRenew:sub.prolongation_status==='enabled', price:sub.price||null }:null,
                account:{display:acc.display||0,real:acc.real||0,bonus:acc.bonus||0},
                loyalty:loyalty.is_loyalty_user?{cashbackPercent:bi.current_cashback_percent||0,purchaseForNext:bi.purchase_amount_for_next_level||0}:null };
        }catch(e){ return null; }
    }

    // ═══ 🔍 ДЕТЕКТ BLOB ПО MAGIC BYTES ═══
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

    function isMultimediaType(type){ return ['audio-mp3','audio-m4b','audio-m4a','audio-flac','audio-ogg','audio-wav','video-mp4','video-webm'].includes(type); }

    // ═══ 📊 DOWNLOAD WITH PROGRESS ═══
    async function downloadWithProgress(url, opts={}, label='файла', expectedTypes=null){
        const ctrl = new AbortController();
        const hardTimeout = setTimeout(()=>ctrl.abort(), 600000);
        const t0 = performance.now();
        try{
            const r = await fetch(url, {...opts, signal:ctrl.signal});
            if(!r.ok){ clearTimeout(hardTimeout); return null; }
            const total = parseInt(r.headers.get('content-length')||'0', 10);
            if(!r.body || !r.body.getReader){
                const blob = await r.blob();
                clearTimeout(hardTimeout);
                if(expectedTypes){
                    const info = await detectBlobType(blob);
                    if(!expectedTypes.includes(info.type)){ console.log(`⚠️ ${label}: тип ${info.type} не подходит`); return null; }
                }
                return blob;
            }
            const reader = r.body.getReader();
            const chunks = [];
            let loaded=0, lastUpdate=0, lastPct=0;
            const speedSamples = [];
            while(true){
                const { done, value } = await reader.read();
                if(done) break;
                chunks.push(value);
                loaded += value.byteLength;
                const now = performance.now();
                if(now - lastUpdate > 200){
                    lastUpdate = now;
                    const sec = (now - t0)/1000;
                    const instSp = sec>0 ? (loaded/1048576/sec) : 0;
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
            clearTimeout(hardTimeout);
            const blob = new Blob(chunks);
            const sec = (performance.now()-t0)/1000;
            const info = await detectBlobType(blob);
            console.log(`🔍 ${label}: ${info.icon||''} ${info.name} (${fmtBytes(blob.size)})`, info.hex ? `| head: ${info.hex}` : '');
            if(expectedTypes && !expectedTypes.includes(info.type)){
                console.log(`⚠️ ${label}: тип "${info.type}" не в списке`);
                addLog(`⚠️ ${label}: тип "${info.name}" не подходит`, 'warn');
                return null;
            }
            addLog(`✅ ${label}: ${fmtBytes(blob.size)} за ${sec.toFixed(1)}s (${fmtSpeed(blob.size/1048576/sec)})`, 'ok');
            blob._detected = info;
            return blob;
        }catch(e){
            clearTimeout(hardTimeout);
            console.log('⚠️ download failed:', e.message);
            return null;
        }
    }

    function fmtBytes(b){ if(b<1024) return b+' B'; if(b<1048576) return (b/1024).toFixed(1)+' KB'; return (b/1048576).toFixed(2)+' MB'; }
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

    // ═══════════════════════════════════════════════════════════
    // 🎯 STRATEGY 1: ZIP / MULTIMEDIA / PDF (по ссылке) — FIX v53
    // ═══════════════════════════════════════════════════════════
    async function strategyZip(){
        const fid = state.fileId || bookInfo.fileId;
        if(!fid) return { ok:false };
        const urls = [
            `https://api.litres.ru/foundation/api/arts/files/${fid}/link?is_trial=false`,
            `https://api.litres.ru/foundation/api/arts/files/${fid}/link?resource=bin&is_trial=false`,
            `https://api.litres.ru/foundation/api/arts/files/${fid}/link?resource=zip&is_trial=false`,
            `https://api.litres.ru/foundation/api/arts/files/${fid}/link?resource=mp3&is_trial=false`,
            `https://api.litres.ru/foundation/api/arts/files/${fid}/link?resource=m4b&is_trial=false`,
            `https://api.litres.ru/foundation/api/arts/files/${fid}/link?index=1&is_trial=false`
        ];
        for(const url of urls){
            try{
                const r = await fetchWithTimeout(url, { credentials:'include', headers:getHeaders() }, 8000);
                if(r.status===401 || r.status===403) continue;
                if(!r.ok) continue;
                const d = await r.json();
                const link = d?.payload?.data?.link || d?.payload?.link || d?.data?.link || d?.link;
                if(!link) continue;

                // 🔑 FIX v53: определяем, PDF это по прямой ссылке
                const isPdfDirect = /fname=[^&]*\.pdf/i.test(link) || /\.pdf(\?|$)/i.test(link);
                const isPdfJsMeta = link.includes('/pdfjs/') && !isPdfDirect;

                // отсеиваем оглавление / главы / метаданные pdfjs-постранички
                if(link.includes('toc.js')) continue;
                if(link.includes('/json/') && !isPdfDirect) continue;
                if(isPdfJsMeta) continue; // pdfjs/*.js без fname=*.pdf — это НЕ файл книги
                if(link.includes('mimetype=text/javascript') && !isPdfDirect) continue;

                const isReal = isPdfDirect ||
                              link.includes('.bin') || link.includes('.zip') || link.includes('application/zip') ||
                              link.includes('resource=bin') || link.includes('resource=zip') ||
                              link.includes('.mp3') || link.includes('.m4b') || link.includes('.m4a') ||
                              link.includes('.flac') || link.includes('.ogg') || link.includes('.wav') ||
                              link.includes('.mp4') || link.includes('.webm') || link.includes('.mkv') ||
                              (link.includes('download_book') && !link.includes('/json/'));
                if(!isReal) continue;

                const fmt = detectFormatFromName(link);
                if(fmt && (!bookInfo.format || bookInfo.format.name!==fmt.name)){
                    bookInfo.format = fmt;
                    if(['MP3','M4B','M4A','FLAC','OGG','WAV','MP4','WEBM','MKV'].includes(fmt.name)) bookInfo.isAudio = true;
                    updateFormatDisplay();
                }
                console.log('🥇 Direct link:', link.substring(0, 140));
                return { ok:true, link, isPdf: isPdfDirect };
            }catch(e){}
        }
        return { ok:false };
    }

    // ═══════════════════════════════════════════════════════════
    // 🎯 STRATEGY 2: 000.js — БЫСТРАЯ проверка Range (2.5с)
    // ═══════════════════════════════════════════════════════════
    async function strategy000js(){
        const fid = state.fileId;
        if(!fid) return { ok:false };
        const chUrl = `https://www.litres.ru/download_book_subscr/${state.artId}/${fid}/json/000.js`;

        try{
            setReadingStatus('⚡ Проверка формата...');
            const rHead = await fetchWithTimeout(chUrl, {
                credentials:'include',
                headers:{ 'Range':'bytes=0-15' }
            }, 2500);

            if(rHead.ok || rHead.status===206){
                const buf = await rHead.arrayBuffer();
                const head = new Uint8Array(buf);
                const hex = Array.from(head.slice(0,8)).map(b=>b.toString(16).padStart(2,'0')).join(' ');
                const str = (s,l) => String.fromCharCode(...head.slice(s,s+l));
                console.log(`🔍 000.js Range первые байты: ${hex}`);

                if(str(0,5)==='%PDF-') return { ok:true, type:'pdf', needDownload:true };
                if(str(0,3)==='ID3') return { ok:true, type:'audio-mp3', needDownload:true };
                if(str(0,4)==='fLaC') return { ok:true, type:'audio-flac', needDownload:true };
                if(str(0,4)==='OggS') return { ok:true, type:'audio-ogg', needDownload:true };
                if(str(4,4)==='ftyp') return { ok:true, type:'audio-m4a', needDownload:true };
                if(head[0]===0x1A && head[1]===0x45 && head[2]===0xDF && head[3]===0xA3) return { ok:true, type:'video-webm', needDownload:true };
                if(str(0,1)==='[') return { ok:true, type:'json', needDownload:true };
                if(str(0,1)==='{') return { ok:true, type:'json-obj', needDownload:true };
                if(head[0]===0xFF && (head[1]&0xE0)===0xE0) return { ok:true, type:'audio-mp3', needDownload:true };
            }
        } catch(e){
            console.log('⚠️ Range проверка:', e.message);
        }
        console.log('⚠️ Range недоступен — качаем полностью с прогрессом');
        return { ok:true, type:'unknown', needDownload:true };
    }

    // ═══ 🎯 STRATEGY 3: PDFjs постраничка ═══
    async function strategyPdfjs(){
        if(!state.fileId) return { ok:false };
        try{
            const r = await fetchWithTimeout(`https://api.litres.ru/foundation/api/arts/files/${state.fileId}/link?index=1&is_trial=false`, { credentials:'include', headers:getHeaders() }, 10000);
            if(!r.ok) return { ok:false };
            const d = await r.json();
            const jsUrl = d?.payload?.data?.link || d?.payload?.link;
            if(!jsUrl) return { ok:false };
            const jr = await fetchWithTimeout(jsUrl, { credentials:'omit' }, 10000);
            if(!jr.ok) return { ok:false };
            const text = await jr.text();
            const exts = [...text.matchAll(/ext\s*:\s*['"](\w+)['"]/g)].map(m=>m[1]);
            if(exts.length===0) return { ok:false };
            return { ok:true, pageFormats:exts, totalPages:exts.length };
        }catch(e){ return { ok:false }; }
    }

    // ═══ PARSERS ═══
    function parseLitFile(t){ const c=t.trim().replace(/;\s*$/,''); try{ return new Function('return ('+c+')')(); }catch(e){ const s=c.indexOf('['), e2=c.lastIndexOf(']'); if(s>=0&&e2>s) return new Function('return ('+c.slice(s,e2+1)+')')(); throw e; } }
    function escHtml(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
    function litJsonToHtml(n){
        if(!Array.isArray(n)){ if(typeof n==='string') return escHtml(n); if(n&&typeof n==='object') return litJsonToHtml(n.c||[]); return ''; }
        return n.map(x=>{ if(typeof x==='string') return escHtml(x); if(!x||!x.t) return '';
            const i = litJsonToHtml(x.c||[]);
            switch(x.t){ case 'title': return `<h2>${i}</h2>`; case 'subtitle': return `<h3>${i}</h3>`; case 'p': return `<p>${i}</p>`; case 'em': return `<em>${i}</em>`; case 'strong': return `<strong>${i}</strong>`; case 'br': return '<br>'; default: return i; }
        }).join('');
    }
    async function fetchJsonChapter(num){
        const fid=state.fileId; if(!fid) return null;
        const n=String(num).padStart(3,'0');
        try{
            const r = await fetchWithTimeout(`https://www.litres.ru/download_book_subscr/${state.artId}/${fid}/json/${n}.js`, { credentials:'include' }, 10000);
            if(!r.ok) return null;
            const t = await r.text(); if(!t||t.length<10) return null;
            return litJsonToHtml(parseLitFile(t));
        }catch(e){ return null; }
    }
    function buildBookHtml(ch, m){
        const st=escHtml(m.title||'Книга'), sa=escHtml(m.author||'Неизвестный автор');
        return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>${st}</title><style>*{box-sizing:border-box;}body{font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.7;max-width:720px;margin:0 auto;padding:60px 30px;background:#fafafa;color:#222;}h1.book-title{font-size:32px;margin:0 0 10px;color:#1a2a4a;border-bottom:3px solid #1a5a9a;padding-bottom:15px;}h2{font-size:24px;margin:50px 0 20px;color:#1a2a4a;page-break-before:always;}h2:first-of-type{page-break-before:auto;}h3{font-size:20px;margin:30px 0 15px;color:#2a4a6a;}p{margin:14px 0;text-align:justify;}em{font-style:italic;}strong{font-weight:bold;}.meta{color:#6a8aaa;font-size:14px;margin-bottom:40px;padding-bottom:20px;border-bottom:1px solid #ddd;}.footer{margin-top:80px;padding-top:20px;border-top:1px solid #ddd;font-size:12px;color:#aab8c4;text-align:center;}</style></head><body><h1 class="book-title">${st}</h1><div class="meta">✍️ ${sa}</div>${ch.map((h,i)=>`<!-- Глава ${String(i).padStart(3,'0')} -->\n${h}`).join('\n')}<div class="footer">📚 LitRes Downloader v53.0<br>Глав: ${ch.length}</div></body></html>`;
    }

    let toolsBlob = null;
    async function downloadTools(){
        if(toolsBlob) return toolsBlob;
        for(const url of TOOLS_URLS){ try{ const r=await fetchWithTimeout(url,{credentials:'omit',mode:'cors'},30000); if(!r.ok) continue; toolsBlob=await r.blob(); return toolsBlob; }catch(e){} }
        return null;
    }
    function triggerDownload(blob, filename){
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.style.display='none';
        document.body.appendChild(a); a.click();
        setTimeout(()=>{ a.remove(); URL.revokeObjectURL(a.href); }, 3000);
    }

    // ═══ UI ═══
    document.body.insertAdjacentHTML('beforeend', `
        <style>
            @keyframes ldl-mini-in{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
            @keyframes ldl-in{from{opacity:0;transform:translateY(20px) scale(.96);}to{opacity:1;transform:translateY(0) scale(1);}}
            @keyframes ldl-pulse{0%,100%{opacity:1;}50%{opacity:.6;}}
            #litres_mini{animation:ldl-mini-in .3s cubic-bezier(.16,1,.3,1);position:fixed;bottom:16px;right:16px;z-index:99999;background:#000;border:1px solid rgba(255,255,255,.08);border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.7);display:none;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;transition:all .2s;font-family:'Segoe UI',Arial,sans-serif;}
            #litres_mini:hover{box-shadow:0 16px 48px rgba(74,138,244,.4);transform:translateY(-1px);}
            #litres_downloader_ui{animation:ldl-in .35s cubic-bezier(.16,1,.3,1);position:fixed;bottom:16px;right:16px;z-index:99999;background:#0e0e10;color:#fff;font-family:'Segoe UI',Arial,sans-serif;width:400px;max-width:calc(100vw - 32px);border-radius:20px;border:1px solid rgba(255,255,255,.08);box-shadow:0 24px 80px rgba(0,0,0,.8);overflow:hidden;display:flex;flex-direction:column;max-height:calc(100vh - 32px);user-select:none;font-size:13px;}
            #litres_downloader_ui *{box-sizing:border-box;}
            #litres_downloader_ui ::-webkit-scrollbar{width:6px;}
            #litres_downloader_ui ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:3px;}
            .ldl-header{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.08);flex-shrink:0;}
            .ldl-logo{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#1a5a9a,#4a8af4);display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 16px rgba(74,138,244,.35);flex-shrink:0;}
            .ldl-title{font-weight:700;font-size:15px;line-height:1.15;}
            .ldl-title .accent{color:#4a8af4;}
            .ldl-subtitle{font-size:10px;color:rgba(255,255,255,.4);text-transform:uppercase;margin-top:2px;}
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
            .ldl-hand.downloading{animation:ldl-pulse 1.5s infinite;}
            .ldl-status-text{flex:1;min-width:0;}
            .ldl-status-main{font-weight:600;font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
            .ldl-status-phase{font-size:10px;color:rgba(255,255,255,.4);font-family:'SF Mono',Consolas,monospace;margin-top:1px;}
            .ldl-counter{font-size:15px;font-weight:700;color:#4a8af4;font-family:'SF Mono',Consolas,monospace;flex-shrink:0;}
            .ldl-bar{width:100%;height:6px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden;margin-bottom:8px;}
            .ldl-bar-fill{height:100%;width:0%;background:linear-gradient(90deg,#1a5a9a,#4a8af4);border-radius:3px;transition:width .3s ease;}
            .ldl-progress-info{display:flex;justify-content:space-between;font-size:10px;color:rgba(255,255,255,.5);font-family:'SF Mono',Consolas,monospace;margin-bottom:8px;}
            .ldl-progress-info .pct{font-weight:700;color:#4a8af4;}
            .ldl-log{font-size:10px;color:rgba(255,255,255,.55);background:rgba(0,0,0,.4);padding:8px 10px;border-radius:8px;max-height:70px;overflow-y:auto;font-family:'SF Mono',Consolas,monospace;line-height:1.5;border:1px solid rgba(255,255,255,.05);word-break:break-word;}
            .ldl-result{display:none;padding:12px 14px;background:linear-gradient(135deg,rgba(39,174,96,.15),rgba(46,204,113,.08));border:1.5px solid rgba(39,174,96,.4);border-radius:12px;font-size:11px;line-height:1.6;}
            .ldl-result-title{font-weight:800;font-size:13px;color:#2ecc71;margin-bottom:6px;}
            .ldl-result-line{color:rgba(255,255,255,.8);}
            .ldl-result-line b{color:#fff;}
            .ldl-result-line .fmt{color:#4a8af4;}
            .ldl-buttons{display:flex;gap:6px;padding:0 16px 12px;flex-shrink:0;}
            .ldl-btn{padding:14px;border-radius:10px;border:none;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;}
            .ldl-btn-main{flex:3;background:linear-gradient(135deg,#27ae60,#2ecc71);color:#fff;box-shadow:0 4px 16px rgba(46,204,113,.35);}
            .ldl-btn-main:hover:not(:disabled){box-shadow:0 6px 20px rgba(46,204,113,.5);transform:translateY(-1px);}
            .ldl-btn-main.pause-mode{background:linear-gradient(135deg,#f0a500,#f39c12);box-shadow:0 4px 16px rgba(240,165,0,.35);}
            .ldl-btn-main.continue-mode,.ldl-btn-main.repeat-mode{background:linear-gradient(135deg,#1a5a9a,#4a8af4);box-shadow:0 4px 16px rgba(74,138,244,.4);}
            .ldl-btn-main:disabled{opacity:.4;cursor:not-allowed;transform:none;box-shadow:none;}
            .ldl-btn-stop{flex:1;background:rgba(255,255,255,.06);color:rgba(255,255,255,.7);border:1px solid rgba(255,255,255,.08);}
            .ldl-btn-stop:hover:not(:disabled){background:rgba(231,76,60,.15);color:#e74c3c;}
            .ldl-btn-stop:disabled{opacity:.3;cursor:not-allowed;}
            .ldl-toggles{display:flex;align-items:center;gap:12px;padding:10px 14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px;margin:0 16px 10px;font-size:11px;flex-wrap:wrap;flex-shrink:0;}
            .ldl-toggle{display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-weight:600;color:rgba(255,255,255,.75);user-select:none;}
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

        <div id="litres_mini" title="Развернуть">
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
                    <div class="ldl-subtitle">v53.0 · multimedia + pdf fix</div>
                </div>
                <button id="btn_sound" class="ldl-icon-btn" title="Звук">🔊</button>
                <button id="btn_github" class="ldl-icon-btn" title="GitHub">🔑</button>
                <button id="btn_minimize" class="ldl-icon-btn" title="Свернуть">—</button>
                <button id="close_ui" class="ldl-icon-btn" title="Закрыть">✕</button>
            </div>

            <div class="ldl-body">
                <div class="ldl-card book-card">
                    <div class="ldl-card-title" id="preview_book_title">⏳ Инициализация...</div>
                    <div class="ldl-card-row">✍️ <span id="preview_book_author">—</span></div>
                    <div class="ldl-card-row">📄 <span id="preview_total_pages">—</span> стр. • <span id="preview_formats">⏳</span></div>
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
                    <div class="ldl-result-title">✅ Файл скачан!</div>
                    <div id="result_text"></div>
                </div>
            </div>

            <div class="ldl-buttons">
                <button id="btn_start" class="ldl-btn ldl-btn-main" disabled>⏳ Инициализация...</button>
                <button id="btn_stop" class="ldl-btn ldl-btn-stop" disabled>⏹ Стоп</button>
            </div>

            <div class="ldl-toggles">
                <label class="ldl-toggle force"><input type="checkbox" id="force_mode">⚡ FORCE</label>
                <label class="ldl-toggle auto" title="Автоматически нажать Старт"><input type="checkbox" id="autostart_mode">🚀 АВТО</label>
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
        isReady:false, isRunning:false, isPaused:false, isStopped:false, isStarting:false,
        phase:'loading', downloaded:0, total:0, startPage:1, endPage:10,
        bookTitle:bookInfo.title, bookAuthor:bookInfo.author, totalPages:bookInfo.pages||0,
        errors:0, zip:null, failedPages:[], consecutiveErrors:0,
        fileId:fileId, artId:artId, lastSaveTime:0, forceMode:false,
        bookInfoLoaded:false, directLink:null, pageFormats:null, drmActivated:false,
        autoInterval:null, mode:'zip', jsonChapters:[], jsonEmptyStreak:0, skippedChapters:[],
        minimized:false, resultFormat:null, resultFilename:null
    };
    try{ state.minimized = localStorage.getItem(MINI_KEY)==='1'; }catch(e){}

    const LOG_COLORS = { info:'rgba(255,255,255,.55)', ok:'#2ecc71', err:'#e74c3c', warn:'#f0a500', step:'#4a8af4', net:'#7c5cff', db:'#38bdf8' };
    function addLog(text, kind='info'){
        logStatus.textContent = `${({ok:'✓',err:'✕',warn:'⚠',step:'▸',net:'🌐',db:'💾',info:'ℹ️'})[kind]||'ℹ️'} [${new Date().toLocaleTimeString()}] ${text}`;
        logStatus.style.color = LOG_COLORS[kind] || LOG_COLORS.info;
        console.log(`[LOG:${kind}] ${text}`);
    }
    const logOk = t => addLog(t,'ok'), logErr = t => addLog(t,'err'), logWarn = t => addLog(t,'warn'), logStep = t => addLog(t,'step'), logNet = t => addLog(t,'net');
    function setStatus(text, kind='info'){ statusText.textContent=text; statusText.style.color = kind==='err'?'#e74c3c':kind==='ok'?'#2ecc71':'rgba(255,255,255,.4)'; addLog(text, kind==='err'?'err':kind==='ok'?'ok':'info'); }
    function setReadingStatus(t){ readingStatus.textContent = t; }
    function setPhase(p){ state.phase = p; updateMini(); updateTabTitle(); }

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
    function animateHand(a){
        if(a==='turn'){ handAnimation.style.transform='translateX(30px) rotate(20deg)'; setTimeout(()=>handAnimation.style.transform='translateX(-10px) rotate(-10deg)',400); setTimeout(()=>handAnimation.style.transform='translateX(0) rotate(0deg)',800); }
        else if(a==='hover'){ handAnimation.style.transform='translateX(10px) scale(1.1)'; setTimeout(()=>handAnimation.style.transform='translateX(0) scale(1)',600); }
        else if(a==='wait'){ handAnimation.style.transform='rotate(-5deg)'; setTimeout(()=>handAnimation.style.transform='rotate(5deg)',500); setTimeout(()=>handAnimation.style.transform='rotate(0deg)',1000); }
        else { handAnimation.textContent=a; handAnimation.style.transform='scale(1.3)'; setTimeout(()=>handAnimation.style.transform='scale(1)',250); }
    }
    function getReadingDelay(){ if(state.forceMode) return Math.random()*300+200; const base=Math.random()*5000+3000; if(Math.random()<0.15) return base+Math.random()*10000+5000; return base; }
    function getRandomPause(){ if(state.forceMode) return Math.random()*200+100; if(Math.random()<0.2) return Math.random()*10000+5000; return Math.random()*3000+1000; }
    function updateProgress(){
        const p = state.total>0 ? Math.round((state.downloaded/state.total)*100) : 0;
        progressBar.style.width = `${Math.min(p,100)}%`;
        progressText.textContent = `📥 ${state.downloaded} из ${state.total}`;
        percentText.textContent = `${p}%`;
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
        const sz = size>1048576 ? (size/1048576).toFixed(2)+' MB' : (size/1024).toFixed(0)+' KB';
        $('result_text').innerHTML = `<div class="ldl-result-line">📁 <b>${filename}</b></div><div class="ldl-result-line">📄 Формат: <span class="fmt"><b>${format}</b></span></div><div class="ldl-result-line">📦 Размер: <b>${sz}</b></div><div style="margin-top:6px;font-size:10px;color:rgba(255,255,255,.5);">Файл в папке «Загрузки»</div>`;
        $('result_banner').style.display = 'block';
        setPhase('done'); setReadingStatus('✅ Файл скачан'); animateHand('✅');
        updateButtons(); Sound.complete();
    }
    function resetForRepeat(){
        $('result_banner').style.display = 'none';
        Object.assign(state, { downloaded:0, errors:0, consecutiveErrors:0, failedPages:[], jsonChapters:[], jsonEmptyStreak:0, skippedChapters:[], zip:null, isStopped:false, isPaused:false, isRunning:false, isStarting:false, resultFormat:null, resultFilename:null, phase:'idle' });
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
    async function downloadPageToZip(pageNum){
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
                        if(blob){ state.zip.file(`page_${String(pageNum).padStart(3,'0')}.${ext}`, blob); resolve({ success:true, size:blob.size }); }
                        else resolve({ success:false, error:'Конвертация' });
                    }, 'image/jpeg', 0.95);
                }catch(e){ resolve({ success:false, error:e.message }); }
            };
            img.onerror = function(){ clearTimeout(t); resolve({ success:false, error:'Ошибка загрузки' }); };
            img.src = url;
        });
    }
    function isBookFinished(){ return state.consecutiveErrors>=20 || state.downloaded>=state.total || state.errors>=50; }

    async function finalizePageZip(){
        if(!state.zip) return;
        setStatus('📦 Формируем ZIP...'); Sound.zip();
        zipInfo.style.display='inline';
        addLog('📥 Скачиваем x64.rar...', 'net');
        const t = await downloadTools();
        if(t){ state.zip.file(TOOLS_PATH, t); addLog(`✅ Tools: ${(t.size/1048576).toFixed(2)} MB`, 'db'); }
        state.zip.file('tools/README.txt', `LitRes PDF Converter\n1. Распакуй tools/x64.rar\n2. run_auto.bat\n3. ZIP в IN\n4. PDF в OUT\n© 2026 Diminssoft`);
        state.zip.file('book_info.txt', `Название: ${state.bookTitle}\nАвтор: ${state.bookAuthor}\nartId: ${state.artId}\nfileId: ${state.fileId}\nСтраниц: ${state.downloaded}/${state.total}\nФормат: JPG/GIF постранично\nДата: ${new Date().toLocaleString('ru-RU')}\nСкачано через LitRes Downloader v53.0`);
        try{
            const zb = await state.zip.generateAsync({ type:'blob', compression:'DEFLATE', compressionOptions:{level:6} });
            const safe = state.bookTitle.replace(/[\\/:*?"<>|]/g,'_').slice(0,100);
            const fn = `${safe}(${state.startPage}-${state.endPage}).zip`;
            triggerDownload(zb, fn);
            zipInfo.textContent = `✅ ZIP: ${Math.round(zb.size/1048576)} MB`;
            const extUsed = state.pageFormats && state.pageFormats[0] ? state.pageFormats[0].toUpperCase() : 'JPG';
            showResult(`JPG/GIF (${extUsed})`, fn, zb.size);
            await saveProgress(true);
        }catch(e){ setStatus(`❌ ${e.message}`, 'err'); setPhase('error'); Sound.error(); }
        state.isRunning = false; updateButtons();
    }

    async function downloadLoop(){
        if(state.isStopped) return;
        if(state.isPaused){ setTimeout(()=>{ if(!state.isPaused && state.isRunning) downloadLoop(); },1000); return; }
        if(isBookFinished()){ await finalizePageZip(); return; }
        const pageNum = state.startPage + state.downloaded;
        if(pageNum > state.endPage){ await finalizePageZip(); return; }
        setReadingStatus(`📖 Стр. ${pageNum}...`);
        animateHand('wait');
        setStatus(!state.forceMode ? `📖 Стр. ${pageNum}` : `⚡ ${pageNum}`);
        await new Promise(r=>setTimeout(r, getReadingDelay()));
        animateHand('turn');
        await new Promise(r=>setTimeout(r, 800));
        const result = await downloadPageToZip(pageNum);
        if(!result.success){ state.failedPages.push(pageNum); state.errors++; state.consecutiveErrors++; logWarn(`Стр. ${pageNum}`); Sound.warn(); }
        else { state.consecutiveErrors=0; state.downloaded++; updateProgress(); logOk(`Стр. ${pageNum} (${Math.round(result.size/1024)} KB)`); Sound.pageDone(); }
        if(state.downloaded%5===0 && state.downloaded>0) await saveProgress();
        await new Promise(r=>setTimeout(r, getRandomPause()));
        state.autoInterval = setTimeout(()=>{ if(!state.isStopped && !state.isPaused && state.isRunning) downloadLoop(); }, 500);
    }

    async function jsonDownloadLoop(){
        if(state.isStopped) return;
        if(state.isPaused){ setTimeout(()=>{ if(!state.isPaused && state.isRunning) jsonDownloadLoop(); },1000); return; }
        if(state.total>0 && state.downloaded>=state.total){ await finalizeJsonBook(); return; }
        const n = String(state.downloaded).padStart(3,'0');
        setReadingStatus(`📖 Глава ${n}...`);
        animateHand('hover');
        setStatus(`📖 ${state.downloaded}/${state.total||'?'}`);
        const html = await fetchJsonChapter(state.downloaded);
        if(html===null){
            state.jsonEmptyStreak++;
            logWarn(`Глава ${n} пустая (${state.jsonEmptyStreak}/50)`);
            if(state.jsonEmptyStreak>=50){ await finalizeJsonBook(); return; }
            await new Promise(r=>setTimeout(r,500));
            state.skippedChapters.push(state.downloaded); state.downloaded++; updateProgress();
        } else {
            state.jsonEmptyStreak = 0;
            state.jsonChapters.push(html); state.downloaded++; updateProgress();
            logOk(`Глава ${n} — ${html.length} симв.`); Sound.chapterDone();
        }
        if(state.downloaded>2000){ await finalizeJsonBook(); return; }
        state.autoInterval = setTimeout(()=>{ if(!state.isStopped && !state.isPaused && state.isRunning) jsonDownloadLoop(); }, state.forceMode?100:300);
    }

    async function finalizeJsonBook(){
        if(state.isStopped || !state.jsonChapters.length){ state.isRunning=false; updateButtons(); return; }
        setStatus('📦 HTML → ZIP...'); Sound.zip();
        zipInfo.style.display='inline';
        if(state.skippedChapters.length>0) logWarn(`Пропущено: ${state.skippedChapters.length}`);
        const html = buildBookHtml(state.jsonChapters, { title:state.bookTitle, author:state.bookAuthor });
        const safe = state.bookTitle.replace(/[\\/:*?"<>|]/g,'_').slice(0,100);
        if(!state.zip) state.zip = new JSZip();
        state.zip.file(`${safe}.html`, html);
        state.zip.file('book_info.txt', `Название: ${state.bookTitle}\nАвтор: ${state.bookAuthor}\nartId: ${state.artId}\nfileId: ${state.fileId}\nГлав: ${state.jsonChapters.length}\nПропущено: ${state.skippedChapters.length}\nФормат: HTML (из JSON)\nДата: ${new Date().toLocaleString('ru-RU')}\nСкачано через LitRes Downloader v53.0`);
        try{
            const zb = await state.zip.generateAsync({ type:'blob', compression:'DEFLATE', compressionOptions:{level:6} });
            const zn = `${safe}.zip`;
            triggerDownload(zb, zn);
            zipInfo.textContent = `✅ ${zn} (${(zb.size/1048576).toFixed(2)} MB)`;
            showResult(`HTML (${state.jsonChapters.length} глав)`, zn, zb.size);
            await saveProgress(true);
        }catch(e){ setStatus('❌ ' + e.message, 'err'); setPhase('error'); Sound.error(); }
        state.isRunning = false; updateButtons();
    }

    async function finalizePdfToZip(pdfBlob){
        setStatus('📦 PDF → ZIP...'); Sound.zip();
        zipInfo.style.display='inline';
        const safe = state.bookTitle.replace(/[\\/:*?"<>|]/g,'_').slice(0,100);
        const zip = new JSZip();
        zip.file(`${safe}.pdf`, pdfBlob);
        zip.file('book_info.txt', `Название: ${state.bookTitle}\nАвтор: ${state.bookAuthor}\nartId: ${state.artId}\nfileId: ${state.fileId}\nФормат: PDF\nДата: ${new Date().toLocaleString('ru-RU')}\nСкачано через LitRes Downloader v53.0`);
        try{
            const zb = await zip.generateAsync({ type:'blob', compression:'DEFLATE', compressionOptions:{level:6} });
            const zn = `${safe}.zip`;
            triggerDownload(zb, zn);
            zipInfo.textContent = `✅ ${zn} (${(zb.size/1048576).toFixed(2)} MB)`;
            showResult('PDF (в ZIP)', zn, zb.size);
        }catch(e){ setStatus('❌ ' + e.message, 'err'); setPhase('error'); Sound.error(); }
    }

    function saveMultimedia(blob, formatInfo){
        const safe = state.bookTitle.replace(/[\\/:*?"<>|]/g,'_').slice(0,100);
        const extMap = { 'MP3':'mp3','M4B':'m4b','M4A':'m4a','M4A/MP4':'m4a','FLAC':'flac','OGG':'ogg','WAV':'wav','MP4':'mp4','WEBM':'webm','MKV':'mkv','PDF':'pdf' };
        const ext = extMap[formatInfo.name] || 'bin';
        const fn = `${safe}.${ext}`;
        triggerDownload(blob, fn);
        const sz = (blob.size/1048576).toFixed(2);
        addLog(`🎵 ${fn} (${sz} MB)`, 'ok');
        zipInfo.style.display='inline';
        zipInfo.textContent = `✅ ${fn} (${sz} MB)`;
        zipInfo.style.color = '#4a8af4';
        showResult(`${formatInfo.icon} ${formatInfo.name}`, fn, blob.size);
    }

    // ═══ START ═══
    async function startSmart(){
        if(!state.isReady) return;
        if(state.phase==='done'||state.phase==='error') resetForRepeat();
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
            if(!JSZipLoaded){
                setStatus('⏳ JSZip...');
                await new Promise(res => { const c=setInterval(()=>{ if(JSZipLoaded){ clearInterval(c); res(); } },200); setTimeout(()=>{ clearInterval(c); res(); }, 5000); });
            }
            updateSession();
            if(!sessionData.sessionId){ setStatus('⚠️ Нет session-id. F5!', 'err'); Sound.error(); return; }
            if(!state.fileId){ if(!state.bookInfoLoaded) await fetchBookInfo(); state.fileId = bookInfo.fileId; }
            if(!state.fileId){ setStatus('❌ Нет fileId!', 'err'); Sound.error(); return; }

            logStep('⚡ Multi-strategy: ZIP + 000.js + PDFjs параллельно...');
            setStatus('⚡ Проверка способов...');
            setReadingStatus('⚡ Multi-strategy...');

            const [zipRes, pdf000Res, jsRes] = await Promise.all([
                strategyZip().catch(e => ({ ok:false })),
                strategy000js().catch(e => ({ ok:false })),
                strategyPdfjs().catch(e => ({ ok:false }))
            ]);

            console.log('🎯 Results:', { zip:zipRes.ok, pdf000:pdf000Res.ok, pdfjs:jsRes.ok });
            logStep(`ZIP=${zipRes.ok?'✅':'❌'} · 000.js=${pdf000Res.ok?'✅':'❌'} · PDFjs=${jsRes.ok?'✅':'❌'}`);

            // 🥇 Direct link (ZIP / PDF / multimedia)
            if(zipRes.ok){
                logStep(`🥇 Direct link — скачиваем${zipRes.isPdf?' (PDF)':''}`);
                state.isRunning = true; updateButtons();
                // ✅ FIX v53: добавляем 'pdf' в допустимые типы
                const expected = ['zip','pdf','audio-mp3','audio-m4b','audio-m4a','audio-flac','audio-ogg','audio-wav','video-mp4','video-webm'];
                const blob = await downloadWithProgress(zipRes.link, { credentials:'omit', mode:'cors' }, 'файла', expected);
                if(blob && blob.size > 1024){
                    const info = blob._detected;
                    const m = zipRes.link.match(/fname=([^&]+)/);
                    const baseSafe = state.bookTitle.replace(/[\\/:*?"<>|]/g,'_').slice(0,100);

                    // ✅ FIX v53: PDF → упаковываем в ZIP с book_info.txt
                    if(info?.type === 'pdf'){
                        logStep('📕 PDF → ZIP');
                        bookInfo.format = { icon:'📕', name:'PDF' }; updateFormatDisplay();
                        setReadingStatus('📦 Упаковываем PDF в ZIP...');
                        progressBar.style.width='100%'; percentText.textContent='100%';
                        await finalizePdfToZip(blob);
                        state.isRunning = false; updateButtons(); return;
                    }

                    // ZIP / multimedia — качаем как есть
                    const fn = m ? decodeURIComponent(m[1]) : `${baseSafe}.${info?.name?.toLowerCase()||'bin'}`;
                    triggerDownload(blob, fn);
                    zipInfo.style.display='inline';
                    zipInfo.textContent = `✅ ${fn} (${(blob.size/1048576).toFixed(2)} MB)`;
                    zipInfo.style.color = '#4a8af4';
                    const fmtLabel = info ? `${info.icon} ${info.name}` : (bookInfo.format ? `${bookInfo.format.icon} ${bookInfo.format.name}` : 'Файл');
                    showResult(fmtLabel, fn, blob.size);
                    state.isRunning = false; updateButtons(); return;
                }
                logWarn('Direct link не прошёл проверку → идём дальше');
            }

            // 🥈 000.js — единая качалка с прогрессом
            if(pdf000Res.ok && pdf000Res.needDownload){
                const chUrl = `https://www.litres.ru/download_book_subscr/${state.artId}/${state.fileId}/json/000.js`;

                logStep('📥 Качаем 000.js с прогрессом...');
                state.isRunning = true; updateButtons();
                setStatus('📥 Скачиваем книгу...');
                setReadingStatus('📥 Загрузка...');

                const blob = await downloadWithProgress(chUrl, { credentials:'include' }, 'Книга', null);
                if(!blob){
                    logWarn('Не скачалось');
                    state.isRunning=false; updateButtons();
                    return;
                }

                const info = blob._detected || await detectBlobType(blob);
                console.log('🎯 Определено:', info.icon, info.name, `(${fmtBytes(blob.size)})`);

                if(info.type === 'pdf'){
                    logStep('📕 PDF → ZIP');
                    bookInfo.format = { icon:'📕', name:'PDF' }; updateFormatDisplay();
                    setReadingStatus('📦 Упаковываем в ZIP...');
                    progressBar.style.width='100%'; percentText.textContent='100%';
                    await finalizePdfToZip(blob);
                    state.isRunning = false; updateButtons(); return;
                }

                if(isMultimediaType(info.type)){
                    logStep(`${info.icon} Мультимедиа: ${info.name}`);
                    bookInfo.format = info; bookInfo.isAudio = true;
                    updateFormatDisplay();
                    setReadingStatus(`💾 Сохраняем ${info.name}...`);
                    progressBar.style.width='100%'; percentText.textContent='100%';
                    saveMultimedia(blob, info);
                    state.isRunning = false; updateButtons(); return;
                }

                if(info.type === 'json' || info.type === 'json-obj'){
                    logStep('📖 JSON главы → HTML → ZIP');
                    try{
                        const text = await blob.text();
                        const trimmed = text.trim();
                        if(trimmed.startsWith('[') || trimmed.startsWith('{')){
                            bookInfo.format = { icon:'📖', name:'FB2' }; updateFormatDisplay();
                            state.mode = 'json'; state.jsonChapters=[]; state.jsonEmptyStreak=0; state.skippedChapters=[];
                            state.downloaded=0; state.total=999;
                            state.isRunning=true; state.isPaused=false; state.isStopped=false;
                            state.startPage=0; state.endPage=999; state.zip = new JSZip();
                            updateProgress();
                            setStatus('📖 Загрузка глав...');
                            setReadingStatus('📖 Читаем главы...'); animateHand('hover');
                            updateButtons();
                            setTimeout(jsonDownloadLoop, 500); return;
                        }
                    }catch(e){ console.log('JSON parse fail:', e); }
                }

                logWarn(`Неизвестный тип: ${info.type}`);
                state.isRunning = false; updateButtons();
                return;
            }

            // 🥉 PDFjs постраничка
            if(jsRes.ok){
                logStep(`🏅 PDFjs постраничка (${jsRes.pageFormats.length} стр.)`);
                state.pageFormats = jsRes.pageFormats;
                state.totalPages = jsRes.totalPages; state.drmActivated = true;
                bookInfo.format = { icon:'📕', name:'PDF' }; updateFormatDisplay();
                const tp = jsRes.totalPages;
                state.startPage=1; state.endPage=tp; state.total=tp;
                state.downloaded=0; state.errors=0; state.consecutiveErrors=0; state.failedPages=[];
                state.isRunning=true; state.isPaused=false; state.isStopped=false;
                state.mode='zip'; state.zip = new JSZip();
                updateProgress();
                setStatus(`🚀 1-${tp}`);
                setReadingStatus('📖 Открываем книгу...'); animateHand('hover');
                updateButtons();
                setTimeout(downloadLoop, 1000); return;
            }

            setStatus('❌ Все способы провалились', 'err'); Sound.error();
            state.isRunning = false; updateButtons();
        } finally {
            state.isStarting = false;
            if(!state.isRunning) updateButtons();
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
    btnSound.addEventListener('click', () => { Sound.enabled = !Sound.enabled; btnSound.textContent = Sound.enabled?'🔊':'🔇'; localStorage.setItem(SOUND_KEY, Sound.enabled?'true':'false'); if(Sound.enabled) Sound.click(); });
    $('btn_minimize').addEventListener('click', () => { state.minimized=true; updateMini(); Sound.click(); });
    mini.addEventListener('click', () => { state.minimized=false; updateMini(); Sound.click(); });
    $('close_ui').addEventListener('click', () => { stopDownload(); ui.remove(); mini.remove(); });
    forceMode.addEventListener('change', function(){ state.forceMode=this.checked; forceStatus.textContent = this.checked?'⚡ вкл':'⏸ выкл'; if(this.checked) forceStatus.classList.add('on'); else forceStatus.classList.remove('on'); Sound.click(); });
    try{ $('autostart_mode').checked = localStorage.getItem(AUTOSTART_KEY)==='true'; }catch(e){}
    $('autostart_mode').addEventListener('change', function(){ try{ localStorage.setItem(AUTOSTART_KEY, this.checked?'true':'false'); }catch(e){} Sound.click(); addLog(this.checked?'🚀 Автостарт ВКЛ':'🚀 Автостарт ВЫКЛ', 'ok'); });

    window.downloaderUI = { version:'v53.0', start:startSmart, stop:stopDownload, state, Sound, addLog, strategyZip, strategy000js, strategyPdfjs, downloadWithProgress, detectBlobType, fetchBookInfo, fetchUserInfo, fetchJsonChapter, buildBookHtml, parseLitFile, litJsonToHtml, saveProgressToGitHub };

    async function init(){
        setStatus('⏳ Загрузка...');
        addLog(`🔍 Тип: ${pageType}`);
        updateMini(); updateButtons();
        previewBookTitle.textContent = '⏳ Загрузка...';

        const ok = await fetchBookInfo();
        if(ok){
            previewBookTitle.textContent = bookInfo.title;
            previewBookAuthor.textContent = bookInfo.author;
            previewTotalPages.textContent = bookInfo.pages;
            state.bookTitle = bookInfo.title; state.bookAuthor = bookInfo.author;
            state.totalPages = bookInfo.pages; state.bookInfoLoaded = true;
            if(bookInfo.fileId) state.fileId = bookInfo.fileId;
            addLog(`✅ ${bookInfo.pages} ${bookInfo.isAudio?'сек':'стр.'}`, 'ok');
            if(bookInfo.format){ updateFormatDisplay(); logStep(`Формат: ${bookInfo.format.icon} ${bookInfo.format.name}${bookInfo.isAudio?' 🎧':''}`); }
        } else {
            setStatus('⚠️ Не удалось загрузить книгу', 'err');
        }

        setTimeout(async () => {
            const u = await fetchUserInfo();
            if(u){
                let h = `<div>👤 <b>${u.id}</b>${u.login?' • '+u.login:''}</div>`;
                if(u.email) h += `<div style="font-size:10px;">📧 ${u.email} ${u.isEmailConfirmed?'✅':'⚠️'}</div>`;
                if(u.subscription){
                    const till = new Date(u.subscription.validTill);
                    const dl = Math.ceil((till-new Date())/86400000);
                    const dc = dl<3?'#e74c3c':(dl<7?'#f0a500':'#2ecc71');
                    h += `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed rgba(255,255,255,.1);"><div><b>${u.subscription.isTrial?'🎁 Trial':'⭐ Активна'}</b>${u.subscription.planName?' · '+u.subscription.planName:''}${u.subscription.autoRenew?' 🔄':''}</div><div style="font-size:10px;">📅 ${till.toLocaleDateString('ru-RU')} • <span style="color:${dc};font-weight:700;">${dl} дн.</span></div></div>`;
                }
                if(u.account) h += `<div style="margin-top:4px;font-size:10px;">💰 Баланс: <b>${u.account.display}</b> (реал ${u.account.real} + бонус ${u.account.bonus})</div>`;
                if(u.loyalty) h += `<div style="font-size:10px;">🎁 Кешбэк: <b>${u.loyalty.cashbackPercent}%</b></div>`;
                userInfoText.innerHTML = h;
            } else { userInfoText.innerHTML = '<div>⚠️ Нет данных</div>'; }
        }, 300);

        state.isReady = true;
        setStatus('✅ Готов — жми "▶ Старт"', 'ok');
        setReadingStatus('📖 Готов к старту');
        animateHand('🖐️');
        updateButtons();
        updateTabTitle();
        console.log('%c✅ LitRes Downloader v53.0 готов!', 'color:#4ade80;font-weight:bold;font-size:14px;');
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
            Object.assign(state, { isRunning:false, isPaused:false, isStopped:true, downloaded:0, total:0, totalPages:0, pageFormats:null, drmActivated:false, fileId:null, artId:newArtId, directLink:null, bookInfoLoaded:false, jsonChapters:[], mode:'zip', phase:'loading' });
            bookInfo.format = null; bookInfo.isAudio = false;
            previewBookTitle.textContent = '⏳ Загрузка...'; previewBookAuthor.textContent = '...'; previewTotalPages.textContent = '—'; previewFormats.textContent = '⏳';
            progressBar.style.width = '0%';
            updateButtons();
            const ok = await fetchBookInfo();
            if(ok){ previewBookTitle.textContent = bookInfo.title; previewBookAuthor.textContent = bookInfo.author; previewTotalPages.textContent = bookInfo.pages; state.bookTitle = bookInfo.title; state.bookAuthor = bookInfo.author; state.totalPages = bookInfo.pages; state.fileId = bookInfo.fileId; state.bookInfoLoaded = true; updateFormatDisplay(); }
            state.isReady = true;
            setStatus('📖 Готов — жми "▶ Старт"');
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
            console.log(`🚀 Автозапуск`);
            logStep('🚀 Автостарт через 2 сек...');
            setTimeout(() => { if(state.isReady && !state.isRunning && !state.isStarting) startSmart(); }, 2000);
        }
    });

})();
