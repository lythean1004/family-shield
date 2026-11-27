import { receivedRequestEpisodes } from "./received-message.js";
import {
  SIG_AGENCY_IMPERSONATION, SIG_APP_INSTALL, SIG_CALL_THIS_NUMBER, SIG_LINK, SIG_OFFICIAL_LINK, SIG_PERSONAL_INFO,
} from "./signals.js";

export const AGENCY_ACTION_SIGNALS = [SIG_LINK, SIG_APP_INSTALL, SIG_PERSONAL_INFO, SIG_CALL_THIS_NUMBER];

function hasAgencyAction(signals, signal) {
  return signals.has(signal) && (signal !== SIG_LINK || !signals.has(SIG_OFFICIAL_LINK));
}

export function unlinkedAgencyActions(text, signals, extract) {
  const episodes = receivedRequestEpisodes(text);
  if (!episodes) return [];

  const cache = new Map();
  function signalsIn(parts) {
    const input = parts.map(part => part.text + part.separator).join("").trim();
    if (!cache.has(input)) cache.set(input, input ? new Set(extract(input)) : new Set());
    return cache.get(input);
  }

  let sawIssuer = false;
  const observed = new Set();
  const linked = new Set();
  for (const parts of episodes) {
    const original = signalsIn(parts);
    for (const signal of AGENCY_ACTION_SIGNALS) {
      if (hasAgencyAction(original, signal)) observed.add(signal);
    }
    if (!original.has(SIG_AGENCY_IMPERSONATION)) continue;
    sawIssuer = true;

    const excluded = new Set(parts.filter(part => part.otherRecipient));
    for (const [index, part] of parts.entries()) {
      if (!part.withdrawn || index === 0) continue;
      // A withdrawal looking back across several requests has an uncertain antecedent.
      const priorRequests = parts.slice(0, index).filter(candidate =>
        !excluded.has(candidate) && AGENCY_ACTION_SIGNALS.some(signal => hasAgencyAction(signalsIn([candidate]), signal)));
      if (priorRequests.length === 1 && priorRequests[0] === parts[index - 1] && priorRequests[0].request) {
        excluded.add(priorRequests[0]);
      }
    }
    const current = signalsIn(parts.filter(part => !excluded.has(part)));
    for (const signal of AGENCY_ACTION_SIGNALS) {
      if (hasAgencyAction(current, signal)) linked.add(signal);
    }
  }

  if (!sawIssuer) return [];
  // Preserve signals the original extractor could only find across episode boundaries.
  return AGENCY_ACTION_SIGNALS.filter(signal => signals.includes(signal) && observed.has(signal) && !linked.has(signal));
}
