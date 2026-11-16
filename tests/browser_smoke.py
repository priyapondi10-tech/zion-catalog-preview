"""Local Chromium regression checks. No production interactions or submissions."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import quote
import json
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT.parent)))
thread = Thread(target=server.serve_forever, daemon=True)
thread.start()
origin = f'http://127.0.0.1:{server.server_port}'
url = f'{origin}/{quote(ROOT.name)}/#roi'
checks = []
def passed(name):
    checks.append(name)
    print('PASS:', name)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(permissions=['clipboard-read', 'clipboard-write'], accept_downloads=True, viewport={'width': 1365, 'height': 900})
        page = context.new_page()
        errors, requests = [], []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
        page.on('request', lambda request: requests.append(request.url))
        page.goto(url)
        expect(page.locator('#wHours')).to_have_text('17.5 hrs')
        for key, value in {'mSave': '$4,929.17', 'monthlyNet': '$4,679.17', 'yearCosts': '$5,500.00', 'net': '$53,650.00', 'roiLine': '975.5%', 'payback': '0.5 months'}.items():
            expect(page.locator('#' + key)).to_have_text(value)
        passed('default model renders with complete year-one costs at a project subpath')

        for locator in page.locator('#roi input[type=number]').all():
            assert locator.evaluate('(el) => el.labels.length > 0 && el.labels[0].textContent.trim().length > 0')
            assert locator.get_attribute('aria-describedby')
        for locator in page.locator('#roi input[type=range]').all():
            assert locator.evaluate('(el) => Boolean(document.getElementById(el.getAttribute("aria-labelledby")))')
        expect(page.locator('#roi-status')).to_have_attribute('aria-live', 'polite')
        passed('number controls, sliders and dynamic status have accessible associations')

        page.locator('[data-scenario="15"]').click()
        expect(page.locator('#wHours')).to_have_text('15 hrs')
        page.locator('[data-scenario="20"]').click()
        expect(page.locator('#wHours')).to_have_text('20 hrs')
        expect(page.locator('[data-scenario="20"]')).to_have_attribute('aria-pressed', 'true')
        page.locator('#ongoing').fill('275')
        page.locator('[data-scenario="15"]').click()
        expect(page.locator('#ongoing')).to_have_value('275')
        expect(page.locator('#roi-plan')).to_have_value('custom')
        passed('15/20-hour scenarios work and preserve custom costs')

        page.locator('#roi-reset').click()
        page.locator('#cover-range').focus()
        page.keyboard.press('Home')
        expect(page.locator('#cover')).to_have_value('0')
        expect(page.locator('#wHours')).to_have_text('0 hrs')
        expect(page.locator('#payback')).to_have_text('No payback at these assumptions')
        page.keyboard.press('End')
        expect(page.locator('#cover')).to_have_value('100')
        expect(page.locator('#wHours')).to_have_text('25 hrs')
        page.locator('#rate').focus()
        page.keyboard.press('ArrowUp')
        expect(page.locator('#rate')).to_have_value('65.01')
        page.keyboard.press('Enter')
        assert page.url == url
        passed('keyboard sliders, precise entry and Enter do not submit or navigate')

        page.locator('#hours').fill('2.6')
        expect(page.locator('#hours')).to_have_attribute('aria-invalid', 'true')
        expect(page.locator('#roi-errors')).to_be_visible()
        expect(page.locator('#wHours')).to_have_text('—')
        expect(page.locator('#roi-copy')).to_be_disabled()
        expect(page.locator('#roi-download')).to_be_disabled()
        page.locator('#roi-reset').click()
        page.locator('#invest').fill('-1')
        expect(page.locator('#invest')).to_have_attribute('aria-invalid', 'true')
        page.locator('#invest').fill('')
        expect(page.locator('#invest')).to_have_attribute('aria-invalid', 'true')
        page.locator('#roi-reset').click()
        expect(page.locator('#roi-errors')).to_be_hidden()
        expect(page.locator('#roi-copy')).to_be_enabled()
        passed('invalid, negative and blank inputs clear stale results and block exports; reset recovers')

        page.locator('#roi-plan').select_option('growth')
        expect(page.locator('#ongoing')).to_have_value('8000')
        expect(page.locator('#invest')).to_have_value('0')
        expect(page.locator('#net')).to_have_text('-$36,850.00')
        expect(page.locator('#payback')).to_have_text('No payback at these assumptions')
        page.locator('#roi-plan').select_option('starter')
        expect(page.locator('#invest')).to_have_value('2500')
        expect(page.locator('#ongoing')).to_have_value('250')
        page.locator('#invest').fill('0')
        page.locator('#ongoing').fill('0')
        expect(page.locator('#roiLine')).to_have_text('Not defined (no modeled cost)')
        expect(page.locator('#payback')).to_have_text('Immediate (no upfront cost)')
        page.locator('#cover').fill('0')
        expect(page.locator('#payback')).to_have_text('No payback at these assumptions')
        passed('Starter/Growth context and zero-cost/no-payback states render correctly')

        page.locator('#roi-reset').click()
        page.locator('#roi-copy').click()
        expect(page.locator('#roi-action-status')).to_contain_text('Estimate copied locally')
        copied = page.evaluate('navigator.clipboard.readText()')
        assert '$53,650.00' in copied and 'not verified customer results' in copied
        with page.expect_download() as event:
            page.locator('#roi-download').click()
        downloaded = event.value
        assert downloaded.suggested_filename == 'zion-roi-estimate.txt'
        assert Path(downloaded.path()).read_text() == copied
        passed('clipboard and downloaded text match the full locally generated estimate')

        page.locator('#ready').focus()
        page.keyboard.press('End')
        expect(page.locator('#readyVal')).to_have_text('5')
        for anchor in page.locator('a[href="#roi"]').all():
            assert anchor.get_attribute('href') == '#roi'
        assert page.locator('a[href="#roi"]').count() >= 5
        passed('launch advisor readiness and all five ROI entry points remain functional')

        for width in [320, 390, 768, 1365]:
            page.set_viewport_size({'width': width, 'height': 900})
            assert page.locator('#roi').evaluate('(el) => el.scrollWidth <= el.clientWidth'), width
            for selector in ['#people', '#roi-plan', '#roi-copy', '#roi-download']:
                box = page.locator(selector).bounding_box()
                assert box and box['x'] >= 0 and box['x'] + box['width'] <= width + 1, (width, selector, box)
        page.emulate_media(reduced_motion='reduce')
        assert page.evaluate('getComputedStyle(document.documentElement).scrollBehavior') == 'auto'
        passed('calculator has no horizontal overflow at 320/390/768/1365px and honors reduced motion')

        assert not errors, errors
        assert all(request.startswith(origin + '/') or request.startswith('blob:') for request in requests), requests
        passed('no console/page errors or external network requests during interactions and exports')

        fallback_context = browser.new_context()
        fallback_context.add_init_script("Object.defineProperty(navigator, 'clipboard', {value: undefined})")
        fallback = fallback_context.new_page()
        fallback.goto(url)
        fallback.locator('#roi-copy').click()
        expect(fallback.locator('#roi-summary')).to_be_visible()
        assert '$53,650.00' in fallback.locator('#roi-summary').input_value()
        expect(fallback.locator('#roi-action-status')).to_contain_text('Nothing was sent')
        passed('clipboard-unavailable fallback exposes a selectable local summary')

        nojs_context = browser.new_context(java_script_enabled=False)
        nojs = nojs_context.new_page()
        nojs.goto(url)
        expect(nojs.locator('#roi noscript')).to_be_visible()
        expect(nojs.locator('#wHours')).to_have_text('—')
        expect(nojs.locator('#roi-copy')).to_be_disabled()
        expect(nojs.locator('.roi-method summary')).to_be_visible()
        passed('no-JavaScript fallback shows no frozen estimate and retains methodology')
        print(json.dumps({'browser': browser.version, 'passed': len(checks), 'checks': checks}, indent=2))
        browser.close()
finally:
    server.shutdown()
    server.server_close()
