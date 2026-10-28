import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const dir='C:/Users/REYMARK/Documents/MotionLab';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
page.on('pageerror',e=>console.error(e.message));
await page.goto('http://motionlab.test/editorial-review.html');
await page.waitForFunction(()=>window.editorial,{timeout:60000});
const times=[0,1.7,4.8,8.5,11.7,15.3,18,21.5];
for(const t of times){const data=await page.evaluate(t=>window.editorial.render(t),t);await fs.writeFile(`${dir}/editorial-${t}.png`,Buffer.from(data.split(',')[1],'base64'));}
console.log('Review frames rendered');
if(process.argv.includes('--export')) {
  await page.evaluate(()=>{window.editorial.export();});
  for(;;){await page.waitForTimeout(3000);const s=await page.evaluate(()=>({progress:window.editorial.progress,result:window.editorial.result,error:window.editorial.error}));
    console.log(JSON.stringify(s));if(s.error)throw new Error(s.error);if(s.result){
      const response=await page.request.get('http://motionlab.test'+s.result.downloadUrl);
      await fs.writeFile(`${dir}/ANGORA-Beyond-Ordinary-Editorial-Master.mp4`,await response.body());break;
    }}
}
await browser.close();
