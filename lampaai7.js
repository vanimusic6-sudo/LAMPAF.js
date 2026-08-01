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

    /* ===== СТИЛИ (без изменений) ===== */
    function injectCSS() {
        try {
            if (document.getElementById('sw-plugin-styles-enhanced')) return;
            var s = document.createElement('style'); s.id = 'sw-plugin-styles-enhanced';
            s.innerHTML =
                '.sw-modal-content{padding:22px 26px 44px;color:#fff;font-family:' + DISPLAY + ';box-sizing:border-box;max-height:88vh;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch}' +
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
                '.sw-ai-hint{font-size:.74em;color:#7c828c;margin-top:9px;text-align:center}' +
                '.sw-focusable{outline:none;cursor:pointer;scroll-margin-top:40px;scroll-margin-bottom:40px}' +
                '.sw-focusable.focus{box-shadow:0 0 0 3px rgba(255,255,255,.85),0 0 18px rgba(255,255,255,.18);border-radius:12px}' +
                '@media(max-width:600px){.sw-modal-content{padding:16px 16px 32px}.sw-verdict-word{font-size:2.1em}.sw-columns{grid-template-columns:1fr}.sw-info-grid{grid-template-columns:repeat(2,1fr)}.sw-buttons-row{flex-direction:column}.sw-btn{width:100%;justify-content:center}}';
            document.head.appendChild(s);
        } catch(e) { console.error('[SW] injectCSS:', e); }
    }

    /* ===== СКРОЛЛ: ТОЛЬКО ЧЕРЕЗ Lampa.Controller.scroll ===== */
    function initNavPoints(html) {
        try {
            if (!html || !html.length) return;
            window._sw_navPoints = [];
            // Навигационные точки (должны быть с scroll-margin-top)
            ['.sw-dossier', '.sw-info-grid', '.sw-columns', '.sw-quote', '.sw-target-audience', '.sw-decision', '.sw-ai-chat'].forEach(function(sel) {
                var el = html.find(sel);
                if (el.length) {
                    el.addClass('sw-nav-point');
                    window._sw_navPoints.push(el);
                }
            });
            // Если навигационных точек нет — используем все focusable-элементы
            if (!window._sw_navPoints.length) {
                window._sw_navPoints = html.find('.sw-focusable');
            }
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
                window._sw_currentNavPoint = index;
                // Используем нативный скролл Lampa
                Lampa.Controller.scroll(point[0], { behavior: 'smooth', block: 'center' });
                // Фокус на первый focusable в точке
                var ft = point.find('.sw-focusable').first();
                if (!ft.length) ft = point;
                ft.addClass('focus');
                try { ft[0].focus({ preventScroll: true }); } catch(e) {}
                Lampa.Controller.collectionFocus(ft);
            }
        } catch(e) { console.error('[SW] scrollToNavPoint:', e); }
    }
    function focusRing(el) {
        var h = window._sw_currentModalHtml; if (!h) return;
        h.find('.sw-focusable').removeClass('focus');
        el.addClass('focus');
        window._sw_activeInteractive = el[0];
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
        // Скроллим через Lampa.Controller
        var cn = c[0];
        var step = Math.max(140, Math.round(cn.clientHeight * 0.8));
        var target = cn.scrollTop + dir * step;
        Lampa.Controller.scroll(cn, { behavior: 'smooth', block: 'center' });
    }
    function interactiveSet() {
        var h = window._sw_currentModalHtml; if (!h) return $();
        return h.find('.sw-focusable:visible');
    }

    /* ===== ИИ: системная клавиатура Lampa ===== */
    function initAIChat(html, data) {
        try {
            var cfg = getSettings(); if (!cfg.ai_enabled) return;
            var ai = data.ai;
            var chat = html.find('#sw-ai-chat'), aiBtn = html.find('#sw-ai-btn'), closeBtn = html.find('#sw-ai-close');
            var msgs = html.find('#sw-ai-messages');

            function send(query) {
                query = (query || '').trim(); if (!query) return;
                addAIMessage(msgs, 'user', query);
                var typing = aiThinking(msgs);
                // Попробуем сначала локально
                var local = generateLocalResponse(query, ai);
                if (local.precise) {
                    try { typing.remove(); } catch(e) {}
                    addAIMessage(msgs, 'bot', local.text);
                    return;
                }
                // Если локально не получилось — идём в сеть
                wikiFetch(ai.title).then(function(w) {
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

            aiBtn.on('hover:enter click keydown', function(e) {
                if (e.type === 'keydown' && e.keyCode !== 13 && e.keyCode !== 32) return;
                window._sw_aiChatOpen = true;
                chat.addClass('visible');
                // Открываем системную клавиатуру
                Lampa.Keyboard.open({
                    value: '',
                    placeholder: 'Введите вопрос...',
                    onInput: function(text) { /* ничего не делаем, ждём Enter */ },
                    onEnter: function(text) {
                        send(text);
                        Lampa.Keyboard.close();
                    },
                    onClose: function() {
                        window._sw_aiChatOpen = false;
                        chat.removeClass('visible');
                        focusRing(aiBtn);
                    }
                });
            });

            closeBtn.on('hover:enter click keydown', function(e) {
                if (e.type === 'keydown' && e.keyCode !== 13 && e.keyCode !== 32) return;
                window._sw_aiChatOpen = false;
                chat.removeClass('visible');
                focusRing(aiBtn);
            });

            // Быстрые вопросы
            html.find('.sw-ai-chip').on('hover:enter click keydown', function(e) {
                if (e.type === 'keydown' && e.keyCode !== 13 && e.keyCode !== 32) return;
                var q = $(this).attr('data-q');
                send(q);
                Lampa.Keyboard.close();
            });
        } catch(e) { console.error('[SW] initAIChat:', e); }
    }

    /* ===== КОНТРОЛЛЕР (только через Lampa.Controller) ===== */
    function registerController() {
        try {
            Lampa.Controller.add('should_watch_modal_enhanced', {
                toggle: function() {
                    var h = window._sw_currentModalHtml; if (!h) return;
                    if (window._sw_blocknav) {
                        var blocks = h.find('.sw-focusable');
                        try { Lampa.Controller.collectionSet(blocks); } catch(e) {}
                        initNavPoints(h);
                        scrollToNavPoint(0);
                    }
                },
                up: function() { if (window._sw_blocknav) { if (window._sw_navPoints && window._sw_navPoints.length > 1) scrollToNavPoint(window._sw_currentNavPoint - 1); else scrollStep(-1); } },
                down: function() { if (window._sw_blocknav) { if (window._sw_navPoints && window._sw_navPoints.length > 1) scrollToNavPoint(window._sw_currentNavPoint + 1); else scrollStep(1); } },
                left: function() { if (window._sw_blocknav) moveHorizontal(-1); },
                right: function() { if (window._sw_blocknav) moveHorizontal(1); },
                back: function() {
                    if (window._sw_aiChatOpen) {
                        window._sw_aiChatOpen = false;
                        Lampa.Keyboard.close();
                        var chat = window._sw_currentModalHtml.find('#sw-ai-chat');
                        chat.removeClass('visible');
                        focusRing(window._sw_currentModalHtml.find('#sw-ai-btn'));
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

    /* ===== РЕНДЕР (без изменений) ===== */
    function buildReadyInner(a) {
        // ... (оставляем как есть, только убираем tabindex с не-интерактивных элементов)
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
        console.log('[ShouldWatch Enhanced] v7.0 (system keyboard, Lampa scroll)');
    }
    try { if (window.appready) startPlugin(); else Lampa.Listener.follow('app', function(e){ if (e.type === 'ready') startPlugin(); }); } catch(e) {}
})();
