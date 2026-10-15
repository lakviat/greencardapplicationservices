import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const window = {};
vm.runInNewContext(readFileSync('assets/passport-autofill.js', 'utf8'), { window, document: {querySelector: () => null} });
const parse = (text) => JSON.parse(JSON.stringify(window.gcasPassport.parsePassport(text, ['Kyrgyzstan', 'Kazakhstan', 'Germany', 'Russia'])));
test('TD3 names remain separate from issuing country and nationality', () => {
  assert.deepEqual(parse('P<KGZTESTER<<JANE<ANNA<<<<<<<<<<<<<<<<<<<<<<<<<\nAB12345678KGZ7001011F3001019<<<<<<<<<<<<<<<<<00'), {
    firstName: 'JANE ANNA', lastName: 'TESTER', middleName: '', country: '',
  });
});
test('explicit birth country may differ from passport nationality', () => {
  const result = parse('SURNAME: TESTER\nGIVEN NAMES: JANE\nNATIONALITY: KYRGYZSTAN\nPLACE OF BIRTH: ALMATY, KAZAKHSTAN');
  assert.equal(result.country, 'Kazakhstan');
  assert.equal(result.firstName, 'JANE'); assert.equal(result.lastName, 'TESTER');
  assert.equal(parse('NATIONALITY: GERMANY\nPLACE OF BIRTH: BERLIN').country, '');
});
test('ambiguous or unreadable values remain empty and explicit middle name is preserved', () => {
  assert.equal(parse('some random text').firstName, '');
  assert.equal(parse('PLACE OF BIRTH: UTOPIA').country, '');
  assert.equal(parse('SURNAME\nTESTER\nFIRST NAME\nJANE\nMIDDLE NAME\nANNA').middleName, 'ANNA');
});
test('all applicants display first, last, middle; scan controls never submit', () => {
  const html = readFileSync('index.html', 'utf8');
  for (const prefix of ['', 'applicant2', 'applicant3']) {
    const names = prefix ? ['FirstName', 'LastName', 'MiddleName'] : ['firstName','lastName','middleName'];
    const positions = names.map(name => html.indexOf(`name="${prefix}${name}"`));
    assert(positions.every(p => p >= 0));
    assert(positions[0] < positions[1] && positions[1] < positions[2]);
  }
  for (const button of html.matchAll(/<button[^>]*data-passport-[^>]*>/g)) assert.match(button[0], /type="button"/);
});
