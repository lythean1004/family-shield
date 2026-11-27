const horizontalGap = "[\\t\\p{Zs}\\uFEFF]+";
const separator = "(?:[.-]|" + horizontalGap + ")?";
const area = "(?:2|3[1-3]|4[1-4]|5[1-5]|6[1-4])";
const olderMobilePrefix = "1[16789]";
const localSubscriber = separator + "\\d{3,4}" + separator + "\\d{4}";
const fourDigitSubscriber = separator + "\\d{4}" + separator + "\\d{4}";
const regionalOrMobile = area + localSubscriber + "|(?:10|70)" + fourDigitSubscriber + "|" + olderMobilePrefix + localSubscriber;
const internationalPrefix = "\\+?82" + separator + "(?:\\(0\\)" + separator + "|0?)";
const national = "0(?:" + regionalOrMobile + "|(?:50\\d|60|80)" + localSubscriber + ")";
const conventional = [internationalPrefix + "(?:" + regionalOrMobile + ")", "\\(0" + area + "\\)" + localSubscriber, national].join("|");
const representative = "1[568]\\d{2}" + separator + "\\d{4}";
const legacyDomestic = "0\\d{1,2}[- ]?\\d{3,4}[- ]?\\d{4}";

function boundPhoneNumber(source) {
  // 다른 숫자열의 일부는 제외한다. 수평 공백으로 구분된 표의 앞뒤 셀은 별도다.
  return "(?=[+(018])(?<![\\d+-])(?<!\\d\\.)(?<!\\b82" + horizontalGap + ")(?<!\\(0\\)" + horizontalGap + ")" +
    "(?:" + source + ")(?![\\d-]|\\.\\d)";
}

export const CALLBACK_NUMBER_SOURCE = boundPhoneNumber(conventional + "|" + representative + "|" + legacyDomestic + "|1\\d{2,3}");
export const CANONICAL_MASK_PHONE_SOURCE = boundPhoneNumber(conventional + "|" + representative);
export const LEGACY_MASK_LOCAL_PREFIX = "(?:10|" + olderMobilePrefix + "|2|[3-9]\\d)";

/** 같은 국내 번호는 원래 표기와 관계없이 국가번호 82를 0으로 맞춘다. */
export function normalizePhoneNumber(raw) {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("82") ? "0" + digits.slice(2).replace(/^0/, "") : digits;
}
