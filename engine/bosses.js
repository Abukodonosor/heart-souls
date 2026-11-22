'use strict';
// Each boss = a looping script. `yield n` waits n seconds, `yield fn` waits until fn() is true.
// Zones are telegraphed first (tel seconds), then hit. Weak point only works while expose() is running.
const cx=A.x+A.w/2,cy=A.y+A.h/2;
const lead=(s=.45)=>[clamp(P.x+P.vx*s,A.x+20,A.x+A.w-20),clamp(P.y+P.vy*s,A.y+20,A.y+A.h-20)];
const BOSSES=[
// 1. THE WARDEN - teaches: dodge zones, circle behind, hit the back
()=>mk({name:'THE WARDEN',r:38,hp:8,turn:1.5,x:cx,y:A.y+120,script:function*(){
while(true){
for(let i=0;i<3;i++){const[x,y]=lead();const T=.85*B.k;zc(x,y,72,T);yield*cast('CRUSH',T)}
{const a=aimP(B.x,B.y),T=1*B.k;for(const o of[-.6,0,.6])zb(B.x,B.y,a+o,38,T);yield*cast('EDGE BREAKER',T)}
yield .3;
{const T=.8*B.k;yield*cast('SHOCKWAVE',T);ring(B.x,B.y,14,170);if(B.k<1){yield .5;ring(B.x,B.y,14,170,.22)}}
yield* expose(2.4);
yield* goto(rr(A.x+150,A.x+A.w-150),rr(A.y+90,A.y+220),220);
}}}),
// 2. THE WRAITH - teaches: bullet spirals, beam crosses, blink windows
()=>mk({name:'THE WRAITH',r:30,hp:11,turn:2.4,x:cx,y:A.y+100,script:function*(){
while(true){
{const T=1.7*B.k;for(let i=0;i<8;i++)zc(rr(A.x+40,A.x+A.w-40),rr(A.y+40,A.y+A.h-40),58,1+i*.1);yield*cast('DARK RAIN',T)}
{const T=1*B.k;zb(A.x,P.y,0,34,T,.3,A.w);zb(P.x,A.y,PI/2,34,T,.3,A.h);if(B.k<1)zb(A.x,P.y+90,0,34,T+.2);yield*cast('SCYTHE',T)}
{const dx=rr(A.x+80,A.x+A.w-80),dy=rr(A.y+70,A.y+200),T=.7*B.k;zc(dx,dy,44,T);yield*cast('BLINK',T);B.x=dx;B.y=dy;spark(dx,dy,'#a0f')}
for(let i=0;i<18;i++){bl(B.x,B.y,i*.38,185+(B.k<1?30:0));yield .08*B.k}
yield* expose(2);
}}}),
// 3. THE HEART EATER - gaps in expanding rings, rotating beams, spirals
()=>mk({name:'THE HEART EATER',r:50,hp:16,turn:1.15,x:cx,y:cy-50,script:function*(){
yield* goto(cx,cy-60,150);
while(true){
{const T=.8*B.k;zc(B.x,B.y,130,T);yield*cast('HEARTBEAT',T);zr(B.x,B.y,160,270,T);yield*cast('HEARTBEAT',T);zr(B.x,B.y,300,460,T);yield*cast('HEARTBEAT',T)}
{const T=1.05*B.k,b0=rr(0,PI);for(let i=0;i<4;i++)zb(B.x,B.y,b0+i*PI/2,40,T);yield*cast('CROSS',T);for(let i=0;i<4;i++)zb(B.x,B.y,b0+PI/4+i*PI/2,40,T);if(B.k<1)ring(B.x,B.y,10,150);yield*cast('CROSS',T)}
{B.cast={name:'DEVOUR',T:1.6,t:0};for(let i=0;i<40;i++){for(let a=0;a<3;a++)bl(B.x,B.y,i*.3+a*2.094,170);B.cast.t=i/40*1.6;yield .06*B.k}B.cast=null}
for(let i=0;i<2;i++){const[x,y]=lead(.3),T=.9*B.k;zc(x,y,115,T);yield*cast('MAW',T)}
yield* expose(2.2);
}}})
];
