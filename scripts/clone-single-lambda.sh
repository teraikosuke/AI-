#!/bin/bash
# =============================================================================
# Lambda関数 本番環境複製スクリプト（シンプル版）
# =============================================================================
# 使用方法: ./scripts/clone-single-lambda.sh <dev-function-name>
# 例: ./scripts/clone-single-lambda.sh ats-api-dev-auth-me
# =============================================================================

set -e

if [ -z "$1" ]; then
  echo "使用方法: $0 <dev-function-name>"
  echo "例: $0 ats-api-dev-auth-me"
  exit 1
fi

DEV_FUNC="$1"
PROD_FUNC="${DEV_FUNC/dev/prod}"
REGION="ap-northeast-1"
TEMP_DIR="/tmp/lambda-clone"

echo "=============================================="
echo "複製: $DEV_FUNC → $PROD_FUNC"
echo "=============================================="

mkdir -p "$TEMP_DIR"

# 1. 関数情報を取得
echo "📥 関数情報を取得中..."
RUNTIME=$(aws lambda get-function-configuration --function-name "$DEV_FUNC" --region "$REGION" --query 'Runtime' --output text)
HANDLER=$(aws lambda get-function-configuration --function-name "$DEV_FUNC" --region "$REGION" --query 'Handler' --output text)
ROLE=$(aws lambda get-function-configuration --function-name "$DEV_FUNC" --region "$REGION" --query 'Role' --output text)
TIMEOUT=$(aws lambda get-function-configuration --function-name "$DEV_FUNC" --region "$REGION" --query 'Timeout' --output text)
MEMORY=$(aws lambda get-function-configuration --function-name "$DEV_FUNC" --region "$REGION" --query 'MemorySize' --output text)

echo "  Runtime: $RUNTIME"
echo "  Handler: $HANDLER"
echo "  Timeout: $TIMEOUT"
echo "  Memory: $MEMORY"

# 2. コードをダウンロード
echo "📦 コードをダウンロード中..."
CODE_URL=$(aws lambda get-function --function-name "$DEV_FUNC" --region "$REGION" --query 'Code.Location' --output text)
ZIP_FILE="$TEMP_DIR/${DEV_FUNC}.zip"
curl -s -o "$ZIP_FILE" "$CODE_URL"
echo "  ダウンロード完了: $(ls -lh "$ZIP_FILE" | awk '{print $5}')"

# 3. 環境変数を取得してファイルに保存
echo "🔧 環境変数を取得中..."
aws lambda get-function-configuration --function-name "$DEV_FUNC" --region "$REGION" --query 'Environment' --output json > "$TEMP_DIR/env.json"

# NODE_ENV=productionを追加
cat "$TEMP_DIR/env.json" | jq '.Variables.NODE_ENV = "production"' > "$TEMP_DIR/env_prod.json"

# ランタイムをnodejs20.xに固定
if [[ "$RUNTIME" == "nodejs24.x" ]]; then
  RUNTIME="nodejs20.x"
  echo "  ランタイムを nodejs20.x に変更"
fi

# 4. 本番用関数を作成
echo "🚀 本番用関数を作成中..."
aws lambda create-function \
  --function-name "$PROD_FUNC" \
  --runtime "$RUNTIME" \
  --handler "$HANDLER" \
  --role "$ROLE" \
  --timeout "$TIMEOUT" \
  --memory-size "$MEMORY" \
  --zip-file "fileb://$ZIP_FILE" \
  --region "$REGION" \
  --environment "file://$TEMP_DIR/env_prod.json"

echo ""
echo "✅ 作成完了: $PROD_FUNC"
