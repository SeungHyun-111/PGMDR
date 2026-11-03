import './HandControlStatus.css'

function TerminalMessage({ text, counting, failed }) {
  const parts = []
  const pattern = /\d+(?:\.\d+)?|더블클릭|드래그|클릭|스크롤|메뉴 이동|손바닥 인식|손 감지됨|연결됨|완료|자동 대기|대기|준비 중|로딩 중|요청 중|실패|차단|취소|종료|미감지|없음|[·:→/]/g
  let end = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > end) parts.push(text.slice(end, match.index))
    const word = match[0]
    const kind = /^\d/.test(word) ? counting ? 'count' : 'number'
      : /^(실패|차단|취소|종료|미감지|없음)$/.test(word) ? 'danger'
      : /^(손바닥 인식|손 감지됨|연결됨|완료)$/.test(word) ? 'success'
      : /^(자동 대기|대기|준비 중|로딩 중|요청 중)$/.test(word) ? 'waiting'
      : /^[·:→/]$/.test(word) ? 'operator' : 'action'
    parts.push(<span key={match.index} className={`hand-terminal__token hand-terminal__token--${failed ? 'danger' : kind}`}>{word}</span>)
    end = match.index + word.length
  }
  parts.push(text.slice(end))
  return parts
}

export default function HandControlStatus({ control, onStart, feedback }) {
  const { status, error, active, countdown, remaining, detected, phase } = control
  const label = error ? 'ERROR' : status === 'loading' ? 'INIT' : active ? 'ACTIVE' : countdown ? 'HOLD' : status === 'ready' ? 'WAIT' : 'OFF'
  const message = error || (active ? control.tracking==='LOST'?'활성 손 추적 끊김 · 다른 손은 커서를 조작하지 않습니다':remaining <= 10 ? `입력 대기 · ${remaining}초 후 HUD 종료` : feedback?.message || '집었다 놓기: 클릭 · 두 번: 더블클릭 · 집고 이동: 드래그' : countdown ? `손바닥 인식 · ${countdown}초 유지하면 시작` : status === 'ready' && detected ? '손 감지됨 · 손가락을 펴서 손바닥을 보여주세요' : status === 'ready' ? `${control.autoWait ? '자동 대기 · ' : ''}${phase} · 현재 손 미감지` : phase)
  return <div className="hand-terminal" data-state={label} title={`[${label}] ${message}`}>
    <span className="hand-terminal__prompt" aria-hidden="true">&gt;_</span>
    <span className="hand-terminal__output" role={error ? 'alert' : 'status'} aria-live="polite" aria-atomic="true"><b>[{label}]</b> <TerminalMessage text={message} counting={!!countdown || (active && remaining <= 10)} failed={!!error} /></span>
    {status==='ready'&&<details className="hand-tracking-debug"><summary>{control.activeHand?.toUpperCase()||'—'} / {control.tracking||'WAIT'} / {control.handCount||0}손 / {control.pinchState==='PRESSED'?'누름':control.pinchState==='CONTACT'?'접촉':'벌림'}</summary><div>
      <p>ACTIVE HAND: <b>{control.activeHand?.toUpperCase()||'NONE'}</b></p>
      <p>POINTER LANDMARK: <b>INDEX_TIP(8)</b></p>
      <p>DRAG ANCHOR: THUMB(4) + INDEX(8) / 2</p>
      <p>TRACKING: <b>{control.tracking||'WAIT'}</b></p>
      <p>HAND COUNT: {control.handCount||0}</p>
      <p>LEFT: {control.leftGesture||'MISSING'} / RIGHT: {control.rightGesture||'MISSING'}</p>
      <p>PINCH: {control.pinchRatio?.toFixed(2)??'—'}</p>
      <p>CLICK STATE: {control.pinchState||'OPEN'} / 누름 &lt; {control.pinchEnter??.45} / 해제 &gt; {control.pinchExit??.65}</p>
    </div></details>}
    <button onClick={status === 'off' ? onStart : control.stop}>{status === 'off' ? error ? '재시도' : '켜기' : '끄기'}</button>
  </div>
}
