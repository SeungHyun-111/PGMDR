import { lazy, Suspense, useEffect, useState } from 'react'
import AsciiFlame from './components/effects/AsciiFlame'
import CosmicOrb from './components/effects/CosmicOrb'
import PixelDriftText from './components/effects/PixelDriftText'
import PulsatingBorder from './components/effects/PulsatingBorder'
import Stardust from './components/effects/Stardust'

const ProtectedApp = lazy(() => import('./ProtectedApp'))
const PASSWORD_HASH =
  import.meta.env.VITE_APP_PASSWORD_HASH ||
  '3d8b4ecff8e80bc47eacf6a5ab5b0ce5c9158e24b851dd0b01289dabbe9eb637'


async function sha256(value) {
  const data = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

export default function App() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('pgmdr-unlocked') === '1')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!unlocked) return
    sessionStorage.setItem('pgmdr-unlocked', '1')
  }, [unlocked])

  const handleSubmit = async event => {
    event.preventDefault()
    if (!password.trim()) return
    setBusy(true)
    setError('')
    try {
      const digest = await sha256(password)
      if (digest === PASSWORD_HASH) {
        setUnlocked(true)
        setPassword('')
      } else {
        setError('비밀번호를 확인해주세요.')
      }
    } catch {
      setError('브라우저 보안 환경에서 다시 시도해주세요.')
    } finally {
      setBusy(false)
    }
  }

  if (unlocked) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <ProtectedApp />
      </Suspense>
    )
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        color: '#f8fafc',
        background:
          'radial-gradient(circle at 50% 27%, rgba(153,255,69,.16), transparent 42%), radial-gradient(circle at 50% 72%, rgba(25,255,0,.055), transparent 34%), linear-gradient(180deg, #11170f 0%, #0d160d 48%, #091108 100%)',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg, rgba(25,255,0,.035), transparent 24%, transparent 76%, rgba(25,255,0,.035)), repeating-linear-gradient(180deg, rgba(185,255,0,.035) 0 1px, transparent 1px 62px)',
          opacity: 0.28,
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 4% 13%, rgba(164, 255, 86, .16), transparent 23%), radial-gradient(ellipse at 96% 12%, rgba(164, 255, 86, .14), transparent 24%), radial-gradient(ellipse at 47% 50%, rgba(224, 229, 210, .12), transparent 24%), radial-gradient(ellipse at 54% 46%, rgba(88, 119, 69, .16), transparent 32%), linear-gradient(90deg, rgba(255,255,255,.035), transparent 18%, transparent 82%, rgba(255,255,255,.03))',
          filter: 'blur(18px)',
          opacity: 0.86,
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'repeating-radial-gradient(circle at 18% 18%, rgba(255,255,255,.045) 0 1px, transparent 1px 3px), repeating-radial-gradient(circle at 84% 12%, rgba(255,255,255,.035) 0 1px, transparent 1px 4px)',
          backgroundSize: '280px 220px, 340px 260px',
          opacity: 0.2,
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />
      <Stardust density={46} style={{ opacity: 0.18 }} />

      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '-10vw',
          right: '-10vw',
          bottom: 0,
          height: '52vh',
          opacity: 0.88,
          pointerEvents: 'none',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,.35) 18%, black 42%, black 100%)',
          maskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,.35) 18%, black 42%, black 100%)',
        }}
      >
        <AsciiFlame
          fontSize={20}
          shades={['#041400', '#113800', '#2d9100', '#83f000', '#e6ff57']}
          intensity={36}
          decay={7}
          windDirection="left"
          windForce={10}
          sparkColor="#19ef00"
        />
      </div>

      <section
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: 'min(560px, calc(100vw - 32px))',
          paddingTop: 8,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: 188,
            height: 188,
            marginBottom: 26,
            filter: 'drop-shadow(0 0 84px rgba(185,255,0,.34))',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: -390,
              borderRadius: '50%',
              overflow: 'hidden',
              pointerEvents: 'none',
              WebkitMaskImage: 'radial-gradient(circle, black 0%, black 34%, transparent 82%)',
              maskImage: 'radial-gradient(circle, black 0%, black 34%, transparent 82%)',
            }}
          >
            <Stardust
              density={560}
              color="230, 255, 220"
              sizeScale={1.22}
              alphaScale={1.55}
              speedScale={0.72}
              style={{
                opacity: 1,
                mixBlendMode: 'screen',
              }}
            />
          </div>
          <CosmicOrb
            size={188}
            background="#000000"
            palette={{
              anchor: '#101c08',
              colorA: '#5edb26',
              colorB: '#a9e900',
              colorC: '#83b84a',
            }}
            speed={50}
            spin={50}
            lensAmount={45}
          />
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 20,
            color: '#e6ffe0',
            fontFamily: '"Cascadia Mono", "SFMono-Regular", Consolas, monospace',
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: 0,
          }}
        >
          <span
            style={{
              width: 14,
              height: 8,
              borderRadius: 3,
              background: '#b7f537',
              boxShadow: '0 0 14px rgba(185,255,0,.46)',
            }}
          />
          SKSTOA SCHEDULE WORKFLOW
        </div>

        <div
          style={{
            width: 'min(520px, 100%)',
            height: 136,
            marginBottom: 18,
            filter: 'drop-shadow(0 4px 28px rgba(0,0,0,.72))',
          }}
        >
          <PixelDriftText
            text="SK스토아 편성팀"
            colors={['#fffdf5']}
            particleSize={7}
            particleCount={50}
            fontSize={72}
            autoFit
            mode="onEnter"
            replay
            position="above"
            mouseEnabled
            mouseRadius={70}
            mouseForce={20}
            transition={{ type: 'tween', duration: 0.7, ease: 'easeOut' }}
            style={{ width: '100%', height: '100%' }}
          />
        </div>

        <div
          style={{
            width: 'min(520px, 100%)',
            height: 54,
            marginBottom: 26,
            filter: 'drop-shadow(0 3px 18px rgba(0,0,0,.74))',
          }}
        >
          <PixelDriftText
            text="공유 비밀번호 입력 후 편성 작업판으로 입장합니다."
            colors={['#fffdf5']}
            particleSize={5}
            particleCount={50}
            fontSize={24}
            autoFit
            mode="onEnter"
            replay
            position="above"
            mouseEnabled
            mouseRadius={34}
            mouseForce={8}
            transition={{ type: 'tween', duration: 0.55, ease: 'easeOut' }}
            style={{ width: '100%', height: '100%' }}
          />
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            position: 'relative',
            display: 'flex',
            gap: 10,
            width: 'min(360px, 100%)',
            padding: 6,
            border: '1px solid rgba(185,255,0,.08)',
            borderRadius: 10,
            background: 'rgba(4, 8, 4, .6)',
            boxShadow: '0 20px 52px rgba(0,0,0,.36)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <PulsatingBorder
            colors={['#dfff55', '#76f000', '#19ef00']}
            speed={1.15}
            radius={28}
            thickness={4}
            softness={82}
            intensity={48}
            bloom={62}
            spotSize={72}
            spread={18}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 10,
            }}
          />
          <input
            autoFocus
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            placeholder="Password"
            style={{
              minWidth: 0,
              flex: 1,
              height: 42,
              boxSizing: 'border-box',
              border: 'none',
              borderRadius: 7,
              padding: '0 13px',
              fontSize: 14,
              outline: 'none',
              background: 'rgba(4, 18, 4, .6)',
              color: '#f4ffe8',
            }}
          />
          <button
            type="submit"
            disabled={busy}
            style={{
              flex: '0 0 auto',
              height: 42,
              border: 'none',
              borderRadius: 7,
              padding: '0 18px',
              background: '#b7f537',
              color: '#061100',
              fontSize: 13,
              fontWeight: 900,
              cursor: busy ? 'default' : 'pointer',
              opacity: busy ? 0.7 : 1,
              boxShadow: '0 0 18px rgba(185,255,0,.22)',
            }}
          >
            {busy ? '확인 중' : '입장'}
          </button>
        </form>
        {error && <div style={{ marginTop: 10, fontSize: 12, color: '#fca5a5' }}>{error}</div>}
      </section>
    </main>
  )
}

function LoadingScreen() {
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontWeight: 800,
        color: '#b7f537',
        background: '#050805',
      }}
    >
      편성표 로딩 중...
    </div>
  )
}

