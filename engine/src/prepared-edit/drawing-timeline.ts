import {transitionDrawingTail,TRANSITION_RULES, type TransitionEntry, type TransitionScene} from './graphics-transitions.ts';

/** Drawing windows only. Authored scene, audio, caption and camera boundaries stay nominal. */
export function sceneDrawingWindows(scenes: readonly TransitionScene[], transitions: readonly TransitionEntry[] = []) {
  return scenes.map((scene,index) => {
    const incoming=transitions.find(t=>t.atFrame===scene.fromFrame && (TRANSITION_RULES[t.kind].lead || TRANSITION_RULES[t.kind].needsOutgoing));
    const next=scenes[index+1];
    const outgoing=next && transitions.find(t=>t.atFrame===next.fromFrame && (TRANSITION_RULES[t.kind].lead || TRANSITION_RULES[t.kind].tail || TRANSITION_RULES[t.kind].needsOutgoing));
    const lead=incoming ? TRANSITION_RULES[incoming.kind].lead ?? 0 : 0;
    const tail=outgoing ? transitionDrawingTail(outgoing) : 0;
    const delegated=outgoing && TRANSITION_RULES[outgoing.kind].needsOutgoing;
    return {lead,tail,incoming,outgoing,renderFromFrame:scene.fromFrame-lead,
      renderEndFrame:delegated ? next.fromFrame-(TRANSITION_RULES[outgoing.kind].lead??0) : scene.fromFrame+scene.durationInFrames+tail};
  });
}

export function drawingClock(scene: TransitionScene, lead: number, frame: number, freezeOutgoing=false) {
  const nominal=frame-scene.fromFrame;
  return {graphics:lead+(freezeOutgoing?Math.min(scene.durationInFrames-1,nominal):nominal),
    camera:Math.max(0,Math.min(scene.durationInFrames-1,nominal))};
}
