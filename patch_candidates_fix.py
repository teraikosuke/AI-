
path = r'c:\Users\hirot\OneDrive\ドキュメント\GitHub\AI-\pages\candidates\candidates.js'
try:
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    found = False
    for i, line in enumerate(lines):
        if 'if (!confirm("⚠️ 次回アクションが未設定です。' in line:
            # Check next line
            if i + 1 < len(lines):
                next_line = lines[i+1].strip()
                if next_line == 'return;':
                    print(f"Found return at line {i+2}, removing it.")
                    lines.pop(i+1)
                    found = True
                    break
    
    if found:
        with open(path, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        print("Fixed successfully.")
    else:
        print("Target not found or already fixed.")

except Exception as e:
    print(f"Error: {e}")
