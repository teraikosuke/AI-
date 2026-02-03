
path = r'c:\Users\hirot\OneDrive\ドキュメント\GitHub\AI-\pages\candidates\candidates.js'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'completeTaskId' in line:
        print(f"Line {i+1}: {line.strip()}")
