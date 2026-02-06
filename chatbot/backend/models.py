# API入出力の型定義
# dataclassを使用（Flask向け）

from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Any
from enum import Enum


class ActionType(Enum):
    """選択肢のアクション種別"""
    NAVIGATE = "navigate"
    SHOW_CONTENT = "show_content"
    BACK = "back"
    SEARCH = "search"
    EXTERNAL = "external"


@dataclass
class OptionItem:
    """選択肢アイテム"""
    id: str
    label: str
    action: str
    target: str
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ContentDetail:
    """コンテンツ詳細"""
    id: str
    title: str
    body: str
    links: List[Dict[str, str]] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class StateInfo:
    """状態情報"""
    state_id: str
    history: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class InputMode:
    """入力モード"""
    free_text: bool = False
    placeholder: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ChatResponse:
    """チャットAPIレスポンス"""
    success: bool
    session_id: str
    state: StateInfo
    message: str
    options: List[OptionItem] = field(default_factory=list)
    content: Optional[ContentDetail] = None
    input_mode: InputMode = field(default_factory=InputMode)
    screen_info: Optional[Dict[str, str]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        result = {
            "success": self.success,
            "session_id": self.session_id,
            "state": self.state.to_dict(),
            "message": self.message,
            "options": [o.to_dict() for o in self.options],
            "input_mode": self.input_mode.to_dict(),
        }
        if self.content:
            result["content"] = self.content.to_dict()
        if self.screen_info:
            result["screen_info"] = self.screen_info
        return result


@dataclass 
class ErrorResponse:
    """エラーレスポンス"""
    success: bool = False
    error_code: str = ""
    message: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "error": {
                "code": self.error_code,
                "message": self.message
            }
        }


# リクエスト型
@dataclass
class StartRequest:
    """開始リクエスト"""
    screen_id: str


@dataclass
class StepRequest:
    """遷移リクエスト"""
    session_id: str
    action: str
    target: str = ""
    query: str = ""  # 検索用
