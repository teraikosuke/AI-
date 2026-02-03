import sys
try:
    with open(r'c:\Users\hirot\OneDrive\ドキュメント\GitHub\AI-\pages\candidates\candidates.js', 'r', encoding='utf-8') as f:
        lines = f.readlines()
        # Lines 2458-2461 (1-based) => indices 2457-2461
        target = ''.join(lines[2457:2461])
        print(repr(target))
except Exception as e:
    print(e)
