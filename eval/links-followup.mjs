// Offline counts only. Never prints original URLs or hosts, never fetches links.
// node eval/links-followup.mjs data/kisa/kisa-2023.csv data/kisa/kisa-2024.csv [--links-ref ec3bc1f]
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as currentLinks from '../packages/core/src/links.js';
import { normalizeHost } from '../packages/core/src/phishing-list.js';
import { domainSegments, findLookalikes } from '../packages/core/src/lookalike.js';

const args = process.argv.slice(2), refIndex = args.indexOf('--links-ref');
const ref = refIndex < 0 ? null : args[refIndex + 1];
if (refIndex >= 0 && !/^[a-f0-9]{7,40}$/.test(ref ?? '')) throw new Error('커밋 해시를 주세요');
const files = args.filter((_, i) => refIndex < 0 || (i !== refIndex && i !== refIndex + 1));
if (!files.length) { console.error('KISA CSV 경로를 주세요'); process.exit(1); }
const { findLinks, toDomain, BARE_DOMAIN_RE } = ref
  ? await import('data:text/javascript;base64,' + Buffer.from(execFileSync('git', ['show', `${ref}:packages/core/src/links.js`])).toString('base64'))
  : currentLinks;
const rows = files.flatMap(file => readFileSync(file, 'utf8').split(/\r?\n/).slice(1)
  .filter(line => line.includes(',')).map(line => line.slice(line.indexOf(',') + 1).trim()));
const bare = rows.filter(row => !/^(https?|ftp):\/\//i.test(row));
const hosts = [...new Set(rows.map(row => normalizeHost(toDomain(row))).filter(Boolean))];
const names = ['customs', 'unipass', 'fss', 'fsc', 'kb', 'kbstar', 'kookmin', 'nh', 'nonghyup', 'woori',
  'shinhan', 'hana', 'hanabank', 'ibk', 'samsung', 'hyundai', 'lotte', 'card', 'kt', 'skt', 'lg', 'uplus'];
const prefixCounts = Object.fromEntries(names.map(name => [name, hosts.filter(host => domainSegments(host).some(s => s.startsWith(name))).length]));
const byCard = {};
for (const { card_id } of findLookalikes(hosts)) byCard[card_id] = (byCard[card_id] ?? 0) + 1;
const absent = bare.filter(row => !findLinks(row).length);
const bareRegex = new RegExp(BARE_DOMAIN_RE);
const regexMisses = bare.filter(row => { bareRegex.lastIndex = 0; return !bareRegex.test(row); });
const regexCategories = { domain: 0, not_a_domain: 0, csv_quoted: 0, scheme_typo: 0 };
for (const row of regexMisses) {
  const key = row.startsWith('"') ? 'csv_quoted' : /^hhttps?:/i.test(row) ? 'scheme_typo' : !toDomain(row).includes('.') ? 'not_a_domain' : 'domain';
  regexCategories[key]++;
}
const suffixes = {};
for (const row of absent) {
  const suffix = toDomain(row).split('.').pop();
  // Fixed list of categories observed in this study; arbitrary host data never becomes a log key.
  const key = !toDomain(row).includes('.') ? 'not_a_domain' : ['show','media','gold','vin','services','ski','pub','moe','mobi','baby','rent',
    'secretbox','kca','singlecam','mcf','rnddm'].includes(suffix) ? suffix : 'other';
  suffixes[key] = (suffixes[key] ?? 0) + 1;
}
const partial = { csv_quoted: 0, scheme_typo: 0, host_mismatch: 0 };
for (const row of bare) {
  const links = findLinks(row);
  if (!links.length || links.some(link => normalizeHost(toDomain(link)) === normalizeHost(toDomain(row)))) continue;
  const key = row.startsWith('"') ? 'csv_quoted' : /^hhttps?:/i.test(row) ? 'scheme_typo' : 'host_mismatch';
  partial[key]++;
}
const decodedBare = rows.map(row => row.startsWith('"') && row.endsWith('"') ? row.slice(1, -1).replaceAll('""', '"') : row)
  .filter(row => !/^(https?|ftp):\/\//i.test(row));
console.log(JSON.stringify({ links_ref: ref ?? 'working_tree', input_rows: rows.length, distinct_valid_hosts: hosts.length, name_prefix_counts: prefixCounts,
  first_match_by_card: byCard, bare: { count: bare.length, no_link: absent.length, missing_suffixes: suffixes,
    bare_regex_miss: regexMisses.length, bare_regex_miss_types: regexCategories,
    missing_ipv4: absent.filter(row => /^\d+(\.\d+){3}/.test(row)).length,
    missing_korean: absent.filter(row => /[가-힣]/.test(toDomain(row))).length, partial,
    after_csv_unquote_count: decodedBare.length, after_csv_unquote_no_link: decodedBare.filter(row => !findLinks(row).length).length } }, null, 2));
