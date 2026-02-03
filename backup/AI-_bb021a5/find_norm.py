
path = r'c:\Users\hirot\OneDrive\ドキュメント\GitHub\AI-\pages\candidates\candidates.js'
try:
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    for i, line in enumerate(lines):
        if 'function normalizeCandidate' in line:
            print(f"Found normalizeCandidate at line {i+1}: {line.strip()}")

except Exception as e:
    print(f"Error: {e}")
