import type { ProjectData, TimelineClip, Keyframe, MediaAsset, TextStyle } from '../types/editor';
import { createDefaultColorEffects,createDefaultCrop,createDefaultMask,createDefaultTextStyle } from './projectFactory';

export const WORLDCLASS_ID='proj-1793123822118-ozxxo';
export const WORLDCLASS_SCENES=[
  {id:'01',name:'The hook',start:0,end:4,review:2.8},
  {id:'02',name:'The capacity problem',start:4,end:8,review:6.7},
  {id:'03',name:'Meet Angora',start:8,end:12,review:10.1},
  {id:'04A',name:'Design',start:12,end:14.5,review:13.4},
  {id:'04B',name:'Develop',start:14.5,end:17,review:15.8},
  {id:'04C',name:'Edit',start:17,end:19.5,review:18.4},
  {id:'04D',name:'Automate',start:19.5,end:22,review:20.8},
  {id:'05',name:'One partner',start:22,end:26,review:24.6},
  {id:'06',name:'The payoff',start:26,end:30,review:28.8},
];

export async function buildAngoraWorldclass():Promise<ProjectData>{
 const C={ink:'#172018',paper:'#F4F5EC',sage:'#A8C256',lime:'#D7FF4A',grey:'#6B7466'};
 const now=Date.now();
 const p:ProjectData={id:WORLDCLASS_ID,name:'Instagram Story / Reels',aspectRatio:'9:16',resolution:'1080p',fps:30,createdAt:now,updatedAt:now,clips:[],mediaAssets:[],tracks:[
  ['wipe','V9 · Object-led transitions'],['grain','V8 · Paper / print finish'],['front','V7 · Foreground typography'],
  ['photo','V6 · Photo cutouts / foreground'],['type','V5 · Editorial typography'],['detail','V4 · Native design elements'],
  ['mid','V3 · Photographic prints'],['back','V2 · Paper / composition groups'],['bg','V1 · Color foundation'],
  ['score','A1 · Original 120 BPM composition'],['foley','A2 · Tactile accents'],
 ].map(([id,name],order)=>({id,name,order,type:id==='score'||id==='foley'?'audio':id==='bg'?'video':'overlay',muted:false,visible:true,locked:false}))};
 let serial=0;const frame=(n:number)=>Math.round(n*30)/30;
 const ctx=document.createElement('canvas').getContext('2d')!;
 function clip(name:string,trackId:string,start:number,end:number,parent?:TimelineClip){const s=frame(start),e=frame(end);const c:TimelineClip={id:`wc-${String(++serial).padStart(3,'0')}`,name,trackId,type:trackId==='score'||trackId==='foley'?'audio':'image',startTime:s,duration:Number((e-s).toFixed(6)),inPoint:0,outPoint:Number((e-s).toFixed(6)),sourceDuration:Infinity,playbackSpeed:1,x:0,y:0,scale:1,rotation:0,opacity:1,crop:createDefaultCrop(),mask:createDefaultMask(),effects:createDefaultColorEffects(),volume:1,muted:trackId!=='score'&&trackId!=='foley',fadeIn:0,fadeOut:0,transitionIn:{type:'none',duration:0},transitionOut:{type:'none',duration:0},keyframes:[],parentId:parent?.id};p.clips.push(c);return c;}
 function k(c:TimelineClip,prop:Keyframe['property'],time:number,value:number,curve:[number,number,number,number]=[.22,1,.36,1]){const t=frame(time);const existing=c.keyframes.find(kf=>kf.property===prop&&Math.abs(kf.time-t)<0.001);if(existing){existing.value=value;existing.bezierPoints=curve;return;}c.keyframes.push({id:`${c.id}-${prop}-${t}`,property:prop,time:t,value,easing:'cubic-bezier',bezierPoints:curve});}
 function at(c:TimelineClip,prop:Keyframe['property'],globalTime:number,value:number,curve?:[number,number,number,number]){k(c,prop,globalTime-c.startTime,value,curve);}
 function shape(name:string,x:number,y:number,w:number,h:number,color:string,start:number,end:number,track='detail',parent?:TimelineClip,r=0){const c=clip(name,track,start,end,parent);c.x=x-540;c.y=y-960;c.shapeStyle={shapeType:'rectangle',width:w,height:h,fillColor:color,fillOpacity:1,strokeColor:color,strokeWidth:0,cornerRadius:r};return c;}
 function group(name:string,start:number,end:number){const c=shape(name,540,960,1,1,C.paper,start,end,'back');c.shapeStyle!.fillOpacity=0;return c;}
 function text(content:string,left:number,y:number,size:number,start:number,end:number,color=C.ink,parent?:TimelineClip,opts:{font?:string;track?:string;tracking?:number;weight?:number;maxWidth?:number}={}){
  const c=clip(content,opts.track||'type',start,end,parent);c.type='text';const font=opts.font||'Impact';const weight=opts.weight??400,tracking=opts.tracking??0;
  ctx.font=`${weight} ${size}px "${font}"`;let w=Math.max(...content.split('\n').map(t=>ctx.measureText(t).width+Math.max(0,t.length-1)*tracking));
  if(opts.maxWidth&&w>opts.maxWidth){size*=opts.maxWidth/w;ctx.font=`${weight} ${Math.round(size)}px "${font}"`;w=Math.max(...content.split('\n').map(t=>ctx.measureText(t).width+Math.max(0,t.length-1)*tracking));}
  c.x=left+w/2-540;c.y=y-960;c.textStyle={...createDefaultTextStyle(content),fontFamily:font,fontSize:Math.round(size),fontWeight:weight,color,align:'left',letterSpacing:tracking,backgroundOpacity:0,shadowBlur:0,animationIn:'none',animationOut:'none',animationDuration:.5} as TextStyle;return c;
 }
 function label(content:string,x:number,y:number,start:number,end:number,color=C.ink,parent?:TimelineClip){return text(content,x,y,25,start,end,color,parent,{font:'Arial',weight:700,tracking:2});}
 function slide(c:TimelineClip,dx:number,dy:number,dur=.55,delay=0){k(c,'x',0,c.x+dx);if(delay>0.001)k(c,'x',delay,c.x+dx);k(c,'x',delay+dur,c.x);k(c,'y',0,c.y+dy);if(delay>0.001)k(c,'y',delay,c.y+dy);k(c,'y',delay+dur,c.y);}
 function reveal(c:TimelineClip,dur=.55,delay=0){c.mask={...createDefaultMask(),shape:'linear-wipe'};k(c,'maskWidth',0,0);if(delay>0.001)k(c,'maskWidth',delay,0);k(c,'maskWidth',delay+dur,100,[.65,0,.2,1]);}
 function depart(g:TimelineClip,start:number,dx:number,dy:number,rot=0){at(g,'x',start,0);at(g,'x',g.startTime+g.duration,dx,[.65,0,.85,.3]);at(g,'y',start,0);at(g,'y',g.startTime+g.duration,dy,[.65,0,.85,.3]);at(g,'rotation',start,0);at(g,'rotation',g.startTime+g.duration,rot,[.65,0,.85,.3]);}
 async function file(name:string,type:'image'|'audio'='image',duration=5){const r=await fetch(`/angora-worldclass/${name}`);if(!r.ok)throw new Error(`Missing production asset: ${name}`);const blob=await r.blob();let width=0,height=0;const objectUrl=URL.createObjectURL(blob);if(type==='image'){const im=new Image();im.src=objectUrl;await im.decode();width=im.naturalWidth;height=im.naturalHeight;}
 const a:MediaAsset={id:`worldclass-${name}`,name,type,mimeType:blob.type,size:blob.size,width,height,duration,hasAudio:type==='audio',codecInfo:type==='image'?'Supplied reference / original source':'Original composition · PCM stereo',thumbnails:type==='image'?[objectUrl]:[],waveform:[],objectUrl,blob,createdAt:now};p.mediaAssets.push(a);return a;}
 const [logo,symbol,grain,workspace,operator,handA,handB,studio,filmA,filmB,filmC,score,foley]=await Promise.all([
 file('official-logo.png'),file('official-symbol.png'),file('paper-grain.png'),file('workspace-print.png'),file('agency-cutout.png'),file('creative-hands.png'),file('planning-hands.png'),file('studio-photo.png'),file('film-planning.png'),file('film-editing.png'),file('film-design.png'),file('score-master.wav','audio',30),file('paper-foley.wav','audio',.34)]);
 function image(a:MediaAsset,name:string,x:number,y:number,w:number,start:number,end:number,track='mid',parent?:TimelineClip){const c=clip(name,track,start,end,parent);c.mediaId=a.id;c.x=x-540;c.y=y-960;c.scale=w/Math.min(1080,1920*a.width/a.height);return c;}
 function print(a:MediaAsset,name:string,x:number,y:number,w:number,start:number,end:number,parent:TimelineClip,rot=0){const h=w*a.height/a.width;const sh=shape(`${name} / shadow`,x+10,y+18,w+30,h+30,'#C7CBBE',start,end,'back',parent);sh.rotation=rot;
 const backing=shape(`${name} / paper margin`,x,y,w+30,h+30,C.paper,start,end,'back',parent);backing.rotation=rot;
 const c=image(a,name,x,y,w,start,end,'mid',parent);c.rotation=rot;return c;}
 // Full film foundation and organic print grain. No text or logos are flattened into these plates.
 shape('Warm-white stock',540,960,1080,1920,C.paper,0,30,'bg');
 for(const [s,e,col]of [[8,12,C.ink],[17,19.5,C.ink],[26,30,C.ink]] as [number,number,string][])shape('Forest stock',540,960,1080,1920,col,s,e,'bg');
 const gr=image(grain,'Fine organic paper grain',540,960,1080,0,30,'grain');gr.opacity=.38;

 // 01 — a typographic cause and response. Initial words are already in motion on frame zero.
 const hook=group('01 / typography choreography',0,4.15);
 label('ANGORA / EXECUTION PARTNER',84,226,0,4,C.ink,hook);
 const great=text('GREAT',78,590,240,0,4,C.ink,hook);slide(great,-1000,0,.47);
 const ideas=text('IDEAS.',78,832,240,.13,4,C.ink,hook);slide(ideas,0,460,.55);
  for(const c of [great,ideas]){at(c,'y',1.2,c.y);at(c,'y',1.7,c.y-220);at(c,'scale',1.2,1);at(c,'scale',1.7,.82);at(c,'x',1.2,c.x);at(c,'x',1.7,c.x-45);}
 const swash=shape('Lime answer strip',540,1035,930,166,C.lime,1.3,4,'detail',hook);slide(swash,-1100,0,.55);swash.rotation=-2;
 const need=text('NEED GREAT',85,935,126,1.47,4,C.ink,hook);reveal(need,.48);
 const exec=text('EXECUTION.',85,1115,174,1.65,4,C.ink,hook);slide(exec,0,260,.65);reveal(exec,.6);
 const mark=image(symbol,'Original ribbon mark / hook',875,1430,145,2.1,4,'photo',hook);slide(mark,280,0,.6);
 label('THE DIFFERENCE IS IN THE DOING.',85,1430,2.2,4,C.ink,hook);
 depart(hook,3.6,0,-720,-3);
 // A lime object grows out of the answer strip, taking the frame into the work pile.
 const iris=shape('01 → 02 / lime iris',920,1080,800,800,C.lime,3.6,4.25,'wipe');iris.shapeStyle!.shapeType='circle';k(iris,'scale',0,.02);k(iris,'scale',.32,3.5,[.6,0,.25,1]);k(iris,'x',.32,380);k(iris,'x',.65,-2000,[.65,0,.25,1]);

 // 02 — human pressure in foreground; real production material accumulates behind.
 const problem=group('02 / work gathers',4,8.45);
 label('THE AGENCY CAPACITY PROBLEM',84,226,4,8,C.ink,problem);
 const a=text('MORE CLIENTS.',80,438,136,4.03,8,C.ink,problem);slide(a,-1000,0,.45);
 const b=text('MORE WORK.',80,594,136,4.65,8,C.ink,problem);slide(b,1000,0,.45);
 const c=text('SAME TEAM.',80,750,136,5.3,8,C.ink,problem);reveal(c,.45);
 const lime=shape('Capacity underline',385,835,610,18,C.sage,5.5,8,'detail',problem);slide(lime,-900,0,.5);
 const work=print(workspace,'Supplied editing workspace fragment',690,1130,570,4.18,8.45,problem,7);slide(work,700,300,.8);
 const briefPaper=shape('Live project brief / paper',270,1190,420,500,C.sage,4.55,8.45,'back',problem);briefPaper.rotation=-8;slide(briefPaper,-700,240,.65);
 const bp=group('Project brief content',4.55,8.45);bp.parentId=problem.id;
 const bt=text('PROJECT\nBRIEF.',108,1050,69,4.7,8.45,C.ink,bp);bt.rotation=-8;reveal(bt,.4);
 text('DESIGN / WEB / VIDEO',110,1250,20,4.8,8.45,C.ink,bp,{font:'Arial',weight:700});
 const subject=image(operator,'Agency pressure / reference cutout',590,1260,690,5.2,8.45,'photo',problem);slide(subject,60,700,.85);at(subject,'scale',7.5,subject.scale);at(subject,'scale',8.4,subject.scale*.75);
 const sticky=shape('Revision note / paper',810,1390,285,180,C.lime,6,8.45,'photo',problem);sticky.rotation=7;slide(sticky,500,-100,.5);
 const rev=text('ONE MORE\nREVISION.',692,1380,43,6.1,8.45,C.ink,problem,{track:'front'});rev.rotation=7;slide(rev,500,-100,.5);
 depart(problem,7.72,1400,-100,-12);

 // 03 — paper leaves the frame, revealing the real brand through a progressive mask.
 const meet=group('03 / Angora organizes the work',8,12.25);
 label('YOUR BEHIND-THE-SCENES PARTNER',84,230,8.2,12,C.paper,meet);
 const mt=text('MEET',80,525,200,8.25,12,C.paper,meet);slide(mt,-950,0,.65);
 const an=text('ANGORA.',80,735,200,8.4,12,C.lime,meet);reveal(an,.8);
 const lg=image(logo,'Official Angora complete logo / unaltered',540,1080,840,8.75,12.25,'photo',meet);reveal(lg,.8);slide(lg,0,90,.9);
 const supporting=text('One execution partner.\nBuilt around your agency.',88,1400,39,9.2,12,C.paper,meet,{font:'Arial',weight:400});reveal(supporting,.75);
 const seam=shape('Print seam',540,1515,905,2,C.sage,9.4,12,'detail',meet);seam.shapeStyle!.shapeType='line';seam.shapeStyle!.strokeWidth=2;k(seam,'trimEnd',0,0);k(seam,'trimEnd',.8,100);
 depart(meet,11.7,-1300,0,0);

 // 04A — an actual type specimen assembles from separate native editable print layers.
 const design=group('04A / designed on the press',12,14.65);
 label('01 / GRAPHIC DESIGN & BRANDING',84,220,12,14.5,C.ink,design);
 const dh=text('DESIGN',78,465,220,12,14.5,C.ink,design);reveal(dh,.5);
 const poster=shape('Forest print stock',555,1040,690,850,C.ink,12,14.65,'back',design);poster.rotation=-5;slide(poster,850,80,.6);
 const pgroup=group('Poster art / separate type and ink',12.05,14.65);pgroup.parentId=design.id;pgroup.rotation=-5;
 const make=text('MAKE',250,785,158,12.1,14.65,C.paper,pgroup);slide(make,0,180,.45);
 const it=text('IT',250,955,158,12.23,14.65,C.sage,pgroup);slide(it,-350,0,.45);
 const matter=text('MATTER.',250,1125,148,12.36,14.65,C.lime,pgroup);reveal(matter,.5);
 label('FORM / PURPOSE / EXPRESSION',252,1350,12.5,14.65,C.paper,pgroup);
 const hand=print(handA,'Supplied designer at work / torn print',765,1260,355,12.6,14.65,design,8);slide(hand,500,250,.65);
 const chip=shape('Electric lime print swatch',178,1370,160,160,C.lime,12.6,14.65,'photo',design);chip.rotation=-8;slide(chip,-300,0,.5);
 const ink=text('INK\n01',124,1360,35,12.7,14.65,C.ink,design,{track:'front'});ink.rotation=-8;slide(ink,-300,0,.5);
 text('Social media creative\n& management',84,1535,31,12.8,14.5,C.ink,design,{font:'Arial',weight:700});
 depart(design,14.2,-1200,0,-4);

 // 04B — an explicitly marked original demo, built as separate responsive elements.
 const develop=group('04B / responsive site build',14.5,17.12);
 label('02 / WEBSITES & WEB DEVELOPMENT',84,220,14.5,17,C.ink,develop);
 const dev=text('DEVELOP',78,465,205,14.5,17,C.ink,develop);slide(dev,0,220,.5);reveal(dev,.5);
 const browser=group('Demo browser assembly',14.5,17.12);browser.parentId=develop.id;
 shape('Browser forest backing',540,1020,900,800,C.ink,14.5,17.12,'back',browser,12);
 shape('Browser page / warm stock',540,1040,876,710,C.paper,14.5,17.12,'back',browser);
 text('ANGORA / CONCEPT STUDIO',126,660,18,14.6,17.12,C.paper,browser,{font:'Arial',weight:700,tracking:2});
 text('A considered\ndigital presence.',140,855,60,14.66,17.12,C.ink,browser,{font:'Arial',weight:700,maxWidth:520});
 const hero=image(studio,'Approved studio photo / demo hero',768,1030,300,14.7,17.12,'mid',browser);hero.mask={...createDefaultMask(),shape:'rectangle',radius:0};reveal(hero,.45);
 shape('Demo service rule',360,1095,430,3,C.sage,14.85,17.12,'detail',browser);
 text('DESIGN THAT WORKS.',140,1160,27,14.8,17.12,C.ink,browser,{font:'Arial',weight:700});
 text('LET’S BUILD SOMETHING.',140,1280,24,14.9,17.12,C.ink,browser,{font:'Arial',weight:700});
 slide(browser,800,70,.65);k(browser,'skewY',0,-4);k(browser,'skewY',.8,0);at(browser,'scale',15.2,1);at(browser,'scale',16,.84);at(browser,'x',15.2,0);at(browser,'x',16,-90);
 const mobile=group('Responsive mobile layout',15.35,17.12);mobile.parentId=develop.id;
 shape('Mobile frame',843,1170,260,520,C.ink,15.35,17.12,'photo',mobile,30);
 shape('Mobile screen',843,1170,238,488,C.paper,15.35,17.12,'photo',mobile,22);
 const mtext=text('A considered\ndigital presence.',742,1050,28,15.35,17.12,C.ink,mobile,{font:'Arial',track:'front',weight:700});
 const mi=image(studio,'Responsive photo crop',843,1240,205,15.35,17.12,'photo',mobile);mi.mask={...createDefaultMask(),shape:'rectangle',height:72};
 slide(mobile,440,100,.7);reveal(mtext,.4,.15);
 text('Landing pages & funnels\nWeb apps & CMS',84,1520,32,15.2,17,C.ink,develop,{font:'Arial',weight:700});
 label('ORIGINAL DEMONSTRATION / NOT CLIENT WORK',84,1600,14.5,17,C.grey,develop);
 depart(develop,16.8,0,-1700,2);

 // 04C — photographed film frames slide through an editorial gate; the playhead cuts the type.
 const edit=group('04C / editorial cutting room',17,19.62);
 label('03 / VIDEO EDITING & MOTION GRAPHICS',84,220,17,19.5,C.paper,edit);
 const eh=text('EDIT',78,455,230,17,19.5,C.lime,edit);slide(eh,-900,0,.45);
 const strips=[filmA,filmB,filmC];
 for(let i=0;i<3;i++){const x=85+i*315;shape('Film frame / paper border',x+145,1010,298,650,C.paper,17+i*.1,19.62,'back',edit);
 const im=image(strips[i],`Editorial source frame ${i+1}`,x+145,1010,285,17+i*.1,19.62,'mid',edit);im.mask={...createDefaultMask(),shape:'rectangle',height:Math.min(100,610/(285*strips[i].height/strips[i].width)*100)};slide(im,500+i*200,0,.8);at(im,'y',17.9,im.y);at(im,'y',19.4,im.y+(i%2?55:-55),[0,0,1,1]);
 label(`0${i+1}`,x+12,1380,17.3,19.5,C.paper,edit);}
 const punch=text('FRAME BY FRAME.',84,1530,72,17.5,19.5,C.paper,edit);reveal(punch,.65);
 const cursor=shape('Editorial playhead',96,1030,7,780,C.lime,17.4,19.62,'photo',edit);k(cursor,'x',0,-444);k(cursor,'x',1.9,450,[0,0,1,1]);
 depart(edit,19.3,1250,0,0);

 // 04D — a physical job ticket travels through a drawn route, never a dashboard wall.
 const auto=group('04D / work moves through a system',19.5,22.15);
 label('04 / AUTOMATION & CRM WORKFLOWS',84,220,19.5,22,C.ink,auto);
 const ah=text('AUTOMATE',78,450,180,19.5,22,C.ink,auto);reveal(ah,.6);
 const path=shape('Workflow / connected route',540,1010,820,8,C.sage,19.5,22.15,'detail',auto);path.shapeStyle!.shapeType='line';path.shapeStyle!.strokeWidth=8;k(path,'trimEnd',0,0);k(path,'trimEnd',1.2,100,[.45,0,.2,1]);
 for(let i=0;i<3;i++){const node=shape(`Workflow step ${i+1}`,150+i*390,1010,80,80,i===2?C.lime:C.ink,19.7+i*.16,22.15,'detail',auto);node.shapeStyle!.shapeType='circle';k(node,'scale',0,.05);k(node,'scale',.5,1);text(['BRIEF','CREATE','DELIVER'][i],90+i*375,1145,39,19.8+i*.16,22,C.ink,auto,{font:'Arial',weight:700});}
 const ticket=group('Job ticket / routed across workflow',19.65,22.15);ticket.parentId=auto.id;
 const ticketPaper=shape('Routing ticket / lime',150,850,250,175,C.lime,19.65,22.15,'photo',ticket);ticketPaper.rotation=-6;
 const tick=text('PROJECT\nREADY.',48,850,46,19.65,22.15,C.ink,ticket,{track:'front'});tick.rotation=-6;
 k(ticket,'x',0,-320);k(ticket,'x',.5,0);k(ticket,'x',1,390,[.55,0,.3,1]);k(ticket,'x',1.65,780,[.55,0,.3,1]);k(ticket,'y',0,-50);k(ticket,'y',.5,0);k(ticket,'y',1.65,0);k(ticket,'rotation',1.65,0);k(ticket,'rotation',2.3,4);
 text('Connected tools.\nA clearer way to work.',85,1410,43,20.2,22,C.ink,auto,{font:'Arial',weight:700});
 depart(auto,21.8,0,1500,0);

 // 05 — individual pieces become one working partnership; photographic depth and type interact.
 const promise=group('05 / the partnership composition',22,26.18);
 label('CREATIVE + TECHNICAL + DIGITAL PRODUCTION',84,220,22,26,C.ink,promise);
 const one=text('ONE',80,505,230,22,26,C.ink,promise);slide(one,-1000,0,.5);
 const partner=text('PARTNER.',80,750,230,22.2,26,C.ink,promise);reveal(partner,.65);
 const pp=print(handB,'Partner at work / photographic print',748,1170,475,22.3,26.18,promise,5);slide(pp,700,0,.75);at(pp,'rotation',23.1,5);at(pp,'rotation',25.8,1);
 const pa=print(handA,'Creative execution / photographic print',310,1230,445,22.45,26.18,promise,-7);slide(pa,-700,80,.75);
 const limePaper=shape('Possibilities / physical lime strip',540,1390,1080,210,C.lime,23.1,26.18,'photo',promise);limePaper.rotation=-3;slide(limePaper,-1200,0,.55);
 const more=text('MORE POSSIBILITIES.',86,1380,96,23.25,26,C.ink,promise,{track:'front',maxWidth:900});more.rotation=-3;reveal(more,.7);
 text('Expand your capacity. Keep your team.',86,1545,30,23.7,26,C.ink,promise,{font:'Arial',weight:700});
 depart(promise,25.7,-1300,0,-4);
 const closePaper=shape('05 → 06 / forest sheet',540,960,1180,2050,C.ink,25.8,26.3,'wipe');k(closePaper,'x',0,1300);k(closePaper,'x',.28,0,[.65,0,.2,1]);

 // 06 — original logo, three emphatic lines, then a generous final reading hold.
 const end=group('06 / final brand payoff',26,30);
 const finalLogo=image(logo,'Official complete Angora lockup / unchanged source',540,510,820,26,30,'photo',end);reveal(finalLogo,.8,.1);slide(finalLogo,0,35,.8);
 const yc=text('YOUR CLIENTS.',84,800,115,26.25,30,C.paper,end);slide(yc,-1100,0,.6);
 const yb=text('YOUR BRAND.',84,970,115,26.5,30,C.paper,end);slide(yb,-1100,0,.6);
 const oe=text('OUR EXECUTION.',84,1140,115,26.75,30,C.lime,end,{maxWidth:906});reveal(oe,.6);
 const cta=shape('CTA / warm-white strip',540,1385,906,118,C.paper,27.15,30,'detail',end,6);slide(cta,1100,0,.55);
 const call=text("Let's Work Together.",125,1385,49,27.3,30,C.ink,end,{font:'Arial',track:'front',weight:700});reveal(call,.45);
 const arrow=shape('CTA arrow shaft',892,1385,54,4,C.ink,27.5,30,'front',end);arrow.shapeStyle!.shapeType='line';arrow.shapeStyle!.strokeWidth=4;
 const ar1=shape('CTA arrow upper',905,1375,28,4,C.ink,27.5,30,'front',end);ar1.rotation=45;
 const ar2=shape('CTA arrow lower',905,1395,28,4,C.ink,27.5,30,'front',end);ar2.rotation=-45;
 // Secondary movement on the lockup is finite; the final 1.5 seconds remain legible.
 at(finalLogo,'scale',27,finalLogo.scale);at(finalLogo,'scale',28.4,finalLogo.scale*1.018,[.45,0,.55,1]);
 const music=clip('Original / One Partner — 120 BPM instrumental','score',0,30);music.mediaId=score.id;music.volume=.9;music.fadeIn=.03;music.fadeOut=.65;
 for(const t of [3.6,7.76,11.75,14.22,16.8,19.3,21.8,25.8]){const f=clip('Paper movement / authored foley','foley',t,t+.34);f.mediaId=foley.id;f.volume=.8;f.fadeIn=.01;f.fadeOut=.06;}
 return p;
}
