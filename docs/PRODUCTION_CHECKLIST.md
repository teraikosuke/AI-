# 本番運用チェックリスト

**作成日**: 2026-02-06

---

## 現状サマリー

| 項目 | 現状 | 評価 |
|------|------|------|
| Lambda関数（本番） | 22個作成済み | ✅ |
| API Gateway（本番） | 41ルート設定済み | ✅ |
| VPC設定 | 全Lambda設定済み | ✅ |
| RDSバックアップ | 1日間保持 | ⚠️ 要改善 |
| RDS Multi-AZ | 無効 | ⚠️ 要検討 |
| RDS暗号化 | 有効 | ✅ |
| CloudWatchアラーム | 未設定 | ❌ 要設定 |
| Secrets Manager | 一部使用中 | ⚠️ 要拡張 |
| API Gatewayメトリクス | 無効 | ⚠️ 要有効化 |

---

## 🚨 本番前に必須（Critical）

### 1. フロントエンドホスティング設定
- [ ] Cloudflare Pages または AWS Amplify でフロントエンドをデプロイ
- [ ] `scripts/config.js` に本番APIエンドポイントを設定
- [ ] カスタムドメインを設定（オプション）

### 2. 認証情報のセキュリティ強化
- [ ] 今日使用したAWSアクセスキーをローテーション（削除→再作成）
- [ ] DBパスワードの変更を検討
- [ ] JWT_SECRETを本番用に変更

### 3. CORS設定
- [ ] 本番用Lambda関数の `CORS_ALLOWED_ORIGINS` を本番ドメインに設定
  ```bash
  # 例: フロントエンドが https://app.example.com の場合
  aws lambda update-function-configuration \
    --function-name ats-api-prod-XXX \
    --environment 'Variables={...,CORS_ALLOWED_ORIGINS=https://app.example.com}'
  ```

---

## ⚠️ 本番前に推奨（High Priority）

### 4. RDSバックアップ強化
```bash
# バックアップ保持期間を7日に変更
aws rds modify-db-instance \
  --db-instance-identifier ats-lite-db \
  --backup-retention-period 7 \
  --apply-immediately \
  --region ap-northeast-1
```
**現状**: 1日 → **推奨**: 7〜14日

### 5. CloudWatch アラーム設定
以下のアラームを設定することを推奨：

| アラーム | 条件 | 通知先 |
|----------|------|--------|
| Lambda エラー率 | エラー > 5% | Slack/Email |
| Lambda 実行時間 | 平均 > 2秒 | Slack/Email |
| RDS CPU使用率 | > 80% | Slack/Email |
| RDS 接続数 | > 100 | Slack/Email |
| API Gateway 5xx | > 10/分 | Slack/Email |

```bash
# Lambda エラーアラームの例
aws cloudwatch put-metric-alarm \
  --alarm-name "ats-api-prod-errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --region ap-northeast-1
```

### 6. API Gateway メトリクス有効化
```bash
aws apigatewayv2 update-stage \
  --api-id st70aifr22 \
  --stage-name prod \
  --default-route-settings 'DetailedMetricsEnabled=true' \
  --region ap-northeast-1
```

---

## 📋 運用時に推奨（Medium Priority）

### 7. 本番用DBの分離（後で対応可）
現在は開発と本番が同じDBを使用中。本番トラフィック増加時に分離を検討。

```
開発DB: ats-lite-db-dev
本番DB: ats-lite-db-prod
```

### 8. RDS Multi-AZ 有効化（高可用性）
```bash
aws rds modify-db-instance \
  --db-instance-identifier ats-lite-db \
  --multi-az \
  --apply-immediately \
  --region ap-northeast-1
```
**注意**: 費用が約2倍になる

### 9. Lambda Provisioned Concurrency（コールドスタート対策）
頻繁に使用されるLambdaにProvisioned Concurrencyを設定。
```bash
aws lambda put-provisioned-concurrency-config \
  --function-name ats-api-prod-auth-login \
  --qualifier '$LATEST' \
  --provisioned-concurrent-executions 5 \
  --region ap-northeast-1
```
**注意**: 追加費用が発生

### 10. Secrets Managerへの移行
Lambda環境変数に直接設定されている認証情報をSecrets Managerに移行。
```
現在: Lambda環境変数にDB_PASSWORD, JWT_SECRET
推奨: Secrets Managerから取得するようにコード変更
```

---

## 🔄 日常運用タスク

### 毎日
- [ ] CloudWatchダッシュボードでエラー確認
- [ ] API Gateway アクセスログ確認

### 毎週
- [ ] Lambda関数のエラー率確認
- [ ] RDS パフォーマンス確認
- [ ] 依存パッケージの脆弱性確認

### 毎月
- [ ] AWSコスト確認
- [ ] 不要なログの削除（費用削減）
- [ ] セキュリティパッチ適用確認

---

## 💰 コスト最適化

### 現在の推定コスト（月額）
| サービス | 推定費用 |
|----------|----------|
| Lambda | 〜$5（低トラフィック時） |
| API Gateway | 〜$5 |
| RDS (db.t3.micro) | 〜$15 |
| CloudWatch Logs | 〜$5 |
| **合計** | **〜$30/月** |

### コスト削減のヒント
1. **CloudWatch Logs保持期間を設定**（14〜30日）
2. **未使用のLambda関数を削除**
3. **RDS を Reserved Instance に変更**（年間契約で30-50%割引）

---

## 📞 障害対応フロー

```
1. アラート受信
    ↓
2. CloudWatch Logsでエラー確認
    ↓
3. 影響範囲の特定
    ↓
4. ロールバック or ホットフィックス
    ↓
5. 事後報告（ポストモーテム）
```

---

## 次のアクション

### 今すぐやること
1. [ ] フロントエンドをホスティングサービスにデプロイ
2. [ ] `scripts/config.js` を本番API用に更新
3. [ ] AWSアクセスキーをローテーション

### 今週中にやること
1. [ ] RDSバックアップ保持期間を7日に変更
2. [ ] CloudWatchアラームを1つ以上設定
3. [ ] API Gatewayメトリクスを有効化

### 本番リリース後にやること
1. [ ] エラー監視用のSlack通知設定
2. [ ] コスト監視（AWS Budgets）設定
3. [ ] 本番DB分離の検討
