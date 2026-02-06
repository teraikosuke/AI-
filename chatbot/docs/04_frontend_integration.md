# D) フロントエンド組み込み仕様

## 概要

既存Webアプリにチャットボットを統合するためのフロントエンド実装仕様。

---

## 1. UI構成

### 配置

```
+-----------------------------------+
|  既存アプリ                        |
|                                   |
|                              [?]  | ← 右下のトリガーボタン
+-----------------------------------+
```

### ドロワー構造

```
+-----------------------------------+
|  既存アプリ           +----------+|
|                       | ヘッダ   ||
|                       |----------|
|                       | メッセ   ||
|                       | ージ     ||
|                       | エリア   ||
|                       |          ||
|                       |----------|
|                       | 選択肢   ||
|                       | エリア   ||
|                       +----------+|
+-----------------------------------+
```

---

## 2. screen_id 解決ロジック

### URL → screen_id マッピング

```javascript
// chatbot/screen-resolver.js

const SCREEN_ROUTES = {
  // 歩留まり系
  'yield_personal': ['/pages/yield-personal', '/yield-personal'],
  'yield_company': ['/pages/yield-company', '/yield-company'],
  'yield_admin': ['/pages/yield-admin', '/yield-admin'],
  
  // 設定系
  'settings_main': ['/pages/settings', '/settings'],
  'settings_goal': ['/pages/goal-settings', '/goal-settings'],
  
  // その他
  'members_list': ['/pages/members', '/members'],
  'mypage_main': ['/pages/mypage', '/mypage'],
  'candidates_list': ['/pages/candidates', '/candidates'],
  'referral_main': ['/pages/referral', '/referral'],
  'teleapo_main': ['/pages/teleapo', '/teleapo'],
  'ad_performance': ['/pages/ad-performance', '/ad-performance']
};

/**
 * 現在のURLからscreen_idを解決
 * @returns {string} screen_id または 'unknown'
 */
function resolveScreenId() {
  const pathname = window.location.pathname;
  
  for (const [screenId, routes] of Object.entries(SCREEN_ROUTES)) {
    for (const route of routes) {
      if (pathname.startsWith(route)) {
        return screenId;
      }
    }
  }
  
  // フォールバック: unknown画面用の汎用ヘルプ
  console.warn(`[Chatbot] Unknown screen for path: ${pathname}`);
  return 'unknown';
}

/**
 * 画面増加時の命名規則
 * 
 * 形式: {group}_{feature}[_{sub}]
 * 
 * グループ一覧:
 *   - yield: 歩留まり関連
 *   - settings: 設定関連
 *   - members: メンバー関連
 *   - mypage: マイページ関連
 *   - candidates: 候補者関連
 *   - referral: リファラル関連
 *   - teleapo: テレアポ関連
 *   - ad: 広告関連
 * 
 * 新規画面追加時:
 *   1. SCREEN_ROUTESに追記
 *   2. contents.jsonのscreen_registryに追加
 *   3. 必要に応じてコンテンツを紐づけ
 */
```

### 動的ルート対応（将来拡張）

```javascript
// SPA（React Router等）の場合
function resolveScreenIdFromRouter(routerState) {
  // ルート名から解決
  const routeName = routerState.routes[routerState.routes.length - 1]?.name;
  
  const ROUTE_NAME_MAP = {
    'yield-personal': 'yield_personal',
    'yield-company': 'yield_company',
    // ...
  };
  
  return ROUTE_NAME_MAP[routeName] || 'unknown';
}
```

---

## 3. チャットボットコンポーネント

### HTML構造

```html
<!-- chatbot/chatbot.html -->
<div id="chatbot-container" class="chatbot-hidden">
  <!-- トリガーボタン -->
  <button id="chatbot-trigger" class="chatbot-trigger" aria-label="ヘルプを開く">
    <svg class="chatbot-icon"><!-- アイコン --></svg>
  </button>
  
  <!-- ドロワー -->
  <div id="chatbot-drawer" class="chatbot-drawer" role="dialog" aria-modal="true">
    <!-- ヘッダ -->
    <div class="chatbot-header">
      <h2>ヘルプ</h2>
      <button id="chatbot-close" aria-label="閉じる">×</button>
    </div>
    
    <!-- メッセージエリア -->
    <div id="chatbot-messages" class="chatbot-messages" role="log">
      <!-- 動的に追加 -->
    </div>
    
    <!-- 選択肢エリア -->
    <div id="chatbot-options" class="chatbot-options">
      <!-- 動的に追加 -->
    </div>
    
    <!-- 検索入力（search:active時のみ表示） -->
    <div id="chatbot-search" class="chatbot-search chatbot-hidden">
      <input type="text" id="chatbot-search-input" placeholder="キーワードを入力..." />
      <button id="chatbot-search-submit">検索</button>
    </div>
  </div>
</div>
```

### CSS構造

```css
/* chatbot/chatbot.css */

/* コンテナ */
.chatbot-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9999;
  font-family: system-ui, -apple-system, sans-serif;
}

/* トリガーボタン */
.chatbot-trigger {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #4F46E5;
  color: white;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: transform 0.2s, box-shadow 0.2s;
}

.chatbot-trigger:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

/* ドロワー */
.chatbot-drawer {
  position: absolute;
  bottom: 70px;
  right: 0;
  width: 360px;
  max-height: 500px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform: translateY(10px);
  opacity: 0;
  visibility: hidden;
  transition: transform 0.25s ease, opacity 0.25s ease, visibility 0.25s;
}

.chatbot-drawer.open {
  transform: translateY(0);
  opacity: 1;
  visibility: visible;
}

/* ヘッダ */
.chatbot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #E5E7EB;
  background: #F9FAFB;
}

/* メッセージエリア */
.chatbot-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* メッセージバブル */
.chatbot-message {
  max-width: 85%;
  padding: 12px 16px;
  border-radius: 12px;
  line-height: 1.5;
}

.chatbot-message.bot {
  background: #F3F4F6;
  align-self: flex-start;
  border-bottom-left-radius: 4px;
}

.chatbot-message.user {
  background: #4F46E5;
  color: white;
  align-self: flex-end;
  border-bottom-right-radius: 4px;
}

/* 選択肢エリア */
.chatbot-options {
  padding: 12px;
  border-top: 1px solid #E5E7EB;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}

/* 選択肢ボタン */
.chatbot-option {
  padding: 10px 14px;
  background: white;
  border: 1px solid #D1D5DB;
  border-radius: 8px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.chatbot-option:hover {
  background: #F3F4F6;
  border-color: #4F46E5;
}

/* 検索エリア */
.chatbot-search {
  padding: 12px;
  border-top: 1px solid #E5E7EB;
  display: flex;
  gap: 8px;
}

.chatbot-search input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #D1D5DB;
  border-radius: 6px;
}

/* 非表示 */
.chatbot-hidden {
  display: none !important;
}
```

---

## 4. JavaScript実装

```javascript
// chatbot/chatbot.js

class ChatbotWidget {
  constructor(options = {}) {
    this.apiBase = options.apiBase || '/api/v1/chat';
    this.sessionId = null;
    this.screenId = null;
    this.currentState = null;
    
    this.init();
  }
  
  init() {
    this.screenId = resolveScreenId();
    this.bindEvents();
    console.log(`[Chatbot] Initialized for screen: ${this.screenId}`);
  }
  
  bindEvents() {
    // トリガーボタン
    document.getElementById('chatbot-trigger')
      .addEventListener('click', () => this.toggle());
    
    // 閉じるボタン
    document.getElementById('chatbot-close')
      .addEventListener('click', () => this.close());
    
    // 検索サブミット
    document.getElementById('chatbot-search-submit')
      .addEventListener('click', () => this.handleSearch());
    
    // Enter で検索
    document.getElementById('chatbot-search-input')
      .addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.handleSearch();
      });
    
    // ESCでドロワーを閉じる
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) this.close();
    });
  }
  
  async toggle() {
    if (this.isOpen()) {
      this.close();
    } else {
      await this.open();
    }
  }
  
  async open() {
    document.getElementById('chatbot-drawer').classList.add('open');
    
    // 初回 or セッション切れの場合は開始
    if (!this.sessionId) {
      await this.startSession();
    }
  }
  
  close() {
    document.getElementById('chatbot-drawer').classList.remove('open');
  }
  
  isOpen() {
    return document.getElementById('chatbot-drawer').classList.contains('open');
  }
  
  async startSession() {
    try {
      const response = await fetch(`${this.apiBase}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screen_id: this.screenId })
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.sessionId = data.session_id;
        this.currentState = data.state;
        this.renderMessage(data.message, 'bot');
        this.renderOptions(data.options);
      } else {
        this.handleError(data.error);
      }
    } catch (error) {
      console.error('[Chatbot] Start error:', error);
      this.renderMessage('接続エラーが発生しました。', 'bot');
    }
  }
  
  async handleOptionClick(action, target) {
    if (action === 'external') {
      window.open(target, '_blank');
      return;
    }
    
    // ユーザーの選択を表示
    const label = document.querySelector(`[data-target="${target}"]`)?.textContent;
    if (label) {
      this.renderMessage(label, 'user');
    }
    
    try {
      const response = await fetch(`${this.apiBase}/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          action: action,
          target: target
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.currentState = data.state;
        
        // コンテンツ表示の場合
        if (data.content) {
          this.renderContent(data.content);
        } else {
          this.renderMessage(data.message, 'bot');
        }
        
        this.renderOptions(data.options);
        this.toggleSearchInput(data.state.state_id === 'search:active');
      } else {
        this.handleError(data.error);
      }
    } catch (error) {
      console.error('[Chatbot] Step error:', error);
      this.renderMessage('通信エラーが発生しました。', 'bot');
    }
  }
  
  async handleSearch() {
    const input = document.getElementById('chatbot-search-input');
    const query = input.value.trim();
    
    if (query.length < 2) {
      this.renderMessage('2文字以上で入力してください。', 'bot');
      return;
    }
    
    this.renderMessage(`検索: ${query}`, 'user');
    input.value = '';
    
    try {
      const response = await fetch(`${this.apiBase}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          query: query,
          screen_id: this.screenId
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.currentState = data.state;
        this.renderMessage(data.message, 'bot');
        this.renderOptions(data.options);
        this.toggleSearchInput(false);
      } else {
        this.handleError(data.error);
      }
    } catch (error) {
      console.error('[Chatbot] Search error:', error);
      this.renderMessage('検索中にエラーが発生しました。', 'bot');
    }
  }
  
  renderMessage(text, type) {
    const container = document.getElementById('chatbot-messages');
    const div = document.createElement('div');
    div.className = `chatbot-message ${type}`;
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }
  
  renderContent(content) {
    const container = document.getElementById('chatbot-messages');
    
    // タイトル
    const titleDiv = document.createElement('div');
    titleDiv.className = 'chatbot-message bot chatbot-content-title';
    titleDiv.innerHTML = `<strong>${content.title}</strong>`;
    container.appendChild(titleDiv);
    
    // 本文
    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'chatbot-message bot';
    bodyDiv.innerHTML = this.formatMarkdown(content.body);
    container.appendChild(bodyDiv);
    
    // リンク
    if (content.links && content.links.length > 0) {
      const linksDiv = document.createElement('div');
      linksDiv.className = 'chatbot-message bot chatbot-links';
      linksDiv.innerHTML = content.links.map(link => 
        `<a href="${link.url}" target="_blank">${link.label}</a>`
      ).join(' | ');
      container.appendChild(linksDiv);
    }
    
    container.scrollTop = container.scrollHeight;
  }
  
  renderOptions(options) {
    const container = document.getElementById('chatbot-options');
    container.innerHTML = '';
    
    options.forEach(opt => {
      const button = document.createElement('button');
      button.className = 'chatbot-option';
      button.textContent = opt.label;
      button.dataset.target = opt.target;
      button.addEventListener('click', () => {
        this.handleOptionClick(opt.action, opt.target);
      });
      container.appendChild(button);
    });
  }
  
  toggleSearchInput(show) {
    const searchEl = document.getElementById('chatbot-search');
    if (show) {
      searchEl.classList.remove('chatbot-hidden');
      document.getElementById('chatbot-search-input').focus();
    } else {
      searchEl.classList.add('chatbot-hidden');
    }
  }
  
  formatMarkdown(text) {
    // 簡易Markdown変換（改行のみ）
    return text.replace(/\n/g, '<br>');
  }
  
  handleError(error) {
    console.error('[Chatbot] Error:', error);
    this.renderMessage(error.message || 'エラーが発生しました。', 'bot');
    
    // セッション切れの場合はリセット
    if (error.code === 'SESSION_EXPIRED' || error.code === 'SESSION_NOT_FOUND') {
      this.sessionId = null;
      this.renderOptions([
        { label: '再開する', action: 'restart', target: '' }
      ]);
    }
  }
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  window.chatbot = new ChatbotWidget();
});
```

---

## 5. 既存アプリへの統合

### index.htmlへの追加

```html
<!-- body終了タグ前に追加 -->
<link rel="stylesheet" href="/chatbot/chatbot.css">
<script src="/chatbot/screen-resolver.js"></script>
<script src="/chatbot/chatbot.js"></script>
```

### SPAの場合（React例）

```jsx
// ChatbotWidget.jsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function ChatbotWidget() {
  const location = useLocation();
  
  useEffect(() => {
    // ルート変更時にscreen_idを更新
    if (window.chatbot) {
      window.chatbot.screenId = resolveScreenIdFromPath(location.pathname);
    }
  }, [location.pathname]);
  
  return null; // DOM操作はVanilla JSで行う
}
```

---

## 6. セキュリティ考慮事項

### XSS対策

```javascript
// コンテンツ表示時のサニタイズ
formatMarkdown(text) {
  // HTMLエスケープ
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  
  // 改行のみ変換
  return escaped.replace(/\n/g, '<br>');
}
```

### リンクの検証

```javascript
// 外部リンククリック時
if (action === 'external') {
  // 許可ドメインのチェック
  const allowedDomains = ['example.com', 'docs.example.com'];
  try {
    const url = new URL(target, window.location.origin);
    if (!allowedDomains.some(d => url.hostname.endsWith(d))) {
      console.warn('[Chatbot] Blocked external link:', target);
      return;
    }
  } catch {
    // 相対パスの場合はOK
  }
  window.open(target, '_blank', 'noopener,noreferrer');
}
```

### CSRFトークン

```javascript
// APIリクエストにCSRFトークンを含める
async fetch(url, options) {
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
  
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'X-CSRF-Token': csrfToken
    }
  });
}
```

---

## TODO / 仮置き事項

- [ ] アクセシビリティ対応（ARIA属性の追加、キーボード操作）
- [ ] ダークモード対応
- [ ] モバイル対応（レスポンシブ）
- [ ] アニメーション調整
