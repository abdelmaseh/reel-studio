import React from 'react';
import {fitOnLines} from '../core/type';
import {useTypographyFont} from '../creative-kit/chapter-theme';
import {displayWeight,displayLineHeight,useDesignBottom,useFitEnabled} from './design-safety';
const background=(node:React.ReactNode)=>React.isValidElement(node)&&Boolean((node.type as any).designBackground);
const value=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)?n:typeof n==='string'&&/^[0-9.]+px$/.test(n)?parseFloat(n):0;
/** Measure authored element boxes before mounting them; texture and empty full-canvas SVGs are decorative. */
function extent(node:React.ReactNode,font:string,native:string):number {
 if(!React.isValidElement(node))return 0;
 const p=node.props as any;
 if(background(node)||node.type==='svg'||Boolean((node.type as any).designDecoration))return 0;
 const children=React.Children.toArray(p.children),child=Math.max(0,...children.map(c=>extent(c,font,native)));
 const top=value(p.y??p.top??p.style?.top),h=value(p.h??p.height??p.style?.height);
 if(p.L)return top+p.L.lines.length*p.L.box+p.L.size*.34;
 if(p.plan)return top+value(p.plan.height ?? (p.plan.lines?.length??0)*p.plan.box)+34;
 if(p.rows)return top+24+p.rows.reduce((sum:number,row:any)=>sum+row.h,0)+80;
 if(p.text && p.size && !p.style){
  const family=p.family??font,weight=displayWeight(family,native,p.weight??700),size=p.size;
  const t=fitOnLines(p.text,{fontFamily:family,fontWeight:weight,fontSize:size},{maxBoxWidth:p.width??950,maxLines:p.lines??2,min:p.min??size,max:size,lineHeight:displayLineHeight(family,native,p.lh??1.2)});
  return top+t.lines.length*t.lineBox+24;
 }
 if(children.some(c=>typeof c==='string'&&c.trim()))return top+Math.max(h,value(p.style?.lineHeight)||value(p.style?.fontSize)*1.3)+child;
 return top+Math.max(child,h<1500?h:0);
}
export const FittedContent:React.FC<{native:string;children?:React.ReactNode}>=({native,children})=>{
 const font=useTypographyFont()??native,limit=useDesignBottom();
 const enabled=useFitEnabled();
 const nodes=React.Children.toArray(children),bg:React.ReactNode[]=[],content:React.ReactNode[]=[];
 for(const n of nodes)(background(n)?bg:content).push(n);
 const natural=Math.max(250,...content.map(n=>extent(n,font,native))),scale=Math.min(1,(limit-250)/Math.max(1,natural-250));
 if(!enabled)return <>{children}</>;
 return <>{bg}<div data-content-natural-bottom={natural} data-content-bottom={250+(natural-250)*scale} data-content-scale={scale} style={{position:'absolute',inset:0,transform:scale<1?'scale('+scale+')':undefined,transformOrigin:'540px 250px'}}>{content}</div></>;
};
