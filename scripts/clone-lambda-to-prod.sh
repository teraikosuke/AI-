#!/bin/bash
# =============================================================================
# Lambda関数 本番環境複製スクリプト
# =============================================================================
# 使用方法: ./scripts/clone-lambda-to-prod.sh
#
# このスクリプトは開発用Lambda関数（ats-api-dev-*）を
# 本番用（ats-api-prod-*）として複製します。
# =============================================================================

set -e

# 設定
REGION="ap-northeast-1"
SOURCE_PREFIX="ats-api-dev-"
TARGET_PREFIX="ats-api-prod-"
TEMP_DIR="/tmp/lambda-clone"

# 色付き出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=============================================="
echo "Lambda関数 本番環境複製スクリプト"
echo "=============================================="
echo ""

# 一時ディレクトリ作成
mkdir -p "$TEMP_DIR"

# 開発用Lambda関数リストを取得
echo "📋 開発用Lambda関数を取得中..."
DEV_FUNCTIONS=$(aws lambda list-functions \
  --region "$REGION" \
  --query "Functions[?contains(FunctionName, '$SOURCE_PREFIX')].FunctionName" \
  --output text)

if [ -z "$DEV_FUNCTIONS" ]; then
  echo -e "${RED}❌ 開発用Lambda関数が見つかりません${NC}"
  exit 1
fi

echo "見つかった関数:"
echo "$DEV_FUNCTIONS" | tr '\t' '\n'
echo ""

# 本番用環境変数の設定（必要に応じて編集）
echo -e "${YELLOW}⚠️  注意: 本番用の環境変数を設定してください${NC}"
echo "以下の環境変数を .env.prod ファイルに設定してから実行してください:"
echo "  - DB_HOST"
echo "  - DB_NAME"
echo "  - DB_USER"
echo "  - DB_PASSWORD"
echo "  - JWT_SECRET"
echo "  - CORS_ALLOWED_ORIGINS"
echo ""

# 確認
read -p "続行しますか？ [y/N]: " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "キャンセルしました"
  exit 0
fi

# 各関数を複製
for DEV_FUNC in $DEV_FUNCTIONS; do
  # 本番用の関数名を生成
  PROD_FUNC="${DEV_FUNC/$SOURCE_PREFIX/$TARGET_PREFIX}"
  
  echo ""
  echo "=============================================="
  echo "複製中: $DEV_FUNC → $PROD_FUNC"
  echo "=============================================="
  
  # 既存の本番関数をチェック
  if aws lambda get-function --function-name "$PROD_FUNC" --region "$REGION" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  $PROD_FUNC は既に存在します。スキップします。${NC}"
    continue
  fi
  
  # 1. 開発用関数の情報を取得
  echo "📥 関数情報を取得中..."
  FUNC_INFO=$(aws lambda get-function --function-name "$DEV_FUNC" --region "$REGION")
  
  # 2. コードをダウンロード
  CODE_URL=$(echo "$FUNC_INFO" | jq -r '.Code.Location')
  ZIP_FILE="$TEMP_DIR/$DEV_FUNC.zip"
  curl -s -o "$ZIP_FILE" "$CODE_URL"
  
  # 3. 関数の設定を取得
  RUNTIME=$(echo "$FUNC_INFO" | jq -r '.Configuration.Runtime')
  HANDLER=$(echo "$FUNC_INFO" | jq -r '.Configuration.Handler')
  ROLE=$(echo "$FUNC_INFO" | jq -r '.Configuration.Role')
  TIMEOUT=$(echo "$FUNC_INFO" | jq -r '.Configuration.Timeout')
  MEMORY=$(echo "$FUNC_INFO" | jq -r '.Configuration.MemorySize')
  
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
    --environment "Variables={NODE_ENV=production}"
  
  echo -e "${GREEN}✅ $PROD_FUNC を作成しました${NC}"
done

# クリーンアップ
rm -rf "$TEMP_DIR"

echo ""
echo "=============================================="
echo -e "${GREEN}✅ 複製完了！${NC}"
echo "=============================================="
echo ""
echo "次のステップ:"
echo "1. 各本番関数の環境変数を設定してください"
echo "2. API Gatewayと連携してください"
echo "3. テストを実行してください"
