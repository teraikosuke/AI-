
import os

path = r'c:\Users\hirot\OneDrive\ドキュメント\GitHub\AI-\pages\candidates\candidates.js'

try:
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # 1. Add buttons to remainingTasks render
    mapped_found = False
    for i, line in enumerate(lines):
        if '${remainingTasks.map((task) => `' in line:
            # Look ahead for the closing div of the card
            # The card structure is:
            # <div class="bg-white..." ...>
            #   <div class="flex items-center...">...</div>
            #   <div class="text-sm ...">...</div>
            # </div> <--- We want to insert before this
            
            # We skip a few lines to find the closing div
            # The original code provided in snippet:
            # 3730: <div class...
            # ...
            # 3735: <div class="text-sm text-slate-700">${escapeHtml(task.actionNote || '-')}</div>
            # 3736: </div>
            
            # We will search for the line with task.actionNote and then append the buttons after it (before closing div)
            
            j = i
            while j < i + 20 and j < len(lines):
                if 'task.actionNote' in lines[j]:
                    # Insert the buttons after this line
                    # But we need to be careful with formatting as it is a template literal string
                    
                    # Original: <div class="text-sm text-slate-700">${escapeHtml(task.actionNote || '-')}</div>
                    # We want to add:
                    # <div class="mt-2 flex items-center justify-end gap-2 border-t border-slate-100 pt-2">
                    #   <button type="button" class="text-xs px-2 py-1 bg-white border border-green-200 text-green-700 hover:bg-green-50 rounded" data-complete-task-id="${task.id}">完了</button>
                    #   <button type="button" class="text-xs px-2 py-1 bg-white border border-red-200 text-red-700 hover:bg-red-50 rounded" data-delete-task-id="${task.id}">削除</button>
                    # </div>
                    
                    buttons_html = '            <div class="mt-2 flex items-center justify-end gap-2 border-t border-slate-100 pt-2">\\n              <button type="button" class="text-xs px-2 py-1 bg-white border border-green-200 text-green-700 hover:bg-green-50 rounded" data-complete-task-id="${task.id}">完了</button>\\n              <button type="button" class="text-xs px-2 py-1 bg-white border border-red-200 text-red-700 hover:bg-red-50 rounded" data-delete-task-id="${task.id}">削除</button>\\n            </div>\\n'
                    
                    lines.insert(j+1, buttons_html)
                    mapped_found = True
                    break
                j += 1
            if mapped_found:
                break
    
    if not mapped_found:
        print("Could not find remainingTasks loop.")

    # 2. Add handler logic to handleDetailContentClick
    handler_found = False
    for i, line in enumerate(lines):
        if 'const completeBtn = event.target.closest("[data-complete-task-id]");' in line:
            # Search for the end of this if block
            # It ends with 'return;' and then '}'
            # We will insert our new block after this block
            
            j = i
            while j < i + 10 and j < len(lines):
                if 'return;' in lines[j] and '}' in lines[j+1]:
                    # Insert after j+1
                    insert_pos = j + 2
                    new_handler = """
  const deleteTaskBtn = event.target.closest("[data-delete-task-id]");
  if (deleteTaskBtn) {
    const taskId = Number(deleteTaskBtn.dataset.deleteTaskId);
    handleDeleteTask(taskId);
    return;
  }
"""
                    lines.insert(insert_pos, new_handler)
                    handler_found = True
                    break
                j += 1
            if handler_found:
                break
            
    if not handler_found:
        print("Could not find handleCompleteTask block.")

    # 3. Add handleDeleteTask function
    # We will add it after handleCompleteTask
    func_found = False
    for i, line in enumerate(lines):
        if 'async function handleCompleteTask(taskId) {' in line:
            # Find the closing brace of this function
            # This is risky doing basic brace counting, but let's assume valid indentation helps or finding the next function
            # The function ends around line 2795 in previous view
            
            # We'll stick it before 'function handleDetailFieldChange'
            j = i
            while j < len(lines):
                if 'function handleDetailFieldChange' in lines[j]:
                    insert_pos = j
                    new_func = """
async function handleDeleteTask(taskId) {
  const candidate = getSelectedCandidate();
  if (!candidate || !taskId) return;

  if (!confirm('この予定を削除しますか？')) {
    return;
  }

  try {
    const payload = {
      id: candidate.id,
      detailMode: true,
      deleteTaskId: taskId,
    };

    const response = await fetch(candidatesApi(candidateDetailPath(candidate.id)), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status} ${response.statusText} - ${text.slice(0, 200)}`);
    }

    const updated = normalizeCandidate(await response.json());
    applyCandidateUpdate(updated, { preserveDetailState: true });

  } catch (error) {
    console.error('タスク削除に失敗しました:', error);
    alert(`タスク削除に失敗しました。\\n${error.message}`);
  }
}

"""
                    lines.insert(insert_pos, new_func)
                    func_found = True
                    break
                j += 1
            if func_found:
                break

    if not func_found:
        print("Could not find handleDetailFieldChange to insert before.")

    if mapped_found and handler_found and func_found:
        with open(path, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        print("Patched successfully.")
    else:
        print("Some patches failed.")

except Exception as e:
    print(f"Error: {e}")
