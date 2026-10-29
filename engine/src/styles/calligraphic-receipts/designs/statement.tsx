import {StatementBand} from '../../../style-kit/statement-band';
import React from 'react';

import {W, X1, useInkLayout, TornPaper, InkBlock, BrushRule, Kicker} from './kit';

import type {FamilyDesignProps} from '../../family-designs';
import {DesignRoot, sceneCopy, statementPlacement} from './kit';

export const Statement: React.FC<FamilyDesignProps> = (props) => {
  const {scene,headBox}=props;
  if (scene.family !== 'statement') return null;
  const d = scene.data;
  const copy = sceneCopy(d), inkLayout = useInkLayout();
  const L = inkLayout(d.title, [{lines: 1, size: 118, min: 92, lh: 1.15}, {lines: 2, size: 96, min: 70, lh: 1.12}]);
  if(!headBox || 306+L.lines.length*L.box+L.size*.34+54>headBox.y-40)return <StatementBand {...props} font={L.family}/>;
  const placement = statementPlacement(L, headBox);
  if (!placement.visible) return null;
  const top = placement.top, kTop = placement.kickerTop;
  L.size = placement.size; L.box = placement.box; L.baseline = placement.baseline;
  const textBottom = top + L.lines.length * L.box;
  const ruleTop = textBottom + 8;
  const tearY = ruleTop + 46;
  return <DesignRoot copy={copy}>
    <TornPaper tearY={tearY} seed={9} pitch={L.box} offset={top + L.baseline} height={tearY + 40}>
      <Kicker text={d.kicker} top={kTop} at={2} right={W - X1}/>
      <InkBlock L={L} top={top} at={6}/>
      <BrushRule left={X1 - 520} top={ruleTop} w={520} h={30} at={6 + (L.lines.length - 1) * 18 + 14} dur={16}/>
    </TornPaper>
  </DesignRoot>;
};

