# Zion catalog preview — staging only

[Open the staging homepage](https://priyapondi10-tech.github.io/zion-catalog-preview/)

A clearly labeled non-production copy of the original main homepage, with three independent browser-only tools. Original root-relative catalog links resolve to the production Zion website; only the three new tools are hosted under this GitHub account. Production form submissions and direct payment links are disabled. No analytics or network API requests are allowed. Search indexing is disabled.

## Three apps

- [LLM KV Cache Planner](https://priyapondi10-tech.github.io/llm-kv-cache-planner/) — [source](https://github.com/priyapondi10-tech/llm-kv-cache-planner)
- [Retry & Backoff Lab](https://priyapondi10-tech.github.io/retry-backoff-lab/) — [source](https://github.com/priyapondi10-tech/retry-backoff-lab)
- [Webhook Signature Lab](https://priyapondi10-tech.github.io/webhook-signature-lab/) — [source](https://github.com/priyapondi10-tech/webhook-signature-lab)

## Provenance

Homepage source: https://github.com/Zion-support/zion-support.github.io/blob/main/public/index.html

Reviewed source Git blob SHA: `1730935fcdb782d8b973a7170b2dd7d76584ff00`. Branding and original homepage layout retained for attribution; this preview is not the official Zion production site. No changes were made to Zion-support, ziontechgroup.com, Cloudflare, or existing repositories.

## Hosting

GitHub Pages, default branch root, HTTPS. No CNAME or custom DNS.

## ROI planner (`#roi`)

The embedded planner runs entirely in the browser using `assets/roi.js` and scoped `assets/roi.css`. Header, jump card, footer and both ROI catalog cards lead to the local `#roi` anchor. Discovery, published plans and contact links are explicitly labelled as production-site navigation. No estimate is automatically submitted, stored, tracked or put in a URL. Copy and text downloads are local, with a manual-copy fallback.

### Illustrative inputs, not customer evidence

Reviewed November 16, 2026. The requested planning example is **not a measured or verified typical-customer benchmark**: 15–20 recovered hours/week, $65/hour and a $250/month maintenance allowance. The midpoint is 10 people × 2.5 eligible hours/person/week × 70% coverage = 17.5 hours/week. Eligible time is entered before coverage so it is not counted twice.

[Published USD plan reference](https://ziontechgroup.com/plans/): Starter $2,500 upfront; Growth $8,000/month. Starter's $250/month allowance is illustrative, not a published maintenance fee. Growth's $0 setup input is an editable assumption, not an offer. Consulting $499 is advisory, not automation delivery. Confirm prices, scope and additional costs before quoting. All values are USD; no FX conversion.

### Method and limitations

- Monthly recovered hours = weekly recovered hours × 52/12.
- Gross labor capacity value = recovered hours × hourly cost; this is not necessarily cash savings.
- Total modeled year-one cost = upfront implementation + 12 × ongoing monthly costs.
- Year-one net value = annual gross labor value − total modeled year-one cost.
- Year-one ROI = year-one net value / total modeled year-one cost × 100. It is undefined at zero cost.
- Simple payback = upfront implementation / positive net monthly capacity value; no modeled payback when net monthly value is nonpositive. Positive value with zero upfront cost is immediate.

The model assumes full run rate from month one. It excludes ramp-up, delays, taxes, financing, discounting and any unentered costs. Include tools, APIs, hosting, maintenance and other running costs. Display rounding does not affect calculations. Assumptions, formulas, sources and limitations are also visible on the page. The inherited unsourced “3.2x Average ROI” card next to the planner was replaced with scenario-based wording; unrelated inherited homepage claims were not validated by this change.

### Checks

Runtime: no packages or build step. Unit/static checks need Node.js 20+:

```sh
node --check assets/roi.js
node --test tests/roi.test.cjs
```

Optional Chromium regression checks (development dependencies only):

```sh
python -m pip install -r tests/browser-requirements.txt
python -m playwright install --with-deps chromium
python tests/browser_smoke.py
```

The browser script starts an ephemeral localhost server at a project subpath. It covers defaults, scenarios, validation/reset, negative/zero-cost results, keyboard interaction, accessible control associations, local copy/download and clipboard fallback, all five ROI entry points, the adjacent readiness control, no-JavaScript fallback, reduced motion, no horizontal calculator overflow at 320/390/768/1365px, and no console errors or external network requests during the tested flows. These are scoped regression checks, not a complete WCAG audit. No production forms or payment flows are exercised.
