#!/bin/bash

BASE_URL="http://localhost:8080/api/clients"
CONTENT_TYPE="Content-Type: application/json"

echo "Seeding clients..."

# 1. Tech Frontier
curl -X POST "$BASE_URL" -H "$CONTENT_TYPE" -d '{
  "name": "株式会社テックフロンティア",
  "industry": "IT/Web",
  "location": "東京都渋谷区",
  "jobCategories": "フロントエンドエンジニア",
  "plannedHiresCount": 3,
  "feeAmount": 3500000,
  "salaryRange": [500, 800],
  "mustQualifications": ["React", "TypeScript", "Next.js"],
  "niceQualifications": ["AWS", "UI/UXデザイン"],
  "personalityTraits": ["主体性", "協調性"],
  "requiredExperience": ["Web開発経験3年以上"],
  "contactName": "佐藤 健一",
  "contactEmail": "sato@techfrontier.example.com",
  "warrantyPeriod": "90日",
  "feeDetails": "35%",
  "contractNote": "月末締め翌月末払い",
  "selectionNote": "技術志向の強い方を希望。ポートフォリオ必須。"
}'
echo ""

# 2. Global Next
curl -X POST "$BASE_URL" -H "$CONTENT_TYPE" -d '{
  "name": "グローバルネクスト株式会社",
  "industry": "コンサルティング",
  "location": "東京都千代田区",
  "jobCategories": "戦略コンサルタント",
  "plannedHiresCount": 5,
  "feeAmount": 5000000,
  "salaryRange": [800, 1500],
  "mustQualifications": "コンサルティング経験3年以上, ビジネス英語",
  "niceQualifications": "MBA",
  "personalityTraits": "論理的思考力, プレゼンテーション能力",
  "requiredExperience": "大手ファームでの経験尚可",
  "contactName": "田中 美咲",
  "contactEmail": "tanaka@globalnext.example.com",
  "warrantyPeriod": "180日",
  "feeDetails": "40%",
  "selectionNote": "若手ハイキャリア層をターゲット。"
}'
echo ""

# 3. Medical Care Support
curl -X POST "$BASE_URL" -H "$CONTENT_TYPE" -d '{
  "name": "メディカルケアサポート法人",
  "industry": "医療・福祉",
  "location": "大阪府大阪市",
  "jobCategories": "看護師",
  "plannedHiresCount": 10,
  "feeAmount": 1200000,
  "salaryRange": [400, 600],
  "mustQualifications": "正看護師免許",
  "niceQualifications": "訪問看護経験",
  "personalityTraits": "明るい, コミュニケーション能力",
  "requiredExperience": "臨床経験3年以上",
  "contactName": "鈴木 一郎",
  "warrantyPeriod": "30日",
  "feeDetails": "固定20% or 100万円",
  "selectionNote": "急募案件。面接1回で決定。"
}'
echo ""

# 4. Creative Arts
curl -X POST "$BASE_URL" -H "$CONTENT_TYPE" -d '{
  "name": "株式会社クリエイティブアーツ",
  "industry": "広告・マスコミ",
  "location": "東京都港区",
  "jobCategories": "UI/UXデザイナー",
  "plannedHiresCount": 2,
  "feeAmount": 2000000,
  "salaryRange": [450, 750],
  "mustQualifications": "Figma, Adobe XD",
  "niceQualifications": "HTML/CSSコーディング",
  "personalityTraits": "デザインへの情熱, トレンド敏感",
  "requiredExperience": "アプリデザイン経験",
  "contactName": "高橋 優子",
  "contactEmail": "takahashi@creative.example.com",
  "warrantyPeriod": "60日",
  "feeDetails": "30%",
  "selectionNote": "ポートフォリオ重視。"
}'
echo ""

# 5. Future Logistics
curl -X POST "$BASE_URL" -H "$CONTENT_TYPE" -d '{
  "name": "フューチャー物流株式会社",
  "industry": "物流・運送",
  "location": "埼玉県さいたま市",
  "jobCategories": "物流センター長候補",
  "plannedHiresCount": 1,
  "feeAmount": 1500000,
  "salaryRange": [500, 700],
  "mustQualifications": "物流管理経験, フォークリフト免許",
  "niceQualifications": "運行管理者資格",
  "personalityTraits": "リーダーシップ, 安全意識",
  "contactName": "伊藤 博",
  "warrantyPeriod": "90日",
  "feeDetails": "25%",
  "selectionNote": "マネジメント経験を重視します。"
}'
echo ""

# 6. Education Plus
curl -X POST "$BASE_URL" -H "$CONTENT_TYPE" -d '{
  "name": "エデュケーションプラス",
  "industry": "教育",
  "location": "神奈川県横浜市",
  "jobCategories": "予備校講師（英語）",
  "plannedHiresCount": 4,
  "feeAmount": 800000,
  "salaryRange": [350, 600],
  "mustQualifications": "TOEIC 900点以上, 教員免許(あれば尚可)",
  "niceQualifications": "留学経験",
  "personalityTraits": "生徒に寄り添える方",
  "contactName": "渡辺 誠",
  "warrantyPeriod": "30日",
  "feeDetails": "15%",
  "selectionNote": "模擬授業あり。"
}'
echo ""

# 7. Kensetsu Tech
curl -X POST "$BASE_URL" -H "$CONTENT_TYPE" -d '{
  "name": "建設技術研究所",
  "industry": "建設・不動産",
  "location": "福岡県福岡市",
  "jobCategories": "土木施工管理技士",
  "plannedHiresCount": 2,
  "feeAmount": 2500000,
  "salaryRange": [600, 900],
  "mustQualifications": "1級土木施工管理技士",
  "niceQualifications": "CADスキル",
  "personalityTraits": "責任感, 体力に自信がある方",
  "requiredExperience": "現場監督経験5年以上",
  "contactName": "中村 剛",
  "warrantyPeriod": "180日",
  "feeDetails": "35%",
  "selectionNote": "資格手当あり。"
}'
echo ""

# 8. Fintech Sol
curl -X POST "$BASE_URL" -H "$CONTENT_TYPE" -d '{
  "name": "フィンテックソリューションズ",
  "industry": "金融・フィンテック",
  "location": "東京都中央区",
  "jobCategories": "データサイエンティスト",
  "plannedHiresCount": 2,
  "feeAmount": 4000000,
  "salaryRange": [900, 1400],
  "mustQualifications": "Python, SQL, 機械学習の実務経験",
  "niceQualifications": "金融知識",
  "personalityTraits": "数理的思考, 探究心",
  "contactName": "小林 さくら",
  "contactEmail": "kobayashi@fintech.example.com",
  "warrantyPeriod": "90日",
  "feeDetails": "35%",
  "selectionNote": "Kaggleなどの実績があればプラス評価。"
}'
echo ""

# 9. Green Energy
curl -X POST "$BASE_URL" -H "$CONTENT_TYPE" -d '{
  "name": "株式会社グリーンエナジー",
  "industry": "エネルギー・インフラ",
  "location": "愛知県名古屋市",
  "jobCategories": "法人営業",
  "plannedHiresCount": 3,
  "feeAmount": 1000000,
  "salaryRange": [400, 650],
  "mustQualifications": "普通自動車免許",
  "niceQualifications": "太陽光発電システムの知識",
  "personalityTraits": "行動力, 提案力",
  "requiredExperience": "営業経験2年以上",
  "contactName": "加藤 浩",
  "warrantyPeriod": "60日",
  "feeDetails": "20%",
  "selectionNote": "未経験可だがポテンシャル重視。"
}'
echo ""

# 10. Resort Okinawa
curl -X POST "$BASE_URL" -H "$CONTENT_TYPE" -d '{
  "name": "ホテルリゾート沖縄",
  "industry": "サービス・旅行",
  "location": "沖縄県那覇市",
  "jobCategories": "ホテルスタッフ（フロント）",
  "plannedHiresCount": 5,
  "feeAmount": 600000,
  "salaryRange": [250, 400],
  "mustQualifications": "日常会話レベルの英語",
  "niceQualifications": "中国語・韓国語",
  "personalityTraits": "ホスピタリティ, 笑顔",
  "contactName": "金城 アリサ",
  "contactEmail": "kinjo@resort.example.com",
  "warrantyPeriod": "30日",
  "feeDetails": "15%",
  "contractNote": "寮完備",
  "selectionNote": "人柄重視。"
}'
echo ""

echo "Done."
