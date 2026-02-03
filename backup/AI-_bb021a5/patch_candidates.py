
import os

path = r'c:\Users\hirot\OneDrive\ドキュメント\GitHub\AI-\pages\candidates\candidates.js'
try:
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    found = False
    for i, line in enumerate(lines):
        if 'alert("⚠️ 次回アクションが未設定のため画面を閉じられません' in line:
            print(f"Found at line {i+1}")
            # Construct new line. Preserve indentation (8 spaces).
            indent = '        '
            # Note: We want literal \n in the JS string, which corresponds to \\n in Python string.
            new_line = indent + 'if (!confirm("⚠️ 次回アクションが未設定です。\\n\\n・選考継続中：新規アクションを追加して保存してください。\\n・選考終了：「選考完了」ボタンを押してください。\\n\\nこのまま画面を閉じますか？")) return;\n'
            lines[i] = new_line
            found = True
            break

    if found:
        with open(path, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        print("Patched successfully.")
    else:
        print("Target line not found.")
except Exception as e:
    print(f"Error: {e}")
