import React from 'react';
import {useCurrentFrame,useVideoConfig} from 'remotion';
import {CanvasFill,useProbe} from '../../core/safe';
import {displayDigits} from '../../core/digits.ts';
import {useSceneTheme} from '../chapter-theme';
import {useDigits} from '../digits';
import {ChatWindow} from '../ui-chat';
import {FitText} from '../primitives';
import {SceneStickerSlot} from '../sticker-view';
import type {StyleFamily} from '../schema';
import type {ChatThreadScene} from './schema.ts';
import {chatMessageFrames,chatTypingFrames,notificationCards} from './timing.ts';

export const ChatThreadSceneView:React.FC<{scene:ChatThreadScene;style:StyleFamily}>=({scene,style})=>{
  const theme=useSceneTheme(style),digits=useDigits(),frame=useCurrentFrame(),{fps}=useVideoConfig(),probe=useProbe();
  const d=scene.data,times=chatMessageFrames(d,fps),title=[d.app,d.title].filter(Boolean).join(' · ');
  const messages=d.messages.map((m,i)=>({role:m.from==='me'?'user' as const:'ai' as const,text:displayDigits(m.text,digits),atFrame:times[i],reveal:'instant' as const,wholeText:true,typing:d.variant==='typing'}));
  return <><CanvasFill background={theme.background}/>
    {d.variant!=='notifications'?<div style={{position:'absolute',left:120,top:350,width:700,height:760}}>
      {/* Sender roles control sides; Arabic shaping and text direction are measured independently. */}
      <ChatWindow theme={theme} messages={messages} width={700} height={760} title={title?displayDigits(title,digits):undefined} dir="ltr" fontSize={32} typingFrames={chatTypingFrames(fps)} typingFollowsSender/>
    </div>:<>
      {title?<div style={{position:'absolute',left:120,top:330,width:700}}><FitText text={title} theme={theme} role="title" width={700} height={100} size={44} min={24} lines={2} align="right"/></div>:null}
      {notificationCards(d,probe?Infinity:frame,fps).map(({index,depth,enter:p})=>{
        const message=d.messages[index];
        return <div key={index} data-notification={index} style={{position:'absolute',left:120+depth*8,top:480+depth*150-(1-p)*45,width:700-depth*16,height:160,padding:24,boxSizing:'border-box',borderRadius:22,border:`2px solid ${theme.border}`,background:theme.card,color:theme.text,opacity:1-depth*.08,transform:`scale(${.96+.04*p})`,transformOrigin:'50% 0%'}}>
          <FitText text={message.text} theme={theme} role="body" width={648-depth*16} height={112} size={30} min={18} lines={3} align="right"/>
        </div>;
      })}
    </>}
    <SceneStickerSlot host="chat-thread" sticker={d.sticker} ink={theme.text}/>
  </>;
};
