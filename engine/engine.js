'use strict';
// Top-down boss-fight engine. Abyssal Blade style: 1 HP, telegraphed zones, cast bars, mana burst.
// Titan Souls style: single retrievable bolt, weak points only.
const CFG={W:960,H:540,A:{x:100,y:70,w:760,h:430},hp:1,speed:215,dash:640,dashT:.17,dashCd:.75,burstT:6};
const A=CFG.A,cv=document.getElementById('c'),ctx=cv.getContext('2d');
const PI=Math.PI,norm=a=>((a+PI)%(2*PI)+2*PI)%(2*PI)-PI,rr=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const keys={},mouse={x:480,y:270,l:0,r:0,rp:0};
let state='title',bi=0,t=0,tm=0,sub=0,P,B,zones=[],bullets=[],fx=[],spr=null;
const down=(...k)=>k.some(c=>keys[c]);
dhInit();
// ---- input
function adv(){if(state=='title'){bi=0;begin()}else if(state=='dead'&&sub>.6)begin();else if(state=='win')state='title'}
addEventListener('keydown',e=>{keys[e.code]=1;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
if(e.code=='KeyK'&&!e.repeat)mouse.rp=1;
if(e.code=='KeyQ'&&state=='play'&&P.mana>=100&&P.burst<=0){P.burst=CFG.burstT;P.mana=0}
adv()});
addEventListener('keyup',e=>keys[e.code]=0);
cv.addEventListener('mousedown',e=>{if(e.button==0)mouse.l=1;if(e.button==2){mouse.r=1;mouse.rp=1}adv();e.preventDefault()});
addEventListener('mouseup',e=>{if(e.button==0)mouse.l=0;if(e.button==2)mouse.r=0});
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('mousemove',e=>{const r=cv.getBoundingClientRect();mouse.x=(e.clientX-r.left)*CFG.W/r.width;mouse.y=(e.clientY-r.top)*CFG.H/r.height});
// ---- helpers used by boss scripts
const zc=(x,y,r,tel,act=.3)=>zones.push({k:'c',x,y,r,tel,act,t:0});
const zb=(x,y,a,w,tel,act=.3,len=1400)=>zones.push({k:'b',x,y,a,w,tel,act,len,t:0});
const zr=(x,y,r0,r1,tel,act=.3)=>zones.push({k:'r',x,y,r0,r1,tel,act,t:0});
const bl=(x,y,a,sp,r=6)=>bullets.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r});
const ring=(x,y,n,sp,off=0)=>{for(let i=0;i<n;i++)bl(x,y,off+i*2*PI/n,sp)};
const aimP=(x,y)=>Math.atan2(P.y-y,P.x-x);
const spark=(x,y,c='#fc4')=>{for(let i=0;i<6;i++)fx.push({x,y,vx:rr(-160,160),vy:rr(-160,160),l:rr(.15,.4),c})};
function* cast(name,T){B.cast={name,T,t:0};yield T;B.cast=null}
function* expose(T){B.weak.open=true;B.stun=true;yield T;B.weak.open=false;B.stun=false}
function* goto(x,y,sp=200){B.tgt={x,y,sp};yield()=>!B.tgt}
function mk(o){return Object.assign({max:o.hp,face:PI/2,weak:{open:false,r:15},stun:false,cast:null,tgt:null,wait:1.4,cond:null,flash:0,k:1},o,{gen:null})}
const weakPos=()=>({x:B.x+Math.cos(B.face+PI)*B.r*.95,y:B.y+Math.sin(B.face+PI)*B.r*.95});
// ---- flow
function begin(){P={x:480,y:440,r:8,hp:CFG.hp,vx:0,vy:0,dash:0,dcd:0,dx:0,dy:0,swing:0,scd:0,sa:0,hb:0,hw:0,mana:0,burst:0,bolt:{s:'held',x:0,y:0,vx:0,vy:0,life:0,hit:0}};
B=BOSSES[bi]();B.gen=B.script();zones=[];bullets=[];fx=[];state='intro';sub=1.8;tm=0;mouse.rp=0}
function hurt(){if(P.dash>0||state!='play')return;P.hp--;if(P.hp<=0){state='dead';sub=0;for(let i=0;i<30;i++)fx.push({x:P.x,y:P.y,vx:rr(-300,300),vy:rr(-300,300),l:rr(.3,.9),c:'#c22'})}}
function dmg(n){B.hp-=n;B.flash=.12;const w=weakPos();spark(w.x,w.y);
if(B.hp<=0){state='clear';sub=3;zones=[];bullets=[];B.cast=null;for(let i=0;i<50;i++)fx.push({x:B.x,y:B.y,vx:rr(-300,300),vy:rr(-300,300),l:rr(.4,1.2),c:'#fc4'})}}
const addMana=n=>{if(P.burst<=0)P.mana=Math.min(100,P.mana+n)};
// ---- update
function fxu(dt){for(const f of fx){f.l-=dt;f.x+=(f.vx||0)*dt;f.y+=(f.vy||0)*dt}fx=fx.filter(f=>f.l>0)}
function updP(dt){
let mx=(down('KeyD','ArrowRight')?1:0)-(down('KeyA','ArrowLeft')?1:0),my=(down('KeyS','ArrowDown')?1:0)-(down('KeyW','ArrowUp')?1:0);const ml=Math.hypot(mx,my);if(ml){mx/=ml;my/=ml}
const aim=Math.atan2(mouse.y-P.y,mouse.x-P.x);P.dcd-=dt;
if(down('Space','ShiftLeft')&&P.dcd<=0&&P.dash<=0){P.dash=CFG.dashT;P.dcd=CFG.dashCd;P.dx=ml?mx:Math.cos(aim);P.dy=ml?my:Math.sin(aim)}
if(P.dash>0){P.dash-=dt;P.vx=P.dx*CFG.dash;P.vy=P.dy*CFG.dash}else{P.vx=mx*CFG.speed;P.vy=my*CFG.speed}
P.x=clamp(P.x+P.vx*dt,A.x+P.r,A.x+A.w-P.r);P.y=clamp(P.y+P.vy*dt,A.y+P.r,A.y+A.h-P.r);
const d=Math.hypot(P.x-B.x,P.y-B.y),m=B.r+P.r;if(d<m&&d>0){P.x=B.x+(P.x-B.x)/d*m;P.y=B.y+(P.y-B.y)/d*m}
// blade
P.scd-=dt;if(P.swing>0)P.swing-=dt;if(P.burst>0)P.burst-=dt;
if((mouse.l||keys.KeyJ)&&P.scd<=0){P.swing=.14;P.sa=aim;P.hb=0;P.hw=0;P.scd=P.burst>0?.15:.36}
if(P.swing>0){const R=62;
for(const b of bullets)if(Math.hypot(b.x-P.x,b.y-P.y)<R&&Math.abs(norm(Math.atan2(b.y-P.y,b.x-P.x)-P.sa))<1.4){b.dead=1;spark(b.x,b.y,'#c6f')}
if(!P.hb&&Math.hypot(B.x-P.x,B.y-P.y)<B.r+R&&Math.abs(norm(Math.atan2(B.y-P.y,B.x-P.x)-P.sa))<1.5){P.hb=1;addMana(5)}
if(B.weak.open&&!P.hw){const w=weakPos();if(Math.hypot(w.x-P.x,w.y-P.y)<R+B.weak.r&&Math.abs(norm(Math.atan2(w.y-P.y,w.x-P.x)-P.sa))<1.5){P.hw=1;addMana(12);dmg(P.burst>0?2:1)}}}
// bolt (one projectile: throw, then recall or walk over it)
const T=P.bolt;
if(mouse.rp){mouse.rp=0;if(T.s=='held'){T.s='fly';T.x=P.x;T.y=P.y;T.vx=Math.cos(aim)*780;T.vy=Math.sin(aim)*780;T.life=.65;T.hit=0}else if(T.s!='recall'){T.s='recall';T.hit=0}}
const boltHit=()=>{if(B.weak.open&&!T.hit){const w=weakPos();if(Math.hypot(w.x-T.x,w.y-T.y)<B.weak.r+6){T.hit=1;addMana(10);dmg((P.burst>0?2:1)*3);if(T.s=='fly')T.s='ground'}}};
if(T.s=='fly'){T.x+=T.vx*dt;T.y+=T.vy*dt;T.life-=dt;boltHit();
if(T.s=='fly'&&Math.hypot(T.x-B.x,T.y-B.y)<B.r)T.s='ground';
if(T.x<A.x||T.x>A.x+A.w||T.y<A.y||T.y>A.y+A.h){T.x=clamp(T.x,A.x,A.x+A.w);T.y=clamp(T.y,A.y,A.y+A.h);T.s='ground'}
if(T.life<=0&&T.s=='fly')T.s='ground'}
else if(T.s=='recall'){const dd=Math.hypot(P.x-T.x,P.y-T.y);if(dd<14)T.s='held';else{T.x+=(P.x-T.x)/dd*950*dt;T.y+=(P.y-T.y)/dd*950*dt;boltHit()}}
else if(T.s=='ground'&&Math.hypot(P.x-T.x,P.y-T.y)<16)T.s='held'}
function updBoss(dt){B.k=B.hp<B.max/2?.7:1;B.flash-=dt;if(B.cast)B.cast.t+=dt;
if(!B.stun){const d=norm(Math.atan2(P.y-B.y,P.x-B.x)-B.face),s=B.turn*dt;B.face+=Math.abs(d)<s?d:Math.sign(d)*s}
if(B.tgt){const dx=B.tgt.x-B.x,dy=B.tgt.y-B.y,d=Math.hypot(dx,dy),s=B.tgt.sp*dt;if(d<=s){B.x=B.tgt.x;B.y=B.tgt.y;B.tgt=null}else{B.x+=dx/d*s;B.y+=dy/d*s}}
if(B.cond){if(B.cond())B.cond=null;else return}
B.wait-=dt;if(B.wait<=0){const r=B.gen.next();const v=r.value;if(typeof v=='number')B.wait=v;else if(typeof v=='function')B.cond=v;else B.wait=0}}
function updZones(dt){for(const z of zones){z.t+=dt;if(z.t>=z.tel&&z.t<z.tel+z.act){const pr=P.r*.6;let h=false;
if(z.k=='c')h=Math.hypot(P.x-z.x,P.y-z.y)<z.r+pr;
else if(z.k=='b'){const ux=Math.cos(z.a),uy=Math.sin(z.a),px=P.x-z.x,py=P.y-z.y,s=clamp(px*ux+py*uy,0,z.len);h=Math.hypot(px-ux*s,py-uy*s)<z.w/2+pr}
else{const d=Math.hypot(P.x-z.x,P.y-z.y);h=d>z.r0-pr&&d<z.r1+pr}
if(h)hurt()}}
zones=zones.filter(z=>z.t<z.tel+z.act)}
function updBullets(dt){for(const b of bullets){b.x+=b.vx*dt;b.y+=b.vy*dt;if(Math.hypot(b.x-P.x,b.y-P.y)<b.r+P.r*.6)hurt();if(b.x<A.x-40||b.x>A.x+A.w+40||b.y<A.y-40||b.y>A.y+A.h+40)b.dead=1}bullets=bullets.filter(b=>!b.dead)}
function update(dt){t+=dt;
if(state=='title'||state=='win')return;
if(state=='intro'){sub-=dt;if(sub<=0)state='play';return}
if(state=='dead'){sub+=dt;fxu(dt);return}
if(state=='clear'){sub-=dt;fxu(dt);if(sub<=0){if(bi>=BOSSES.length-1)state='win';else{bi++;begin()}}return}
tm+=dt;updP(dt);if(state!='play')return;updBoss(dt);updZones(dt);updBullets(dt);fxu(dt)}
// ---- draw
function drawZone(z){const tel=z.t<z.tel,p=Math.min(1,z.t/z.tel),f=tel?'rgba(255,40,60,.15)':'rgba(255,120,130,.85)';ctx.fillStyle=f;ctx.strokeStyle='rgba(255,80,90,.9)';ctx.lineWidth=2;
if(z.k=='c'){ctx.beginPath();ctx.arc(z.x,z.y,z.r,0,7);ctx.fill();if(tel){ctx.stroke();ctx.fillStyle='rgba(255,40,60,.3)';ctx.beginPath();ctx.arc(z.x,z.y,z.r*p,0,7);ctx.fill()}}
else if(z.k=='b'){ctx.save();ctx.translate(z.x,z.y);ctx.rotate(z.a);ctx.fillRect(0,-z.w/2,z.len,z.w);if(tel){ctx.strokeRect(0,-z.w/2,z.len,z.w);ctx.fillStyle='rgba(255,40,60,.3)';ctx.fillRect(0,-z.w/2*p,z.len,z.w*p)}ctx.restore()}
else{ctx.beginPath();ctx.arc(z.x,z.y,z.r1,0,2*PI);ctx.moveTo(z.x+z.r0,z.y);ctx.arc(z.x,z.y,z.r0,0,2*PI);ctx.fill('evenodd');if(tel){ctx.beginPath();ctx.arc(z.x,z.y,z.r1,0,7);ctx.stroke()}}}
function drawBoss(){const k=B.flash>0;ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.ellipse(B.x,B.y+B.r*.8,B.r,B.r*.35,0,0,7);ctx.fill();
ctx.fillStyle=k?'#fff':'#120819';ctx.strokeStyle=B.hp<B.max/2?'#f80':'#a0f';ctx.lineWidth=4;ctx.beginPath();ctx.arc(B.x,B.y,B.r,0,7);ctx.fill();ctx.stroke();
ctx.fillStyle='#e22';for(const s of[-.45,.45]){ctx.beginPath();ctx.arc(B.x+Math.cos(B.face+s)*B.r*.62,B.y+Math.sin(B.face+s)*B.r*.62,B.r*.1,0,7);ctx.fill()}
const w=weakPos();if(B.weak.open){const g=8+4*Math.sin(t*14);ctx.fillStyle='rgba(255,220,60,.35)';ctx.beginPath();ctx.arc(w.x,w.y,B.weak.r+g,0,7);ctx.fill();ctx.fillStyle='#fd4';ctx.beginPath();ctx.arc(w.x,w.y,B.weak.r,0,7);ctx.fill()}
else{ctx.fillStyle='#333';ctx.beginPath();ctx.arc(w.x,w.y,B.weak.r*.5,0,7);ctx.fill()}}
function drawPlayer(){ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.ellipse(P.x,P.y+10,12,5,0,0,7);ctx.fill();
if(!DH.ready)return;
const nm=state=='dead'?'death':P.dash>0?'dash':P.swing>0?'attack':(P.vx||P.vy)?'walk':'idle';
if(P.nm!=nm){P.nm=nm;P.ts=t}const el=t-P.ts,fr=dhFrame(nm,el),im=fr||DH.frames[0];
const S=.78;let sx=1,sy=1,ox=0,oy=0,rot=0,al=1,sa=null;
if(!fr){if(nm=='idle')sy=1+Math.sin(t*3)*.025;
else if(nm=='walk'){const w=Math.abs(Math.sin(t*13));oy=-w*3;rot=Math.sin(t*13)*.07;sy=1+w*.03}
else if(nm=='dash'){sa=Math.atan2(P.dy,P.dx);sx=1.45;sy=.75}
else if(nm=='attack'){const k=Math.max(P.swing,0)/.14;ox=Math.cos(P.sa)*7*k;oy=Math.sin(P.sa)*5*k;rot=Math.cos(P.sa)*.12*k}
else if(nm=='death'){rot=Math.min(el*4,PI/2);al=Math.max(0,1-el*.5);oy=Math.min(el*30,10)}}
if(nm=='dash')al=.55;
ctx.save();ctx.globalAlpha=al;ctx.translate(P.x+ox,P.y+10+oy);ctx.imageSmoothingEnabled=false;
if(P.burst>0){ctx.shadowColor='#6af';ctx.shadowBlur=18}
if(sa!==null){ctx.rotate(sa);ctx.scale(sx,sy);ctx.rotate(-sa)}else ctx.scale(sx,sy);
ctx.rotate(rot);if(mouse.x<P.x)ctx.scale(-1,1);
ctx.drawImage(im,-im.width*S/2,-im.height*S,im.width*S,im.height*S);ctx.restore();
if(P.swing>0&&state!='dead'){ctx.strokeStyle='rgba(255,255,255,'+(P.swing/.14)+')';ctx.lineWidth=7;ctx.beginPath();ctx.arc(P.x,P.y-8,52,P.sa-1.3,P.sa+1.3);ctx.stroke()}}
function drawBolt(){const T=P.bolt;if(T.s=='held')return;ctx.fillStyle='#c6f';ctx.shadowColor='#c6f';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(T.x,T.y,T.s=='ground'?5+Math.sin(t*8)*1.5:6,0,7);ctx.fill();ctx.shadowBlur=0;
if(T.s=='ground'){ctx.strokeStyle='rgba(200,100,255,.5)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(T.x,T.y,12+Math.sin(t*5)*3,0,7);ctx.stroke()}}
function bar(x,y,w,h,v,c,bg='#222'){ctx.fillStyle=bg;ctx.fillRect(x,y,w,h);ctx.fillStyle=c;ctx.fillRect(x,y,w*clamp(v,0,1),h)}
function hud(){ctx.textAlign='center';ctx.font='bold 16px monospace';ctx.fillStyle='#fff';ctx.fillText(B.name,480,22);bar(280,28,400,9,B.hp/B.max,B.hp<B.max/2?'#f80':'#e22','#400');
if(B.cast){ctx.font='13px monospace';ctx.fillStyle='#fff';ctx.fillText(B.cast.name,480,56);bar(330,60,300,7,B.cast.t/B.cast.T,'#fff','#333')}
ctx.textAlign='left';ctx.font='14px monospace';ctx.fillStyle='#bbb';ctx.fillText(tm.toFixed(1)+'s',14,22);
ctx.fillStyle='#fff';ctx.fillText('HP '+'♥'.repeat(Math.max(P.hp,0)),14,42);
ctx.fillText('MANA',14,516);bar(60,507,200,10,P.burst>0?P.burst/CFG.burstT:P.mana/100,P.burst>0||P.mana>=100?'#6cf':'#38c','#123');
if(P.burst>0||P.mana>=100){ctx.fillStyle='#6cf';ctx.fillText(P.burst>0?'BURST!':'Q: BURST',270,516)}
ctx.fillStyle=P.bolt.s=='held'?'#c6f':'#777';ctx.fillText('BOLT '+({held:'READY',fly:'AWAY',ground:'ON FLOOR - walk over / RMB recall',recall:'RETURNING'})[P.bolt.s],640,516);
ctx.textAlign='right';ctx.fillStyle='#fff';ctx.fillText('FACE',W3-100,22);const got=bi+(state=='clear'||state=='win'?1:0);for(let i=0;i<BOSSES.length;i++){ctx.fillStyle=i<got?'#bbb':'#333';ctx.fillRect(W3-90+i*28,8,22,22)}}
const W3=960;
function overlay(a,b,c){ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(0,0,960,540);ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='bold 48px monospace';ctx.fillText(a,480,250);ctx.font='18px monospace';ctx.fillText(b,480,295);if(c)ctx.fillText(c,480,330)}
function draw(){ctx.fillStyle='#07040d';ctx.fillRect(0,0,960,540);ctx.fillStyle='#150b1f';ctx.fillRect(A.x,A.y,A.w,A.h);
ctx.strokeStyle='rgba(150,80,200,.12)';ctx.lineWidth=1;ctx.beginPath();for(let x=A.x;x<=A.x+A.w;x+=40){ctx.moveTo(x,A.y);ctx.lineTo(x,A.y+A.h)}for(let y=A.y;y<=A.y+A.h;y+=40){ctx.moveTo(A.x,y);ctx.lineTo(A.x+A.w,y)}ctx.stroke();
ctx.strokeStyle='#7a2a9a';ctx.lineWidth=3;ctx.strokeRect(A.x,A.y,A.w,A.h);
if(state=='title'){ctx.textAlign='center';ctx.fillStyle='#c33';ctx.font='bold 64px monospace';ctx.fillText('DARKHEART',480,170);ctx.fillStyle='#fff';ctx.font='18px monospace';
['One hit kills you. Read the red zones.','WASD move   Space/Shift dash (i-frames)','LMB / J  Abyssal Blade (reflects bullets, builds mana)','RMB / K  throw the bolt, again to recall - ONE bolt only','Q  burst when mana is full','Hit the glowing weak point on his back while it is open.','Press any key'].forEach((s,i)=>ctx.fillText(s,480,230+i*32));return}
for(const z of zones)drawZone(z);
if(!(state=='clear'&&sub<1.5))drawBoss();drawBolt();
ctx.fillStyle='#f42';ctx.shadowColor='#f42';ctx.shadowBlur=8;for(const b of bullets){ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,7);ctx.fill()}ctx.shadowBlur=0;
drawPlayer();for(const f of fx){ctx.fillStyle=f.c||'#fc4';ctx.fillRect(f.x-2,f.y-2,4,4)}
hud();
if(state=='intro'){ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='bold 42px monospace';ctx.fillText('BOSS '+(bi+1)+': '+B.name,480,270)}
if(state=='dead')overlay('YOU DIED','Press any key to retry');
if(state=='clear')overlay('FRAGMENT OF HIS FACE RECOVERED','Time '+tm.toFixed(1)+'s');
if(state=='win')overlay('ENGINE DEMO COMPLETE','All bosses down. Story comes next.','Press any key')}
let last=performance.now();(function loop(n){requestAnimationFrame(loop);const dt=Math.min((n-last)/1000,.033);last=n;update(dt);draw()})(last);
