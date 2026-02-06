// teleapo.js (clean)
import { goalSettingsService } from '../../scripts/services/goalSettings.js';

console.log('teleapo.js loaded');

// グローバル関数: タブ切り替え（onclick属性から呼び出し）
window.switchTeleapoTab = function (targetPanel, clickedTab) {
  const performancePanel = document.getElementById('teleapoPerformancePanel');
  const managementPanel = document.getElementById('teleapoManagementPanel');
  const tabs = document.querySelectorAll('.teleapo-tab');

  // タブのアクティブ状態を更新
  tabs.forEach(t => t.classList.remove('active'));
  clickedTab.classList.add('active');

  // パネルの表示を切り替え
  if (targetPanel === 'performance') {
    performancePanel.style.display = 'block';
    performancePanel.classList.add('active');
    managementPanel.style.display = 'none';
    managementPanel.classList.remove('active');
  } else if (targetPanel === 'management') {
    performancePanel.style.display = 'none';
    performancePanel.classList.remove('active');
    managementPanel.style.display = 'block';
    managementPanel.classList.add('active');
  }
};

function bindTeleapoTabs() {
  const tabs = document.querySelectorAll('.teleapo-tab');
  if (!tabs.length) return;
  tabs.forEach(tab => {
    if (tab.dataset.bound) return;
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab || 'performance';
      window.switchTeleapoTab?.(target, tab);
    });
    tab.dataset.bound = 'true';
  });
}

function bindTeleapoCollapsibles() {
  const headers = document.querySelectorAll('.teleapo-collapsible-header');
  if (!headers.length) return;
  headers.forEach(header => {
    if (header.id === 'teleapoCsTaskToggle' || header.id === 'teleapoMissingInfoToggle') {
      return;
    }
    if (header.dataset.bound) return;
    const parent = header.closest('.teleapo-collapsible');
    const content = parent?.querySelector('.teleapo-collapsible-content');
    if (content) {
      const isOpen = parent?.classList.contains('open');
      content.style.display = isOpen ? 'block' : 'none';
    }
    header.addEventListener('click', () => {
      window.toggleTeleapoCollapsible?.(header);
    });
    const btn = header.querySelector('.teleapo-collapsible-btn');
    if (btn && !btn.dataset.bound) {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        window.toggleTeleapoCollapsible?.(header);
      });
      btn.dataset.bound = 'true';
    }
    header.dataset.bound = 'true';
  });
}

// グローバル関数: 折りたたみセクションのトグル
window.toggleTeleapoCollapsible = function (header) {
  const parent = header.closest('.teleapo-collapsible');
  if (!parent) return;
  const content = parent.querySelector('.teleapo-collapsible-content');
  const willOpen = !parent.classList.contains('open');
  parent.classList.toggle('open', willOpen);
  if (content) {
    content.style.display = willOpen ? 'block' : 'none';
  }
  const btn = parent.querySelector('.teleapo-collapsible-btn');
  if (btn) {
    if (willOpen) {
      btn.textContent = '閉じる';
    } else {
      btn.textContent = '一覧を開く';
    }
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    bindTeleapoTabs();
    bindTeleapoCollapsibles();
  });
} else {
  bindTeleapoTabs();
  bindTeleapoCollapsibles();
}


const ROUTE_TEL = 'tel';
const ROUTE_OTHER = 'other';
const TELEAPO_RATE_MODE_CONTACT = 'contact';
const TELEAPO_RATE_MODE_STEP = 'step';
const TELEAPO_API_URL = `${window.API_BASE_URL || 'https://uqg1gdotaa.execute-api.ap-northeast-1.amazonaws.com/dev'}/teleapo/logs`;
const TELEAPO_EMPLOYEES = ['佐藤', '鈴木', '高橋', '田中'];
const TELEAPO_HEATMAP_DAYS = ['月', '火', '水', '木', '金'];
const TELEAPO_HEATMAP_SLOTS = ['09-11', '11-13', '13-15', '15-17', '17-19'];
const SETTINGS_API_BASE = window.API_BASE_URL || 'https://uqg1gdotaa.execute-api.ap-northeast-1.amazonaws.com/dev';
const SCREENING_RULES_ENDPOINT = `${SETTINGS_API_BASE}/settings-screening-rules`;
// Candidate detail URL (hash router + query)
const CANDIDATE_ID_PARAM = 'candidateId';
const TARGET_CANDIDATE_STORAGE_KEY = 'target_candidate_id';
// ...既存の定数の下に追加...

// Candidates API URL (no trailing slash)
const CANDIDATES_API_URL = `${window.API_BASE_URL || 'https://uqg1gdotaa.execute-api.ap-northeast-1.amazonaws.com/dev'}/candidates`;

let candidateNameMap = new Map(); // Name -> ID
let candidateIdMap = new Map(); // ID -> Name
let candidateAttendanceMap = new Map(); // ID -> Boolean
let candidateAttendanceByName = new Map(); // normalized name -> Boolean
let candidateNameList = [];
let teleapoCsTaskCandidates = [];
let teleapoCandidateMaster = [];
let teleapoCandidateAbort = null;
let candidatePhoneCache = new Map();
let candidatePhoneToId = new Map();
let candidateEmailToId = new Map();
let candidateDetailCache = new Map();
let candidateDetailRequests = new Map();
let screeningRules = null;
let screeningRulesLoaded = false;
let screeningRulesLoading = false;
let validApplicationDetailCache = new Map();
let validApplicationQueue = [];
let validApplicationQueueSet = new Set();
let validApplicationQueueActive = false;
let missingInfoQueue = [];
let missingInfoQueueSet = new Set();
let missingInfoQueueActive = false;
const MISSING_INFO_FETCH_BATCH = 20;
const MISSING_INFO_FETCH_DELAY_MS = 200;
const MISSING_INFO_RENDER_LIMIT = 200;
let missingInfoExpanded = false;
let contactTimeQueue = [];
let contactTimeQueueSet = new Set();
let contactTimeQueueActive = false;
const CONTACT_TIME_FETCH_BATCH = 10;
const CONTACT_TIME_FETCH_DELAY_MS = 200;
const VALID_APPLICATION_FETCH_BATCH = 10;
const VALID_APPLICATION_FETCH_DELAY_MS = 200;
let candidateDetailRefreshTimer = null;
let validApplicationRefreshTimer = null;
let teleapoSummaryByCandidateId = new Map();
let teleapoSummaryByName = new Map();
let csTaskExpanded = false;
let logExpanded = true;
let attendanceQueue = [];
let attendanceQueueSet = new Set();
let attendanceQueueActive = false;
let attendanceRefreshTimer = null;
let teleapoRateMode = TELEAPO_RATE_MODE_CONTACT;
let teleapoQuickEditState = { candidateId: null, detail: null, editMode: false, saving: false };
let teleapoRateTargets = {}; // 目標値キャッシュ
const ATTENDANCE_FETCH_BATCH = 10;
const ATTENDANCE_FETCH_DELAY_MS = 200;
const CONTACT_TIME_PLACEHOLDERS = new Set([
  "-",
  "ー",
  "未設定",
  "未入力",
  "未登録",
  "未指定"
]);

function normalizeContactPreferredTime(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (CONTACT_TIME_PLACEHOLDERS.has(text)) return "";
  return text;
}

function normalizeAttendanceValue(value) {
  if (value === true || value === false) return value;
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "済", "確認済"].includes(normalized)) return true;
    if (["false", "0", "no", "未", "未確認"].includes(normalized)) return false;
  }
  return Boolean(value);
}

function registerCandidateAttendance(candidateId, candidateName, attendanceRaw) {
  const attendance = normalizeAttendanceValue(attendanceRaw);
  if (attendance === null) return;
  const idNum = Number(candidateId);
  if (Number.isFinite(idNum) && idNum > 0) {
    candidateAttendanceMap.set(idNum, attendance);
  }
  const nameKey = normalizeNameKey(candidateName);
  if (nameKey) {
    candidateAttendanceByName.set(nameKey, attendance);
  }
}

function scheduleAttendanceRefresh() {
  if (attendanceRefreshTimer) return;
  attendanceRefreshTimer = window.setTimeout(() => {
    attendanceRefreshTimer = null;
    if (teleapoLogData.length) {
      applyFilters();
    }
  }, 200);
}

function scheduleCandidateDetailRefresh() {
  if (candidateDetailRefreshTimer) return;
  candidateDetailRefreshTimer = window.setTimeout(() => {
    candidateDetailRefreshTimer = null;
    renderLogTable();
    renderCsTaskTable(teleapoCsTaskCandidates);
  }, 200);
}

function scheduleValidApplicationRefresh() {
  if (validApplicationRefreshTimer) return;
  validApplicationRefreshTimer = window.setTimeout(() => {
    validApplicationRefreshTimer = null;
    rebuildCsTaskCandidates();
  }, 200);
}

function enqueueAttendanceFetch(candidateId) {
  const idNum = Number(candidateId);
  if (!Number.isFinite(idNum) || idNum <= 0) return;
  if (candidateAttendanceMap.has(idNum)) return;
  if (candidateDetailRequests.has(idNum)) return;
  const cached = candidateDetailCache.get(idNum);
  if (cached && typeof cached.attendanceConfirmed === "boolean") return;
  if (attendanceQueueSet.has(idNum)) return;
  attendanceQueueSet.add(idNum);
  attendanceQueue.push(idNum);
  if (!attendanceQueueActive) processAttendanceQueue();
}

function processAttendanceQueue() {
  if (!attendanceQueue.length) {
    attendanceQueueActive = false;
    return;
  }
  attendanceQueueActive = true;
  const batch = attendanceQueue.splice(0, ATTENDANCE_FETCH_BATCH);
  batch.forEach((idNum) => attendanceQueueSet.delete(idNum));
  Promise.all(batch.map((idNum) => fetchCandidateDetailInfo(idNum)))
    .catch(() => { })
    .finally(() => {
      setTimeout(processAttendanceQueue, ATTENDANCE_FETCH_DELAY_MS);
    });
}

function scheduleAttendanceFetchFromLogs(logs) {
  if (!Array.isArray(logs) || !logs.length) return;
  logs.forEach((log) => {
    const code = normalizeResultCode(log.resultCode || log.result);
    if (code !== "set") return;
    let idNum = Number(log.candidateId);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      const resolved = findCandidateIdFromTarget(log.target);
      idNum = Number(resolved);
    }
    if (!Number.isFinite(idNum) || idNum <= 0) return;
    enqueueAttendanceFetch(idNum);
  });
}

function enqueueContactTimeFetch(candidateId) {
  const idNum = Number(candidateId);
  if (!Number.isFinite(idNum) || idNum <= 0) return;
  if (contactTimeQueueSet.has(idNum)) return;
  if (candidateDetailRequests.has(idNum)) return;
  const cached = candidateDetailCache.get(idNum);
  if (cached) {
    const cachedTime = normalizeContactPreferredTime(
      cached.contactPreferredTime ?? cached.contact_preferred_time ?? cached.contactTime ?? cached.contact_time
    );
    if (cachedTime) return;
    if (cached.contactPreferredTimeFetched) return;
  }
  contactTimeQueueSet.add(idNum);
  contactTimeQueue.push(idNum);
  if (!contactTimeQueueActive) processContactTimeQueue();
}

function processContactTimeQueue() {
  if (!contactTimeQueue.length) {
    contactTimeQueueActive = false;
    return;
  }
  contactTimeQueueActive = true;
  const batch = contactTimeQueue.splice(0, CONTACT_TIME_FETCH_BATCH);
  batch.forEach((idNum) => contactTimeQueueSet.delete(idNum));
  Promise.all(batch.map((idNum) => fetchCandidateDetailInfo(idNum)))
    .finally(() => {
      scheduleCandidateDetailRefresh();
      setTimeout(processContactTimeQueue, CONTACT_TIME_FETCH_DELAY_MS);
    });
}

function prefetchContactTimeForLogs(logs) {
  if (!Array.isArray(logs) || !logs.length) return;
  logs.forEach((log) => {
    const resolvedId = resolveCandidateIdFromLog(log);
    if (resolvedId) enqueueContactTimeFetch(resolvedId);
  });
}

function enqueueValidApplicationFetch(candidateId) {
  if (!screeningRules) return;
  const idNum = Number(candidateId);
  if (!Number.isFinite(idNum) || idNum <= 0) return;
  if (validApplicationDetailCache.has(idNum)) return;
  if (validApplicationQueueSet.has(idNum)) return;
  if (candidateDetailRequests.has(idNum)) return;
  validApplicationQueueSet.add(idNum);
  validApplicationQueue.push(idNum);
  if (!validApplicationQueueActive) processValidApplicationQueue();
}

function processValidApplicationQueue() {
  if (!validApplicationQueue.length) {
    validApplicationQueueActive = false;
    return;
  }
  validApplicationQueueActive = true;
  const batch = validApplicationQueue.splice(0, VALID_APPLICATION_FETCH_BATCH);
  batch.forEach((idNum) => validApplicationQueueSet.delete(idNum));
  Promise.all(batch.map((idNum) => fetchCandidateDetailInfo(idNum)))
    .finally(() => {
      setTimeout(processValidApplicationQueue, VALID_APPLICATION_FETCH_DELAY_MS);
    });
}

function prefetchValidApplicationForCandidates(list) {
  if (!screeningRules || !Array.isArray(list) || !list.length) return;
  list.forEach((candidate) => {
    const candidateId =
      candidate?.candidateId ??
      candidate?.candidate_id ??
      candidate?.id ??
      candidate?.candidateID ??
      null;
    enqueueValidApplicationFetch(candidateId);
  });
}

function prefetchContactTimeForTasks(list) {
  if (!Array.isArray(list) || !list.length) return;
  list.forEach((row) => {
    if (row?.candidateId) enqueueContactTimeFetch(row.candidateId);
  });
}

function resolveAttendanceConfirmed(log) {
  const idNum = Number(log?.candidateId ?? log?.candidate_id);
  if (Number.isFinite(idNum) && idNum > 0 && candidateAttendanceMap.has(idNum)) {
    return candidateAttendanceMap.get(idNum) === true;
  }
  if (Number.isFinite(idNum) && idNum > 0) {
    const cached = candidateDetailCache.get(idNum);
    if (cached && typeof cached.attendanceConfirmed === "boolean") {
      return cached.attendanceConfirmed;
    }
  }
  const nameKey = normalizeNameKey(log?.target || "");
  if (nameKey && candidateAttendanceByName.has(nameKey)) {
    return candidateAttendanceByName.get(nameKey) === true;
  }
  return false;
}

function resolveCandidateInterviewDate(log) {
  let idNum = Number(log?.candidateId ?? log?.candidate_id);
  if (!Number.isFinite(idNum) || idNum <= 0) {
    const resolved = findCandidateIdFromTarget(log?.target || "");
    idNum = Number(resolved);
  }
  if (Number.isFinite(idNum) && idNum > 0) {
    const cached = candidateDetailCache.get(idNum);
    if (cached?.firstInterviewDate) return cached.firstInterviewDate;
  }
  return null;
}

function buildCandidateDetailUrl(candidateId) {
  const id = String(candidateId ?? '').trim();
  return `#/candidate-detail?id=${encodeURIComponent(id)}`;
}

function navigateToCandidateDetailPage(candidateId, candidateName) {
  const resolvedId = candidateId || findCandidateIdFromTarget(candidateName);
  if (!resolvedId) {
    console.warn('candidate not found:', candidateName);
    return;
  }
  const resolvedIdText = String(resolvedId);
  window.location.hash = `/candidate-detail?id=${encodeURIComponent(resolvedIdText)}`;
}

window.navigateToCandidateDetail = function (candidateId, candidateName) {
  openCandidateQuickView(candidateId, candidateName);
};


function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeNameKey(name) {
  return String(name ?? '')
    .replace(/[\s\u3000]/g, '')
    .toLowerCase();
}

function normalizePhoneKey(value) {
  return String(value ?? '').replace(/[^\d]/g, '');
}

function normalizeEmailKey(value) {
  return String(value ?? '').trim().toLowerCase();
}

function registerCandidateContactMaps(candidateId, candidate = {}) {
  const idNum = Number(candidateId);
  if (!Number.isFinite(idNum) || idNum <= 0) return;
  const phone =
    candidate.phone ??
    candidate.phone_number ??
    candidate.phoneNumber ??
    candidate.tel ??
    candidate.mobile ??
    candidate.candidate_phone ??
    "";
  const email =
    candidate.email ??
    candidate.candidate_email ??
    candidate.mail ??
    candidate.email_address ??
    "";
  const phoneKey = normalizePhoneKey(phone);
  if (phoneKey) candidatePhoneToId.set(phoneKey, idNum);
  const emailKey = normalizeEmailKey(email);
  if (emailKey) candidateEmailToId.set(emailKey, idNum);
}

function findCandidateIdByName(name) {
  if (!name) return undefined;
  const direct = candidateNameMap.get(name);
  if (direct) return direct;
  const targetKey = normalizeNameKey(name);
  if (!targetKey) return undefined;
  for (const [candidateName, id] of candidateNameMap.entries()) {
    if (normalizeNameKey(candidateName) === targetKey) return id;
  }
  return undefined;
}

function findCandidateIdFromTarget(target) {
  if (!target) return undefined;
  const direct = findCandidateIdByName(target);
  if (direct) return direct;

  const normalizedTarget = normalizeNameKey(target);
  if (!normalizedTarget) return undefined;

  let bestMatch = null;
  let bestId;
  const list = candidateNameList.length ? candidateNameList : Array.from(candidateNameMap.keys());
  for (const name of list) {
    const normalizedName = normalizeNameKey(name);
    if (!normalizedName) continue;
    if (normalizedTarget.includes(normalizedName)) {
      if (!bestMatch || normalizedName.length > bestMatch.length) {
        bestMatch = normalizedName;
        bestId = candidateNameMap.get(name);
      }
    }
  }
  return bestId;
}

function resolveCandidateIdFromLog(log) {
  const rawId = log?.candidateId ?? log?.candidate_id;
  const idNum = Number(rawId);
  if (Number.isFinite(idNum) && idNum > 0) return idNum;
  const nameResolved = findCandidateIdFromTarget(log?.target || "");
  const nameIdNum = Number(nameResolved);
  if (Number.isFinite(nameIdNum) && nameIdNum > 0) return nameIdNum;
  const phoneKey = normalizePhoneKey(log?.tel || "");
  if (phoneKey && candidatePhoneToId.has(phoneKey)) return candidatePhoneToId.get(phoneKey);
  const emailKey = normalizeEmailKey(log?.email || "");
  if (emailKey && candidateEmailToId.has(emailKey)) return candidateEmailToId.get(emailKey);
  return null;
}

function hydrateLogCandidateIds(logs) {
  if (!Array.isArray(logs) || !logs.length) return false;
  let updated = false;
  logs.forEach((log) => {
    const current = Number(log?.candidateId);
    if (Number.isFinite(current) && current > 0) return;
    const resolved = resolveCandidateIdFromLog(log);
    if (resolved) {
      log.candidateId = resolved;
      updated = true;
    }
  });
  return updated;
}

function normalizePhaseList(raw) {
  const list = Array.isArray(raw)
    ? raw
    : String(raw || "")
      .split(/[,/、|]/)
      .map((value) => value.trim())
      .filter((value) => value);
  return Array.from(new Set(list));
}

function resolveCandidatePhaseDisplay(candidate) {
  const list = normalizePhaseList(candidate?.phases ?? candidate?.phaseList ?? candidate?.phase ?? "");
  if (list.length) return list.join(" / ");

  const hasConnected = candidate?.csSummary?.hasConnected ?? candidate?.phoneConnected ?? false;
  const hasSms = candidate?.csSummary?.hasSms ?? candidate?.smsSent ?? candidate?.smsConfirmed ?? false;
  const callCount = candidate?.csSummary?.callCount ?? candidate?.csSummary?.max_call_no ?? 0;
  if (hasConnected) return "通電";
  if (hasSms) return "SMS送信";
  if (Number(callCount || 0) > 0) return "架電中";
  return "未接触";
}

function parseRuleNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseListValue(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (value === null || value === undefined) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeScreeningRulesPayload(payload) {
  const source = payload?.rules || payload?.item || payload?.data || payload || {};
  const minAge = parseRuleNumber(source.minAge ?? source.min_age);
  const maxAge = parseRuleNumber(source.maxAge ?? source.max_age);
  const nationalitiesRaw =
    source.targetNationalities ??
    source.target_nationalities ??
    source.allowedNationalities ??
    source.allowed_nationalities ??
    source.nationalities ??
    "";
  const allowedJlptRaw =
    source.allowedJlptLevels ??
    source.allowed_jlpt_levels ??
    source.allowed_japanese_levels ??
    [];
  return {
    minAge,
    maxAge,
    targetNationalitiesList: parseListValue(nationalitiesRaw),
    allowedJlptLevels: parseListValue(allowedJlptRaw),
  };
}

function normalizeNationality(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const normalized = text.toLowerCase();
  if (normalized === "japan" || normalized === "jpn" || normalized === "jp" || normalized === "japanese") {
    return "日本";
  }
  if (text === "日本国" || text === "日本国籍" || text === "日本人" || text === "日本国民") return "日本";
  return text;
}

function isJapaneseNationality(value) {
  return normalizeNationality(value) === "日本";
}

function hasValidApplicationInputs(candidate, rules) {
  if (!candidate || !rules) return false;
  const age = resolveCandidateAgeValue(candidate);
  if (age === null) return false;
  const nationality = normalizeNationality(candidate?.nationality ?? "");
  if (!nationality) return false;
  if (isJapaneseNationality(nationality)) return true;
  const jlpt = String(candidate?.japaneseLevel ?? candidate?.japanese_level ?? "").trim();
  return Boolean(jlpt);
}

function resolveCandidateAgeValue(candidate) {
  const birthday =
    candidate?.birthday ??
    candidate?.birth_date ??
    candidate?.birthDate ??
    candidate?.birthdate ??
    "";
  const computed = calculateAgeFromBirthday(birthday);
  if (computed !== null) return computed;
  const direct = candidate?.age ?? candidate?.age_years ?? candidate?.ageYears;
  if (direct !== null && direct !== undefined && direct !== "") {
    const parsed = Number(direct);
    if (Number.isFinite(parsed)) return parsed;
    const match = String(direct).match(/\d+/);
    if (match) {
      const fromText = Number(match[0]);
      if (Number.isFinite(fromText)) return fromText;
    }
  }
  return null;
}

function computeValidApplication(candidate, rules) {
  if (!candidate || !rules) return null;
  const age = resolveCandidateAgeValue(candidate);
  if (age === null) return false;
  if (rules.minAge !== null && rules.minAge !== undefined && rules.minAge > 0 && age < rules.minAge) return false;
  if (rules.maxAge !== null && rules.maxAge !== undefined && rules.maxAge < 100 && age > rules.maxAge) return false;

  const nationality = normalizeNationality(candidate?.nationality ?? "");
  const allowedNationalities = (rules.targetNationalitiesList || [])
    .map((value) => normalizeNationality(value))
    .filter((value) => value && !isJapaneseNationality(value));

  if (isJapaneseNationality(nationality)) return true;

  if (allowedNationalities.length > 0) {
    if (!nationality) return false;
    const matched = allowedNationalities.some((value) => value === nationality);
    if (!matched) return false;
  }

  const jlpt = String(candidate?.japaneseLevel ?? candidate?.japanese_level ?? "").trim();
  if (!jlpt) return false;
  const allowedJlptLevels = rules.allowedJlptLevels || [];
  if (!allowedJlptLevels.length) return false;
  return allowedJlptLevels.includes(jlpt);
}

function resolveCandidateIdValue(candidate) {
  const raw =
    candidate?.candidateId ??
    candidate?.candidate_id ??
    candidate?.id ??
    candidate?.candidateID ??
    null;
  const idNum = Number(raw);
  if (Number.isFinite(idNum) && idNum > 0) return idNum;
  return null;
}

function updateValidApplicationDetailCache(candidate, { force = false } = {}) {
  if (!screeningRules || !candidate) return null;
  if (!hasValidApplicationInputs(candidate, screeningRules)) return null;
  const idNum = resolveCandidateIdValue(candidate);
  if (!Number.isFinite(idNum)) return null;
  if (!force && validApplicationDetailCache.has(idNum)) {
    const cached = validApplicationDetailCache.get(idNum);
    candidate.validApplicationComputed = cached;
    return cached;
  }
  const computed = computeValidApplication(candidate, screeningRules);
  if (computed === true || computed === false) {
    const prev = validApplicationDetailCache.get(idNum);
    validApplicationDetailCache.set(idNum, computed);
    candidate.validApplicationComputed = computed;
    if (prev !== computed) {
      scheduleValidApplicationRefresh();
    }
    return computed;
  }
  return null;
}

function resolveValidApplicationFromDetail(candidate) {
  const idNum = resolveCandidateIdValue(candidate);
  if (!Number.isFinite(idNum)) return null;
  if (validApplicationDetailCache.has(idNum)) {
    return validApplicationDetailCache.get(idNum);
  }
  return null;
}

function isValidApplicationCandidate(candidate) {
  if (screeningRules && hasValidApplicationInputs(candidate, screeningRules)) {
    const computed = computeValidApplication(candidate, screeningRules);
    if (computed === true || computed === false) {
      updateValidApplicationDetailCache(candidate, { force: true });
      return computed;
    }
  }
  const detailValue = resolveValidApplicationFromDetail(candidate);
  if (detailValue === true || detailValue === false) return detailValue;
  const raw = candidate?.validApplication
    ?? candidate?.valid_application
    ?? candidate?.validApplicationComputed
    ?? candidate?.valid_application_computed
    ?? candidate?.valid
    ?? candidate?.isValidApplication
    ?? candidate?.isEffective
    ?? candidate?.is_effective
    ?? candidate?.is_effective_application
    ?? candidate?.active_flag;
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (["true", "1", "yes", "有効", "有効応募"].includes(normalized)) return true;
    if (["false", "0", "no", "無効", "無効応募"].includes(normalized)) return false;
  }
  return Boolean(raw);
}

function formatCandidateDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
}

function formatCandidateDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}

function formatShortMonthDay(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatCandidateValue(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text ? escapeHtml(text) : fallback;
}

function formatDateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getCandidateDetailApiUrl(candidateId) {
  const id = String(candidateId ?? "").trim();
  if (!id) return "";
  return `${CANDIDATES_API_URL}/${encodeURIComponent(id)}`;
}

function fetchCandidateDetailInfo(candidateId) {
  const idNum = Number(candidateId);
  if (!Number.isFinite(idNum) || idNum <= 0) return Promise.resolve(null);
  if (candidateDetailCache.has(idNum)) return Promise.resolve(candidateDetailCache.get(idNum));
  if (candidateDetailRequests.has(idNum)) return candidateDetailRequests.get(idNum);

  const url = getCandidateDetailApiUrl(idNum);
  if (!url) return Promise.resolve(null);

  const req = fetch(url, { headers: { Accept: "application/json" } })
    .then(res => {
      if (!res.ok) {
        return res.text().then(text => {
          throw new Error(`HTTP ${res.status}: ${text}`);
        });
      }
      return res.json();
    })
    .then(data => {
      const prev = candidateDetailCache.get(idNum);
      const prevContactTime = normalizeContactPreferredTime(
        prev?.contactPreferredTime ??
        prev?.contact_preferred_time ??
        prev?.contactTime ??
        prev?.contact_time
      );
      const phone =
        data?.phone ??
        data?.phone_number ??
        data?.phoneNumber ??
        data?.tel ??
        data?.mobile ??
        data?.candidate_phone ??
        "";
      const email =
        data?.email ??
        data?.candidate_email ??
        data?.mail ??
        data?.email_address ??
        "";
      const attendanceRaw =
        data?.attendanceConfirmed ??
        data?.first_interview_attended ??
        data?.attendance_confirmed ??
        null;
      const firstInterviewDate =
        data?.firstInterviewDate ??
        data?.first_interview_date ??
        data?.firstInterviewAt ??
        data?.first_interview_at ??
        null;
      const birthday =
        data?.birthday ??
        data?.birth_date ??
        data?.birthDate ??
        data?.birthdate ??
        "";
      const contactPreferredTime = normalizeContactPreferredTime(
        data?.contactPreferredTime ??
        data?.contact_preferred_time ??
        data?.contactTime ??
        data?.contact_time ??
        data?.preferredContactTime ??
        data?.preferred_contact_time
      );

      console.log(`[teleapo] Fetched detail for ${idNum}:`, {
        contactPreferredTime,
        rawData: data
      });

      const ageRaw = data?.age ?? data?.age_years ?? data?.ageYears ?? null;
      const ageValue = Number(ageRaw);
      const age = Number.isFinite(ageValue) && ageValue > 0 ? ageValue : null;

      const normalized = normalizeCandidateDetail({
        ...data,
        candidateId: idNum,
        phone,
        email,
        contactPreferredTime
      });

      // Maintain legacy/specific fields
      normalized.attendanceConfirmed = normalizeAttendanceValue(attendanceRaw);
      if (firstInterviewDate) {
        normalized.firstInterviewDate = firstInterviewDate;
      }
      normalized.contactPreferredTimeFetched = true;
      updateValidApplicationDetailCache(normalized, { force: true });

      candidateDetailCache.set(idNum, normalized);
      candidateDetailRequests.delete(idNum);

      // Refresh if we got a new contact preference
      const newContactTime = normalizeContactPreferredTime(contactPreferredTime);
      if (newContactTime && newContactTime !== prevContactTime) {
        scheduleCandidateDetailRefresh();
      }

      return normalized;
    })
    .catch(err => {
      console.warn(`[teleapo] Detail fetch error for ${idNum}:`, err);
      if (!candidateDetailCache.has(idNum)) {
        candidateDetailCache.set(idNum, {
          contactPreferredTimeFetched: true
        });
      }
      candidateDetailRequests.delete(idNum);
      return null;
    });

  candidateDetailRequests.set(idNum, req);
  return req;
}

function applyScreeningRulesToTeleapoCandidates() {
  validApplicationDetailCache.clear();
  validApplicationQueue = [];
  validApplicationQueueSet.clear();
  validApplicationQueueActive = false;
  if (!screeningRules || !teleapoCandidateMaster.length) return;
  prefetchValidApplicationForCandidates(teleapoCandidateMaster);
  rebuildCsTaskCandidates();
}

async function loadScreeningRulesForTeleapo({ force = false } = {}) {
  if (screeningRulesLoading) return;
  if (!force && screeningRulesLoaded) return;
  screeningRulesLoading = true;
  try {
    const response = await fetch(SCREENING_RULES_ENDPOINT);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    screeningRules = normalizeScreeningRulesPayload(data);
  } catch (error) {
    console.error("有効応募判定ルールの取得に失敗しました。", error);
    screeningRules = null;
  } finally {
    screeningRulesLoading = false;
    screeningRulesLoaded = Boolean(screeningRules);
    applyScreeningRulesToTeleapoCandidates();
  }
}

function fetchCandidatePhone(candidateId) {
  const idNum = Number(candidateId);
  if (!Number.isFinite(idNum) || idNum <= 0) return Promise.resolve(null);
  if (candidatePhoneCache.has(idNum)) return Promise.resolve(candidatePhoneCache.get(idNum));
  return fetchCandidateDetailInfo(idNum).then(detail => detail?.phone || null);
}

async function updateCandidateFirstInterview(candidateId, interviewAt) {
  const url = getCandidateDetailApiUrl(candidateId);
  if (!url) throw new Error("candidateId is required");
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ firstInterviewDate: interviewAt }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json().catch(() => ({}));
}

function normalizeCandidateDetail(raw) {
  if (!raw) return raw;
  const normalized = {
    ...raw,
    candidateId: raw.candidateId ?? raw.candidate_id ?? raw.id ?? null,
    candidateName: raw.candidateName ?? raw.candidate_name ?? raw.name ?? "",
    advisorName: raw.advisorName ?? raw.advisor_name ?? "",
    partnerName: raw.partnerName ?? raw.partner_name ?? "",
    registeredAt: raw.registeredAt ?? raw.createdAt ?? raw.created_at ?? raw.registered_at ?? null,
    validApplication:
      raw.validApplication ??
      raw.valid_application ??
      raw.validApplicationComputed ??
      raw.valid_application_computed ??
      raw.is_effective_application ??
      raw.active_flag ??
      raw.isEffective ??
      raw.is_effective ??
      raw.isEffectiveApplication ??
      null,
    phone: raw.phone ?? raw.phone_number ?? raw.tel ?? "",
    email: raw.email ?? raw.email_address ?? "",
    birthday: raw.birthday ?? raw.birth_date ?? raw.birthDate ?? raw.birthdate ?? "",
    age: raw.age ?? raw.age_years ?? raw.ageYears ?? null,
    nationality: raw.nationality ?? raw.nationality_text ?? raw.nationality_code ?? "",
    japaneseLevel: raw.japaneseLevel ?? raw.japanese_level ?? raw.jlpt_level ?? raw.jlptLevel ?? "",
    applyCompanyName: raw.applyCompanyName ?? raw.apply_company_name ?? raw.companyName ?? raw.company_name ?? "",
    applyJobName: raw.applyJobName ?? raw.apply_job_name ?? raw.jobName ?? raw.job_name ?? "",
    applyRouteText: raw.applyRouteText ?? raw.apply_route_text ?? raw.source ?? "",
    contactPreferredTime: normalizeContactPreferredTime(
      raw.contactPreferredTime ??
      raw.contact_preferred_time ??
      raw.contactTime ??
      raw.contact_time
    ),
    address: raw.address ?? "",
    selectionProgress: Array.isArray(raw.selectionProgress ?? raw.selection_progress)
      ? (raw.selectionProgress ?? raw.selection_progress)
      : [],
    teleapoLogs: Array.isArray(raw.teleapoLogs ?? raw.teleapo_logs)
      ? (raw.teleapoLogs ?? raw.teleapo_logs)
      : [],
    csSummary: raw.csSummary ?? raw.cs_summary ?? {},
    phases: raw.phases ?? raw.phaseList ?? raw.phase ?? ""
  };
  if (normalized.birthday) {
    const computedAge = calculateAgeFromBirthday(normalized.birthday);
    if (computedAge !== null) {
      normalized.age = computedAge;
      normalized.age_years = computedAge;
      normalized.ageYears = computedAge;
    }
  }
  return normalized;
}



function buildCandidatePhaseBadges(candidate) {
  const list = normalizePhaseList(candidate?.phases ?? candidate?.phaseList ?? candidate?.phase ?? "");
  const display = list.length ? list : [resolveCandidatePhaseDisplay(candidate)];
  return display.map(value => `
    <span class="teleapo-candidate-pill teleapo-candidate-pill--info">${escapeHtml(value || "-")}</span>
  `).join("");
}

function buildValidApplicationPill(validApplication) {
  if (validApplication === null || validApplication === undefined) {
    return '<span class="teleapo-candidate-pill teleapo-candidate-pill--muted">応募不明</span>';
  }
  return validApplication
    ? '<span class="teleapo-candidate-pill teleapo-candidate-pill--success">有効応募</span>'
    : '<span class="teleapo-candidate-pill teleapo-candidate-pill--muted">無効応募</span>';
}

function setCandidateQuickViewTitle(text) {
  const titleEl = document.getElementById("teleapoCandidateModalTitle");
  if (titleEl) titleEl.textContent = text || "候補者詳細";
}

function setCandidateQuickViewContent(html) {
  const container = document.getElementById("teleapoCandidateDetailContent");
  if (!container) return;
  container.innerHTML = html;
}

function setCandidateQuickEditStatus(message, variant = "info") {
  const el = document.getElementById("teleapoCandidateEditStatus");
  if (!el) return;
  el.textContent = message || "";
  el.classList.remove("text-slate-500", "text-rose-600", "text-emerald-600");
  if (variant === "error") el.classList.add("text-rose-600");
  else if (variant === "success") el.classList.add("text-emerald-600");
  else el.classList.add("text-slate-500");
}

function readQuickEditValue(id) {
  const el = document.getElementById(id);
  if (!el) return "";
  return String(el.value ?? "").trim();
}

function buildQuickEditPayload(candidateId) {
  const birthday = readQuickEditValue("teleapoQuickEditBirthday");
  const ageInput = readQuickEditValue("teleapoQuickEditAge");
  const parsedAge = ageInput ? Number(ageInput) : null;
  const age = Number.isFinite(parsedAge) && parsedAge > 0 ? Math.trunc(parsedAge) : null;
  return {
    id: candidateId ?? null,
    detailMode: true,
    phone: readQuickEditValue("teleapoQuickEditPhone"),
    email: readQuickEditValue("teleapoQuickEditEmail"),
    contactPreferredTime: readQuickEditValue("teleapoQuickEditContactTime"),
    applyCompanyName: readQuickEditValue("teleapoQuickEditApplyCompany"),
    applyJobName: readQuickEditValue("teleapoQuickEditApplyJob"),
    applyRouteText: readQuickEditValue("teleapoQuickEditApplyRoute"),
    birthday: birthday || null,
    age
  };
}

function syncCandidateCaches(candidateId, detail) {
  const idNum = Number(candidateId);
  if (!Number.isFinite(idNum) || idNum <= 0) return;
  const phone = String(detail.phone ?? "").trim();
  const birthday = String(detail.birthday ?? "").trim();
  const contactPreferredTime = normalizeContactPreferredTime(
    detail.contactPreferredTime ??
    detail.contact_preferred_time ??
    detail.contactTime ??
    detail.contact_time
  );
  const ageRaw = detail.age ?? null;
  const ageValue = Number(ageRaw);
  const age = Number.isFinite(ageValue) && ageValue > 0 ? ageValue : calculateAgeFromBirthday(birthday);
  const prev = candidateDetailCache.get(idNum) || {};

  candidateDetailCache.set(idNum, {
    ...prev,
    phone,
    birthday,
    age,
    contactPreferredTime,
    contactPreferredTimeFetched: true
  });
  updateValidApplicationDetailCache({ ...detail, candidateId: idNum }, { force: true });

  if (phone) candidatePhoneCache.set(idNum, phone);
  registerCandidateContactMaps(idNum, { phone, email: detail.email ?? "" });

  const entry = teleapoCandidateMaster.find(c => {
    const entryId = c.id ?? c.candidate_id ?? c.candidateId ?? c.candidateID;
    return String(entryId) === String(idNum);
  });
  if (entry) {
    entry.phone = phone;
    entry.phone_number = phone;
    entry.tel = phone;
    entry.email = detail.email ?? entry.email ?? "";
    entry.birthday = birthday;
    entry.birth_date = birthday;
    entry.birthDate = birthday;
    entry.age = age ?? entry.age ?? null;
    entry.apply_company_name = detail.applyCompanyName ?? entry.apply_company_name ?? "";
    entry.apply_job_name = detail.applyJobName ?? entry.apply_job_name ?? "";
    entry.apply_route_text = detail.applyRouteText ?? entry.apply_route_text ?? "";
    entry.contactPreferredTime = contactPreferredTime;
    entry.contact_preferred_time = contactPreferredTime;
  }
}

async function saveCandidateQuickEdit() {
  if (teleapoQuickEditState.saving) return;
  const candidateId =
    teleapoQuickEditState.candidateId ??
    teleapoQuickEditState.detail?.candidateId ??
    teleapoQuickEditState.detail?.id ??
    teleapoQuickEditState.detail?.candidate_id ??
    null;
  if (!candidateId) {
    setCandidateQuickEditStatus("候補者IDが取得できませんでした。", "error");
    return;
  }
  const url = getCandidateDetailApiUrl(candidateId);
  if (!url) {
    setCandidateQuickEditStatus("保存先のURLが取得できません。", "error");
    return;
  }

  const payload = buildQuickEditPayload(candidateId);
  teleapoQuickEditState.saving = true;
  setCandidateQuickEditStatus("保存中...", "info");

  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    const data = await res.json().catch(() => ({}));
    const normalized = normalizeCandidateDetail(data) || {};
    const fallbackPhone = payload.phone;
    const fallbackBirthday = payload.birthday;
    const idNum = Number(candidateId);
    if (fallbackPhone && !String(normalized.phone || "").trim()) {
      normalized.phone = fallbackPhone;
    }
    if (fallbackBirthday && !String(normalized.birthday || "").trim()) {
      normalized.birthday = fallbackBirthday;
    }
    if (Number.isFinite(payload.age) && (!Number.isFinite(Number(normalized.age)) || Number(normalized.age) <= 0)) {
      normalized.age = payload.age;
    }
    if (!normalized.candidateId && !normalized.id && Number.isFinite(idNum)) {
      normalized.candidateId = idNum;
    }
    teleapoQuickEditState.detail = normalized;
    teleapoQuickEditState.editMode = false;
    syncCandidateCaches(candidateId, normalized);
    renderCandidateQuickView(normalized);
    rebuildMissingInfoCandidates();
    setCandidateQuickEditStatus("", "info");
  } catch (err) {
    console.error("candidate quick edit error:", err);
    const message = err?.message ? `保存に失敗しました: ${err.message}` : "保存に失敗しました。";
    setCandidateQuickEditStatus(message, "error");
  } finally {
    teleapoQuickEditState.saving = false;
  }
}

function renderCandidateQuickView(detail) {
  const candidate = normalizeCandidateDetail(detail || {});
  const name = candidate.candidateName || "-";
  const candidateId = candidate.candidateId ?? candidate.id ?? candidate.candidate_id ?? null;
  const isEditing = teleapoQuickEditState.editMode;
  const birthdayValue = candidate.birthday ?? "";
  const rawAge = Number(candidate.age);
  const ageFromBirthday = calculateAgeFromBirthday(birthdayValue);
  const ageValue = Number.isFinite(rawAge) && rawAge > 0
    ? rawAge
    : (Number.isFinite(ageFromBirthday) && ageFromBirthday > 0 ? ageFromBirthday : null);
  const birthdayText = birthdayValue ? formatCandidateDate(birthdayValue) : "-";
  const ageText = Number.isFinite(ageValue) && ageValue > 0 ? `${ageValue}歳` : "-";
  const editDisabled = teleapoQuickEditState.saving ? "disabled" : "";

  teleapoQuickEditState.detail = candidate;
  if (candidateId) teleapoQuickEditState.candidateId = candidateId;

  setCandidateQuickViewTitle(name ? `${name} の詳細` : "候補者詳細");

  const phaseBadges = buildCandidatePhaseBadges(candidate);
  const validBadge = buildValidApplicationPill(isValidApplicationCandidate(candidate));

  const csSummary = candidate.csSummary || {};
  const csConnected = csSummary.hasConnected ?? candidate.phoneConnected ?? false;
  const csSms = csSummary.hasSms ?? candidate.smsSent ?? candidate.smsConfirmed ?? false;
  const csCallCount = csSummary.callCount ?? csSummary.max_call_no ?? 0;
  const csLastConnected = csSummary.lastConnectedAt ?? candidate.callDate ?? null;

  const selection = (candidate.selectionProgress || [])[0] || null;
  const selectionCompany = selection?.companyName ?? selection?.company_name ?? candidate.applyCompanyName ?? "";
  const selectionJob = selection?.jobTitle ?? selection?.job_title ?? candidate.applyJobName ?? "";
  const selectionStatus = selection?.status ?? selection?.stage_current ?? "";
  const selectionInterview = selection?.interviewDate ?? selection?.firstInterviewAt ?? selection?.first_interview_at ?? null;

  const logs = Array.isArray(candidate.teleapoLogs) ? candidate.teleapoLogs.slice(0, 5) : [];
  const logsHtml = logs.length
    ? logs.map((log) => {
      const calledAt = log.calledAt ?? log.called_at ?? log.callDate ?? log.datetime ?? "";
      const callerName = log.callerName ?? log.caller_name ?? "";
      const memo = log.memo ?? "";
      const callNo = log.callNo ?? log.call_no ?? "";
      return `
        <div class="teleapo-candidate-log-item">
          <div class="teleapo-candidate-log-meta">${escapeHtml(formatCandidateDateTime(calledAt))}</div>
          <div class="teleapo-candidate-log-body">
            <div class="teleapo-candidate-log-title">${formatCandidateValue(callerName, "担当者不明")}</div>
            <div class="teleapo-candidate-log-memo">${formatCandidateValue(memo, "-")}</div>
          </div>
          ${callNo ? `<span class="teleapo-candidate-log-tag">#${escapeHtml(String(callNo))}</span>` : ""}
        </div>
      `;
    }).join("")
    : '<p class="teleapo-candidate-muted">テレアポログはまだありません。</p>';

  const selectionHtml = selection
    ? `
      <dl class="teleapo-candidate-kv">
        <div><dt>企業名</dt><dd>${formatCandidateValue(selectionCompany)}</dd></div>
        <div><dt>職種</dt><dd>${formatCandidateValue(selectionJob)}</dd></div>
        <div><dt>ステータス</dt><dd>${formatCandidateValue(selectionStatus)}</dd></div>
        <div><dt>次回面談</dt><dd>${escapeHtml(formatCandidateDate(selectionInterview))}</dd></div>
      </dl>
    `
    : '<p class="teleapo-candidate-muted">選考情報はありません。</p>';

  const actionHtml = isEditing
    ? `
      <div class="teleapo-candidate-actions">
        <button type="button" data-candidate-action="save" ${editDisabled}
          class="teleapo-candidate-action teleapo-candidate-action--primary">保存</button>
        <button type="button" data-candidate-action="cancel"
          class="teleapo-candidate-action">キャンセル</button>
        <span id="teleapoCandidateEditStatus" class="teleapo-candidate-edit-status"></span>
      </div>
    `
    : `
      <div class="teleapo-candidate-actions">
        <button type="button" data-candidate-action="edit"
          class="teleapo-candidate-action">編集</button>
      </div>
    `;

  const applyRouteField = isEditing
    ? `<input id="teleapoQuickEditApplyRoute" class="teleapo-candidate-edit-input" value="${escapeHtml(candidate.applyRouteText || "")}" />`
    : formatCandidateValue(candidate.applyRouteText);
  const applyCompanyField = isEditing
    ? `<input id="teleapoQuickEditApplyCompany" class="teleapo-candidate-edit-input" value="${escapeHtml(candidate.applyCompanyName || "")}" />`
    : formatCandidateValue(candidate.applyCompanyName);
  const applyJobField = isEditing
    ? `<input id="teleapoQuickEditApplyJob" class="teleapo-candidate-edit-input" value="${escapeHtml(candidate.applyJobName || "")}" />`
    : formatCandidateValue(candidate.applyJobName);
  const birthdayField = isEditing
    ? `<input id="teleapoQuickEditBirthday" type="date" class="teleapo-candidate-edit-input" value="${escapeHtml(formatDateInputValue(birthdayValue))}" />`
    : escapeHtml(birthdayText);
  const ageInputValue = Number.isFinite(rawAge) && rawAge > 0
    ? rawAge
    : (Number.isFinite(ageFromBirthday) && ageFromBirthday > 0 ? ageFromBirthday : "");
  const ageField = isEditing
    ? `<input id="teleapoQuickEditAge" type="number" min="0" class="teleapo-candidate-edit-input" value="${escapeHtml(String(ageInputValue))}" />`
    : escapeHtml(ageText);
  const phoneField = isEditing
    ? `<input id="teleapoQuickEditPhone" class="teleapo-candidate-edit-input" value="${escapeHtml(candidate.phone || "")}" />`
    : formatCandidateValue(candidate.phone);
  const emailField = isEditing
    ? `<input id="teleapoQuickEditEmail" class="teleapo-candidate-edit-input" value="${escapeHtml(candidate.email || "")}" />`
    : formatCandidateValue(candidate.email);
  const contactTimeField = isEditing
    ? `<input id="teleapoQuickEditContactTime" class="teleapo-candidate-edit-input" value="${escapeHtml(candidate.contactPreferredTime || "")}" />`
    : formatCandidateValue(candidate.contactPreferredTime);

  setCandidateQuickViewContent(`
    <div class="teleapo-candidate-meta">
      <div>
        <div class="teleapo-candidate-name">${escapeHtml(name)}</div>
        <div class="teleapo-candidate-tags">
          ${phaseBadges}
          ${validBadge}
        </div>
      </div>
      <button 
        type="button"
        data-candidate-action="open-detail"
        data-candidate-id="${escapeHtml(String(candidateId || ''))}"
        class="px-3 py-2 bg-indigo-600 text-white rounded-md text-xs font-semibold hover:bg-indigo-500 shadow-sm whitespace-nowrap">
        詳細画面へ
      </button>
    </div>
    ${actionHtml}

    <div class="teleapo-candidate-grid">
      <div class="teleapo-candidate-card">
        <div class="teleapo-candidate-card-title">基本情報</div>
        <dl class="teleapo-candidate-kv">
          <div><dt>登録日</dt><dd>${escapeHtml(formatCandidateDate(candidate.registeredAt))}</dd></div>
          <div><dt>応募経路</dt><dd>${applyRouteField}</dd></div>
          <div><dt>応募企業</dt><dd>${applyCompanyField}</dd></div>
          <div><dt>応募職種</dt><dd>${applyJobField}</dd></div>
          <div><dt>生年月日</dt><dd>${birthdayField}</dd></div>
          <div><dt>年齢</dt><dd>${ageField}</dd></div>
          <div><dt>担当CS</dt><dd>${formatCandidateValue(candidate.advisorName)}</dd></div>
          <div><dt>担当パートナー</dt><dd>${formatCandidateValue(candidate.partnerName)}</dd></div>
        </dl>
      </div>
      <div class="teleapo-candidate-card">
        <div class="teleapo-candidate-card-title">連絡先</div>
        <dl class="teleapo-candidate-kv">
          <div><dt>電話</dt><dd>${phoneField}</dd></div>
          <div><dt>メール</dt><dd>${emailField}</dd></div>
          <div><dt>希望時間</dt><dd>${contactTimeField}</dd></div>
          <div><dt>現住所</dt><dd>${formatCandidateValue(candidate.address)}</dd></div>
        </dl>
      </div>
      <div class="teleapo-candidate-card">
        <div class="teleapo-candidate-card-title">CSサマリー</div>
        <dl class="teleapo-candidate-kv">
          <div><dt>通電</dt><dd>${csConnected ? "通電済" : "未通電"}</dd></div>
          <div><dt>SMS</dt><dd>${csSms ? "送信済" : "未送信"}</dd></div>
          <div><dt>架電回数</dt><dd>${escapeHtml(String(csCallCount || 0))}回</dd></div>
          <div><dt>最終通電</dt><dd>${escapeHtml(formatCandidateDateTime(csLastConnected))}</dd></div>
        </dl>
      </div>
    </div>

    <div class="teleapo-candidate-section">
      <div class="teleapo-candidate-card">
        <div class="teleapo-candidate-card-title">最新の選考状況</div>
        ${selectionHtml}
      </div>
    </div>

    <div class="teleapo-candidate-section">
      <div class="teleapo-candidate-card">
        <div class="teleapo-candidate-card-title">最近のテレアポログ（直近5件）</div>
        <div class="teleapo-candidate-log-list">${logsHtml}</div>
      </div>
    </div>
  `);
}

function openCandidateQuickView(candidateId, candidateName) {
  const resolvedId = candidateId || findCandidateIdFromTarget(candidateName);
  const fallbackName = candidateName || candidateIdMap.get(String(candidateId)) || "候補者詳細";
  teleapoQuickEditState.editMode = false;
  teleapoQuickEditState.saving = false;
  teleapoQuickEditState.detail = null;
  teleapoQuickEditState.candidateId = resolvedId || null;
  setCandidateQuickViewTitle(fallbackName);
  setCandidateQuickViewContent(`
    <div class="teleapo-candidate-empty">
      <p class="text-sm text-slate-500">候補者詳細を取得しています...</p>
    </div>
  `);
  openTeleapoCandidateModal();

  if (!resolvedId) {
    setCandidateQuickViewContent(`
      <div class="teleapo-candidate-empty">
        <p class="text-sm text-rose-600">候補者IDが取得できないため詳細を表示できません。</p>
      </div>
    `);
    return;
  }

  if (teleapoCandidateAbort) {
    teleapoCandidateAbort.abort();
  }
  teleapoCandidateAbort = new AbortController();

  fetch(getCandidateDetailApiUrl(resolvedId), {
    headers: { Accept: "application/json" },
    signal: teleapoCandidateAbort.signal
  })
    .then(res => {
      if (!res.ok) {
        return res.text().then(text => {
          throw new Error(`HTTP ${res.status}: ${text}`);
        });
      }
      return res.json();
    })
    .then(data => {
      renderCandidateQuickView(data);
    })
    .catch(err => {
      if (err?.name === "AbortError") return;
      console.error("candidate quick view error:", err);
      setCandidateQuickViewContent(`
        <div class="teleapo-candidate-empty">
          <p class="text-sm text-rose-600">候補者詳細の取得に失敗しました。</p>
        </div>
      `);
    });
}

function openTeleapoCandidateModal() {
  const modal = document.getElementById("teleapoCandidateModal");
  if (!modal) return;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("teleapo-candidate-open");
}

function closeTeleapoCandidateModal() {
  const modal = document.getElementById("teleapoCandidateModal");
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("teleapo-candidate-open");
  if (teleapoCandidateAbort) {
    teleapoCandidateAbort.abort();
    teleapoCandidateAbort = null;
  }
}

function handleCandidateQuickAction(event) {
  const btn = event.target.closest("[data-candidate-action]");
  if (!btn) return;
  event.preventDefault();
  const action = btn.dataset.candidateAction;
  if (!action) return;
  if (!teleapoQuickEditState.detail) return;

  if (action === "open-detail") {
    const candidateId = btn.dataset.candidateId || teleapoQuickEditState.detail?.candidateId || teleapoQuickEditState.detail?.id;
    const candidateName = teleapoQuickEditState.detail?.candidateName || teleapoQuickEditState.detail?.name;
    closeTeleapoCandidateModal();
    navigateToCandidateDetailPage(candidateId, candidateName);
    return;
  }
  if (action === "edit") {
    teleapoQuickEditState.editMode = true;
    renderCandidateQuickView(teleapoQuickEditState.detail);
    return;
  }
  if (action === "cancel") {
    teleapoQuickEditState.editMode = false;
    renderCandidateQuickView(teleapoQuickEditState.detail);
    return;
  }
  if (action === "save") {
    saveCandidateQuickEdit();
  }
}

function initCandidateQuickView() {
  const modal = document.getElementById("teleapoCandidateModal");
  const closeBtn = document.getElementById("teleapoCandidateClose");
  const detailContent = document.getElementById("teleapoCandidateDetailContent");
  if (closeBtn) closeBtn.addEventListener("click", closeTeleapoCandidateModal);
  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeTeleapoCandidateModal();
    });
  }
  if (detailContent) {
    detailContent.addEventListener("click", handleCandidateQuickAction);
  }
}

function renderValidApplicationBadge(isValid) {
  const label = isValid ? "有効応募" : "無効応募";
  const classes = isValid
    ? "bg-emerald-100 text-emerald-700"
    : "bg-slate-100 text-slate-500";
  return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${classes}">${label}</span>`;
}

function buildTeleapoSummaryForCandidate(candidateId, candidateName) {
  const idNum = Number(candidateId);
  const hasId = Number.isFinite(idNum) && idNum > 0;
  const normalizedName = normalizeNameKey(candidateName);
  if (hasId) {
    const cached = teleapoSummaryByCandidateId.get(idNum);
    if (!cached) return null;
    return {
      hasConnected: cached.hasConnected,
      hasSms: cached.hasSms,
      callCount: cached.callCount,
      lastConnectedAt: cached.lastConnectedAt
    };
  }
  if (!normalizedName) return null;
  const cached = teleapoSummaryByName.get(normalizedName);
  if (!cached) return null;
  return {
    hasConnected: cached.hasConnected,
    hasSms: cached.hasSms,
    callCount: cached.callCount,
    lastConnectedAt: cached.lastConnectedAt
  };
}

function normalizeCandidateTask(candidate) {
  if (!candidate) return null;
  const candidateId =
    candidate.id ??
    candidate.candidate_id ??
    candidate.candidateId ??
    candidate.candidateID ??
    null;
  const candidateName = String(
    candidate.candidateName ??
    candidate.candidate_name ??
    candidate.name ??
    ""
  ).trim();
  const phaseList = normalizePhaseList(candidate?.phases ?? candidate?.phaseList ?? candidate?.phase ?? "");
  const teleapoSummary = buildTeleapoSummaryForCandidate(candidateId, candidateName);
  const teleapoPhaseText = teleapoSummary
    ? resolveCandidatePhaseDisplay({ ...candidate, csSummary: teleapoSummary })
    : "";
  const phaseText = teleapoPhaseText || (phaseList.length ? phaseList.join(" / ") : resolveCandidatePhaseDisplay(candidate));
  const validApplication = isValidApplicationCandidate(candidate);
  const registeredAt =
    candidate.registeredAt ??
    candidate.registered_at ??
    candidate.createdAt ??
    candidate.created_at ??
    candidate.createdDate ??
    candidate.created_date ??
    null;
  const phone =
    candidate.phone ??
    candidate.phone_number ??
    candidate.phoneNumber ??
    candidate.tel ??
    candidate.candidate_phone ??
    candidate.mobile ??
    candidate.mobilePhone ??
    "";
  const contactPreferredTime = normalizeContactPreferredTime(
    candidate.contactPreferredTime ??
    candidate.contact_preferred_time ??
    candidate.contactTime ??
    candidate.contact_time
  );
  const isUncontacted = teleapoSummary
    ? !(teleapoSummary.hasConnected || teleapoSummary.hasSms || teleapoSummary.callCount > 0)
    : (phaseList.includes("未接触") || phaseText === "未接触");

  return {
    candidateId,
    candidateName,
    phaseText,
    validApplication,
    registeredAt,
    phone,
    contactPreferredTime,
    isUncontacted,
  };
}

function resolveCandidatePhone(candidateId, candidateName) {
  const idNum = Number(candidateId);
  if (Number.isFinite(idNum) && candidatePhoneCache.has(idNum)) {
    return candidatePhoneCache.get(idNum) || "";
  }
  if (!teleapoLogData.length) return "";
  const normalizedName = normalizeNameKey(candidateName);
  let bestTel = "";
  let bestTs = -Infinity;

  for (const log of teleapoLogData) {
    const tel = String(log.tel || "").trim();
    if (!tel) continue;
    if (Number.isFinite(idNum) && idNum > 0) {
      if (Number(log.candidateId) !== idNum) continue;
    } else if (normalizedName) {
      const targetKey = normalizeNameKey(log.target || "");
      if (!targetKey || !targetKey.includes(normalizedName)) continue;
    } else {
      continue;
    }
    const ts = parseDateTime(log.datetime)?.getTime() || 0;
    if (ts >= bestTs) {
      bestTs = ts;
      bestTel = tel;
    }
  }

  return bestTel;
}

function rebuildCsTaskCandidates() {
  if (!teleapoCandidateMaster.length) return;
  teleapoCsTaskCandidates = teleapoCandidateMaster
    .map(normalizeCandidateTask)
    .filter((c) => c && c.validApplication && c.isUncontacted);
  renderCsTaskTable(teleapoCsTaskCandidates);
  rebuildMissingInfoCandidates();
}

function scheduleCandidatePhoneFetch(list) {
  return;
}

function renderCsTaskTable(list, state = {}) {
  const body = document.getElementById("teleapoCsTaskTableBody");
  const countEl = document.getElementById("teleapoCsTaskCount");
  const wrapper = document.getElementById("teleapoCsTaskTableWrapper");
  if (countEl) {
    countEl.textContent = state.loading ? "読み込み中..." : `${list.length}件`;
  }
  if (!body) return;
  if (wrapper) wrapper.classList.toggle('hidden', !csTaskExpanded);

  if (state.loading) {
    body.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-slate-500 py-6">読み込み中...</td>
      </tr>
    `;
    return;
  }

  if (state.error) {
    body.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-rose-600 py-6">候補者の取得に失敗しました</td>
      </tr>
    `;
    return;
  }

  if (!csTaskExpanded) {
    body.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-slate-500 py-6">一覧を開くと内容が表示されます</td>
      </tr>
    `;
    return;
  }

  if (!list.length) {
    body.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-slate-500 py-6">対象の候補者がいません</td>
      </tr>
    `;
    return;
  }

  body.innerHTML = list.map((row) => {
    const nameLabel = row.candidateName || "-";
    const candidateId = row.candidateId ?? findCandidateIdFromTarget(row.candidateName);
    const phoneValue = row.phone || resolveCandidatePhone(candidateId, row.candidateName);
    const contactTimeValue =
      normalizeContactPreferredTime(row.contactPreferredTime ?? row.contact_preferred_time ?? row.contactTime ?? row.contact_time) ||
      resolveCandidateContactPreferredTime(candidateId, row.candidateName);
    const contactTimeTextValue = String(contactTimeValue ?? "").trim();
    if (!contactTimeTextValue) enqueueContactTimeFetch(candidateId);
    const contactTimeText = escapeHtml(contactTimeTextValue || "-");
    const dialBtn = candidateId || nameLabel !== "-"
      ? `<button type="button"
           class="text-xs px-2 py-1 rounded border border-indigo-200 text-indigo-700 hover:bg-indigo-50"
           data-action="prefill-dial"
           data-candidate-id="${escapeHtml(candidateId || '')}"
           data-candidate-name="${escapeHtml(row.candidateName || '')}">
           架電登録
         </button>`
      : `<span class="text-xs text-slate-400">-</span>`;
    const nameCell = nameLabel !== "-"
      ? `<button type="button"
           class="text-indigo-600 hover:text-indigo-800 underline bg-transparent border-0 p-0"
           data-action="open-candidate"
           data-candidate-id="${escapeHtml(candidateId || '')}"
           data-candidate-name="${escapeHtml(row.candidateName || '')}">${escapeHtml(nameLabel)}</button>`
      : escapeHtml(nameLabel);
    return `
      <tr>
        <td class="whitespace-nowrap">${escapeHtml(row.phaseText || "-")}</td>
        <td class="whitespace-nowrap">${renderValidApplicationBadge(row.validApplication)}</td>
        <td class="whitespace-nowrap">${nameCell}</td>
        <td class="whitespace-nowrap">${escapeHtml(formatCandidateDateTime(row.registeredAt))}</td>
        <td class="whitespace-nowrap">${escapeHtml(phoneValue || "-")}</td>
        <td class="whitespace-nowrap">${contactTimeText}</td>
        <td class="whitespace-nowrap">${dialBtn}</td>
      </tr>
    `;
  }).join("");

  scheduleCandidatePhoneFetch(list);
}

function parseCandidateDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;
  const match = String(value).match(/(\d{4})\s*[\/-]\s*(\d{1,2})\s*[\/-]\s*(\d{1,2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function calculateAgeFromBirthday(value) {
  if (!value) return null;
  const date = parseCandidateDateValue(value);
  if (!date || Number.isNaN(date.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) age -= 1;
  return age;
}

function normalizeMissingInfoCandidate(candidate) {
  if (!candidate) return null;
  const candidateId =
    candidate.id ??
    candidate.candidate_id ??
    candidate.candidateId ??
    candidate.candidateID ??
    null;
  const idNum = Number(candidateId);
  const cached = Number.isFinite(idNum) && idNum > 0 ? candidateDetailCache.get(idNum) : null;

  const name = String(
    candidate.candidateName ??
    candidate.candidate_name ??
    candidate.name ??
    ""
  ).trim();
  const registeredAt =
    candidate.registeredAt ??
    candidate.registered_at ??
    candidate.createdAt ??
    candidate.created_at ??
    candidate.createdDate ??
    candidate.created_date ??
    null;

  const birthday =
    cached?.birthday ??
    candidate.birthday ??
    candidate.birth_date ??
    candidate.birthDate ??
    candidate.birthdate ??
    "";
  const ageRaw =
    cached?.age ??
    candidate.age ??
    candidate.age_years ??
    candidate.ageYears ??
    null;
  const ageValue = Number(ageRaw);
  const age = Number.isFinite(ageValue) && ageValue > 0 ? ageValue : calculateAgeFromBirthday(birthday);

  const phone =
    cached?.phone ??
    candidate.phone ??
    candidate.phone_number ??
    candidate.phoneNumber ??
    candidate.tel ??
    candidate.mobile ??
    candidate.candidate_phone ??
    candidatePhoneCache.get(idNum) ??
    "";

  const missingAge = !(Number.isFinite(age) && age > 0);
  const missingPhone = !String(phone ?? "").trim();
  const needsDetail = (missingAge || missingPhone) && Number.isFinite(idNum) && idNum > 0 && !candidateDetailCache.has(idNum);

  if (!missingAge && !missingPhone) return null;

  return {
    candidateId: Number.isFinite(idNum) && idNum > 0 ? idNum : null,
    candidateName: name,
    registeredAt,
    birthday,
    age,
    phone,
    missingAge,
    missingPhone,
    needsDetail
  };
}

function rebuildMissingInfoCandidates() {
  if (!teleapoCandidateMaster.length) {
    renderMissingInfoTable([], { loading: true });
    return;
  }
  teleapoMissingInfoCandidates = teleapoCandidateMaster
    .map(normalizeMissingInfoCandidate)
    .filter(Boolean);
  renderMissingInfoTable(teleapoMissingInfoCandidates);
}

function renderMissingInfoTable(list, state = {}) {
  const body = document.getElementById("teleapoMissingInfoTableBody");
  const countEl = document.getElementById("teleapoMissingInfoCount");
  const wrapper = document.getElementById("teleapoMissingInfoTableWrapper");
  if (countEl) {
    countEl.textContent = state.loading ? "読み込み中..." : `${list.length}件`;
  }
  if (!body) return;
  if (wrapper) wrapper.classList.toggle('hidden', !missingInfoExpanded);

  if (state.loading) {
    body.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-slate-500 py-6">読み込み中...</td>
      </tr>
    `;
    return;
  }

  if (!list.length) {
    body.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-slate-500 py-6">対象の候補者がいません</td>
      </tr>
    `;
    return;
  }

  if (!missingInfoExpanded) {
    body.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-slate-500 py-6">一覧を開くと内容が表示されます</td>
      </tr>
    `;
    return;
  }

  if (!missingInfoExpanded && list.length > MISSING_INFO_RENDER_LIMIT) {
    body.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-slate-500 py-6">
          対象が多いため一覧を一時的に非表示にしています（${list.length}件）。
          右上の「一覧を開く」を押してください。
        </td>
      </tr>
    `;
    return;
  }

  const visible = list;

  body.innerHTML = visible.map(row => {
    const candidateId = row.candidateId ?? findCandidateIdFromTarget(row.candidateName);
    const nameLabel = row.candidateName || "-";
    const nameCell = nameLabel !== "-"
      ? `<button type="button"
           class="text-indigo-600 hover:text-indigo-800 underline bg-transparent border-0 p-0"
           data-action="open-candidate"
           data-candidate-id="${escapeHtml(candidateId || '')}"
           data-candidate-name="${escapeHtml(row.candidateName || '')}">${escapeHtml(nameLabel)}</button>`
      : escapeHtml(nameLabel);
    const missingTags = [
      row.missingAge ? "年齢" : null,
      row.missingPhone ? "電話番号" : null
    ].filter(Boolean);
    const missingHtml = missingTags.map(tag => `
      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-700">
        ${escapeHtml(tag)}
      </span>
    `).join(" ");

    const ageText = Number.isFinite(row.age) && row.age > 0 ? `${row.age}歳` : "-";
    const phoneText = String(row.phone ?? "").trim() || "-";

    return `
      <tr>
        <td class="whitespace-nowrap">${missingHtml || "-"}</td>
        <td class="whitespace-nowrap">${nameCell}</td>
        <td class="whitespace-nowrap">${escapeHtml(formatCandidateDateTime(row.registeredAt))}</td>
        <td class="whitespace-nowrap">${escapeHtml(ageText)}</td>
        <td class="whitespace-nowrap">${escapeHtml(phoneText)}</td>
      </tr>
    `;
  }).join("");

  scheduleMissingInfoFetch(list);
}

function scheduleMissingInfoFetch(list) {
  if (!Array.isArray(list) || !list.length) return;
  list.forEach(row => {
    if (!row.needsDetail) return;
    const idNum = Number(row.candidateId);
    if (!Number.isFinite(idNum) || idNum <= 0) return;
    if (candidateDetailCache.has(idNum)) return;
    if (candidateDetailRequests.has(idNum)) return;
    if (missingInfoQueueSet.has(idNum)) return;
    missingInfoQueue.push(idNum);
    missingInfoQueueSet.add(idNum);
  });
  if (!missingInfoQueue.length || missingInfoQueueActive) return;
  processMissingInfoQueue();
}

function processMissingInfoQueue() {
  if (!missingInfoQueue.length) {
    missingInfoQueueActive = false;
    return;
  }
  missingInfoQueueActive = true;
  const batch = missingInfoQueue.splice(0, MISSING_INFO_FETCH_BATCH);
  batch.forEach(idNum => missingInfoQueueSet.delete(idNum));
  Promise.all(batch.map(idNum => fetchCandidateDetailInfo(idNum)))
    .then(() => {
      rebuildMissingInfoCandidates();
    })
    .finally(() => {
      setTimeout(processMissingInfoQueue, MISSING_INFO_FETCH_DELAY_MS);
    });
}

const RESULT_LABELS = {
  connect: '通電',
  set: '設定',
  show: '着座',
  callback: 'コールバック',
  no_answer: '不在',
  sms_sent: 'SMS送信'
};

let teleapoLogData = [];
let teleapoPendingLogs = [];
let teleapoMissingInfoCandidates = [];
let teleapoFilteredLogs = [];
let teleapoEmployeeMetrics = [];
let teleapoSummaryScope = { type: 'company', name: '全体' };
let teleapoEmployeeTrendMode = 'month';
let teleapoAnalysisRange = 'all';
let teleapoLogSort = { key: 'datetime', dir: 'desc' };
let teleapoEmployeeSortState = { key: 'connectRate', dir: 'desc' };
let teleapoHighlightLogId = null;
let teleapoHighlightFingerprint = null;
let employeeNameToUserId = new Map();
let teleapoRangeTouched = false;
let teleapoAutoFallbackDone = false;
let teleapoActivePreset = 'thisMonth'; // 現在アクティブなプリセット（今日/今週/今月/null）

function rebuildEmployeeMap() {
  employeeNameToUserId = new Map();
  for (const l of teleapoLogData) {
    if (l.employee && Number.isFinite(l.callerUserId)) {
      employeeNameToUserId.set(l.employee, l.callerUserId);
    }
  }
}

const teleapoInitialMockLogs = [
  // 同じターゲットに複数回架電した例（1回目不在→2回目通電）
  { datetime: '2025/11/25 09:10', employee: '佐藤', route: ROUTE_TEL, target: 'ABC社 田中様', tel: '03-1111-1111', email: 'tanaka@abc.co.jp', resultCode: 'no_answer', memo: '1回目 不在' },
  { datetime: '2025/11/25 10:00', employee: '佐藤', route: ROUTE_TEL, target: 'ABC社 田中様', tel: '03-1111-1111', email: 'tanaka@abc.co.jp', resultCode: 'connect', memo: '提案内容を説明' },
  { datetime: '2025/11/25 11:30', employee: '鈴木', route: ROUTE_TEL, target: 'XYZ社 鈴木様', tel: '03-2222-2222', email: 'suzuki@xyz.co.jp', resultCode: 'set', memo: '12/2 15:00 商談設定' },
  { datetime: '2025/11/25 14:10', employee: '高橋', route: ROUTE_TEL, target: 'DEF社 佐々木様', tel: '03-3333-3333', email: 'sasaki@def.jp', resultCode: 'no_answer', memo: '再架電希望' },
  { datetime: '2025/11/25 15:45', employee: '田中', route: ROUTE_TEL, target: 'GHI社 高橋様', tel: '03-4444-4444', email: 'takahashi@ghi.jp', resultCode: 'show', memo: '来社確定' },
  { datetime: '2025/11/24 09:20', employee: '佐藤', route: ROUTE_TEL, target: 'JKL社 山田様', tel: '03-5555-5555', email: 'yamada@jkl.jp', resultCode: 'callback', memo: '午後折返し' },
  // 3回目で通電した例
  { datetime: '2025/11/24 12:00', employee: '高橋', route: ROUTE_TEL, target: 'PQR社 中村様', tel: '03-6666-6666', email: 'nakamura@pqr.jp', resultCode: 'no_answer', memo: '1回目 不在' },
  { datetime: '2025/11/24 13:20', employee: '高橋', route: ROUTE_TEL, target: 'PQR社 中村様', tel: '03-6666-6666', email: 'nakamura@pqr.jp', resultCode: 'callback', memo: '2回目 折返し待ち' },
  { datetime: '2025/11/24 13:50', employee: '高橋', route: ROUTE_TEL, target: 'PQR社 中村様', tel: '03-6666-6666', email: 'nakamura@pqr.jp', resultCode: 'connect', memo: '課題ヒアリング' },
  { datetime: '2025/11/24 16:30', employee: '田中', route: ROUTE_TEL, target: 'STU社 佐藤様', tel: '03-7777-7777', email: 'sato@stu.jp', resultCode: 'set', memo: '12/4 10:00 商談' },
  { datetime: '2025/11/23 10:40', employee: '佐藤', route: ROUTE_TEL, target: 'VWX社 小林様', tel: '03-8888-8888', email: 'kobayashi@vwx.jp', resultCode: 'connect', memo: '担当紹介' },
  { datetime: '2025/11/23 14:00', employee: '鈴木', route: ROUTE_OTHER, target: 'YZA社 高田様', tel: '', email: 'takada@yza.jp', resultCode: 'show', memo: 'オンライン面談' },
  { datetime: '2025/11/22 09:15', employee: '高橋', route: ROUTE_TEL, target: 'NEXT 山本様', tel: '03-9999-9999', email: 'abe@next.jp', resultCode: 'connect', memo: '資料送付' },
  { datetime: '2025/11/22 15:05', employee: '佐藤', route: ROUTE_TEL, target: 'INSIGHT 山下様', tel: '03-1212-1212', email: 'yamashita@insight.jp', resultCode: 'set', memo: '11/29 15:00 予定' },
  { datetime: '2025/11/21 10:50', employee: '鈴木', route: ROUTE_TEL, target: 'JOINT 工藤様', tel: '03-1313-1313', email: 'kudo@joint.jp', resultCode: 'show', memo: '来社済み' },
  { datetime: '2025/11/21 16:20', employee: '田中', route: ROUTE_TEL, target: 'LEAD 池田様', tel: '03-1414-1414', email: 'ikeda@lead.jp', resultCode: 'connect', memo: 'フォロー中' },
  // 10月以前のモック（期間広げてもグラフが埋まるように）
  { datetime: '2025/10/05 11:00', employee: '佐藤', route: ROUTE_TEL, target: 'OLD社 佐藤様', tel: '03-2020-2020', email: 'old1@example.jp', resultCode: 'no_answer', memo: '1回目 不在' },
  { datetime: '2025/10/06 14:00', employee: '佐藤', route: ROUTE_TEL, target: 'OLD社 佐藤様', tel: '03-2020-2020', email: 'old1@example.jp', resultCode: 'connect', memo: '2回目 通電' },
  { datetime: '2025/09/28 09:30', employee: '鈴木', route: ROUTE_TEL, target: 'LEGACY社 山口様', tel: '03-3030-3030', email: 'legacy@example.jp', resultCode: 'callback', memo: '1回目 折返し待ち' },
  { datetime: '2025/09/30 10:10', employee: '鈴木', route: ROUTE_TEL, target: 'LEGACY社 山口様', tel: '03-3030-3030', email: 'legacy@example.jp', resultCode: 'show', memo: '2回目 着座' },
  // 9?7月もカバーし、社員別の時系列グラフが長めに動くように追加
  { datetime: '2025/09/12 15:30', employee: '佐藤', route: ROUTE_TEL, target: 'HIST社 佐々木様', tel: '03-1515-1515', email: 'sasaki@hist.jp', resultCode: 'connect', memo: '9月中旬 通電' },
  { datetime: '2025/09/05 10:30', employee: '高橋', route: ROUTE_TEL, target: 'HIST社 山下様', tel: '03-1616-1616', email: 'yamashita@hist.jp', resultCode: 'set', memo: '9月上旬 設定' },
  { datetime: '2025/08/25 11:00', employee: '鈴木', route: ROUTE_TEL, target: 'SUMMER社 佐伯様', tel: '03-1717-1717', email: 'saeki@summer.jp', resultCode: 'callback', memo: '8月下旬 折返し待ち' },
  { datetime: '2025/08/18 16:00', employee: '田中', route: ROUTE_TEL, target: 'SUMMER社 斎藤様', tel: '03-1818-1818', email: 'saito@summer.jp', resultCode: 'show', memo: '8月中旬 着座' },
  { datetime: '2025/08/02 09:15', employee: '佐藤', route: ROUTE_TEL, target: 'SUMMER社 江口様', tel: '03-1919-1919', email: 'eguchi@summer.jp', resultCode: 'no_answer', memo: '8月初旬 不在' },
  { datetime: '2025/07/22 14:30', employee: '高橋', route: ROUTE_TEL, target: 'RAINY社 岩田様', tel: '03-2021-2021', email: 'iwata@rainy.jp', resultCode: 'connect', memo: '7月下旬 通電' },
  { datetime: '2025/07/10 13:10', employee: '田中', route: ROUTE_TEL, target: 'RAINY社 三浦様', tel: '03-2121-2121', email: 'miura@rainy.jp', resultCode: 'set', memo: '7月中旬 設定' },
  { datetime: '2025/07/05 10:40', employee: '鈴木', route: ROUTE_TEL, target: 'RAINY社 渡辺様', tel: '03-2221-2221', email: 'watanabe@rainy.jp', resultCode: 'show', memo: '7月初旬 着座' },
  // 上期のモック（グラフを月単位でも確認できるように更に拡張）
  { datetime: '2025/06/18 11:40', employee: '佐藤', route: ROUTE_TEL, target: 'EARLY社 河合様', tel: '03-2323-2323', email: 'kawai@early.jp', resultCode: 'connect', memo: '6月中旬 通電' },
  { datetime: '2025/06/07 16:20', employee: '高橋', route: ROUTE_TEL, target: 'EARLY社 大西様', tel: '03-2424-2424', email: 'onishi@early.jp', resultCode: 'callback', memo: '6月初旬 折返し待ち' },
  { datetime: '2025/05/27 09:50', employee: '鈴木', route: ROUTE_TEL, target: 'MAY社 井上様', tel: '03-2525-2525', email: 'inoue@may.jp', resultCode: 'set', memo: '5月末 設定' },
  { datetime: '2025/05/15 14:05', employee: '田中', route: ROUTE_TEL, target: 'MAY社 木村様', tel: '03-2626-2626', email: 'kimura@may.jp', resultCode: 'show', memo: '5月中旬 着座' },
  { datetime: '2025/04/22 10:25', employee: '佐藤', route: ROUTE_TEL, target: 'SPRING社 野村様', tel: '03-2727-2727', email: 'nomura@spring.jp', resultCode: 'connect', memo: '4月下旬 通電' },
  { datetime: '2025/04/05 15:35', employee: '鈴木', route: ROUTE_TEL, target: 'SPRING社 大谷様', tel: '03-2828-2828', email: 'otani@spring.jp', resultCode: 'no_answer', memo: '4月初旬 不在' },
  { datetime: '2025/03/18 11:10', employee: '高橋', route: ROUTE_TEL, target: 'MARCH社 佐野様', tel: '03-2929-2929', email: 'sano@march.jp', resultCode: 'set', memo: '3月中旬 設定' },
  { datetime: '2025/02/09 09:40', employee: '田中', route: ROUTE_TEL, target: 'WINTER社 千葉様', tel: '03-3031-3031', email: 'chiba@winter.jp', resultCode: 'connect', memo: '2月初旬 通電' },
  { datetime: '2024/12/12 13:00', employee: '佐藤', route: ROUTE_TEL, target: 'XMAS社 杉山様', tel: '03-3131-3131', email: 'sugiyama@xmas.jp', resultCode: 'show', memo: '12月 着座' }
];

function parseDateTime(dateTimeStr) {
  if (!dateTimeStr) return null;
  const [datePart, timePart = '00:00'] = dateTimeStr.split(' ');
  const [y, m, d] = (datePart || '').split('/');
  const [hh = '00', mm = '00'] = (timePart || '').split(':');
  if (!y || !m || !d) return null;
  return new Date(`${y}-${m}-${d}T${hh}:${mm}:00`);
}

function normalizeResultCode(raw) {
  const t = (raw || '').toString().toLowerCase();
  if (t.includes('show') || t.includes('着座')) return 'show';
  if (t.includes('set') || t.includes('設定') || t.includes('アポ') || t.includes('面談')) return 'set';
  if (t.includes('callback') || t.includes('コールバック') || t.includes('折返') || t.includes('折り返')) return 'callback';
  if (t.includes('no_answer') || t.includes('不在')) return 'no_answer';
  if (t.includes('connect') || t.includes('通電')) return 'connect';
  if (t.includes('sms')) return 'sms_sent';
  return t || '';
}

function normalizeRoute(raw) {
  const t = (raw || '').toString().toLowerCase();
  if (t.includes('other') || t.includes('その他')) return ROUTE_OTHER;
  if (t.includes('sms') || t.includes('mail') || t.includes('メール') || t.includes('line')) return ROUTE_OTHER;
  if (t.includes('tel') || t.includes('call') || t.includes('電話')) return ROUTE_TEL;
  return ROUTE_TEL; // デフォルトは架電扱い
}

function normalizeLog(log) {
  const rawResult = log.result || log.resultRaw || '';
  const resultCode = normalizeResultCode(log.resultCode || rawResult);
  return {
    ...log,
    route: normalizeRoute(log.route),
    resultCode,
    result: RESULT_LABELS[resultCode] || rawResult || ''
  };
}

function isSameTeleapoLog(a, b) {
  if (!a || !b) return false;
  if (a.id && b.id && String(a.id) === String(b.id)) return true;
  if (!a.datetime || !b.datetime) return false;
  if (a.employee && b.employee && a.employee !== b.employee) return false;
  if (a.datetime !== b.datetime) return false;
  if (a.candidateId && b.candidateId && Number(a.candidateId) === Number(b.candidateId)) return true;
  const aKey = normalizeNameKey(a.target || "");
  const bKey = normalizeNameKey(b.target || "");
  return aKey && bKey && aKey === bKey;
}

function findCandidateEntry(candidateId, candidateName) {
  if (!teleapoCandidateMaster.length) return null;
  const idText = candidateId ? String(candidateId) : "";
  const nameKey = normalizeNameKey(candidateName || "");
  let candidate = null;
  if (idText) {
    candidate = teleapoCandidateMaster.find(c => String(c.id ?? c.candidate_id ?? c.candidateId ?? c.candidateID) === idText) || null;
  }
  if (!candidate && nameKey) {
    candidate = teleapoCandidateMaster.find(c => normalizeNameKey(c.candidateName ?? c.candidate_name ?? c.name ?? "") === nameKey) || null;
  }
  if (!candidate && candidateName) {
    const resolvedId = findCandidateIdFromTarget(candidateName);
    if (resolvedId) {
      const resolvedIdText = String(resolvedId);
      candidate = teleapoCandidateMaster.find(c => String(c.id ?? c.candidate_id ?? c.candidateId ?? c.candidateID) === resolvedIdText) || null;
    }
  }
  return candidate;
}

function resolveCandidateContact(candidateId, candidateName) {
  const candidate = findCandidateEntry(candidateId, candidateName);
  if (!candidate) return { tel: "", email: "" };
  const tel =
    candidate?.phone ??
    candidate?.phone_number ??
    candidate?.phoneNumber ??
    candidate?.tel ??
    candidate?.mobile ??
    candidate?.candidate_phone ??
    "";
  const email =
    candidate?.email ??
    candidate?.candidate_email ??
    candidate?.mail ??
    "";
  return { tel, email };
}

function resolveCandidateContactPreferredTime(candidateId, candidateName) {
  let idNum = Number(candidateId);
  if (!Number.isFinite(idNum) || idNum <= 0) {
    const resolved = findCandidateIdFromTarget(candidateName);
    idNum = Number(resolved);
  }
  if (Number.isFinite(idNum) && idNum > 0) {
    const cached = candidateDetailCache.get(idNum);
    const cachedTime = normalizeContactPreferredTime(
      cached?.contactPreferredTime ??
      cached?.contact_preferred_time ??
      cached?.contactTime ??
      cached?.contact_time
    );
    if (cachedTime) {
      return cachedTime;
    }
  }
  const candidate = findCandidateEntry(candidateId, candidateName);
  const time = normalizeContactPreferredTime(
    candidate?.contactPreferredTime ??
    candidate?.contact_preferred_time ??
    candidate?.contactTime ??
    candidate?.contact_time
  );
  return time;
}

function buildPendingTeleapoLog({
  id,
  candidateId,
  candidateName,
  calledAt,
  employee,
  route,
  result,
  memo,
  callerUserId
}) {
  const contact = resolveCandidateContact(candidateId, candidateName);
  const contactPreferredTime = resolveCandidateContactPreferredTime(candidateId, candidateName);
  return normalizeLog({
    id: id != null && id !== "" ? String(id) : undefined,
    datetime: toDateTimeString(calledAt) || "",
    employee: employee || "",
    route,
    target: candidateName || "",
    tel: contact.tel || "",
    email: contact.email || "",
    contactPreferredTime,
    resultRaw: result || "",
    memo: memo || "",
    candidateId: Number.isFinite(candidateId) && candidateId > 0 ? candidateId : undefined,
    callerUserId: Number.isFinite(callerUserId) && callerUserId > 0 ? callerUserId : undefined
  });
}

function addPendingTeleapoLog(log) {
  if (!log || !log.datetime) return;
  const exists = teleapoPendingLogs.some(p => isSameTeleapoLog(p, log));
  if (!exists) teleapoPendingLogs.unshift(log);
}

function mergePendingLogs(baseLogs) {
  if (!teleapoPendingLogs.length) return baseLogs;
  const merged = [...baseLogs];
  const stillPending = [];
  for (const pending of teleapoPendingLogs) {
    const exists = merged.some(l => isSameTeleapoLog(l, pending));
    if (!exists) {
      merged.unshift(pending);
      stillPending.push(pending);
    }
  }
  teleapoPendingLogs = stillPending;
  return merged;
}

function classifyTeleapoResult(log) {
  const code = normalizeResultCode(log.resultCode || log.result);
  const attendanceConfirmed = resolveAttendanceConfirmed(log);
  const interviewDate = resolveCandidateInterviewDate(log);
  const isShow = code === 'show' || (code === 'set' && attendanceConfirmed);
  const meetingLabel = interviewDate
    ? `面談(${formatShortMonthDay(interviewDate)})`
    : '面談';
  const flowLabels = (code === 'set' || code === 'show')
    ? ['通電', meetingLabel].concat(isShow ? ['着座'] : [])
    : null;
  const displayLabel = flowLabels
    ? flowLabels.join('→')
    : (RESULT_LABELS[code] || log.result || '');
  return {
    isConnect: ['connect', 'set', 'show', 'callback'].includes(code), // 既存の通電判定（後方互換）
    isConnectPlusSet: ['connect', 'callback', 'set', 'show'].includes(code), // 通電率定義用: 通電＋設定
    isSet: ['set', 'show'].includes(code),
    isShow,
    code,
    attendanceConfirmed,
    interviewDate,
    flowLabels,
    displayLabel
  };
}

function zeroPad(n) {
  return `${n}`.padStart(2, '0');
}

function toDateTimeString(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return `${value}`; // 変換できない場合はそのまま返す
  return `${d.getFullYear()}/${zeroPad(d.getMonth() + 1)}/${zeroPad(d.getDate())} ${zeroPad(d.getHours())}:${zeroPad(d.getMinutes())}`;
}

function buildLogHighlightFingerprint(candidateId, calledAt, callerUserId, candidateName) {
  const ts = new Date(calledAt).getTime();
  if (!Number.isFinite(ts)) return null;
  const candidateNum = Number(candidateId);
  const hasCandidateId = Number.isFinite(candidateNum) && candidateNum > 0;
  const name = (candidateName || "").trim();
  if (!hasCandidateId && !name) return null;
  const callerNum = Number(callerUserId);
  return {
    candidateId: hasCandidateId ? candidateNum : null,
    candidateName: name || null,
    callerUserId: Number.isFinite(callerNum) ? callerNum : null,
    timestampMs: ts
  };
}

function setLogHighlightTarget({ id, candidateId, calledAt, callerUserId, candidateName }) {
  teleapoHighlightLogId = id != null && id !== '' ? String(id) : null;
  teleapoHighlightFingerprint = teleapoHighlightLogId
    ? null
    : buildLogHighlightFingerprint(candidateId, calledAt, callerUserId, candidateName);
}

function shouldHighlightLog(row) {
  if (teleapoHighlightLogId && row?.id != null && String(row.id) === teleapoHighlightLogId) return true;
  if (!teleapoHighlightFingerprint) return false;
  const fp = teleapoHighlightFingerprint;
  if (fp.candidateId != null) {
    const rowCandidate = Number(row?.candidateId);
    if (!Number.isFinite(rowCandidate) || rowCandidate !== fp.candidateId) return false;
  } else if (fp.candidateName) {
    const rowName = (row?.target || "").trim();
    if (!rowName || rowName !== fp.candidateName) return false;
  } else {
    return false;
  }
  if (fp.callerUserId && row?.callerUserId && Number(row.callerUserId) !== fp.callerUserId) return false;
  const rowTime = parseDateTime(row?.datetime);
  if (!rowTime) return false;
  const diffMs = Math.abs(rowTime.getTime() - fp.timestampMs);
  return diffMs <= 5 * 60 * 1000;
}

function clearLogHighlightTarget() {
  teleapoHighlightLogId = null;
  teleapoHighlightFingerprint = null;
}

function ensureLogHighlightStyles() {
  if (document.getElementById('teleapo-log-highlight-style')) return;
  const style = document.createElement('style');
  style.id = 'teleapo-log-highlight-style';
  style.textContent = `
    @keyframes teleapo-log-highlight {
      0% { background-color: #fef3c7; }
      70% { background-color: #fff7ed; }
      100% { background-color: transparent; }
    }
    .teleapo-log-highlight td {
      animation: teleapo-log-highlight 2.4s ease-out;
    }
  `;
  document.head.appendChild(style);
}

function mapApiLog(log = {}) {
  const id = log.id ?? log.log_id ?? log.logId ?? log.logID;
  const rawDatetime = log.datetime || log.called_at || log.calledAt || log.call_at;
  const employee = log.employee || log.caller_name || log.caller || log.user_name || '';
  const datetime = toDateTimeString(rawDatetime) || (rawDatetime ? String(rawDatetime) : '');

  const candidateIdRaw = log.candidate_id ?? log.candidateId ?? log.candidateID;
  const candidateId = candidateIdRaw === undefined || candidateIdRaw === null || candidateIdRaw === ''
    ? undefined
    : Number(candidateIdRaw);

  // ★ 追加：callerUserId（RDSの teleapo_logs.caller_user_id）
  const callerUserIdRaw = log.caller_user_id ?? log.callerUserId;
  const callerUserIdNum = callerUserIdRaw === undefined || callerUserIdRaw === null || callerUserIdRaw === ''
    ? undefined
    : Number(callerUserIdRaw);

  const target = log.target || log.candidate_name || log.candidateName || log.company_name || '';

  const tel = log.candidate_phone || log.candidatePhone || log.phone || log.tel || '';
  const email = log.candidate_email || log.candidateEmail || log.email || '';
  const contactPreferredTime = normalizeContactPreferredTime(
    log.contactPreferredTime ??
    log.contact_preferred_time ??
    log.contactTime ??
    log.contact_time
  );

  const rawResult = log.result || log.result_code || log.status || log.outcome || '';
  const resultCode = normalizeResultCode(log.resultCode || rawResult);
  const memo = log.memo || log.note || '';
  const route = normalizeRoute(log.route || log.route_type || log.channel || '');

  const callNo = Number(log.call_no || log.callNo || log.call_number || log.callNoNumber);

  return normalizeLog({
    id: id != null && id !== '' ? String(id) : undefined,
    datetime,
    employee,
    route,
    target,
    tel,
    email,
    contactPreferredTime,
    resultRaw: rawResult,
    resultCode,
    memo,
    candidateId: Number.isFinite(candidateId) && candidateId > 0 ? candidateId : undefined,
    callerUserId: Number.isFinite(callerUserIdNum) && callerUserIdNum > 0 ? callerUserIdNum : undefined, // ★追加
    callAttempt: Number.isFinite(callNo) && callNo > 0 ? callNo : undefined
  });
}


function getCallKey(log) {
  if (log.candidateId) return log.candidateId;
  const targetKey = normalizeNameKey(log.target || '');
  return targetKey || log.tel || log.email || '不明';
}



function annotateCallAttempts(logs) {
  const telLogs = logs.filter(l => l.route === ROUTE_TEL);
  const sorted = [...telLogs].sort((a, b) => (parseDateTime(a.datetime)?.getTime() || 0) - (parseDateTime(b.datetime)?.getTime() || 0));
  const counters = new Map();
  sorted.forEach(log => {
    const key = getCallKey(log);
    const next = (counters.get(key) || 0) + 1;
    counters.set(key, next);
    log.callAttempt = next;
  });
  logs.filter(l => l.route !== ROUTE_TEL).forEach(log => {
    if ('callAttempt' in log) delete log.callAttempt;
  });
  rebuildTeleapoSummaryCache(logs);
}

function rebuildTeleapoSummaryCache(logs) {
  teleapoSummaryByCandidateId = new Map();
  teleapoSummaryByName = new Map();
  if (!Array.isArray(logs) || !logs.length) return;

  const updateSummary = (map, key, log, flags, ts) => {
    if (!key && key !== 0) return;
    const current = map.get(key) || { callCount: 0, hasConnected: false, hasSms: false, lastConnectedAt: null, lastConnectedTs: -Infinity };
    if (log.route === ROUTE_TEL) current.callCount += 1;
    if (flags.code === "sms_sent") current.hasSms = true;
    if (flags.isConnect) {
      current.hasConnected = true;
      if (ts >= current.lastConnectedTs) {
        current.lastConnectedTs = ts;
        current.lastConnectedAt = log.datetime;
      }
    }
    map.set(key, current);
  };

  logs.forEach(log => {
    const flags = classifyTeleapoResult(log);
    const ts = parseDateTime(log.datetime)?.getTime() || 0;
    const idNum = Number(log.candidateId);
    if (Number.isFinite(idNum) && idNum > 0) {
      updateSummary(teleapoSummaryByCandidateId, idNum, log, flags, ts);
    }
    const targetKey = normalizeNameKey(log.target || "");
    if (targetKey) {
      updateSummary(teleapoSummaryByName, targetKey, log, flags, ts);
    }
  });
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setLogStatus(message, type = 'info') {
  const el = document.getElementById('teleapoLogStatus');
  if (!el) return;
  const baseClass = 'text-[11px]';
  const colorClass = type === 'success'
    ? 'text-emerald-600'
    : type === 'error'
      ? 'text-rose-600'
      : 'text-slate-500';
  el.className = `${baseClass} ${colorClass}`;
  el.textContent = message || '';
  if (message) {
    const current = message;
    window.setTimeout(() => {
      if (el.textContent === current) {
        el.textContent = '';
        el.className = `${baseClass} text-slate-500`;
      }
    }, 3000);
  }
}

function formatRate(rate) {
  if (rate == null || Number.isNaN(rate)) return '-';
  return `${rate.toFixed(1)}%`;
}

function formatRangeLabel(startStr, endStr) {
  // アクティブなプリセットがある場合はそのラベルを表示
  if (teleapoActivePreset) {
    const presetLabels = {
      today: '今日',
      thisWeek: '今週',
      thisMonth: '今月'
    };
    if (presetLabels[teleapoActivePreset]) {
      return presetLabels[teleapoActivePreset];
    }
  }
  if (!startStr && !endStr) return '全期間';
  if (startStr && endStr) return `${startStr.replace(/-/g, '/')} ～ ${endStr.replace(/-/g, '/')}`;
  if (startStr) return `${startStr.replace(/-/g, '/')} ～`;
  return `～ ${endStr.replace(/-/g, '/')}`;
}


function addDaysToDateString(dateStr, days) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${zeroPad(dt.getMonth() + 1)}-${zeroPad(dt.getDate())}`;
}
function rateClass(rate, targetKey) {
  if (!targetKey || !teleapoRateTargets[targetKey]) return 'text-slate-900';
  const targetRate = Number(teleapoRateTargets[targetKey]);
  if (!Number.isFinite(targetRate) || targetRate <= 0) return 'text-slate-900';
  const percentage = (rate / targetRate) * 100;
  if (percentage >= 100) return 'text-green-700';
  if (percentage >= 80) return 'text-amber-600';
  return 'text-red-600';
}

function getShowDenominator(sets, contacts) {
  return teleapoRateMode === TELEAPO_RATE_MODE_STEP ? sets : contacts;
}

function calcShowRate(shows, sets, contacts, nullIfZero = false) {
  const denom = getShowDenominator(sets, contacts);
  if (!denom) return nullIfZero ? null : 0;
  return (shows / denom) * 100;
}

function buildSummaryKpiDesc() {
  const denomLabel = teleapoRateMode === TELEAPO_RATE_MODE_STEP ? '設定数' : '接触数';
  return `設定率=設定数/接触数・着座率=着座数/${denomLabel}`;
}

function buildEmployeeKpiDesc() {
  const denomLabel = teleapoRateMode === TELEAPO_RATE_MODE_STEP ? '設定数' : '通電数';
  return `通電率=通電数/架電数・設定率=設定数/通電数・着座率=着座数/${denomLabel}`;
}

function updateRateModeUI() {
  const toggle = document.getElementById('teleapoRateModeToggle');
  if (toggle) {
    toggle.querySelectorAll('[data-rate-mode]').forEach(btn => {
      const mode = btn.dataset.rateMode;
      const isActive = mode === teleapoRateMode;
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      setTeleapoButtonActive(btn, isActive);
      btn.classList.toggle('bg-indigo-600', isActive);
      btn.classList.toggle('text-white', isActive);
      btn.classList.toggle('shadow-sm', isActive);
      btn.classList.toggle('text-slate-600', !isActive);
    });
  }
  const desc = document.getElementById('teleapoKpiCalcDesc');
  if (desc) desc.textContent = buildSummaryKpiDesc();
  const empDesc = document.getElementById('teleapoEmployeeCalcDesc');
  if (empDesc) empDesc.textContent = buildEmployeeKpiDesc();
}

function initRateModeToggle() {
  const toggle = document.getElementById('teleapoRateModeToggle');
  if (!toggle) return;
  toggle.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-rate-mode]');
    if (!btn) return;
    const nextMode = btn.dataset.rateMode === TELEAPO_RATE_MODE_STEP
      ? TELEAPO_RATE_MODE_STEP
      : TELEAPO_RATE_MODE_CONTACT;
    if (nextMode === teleapoRateMode) return;
    teleapoRateMode = nextMode;
    updateRateModeUI();
    applyFilters();
  });
  updateRateModeUI();
}

function computeKpi(logs) {
  const tel = { attempts: 0, contacts: 0, contactsPlusSets: 0, sets: 0, shows: 0 };
  const other = { attempts: 0, contacts: 0, contactsPlusSets: 0, sets: 0, shows: 0 };

  logs.forEach(log => {
    const bucket = log.route === ROUTE_OTHER ? other : tel;
    const flags = classifyTeleapoResult(log);
    bucket.attempts += 1;
    if (flags.isConnect) bucket.contacts += 1;
    if (flags.isConnectPlusSet) bucket.contactsPlusSets += 1;
    if (flags.isSet) bucket.sets += 1;
    if (flags.isShow) bucket.shows += 1;
  });

  const total = {
    attempts: tel.attempts + other.attempts,
    contacts: tel.contacts + other.contacts,
    contactsPlusSets: tel.contactsPlusSets + other.contactsPlusSets,
    sets: tel.sets + other.sets,
    shows: tel.shows + other.shows
  };

  return { tel, other, total };
}

function computeRates(counts) {
  const contactRate = counts.attempts > 0 ? ((counts.contactsPlusSets ?? counts.contacts) / counts.attempts) * 100 : null;
  const setRate = counts.contacts > 0 ? (counts.sets / counts.contacts) * 100 : null;
  const showRate = calcShowRate(counts.shows, counts.sets, counts.contacts, true);
  return { contactRate, setRate, showRate };
}

function renderSummary(logs, titleText, scopeLabelText) {
  const kpi = computeKpi(logs);
  const telRates = computeRates(kpi.tel);
  const otherRates = computeRates(kpi.other);
  const totalRates = computeRates(kpi.total);

  setText('teleapoSummaryTitle', titleText || '全体KPI');
  setText('teleapoSummaryScopeLabel', scopeLabelText || '全体');
  updateRateModeUI();

  setTextWithRateColor('teleapoKpiContactRateTel', telRates.contactRate, 'teleapoConnectionRate');
  setTextWithRateColor('teleapoKpiContactRateOther', otherRates.contactRate, 'teleapoConnectionRate');
  setTextWithRateColor('teleapoKpiContactRateTotal', totalRates.contactRate, 'teleapoConnectionRate');

  setTextWithRateColor('teleapoKpiSetRateTel', telRates.setRate, 'teleapoSetupRate');
  setTextWithRateColor('teleapoKpiSetRateOther', otherRates.setRate, 'teleapoSetupRate');
  setTextWithRateColor('teleapoKpiSetRateTotal', totalRates.setRate, 'teleapoSetupRate');

  const showRateTargetKey = teleapoRateMode === TELEAPO_RATE_MODE_STEP
    ? 'teleapoAttendanceRate'
    : 'teleapoAttendanceRateContact';

  setTextWithRateColor('teleapoKpiShowRateTel', telRates.showRate, showRateTargetKey);
  setTextWithRateColor('teleapoKpiShowRateOther', otherRates.showRate, showRateTargetKey);
  setTextWithRateColor('teleapoKpiShowRateTotal', totalRates.showRate, showRateTargetKey);

  setText('teleapoKpiDialsTel', kpi.tel.attempts.toLocaleString());
  setText('teleapoKpiContactsTel', kpi.tel.contacts.toLocaleString());
  setText('teleapoKpiContactsOther', kpi.other.contacts.toLocaleString());
  setText('teleapoKpiContactsTotal', kpi.total.contacts.toLocaleString());
  setText('teleapoKpiSetsTel', kpi.tel.sets.toLocaleString());
  setText('teleapoKpiSetsOther', kpi.other.sets.toLocaleString());
  setText('teleapoKpiSetsTotal', kpi.total.sets.toLocaleString());
  setText('teleapoKpiShowsTel', kpi.tel.shows.toLocaleString());
  setText('teleapoKpiShowsOther', kpi.other.shows.toLocaleString());
  setText('teleapoKpiShowsTotal', kpi.total.shows.toLocaleString());
}

function setTextWithRateColor(id, rate, targetKey) {
  const el = document.getElementById(id);
  if (!el) return;
  const text = formatRate(rate);
  el.textContent = text;
  el.classList.remove('text-green-700', 'text-amber-600', 'text-red-600', 'text-slate-900', 'text-slate-800');
  if (rate == null || Number.isNaN(rate)) {
    el.classList.add('text-slate-900');
    return;
  }
  const targetRate = Number(teleapoRateTargets[targetKey]);
  if (!Number.isFinite(targetRate) || targetRate <= 0) {
    el.classList.add('text-slate-900');
    return;
  }
  const percentage = (rate / targetRate) * 100;
  if (percentage >= 100) el.classList.add('text-green-700');
  else if (percentage >= 80) el.classList.add('text-amber-600');
  else el.classList.add('text-red-600');
}

function computeEmployeeMetrics(logs) {
  const telLogs = logs.filter(l => l.route === ROUTE_TEL);
  const map = new Map();
  telLogs.forEach(log => {
    const name = log.employee || '未設定';
    const flags = classifyTeleapoResult(log);
    if (!map.has(name)) map.set(name, { dials: 0, connects: 0, sets: 0, shows: 0 });
    const rec = map.get(name);
    rec.dials += 1;
    if (flags.isConnect) rec.connects += 1;
    if (flags.isSet) rec.sets += 1;
    if (flags.isShow) rec.shows += 1;
  });

  return Array.from(map.entries()).map(([name, rec]) => {
    const connectRate = rec.dials > 0 ? (rec.connects / rec.dials) * 100 : 0;
    const setRate = rec.connects > 0 ? (rec.sets / rec.connects) * 100 : 0;
    const showRate = calcShowRate(rec.shows, rec.sets, rec.connects);
    return { name, ...rec, connectRate, setRate, showRate };
  });
}

function renderEmployeeTable(metrics) {
  const tbody = document.getElementById('teleapoEmployeeTableBody');
  if (!tbody) return;

  const sortedMetrics = sortEmployeeMetrics(metrics, `${teleapoEmployeeSortState.key}-${teleapoEmployeeSortState.dir}`);

  tbody.innerHTML = sortedMetrics.map(emp => {
    const connectClass = rateClass(emp.connectRate, 'teleapoConnectionRate');
    const setClass = rateClass(emp.setRate, 'teleapoSetupRate');
    const showClass = rateClass(emp.showRate, 'teleapoAttendanceRate');
    return `
      <tr class="teleapo-employee-row hover:bg-slate-50 cursor-pointer" data-employee-name="${emp.name}">
        <td class="font-medium text-slate-800">${emp.name}</td>
        <td class="text-right">${emp.dials}</td>
        <td class="text-right">${emp.connects}</td>
        <td class="text-right">${emp.sets}</td>
        <td class="text-right">${emp.shows}</td>
        <td class="text-right font-semibold ${connectClass}">${emp.connectRate.toFixed(1)}%</td>
        <td class="text-right font-semibold ${setClass}">${emp.setRate.toFixed(1)}%</td>
        <td class="text-right font-semibold ${showClass}">${emp.showRate.toFixed(1)}%</td>
      </tr>
    `;
  }).join('');

  updateEmployeeSortIndicators();
  attachEmployeeRowHandlers();
}

function attachEmployeeRowHandlers() {
  const rows = document.querySelectorAll('.teleapo-employee-row');
  rows.forEach(row => {
    const name = row.dataset.employeeName;
    row.onclick = () => {
      const isCurrent = teleapoSummaryScope.type === "employee" && teleapoSummaryScope.name === name;
      teleapoSummaryScope = isCurrent ? { type: "company", name: "全体" } : { type: "employee", name };
      applyFilters();
    };
  });
  const resetBtn = document.getElementById('teleapoSummaryResetBtn');
  if (resetBtn) resetBtn.onclick = () => {
    teleapoSummaryScope = { type: "company", name: "全体" };
    clearDateFilters();
    applyFilters();
  };
}
function sortEmployeeMetrics(metrics, sortValue) {
  const [key, dir] = sortValue.split('-');
  const factor = dir === 'asc' ? 1 : -1;
  const data = [...metrics];
  data.sort((a, b) => {
    if (key === 'name') return factor * a.name.localeCompare(b.name, 'ja');
    return factor * ((a[key] || 0) - (b[key] || 0));
  });
  return data;
}

function initEmployeeSortHeaders() {
  const headers = document.querySelectorAll('#teleapoEmployeeTableWrapper th[data-sort]');
  headers.forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (!key) return;
      if (teleapoEmployeeSortState.key === key) {
        teleapoEmployeeSortState.dir = teleapoEmployeeSortState.dir === 'asc' ? 'desc' : 'asc';
      } else {
        teleapoEmployeeSortState = { key, dir: 'asc' };
      }
      renderEmployeeTable(teleapoEmployeeMetrics);
    });
  });
  updateEmployeeSortIndicators();
}

function updateEmployeeSortIndicators() {
  const headers = document.querySelectorAll('#teleapoEmployeeTableWrapper th[data-sort]');
  headers.forEach(th => {
    const isActive = teleapoEmployeeSortState.key === th.dataset.sort;
    const dir = isActive ? teleapoEmployeeSortState.dir : '';
    th.classList.toggle('is-sorted', isActive);
    if (dir) {
      th.dataset.sortDir = dir;
      th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : 'descending');
    } else {
      th.removeAttribute('data-sort-dir');
      th.setAttribute('aria-sort', 'none');
    }
  });
}

function initEmployeeTrendModeControls() {
  const container = document.getElementById('teleapoEmployeeTrendMode');
  if (!container) return;

  container.addEventListener('click', (event) => {
    const button = event.target.closest('[data-employee-trend-mode]');
    if (!button) return;
    const mode = button.dataset.employeeTrendMode;
    if (!mode || mode === teleapoEmployeeTrendMode) return;
    setEmployeeTrendMode(mode);
  });

  updateEmployeeTrendModeButtons();
}

function setEmployeeTrendMode(mode) {
  teleapoEmployeeTrendMode = mode;
  updateEmployeeTrendModeButtons();
  if (teleapoSummaryScope.type === 'employee') {
    renderEmployeeTrendChart(teleapoSummaryScope.name, teleapoFilteredLogs);
  }
}

function updateEmployeeTrendModeButtons() {
  document.querySelectorAll('[data-employee-trend-mode]').forEach((btn) => {
    const isActive = btn.dataset.employeeTrendMode === teleapoEmployeeTrendMode;
    setTeleapoButtonActive(btn, isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}


// 上書き版: フィルタ済みログの範囲を使い、最大日時を基準にウィンドウを切る
function renderHeatmap(logs) {
  const tbody = document.getElementById('teleapoHeatmapTableBody');
  if (!tbody) return;

  const buckets = {};
  TELEAPO_HEATMAP_DAYS.forEach(day => {
    buckets[day] = {};
    TELEAPO_HEATMAP_SLOTS.forEach(slot => { buckets[day][slot] = { dials: 0, connects: 0 }; });
  });

  logs.filter(l => l.route === ROUTE_TEL).forEach(log => {
    const dt = parseDateTime(log.datetime);
    if (!dt) return;
    const day = '日月火水木金土'[dt.getDay()];
    if (!buckets[day]) return;
    const hour = dt.getHours();
    const slot = hour < 11 ? '09-11' : hour < 13 ? '11-13' : hour < 15 ? '13-15' : hour < 17 ? '15-17' : hour < 19 ? '17-19' : null;
    if (!slot) return;
    const flags = classifyTeleapoResult(log);
    const cell = buckets[day][slot];
    cell.dials += 1;
    if (flags.isConnect) cell.connects += 1;
  });

  tbody.innerHTML = TELEAPO_HEATMAP_SLOTS.map(slot => {
    const cells = TELEAPO_HEATMAP_DAYS.map(day => {
      const c = buckets[day][slot];
      const rate = c.dials ? (c.connects / c.dials) * 100 : null;
      const intensity = rate == null ? 'bg-white' : rate >= 70 ? 'bg-green-100' : rate >= 40 ? 'bg-amber-50' : 'bg-rose-50';
      const rateText = rate == null ? '-' : `${rate.toFixed(0)}%`;
      const countText = rate == null ? '' : `(${c.dials}-${c.connects})`;
      return `
        <td class="px-2 py-2 border border-slate-200 text-center ${intensity}">
          <div class="teleapo-heatmap-cell">
            <span class="teleapo-heatmap-rate">${rateText}</span>
            <span class="teleapo-heatmap-count">${countText}</span>
          </div>
        </td>
      `;
    }).join('');
    return `<tr><th class="px-3 py-2 border border-slate-200 text-left bg-slate-50">${slot}帯</th>${cells}</tr>`;
  }).join('');
}

function buildHeatmapInsight(logs, scopeLabel) {
  const telLogs = logs.filter(l => l.route === ROUTE_TEL);
  if (!telLogs.length) return null;

  const buckets = new Map();
  const allowedDays = new Set(TELEAPO_HEATMAP_DAYS);
  let totalDials = 0;
  let totalConnects = 0;
  const addBucket = (day, slot) => {
    const key = `${day}-${slot}`;
    if (!buckets.has(key)) buckets.set(key, { day, slot, dials: 0, connects: 0 });
    return buckets.get(key);
  };

  telLogs.forEach(log => {
    const dt = parseDateTime(log.datetime);
    if (!dt) return;
    const day = '日月火水木金土'[dt.getDay()];
    if (!allowedDays.has(day)) return;
    const hour = dt.getHours();
    const slot = hour < 11 ? '09-11' : hour < 13 ? '11-13' : hour < 15 ? '13-15' : hour < 17 ? '15-17' : hour < 19 ? '17-19' : null;
    if (!slot) return;
    const flags = classifyTeleapoResult(log);
    const bucket = addBucket(day, slot);
    bucket.dials += 1;
    totalDials += 1;
    if (flags.isConnect) {
      bucket.connects += 1;
      totalConnects += 1;
    }
  });

  const baselineRate = totalDials ? (totalConnects / totalDials) * 100 : 0;
  const minSamples = Math.max(5, Math.ceil(totalDials * 0.05));
  const priorWeight = 6;

  const ranked = Array.from(buckets.values())
    .map(b => {
      const rate = b.dials ? (b.connects / b.dials) * 100 : null;
      const smoothed = b.dials
        ? ((b.connects + (baselineRate / 100) * priorWeight) / (b.dials + priorWeight)) * 100
        : null;
      const lift = rate == null ? null : rate - baselineRate;
      const smoothedLift = smoothed == null ? null : smoothed - baselineRate;
      const score = smoothedLift == null ? -Infinity : smoothedLift * Math.sqrt(b.dials);
      return { ...b, rate, smoothed, lift, score };
    })
    .filter(b => b.rate != null && b.dials >= minSamples)
    .sort((a, b) => (b.score - a.score) || (b.dials - a.dials));

  if (!ranked.length || totalDials < minSamples) {
    return { type: 'lowSample', scopeLabel, baselineRate, totalDials, minSamples };
  }

  const best = ranked[0];
  if (best.lift != null && best.lift >= 6) {
    return { type: 'lift', ...best, scopeLabel, baselineRate, totalDials, minSamples };
  }

  const byVolume = ranked.slice().sort((a, b) => b.dials - a.dials)[0];
  return { type: 'volume', ...byVolume, scopeLabel, baselineRate, totalDials, minSamples };
}

function buildAttemptInsight(logs) {
  const { buckets, average } = computeAttemptDistribution(logs);
  if (!buckets.length) return null;
  const totalDials = buckets.reduce((s, b) => s + (b.reached || 0), 0);
  const totalConnects = buckets.reduce((s, b) => s + (b.connected || 0), 0);
  const baselineRate = totalDials ? (totalConnects / totalDials) * 100 : 0;
  const minSamples = Math.max(5, Math.ceil(totalDials * 0.05));
  const priorWeight = 4;
  const ranked = buckets
    .map(b => {
      const smoothed = b.reached
        ? ((b.connected + (baselineRate / 100) * priorWeight) / (b.reached + priorWeight)) * 100
        : null;
      const lift = smoothed == null ? null : smoothed - baselineRate;
      const score = lift == null ? -Infinity : lift * Math.sqrt(b.reached);
      return { ...b, smoothed, lift, score };
    })
    .filter(b => b.rate != null && b.reached >= minSamples)
    .sort((a, b) => (b.score - a.score) || (b.reached - a.reached));
  if (!ranked.length) return null;
  const best = ranked[0];
  if (best.lift != null && best.lift >= 3) {
    return { ...best, average };
  }
  return { ...best, average, lowSignal: true };
}

function updateTeleapoInsight(logs, scope) {
  const el = document.getElementById('teleapoInsightText');
  if (!el) return;
  const telLogs = logs.filter(l => l.route === ROUTE_TEL);
  if (!telLogs.length) {
    el.textContent = 'データがまだ少なめです！ログを増やせば勝ちパターンが見えてきますよ！';
    return;
  }

  const scopeLabel = scope?.scopeLabel || '全体';
  const attempt = buildAttemptInsight(logs);
  const heatmap = buildHeatmapInsight(logs, scopeLabel);

  if (attempt && heatmap && heatmap.type === 'lift') {
    const lift = Math.round(heatmap.lift || 0);
    const rateText = Number.isFinite(heatmap.rate) ? `${heatmap.rate.toFixed(0)}%` : '-';
    const baseText = Number.isFinite(heatmap.baselineRate) ? `${heatmap.baselineRate.toFixed(0)}%` : '-';
    const dials = heatmap.dials || 0;
    const connects = heatmap.connects || 0;
    const sampleNote = heatmap.minSamples ? `（母数${heatmap.minSamples}件以上の中で）` : '';
    el.textContent = `通電は${attempt.attempt}回目が勝負！${heatmap.scopeLabel}の${heatmap.day}${heatmap.slot}帯は通電率${rateText}（${connects}/${dials}件）で平均${baseText}より${lift}ポイント高い${sampleNote}ため、ここを集中攻略しましょう！`;
    return;
  }
  if (attempt && heatmap && heatmap.type === 'volume') {
    el.textContent = `通電は${attempt.attempt}回目が勝負！${heatmap.scopeLabel}の${heatmap.day}${heatmap.slot}帯が母数最多（${heatmap.dials}件）なので、ここを底上げすると伸びます！`;
    return;
  }
  if (attempt && heatmap && heatmap.type === 'lowSample') {
    el.textContent = `通電は${attempt.attempt}回目が勝負！ヒートマップは母数が少なめなので、まず件数を積み上げましょう！`;
    return;
  }
  if (attempt) {
    const baseText = `${attempt.attempt}回目の通電率が${attempt.rate.toFixed(0)}%！`;
    el.textContent = attempt.lowSignal
      ? `${baseText} ただし差は小さめなので、まずは母数を増やして精度を上げましょう！`
      : `${baseText} 粘りが結果につながっています、あと一押し行きましょう！`;
    return;
  }
  if (heatmap && heatmap.type === 'lift') {
    const lift = Math.round(heatmap.lift || 0);
    const rateText = Number.isFinite(heatmap.rate) ? `${heatmap.rate.toFixed(0)}%` : '-';
    const baseText = Number.isFinite(heatmap.baselineRate) ? `${heatmap.baselineRate.toFixed(0)}%` : '-';
    const dials = heatmap.dials || 0;
    const connects = heatmap.connects || 0;
    const sampleNote = heatmap.minSamples ? `（母数${heatmap.minSamples}件以上の中で）` : '';
    el.textContent = `${heatmap.scopeLabel}の${heatmap.day}${heatmap.slot}帯は通電率${rateText}（${connects}/${dials}件）で平均${baseText}より${lift}ポイント高く好調${sampleNote}！この時間帯を攻めて伸ばしましょう！`;
    return;
  }
  if (heatmap && heatmap.type === 'volume') {
    el.textContent = `${heatmap.scopeLabel}の${heatmap.day}${heatmap.slot}帯が母数最多（${heatmap.dials}件）！ここを磨けば全体が伸びます！`;
    return;
  }
  if (heatmap && heatmap.type === 'lowSample') {
    el.textContent = 'ヒートマップは母数が少なめです！まずは件数を増やして勝ち時間帯を見つけましょう！';
    return;
  }

  el.textContent = '傾向がまだ出ていません！まずは母数を増やして、勝ち筋を掴みましょう！';
}

function getAnalysisScope(logs) {
  const employeeFilter = document.getElementById('teleapoAnalysisEmployeeFilter')?.value || 'all';
  const scopeLabel = employeeFilter === 'all' ? '全体' : `${employeeFilter}さん`;
  let scopedLogs = employeeFilter === 'all' ? logs : logs.filter(l => l.employee === employeeFilter);

  const dates = scopedLogs.map(l => parseDateTime(l.datetime)).filter(Boolean).sort((a, b) => a - b);
  if (!dates.length) {
    return { logs: [], from: null, to: null, label: '', scopeLabel };
  }
  const maxDate = dates[dates.length - 1];
  const minDate = dates[0];
  const from = new Date(maxDate);
  if (teleapoAnalysisRange === '1w') from.setDate(maxDate.getDate() - 7);
  else if (teleapoAnalysisRange === '1m') from.setDate(maxDate.getDate() - 30);
  else if (teleapoAnalysisRange === '6m') from.setDate(maxDate.getDate() - 182);
  else from.setTime(minDate.getTime());
  if (from < minDate) from.setTime(minDate.getTime());

  scopedLogs = scopedLogs.filter(log => {
    const dt = parseDateTime(log.datetime);
    return dt && dt >= from && dt <= maxDate;
  });

  const fromStr = from.toISOString().slice(0, 10).replace(/-/g, '/');
  const toStr = maxDate.toISOString().slice(0, 10).replace(/-/g, '/');
  return { logs: scopedLogs, from, to: maxDate, label: `${fromStr} ～ ${toStr}`, scopeLabel };
}

function renderLogTable() {
  const tbody = document.getElementById('teleapoLogTableBody');
  if (!tbody) return;

  const sorted = [...teleapoFilteredLogs].sort((a, b) => {
    if (teleapoLogSort.key === 'datetime') {
      const ad = parseDateTime(a.datetime) || 0;
      const bd = parseDateTime(b.datetime) || 0;
      return teleapoLogSort.dir === 'asc' ? ad - bd : bd - ad;
    }
    const valA = a[teleapoLogSort.key] || '';
    const valB = b[teleapoLogSort.key] || '';
    return teleapoLogSort.dir === 'asc'
      ? `${valA}`.localeCompare(`${valB}`)
      : `${valB}`.localeCompare(`${valA}`);
  });

  tbody.innerHTML = sorted.map(row => {
    const flags = classifyTeleapoResult(row);
    const badgeClass =
      flags.code === 'show' ? 'bg-green-100 text-green-700'
        : flags.code === 'set' ? 'bg-emerald-100 text-emerald-700'
          : flags.code === 'connect' ? 'bg-blue-100 text-blue-700'
            : flags.code === 'callback' ? 'bg-amber-100 text-amber-700'
              : 'bg-slate-100 text-slate-700';

    const attemptLabel = row.callAttempt ? `（${row.callAttempt}回目）` : '';
    const routeLabel = row.route === ROUTE_OTHER ? 'その他' : `架電${attemptLabel}`;

    // ★ 相手（候補者名）をクリックで候補者詳細へ
    const targetLabel = row.target || '';
    const targetText = escapeHtml(targetLabel);
    const resolvedCandidateId = resolveCandidateIdFromLog(row);
    if (resolvedCandidateId && !row.candidateId) {
      row.candidateId = resolvedCandidateId;
    }
    const targetCandidateId = resolvedCandidateId || row.candidateId;
    const targetCell = targetLabel
      ? `<button type="button"
           class="text-indigo-600 hover:text-indigo-800 underline bg-transparent border-0 p-0"
           data-action="open-candidate"
           data-candidate-id="${escapeHtml(targetCandidateId || '')}"
           data-candidate-name="${escapeHtml(targetLabel)}">${targetText}</button>`
      : targetText;

    // ★ 電話・メールは mapApiLog で candidates 由来が tel/email に入るので表示できる
    const telText = escapeHtml(row.tel || '');
    const contactTimeValue =
      normalizeContactPreferredTime(row.contactPreferredTime ?? row.contact_preferred_time ?? row.contactTime ?? row.contact_time) ||
      resolveCandidateContactPreferredTime(targetCandidateId || row.candidateId, targetLabel);
    const contactTimeTextValue = String(contactTimeValue ?? "").trim();
    if (!contactTimeTextValue) enqueueContactTimeFetch(targetCandidateId || row.candidateId);
    const contactTimeText = escapeHtml(contactTimeTextValue || "-");
    const emailText = escapeHtml(row.email || '');
    const memoText = escapeHtml(row.memo || '');
    const isHighlight = shouldHighlightLog(row);
    const rowClass = isHighlight ? 'teleapo-log-highlight' : '';
    const rowIdAttr = row.id ? `data-log-id="${escapeHtml(String(row.id))}"` : '';

    const deleteCell = row.id
      ? `<button type="button" class="px-2 py-1 rounded text-xs border border-rose-200 text-rose-600 hover:bg-rose-50"
           data-action="delete-log" data-log-id="${escapeHtml(String(row.id))}">削除</button>`
      : `<span class="text-xs text-slate-400">-</span>`;

    return `
      <tr class="${rowClass}" ${rowIdAttr}>
        <td class="whitespace-nowrap">${escapeHtml(row.datetime)}</td>
        <td class="whitespace-nowrap">${escapeHtml(row.employee || '')}</td>
        <td>${escapeHtml(routeLabel)}</td>
        <td>${targetCell}</td>
        <td>${telText}</td>
        <td class="whitespace-nowrap">${contactTimeText}</td>
        <td>${emailText}</td>
        <td>
          ${flags.flowLabels
        ? `
            <div class="flex flex-wrap items-center gap-1">
              ${flags.flowLabels.map((label, index) => {
          const variantClass = label.startsWith('通電')
            ? 'bg-blue-100 text-blue-700'
            : label.startsWith('面談')
              ? 'bg-emerald-100 text-emerald-700'
              : label === '着座'
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-700';
          const arrow = index < flags.flowLabels.length - 1
            ? '<span class="text-slate-400 text-xs">→</span>'
            : '';
          return `<span class="px-2 py-0.5 rounded text-[10px] font-semibold ${variantClass}">${escapeHtml(label)}</span>${arrow}`;
        }).join('')}
            </div>
          `
        : `<span class="px-2 py-1 rounded text-xs font-semibold ${badgeClass}">
              ${escapeHtml(flags.displayLabel || RESULT_LABELS[flags.code] || row.result || '')}
            </span>`}
        </td>
        <td>${memoText}</td>
        <td class="text-center">${deleteCell}</td>
      </tr>
    `;
  }).join('');

  const highlightRow = tbody.querySelector('.teleapo-log-highlight');
  if (highlightRow) {
    window.setTimeout(() => highlightRow.classList.remove('teleapo-log-highlight'), 2400);
    clearLogHighlightTarget();
  }

  // 件数表示
  const countEl = document.getElementById('teleapoLogFilterCount');
  if (countEl) countEl.textContent = `${teleapoFilteredLogs.length}件`;
}

async function deleteTeleapoLog(logId) {
  const res = await fetch(TELEAPO_LOGS_URL, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: logId })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
}

function computeAttemptDistribution(logs) {
  // 試行番号の確定: call_no があれば優先し、無ければ対象ごとに時系列で採番
  const telLogs = [...logs].filter(l => l.route === ROUTE_TEL).sort((a, b) => (parseDateTime(a.datetime) - parseDateTime(b.datetime)));
  const counters = new Map();
  telLogs.forEach(log => {
    const key = getCallKey(log);
    const current = counters.get(key) || 0;
    const attempt = Number.isFinite(log.callAttempt) && log.callAttempt > 0 ? log.callAttempt : current + 1;
    counters.set(key, Math.max(current, attempt));
    log._attempt = attempt;
  });

  // 試行番号別に分母（dials）と分子（connect）を集計
  const bucketsMap = new Map();
  const addBucket = n => {
    if (!bucketsMap.has(n)) bucketsMap.set(n, { attempt: n, dials: 0, connects: 0, connectsPlusSets: 0, sets: 0 });
    return bucketsMap.get(n);
  };

  telLogs.forEach(log => {
    const attempt = log._attempt || 0;
    const bucket = addBucket(attempt);
    bucket.dials += 1;
    const flags = classifyTeleapoResult(log);
    if (flags.isConnect) bucket.connects += 1;
    if (flags.isConnectPlusSet) bucket.connectsPlusSets += 1;
    if (flags.isSet) bucket.sets += 1;
  });

  const buckets = Array.from(bucketsMap.values())
    .sort((a, b) => a.attempt - b.attempt)
    .map(b => ({
      attempt: b.attempt,
      reached: b.dials,
      connected: b.connectsPlusSets,
      rate: b.dials ? (b.connectsPlusSets / b.dials) * 100 : null
    }));

  // 平均通電回数（通電したログのみ）
  const connectAttempts = telLogs
    .filter(l => classifyTeleapoResult(l).isConnectPlusSet && Number.isFinite(l._attempt))
    .map(l => l._attempt);
  const average = connectAttempts.length
    ? connectAttempts.reduce((s, v) => s + v, 0) / connectAttempts.length
    : 0;

  return { buckets, average, sampleDials: telLogs.length, sampleConnects: connectAttempts.length };
}

function getDateRange(logs) {
  const dates = logs.map(l => parseDateTime(l.datetime)).filter(Boolean);
  if (!dates.length) return null;
  let min = dates[0];
  let max = dates[0];
  dates.forEach(d => {
    if (d < min) min = d;
    if (d > max) max = d;
  });
  return { min, max };
}

function getWeekOfMonth(dt) {
  const firstDay = new Date(dt.getFullYear(), dt.getMonth(), 1).getDay(); // 0(日)?6(土)
  return Math.floor((firstDay + dt.getDate() - 1) / 7) + 1;
}

function buildEmployeeTrendPoints(empLogs, modeOverride) {
  const range = getDateRange(empLogs);
  if (!range) return { mode: modeOverride || 'month', points: [] };

  const spanDays = (range.max - range.min) / (1000 * 60 * 60 * 24);
  let mode = modeOverride;
  if (!mode) {
    if (spanDays <= 1) mode = 'hour';
    else if (spanDays <= 7) mode = 'weekday';
    else if (spanDays <= 31) mode = 'week';
    else mode = 'month';
  }

  const buckets = new Map();
  const addBucket = (key, label, sortValue) => {
    if (!buckets.has(key)) buckets.set(key, { label, sortValue, dials: 0, connects: 0, sets: 0, shows: 0 });
    return buckets.get(key);
  };

  empLogs.forEach(log => {
    const dt = parseDateTime(log.datetime);
    if (!dt) return;
    const flags = classifyTeleapoResult(log);
    let key; let label; let sortValue;

    if (mode === 'hour') {
      const hour = dt.getHours();
      key = hour;
      label = `${String(hour).padStart(2, '0')}:00`;
      sortValue = hour;
    } else if (mode === 'weekday') {
      const dow = dt.getDay(); // 0=日
      const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'];
      key = dow;
      label = weekdayLabels[dow];
      sortValue = dow;
    } else if (mode === 'week') {
      const week = getWeekOfMonth(dt);
      key = `${dt.getFullYear()}-${dt.getMonth() + 1}-W${week}`;
      label = `${dt.getMonth() + 1}月${week}週`;
      sortValue = new Date(dt.getFullYear(), dt.getMonth(), (week - 1) * 7 + 1).getTime();
    } else if (mode === 'month') {
      const month = dt.getMonth() + 1;
      key = `${dt.getFullYear()}-${month}`;
      label = `${dt.getFullYear()}/${String(month).padStart(2, '0')}`;
      sortValue = new Date(dt.getFullYear(), dt.getMonth(), 1).getTime();
    } else {
      const year = dt.getFullYear();
      key = `${year}`;
      label = `${year}年`;
      sortValue = new Date(year, 0, 1).getTime();
    }

    const bucket = addBucket(key, label, sortValue);
    bucket.dials += 1;
    if (flags.isConnect) bucket.connects += 1;
    if (flags.isSet) bucket.sets += 1;
    if (flags.isShow) bucket.shows += 1;
  });

  const points = Array.from(buckets.values())
    .sort((a, b) => a.sortValue - b.sortValue)
    .map(b => {
      const connectRate = b.dials ? (b.connects / b.dials) * 100 : 0;
      const setRate = b.connects ? (b.sets / b.connects) * 100 : 0;
      const showRate = calcShowRate(b.shows, b.sets, b.connects);
      return { label: b.label, connectRate, setRate, showRate, dials: b.dials, connects: b.connects, sets: b.sets, shows: b.shows };
    });

  return { mode, points };
}

function getTrendModeLabel(mode) {
  if (mode === 'hour') return '時間帯';
  if (mode === 'weekday') return '曜日';
  if (mode === 'week') return '週';
  if (mode === 'year') return '年';
  return '月';
}

function renderEmployeeSummary(empName, empLogs, trend) {
  const summary = empLogs.reduce((acc, log) => {
    const flags = classifyTeleapoResult(log);
    acc.dials += 1;
    if (flags.isConnect) acc.connects += 1;
    if (flags.isSet) acc.sets += 1;
    if (flags.isShow) acc.shows += 1;
    return acc;
  }, { dials: 0, connects: 0, sets: 0, shows: 0 });

  const connectRate = summary.dials ? (summary.connects / summary.dials) * 100 : 0;
  const setRate = summary.connects ? (summary.sets / summary.connects) * 100 : 0;
  const showRate = calcShowRate(summary.shows, summary.sets, summary.connects);

  setText('teleapoEmployeeKpiDials', summary.dials.toLocaleString());
  setText('teleapoEmployeeKpiConnects', summary.connects.toLocaleString());
  setText('teleapoEmployeeKpiSets', summary.sets.toLocaleString());
  setText('teleapoEmployeeKpiShows', summary.shows.toLocaleString());
  setText('teleapoEmployeeRateConnect', formatRate(connectRate));
  setText('teleapoEmployeeRateSet', formatRate(setRate));
  setText('teleapoEmployeeRateShow', formatRate(showRate));

  renderEmployeeTrendTable(trend.points, trend.mode);
}

function renderEmployeeTrendTable(points, mode) {
  const body = document.getElementById('teleapoEmployeeTrendTableBody');
  if (!body) return;

  setText('teleapoEmployeeTrendModeLabel', getTrendModeLabel(mode));

  if (!points.length) {
    body.innerHTML = `
      <tr>
        <td colspan="5" class="teleapo-employee-table-empty">データがありません。</td>
      </tr>
    `;
    return;
  }

  body.innerHTML = points.map((p) => {
    const connectDetail = p.dials ? `${p.connects}/${p.dials}` : '-';
    const setDetail = p.connects ? `${p.sets}/${p.connects}` : '-';
    const showDenom = getShowDenominator(p.sets, p.connects);
    const showDetail = showDenom ? `${p.shows}/${showDenom}` : '-';
    return `
      <tr>
        <td>${escapeHtml(p.label)}</td>
        <td class="text-right">${p.dials}</td>
        <td class="text-right">
          <div class="teleapo-employee-table-rate ${rateClass(p.connectRate, 'teleapoConnectionRate')}">${formatRate(p.connectRate)}</div>
          <div class="teleapo-employee-table-detail">${connectDetail}</div>
        </td>
        <td class="text-right">
          <div class="teleapo-employee-table-rate ${rateClass(p.setRate, 'teleapoSetupRate')}">${formatRate(p.setRate)}</div>
          <div class="teleapo-employee-table-detail">${setDetail}</div>
        </td>
        <td class="text-right">
          <div class="teleapo-employee-table-rate ${rateClass(p.showRate, 'teleapoAttendanceRate')}">${formatRate(p.showRate)}</div>
          <div class="teleapo-employee-table-detail">${showDetail}</div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderAttemptChart(logs) {
  const wrapper = document.getElementById('teleapoAttemptChartWrapper');
  const svg = document.getElementById('teleapoAttemptChart');
  const note = document.getElementById('teleapoAttemptChartNote');
  if (!wrapper || !svg) return;

  const { buckets, average, sampleDials, sampleConnects } = computeAttemptDistribution(logs);
  if (!buckets.length) {
    wrapper.classList.add('hidden');
    return;
  }
  wrapper.classList.remove('hidden');
  if (note) note.textContent = `平均 ${average.toFixed(1)} 回目で通電（架電 ${sampleDials}件 / 通電 ${sampleConnects}件）`;

  const rect = svg.getBoundingClientRect();
  const maxWidth = 300;
  const width = Math.min(maxWidth, Math.round(rect.width || 0) || maxWidth);
  const height = 260;
  const padding = { top: 16, right: 20, bottom: 40, left: 56 };
  const count = Math.max(buckets.length, 1);
  const available = width - padding.left - padding.right;
  const fixedBarWidth = 36;
  let barWidth = fixedBarWidth;
  let gap = count > 1 ? (available - barWidth * count) / (count - 1) : 0;
  const minGap = 4;
  if (gap < minGap) {
    gap = minGap;
    const maxBarWidth = (available - gap * (count - 1)) / count;
    if (maxBarWidth < barWidth) {
      barWidth = Math.max(8, maxBarWidth);
    }
  }
  const maxRate = Math.max(...buckets.map(b => b.rate ?? 0), 100);
  const yTicks = [0, 20, 40, 60, 80, 100].filter(v => v <= maxRate);

  const bars = buckets.map((b, i) => {
    const rateVal = b.rate == null ? 0 : b.rate;
    const x = count === 1
      ? padding.left + (available - barWidth) / 2
      : padding.left + i * (barWidth + gap);
    const h = (rateVal / maxRate) * (height - padding.top - padding.bottom);
    const y = height - padding.bottom - h;
    const label = b.rate == null ? '-' : `${rateVal.toFixed(0)}%`;
    return `
      <rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="8" class="fill-indigo-400 opacity-90" />
      <text x="${x + barWidth / 2}" y="${height - padding.bottom + 12}" text-anchor="middle" class="text-[10px] fill-slate-700">${b.attempt}回目</text>
      <text x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle" class="text-[10px] fill-slate-800 font-semibold">${label}</text>
    `;
  }).join('');

  const yGrid = yTicks.map(t => {
    const y = height - padding.bottom - (t / maxRate) * (height - padding.top - padding.bottom);
    return `
      <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="rgb(226 232 240)" stroke-width="1" />
      <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" class="text-[10px] fill-slate-600">${t}%</text>
    `;
  }).join('');

  const yAxis = `
    <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="rgb(148 163 184)" stroke-width="1" />
    <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="rgb(148 163 184)" stroke-width="1" />
    ${yGrid}
  `;

  const yLabelX = padding.left - 32;
  const yLabelY = (height - padding.bottom + padding.top) / 2;
  const axisLabels = `
    <text x="${(padding.left + width - padding.right) / 2}" y="${height - 6}" text-anchor="middle" class="text-[10px] fill-slate-600">架電回数</text>
    <text x="${yLabelX}" y="${yLabelY}" text-anchor="middle" class="text-[10px] fill-slate-600" transform="rotate(-90 ${yLabelX} ${yLabelY})">通電率</text>
  `;

  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.innerHTML = `${yAxis}${bars}${axisLabels}`;
}

function renderEmployeeTrendChart(empName, logs) {
  const wrapper = document.getElementById('teleapoEmployeeChartWrapper');
  const svg = document.getElementById('teleapoEmployeeTrendChart');
  const titleEl = document.getElementById('teleapoEmployeeChartTitle');
  if (!wrapper || !svg || !titleEl) return;

  const empLogs = logs.filter(l => l.route === ROUTE_TEL && l.employee === empName);
  if (!empLogs.length) { wrapper.classList.add('hidden'); return; }

  titleEl.textContent = `${empName} さんのKPI推移（架電のみ）`;

  const trend = buildEmployeeTrendPoints(empLogs, teleapoEmployeeTrendMode);
  const { mode, points } = trend;
  if (!points.length) { wrapper.classList.add('hidden'); return; }
  renderEmployeeSummary(empName, empLogs, trend);

  const width = 880;
  const height = 340;
  const padding = { top: 28, right: 32, bottom: 62, left: 72 };
  const maxY = Math.max(...points.map(p => Math.max(p.connectRate, p.setRate, p.showRate)), 100);
  const yTicks = [0, 20, 40, 60, 80, 100].filter(v => v <= maxY + 5);
  const toX = (i) => padding.left + (i / Math.max(points.length - 1, 1)) * (width - padding.left - padding.right);
  const toY = (v) => height - padding.bottom - (v / Math.max(maxY, 1)) * (height - padding.top - padding.bottom);

  const buildSmoothPath = (values) => {
    const pts = values.map((v, i) => ({ x: toX(i), y: toY(v) }));
    if (!pts.length) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    const tension = 0.35;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6 * tension;
      const cp1y = p1.y + (p2.y - p0.y) / 6 * tension;
      const cp2x = p2.x - (p3.x - p1.x) / 6 * tension;
      const cp2y = p2.y - (p3.y - p1.y) / 6 * tension;
      d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
    }
    return d;
  };

  const line = (vals, color) => {
    const d = buildSmoothPath(vals);
    if (!d) return '';
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />`;
  };

  const connectPath = line(points.map(p => p.connectRate), '#2563eb');
  const setPath = line(points.map(p => p.setRate), '#f59e0b');
  const showPath = line(points.map(p => p.showRate), '#10b981');

  const grid = yTicks.map(t => {
    const y = toY(t);
    return `
      <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="rgb(226 232 240)" stroke-width="1" />
      <text x="${padding.left - 14}" y="${y + 4}" text-anchor="end" class="teleapo-chart-axis-tick">${t}%</text>
    `;
  }).join('');

  const yLabelX = padding.left - 38;
  const yLabelY = (height - padding.bottom + padding.top) / 2;
  const xAxisLabel = getTrendModeLabel(mode);
  const axisLabels = `
    <text x="${(padding.left + width - padding.right) / 2}" y="${height - 8}" text-anchor="middle" class="teleapo-chart-axis-label">${xAxisLabel}</text>
    <text x="${yLabelX}" y="${yLabelY}" text-anchor="middle" class="teleapo-chart-axis-label" transform="rotate(-90 ${yLabelX} ${yLabelY})">率（%）</text>
  `;

  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.innerHTML = `
    ${grid}
    <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="rgb(148 163 184)" stroke-width="1" />
    <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="rgb(148 163 184)" stroke-width="1" />
    ${connectPath}
    ${setPath}
    ${showPath}
    ${points.map((p, i) => {
    const tip = `${p.label}
架電: ${p.dials}件
通電率: ${p.connectRate.toFixed(1)}% (${p.connects}/${p.dials})
設定率: ${p.setRate.toFixed(1)}% (${p.sets}/${Math.max(p.connects, 1)})
着座率: ${p.showRate.toFixed(1)}% (${p.shows}/${Math.max(getShowDenominator(p.sets, p.connects), 1)})`;
    return `<circle cx="${toX(i)}" cy="${toY(p.connectRate)}" r="4" fill="#2563eb"><title>${tip}</title></circle>`;
  }).join('')}
    ${points.map((p, i) => {
    const tip = `${p.label}
架電: ${p.dials}件
通電率: ${p.connectRate.toFixed(1)}% (${p.connects}/${p.dials})
設定率: ${p.setRate.toFixed(1)}% (${p.sets}/${Math.max(p.connects, 1)})
着座率: ${p.showRate.toFixed(1)}% (${p.shows}/${Math.max(getShowDenominator(p.sets, p.connects), 1)})`;
    return `<circle cx="${toX(i)}" cy="${toY(p.setRate)}" r="4" fill="#f59e0b"><title>${tip}</title></circle>`;
  }).join('')}
    ${points.map((p, i) => {
    const tip = `${p.label}
架電: ${p.dials}件
通電率: ${p.connectRate.toFixed(1)}% (${p.connects}/${p.dials})
設定率: ${p.setRate.toFixed(1)}% (${p.sets}/${Math.max(p.connects, 1)})
着座率: ${p.showRate.toFixed(1)}% (${p.shows}/${Math.max(getShowDenominator(p.sets, p.connects), 1)})`;
    return `<circle cx="${toX(i)}" cy="${toY(p.showRate)}" r="4" fill="#10b981"><title>${tip}</title></circle>`;
  }).join('')}
    ${points.map((p, i) => `<text x="${toX(i)}" y="${height - padding.bottom + 18}" text-anchor="middle" class="teleapo-chart-axis-tick">${p.label}</text>`).join('')}
    ${axisLabels}
  `;

  const prevName = wrapper.dataset.employeeName || '';
  wrapper.dataset.employeeName = empName;
  const shouldHighlight = prevName !== empName;
  wrapper.classList.remove('hidden');
  if (shouldHighlight) {
    const chartCard = wrapper.querySelector('.teleapo-employee-chart-card');
    if (chartCard) {
      chartCard.classList.remove('is-highlight');
      void chartCard.offsetWidth;
      chartCard.classList.add('is-highlight');
    }
  }
}

function applyFilters() {
  const empFilter = document.getElementById('teleapoLogEmployeeFilter')?.value || '';
  const resultFilter = document.getElementById('teleapoLogResultFilter')?.value || '';
  const routeFilter = document.getElementById('teleapoLogRouteFilter')?.value || '';
  const targetSearch = (document.getElementById('teleapoLogTargetSearch')?.value || '').toLowerCase();
  const { startStr, endStr, start, end } = getSelectedRange();
  const rangeLabel = formatRangeLabel(startStr, endStr);

  teleapoFilteredLogs = teleapoLogData.filter(log => {
    const dt = parseDateTime(log.datetime);
    if (start && dt && dt < start) return false;
    if (end && dt && dt > end) return false;
    if (empFilter && log.employee !== empFilter) return false;
    if (resultFilter) {
      const flags = classifyTeleapoResult(log);
      if (resultFilter === '着座' && !flags.isShow) return false;
      if (resultFilter === '設定' && !flags.isSet) return false;
      if (resultFilter !== '着座' && resultFilter !== '設定') {
        const resultText = `${flags.displayLabel || ''}${log.result || ''}${log.resultCode || ''}`;
        if (!resultText.includes(resultFilter)) return false;
      }
    }
    if (routeFilter === 'tel' && log.route !== ROUTE_TEL) return false;
    if (routeFilter === 'other' && log.route !== ROUTE_OTHER) return false;
    if (targetSearch && !(`${log.target || ''}`.toLowerCase().includes(targetSearch))) return false;
    return true;
  });

  const scopeLogs = teleapoSummaryScope.type === 'employee'
    ? teleapoFilteredLogs.filter(l => l.employee === teleapoSummaryScope.name && l.route === ROUTE_TEL)
    : teleapoFilteredLogs;

  renderSummary(scopeLogs, teleapoSummaryScope.type === 'employee' ? `${teleapoSummaryScope.name}さんのKPI` : '全体KPI', rangeLabel ? `${teleapoSummaryScope.name} / ${rangeLabel}` : teleapoSummaryScope.name);

  teleapoEmployeeMetrics = computeEmployeeMetrics(teleapoFilteredLogs);
  renderEmployeeTable(teleapoEmployeeMetrics);

  if (teleapoSummaryScope.type === 'employee') {
    renderEmployeeTrendChart(teleapoSummaryScope.name, teleapoFilteredLogs);
  } else {
    const wrapper = document.getElementById('teleapoEmployeeChartWrapper');
    if (wrapper) wrapper.classList.add('hidden');
  }

  const analysisScope = getAnalysisScope(teleapoFilteredLogs);
  const analysisLogs = analysisScope.logs;

  renderHeatmap(analysisLogs);
  renderAttemptChart(analysisLogs);
  updateTeleapoInsight(analysisLogs, analysisScope);
  renderLogTable();

  // グラフ側の期間ラベルを更新（空なら全期間）
  setText('teleapoAnalysisPeriodLabel', analysisScope.label ? `集計期間: ${analysisScope.label}` : '集計期間: -');
  setText('teleapoLogPeriodLabel', rangeLabel || '全期間');
}

function getSelectedRange() {
  const startStr = document.getElementById('teleapoLogRangeStart')?.value
    || document.getElementById('teleapoCompanyRangeStart')?.value
    || '';
  const endStr = document.getElementById('teleapoLogRangeEnd')?.value
    || document.getElementById('teleapoCompanyRangeEnd')?.value
    || '';
  const start = startStr ? new Date(`${startStr}T00:00:00`) : null;
  const end = endStr ? new Date(`${endStr}T23:59:59`) : null;
  return { startStr, endStr, start, end };
}

function getLoadedDateRange(logs = teleapoLogData) {
  const dates = (Array.isArray(logs) ? logs : [])
    .map(log => parseDateTime(log.datetime))
    .filter(Boolean)
    .sort((a, b) => a - b);
  if (!dates.length) return null;
  return { min: dates[0], max: dates[dates.length - 1] };
}

function isRangeWithinLoaded(selected, loaded) {
  if (!loaded) return false;
  if (selected.start && selected.start < loaded.min) return false;
  if (selected.end && selected.end > loaded.max) return false;
  return true;
}

function refreshForRangeChange() {
  const selected = getSelectedRange();
  const loaded = getLoadedDateRange();
  if (!loaded || !isRangeWithinLoaded(selected, loaded)) {
    loadTeleapoData();
    return;
  }
  applyFilters();
}

function setRangePreset(preset) {
  const today = new Date();
  let start = new Date(today);
  let end = new Date(today);

  if (preset === 'today') {
    // start/end already today
  } else if (preset === 'thisWeek') {
    // 月曜起算: getDay()は日曜=0, 月曜=1, ..., 土曜=6
    const day = today.getDay();
    const daysToMonday = day === 0 ? 6 : day - 1;
    start.setDate(today.getDate() - daysToMonday);
  } else if (preset === 'thisMonth') {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (preset === 'last30') {
    start.setDate(today.getDate() - 30);
  } else if (preset === 'last180') {
    start.setDate(today.getDate() - 180);
  } else {
    start.setDate(today.getDate() - 30);
  }

  const toLocalDate = (value) => {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const startStr = toLocalDate(start);
  const endStr = toLocalDate(end);

  ['teleapoLogRangeStart', 'teleapoCompanyRangeStart'].forEach(id => { const el = document.getElementById(id); if (el) el.value = startStr; });
  ['teleapoLogRangeEnd', 'teleapoCompanyRangeEnd'].forEach(id => { const el = document.getElementById(id); if (el) el.value = endStr; });
}

function clearDateFilters() {
  ['teleapoLogRangeStart', 'teleapoCompanyRangeStart', 'teleapoLogRangeEnd', 'teleapoCompanyRangeEnd']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  clearCompanyRangePresetSelection();
}

function getCompanyPresetButtons() {
  const scoped = document.querySelector('[data-scope="company"]');
  if (scoped) return Array.from(scoped.querySelectorAll('[data-preset]'));
  return Array.from(document.querySelectorAll('#teleapoPerformancePanel [data-preset]'));
}

function isTeleapoButtonActive(button) {
  return button.classList.contains('active')
    || button.classList.contains('is-active')
    || button.classList.contains('kpi-v2-range-btn-active');
}

function setTeleapoButtonActive(button, isActive) {
  if (!button) return;
  if (isActive) {
    if (button.classList.contains('kpi-v2-range-btn')) button.classList.add('kpi-v2-range-btn-active');
    button.classList.add('active', 'is-active');
    button.setAttribute('aria-pressed', 'true');
    button.style.setProperty('background-color', '#0077c7', 'important');
    button.style.setProperty('color', '#ffffff', 'important');
    button.style.setProperty('font-weight', '600', 'important');
    button.style.setProperty('box-shadow', '0 2px 8px rgba(0, 119, 199, 0.4)', 'important');
  } else {
    if (button.classList.contains('kpi-v2-range-btn')) button.classList.remove('kpi-v2-range-btn-active');
    button.classList.remove('active', 'is-active');
    button.setAttribute('aria-pressed', 'false');
    button.style.removeProperty('background-color');
    button.style.removeProperty('color');
    button.style.removeProperty('font-weight');
    button.style.removeProperty('box-shadow');
  }
}

function syncTeleapoButtonGroup(buttons, activeButton) {
  buttons.forEach(btn => setTeleapoButtonActive(btn, btn === activeButton));
}

function clearCompanyRangePresetSelection() {
  const buttons = getCompanyPresetButtons();
  if (!buttons.length) return;
  buttons.forEach(btn => setTeleapoButtonActive(btn, false));
}

function initDateInputs() {
  const buttons = getCompanyPresetButtons();
  // 全ボタン非アクティブ化（デフォルトは全期間）
  buttons.forEach(btn => setTeleapoButtonActive(btn, false));

  // プリセットなし
  teleapoActivePreset = null;

  // 日付フィールドクリア
  ['teleapoLogRangeStart', 'teleapoLogRangeEnd', 'teleapoCompanyRangeStart', 'teleapoCompanyRangeEnd'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  // 初期表示ラベル更新（全期間）
  refreshForRangeChange();
}

function initFilters() {
  const handleRangeChange = () => {
    teleapoRangeTouched = true;
    refreshForRangeChange();
  };
  ['teleapoLogEmployeeFilter', 'teleapoLogResultFilter', 'teleapoLogRouteFilter', 'teleapoLogTargetSearch', 'teleapoLogRangeStart', 'teleapoLogRangeEnd', 'teleapoCompanyRangeStart', 'teleapoCompanyRangeEnd'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(id.includes('TargetSearch') ? 'input' : 'change', () => {
      if (id.includes('Range')) {
        handleRangeChange();
        return;
      }
      applyFilters();
    });
  });
  const resetBtn = document.getElementById('teleapoLogFilterReset');
  if (resetBtn) {
    resetBtn.onclick = () => {
      const emp = document.getElementById('teleapoLogEmployeeFilter');
      const result = document.getElementById('teleapoLogResultFilter');
      const route = document.getElementById('teleapoLogRouteFilter');
      const target = document.getElementById('teleapoLogTargetSearch');
      if (emp) emp.value = '';
      if (result) result.value = '';
      if (route) route.value = '';
      if (target) target.value = '';
      applyFilters();
    };
  }
}

function initHeatmapControls() {
  const rangeButtons = Array.from(document.querySelectorAll('[data-analysis-range]'));
  const syncButtons = () => {
    const active = rangeButtons.find(b => b.dataset.analysisRange === teleapoAnalysisRange);
    syncTeleapoButtonGroup(rangeButtons, active || null);
  };
  syncButtons();
  rangeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      teleapoAnalysisRange = btn.dataset.analysisRange || 'all';
      syncButtons();
      applyFilters();
    });
  });
  const employeeSelect = document.getElementById('teleapoAnalysisEmployeeFilter');
  if (employeeSelect) {
    employeeSelect.addEventListener('change', () => {
      applyFilters();
    });
  }
}

function initEmployeeSort() {
  const select = document.getElementById('teleapoEmployeeSortSelect');
  if (!select) return;
  select.addEventListener('change', () => applyFilters());
}


// clearDateFilters definition removed to fix SyntaxError

function initResetButton() {
  const resetBtn = document.getElementById('teleapoSummaryResetBtn');
  if (!resetBtn) return;

  resetBtn.addEventListener('click', () => {
    // プリセット解除
    const buttons = getCompanyPresetButtons();
    buttons.forEach(btn => setTeleapoButtonActive(btn, false));
    teleapoActivePreset = null;

    // 日付クリア
    ['teleapoLogRangeStart', 'teleapoLogRangeEnd', 'teleapoCompanyRangeStart', 'teleapoCompanyRangeEnd'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    // 再描画
    refreshForRangeChange();
  });
}

function initCompanyRangePresets() {
  setTimeout(() => {
    const buttons = getCompanyPresetButtons();
    if (!buttons.length) return;

    buttons.forEach(btn => {
      if (btn.dataset.listenerAttached === 'true') return;

      btn.addEventListener('click', () => {
        teleapoRangeTouched = true;
        const preset = btn.dataset.preset || 'thisMonth';
        const isActive = isTeleapoButtonActive(btn);

        syncTeleapoButtonGroup(buttons, null);
        if (isActive) {
          teleapoActivePreset = null;
          ['teleapoLogRangeStart', 'teleapoLogRangeEnd', 'teleapoCompanyRangeStart', 'teleapoCompanyRangeEnd'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
          });
          refreshForRangeChange();
          return;
        }
        teleapoActivePreset = preset;
        setRangePreset(preset);
        setTeleapoButtonActive(btn, true);
        refreshForRangeChange();
      });

      btn.dataset.listenerAttached = 'true';
    });
  }, 50);
}
function initCompanyRangePresets_DISABLED() {
  console.log('[DEBUG] initCompanyRangePresets: Start');
  // DOMの確実な読み込みを待つために遅延実行
  setTimeout(() => {
    console.log('[DEBUG] initCompanyRangePresets: Timeout callback start');
    const buttons = getCompanyPresetButtons();
    console.log('[DEBUG] initCompanyRangePresets: buttons found', buttons.length);
    if (!buttons.length) return;

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        console.log('[DEBUG] Clicked preset:', btn.dataset.preset);
        teleapoRangeTouched = true;
        const preset = btn.dataset.preset || 'thisMonth';
        const isActive = isTeleapoButtonActive(btn);
        console.log('[DEBUG] Clicked preset is active?', isActive);

        syncTeleapoButtonGroup(buttons, null);
        if (isActive) {
          // 同じボタンを再クリック→プリセット解除＆日付クリアで全期間表示
          console.log('[DEBUG] Deselecting preset (Total Range)');
          teleapoActivePreset = null;
          clearDateFilters();
          refreshForRangeChange();
          return;
        }
        console.log('[DEBUG] Selecting preset:', preset);
        teleapoActivePreset = preset;
        setRangePreset(preset);
        setTeleapoButtonActive(btn, true);
        refreshForRangeChange();
      });
    });
    console.log('[DEBUG] initCompanyRangePresets: Timeout callback end');
  }, 50); // 50ms delay
}

function updateLogSortIndicators() {
  const headers = document.querySelectorAll('#teleapoLogTable th[data-sort]');
  headers.forEach(th => {
    const isActive = teleapoLogSort.key === th.dataset.sort;
    th.classList.toggle('is-sorted', isActive);
    if (isActive) {
      th.dataset.sortDir = teleapoLogSort.dir;
      th.setAttribute('aria-sort', teleapoLogSort.dir === 'asc' ? 'ascending' : 'descending');
    } else {
      th.removeAttribute('data-sort-dir');
      th.setAttribute('aria-sort', 'none');
    }
  });
}

function initLogTableSort() {
  const headers = document.querySelectorAll('#teleapoLogTable th.sortable');
  headers.forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (!key) return;
      if (teleapoLogSort.key === key) {
        teleapoLogSort.dir = teleapoLogSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        teleapoLogSort = { key, dir: 'asc' };
      }
      renderLogTable();
      updateLogSortIndicators();
    });
  });
  updateLogSortIndicators();
}

function initLogTableActions() {
  const tbody = document.getElementById('teleapoLogTableBody');
  if (!tbody) return;

  tbody.addEventListener('click', async (event) => {
    const candidateBtn = event.target.closest('[data-action="open-candidate"]');
    if (candidateBtn) {
      event.preventDefault();
      event.stopPropagation();
      const candidateId = candidateBtn.dataset.candidateId;
      const candidateName = candidateBtn.dataset.candidateName;
      window.navigateToCandidateDetail?.(candidateId, candidateName);
      return;
    }
    const btn = event.target.closest('[data-action="delete-log"]');
    if (!btn) return;
    const logId = btn.dataset.logId;
    if (!logId) return;

    if (!window.confirm('この架電ログを削除しますか？')) return;

    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '削除中...';

    try {
      const removedLog = teleapoLogData.find(l => String(l.id) === String(logId));
      await deleteTeleapoLog(logId);
      teleapoLogData = teleapoLogData.filter(l => String(l.id) !== String(logId));
      annotateCallAttempts(teleapoLogData);
      applyFilters();
      rebuildCsTaskCandidates();
      if (removedLog?.route === ROUTE_TEL) {
        const candidateInput = document.getElementById("dialFormCandidateName");
        if (candidateInput) updateCallNoAndRoute(candidateInput.value);
      }
      setLogStatus('架電ログを削除しました', 'success');
    } catch (err) {
      console.error(err);
      setLogStatus(`削除に失敗しました: ${err.message}`, 'error');
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
}

function initCsTaskTableActions() {
  const tbody = document.getElementById('teleapoCsTaskTableBody');
  if (!tbody) return;
  tbody.addEventListener('click', (event) => {
    const dialBtn = event.target.closest('[data-action="prefill-dial"]');
    if (dialBtn) {
      event.preventDefault();
      event.stopPropagation();
      const candidateId = dialBtn.dataset.candidateId;
      const candidateName = dialBtn.dataset.candidateName;
      prefillDialFormFromCandidate(candidateId, candidateName);
      return;
    }
    const candidateBtn = event.target.closest('[data-action="open-candidate"]');
    if (!candidateBtn) return;
    event.preventDefault();
    event.stopPropagation();
    const candidateId = candidateBtn.dataset.candidateId;
    const candidateName = candidateBtn.dataset.candidateName;
    window.navigateToCandidateDetail?.(candidateId, candidateName);
  });
}

function setToggleButtonState(button, isOpen) {
  if (!button) return;
  button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  button.classList.toggle('bg-indigo-600', isOpen);
  button.classList.toggle('text-white', isOpen);
  button.classList.toggle('border-indigo-600', isOpen);
  button.classList.toggle('bg-white', !isOpen);
  button.classList.toggle('text-indigo-700', !isOpen);
  button.classList.toggle('border-indigo-200', !isOpen);
}

function initCsTaskToggle() {
  const header = document.getElementById('teleapoCsTaskToggle');
  const wrapper = document.getElementById('teleapoCsTaskTableWrapper');
  if (!header) return;
  const toggleBtn = header.querySelector('.teleapo-collapsible-btn');
  if (!toggleBtn) return;
  const parent = header.closest('.teleapo-collapsible');
  const onToggle = () => {
    csTaskExpanded = !csTaskExpanded;
    updateLabel();
    if (parent) parent.classList.toggle('open', csTaskExpanded);
    if (wrapper) wrapper.style.display = csTaskExpanded ? 'block' : 'none';
    if (csTaskExpanded) {
      renderCsTaskTable(teleapoCsTaskCandidates);
    }
  };
  const updateLabel = () => {
    toggleBtn.textContent = csTaskExpanded ? '一覧を閉じる' : '一覧を開く';
    setToggleButtonState(toggleBtn, csTaskExpanded);
  };
  updateLabel();
  if (parent) parent.classList.toggle('open', csTaskExpanded);
  if (wrapper) wrapper.style.display = csTaskExpanded ? 'block' : 'none';
  header.addEventListener('click', onToggle);
  toggleBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    onToggle();
  });
}

function initMissingInfoTableActions() {
  const tbody = document.getElementById('teleapoMissingInfoTableBody');
  if (!tbody) return;
  tbody.addEventListener('click', (event) => {
    const candidateBtn = event.target.closest('[data-action="open-candidate"]');
    if (!candidateBtn) return;
    event.preventDefault();
    event.stopPropagation();
    const candidateId = candidateBtn.dataset.candidateId;
    const candidateName = candidateBtn.dataset.candidateName;
    window.navigateToCandidateDetail?.(candidateId, candidateName);
  });
}

function initMissingInfoToggle() {
  const header = document.getElementById('teleapoMissingInfoToggle');
  const wrapper = document.getElementById('teleapoMissingInfoTableWrapper');
  if (!header) return;
  const toggleBtn = header.querySelector('.teleapo-collapsible-btn');
  if (!toggleBtn) return;
  const parent = header.closest('.teleapo-collapsible');
  const onToggle = () => {
    missingInfoExpanded = !missingInfoExpanded;
    updateLabel();
    if (parent) parent.classList.toggle('open', missingInfoExpanded);
    if (wrapper) wrapper.style.display = missingInfoExpanded ? 'block' : 'none';
    renderMissingInfoTable(teleapoMissingInfoCandidates);
  };
  const updateLabel = () => {
    toggleBtn.textContent = missingInfoExpanded ? '一覧を閉じる' : '一覧を開く';
    setToggleButtonState(toggleBtn, missingInfoExpanded);
  };
  updateLabel();
  if (parent) parent.classList.toggle('open', missingInfoExpanded);
  if (wrapper) wrapper.style.display = missingInfoExpanded ? 'block' : 'none';
  header.addEventListener('click', onToggle);
  toggleBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    onToggle();
  });
}

function initLogToggle() {
  const toggleBtn = document.getElementById('teleapoLogToggle');
  const wrapper = document.getElementById('teleapoLogWrapper');
  if (!toggleBtn) return;
  const updateLabel = () => {
    toggleBtn.textContent = logExpanded ? '一覧を閉じる' : '一覧を開く';
    setToggleButtonState(toggleBtn, logExpanded);
  };
  updateLabel();
  if (wrapper) wrapper.classList.toggle('hidden', !logExpanded);
  toggleBtn.addEventListener('click', () => {
    logExpanded = !logExpanded;
    updateLabel();
    if (wrapper) wrapper.classList.toggle('hidden', !logExpanded);
    if (logExpanded) {
      renderLogTable();
    }
  });
}

function initLogForm() {
  const addBtn = document.getElementById('teleapoLogInputAddBtn');
  const statusEl = document.getElementById('teleapoLogInputStatus');
  if (!addBtn) return;

  const setStatus = (msg, type = 'info') => {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.className = type === 'error' ? 'text-red-600' : type === 'success' ? 'text-emerald-600' : 'text-slate-500';
  };

  addBtn.addEventListener('click', () => {
    try {
      const datetime = document.getElementById('teleapoLogInputDatetime')?.value || '';
      const employee = document.getElementById('teleapoLogInputEmployee')?.value || '';
      const route = document.getElementById('teleapoLogInputRoute')?.value || ROUTE_TEL;
      const resultRaw = document.getElementById('teleapoLogInputResult')?.value || '';
      const target = document.getElementById('teleapoLogInputTarget')?.value || '';
      const tel = document.getElementById('teleapoLogInputTel')?.value || '';
      const email = document.getElementById('teleapoLogInputEmail')?.value || '';
      const memo = document.getElementById('teleapoLogInputMemo')?.value || '';

      if (!datetime || !employee || !resultRaw) {
        setStatus('日時・担当・結果は必須です', 'error');
        return;
      }

      const resultCode = normalizeResultCode(resultRaw);
      const newLog = normalizeLog({ datetime: datetime.replace('T', ' '), employee, route, target, tel, email, resultCode, memo });
      const callKey = getCallKey(newLog);
      const attempt = teleapoLogData.filter(l => getCallKey(l) === callKey).length + 1;
      newLog.callAttempt = attempt;

      teleapoLogData.push(newLog);
      applyFilters();
      rebuildCsTaskCandidates();
      setStatus('追加しました', 'success');

      ['teleapoLogInputTarget', 'teleapoLogInputTel', 'teleapoLogInputEmail', 'teleapoLogInputMemo'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    } catch (e) {
      console.error(e);
      setStatus('追加に失敗しました', 'error');
    }
  });
}

async function fetchTeleapoApi() {
  let startStr = document.getElementById('teleapoLogRangeStart')?.value
    || document.getElementById('teleapoCompanyRangeStart')?.value
    || '';
  let endStr = document.getElementById('teleapoLogRangeEnd')?.value
    || document.getElementById('teleapoCompanyRangeEnd')?.value
    || '';

  // プリセットがアクティブな場合は日付フィールドの値を使用（上書きしない）
  // 日付が空の場合のみデフォルトを適用
  if (!startStr || !endStr) {
    // プリセットがアクティブなら、そのプリセットの日付を再計算
    if (teleapoActivePreset) {
      setRangePreset(teleapoActivePreset);
      startStr = document.getElementById('teleapoCompanyRangeStart')?.value || '';
      endStr = document.getElementById('teleapoCompanyRangeEnd')?.value || '';
    }

    // まだ空なら「全期間」として1年分を取得（APIは日付範囲が必要なため）
    if (!startStr || !endStr) {
      const today = new Date();
      const from = new Date(today);
      from.setFullYear(today.getFullYear() - 1); // 1年前から
      startStr = from.toISOString().slice(0, 10);
      endStr = today.toISOString().slice(0, 10);

      // 日付フィールドは空のままにして「全期間」表示を維持
      // （UIには表示しないがAPIリクエストには使用）
    }
  }

  const params = new URLSearchParams();
  params.append('from', startStr);
  params.append('to', endStr ? addDaysToDateString(endStr, 1) : endStr);
  params.append('limit', '2000');
  params.append('offset', '0');

  const url = new URL(TELEAPO_LOGS_URL);
  params.forEach((value, key) => url.searchParams.append(key, value));

  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Teleapo API HTTP ${res.status}`);
  return res.json();
}

// ... fetchTeleapoApi関数などの近くに追加 ...

// ★ 候補者一覧を取得して datalist 用の辞書を作る
async function loadCandidates() {
  renderCsTaskTable([], { loading: true });
  renderMissingInfoTable([], { loading: true });
  try {
    const res = await fetch(CANDIDATES_API_URL, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Candidates API Error: ${res.status}`);

    const data = await res.json();
    const rawItems = Array.isArray(data.items) ? data.items : [];
    const items = rawItems.map(item => normalizeCandidateDetail(item) || item);

    candidateNameMap.clear();
    candidateIdMap.clear();
    candidateAttendanceMap.clear();
    candidateAttendanceByName.clear();
    candidatePhoneToId.clear();
    candidateEmailToId.clear();
    items.forEach(c => {
      // 名前を一意のキーにする（同姓同名対策が必要なら "名前(ID)" 等にするが、一旦名前で実装）
      const fullName = String(c.candidateName ?? c.candidate_name ?? c.name ?? '').trim();
      const candidateId = Number(c.candidateId ?? c.candidate_id ?? c.id ?? c.candidateID);
      if (fullName && Number.isFinite(candidateId) && candidateId > 0) {
        candidateNameMap.set(fullName, candidateId);
        candidateIdMap.set(String(candidateId), fullName);
        registerCandidateAttendance(
          candidateId,
          fullName,
          c.attendanceConfirmed ?? c.first_interview_attended ?? c.attendance_confirmed ?? c.firstInterviewAttended
        );
        const phone =
          c.phone ??
          c.phone_number ??
          c.phoneNumber ??
          c.tel ??
          c.mobile ??
          c.candidate_phone ??
          "";
        const phoneText = String(phone ?? "").trim();
        const birthday = String(c.birthday ?? c.birth_date ?? c.birthDate ?? c.birthdate ?? "").trim();
        const contactPreferredTime = normalizeContactPreferredTime(
          c.contactPreferredTime ??
          c.contact_preferred_time ??
          c.contactTime ??
          c.contact_time
        );
        const contactPreferredTimeFetched = Boolean(contactPreferredTime);
        const ageRaw = c.age ?? c.age_years ?? c.ageYears ?? null;
        const ageValue = Number(ageRaw);
        const age = Number.isFinite(ageValue) && ageValue > 0 ? ageValue : null;
        const detail = {
          phone: phoneText,
          birthday: String(birthday ?? "").trim(),
          age,
          contactPreferredTime: normalizeContactPreferredTime(contactPreferredTime),
          contactPreferredTimeFetched,
          attendanceConfirmed: normalizeAttendanceValue(
            c.attendanceConfirmed ?? c.first_interview_attended ?? c.attendance_confirmed ?? c.firstInterviewAttended
          ),
          firstInterviewDate: c.firstInterviewDate ?? c.first_interview_date ?? c.firstInterviewAt ?? c.first_interview_at ?? null
        };
        if (detail.phone) candidatePhoneCache.set(candidateId, detail.phone);
        if (detail.phone || detail.birthday || detail.age !== null || detail.contactPreferredTime) {
          candidateDetailCache.set(candidateId, detail);
        }
        registerCandidateContactMaps(candidateId, { ...c, phone: phoneText });
      }
    });
    candidateNameList = Array.from(candidateNameMap.keys()).sort((a, b) => b.length - a.length);

    console.log(`候補者ロード完了: ${candidateNameMap.size}件`);
    refreshCandidateDatalist(); // datalist更新

    teleapoCandidateMaster = items;
    prefetchValidApplicationForCandidates(teleapoCandidateMaster);
    rebuildCsTaskCandidates();
    const hydrated = hydrateLogCandidateIds(teleapoLogData);
    if (hydrated) {
      rebuildTeleapoSummaryCache(teleapoLogData);
    }
    prefetchContactTimeForLogs(teleapoLogData);
    prefetchContactTimeForTasks(teleapoCsTaskCandidates);
    applyFilters();
    scheduleAttendanceFetchFromLogs(teleapoLogData);
  } catch (e) {
    console.error("候補者一覧の取得に失敗:", e);
    renderCsTaskTable([], { error: true });
  }
}

async function loadTeleapoData() {
  const prevLogs = Array.isArray(teleapoLogData) ? [...teleapoLogData] : [];
  const prevRange = getLoadedDateRange(prevLogs);
  const selectedRange = getSelectedRange();
  try {
    const data = await fetchTeleapoApi();
    const logs = Array.isArray(data?.logs) ? data.logs : Array.isArray(data?.items) ? data.items : [];
    const mappedLogs = logs.map(mapApiLog).filter(Boolean);
    let nextLogs = mappedLogs.filter(l => l.datetime);
    if (!nextLogs.length && mappedLogs.length) {
      nextLogs = mappedLogs;
    }
    if (!nextLogs.length && prevLogs.length && (selectedRange.startStr || selectedRange.endStr) && prevRange) {
      if (isRangeWithinLoaded(selectedRange, prevRange)) {
        teleapoLogData = prevLogs;
        applyFilters();
        return;
      }
    }
    teleapoLogData = nextLogs;
    if (!teleapoLogData.length && !teleapoRangeTouched && !teleapoAutoFallbackDone) {
      teleapoAutoFallbackDone = true;
      clearCompanyRangePresetSelection();
      setRangePreset('last180');
      return loadTeleapoData();
    }
    teleapoLogData = mergePendingLogs(teleapoLogData);
    annotateCallAttempts(teleapoLogData);
    rebuildEmployeeMap();
    refreshCandidateDatalist();
    const hydrated = hydrateLogCandidateIds(teleapoLogData);
    if (hydrated) {
      rebuildTeleapoSummaryCache(teleapoLogData);
    }
    scheduleAttendanceFetchFromLogs(teleapoLogData);
    prefetchContactTimeForLogs(teleapoLogData);
    applyFilters();
    rebuildCsTaskCandidates();
    prefetchContactTimeForTasks(teleapoCsTaskCandidates);
  } catch (err) {
    console.error('[teleapo] API取得に失敗したためモックを使用します', err);
    teleapoLogData = teleapoInitialMockLogs.map(normalizeLog);
    teleapoLogData = mergePendingLogs(teleapoLogData);
    annotateCallAttempts(teleapoLogData);
    refreshCandidateDatalist();
    const hydrated = hydrateLogCandidateIds(teleapoLogData);
    if (hydrated) {
      rebuildTeleapoSummaryCache(teleapoLogData);
    }
    scheduleAttendanceFetchFromLogs(teleapoLogData);
    prefetchContactTimeForLogs(teleapoLogData);
    applyFilters();
    rebuildCsTaskCandidates();
    prefetchContactTimeForTasks(teleapoCsTaskCandidates);
  }
}

async function loadTeleapoRateTargets() {
  try {
    await goalSettingsService.load();
    const periods = goalSettingsService.getEvaluationPeriods();
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;
    const currentPeriod = goalSettingsService.getPeriodByDate(todayStr, periods);
    if (currentPeriod?.id) {
      teleapoRateTargets = await goalSettingsService.loadPageRateTargets(currentPeriod.id) || {};
    }
  } catch (error) {
    console.warn('[teleapo] failed to load rate targets', error);
    teleapoRateTargets = {};
  }
}

// 既存の mount をこれで上書き
export function mount() {
  bindTeleapoTabs();
  bindTeleapoCollapsibles();
  ensureLogHighlightStyles();
  initDateInputs();
  initFilters();
  initCompanyRangePresets();
  initResetButton();
  initHeatmapControls();
  initEmployeeSort();
  initEmployeeSortHeaders();
  initEmployeeTrendModeControls();
  initLogTableSort();
  initLogTableActions();
  initCsTaskTableActions();
  initCsTaskToggle();
  initMissingInfoTableActions();
  initMissingInfoToggle();
  initLogToggle();
  initCandidateQuickView(); // 既存の初期化関数を使用
  initRateModeToggle();

  // initLogForm(); // ← ★削除またはコメントアウト（モック用フォームはもう不要）

  initDialForm(); // 本番用フォーム（POST対応版）

  // データロード開始
  // 目標値をロード
  loadTeleapoRateTargets().then(() => {
    // データロード後に目標値があれば再描画されるが、ここでもロードしておく
    refreshForRangeChange();
  });
  loadScreeningRulesForTeleapo();
  // 1. 候補者マスタ取得 (datalist用)
  loadCandidates();

  // 2. ログデータ取得 (一覧用)
  loadTeleapoData();
}




function localDateTimeToRfc3339(localValue) {
  // localValue: "YYYY-MM-DDTHH:mm"
  if (!localValue || !localValue.includes("T")) return null;

  const [datePart, timePart] = localValue.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);

  const dt = new Date(y, m - 1, d, hh, mm, 0); // ローカルとして生成
  const tzMin = -dt.getTimezoneOffset(); // 例: JSTなら +540
  const sign = tzMin >= 0 ? "+" : "-";
  const abs = Math.abs(tzMin);
  const tzH = String(Math.floor(abs / 60)).padStart(2, "0");
  const tzM = String(abs % 60).padStart(2, "0");

  const pad2 = (n) => String(n).padStart(2, "0");
  return `${y}-${pad2(m)}-${pad2(d)}T${pad2(hh)}:${pad2(mm)}:00${sign}${tzH}:${tzM}`;
}

// ★ ここを実際のAPI Gatewayに合わせる（teleapo GETと同じでOK）
const TELEAPO_API_BASE = window.API_BASE_URL || "https://uqg1gdotaa.execute-api.ap-northeast-1.amazonaws.com/dev";
const TELEAPO_LOGS_PATH = "/teleapo/logs";
const TELEAPO_LOGS_URL = `${TELEAPO_API_BASE}${TELEAPO_LOGS_PATH}`;


function nowLocalDateTime() {
  const d = new Date();
  const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
  return iso.slice(0, 16);
}

function populateEmployeeSelect() {
  const sel = document.getElementById("dialFormEmployee");
  if (!sel) return;
  sel.innerHTML = TELEAPO_EMPLOYEES.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
}

// 既存の refreshCandidateDatalist をこれで上書き
function refreshCandidateDatalist() {
  const listEl = document.getElementById("dialFormCandidateList");
  if (!listEl) return;

  // APIから取得した候補者リストを使用
  const names = Array.from(candidateNameMap.keys()).sort((a, b) => a.localeCompare(b, "ja"));

  listEl.innerHTML = names.map(n => `<option value="${escapeHtml(n)}"></option>`).join("");
}

function routeLabelFromLogRoute(logRoute) {
  if (!logRoute) return "電話";
  const t = `${logRoute}`.toLowerCase();
  if (t.includes("sms")) return "SMS";
  if (t.includes("other") || t.includes("mail") || t.includes("line")) return "その他";
  return "電話";
}

function updateCallNoAndRoute(candidateName) {
  const name = (candidateName || "").trim();
  const callNoInput = document.getElementById("dialFormCallNo");
  const routeSelect = document.getElementById("dialFormRoute");
  const candidateIdHidden = document.getElementById("dialFormCandidateId");
  if (!name) return;

  const matchedCandidateId = findCandidateIdByName(name);
  if (matchedCandidateId && candidateIdHidden) {
    candidateIdHidden.value = String(matchedCandidateId);
  }
  const nameKey = normalizeNameKey(name);
  const matched = matchedCandidateId
    ? teleapoLogData.filter(l => Number(l.candidateId) === Number(matchedCandidateId))
    : teleapoLogData.filter(l => normalizeNameKey(l.target || '') === nameKey);
  if (matched.length === 0) {
    if (callNoInput) callNoInput.value = "1";
    if (routeSelect) routeSelect.value = "電話";
    if (candidateIdHidden) candidateIdHidden.value = "";
    return;
  }

  const telMatched = matched.filter(l => l.route === ROUTE_TEL);
  const nextAttempt = telMatched.length + 1;
  if (callNoInput) callNoInput.value = String(nextAttempt || 1);

  const latest = [...matched].sort((a, b) => {
    const ta = parseDateTime(a.datetime)?.getTime() || 0;
    const tb = parseDateTime(b.datetime)?.getTime() || 0;
    return tb - ta;
  })[0];
  if (routeSelect) routeSelect.value = routeLabelFromLogRoute(latest.route);
  if (candidateIdHidden && latest?.candidateId) candidateIdHidden.value = String(latest.candidateId);
}

function prefillDialFormFromCandidate(candidateId, candidateName) {
  const form = document.getElementById("teleapoFormSection");
  const nameInput = document.getElementById("dialFormCandidateName");
  const idInput = document.getElementById("dialFormCandidateId");
  const calledAtInput = document.getElementById("dialFormCalledAt");
  const routeSelect = document.getElementById("dialFormRoute");

  const resolvedName = candidateName || candidateIdMap.get(String(candidateId)) || "";
  if (nameInput && resolvedName) {
    nameInput.value = resolvedName;
  }
  if (idInput && candidateId) {
    idInput.value = String(candidateId);
  }
  if (calledAtInput) {
    calledAtInput.value = nowLocalDateTime();
  }

  if (resolvedName) {
    updateCallNoAndRoute(resolvedName);
  }
  if (routeSelect) {
    routeSelect.value = "電話";
  }
  updateInterviewFieldVisibility(document.getElementById("dialFormResult")?.value);

  if (form) {
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const resultSelect = document.getElementById("dialFormResult");
  if (resultSelect) {
    resultSelect.focus();
  } else {
    nameInput?.focus();
  }
}

function shouldRequireInterview(resultValue) {
  return normalizeResultCode(resultValue) === "set";
}

function updateInterviewFieldVisibility(resultValue) {
  const field = document.getElementById("dialFormInterviewField");
  const input = document.getElementById("dialFormInterviewAt");
  if (!field || !input) return;
  const shouldShow = shouldRequireInterview(resultValue ?? document.getElementById("dialFormResult")?.value);
  field.classList.toggle("is-hidden", !shouldShow);
  input.required = shouldShow;
  if (!shouldShow) input.value = "";
}

function resetDialFormDefaults(clearMessage = true) {
  const dt = document.getElementById("dialFormCalledAt");
  if (dt) dt.value = nowLocalDateTime();
  const emp = document.getElementById("dialFormEmployee");
  if (emp && emp.options.length) emp.value = emp.options[0].value;
  const route = document.getElementById("dialFormRoute");
  if (route) route.value = "電話";
  const callNo = document.getElementById("dialFormCallNo");
  if (callNo) callNo.value = "1";
  const result = document.getElementById("dialFormResult");
  if (result) result.value = "通電";
  updateInterviewFieldVisibility(result?.value);
  const memo = document.getElementById("dialFormMemo");
  if (memo) memo.value = "";
  const msg = document.getElementById("dialFormMessage");
  if (msg && clearMessage) msg.textContent = "";
}

// 既存の bindDialForm をこれで上書き
function bindDialForm() {
  const candidateInput = document.getElementById("dialFormCandidateName");
  const resultSelect = document.getElementById("dialFormResult");

  // 名前入力時の自動補完ロジック
  if (candidateInput) {
    ["change", "blur", "input"].forEach(ev =>
      candidateInput.addEventListener(ev, () => {
        const val = candidateInput.value.trim();
        updateCallNoAndRoute(val);

        // ★ API由来のマップからIDを即座にセット
        const foundId = findCandidateIdByName(val);
        const hiddenId = document.getElementById("dialFormCandidateId");
        if (hiddenId && foundId) {
          hiddenId.value = foundId;
        }
      })
    );
  }

  if (resultSelect) {
    resultSelect.addEventListener("change", () => updateInterviewFieldVisibility(resultSelect.value));
    updateInterviewFieldVisibility(resultSelect.value);
  }

  const submitBtn = document.getElementById("dialFormSubmit");
  if (!submitBtn) return;

  submitBtn.addEventListener("click", async () => {
    const msg = document.getElementById("dialFormMessage");
    if (msg) msg.textContent = "";

    // 1. フォーム値取得
    const candidateName = (document.getElementById("dialFormCandidateName")?.value || "").trim();
    // 隠しフィールドのIDを優先し、なければMapから再検索
    let candidateId = Number(document.getElementById("dialFormCandidateId")?.value);
    if (!candidateId && candidateName) {
      candidateId = findCandidateIdByName(candidateName);
    }
    const candidateIdValue = Number.isFinite(candidateId) && candidateId > 0 ? candidateId : null;

    const calledAtLocal = document.getElementById("dialFormCalledAt")?.value || nowLocalDateTime();
    const calledAt = localDateTimeToRfc3339(calledAtLocal);
    const route = document.getElementById("dialFormRoute")?.value || "電話";
    const result = document.getElementById("dialFormResult")?.value || "通電";
    const interviewAtLocal = document.getElementById("dialFormInterviewAt")?.value || "";
    const needsInterview = shouldRequireInterview(result);
    const employee = document.getElementById("dialFormEmployee")?.value || "";
    const memo = document.getElementById("dialFormMemo")?.value || "";
    const callNo = Number(document.getElementById("dialFormCallNo")?.value);

    // 2. バリデーション
    if (!candidateName) {
      if (msg) msg.textContent = "候補者名は必須です";
      return;
    }
    if (!employee || !calledAt) {
      if (msg) msg.textContent = "担当者と日時は必須です";
      return;
    }
    if (needsInterview && !interviewAtLocal) {
      if (msg) msg.textContent = "アポ結果が設定の場合は初回面談日時を入力してください";
      return;
    }
    if (needsInterview && !candidateIdValue) {
      if (msg) msg.textContent = "初回面談日時の登録には候補者を一覧から選択してください";
      return;
    }

    // 3. 担当者ID (callerUserId) の特定
    // ログから特定できない場合（新規環境など）、デモ用に強制的に '1' を割り当てる安全策を追加
    let callerUserId = employeeNameToUserId.get(employee);
    if (!callerUserId) {
      console.warn("社員IDが特定できないため、デモ用ID(1)を使用します");
      callerUserId = 1;
    }

    try {
      // 4. ペイロード作成
      const payload = {
        candidateName: candidateName,
        callerUserId: callerUserId,
        calledAt: calledAt,
        route: route,
        result: result,
        memo: memo
      };
      if (candidateIdValue) payload.candidateId = candidateIdValue;
      if (Number.isFinite(callNo) && callNo > 0) payload.callNo = callNo;

      // 5. PUT送信
      const res = await fetch(TELEAPO_LOGS_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      // 6. 成功時の処理
      let responseJson = null;
      try {
        responseJson = await res.json();
      } catch (e) {
        responseJson = null;
      }
      const responseId =
        responseJson?.id ??
        responseJson?.log_id ??
        responseJson?.logId ??
        responseJson?.item?.id ??
        responseJson?.data?.id ??
        null;
      setLogHighlightTarget({
        id: responseId,
        candidateId: candidateIdValue,
        calledAt,
        callerUserId,
        candidateName
      });
      const pendingLog = buildPendingTeleapoLog({
        id: responseId,
        candidateId: candidateIdValue,
        candidateName,
        calledAt,
        employee,
        route,
        result,
        memo,
        callerUserId
      });
      addPendingTeleapoLog(pendingLog);
      teleapoLogData = mergePendingLogs(teleapoLogData);
      annotateCallAttempts(teleapoLogData);
      applyFilters();
      let interviewUpdateError = "";
      if (needsInterview && candidateIdValue) {
        const interviewAt = localDateTimeToRfc3339(interviewAtLocal);
        try {
          await updateCandidateFirstInterview(candidateIdValue, interviewAt);
        } catch (err) {
          interviewUpdateError = "（初回面談日時の保存に失敗しました）";
          console.error("candidate interview update error:", err);
        }
      }
      if (msg) {
        msg.className = `teleapo-form-message text-sm ${interviewUpdateError ? "text-amber-600" : "text-emerald-600"} font-semibold`;
        msg.textContent = interviewUpdateError
          ? `架電ログに追加しました${interviewUpdateError}`
          : "架電ログに追加しました";
        setTimeout(() => msg.textContent = "", 3000);
      }

      // フォーム初期化
      resetDialFormDefaults(false);
      const cInput = document.getElementById("dialFormCandidateName");
      if (cInput) cInput.value = "";
      const hInput = document.getElementById("dialFormCandidateId");
      if (hInput) hInput.value = "";

      // データを再読み込みして表を更新
      await loadTeleapoData();

    } catch (err) {
      console.error(err);
      if (msg) {
        msg.className = "teleapo-form-message text-sm text-red-600 font-semibold";
        msg.textContent = "保存に失敗しました: " + err.message;
      }
    }
  });
}
function initDialForm() {
  populateEmployeeSelect();
  resetDialFormDefaults();
  refreshCandidateDatalist();
  bindDialForm();
}

