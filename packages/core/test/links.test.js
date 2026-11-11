import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findLinks, toDomain } from '../src/links.js';
import { extractCodeSignals } from '../src/extract.js';

test('recognize eleven verified TLDs missed in bare KISA rows, without visiting them', () => {
  for (const tld of ['show', 'media', 'gold', 'vin', 'services', 'ski', 'pub', 'moe', 'mobi', 'baby', 'rent']) {
    const host = `synthetic-example.${tld}`;
    assert.deepEqual(findLinks(`확인 (${host}/check?a=1).`), [`${host}/check?a=1`]);
    assert.deepEqual(extractCodeSignals(`조회 ${host}/check`).domains, [host]);
    assert.deepEqual(findLinks(`확인 ${host.toUpperCase()} 후 연락`), [host.toUpperCase()]);
  }
});

test('do not convert decimals, versions, dates, email addresses or file paths into links', () => {
  for (const text of ['버전 1.2.3, v2.5.0, 2026.11.11', '금액 3.14와 0.001, 전화 010.1234.5678',
    '문서 report.pdf 사진 photo.jpg', 'user@example.media', 'user@www.example.com',
    '/folder/example.media', 'local/example.media', 'example.mediax', 'example.media-backup',
    'example.media.backup', 'example.secretbox', 'example.mcf', 'club']) {
    assert.deepEqual(findLinks(text), [], text);
  }
});

test('www inside a bare hostname does not truncate its beginning; terminal punctuation stays outside', () => {
  const full = 'synthetic.www.abc.example.com';
  assert.deepEqual(findLinks(`확인 ${full} 부탁`), [full]);
  assert.equal(toDomain(findLinks(full)[0]), full);
  assert.deepEqual(findLinks('synthetic.www.example.test'), ['synthetic.www.example.test']);
  assert.deepEqual(findLinks('확인 example.media. 다음 문장'), ['example.media']);
  assert.deepEqual(findLinks('www.example.com/path https://example.media/path'), ['www.example.com/path', 'https://example.media/path']);
});
