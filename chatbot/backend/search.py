# 検索機能
# キーワードによる候補提示（生成禁止確保）

import re
import logging
from typing import List, Dict, Any, Tuple

from content_repo import content_repo
from config import config

logger = logging.getLogger(__name__)


class SearchEngine:
    """検索エンジン（候補提示のみ）"""
    
    def __init__(self):
        self._synonyms: Dict[str, List[str]] = {}
        self._stopwords: set = set()
        self._initialized = False
    
    def initialize(self) -> None:
        """検索設定を読み込み"""
        search_config = content_repo.get_search_config()
        self._synonyms = search_config.get("synonyms", {})
        self._stopwords = set(search_config.get("stopwords", []))
        self._initialized = True
    
    def _ensure_initialized(self) -> None:
        if not self._initialized:
            self.initialize()
    
    def _normalize(self, text: str) -> str:
        """テキスト正規化"""
        # 小文字化、空白統一
        text = text.lower().strip()
        text = re.sub(r"\s+", " ", text)
        return text
    
    def _tokenize(self, text: str) -> List[str]:
        """トークン分割（簡易）"""
        text = self._normalize(text)
        # スペースで分割 + ストップワード除去
        tokens = [t for t in text.split() if t not in self._stopwords and len(t) >= 2]
        return tokens
    
    def _expand_synonyms(self, tokens: List[str]) -> List[str]:
        """シノニム展開"""
        expanded = set(tokens)
        for token in tokens:
            if token in self._synonyms:
                expanded.update(self._synonyms[token])
        return list(expanded)
    
    def _score_item(self, item: Dict[str, Any], query_tokens: List[str]) -> float:
        """アイテムのスコア計算"""
        score = 0.0
        
        title = self._normalize(item.get("title", ""))
        body = self._normalize(item.get("body", ""))
        keywords = [self._normalize(k) for k in item.get("keywords", [])]
        
        for token in query_tokens:
            # タイトル一致（高スコア）
            if token in title:
                score += 3.0
            # キーワード一致（中スコア）
            if any(token in kw or kw in token for kw in keywords):
                score += 2.0
            # 本文一致（低スコア）
            if token in body:
                score += 1.0
        
        # 優先度による補正
        priority = item.get("priority", 50)
        score += priority / 100.0
        
        return score
    
    def search(
        self, 
        query: str, 
        screen_id: str = None,
        max_results: int = None
    ) -> List[Dict[str, Any]]:
        """
        検索実行
        
        Args:
            query: 検索クエリ
            screen_id: 絞り込み用画面ID（省略時は全画面）
            max_results: 最大結果数
        
        Returns:
            スコア順のコンテンツリスト（id, title, snippet, score）
        """
        self._ensure_initialized()
        
        if max_results is None:
            max_results = config.SEARCH_MAX_RESULTS
        
        # クエリが短すぎる
        if len(query.strip()) < config.SEARCH_MIN_QUERY_LEN:
            return []
        
        # トークン化 & シノニム展開
        tokens = self._tokenize(query)
        tokens = self._expand_synonyms(tokens)
        
        if not tokens:
            return []
        
        # スコア計算
        scored: List[Tuple[float, str, Dict[str, Any]]] = []
        
        for item_id, item in content_repo.get_all_contents().items():
            # 画面フィルタ
            item_screens = item.get("screens", [])
            if screen_id and item_screens and screen_id not in item_screens:
                continue
            
            score = self._score_item(item, tokens)
            if score > 0:
                scored.append((score, item_id, item))
        
        # スコア降順でソート
        scored.sort(key=lambda x: x[0], reverse=True)
        
        # 結果整形
        results = []
        for score, item_id, item in scored[:max_results]:
            body = item.get("body", "")
            snippet = body[:80] + "..." if len(body) > 80 else body
            results.append({
                "id": item_id,
                "title": item["title"],
                "snippet": snippet,
                "score": round(score, 2)
            })
        
        logger.info(f"Search '{query}' -> {len(results)} results")
        return results


# シングルトンインスタンス
search_engine = SearchEngine()
