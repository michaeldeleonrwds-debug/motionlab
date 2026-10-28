import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true});
try {
  const context=await browser.newContext();
  // This regression browser has its own IndexedDB and cannot alter the user's MCP state.
  await context.route('**/api/mcp/bridge-stream',route=>route.abort());
  await context.route('**/api/mcp/sync-state',route=>route.fulfill({json:{ok:true}}));
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://motionlab.test/');
  await page.waitForFunction(()=>window.__MOTIONLAB_STORE__?.getState()?.projectList?.length>0);
  await page.evaluate(()=>{
    const initial=window.__MOTIONLAB_STORE__.getState();
    window.__MOTIONLAB_STORE__.setState({project:{...initial.project,clips:[],mediaAssets:[]}});
    const store=window.__MOTIONLAB_STORE__.getState();
    store.addTextClipToTimeline('Preview playback regression',{animationIn:'slide-in',animationOut:'none'},0);
    store.setCurrentTime(0);store.setIsPlaying(false);
  });
  const play=page.getByTestId('play-pause-btn');
  const read=()=>page.evaluate(()=>({time:window.__MOTIONLAB_STORE__.getState().currentTime,playing:window.__MOTIONLAB_STORE__.getState().isPlaying}));
  await play.click();
  await page.waitForFunction(()=>window.__MOTIONLAB_STORE__.getState().currentTime>.3);
  const buttonPlayed=await read();assert.equal(buttonPlayed.playing,true);
  const imageA=await page.locator('canvas').first().evaluate(c=>c.toDataURL());
  await page.waitForFunction(t=>window.__MOTIONLAB_STORE__.getState().currentTime>t+.25,buttonPlayed.time);
  const imageB=await page.locator('canvas').first().evaluate(c=>c.toDataURL());
  assert.notEqual(imageA,imageB,'Preview must render different animation frames');
  await play.click();const paused=await read();await page.waitForTimeout(200);
  assert.deepEqual(await read(),paused,'Pause must stop the playhead');
  await page.keyboard.press('Space');
  await page.waitForFunction(t=>window.__MOTIONLAB_STORE__.getState().currentTime>t+.2,paused.time);
  const spacePlayed=await read();assert.equal(spacePlayed.playing,true);
  await page.keyboard.press('Space');assert.equal((await read()).playing,false);
  await page.evaluate(()=>window.__MOTIONLAB_STORE__.getState().setCurrentTime(2.9));
  await page.keyboard.press('Space');
  await page.waitForFunction(()=>!window.__MOTIONLAB_STORE__.getState().isPlaying);
  assert.equal((await read()).time,3);
  await play.click();
  await page.waitForFunction(()=>window.__MOTIONLAB_STORE__.getState().currentTime>.15&&window.__MOTIONLAB_STORE__.getState().currentTime<1);
  await play.click();
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({buttonPlayed,spacePlayed,animationFramesChanged:true,pause:true,stopAtEnd:true,replay:true,pageErrors:errors}));
} finally {await browser.close();}
