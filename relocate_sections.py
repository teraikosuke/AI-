import os

path = r'c:\Users\hirot\OneDrive\ドキュメント\GitHub\AI-\pages\candidates\candidates.js'

try:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
except Exception as e:
    print(f"Error reading file: {e}")
    exit(1)

# Target Parts
# 1. Update tabContentMap
old_map = """    profile: renderDetailCard("基本情報", renderApplicantInfoSection(candidate), "profile"),
    hearing: renderDetailCard("面談メモ", renderHearingSection(candidate), "hearing"),
    cs: renderDetailCard("架電結果", renderCsSection(candidate), "cs"),"""

new_map = """    profile: renderDetailCard("基本情報", renderApplicantInfoSection(candidate), "profile") +
             renderDetailCard("担当者", renderAssigneeSection(candidate), "assignees"),
    hearing: renderDetailCard("面談メモ", renderHearingSection(candidate), "hearing"),
    cs: renderDetailCard("架電結果", renderCsSection(candidate), "cs") +
        renderDetailCard("テレアポログ一覧", renderTeleapoLogsSection(candidate), "teleapoLogs", { editable: false }),"""

content = content.replace(old_map, new_map)

# 2. Remove otherSections definition
old_other = """  const otherSections = `
    ${renderDetailCard("担当者", renderAssigneeSection(candidate), "assignees")}
    ${renderDetailCard("テレアポログ一覧", renderTeleapoLogsSection(candidate), "teleapoLogs", { editable: false })}
  `;"""

content = content.replace(old_other, "")

# 3. Update container.innerHTML
old_html_block = """    <div class="candidate-detail-wrapper">
      ${backButtonHtml}
      ${summaryCardHtml}
      <div class="sticky-nav-wrapper">
        ${tabsHtml}
      </div>
      ${tabPanelsHtml}
      <div class="detail-sections-scroll">
        ${otherSections}
      </div>
    </div>"""

new_html_block = """    <div class="candidate-detail-wrapper">
      ${backButtonHtml}
      ${summaryCardHtml}
      <div class="sticky-nav-wrapper">
        ${tabsHtml}
      </div>
      ${tabPanelsHtml}
    </div>"""

content = content.replace(old_html_block, new_html_block)

try:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("File saved")
except Exception as e:
    print(f"Error writing file: {e}")
