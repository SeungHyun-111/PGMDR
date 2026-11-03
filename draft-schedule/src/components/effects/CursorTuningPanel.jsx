import { DEFAULT_CURSOR_TUNING } from '../../utils/cursorTuning'

const SLIDERS = [
  ['sensitivity','감도',.25,3,.05],['deadZone','미세 떨림 제거',0,.012,.0005],
  ['minCutoff','기본 반응성',.3,4,.1],['beta','빠른 동작 반응',0,15,.5],['maxDelta','최대 이동 / 60fps',15,90,5],['pinchEnter','집기 인식 여유',.2,.65,.01],
]
export default function CursorTuningPanel({ value,onChange,onClose }) {
  return <section className="cursor-tuning" aria-label="커서 튜닝">
    <header><strong>CURSOR TUNING</strong><button onClick={onClose} aria-label="커서 튜닝 닫기">×</button></header>
    <p>값을 바꾸면 즉시 반영됩니다. 카메라 영상은 표시·저장하지 않습니다.</p>
    {SLIDERS.map(([key,label,min,max,step])=><label key={key}><span>{label}<output>{Number(value[key]).toFixed(key==='deadZone'?4:2)}</output></span><input aria-label={label} type="range" min={min} max={max} step={step} value={value[key]} onChange={e=>onChange({...value,[key]:Number(e.target.value)})} /></label>)}
    <label><span>카메라 중앙 조작 영역<output>{Math.round((value.activeRight-value.activeLeft)*100)}%</output></span><input aria-label="카메라 중앙 조작 영역" type="range" min="30" max="100" step="5" value={Math.round((value.activeRight-value.activeLeft)*100)} onChange={e=>{const margin=(1-Number(e.target.value)/100)/2;onChange({...value,activeLeft:margin,activeRight:1-margin,activeTop:margin,activeBottom:1-margin})}} /></label>
    <p>떨리면 ‘미세 떨림 제거’를 올리고 ‘기본 반응성’을 낮추세요. 손을 빠르게 움직일 때 답답하면 ‘빠른 동작 반응’을 올리세요.</p>
    <button onClick={()=>onChange({...DEFAULT_CURSOR_TUNING,sensitivity:1})}>기본값 복원</button>
  </section>
}
