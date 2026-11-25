const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.CODEX_PLAYWRIGHT || 'playwright');
const raw = fs.readFileSync(process.argv[2], 'utf8');
const marker = 'pairCode&&!token';
assert.equal(raw.split(marker).length, 2, 'installed-page boot marker');
const fixture = raw.slice(0, raw.indexOf(marker)) + `
  state.me = {role:'full',kind:'device',name:'手机',host:'我的电脑'};
  m.setStyle('chat');
  m.onRole();
  window.showChat = (view, options) => {
    state.current = 'width-fixture';
    m.setStyle('chat');
    state.optionsFor = state.current;
    state.options = options;
    applyView(view);
  };
  window.showList = threads => { state.threads = threads; m.onThreads(); };
})();\n</script></body></html>`;
const cwd = 'E:\\project\\' + 'LongDirectoryName'.repeat(11);
const long = 'LongUnbrokenText'.repeat(16);
const file = `${long}.docx`;
const code = `const value = "FIRST_${long}_LAST";`;
const expression = `a_0 + ${Array.from({ length: 30 }, (_, i) => `x_{${i+1}}^2`).join(' + ')} + z_{99}`;
const model = 'model-' + 'LongModelName'.repeat(12);
const controls = { model, effort:'high', permissionMode:'custom' };
const options = { models:[{ id:model, label:model, description:long }], permissionModes:[], current:controls };
const items = [
  { type:'agentMessage', text:['普通文本 https://example.invalid/'+long, `[${long}](https://example.invalid/path)`, '```js',code,'```', '', `短公式：\\(x^2\\)`, `长行内：\\(${expression}\\)`, `\\[${expression}\\]`, '\\[a^2+b^2=c^2\\]'].join('\n') },
  { type:'userMessage', text:cwd, attachments:[{ name:file,mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },{name:long+'.xlsx',mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}] },
  { type:'webSearch', query:long },
  { type:'modelChanged', toModel:model }
];
const view = { title:long, cwd, live:true, runtime:'idle', controls, tokenUsage:{used:84523,window:258400}, turns:[{startedAtMs:Date.now(),items}] };
const origin = 'https://codex-width.test/';
const problems = [];
function expect(ok, detail) { if(!ok) problems.push(detail); }
async function measure(page, selector) {
  return page.locator(selector).evaluate(e=>{
    const rect=e.getBoundingClientRect();
    const initial=e.scrollLeft;
    e.scrollLeft=1e6;
    const offset=e.scrollLeft;
    e.scrollLeft=initial;
    return {client:e.clientWidth,scroll:e.scrollWidth,offset,left:Math.round(rect.left),right:Math.round(rect.right),x:getComputedStyle(e).overflowX};
  });
}
async function fits(page, selector, label) {
  const result=await measure(page,selector);
  expect(result.scroll<=result.client+1 && result.offset<=1,`${label} ${selector}: ${JSON.stringify(result)}`);
}
async function localScroll(page,selector,label,inner) {
  const target=page.locator(selector);
  const metrics=await target.evaluate((e,inner)=>{
    const child=e.querySelector(inner);
    const initial=e.scrollLeft;
    e.scrollLeft=0;
    const start=child.getBoundingClientRect().left-e.getBoundingClientRect().left;
    e.scrollLeft=1e6;
    const end=child.getBoundingClientRect().right-e.getBoundingClientRect().right;
    const range=e.scrollLeft;
    e.scrollLeft=initial;
    return {start,end,range};
  },inner);
  expect(metrics.range>10 && metrics.start>=-1 && metrics.end<=1, `${label} ${selector}: expected both ends reachable ${JSON.stringify(metrics)}`);
}
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    for(const [width,height,scheme] of [[320,640,'light'],[390,844,'dark'],[430,932,'light'],[844,390,'light'],[932,430,'dark']]) {
      const label=`${width}x${height} ${scheme}`;
      const wide=width>=900;
      const ctx=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:3,colorScheme:scheme,serviceWorkers:'block'});
      const page=await ctx.newPage();
      page.setDefaultTimeout(3000);
      const errors=[];
      page.on('pageerror', e=>errors.push(e.message));
      await page.route('**/*', r=>{
        const url=r.request().url();
        if(url===origin) return r.fulfill({status:200,contentType:'text/html; charset=UTF-8',body:fixture,
          headers:{'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'"}});
        if(url===origin+'favicon.ico') return r.fulfill({status:204});
        if(url===origin+'api/threads') return r.fulfill({json:{threads:[]}});
        errors.push(url); return r.abort();
      });
      await page.goto(origin);
      await page.evaluate(v=>showList([{id:'width-fixture',title:v.title,cwd:v.cwd,preview:v.cwd,updatedAt:Math.floor(Date.now()/1000)}]),view);
      assert.ok(await page.locator('#mRows .m-row').first().isVisible());
      await fits(page,'#mRows',label+' populated list');
      await page.evaluate(({view,options})=>showChat(view,options),{view,options});
      assert.equal(await page.evaluate(()=>window.innerWidth),width,'mobile viewport meta active');
      assert.ok(await page.locator('#mLog .m-answer').isVisible());
      for(const selector of ['html','body','.m','#mChat','#mLog','#mChips','#mLog .m-tip:nth-last-child(1)']) await fits(page,selector,label);
      const title=await page.locator('#mChatTitle').evaluate(e=>({own:e.getBoundingClientRect().width,parent:e.parentElement.clientWidth}));
      expect(title.own<=title.parent+1,`${label} oversized chat title: ${JSON.stringify(title)}`);
      assert.equal(await page.locator('#mLog .m-file').count(),2);
      assert.equal(await page.locator('#mLog .m-math math').count(),4);
      await localScroll(page,'#mLog .m-answer pre',label,'code');
      await localScroll(page,'#mLog .m-math:not(.display) >> nth=1',label,'math');
      await localScroll(page,'#mLog .m-math.display >> nth=0',label,'math');
      const centered=await page.locator('#mLog .m-math.display math').last().evaluate(e=>{
        const a=e.getBoundingClientRect(),r=e.parentElement.getBoundingClientRect();
        return Math.abs((a.left+a.right-r.left-r.right)/2)<2;
      });
      expect(centered,`${label} short display math lost centering`);
      await page.locator('#mChatMore').tap();
      assert.ok(await page.locator('.m-sheet-body').isVisible());
      for(const selector of ['html','.m-sheet','.m-sheet-body','.m-sheet .opt small']) await fits(page,selector,label+' more menu');
      if(wide) await page.touchscreen.tap(12,12);
      else await page.locator('.m-sheet .cancel').tap();
      await page.locator('#mChips button').nth(2).tap();
      assert.ok(await page.locator('.m-sheet .label').first().isVisible());
      for(const selector of ['.m-sheet-body','.m-sheet .label','.m-sheet .label small']) await fits(page,selector,label+' model menu');
      if(wide) await page.touchscreen.tap(12,12);
      else await page.locator('.m-sheet .cancel').tap();
      // Drag within an ordinary message, not within an intentional local scroller.
      const surface=page.locator('#mLog');
      const tip=page.locator('#mLog .m-tip').last();
      await tip.evaluate(e=>e.scrollIntoView({block:'center',inline:'nearest'}));
      await surface.evaluate(e=>e.scrollLeft=0);
      const rect=await tip.boundingBox();
      const frame=await surface.boundingBox();
      const cdp=await ctx.newCDPSession(page);
      const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
      const x=Math.round(frame.x+frame.width*.76), y=Math.round((Math.max(rect.y,frame.y)+Math.min(rect.y+rect.height,frame.y+frame.height))/2);
      await touch('touchStart',[{x,y}]);
      for(let i=1;i<=8;i++) await touch('touchMove',[{x:Math.round(x-i*frame.width*.06),y}]);
      await touch('touchCancel',[]);
      await cdp.detach();
      const swipe=await surface.evaluate(e=>e.scrollLeft);
      expect(swipe<=1,`${label} horizontal touch drag panned chat ${swipe}px`);
      await surface.evaluate(e=>e.scrollLeft=0);
      const back = page.locator('#mChatBack');
      if(!wide) expect(await back.evaluate(e=>{
        const r=e.getBoundingClientRect();
        return e.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));
      }),`${label} chat title overlaps back button`);
      if(!wide) await back.evaluate(e=>e.click());
      await fits(page,'#mRows',label+' list');
      await page.locator('#mTabSettings').tap();
      await fits(page,'#mSettingsBody',label+' settings');
      assert.deepEqual(errors,[]);
      console.log(label,problems.filter(s=>s.startsWith(label)));
      await ctx.close();
    }
    assert.equal(problems.length,0,`${problems.length} width regressions in Chrome ${browser.version()}`);
    console.log(`PASS Chrome ${browser.version()}: 5 mobile profiles; document, messages, controls, menus, local code/MathML scrolling`);
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
