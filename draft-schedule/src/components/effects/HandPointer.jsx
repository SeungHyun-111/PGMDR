import { useEffect, useRef, useState } from 'react'
import { createCommandState, updateHandCommands } from '../../utils/handCommands'
import { moveRelativePointer, resetPointerMotion } from '../../utils/handCoordinates'
import { createVirtualHandMouse, handMouseTarget } from '../../utils/virtualHandMouse'
import { SENSITIVITY_KEY, readSensitivity, createSensitivityState, cancelSensitivity, updateSensitivity } from '../../utils/handSensitivity'
import './HandPointer.css'
import CursorTuningPanel from './CursorTuningPanel'
import { readCursorTuning, normalizeCursorTuning, CURSOR_TUNING_KEY } from '../../utils/cursorTuning'
import { createPinchPointer, planPinchPointer } from '../../utils/pinchPointer'

function findScrollTarget(element) {
  for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
    const style = getComputedStyle(node)
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 2) return node
  }
  return document.scrollingElement
}

export default function HandPointer({ enabled, input, visualPointer, onNavigate, onFeedback }) {
  const pointer = useRef(null)
  const callbacks = useRef({ onNavigate, onFeedback })
  const [help, setHelp] = useState(false)
  const [sensitivityView, setSensitivityView] = useState(null)
  const [tuningValue,setTuningValue] = useState(()=>({...readCursorTuning(),sensitivity:readSensitivity()}))
  const controls = useRef(tuningValue)
  const [tuningOpen,setTuningOpen] = useState(false)
  const changeTuning = value => {
    const normalized={...normalizeCursorTuning(value),sensitivity:Math.max(.25,Math.min(3,value.sensitivity))}
    controls.current=normalized;setTuningValue(normalized)
    try {localStorage.setItem(CURSOR_TUNING_KEY,JSON.stringify(normalized));localStorage.setItem(SENSITIVITY_KEY,String(normalized.sensitivity))}
    catch {callbacks.current.onFeedback('커서 튜닝 적용 · 저장 불가, 이번 접속에만 유지')}
  }
  useEffect(() => { callbacks.current = { onNavigate, onFeedback } }, [onNavigate, onFeedback])
  useEffect(() => {
    if (!enabled) return
    let frame, lastSample = null, x = window.innerWidth / 2, y = window.innerHeight / 2, lastAimAt = -Infinity
    const motion = { x, y, targetX: x, targetY: y, rawX: null, rawY: null }
    let target = null
    const state = createCommandState()
    const mouse = createVirtualHandMouse(message => callbacks.current.onFeedback(message))
    const pinchPointer = createPinchPointer()
    let sensitivity = controls.current.sensitivity, lastConfig = controls.current, lastSource = null
    const adjustment = createSensitivityState(sensitivity)
    const clearTarget = () => { target?.removeAttribute('data-hand-hover'); target = null }
    const resetPointer = () => { mouse.cancel(); clearTarget(); Object.assign(state,createCommandState()); Object.assign(pinchPointer,createPinchPointer()); resetPointerMotion(motion) }
    const cancelAdjustment = event => {
      if (event.key !== 'Escape' || (adjustment.mode !== 'editing' && adjustment.since === null)) return
      event.preventDefault(); event.stopImmediatePropagation()
      cancelSensitivity(adjustment,sensitivity); setSensitivityView(null); resetPointer()
      callbacks.current.onFeedback(`감도 변경 취소 · ${sensitivity.toFixed(2)}× 유지`)
    }
    document.addEventListener('keydown',cancelAdjustment,true)
    const loop = now => {
      frame = requestAnimationFrame(loop)
      const hand = input.current
      sensitivity=controls.current.sensitivity
      if(lastConfig!==controls.current || (lastSource && hand.source && lastSource!==hand.source)) { resetPointer();lastConfig=controls.current }
      lastSource=hand.source
      const adjustmentView = updateSensitivity(adjustment,hand,now,sensitivity,mouse.isDown)
      if (adjustmentView.event === 'opened') { resetPointer(); callbacks.current.onFeedback('감도 조절 · 왼손 주먹 유지 + 오른손 위아래 / 왼손 펴기: 저장 / Esc: 취소') }
      if (adjustmentView.event === 'applied') {
        sensitivity = adjustmentView.value
        controls.current={...controls.current,sensitivity};lastConfig=controls.current;setTuningValue(controls.current)
        try { localStorage.setItem(SENSITIVITY_KEY,String(sensitivity)); callbacks.current.onFeedback(`커서 감도 적용 · ${sensitivity.toFixed(2)}×`) }
        catch { callbacks.current.onFeedback(`감도 ${sensitivity.toFixed(2)}× 적용 · 브라우저 저장 불가, 이번 접속에만 유지`) }
        resetPointer()
      }
      if (adjustmentView.event === 'cancelled') callbacks.current.onFeedback('감도 변경 취소 · 손 추적이 끊겼습니다')
      setSensitivityView(previous => {
        const next = adjustmentView.mode === 'idle' ? null : adjustmentView
        return previous?.mode === next?.mode && previous?.value === next?.value && previous?.progress === next?.progress && previous?.confirming === next?.confirming && previous?.confirmProgress === next?.confirmProgress && previous?.trackingLost === next?.trackingLost && previous?.leftState === next?.leftState && previous?.rightDetected === next?.rightDetected ? previous : next
      })
      if (adjustmentView.mode !== 'idle' || adjustmentView.event) {
        clearTarget(); motion.rawX=null
        if (visualPointer) visualPointer.current = hand.active ? { x,y,hovered:false,interaction:'SENSITIVITY',sensitivityScale:adjustmentView.value } : null
        return
      }
      const pinchPlan=planPinchPointer(pinchPointer,hand,now,{mouseDown:mouse.isDown,heldSince:mouse.heldSince})
      const intentionalAim = hand.gesture === 'Pointing_Up' || hand.gesture === 'Victory' || hand.pressed || mouse.isDown || pinchPlan.mode!=='free'
      if (hand.active && intentionalAim) lastAimAt = now
      const aiming = hand.active && (intentionalAim || (!hand.openPalm && hand.gesture === 'None' && now - lastAimAt < 250))
      if (!aiming) { if (visualPointer) visualPointer.current = null; resetPointerMotion(motion) }
      if (pointer.current) pointer.current.style.display = aiming ? 'block' : 'none'
      if (!hand.active) { mouse.cancel(); updateHandCommands(state, hand, now); clearTarget(); return }
      if (aiming) {
        const next = moveRelativePointer(motion, pinchPlan.rawX??hand.pointerX??.5, pinchPlan.rawY??hand.pointerY??.5, window.innerWidth, window.innerHeight, pinchPlan.freeze || (mouse.isDown&&!hand.pressed), sensitivity,{now,sampleTime:hand.sampleTime??now,source:`${hand.source}:${pinchPlan.source}`,config:controls.current})
        if(motion.rejectedJump){mouse.cancel();callbacks.current.onFeedback('좌표 급변 차단 · 커서를 고정했습니다')}
        x = next.x; y = next.y
        if (visualPointer) visualPointer.current = { x, y, hovered: false }
        const node = pointer.current
        if (node) { node.style.transform = `translate3d(${x}px,${y}px,0)`; node.dataset.pressed = String(hand.pressed); node.dataset.mode = hand.gesture === 'Victory' ? 'scroll' : 'point' }
        const hovered = handMouseTarget(document.elementFromPoint(x, y))
        if (hovered !== target) { clearTarget(); target = hovered; target?.setAttribute('data-hand-hover', '') }
        if (visualPointer) visualPointer.current.hovered = !!target
      } else clearTarget()
      mouse.update({ active: hand.active && !motion.rejectedJump, pressed: !!hand.pressed && (mouse.isDown || hand.gesture !== 'Closed_Fist'), x, y, now, hit: document.elementFromPoint(x,y) })
      if (visualPointer?.current) visualPointer.current.interaction = mouse.isDragging ? 'DRAG' : mouse.isDown ? 'HOLD' : null
      if (lastSample === hand) return
      lastSample = hand
      const action = updateHandCommands(state, hand, now)
      if (action?.type === 'navigate' && !mouse.isDown) callbacks.current.onNavigate(action.direction)
      if (action?.type === 'scroll' && !mouse.isDown) {
        const element = findScrollTarget(document.elementFromPoint(x, y))
        if (element) { element.scrollTop += Math.max(-240, Math.min(240, action.delta * window.innerHeight * 4)); callbacks.current.onFeedback('스크롤 · 두 손가락을 작게 위아래로 움직이세요') }
      }
    }
    frame = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown',cancelAdjustment,true); mouse.cancel(); clearTarget(); if (visualPointer) visualPointer.current = null }
  }, [enabled, input, visualPointer])
  if (!enabled) return null
  return <>
    {tuningOpen && <CursorTuningPanel value={tuningValue} onChange={changeTuning} onClose={()=>setTuningOpen(false)} />}
    {sensitivityView && <section className="hand-sensitivity" aria-label="커서 감도 조절" role="status">
      <span>{sensitivityView.mode === 'arming' ? '왼손 주먹 · 감도 조절 시작' : 'CURSOR SENSITIVITY'}</span>
      <strong>{sensitivityView.value.toFixed(2)}<small>×</small></strong>
      <meter min="0.25" max="3" value={sensitivityView.value} aria-label="감도" />
      <div>왼손: {sensitivityView.leftState === 'fist' ? '주먹 ●' : sensitivityView.leftState === 'open' ? '펴짐' : sensitivityView.leftState === 'missing' ? '미감지' : '주먹을 쥐세요'} / 오른손: {sensitivityView.rightDetected ? '감지 ●' : '미감지'}</div>
      {sensitivityView.mode === 'arming' ? <><progress max="100" value={sensitivityView.progress} aria-label="왼손 주먹 유지 진행" /><p>왼손 주먹을 잠깐 유지하세요</p></> : <>
        {sensitivityView.confirming && <progress max="100" value={sensitivityView.confirmProgress} aria-label="감도 적용 진행" />}
        <p>{sensitivityView.confirming ? '왼손 펴짐 · 값을 고정하고 저장 중' : sensitivityView.trackingLost ? '왼손 주먹을 다시 보여주세요 · 값 고정 중' : !sensitivityView.rightDetected ? '오른손을 보여주세요 · 값 고정 중' : '왼손 주먹 유지 + 오른손 위: 증가 / 아래: 감소'}<br />왼손 펴기: 저장 후 닫기 · Esc: 취소</p>
      </>}
    </section>}
    <button className="cursor-tuning-launch" onClick={()=>setTuningOpen(v=>!v)} aria-expanded={tuningOpen}>커서 튜닝</button>
    <div ref={pointer} className="hand-pointer" aria-hidden="true"><span /><small>집기 = 클릭</small></div>
    <div className="hand-gesture-help"><button onClick={() => setHelp(v => !v)} aria-expanded={help}>손동작 안내 {help ? '−' : '+'}</button>{help && <div>검지 하나 · 커서 이동<br />집었다 놓기 · 클릭<br />빠르게 두 번 집었다 놓기 · 더블클릭<br />집은 채 이동 → 놓기 · 드래그 앤 드롭<br />편성 블록 더블클릭 · 수정창 열기<br />손바닥 좌우 쓸기 · 이전/다음 메뉴<br />V자 두 손가락 위아래 · 스크롤<br />왼손 주먹 + 오른손 위아래 · 감도 조절<br />왼손 펴기 · 감도 저장<br />Esc / 손 추적 끊김 · 드래그 취소</div>}</div>
  </>
}
