#!/bin/bash
# =============================================================================
# 本番用Lambda関数の環境変数を修正するスクリプト
# =============================================================================

REGION="ap-northeast-1"

# 環境変数
DB_HOST="ats-lite-db.cdiqayuosm2o.ap-northeast-1.rds.amazonaws.com"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="app_admin"
DB_PASSWORD="QgjoFpxFGJjxNwicxLUb"
JWT_SECRET="nFPWi7lPuMhQ2rlNW6Y28yTV+G2EeM1+2AVAebKwj4A="

# 本番用Lambda関数リスト
FUNCTIONS=(
  "ats-api-prod-auth-login"
  "ats-api-prod-auth-me"
  "ats-api-prod-candidates-detail"
  "ats-api-prod-candidates-list"
  "ats-api-prod-clients-create"
  "ats-api-prod-goal-settings"
  "ats-api-prod-kpi-ads"
  "ats-api-prod-kpi-ads-detail"
  "ats-api-prod-kpi-clients"
  "ats-api-prod-kpi-clients-edit"
  "ats-api-prod-kpi-targets"
  "ats-api-prod-kpi-teleapo"
  "ats-api-prod-kpi-yield"
  "ats-api-prod-kpi-yield-daily"
  "ats-api-prod-kpi-yield-personal"
  "ats-api-prod-members"
  "ats-api-prod-ms-targets"
  "ats-api-prod-mypage"
  "ats-api-prod-settings-screening-rules"
  "ats-api-prod-teleapo-candidate-contact"
  "ats-api-prod-teleapo-log-create"
  "ats-api-prod-teleapo-logs"
)

echo "=============================================="
echo "本番用Lambda関数 環境変数修正スクリプト"
echo "=============================================="

for FUNC in "${FUNCTIONS[@]}"; do
  echo "処理中: $FUNC"
  
  # 現在の環境変数を確認
  CURRENT_DB=$(aws lambda get-function-configuration \
    --function-name "$FUNC" \
    --region "$REGION" \
    --query 'Environment.Variables.DB_HOST' \
    --output text 2>/dev/null)
  
  if [ "$CURRENT_DB" == "None" ] || [ -z "$CURRENT_DB" ] || [ "$CURRENT_DB" == "null" ]; then
    echo "  ⚠️  環境変数がありません。設定中..."
    
    aws lambda update-function-configuration \
      --function-name "$FUNC" \
      --environment "Variables={DB_HOST=$DB_HOST,DB_PORT=$DB_PORT,DB_NAME=$DB_NAME,DB_USER=$DB_USER,DB_PASSWORD=$DB_PASSWORD,JWT_SECRET=$JWT_SECRET,NODE_ENV=production}" \
      --region "$REGION" > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
      echo "  ✅ 環境変数を設定しました"
    else
      echo "  ❌ 設定失敗"
    fi
  else
    echo "  ✅ 環境変数OK"
  fi
  
  sleep 0.5
done

echo ""
echo "=============================================="
echo "完了！"
echo "=============================================="
