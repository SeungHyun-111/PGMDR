const TARGETS = 'button,a[href],input,select,textarea,[role="button"],[role="tab"],[data-hand-target],[draggable="true"],label,summary'

export function handMouseTarget(element) { return element?.closest(TARGETS) || null }

export function createVirtualHandMouse(feedback = () => {}) {
  let down = null, ready = false, lastClick = null
  const pointerId = 731
  const eventOptions = (x, y, buttons, detail = 0) => ({ bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0, buttons, detail })
  const emitMouse = (target, type, x, y, buttons, detail = 0) => target?.dispatchEvent(new MouseEvent(type, eventOptions(x,y,buttons,detail)))
  const emitPointer = (target, type, x, y, buttons) => target?.dispatchEvent(new PointerEvent(type, { ...eventOptions(x,y,buttons), pointerId, pointerType: 'mouse', isPrimary: true }))
  const emitDrag = (target, type, x, y) => target?.dispatchEvent(new DragEvent(type, { ...eventOptions(x,y,type === 'dragend' || type === 'drop' ? 0 : 1), dataTransfer: down.transfer }))
  const cleanup = () => { down?.source?.removeAttribute('data-hand-dragging'); down?.drop?.removeAttribute('data-hand-drop'); down = null }
  const cancel = () => {
    if (down) {
      emitPointer(down.target, 'pointercancel', down.x, down.y, 0)
      // End custom mouse resize handlers as well, without a click or a drop.
      emitMouse(down.target, 'mouseup', down.x, down.y, 0)
      if (down.source) { emitDrag(down.drop, 'dragleave', down.x, down.y); emitDrag(down.source, 'dragend', down.x, down.y) }
      feedback('조작 취소 · 손 추적이 끊겼거나 제어가 종료됐습니다')
    }
    cleanup(); ready = false; lastClick = null
  }
  return {
    get isDown() { return !!down },
    get isDragging() { return !!down?.moved },
    get heldSince() { return down?.started ?? Infinity },
    cancel,
    update({ active, pressed, x, y, now, hit }) {
      if (!active) { cancel(); return }
      if (!pressed && !down) { ready = true; return }
      if (pressed && !down) {
        if (!ready) return
        ready = false
        const target = handMouseTarget(hit)
        if (!target || target.matches(':disabled,[aria-disabled="true"]')) { feedback('버튼이나 편성 블록을 가리킨 뒤 집어주세요'); return }
        down = { target, startX: x, startY: y, x, y, started: now, moved: false, source: null, transfer: null, drop: null, accepted: false }
        target.focus?.({ preventScroll: true })
        const allowed = emitPointer(target,'pointerdown',x,y,1)
        if (allowed) emitMouse(target,'mousedown',x,y,1)
        feedback('누르는 중 · 놓으면 클릭 / 집은 채 움직이면 드래그')
        return
      }
      if (!down) return
      down.x = x; down.y = y
      if (!down.target.isConnected) { cancel(); return }
      if (pressed) {
        if (!down.moved && Math.hypot(x-down.startX,y-down.startY) >= 10 && now-down.started >= 180) {
          down.moved = true; lastClick = null
          const source = down.target.closest('[draggable="true"]')
          if (source) {
            down.transfer = new DataTransfer()
            if (emitDrag(source,'dragstart',down.startX,down.startY)) {
              down.source = source; source.setAttribute('data-hand-dragging','')
              feedback('블록 드래그 중 · 원하는 칸에서 손가락을 놓으세요')
            } else { cancel(); return }
          } else feedback('드래그 중 · 놓으면 버튼 누르기를 해제합니다')
        }
        emitPointer(down.target,'pointermove',x,y,1)
        emitMouse(down.target,'mousemove',x,y,1)
        if (down.source) {
          if (hit !== down.drop) {
            emitDrag(down.drop,'dragleave',x,y); down.drop?.removeAttribute('data-hand-drop')
            down.drop = hit; emitDrag(hit,'dragenter',x,y)
          }
          down.accepted = hit ? !emitDrag(hit,'dragover',x,y) : false
          if (down.accepted) down.drop?.setAttribute('data-hand-drop','')
          else down.drop?.removeAttribute('data-hand-drop')
        }
        return
      }
      const current = down
      emitPointer(current.target,'pointerup',x,y,0)
      emitMouse(current.target,'mouseup',x,y,0)
      if (current.source) {
        // Recheck the release position rather than dropping at an old frame.
        const accepted = hit ? !emitDrag(hit,'dragover',x,y) : false
        if (accepted) { emitDrag(hit,'drop',x,y); feedback('놓기 완료 · 편성표의 이동/교체 확인창을 확인하세요') }
        else feedback('이동 취소 · 놓을 수 있는 칸이 아닙니다')
        emitDrag(current.drop,'dragleave',x,y)
        emitDrag(current.source,'dragend',x,y)
      } else if (!current.moved && handMouseTarget(hit) === current.target) {
        const double = lastClick?.target === current.target && now-lastClick.time <= 650 && Math.hypot(x-lastClick.x,y-lastClick.y)<18
        emitMouse(current.target,'click',x,y,0,double?2:1)
        if (double) { emitMouse(current.target,'dblclick',x,y,0,2); lastClick = null; feedback('더블클릭 · 편성 블록은 수정창을 엽니다') }
        else { lastClick = { target: current.target, time: now, x, y }; feedback('클릭 · 한 번 더 집었다 놓으면 더블클릭') }
      } else feedback('드래그 해제')
      cleanup(); ready = true
    },
  }
}
