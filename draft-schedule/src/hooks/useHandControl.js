import { useCallback, useEffect, useRef, useState } from 'react'
import { advanceHandSession, createHandSession } from '../utils/handControlState'
import { readRecognizedHands } from '../utils/recognizedHands'
import { createPinchPress, updatePinchPress } from '../utils/pinchPointer'

const AUTO_WAIT_KEY = 'pgmdr-hand-auto-wait'
function readAutoWait() {
  try { return localStorage.getItem(AUTO_WAIT_KEY) === '1' } catch { return false }
}

export default function useHandControl() {
  const [autoWait, setAutoWait] = useState(readAutoWait)
  const [status, setStatus] = useState('off')
  const [view, setView] = useState({ active: false, countdown: null, remaining: null })
  const [error, setError] = useState('')
  const [phase, setPhase] = useState('제어 꺼짐 · 메뉴에서 손동작 제어를 켜세요')
  const run = useRef(null)
  const handInput = useRef({ x: 0, y: 0, active: false, pressed: false })
  const visualPointer = useRef(null)
  const release = useCallback(() => {
    const current = run.current
    run.current = null
    if (current) {
      clearTimeout(current.timer)
      current.stream?.getTracks().forEach(track => track.stop())
      if (current.video) { current.video.pause(); current.video.srcObject = null; current.video.removeAttribute('src'); current.video.load(); current.video.remove() }
      current.recognizer?.close()
    }
    handInput.current = { x: 0, y: 0, active: false, pressed: false }
    visualPointer.current = null
    setStatus('off')
    setPhase('카메라 종료 · 손동작 제어 꺼짐')
    setView({ active: false, countdown: null, remaining: null })
  }, [])
  const setAutoWaitPreference = useCallback(value => {
    try {
      if (value) localStorage.setItem(AUTO_WAIT_KEY, '1')
      else localStorage.removeItem(AUTO_WAIT_KEY)
      setAutoWait(value)
    } catch {
      setAutoWait(false)
      setError('자동 대기 설정을 저장할 수 없습니다. 브라우저의 사이트 저장 설정을 확인해주세요.')
    }
  }, [])
  const stop = useCallback(() => {
    setAutoWaitPreference(false)
    release()
  }, [release, setAutoWaitPreference])
  const suspend = useCallback(() => {
    if (run.current) run.current.session = createHandSession()
    handInput.current.active = false
    setPhase('HUD 종료 · 손바닥을 5초 보여주면 다시 시작')
    setView({ active: false, countdown: null, remaining: null })
  }, [])

  const start = useCallback(async () => {
    if (run.current) return
    setError('')
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError('카메라는 HTTPS 또는 localhost 주소에서 사용할 수 있습니다.')
      return
    }
    const current = { session: createHandSession(), stream: null, recognizer: null, video: null, timer: null }
    run.current = current
    setStatus('loading')
    setPhase('카메라 권한 요청 중 · 브라우저에서 허용해주세요')
    try {
      // No recorder, snapshots, storage, uploads, or frame/landmark logging.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 20 } } })
      if (run.current !== current) { stream.getTracks().forEach(track => track.stop()); return }
      current.stream = stream
      stream.getVideoTracks()[0].addEventListener('ended', () => { if (run.current === current) { release(); setError('카메라 연결이 종료됐습니다. 연결과 권한을 확인하고 다시 켜주세요.') } }, { once: true })
      setPhase('카메라 연결됨 · 영상 입력 준비 중')
      const video = document.createElement('video')
      current.video = video
      video.muted = true; video.playsInline = true; video.srcObject = stream
      video.setAttribute('aria-hidden', 'true')
      video.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;bottom:0;left:0'
      document.body.appendChild(video)
      await video.play()
      if (run.current !== current) return
      setPhase('손 인식 모델 로딩 중 · 처음에는 잠시 걸릴 수 있습니다')
      const { FilesetResolver, GestureRecognizer } = await import('@mediapipe/tasks-vision')
      const vision = await FilesetResolver.forVisionTasks('/hand-control/wasm')
      if (run.current !== current) return
      const recognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: { modelAssetPath: '/hand-control/gesture_recognizer.task', delegate: 'CPU' },
        runningMode: 'VIDEO', numHands: 2,
        minHandDetectionConfidence: .5, minHandPresenceConfidence: .5, minTrackingConfidence: .5,
      })
      if (run.current !== current) { recognizer.close(); return }
      current.recognizer = recognizer
      setStatus('ready')
      setPhase('대기 · 손바닥을 카메라에 5초 보여주세요')
      let lastVideoTime = -1
      let lastSample = null, sampledAt = 0
      const tick = () => {
        if (run.current !== current) return
        try {
          const now = performance.now()
          let sample = null
          if (!document.hidden && video.readyState >= 2 && lastVideoTime !== video.currentTime) {
            lastVideoTime = video.currentTime
            const result = recognizer.recognizeForVideo(video, now)
            sample = readRecognizedHands(result)
            if (sample) sample.sampleTime = now
            lastSample = sample
            sampledAt = now
          } else if (!document.hidden && now - sampledAt < 250) {
            sample = lastSample
          }
          const wasActive = current.session.active
          const next = advanceHandSession(current.session, sample && !wasActive ? {...sample,openPalm:sample.anyOpenPalm} : sample, now)
          if (wasActive && !next.active) setPhase('60초간 손동작 없음 · HUD 종료, 재시작 대기')
          next.detected = !!sample
          current.pinchState ??= createPinchPress()
          const pressed=updatePinchPress(current.pinchState,sample?.pinch??2,now,next.active&&!!sample,sample?.side||'unknown')
          handInput.current = { x: sample ? 1 - sample.x * 2 : 0, y: sample ? sample.y * 2 - 1 : 0, active: next.active && !!sample, pressed, gesture: sample?.gesture, openPalm: sample?.openPalm, pointerX: sample?.pointerX, pointerY: sample?.pointerY }
          handInput.current.points = sample?.points
          handInput.current.detected = !!sample
          handInput.current.pinch = sample?.pinch ?? 2
          handInput.current.gestureScore = sample?.gestureScore
          handInput.current.hands = sample?.hands || {left:null,right:null}
          handInput.current.sampleTime = sample?.sampleTime
          handInput.current.source = sample?.side || 'unknown'
          handInput.current.palmX = sample?.palmX
          handInput.current.palmY = sample?.palmY
          setView(previous => previous.active === next.active && previous.countdown === next.countdown && previous.remaining === next.remaining && previous.detected === next.detected ? previous : next)
          current.timer = setTimeout(tick, 1000 / 15)
        } catch {
          release(); setError('손 인식이 중단됐습니다. 손동작 제어를 다시 켜주세요.')
        }
      }
      tick()
    } catch (failure) {
      if (run.current !== current) return
      release()
      setError(failure.name === 'NotAllowedError' ? '카메라 권한 차단 · 주소창 사이트 설정에서 카메라를 허용해주세요.' : failure.name === 'NotFoundError' ? '카메라 없음 · 장치 연결을 확인해주세요.' : failure.name === 'NotReadableError' ? '카메라 사용 불가 · 다른 앱의 카메라 사용과 장치 설정을 확인해주세요.' : '카메라 또는 손 인식 모델 시작 실패 · 연결 상태를 확인하고 다시 켜주세요.')
    }
  }, [release])

  useEffect(() => {
    // Defer startup so React StrictMode's initial cleanup cannot leak a request.
    const timer = setTimeout(() => { if (readAutoWait()) start() }, 0)
    return () => clearTimeout(timer)
  }, [start])

  useEffect(() => {
    const leave = () => release()
    const restore = event => { if (event.persisted && readAutoWait()) start() }
    const hide = () => { if (document.hidden) suspend() }
    window.addEventListener('pagehide', leave)
    window.addEventListener('pageshow', restore)
    document.addEventListener('visibilitychange', hide)
    return () => { window.removeEventListener('pagehide', leave); window.removeEventListener('pageshow', restore); document.removeEventListener('visibilitychange', hide); release() }
  }, [release, start, suspend])
  return { status, ...view, phase, error, start, stop, suspend, handInput, visualPointer, autoWait, setAutoWaitPreference }
}
