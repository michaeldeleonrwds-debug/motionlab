import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
const out='C:/Users/REYMARK/Documents/Sites/MotionLab/public/angora-worldclass';
await fs.mkdir(out,{recursive:true});
const refs=[
['team','C:/Users/REYMARK/AppData/Local/Temp/codex-clipboard-1d43b964-5e34-4e1a-afad-00595a2a94ea.png'],
['pressure','C:/Users/REYMARK/AppData/Local/Temp/codex-clipboard-18746385-c8bf-4bf5-831b-cd5830edf38e.png'],
['workspace','C:/Users/REYMARK/AppData/Local/Temp/codex-clipboard-0e7ff45d-8cac-427a-a841-94e0ae1d6661.png'],
['collage','C:/Users/REYMARK/AppData/Local/Temp/codex-clipboard-fb779bbc-85fd-4295-93d1-ef89ab9de453.png'],
];
for(const [name,p]of refs)await fs.copyFile(p,`${out}/reference-${name}.png`);
await fs.copyFile('C:/Users/REYMARK/Downloads/Angora Web Services Logo.png',`${out}/official-logo.png`);
await fs.copyFile('C:/Users/REYMARK/Downloads/Lime Green Ribbon A Logo.png',`${out}/official-symbol.png`);
const browser=await chromium.launch();const page=await browser.newPage();
const crops=[
['workspace','workspace-print',415,208,450,320,null],
['team','creative-hands',12,10,295,265,null],
['team','planning-hands',610,15,255,265,null],
['pressure','agency-cutout',366,302,464,515,[[205,28],[225,14],[245,12],[281,21],[300,40],[311,65],[311,90],[323,109],[326,135],[319,149],[321,170],[329,198],[335,222],[348,245],[389,271],[418,282],[442,300],[461,315],[461,515],[0,515],[5,311],[21,293],[62,272],[102,248],[119,212],[139,188],[150,167],[155,135],[167,110],[177,89],[185,64],[201,50]]],
['collage','studio-photo',1218,499,245,246,null],
['team','desk-detail',5,440,210,416,null],
];
for(const [ref,name,x,y,w,h,poly]of crops){
 const data='data:image/png;base64,'+(await fs.readFile(`${out}/reference-${ref}.png`)).toString('base64');
 const png=await page.evaluate(async({data,x,y,w,h,poly})=>{const im=new Image();im.src=data;await im.decode();const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');
 if(poly){ctx.beginPath();poly.forEach(([a,b],i)=>i?ctx.lineTo(a,b):ctx.moveTo(a,b));ctx.closePath();ctx.clip();}
 ctx.drawImage(im,x,y,w,h,0,0,w,h);return c.toDataURL();},{data,x,y,w,h,poly});
 await fs.writeFile(`${out}/${name}.png`,Buffer.from(png.split(',')[1],'base64'));
}
const grain=await page.evaluate(()=>{let seed=891;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};const c=document.createElement('canvas');c.width=1080;c.height=1920;const ctx=c.getContext('2d');const d=ctx.createImageData(1080,1920);for(let i=0;i<d.data.length;i+=4){const n=rand();d.data[i]=d.data[i+1]=d.data[i+2]=n>0.5?255:20;d.data[i+3]=Math.floor(rand()*12);}ctx.putImageData(d,0,0);for(let k=0;k<40;k++){ctx.strokeStyle='rgba(23,32,24,0.025)';ctx.beginPath();const y=rand()*1920;ctx.moveTo(0,y);ctx.lineTo(1080,y+rand()*8);ctx.stroke();}return c.toDataURL();});
await fs.writeFile(`${out}/paper-grain.png`,Buffer.from(grain.split(',')[1],'base64'));
for(const [source,target]of [['planning-hands','film-planning'],['workspace-print','film-editing'],['desk-detail','film-design']]){
 const data='data:image/png;base64,'+(await fs.readFile(`${out}/${source}.png`)).toString('base64');
 const crop=await page.evaluate(async data=>{const im=new Image();im.src=data;await im.decode();const c=document.createElement('canvas');c.width=300;c.height=640;const ctx=c.getContext('2d');const s=Math.max(300/im.width,640/im.height);ctx.drawImage(im,(300-im.width*s)/2,(640-im.height*s)/2,im.width*s,im.height*s);return c.toDataURL();},data);
 await fs.writeFile(`${out}/${target}.png`,Buffer.from(crop.split(',')[1],'base64'));
}
await browser.close();
// Original 120 BPM composition: warm minor-seventh plucks, restrained drums, bass and airy percussion.
const sr=48000,N=sr*30,L=new Float64Array(N),R=new Float64Array(N);let seed=7121;
const noise=()=>{seed=(1664525*seed+1013904223)>>>0;return(seed/4294967296)*2-1;};
const hz=m=>440*2**((m-69)/12);
function note(t,m,dur,amp,pan=0,kind='pluck') {const n=Math.min(N,Math.floor((t+dur)*sr)),st=Math.floor(t*sr),f=hz(m);for(let i=st;i<n;i++){const a=(i-st)/sr;const env=Math.min(1,a/0.012)*Math.exp(-a*(kind==='bass'?3.2:2.3))*Math.min(1,(dur-a)/0.1);const v=amp*env*(Math.sin(2*Math.PI*f*a)+0.21*Math.sin(4*Math.PI*f*a)+0.06*Math.sin(6*Math.PI*f*a));L[i]+=v*(1-pan*0.35);R[i]+=v*(1+pan*0.35);}}
const chords=[[57,60,64,67],[53,57,60,64],[48,55,59,62],[55,59,62,64]];
for(let beat=0;beat<60;beat++){const t=beat/2;const bar=Math.floor(beat/8)%4;const chord=chords[bar];const quiet=t>=7.5&&t<8.5||t>=25.5&&t<26.5;
 if(beat%4===0)chord.forEach((m,j)=>note(t,m+12,2.8,0.043,j%2?-0.6:0.6));
 if(beat%2===0)note(t,chord[0]-12,0.8,0.14,0,'bass');
 if(beat%2===1&&!quiet)note(t+0.25,chord[(beat%3)+1]+12,0.7,0.048,beat%4===1?-0.5:0.5);
 if(!quiet&&t<27.5){for(let k=0;k<sr*.32;k++){const i=Math.floor(t*sr)+k;if(i>=N)break;const a=k/sr;const env=Math.exp(-a*22);const kick=0.24*Math.sin(2*Math.PI*(45*a+2.2*(1-Math.exp(-a*35))))*env;L[i]+=kick;R[i]+=kick;}
 if(beat%2===1){for(let k=0;k<sr*.15;k++){const i=Math.floor(t*sr)+k;if(i>=N)break;const v=noise()*Math.exp(-k/sr*45)*0.07;L[i]+=v;R[i]+=v;}}
 for(const off of [0.23,0.48]){for(let k=0;k<sr*.045;k++){const i=Math.floor((t+off)*sr)+k;if(i>=N)break;const v=noise()*Math.exp(-k/sr*90)*0.019;L[i]+=v;R[i]-=v*.65;}}}
}
const pcm=Buffer.alloc(N*4);for(let i=0;i<N;i++){const t=i/sr;const env=Math.min(1,t/0.06)*Math.min(1,(30-t)/1.1);const left=Math.tanh(L[i]*1.25)*env,right=Math.tanh(R[i]*1.25)*env;pcm.writeInt16LE(Math.round(left*27000),i*4);pcm.writeInt16LE(Math.round(right*27000),i*4+2);}
function wav(data,rate=sr){const b=Buffer.alloc(44);b.write('RIFF');b.writeUInt32LE(36+data.length,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*4,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(data.length,40);return Buffer.concat([b,data]);}
await fs.writeFile(`${out}/original-score.wav`,wav(pcm));
// Short tactile paper sound, with no sampled third-party recording.
const fn=Math.round(sr*.34),foley=Buffer.alloc(fn*4);let smooth=0;
for(let k=0;k<fn;k++){const t=k/sr;smooth=smooth*.83+noise()*.17;const env=Math.sin(Math.PI*t/.34)**2*Math.exp(-t*5);const v=Math.round((smooth*.5+noise()*.025)*env*22000);foley.writeInt16LE(v,k*4);foley.writeInt16LE(v,k*4+2);}
await fs.writeFile(`${out}/paper-foley.wav`,wav(foley));
execFileSync('ffmpeg',['-v','error','-y','-i',`${out}/original-score.wav`,'-af','loudnorm=I=-16:TP=-2:LRA=9','-ar','48000',`${out}/score-master.wav`]);
console.log('Prepared approved reference fragments, original logo copies, paper texture, original 30s instrumental and paper foley.');
