/**
 * ヘルプチャットボット ウィジェット JavaScript
 * 最小実装: open/close, /start, /step fetch, messages/buttons描画, free_text制御
 * 
 * 使い方:
 *   1. widget.html と widget.css を読み込み
 *   2. このスクリプトを読み込み
 *   3. HelpChatWidget.init({ apiBase: '/api/v1/helpchat' }) を呼び出し
 */

(function () {
    'use strict';

    // === 設定 ===
    const DEFAULT_CONFIG = {
        apiBase: 'http://127.0.0.1:5001/api/v1/helpchat',
        screenResolvers: {
            // パス -> screen_id のマッピング
            '/teleapo': 'teleapo',
            '/referral': 'referral',
            '/ad-performance': 'ad_performance',
            '/candidates': 'candidates',
            '/goal-settings': 'goal_settings',
            '/pages/yield-personal': 'yield_personal',
            '/yield-personal': 'yield_personal',
            '/pages/yield-company': 'yield_company',
            '/yield-company': 'yield_company',
            '/pages/yield-admin': 'yield_admin',
            '/yield-admin': 'yield_admin',
            '/pages/settings': 'settings_main',
            '/settings': 'settings_main',
            '/pages/members': 'members_list',
            '/members': 'members_list'
        }
    };

    // === 状態 ===
    let config = { ...DEFAULT_CONFIG };
    let sessionId = null;
    let currentState = null;
    let currentScreenId = null;
    let isOpen = false;
    let isFreeTextEnabled = false;
    let triggerPos = { x: null, y: null };
    let dragState = null;
    let resizeState = null;
    const STORAGE_KEY = 'helpchat:position';
    const DRAG_THRESHOLD = 4;
    const RESIZE_MIN_WIDTH = 280;
    const RESIZE_MIN_HEIGHT = 260;
    const RESIZE_MARGIN = 10;

    // === DOM要素 ===
    let elements = {};

    // === 初期化 ===
    function init(userConfig = {}) {
        const bootstrapConfig = window.HelpChatWidgetConfig || {};
        config = { ...DEFAULT_CONFIG, ...bootstrapConfig, ...userConfig };

        // DOM要素取得
        elements = {
            widget: document.getElementById('helpchat-widget'),
            trigger: document.getElementById('helpchat-trigger'),
            drawer: document.getElementById('helpchat-drawer'),
            close: document.getElementById('helpchat-close'),
            messages: document.getElementById('helpchat-messages'),
            options: document.getElementById('helpchat-options'),
            inputArea: document.getElementById('helpchat-input-area'),
            input: document.getElementById('helpchat-input'),
            send: document.getElementById('helpchat-send')
        };

        if (!elements.widget) {
            console.error('[HelpChat] Widget container not found');
            return;
        }

        initPosition();
        bindEvents();
        console.log('[HelpChat] Initialized');
    }

    // === イベントバインド ===
    function bindEvents() {
        // トリガーボタン
        elements.trigger.addEventListener('pointerdown', handleTriggerPointerDown);
        elements.trigger.addEventListener('pointermove', handleTriggerPointerMove);
        elements.trigger.addEventListener('pointerup', handleTriggerPointerUp);
        elements.trigger.addEventListener('pointercancel', handleTriggerPointerUp);

        // 閉じるボタン
        elements.close.addEventListener('click', close);

        // 送信ボタン
        elements.send.addEventListener('click', handleSend);

        // Enter で送信
        elements.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });

        // ESCで閉じる
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isOpen) {
                close();
            }
        });

        // ドロワー外クリックで閉じる
        document.addEventListener('click', (e) => {
            if (isOpen && !elements.widget.contains(e.target)) {
                close();
            }
        });

        const resizeHandles = elements.drawer.querySelectorAll('.helpchat-resize-handle');
        resizeHandles.forEach((handle) => {
            handle.addEventListener('pointerdown', handleResizePointerDown);
            handle.addEventListener('pointermove', handleResizePointerMove);
            handle.addEventListener('pointerup', handleResizePointerUp);
            handle.addEventListener('pointercancel', handleResizePointerUp);
        });

        window.addEventListener('resize', () => {
            if (triggerPos.x !== null && triggerPos.y !== null) {
                setTriggerPosition(triggerPos.x, triggerPos.y, true);
            }
            positionDrawer();
        });

        if (window.ResizeObserver) {
            const observer = new ResizeObserver(() => positionDrawer());
            observer.observe(elements.drawer);
        }

        // ルート変更時に画面判定を更新（SPA用）
        window.addEventListener('hashchange', handleRouteChange);
    }

    // === 開閉制御 ===
    function toggle() {
        if (isOpen) {
            close();
        } else {
            open();
        }
    }

    async function open() {
        elements.drawer.classList.add('open');
        elements.drawer.setAttribute('aria-hidden', 'false');
        isOpen = true;
        requestAnimationFrame(positionDrawer);

        // 初回 or 画面変更 or セッション切れの場合は開始
        await startSession();
    }

    function close() {
        elements.drawer.classList.remove('open');
        elements.drawer.setAttribute('aria-hidden', 'true');
        isOpen = false;
    }

    function initPosition() {
        const saved = loadPosition();
        if (saved) {
            triggerPos = saved;
            requestAnimationFrame(() => setTriggerPosition(saved.x, saved.y, true));
            return;
        }

        requestAnimationFrame(() => {
            const { x, y } = getDefaultPosition();
            setTriggerPosition(x, y, true);
        });
    }

    function getDefaultPosition() {
        const size = elements.trigger ? elements.trigger.offsetWidth || 56 : 56;
        const x = window.innerWidth - size - 20;
        const y = window.innerHeight - size - 20;
        return { x, y };
    }

    function clampPosition(x, y, size) {
        const maxX = window.innerWidth - size - 8;
        const maxY = window.innerHeight - size - 8;
        return {
            x: Math.max(8, Math.min(x, maxX)),
            y: Math.max(8, Math.min(y, maxY))
        };
    }

    function setTriggerPosition(x, y, skipSave = false) {
        const size = elements.trigger ? elements.trigger.offsetWidth || 56 : 56;
        const clamped = clampPosition(x, y, size);
        triggerPos = clamped;
        elements.trigger.style.left = `${clamped.x}px`;
        elements.trigger.style.top = `${clamped.y}px`;
        if (!skipSave) savePosition(clamped);
        positionDrawer();
    }

    function positionDrawer() {
        if (!elements.drawer || triggerPos.x === null || triggerPos.y === null) return;

        const gap = 12;
        const triggerRect = elements.trigger.getBoundingClientRect();
        const drawerWidth = elements.drawer.offsetWidth || 360;
        const drawerHeight = elements.drawer.offsetHeight || 500;

        let left = triggerRect.left + triggerRect.width - drawerWidth;
        let top = triggerRect.top - drawerHeight - gap;

        if (top < 10) {
            top = triggerRect.bottom + gap;
        }

        const maxLeft = window.innerWidth - drawerWidth - 10;
        const maxTop = window.innerHeight - drawerHeight - 10;

        left = Math.max(10, Math.min(left, maxLeft));
        top = Math.max(10, Math.min(top, maxTop));

        elements.drawer.style.left = `${left}px`;
        elements.drawer.style.top = `${top}px`;
    }

    function loadPosition() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
                return parsed;
            }
        } catch (err) {
            console.warn('[HelpChat] Failed to load position', err);
        }
        return null;
    }

    function savePosition(pos) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
        } catch (err) {
            console.warn('[HelpChat] Failed to save position', err);
        }
    }

    function handleTriggerPointerDown(e) {
        e.preventDefault();
        elements.trigger.setPointerCapture(e.pointerId);
        dragState = {
            startX: e.clientX,
            startY: e.clientY,
            originX: triggerPos.x ?? 0,
            originY: triggerPos.y ?? 0,
            moved: false
        };
        elements.trigger.classList.add('is-dragging');
    }

    function handleTriggerPointerMove(e) {
        if (!dragState) return;

        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;
        const distance = Math.hypot(dx, dy);

        if (!dragState.moved && distance > DRAG_THRESHOLD) {
            dragState.moved = true;
        }

        if (dragState.moved) {
            setTriggerPosition(dragState.originX + dx, dragState.originY + dy);
        }
    }

    function handleTriggerPointerUp(e) {
        if (!dragState) return;
        elements.trigger.releasePointerCapture(e.pointerId);
        elements.trigger.classList.remove('is-dragging');
        const wasDragged = dragState.moved;
        dragState = null;
        if (!wasDragged) {
            toggle();
        }
    }

    function handleResizePointerDown(e) {
        e.preventDefault();
        e.stopPropagation();
        const dir = e.currentTarget.dataset.resize;
        const rect = elements.drawer.getBoundingClientRect();
        resizeState = {
            dir,
            startX: e.clientX,
            startY: e.clientY,
            startWidth: rect.width,
            startHeight: rect.height,
            startLeft: rect.left,
            startTop: rect.top
        };
        e.currentTarget.setPointerCapture(e.pointerId);
    }

    function handleResizePointerMove(e) {
        if (!resizeState) return;

        const dx = e.clientX - resizeState.startX;
        const dy = e.clientY - resizeState.startY;
        const right = resizeState.startLeft + resizeState.startWidth;
        const bottom = resizeState.startTop + resizeState.startHeight;

        let width = resizeState.startWidth;
        let height = resizeState.startHeight;
        let left = resizeState.startLeft;
        let top = resizeState.startTop;

        if (resizeState.dir.includes('e')) {
            width = resizeState.startWidth + dx;
        }
        if (resizeState.dir.includes('s')) {
            height = resizeState.startHeight + dy;
        }
        if (resizeState.dir.includes('w')) {
            width = resizeState.startWidth - dx;
            left = right - width;
        }
        if (resizeState.dir.includes('n')) {
            height = resizeState.startHeight - dy;
            top = bottom - height;
        }

        const maxWidth = Math.max(RESIZE_MIN_WIDTH, window.innerWidth - RESIZE_MARGIN * 2);
        const maxHeight = Math.max(RESIZE_MIN_HEIGHT, window.innerHeight - RESIZE_MARGIN * 2);

        width = Math.max(RESIZE_MIN_WIDTH, Math.min(width, maxWidth));
        height = Math.max(RESIZE_MIN_HEIGHT, Math.min(height, maxHeight));

        if (resizeState.dir.includes('w')) {
            left = right - width;
            if (left < RESIZE_MARGIN) {
                left = RESIZE_MARGIN;
                width = right - left;
            }
        }

        if (resizeState.dir.includes('n')) {
            top = bottom - height;
            if (top < RESIZE_MARGIN) {
                top = RESIZE_MARGIN;
                height = bottom - top;
            }
        }

        if (resizeState.dir.includes('e')) {
            const maxRight = window.innerWidth - RESIZE_MARGIN;
            if (left + width > maxRight) {
                width = Math.max(RESIZE_MIN_WIDTH, maxRight - left);
            }
        }

        if (resizeState.dir.includes('s')) {
            const maxBottom = window.innerHeight - RESIZE_MARGIN;
            if (top + height > maxBottom) {
                height = Math.max(RESIZE_MIN_HEIGHT, maxBottom - top);
            }
        }

        elements.drawer.style.width = `${Math.round(width)}px`;
        elements.drawer.style.height = `${Math.round(height)}px`;
        elements.drawer.style.left = `${Math.round(left)}px`;
        elements.drawer.style.top = `${Math.round(top)}px`;
    }

    function handleResizePointerUp(e) {
        if (!resizeState) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        resizeState = null;
    }

    // === screen_id 解決 ===
    function resolveScreenId() {
        const pathname = window.location.pathname;
        const hashPath = (window.location.hash || '').replace(/^#\/?/, '').split('/')[0];

        // ハッシュルート優先（/#/teleapo など）
        if (hashPath && config.screenResolvers[`/${hashPath}`]) {
            return config.screenResolvers[`/${hashPath}`];
        }
        if (hashPath && config.screenResolvers[hashPath]) {
            return config.screenResolvers[hashPath];
        }

        // 完全一致
        if (config.screenResolvers[pathname]) {
            return config.screenResolvers[pathname];
        }

        // 前方一致
        for (const [path, screenId] of Object.entries(config.screenResolvers)) {
            if (pathname.startsWith(path)) {
                return screenId;
            }
        }

        // フォールバック
        console.warn('[HelpChat] Unknown path:', pathname || hashPath || '(empty)');
        return 'global';
    }

    function resetSessionForScreen(screenId) {
        sessionId = null;
        currentState = null;
        currentScreenId = screenId;
        if (elements.messages) elements.messages.innerHTML = '';
        if (elements.options) elements.options.innerHTML = '';
        if (elements.input) elements.input.value = '';
        if (elements.inputArea) elements.inputArea.classList.add('helpchat-hidden');
    }

    function handleRouteChange() {
        const screenId = resolveScreenId();
        if (screenId !== currentScreenId) {
            resetSessionForScreen(screenId);
            if (isOpen) {
                startSession();
            }
        }
    }

    // === API通信 ===
    async function startSession() {
        const screenId = resolveScreenId();
        if (screenId !== currentScreenId) {
            resetSessionForScreen(screenId);
        }
        showLoading();

        try {
            const res = await fetch(`${config.apiBase}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ screen_id: screenId })
            });

            const data = await res.json();
            hideLoading();

            if (data.success) {
                sessionId = data.session_id;
                currentState = data.state;
                renderMessage(data.message, 'bot');
                renderOptions(data.options);
                updateInputMode(data.input_mode);
            } else {
                renderMessage(data.error?.message || 'エラーが発生しました', 'bot');
            }
        } catch (err) {
            hideLoading();
            console.error('[HelpChat] Start error:', err);
            renderMessage('接続エラーが発生しました', 'bot');
        }
    }

    async function step(action, target = '', query = '') {
        if (!sessionId) {
            await startSession();
            return;
        }

        showLoading();

        try {
            const res = await fetch(`${config.apiBase}/step`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    action: action,
                    target: target,
                    query: query
                })
            });

            const data = await res.json();
            hideLoading();

            if (data.success) {
                currentState = data.state;

                // コンテンツ表示の場合
                if (data.content) {
                    renderContent(data.content);
                } else if (data.message) {
                    renderMessage(data.message, 'bot');
                }

                renderOptions(data.options);
                updateInputMode(data.input_mode);
            } else {
                // セッション切れ
                if (res.status === 410) {
                    sessionId = null;
                    renderMessage(data.error?.message || 'セッションが切れました', 'bot');
                    renderOptions([{ id: 'retry', label: '再開する', action: 'restart', target: '' }]);
                } else {
                    renderMessage(data.error?.message || 'エラーが発生しました', 'bot');
                }
            }
        } catch (err) {
            hideLoading();
            console.error('[HelpChat] Step error:', err);
            renderMessage('通信エラーが発生しました', 'bot');
        }
    }

    // === 選択肢クリック ===
    function handleOptionClick(option) {
        // ユーザーの選択を表示
        renderMessage(option.label, 'user');

        if (option.action === 'restart') {
            sessionId = null;
            startSession();
            return;
        }

        if (option.action === 'external') {
            window.open(option.target, '_blank', 'noopener,noreferrer');
            return;
        }

        step(option.action, option.target);
    }

    // === 自由入力送信 ===
    function handleSend() {
        const query = elements.input.value.trim();

        if (!query) return;

        // 自由入力が許可されていない場合
        // → サーバーに free_text アクションで送信（サーバーが固定文言で誘導）
        if (!isFreeTextEnabled) {
            elements.input.value = '';
            renderMessage(query, 'user');
            step('free_text', '', query);
            return;
        }

        // 検索実行
        elements.input.value = '';
        renderMessage(query, 'user');
        step('search', '', query);
    }

    // === 描画 ===
    function renderMessage(text, type) {
        if (!text) return;

        const div = document.createElement('div');
        div.className = `helpchat-message ${type}`;
        div.textContent = text;
        elements.messages.appendChild(div);
        scrollToBottom();
    }

    function renderContent(content) {
        const div = document.createElement('div');
        div.className = 'helpchat-content';

        // タイトル
        const titleDiv = document.createElement('div');
        titleDiv.className = 'helpchat-content-title';
        titleDiv.textContent = content.title;
        div.appendChild(titleDiv);

        // 本文
        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'helpchat-content-body';
        bodyDiv.textContent = content.body;
        div.appendChild(bodyDiv);

        // リンク
        if (content.links && content.links.length > 0) {
            const linksDiv = document.createElement('div');
            linksDiv.className = 'helpchat-content-links';
            content.links.forEach(link => {
                const a = document.createElement('a');
                a.href = link.url;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.textContent = link.label;
                linksDiv.appendChild(a);
                linksDiv.appendChild(document.createTextNode(' '));
            });
            div.appendChild(linksDiv);
        }

        elements.messages.appendChild(div);
        scrollToBottom();
    }

    function renderOptions(options) {
        elements.options.innerHTML = '';

        if (!options || options.length === 0) return;

        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'helpchat-option';
            btn.textContent = opt.label;
            btn.addEventListener('click', () => handleOptionClick(opt));
            elements.options.appendChild(btn);
        });
    }

    function updateInputMode(inputMode) {
        isFreeTextEnabled = inputMode?.free_text || false;

        if (isFreeTextEnabled) {
            elements.inputArea.classList.remove('helpchat-hidden');
            elements.input.placeholder = inputMode.placeholder || 'キーワードを入力...';
            elements.input.focus();
        } else {
            elements.inputArea.classList.add('helpchat-hidden');
        }
    }

    function showLoading() {
        const loading = document.createElement('div');
        loading.className = 'helpchat-loading';
        loading.id = 'helpchat-loading';
        loading.innerHTML = '<span></span><span></span><span></span>';
        elements.messages.appendChild(loading);
        scrollToBottom();
    }

    function hideLoading() {
        const loading = document.getElementById('helpchat-loading');
        if (loading) loading.remove();
    }

    function scrollToBottom() {
        elements.messages.scrollTop = elements.messages.scrollHeight;
    }

    // === 公開API ===
    window.HelpChatWidget = {
        init: init,
        open: open,
        close: close,
        toggle: toggle
    };

    // 自動初期化（DOMContentLoaded後）
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => init());
    } else {
        // 既にDOMがロード済みの場合は少し遅延して初期化
        setTimeout(() => init(), 0);
    }

})();
