# セッション管理
# インメモリ実装（将来Redis等に差し替え可能）

import uuid
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from threading import Lock

from config import config


@dataclass
class Session:
    """セッションデータ"""
    session_id: str
    screen_id: str
    current_state: str
    history: List[str] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    last_activity: float = field(default_factory=time.time)
    
    def is_expired(self) -> bool:
        return time.time() - self.last_activity > config.SESSION_TTL
    
    def touch(self) -> None:
        """アクティビティ更新"""
        self.last_activity = time.time()
    
    def push_state(self, state_id: str) -> None:
        """履歴に現在の状態を追加して遷移"""
        if self.current_state:
            self.history.append(self.current_state)
            # 最大履歴数を超えたら古いものを削除
            if len(self.history) > config.MAX_HISTORY:
                self.history = self.history[-config.MAX_HISTORY:]
        self.current_state = state_id
        self.touch()
    
    def pop_state(self) -> Optional[str]:
        """履歴から1つ戻る"""
        if self.history:
            prev = self.history.pop()
            self.current_state = prev
            self.touch()
            return prev
        return None
    
    def reset_to_home(self) -> str:
        """ホームにリセット"""
        home_state = f"home:{self.screen_id}"
        self.history.clear()
        self.current_state = home_state
        self.touch()
        return home_state


class SessionStore:
    """セッションストア（インメモリ実装）"""
    
    def __init__(self):
        self._sessions: Dict[str, Session] = {}
        self._lock = Lock()
    
    def create(self, screen_id: str) -> Session:
        """新規セッション作成"""
        session_id = str(uuid.uuid4())
        initial_state = f"home:{screen_id}"
        
        session = Session(
            session_id=session_id,
            screen_id=screen_id,
            current_state=initial_state,
            history=[]
        )
        
        with self._lock:
            self._sessions[session_id] = session
        
        return session
    
    def get(self, session_id: str) -> Optional[Session]:
        """セッション取得"""
        with self._lock:
            session = self._sessions.get(session_id)
            if session and session.is_expired():
                del self._sessions[session_id]
                return None
            return session
    
    def delete(self, session_id: str) -> bool:
        """セッション削除"""
        with self._lock:
            if session_id in self._sessions:
                del self._sessions[session_id]
                return True
            return False
    
    def cleanup_expired(self) -> int:
        """期限切れセッションを削除"""
        count = 0
        with self._lock:
            expired = [
                sid for sid, s in self._sessions.items() 
                if s.is_expired()
            ]
            for sid in expired:
                del self._sessions[sid]
                count += 1
        return count


# シングルトンインスタンス
session_store = SessionStore()
