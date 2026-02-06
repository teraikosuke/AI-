#!/bin/bash
# =============================================================================
# Lambda関数 本番環境一括複製スクリプト（自動実行版）
# =============================================================================

set -e

REGION="ap-northeast-1"
TEMP_DIR="/tmp/lambda-clone"

# 色付き出力
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 複製対象の関数リスト
DEV_FUNCTIONS=(
  "ats-api-dev-auth-me"
  "ats-api-dev-candidates-detail"
  "ats-api-dev-candidates-list"
  "ats-api-dev-clients-create"
  "ats-api-dev-goal-settings"
  "ats-api-dev-kpi-ads"
  "ats-api-dev-kpi-ads-detail"
  "ats-api-dev-kpi-clients"
  "ats-api-dev-kpi-clients-edit"
  "ats-api-dev-kpi-targets"
  "ats-api-dev-kpi-teleapo"
  "ats-api-dev-kpi-yield"
  "ats-api-dev-kpi-yield-daily"
  "ats-api-dev-kpi-yield-personal"
  "ats-api-dev-members"
  "ats-api-dev-ms-targets"
  "ats-api-dev-mypage"
  "ats-api-dev-teleapo-candidate-contact"
  "ats-api-dev-teleapo-log-create"
  "ats-api-dev-teleapo-logs"
)

echo "=============================================="
echo "Lambda関数 本番環境一括複製スクリプト"
echo "=============================================="
echo ""

mkdir -p "$TEMP_DIR"

SUCCESS_COUNT=0
SKIP_COUNT=0
FAIL_COUNT=0

for DEV_FUNC in "${DEV_FUNCTIONS[@]}"; do
  PROD_FUNC="${DEV_FUNC/dev/prod}"
  
  echo ""
  echo "----------------------------------------------"
  echo "処理中: $DEV_FUNC → $PROD_FUNC"
  echo "----------------------------------------------"
  
  # 既存チェック
  if aws lambda get-function --function-name "$PROD_FUNC" --region "$REGION" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  既に存在します。スキップ。${NC}"
    ((SKIP_COUNT++))
    continue
  fi
  
  # 関数情報取得
  echo "📥 関数情報を取得中..."
  FUNC_INFO=$(aws lambda get-function --function-name "$DEV_FUNC" --region "$REGION" 2>/dev/null)
  
  if [ -z "$FUNC_INFO" ]; then
    echo -e "${RED}❌ 取得失敗${NC}"
    ((FAIL_COUNT++))
    continue
  fi
  
  # 設定抽出
  RUNTIME=$(echo "$FUNC_INFO" | jq -r '.Configuration.Runtime')
  HANDLER=$(echo "$FUNC_INFO" | jq -r '.Configuration.Handler')
  ROLE=$(echo "$FUNC_INFO" | jq -r '.Configuration.Role')
  TIMEOUT=$(echo "$FUNC_INFO" | jq -r '.Configuration.Timeout')
  MEMORY=$(echo "$FUNC_INFO" | jq -r '.Configuration.MemorySize')
  CODE_URL=$(echo "$FUNC_INFO" | jq -r '.Code.Location')
  
  # 環境変数取得（NODE_ENV=productionを追加）
  ENV_VARS=$(echo "$FUNC_INFO" | jq -r '.Configuration.Environment.Variables // {}')
  ENV_VARS=$(echo "$ENV_VARS" | jq '. + {NODE_ENV: "production"}')
  ENV_STRING="Variables=$ENV_VARS"
  
  # コードダウンロード
  echo "📦 コードをダウンロード中..."
  ZIP_FILE="$TEMP_DIR/${DEV_FUNC}.zip"
  curl -s -o "$ZIP_FILE" "$CODE_URL"
  
  # ランタイムをnodejs20.xに固定（nodejs24.xはまだ未サポートの可能性）
  if [[ "$RUNTIME" == "nodejs24.x" ]]; then
    RUNTIME="nodejs20.x"
  fi
  
  # 関数作成
  echo "🚀 本番用関数を作成中..."
  if aws lambda create-function \
    --function-name "$PROD_FUNC" \
    --runtime "$RUNTIME" \
    --handler "$HANDLER" \
    --role "$ROLE" \
    --timeout "$TIMEOUT" \
    --memory-size "$MEMORY" \
    --zip-file "fileb://$ZIP_FILE" \
    --region "$REGION" \
    --environment "$ENV_STRING" 2>/dev/null; then
    echo -e "${GREEN}✅ 作成成功${NC}"
    ((SUCCESS_COUNT++))
  else
    echo -e "${RED}❌ 作成失敗${NC}"
    ((FAIL_COUNT++))
  fi
  
  # 少し待機（API制限対策）
  sleep 1
done

# クリーンアップ
rm -rf "$TEMP_DIR"

echo ""
echo "=============================================="
echo "完了！"
echo "=============================================="
echo -e "${GREEN}成功: $SUCCESS_COUNT${NC}"
echo -e "${YELLOW}スキップ: $SKIP_COUNT${NC}"
echo -e "${RED}失敗: $FAIL_COUNT${NC}"
