#!/bin/bash
# =============================================================================
# 本番用API Gateway自動作成スクリプト
# =============================================================================
# 開発用API Gatewayの設定をコピーして本番用を作成します
# =============================================================================

set -e

REGION="ap-northeast-1"
DEV_API_ID="uqg1gdotaa"
PROD_API_NAME="ats-lite-api-prod"
ACCOUNT_ID="195275648846"

# 色付き出力
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "=============================================="
echo "本番用API Gateway自動作成スクリプト"
echo "=============================================="
echo ""

# Step 1: 本番用API Gatewayを作成
echo "🚀 Step 1: 本番用API Gatewayを作成中..."

PROD_API_RESULT=$(aws apigatewayv2 create-api \
  --name "$PROD_API_NAME" \
  --protocol-type HTTP \
  --cors-configuration "AllowOrigins=*,AllowMethods=GET,POST,PUT,DELETE,OPTIONS,AllowHeaders=content-type,authorization" \
  --region "$REGION" \
  --output json)

PROD_API_ID=$(echo "$PROD_API_RESULT" | jq -r '.ApiId')
PROD_API_ENDPOINT=$(echo "$PROD_API_RESULT" | jq -r '.ApiEndpoint')

echo -e "${GREEN}✅ API作成完了${NC}"
echo "   API ID: $PROD_API_ID"
echo "   エンドポイント: $PROD_API_ENDPOINT"
echo ""

# Step 2: 本番用Lambdaへの統合を作成
echo "🔗 Step 2: Lambda統合を作成中..."

# Lambda関数とパスのマッピング
declare -A LAMBDA_ROUTES
LAMBDA_ROUTES["ats-api-prod-auth-login"]="POST /auth/login"
LAMBDA_ROUTES["ats-api-prod-auth-me"]="GET /auth/me"
LAMBDA_ROUTES["ats-api-prod-candidates-list"]="GET /candidates"
LAMBDA_ROUTES["ats-api-prod-candidates-detail"]="GET /candidates/{id}"
LAMBDA_ROUTES["ats-api-prod-mypage"]="GET /mypage"
LAMBDA_ROUTES["ats-api-prod-members"]="GET /members"
LAMBDA_ROUTES["ats-api-prod-goal-settings"]="GET /goal/goal-settings"
LAMBDA_ROUTES["ats-api-prod-kpi-yield"]="GET /kpi/yield"
LAMBDA_ROUTES["ats-api-prod-kpi-yield-daily"]="GET /kpi/yield/daily"
LAMBDA_ROUTES["ats-api-prod-kpi-yield-personal"]="GET /kpi/yield/personal"
LAMBDA_ROUTES["ats-api-prod-kpi-clients"]="GET /kpi/clients"
LAMBDA_ROUTES["ats-api-prod-kpi-ads"]="GET /kpi/ads"
LAMBDA_ROUTES["ats-api-prod-kpi-ads-detail"]="GET /ads/detail"
LAMBDA_ROUTES["ats-api-prod-kpi-teleapo"]="GET /kpi/teleapo"
LAMBDA_ROUTES["ats-api-prod-kpi-targets"]="GET /kpi-targets"
LAMBDA_ROUTES["ats-api-prod-teleapo-logs"]="GET /teleapo/logs"
LAMBDA_ROUTES["ats-api-prod-teleapo-log-create"]="POST /teleapo/logs"
LAMBDA_ROUTES["ats-api-prod-teleapo-candidate-contact"]="GET /teleapo/candidate-contact"
LAMBDA_ROUTES["ats-api-prod-ms-targets"]="GET /ms-targets"
LAMBDA_ROUTES["ats-api-prod-clients-create"]="POST /clients"
LAMBDA_ROUTES["ats-api-prod-kpi-clients-edit"]="GET /clients"

# 各Lambdaに対して統合とルートを作成
for LAMBDA_NAME in "${!LAMBDA_ROUTES[@]}"; do
  ROUTE_KEY="${LAMBDA_ROUTES[$LAMBDA_NAME]}"
  LAMBDA_ARN="arn:aws:lambda:$REGION:$ACCOUNT_ID:function:$LAMBDA_NAME"
  
  echo "  処理中: $LAMBDA_NAME → $ROUTE_KEY"
  
  # 統合を作成
  INTEGRATION_RESULT=$(aws apigatewayv2 create-integration \
    --api-id "$PROD_API_ID" \
    --integration-type AWS_PROXY \
    --integration-uri "$LAMBDA_ARN" \
    --payload-format-version "2.0" \
    --region "$REGION" \
    --output json 2>/dev/null) || continue
  
  INTEGRATION_ID=$(echo "$INTEGRATION_RESULT" | jq -r '.IntegrationId')
  
  # ルートを作成
  aws apigatewayv2 create-route \
    --api-id "$PROD_API_ID" \
    --route-key "$ROUTE_KEY" \
    --target "integrations/$INTEGRATION_ID" \
    --region "$REGION" > /dev/null 2>&1 || true
  
  # OPTIONSルートも作成（CORS用）
  OPTIONS_ROUTE_KEY="OPTIONS ${ROUTE_KEY#* }"
  aws apigatewayv2 create-route \
    --api-id "$PROD_API_ID" \
    --route-key "$OPTIONS_ROUTE_KEY" \
    --target "integrations/$INTEGRATION_ID" \
    --region "$REGION" > /dev/null 2>&1 || true
  
  # Lambda実行権限を追加
  aws lambda add-permission \
    --function-name "$LAMBDA_NAME" \
    --statement-id "apigateway-$PROD_API_ID-$(date +%s)" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT_ID:$PROD_API_ID/*" \
    --region "$REGION" > /dev/null 2>&1 || true
done

echo -e "${GREEN}✅ Lambda統合とルート作成完了${NC}"
echo ""

# Step 3: ステージを作成してデプロイ
echo "📦 Step 3: ステージを作成してデプロイ中..."

aws apigatewayv2 create-stage \
  --api-id "$PROD_API_ID" \
  --stage-name "prod" \
  --auto-deploy \
  --region "$REGION" > /dev/null

echo -e "${GREEN}✅ ステージ作成完了${NC}"
echo ""

# 完了メッセージ
echo "=============================================="
echo -e "${GREEN}🎉 本番用API Gateway作成完了！${NC}"
echo "=============================================="
echo ""
echo "API ID: $PROD_API_ID"
echo "エンドポイント: $PROD_API_ENDPOINT/prod"
echo ""
echo "次のステップ:"
echo "1. フロントエンドのAPIベースURLを更新"
echo "2. 動作確認テスト"
