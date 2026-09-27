import json,os
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
s=json.loads(Path('/tmp/quadem-ops-browser-private.json').read_text())
out=Path('/tmp/quadem-ops-browser');out.mkdir(exist_ok=True)
checks=[];errors=[]
def check(name,ok):
 checks.append({'name':name,'passed':bool(ok)});print(('PASS ' if ok else 'FAIL ')+name)
def route(r):
 if any(x in r.request.url for x in ['googletagmanager','analytics','tawk.to','metricool','vercel-insights']):return r.abort()
 if r.request.method not in ['GET','HEAD']:return r.abort()
 return r.continue_()
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 for width in [390,1440]:
  c=browser.new_context(viewport={'width':width,'height':900});c.route('**/*',route)
  name,value=s['cookie'].split('=',1);c.add_cookies([{'name':name,'value':value,'domain':'quademdigital.com','path':'/','httpOnly':True,'secure':True,'sameSite':'Strict'}])
  page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('https://quademdigital.com/portal/',wait_until='networkidle',timeout=90000)
  check(f'Portal visible journey at {width}',page.get_by_text('QA visible project step',exact=True).is_visible())
  check(f'Portal hides internal journey at {width}',page.get_by_text('QA INTERNAL MUST NOT APPEAR',exact=True).count()==0)
  check(f'Portal fits at {width}',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
  check(f'Portal connectors stay inside viewport at {width}',page.locator('.step-connector').evaluate_all('(els)=>els.every(e=>{let r=e.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth+1})'))
  check(f'Portal headings stay readable without reveal masks at {width}',page.locator('.portal-dashboard story-mask').count()==0)
  page.screenshot(path=str(out/f'portal-{width}.png'),full_page=True)
  page.goto(s['invoiceUrl'],wait_until='networkidle',timeout=90000)
  check(f'Invoice readable at {width}',page.get_by_text('QA TEST ONLY - no payment required',exact=False).count()>0)
  check(f'Invoice fits at {width}',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
  check(f'Invoice headings stay readable without reveal masks at {width}',page.locator('.invoice-page-wrapper story-mask').count()==0)
  check(f'Payment instructions use invoice palette at {width}',page.locator('.payment-info').evaluate('(e)=>getComputedStyle(e).backgroundColor === getComputedStyle(document.querySelector(".invoice-page-wrapper")).backgroundColor'))
  page.screenshot(path=str(out/f'invoice-{width}.png'),full_page=True)
  c.close()
 browser.close()
check('No browser application errors',not errors)
(out/'results.json').write_text(json.dumps({'checks':checks,'errors':errors},indent=2))
assert all(x['passed'] for x in checks)
