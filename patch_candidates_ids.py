
import os

path = r'c:\Users\hirot\OneDrive\ドキュメント\GitHub\AI-\pages\candidates\candidates.js'

try:
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    patched = False
    for i, line in enumerate(lines):
        # Patch completeBtn logic
        if 'const taskId = Number(completeBtn.dataset.completeTaskId);' in line:
            print(f"Patching completeBtn at line {i+1}")
            lines[i] = line.replace('Number(', '').replace(')', '')
            patched = True
        
        # Patch deleteTaskBtn logic
        if 'const taskId = Number(deleteTaskBtn.dataset.deleteTaskId);' in line:
            print(f"Patching deleteTaskBtn at line {i+1}")
            lines[i] = line.replace('Number(', '').replace(')', '')
            patched = True

    if patched:
        with open(path, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        print("Patched successfully.")
    else:
        print("No lines matched for patching.")

except Exception as e:
    print(f"Error: {e}")
