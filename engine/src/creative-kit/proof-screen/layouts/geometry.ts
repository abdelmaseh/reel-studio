import type {ProofScreenData} from '../schema.ts';

export function proofLayoutGeometry(page:ProofScreenData['page'],count:number){
  const columns=page==='dashboard'?2:1,rows=Math.ceil(count/columns),gap=page==='dashboard'?12:10;
  return {width:page==='dashboard'?316:page==='chat'?570:644,
    height:Math.min(page==='dashboard'?260:196,Math.floor((872-(rows-1)*gap)/rows)),gap,columns};
}
export function proofFocusOrigin(data:ProofScreenData):string{
  const index=data.focus??0,g=proofLayoutGeometry(data.page,data.blocks.length);
  const x=data.page==='dashboard'?(index%2===0?28+644-g.width/2:28+g.width/2)
    :data.page==='chat'?(index%2===0?28+644-g.width/2:28+g.width/2):350;
  const y=98+Math.floor(index/g.columns)*(g.height+g.gap)+g.height/2;
  return `${x}px ${y}px`;
}
