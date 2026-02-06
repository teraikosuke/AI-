#!/bin/bash
# =============================================================================
# 本番用API Gateway統合・ルート作成スクリプト
# =============================================================================

REGION="ap-northeast-1"
PROD_API_ID="st70aifr22"
ACCOUNT_ID="195275648846"

echo "=============================================="
echo "本番用API Gateway統合・ルート作成"
echo "=============================================="

# Lambdaと対応するルートのリスト
LAMBDAS=(
  "ats-api-prod-auth-login:POST /auth/login"
  "ats-api-prod-auth-me:GET /auth/me"
  "ats-api-prod-candidates-list:GET /candidates"
  "ats-api-prod-candidates-detail:GET /candidates/{id}"
  "ats-api-prod-candidates-detail:PUT /candidates/{id}"
  "ats-api-prod-mypage:GET /mypage"
  "ats-api-prod-members:GET /members"
  "ats-api-prod-members:POST /members"
  "ats-api-prod-members:PUT /members"
  "ats-api-prod-members:DELETE /members"
  "ats-api-prod-goal-settings:GET /goal/goal-settings"
  "ats-api-prod-goal-settings:PUT /goal/goal-settings"
  "ats-api-prod-goal-settings:GET /goal/goal-targets"
  "ats-api-prod-goal-settings:PUT /goal/goal-targets"
  "ats-api-prod-goal-settings:GET /goal/goal-daily-targets"
  "ats-api-prod-goal-settings:PUT /goal/goal-daily-targets"
  "ats-api-prod-kpi-yield:GET /kpi/yield"
  "ats-api-prod-kpi-yield:GET /kpi/yield/breakdown"
  "ats-api-prod-kpi-yield:GET /kpi/yield/trend"
  "ats-api-prod-kpi-yield-daily:GET /kpi/yield/daily"
  "ats-api-prod-kpi-yield-personal:GET /kpi/yield/personal"
  "ats-api-prod-kpi-clients:GET /kpi/clients"
  "ats-api-prod-kpi-clients:POST /kpi/clients"
  "ats-api-prod-kpi-clients:PUT /kpi/clients"
  "ats-api-prod-kpi-clients-edit:GET /clients"
  "ats-api-prod-kpi-clients-edit:PUT /clients"
  "ats-api-prod-clients-create:POST /clients"
  "ats-api-prod-kpi-ads:GET /kpi/ads"
  "ats-api-prod-kpi-ads-detail:GET /ads/detail"
  "ats-api-prod-kpi-ads-detail:PUT /ads/detail"
  "ats-api-prod-kpi-teleapo:GET /kpi/teleapo"
  "ats-api-prod-kpi-targets:GET /kpi-targets"
  "ats-api-prod-kpi-targets:PUT /kpi-targets"
  "ats-api-prod-teleapo-logs:GET /teleapo/logs"
  "ats-api-prod-teleapo-log-create:PUT /teleapo/logs"
  "ats-api-prod-teleapo-log-create:DELETE /teleapo/logs"
  "ats-api-prod-teleapo-candidate-contact:GET /teleapo/candidate-contact"
  "ats-api-prod-ms-targets:GET /ms-targets"
  "ats-api-prod-ms-targets:PUT /ms-targets"
  "ats-api-prod-settings-screening-rules:GET /settings-screening-rules"
  "ats-api-prod-settings-screening-rules:PUT /settings-screening-rules"
)

# 既に作成済みの統合IDを保存するための一時ファイル
INTEGRATION_CACHE="/tmp/integration_cache.txt"
> "$INTEGRATION_CACHE"

for ENTRY in "${LAMBDAS[@]}"; do
  LAMBDA_NAME="${ENTRY%%:*}"
  ROUTE_KEY="${ENTRY#*:}"
  LAMBDA_ARN="arn:aws:lambda:$REGION:$ACCOUNT_ID:function:$LAMBDA_NAME"
  
  echo "処理中: $LAMBDA_NAME → $ROUTE_KEY"
  
  # 既存の統合IDを確認
  INTEGRATION_ID=$(grep "^$LAMBDA_NAME:" "$INTEGRATION_CACHE" | cut -d: -f2)
  
  if [ -z "$INTEGRATION_ID" ]; then
    # 統合を作成
    INTEGRATION_RESULT=$(aws apigatewayv2 create-integration \
      --api-id "$PROD_API_ID" \
      --integration-type AWS_PROXY \
      --integration-uri "$LAMBDA_ARN" \
      --payload-format-version "2.0" \
      --region "$REGION" \
      --output json 2>/dev/null)
    
    if [ $? -eq 0 ]; then
      INTEGRATION_ID=$(echo "$INTEGRATION_RESULT" | jq -r '.IntegrationId')
      echo "$LAMBDA_NAME:$INTEGRATION_ID" >> "$INTEGRATION_CACHE"
      
      # Lambda実行権限を追加
      aws lambda add-permission \
        --function-name "$LAMBDA_NAME" \
        --statement-id "apigateway-$PROD_API_ID-$(date +%s%N)" \
        --action lambda:InvokeFunction \
        --principal apigateway.amazonaws.com \
        --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT_ID:$PROD_API_ID/*" \
        --region "$REGION" > /dev/null 2>&1 || true
      
      echo "  ✅ 統合作成: $INTEGRATION_ID"
    else
      echo "  ❌ 統合作成失敗"
      continue
    fi
  fi
  
  # ルートを作成
  aws apigatewayv2 create-route \
    --api-id "$PROD_API_ID" \
    --route-key "$ROUTE_KEY" \
    --target "integrations/$INTEGRATION_ID" \
    --region "$REGION" > /dev/null 2>&1
  
  if [ $? -eq 0 ]; then
    echo "  ✅ ルート作成: $ROUTE_KEY"
  else
    echo "  ⚠️  ルート既存またはエラー: $ROUTE_KEY"
  fi
  
  # OPTIONSルートも作成（CORS用）
  OPTIONS_ROUTE_KEY="OPTIONS ${ROUTE_KEY#* }"
  aws apigatewayv2 create-route \
    --api-id "$PROD_API_ID" \
    --route-key "$OPTIONS_ROUTE_KEY" \
    --target "integrations/$INTEGRATION_ID" \
    --region "$REGION" > /dev/null 2>&1 || true
  
  sleep 0.5
done

# ステージを作成
echo ""
echo "📦 ステージを作成中..."
aws apigatewayv2 create-stage \
  --api-id "$PROD_API_ID" \
  --stage-name "prod" \
  --auto-deploy \
  --region "$REGION" > /dev/null 2>&1 || echo "ステージ既存"

echo ""
echo "=============================================="
echo "🎉 完了！"
echo "=============================================="
echo ""
echo "本番用APIエンドポイント:"
echo "https://st70aifr22.execute-api.ap-northeast-1.amazonaws.com/prod"
