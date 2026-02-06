#!/bin/bash
# =============================================================================
# APIエンドポイント切り替えスクリプト
# =============================================================================
# 使用方法:
#   本番に切り替え: ./scripts/switch-api.sh prod
#   開発に切り替え: ./scripts/switch-api.sh dev
# =============================================================================

DEV_API="https://uqg1gdotaa.execute-api.ap-northeast-1.amazonaws.com/dev"
PROD_API="https://st70aifr22.execute-api.ap-northeast-1.amazonaws.com/prod"

if [ "$1" == "prod" ]; then
  echo "🔄 本番APIに切り替え中..."
  FROM="$DEV_API"
  TO="$PROD_API"
elif [ "$1" == "dev" ]; then
  echo "🔄 開発APIに切り替え中..."
  FROM="$PROD_API"
  TO="$DEV_API"
else
  echo "使用方法: $0 [prod|dev]"
  exit 1
fi

# pagesディレクトリ内のJSファイルを置換
find ./pages -name "*.js" -type f | while read file; do
  if grep -q "$FROM" "$file"; then
    sed -i '' "s|$FROM|$TO|g" "$file"
    echo "  ✅ $file"
  fi
done

# scriptsディレクトリ内のJSファイルを置換
find ./scripts -name "*.js" -type f | while read file; do
  if grep -q "$FROM" "$file"; then
    sed -i '' "s|$FROM|$TO|g" "$file"
    echo "  ✅ $file"
  fi
done

echo ""
echo "✅ 切り替え完了: $TO"
