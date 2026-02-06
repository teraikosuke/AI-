# Git履歴からシークレットを削除する手順

> [!CAUTION]
> この作業はGit履歴を書き換えるため、リモートリポジトリへの強制プッシュが必要です。
> チームメンバーがいる場合は事前に調整してください。

## 問題の概要

以下のファイルがGit履歴にコミットされており、シークレットが含まれています：

- `.env` - Kintone APIトークン、データベース接続情報

## 対応手順

### Step 1: BFG Repo-Cleanerのインストール

```bash
# Homebrewを使用する場合
brew install bfg
```

### Step 2: リポジトリのバックアップ

```bash
# 作業前にバックアップを作成
cd /Users/riho/Documents/GitHub
cp -r AI- AI-backup-$(date +%Y%m%d)
```

### Step 3: シークレットの削除

```bash
cd /Users/riho/Documents/GitHub/AI-

# .envファイルを履歴から削除
bfg --delete-files .env

# 履歴をクリーンアップ
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### Step 4: 強制プッシュ

```bash
# ⚠️ チームメンバーへの事前通知が必要
git push origin --force --all
git push origin --force --tags
```

### Step 5: シークレットの無効化と再発行

1. **Kintone APIトークン**
   - Kintone管理画面で現在のトークンを無効化
   - 新しいトークンを発行
   - AWS Secrets Managerに新しいトークンを保存

2. **JWT Secret**
   - 新しい強力なシークレットを生成
   ```bash
   openssl rand -base64 32
   ```
   - AWS Secrets Managerに保存

3. **データベースパスワード**
   - RDSのパスワードを変更（必要に応じて）
   - AWS Secrets Managerに保存

### Step 6: チームメンバーへの対応依頼

履歴が書き換わるため、チームメンバーには以下の対応を依頼：

```bash
# ローカルリポジトリを再クローン
cd ~/work
rm -rf AI-
git clone https://github.com/Sunwood-ai-labs/AI-.git
```

または：

```bash
# 強制的にリモートと同期
git fetch origin
git reset --hard origin/main
```

---

## 代替手段: git filter-branch（BFGがない場合）

```bash
# .envを履歴から削除
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env' \
  --prune-empty --tag-name-filter cat -- --all

# クリーンアップ
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 強制プッシュ
git push origin --force --all
```

---

## 確認

削除後、以下のコマンドで履歴に残っていないことを確認：

```bash
# .envが履歴に存在しないことを確認
git log --oneline --all -- .env
# 出力が空であればOK
```
