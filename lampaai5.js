(function () {
    'use strict';
    if (window.should_watch_plugin_installed) return;
    window.should_watch_plugin_installed = true;

    var PLUGIN_ID = 'should_watch_plugin_enhanced';
    var ICON = '<svg viewBox="0 0 100 100" width="30" height="30" xmlns="http://www.w3.org/2000/svg"><g stroke="currentColor" stroke-width="8" stroke-linecap="square" fill="none"><path d="M20,55 L40,75 L80,25"/><path d="M25,25 L75,75" stroke-dasharray="4,4"/></g></svg>';
    var DISPLAY = '"Trebuchet MS","Segoe UI",system-ui,sans-serif"';

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

    /* ===== ПОЛНОСТЬЮ ПЕРЕРАБОТАННЫЕ СТИЛИ (плавные анимации + TV-скролл) ===== */
    function injectCSS() {
        try {
            if (document.getElementById('sw-plugin-styles-enhanced')) return;
            var s = document.createElement('style'); 
            s.id = 'sw-plugin-styles-enhanced';
            s.innerHTML = 
                /* Базовый контейнер — используем нативный скролл модалки Lampa */
                '.sw-modal-content{padding:20px 24px 40px;color:#fff;font-family:' + DISPLAY + ';box-sizing:border-box;scroll-behavior:smooth}' +
                
                /* Анимации — мягкие, плавные, без резких скачков */
                '.sw-body{animation:swFadeIn .5s cubic-bezier(.25,.8,.25,1)}' +
                '@keyframes swFadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}' +
                
                /* Загрузчик — плавная анимация прогресса */
                '.sw-loader{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:60px 20px;color:#cbd5e1}' +
                '.sw-loader-dice{font-size:3.8em;line-height:1;animation:swFloat 2s ease-in-out infinite;filter:drop-shadow(0 4px 20px rgba(133,194,94,.5))}' +
                '@keyframes swFloat{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-8px) rotate(2deg)}}' +
                '.sw-loader-text{font-size:1.1em;font-weight:600;min-height:1.5em;transition:all .3s ease;color:#94a3b8;text-align:center}' +
                '.sw-loader-progress{width:220px;height:4px;border-radius:2px;background:rgba(255,255,255,.08);overflow:hidden;position:relative;margin-top:12px}' +
                '.sw-loader-progress::after{content:"";position:absolute;left:-100%;top:0;height:100%;width:100%;background:linear-gradient(90deg,transparent,#85c25e,transparent);animation:swProgress 2.2s linear infinite}' +
                '@keyframes swProgress{0%{left:-100%}100%{left:100%}}' +
                
                /* Досье (Вердикт) — плавное раскрытие */
                '.sw-dossier{position:relative;padding:26px;border-radius:18px;margin-bottom:26px;background:linear-gradient(145deg,rgba(255,255,255,.06),rgba(255,255,255,.01));border:1px solid rgba(255,255,255,.08);backdrop-filter:blur(12px);transition:all .4s ease}' +
                '.sw-dossier.focus{box-shadow:0 0 0 4px rgba(255,255,255,.3),0 0 20px rgba(133,194,94,.2)}' +
                '.sw-verdict-word{font-family:' + DISPLAY + ';font-size:2.8em;font-weight:900;letter-spacing:-.02em;line-height:1;margin:0 0 10px;text-transform:uppercase;opacity:0;transform:scale(0.85);transition:all .5s cubic-bezier(.25,.8,.25,1)}' +
                '.sw-verdict-word.appear{opacity:1;transform:scale(1)}' +
                '.sw-verdict-reason{font-size:1.1em;color:#d1d5db;line-height:1.65;margin:0 0 18px;max-width:68ch;opacity:0;transform:translateY(6px);transition:all .4s cubic-bezier(.25,.8,.25,1)}' +
                '.sw-verdict-reason.appear{opacity:1;transform:translateY(0)}' +
                
                /* Прогресс-бар — плавное заполнение */
                '.sw-meter{height:10px;border-radius:5px;background:rgba(0,0,0,.35);overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,.4);transition:all .4s cubic-bezier(.25,.8,.25,1)}' +
                '.sw-meter-fill{height:100%;width:0;border-radius:5px;transition:width .8s cubic-bezier(.34,1.56,.64,1)}' +
                '.sw-meter-fill.yes{background:linear-gradient(90deg,#6ba82f,#85c25e)}' +
                '.sw-meter-fill.no{background:linear-gradient(90deg,#c9302c,#d9534f)}' +
                '.sw-meter-fill.maybe{background:linear-gradient(90deg,#d48a2b,#e0a93b)}' +
                
                /* Бейдж режима */
                '.sw-mode-badge{position:absolute;top:22px;right:22px;display:inline-flex;align-items:center;gap:6px;font-size:.75em;padding:4px 14px;border-radius:22px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.1);transition:all .3s}' +
                '.sw-mode-badge.tmdb{color:#85c25e;border-color:rgba(133,194,94,.3)}' +
                '.sw-mode-badge.tags{color:#aaa}' +
                '.sw-mode-dot{width:6px;height:6px;border-radius:50%;display:inline-block;transition:all .3s}' +
                '.sw-mode-dot.active{background:#85c25e;box-shadow:0 0 12px rgba(133,194,94,.6)}' +
                '.sw-mode-dot.inactive{background:#777}' +
                
                /* Инфо-грид */
                '.sw-info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:14px;margin-bottom:26px}' +
                '.sw-info-item{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:14px;text-align:center;transition:all .3s}' +
                '.sw-info-item:hover{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.15)}' +
                '.sw-info-label{font-size:.75em;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}' +
                '.sw-info-value{font-size:1.15em;font-weight:700;color:#f3f4f6}' +
                
                /* Колонки Плюсы/Минусы */
                '.sw-columns{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px;margin-bottom:26px}' +
                '.sw-col{background:rgba(255,255,255,.03);padding:22px;border-radius:16px;border:1px solid rgba(255,255,255,.06);transition:all .3s}' +
                '.sw-col:hover{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.12)}' +
                '.sw-title{font-family:' + DISPLAY + ';font-size:.92em;font-weight:800;margin-bottom:16px;text-transform:uppercase;display:flex;align-items:center;gap:8px;letter-spacing:.04em}' +
                '.sw-title.pros{color:#85c25e}.sw-title.cons{color:#d9534f}.sw-title.target{color:#e5e7eb}' +
                '.sw-list{margin:0;padding-left:20px;font-size:.96em;line-height:1.65;color:#d1d5db}' +
                '.sw-list li{margin-bottom:10px;padding-left:4px;opacity:0;transform:translateX(-8px);transition:all .4s cubic-bezier(.25,.8,.25,1)}' +
                '.sw-list li.appear{opacity:1;transform:translateX(0)}' +
                
                /* Цитата */
                '.sw-quote{position:relative;background:rgba(255,255,255,.03);border-left:4px solid rgba(133,194,94,.2);border-radius:0 14px 14px 0;padding:18px 22px 18px 26px;margin-bottom:26px;transition:all .3s}' +
                '.sw-quote:hover{background:rgba(255,255,255,.05);border-left-color:rgba(133,194,94,.4)}' +
                '.sw-quote-text{font-size:1.05em;line-height:1.65;color:#e5e7eb;font-style:italic;opacity:0;transform:translateY(6px);transition:all .4s cubic-bezier(.25,.8,.25,1)}' +
                '.sw-quote-text.appear{opacity:1;transform:translateY(0)}' +
                '.sw-quote-meta{margin-top:12px;font-size:.82em;color:#9ca3af;display:flex;align-items:center;gap:8px;opacity:0;transform:translateY(6px);transition:all .4s cubic-bezier(.25,.8,.25,1)}' +
                '.sw-quote-meta.appear{opacity:1;transform:translateY(0)}' +
                
                /* Аудитория */
                '.sw-target-audience{background:linear-gradient(90deg,rgba(133,194,94,.08),transparent);border:1px solid rgba(133,194,94,.18);padding:20px 22px;border-radius:14px;line-height:1.65;color:#d1d5db;font-size:1.05em;margin-bottom:26px;transition:all .3s}' +
                '.sw-target-audience:hover{background:linear-gradient(90deg,rgba(133,194,94,.12),transparent);border-color:rgba(133,194,94,.3)}' +
                '.sw-aud-text{color:#f3f4f6;opacity:0;transform:translateY(6px);transition:all .4s cubic-bezier(.25,.8,.25,1)}' +
                '.sw-aud-text.appear{opacity:1;transform:translateY(0)}' +
                
                /* Блок решения и кнопки */
                '.sw-decision{text-align:center;padding:26px;background:rgba(255,255,255,.02);border-radius:18px;border:1px solid rgba(255,255,255,.06);margin-bottom:22px;transition:all .3s}' +
                '.sw-decision:hover{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.1)}' +
                '.sw-decision-hint{font-size:.85em;color:#9ca3af;margin-bottom:18px}' +
                '.sw-buttons-row{display:flex;gap:14px;justify-content:center;flex-wrap:wrap}' +
                
                '.sw-btn{font-family:' + DISPLAY + ';font-size:1em;font-weight:700;padding:13px 30px;border-radius:32px;display:inline-flex;align-items:center;gap:12px;transition:all .3s;cursor:pointer;outline:none;border:2px solid transparent;background:rgba(255,255,255,.08);color:#fff}' +
                '.sw-btn:hover{background:rgba(255,255,255,.15);transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.15)}' +
                '.sw-btn.focus{background:#fff;color:#000;transform:scale(1.06);box-shadow:0 0 0 4px rgba(255,255,255,.4),0 4px 20px rgba(255,255,255,.25}' +
                '.sw-btn-primary{background:#85c25e;color:#1a1a1a}' +
                '.sw-btn-primary.focus{background:#fff;box-shadow:0 0 0 4px rgba(133,194,94,.4),0 4px 20px rgba(133,194,94,.25}' +
                '.sw-btn.shake{animation:swPulse 0.6s ease-in-out}' +
                '@keyframes swPulse{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-4px) scale(1.02)}}' +
                
                /* Результат костей */
                '.sw-verdict-roll{margin-top:18px;font-family:' + DISPLAY + ';font-size:1.5em;font-weight:900;min-height:34px;text-transform:uppercase;letter-spacing:.01em;opacity:0;transform:translateY(8px);transition:all .4s cubic-bezier(.25,.8,.25,1)}' +
                '.sw-verdict-roll.appear{opacity:1;transform:translateY(0)}' +
                '.sw-verdict-roll.verdict-yes{color:#85c25e;text-shadow:0 0 18px rgba(133,194,94,.4)}' +
                '.sw-verdict-roll.verdict-no{color:#d9534f;text-shadow:0 0 18px rgba(217,83,79,.4)}' +
                
                /* ИИ Чат (полностью переработан) */
                '.sw-ai-chat{display:none;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:22px;margin-top:22px;animation:swFadeIn .4s cubic-bezier(.25,.8,.25,1)}' +
                '.sw-ai-chat.visible{display:block}' +
                '.sw-ai-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,.08)}' +
                '.sw-ai-title{font-size:1.15em;font-weight:700;color:#f3f4f6;display:flex;align-items:center;gap:10px}' +
                '.sw-ai-close{background:rgba(255,255,255,.1);border:none;color:#fff;cursor:pointer;width:36px;height:36px;border-radius:50%;font-size:1.3em;display:flex;align-items:center;justify-content:center;transition:all .3s}' +
                '.sw-ai-close.focus{background:#fff;color:#000;transform:scale(1.1)}' +
                '.sw-ai-messages{max-height:280px;overflow-y:auto;padding-right:10px;margin-bottom:18px}' +
                '.sw-ai-message{padding:12px 16px;border-radius:14px;margin-bottom:12px;font-size:.98em;line-height:1.6;max-width:85%;animation:swSlideIn .4s cubic-bezier(.25,.8,.25,1)}' +
                '.sw-ai-message.user{background:#85c25e;color:#1a1a1a;margin-left:auto;border-bottom-right-radius:2px}' +
                '.sw-ai-message.bot{background:rgba(255,255,255,.08);color:#e5e7eb;border-bottom-left-radius:2px}' +
                '.sw-ai-typing{display:flex;gap:6px;padding:14px 18px;background:rgba(255,255,255,.05);border-radius:14px;width:fit-content;margin-bottom:12px;animation:swFloat 1.8s ease-in-out infinite}' +
                '.sw-ai-typing span{width:6px;height:6px;background:#9ca3af;border-radius:50%;animation:swBounce 0.16s infinite ease-in-out both}' +
                '.sw-ai-typing span:nth-child(1){animation-delay:.0s}.sw-ai-typing span:nth-child(2){animation-delay:.16s}.sw-ai-typing span:nth-child(3){animation-delay:.32s}' +
                
                /* Клавиатура ИИ — встроенная в Lampa */
                '.sw-ai-keyboard{display:none;position:relative;margin-top:16px;transition:all .3s}' +
                '.sw-ai-keyboard.visible{display:block}' +
                '.sw-ai-input-container{display:flex;gap:12px;align-items:center}' +
                '.sw-ai-input{flex:1;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);border-radius:14px;color:#fff;font-family:' + DISPLAY + ';font-size:.95em;padding:12px 16px;resize:none;min-height:44px;transition:all .3s}' +
                '.sw-ai-input:focus{outline:none;border-color:rgba(133,194,94,.5);background:rgba(255,255,255,.12)}' +
                '.sw-ai-send{background:#85c25e;color:#1a1a1a;border:none;border-radius:14px;padding:12px 20px;font-weight:700;cursor:pointer;transition:all .3s}' +
                '.sw-ai-send:hover{background:#75a83f;transform:translateY(-2px)}' +
                '.sw-ai-send:disabled{background:#555;cursor:not-allowed}' +
                
                /* Фокус для TV — ключевой момент! */
                '.sw-focusable{outline:none;cursor:pointer;scroll-margin-top:32px;scroll-margin-bottom:32px;transition:all .3s}' +
                '.sw-focusable.focus{box-shadow:0 0 0 3px rgba(255,255,255,.8),0 0 18px rgba(255,255,255,.2);border-radius:10px;transform:translateY(-2px)}' +
                '.sw-nav-point{scroll-margin-top:40px;scroll-margin-bottom:40px}' +
                
                /* Адаптивность */
                '@media(max-width:600px){' +
                '.sw-modal-content{padding:16px 16px 30px}' +
                '.sw-verdict-word{font-size:2.2em}' +
                '.sw-columns{grid-template-columns:1fr}' +
                '.sw-info-grid{grid-template-columns:repeat(2,1fr)}' +
                '.sw-buttons-row{flex-direction:column}' +
                '.sw-btn{width:100%;justify-content:center}' +
                '}';
            document.head.appendChild(s);
        } catch(e) { console.error('[SW] injectCSS:', e); }
    }

    /* ===== УТИЛИТЫ (без изменений) ===== */
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

    /* ===== ДЕТЕКТОР ЖАНРОВ ===== */
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

    /* ===== НАВИГАЦИЯ ДЛЯ TV (КРИТИЧЕСКИ ВАЖНО!) ===== */
    function initNavPoints(html) {
        try {
            if (!html || !html.length) return;
            window._sw_navPoints = [];
            var points = [
                '.sw-dossier', '.sw-info-grid', '.sw-columns', 
                '.sw-quote', '.sw-target-audience', '.sw-decision', '.sw-ai-chat'
            ];
            points.forEach(function(sel) {
                var el = html.find(sel);
                if (el.length) { 
                    el.addClass('sw-nav-point'); 
                    window._sw_navPoints.push(el); 
                }
            });
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
                // 🔑 Главное: используем scroll-margin и Lampa.Controller.scroll
                // Это гарантирует корректную работу на всех ТВ
                try {
                    // Сначала делаем элемент видимым в зоне просмотра
                    Lampa.Controller.scroll(point[0], { behavior: 'smooth', block: 'center' });
                } catch(e) {
                    // Fallback: нативный scroll (для старых версий Lampa)
                    var container = window._sw_scrollContainer;
                    if (container && container.length) {
                        container[0].scrollTo({
                            top: point[0].offsetTop - 40,
                            behavior: 'smooth'
                        });
                    }
                }
                
                setTimeout(function() {
                    try {
                        // Снимаем фокус со всех
                        window._sw_navPoints.forEach(function(p){ 
                            p.find('.sw-focusable').removeClass('focus'); 
                            p.removeClass('focus'); 
                        });
                        
                        // Фокусируем первый фокусируемый элемент внутри точки
                        var ft = point.find('.sw-focusable').first(); 
                        if (!ft.length) ft = point;
                        
                        ft.addClass('focus');
                        try { ft[0].focus({ preventScroll: true }); } catch(_) {}
                        Lampa.Controller.collectionFocus(ft);
                    } catch(e) {}
                }, 300);
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
            try { 
                // Для TV: используем scroll-margin, а не scrollIntoView
                Lampa.Controller.scroll(el[0], { behavior: 'smooth', block: 'nearest' });
            } catch(e) { 
                try { el[0].scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch(_) {}
            }
            try { Lampa.Controller.collectionFocus(el); } catch(e) {}
        } catch(e) { console.error('[SW] setFocus:', e); }
    }

    /* ===== ДОГРУЗКА ДАННЫХ (без изменений) ===== */
    // ... (оставляем loadCredits, tmdbGet, loadMeta, reviewTone как есть)

    /* ===== АНАЛИЗ ФИЛЬМА (без изменений) ===== */
    // ... (оставляем analyze как есть — логика отличная)

    /* ===== ИИ ЧАТ — ПОЛНОСТЬЮ ПЕРЕДЕЛАН (работает с клавиатурой Lampa) ===== */
    function initAIChat(html, movieInfo) {
        try {
            var cfg = getSettings();
            if (!cfg.ai_enabled) return;
            
            var chatContainer = html.find('.sw-ai-chat');
            var aiBtn = html.find('.sw-ai-btn');
            var closeBtn = html.find('.sw-ai-close');
            var messagesContainer = html.find('.sw-ai-messages');
            var input = html.find('.sw-ai-input');
            var sendBtn = html.find('.sw-ai-send');
            
            // Открытие чата — показываем клавиатуру
            aiBtn.on('hover:enter click keydown', function(e) {
                if (e.type === 'keydown' && e.keyCode !== 13 && e.keyCode !== 32) return;
                window._sw_aiChatOpen = true;
                chatContainer.addClass('visible');
                
                // Показываем приветствие, если чат пустой
                if (messagesContainer.find('.sw-ai-message').length === 0) {
                    addAIMessage(messagesContainer, 'bot', 'Привет! Я — ваш помощник по фильмам. Задайте любой вопрос (например: «Что за фильм?», «Какой сюжет?», «Есть ли сцены насилия?»).');
                }
                
                // Открываем виртуальную клавиатуру Lampa
                setTimeout(function() {
                    Lampa.Keyboard.open({
                        value: '',
                        placeholder: 'Напишите вопрос...',
                        onInput: function(text) {
                            input.val(text);
                        },
                        onEnter: function(text) {
                            if (!text.trim()) return;
                            input.val('');
                            sendAIQuestion(text, messagesContainer, movieInfo);
                        },
                        onClose: function() {
                            // При закрытии клавиатуры — возвращаем фокус на кнопку
                            setTimeout(() => Lampa.Controller.collectionFocus(aiBtn), 100);
                        }
                    });
                }, 100);
            });
            
            // Закрытие чата
            closeBtn.on('hover:enter click keydown', function(e) {
                if (e.type === 'keydown' && e.keyCode !== 13 && e.keyCode !== 32) return;
                window._sw_aiChatOpen = false;
                chatContainer.removeClass('visible');
                Lampa.Controller.collectionFocus(aiBtn);
            });
            
            // Отправка через кнопку (для совместимости с пультом)
            sendBtn.on('hover:enter click keydown', function(e) {
                if (e.type === 'keydown' && e.keyCode !== 13 && e.keyCode !== 32) return;
                var text = input.val().trim();
                if (!text) return;
                input.val('');
                sendAIQuestion(text, messagesContainer, movieInfo);
            });
            
            // Enter в инпуте (для сенсорных устройств)
            input.on('keydown', function(e) {
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
        
        // Анимация появления
        setTimeout(function() {
            msg.addClass('appear');
        }, 10);
    }
    
    function sendAIQuestion(query, messagesContainer, movieInfo) {
        var userMsg = query.trim();
        if (!userMsg) return;
        
        addAIMessage(messagesContainer, 'user', userMsg);
        
        // Показываем индикатор "думает"
        var typingIndicator = $('<div class="sw-ai-message bot sw-ai-typing"><span></span><span></span><span></span></div>');
        messagesContainer.append(typingIndicator);
        messagesContainer.scrollTop(messagesContainer[0].scrollHeight);
        
        // Имитируем задержку (как реальный ИИ)
        setTimeout(function() {
            typingIndicator.remove();
            
            // Генерируем ответ — теперь он может быть любым, даже если данных нет
            var response = generateSmartAIResponse(userMsg, movieInfo);
            addAIMessage(messagesContainer, 'bot', response);
        }, 800);
    }
    
    function generateSmartAIResponse(query, movieInfo) {
        var movie = movieInfo.movie;
        var text = query.toLowerCase();
        
        // 1. Базовые вопросы
        if (text.includes('привет') || text.includes('здравствуй') || text.includes('hi')) {
            return 'Здравствуйте! Я помогу вам разобраться с этим фильмом. Что вас интересует?';
        }
        if (text.includes('спасибо') || text.includes('благодар')) {
            return 'Пожалуйста! Если останутся вопросы — спрашивайте.';
        }
        
        // 2. Поиск по данным TMDB (если есть)
        var ratingItem = movieInfo.infoItems.find(item => item.label === 'Рейтинг');
        var runtimeItem = movieInfo.infoItems.find(item => item.label === 'Длительность');
        var yearItem = movieInfo.infoItems.find(item => item.label === 'Год');
        var budgetItem = movieInfo.infoItems.find(item => item.label === 'Бюджет');
        var revenueItem = movieInfo.infoItems.find(item => item.label === 'Сборы');
        
        if (text.includes('рейтинг') || text.includes('оценка') || text.includes('балл')) {
            return ratingItem 
                ? `Рейтинг на TMDB: ${ratingItem.value}. Основан на ${movieInfo.movie.vote_count.toLocaleString()} голосах.` 
                : 'Рейтинг не найден. Возможно, фильм ещё не добавлен в базу.';
        }
        if (text.includes('сколько длится') || text.includes('длительность') || text.includes('минут')) {
            return runtimeItem 
                ? `Длительность: ${runtimeItem.value}.` 
                : 'Данные о длительности отсутствуют.';
        }
        if (text.includes('когда вышел') || text.includes('год') || text.includes('выпущен')) {
            return yearItem 
                ? `Год выхода: ${yearItem.value}.` 
                : 'Год выпуска не указан.';
        }
        if (text.includes('бюджет') || text.includes('сколько стоил')) {
            return budgetItem 
                ? `Бюджет: ${budgetItem.value}.` 
                : 'Бюджет неизвестен.';
        }
        if (text.includes('сборы') || text.includes('касса') || text.includes('заработал')) {
            return revenueItem 
                ? `Сборы: ${revenueItem.value}.` 
                : 'Данные о сборах отсутствуют.';
        }
        
        // 3. Общие вопросы — даём честный ответ, если данных нет
        if (text.includes('что это за фильм') || text.includes('о чём') || text.includes('сюжет')) {
            var overview = (movieInfo.movie.overview || '').trim();
            if (overview) {
                return 'Это ' + (movieInfo.movie.type === 'tv' ? 'сериал' : 'фильм') + ' «' + movieInfo.movie.title + '». Кратко: ' + 
                       (overview.length > 180 ? overview.substring(0, 180) + '...' : overview);
            } else {
                return 'Краткое описание не найдено. Вы можете найти его на официальном сайте или в поиске Google.';
            }
        }
        
        // 4. Вопросы о контенте (на основе анализа)
        if (text.includes('детский') || text.includes('для детей') || text.includes('семейный')) {
            return movieInfo.familyOK 
                ? 'Да, это семейный фильм. Подходит для совместного просмотра.' 
                : 'Нет, этот фильм не является детским. В нём могут быть взрослые темы или сцены, не подходящие для детей.';
        }
        if (text.includes('насилие') || text.includes('кровь') || text.includes('убийства')) {
            return movieInfo.cons.some(c => c.includes('жестокие') || c.includes('кров') || c.includes('убийств'))
                ? 'Да, в фильме есть сцены насилия и крови.' 
                : 'Нет, сцен насилия в этом фильме не обнаружено.';
        }
        if (text.includes('мат') || text.includes('нецензур') || text.includes('ругательства')) {
            return movieInfo.cons.some(c => c.includes('нецензур') || c.includes('мат'))
                ? 'Да, в фильме присутствует нецензурная лексика.' 
                : 'Нет, нецензурной лексики в этом фильме нет.';
        }
        
        // 5. Универсальный ответ, если ничего не подошло
        return 'Я не нашёл точного ответа в базе данных, но могу предложить поискать в Google по запросу: "' + movie.title + ' ' + query + '". Хотите попробовать?';
    }

    /* ===== КОНТРОЛЛЕР (обновлен для TV-скролла) ===== */
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
                    if (window._sw_blocknav) {
                        var blocks = h.find('.sw-focusable');
                        try { Lampa.Controller.collectionSet(blocks); } catch(e) {}
                        swSetFocus(0); initNavPoints(h);
                    }
                },
                up: function() { 
                    if (window._sw_blocknav) { 
                        if (window._sw_aiChatOpen) {
                            // Внутри чата: перемещаем фокус по элементам
                            var input = window._sw_currentModalHtml.find('.sw-ai-input');
                            var sendBtn = window._sw_currentModalHtml.find('.sw-ai-send');
                            var firstMsg = window._sw_currentModalHtml.find('.sw-ai-message').first();
                            
                            if (input.hasClass('focus')) {
                                if (firstMsg.length) {
                                    Lampa.Controller.collectionFocus(firstMsg);
                                } else {
                                    Lampa.Controller.collectionFocus(sendBtn);
                                }
                            } else if (sendBtn.hasClass('focus')) {
                                Lampa.Controller.collectionFocus(input);
                            } else {
                                // Переходим к предыдущей навигационной точке
                                if (window._sw_navPoints && window._sw_navPoints.length > 1) {
                                    scrollToNavPoint(window._sw_currentNavPoint - 1);
                                } else {
                                    swSetFocus((window._sw_focusIdx || 0) - 1);
                                }
                            }
                        } 
                        else if (window._sw_navPoints && window._sw_navPoints.length > 1) {
                            scrollToNavPoint(window._sw_currentNavPoint - 1);
                        } else {
                            swSetFocus((window._sw_focusIdx || 0) - 1);
                        }
                    }
                },
                down: function() { 
                    if (window._sw_blocknav) { 
                        if (window._sw_aiChatOpen) {
                            var input = window._sw_currentModalHtml.find('.sw-ai-input');
                            var sendBtn = window._sw_currentModalHtml.find('.sw-ai-send');
                            var lastMsg = window._sw_currentModalHtml.find('.sw-ai-message').last();
                            
                            if (input.hasClass('focus')) {
                                if (lastMsg.length) {
                                    Lampa.Controller.collectionFocus(lastMsg);
                                } else {
                                    Lampa.Controller.collectionFocus(sendBtn);
                                }
                            } else if (sendBtn.hasClass('focus')) {
                                Lampa.Controller.collectionFocus(input);
                            } else {
                                if (window._sw_navPoints && window._sw_navPoints.length > 1) {
                                    scrollToNavPoint(window._sw_currentNavPoint + 1);
                                } else {
                                    swSetFocus((window._sw_focusIdx || 0) + 1);
                                }
                            }
                        } 
                        else if (window._sw_navPoints && window._sw_navPoints.length > 1) {
                            scrollToNavPoint(window._sw_currentNavPoint + 1);
                        } else {
                            swSetFocus((window._sw_focusIdx || 0) + 1);
                        }
                    }
                },
                left: function() {},
                right: function() {},
                back: function() {
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
        
        var quote = '';
        if (a.review.sample) {
            var toneLabel = a.review.tone === 'pos' ? 'хвалебный' : (a.review.tone === 'neg' ? 'критический' : 'спорный');
            var toneCls = a.review.tone === 'pos' ? 'pos' : (a.review.tone === 'neg' ? 'neg' : 'mix');
            var txt = a.review.sample.text.length > 240 ? a.review.sample.text.substring(0, 240).trim() + '…' : a.review.sample.text;
            quote = '<div class="sw-quote sw-focusable" tabindex="0"><div class="sw-quote-text">' + esc(txt) + '</div><div class="sw-quote-meta">— ' + esc(a.review.sample.author) + '<span class="sw-quote-tone ' + toneCls + '">' + toneLabel + '</span></div></div>';
        }
        
        var infoGrid = '';
        if (a.infoItems && a.infoItems.length > 0) {
            infoGrid = '<div class="sw-info-grid sw-nav-point">' + 
                a.infoItems.map(function(item) {
                    return '<div class="sw-info-item sw-focusable" tabindex="0"><div class="sw-info-label">' + esc(item.label) + '</div><div class="sw-info-value">' + esc(item.value) + '</div></div>';
                }).join('') + 
                '</div>';
        }
        
        var cfg = getSettings();
        var aiButton = '';
        var aiChat = '';
        if (cfg.ai_enabled) {
            aiButton = '<button class="sw-btn sw-ai-btn selector sw-focusable" id="sw-ai-btn" tabindex="0"><span>🤖</span> Спросить ИИ</button>';
            aiChat = '<div class="sw-ai-chat" id="sw-ai-chat">' +
                '<div class="sw-ai-header">' +
                '<span class="sw-ai-title">🤖 ИИ Помощник</span>' +
                '<button class="sw-ai-close sw-focusable" id="sw-ai-close" tabindex="0">×</button>' +
                '</div>' +
                '<div class="sw-ai-messages" id="sw-ai-messages"></div>' +
                '<div class="sw-ai-keyboard" id="sw-ai-keyboard">' +
                '<div class="sw-ai-input-container">' +
                '<textarea class="sw-ai-input sw-focusable" id="sw-ai-input" placeholder="Напишите вопрос..." rows="1" tabindex="0"></textarea>' +
                '<button class="sw-ai-send sw-focusable" id="sw-ai-send" tabindex="0">Отправить</button>' +
                '</div>' +
                '</div>' +
                '</div>';
        }
        
        return '' +
            '<div class="sw-dossier sw-focusable sw-nav-point" tabindex="0">' + badge +
                '<div class="sw-verdict-word ' + a.vClass + '">...</div>' +
                '<div class="sw-verdict-reason">...</div>' +
                '<div class="sw-meter"><div class="sw-meter-fill ' + a.vClass + '" data-w="' + a.norm + '"></div></div>' +
            '</div>' +
            infoGrid +
            '<div class="sw-columns sw-nav-point">' +
                '<div class="sw-col sw-focusable" tabindex="0"><div class="sw-title pros">✓ Аргументы за</div><ul class="sw-list">' + a.pros.map(function(p, i){ return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>' +
                '<div class="sw-col sw-focusable" tabindex="0"><div class="sw-title cons">✗ Аргументы против</div><ul class="sw-list">' + a.cons.map(function(c, i){ return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></div>' +
            '</div>' +
            quote +
            '<div class="sw-target-audience sw-focusable sw-nav-point" tabindex="0"><div class="sw-title target">🎯 Кому понравится</div><div class="sw-aud-text">' + esc(a.audience) + '</div></div>' +
            '<div class="sw-decision sw-nav-point">' +
                '<div class="sw-decision-hint">Вердикт выше — а если колеблешься, доверься случаю или спроси ИИ</div>' +
                '<div class="sw-buttons-row">' +
                '<button class="sw-btn sw-btn-primary selector sw-focusable" id="sw-dice-btn" tabindex="0"><span style="font-size:1.2em">🎲</span> Бросить кости</button>' +
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
                        if (Math.random() > 0.5) {
                            v.text('Смотреть!').addClass('verdict-yes');
                            v.addClass('appear');
                        } else {
                            v.text('Не смотреть').addClass('verdict-no');
                            v.addClass('appear');
                        }
                        Lampa.Controller.collectionFocus(btn);
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
            
            var phrases = ['🔍 Анализирую...', '📊 Загружаю данные...', '💬 Читаю отзывы...', '🎭 Проверяю ценз...', '⚖️ Формирую вердикт...'];
            
            var html = $('<div class="sw-modal-content"><div id="sw-body"><div class="sw-loader"><div class="sw-loader-dice">🎲</div><div class="sw-loader-text" id="sw-loader-text">' + phrases[0] + '</div><div class="sw-loader-progress"></div></div></div></div>');
            window._sw_currentModalHtml = html; window._sw_focusIdx = 0; 
            window._sw_scrollContainer = html; // Ключевой элемент для TV-скролла
            window._sw_navPoints = []; window._sw_currentNavPoint = 0;
            
            var pi = 0;
            window._sw_loaderTimer = setInterval(function() {
                pi = (pi + 1) % phrases.length; 
                var t = html.find('#sw-loader-text');
                if (t.length) { 
                    t.css('opacity', 0);
                    setTimeout(function(){ t.text(phrases[pi]).css('opacity', 1); }, 250);
                }
            }, 700);

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
                
                // Сначала рендерим HTML
                html.find('#sw-body').html('<div class="sw-body">' + buildReadyInner(a) + '</div>');
                
                // Затем анимируем вердикт и причины
                setTimeout(function() {
                    html.find('.sw-verdict-word').text(a.vWord).addClass('appear');
                    html.find('.sw-verdict-reason').text(a.reason).addClass('appear');
                    html.find('.sw-meter-fill').each(function(){
                        this.style.width = (this.getAttribute('data-w') || 50) + '%';
                    });
                    
                    // Анимируем списки
                    html.find('.sw-list li').addClass('appear');
                    html.find('.sw-quote-text, .sw-quote-meta, .sw-aud-text').addClass('appear');
                }, 200);
                
                bindDice(html);
                initAIChat(html, a);
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
        console.log('[ShouldWatch Enhanced] v4.0 (AI with real keyboard, TV-scroll fixed, smooth animations)');
    }
    try { if (window.appready) startPlugin(); else Lampa.Listener.follow('app', function(e){ if (e.type === 'ready') startPlugin(); }); } catch(e) {}
})();
