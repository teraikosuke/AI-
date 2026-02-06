#!/bin/bash
# =============================================================================
# 本番用Lambda関数にVPC設定を適用するスクリプト
# =============================================================================

REGION="ap-northeast-1"
SUBNETS="subnet-09878c21843bc5191,subnet-0b46fa2e756e957ea,subnet-073499f625497f368"
SECURITY_GROUP="sg-0fee6a530d4feb4d1"

# VPC設定がない本番用Lambda関数
FUNCTIONS=(
  "ats-api-prod-teleapo-candidate-contact"
  "ats-api-prod-auth-me"
  "ats-api-prod-goal-settings"
  "ats-api-prod-candidates-detail"
  "ats-api-prod-kpi-clients"
  "ats-api-prod-clients-create"
  "ats-api-prod-kpi-yield-personal"
  "ats-api-prod-kpi-yield"
  "ats-api-prod-kpi-targets"
  "ats-api-prod-kpi-teleapo"
  "ats-api-prod-teleapo-logs"
  "ats-api-prod-kpi-yield-daily"
  "ats-api-prod-members"
  "ats-api-prod-mypage"
  "ats-api-prod-auth-login"
  "ats-api-prod-kpi-clients-edit"
  "ats-api-prod-kpi-ads-detail"
  "ats-api-prod-ms-targets"
  "ats-api-prod-settings-screening-rules"
  "ats-api-prod-kpi-ads"
  "ats-api-prod-teleapo-log-create"
)

echo "=============================================="
echo "本番用Lambda VPC設定スクリプト"
echo "=============================================="

for FUNC in "${FUNCTIONS[@]}"; do
  echo "処理中: $FUNC"
  
  # 開発版の関数名を取得
  DEV_FUNC="${FUNC/prod/dev}"
  
  # 開発版のロールを取得
  DEV_ROLE=$(aws lambda get-function-configuration \
    --function-name "$DEV_FUNC" \
    --region "$REGION" \
    --query 'Role' \
    --output text 2>/dev/null)
  
  if [ -n "$DEV_ROLE" ] && [ "$DEV_ROLE" != "None" ]; then
    # ロールを更新
    aws lambda update-function-configuration \
      --function-name "$FUNC" \
      --role "$DEV_ROLE" \
      --region "$REGION" > /dev/null 2>&1
    
    sleep 2
    
    # VPC設定を追加
    aws lambda update-function-configuration \
      --function-name "$FUNC" \
      --vpc-config "SubnetIds=$SUBNETS,SecurityGroupIds=$SECURITY_GROUP" \
      --region "$REGION" > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
      echo "  ✅ VPC設定完了"
    else
      echo "  ❌ VPC設定失敗"
    fi
  else
    echo "  ⚠️  開発版が見つからない: $DEV_FUNC"
  fi
  
  sleep 1
done

echo ""
echo "=============================================="
echo "完了！"
echo "=============================================="
