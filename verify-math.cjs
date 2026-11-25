const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.CODEX_PLAYWRIGHT || 'playwright');
const [input, shots] = process.argv.slice(2);
const raw = fs.readFileSync(input, 'utf8');
const boot = 'pairCode&&!token';
assert.equal(raw.split(boot).length,2);
const fixture = raw.split(boot)[0] + `
  state.me = {role:'full',kind:'device',name:'手机',host:'我的电脑'};
  window.makeMarkdown=text=>markdown(text,true);
  window.showExample = (view) => {
    state.current = view ? 'math' : null;
    state.view = view;
    state.threads = [
      {id:'math',title:'统计推断 · 双样本检验',preview:'两个总体均值的比较',updatedAt:Math.floor(Date.now()/1000)},
      {id:'notes',title:'课程复习笔记',preview:'整理公式和例题',updatedAt:Math.floor(Date.now()/1000)-3600},
      {id:'plan',title:'本周学习计划',preview:'继续复习概率分布',updatedAt:Math.floor(Date.now()/1000)-7200}
    ];
    m.setStyle('chat'); m.onRole();
    if (view) applyView(view);
  };
})();\n</script></body></html>`;
const tex = String.raw;
const stats = [
  tex`|\bar X-\bar Y|\ge u_{\alpha/2}\,\sigma_0\sqrt{\frac1n+\frac1m}.`,
  tex`\frac{\bar X-\bar Y-1}{\sqrt{5/n+5/m}}\le u_{1-\alpha}=-u_\alpha.`,
  tex`\lvert t\rvert=\frac{175.9-175}{\sqrt{11.3/8}}\approx 0.757<2.364.`,
  tex`\frac{\sqrt n\left(\overline X-\mu_0\right)}{S}\ge t_\alpha(n-1)`,
];
const display = s=>`\\[\n${s}\n\\]`;
const sig = (p, str) => p.evaluate(str=>{
  const node=makeMarkdown(str);
  return {text:node.textContent, parts:[...node.querySelectorAll('.m-math')].map(e=>({
    display:e.classList.contains('display'), fallback:e.classList.contains('fallback'),
    text:e.textContent, tags:[...e.querySelectorAll('math *')].map(x=>x.localName),
    subs:[...e.querySelectorAll('msub')].map(x=>x.lastElementChild.textContent),
    plainFences:[...e.querySelectorAll('mo')].filter(n=>['|','(',')'].includes(n.textContent)).map(n=>n.getAttribute('stretchy')),
    fracs:[...e.querySelectorAll('mfrac')].map(x=>[...x.children].map(y=>y.textContent)),
    numbers:[...e.querySelectorAll('mn')].map(x=>x.textContent)
  })), code:[...node.querySelectorAll('code')].map(x=>x.textContent), images:node.querySelectorAll('img').length,
    scripts:node.querySelectorAll('script').length, links:[...node.querySelectorAll('a')].map(x=>x.href),
    listMath:node.querySelectorAll('li math').length, quoteMath:node.querySelectorAll('blockquote math').length};
},str);
const origin='https://codex-line.test/';
(async()=>{
  const b=await chromium.launch({channel:'chrome',headless:true});
  try {
    const failures=[];
    const verify=(ok,desc)=>{if(!ok) failures.push(desc);};
    for(const [width,height,scheme] of [[320,640,'light'],[390,844,'light'],[390,844,'dark'],[932,430,'dark']]) {
      const label=`${width}x${height} ${scheme}`;
      const ctx=await b.newContext({viewport:{width,height},isMobile:true,hasTouch:true,colorScheme:scheme,serviceWorkers:'block'});
      const page=await ctx.newPage();
      page.setDefaultTimeout(3000);
      const errors=[];
      page.on('pageerror', e=>errors.push(e.message));
      await page.route('**/*', r=>{
        const url=r.request().url();
        if(url===origin) return r.fulfill({status:200,contentType:'text/html; charset=UTF-8',body:fixture,
          headers:{'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'"}});
        if(url===origin+'favicon.ico') return r.fulfill({status:204});
        errors.push(url); return r.abort();
      });
      await page.goto(origin);
      const cases=[display(stats[0]),display(stats[1]),`\\[${stats[2]}\\]`,`\\[ ${stats[3]}\n\\]，不取等号`];
      const rendered=await Promise.all(cases.map(s=>sig(page,s)));
      verify(rendered.every(c=>c.parts.length===1&&c.parts[0].display&&!c.parts[0].fallback),`${label}: all four screenshot formulas display in MathML: ${JSON.stringify(rendered.map(x=>x.text))}`);
      verify(JSON.stringify(rendered[0].parts[0]?.fracs)===JSON.stringify([['1','n'],['1','m']]) && rendered[0].parts[0]?.tags.filter(x=>x==='mover').length===2 && rendered[0].parts[0]?.tags.includes('msqrt') && rendered[0].text.includes('≥'),`${label}: shorthand fractions, spaced accents and ≥`);
      verify(rendered[1].parts[0]?.subs.join(',')==='1−α,α' && rendered[1].text.includes('≤'),`${label}: Greek subscript consumed once, ≤ rendered`);
      verify(rendered[2].parts[0]?.text.includes('|t|') && rendered[2].parts[0]?.numbers.includes('175.9') && rendered[2].parts[0]?.numbers.includes('2.364'),`${label}: absolute value and decimal digits`);
      verify(rendered[3].parts[0]?.tags.includes('msqrt') && rendered[3].parts[0]?.subs.at(-1)==='α' && rendered[3].text.endsWith('，不取等号'),`${label}: square root of single token, no duplicate alpha, trailing prose`);
      verify([rendered[0],rendered[2]].every(x=>x.parts[0]?.plainFences.length===2 && x.parts[0].plainFences.every(s=>s==='false')), `${label}: ordinary absolute bars must not stretch to the other side of the equation`);
      const nested=await sig(page,`1. 双样本比较\n   \\[\n   ${stats[0]}\n   \\]\n2. 继续\n\n> \\[\n> ${stats[1]}\n> \\]`);
      verify(nested.listMath===1 && nested.quoteMath===1,`${label}: math in numbered list and quote`);
      const mixed=await sig(page,'**'+tex`在 5\% 水平下，\(\bar X\) 与 $\mu_0$`+'**\n\n'+tex`价格 $5 或 $10，预算 \$20`+'\n\n`\\[k\\]`\n\n```tex\n'+display(stats[0])+'\n```');
      verify(mixed.parts.length===2 && mixed.text.includes('5%') && mixed.text.includes('$5 或 $10') && mixed.text.includes('$20') && mixed.code.length===2,`${label}: bold math, escaped punctuation, currency and code`);
      const more=await sig(page,tex`结论：\[\sqrt[3]{n}+\left\lVert v\right\rVert\]。另有 $$x^2 = 1$$。`+'\n\n'+tex`\[\begin{aligned} A &= B \\ C &= D \end{aligned}\]`+'\n\n'+tex`行内：\(\frac{1}{`+'\n'+tex`1+t}\)。`);
      verify(more.parts.length===4 && more.parts.slice(0,3).every(x=>x.display&&!x.fallback) && !more.parts[3]?.display && !more.parts[3]?.fallback && more.parts[0]?.tags.includes('mroot') && more.parts[0]?.text.includes('‖v‖') && more.parts[2]?.tags.filter(x=>x==='mtr').length===2 && more.parts[3]?.tags.includes('mfrac'),`${label}: mixed-text display, multiline inline, indexed root, norm and aligned rows`);
      const unsupported=await sig(page, tex`\[\unknown{x}\]`+'\n\n'+tex`\(\href{https://example.invalid}{a}\)`+'\n\n'+tex`\(\text{<img src=x>}\)`+'\n\n'+tex`\[\frac{1}`+'\n\n## 保留下一段');
      verify(unsupported.parts.filter(x=>x.fallback).length===2 && unsupported.parts.at(-1)?.text==='<img src=x>' && unsupported.text.includes('保留下一段') && unsupported.images===0 && unsupported.scripts===0 && unsupported.links.length===0,`${label}: literal fallback, no markup execution and incomplete formula does not eat content`);
      const wide=tex`\left\lvert ${Array.from({length:36},(_,i)=>`x_{${i+1}}`).join('+')} \right\rvert`;
      const view={title:'统计推断 · 双样本检验',live:true,runtime:'idle',controls:{model:'Codex',effort:'high'},turns:[{startedAtMs:Date.now(),items:[
        {type:'userMessage',text:'这两种检验的公式怎么写？'},
        {type:'agentMessage',text:`## 两个总体均值的比较\n先看给定方差时的临界条件。\n\n${display(stats[0])}\n\n${display(stats[1])}\n\n${display(stats[2])}\n\n${display(stats[3])}\n\n${display(wide)}\n\n在 5% 水平下，结合临界值判断。`}
      ]}]};
      if(shots && width===390 && scheme==='light') { await page.evaluate(()=>showExample(null)); await page.screenshot({path:path.join(shots,'line-sessions.png')}); }
      await page.evaluate(view=>showExample(view),view);
      const color=await page.locator('#mChat').evaluate(e=>getComputedStyle(e).backgroundColor);
      const palette = ['rgb(240, 240, 240)', 'rgb(32, 33, 36)'];
      verify(color===palette[scheme==='light'?0:1],`${label}: LINE chat background, got ${color}`);
      const outgoing=await page.locator('.m-msg.out .m-bubble').evaluate(e=>getComputedStyle(e).backgroundColor);
      verify(outgoing===(scheme==='light'?'rgb(180, 242, 166)':'rgb(42, 91, 58)'),`${label}: green outgoing bubble got ${outgoing}`);
      const widthInfo=await page.locator('#mLog .m-math.display').last().evaluate(e=>{
        const m=e.querySelector('math'), b=e.getBoundingClientRect();
        e.scrollLeft=0; const left=m.getBoundingClientRect().left-b.left;
        e.scrollLeft=100000; const right=m.getBoundingClientRect().right-b.right;
        const range=e.scrollLeft; e.scrollLeft=0;
        return {left,right,range,chat:document.querySelector('#mLog').scrollWidth-document.querySelector('#mLog').clientWidth};
      });
      verify(widthInfo.left>=-1&&widthInfo.right<=1&&widthInfo.range>0&&widthInfo.chat<=3 && await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth),`${label}: wide formula edges reachable without moving chat ${JSON.stringify(widthInfo)}`);
      if(shots && width===390) { await page.locator('#mLog').evaluate(e=>e.scrollTop=0); await page.screenshot({path:path.join(shots,`line-chat-${scheme}.png`)}); }
      assert.deepEqual(errors,[]);
      await ctx.close();
    }
    if(failures.length) throw new Error(failures.join('\n'));
    console.log(`PASS Chrome ${b.version()}: 4 mobile profiles, screenshot formulas, mixed Markdown, math scroll, LINE tokens and safe literal fallback`);
  } finally {await b.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
