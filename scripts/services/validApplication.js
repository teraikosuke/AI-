const PLACEHOLDER_VALUES = new Set(["-", "ー", "未設定", "未入力", "未登録", "未指定"]);

export function parseRuleNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function parseListValue(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (value === null || value === undefined) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeCommaText(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).join(", ");
  }
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
}

export function normalizeScreeningRulesPayload(payload) {
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
    targetNationalities: normalizeCommaText(nationalitiesRaw),
    targetNationalitiesList: parseListValue(nationalitiesRaw),
    allowedJlptLevels: parseListValue(allowedJlptRaw),
  };
}

export function isUnlimitedMinAge(value) {
  if (value === null || value === undefined || value === "") return true;
  return Number(value) <= 0;
}

export function isUnlimitedMaxAge(value) {
  if (value === null || value === undefined || value === "") return true;
  return Number(value) >= 100;
}

export function hasScreeningConstraints(rules) {
  if (!rules) return false;
  if (!isUnlimitedMinAge(rules.minAge) && rules.minAge !== null) return true;
  if (!isUnlimitedMaxAge(rules.maxAge) && rules.maxAge !== null) return true;
  if (Array.isArray(rules.targetNationalitiesList) && rules.targetNationalitiesList.length > 0) return true;
  if (Array.isArray(rules.allowedJlptLevels) && rules.allowedJlptLevels.length > 0) return true;
  return false;
}

function toHalfWidthDigits(text) {
  return String(text || "")
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0));
}

export function parseAgeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 0 && value <= 130 ? value : null;
  }
  const normalized = toHalfWidthDigits(String(value).trim());
  if (!normalized) return null;
  const direct = Number(normalized);
  if (Number.isFinite(direct) && direct >= 0 && direct <= 130) return direct;
  const match = normalized.match(/(\d{1,3})\s*(?:歳|才)?/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 130 ? parsed : null;
}

export function calculateAgeFromBirthday(value) {
  if (!value) return null;
  let birthDate = null;
  if (value instanceof Date) {
    birthDate = value;
  } else {
    const direct = new Date(value);
    if (!Number.isNaN(direct.getTime())) {
      birthDate = direct;
    } else {
      const match = String(value).match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
      if (match) {
        const year = Number(match[1]);
        const month = Number(match[2]) - 1;
        const day = Number(match[3]);
        const parsed = new Date(year, month, day);
        if (!Number.isNaN(parsed.getTime())) birthDate = parsed;
      }
    }
  }
  if (!birthDate) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age >= 0 && age <= 130 ? age : null;
}

export function resolveCandidateAgeValue(candidate) {
  if (!candidate) return null;
  const birthday =
    candidate.birthday ??
    candidate.birth_date ??
    candidate.birthDate ??
    candidate.birthdate ??
    null;
  const fromBirthday = calculateAgeFromBirthday(birthday);
  if (fromBirthday !== null) return fromBirthday;
  return parseAgeNumber(candidate.age ?? candidate.ageText ?? candidate.age_value ?? candidate.age_years ?? candidate.ageYears);
}

export function normalizeNationality(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (PLACEHOLDER_VALUES.has(text)) return "";
  const normalized = text.toLowerCase();
  if (normalized === "japan" || normalized === "jpn" || normalized === "jp" || normalized === "japanese") {
    return "日本";
  }
  if (["日本国", "日本国籍", "日本人", "日本国民"].includes(text)) return "日本";
  return text;
}

export function isJapaneseNationality(value) {
  return normalizeNationality(value) === "日本";
}

export function resolveCandidateNationalityForScreening(candidate) {
  const normalized = normalizeNationality(candidate?.nationality ?? "");
  return normalized || "日本";
}

function normalizeJlpt(value) {
  const text = String(value || "").trim();
  if (!text || PLACEHOLDER_VALUES.has(text)) return "";
  return text;
}

export function computeValidApplication(candidate, rules) {
  if (!candidate || !rules) return null;
  if (!hasScreeningConstraints(rules)) return null;

  const age = resolveCandidateAgeValue(candidate);
  const requiresMinAge = !isUnlimitedMinAge(rules.minAge) && rules.minAge !== null;
  const requiresMaxAge = !isUnlimitedMaxAge(rules.maxAge) && rules.maxAge !== null;
  if (requiresMinAge || requiresMaxAge) {
    if (age === null) return false;
    if (requiresMinAge && age < rules.minAge) return false;
    if (requiresMaxAge && age > rules.maxAge) return false;
  }

  const candidateNationality = resolveCandidateNationalityForScreening(candidate);
  const allowedNationalities = parseListValue(rules.targetNationalitiesList)
    .map((value) => normalizeNationality(value))
    .filter(Boolean);

  if (allowedNationalities.length > 0 && !allowedNationalities.includes(candidateNationality)) {
    return false;
  }

  if (isJapaneseNationality(candidateNationality)) return true;

  const allowedJlptLevels = parseListValue(rules.allowedJlptLevels);
  if (!allowedJlptLevels.length) return true;

  const jlpt = normalizeJlpt(candidate.japaneseLevel ?? candidate.japanese_level);
  if (!jlpt) return false;
  return allowedJlptLevels.includes(jlpt);
}

export function resolveValidApplicationRaw(candidate) {
  const explicitRaw =
    candidate?.valid_application ??
    candidate?.is_effective_application ??
    candidate?.isEffective ??
    candidate?.is_effective ??
    candidate?.isValidApplication ??
    candidate?.active_flag ??
    candidate?.valid;

  let raw = explicitRaw;
  if (raw === null || raw === undefined || raw === "") {
    if (candidate?.validApplication === true) raw = true;
    else if (candidate?.validApplication === false) raw = false;
    else if (candidate?.validApplicationComputed === true || candidate?.validApplicationComputed === false) {
      raw = candidate.validApplicationComputed;
    } else if (candidate?.valid_application_computed === true || candidate?.valid_application_computed === false) {
      raw = candidate.valid_application_computed;
    }
  }

  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (["true", "1", "yes", "有効", "有効応募"].includes(normalized)) return true;
    if (["false", "0", "no", "無効", "無効応募"].includes(normalized)) return false;
  }
  if (raw === null || raw === undefined || raw === "") return null;
  return Boolean(raw);
}
