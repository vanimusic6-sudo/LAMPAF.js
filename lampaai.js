(function () {
    'use strict';
    if (window.should_watch_plugin_installed) return;
    window.should_watch_plugin_installed = true;

    var PLUGIN_ID = 'should_watch_plugin_enhanced';
    var ICON = '<svg viewBox="0 0 100 100" width="30" height="30" xmlns="http://www.w3.org/2000/svg"><g stroke="currentColor" stroke-width="8" stroke-linecap="square" fill="none"><path d="M20,55 L40,75 L80,25"/><path d="M25,25 L75,75" stroke-dasharray="4,4"/></g></svg>';
    var DISPLAY = '"Trebuchet MS","Segoe UI",system-ui,sans-serif';

    var GENRE_ID_ANIM = 16, GENRE_ID_FAMILY = 10751, GENRE_ID_KIDS = 10762;

    window._sw_rolling = false;
    window._sw_currentModalHtml = null;
    window._sw_prevController = null;
    window._sw_closingFromController = false;
    window._sw_loaderTimer = null;
    window._sw_blocknav = true;
    window._sw_scrollContainer = null;
    window._sw_activeInteractive = null;
    window._sw_aiChatOpen = false;
    window._sw_keyBound = false;
    var _metaCache = {};

    /* ===== НАСТРОЙКИ ===== */
    function getSetting(k, d) { try { var v = Lampa.Storage.get(PLUGIN_ID + '_' + k); if (v !== undefined && v !== null && v !== '') return v; } catch(e) {} return d; }
    function getSettings() {
        return {
            bad_genres: String(getSetting('bad_genres', '') || ''),
            bad_actors: String(getSetting('bad_actors', '') || ''),
            bad_directors: String(getSetting('bad_directors', '') || ''),
            min_rating: parseFloat(getSetting('min_rating', '6')) || 6,
            ai_enabled: getSetting('ai_enabled', true)
        };
    }
    function parseBL(s) { return s ? s.split(',').map(function(x){ return x.trim().toLowerCase(); }).filter(Boolean) : []; }
    function initSettings() {
        try {
            if (!window.Lampa || !Lampa.SettingsApi || window.sw_settings_ready) return;
            window.sw_settings_ready = true;
            Lampa.SettingsApi.addComponent({ component: PLUGIN_ID, name: 'Стоит ли смотреть?', icon: ICON });
            [
                { name: 'bad_genres', type: 'input', title: 'Нелюбимые жанры', description: 'Через запятую', default: '' },
                { name: 'bad_actors', type: 'input', title: 'Нелюбимые актёры', description: 'Через запятую', default: '' },
                { name: 'bad_directors', type: 'input', title: 'Нелюбимые авторы', description: 'Через запятую', default: '' },
                { name: 'min_rating', type: 'select', title: 'Мин. рейтинг', values: {'0':'Любой','5':'5.0','6':'6.0','7':'7.0','8':'8.0'}, default: '6' },
                { name: 'ai_enabled', type: 'toggle', title: 'Включить ИИ помощник', default: true }
            ].forEach(function(p) {
                Lampa.SettingsApi.addParam({
                    component: PLUGIN_ID,
                    param: { name: PLUGIN_ID + '_' + p.name, type: p.type, values: p.values || '', default: p.default },
                    field: { name: p.title, description: p.description }
                });
            });
        } catch(e) { console.error('[SW] initSettings:', e); }
    }

    /* ===== СТИЛИ ===== */
    function injectCSS() {
        try {
            if (document.getElementById('sw-plugin-styles-enhanced')) return;
            var s = document.createElement('style'); s.id = 'sw-plugin-styles-enhanced';
            s.innerHTML =
                '.sw-modal-content{padding:22px 26px 44px;color:#fff;font-family:' + DISPLAY + ';box-sizing:border-box;max-height:88vh;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y}' +
                '.sw-modal-content::-webkit-scrollbar{width:6px}.sw-modal-content::-webkit-scrollbar-thumb{background:rgba(255,255,255,.22);border-radius:3px}.sw-modal-content::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.34)}' +
                '.sw-body{animation:swFadeIn .5s cubic-bezier(.25,.8,.25,1)}' +
                '@keyframes swFadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}' +
                '.sw-loader{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:70px 20px;color:#cbd5e1;min-height:50vh}' +
                '.sw-loader-dice{font-size:3.6em;line-height:1;animation:swFloat 2.4s ease-in-out infinite;filter:drop-shadow(0 6px 22px rgba(133,194,94,.45))}' +
                '@keyframes swFloat{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-10px) rotate(3deg)}}' +
                '.sw-loader-text{font-size:1.1em;font-weight:600;min-height:1.5em;transition:opacity .3s ease;color:#94a3b8;text-align:center}' +
                '.sw-loader-progress{width:220px;height:4px;border-radius:2px;background:rgba(255,255,255,.08);overflow:hidden;position:relative;margin-top:10px}' +
                '.sw-loader-progress::after{content:"";position:absolute;left:-100%;top:0;height:100%;width:100%;background:linear-gradient(90deg,transparent,#85c25e,transparent);animation:swSlide 1.8s linear infinite}' +
                '@keyframes swSlide{0%{left:-100%}100%{left:100%}}' +
                '.sw-dossier{position:relative;padding:26px;border-radius:18px;margin-bottom:24px;background:linear-gradient(145deg,rgba(255,255,255,.06),rgba(255,255,255,.012));border:1px solid rgba(255,255,255,.08);animation:swRise .55s cubic-bezier(.22,1,.36,1) both}' +
                '@keyframes swRise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}' +
                '.sw-dossier::before{content:"";position:absolute;inset:0;border-radius:18px;background:radial-gradient(120% 80% at 100% 0%,rgba(133,194,94,.08),transparent 55%);pointer-events:none}' +
                '.sw-verdict-word{font-family:' + DISPLAY + ';font-size:2.7em;font-weight:900;letter-spacing:-.02em;line-height:1;margin:0 0 8px;text-transform:uppercase;opacity:0;transform:scale(.9);transition:opacity .5s ease,transform .55s cubic-bezier(.34,1.56,.64,1)}' +
                '.sw-verdict-word.appear{opacity:1;transform:scale(1)}' +
                '.sw-verdict-word.yes{color:#85c25e;text-shadow:0 0 22px rgba(133,194,94,.28)}.sw-verdict-word.no{color:#d9534f;text-shadow:0 0 22px rgba(217,83,79,.28)}.sw-verdict-word.maybe{color:#e0a93b;text-shadow:0 0 22px rgba(224,169,59,.28)}' +
                '.sw-verdict-reason{font-size:1.05em;color:#d1d5db;line-height:1.6;margin:0 0 18px;max-width:66ch;opacity:0;transform:translateY(8px);transition:opacity .45s ease .12s,transform .45s ease .12s}' +
                '.sw-verdict-reason.appear{opacity:1;transform:translateY(0)}' +
                '.sw-meter{height:9px;border-radius:5px;background:rgba(0,0,0,.4);overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,.4)}' +
                '.sw-meter-fill{height:100%;width:0;border-radius:5px;transition:width 1s cubic-bezier(.34,1.56,.64,1)}' +
                '.sw-meter-fill.yes{background:linear-gradient(90deg,#6ba82f,#85c25e)}.sw-meter-fill.no{background:linear-gradient(90deg,#c9302c,#d9534f)}.sw-meter-fill.maybe{background:linear-gradient(90deg,#d48a2b,#e0a93b)}' +
                '.sw-mode-badge{position:absolute;top:22px;right:22px;display:inline-flex;align-items:center;gap:6px;font-size:.72em;padding:4px 13px;border-radius:20px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.1)}' +
                '.sw-mode-badge.tmdb{color:#85c25e;border-color:rgba(133,194,94,.3)}.sw-mode-badge.tags{color:#aaa}' +
                '.sw-mode-dot{width:6px;height:6px;border-radius:50%;display:inline-block}' +
                '.sw-mode-dot.active{background:#85c25e;box-shadow:0 0 10px rgba(133,194,94,.7);animation:swPulse 1.6s ease-in-out infinite}.sw-mode-dot.inactive{background:#777}' +
                '@keyframes swPulse{0%,100%{box-shadow:0 0 0 0 rgba(133,194,94,.5)}50%{box-shadow:0 0 0 5px rgba(133,194,94,0)}}' +
                '.sw-info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:24px}' +
                '.sw-info-item{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);border-radius:13px;padding:13px 10px;text-align:center;transition:background .25s ease,border-color .25s ease,transform .25s ease}' +
                '.sw-info-item:hover{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.16);transform:translateY(-2px)}' +
                '.sw-info-label{font-size:.72em;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px}' +
                '.sw-info-value{font-size:1.08em;font-weight:700;color:#f3f4f6;word-break:break-word}' +
                '.sw-columns{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:16px;margin-bottom:24px}' +
                '.sw-col{background:rgba(255,255,255,.03);padding:20px 22px;border-radius:16px;border:1px solid rgba(255,255,255,.06);transition:background .25s ease,border-color .25s ease}' +
                '.sw-col:hover{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.14)}' +
                '.sw-title{font-family:' + DISPLAY + ';font-size:.92em;font-weight:800;margin-bottom:15px;text-transform:uppercase;display:flex;align-items:center;gap:8px;letter-spacing:.04em}' +
                '.sw-title.pros{color:#85c25e}.sw-title.cons{color:#d9534f}.sw-title.target{color:#e5e7eb}' +
                '.sw-list{margin:0;padding-left:20px;font-size:.96em;line-height:1.6;color:#d1d5db}.sw-list li{margin-bottom:9px;opacity:0;transform:translateX(-8px);transition:opacity .4s ease,transform .4s cubic-bezier(.25,.8,.25,1)}.sw-list li.appear{opacity:1;transform:translateX(0)}' +
                '.sw-quote{position:relative;background:rgba(255,255,255,.03);border-left:4px solid rgba(133,194,94,.25);border-radius:0 14px 14px 0;padding:18px 22px;margin-bottom:24px;transition:border-color .25s ease,background .25s ease}' +
                '.sw-quote:hover{background:rgba(255,255,255,.06);border-left-color:rgba(133,194,94,.5)}' +
                '.sw-quote-text{font-size:1.02em;line-height:1.6;color:#e5e7eb;font-style:italic}' +
                '.sw-quote-meta{margin-top:11px;font-size:.82em;color:#9ca3af;display:flex;align-items:center;gap:8px;flex-wrap:wrap}' +
                '.sw-quote-tone{padding:2px 9px;border-radius:6px;font-style:normal;font-weight:700;text-transform:uppercase;font-size:.72em;letter-spacing:.05em}' +
                '.sw-quote-tone.pos{background:rgba(133,194,94,.16);color:#85c25e}.sw-quote-tone.neg{background:rgba(217,83,79,.16);color:#d9534f}.sw-quote-tone.mix{background:rgba(224,169,59,.16);color:#e0a93b}' +
                '.sw-target-audience{background:linear-gradient(90deg,rgba(133,194,94,.08),transparent);border:1px solid rgba(133,194,94,.16);padding:18px 22px;border-radius:14px;line-height:1.6;margin-bottom:24px;transition:background .25s ease,border-color .25s ease}' +
                '.sw-target-audience:hover{background:linear-gradient(90deg,rgba(133,194,94,.14),transparent);border-color:rgba(133,194,94,.32)}' +
                '.sw-aud-text{color:#f3f4f6;font-size:1.02em}' +
                '.sw-decision{text-align:center;padding:26px;background:rgba(255,255,255,.02);border-radius:18px;border:1px solid rgba(255,255,255,.06);margin-bottom:18px}' +
                '.sw-decision-hint{font-size:.85em;color:#9ca3af;margin-bottom:18px}' +
                '.sw-buttons-row{display:flex;gap:14px;justify-content:center;flex-wrap:wrap}' +
                '.sw-btn{font-family:' + DISPLAY + ';font-size:1em;font-weight:700;padding:13px 30px;border-radius:32px;display:inline-flex;align-items:center;gap:11px;transition:transform .25s ease,background .25s ease,box-shadow .25s ease;cursor:pointer;outline:none;border:2px solid transparent;background:rgba(255,255,255,.09);color:#fff}' +
                '.sw-btn:hover{background:rgba(255,255,255,.16);transform:translateY(-2px)}' +
                '.sw-btn.focus{background:#fff;color:#111;transform:scale(1.05);box-shadow:0 0 0 4px rgba(255,255,255,.35),0 6px 22px rgba(0,0,0,.3)}' +
                '.sw-btn-primary{background:#85c25e;color:#16220c}.sw-btn-primary:hover{background:#92d069}.sw-btn-primary.focus{background:#fff;box-shadow:0 0 0 4px rgba(133,194,94,.45),0 6px 22px rgba(0,0,0,.3)}' +
                '.sw-btn.shake{animation:swShake .5s}' +
                '@keyframes swShake{0%,100%{transform:translateX(0) rotate(0)}15%{transform:translateX(-4px) rotate(-3deg)}30%{transform:translateX(4px) rotate(3deg)}45%{transform:translateX(-3px) rotate(-2deg)}60%{transform:translateX(3px) rotate(2deg)}75%{transform:translateX(-1px)}}' +
                '.sw-verdict-roll{margin-top:16px;font-family:' + DISPLAY + ';font-size:1.45em;font-weight:900;min-height:34px;text-transform:uppercase;letter-spacing:.01em;opacity:0;transform:scale(.8);transition:opacity .4s ease,transform .5s cubic-bezier(.34,1.56,.64,1)}' +
                '.sw-verdict-roll.appear{opacity:1;transform:scale(1)}' +
                '.sw-verdict-roll.verdict-yes{color:#85c25e;text-shadow:0 0 18px rgba(133,194,94,.4)}.sw-verdict-roll.verdict-no{color:#d9534f;text-shadow:0 0 18px rgba(217,83,79,.4)}' +
                '.sw-ai-chat{display:none;background:rgba(0,0,0,.32);border:1px solid rgba(255,255,255,.09);border-radius:18px;padding:20px 22px;margin-top:8px;animation:swRise .4s cubic-bezier(.22,1,.36,1) both}' +
                '.sw-ai-chat.visible{display:block}' +
                '.sw-ai-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:13px;border-bottom:1px solid rgba(255,255,255,.08)}' +
                '.sw-ai-title{font-size:1.1em;font-weight:700;color:#f3f4f6;display:flex;align-items:center;gap:9px}' +
                '.sw-ai-close{background:rgba(255,255,255,.1);border:none;color:#fff;cursor:pointer;width:36px;height:36px;border-radius:50%;font-size:1.3em;display:flex;align-items:center;justify-content:center;transition:background .25s ease,transform .25s ease;outline:none}' +
                '.sw-ai-close.focus{background:#fff;color:#111;transform:scale(1.1)}' +
                '.sw-ai-messages{max-height:280px;overflow-y:auto;padding-right:8px;margin-bottom:16px;overscroll-behavior:contain}' +
                '.sw-ai-messages::-webkit-scrollbar{width:4px}.sw-ai-messages::-webkit-scrollbar-thumb{background:rgba(255,255,255,.2);border-radius:2px}' +
                '.sw-ai-message{padding:11px 15px;border-radius:14px;margin-bottom:10px;font-size:.96em;line-height:1.55;max-width:90%;opacity:0;transform:translateY(8px);animation:swMsgIn .35s cubic-bezier(.25,.8,.25,1) forwards}' +
                '@keyframes swMsgIn{to{opacity:1;transform:translateY(0)}}' +
                '.sw-ai-message.user{background:#85c25e;color:#16220c;margin-left:auto;border-bottom-right-radius:3px}' +
                '.sw-ai-message.bot{background:rgba(255,255,255,.08);color:#e5e7eb;border-bottom-left-radius:3px}' +
                '.sw-ai-source{display:inline-block;margin-top:9px;font-size:.8em;color:#85c25e;text-decoration:none;border-bottom:1px dashed rgba(133,194,94,.4)}' +
                '.sw-ai-source.muted{color:#7c828c;border-bottom:none}' +
                '.sw-ai-typing{display:inline-flex;gap:6px;padding:13px 17px;background:rgba(255,255,255,.06);border-radius:14px;margin-bottom:10px}' +
                '.sw-ai-typing span{width:7px;height:7px;background:#9ca3af;border-radius:50%;animation:swDot 1.2s infinite ease-in-out both}' +
                '.sw-ai-typing span:nth-child(1){animation-delay:0s}.sw-ai-typing span:nth-child(2){animation-delay:.18s}.sw-ai-typing span:nth-child(3){animation-delay:.36s}' +
                '@keyframes swDot{0%,80%,100%{transform:scale(.6);opacity:.4}40%{transform:scale(1);opacity:1}}' +
                '.sw-ai-suggestions{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}' +
                '.sw-ai-chip{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#d1d5db;padding:8px 15px;border-radius:20px;font-size:.85em;cursor:pointer;transition:all .22s ease;white-space:nowrap;outline:none}' +
                '.sw-ai-chip.focus{background:#fff;color:#111;border-color:#fff;transform:scale(1.05)}' +
                '.sw-ai-chip.web{border-color:rgba(133,194,94,.4);color:#bfe3a6}' +
                '.sw-ai-input-row{display:flex;gap:10px;align-items:flex-end}' +
                '.sw-ai-input{flex:1;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:13px;color:#fff;font-family:' + DISPLAY + ';font-size:.95em;padding:11px 14px;resize:none;min-height:44px;max-height:90px;outline:none;transition:border-color .25s ease,background .25s ease}' +
                '.sw-ai-input:focus{border-color:rgba(133,194,94,.55);background:rgba(255,255,255,.11)}' +
                '.sw-ai-send{background:#85c25e;color:#16220c;border:none;border-radius:13px;padding:11px 20px;font-weight:700;cursor:pointer;transition:background .25s ease,transform .25s ease;outline:none;font-family:' + DISPLAY + '}' +
                '.sw-ai-send.focus{background:#fff;transform:scale(1.05)}' +
                '.sw-ai-hint{font-size:.74em;color:#7c828c;margin-top:9px;text-align:center}' +
                /* фокус-рамка ТОЛЬКО для интерактива; без scroll-margin, чтобы не дёргать скролл */
                '.sw-focusable{outline:none;cursor:pointer}' +
                '.sw-focusable.focus{box-shadow:0 0 0 3px rgba(255,255,255,.85),0 0 18px rgba(255,255,255,.18);border-radius:12px}' +
                /* на таче гасим любые следы фокуса, чтобы свайп не спотыкался */
                '@media (hover:none) and (pointer:coarse){.sw-focusable:focus,.sw-focusable.focus{box-shadow:none}.sw-btn.focus{transform:none}}' +
                '@media(max-width:600px){.sw-modal-content{padding:16px 16px 32px}.sw-verdict-word{font-size:2.1em}.sw-columns{grid-template-columns:1fr}.sw-info-grid{grid-template-columns:repeat(2,1fr)}.sw-buttons-row{flex-direction:column}.sw-btn{width:100%;justify-content:center}}';
            document.head.appendChild(s);
        } catch(e) { console.error('[SW] injectCSS:', e); }
    }

    /* ===== УТИЛИТЫ ===== */
    var escMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function esc(s) { if (typeof s !== 'string') return ''; return s.replace(/[&<>"']/g, function(m){ return escMap[m]; }); }
    function hasGenre(g, re) { return g.some(function(x){ return re.test((x || '').toLowerCase()); }); }
    function inText(s, re) { return re.test((s || '').toLowerCase()); }
    function inAnyText(texts, re) { return texts.some(function(s){ return inText(s, re); }); }
    function mediaType(m) { return (m && m.name && !m.title) ? 'tv' : 'movie'; }
    function formatNumber(num) { if (!num) return 'N/A'; if (num >= 1000000) return '$' + (num/1000000).toFixed(1) + 'M'; if (num >= 1000) return '$' + (num/1000).toFixed(0) + 'K'; return '$' + num; }
    function uniq(arr) { return arr.filter(function(v,i,s){ return s.indexOf(v) === i; }); }

    /* ===== СКРОЛЛ-КОНТЕЙНЕР (проверяем сам узел, а не только родителей) ===== */
    function findScrollParent(node) {
        try {
            var el = node;
            while (el && el.nodeType === 1 && el !== document.body && el !== document.documentElement) {
                var oy = window.getComputedStyle(el).overflowY;
                if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && el.scrollHeight > el.clientHeight + 4) return el;
                el = el.parentNode;
            }
        } catch(e) {}
        return document.scrollingElement || document.documentElement;
    }
    function refreshScrollContainer() {
        var h = window._sw_currentModalHtml;
        if (h && h.length) {
            var inner = h.find('.sw-modal-content')[0] || h[0];
            window._sw_scrollContainer = $(findScrollParent(inner));
        }
    }
    function animateScrollTo(target, cb) {
        var c = window._sw_scrollContainer; if (!c || !c.length) return;
        var cn = c[0]; var max = cn.scrollHeight - cn.clientHeight; if (max < 0) max = 0;
        if (target < 0) target = 0; if (target > max) target = max;
        try { $(cn).stop(true, false).animate({ scrollTop: target }, 220, 'swing', function(){ if (cb) cb(); }); }
        catch(e) { cn.scrollTop = target; if (cb) cb(); }
    }
    function scrollContainerTo(el, center) {
        try {
            if (!el || !el.length) return;
            var c = window._sw_scrollContainer; if (!c || !c.length) { refreshScrollContainer(); c = window._sw_scrollContainer; }
            if (!c || !c.length) return;
            var cn = c[0], cRect = cn.getBoundingClientRect(), eRect = el[0].getBoundingClientRect();
            var delta = eRect.top - cRect.top, target;
            if (center) target = cn.scrollTop + delta - (cn.clientHeight / 2) + (eRect.height / 2);
            else if (eRect.top < cRect.top + 8) target = cn.scrollTop + delta - 20;
            else if (eRect.bottom > cRect.bottom - 8) target = cn.scrollTop + (eRect.bottom - cRect.bottom) + 20;
            else return;
            animateScrollTo(target, null);
        } catch(e) {}
    }

    /* ===== ФОКУС-КОЛЬЦО (только интерактив, без нативного focus → без рывков) ===== */
    function interactiveSet() {
        var h = window._sw_currentModalHtml; if (!h) return $();
        return h.find('.sw-focusable:visible:not(textarea):not(input)');
    }
    function focusRing(el) {
        var h = window._sw_currentModalHtml; if (!h) return;
        h.find('.sw-focusable').removeClass('focus');
        el.addClass('focus');
        window._sw_activeInteractive = el[0];
    }
    function highlightVisible() {
        var set = interactiveSet(); if (!set.length) return;
        var c = window._sw_scrollContainer, mid;
        if (c && c.length) { var r = c[0].getBoundingClientRect(); mid = r.top + r.height / 2; }
        else mid = window.innerHeight / 2;
        var best = null, bd = 1e9;
        set.each(function(){ var rr = this.getBoundingClientRect(); var d = Math.abs((rr.top + rr.height/2) - mid); if (d < bd) { bd = d; best = this; } });
        if (best) focusRing($(best));
    }
    function moveHorizontal(dir) {
        var set = interactiveSet(); if (!set.length) return;
        var idx = -1;
        if (window._sw_activeInteractive) idx = set.index(window._sw_activeInteractive);
        if (idx < 0) idx = dir > 0 ? -1 : 0;
        var n = idx + dir; if (n < 0) n = set.length - 1; if (n >= set.length) n = 0;
        focusRing(set.eq(n));
    }
    function scrollStep(dir) {
        var c = window._sw_scrollContainer; if (!c || !c.length) { refreshScrollContainer(); c = window._sw_scrollContainer; }
        if (!c || !c.length) return;
        var cn = c[0]; var step = Math.max(140, Math.round(cn.clientHeight * 0.8));
        animateScrollTo(cn.scrollTop + dir * step, highlightVisible);
    }

    /* ===== ДЕТЕКТОР ЖАНРОВ ===== */
    function genreByIdOrName(genresRaw, ids, nameRe) {
        if (!genresRaw || !genresRaw.length) return false;
        for (var i = 0; i < genresRaw.length; i++) {
            var g = genresRaw[i];
            if (g && typeof g === 'object') { if (g.id && ids.indexOf(g.id) >= 0) return true; if (nameRe.test((g.name || '').toLowerCase())) return true; }
            else if (typeof g === 'string') { if (nameRe.test(g.toLowerCase())) return true; }
        }
        return false;
    }

    /* ===== СЕТЬ: универсальный GET + Wikipedia ===== */
    function parseMaybe(d) { if (d == null) return null; if (typeof d === 'string') { try { return JSON.parse(d); } catch(e) { return null; } } return d; }
    function httpGet(url) {
        return new Promise(function(res){
            try {
                if (Lampa.Request && typeof Lampa.Request.get === 'function') {
                    Lampa.Request.get(url, function(d){ res(parseMaybe(d)); }, function(){ res(null); }, { dataType: 'json' });
                } else if (typeof fetch !== 'undefined') {
                    fetch(url).then(function(r){ return r.text(); }).then(function(t){ res(parseMaybe(t)); }).catch(function(){ res(null); });
                } else res(null);
            } catch(e) { res(null); }
        });
    }
    function extractByTitle(page, en) {
        var host = en ? 'https://en.wikipedia.org' : 'https://ru.wikipedia.org';
        var u = host + '/w/api.php?action=query&prop=extracts|info&exintro=1&explaintext=1&inprop=url&titles=' + encodeURIComponent(page) + '&format=json&origin=*';
        return httpGet(u).then(function(d){
            var pages = d && d.query && d.query.pages; if (!pages) return null;
            var p = pages[Object.keys(pages)[0]]; if (!p || !p.extract) return null;
            var url = p.fullurl || (host + '/wiki/' + encodeURIComponent(p.title.replace(/ /g, '_')));
            return { title: p.title, extract: p.extract, url: url, lang: en ? 'en' : 'ru' };
        });
    }
    function wikiSearchLang(title, en) {
        var host = en ? 'https://en.wikipedia.org' : 'https://ru.wikipedia.org';
        var s = host + '/w/api.php?action=query&list=search&srsearch=' + encodeURIComponent(title) + '&format=json&origin=*&srlimit=3';
        return httpGet(s).then(function(d){
            var hits = d && d.query && d.query.search; if (!hits || !hits.length) return null;
            return extractByTitle(hits[0].title, en);
        });
    }
    function wikiFetch(title) {
        return wikiSearchLang(title, false).then(function(r){ return r ? r : wikiSearchLang(title, true); });
    }
    function trimExtract(ex, max) {
        if (!ex) return '';
        if (ex.length <= max) return ex;
        var cut = ex.substring(0, max);
        var last = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
        if (last > max * 0.5) cut = cut.substring(0, last + 1);
        return cut.trim() + '…';
    }

    /* ===== ДОГРУЗКА TMDB ===== */
    function loadCredits(movie) {
        try {
            if (movie.credits && ((movie.credits.cast && movie.credits.cast.length) || (movie.credits.crew && movie.credits.crew.length))) return Promise.resolve(movie.credits);
            var id = movie.id || movie.tmdb_id; if (!id) return Promise.resolve(null);
            if (Lampa.TMDB && typeof Lampa.TMDB.credits === 'function') {
                return new Promise(function(res){ Lampa.TMDB.credits(id, function(d){ res(d && !d.status_code ? d : null); }, function(){ res(null); }); });
            }
        } catch(e) {}
        return Promise.resolve(null);
    }
    function tmdbKey() { try { if (Lampa.TMDB && Lampa.TMDB.key) return Lampa.TMDB.key; } catch(e) {} return '4ef0d7355d9ffb5151e987764708ce96'; }
    function curLangCode() { try { var l = Lampa.Storage.get('language', 'ru') || 'ru'; return l + '-' + l.toUpperCase(); } catch(e) { return 'ru-RU'; } }
    function tmdbGet(path, lang) {
        return new Promise(function(res){
            try {
                var langCode = lang || curLangCode();
                var url = 'https://api.themoviedb.org/3' + path + (path.indexOf('?') > -1 ? '&' : '?') + 'language=' + langCode + '&api_key=' + tmdbKey();
                if (Lampa.Request && typeof Lampa.Request.get === 'function') {
                    Lampa.Request.get(url, function(d){ res(d && d.status_code ? null : d); }, function(){ res(null); }, { dataType: 'json' });
                } else if (typeof fetch !== 'undefined') {
                    fetch(url).then(function(r){ return r.json(); }).then(function(d){ res(d && d.status_code ? null : d); }).catch(function(){ res(null); });
                } else res(null);
            } catch(e) { res(null); }
        });
    }
    function mapUSRating(s) {
        return { 'G':0,'PG':7,'PG-13':13,'R':17,'NC-17':17,'TV-MA':17,'TV-14':14,'TV-PG':7,'TV-G':0,'TV-Y7':7,'TV-Y':0,'MA':17,'18':18,'16':16,'12':12,'12A':12,'15':15,'7':7,'6':6,'U':0,'0':0 }[(s || '').toUpperCase().trim()] || null;
    }
    function loadMeta(movie) {
        var id = movie.id || movie.tmdb_id;
        if (!id) return Promise.resolve({ kw: [], age: null, reviews: [], hasTrailer: false, enOv: '', budget: null, revenue: null, runtime: null, production_companies: [], production_countries: [], release_date: null });
        if (_metaCache[id]) return Promise.resolve(_metaCache[id]);
        if (Object.keys(_metaCache).length > 100) _metaCache = {};
        var type = mediaType(movie);
        return Promise.all([
            tmdbGet('/' + type + '/' + id + '/keywords'),
            tmdbGet('/' + type + '/' + id + '/content_ratings'),
            tmdbGet('/' + type + '/' + id + '/reviews'),
            tmdbGet('/' + type + '/' + id + '/videos'),
            tmdbGet('/' + type + '/' + id, 'en-US'),
            tmdbGet('/' + type + '/' + id)
        ]).then(function(arr){
            var kw = [];
            if (arr[0]) (arr[0].keywords || arr[0].results || []).forEach(function(k){ if (k && k.name) kw.push(k.name.toLowerCase()); });
            var age = null;
            if (arr[1] && arr[1].results) {
                var ru = arr[1].results.find(function(x){ return x.iso_3166_1 === 'RU'; });
                var us = arr[1].results.find(function(x){ return x.iso_3166_1 === 'US'; });
                var de = arr[1].results.find(function(x){ return x.iso_3166_1 === 'DE'; });
                var gb = arr[1].results.find(function(x){ return x.iso_3166_1 === 'GB'; });
                if (ru && ru.rating) { var n = parseInt(ru.rating); if (!isNaN(n)) age = n; }
                if (age === null && us && us.rating) age = mapUSRating(us.rating);
                if (age === null && de && de.rating) { var n = parseInt(de.rating.replace('FSK ', '')); if (!isNaN(n)) age = n; }
                if (age === null && gb && gb.rating) age = mapUSRating(gb.rating);
                if (age === null && arr[1].results.length > 0) { var f = arr[1].results[0]; if (f.rating) { var n = parseInt(f.rating); age = !isNaN(n) ? n : mapUSRating(f.rating); } }
            }
            var reviews = [];
            if (arr[2] && arr[2].results) reviews = arr[2].results.slice(0, 5).map(function(r){ return { author: r.author || 'Аноним', text: (r.content || '').replace(/<[^>]+>/g, '').trim() }; }).filter(function(r){ return r.text.length > 20; });
            var hasTrailer = false;
            if (arr[3] && arr[3].results) hasTrailer = arr[3].results.some(function(v){ return v.type === 'Trailer' && v.site === 'YouTube'; });
            var enOv = (arr[4] && arr[4].overview) ? arr[4].overview : '';
            var budget = null, revenue = null, runtime = null, production_companies = [], production_countries = [], release_date = null;
            if (arr[5]) {
                budget = arr[5].budget || null; revenue = arr[5].revenue || null; runtime = arr[5].runtime || null;
                release_date = arr[5].release_date || arr[5].first_air_date || null;
                if (arr[5].production_companies) production_companies = arr[5].production_companies.map(function(c){ return c.name || ''; }).filter(Boolean);
                if (arr[5].production_countries) production_countries = arr[5].production_countries.map(function(c){ return c.name || c.iso_3166_1 || ''; }).filter(Boolean);
            }
            var r = { kw: kw, age: age, reviews: reviews, hasTrailer: hasTrailer, enOv: enOv, budget: budget, revenue: revenue, runtime: runtime, production_companies: production_companies, production_countries: production_countries, release_date: release_date };
            _metaCache[id] = r; return r;
        });
    }
    function hasKw(ctx, re) { return ctx.kw.some(function(k){ return re.test(k); }); }
    function reviewTone(reviews) {
        if (!reviews.length) return { tone: null, sample: null };
        var posRe = /шедевр|великолепн|потрясающ|восхитит|блестящ|лучш|мощн|гениальн|masterpiece|brilliant|amazing|great|best|loved|perfect|outstanding|flawless|must-watch|замечательн|превосходн|отличн/i;
        var negRe = /скучн|ужасн|провал|разочаров|слаб|затян|бессмысл|плох|boring|bad|worst|terrible|awful|disappoint|waste|dull|pointless|ridiculous|утомительн|неинтересн/i;
        var pos = 0, neg = 0, firstNeg = null, firstPos = null;
        reviews.forEach(function(r){ var t = r.text.toLowerCase(); var p = (t.match(posRe) || []).length, n = (t.match(negRe) || []).length; if (p > n) { pos++; if (!firstPos) firstPos = r; } else if (n > p) { neg++; if (!firstNeg) firstNeg = r; } });
        var tone = (pos === 0 && neg === 0) ? null : (pos > neg + 1 ? 'pos' : (neg > pos + 1 ? 'neg' : 'mix'));
        var sample = (tone === 'neg' ? firstNeg : (tone === 'pos' ? firstPos : (firstNeg || firstPos))) || reviews[0];
        return { tone: tone, sample: sample };
    }

    /* ===== АНАЛИЗ ===== */
    function analyze(movie) {
        return Promise.all([ loadCredits(movie), loadMeta(movie) ]).then(function(arr){
            var credits = arr[0], meta = arr[1];
            var cfg = getSettings();
            var blG = parseBL(cfg.bad_genres), blA = parseBL(cfg.bad_actors), blD = parseBL(cfg.bad_directors);
            var now = new Date().getFullYear();

            var q = (movie.quality || movie.source_quality || '').toString().toUpperCase();
            var rating = parseFloat(movie.vote_average) || 0;
            var votes = parseInt(movie.vote_count) || 0;
            var runtime = parseInt(movie.runtime) || parseInt(meta.runtime) || 0;
            var genresRaw = movie.genres || [];
            var genres = genresRaw.map(function(g){ return typeof g === 'string' ? g : (g && g.name) || ''; }).filter(Boolean);
            var ovRu = (movie.overview || '').trim(), ovEn = (meta.enOv || '').trim(), ovBoth = [ovRu, ovEn];
            var age = meta.age;
            var yr = movie.release_date ? parseInt(movie.release_date.substring(0, 4)) : (meta.release_date ? parseInt(meta.release_date.substring(0, 4)) : 0);
            var rt = reviewTone(meta.reviews);
            var dataRich = !!(meta.kw.length || age !== null || meta.reviews.length || (credits && credits.crew && credits.crew.length) || meta.budget || meta.revenue);

            var cast = (credits && credits.cast || []).slice(0, 15).map(function(c){ return c.name; }).filter(Boolean);
            var crew = credits && credits.crew || [];
            var dirs = crew.filter(function(c){ return c.job === 'Director'; }).map(function(c){ return c.name; }).filter(Boolean);
            var wrts = crew.filter(function(c){ return ['Writer','Screenplay','Story','Author'].indexOf(c.job) >= 0; }).map(function(c){ return c.name; }).filter(Boolean);
            var ctx = { kw: meta.kw };

            var isAnim = genreByIdOrName(genresRaw, [GENRE_ID_ANIM], /animation|анимац|мульт|anime|аниме/);
            var hasFamilyGenre = genreByIdOrName(genresRaw, [GENRE_ID_FAMILY, GENRE_ID_KIDS], /family|семейн|kids|детск|for children|для детей/);
            var kidsKw = hasKw(ctx, /for kids|children|kids|family-friendly|kids tv|детям|семейн|для детей|child|family/i);

            var fDrugs    = inAnyText(ovBoth, /метамфетамин|варк|нарко|кокаин|героин|марихуан|каннабис|опиум|амфетамин/i) || inAnyText(ovBoth, /meth|cocaine|coke|heroin|marijuan|cannabis|substance|quaalude|lsd|ecstasy|opium|overdose|dealer|cartel|crack|drug use|drug deal|drug addict/i) || hasKw(ctx, /drug|narcotic|addiction|meth|cocaine|coke|heroin|marijuan|substance|quaalude|lsd|ecstasy|opium|overdose|dealer|cartel|crack/);
            var fNudity   = inAnyText(ovBoth, /обнаж|нагот|голы|эротик/i) || inAnyText(ovBoth, /nude|nudity|strip club|stripper|topless|bare chest|full frontal|rear nudity|sexual content/i) || hasKw(ctx, /nudity|female nudity|male nudity|full frontal|rear nudity|topless|bare chest|breast|strip club|stripper/);
            var fSex      = inAnyText(ovBoth, /эротик|откровен|оргазм|проститутк|интимн/i) || inAnyText(ovBoth, /orgy|threesome|one night stand|hooker|prostitut|seduction|affair|infidelity|erotic|explicit sex|orgasm|sex scene|sexual/i) || hasKw(ctx, /sex scene|sexual content|sexuality|orgy|prostitut|stripper|seduction|affair|infidelity|erotic|one night|threesome|hooker|explicit/) || !!movie.adult;
            var fViol     = inAnyText(ovBoth, /violenc|gore|murder|убийств|кров|жесток|насил|оружи|стрельб|резн|бойн|террор/i) || inAnyText(ovBoth, /tortur|brutal|weapon|gun|fight|massacre|execution|stab|slaughter|bloodshed|terror/i) || hasKw(ctx, /violenc|gore|murder|blood|tortur|brutal|weapon|gun|fight|massacre|execution|stab|slaughter/) || hasGenre(genres, /horror|ужас|slasher/i) || (hasGenre(genres, /crime|криминал/i) && hasGenre(genres, /thriller|триллер|action|боевик/i));
            var fSmoke    = inAnyText(ovBoth, /smok|курени|сигарет|табак/i) || inAnyText(ovBoth, /cigarette|smoking|cigar|vape|tobacco/i) || hasKw(ctx, /smok|cigarette|cigar/);
            var fAlcohol  = inAnyText(ovBoth, /alcohol|пьян|выпив|алкогол|водк|виски|пьяниц/i) || inAnyText(ovBoth, /drunkenness|drunk|booze|hangover|alcoholic|vodka|whiskey|binge|beer|wine/i) || hasKw(ctx, /alcohol|drunkenness|drunk|booze|hangover|alcoholic/);
            var fProfanity= inAnyText(ovBoth, /мат|нецензур|ругательств|брани|обсцен/i) || inAnyText(ovBoth, /profanity|f word|strong language|vulgarity|cursing|bad language|swearing|cuss|fuck|shit/i) || hasKw(ctx, /profanity|f word|strong language|vulgarity|cursing|bad language|swearing|cuss/);
            var fHate     = inAnyText(ovBoth, /hate|racis|нацист|расизм|ненавист|ксенофоб/i) || hasKw(ctx, /racis|nazi|homophob|white supremacist|xenophob/);
            var fGamb     = inAnyText(ovBoth, /casino|gambl|казино|ставк|bet|рулетк|покер|азарт/i) || hasKw(ctx, /casino|gambl|betting|poker|gambling/);
            var fSuicide  = inAnyText(ovBoth, /суицид|самоубийств|покончи/i) || inAnyText(ovBoth, /suicide|kill myself/i) || hasKw(ctx, /suicide|self harm/);
            var fAdultAnim= isAnim && (hasKw(ctx, /adult animation|dark comed|black comed|dysfunctional|mature|satire|for adults/i) || hasGenre(genres, /adult|18\+/i) || fDrugs || fNudity || fSex || fViol || fProfanity);
            var hardAdult = fDrugs || fNudity || fSex || fViol || fHate || fGamb || fSuicide || fAdultAnim || !!movie.adult;

            var familyOK;
            if (isAnim) {
                if (hardAdult) familyOK = false;
                else if (age !== null && age >= 16) familyOK = false;
                else if (hasFamilyGenre) familyOK = true;
                else if (age !== null && age <= 12) familyOK = true;
                else if (kidsKw) familyOK = true;
                else if (age !== null && age > 12) familyOK = false;
                else familyOK = false;
            } else {
                familyOK = !hardAdult && rating >= 5 && ((age !== null && age <= 12) || hasFamilyGenre || kidsKw);
            }

            var mG = genres.filter(function(g){ return blG.some(function(b){ return g.toLowerCase().indexOf(b) >= 0; }); });
            var mA = cast.filter(function(a){ return blA.some(function(b){ return a.toLowerCase().indexOf(b) >= 0; }); });
            var mD = [].concat(dirs, wrts).filter(function(p){ return blD.some(function(b){ return p.toLowerCase().indexOf(b) >= 0; }); });

            var P = [], C = [];
            function addP(t, w) { P.push({ t: t, w: w }); }
            function addC(t, w) { C.push({ t: t, w: w }); }

            if (rating >= 8.5 && votes >= 5000) addP('⭐ признание зрителей и критиков по всему миру', 35);
            else if (rating >= 8.0 && votes >= 3000) addP('⭐ высокие оценки зрителей и критиков', 30);
            else if (rating >= cfg.min_rating && votes >= 500) addP('⭐ стабильно хорошие оценки', 20);
            else if (rating >= cfg.min_rating && votes >= 100) addP('⭐ оценки выше вашего порога', 18);
            if (rating >= 7.8 && votes >= 100 && votes < 1500) addP('🔎 скрытая жемчужина с высоким рейтингом', 18);
            if (rating >= 8.0 && votes >= 2000 && yr > 0 && yr <= now - 3) addP('🏛 культовый фильм', 20);
            if (yr >= now - 1 && votes >= 200) addP('🔥 актуальный фильм — все обсуждают', 12);
            if (yr === now) addP('🆕 свежая новинка', 8);
            if (votes > 0 && votes < 30) addC('❓ мало оценок — вердикт осторожный', 12);
            if (votes === 0) addC('⚠️ нет оценок — данных недостаточно', 15);

            if (rt.tone === 'pos') addP('💬 зрители в восторге', 22);
            else if (rt.tone === 'neg') addC('💬 отрицательные отзывы зрителей', 25);
            else if (rt.tone === 'mix') { addP('💬 фильму дают полярные отзывы', 8); addC('💬 часть зрителей осталась разочарована', 10); }

            if (q && !/CAM|TS|HDCAM|SCR|WORKPRINT|TELESYNC|HDRIP|TELECINE/i.test(q)) addP('🎥 хорошее качество изображения (' + (q || 'HD') + ')', 10);
            if (q && /4K|UHD|2160p/i.test(q)) addP('🎥 отличное 4K-качество', 12);
            if (runtime > 0 && runtime <= 90) addP('🕐 удобная длительность для просмотра (' + runtime + ' мин)', 8);
            if (runtime > 90 && runtime <= 120) addP('🕐 оптимальная длительность (' + runtime + ' мин)', 6);
            if (meta.budget && meta.budget > 1000000) addP('💰 большой бюджет — ожидается качественная картинка', 12);
            if (meta.revenue && meta.budget && meta.revenue > meta.budget * 2) addP('📈 кассовый успех — собрал в 2+ раза больше бюджета', 15);

            if (familyOK) addP('👨‍👩‍‍👦 подходит для семейного просмотра', 16);
            if (hasGenre(genres, /documentary|документ/i)) addP('🦉 познавательный фильм', 10);
            if (inAnyText(ovBoth, /soundtrack|music|composer|score|музык|композитор|саундтрек/i) || hasKw(ctx, /music|soundtrack|composer|score/)) addP('🎵 запоминающаяся музыка', 10);
            if (hasGenre(genres, /action|боевик|экшен/i)) addP('💥 яркий экшен', 10);
            if (meta.hasTrailer) addP('▶ есть трейлер — можно оценить за 2 минуты', 6);
            if (hasGenre(genres, /comedy|комедия/i)) addP('😂 поднимет настроение', 8);
            if (hasGenre(genres, /adventure|приключения/i)) addP('🌍 увлекательные приключения', 8);
            if (hasGenre(genres, /sci-fi|фантастика|fantasy|фэнтези/i)) addP('🚀 погрузит в фантастический мир', 8);
            if (hasGenre(genres, /drama|драма/i) && rating >= 7.5) addP(isAnim ? '🎭 трогательная и глубокая история' : '🎭 сильная актёрская игра', 8);
            if (meta.production_companies && meta.production_companies.length > 0) {
                var famousStudios = ['warner bros','disney','universal','paramount','20th century','sony pictures','marvel','dc','pixar','dreamworks','hbo','netflix','a24'];
                if (meta.production_companies.some(function(c){ return famousStudios.some(function(s){ return c.toLowerCase().indexOf(s) >= 0; }); })) addP('🎬 произведён известной студией', 10);
            }

            if (rating > 0 && rating < cfg.min_rating && votes >= 100) addC('📉 оценки ниже вашего порога (' + rating.toFixed(1) + ')', 25);
            if (rating > 0 && rating < 5 && votes >= 50) addC('📉 низкие оценки зрителей (' + rating.toFixed(1) + ')', 30);
            if (mG.length) addC('⛔ нелюбимый жанр: ' + mG.join(', '), 40);
            if (mA.length) addC('⛔ нелюбимый актёр: ' + uniq(mA).slice(0,2).join(', '), 35);
            if (mD.length) addC('⛔ нелюбимый автор: ' + uniq(mD).slice(0,2).join(', '), 35);
            if (fNudity) addC('🫣 есть сцены с наготой', 16);
            if (fSex) addC('💋 сексуальные сцены', 16);
            if (fDrugs) addC('💉 затрагивается тема наркотиков', 18);
            if (fViol) addC('🔪 жестокие и кровавые сцены', 18);
            if (fSmoke) addC('🚬 показано курение', 8);
            if (fAlcohol) addC('🍺 присутствует алкоголь', 10);
            if (fProfanity) addC('🤬 много нецензурной лексики', 10);
            if (fHate) addC('🚩 есть мотивы ненависти', 20);
            if (fGamb) addC('🎰 затрагивается тема азартных игр', 12);
            if (fSuicide) addC('⚠️ затрагивается тема суицида', 20);
            if (runtime > 180) addC('⌛ длительный фильм (' + runtime + ' мин)', 12);
            if (runtime > 150 && runtime <= 180) addC('⌛ довольно длинный (' + runtime + ' мин)', 8);
            if (/CAM|TS|HDCAM|HDRIP|TELECINE|SCR|WORKPRINT|TELESYNC/i.test(q || '')) addC('📺 плохое качество изображения и звука', 28);
            if (age !== null && age >= 18) addC('🔞 только для взрослых (' + age + '+)', 15);
            else if (age !== null && age >= 16) addC('🔞 не для детей (' + age + '+)', 14);
            else if (age !== null && age >= 12) addC('🔞 рекомендуется с родителями (' + age + '+)', 10);
            if (isAnim && !familyOK) {
                if (hardAdult || (age !== null && age >= 16)) addC('🎭 мультфильм для взрослой аудитории' + (age !== null ? ' (' + age + '+)' : ''), 16);
                else addC('🎭 анимация не для детей — возможен взрослый юмор и темы', 14);
            }

            var score = 0;
            P.forEach(function(x){ score += x.w; }); C.forEach(function(x){ score -= x.w; });
            if (score > 100) score = 100; if (score < -100) score = -100;
            var norm = Math.round((score + 100) / 2);
            var vClass = score >= 25 ? 'yes' : (score <= -25 ? 'no' : 'maybe');
            var vWord = score >= 25 ? 'СТОИТ' : (score <= -25 ? 'НЕ СТОИТ' : 'СПОРНО');
            var topP = P.slice().sort(function(a,b){ return b.w - a.w; })[0];
            var topC = C.slice().sort(function(a,b){ return b.w - a.w; })[0];
            function strip(t) { return t ? t.replace(/^[^\s]+\s/, '') : ''; }
            var reason = '';
            if (vClass === 'yes') reason = (score >= 50 ? 'Определённо стоит посмотреть' : 'Стоит посмотреть') + (topP ? ' — ' + strip(topP.t) : '') + '.';
            else if (vClass === 'no') reason = (score <= -50 ? 'Лучше пропустить' : 'Не стоит тратить время') + (topC ? ' — ' + strip(topC.t) : '') + '.';
            else reason = 'Вердикт спорный' + (topP && topC ? ': за «' + strip(topP.t) + '», против «' + strip(topC.t) + '».' : '.') + ' Решайте сами.';
            if (!dataRich) reason += ' Данных маловато — вердикт осторожный.';

            var pros = P.map(function(x){ return x.t; });
            var cons = C.map(function(x){ return x.t; });
            if (!pros.length) pros.push('ℹ️ данных недостаточно для рекомендации');
            if (!cons.length) cons.push((blG.length || blA.length || blD.length) ? '✅ под ваши фильтры ничего не попало' : '✅ явных минусов не выявлено');

            var infoItems = [];
            if (rating > 0) infoItems.push({ label: 'Рейтинг', value: rating.toFixed(1) + '/10' });
            if (votes > 0) infoItems.push({ label: 'Голосов', value: votes.toLocaleString() });
            if (runtime > 0) infoItems.push({ label: 'Длительность', value: runtime + ' мин' });
            if (yr > 0) infoItems.push({ label: 'Год', value: yr });
            if (age !== null) infoItems.push({ label: 'Возраст', value: age + '+' });
            if (meta.budget) infoItems.push({ label: 'Бюджет', value: formatNumber(meta.budget) });
            if (meta.revenue) infoItems.push({ label: 'Сборы', value: formatNumber(meta.revenue) });
            if (meta.production_countries && meta.production_countries.length > 0) infoItems.push({ label: 'Страна', value: meta.production_countries.slice(0,2).join(', ') });
            if (dirs.length > 0) infoItems.push({ label: 'Режиссёр', value: dirs[0] });

            var audience = buildAudience(pros, cons, genres, rating, familyOK, age, isAnim, ctx);

            var ai = {
                title: movie.title || movie.name || 'Фильм', type: mediaType(movie),
                overview: ovRu || ovEn || '', genres: genres, cast: cast.slice(0, 6), directors: dirs, writers: wrts.slice(0, 3),
                rating: rating, votes: votes, runtime: runtime, year: yr, age: age, budget: meta.budget, revenue: meta.revenue,
                studios: meta.production_companies.slice(0, 3), countries: meta.production_countries.slice(0, 3), hasTrailer: meta.hasTrailer,
                familyOK: familyOK, isAnim: isAnim, reviewTone: rt.tone,
                flags: { viol: fViol, drugs: fDrugs, nudity: fNudity, sex: fSex, profanity: fProfanity, alcohol: fAlcohol, smoke: fSmoke, hate: fHate, suicide: fSuicide },
                vWord: vWord, vClass: vClass, reason: reason, pros: pros, cons: cons
            };

            return { pros: pros, cons: cons, audience: audience, review: rt, score: score, norm: norm, vClass: vClass, vWord: vWord, reason: reason, mode: dataRich ? 'TMDB' : 'TAGS', familyOK: familyOK, age: age, isAnim: isAnim, infoItems: infoItems, ai: ai };
        });
    }

    function buildAudience(pros, cons, genres, rating, familyOK, age, isAnim) {
        var hasCult = pros.some(function(p){ return /культ|классик|легендарн/i.test(p); });
        var hasHype = pros.some(function(p){ return /хайп|популярн|обсуждаем|тренд|актуальн/i.test(p); });
        var hasGem  = pros.some(function(p){ return /жемчужин|скрыт|недооцен|шедевр/i.test(p); });
        var hasAction = hasGenre(genres, /action|боевик|экшен/i);
        var hasMusic  = pros.some(function(p){ return /музык|саундтрек|композитор/i.test(p); });
        var hasDoc = hasGenre(genres, /documentary|документ/i), hasComedy = hasGenre(genres, /comedy|комед/i), hasDrama = hasGenre(genres, /drama|драма/i);
        var hasSciFi = hasGenre(genres, /sci-fi|fantasy|фантастик|фэнтези|космич/i), hasThriller = hasGenre(genres, /thriller|horror|триллер|ужас|мистик/i);
        var hasCrime = hasGenre(genres, /crime|криминал|детектив/i), hasAdventure = hasGenre(genres, /adventure|приключен/i), hasRomance = hasGenre(genres, /romance|мелодрама|любовн|романтич/i);
        var hasViolence = cons.some(function(c){ return /жесток|насили|кров|убийств/i.test(c); });
        var hasDrugs = cons.some(function(c){ return /нарко|метамфетамин|кокаин|героин/i.test(c); });
        var hasNudity = cons.some(function(c){ return /нагот|обнаж/i.test(c); });
        var hasStrongLang = cons.some(function(c){ return /мат|нецензур/i.test(c); });
        if (familyOK) return 'Семьям для совместного просмотра';
        var parts = [];
        if (hasCult && rating >= 8) parts.push('ценит классику и проверенные временем фильмы');
        else if (hasHype) parts.push('хочет быть в курсе актуального');
        else if (hasGem) parts.push('любит открывать недооценённые фильмы');
        else if (hasAction) parts.push('ищет динамичный сюжет');
        else if (hasThriller) parts.push('любит напряжённые истории');
        else if (hasComedy) parts.push('ищет повод для смеха');
        else if (hasDrama && rating >= 7) parts.push('ценит глубокие и эмоциональные истории');
        else if (hasSciFi) parts.push('любит фантастические миры');
        else if (hasDoc) parts.push('интересуется познавательным контентом');
        else if (hasMusic) parts.push('ценит качественную музыку');
        else if (hasAdventure) parts.push('жаждет увлекательных приключений');
        else if (hasRomance) parts.push('любит романтические истории');
        else if (hasCrime) parts.push('увлекается детективами и расследованиями');
        if (!parts.length) { if (rating >= 8) parts.push('ценит качественное кино'); else if (rating >= 6) parts.push('ищет интересный фильм для просмотра'); else parts.push('готов экспериментировать'); }
        var base = 'Тем, кто ' + parts[0];
        var warnings = [];
        if (hasViolence) warnings.push('жёстким сценам');
        if (hasDrugs) warnings.push('темам наркотиков');
        if (hasNudity) warnings.push('откровенным сценам');
        if (hasStrongLang) warnings.push('нецензурной лексике');
        if (age !== null && age >= 18) warnings.push('взрослому контенту (' + age + '+)');
        else if (age !== null && age >= 16) warnings.push('контенту для старших (' + age + '+)');
        if (warnings.length) base += ' и не против ' + warnings.join(', ');
        if (isAnim && !familyOK) base = 'Фанатам анимации, которые не против ' + (warnings.length ? warnings.join(', ') : 'взрослого юмора и тем');
        return base;
    }

    /* ===== ИИ: локальный мозг (мгновенно) ===== */
    function pick(arr, n) { return (arr || []).slice(0, n || 3).join(', '); }
    function generateLocalResponse(query, ai) {
        var t = (query || '').toLowerCase();
        var kind = ai.type === 'tv' ? 'сериал' : 'фильм';
        var title = ai.title;
        function ok(s) { return { text: s, precise: true }; }

        if (/^(привет|здравствуй|хай|хеллоу|hi|hello|йо)\b/.test(t) || t.indexOf('привет') === 0)
            return ok('Привет! Я изучил карточку «' + title + '». Спрашивай что угодно: сюжет, актёров, рейтинг, ценз — или стоит ли тратить вечер. А кнопкой «🌐 Найти в сети» я схожу в Википедию за подробностями.');
        if (/спасиб|благодар|thanks/.test(t)) return ok('Пожалуйста 🙂 Если что — я тут.');
        if (/похож|аналог|рекоменд.*друг|что ещё|что еще посмотреть/.test(t))
            return ok('Подбирать похожие тайтлы я пока не умею, но вот жанры «' + title + '»: ' + (ai.genres.length ? pick(ai.genres, 4) : 'не указаны') + ' — ищи по ним в каталоге.');

        if (/сюжет|о чём|о чем|про что|описание|суть|пересказ|что за фильм|что за сериал/.test(t)) {
            if (ai.overview) return ok('Если коротко: ' + ai.overview + (ai.genres.length ? ' По жанру это ' + pick(ai.genres, 4).toLowerCase() + '.' : ''));
            return { text: 'По карточке краткого описания нет.', precise: false };
        }
        if (/жанр|категор|направлен/.test(t)) return ok(ai.genres.length ? 'Жанры: ' + pick(ai.genres, 6) + '.' : 'Жанры в базе не указаны.');
        if (/актер|актёр|играет|играют|в ролях|каст|звезд|звёзд|снималс|снимались/.test(t)) return ok(ai.cast.length ? 'В главных ролях: ' + pick(ai.cast, 6) + '.' : 'Список актёров не подгрузился.');
        if (/режиссер|режиссёр|постановщик|снял кто|автор|сценарист|сценарий/.test(t)) {
            var d = ai.directors.length ? 'Режиссёр: ' + pick(ai.directors, 2) + '.' : '';
            var w = ai.writers.length ? ' Сценарий: ' + pick(ai.writers, 2) + '.' : '';
            return ok((d || w) ? (d + w) : 'Данные о съёмочной группе не подгрузились.');
        }
        if (/рейтинг|оценк|балл|оценили|мнени|отзыв|что говорят|как зрител/.test(t)) {
            var r = ai.rating > 0 ? 'Рейтинг на TMDB — ' + ai.rating.toFixed(1) + ' из 10' + (ai.votes ? ' (' + ai.votes.toLocaleString() + ' голосов)' : '') + '.' : 'Рейтинга пока нет.';
            var mood = ai.reviewTone === 'pos' ? ' Отзывы зрителей в основном восторженные.' : (ai.reviewTone === 'neg' ? ' Отзывы скорее критические.' : (ai.reviewTone === 'mix' ? ' Отзывы полярные — кому‑то зашло, кому‑то нет.' : ''));
            return ok(r + mood);
        }
        if (/стоит ли|рекоменд|посовету|смотреть или нет|заценить|тратить время/.test(t)) return ok('Мой вердикт: ' + ai.vWord + '. ' + ai.reason);
        if (/длительн|сколько длится|минут|хронометраж|продолжительн/.test(t)) return ok(ai.runtime ? 'Хронометраж: ' + ai.runtime + ' мин.' + (ai.type === 'tv' ? ' Это сериал, серий там побольше.' : '') : 'Точный хронометраж в базе не указан.');
        if (/год|когда вышел|дата выход|выпущен|свеж|новинк/.test(t)) return ok(ai.year ? ('Вышел в ' + ai.year + ' году.' + (ai.year >= new Date().getFullYear() - 1 ? ' То есть довольно свежее.' : '')) : 'Год выхода не указан.');
        if (/бюджет|стоил|сборы|касса|заработал|окупил|кассов/.test(t)) {
            var b = ai.budget ? 'Бюджет — ' + formatNumber(ai.budget) + '.' : '';
            var rv = ai.revenue ? ' Сборы — ' + formatNumber(ai.revenue) + '.' : '';
            var o = (ai.budget && ai.revenue) ? (ai.revenue > ai.budget * 2 ? ' В прокате сработал отлично.' : (ai.revenue > ai.budget ? ' В прокате окупился.' : ' В прокате, увы, не окупился.')) : '';
            return ok((b || rv) ? (b + rv + o) : 'Данных о бюджете и сборах в базе нет (часто так у сериалов).');
        }
        if (/стран|студия|производств|компани/.test(t)) {
            var c = ai.countries.length ? 'Страна: ' + pick(ai.countries, 3) + '.' : '';
            var st = ai.studios.length ? ' Студия/производство: ' + pick(ai.studios, 3) + '.' : '';
            return ok((c || st) ? (c + st) : 'Данные о производстве не подгрузились.');
        }
        if (/детск|для детей|семейн|ребенк|ребёнк|можно ли с детьм/.test(t)) {
            if (ai.familyOK) return ok('Да, подходит для семейного просмотра — можно смотреть с детьми.' + (ai.age !== null ? ' Возрастная метка: ' + ai.age + '+.' : ''));
            var why = [];
            if (ai.flags.viol) why.push('насилие'); if (ai.flags.profanity) why.push('мат'); if (ai.flags.nudity || ai.flags.sex) why.push('откровенные сцены'); if (ai.flags.drugs) why.push('тема наркотиков'); if (ai.age !== null && ai.age >= 16) why.push('ценз ' + ai.age + '+');
            return ok('С детьми — осторожно: это не семейный контент.' + (why.length ? ' Причина: ' + why.join(', ') + '.' : '') + (ai.age !== null ? ' Метка ' + ai.age + '+.' : ''));
        }
        if (/ценз|возраст|\d\+/.test(t)) return ok(ai.age !== null ? 'Возрастной ценз: ' + ai.age + '+.' : 'Точный ценз в базе не найден — смотри предупреждения в блоке «против».');
        if (/насили|кров|жесток|убийств/.test(t)) return ok(ai.flags.viol ? 'Да, есть жестокие/кровавые сцены.' : 'Сцен насилия по данным базы не обнаружено.');
        if (/мат|нецензур|ругательств|брань/.test(t)) return ok(ai.flags.profanity ? 'Да, нецензурная лексика присутствует.' : 'Мата по данным базы нет.');
        if (/нагот|обнаж|эротик|секс|постельн/.test(t)) return ok((ai.flags.nudity || ai.flags.sex) ? 'Да, есть откровенные/сексуальные сцены.' : 'Откровенных сцен по данным базы нет.');
        if (/наркот|выпивк|алкогол|курени|сигарет/.test(t)) {
            var w2 = []; if (ai.flags.drugs) w2.push('наркотики'); if (ai.flags.alcohol) w2.push('алкоголь'); if (ai.flags.smoke) w2.push('курение');
            return ok(w2.length ? ('Да, затрагивается: ' + w2.join(', ') + '.') : 'По данным базы — нет.');
        }
        if (/трейлер|ролик|превью/.test(t)) return ok(ai.hasTrailer ? 'Да, трейлер есть — глянь на карточке, составишь впечатление за пару минут.' : 'Трейлера в базе не нашлось.');
        if (/настроен|атмосфер|вайб|напряж|весел|грустн|мрачн|легк/.test(t)) {
            var v = [];
            if (hasGenre(ai.genres, /comedy|комед/i)) v.push('лёгкое и с юмором');
            if (hasGenre(ai.genres, /thriller|horror|триллер|ужас/i)) v.push('напряжённое и тревожное');
            if (hasGenre(ai.genres, /drama|драма/i)) v.push('эмоционально‑глубокое');
            if (hasGenre(ai.genres, /action|боевик/i)) v.push('драйвовое');
            if (hasGenre(ai.genres, /sci-fi|fantasy|фантаст|фэнтези/i)) v.push('с погружением в другой мир');
            return ok(v.length ? ('По настроению — скорее ' + v.join(', ') + '.') : 'Настроение лучше считать по трейлеру и отзывам.');
        }
        if (/плюс|минус|за и против|аргумент/.test(t)) return ok('Главное «за»: ' + (ai.pros[0] || '—') + '. Главное «против»: ' + (ai.cons[0] || '—') + '.');

        // fallback → пойдём в сеть
        var fb = 'По «' + title + '» (' + kind + ') у меня есть: ';
        var facts = [];
        if (ai.rating > 0) facts.push('рейтинг ' + ai.rating.toFixed(1));
        if (ai.year) facts.push(ai.year + ' год');
        if (ai.genres.length) facts.push('жанры: ' + pick(ai.genres, 3).toLowerCase());
        if (ai.age !== null) facts.push('ценз ' + ai.age + '+');
        fb += facts.length ? facts.join(', ') + '.' : 'данных в базе мало.';
        fb += ' Вердикт — ' + ai.vWord + '.';
        return { text: fb, precise: false };
    }

    /* ===== ИИ: сообщения чата ===== */
    function scrollMsgs(c) { try { c[0].scrollTop = c[0].scrollHeight; } catch(e) {} }
    function addAIMessage(c, type, text) { var m = $('<div class="sw-ai-message ' + type + '">' + esc(text) + '</div>'); c.append(m); scrollMsgs(c); }
    function addBotWithSource(c, text, srcTitle, srcUrl, failed) {
        var html = '<div>' + esc(text) + '</div>';
        if (srcUrl) html += '<a class="sw-ai-source" href="' + esc(srcUrl) + '" target="_blank" rel="noopener">🌐 Источник: ' + esc(srcTitle || 'Википедия') + '</a>';
        else if (failed) html += '<div class="sw-ai-source muted">🌐 В открытых источниках найти не удалось — ответил по карточке.</div>';
        var m = $('<div class="sw-ai-message bot">' + html + '</div>'); c.append(m); scrollMsgs(c);
    }
    function aiThinking(c) { var t = $('<div class="sw-ai-message bot"><div class="sw-ai-typing"><span></span><span></span><span></span></div></div>'); c.append(t); scrollMsgs(c); return t; }

    function initAIChat(html, data) {
        try {
            var cfg = getSettings(); if (!cfg.ai_enabled) return;
            var ai = data.ai;
            var chat = html.find('#sw-ai-chat'), aiBtn = html.find('#sw-ai-btn'), closeBtn = html.find('#sw-ai-close');
            var msgs = html.find('#sw-ai-messages'), input = html.find('#sw-ai-input'), sendBtn = html.find('#sw-ai-send');

            function send(query, forceWeb) {
                query = (query || '').trim(); if (!query) return;
                addAIMessage(msgs, 'user', query);
                var typing = aiThinking(msgs);
                var local = generateLocalResponse(query, ai);
                var useWeb = !!forceWeb || !local.precise;
                if (!useWeb) { try { typing.remove(); } catch(e) {} addAIMessage(msgs, 'bot', local.text); return; }
                wikiFetch(ai.title).then(function(w){
                    try { typing.remove(); } catch(e) {}
                    if (w) {
                        var ex = trimExtract(w.extract, 520);
                        var txt = '🌐 Нашёл в сети («' + (w.lang === 'en' ? 'англ. Википедия' : 'Википедия') + '»): ' + ex + '  ·  Мой вердикт по карточке: ' + ai.vWord + '.';
                        addBotWithSource(msgs, txt, w.title, w.url, false);
                    } else {
                        addBotWithSource(msgs, '🌐 В открытых источниках по запросу «' + ai.title + '» ничего подходящего не нашлось — возможно, статья называется иначе. ' + (local.text || ai.reason), null, null, true);
                    }
                });
            }

            aiBtn.on('hover:enter click keydown', function(e){
                if (e.type === 'keydown' && e.keyCode !== 13 && e.keyCode !== 32) return;
                window._sw_aiChatOpen = !window._sw_aiChatOpen;
                chat.toggleClass('visible', window._sw_aiChatOpen);
                if (window._sw_aiChatOpen) {
                    if (msgs.find('.sw-ai-message').length === 0) addAIMessage(msgs, 'bot', 'Привет! Я изучил «' + ai.title + '». Выбери вопрос кнопкой, нажми «🌐 Найти в сети» или напиши свой в поле ниже.');
                    scrollContainerTo(chat, false);
                    setTimeout(highlightVisible, 70);
                } else { focusRing(aiBtn); }
            });
            closeBtn.on('hover:enter click keydown', function(e){
                if (e.type === 'keydown' && e.keyCode !== 13 && e.keyCode !== 32) return;
                window._sw_aiChatOpen = false; chat.removeClass('visible'); focusRing(aiBtn);
            });
            html.find('.sw-ai-chip').on('hover:enter click keydown', function(e){
                if (e.type === 'keydown' && e.keyCode !== 13 && e.keyCode !== 32) return;
                if ($(this).attr('data-web')) send('Расскажи подробнее об этом фильме — факты из интернета', true);
                else send($(this).attr('data-q'), false);
            });
            sendBtn.on('hover:enter click keydown', function(e){
                if (e.type === 'keydown' && e.keyCode !== 13 && e.keyCode !== 32) return;
                var v = input.val(); input.val(''); send(v, false);
            });
            input.on('keydown', function(e){ if (e.keyCode === 13 && !e.shiftKey) { e.preventDefault(); sendBtn.trigger('click'); } });
        } catch(e) { console.error('[SW] initAIChat:', e); }
    }

    /* ===== КОНТРОЛЛЕР + capture-Enter ===== */
    function restorePrev() {
        var prev = window._sw_prevController; window._sw_prevController = null;
        try { if (prev && prev.name) Lampa.Controller.toggle(prev.name); else Lampa.Controller.toggle('full_start'); }
        catch(e) { try { Lampa.Controller.toggle('full'); } catch(_) {} }
    }
    function clearLoader() { if (window._sw_loaderTimer) { clearInterval(window._sw_loaderTimer); window._sw_loaderTimer = null; } }
    function swKeyCapture(e) {
        if (!window._sw_blocknav) return;
        var ae = document.activeElement;
        if (ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT')) return;
        if (e.keyCode === 13 || e.keyCode === 32) {
            var a = window._sw_activeInteractive;
            if (a) { e.preventDefault(); try { e.stopImmediatePropagation(); } catch(_) {} $(a).trigger('click'); }
        }
    }
    function cleanupModal() {
        window._sw_rolling = false; window._sw_currentModalHtml = null; window._sw_scrollContainer = null;
        window._sw_activeInteractive = null; window._sw_aiChatOpen = false;
        clearLoader();
        if (window._sw_keyBound) { document.removeEventListener('keydown', swKeyCapture, true); window._sw_keyBound = false; }
    }
    function registerController() {
        try {
            Lampa.Controller.add('should_watch_modal_enhanced', {
                toggle: function() {
                    var h = window._sw_currentModalHtml; if (!h) return;
                    refreshScrollContainer();
                    if (window._sw_blocknav) highlightVisible();
                },
                up: function() { if (window._sw_blocknav) scrollStep(-1); },
                down: function() { if (window._sw_blocknav) scrollStep(1); },
                left: function() { if (window._sw_blocknav) moveHorizontal(-1); },
                right: function() { if (window._sw_blocknav) moveHorizontal(1); },
                back: function() {
                    if (window._sw_aiChatOpen) {
                        window._sw_aiChatOpen = false;
                        var chat = window._sw_currentModalHtml.find('#sw-ai-chat');
                        chat.removeClass('visible'); focusRing(window._sw_currentModalHtml.find('#sw-ai-btn'));
                        return;
                    }
                    cleanupModal();
                    window._sw_closingFromController = true;
                    try { Lampa.Modal.close(); } catch(e) {}
                    restorePrev();
                }
            });
        } catch(e) { console.error('[SW] registerController:', e); }
    }

    /* ===== РЕНДЕР (инфо-блоки БЕЗ tabindex/фокуса) ===== */
    function buildReadyInner(a) {
        var badge = a.mode === 'TMDB'
            ? '<span class="sw-mode-badge tmdb"><span class="sw-mode-dot active"></span>TMDB</span>'
            : '<span class="sw-mode-badge tags"><span class="sw-mode-dot inactive"></span>TAGS</span>';
        var quote = '';
        if (a.review.sample) {
            var toneLabel = a.review.tone === 'pos' ? 'хвалебный' : (a.review.tone === 'neg' ? 'критический' : 'спорный');
            var toneCls = a.review.tone === 'pos' ? 'pos' : (a.review.tone === 'neg' ? 'neg' : 'mix');
            var txt = a.review.sample.text.length > 240 ? a.review.sample.text.substring(0, 240).trim() + '…' : a.review.sample.text;
            quote = '<div class="sw-quote"><div class="sw-quote-text">' + esc(txt) + '</div><div class="sw-quote-meta">— ' + esc(a.review.sample.author) + ', отзыв зрителя <span class="sw-quote-tone ' + toneCls + '">' + toneLabel + '</span></div></div>';
        }
        var infoGrid = '';
        if (a.infoItems && a.infoItems.length) {
            infoGrid = '<div class="sw-info-grid">' + a.infoItems.map(function(it){
                return '<div class="sw-info-item"><div class="sw-info-label">' + esc(it.label) + '</div><div class="sw-info-value">' + esc(it.value) + '</div></div>';
            }).join('') + '</div>';
        }
        var cfg = getSettings(), aiButton = '', aiChat = '';
        if (cfg.ai_enabled) {
            aiButton = '<button class="sw-btn sw-ai-btn sw-focusable" id="sw-ai-btn" tabindex="0"><span>🤖</span> Спросить ИИ</button>';
            aiChat = '<div class="sw-ai-chat" id="sw-ai-chat">' +
                '<div class="sw-ai-header"><span class="sw-ai-title">🤖 ИИ‑помощник по фильму</span><button class="sw-ai-close sw-focusable" id="sw-ai-close" tabindex="0">×</button></div>' +
                '<div class="sw-ai-messages" id="sw-ai-messages"></div>' +
                '<div class="sw-ai-suggestions">' +
                    '<div class="sw-ai-chip sw-focusable" data-q="О чём этот фильм?" tabindex="0">О чём?</div>' +
                    '<div class="sw-ai-chip sw-focusable" data-q="Кто играет и кто режиссёр?" tabindex="0">Актёры/режиссёр</div>' +
                    '<div class="sw-ai-chip sw-focusable" data-q="Какой рейтинг и что говорят зрители?" tabindex="0">Рейтинг и отзывы</div>' +
                    '<div class="sw-ai-chip sw-focusable" data-q="Можно ли смотреть с детьми?" tabindex="0">Для детей?</div>' +
                    '<div class="sw-ai-chip sw-focusable" data-q="Стоит ли смотреть?" tabindex="0">Стоит ли?</div>' +
                    '<div class="sw-ai-chip web sw-focusable" data-web="1" tabindex="0">🌐 Найти в сети</div>' +
                '</div>' +
                '<div class="sw-ai-input-row">' +
                    '<textarea class="sw-ai-input" id="sw-ai-input" placeholder="Или напиши свой вопрос…" rows="1" tabindex="0"></textarea>' +
                    '<button class="sw-ai-send sw-focusable" id="sw-ai-send" tabindex="0">➤</button>' +
                '</div>' +
                '<div class="sw-ai-hint">На ТВ: ↑↓ листают, ←→ переключают кнопки, OK — выбрать · на ПК/телефоне можно печатать</div>' +
                '</div>';
        }
        return '' +
            '<div class="sw-dossier">' + badge +
                '<div class="sw-verdict-word ' + a.vClass + '" id="sw-vword">' + esc(a.vWord) + '</div>' +
                '<div class="sw-verdict-reason" id="sw-vreason">' + esc(a.reason) + '</div>' +
                '<div class="sw-meter"><div class="sw-meter-fill ' + a.vClass + '" data-w="' + a.norm + '"></div></div>' +
            '</div>' +
            infoGrid +
            '<div class="sw-columns">' +
                '<div class="sw-col"><div class="sw-title pros">✓ Аргументы за</div><ul class="sw-list">' + a.pros.map(function(p){ return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>' +
                '<div class="sw-col"><div class="sw-title cons">✗ Аргументы против</div><ul class="sw-list">' + a.cons.map(function(c){ return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></div>' +
            '</div>' +
            quote +
            '<div class="sw-target-audience"><div class="sw-title target">🎯 Кому понравится</div><div class="sw-aud-text">' + esc(a.audience) + '</div></div>' +
            '<div class="sw-decision">' +
                '<div class="sw-decision-hint">Вердикт выше — а если колеблешься, брось кости или спроси ИИ</div>' +
                '<div class="sw-buttons-row">' +
                    '<button class="sw-btn sw-btn-primary sw-focusable" id="sw-dice-btn" tabindex="0"><span style="font-size:1.2em">🎲</span> Бросить кости</button>' +
                    aiButton +
                '</div>' +
                '<div class="sw-verdict-roll" id="sw-verdict"></div>' +
            '</div>' +
            aiChat;
    }

    function bindDice(html) {
        html.find('#sw-dice-btn').on('hover:enter click keydown', function(e){
            try {
                if (e.type === 'keydown' && e.keyCode !== 13 && e.keyCode !== 32) return;
                if (window._sw_rolling) return; window._sw_rolling = true;
                var btn = $(this), v = html.find('#sw-verdict');
                v.attr('style','').attr('class','sw-verdict-roll').text('');
                btn.addClass('shake');
                setTimeout(function(){
                    try {
                        btn.removeClass('shake');
                        if (Math.random() > 0.5) v.text('Смотреть!').addClass('verdict-yes');
                        else v.text('Не смотреть').addClass('verdict-no');
                        setTimeout(function(){ v.addClass('appear'); }, 20);
                        scrollContainerTo(v, false);
                        focusRing(btn);
                    } catch(err) { console.error('[SW] dice render:', err); }
                    window._sw_rolling = false;
                }, 520);
            } catch(err) { console.error('[SW] dice handler:', err); window._sw_rolling = false; }
        });
    }

    function showModal(movie) {
        try {
            var title = esc(movie.title || movie.name || 'Фильм');
            try { window._sw_prevController = Lampa.Controller.enabled ? Lampa.Controller.enabled() : null; } catch(e) { window._sw_prevController = null; }
            var phrases = ['🔍 Анализирую карточку…','📊 Тяну данные с TMDB…','💬 Читаю отзывы зрителей…','🎭 Проверяю ценз и теги…','⚖️ Взвешиваю аргументы…'];
            var html = $('<div class="sw-modal-content"><div id="sw-body"><div class="sw-loader"><div class="sw-loader-dice">🎲</div><div class="sw-loader-text" id="sw-loader-text">' + phrases[0] + '</div><div class="sw-loader-progress"></div></div></div></div>');
            window._sw_currentModalHtml = html; window._sw_activeInteractive = null;

            var pi = 0;
            window._sw_loaderTimer = setInterval(function(){
                pi = (pi + 1) % phrases.length;
                var t = html.find('#sw-loader-text');
                if (t.length) { t.css('opacity', 0); setTimeout(function(){ t.text(phrases[pi]).css('opacity', 1); }, 220); }
            }, 750);

            Lampa.Modal.open({
                title: 'Стоит ли смотреть: ' + title, html: html, size: 'large',
                onBack: function() {
                    var closing = window._sw_closingFromController;
                    cleanupModal();
                    if (closing) { window._sw_closingFromController = false; return; }
                    restorePrev();
                }
            });

            refreshScrollContainer();
            if (window._sw_blocknav && !window._sw_keyBound) { document.addEventListener('keydown', swKeyCapture, true); window._sw_keyBound = true; }

            analyze(movie).then(function(a){
                clearLoader();
                html.find('#sw-body').html('<div class="sw-body">' + buildReadyInner(a) + '</div>');
                refreshScrollContainer();
                bindDice(html);
                initAIChat(html, a);
                setTimeout(function(){
                    html.find('#sw-vword').addClass('appear');
                    html.find('#sw-vreason').addClass('appear');
                    html.find('.sw-meter-fill').each(function(){ this.style.width = (this.getAttribute('data-w') || 50) + '%'; });
                    html.find('.sw-list li').each(function(i){ var li = $(this); setTimeout(function(){ li.addClass('appear'); }, i * 45); });
                    if (window._sw_blocknav) highlightVisible();
                }, 120);
                Lampa.Controller.toggle('should_watch_modal_enhanced');
            }).catch(function(err){
                clearLoader(); console.error('[SW] analyze:', err);
                html.find('#sw-body').html('<div class="sw-body" style="text-align:center;padding:48px 20px;color:#d9534f">Не удалось проанализировать фильм. Проверьте сеть и попробуйте снова.</div>');
            });
        } catch(e) { console.error('[SW] showModal:', e); }
    }

    /* ===== ИНЪЕКЦИЯ ===== */
    function addBtn(el, movie) {
        try {
            if (!el || !el.length || el.find('.sw-custom-button-enhanced').length) return;
            var btn = $('<div class="full-start__button selector sw-custom-button-enhanced" data-type="should_watch"><div class="full-start__icon">' + ICON + '</div><span>Стоит ли?</span></div>');
            btn.on('hover:enter', function(){ if (movie) showModal(movie); });
            var anchor = el.find('.view--torrent,.view--online,.view--trailer').last();
            if (anchor.length) anchor.after(btn);
            else { var fb = el.find('.full-start__buttons,.full-start-new__buttons,.full-card__buttons'); if (fb.length) fb.append(btn); }
        } catch(e) { console.error('[SW] addBtn:', e); }
    }

    function startPlugin() {
        try {
            var ua = navigator.userAgent || '';
            var hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
            var isTV = /TV|SmartTV|HbbTV|Web0S|webOS|Tizen|NetCast|Viera|BRAVIA|CrKey|AFT|FireTV|POVIDE|Maple/i.test(ua);
            window._sw_blocknav = !hasTouch || isTV;
        } catch(e) { window._sw_blocknav = true; }
        try { registerController(); } catch(e) {}
        try { Lampa.Listener.follow('full', function(e){
            if (e.type !== 'complite') return;
            try {
                var renderEl = null;
                if (e.object && typeof e.object.render === 'function') renderEl = e.object.render();
                else if (e.object && e.object.activity && typeof e.object.activity.render === 'function') renderEl = e.object.activity.render();
                if (renderEl) addBtn(renderEl, e.data.movie);
            } catch(err) { console.error('[SW]', err); }
        }); } catch(e) {}
        try { initSettings(); } catch(e) {}
        try { injectCSS(); } catch(e) {}
        console.log('[ShouldWatch Enhanced] v6.0 (scroll-by-arrows, focus only on actions, web-enabled AI)');
    }
    try { if (window.appready) startPlugin(); else Lampa.Listener.follow('app', function(e){ if (e.type === 'ready') startPlugin(); }); } catch(e) {}
})();
