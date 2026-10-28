import type { ProjectData, TimelineClip, MediaAsset, Keyframe, TextStyle } from '../types/editor';
import { createDefaultColorEffects, createDefaultCrop, createDefaultMask, createDefaultTextStyle } from './projectFactory';

// Art direction and editable, frame-aligned animation for the 23-second social master.
export async function buildAngoraEditorial(): Promise<ProjectData> {
  const ink = '#101812', lime = '#D4FF47', paper = '#F2F3E9', muted = '#A8B3A6';
  const now = Date.now();
  const project: ProjectData = {
    id: 'proj-angora-beyond-ordinary-editorial', name: 'ANGORA — Beyond Ordinary | Editorial Master',
    aspectRatio: '9:16', resolution: '1080p', fps: 30, createdAt: now, updatedAt: now,
    tracks: [
      ['type','T1 · Headlines & copy','text'], ['brand','V3 · Original Angora identity','overlay'],
      ['art','V2 · Designed service scenes','overlay'], ['bg','V1 · Color & rhythm','video'],
      ['music','A1 · Restrained score','audio'], ['sfx','A2 · Transition accents','audio'],
    ].map(([id,name,type],order)=>({id,name,type: type as 'text'|'overlay'|'video'|'audio',order,muted:false,visible:true,locked:false})),
    clips: [], mediaAssets: [],
  };
  let serial = 0;
  const snap = (n:number) => Math.round(n*30)/30;
  function base(name:string, trackId:string, start:number, end:number):TimelineClip {
    return {id:`ed-${++serial}`,name,trackId,type:trackId==='type'?'text':trackId==='music'||trackId==='sfx'?'audio':'image',
      startTime:snap(start),duration:snap(snap(end)-snap(start)),inPoint:0,outPoint:snap(snap(end)-snap(start)),sourceDuration:Infinity,
      playbackSpeed:1,x:0,y:0,scale:1,rotation:0,opacity:1,crop:createDefaultCrop(),mask:createDefaultMask(),
      effects:createDefaultColorEffects(),volume:1,muted:trackId!=='music'&&trackId!=='sfx',fadeIn:0,fadeOut:0,
      transitionIn:{type:'none',duration:0},transitionOut:{type:'none',duration:0},keyframes:[]};
  }
  function key(c:TimelineClip,p:Keyframe['property'],t:number,v:number,e:Keyframe['easing']='cubic-bezier') {
    c.keyframes.push({id:`${c.id}-${p}-${t}`,property:p,time:snap(t),value:v,easing:e,bezierPoints:[0.22,1,0.36,1]});
  }
  function enter(c:TimelineClip, distance=46, duration=0.6, exit=true) {
    key(c,'y',0,c.y+distance); key(c,'y',duration,c.y);
    key(c,'opacity',0,0); key(c,'opacity',0.23,1);
    if(exit && c.duration>1 && c.startTime+c.duration<22.99) { key(c,'opacity',c.duration-0.16,1); key(c,'opacity',c.duration,0,'ease-in'); }
  }
  const measure = document.createElement('canvas').getContext('2d')!;
  function text(content:string,left:number,y:number,size:number,start:number,end:number,color=paper,weight=700,tracking=0,animate=true) {
    const c=base(content.replace(/\n/g,' / '),'type',start,end);
    measure.font=`${weight} ${size}px Arial`;
    const width=Math.max(...content.split('\n').map(l=>measure.measureText(l).width+Math.max(0,l.length-1)*tracking));
    c.x=left+width/2-540; c.y=y-960;
    c.textStyle={...createDefaultTextStyle(content),fontFamily:'Arial',fontSize:size,fontWeight:weight,color,
      align:'left',letterSpacing:tracking,backgroundOpacity:0,shadowBlur:0,animationIn:'none',animationOut:'none'} as TextStyle;
    if(animate) enter(c);
    project.clips.push(c); return c;
  }
  function rect(name:string,x:number,y:number,w:number,h:number,color:string,start:number,end:number,track='art',radius=0) {
    const c=base(name,track,start,end); c.x=x-540;c.y=y-960;
    c.shapeStyle={shapeType:'rectangle',width:w,height:h,fillColor:color,fillOpacity:1,strokeColor:color,strokeWidth:0,cornerRadius:radius};
    project.clips.push(c); return c;
  }
  async function asset(name:string,blob:Blob,w:number,h:number,type:'image'|'audio'='image',duration=5) {
    const a:MediaAsset={id:`editorial-${name}`,name,type,mimeType:blob.type,size:blob.size,width:w,height:h,duration,
      hasAudio:type==='audio',codecInfo:type==='image'?'Authored vector / brand asset':'PCM · stereo',thumbnails:[],waveform:[],
      objectUrl:URL.createObjectURL(blob),blob,createdAt:now};
    if(type==='image') a.thumbnails=[a.objectUrl!];
    project.mediaAssets.push(a);return a;
  }
  async function svg(name:string,body:string,w=1080,h=1920) {
    return asset(name,new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`],{type:'image/svg+xml'}),w,h);
  }
  function picture(a:MediaAsset,name:string,start:number,end:number,x=540,y=960,scale=1,rotation=0) {
    const c=base(name,'art',start,end);c.mediaId=a.id;c.x=x-540;c.y=y-960;c.scale=scale;c.rotation=rotation;
    project.clips.push(c);return c;
  }
  const logoRes=await fetch('/angora-assets/angora-original-symbol.png');
  if(!logoRes.ok) throw new Error('Original Angora symbol is unavailable');
  const symbol=await asset('Angora — supplied original symbol.png',await logoRes.blob(),1280,1280);
  function logo(start:number,end:number,x:number,y:number,scale:number,animated=true) {
    const c=picture(symbol,'Original Angora ribbon A',start,end,x,y,scale);c.trackId='brand';
    if(animated) {enter(c,28,0.7);key(c,'scale',0,scale*0.94);key(c,'scale',0.8,scale);}
    return c;
  }
  // Underlying base prevents black gaps at every cut. All copy stays inside mobile-safe margins.
  rect('Continuous charcoal',540,960,1080,1920,ink,0,23,'bg');
  rect('Lime manifesto',540,960,1080,1920,lime,3.6,7.2,'bg');
  rect('Warm paper / creative',540,960,1080,1920,paper,10.4,13.6,'bg');
  rect('Lime typographic punctuation',540,960,1080,1920,lime,16.8,19.2,'bg');

  // 01. Start with the promise, already readable on the first frame.
  text('ANGORA',86,230,31,0,3.6,paper,700,6,false);
  text('WEB SERVICES',86,278,19,0,3.6,muted,400,4,false);
  const rule=rect('Opening hairline',540,365,908,2,'#394437',0,3.6);rule.shapeStyle!.shapeType='line';rule.shapeStyle!.strokeWidth=2;key(rule,'trimEnd',0,0);key(rule,'trimEnd',0.8,100);
  text('Beyond',78,580,153,0,3.6,paper,700,-7,false);
  text('ordinary.',78,754,153,0.13,3.6,lime,700,-7);
  logo(0.27,3.6,737,1180,0.48);
  text('Design. Build. Move forward.',86,1525,32,0.55,3.6,muted,400);
  text('YOUR AGENCY. OUR EXECUTION.',86,1630,20,0.65,3.6,paper,700,2);

  // 02. Two large statements; restrained vertical reveals, generous reading hold.
  text('A CREATIVE PARTNER FOR YOUR AGENCY',86,258,21,3.6,7.2,ink,700,2);
  text('Your',78,590,162,3.67,7.2,ink,700,-7);
  text('agency.',78,768,162,3.8,7.2,ink,700,-7);
  rect('Manifesto divider',540,950,908,2,'#8FAA33',3.6,7.2);
  text('Our',78,1100,162,4.12,7.2,ink,700,-7);
  text('execution.',78,1278,144,4.25,7.2,ink,700,-7);
  text('From the first idea to the final detail.',86,1598,31,4.53,7.2,ink,400);

  // 03. A deliberately designed website specimen, rather than a generic neon wireframe.
  text('01 / DIGITAL EXPERIENCES',86,254,22,7.2,10.4,lime,700,2);
  text('Web design',80,440,108,7.25,10.4,paper,700,-4);
  text('& development.',80,565,91,7.38,10.4,paper,700,-3);
  const web=await svg('Website specimen.svg',`
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#D4FF47"/><stop offset="1" stop-color="#8BAA26"/></linearGradient></defs>
    <rect x="86" y="750" width="908" height="740" rx="18" fill="#F2F3E9"/>
    <path d="M86 804H994" stroke="#D1D5C8" stroke-width="2"/>
    <g fill="#9CA492"><circle cx="118" cy="777" r="5"/><circle cx="138" cy="777" r="5"/><circle cx="158" cy="777" r="5"/></g>
    <text x="192" y="784" font-family="Arial" font-size="16" fill="#66705E">ANGORA / DIGITAL STUDIO</text>
    <text x="132" y="866" font-family="Arial" font-size="22" font-weight="700" letter-spacing="4" fill="#101812">A /</text>
    <text x="840" y="864" font-family="Arial" font-size="15" fill="#101812">LET'S TALK ↗</text>
    <text x="132" y="1018" font-family="Arial" font-size="74" font-weight="700" letter-spacing="-4" fill="#101812">Built for</text>
    <text x="132" y="1100" font-family="Arial" font-size="74" font-weight="700" letter-spacing="-4" fill="#101812">what's next.</text>
    <text x="134" y="1166" font-family="Arial" font-size="19" fill="#66705E">Thoughtful design. Seamless experiences.</text>
    <rect x="132" y="1210" width="210" height="52" rx="26" fill="#101812"/>
    <text x="160" y="1243" font-family="Arial" font-size="17" fill="#F2F3E9">Explore the work ↗</text>
    <path d="M690 964 L920 964 L812 1180 L582 1180 Z" fill="url(#g)"/>
    <path d="M690 964 L812 1180 L738 1290 L616 1074 Z" fill="#BCD63C"/>
    <path d="M812 1180 L920 964 L966 1044 L858 1260 Z" fill="#344A2B"/>
    <path d="M132 1340H948" stroke="#CCD2C2"/>
    <text x="132" y="1400" font-family="Arial" font-size="17" fill="#66705E">STRATEGY → DESIGN → DEVELOPMENT</text>
    <text x="914" y="1420" font-family="Arial" font-size="36" fill="#101812">↗</text>`);
  const wc=picture(web,'Website / art-directed browser specimen',7.35,10.4);enter(wc,85,0.8);key(wc,'scale',0,0.95);key(wc,'scale',2.8,1.01,'linear');
  text('Considered interfaces. Confident builds.',86,1610,30,7.85,10.4,muted,400);

  // 04. A tangible typographic poster and a clean editing timeline.
  text('02 / DESIGN IN MOTION',86,254,22,10.4,13.6,ink,700,2);
  text('Graphic design.',80,440,103,10.45,13.6,ink,700,-4);
  text('Video editing.',80,562,103,10.58,13.6,ink,700,-4);
  const poster=await svg('Design poster.svg',`
    <rect x="110" y="760" width="560" height="700" fill="#101812"/>
    <text x="150" y="815" fill="#D4FF47" font-family="Arial" font-size="17" letter-spacing="3">ANGORA / DESIGN STUDY</text>
    <text x="142" y="972" fill="#F2F3E9" font-family="Arial" font-size="99" font-weight="700" letter-spacing="-6">MAKE</text>
    <text x="142" y="1060" fill="#D4FF47" font-family="Arial" font-size="84" font-weight="700" letter-spacing="-5">IT</text>
    <text x="142" y="1148" fill="#D4FF47" font-family="Arial" font-size="74" font-weight="700" letter-spacing="-4">MATTER.</text>
    <path d="M151 1370 L366 1153 L584 1370" stroke="#D4FF47" stroke-width="55" fill="none"/>
    <path d="M151 1420H622" stroke="#465342"/>
    <text x="150" y="1446" fill="#A8B3A6" font-family="Arial" font-size="13" letter-spacing="2">FORM. PURPOSE. EXPRESSION.</text>`);
  const pc=picture(poster,'Editorial poster',10.55,13.6,500,950,1,-4);enter(pc,85,0.7);
  const video=await svg('Motion editing specimen.svg',`
    <rect x="475" y="1010" width="495" height="480" rx="14" fill="#D4FF47" stroke="#101812" stroke-width="3"/>
    <text x="510" y="1060" fill="#101812" font-family="Arial" font-size="18" font-weight="700" letter-spacing="2">MOTION / IN THE MAKING</text>
    <rect x="508" y="1090" width="430" height="220" rx="7" fill="#1D2A1D"/>
    <path d="M687 1158 L687 1245 L762 1201 Z" fill="#D4FF47"/>
    <g fill="#101812"><rect x="508" y="1345" width="185" height="28" rx="4"/><rect x="700" y="1345" width="238" height="28" rx="4"/></g>
    <g fill="#769A25"><rect x="508" y="1383" width="95" height="28" rx="4"/><rect x="610" y="1383" width="210" height="28" rx="4"/><rect x="827" y="1383" width="111" height="28" rx="4"/></g>
    <text x="510" y="1460" fill="#101812" font-family="Arial" font-size="15">IDEAS, SHAPED FRAME BY FRAME.</text>`);
  const vc=picture(video,'Motion / offset editing card',10.8,13.6,540,960,1,3);enter(vc,110,0.7);
  const playhead=await svg('Editing playhead.svg','<path d="M550 1325V1430" stroke="#F2F3E9" stroke-width="3"/><path d="M543 1325H557L550 1335Z" fill="#F2F3E9"/>');
  const ph=picture(playhead,'Frame-accurate travelling playhead',10.8,13.6,540,960,1,3);enter(ph,110,0.7);key(ph,'x',0.5,0);key(ph,'x',2.7,340,'linear');
  text('Made to catch the eye. Built to stay with you.',86,1620,29,11.1,13.6,ink,400);

  // 05. A single continuous route, with three actions appearing on its beat.
  text('03 / CONNECTED WORKFLOWS',86,254,22,13.6,16.8,lime,700,2);
  text('Less busywork.',80,440,107,13.65,16.8,paper,700,-4);
  text('More possibility.',80,568,98,13.78,16.8,paper,700,-4);
  const flow=await svg('Workflow route.svg',`
    <path d="M202 845V1410" stroke="#394936" stroke-width="3"/>
    <path d="M202 845V1410" stroke="#D4FF47" stroke-width="3" stroke-dasharray="7 14"/>
    <path d="M193 1395L202 1410L211 1395" stroke="#D4FF47" stroke-width="3" fill="none"/>`);
  picture(flow,'A single clear workflow',13.8,16.8);
  [[14,840,'Capture the idea','BRIEF'],[14.2,1095,'Connect the tools','WORKFLOW'],[14.4,1350,'Move work forward','DELIVERY']].forEach(([st,y,copy,label],i)=>{
    const yy=Number(y);const c=rect(`Workflow ${label}`,550,yy,800,174,i===2?lime:'#1D291D',Number(st),16.8,'art',16);enter(c,45,0.55);
    text(`0${i+1}`,178,yy,30,Number(st)+0.05,16.8,i===2?ink:lime,700);
    text(String(copy),275,yy+15,42,Number(st)+0.05,16.8,i===2?ink:paper,700,-1);
    text(String(label),278,yy-42,16,Number(st)+0.05,16.8,i===2?ink:muted,700,2);
  });
  text('Automation, with intention.',86,1620,31,14.6,16.8,muted,400);

  // 06. One strong typographic punctuation instead of a particle explosion.
  text('THE DIFFERENCE IS IN THE DOING.',86,258,21,16.8,19.2,ink,700,2);
  text('Good',78,610,164,16.8,19.2,ink,700,-7);
  text('ideas.',78,786,164,16.9,19.2,ink,700,-7);
  text('Great',78,1090,164,17.07,19.2,ink,700,-7);
  text('execution.',78,1267,143,17.2,19.2,ink,700,-7);
  rect('Closing statement underline',540,1445,908,5,ink,17.3,19.2);

  // 07. A full closing hold. The CTA stays comfortably above social UI.
  logo(19.2,23,540,576,0.32);
  const wordmark=text('ANGORA',290,860,75,19.35,23,paper,700,12);wordmark.x=0;
  const descriptor=text('WEB SERVICES',382,936,23,19.45,23,lime,400,6);descriptor.x=0;
  text('Your agency.',125,1142,88,19.62,23,paper,700,-3);
  text('Our execution.',125,1247,88,19.75,23,lime,700,-3);
  const button=rect('Call to action / lime bar',540,1452,830,112,lime,20,23,'art',56);enter(button,30,0.55,false);
  text("Let's work together",170,1452,42,20.05,23,ink,700,-1);
  // Arrow is vector to avoid the editor's animated arrow glyph preset.
  const arrow=await svg('CTA arrow.svg','<path d="M845 1452H904M883 1431L904 1452L883 1473" fill="none" stroke="#101812" stroke-width="5"/>');
  picture(arrow,'Static CTA arrow',20.3,23);
  text('DESIGN  /  DEVELOPMENT  /  VIDEO  /  AUTOMATION',125,1610,18,20.2,23,muted,700,1);

  // Reuse the supplied project score, with fewer, quieter transition accents.
  const scoreRes=await fetch('/angora-assets/angora-beyond-bgm-23s.wav');
  const score=await asset('Angora score.wav',await scoreRes.blob(),0,0,'audio',23);
  const music=base('Score / gentle entry and resolved tail','music',0,23);music.mediaId=score.id;music.volume=1.85;music.fadeIn=0.25;music.fadeOut=1;project.clips.push(music);
  const accentRes=await fetch('/angora-assets/angora-sfx-whoosh.wav');
  const accent=await asset('Transition / soft sweep.wav',await accentRes.blob(),0,0,'audio',0.65);
  [3.5,7.1,10.3,13.5,16.7,19.1].forEach((st)=>{const c=base('Soft cut accent','sfx',st,st+0.65);c.mediaId=accent.id;c.volume=0.24;c.fadeIn=0.08;c.fadeOut=0.25;project.clips.push(c);});
  // Land scene cuts on the existing score's half-second pulse while preserving 23 seconds.
  const beats=[[0,0],[3.6,3.5],[7.2,7],[10.4,10],[13.6,13],[16.8,16.5],[19.2,19],[23,23]];
  const retime=(t:number)=>{for(let i=1;i<beats.length;i++){const [a,b]=beats[i-1], [c,d]=beats[i];if(t<=c+0.001)return b+(t-a)/(c-a)*(d-b);}return t;};
  for(const c of project.clips){if(c.type==='audio'&&c.trackId==='music')continue;const old=c.startTime;const end=snap(retime(old+c.duration));c.startTime=snap(retime(old));c.duration=snap(end-c.startTime);c.outPoint=c.duration;for(const k of c.keyframes)k.time=Math.max(0,Math.min(c.duration,snap(retime(old+k.time)-c.startTime)));}
  return project;
}
