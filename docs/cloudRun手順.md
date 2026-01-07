プロジェクト初期化
npm init -y
npm i express @line/bot-sdk
npm pkg set scripts.start="node server.js"

Dockerfile、.dockerignore作成
※内容はファイルを参照

プロジェクト設定
gcloud config set project celm-linebot-pj-dev
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com

シークレット設定
echo -n 'YOUR_LINE_CHANNEL_SECRET'       | gcloud secrets create LINE_CHANNEL_SECRET --data-file=-
echo -n 'YOUR_LINE_CHANNEL_ACCESS_TOKEN' | gcloud secrets create LINE_CHANNEL_ACCESS_TOKEN --data-file=-

デプロイ
gcloud run deploy line-webhook --source . --region asia-northeast1 --allow-unauthenticated --set-secrets "LINE_CHANNEL_SECRET=LINE_CHANNEL_SECRET:latest,LINE_CHANNEL_ACCESS_TOKEN=LINE_CHANNEL_ACCESS_TOKEN:latest"

失敗時ログ取得
$LAST=(gcloud builds list --region=asia-northeast1 --limit=1 --sort-by=~create_time --format="value(ID)"); gcloud builds log $LAST --region=asia-northeast1

権限付与
gcloud secrets add-iam-policy-binding LINE_CHANNEL_SECRET --member="serviceAccount:1090530020499-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding LINE_CHANNEL_ACCESS_TOKEN --member="serviceAccount:1090530020499-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"

デプロイ後ログ確認
gcloud run services logs read line-webhook --region asia-northeast1 --limit=100

チャネルアスセスキー更新
echo "アクセスキー" | gcloud secrets versions add LINE_CHANNEL_SECRET --data-file=-

cloud run更新
gcloud run services update line-webhook --region asia-northeast1 --update-secrets "LINE_CHANNEL_SECRET=LINE_CHANNEL_SECRET:latest"


認証周りで失敗し続けていたので下記コマンドで更新
Set-Content -NoNewline -Path tmp_token.txt -Value "Oi2LJATWBTNnc47AIs/F14jB42THPpEvKWURqghOe5mAsziYb6gWlM05fpJgRjrN1jOwE9nb+7VpQ7nrY8oNg2E0SVOLsYmMjJ5U4shpWVGiU+zBqIIH8KS5t6ceRk21XSb5cGiku9bzxGldRkxN/gdB04t89/1O/w1cDnyilFU="; gcloud secrets versions add LINE_CHANNEL_ACCESS_TOKEN --data-file=tmp_token.txt; Remove-Item tmp_token.txt; gcloud run services update line-webhook --region asia-northeast1 --update-secrets "LINE_CHANNEL_ACCESS_TOKEN=LINE_CHANNEL_ACCESS_TOKEN:latest"

Set-Content -NoNewline -Path tmp_secret.txt -Value "3c49df60b99e1c47da22263efa4bd96f"; gcloud secrets versions add LINE_CHANNEL_SECRET --data-file=tmp_secret.txt; Remove-Item tmp_secret.txt; gcloud run services update line-webhook --region asia-northeast1 --update-secrets "LINE_CHANNEL_SECRET=LINE_CHANNEL_SECRET:latest"; gcloud run services update-traffic line-webhook --region asia-northeast1 --to-latest
