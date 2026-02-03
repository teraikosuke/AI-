
path = r'c:\Users\hirot\OneDrive\ドキュメント\GitHub\AI-\pages\candidates\candidates.js'
try:
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    for i, line in enumerate(lines):
        if 'handleCompleteTask' in line:
            print(f"Found handleCompleteTask usage/def at line {i+1}: {line.strip()}")
        if 'handleDeleteTask' in line:
            print(f"Found handleDeleteTask usage/def at line {i+1}: {line.strip()}")

except Exception as e:
    print(f"Error: {e}")
