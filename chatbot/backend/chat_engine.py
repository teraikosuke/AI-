# チャットエンジン
# 状態遷移（state machine）とルール処理
# 重要: 生成禁止 - 必ず content_items / system_messages の固定文言のみ返す

import logging
from typing import Optional, List, Tuple

from models import (
    OptionItem, ContentDetail, StateInfo, InputMode, ChatResponse
)
from session_store import Session, session_store
from content_repo import content_repo
from search import search_engine

logger = logging.getLogger(__name__)


class ChatEngine:
    """チャットエンジン（状態遷移管理）"""
    
    # === 状態タイプ定義 ===
    # home:{screen_id} - 画面ホーム
    # menu:{menu_id} - メニュー表示
    # cat:{category}:{screen_id} - カテゴリ内一覧
    # ans:{content_id} - コンテンツ表示
    # search:{screen_id} - 検索入力待ち
    # nf:{screen_id} - 該当なし（検索誘導）
    
    def start_session(self, screen_id: str) -> ChatResponse:
        """
        セッション開始
        
        Args:
            screen_id: 画面ID
        
        Returns:
            初期状態のレスポンス
        """
        # screen_id 検証（不明なら global にフォールバック）
        valid_screen_id = content_repo.resolve_screen_id(screen_id)
        
        # セッション作成
        session = session_store.create(valid_screen_id)
        
        # ホームメニューを取得
        return self._build_home_response(session, valid_screen_id)
    
    def step(
        self, 
        session_id: str, 
        action: str, 
        target: str = "",
        query: str = ""
    ) -> ChatResponse:
        """
        状態遷移
        
        Args:
            session_id: セッションID
            action: アクション種別
            target: 遷移先
            query: 検索クエリ（action=search時）
        
        Returns:
            遷移後のレスポンス
        """
        # セッション取得
        session = session_store.get(session_id)
        if not session:
            return self._error_response(session_id, "SESSION_NOT_FOUND", 
                content_repo.get_system_message("error_session_expired"))
        
        # アクション処理
        if action == "navigate":
            return self._handle_navigate(session, target)
        elif action == "show_content":
            return self._handle_show_content(session, target)
        elif action == "back":
            return self._handle_back(session)
        elif action == "reset":
            return self._handle_reset(session)
        elif action == "search":
            return self._handle_search(session, query)
        elif action == "free_text":
            return self._handle_free_text(session, query)
        else:
            return self._error_response(session.session_id, "INVALID_ACTION",
                content_repo.get_system_message("error"))
    
    # === アクションハンドラ ===
    
    def _handle_navigate(self, session: Session, target: str) -> ChatResponse:
        """遷移処理"""
        session.push_state(target)
        return self._build_state_response(session, target)
    
    def _handle_show_content(self, session: Session, target: str) -> ChatResponse:
        """コンテンツ表示"""
        # target は "ans:{content_id}" 形式
        if target.startswith("ans:"):
            content_id = target[4:]
        else:
            content_id = target
        
        state_id = f"ans:{content_id}"
        session.push_state(state_id)
        return self._build_content_response(session, content_id)
    
    def _handle_back(self, session: Session) -> ChatResponse:
        """戻る処理"""
        prev_state = session.pop_state()
        if prev_state:
            return self._build_state_response(session, prev_state)
        else:
            # 履歴がない場合はホームへ
            return self._build_home_response(session, session.screen_id)
    
    def _handle_reset(self, session: Session) -> ChatResponse:
        """リセット処理"""
        session.reset_to_home()
        return self._build_home_response(session, session.screen_id)
    
    def _handle_search(self, session: Session, query: str) -> ChatResponse:
        """検索処理"""
        if not query or len(query.strip()) < 2:
            # クエリ短すぎ → 検索入力状態に留まる
            state_id = f"search:{session.screen_id}"
            session.push_state(state_id)
            return self._build_search_prompt_response(session, 
                content_repo.get_system_message("search_too_short"))
        
        # 検索実行
        results = search_engine.search(query, session.screen_id)
        
        if not results:
            # 該当なし
            return self._build_no_result_response(session, query)
        
        # 検索結果を返す
        return self._build_search_results_response(session, query, results)
    
    def _handle_free_text(self, session: Session, query: str) -> ChatResponse:
        """
        自由入力処理
        重要: search:{screen_id} 状態のみ受け付ける
        """
        current = session.current_state
        
        # 検索状態の場合のみ処理
        if current.startswith("search:"):
            return self._handle_search(session, query)
        
        # それ以外は誘導メッセージ
        # 生成禁止: 必ず固定文言を返す
        message = content_repo.get_system_message("select_from_options")
        options = self._get_current_options(session)
        
        return ChatResponse(
            success=True,
            session_id=session.session_id,
            state=StateInfo(session.current_state, list(session.history)),
            message=message,
            options=options,
            input_mode=InputMode(free_text=False)
        )
    
    # === レスポンスビルダー ===
    
    def _build_home_response(self, session: Session, screen_id: str) -> ChatResponse:
        """ホーム画面レスポンス"""
        menu = content_repo.get_home_menu(screen_id)
        if not menu:
            # フォールバック: global ホーム
            menu = content_repo.get_home_menu("global")
        
        message = menu.get("message", content_repo.get_system_message("welcome"))
        options = self._menu_to_options(menu)
        
        screen_info = content_repo.get_screen(screen_id)
        
        return ChatResponse(
            success=True,
            session_id=session.session_id,
            state=StateInfo(session.current_state, list(session.history)),
            message=message,
            options=options,
            input_mode=InputMode(free_text=False),
            screen_info={"name": screen_info.get("name", screen_id)} if screen_info else None
        )
    
    def _build_state_response(self, session: Session, state_id: str) -> ChatResponse:
        """状態に応じたレスポンス"""
        if state_id.startswith("home:"):
            screen_id = state_id[5:]
            return self._build_home_response(session, screen_id)
        
        elif state_id.startswith("menu:"):
            menu_id = state_id
            return self._build_menu_response(session, menu_id)
        
        elif state_id.startswith("cat:"):
            # cat:{category}:{screen_id}
            parts = state_id.split(":")
            if len(parts) >= 3:
                category, screen_id = parts[1], parts[2]
                return self._build_category_response(session, category, screen_id)
        
        elif state_id.startswith("ans:"):
            content_id = state_id[4:]
            return self._build_content_response(session, content_id)
        
        elif state_id.startswith("search:"):
            return self._build_search_prompt_response(session,
                content_repo.get_system_message("search_prompt"))
        
        elif state_id.startswith("nf:"):
            return self._build_not_found_response(session)
        
        # 不明な状態 → ホームへ
        logger.warning(f"Unknown state: {state_id}")
        session.reset_to_home()
        return self._build_home_response(session, session.screen_id)
    
    def _build_menu_response(self, session: Session, menu_id: str) -> ChatResponse:
        """メニュー表示レスポンス"""
        menu = content_repo.get_menu(menu_id)
        if not menu:
            # 見つからない場合はホームへ
            session.reset_to_home()
            return self._build_home_response(session, session.screen_id)
        
        message = menu.get("message", "")
        options = self._menu_to_options(menu)
        
        # 戻る選択肢を追加
        options.append(OptionItem(
            id="opt_back",
            label="戻る",
            action="back",
            target=""
        ))
        
        return ChatResponse(
            success=True,
            session_id=session.session_id,
            state=StateInfo(session.current_state, list(session.history)),
            message=message,
            options=options,
            input_mode=InputMode(free_text=False)
        )
    
    def _build_category_response(
        self, 
        session: Session, 
        category: str, 
        screen_id: str
    ) -> ChatResponse:
        """カテゴリ内コンテンツ一覧"""
        menu_id = f"cat:{category}:{screen_id}"
        menu = content_repo.get_menu(menu_id)
        
        if menu:
            message = menu.get("message", "")
            options = self._menu_to_options(menu)
        else:
            message = content_repo.get_system_message("category_empty")
            options = []
        
        # 検索誘導と戻る
        options.append(OptionItem(
            id="opt_search",
            label="探しているものがない → 検索",
            action="navigate",
            target=f"search:{screen_id}"
        ))
        options.append(OptionItem(
            id="opt_back",
            label="戻る",
            action="back",
            target=""
        ))
        
        return ChatResponse(
            success=True,
            session_id=session.session_id,
            state=StateInfo(session.current_state, list(session.history)),
            message=message,
            options=options,
            input_mode=InputMode(free_text=False)
        )
    
    def _build_content_response(self, session: Session, content_id: str) -> ChatResponse:
        """コンテンツ詳細レスポンス"""
        item = content_repo.get_content(content_id)
        
        if not item:
            # コンテンツが見つからない
            return self._build_not_found_response(session)
        
        content = ContentDetail(
            id=content_id,
            title=item["title"],
            body=item["body"],
            links=item.get("links", [])
        )
        
        # 関連コンテンツがあれば選択肢に
        options = []
        for related_id in item.get("related", [])[:3]:
            related = content_repo.get_content(related_id)
            if related:
                options.append(OptionItem(
                    id=f"opt_{related_id}",
                    label=f"関連: {related['title']}",
                    action="show_content",
                    target=f"ans:{related_id}"
                ))
        
        # 戻ると最初に戻る
        options.append(OptionItem(
            id="opt_back",
            label="戻る",
            action="back",
            target=""
        ))
        options.append(OptionItem(
            id="opt_reset",
            label="最初に戻る",
            action="reset",
            target=""
        ))
        
        return ChatResponse(
            success=True,
            session_id=session.session_id,
            state=StateInfo(session.current_state, list(session.history)),
            message="",  # コンテンツ表示時はメッセージなし
            options=options,
            content=content,
            input_mode=InputMode(free_text=False)
        )
    
    def _build_search_prompt_response(
        self, 
        session: Session, 
        message: str
    ) -> ChatResponse:
        """検索入力待ちレスポンス"""
        state_id = f"search:{session.screen_id}"
        if session.current_state != state_id:
            session.push_state(state_id)
        
        options = [
            OptionItem(
                id="opt_back",
                label="戻る",
                action="back",
                target=""
            )
        ]
        
        return ChatResponse(
            success=True,
            session_id=session.session_id,
            state=StateInfo(session.current_state, list(session.history)),
            message=message,
            options=options,
            input_mode=InputMode(
                free_text=True,
                placeholder="キーワードを入力..."
            )
        )
    
    def _build_search_results_response(
        self, 
        session: Session, 
        query: str, 
        results: List[dict]
    ) -> ChatResponse:
        """検索結果レスポンス"""
        message = content_repo.get_system_message("search_results").format(query=query, count=len(results))
        
        options = []
        for r in results:
            options.append(OptionItem(
                id=f"opt_{r['id']}",
                label=r["title"],
                action="show_content",
                target=f"ans:{r['id']}"
            ))
        
        # 再検索と戻る
        options.append(OptionItem(
            id="opt_retry",
            label="別のキーワードで検索",
            action="navigate",
            target=f"search:{session.screen_id}"
        ))
        options.append(OptionItem(
            id="opt_back",
            label="戻る",
            action="back",
            target=""
        ))
        
        return ChatResponse(
            success=True,
            session_id=session.session_id,
            state=StateInfo(session.current_state, list(session.history)),
            message=message,
            options=options,
            input_mode=InputMode(free_text=False)
        )
    
    def _build_no_result_response(self, session: Session, query: str) -> ChatResponse:
        """検索結果なしレスポンス"""
        message = content_repo.get_system_message("search_no_result").format(query=query)
        
        options = [
            OptionItem(
                id="opt_retry",
                label="別のキーワードで検索",
                action="navigate",
                target=f"search:{session.screen_id}"
            ),
            OptionItem(
                id="opt_reset",
                label="最初に戻る",
                action="reset",
                target=""
            )
        ]
        
        return ChatResponse(
            success=True,
            session_id=session.session_id,
            state=StateInfo(session.current_state, list(session.history)),
            message=message,
            options=options,
            input_mode=InputMode(free_text=True, placeholder="別のキーワード...")
        )
    
    def _build_not_found_response(self, session: Session) -> ChatResponse:
        """該当なしレスポンス（検索誘導）"""
        state_id = f"nf:{session.screen_id}"
        session.push_state(state_id)
        
        message = content_repo.get_system_message("not_found")
        
        options = [
            OptionItem(
                id="opt_search",
                label="キーワードで検索する",
                action="navigate",
                target=f"search:{session.screen_id}"
            ),
            OptionItem(
                id="opt_reset",
                label="最初に戻る",
                action="reset",
                target=""
            )
        ]
        
        return ChatResponse(
            success=True,
            session_id=session.session_id,
            state=StateInfo(session.current_state, list(session.history)),
            message=message,
            options=options,
            input_mode=InputMode(free_text=False)
        )
    
    def _error_response(
        self, 
        session_id: str, 
        code: str, 
        message: str
    ) -> ChatResponse:
        """エラーレスポンス"""
        return ChatResponse(
            success=False,
            session_id=session_id,
            state=StateInfo("error", []),
            message=message,
            options=[],
            input_mode=InputMode(free_text=False)
        )
    
    # === ヘルパー ===
    
    def _menu_to_options(self, menu: dict) -> List[OptionItem]:
        """メニュー定義を選択肢リストに変換"""
        options = []
        for i, opt in enumerate(menu.get("options", [])):
            next_state = opt.get("next_state", "")
            
            # アクション判定
            if next_state.startswith("ans:"):
                action = "show_content"
            else:
                action = "navigate"
            
            options.append(OptionItem(
                id=f"opt_{i}",
                label=opt["label"],
                action=action,
                target=next_state
            ))
        
        return options
    
    def _get_current_options(self, session: Session) -> List[OptionItem]:
        """現在の状態の選択肢を取得"""
        state = session.current_state
        
        if state.startswith("home:"):
            menu = content_repo.get_home_menu(state[5:])
            if menu:
                return self._menu_to_options(menu)
        
        elif state.startswith("menu:"):
            menu = content_repo.get_menu(state)
            if menu:
                return self._menu_to_options(menu)
        
        return []


# シングルトンインスタンス
chat_engine = ChatEngine()
