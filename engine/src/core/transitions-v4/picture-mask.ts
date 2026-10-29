/** Picture geometry only; captions stay above transitions. The single plate stays beneath the masked picture. Coordinates are canvas pixels. */
export type PictureMasks = {incoming:string;outgoing:string};
export const hiddenPicture = 'inset(0 0 100% 0)';
export const fullPicture = 'inset(0)';
export const edgePictureMasks = (incomingEdge:number,outgoingEdge=incomingEdge,width=1080):PictureMasks => ({
  incoming:`inset(0 0 0 ${Math.max(0,Math.min(width,incomingEdge))}px)`,
  outgoing:`inset(0 ${Math.max(0,width-Math.max(0,outgoingEdge))}px 0 0)`,
});
export const lensPictureMasks = (cx:number,cy:number,r:number,width=1080,height=1920):PictureMasks => ({
  incoming:`circle(${r}px at ${cx}px ${cy}px)`,
  outgoing:`path(evenodd, "M0 0H${width}V${height}H0Z M${cx-r} ${cy}a${r} ${r} 0 1 0 ${2*r} 0a${r} ${r} 0 1 0 ${-2*r} 0Z")`,
});
