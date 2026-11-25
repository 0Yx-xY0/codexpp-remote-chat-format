import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

path = Path(sys.argv[1])
html = path.read_text(encoding='utf-8')
markers = ['pairCode&&!token', '  if (pairCode && !token) {']
starts = [marker for marker in markers if html.count(marker) == 1]
assert len(starts) == 1, 'unexpected boot sequence'
start = starts[0]
head = html[:html.rindex(start)]
fixture = '''
  state.current = 'fixture';
  state.me = {role:'message'};
  m.setStyle('chat');
  window.fixtureApply = (turns, runtime) => applyView({title:'测试对话', turns, runtime});
})();
</script>
</body></html>
'''
html = head + fixture
bookmarklet = Path(sys.argv[2]).read_text(encoding="utf-8-sig").strip() if len(sys.argv) > 2 else None
origin = 'https://codex-format.test/'
marker = '\ue200cite\ue202turn6search1\ue202turn6search4\ue201'
user = '**我的原文** `命令`'
long_code = 'print(' + 'a' * 150 + ')'
reply = '\n'.join(['## 中文标题', '这是**加粗**和 `代码`。' + marker, '', '- 第一项', '- 第二项', '', '> 一条引用', '', '[项目文档](https://example.invalid/help)', '', '```py', long_code, '```', '', 'HTML 原文：<img src=x onerror="window.executed=true">', '', '[不是链接](javascript:alert(1))'])
stream = '继续输出 **未结束'

def run(page):
    errors = []
    unexpected = []
    page.on('pageerror', lambda exc: errors.append(str(exc)))
    def route(r):
        if r.request.url == origin:
            r.fulfill(status=200, content_type='text/html; charset=utf-8', body=html, headers={"Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data: blob:; manifest-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"})
        elif r.request.url == origin + 'favicon.ico':
            r.fulfill(status=204)
        else:
            unexpected.append(r.request.url)
            r.abort()
    page.route('**/*', route)
    page.goto(origin)
    assert not errors, errors
    turns = [{'items':[{'type':'userMessage','text':user},{'type':'agentMessage','text':reply}]}]
    page.evaluate('(turns) => fixtureApply(turns, "idle")', turns)
    if bookmarklet:
        # Simulate clicking a javascript: URL from the loaded page with Codex++'s CSP.
        page.on('dialog', lambda d: d.accept())
        page.evaluate('''url => {
          const a = document.createElement('a');
          a.id = 'testBookmarklet';
          a.href = url;
          a.textContent = 'test bookmarklet';
          Object.assign(a.style, {position:'fixed', zIndex:'10000', top:'0', left:'0', background:'white'});
          document.body.append(a);
        }''', bookmarklet)
        page.locator('#testBookmarklet').click()
    a = page.locator('#mLog .m-msg.in .m-bubble').first
    assert page.locator('#mInput').is_visible(), 'mobile chat input hidden'
    assert '我的原文' in page.locator('#mLog .m-msg.out .m-bubble').inner_text()
    assert not page.locator('#mLog .m-msg.out strong').count()
    from playwright.sync_api import expect
    expect(a.locator('strong')).to_have_count(1, timeout=2000)
    assert a.locator('strong').inner_text() == '加粗'
    assert a.locator('h4').inner_text() == '中文标题'
    assert a.locator('li').all_inner_texts() == ['第一项', '第二项']
    assert a.locator('blockquote').inner_text() == '一条引用'
    assert a.locator('a').count() == 1
    assert a.locator('a').get_attribute('href') == 'https://example.invalid/help'
    assert a.locator('code').all_inner_texts() == ['代码', long_code]
    assert a.locator('pre').evaluate('(e) => e.scrollWidth > e.clientWidth'), 'long code does not scroll within its block'
    assert 'turn6search' not in a.inner_text()
    assert not any(c in a.inner_text() for c in ('\ue200','\ue201','\ue202'))
    assert a.locator('.m-citation').all_inner_texts() == ['来源请在电脑端查看']
    assert '<img' in a.inner_text() and a.locator('img').count() == 0
    assert not page.evaluate('Boolean(window.executed)')
    assert page.locator('#mLog').evaluate('e => e.scrollWidth <= e.clientWidth + 1'), 'chat overflow'
    turns.append({'items':[{'type':'agentMessage','text':stream}]})
    page.locator('#mInput').fill('输入草稿')
    page.evaluate('(turns) => fixtureApply(turns, "active")', turns)
    b = page.locator('#mLog .m-msg.in .m-bubble').last
    assert '未结束' in b.inner_text()
    turns[-1]['items'][0]['text'] = stream + '**。' + marker[:-1]
    page.evaluate('(turns) => fixtureApply(turns, "active")', turns)
    assert b.locator('strong').inner_text() == '未结束' and 'turn6search' not in b.inner_text()
    turns[-1]['items'][0]['text'] += marker[-1]
    page.evaluate('(turns) => fixtureApply(turns, "idle")', turns)
    assert b.locator('.m-citation').count() == 1
    assert page.locator('#mInput').input_value() == '输入草稿'
    assert page.locator('#log .cx-agent').first.locator('strong').inner_text() == '加粗'
    assert not page.locator('#log .m-citation').count(), 'desktop behavior changed'
    assert not errors, errors
    assert not unexpected, unexpected

with sync_playwright() as pw:
    browser = pw.chromium.launch(channel='chrome',headless=True)
    for width, theme in [(360,'light'),(390,'dark'),(430,'light')]:
        ctx = browser.new_context(viewport={'width':width,'height':844},is_mobile=True,has_touch=True,color_scheme=theme,service_workers='block')
        run(ctx.new_page())
        ctx.close()
        print(f'PASS Chrome {browser.version} / {width}px / {theme}')
    browser.close()
