import os

path = r'c:\Users\hirot\OneDrive\ドキュメント\GitHub\AI-\pages\candidates\candidates.js'
keywords = ["renderCandidateDetail", "基本情報", "架電結果", "担当者", "テレアポログ"]

try:
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        for i, line in enumerate(lines):
            for k in keywords:
                if k in line:
                    print(f"{i+1}: {k} found in: {line.strip()[:100]}...")
except Exception as e:
    print(f"Error: {e}")
