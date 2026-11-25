const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.CODEX_PLAYWRIGHT || 'playwright');
const [source, shots] = process.argv.slice(2);
const raw = fs.readFileSync(source, 'utf8');
const boot = 'pairCode&&!token';
assert.equal(raw.split(boot).length, 2);
const fixture = raw.split(boot)[0] + `
  state.me = {role:'full',kind:'device',name:'手机',host:'我的电脑'};
  m.setStyle('chat'); m.onRole();
  window.loadFixture = loadThreads;
  window.setRuntime = running => applyView({...state.view,runtime:running?'active':'idle'});
})();\n</script></body></html>`;
const t = Math.floor(Date.now()/1000)-300;
const cwd = String.raw`C:\Users\Demo\Projects\Sample`;
const base = {cwd,updatedAt:t,status:'notLoaded'};
const threads = [
  {...base,id:'a',title:cwd,preview:'为远程页整理说明',updatedAt:t-9,status:'active'},
  {...base,id:'c',title:cwd,updatedAt:t-4,preview:`# Files mentioned by the user:\n\n## picture.png: ${cwd}\\picture.png\nImage attachment: true\n\n## My request:\n检查参数估计公式的显示`},
  {...base,id:'b',title:'远程查看 Word 和 Excel',preview:'检查 Excel 表格预览',updatedAt:t-5},
  {...base,id:'a',title:'远程查看 Word 和 Excel',preview:'修复远程聊天列表',updatedAt:t},
  {...base,id:'a',title:cwd,preview:'旧版本',updatedAt:t-50},
  {...base,id:'b',title:'远程查看 Word 和 Excel',preview:'旧版本',updatedAt:t-60},
  {...base,id:'d',title:'',preview:`# Files mentioned by the user:\n## x.png: ${cwd}\\x.png`,updatedAt:t-70},
];
const origin='https://codex-direct.test/';
const long = '超长模型名'.repeat(28);
const view = {title:cwd, runtime:'idle', live:false, model:long,
  controls:{model:long}, tokenUsage:{used:12300,window:128000}, turns:[{startedAtMs:t*1000,items:[
    { type:'userMessage', text:'请修复移动端远程聊天列表。' },
    { type:'agentMessage', timestampMs:String(t*1000), text:'首页按最近活动显示每个会话。公式测试：\\(\u03b1_1 + x^2\\)。' }
,
    { type:'userMessage', text:'短消息' },
    { type:'userMessage', text:'这是一个较长的连续消息，需要在手机窄屏中自然换行。'.repeat(5) },
    { type:'agentMessage', text:'已收到这组连续消息。' },
    { type:'commandExecution', id:'cmd-1', command:['echo','done'], status:'completed', aggregatedOutput:'执行细节内容\n第二行' },
    { type:'commandExecution', id:'cmd-2', command:['echo','again'], status:'completed', aggregatedOutput:'其他细节' },
    { type:'agentMessage', text:'最终答复已准备好。' }
  ]}]};
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const failures=[];
  try {
    for(const [width,height,mobile,scheme] of [[320,640,true,'light'],[390,844,true,'light'],[390,844,true,'dark'],[932,430,true,'light'],[1200,900,false,'light']]) {
      const key=`${width}x${height} ${scheme}`;
      const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,colorScheme:scheme,serviceWorkers:'block'});
      const page=await context.newPage(); page.setDefaultTimeout(2300);
      const errors=[], opened=[], writes=[];
      let listing = threads;
      page.on('pageerror',e=>errors.push(e.message));
      await page.routeWebSocket(`${origin.replace('https','wss')}api/threads/**`,()=>{});
      await page.route('**/*', r=>{
        const url = r.request().url();
        if(url===origin) return r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fixture});
        if(url===origin+'favicon.ico') return r.fulfill({status:204});
        if(!url.startsWith(origin)) {errors.push(url);return r.abort();}
        const [a,b,id,action]=new URL(url).pathname.slice(1).split('/');
        const respond = data=>r.fulfill({json:{ok:true,data}});
        if(a==='api'&&b==='threads') {
          if(!id) return respond({threads: listing});
          if(!action) {opened.push(id);return respond({...view,threadId:id});}
          if(action==='options') return respond({});
          if(['messages','interrupt'].includes(action)) {writes.push([id,action,r.request().postDataJSON()]);return respond({});}
        }
        if(b==='jiajia') return respond(null);
        errors.push(url);return r.abort();
      });
      const check=async (name, fn)=>{try{await fn()}catch(e){failures.push(`${key} ${name}: ${e.message}`);}};
      const titles=()=>page.locator('#mRows .m-row-title').allTextContents();
      const matches=page.locator('#mRows .m-row');
      await page.goto(origin);
      assert.deepEqual(errors, [], "boot errors");
      await page.evaluate(()=>loadFixture());
      await check('flat and unique',async()=>{
        assert.deepEqual(await titles(),['远程查看 Word 和 Excel','检查参数估计公式的显示','远程查看 Word 和 Excel','含附件的会话']);
        assert.equal(await page.locator('#mRows .tile').count(),0);
        assert.equal(await page.locator('#mTabBadge').isVisible(),false,'first render does not treat older duplicates as updated');
        assert.match(await matches.nth(0).innerText(),/修复远程聊天列表/);
        assert.match(await matches.nth(2).innerText(),/检查 Excel 表格预览/);
        assert.ok((await matches.nth(1).innerText()).includes('检查参数估计公式的显示'));
        assert.doesNotMatch(await page.locator('#mRows').innerText(),/Files mentioned|C:\\Users/);
        if(shots&&width===390&&scheme==='light') await page.screenshot({path:path.join(shots,'sessions-light.png')});
      });
      await check('unique unread badge and filters',async()=>{
        listing=[...threads,{...threads[3],updatedAt:t+1},{...threads[3],updatedAt:t+1}];
        await page.evaluate(()=>loadFixture());
        assert.equal(await page.locator('#mTabBadge').innerText(),'1');
        const filter=async label=>{
          await page.locator('#mFilter').click();
          await page.locator('.m-sheet').getByText(label,{exact:true}).click();
        };
        await filter('只看未读');
        assert.deepEqual(await titles(),['远程查看 Word 和 Excel']);
        assert.equal(await matches.locator('.badge.dot').count(),1);
        await filter('只看运行中');
        assert.deepEqual(await titles(),['远程查看 Word 和 Excel']);
        assert.match(await matches.first().innerText(),/运行中/);
        await filter('全部会话');
      });
      await check('search and direct identity',async()=>{
        await page.locator('#mSearch').fill('检查 Excel');
        assert.deepEqual(await titles(),['远程查看 Word 和 Excel']);
        await matches.first().click();
        await page.waitForFunction(()=>document.querySelector('#mLog .m-bubble'));
        assert.deepEqual(opened,['b']);
        assert.equal(await page.locator('#mChatTitle').innerText(),'远程查看 Word 和 Excel');
        assert.equal(await page.locator('#mProject').isVisible(),false);

      await check('LINE message layout, read receipt and folded process',async()=>{
        const outgoing=page.locator('#mLog .m-msg.out');
        const incoming=page.locator('#mLog .m-msg.in');
        assert.equal(await outgoing.count(),3);
        assert.ok(await outgoing.evaluateAll(rows=>rows.every(row=>!row.querySelector('.who'))),'own avatars are hidden');
        assert.ok(await page.locator('#mLog .m-meta').count()>=6,'timestamps sit outside bubbles');
        assert.ok(await page.locator('#mLog .m-meta').first().evaluate(meta=>!meta.closest('.m-msg').querySelector('.m-bubble')?.contains(meta)));
        assert.ok(await outgoing.last().locator('.m-receipt[data-state="read"]').count(),'assistant response marks the outgoing message read');
        assert.ok(await outgoing.nth(1).locator('.m-meta .m-message-time').evaluate(e=>getComputedStyle(e).display==='none'),'only the last message in a consecutive group shows the time');
        assert.ok(await outgoing.last().locator('.m-bubble').evaluate(node=>node.getBoundingClientRect().width <= document.querySelector('#mLog').clientWidth*.78+1),'long bubbles wrap within the chat column');
        assert.ok(await incoming.first().locator('.m-bubble').evaluate(node=>getComputedStyle(node,'::before').content!=='none'&&getComputedStyle(node,'::before').borderRightColor===getComputedStyle(node).backgroundColor),'LINE bubble tail is present');
        assert.ok(await page.locator('#mLog .m-msg.in .m-bubble').first().evaluate((node,scheme)=>getComputedStyle(node).backgroundColor!=='rgba(0, 0, 0, 0)',scheme),'received bubble uses the incoming color');
        assert.ok(await incoming.nth(2).locator('.who').evaluate(node=>getComputedStyle(node).visibility==='hidden'),'continuous incoming messages do not repeat the avatar');
        assert.match(await incoming.first().locator('time').innerText(), /\b\d{2}:\d{2}$/, 'numeric-string timestamps are formatted');
        assert.ok(await outgoing.nth(1).locator('.m-bubble').evaluate(node=>node.getBoundingClientRect().width < document.querySelector('#mLog').clientWidth/2),'short bubbles shrink to content');
        const group=page.locator('#mLog details.m-process');
        assert.equal(await group.count(),1,'consecutive tool steps share one process disclosure');
        assert.equal(await group.getAttribute('open'),null,'process summary starts collapsed');
        assert.equal(await group.locator('.m-card').first().isVisible(),false);
        await group.locator('summary').click();
        assert.equal(await group.locator('.m-card:visible').count(),2);
        const controls=await group.locator('.m-process-toggle').evaluateAll(buttons=>buttons.map(b=>b.getAttribute('aria-controls')));
        assert.equal(new Set(controls).size,2,'command toggles target distinct output elements');
        const process=group.locator('.m-process-toggle').first();
        assert.equal(await process.getAttribute('aria-expanded'),'false','process output starts collapsed');
        assert.equal(await page.locator('#mLog .m-process-output').first().isVisible(),false);
        await process.click();
        assert.equal(await process.getAttribute('aria-expanded'),'true');
        assert.equal(await page.locator('#mLog .m-process-output').first().isVisible(),true);
        assert.equal(await page.evaluate(()=>document.activeElement.id),'','chat opens without focusing the composer');
      });      });
      if(opened.length===0) await page.evaluate(()=>window.dispatchEvent(new PopStateEvent('popstate')));
      if(opened.length) {
        await check('composer, gray canvas, send/stop',async()=>{
          const send=page.locator('#mGo');
          const input=page.locator('#mInput');
          assert.equal(await page.locator('#mChips button').first().innerText(),'Agent','keep the existing mode label');
          assert.equal(await page.locator('#mChips .ring, #mChips [title="上下文用量"]').count(),0,'LINE view does not render a context-usage indicator or tooltip');
          if(mobile) assert.ok(!await send.isVisible()); else assert.ok(await send.isDisabled());
          if(mobile) assert.ok(await input.evaluate(node=>{
            const box=node.closest('.m-pill'), r=box.getBoundingClientRect(), plus=document.querySelector('#mPlus').getBoundingClientRect();
            return r.height>=44&&r.height<=52&&parseFloat(getComputedStyle(box).borderRadius)>=20&&Math.abs(plus.top+plus.height/2-(r.top+r.height/2))<5;
          }),'composer height, radius and plus alignment');
          assert.ok(await page.locator('#mComposer').evaluate(e=>parseFloat(getComputedStyle(e).paddingBottom)>=8),'composer keeps bottom safe-area spacing');
          await input.fill('组合草稿');
          await input.evaluate(node=>node.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,isComposing:true,keyCode:229})));
          assert.equal(await input.inputValue(),'组合草稿','IME confirmation does not send');
          await input.fill('换行测试');
          await input.press('Shift+Enter');
          assert.ok((await input.inputValue()).includes('\n'),'Shift+Enter inserts a line break');
          await input.fill('继续整理');
          assert.equal(await send.getAttribute('aria-label'),'发送');
          if(mobile) {
            assert.equal(await page.locator('#mChat').evaluate(e=>getComputedStyle(e).backgroundColor),scheme==='light'?'rgb(240, 240, 240)':'rgb(32, 33, 36)');
            assert.ok(await page.locator('#mPlus').evaluate(e=>{
              const r=e.getBoundingClientRect(), pill=document.querySelector('#mInput').closest('.m-pill'), p=pill.getBoundingClientRect();
              return !pill.contains(e)&&r.right<=p.left&&r.width>=44&&r.height>=40;
            }),'attachment plus is outside the input, on the left');
            assert.ok(await send.evaluate(e=>getComputedStyle(e).display==='none'),'mobile composer has no send button');
            assert.ok(await page.locator('#mChips').evaluate(e=>{
              const a=[...e.querySelectorAll('button')].map(x=>x.getBoundingClientRect()), r=e.getBoundingClientRect();
              return a.length===3&&a.every(x=>Math.abs(x.width-a[0].width)<1&&x.top===a[0].top)&&Math.abs(a[0].left-r.left)<2&&Math.abs(a[2].right-r.right)<2&&e.scrollWidth===e.clientWidth;
            }),'three equal cells span the row');
            assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
            if(shots&&width===390) await page.screenshot({path:path.join(shots,`composer-${scheme}.png`)});
          } else {
            assert.equal(await send.innerText(),'发送');
            assert.equal(await page.locator('#mComposer').evaluate(e=>getComputedStyle(e).display),'grid');
          }
          if(mobile) await input.press('Enter'); else await send.click();
          await page.waitForFunction(()=>!document.querySelector('#mInput').value);
          assert.deepEqual(writes[0],['b','messages',{text:'继续整理',attachments:[]}]);
          await page.evaluate(()=>setRuntime(true));
          await input.fill('补充');
          assert.equal(await send.getAttribute('aria-label'),'插话');
          await input.fill('');
          assert.equal(await send.getAttribute('aria-label'),'停止');
          if(mobile) await input.press('Enter'); else await send.click();
          await assertEventually(()=>assert.deepEqual(writes[1]?.slice(0,2),['b','interrupt']));
          await page.locator('#mPlus').click();
          await page.locator('.m-sheet').waitFor();
          if(mobile && width<900) {
            await page.locator('.m-sheet .cancel').click();
            await page.locator('#mChatBack').click();
            await page.locator('#mList').waitFor();
            assert.equal(await page.locator('#mProject').isVisible(),false);
            assert.deepEqual(await titles(),['远程查看 Word 和 Excel']);
          }
        });
      }
      await check('no page errors',async()=>assert.deepEqual(errors,[]));
      await context.close();
    }
  } finally {await browser.close();}
  assert.deepEqual(failures,[]);
  console.log('PASS 5 layouts: unique sessions, titles, LINE bubbles, folded process, receipts, composer and send/interrupt');
})().catch(e=>{console.error(e);process.exitCode=1});
async function assertEventually(fn){for(let i=0;i<20;i++){try{return fn()}catch(e){if(i===19) throw e;await new Promise(r=>setTimeout(r,50));}}}
