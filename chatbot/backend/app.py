# Flask API
# 実行: python app.py
# Flask を採用: 軽量で最小構成に適しているため

import logging
from flask import Flask, request, jsonify
from flask_cors import CORS

from config import config
from content_repo import content_repo, ContentValidationError
from chat_engine import chat_engine
from search import search_engine

# ロギング設定
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

# Flask アプリ
app = Flask(__name__)

# CORS設定
# TODO: 本番環境では origins を適切なドメインに制限すること
CORS(app, origins=config.CORS_ORIGINS)


# === 起動時初期化 ===

def initialize():
    """アプリケーション初期化"""
    try:
        content_repo.load()
        search_engine.initialize()
        logger.info("Application initialized successfully")
    except ContentValidationError as e:
        logger.error(f"Content validation failed: {e}")
        raise


# === API エンドポイント ===

@app.route(f"{config.API_PREFIX}/start", methods=["POST"])
def start_chat():
    """
    チャットセッション開始
    
    Request:
        {"screen_id": "yield_personal"}
    
    Response:
        ChatResponse (see models.py)
    """
    try:
        data = request.get_json() or {}
        screen_id = data.get("screen_id", "global")
        
        response = chat_engine.start_session(screen_id)
        return jsonify(response.to_dict())
    
    except Exception as e:
        logger.exception("Error in start_chat")
        return jsonify({
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": content_repo.get_system_message("error") or "エラーが発生しました"
            }
        }), 500


@app.route(f"{config.API_PREFIX}/step", methods=["POST"])
def step_chat():
    """
    状態遷移
    
    Request:
        {
            "session_id": "uuid",
            "action": "navigate|show_content|back|reset|search|free_text",
            "target": "state_id or content_id",
            "query": "search query (for action=search or free_text)"
        }
    
    Response:
        ChatResponse (see models.py)
    """
    try:
        data = request.get_json() or {}
        
        session_id = data.get("session_id", "")
        action = data.get("action", "")
        target = data.get("target", "")
        query = data.get("query", "")
        
        if not session_id:
            return jsonify({
                "success": False,
                "error": {
                    "code": "MISSING_SESSION_ID",
                    "message": "session_id is required"
                }
            }), 400
        
        if not action:
            return jsonify({
                "success": False,
                "error": {
                    "code": "MISSING_ACTION",
                    "message": "action is required"
                }
            }), 400
        
        response = chat_engine.step(session_id, action, target, query)
        
        # セッション切れの場合は 410 を返す
        if not response.success and "SESSION" in response.message:
            return jsonify(response.to_dict()), 410
        
        return jsonify(response.to_dict())
    
    except Exception as e:
        logger.exception("Error in step_chat")
        return jsonify({
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": content_repo.get_system_message("error") or "エラーが発生しました"
            }
        }), 500


@app.route(f"{config.API_PREFIX}/health", methods=["GET"])
def health_check():
    """ヘルスチェック"""
    return jsonify({
        "status": "ok",
        "version": content_repo._data.get("meta", {}).get("version", "unknown")
    })


# === メイン ===

if __name__ == "__main__":
    initialize()
    
    # 開発サーバー起動
    # 本番では gunicorn などを使用すること
    app.run(
        host="0.0.0.0",
        port=5001,
        debug=config.LOG_LEVEL == "DEBUG"
    )
