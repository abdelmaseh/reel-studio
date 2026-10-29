export const clamp=(x:number,a=0,b=1)=>Math.min(b,Math.max(a,x));
export const progress=(t:number,a:number,d:number)=>clamp((t-a)/d);
export const lerp=(a:number,b:number,k:number)=>a+(b-a)*k;
export const hash=(a:number,b=0)=>{const h=Math.sin(a*127.1+b*311.7)*43758.5453;return h-Math.floor(h);};
export const E={cubOut:(x:number)=>1-(1-x)**3,cubIn:(x:number)=>x*x*x,
  cubIO:(x:number)=>x<.5?4*x*x*x:1-(-2*x+2)**3/2,
  sinOut:(x:number)=>Math.sin(x*Math.PI/2),sinIO:(x:number)=>-(Math.cos(Math.PI*x)-1)/2,
  expOut:(x:number)=>x>=1?1:1-2**(-10*x),expIn:(x:number)=>x<=0?0:2**(10*x-10),
  expIO:(x:number)=>x<=0?0:x>=1?1:x<.5?2**(20*x-10)/2:(2-2**(-20*x+10))/2,
  back:(x:number)=>1+2.70158*(x-1)**3+1.70158*(x-1)**2};
