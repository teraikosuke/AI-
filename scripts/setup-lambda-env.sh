#!/bin/bash
# =============================================================================
# Lambda環境変数セットアップスクリプト
# =============================================================================
#
# 使用方法:
#   chmod +x scripts/setup-lambda-env.sh
#   ./scripts/setup-lambda-env.sh [環境名]
#
# 例:
#   ./scripts/setup-lambda-env.sh dev      # 開発環境
#   ./scripts/setup-lambda-env.sh staging  # ステージング環境
#   ./scripts/setup-lambda-env.sh prod     # 本番環境
#
# 前提条件:
#   - AWS CLIがインストール済み
#   - 適切なAWS認証情報が設定済み
#   - jqがインストール済み
#
# =============================================================================

set -e

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 引数チェック
ENV=${1:-dev}
REGION=${AWS_REGION:-ap-northeast-1}

echo -e "${GREEN}=== Lambda環境変数セットアップ ===${NC}"
echo "環境: $ENV"
echo "リージョン: $REGION"
echo ""

# Lambda関数名のプレフィックス
PREFIX="ats-api-${ENV}"

# 対象Lambda関数一覧
LAMBDA_FUNCTIONS=(
  "${PREFIX}-auth-login"
  "${PREFIX}-auth-me"
  "${PREFIX}-candidates-detail"
  "${PREFIX}-candidates-list"
  "${PREFIX}-clients-create"
  "${PREFIX}-goal-settings"
  "${PREFIX}-kpi-ads"
  "${PREFIX}-kpi-ads-detail"
  "${PREFIX}-kpi-clients"
  "${PREFIX}-kpi-clients-edit"
  "${PREFIX}-kpi-targets"
  "${PREFIX}-kpi-teleapo"
  "${PREFIX}-kpi-yield"
  "${PREFIX}-kpi-yield-daily"
  "${PREFIX}-kpi-yield-personal"
  "${PREFIX}-members"
  "${PREFIX}-ms-targets"
  "${PREFIX}-mypage"
  "${PREFIX}-teleapo-candidate-contact"
  "${PREFIX}-teleapo-log-create"
  "${PREFIX}-teleapo-logs"
  "ats-api-settings-screening-rules"
)

# 環境変数定義
# ⚠️ 本番運用時はこれらの値を適切に設定してください
if [ "$ENV" == "prod" ]; then
  NODE_ENV="production"
  CORS_ORIGINS="https://app.agent-key.example.com"
else
  NODE_ENV="development"
  CORS_ORIGINS="http://localhost:8000,http://localhost:8001,http://localhost:8081"
fi

# 設定する環境変数
ENV_VARS=$(cat <<EOF
{
  "Variables": {
    "NODE_ENV": "${NODE_ENV}",
    "CORS_ALLOWED_ORIGINS": "${CORS_ORIGINS}"
  }
}
EOF
)

echo -e "${YELLOW}設定する環境変数:${NC}"
echo "$ENV_VARS" | jq .
echo ""

# 確認
read -p "続行しますか？ (y/N): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "キャンセルしました"
  exit 0
fi

# 各Lambda関数に環境変数を設定
echo ""
echo -e "${GREEN}Lambda関数の環境変数を更新中...${NC}"

for func in "${LAMBDA_FUNCTIONS[@]}"; do
  echo -n "  $func ... "
  
  # 関数が存在するか確認
  if aws lambda get-function --function-name "$func" --region "$REGION" > /dev/null 2>&1; then
    # 現在の環境変数を取得してマージ
    current_env=$(aws lambda get-function-configuration \
      --function-name "$func" \
      --region "$REGION" \
      --query 'Environment.Variables' \
      2>/dev/null || echo "{}")
    
    # 新しい環境変数をマージ
    merged_env=$(echo "$current_env" | jq --argjson new "$ENV_VARS" \
      '. + $new.Variables')
    
    # 環境変数を更新
    aws lambda update-function-configuration \
      --function-name "$func" \
      --region "$REGION" \
      --environment "{\"Variables\": $merged_env}" \
      > /dev/null 2>&1
    
    echo -e "${GREEN}✓${NC}"
  else
    echo -e "${RED}✗ (関数が見つかりません)${NC}"
  fi
done

echo ""
echo -e "${GREEN}=== セットアップ完了 ===${NC}"
echo ""
echo -e "${YELLOW}次のステップ:${NC}"
echo "1. AWS Secrets Manager または Parameter Store に以下を設定:"
echo "   - JWT_SECRET (32文字以上の強力なランダム文字列)"
echo "   - DB_PASSWORD (データベースパスワード)"
echo "   - KINTONE_API_TOKEN (Kintone APIトークン)"
echo ""
echo "2. 各Lambda関数で Secrets Manager から取得するように修正"
echo ""
echo "3. 本番環境では CORS_ALLOWED_ORIGINS を本番ドメインに変更"
