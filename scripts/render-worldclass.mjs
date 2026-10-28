import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const out='C:/Users/REYMARK/Documents/MotionLab/ANGORA-30s';await fs.mkdir(`${out}/preview-frames`,{recursive:true});
const b=await chromium.launch();const pg=await b.newPage();pg.on('pageerror',e=>console.error(e.message));
await pg.goto('http://motionlab.test/worldclass-review.html');await pg.waitForFunction(()=>window.film,{timeout:60000});
const scenes=await pg.evaluate(()=>window.film.scenes);
for(const s of scenes){const png=await pg.evaluate(t=>window.film.render(t),s.review);await fs.writeFile(`${out}/preview-frames/${s.id}.png`,Buffer.from(png.split(',')[1],'base64'));}
const audit=await pg.evaluate(()=>window.film.audit());await fs.writeFile(`${out}/technical-audit.json`,JSON.stringify(audit,null,2));
await fs.writeFile(`${out}/editable-project.json`,await pg.evaluate(()=>window.film.projectJson()));
const manifest=await pg.evaluate(()=>window.film.p.mediaAssets.map(({id,name,type,width,height,duration,size})=>({id,name,type,width,height,duration,size,source:type==='audio'?'Original instrumental or foley; no third-party samples':name.startsWith('official')?'Unaltered user-supplied Angora identity':name.includes('grain')?'Original procedural paper texture':'Cropped / masked supplied Angora reference'})));
await fs.writeFile(`${out}/asset-manifest.json`,JSON.stringify(manifest,null,2));
console.log(JSON.stringify({...audit,textBounds:audit.textBounds.filter(t=>t.left<65||t.right>1015||t.bottom>1700)}));
const args=['-v','error','-y'];for(const s of scenes)args.push('-i',`${out}/preview-frames/${s.id}.png`);
const filters=scenes.map((_,i)=>`[${i}:v]scale=270:480,pad=300:540:15:35:color=0x172018,drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='${scenes[i].id}  ${scenes[i].name}':x=15:y=10:fontsize=14:fontcolor=0xF4F5EC[v${i}]`);
filters.push(scenes.map((_,i)=>`[v${i}]`).join('')+'xstack=inputs=9:layout=0_0|300_0|600_0|0_540|300_540|600_540|0_1080|300_1080|600_1080[out]');
execFileSync('ffmpeg',[...args,'-filter_complex',filters.join(';'),'-map','[out]','-frames:v','1',`${out}/scene-contact-sheet.png`]);
// Dense timing strip: scene transitions and moving phrases are inspected at multiple frames.
const motionTimes=[.1,.4,.8,1.4,1.8,2.3,3.65,3.95,4.25,5.3,6.3,7.85,8.2,8.7,9.4,11.85,12.3,14.45,15,15.8,16.9,17.4,18.2,19.4,20,20.6,21.8,22.4,23.3,24.2,25.9,26.3,26.9,27.5,28.2,29.9];
await fs.mkdir(`${out}/motion-review`,{recursive:true});
for(let i=0;i<motionTimes.length;i++){const data=await pg.evaluate(t=>window.film.render(t),motionTimes[i]);await fs.writeFile(`${out}/motion-review/${String(i).padStart(3,'0')}.png`,Buffer.from(data.split(',')[1],'base64'));}
execFileSync('ffmpeg',['-v','error','-y','-i',`${out}/motion-review/%03d.png`,'-vf','scale=180:320,tile=9x4','-frames:v','1',`${out}/motion-contact-sheet.jpg`]);
if(process.argv.includes('--export')){await pg.evaluate(()=>{window.film.export();});for(;;){await pg.waitForTimeout(2500);const s=await pg.evaluate(()=>({progress:window.film.progress,result:window.film.result,error:window.film.error}));console.log(JSON.stringify(s.result?{completed:true,result:s.result}:s));if(s.error)throw new Error(s.error);if(s.result){const r=await pg.request.get('http://motionlab.test'+s.result.downloadUrl);await fs.writeFile(`${out}/ANGORA-One-Partner-30s-render.mp4`,await r.body());await fs.writeFile(`${out}/export-verification.json`,JSON.stringify(s.result,null,2));break;}}}
await b.close();
