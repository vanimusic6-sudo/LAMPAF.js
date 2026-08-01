(function () {
    'use strict';
    if (window.should_watch_plugin_installed) return;
    window.should_watch_plugin_installed = true;

    var PLUGIN_ID = 'should_watch_plugin_enhanced';
    var ICON = '<svg viewBox="0 0 100 100" width="30" height="30" xmlns="http://www.w3.org/2000/svg"><g stroke="currentColor" stroke-width="8" stroke-linecap="square" fill="none"><path d="M20,55 L40,75 L80,25"/><path d="M25,25 L75,75" stroke-dasharray="4,4"/></g></svg>';
    var DISPLAY = '"Trebuchet MS","Segoe UI",system-ui,sans-serif';

    /* Стабильные ID жанров TMDB */
    var GENRE_ID_ANIM = 16;
    var GENRE_ID_FAMILY = 10751;
    var GENRE_ID_KIDS = 10762;

    // Состояние плагина
    window._sw_rolling = false;
    window._sw_currentModalHtml = null;
    window._sw_prevController = null;
    window._sw_closingFromController = false;
    window._sw_loaderTimer = null;
    window._sw_focusIdx = 0;
    window._sw_blocknav = true;
    window._sw_scrollContainer = null;
    window._sw_navPoints = [];
    window._sw_currentNavPoint = 0;
    window._sw_aiChatOpen = false;
    var _metaCache = {};

    /* ===== НАСТРОЙКИ ===== */
    function getSetting(k, d) {
        try { var v = Lampa.Storage.get(PLUGIN_ID + '_' + k); if (v !== undefined && v !== null && v !== '') return v; } catch(e) {} 
        return d;
    }
    function saveSetting(k, v) { 
        try { Lampa.SettingsApi && Lampa.Storage.set(PLUGIN_ID + '_' + k, v); } catch(e) {} 
    }
    function getSettings() {
        return {
            bad_genres: String(getSetting('bad_genres', '') || ''),
            bad_actors: String(getSetting('bad_actors', '') || ''),
            bad_directors: String(getSetting('bad_directors', '') || ''),
            min_rating: parseFloat(getSetting('min_rating', '6')) || 6,
            ai_enabled: getSetting('ai_enabled', true)
        };
    }
    function parseBL(s) { 
        return s ? s.split(',').map(function(x){ return x.trim().toLowerCase(); }).filter(Boolean) : []; 
    }
    function initSettings() {
        try {
            if (!window.Lampa || !Lampa.SettingsApi || window.sw_settings_ready) return;
            window.sw_settings_ready = true;
            Lampa.SettingsApi.addComponent({ 
                component: PLUGIN_ID, 
                name: 'Стоит ли смотреть?', 
                icon: ICON 
            });
            [
                { name: 'bad_genres', type: 'input', title: 'Нелюбимые жанры', description: 'Через запятую', default: '' },
                { name: 'bad_actors', type: 'input', title: 'Нелюбимые актёры', description: 'Через запятую', default: '' },
                { name: 'bad_directors', type: 'input', title: 'Нелюбимые авторы', description: 'Через запятую', default: '' },
                { name: 'min_rating', type: 'select', title: 'Мин. рейтинг', values: {'0':'Любой','5':'5.0','6':'6.0','7':'7.0','8':'8.0'}, default: '6' },
                { name: 'ai_enabled', type: 'toggle', title: 'Включить ИИ помощник', default: true }
            ].forEach(function(p) {
                Lampa.SettingsApi.addParam({
                    component: PLUGIN_ID,
                    param: { 
                        name: PLUGIN_ID + '_' + p.name, 
                        type: p.type, 
                        values: p.values || '', 
                        default: p.default 
                    },
                    field: { name: p.title, description: p.description }
                });
            });
        } catch(e) { console.error('[SW] initSettings:', e); }
    }

    /* ===== УЛУЧШЕННЫЕ СТИЛИ ===== */
    function injectCSS() {
        try {
            if (document.getElementById('sw-plugin-styles-enhanced')) return;
            var s = document.createElement('style'); 
            s.id = 'sw-plugin-styles-enhanced';
            s.innerHTML = 
                /* Основные стили модального окна */
                '.sw-modal-wrapper{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.88);z-index:10000;display:flex;flex-direction:column}' +
                '.sw-modal-content{padding:12px 14px 18px;color:#fff;font-family:' + DISPLAY + ';height:100vh;overflow-y:auto;-webkit-overflow-scrolling:touch;scroll-behavior:smooth;background:linear-gradient(180deg,rgba(12,12,12,.98) 0%,rgba(22,22,22,.96) 100%);display:flex;flex-direction:column}' +
                '#sw-body{flex:1;display:flex;flex-direction:column;min-height:0}' +
                '.sw-body > div{flex:1;display:flex;flex-direction:column;min-height:0}' +
                
                /* Скроллбар для десктопа */
                '.sw-modal-content::-webkit-scrollbar{width:5px}.sw-modal-content::-webkit-scrollbar-thumb{background:rgba(255,255,255,.2);border-radius:3px}.sw-modal-content::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.3)}' +
                
                /* Анимации появления */
                '.sw-body{animation:swFadeIn .4s cubic-bezier(.4,0,.2,1)}' +
                '@keyframes swFadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}' +
                
                /* Загрузчик */
                '.sw-loader{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:32px 12px;color:#cbd5e1;flex:1}' +
                '.sw-loader-dice{font-size:3.2em;line-height:1;animation:swBounce 1s ease-in-out infinite;filter:drop-shadow(0 4px 16px rgba(133,194,94,.45))}' +
                '.sw-loader-text{font-size:1.1em;font-weight:600;min-height:1.5em;transition:all .3s ease;color:#94a3b8;text-align:center;opacity:1}' +
                '.sw-loader-progress{width:200px;height:3px;border-radius:2px;background:rgba(255,255,255,.06);overflow:hidden;position:relative;margin-top:8px}' +
                '.sw-loader-progress::after{content:"";position:absolute;left:-100%;top:0;height:100%;width:100%;background:linear-gradient(90deg,transparent,#85c25e,#4caf50,transparent);animation:swSlide 1.8s linear infinite}' +
                
                /* Досье (верхний блок) */
                '.sw-dossier{position:relative;padding:18px 20px;border-radius:14px;margin-bottom:18px;overflow:hidden;background:linear-gradient(150deg,rgba(255,255,255,.05),rgba(255,255,255,.01));border:1px solid rgba(255,255,255,.06);box-shadow:0 2px 8px rgba(0,0,0,.15);animation:swRise .5s cubic-bezier(.22,1,.36,1) both}' +
                '.sw-dossier::before{content:"";position:absolute;inset:0;background:radial-gradient(120% 80% at 100% 0%,rgba(133,194,94,.08),transparent 50%);pointer-events:none}' +
                
                /* Вердикт */
                '.sw-verdict-word{font-family:' + DISPLAY + ';font-size:2.4em;font-weight:900;letter-spacing:-.02em;line-height:1;margin:0 0 4px;text-transform:uppercase;text-shadow:0 2px 4px rgba(0,0,0,.2)}' +
                '.sw-verdict-word.yes{color:#85c25e;text-shadow:0 0 20px rgba(133,194,94,.3)}.sw-verdict-word.no{color:#d9534f;text-shadow:0 0 20px rgba(217,83,79,.3)}.sw-verdict-word.maybe{color:#e0a93b;text-shadow:0 0 20px rgba(224,169,59,.3)}' +
                '.sw-verdict-reason{font-size:.98em;color:#c4ccd6;line-height:1.5;margin:0 0 14px;max-width:60ch}' +
                
                /* Прогресс-бар */
                '.sw-meter{height:8px;border-radius:5px;background:rgba(0,0,0,.4);overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,.3)}' +
                '.sw-meter-fill{height:100%;width:0;border-radius:5px;transition:width 1.2s cubic-bezier(.22,1,.36,1)}' +
                '.sw-meter-fill.yes{background:linear-gradient(90deg,#6ba82f,#85c25e)}.sw-meter-fill.no{background:linear-gradient(90deg,#c9302c,#d9534f)}.sw-meter-fill.maybe{background:linear-gradient(90deg,#d48a2b,#e0a93b)}' +
                
                /* Бейджи режима */
                '.sw-mode-badge{position:absolute;top:12px;right:14px;display:inline-flex;align-items:center;gap:5px;font-size:.68em;padding:3px 10px;border-radius:8px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:rgba(0,0,0,.3);color:#ccc}' +
                '.sw-mode-badge.tmdb{background:#0d8050;color:#fff}.sw-mode-badge.tags{background:rgba(255,255,255,.12);color:#aaa}' +
                '.sw-mode-dot{width:6px;height:6px;border-radius:50%;display:inline-block}' +
                '.sw-mode-dot.active{background:#85c25e;animation:swPulse 1.4s ease-in-out infinite}.sw-mode-dot.inactive{background:#777}' +
                
                /* Колонки плюсов/минусов */
                '.sw-columns{display:flex;justify-content:space-between;gap:14px;margin-bottom:16px;flex-wrap:wrap}' +
                '.sw-col{flex:1;min-width:260px;background:rgba(255,255,255,.03);padding:14px 16px;border-radius:11px;border:1px solid rgba(255,255,255,.05);transition:all .2s ease}' +
                '.sw-col:hover{border-color:rgba(255,255,255,.1);background:rgba(255,255,255,.04)}' +
                '.sw-title{font-family:' + DISPLAY + ';font-size:.95em;font-weight:800;margin-bottom:11px;text-transform:uppercase;display:flex;align-items:center;gap:7px;letter-spacing:.03em}' +
                '.sw-title.pros{color:#85c25e}.sw-title.cons{color:#d9534f}.sw-title.target{color:#e0e0e0}' +
                '.sw-list{margin:0;padding-left:16px;font-size:.92em;line-height:1.55;color:#cdd3db}.sw-list li{margin-bottom:8px;animation:swFade .4s ease both}' +
                
                /* Цитата */
                '.sw-quote{position:relative;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:16px 18px 14px 46px;margin-bottom:16px}' +
                '.sw-quote::before{content:"\\"\\"\\";position:absolute;left:10px;top:0;font-size:2.8em;line-height:1;color:rgba(255,255,255,.12);font-family:Georgia,serif;font-weight:700}' +
                '.sw-quote-text{font-size:.98em;line-height:1.55;color:#dfe5ec;font-style:italic}' +
                '.sw-quote-meta{margin-top:8px;font-size:.78em;color:#8b929c}' +
                '.sw-quote-tone{display:inline-block;padding:2px 8px;border-radius:6px;font-style:normal;font-weight:700;margin-left:7px;text-transform:uppercase;font-size:.72em;letter-spacing:.05em}' +
                '.sw-quote-tone.pos{background:rgba(133,194,94,.15);color:#9bd07a}.sw-quote-tone.neg{background:rgba(217,83,79,.15);color:#e88}.sw-quote-tone.mix{background:rgba(224,169,59,.15);color:#e7c06a}' +
                
                /* Целевая аудитория */
                '.sw-target-audience{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);padding:14px 16px;border-radius:11px;line-height:1.6;color:#d6dce4;font-size:.98em;margin-bottom:16px}' +
                '.sw-aud-text{font-size:1.02em;line-height:1.55;color:#d6dce4}' +
                
                /* Блок решения */
                '.sw-decision{text-align:center;padding:16px 16px;background:rgba(255,255,255,.02);border-radius:12px;border:1px solid rgba(255,255,255,.05);margin-bottom:12px}' +
                '.sw-decision-hint{font-size:.82em;color:#8b929c;margin-bottom:10px}' +
                
                /* Кнопки */
                '.sw-buttons-row{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}' +
                '.sw-dice-btn{background:linear-gradient(135deg,#eadecd,#d6e8d4);color:#1a1a1a;font-family:' + DISPLAY + ';font-size:1.1em;font-weight:800;padding:11px 24px;border-radius:25px;display:inline-flex;align-items:center;gap:10px;transition:all .2s;cursor:pointer;outline:none;border:2px solid transparent;box-shadow:0 2px 6px rgba(0,0,0,.1)}' +
                '.sw-dice-btn.focus{background:#fff;transform:scale(1.03);box-shadow:0 0 0 3px #fff,0 0 16px rgba(255,255,255,.4);border-color:#fff}' +
                '.sw-dice-btn:hover:not(.focus){transform:translateY(-1px);box-shadow:0 4px 10px rgba(0,0,0,.15)}' +
                '.sw-dice-btn.shake{animation:swShake .5s}' +
                
                '.sw-ai-btn{background:linear-gradient(135deg,#d6e8d4,#eadecd);color:#1a1a1a;font-family:' + DISPLAY + ';font-size:1.1em;font-weight:800;padding:11px 24px;border-radius:25px;display:inline-flex;align-items:center;gap:10px;transition:all .2s;cursor:pointer;outline:none;border:2px solid transparent;box-shadow:0 2px 6px rgba(0,0,0,.1)}' +
                '.sw-ai-btn.focus{background:#fff;transform:scale(1.03);box-shadow:0 0 0 3px #fff,0 0 16px rgba(255,255,255,.4);border-color:#fff}' +
                '.sw-ai-btn:hover:not(.focus){transform:translateY(-1px);box-shadow:0 4px 10px rgba(0,0,0,.15)}' +
                
                /* Результат броска костей */
                '.sw-verdict-roll{margin-top:10px;font-family:' + DISPLAY + ';font-size:1.35em;font-weight:900;min-height:30px;text-transform:uppercase;letter-spacing:.01em;transition:all .2s}' +
                '.sw-verdict-roll.verdict-yes{color:#85c25e!important;text-shadow:0 0 12px rgba(133,194,94,.35)}' +
                '.sw-verdict-roll.verdict-no{color:#d9534f!important;text-shadow:0 0 12px rgba(217,83,79,.35)}' +
                
                /* ИИ чат */
                '.sw-ai-chat{display:none;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:16px;margin-top:12px;animation:swRise .3s ease}' +
                '.sw-ai-chat.visible{display:block}' +
                '.sw-ai-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.05)}' +
                '.sw-ai-title{font-size:1.05em;font-weight:700;color:#dfe5ec}' +
                '.sw-ai-close{background:none;border:none;color:#8b929c;cursor:pointer;font-size:1.3em;padding:2px 6px;transition:color .2s}' +
                '.sw-ai-close:hover{color:#fff}' +
                '.sw-ai-messages{max-height:200px;overflow-y:auto;margin-bottom:12px;padding-right:4px}' +
                '.sw-ai-messages::-webkit-scrollbar{width:4px}.sw-ai-messages::-webkit-scrollbar-thumb{background:rgba(255,255,255,.2);border-radius:2px}' +
                '.sw-ai-message{padding:8px 12px;border-radius:8px;margin-bottom:8px;font-size:.9em;line-height:1.45;animation:swFade .3s ease}' +
                '.sw-ai-message.user{background:rgba(133,194,94,.15);color:#dfe5ec;border-bottom-right-radius:2px}' +
                '.sw-ai-message.bot{background:rgba(255,255,255,.08);color:#cdd3db;border-bottom-left-radius:2px}' +
                '.sw-ai-input{display:flex;gap:8px;align-items:center}' +
                '.sw-ai-textarea{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#fff;font-family:' + DISPLAY + ';font-size:.95em;padding:8px 12px;resize:none;min-height:40px;max-height:80px;transition:border-color .2s}' +
                '.sw-ai-textarea:focus{outline:none;border-color:rgba(133,194,94,.5)}' +
                '.sw-ai-send{background:#85c25e;color:#fff;border:none;border-radius:6px;padding:8px 14px;cursor:pointer;font-weight:700;transition:background .2s}' +
                '.sw-ai-send:hover{background:#75a83f}.sw-ai-send:disabled{background:#555;cursor:not-allowed}' +
                '.sw-ai-typing{display:flex;gap:4px;padding:8px 0}' +
                '.sw-ai-typing span{width:6px;height:6px;background:rgba(255,255,255,.4);border-radius:50%;animation:swBounce .14s infinite ease-in-out both}' +
                '.sw-ai-typing span:nth-child(1){animation-delay:.0s}.sw-ai-typing span:nth-child(2){animation-delay:.15s}.sw-ai-typing span:nth-child(3){animation-delay:.3s}' +
                
                /* Дополнительная информация */
                '.sw-info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:16px}' +
                '.sw-info-item{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);border-radius:9px;padding:10px 12px;text-align:center}' +
                '.sw-info-label{font-size:.75em;color:#8b929c;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}' +
                '.sw-info-value{font-size:1.05em;font-weight:700;color:#dfe5ec}' +
                
                /* Фокус для TV */
                '.sw-focusable{outline:none;cursor:pointer;scroll-margin-top:16px;scroll-margin-bottom:16px}' +
                '.sw-focusable.focus{box-shadow:0 0 0 2px rgba(255,255,255,.8),0 0 16px rgba(255,255,255,.2);transition:box-shadow .15s ease}' +
                
                /* Навигационные точки */
                '.sw-nav-point{scroll-margin-top:30px;scroll-margin-bottom:30px}' +
                
                /* Анимации */
                '@keyframes swShake{0%,100%{transform:translate(1px,-2px) rotate(-1deg)}10%,30%,50%,70%,90%{transform:translate(-1px,2px) rotate(1deg)}20%,40%,60%,80%{transform:translate(-3px,0) rotate(0deg)}}' +
                '@keyframes swFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}' +
                '@keyframes swRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}' +
                '@keyframes swBounce{0%,100%{transform:translateY(0) rotate(-6deg)}50%{transform:translateY(-14px) rotate(6deg)}}' +
                '@keyframes swSlide{0%{left:-40%}100%{left:100%}}' +
                '@keyframes swPulse{0%,100%{box-shadow:0 0 0 0 rgba(133,194,94,.6)}50%{box-shadow:0 0 0 5px rgba(133,194,94,0)}}' +
                
                /* Адаптивность */
                '@media(max-width:768px){' +
                '.sw-verdict-word{font-size:2.0em}' +
                '.sw-columns{flex-direction:column}' +
                '.sw-col{min-width:auto}' +
                '.sw-buttons-row{flex-direction:column;align-items:stretch}' +
                '.sw-dice-btn,.sw-ai-btn{width:100%;justify-content:center}' +
                '.sw-modal-content{padding:12px 14px 20px;height:100vh}' +
                '}' +
                
                '@media(max-width:480px){' +
                '.sw-verdict-word{font-size:1.7em}' +
                '.sw-dossier{padding:14px 16px}' +
                '.sw-info-grid{grid-template-columns:repeat(2,1fr)}' +
                '}' +
                
                /* Фикс скролла на мобильных */
                '@media (hover: none) and (pointer: coarse){' +
                '.sw-modal-content{-webkit-overflow-scrolling:touch;touch-action:pan-y}' +
                '}';
            document.head.appendChild(s);
        } catch(e) { console.error('[SW] injectCSS:', e); }
    }

    /* ===== УТИЛИТЫ ===== */
    var escMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function esc(s) {
        if (typeof s !== 'string') return '';
        return s.replace(/[&<>"']/g, function(m) { return escMap[m]; });
    }
    function hasGenre(g, re) { return g.some(function(x){ return re.test((x || '').toLowerCase()); }); }
    function inText(s, re) { return re.test((s || '').toLowerCase()); }
    function inAnyText(texts, re) { return texts.some(function(s){ return inText(s, re); }); }
    function mediaType(m) { return (m && m.name && !m.title) ? 'tv' : 'movie'; }
    function formatNumber(num) { 
        if (num === null || num === undefined) return 'N/A';
        if (num >= 1000000) return '$' + (num/1000000).toFixed(1) + 'M';
        if (num >= 1000) return '$' + (num/1000).toFixed(0) + 'K';
        return '$' + num;
    }
    function formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        try {
            var d = new Date(dateStr);
            return d.toLocaleDateString('ru-RU', { year: 'numeric', month: 'short', day: 'numeric' });
        } catch(e) { return dateStr.substring(0, 10); }
    }

    /* ===== ДЕТЕКТОР ЖАНРОВ ПО ID + ИМЕНИ ===== */
    function genreByIdOrName(genresRaw, ids, nameRe) {
        if (!genresRaw || !genresRaw.length) return false;
        for (var i = 0; i < genresRaw.length; i++) {
            var g = genresRaw[i];
            if (g && typeof g === 'object') {
                if (g.id && ids.indexOf(g.id) >= 0) return true;
                if (nameRe.test((g.name || '').toLowerCase())) return true;
            } else if (typeof g === 'string') {
                if (nameRe.test(g.toLowerCase())) return true;
            }
        }
        return false;
    }

    /* ===== НАВИГАЦИЯ ДЛЯ TV ===== */
    function initNavPoints(html) {
        try {
            if (!html || !html.length) return;
            window._sw_navPoints = [];
            var topPoint = html.find('.sw-dossier');
            if (topPoint.length) { topPoint.addClass('sw-nav-point'); window._sw_navPoints.push(topPoint); }
            var columnsPoint = html.find('.sw-columns');
            if (columnsPoint.length) { columnsPoint.addClass('sw-nav-point'); window._sw_navPoints.push(columnsPoint); }
            var infoPoint = html.find('.sw-info-grid');
            if (infoPoint.length) { infoPoint.addClass('sw-nav-point'); window._sw_navPoints.push(infoPoint); }
            var quotePoint = html.find('.sw-quote');
            if (quotePoint.length) { quotePoint.addClass('sw-nav-point'); window._sw_navPoints.push(quotePoint); }
            var audiencePoint = html.find('.sw-target-audience');
            if (audiencePoint.length) { audiencePoint.addClass('sw-nav-point'); window._sw_navPoints.push(audiencePoint); }
            var decisionPoint = html.find('.sw-decision');
            if (decisionPoint.length) { decisionPoint.addClass('sw-nav-point'); window._sw_navPoints.push(decisionPoint); }
            var aiPoint = html.find('.sw-ai-chat');
            if (aiPoint.length) { aiPoint.addClass('sw-nav-point'); window._sw_navPoints.push(aiPoint); }
            if (!window._sw_navPoints.length) window._sw_navPoints = html.find('.sw-focusable');
            window._sw_currentNavPoint = 0;
        } catch(e) { console.error('[SW] initNavPoints:', e); }
    }
    function scrollToNavPoint(index) {
        try {
            if (!window._sw_navPoints || !window._sw_navPoints.length) return;
            if (index < 0) index = window._sw_navPoints.length - 1;
            if (index >= window._sw_navPoints.length) index = 0;
            var point = window._sw_navPoints[index];
            if (point && point.length) {
                try { 
                    point[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' }); 
                } catch(e) { 
                    var c = window._sw_scrollContainer; 
                    if (c && c.length) c[0].scrollTop = point[0].offsetTop - 20; 
                }
                setTimeout(function() {
                    try {
                        var ft = point.find('.sw-focusable').first(); 
                        if (!ft.length) ft = point;
                        window._sw_navPoints.forEach(function(p){ 
                            p.find('.sw-focusable').removeClass('focus'); 
                            p.removeClass('focus'); 
                        });
                        ft.addClass('focus');
                        try { ft[0].focus({ preventScroll: true }); } catch(_) {}
                        Lampa.Controller.collectionFocus(ft);
                    } catch(e) {}
                }, 200);
                window._sw_currentNavPoint = index;
            }
        } catch(e) { console.error('[SW] scrollToNavPoint:', e); }
    }
    function swSetFocus(i) {
        try {
            var h = window._sw_currentModalHtml; if (!h) return;
            var blocks = h.find('.sw-focusable'); if (!blocks.length) return;
            if (i < 0) i = 0; if (i >= blocks.length) i = blocks.length - 1;
            window._sw_focusIdx = i;
            blocks.removeClass('focus');
            var el = blocks.eq(i); el.addClass('focus');
            try { el[0].focus({ preventScroll: true }); } catch(e) { try { el[0].focus(); } catch(_) {} }
            try { el[0].scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch(e) {}
            try { Lampa.Controller.collectionFocus(el); } catch(e) {}
        } catch(e) { console.error('[SW] setFocus:', e); }
    }

    /* ===== ДОГРУЗКА ДАННЫХ ===== */
    function loadCredits(movie) {
        try {
            if (movie.credits && ((movie.credits.cast && movie.credits.cast.length) || (movie.credits.crew && movie.credits.crew.length))) 
                return Promise.resolve(movie.credits);
            var id = movie.id || movie.tmdb_id; if (!id) return Promise.resolve(null);
            if (Lampa.TMDB && typeof Lampa.TMDB.credits === 'function') {
                return new Promise(function(res) { 
                    Lampa.TMDB.credits(id, function(d){ res(d && !d.status_code ? d : null); }, function(){ res(null); }); 
                });
            }
        } catch(e) { console.error('[SW] loadCredits:', e); }
        return Promise.resolve(null);
    }
    function tmdbKey() { 
        try { if (Lampa.TMDB && Lampa.TMDB.key) return Lampa.TMDB.key; } catch(e) {} 
        return '4ef0d7355d9ffb5151e987764708ce96';
    }
    function curLangCode() { 
        try { var l = Lampa.Storage.get('language', 'ru') || 'ru'; return l + '-' + l.toUpperCase(); } catch(e) { return 'ru-RU'; } 
    }
    function tmdbGet(path, lang) {
        return new Promise(function(res) {
            try {
                var langCode = lang || curLangCode();
                var url = 'https://api.themoviedb.org/3' + path + (path.indexOf('?') > -1 ? '&' : '?') + 'language=' + langCode + '&api_key=' + tmdbKey();
                if (Lampa.Request && typeof Lampa.Request.get === 'function') {
                    Lampa.Request.get(url, function(data) { res(data && data.status_code ? null : data); }, function() { res(null); }, { dataType: 'json' });
                } else if (typeof fetch !== 'undefined') {
                    fetch(url).then(function(r){ return r.json(); }).then(function(d){ res(d && d.status_code ? null : d); }).catch(function(){ res(null); });
                } else res(null);
            } catch(e) { res(null); }
        });
    }
    function mapUSRating(s) {
        return {
            'G':0, 'PG':7, 'PG-13':13, 'R':17, 'NC-17':17,
            'TV-MA':17, 'TV-14':14, 'TV-PG':7, 'TV-G':0, 'TV-Y7':7, 'TV-Y':0,
            'MA':17, '18':18, '16':16, '12':12, '12A':12, '15':15, '7':7, '6':6, 'U':0, '0':0
        }[(s || '').toUpperCase().trim()] || null;
    }
    
    // Расширенная загрузка метаданных
    function loadMeta(movie) {
        var id = movie.id || movie.tmdb_id; 
        if (!id) return Promise.resolve({ 
            kw: [], age: null, reviews: [], hasTrailer: false, enOv: '', 
            budget: null, revenue: null, runtime: null, status: null, 
            production_companies: [], production_countries: [], 
            release_date: null, homepage: null, imdb_id: null
        });
        
        if (_metaCache[id]) return Promise.resolve(_metaCache[id]);
        if (Object.keys(_metaCache).length > 100) _metaCache = {};
        
        var type = mediaType(movie);
        
        return Promise.all([
            tmdbGet('/' + type + '/' + id + '/keywords'),
            tmdbGet('/' + type + '/' + id + '/content_ratings'),
            tmdbGet('/' + type + '/' + id + '/reviews'),
            tmdbGet('/' + type + '/' + id + '/videos'),
            tmdbGet('/' + type + '/' + id, 'en-US'),
            tmdbGet('/' + type + '/' + id + '?append_to_response=production_companies,production_countries,release_dates')
        ]).then(function(arr) {
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
                if (age === null && arr[1].results.length > 0) {
                    var first = arr[1].results[0];
                    if (first.rating) { var n = parseInt(first.rating); age = !isNaN(n) ? n : mapUSRating(first.rating); }
                }
            }

            var reviews = [];
            if (arr[2] && arr[2].results)
                reviews = arr[2].results.slice(0, 5).map(function(r){
                    return { author: r.author || 'Аноним', text: (r.content || '').replace(/<[^>]+>/g, '').trim() };
                }).filter(function(r){ return r.text.length > 20; });

            var hasTrailer = false;
            if (arr[3] && arr[3].results) hasTrailer = arr[3].results.some(function(v){ return v.type === 'Trailer' && v.site === 'YouTube'; });

            var enOv = (arr[4] && arr[4].overview) ? arr[4].overview : '';
            
            // Дополнительная информация
            var budget = null, revenue = null, runtime = null, status = null;
            var production_companies = [];
            var production_countries = [];
            var release_date = null;
            var homepage = null;
            var imdb_id = null;
            
            if (arr[5]) {
                budget = arr[5].budget || null;
                revenue = arr[5].revenue || null;
                runtime = arr[5].runtime || null;
                status = arr[5].status || null;
                homepage = arr[5].homepage || null;
                imdb_id = arr[5].imdb_id || null;
                release_date = arr[5].release_date || (arr[5].first_air_date || null);
                
                if (arr[5].production_companies) {
                    production_companies = arr[5].production_companies.map(function(c) { 
                        return c.name || ''; 
                    }).filter(Boolean);
                }
                if (arr[5].production_countries) {
                    production_countries = arr[5].production_countries.map(function(c) { 
                        return c.name || c.iso_3166_1 || ''; 
                    }).filter(Boolean);
                }
            }
            
            var r = { 
                kw: kw, age: age, reviews: reviews, hasTrailer: hasTrailer, enOv: enOv,
                budget: budget, revenue: revenue, runtime: runtime, status: status,
                production_companies: production_companies, production_countries: production_countries,
                release_date: release_date, homepage: homepage, imdb_id: imdb_id
            };
            _metaCache[id] = r;
            return r;
        });
    }
    function hasKw(ctx, re) { return ctx.kw.some(function(k){ return re.test(k); }); }

    function reviewTone(reviews) {
        if (!reviews.length) return { tone: null, sample: null };
        var posRe = /шедевр|великолепн|потрясающ|восхитит|блестящ|лучш|мощн|гениальн|masterpiece|brilliant|amazing|great|best|loved|perfect|outstanding|flawless|must-watch|замечательн|превосходн|отличн/i;
        var negRe = /скучн|ужасн|провал|разочаров|слаб|затян|бессмысл|плох|boring|bad|worst|terrible|awful|disappoint|waste|dull|pointless|ridiculous|утомительн|неинтересн/i;
        var pos = 0, neg = 0, firstNeg = null, firstPos = null;
        reviews.forEach(function(r) {
            var t = r.text.toLowerCase();
            var p = (t.match(posRe) || []).length, n = (t.match(negRe) || []).length;
            if (p > n) { pos++; if (!firstPos) firstPos = r; }
            else if (n > p) { neg++; if (!firstNeg) firstNeg = r; }
        });
        var tone = (pos === 0 && neg === 0) ? null : (pos > neg + 1 ? 'pos' : (neg > pos + 1 ? 'neg' : 'mix'));
        var sample = (tone === 'neg' ? firstNeg : (tone === 'pos' ? firstPos : (firstNeg || firstPos))) || reviews[0];
        return { tone: tone, sample: sample };
    }

    /* ===== АНАЛИЗ ФИЛЬМА (РАСШИРЕННЫЙ) ===== */
    function analyze(movie) {
        return Promise.all([ loadCredits(movie), loadMeta(movie) ]).then(function(arr) {
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

            var ovRu = (movie.overview || '').trim();
            var ovEn = (meta.enOv || '').trim();
            var ovBoth = [ovRu, ovEn];
            var age = meta.age || null;
            var yr = movie.release_date ? parseInt(movie.release_date.substring(0, 4)) : (meta.release_date ? parseInt(meta.release_date.substring(0, 4)) : 0);
            var rt = reviewTone(meta.reviews);
            var dataRich = !!(meta.kw.length || age !== null || meta.reviews.length || (credits && credits.crew && credits.crew.length) || meta.budget || meta.revenue);

            var cast = (credits && credits.cast || []).slice(0, 15).map(function(c){ return c.name; }).filter(Boolean);
            var crew = credits && credits.crew || [];
            var dirs = crew.filter(function(c){ return c.job === 'Director'; }).map(function(c){ return c.name; }).filter(Boolean);
            var wrts = crew.filter(function(c){ return ['Writer','Screenplay','Story','Author'].indexOf(c.job) >= 0; }).map(function(c){ return c.name; }).filter(Boolean);
            var ctx = { kw: meta.kw };

            /* Детектор жанров */
            var isAnim = genreByIdOrName(genresRaw, [GENRE_ID_ANIM], /animation|анимац|мульт|anime|аниме/);
            var hasFamilyGenre = genreByIdOrName(genresRaw, [GENRE_ID_FAMILY, GENRE_ID_KIDS], /family|семейн|kids|детск|for children|для детей/);
            var kidsKw = hasKw(ctx, /for kids|children|kids|family-friendly|kids tv|детям|семейн|для детей|child|family/i);

            /* Флаги взрослого контента */
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

            /* Логика семейности */
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

            // Рейтинг и голосование
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

            // Отзывы
            if (rt.tone === 'pos') addP('💬 зрители в восторге', 22);
            else if (rt.tone === 'neg') addC('💬 отрицательные отзывы зрителей', 25);
            else if (rt.tone === 'mix') { addP('💬 фильму дают полярные отзывы', 8); addC('💬 часть зрителей осталась разочарована', 10); }

            // Качество
            if (q && !/CAM|TS|HDCAM|SCR|WORKPRINT|TELESYNC|HDRIP|TELECINE/i.test(q)) addP('🎥 хорошее качество изображения (' + (q || 'HD') + ')', 10);
            if (q && /4K|UHD|2160p/i.test(q)) addP('🎥 отличное 4K-качество', 12);
            
            // Длительность
            if (runtime > 0 && runtime <= 90) addP('🕐 удобная длительность для просмотра (' + runtime + ' мин)', 8);
            if (runtime > 90 && runtime <= 120) addP('🕐 оптимальная длительность (' + runtime + ' мин)', 6);

            // Бюджет и сборы
            if (meta.budget && meta.budget > 1000000) addP('💰 большой бюджет — ожидается качественная картинка', 12);
            if (meta.revenue && meta.revenue > meta.budget * 2) addP('📈 кассовый успех — собрал в 2+ раза больше бюджета', 15);

            // Жанры и темы
            if (familyOK) addP('👨‍👩‍‍👦 подходит для семейного просмотра', 16);
            if (hasGenre(genres, /documentary|документ/i)) addP('🦉 познавательный фильм', 10);
            if (inAnyText(ovBoth, /soundtrack|music|composer|score|музык|композитор|саундтрек/i) || hasKw(ctx, /music|soundtrack|composer|score/)) addP('🎵 запоминающаяся музыка', 10);
            if (hasGenre(genres, /action|боевик|экшен/i)) addP('💥 яркий экшен', 10);
            if (meta.hasTrailer) addP('▶ есть трейлер — можно оценить за 2 минуты', 6);
            if (hasGenre(genres, /comedy|комедия/i)) addP('😂 поднимет настроение', 8);
            if (hasGenre(genres, /adventure|приключения/i)) addP('🌍 увлекательные приключения', 8);
            if (hasGenre(genres, /sci-fi|фантастика|fantasy|фэнтези/i)) addP('🚀 погрузит в фантастический мир', 8);
            if (hasGenre(genres, /drama|драма/i) && rating >= 7.5) addP(isAnim ? '🎭 трогательная и глубокая история' : '🎭 сильная актёрская игра', 8);
            
            // Производство
            if (meta.production_companies && meta.production_companies.length > 0) {
                var famousStudios = ['Warner Bros', 'Disney', 'Universal', 'Paramount', '20th Century', 'Sony Pictures', 'Marvel', 'DC', 'Pixar', 'DreamWorks'];
                var hasFamousStudio = meta.production_companies.some(function(c) { 
                    return famousStudios.some(function(s) { return c.toLowerCase().includes(s.toLowerCase()); }); 
                });
                if (hasFamousStudio) addP('🎬 произведён известной студией', 10);
            }

            // Отрицательные факторы
            if (rating > 0 && rating < cfg.min_rating && votes >= 100) addC('📉 оценки ниже вашего порога (' + rating.toFixed(1) + ')', 25);
            if (rating > 0 && rating < 5 && votes >= 50) addC('📉 низкие оценки зрителей (' + rating.toFixed(1) + ')', 30);

            if (mG.length) addC('⛔ нелюбимый жанр: ' + mG.join(', '), 40);
            if (mA.length) addC('⛔ нелюбимый актёр: ' + [].concat(mA).filter(function(v,i,s){return s.indexOf(v)===i;}).slice(0,2).join(', '), 35);
            if (mD.length) addC('⛔ нелюбимый автор: ' + [].concat(mD).filter(function(v,i,s){return s.indexOf(v)===i;}).slice(0,2).join(', '), 35);

            // Контент предупреждения
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

            // Расчёт оценки
            var score = 0;
            P.forEach(function(x){ score += x.w; });
            C.forEach(function(x){ score -= x.w; });
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

            // Дополнительная информация для отображения
            var infoItems = [];
            if (rating > 0) infoItems.push({ label: 'Рейтинг', value: rating.toFixed(1) + '/10' });
            if (votes > 0) infoItems.push({ label: 'Голосов', value: votes.toLocaleString() });
            if (runtime > 0) infoItems.push({ label: 'Длительность', value: runtime + ' мин' });
            if (yr > 0) infoItems.push({ label: 'Год', value: yr });
            if (age !== null) infoItems.push({ label: 'Возраст', value: age + '+' });
            if (meta.budget) infoItems.push({ label: 'Бюджет', value: formatNumber(meta.budget) });
            if (meta.revenue) infoItems.push({ label: 'Сборы', value: formatNumber(meta.revenue) });
            if (meta.status) infoItems.push({ label: 'Статус', value: meta.status });
            if (meta.production_countries && meta.production_countries.length > 0) 
                infoItems.push({ label: 'Страна', value: meta.production_countries.join(', ') });
            if (dirs.length > 0) infoItems.push({ label: 'Режиссёр', value: dirs[0] });

            var audience = buildAudience(pros, cons, genres, rating, familyOK, age, isAnim, ctx);

            return {
                pros: pros, cons: cons, audience: audience,
                review: rt, score: score, norm: norm,
                vClass: vClass, vWord: vWord, reason: reason,
                mode: dataRich ? 'TMDB' : 'TAGS',
                familyOK: familyOK, age: age, isAnim: isAnim,
                infoItems: infoItems,
                movie: {
                    title: movie.title || movie.name || 'Фильм',
                    id: movie.id || movie.tmdb_id,
                    type: mediaType(movie)
                }
            };
        });
    }

    /* ===== АУДИТОРИЯ ===== */
    function buildAudience(pros, cons, genres, rating, familyOK, age, isAnim, ctx) {
        var hasCult = pros.some(function(p){ return /культ|классик|легендарн/i.test(p); });
        var hasHype = pros.some(function(p){ return /хайп|популярн|обсуждаем|тренд|актуальн/i.test(p); });
        var hasGem  = pros.some(function(p){ return /жемчужин|скрыт|недооцен|шедевр/i.test(p); });
        var hasAction = hasGenre(genres, /action|боевик|экшен/i) || pros.some(function(p){ return /драйв|экшен|динамичн/i.test(p); });
        var hasMusic  = pros.some(function(p){ return /музык|саундтрек|композитор|мелоди/i.test(p); });
        var hasDoc    = hasGenre(genres, /documentary|документ/i);
        var hasComedy = hasGenre(genres, /comedy|комед/i);
        var hasDrama  = hasGenre(genres, /drama|драма/i);
        var hasSciFi  = hasGenre(genres, /sci-fi|fantasy|фантастик|фэнтези|космич/i);
        var hasThriller = hasGenre(genres, /thriller|horror|триллер|ужас|мистик/i);
        var hasCrime  = hasGenre(genres, /crime|криминал|детектив/i);
        var hasAdventure = hasGenre(genres, /adventure|приключен/i);
        var hasRomance = hasGenre(genres, /romance|мелодрама|любовн|романтич/i);

        var hasViolence  = cons.some(function(c){ return /жесток|насили|кров|убийств|бойн/i.test(c); }) || hasKw(ctx, /violenc|gore|murder|blood|brutal/);
        var hasDrugs     = cons.some(function(c){ return /нарко|метамфетамин|кокаин|героин/i.test(c); }) || hasKw(ctx, /drug|narcotic|meth|cocaine|heroin/);
        var hasNudity    = cons.some(function(c){ return /нагот|обнаж/i.test(c); }) || hasKw(ctx, /nudity|female nudity|male nudity/);
        var hasStrongLang= cons.some(function(c){ return /мат|нецензур/i.test(c); }) || hasKw(ctx, /profanity|strong language/);

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
        if (!parts.length) {
            if (rating >= 8) parts.push('ценит качественное кино');
            else if (rating >= 6) parts.push('ищет интересный фильм для просмотра');
            else parts.push('готов экспериментировать');
        }

        var base = 'Тем, кто ' + parts[0];
        var warnings = [];
        if (hasViolence) warnings.push('жёстким сценам');
        if (hasDrugs) warnings.push('темам наркотиков');
        if (hasNudity) warnings.push('откровенным сценам');
        if (hasStrongLang) warnings.push('нецензурной лексике');
        if (age !== null && age >= 18) warnings.push('взрослому контенту (' + age + '+)');
        else if (age !== null && age >= 16) warnings.push('контенту для старших (' + age + '+)');
        if (warnings.length) base += ' и не против ' + warnings.join(', ');

        if (isAnim && !familyOK) {
            base = 'Фанатам анимации, которые не против ' + (warnings.length ? warnings.join(', ') : 'взрослого юмора и тем');
        }
        return base;
    }

    /* ===== ИИ ЧАТ-БОТ ===== */
    function initAIChat(html, movieInfo) {
        try {
            var cfg = getSettings();
            if (!cfg.ai_enabled) return;
            
            var chatContainer = html.find('.sw-ai-chat');
            var aiBtn = html.find('.sw-ai-btn');
            var closeBtn = html.find('.sw-ai-close');
            var sendBtn = html.find('.sw-ai-send');
            var textarea = html.find('.sw-ai-textarea');
            var messagesContainer = html.find('.sw-ai-messages');
            
            // Открытие/закрытие чата
            aiBtn.on('hover:enter click keydown', function(e) {
                if (e.type === 'keydown' && e.keyCode !== 13 && e.keyCode !== 32) return;
                window._sw_aiChatOpen = !window._sw_aiChatOpen;
                chatContainer.toggleClass('visible', window._sw_aiChatOpen);
                if (window._sw_aiChatOpen) {
                    textarea.focus();
                    if (messagesContainer.find('.sw-ai-message').length === 0) {
                        // Приветственное сообщение
                        setTimeout(function() {
                            addAIMessage(messagesContainer, 'bot', 'Привет! Я помогу с информацией о фильме. Задайте вопрос.');
                        }, 200);
                    }
                }
                Lampa.Controller.collectionFocus(window._sw_aiChatOpen ? textarea : aiBtn);
            });
            
            closeBtn.on('hover:enter click keydown', function(e) {
                if (e.type === 'keydown' && e.keyCode !== 13 && e.keyCode !== 32) return;
                window._sw_aiChatOpen = false;
                chatContainer.removeClass('visible');
                Lampa.Controller.collectionFocus(aiBtn);
            });
            
            // Отправка сообщения
            var isProcessing = false;
            sendBtn.on('hover:enter click keydown', function(e) {
                if (e.type === 'keydown' && e.keyCode !== 13 && e.keyCode !== 32) return;
                if (isProcessing) return;
                var text = textarea.val().trim();
                if (!text) return;
                
                isProcessing = true;
                sendBtn.prop('disabled', true);
                
                // Добавляем сообщение пользователя
                addAIMessage(messagesContainer, 'user', text);
                textarea.val('');
                
                // Показываем индикатор ввода
                var typingIndicator = $('<div class="sw-ai-message bot sw-ai-typing"><span></span><span></span><span></span></div>');
                messagesContainer.append(typingIndicator);
                messagesContainer.scrollTop(messagesContainer[0].scrollHeight);
                
                // Симулируем ответ ИИ (в реальности можно использовать API)
                setTimeout(function() {
                    typingIndicator.remove();
                    var response = generateAIResponse(text, movieInfo);
                    addAIMessage(messagesContainer, 'bot', response);
                    isProcessing = false;
                    sendBtn.prop('disabled', false);
                    textarea.focus();
                }, 800);
            });
            
            // Отправка по Enter
            textarea.on('keydown', function(e) {
                if (e.keyCode === 13 && !e.shiftKey) {
                    e.preventDefault();
                    sendBtn.trigger('click');
                }
            });
            
        } catch(e) { console.error('[SW] initAIChat:', e); }
    }
    
    function addAIMessage(container, type, text) {
        var msg = $('<div class="sw-ai-message ' + type + '">' + esc(text) + '</div>');
        container.append(msg);
        container.scrollTop(container[0].scrollHeight);
    }
    
    function generateAIResponse(query, movieInfo) {
        // Базовые ответы на основе ключевых слов
        var movie = movieInfo.movie;
        var text = query.toLowerCase();
        
        if (text.includes('что это за фильм') || text.includes('о чём')) {
            return 'Это ' + (movie.type === 'tv' ? 'сериал' : 'фильм') + ' «' + movie.title + '». Рекомендую прочитать описание на карточке фильма для деталей.';
        }
        if (text.includes('стоит ли смотреть') || text.includes('рекомендуешь')) {
            return 'Смотрите вердикт выше! Он основан на анализе рейтинга, отзывов и ваших предпочтений.';
        }
        if (text.includes('рейтинг') || text.includes('оценка')) {
            return 'Рейтинг фильма на TMDB: ' + (movieInfo.score >= 0 ? movieInfo.score.toFixed(1) + '/100' : 'данных нет') + '. Подробнее в блоке информации.';
        }
        if (text.includes('жанр') || text.includes('категория')) {
            return 'Информацию о жанрах можно увидеть на карточке фильма.';
        }
        if (text.includes('сколько длится') || text.includes('длительность')) {
            var runtime = movieInfo.infoItems.find(function(item) { return item.label === 'Длительность'; });
            return runtime ? 'Длительность: ' + runtime.value : 'Данных о длительности нет.';
        }
        if (text.includes('год') || text.includes('когда вышел')) {
            var year = movieInfo.infoItems.find(function(item) { return item.label === 'Год'; });
            return year ? 'Год выпуска: ' + year.value : 'Данных о годе выхода нет.';
        }
        if (text.includes('бюджет') || text.includes('сколько стоил')) {
            var budget = movieInfo.infoItems.find(function(item) { return item.label === 'Бюджет'; });
            return budget ? 'Бюджет: ' + budget.value : 'Данных о бюджете нет.';
        }
        if (text.includes('сборы') || text.includes('касса')) {
            var revenue = movieInfo.infoItems.find(function(item) { return item.label === 'Сборы'; });
            return revenue ? 'Сборы: ' + revenue.value : 'Данных о сборах нет.';
        }
        if (text.includes('привет') || text.includes('hello') || text.includes('hi')) {
            return 'Привет! Какой фильм вас интересует?';
        }
        if (text.includes('спас') || text.includes('благодар')) {
            return 'Пожалуйста! Если есть ещё вопросы — задавайте.';
        }
        
        return 'Интересный вопрос! К сожалению, я могу отвечать только на основе доступных данных о фильме. Попробуйте уточнить вопрос.';
    }

    /* ===== КОНТРОЛЛЕР ===== */
    function restorePrev() {
        var prev = window._sw_prevController; window._sw_prevController = null;
        try { if (prev && prev.name) Lampa.Controller.toggle(prev.name); else Lampa.Controller.toggle('full_start'); }
        catch(e) { try { Lampa.Controller.toggle('full'); } catch(_) {} }
    }
    function clearLoader() { if (window._sw_loaderTimer) { clearInterval(window._sw_loaderTimer); window._sw_loaderTimer = null; } }
    function registerController() {
        try {
            Lampa.Controller.add('should_watch_modal_enhanced', {
                toggle: function() {
                    var h = window._sw_currentModalHtml; if (!h) return;
                    if (h[0]) h[0].scrollTop = 0;
                    if (window._sw_blocknav) {
                        var blocks = h.find('.sw-focusable');
                        try { Lampa.Controller.collectionSet(blocks); } catch(e) {}
                        swSetFocus(0); initNavPoints(h);
                    }
                },
                up: function() { 
                    if (window._sw_blocknav) { 
                        if (window._sw_aiChatOpen) {
                            // Навигация внутри чата
                            var textarea = window._sw_currentModalHtml.find('.sw-ai-textarea');
                            if (textarea.hasClass('focus')) {
                                // Переход к кнопке отправки
                                window._sw_currentModalHtml.find('.sw-ai-send').addClass('focus');
                                window._sw_currentModalHtml.find('.sw-ai-textarea').removeClass('focus');
                            }
                        } else if (window._sw_navPoints && window._sw_navPoints.length > 1) {
                            scrollToNavPoint(window._sw_currentNavPoint - 1); 
                        } else {
                            swSetFocus((window._sw_focusIdx || 0) - 1); 
                        }
                    }
                },
                down: function() { 
                    if (window._sw_blocknav) { 
                        if (window._sw_aiChatOpen) {
                            // Навигация внутри чата
                            var sendBtn = window._sw_currentModalHtml.find('.sw-ai-send');
                            if (sendBtn.hasClass('focus')) {
                                // Переход к текстовому полю
                                window._sw_currentModalHtml.find('.sw-ai-textarea').addClass('focus');
                                window._sw_currentModalHtml.find('.sw-ai-send').removeClass('focus');
                            }
                        } else if (window._sw_navPoints && window._sw_navPoints.length > 1) {
                            scrollToNavPoint(window._sw_currentNavPoint + 1); 
                        } else {
                            swSetFocus((window._sw_focusIdx || 0) + 1); 
                        }
                    }
                },
                left: function() {},
                right: function() {},
                back: function() {
                    // Закрытие чата если открыт
                    if (window._sw_aiChatOpen) {
                        window._sw_aiChatOpen = false;
                        var chatContainer = window._sw_currentModalHtml.find('.sw-ai-chat');
                        chatContainer.removeClass('visible');
                        Lampa.Controller.collectionFocus(window._sw_currentModalHtml.find('.sw-ai-btn'));
                        return;
                    }
                    
                    window._sw_rolling = false; window._sw_currentModalHtml = null; window._sw_focusIdx = 0;
                    window._sw_scrollContainer = null; window._sw_navPoints = []; window._sw_currentNavPoint = 0;
                    clearLoader(); window._sw_closingFromController = true;
                    try { Lampa.Modal.close(); } catch(e) {}
                    restorePrev();
                }
            });
        } catch(e) { console.error('[SW] registerController:', e); }
    }

    /* ===== РЕНДЕР ===== */
    function buildReadyInner(a) {
        var badge = a.mode === 'TMDB'
            ? '<span class="sw-mode-badge tmdb"><span class="sw-mode-dot active"></span>TMDB</span>'
            : '<span class="sw-mode-badge tags"><span class="sw-mode-dot inactive"></span>TAGS</span>';
        
        // Цитата
        var quote = '';
        if (a.review.sample) {
            var toneLabel = a.review.tone === 'pos' ? 'хвалебный' : (a.review.tone === 'neg' ? 'критический' : 'спорный');
            var toneCls = a.review.tone === 'pos' ? 'pos' : (a.review.tone === 'neg' ? 'neg' : 'mix');
            var txt = a.review.sample.text.length > 240 ? a.review.sample.text.substring(0, 240).trim() + '…' : a.review.sample.text;
            quote = '<div class="sw-quote sw-focusable" tabindex="0"><div class="sw-quote-text">' + esc(txt) + '</div><div class="sw-quote-meta">— ' + esc(a.review.sample.author) + ', отзыв зрителя<span class="sw-quote-tone ' + toneCls + '">' + toneLabel + '</span></div></div>';
        }
        
        // Дополнительная информация
        var infoGrid = '';
        if (a.infoItems && a.infoItems.length > 0) {
            infoGrid = '<div class="sw-info-grid sw-nav-point">' + 
                a.infoItems.map(function(item) {
                    return '<div class="sw-info-item sw-focusable" tabindex="0"><div class="sw-info-label">' + esc(item.label) + '</div><div class="sw-info-value">' + esc(item.value) + '</div></div>';
                }).join('') + 
                '</div>';
        }
        
        // Кнопки
        var cfg = getSettings();
        var aiButton = '';
        if (cfg.ai_enabled) {
            aiButton = '<button class="sw-ai-btn selector sw-focusable" id="sw-ai-btn" tabindex="0"><span>🤖</span> Спросить ИИ</button>';
        }
        
        // Чат ИИ
        var aiChat = '';
        if (cfg.ai_enabled) {
            aiChat = '<div class="sw-ai-chat" id="sw-ai-chat">' +
                '<div class="sw-ai-header">' +
                '<span class="sw-ai-title">ИИ Помощник</span>' +
                '<button class="sw-ai-close" id="sw-ai-close" tabindex="0">×</button>' +
                '</div>' +
                '<div class="sw-ai-messages" id="sw-ai-messages"></div>' +
                '<div class="sw-ai-input">' +
                '<textarea class="sw-ai-textarea sw-focusable" id="sw-ai-textarea" placeholder="Задайте вопрос о фильме..." rows="1" tabindex="0"></textarea>' +
                '<button class="sw-ai-send" id="sw-ai-send" tabindex="0">Отправить</button>' +
                '</div>' +
                '</div>';
        }
        
        return '' +
            '<div class="sw-dossier sw-focusable sw-nav-point" tabindex="0">' + badge +
                '<div class="sw-verdict-word ' + a.vClass + '">' + a.vWord + '</div>' +
                '<div class="sw-verdict-reason">' + esc(a.reason) + '</div>' +
                '<div class="sw-meter"><div class="sw-meter-fill ' + a.vClass + '" data-w="' + a.norm + '"></div></div>' +
            '</div>' +
            infoGrid +
            '<div class="sw-columns sw-nav-point">' +
                '<div class="sw-col sw-focusable" tabindex="0"><div class="sw-title pros">✓ Аргументы за</div><ul class="sw-list">' + a.pros.map(function(p, i){ return '<li style="animation-delay:' + (i * 0.05) + 's">' + esc(p) + '</li>'; }).join('') + '</ul></div>' +
                '<div class="sw-col sw-focusable" tabindex="0"><div class="sw-title cons">✗ Аргументы против</div><ul class="sw-list">' + a.cons.map(function(c, i){ return '<li style="animation-delay:' + (i * 0.05) + 's">' + esc(c) + '</li>'; }).join('') + '</ul></div>' +
            '</div>' +
            quote +
            '<div class="sw-target-audience sw-focusable sw-nav-point" tabindex="0"><div class="sw-title target">🎯 Кому понравится</div><div class="sw-aud-text">' + esc(a.audience) + '</div></div>' +
            '<div class="sw-decision sw-nav-point">' +
                '<div class="sw-decision-hint">Вердикт выше — а если колеблешься, доверься случаю или спроси ИИ</div>' +
                '<div class="sw-buttons-row">' +
                '<button class="sw-dice-btn selector sw-focusable" id="sw-dice-btn" tabindex="0"><span style="font-size:1.4em">🎲</span> Бросить кости</button>' +
                aiButton +
                '</div>' +
                '<div class="sw-verdict-roll" id="sw-verdict"></div>' +
            '</div>' +
            aiChat;
    }
    
    function bindDice(html) {
        html.find('#sw-dice-btn').on('hover:enter click keydown', function(e) {
            try {
                if (e.type === 'keydown' && e.keyCode !== 13 && e.keyCode !== 32) return;
                if (window._sw_rolling) return; window._sw_rolling = true;
                var btn = $(this), v = html.find('#sw-verdict');
                v.attr('style', '').attr('class', 'sw-verdict-roll').text('');
                btn.addClass('shake');
                setTimeout(function() {
                    try {
                        btn.removeClass('shake');
                        if (Math.random() > 0.5) v.text('Смотреть!').addClass('verdict-yes').css({color:'#85c25e',textShadow:'0 0 12px rgba(133,194,94,.35)'});
                        else v.text('Не смотреть').addClass('verdict-no').css({color:'#d9534f',textShadow:'0 0 12px rgba(217,83,79,.35)'});
                        Lampa.Controller.collectionFocus(btn);
                        try { btn[0].scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch(_) {}
                    } catch(err) { console.error('[SW] dice render:', err); }
                    window._sw_rolling = false;
                }, 500);
            } catch(err) { console.error('[SW] dice handler:', err); window._sw_rolling = false; }
        });
    }

    function showModal(movie) {
        try {
            var title = esc(movie.title || movie.name || 'Фильм');
            try { window._sw_prevController = Lampa.Controller.enabled ? Lampa.Controller.enabled() : null; } catch(e) { window._sw_prevController = null; }
            
            var phrases = [
                '🔍 Ищу информацию о фильме...',
                '📊 Загружаю данные с TMDB...',
                '🎬 Получаю жанры и рейтинг...',
                '💬 Анализирую отзывы зрителей...',
                '🎭 Проверяю возрастной ценз...',
                '🔍 Ищу трейлеры и дополнительную информацию...',
                '⚖️ Сравниваю с вашими настройками...',
                '🧠 Формирую финальный вердикт...'
            ];
            var html = $('<div class="sw-modal-wrapper"><div class="sw-modal-content"><div id="sw-body" style="flex:1;display:flex;flex-direction:column"><div class="sw-loader"><div class="sw-loader-dice">🎲</div><div class="sw-loader-text" id="sw-loader-text">' + phrases[0] + '</div><div class="sw-loader-progress"></div></div></div></div>');
            window._sw_currentModalHtml = html; window._sw_focusIdx = 0; window._sw_scrollContainer = html.find('.sw-modal-content');
            window._sw_navPoints = []; window._sw_currentNavPoint = 0;
            var pi = 0;
            window._sw_loaderTimer = setInterval(function() {
                pi = (pi + 1) % phrases.length; 
                var t = html.find('#sw-loader-text');
                if (t.length) { 
                    t.css('opacity', 0).animate({opacity: 0}, 150, function() {
                        t.text(phrases[pi]).css('opacity', 0);
                        t.animate({opacity: 1}, 200);
                    });
                }
            }, 600);

            Lampa.Modal.open({
                title: 'Стоит ли смотреть: ' + title, 
                html: html, 
                size: 'large',
                onBack: function() {
                    window._sw_rolling = false; window._sw_currentModalHtml = null; window._sw_focusIdx = 0;
                    window._sw_scrollContainer = null; window._sw_navPoints = []; window._sw_currentNavPoint = 0;
                    window._sw_aiChatOpen = false;
                    clearLoader();
                    if (window._sw_closingFromController) { window._sw_closingFromController = false; return; }
                    restorePrev();
                }
            });

            analyze(movie).then(function(a) {
                clearLoader();
                html.find('#sw-body').html('<div style="flex:1;display:flex;flex-direction:column;min-height:0">' + buildReadyInner(a) + '</div>');
                bindDice(html);
                initAIChat(html, a);
                setTimeout(function() { 
                    html.find('.sw-meter-fill').each(function(){ this.style.width = (this.getAttribute('data-w') || 50) + '%'; }); 
                }, 120);
                Lampa.Controller.toggle('should_watch_modal_enhanced');
            }).catch(function(err) {
                clearLoader(); console.error('[SW] analyze:', err);
                html.find('#sw-body').html('<div class="sw-body" style="text-align:center;padding:40px;color:#d9534f">Ошибка анализа. Попробуйте позже.</div>');
            });
        } catch(e) { console.error('[SW] showModal:', e); }
    }

    /* ===== ИНЪЕКЦИЯ ===== */
    function addBtn(el, movie) {
        try {
            if (!el || !el.length || el.find('.sw-custom-button-enhanced').length) return;
            var btn = $('<div class="full-start__button selector sw-custom-button-enhanced" data-type="should_watch"><div class="full-start__icon">' + ICON + '</div><span>Стоит ли?</span></div>');
            btn.on('hover:enter', function() { if (movie) showModal(movie); });
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
        try { 
            Lampa.Listener.follow('full', function(e) {
                if (e.type !== 'complite') return;
                try {
                    var renderEl = null;
                    if (e.object && typeof e.object.render === 'function') renderEl = e.object.render();
                    else if (e.object && e.object.activity && typeof e.object.activity.render === 'function') renderEl = e.object.activity.render();
                    if (renderEl) addBtn(renderEl, e.data.movie);
                } catch(err) { console.error('[SW]', err); }
            }); 
        } catch(e) {}
        try { initSettings(); } catch(e) {}
        try { injectCSS(); } catch(e) {}
        console.log('[ShouldWatch Enhanced] v2.0 (improved analysis, AI chat, better UI)');
    }
    try { if (window.appready) startPlugin(); else Lampa.Listener.follow('app', function(e){ if (e.type === 'ready') startPlugin(); }); } catch(e) {}
})();
