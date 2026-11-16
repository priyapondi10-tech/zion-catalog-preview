/* Local-only ROI planning model and UI. No runtime dependencies or network calls. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root.document) api.mount(root.document);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const defaults = Object.freeze({ people: 10, rate: 65, hours: 2.5, cover: 70, invest: 2500, ongoing: 250 });
  const fields = Object.freeze({
    people: ['Team members', 1, 500, 1],
    rate: ['Hourly cost', 0, 1000, 0.01],
    hours: ['Workflow hours per person', 0, 40, 0.25],
    cover: ['Automation coverage', 0, 100, 1],
    invest: ['Upfront implementation cost', 0, 1000000, 1],
    ongoing: ['Ongoing monthly costs', 0, 100000, 1]
  });
  const plans = Object.freeze({
    starter: { invest: 2500, ongoing: 250, note: '$2,500 upfront is the published Starter price. $250/month is an illustrative maintenance allowance, not a published fee. Add any tools, API, hosting or other running costs.' },
    growth: { invest: 0, ongoing: 8000, note: '$8,000/month is the published Growth retainer. $0 setup is an editable assumption, not a quote or promise. Include any quoted setup cost and confirm the service scope.' },
    custom: { note: 'Use your quote and full running costs, including implementation, tools, APIs, hosting and maintenance. All amounts are USD; no currency conversion is performed.' }
  });
  const reviewed = '2026-11-16';
  const money = n => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const hours = n => n > 0 && n < 0.1 ? '<0.1' : n.toLocaleString('en-US', { maximumFractionDigits: 1 });
  const percent = n => n === null ? 'Not defined (no modeled cost)' : n.toLocaleString('en-US', { maximumFractionDigits: 1 }) + '%';

  function validate(input) {
    const errors = {};
    for (const [key, [label, min, max, step]] of Object.entries(fields)) {
      const value = input && input[key];
      if (typeof value !== 'number' || !Number.isFinite(value)) errors[key] = label + ': enter a number.';
      else if (value < min || value > max) errors[key] = label + ': use ' + min + ' to ' + max + '.';
      else if (Math.abs((value - min) / step - Math.round((value - min) / step)) > 0.000001) errors[key] = label + ': use increments of ' + step + '.';
    }
    return errors;
  }

  function calculate(input) {
    const errors = validate(input);
    if (Object.keys(errors).length) throw new RangeError(Object.values(errors).join(' '));
    const weeklyHours = input.people * input.hours * input.cover / 100;
    const monthlyHours = weeklyHours * 52 / 12;
    const monthlyGross = monthlyHours * input.rate;
    const monthlyNet = monthlyGross - input.ongoing;
    const annualGross = weeklyHours * 52 * input.rate;
    const annualOngoing = input.ongoing * 12;
    const annualCost = input.invest + annualOngoing;
    const annualNet = annualGross - annualCost;
    return Object.freeze({ weeklyHours, monthlyHours, monthlyGross, monthlyNet, annualGross, annualOngoing, annualCost, annualNet,
      roi: annualCost > 0 ? annualNet / annualCost * 100 : null,
      payback: monthlyNet > 0 ? input.invest / monthlyNet : null });
  }

  function paybackText(result) {
    if (result.payback === null) return 'No payback at these assumptions';
    if (result.payback === 0) return 'Immediate (no upfront cost)';
    if (result.payback < 0.1) return '<0.1 months';
    return result.payback.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' months' + (result.payback > 12 ? ' (beyond year one)' : '');
  }

  function buildSummary(input, result) {
    return [
      'Zion ROI planning estimate — illustrative, not verified customer results',
      'All amounts USD. Potential labor capacity value is not guaranteed cash savings.',
      'Model and published plan references reviewed: ' + reviewed,
      '', 'INPUTS',
      'Team members: ' + input.people,
      'Eligible workflow hours/person/week (before coverage): ' + input.hours,
      'Automation coverage: ' + input.cover + '%',
      'Blended hourly cost: ' + money(input.rate),
      'Upfront implementation: ' + money(input.invest),
      'Ongoing costs/month: ' + money(input.ongoing),
      '', 'MODELED RESULTS',
      'Hours recovered/week: ' + hours(result.weeklyHours),
      'Hours recovered/month: ' + hours(result.monthlyHours),
      'Gross labor value/month: ' + money(result.monthlyGross),
      'Ongoing costs/month: ' + money(input.ongoing),
      'Net capacity value/month: ' + money(result.monthlyNet),
      'Gross labor value/year: ' + money(result.annualGross),
      'Ongoing costs/year: ' + money(result.annualOngoing),
      'Total modeled year-one cost: ' + money(result.annualCost),
      'Net value/year one: ' + money(result.annualNet),
      'Year-one ROI (net value / total year-one cost): ' + percent(result.roi),
      'Simple payback: ' + paybackText(result),
      '', 'METHOD',
      'Weekly hours = people × eligible hours/person × coverage. Months use 52/12 weeks.',
      'Year-one ROI = (annual gross labor value − upfront cost − 12 × monthly costs) / (upfront cost + 12 × monthly costs).',
      'Payback = upfront cost / net monthly capacity value; no payback when net monthly value is nonpositive.',
      'Full run rate from month one; excludes ramp-up, taxes, financing, discounting and unentered costs.',
      'Defaults (15–20 saved hours/week, $65/hour and $250/month) are illustrative planning assumptions, not measured typical customer benchmarks.',
      'Published plan context: https://ziontechgroup.com/plans/ — confirm scope and current prices.',
      'Generated locally. No estimate was submitted or sent.'
    ].join('\n');
  }

  function mount(doc) {
    const section = doc.getElementById('roi');
    if (!section || section.dataset.roiMounted) return;
    const form = doc.getElementById('roi-form');
    if (!form) return;
    section.dataset.roiMounted = 'true';
    const win = doc.defaultView;
    const keys = Object.keys(fields);
    const inputs = Object.fromEntries(keys.map(key => [key, doc.getElementById(key)]));
    const plan = doc.getElementById('roi-plan');
    const copy = doc.getElementById('roi-copy');
    const download = doc.getElementById('roi-download');
    const summary = doc.getElementById('roi-summary');
    const actionStatus = doc.getElementById('roi-action-status');
    const live = doc.getElementById('roi-status');
    const outputIds = ['wHours', 'mHours', 'mSave', 'monthlyCosts', 'monthlyNet', 'ySave', 'upfrontCost', 'yearRecurring', 'yearCosts', 'net', 'roiLine', 'payback'];
    let lastInput = null, lastResult = null, liveTimer;
    function setValue(key, value) {
      inputs[key].value = value;
      const slider = doc.getElementById(key + '-range');
      if (slider) slider.value = value;
    }
    function planNote() { doc.getElementById('roi-plan-note').textContent = plans[plan.value].note; }
    function render() {
      const input = Object.fromEntries(keys.map(key => [key, inputs[key].valueAsNumber]));
      const errors = validate(input);
      for (const key of keys) {
        const error = doc.getElementById(key + '-error');
        error.textContent = errors[key] || '';
        inputs[key].setAttribute('aria-invalid', String(Boolean(errors[key])));
        const slider = doc.getElementById(key + '-range');
        if (slider && !errors[key]) slider.value = input[key];
      }
      const invalid = Object.keys(errors).length > 0;
      doc.getElementById('roi-errors').hidden = !invalid;
      copy.disabled = download.disabled = invalid;
      summary.hidden = true;
      actionStatus.textContent = '';
      win.clearTimeout(liveTimer);
      for (const button of section.querySelectorAll('[data-scenario]')) {
        const selected = input.people === 10 && input.hours === 2.5 && input.rate === 65 && input.cover === Number(button.dataset.scenario) * 4;
        button.setAttribute('aria-pressed', String(selected));
      }
      if (invalid) {
        lastInput = lastResult = null;
        for (const id of outputIds) doc.getElementById(id).textContent = '—';
        doc.getElementById('roi-results').removeAttribute('data-negative');
        live.textContent = 'Estimate unavailable. Correct the highlighted inputs.';
        return;
      }
      const result = calculate(input);
      const values = {
        wHours: hours(result.weeklyHours) + ' hrs', mHours: hours(result.monthlyHours) + ' hrs',
        mSave: money(result.monthlyGross), monthlyCosts: money(input.ongoing), monthlyNet: money(result.monthlyNet),
        ySave: money(result.annualGross), upfrontCost: money(input.invest), yearRecurring: money(result.annualOngoing),
        yearCosts: money(result.annualCost), net: money(result.annualNet), roiLine: percent(result.roi), payback: paybackText(result)
      };
      for (const [id, value] of Object.entries(values)) doc.getElementById(id).textContent = value;
      doc.getElementById('roi-results').dataset.negative = String(result.annualNet < 0);
      lastInput = input;
      lastResult = result;
      liveTimer = win.setTimeout(() => { live.textContent = 'Estimate updated. ' + hours(result.weeklyHours) + ' hours recovered weekly. Year-one net capacity value: ' + money(result.annualNet) + '. ' + paybackText(result) + '.'; }, 250);
    }
    form.addEventListener('submit', event => event.preventDefault());
    for (const key of keys) {
      const changed = () => {
        if (key === 'invest' || key === 'ongoing') { plan.value = 'custom'; planNote(); }
        render();
      };
      inputs[key].addEventListener('input', changed);
      const slider = doc.getElementById(key + '-range');
      if (slider) slider.addEventListener('input', () => { inputs[key].value = slider.value; changed(); });
    }
    plan.addEventListener('change', () => {
      if (plan.value !== 'custom') for (const key of ['invest', 'ongoing']) setValue(key, plans[plan.value][key]);
      planNote(); render();
    });
    for (const button of section.querySelectorAll('[data-scenario]')) {
      button.addEventListener('click', () => {
        for (const key of ['people', 'hours', 'rate']) setValue(key, defaults[key]);
        setValue('cover', Number(button.dataset.scenario) * 4);
        render();
      });
    }
    doc.getElementById('roi-reset').addEventListener('click', () => {
      for (const key of keys) setValue(key, defaults[key]);
      plan.value = 'starter'; planNote(); render();
      actionStatus.textContent = 'Illustrative Starter defaults restored.';
    });
    copy.addEventListener('click', async () => {
      if (!lastResult) return;
      const text = buildSummary(lastInput, lastResult);
      try {
        if (!win.navigator.clipboard) throw new Error('Clipboard unavailable');
        await win.navigator.clipboard.writeText(text);
        actionStatus.textContent = 'Estimate copied locally. Nothing was sent to Zion.';
      } catch (_) {
        summary.value = text; summary.hidden = false; summary.focus(); summary.select();
        actionStatus.textContent = 'Clipboard unavailable. Select and copy the local summary below. Nothing was sent.';
      }
    });
    download.addEventListener('click', () => {
      if (!lastResult) return;
      const url = win.URL.createObjectURL(new win.Blob([buildSummary(lastInput, lastResult)], { type: 'text/plain;charset=utf-8' }));
      const link = doc.createElement('a'); link.href = url; link.download = 'zion-roi-estimate.txt';
      doc.body.append(link); link.click(); link.remove();
      win.setTimeout(() => win.URL.revokeObjectURL(url), 1000);
      actionStatus.textContent = 'Estimate downloaded locally. Nothing was sent to Zion.';
    });
    planNote(); render();
  }
  return Object.freeze({ defaults, fields, plans, reviewed, validate, calculate, money, hours, percent, paybackText, buildSummary, mount });
});
