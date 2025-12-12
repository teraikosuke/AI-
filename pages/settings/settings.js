let form;
let statusElement;
let testButton;
let updatedAtElement;

export function mount() {
  form = document.getElementById("kintoneSettingsForm");
  statusElement = document.getElementById("kintoneSettingsStatus");
  testButton = document.getElementById("kintoneTestButton");
  updatedAtElement = document.getElementById("kintoneSettingsUpdatedAt");

  if (form) {
    form.addEventListener("submit", handleSave);
  }
  if (testButton) {
    testButton.addEventListener("click", handleTestConnection);
  }
  loadSettings();
}

export function unmount() {
  if (form) {
    form.removeEventListener("submit", handleSave);
  }
  if (testButton) {
    testButton.removeEventListener("click", handleTestConnection);
  }
}

async function loadSettings() {
  try {
    const response = await fetch("/api/settings/kintone");
    if (!response.ok) {
      throw new Error("設定の取得に失敗しました");
    }
    const data = await response.json();
    if (!data || !data.exists) {
      showStatus("まだ設定が登録されていません。", "info");
      form?.reset();
      updateUpdatedAt(null);
      return;
    }
    if (form) {
      form.kintoneSubdomain.value = data.kintoneSubdomain || "";
      form.kintoneAppId.value = data.kintoneAppId || "";
      form.kintoneApiToken.value = "";
    }
    updateUpdatedAt(data.updatedAt);
    showStatus("保存済みの設定を読み込みました。", "success");
  } catch (error) {
    console.error(error);
    showStatus("設定の読み込みに失敗しました。", "error");
  }
}

async function handleSave(event) {
  event.preventDefault();
  if (!form) return;

  const body = {
    kintoneSubdomain: form.kintoneSubdomain.value.trim(),
    kintoneAppId: form.kintoneAppId.value.trim(),
    kintoneApiToken: form.kintoneApiToken.value.trim(),
  };

  if (!body.kintoneSubdomain || !body.kintoneAppId) {
    showStatus("サブドメインとアプリIDを入力してください。", "error");
    return;
  }

  try {
    const response = await fetch("/api/settings/kintone", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result?.error || "保存に失敗しました。");
    }
    form.kintoneApiToken.value = "";
    await loadSettings();
    showStatus("設定を保存しました。", "success");
  } catch (error) {
    console.error(error);
    showStatus(error.message || "保存に失敗しました。", "error");
  }
}

async function handleTestConnection() {
  if (!form) return;
  const payload = {
    kintoneSubdomain: form.kintoneSubdomain.value.trim(),
    kintoneAppId: form.kintoneAppId.value.trim(),
    kintoneApiToken:
      form.kintoneApiToken.value.trim() || undefined,
  };

  if (!payload.kintoneSubdomain || !payload.kintoneAppId) {
    showStatus("サブドメインとアプリIDを入力してください。", "error");
    return;
  }
  if (!payload.kintoneApiToken) {
    showStatus("接続テストには API トークンを入力してください。", "error");
    return;
  }

  try {
    showStatus("接続テストを実行中...", "info");
    const response = await fetch("/api/settings/kintone/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result?.error || "接続に失敗しました。");
    }
    showStatus(result.message || "接続テストに成功しました。", "success");
  } catch (error) {
    console.error(error);
    showStatus(error.message || "接続テストに失敗しました。", "error");
  }
}

function showStatus(message, type = "info") {
  if (!statusElement) return;
  statusElement.textContent = message;
  statusElement.classList.remove(
    "settings-status-success",
    "settings-status-error"
  );
  if (type === "success") {
    statusElement.classList.add("settings-status-success");
  } else if (type === "error") {
    statusElement.classList.add("settings-status-error");
  }
}

function updateUpdatedAt(value) {
  if (!updatedAtElement) return;
  updatedAtElement.textContent = value ? formatDateTimeJP(value) : "-";
}

function formatDateTimeJP(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}/${month}/${day} ${hours}:${minutes}`;
}
