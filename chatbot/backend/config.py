# 設定管理
# 環境変数から設定を読み込む

import os
from pathlib import Path


class Config:
    """アプリケーション設定"""
    
    # パス設定
    BASE_DIR = Path(__file__).parent.parent
    CONTENT_PATH = os.getenv("CONTENT_PATH", str(BASE_DIR / "contents" / "contents.json"))
    SCHEMA_PATH = os.getenv("SCHEMA_PATH", str(BASE_DIR / "contents" / "contents.schema.json"))
    CONTENT_SOURCE = os.getenv("CONTENT_SOURCE", "json")  # "json" or "csv"
    CONTENT_CSV_DIR = os.getenv("CONTENT_CSV_DIR", str(BASE_DIR / "contents" / "csv"))
    
    # セッション設定
    SESSION_TTL = int(os.getenv("SESSION_TTL", "1800"))  # 30分
    MAX_HISTORY = int(os.getenv("MAX_HISTORY", "10"))
    
    # 検索設定
    SEARCH_MAX_RESULTS = int(os.getenv("SEARCH_MAX_RESULTS", "5"))
    SEARCH_MIN_QUERY_LEN = int(os.getenv("SEARCH_MIN_QUERY_LEN", "2"))
    
    # ログ設定
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    
    # CORS設定（本番では制限すること）
    # TODO: 本番環境では CORS_ORIGINS を適切なドメインに制限する
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")
    
    # API設定
    API_PREFIX = "/api/v1/helpchat"


config = Config()
