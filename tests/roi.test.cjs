'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const roi = require('../assets/roi.js');
const input = overrides => ({ ...roi.defaults, ...overrides });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('Starter midpoint uses 17.5 saved hours, $65/hour and complete year-one cost', () => {
  const r = roi.calculate(input());
  close(r.weeklyHours, 17.5); close(r.monthlyHours, 17.5 * 52 / 12);
  close(r.monthlyGross, 59150 / 12); close(r.monthlyNet, 59150 / 12 - 250);
  close(r.annualGross, 59150); close(r.annualOngoing, 3000);
  close(r.annualCost, 5500); close(r.annualNet, 53650);
  close(r.roi, 53650 / 5500 * 100); close(r.payback, 2500 / (59150 / 12 - 250));
});
for (const [hours, cover, annual] of [[15, 60, 50700], [17.5, 70, 59150], [20, 80, 67600]]) {
  test(`illustrative ${hours}-hour scenario applies coverage exactly once`, () => {
    const r = roi.calculate(input({ cover }));
    close(r.weeklyHours, hours); close(r.annualGross, annual);
    close(r.annualNet, annual - 5500);
  });
}
for (const [name, overrides] of [['zero coverage', { cover: 0 }], ['zero eligible hours', { hours: 0 }], ['zero hourly value', { rate: 0 }]]) {
  test(`${name} has no modeled payback`, () => {
    const r = roi.calculate(input(overrides));
    close(r.annualGross, 0); close(r.annualNet, -5500); close(r.roi, -100);
    assert.equal(r.payback, null);
    assert.equal(roi.paybackText(r), 'No payback at these assumptions');
  });
}
test('recurring costs equal to monthly gross value produce no payback', () => {
  const r = roi.calculate(input({ people: 1, hours: 1, cover: 100, rate: 12, ongoing: 52 }));
  close(r.monthlyNet, 0); assert.equal(r.payback, null);
});
test('Growth retainer can produce a negative result; no invented setup quote', () => {
  const r = roi.calculate(input({ invest: roi.plans.growth.invest, ongoing: roi.plans.growth.ongoing }));
  close(r.annualCost, 96000); close(r.annualNet, -36850);
  assert.ok(r.monthlyNet < 0); assert.equal(r.payback, null);
});
test('zero upfront cost with positive net value is immediate', () => {
  const r = roi.calculate(input({ invest: 0 }));
  assert.equal(r.payback, 0); assert.equal(roi.paybackText(r), 'Immediate (no upfront cost)');
});
test('zero total costs have undefined ROI, not an infinite percentage', () => {
  const r = roi.calculate(input({ invest: 0, ongoing: 0 }));
  assert.equal(r.roi, null); assert.match(roi.percent(r.roi), /Not defined/);
});
test('zero cost and zero value do not imply instant payback', () => {
  const r = roi.calculate(input({ invest: 0, ongoing: 0, cover: 0 }));
  assert.equal(r.roi, null); assert.equal(r.payback, null); close(r.annualNet, 0);
});
test('short positive payback is not rounded to zero', () => {
  assert.equal(roi.paybackText(roi.calculate(input({ invest: 1 }))), '<0.1 months');
});
test('long payback is marked as outside the modeled year', () => {
  assert.match(roi.paybackText(roi.calculate(input({ invest: 1000000 }))), /beyond year one/);
});
test('small positive hour values remain visibly nonzero', () => {
  assert.equal(roi.hours(0.0025), '<0.1'); assert.equal(roi.hours(0), '0');
});
for (const [name, overrides] of [
  ['blank', { rate: NaN }], ['infinite', { invest: Infinity }], ['string', { rate: '65' }],
  ['negative cost', { ongoing: -1 }], ['out-of-range coverage', { cover: 101 }],
  ['fractional people', { people: 1.5 }], ['invalid hour increment', { hours: 2.6 }],
  ['invalid currency precision', { rate: 65.001 }], ['fractional setup cost', { invest: 2500.5 }],
  ['team too large', { people: 501 }], ['cost too large', { invest: 1000001 }]
]) {
  test(`validation rejects ${name}`, () => {
    assert.ok(Object.keys(roi.validate(input(overrides))).length);
    assert.throws(() => roi.calculate(input(overrides)), RangeError);
  });
}
test('missing inputs are rejected without a type error', () => {
  assert.equal(Object.keys(roi.validate(null)).length, 6);
  assert.throws(() => roi.calculate({}), RangeError);
});
test('maximum supported values stay finite', () => {
  const maximum = Object.fromEntries(Object.entries(roi.fields).map(([key, config]) => [key, config[2]]));
  for (const value of Object.values(roi.calculate(maximum))) assert.ok(value === null || Number.isFinite(value));
});
test('one-person workflow and precise hourly rate are valid', () => {
  assert.deepEqual(roi.validate(input({ people: 1, rate: 65.25, hours: 0.25 })), {});
});
test('calculations do not mutate inputs and preserve unrounded values', () => {
  const original = Object.freeze(input());
  const r = roi.calculate(original);
  assert.ok(Object.isFrozen(r)); close(r.monthlyGross * 12, r.annualGross);
  assert.deepEqual(original, roi.defaults);
});
test('summary contains costs, formulas, provenance and no transmission claim', () => {
  const text = roi.buildSummary(input(), roi.calculate(input()));
  for (const term of ['17.5', '$65.00', '$250.00', '$5,500.00', '$53,650.00', '52/12', 'not verified', 'No estimate was submitted', 'https://ziontechgroup.com/plans/']) assert.ok(text.includes(term), term);
  assert.doesNotMatch(text, /\b(?:NaN|Infinity)\b/);
});

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const section = html.match(/<section class="wrap" id="roi"[\s\S]*?<\/section>/)[0];
test('number inputs match the tested model defaults, bounds and steps', () => {
  for (const [key, [, min, max, step]] of Object.entries(roi.fields)) {
    const tag = section.match(new RegExp('<input id="' + key + '"[^>]*>'))[0];
    for (const [attr, value] of Object.entries({ min, max, step, value: roi.defaults[key] })) {
      assert.equal(Number(tag.match(new RegExp('\\b' + attr + '="([^"]+)"'))[1]), value, key + ' ' + attr);
    }
    assert.match(section, new RegExp('<label[^>]*for="' + key + '"'));
    assert.ok(tag.includes('aria-describedby="' + key + '-help ' + key + '-error"'));
  }
});
test('page fragments resolve and IDs are unique', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(id), id);
});
test('calculator entry points stay in the preview and stale destinations are removed', () => {
  assert.doesNotMatch(html, /href="https:\/\/ziontechgroup\.com\/(?:tools\/roi-calculator|roi-calc)\//);
  assert.ok([...html.matchAll(/href="#roi"/g)].length >= 5);
  assert.doesNotMatch(html, /<b>3\.2x<\/b>Average ROI/);
});
test('staging CSP, noindex, robots and production protections are retained', () => {
  for (const term of ["connect-src 'none'", "form-action 'none'", 'noindex,nofollow', 'STAGING PREVIEW — NOT THE PRODUCTION SITE']) assert.ok(html.includes(term));
  assert.match(fs.readFileSync(path.join(root, 'robots.txt'), 'utf8'), /Disallow: \//);
  assert.ok(fs.existsSync(path.join(root, '.nojekyll')));
  assert.doesNotMatch(section, /https:\/\/buy\.stripe\.com/);
});
test('runtime has no network API and the launch advisor interaction remains', () => {
  const source = fs.readFileSync(path.join(root, 'assets/roi.js'), 'utf8');
  assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(/);
  assert.ok(html.includes("document.getElementById('ready').addEventListener('input'"));
  assert.match(html, /<script src="\.\/assets\/roi\.js" defer=""><\/script>/);
});
