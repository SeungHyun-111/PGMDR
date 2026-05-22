import { useState, useEffect } from 'react'
import useScheduleStore from '../store/useScheduleStore'
import { db, ref, get } from '../api/firebase'

const SECTIONS = [
  {
    title: '편성표 기본 사용법',
    items: [
      { label: '블록 편성', desc: '사이드바에서 상품 카드를 편성표의 원하는 슬롯으로 드래그하여 편성합니다.' },
      { label: '블록 이동', desc: '편성된 블록을 다른 슬롯으로 드래그하여 이동할 수 있습니다.' },
      { label: '블록 삭제', desc: '블록 우클릭 → 삭제를 선택하면 디폴트([편성팀]) 블록으로 복원됩니다.' },
      { label: '블록 수정', desc: '블록 더블클릭 또는 우클릭 → 수정으로 상세 정보를 편집합니다.' },
      { label: '사이드바 복귀', desc: '편성된 블록을 사이드바로 드래그하거나 우클릭 → 복사로 사이드바에 돌려보냅니다.' },
    ]
  },
  {
    title: 'CA/IP 분리',
    items: [
      { label: '분리 방법', desc: '편성표 좌측 시간축을 우클릭하면 CA/IP 분리 팝업이 나타납니다.' },
      { label: '기존 블록 분리', desc: '이미 편성된 블록이 있을 경우 CA 또는 IP 중 어느 채널에 남길지 선택합니다.' },
      { label: '분리 해제', desc: '분리된 슬롯의 시간축을 다시 우클릭하여 일원(전채널)으로 되돌립니다.' },
      { label: '전체 해제', desc: '툴바의 "분리 전체 해제" 버튼으로 모든 분리를 한번에 해제합니다.' },
    ]
  },
  {
    title: '경쟁 편성',
    items: [
      { label: '경쟁 생성', desc: '이미 편성된 슬롯에 다른 상품을 드래그하면 경쟁 상태가 됩니다.' },
      { label: '경쟁 표시', desc: '빨간 배경 + 노란 글씨로 표시되며 [브랜드A*브랜드B] 형태로 노출됩니다.' },
      { label: '경쟁 해제', desc: '경쟁 블록 우클릭 → 경쟁 해제로 삭제합니다.' },
    ]
  },
  {
    title: '첨삭 기능',
    items: [
      { label: '첨삭 추가', desc: '블록 우클릭 → 첨삭 추가로 메모를 작성합니다. 구글 시트 셀 메모와 동일한 개념입니다.' },
      { label: '첨삭 표시', desc: '첨삭이 있는 블록 우상단에 노란 삼각형 마크가 표시됩니다.' },
      { label: '첨삭 확인', desc: '블록에 마우스를 올리면 툴팁에서 첨삭 내용을 확인할 수 있습니다.' },
    ]
  },
  {
    title: '편성C (#)',
    items: [
      { label: '#마크', desc: '블록 수정에서 편성C(코멘트)에 # 문자를 포함하면 블록 우하단에 초록색 # 마크가 표시됩니다.' },
    ]
  },
  {
    title: '별표 기능',
    items: [
      { label: '별표 추가', desc: '사이드바 카드의 ☆ 버튼을 클릭하여 별표를 표시합니다.' },
      { label: '별표 확인', desc: '편성현황 탭과 실적예상값 탭에서 별표 항목을 필터링할 수 있습니다.' },
      { label: '실시간 공유', desc: '별표는 Firebase에 저장되어 팀원 모두에게 실시간으로 공유됩니다.' },
    ]
  },
  {
    title: '데이터 갱신',
    items: [
      { label: '선편성 갱신', desc: '상단 메뉴 → 선편성정보 갱신으로 최신 선편성 데이터를 반영합니다.' },
      { label: '제안상품 갱신', desc: '상단 메뉴 → 제안상품 갱신으로 영업팀 제안 목록을 최신화합니다.' },
      { label: '실적DB 갱신', desc: '상단 메뉴 → 실적DB 갱신으로 직전 방송 실적을 최신화합니다.' },
    ]
  },
  {
    title: '내보내기',
    items: [
      { label: 'Excel', desc: '편성표 전체를 .xlsx 파일로 내보냅니다.' },
      { label: 'HTML (Outlook)', desc: '이메일 첨부에 적합한 HTML 형태로 내보냅니다.' },
      { label: '인쇄', desc: '브라우저 인쇄 다이얼로그를 통해 인쇄합니다.' },
      { label: '필터', desc: '디폴트/경쟁/선편성/별표 항목을 포함 여부를 선택할 수 있습니다.' },
    ]
  },
]

const DB_PATHS = [
  { path: 'gasData/pgmSlots',       label: '편성 슬롯',       desc: '방송 날짜·시간·가중분 목록. 편성표 행 구조의 기반.', refresh: 'GAS 전체 재동기화' },
  { path: 'gasData/proposalItems',  label: '제안상품',         desc: '사이드바에 표시되는 MD 제안 상품 목록.', refresh: '제안상품 갱신 / GAS 전체 재동기화' },
  { path: 'gasData/perfMap',        label: '실적 DB',          desc: '[거래형태]+상품명 키로 직전 실적(취급/분, 한익/분)을 저장. Firebase 저장 시 [,] 인코딩 필요.', refresh: '실적DB 갱신 / GAS 전체 재동기화' },
  { path: 'gasData/preScheduleRows',label: '선편성 정보',      desc: '구글 시트에 사전 등록된 편성 항목. 슬롯에 자동 배치됨.', refresh: '선편성정보 갱신 / GAS 전체 재동기화' },
  { path: 'scheduleBlocks',         label: '편성 블록',        desc: '사용자가 드래그로 편성한 블록. 실시간 구독(onValue)으로 팀 전체 동기화.', refresh: '자동 저장 (드래그/수정/삭제)' },
  { path: 'splitSlots',             label: 'CA/IP 분리 상태',  desc: '슬롯별 CA/IP 분리 여부. 실시간 구독.', refresh: '시간축 우클릭 또는 채널 변경 저장' },
  { path: 'scheduledItemIds',       label: '편성 완료 상품 ID',desc: '사이드바에서 제거할 상품 ID 목록. 중복 편성 방지.', refresh: '자동 저장' },
  { path: 'manualInputs',           label: '수동 실적 입력',   desc: '블록 수정에서 직접 입력한 취급/분·한익/분. perfKey 기준 저장.', refresh: '블록 수정 → 수동 입력 후 저장' },
  { path: 'refreshLogs',            label: '갱신 이력',        desc: '재동기화 실행 시 기록되는 로그(시간·작업자·결과 건수).', refresh: '자동 기록' },
  { path: 'logs',                   label: '편성 작업 로그',   desc: '블록 편성/수정/삭제/채널변경 이력. 작업자 이름 포함.', refresh: '자동 기록' },
]

const REFRESH_TABLE = [
  { action: 'GAS 전체 재동기화', scope: '슬롯·제안상품·실적·선편성 전체', note: '사용자 직접 편성 블록은 보호됨. 선편성·디폴트 블록은 최신 데이터로 덮어씀.' },
  { action: '선편성정보 갱신',   scope: 'preScheduleRows',               note: '사용자 편성 블록 보호. 기존 선편성·디폴트 블록만 덮어씀.' },
  { action: '제안상품 갱신',     scope: 'proposalItems',                 note: '이미 편성된 상품은 사이드바에서 제외 유지.' },
  { action: '실적DB 갱신',       scope: 'perfMap',                       note: 'Firebase 저장 시 [,] 자동 인코딩 처리.' },
]

function FlowDiagram() {
  const box = (label, sub, color) => (
    <div style={{ border: `2px solid ${color}`, borderRadius: 8, padding: '10px 16px', textAlign: 'center', background: 'var(--bg2)', minWidth: 140 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
  const arrow = (label) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, color: 'var(--border2)' }}>→</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', paddingBottom: 8, flexWrap: 'wrap', gap: 8 }}>
      {box('Google Sheets', '구글 스프레드시트\n(원천 데이터)', 'var(--green)')}
      {arrow('Apps Script\n(GAS 웹앱)')}
      {box('Firebase RTDB', 'sessions/{weekKey}/\n(실시간 DB)', '#f5a623')}
      {arrow('실시간 구독\n(onValue)')}
      {box('Zustand Store', 'useScheduleStore\n(React 상태)', 'var(--accent)')}
      {arrow('렌더링')}
      {box('편성 작업판', 'React UI', 'var(--ip-t)')}
    </div>
  )
}

export default function HelpPage() {
  const { startDate, poolType } = useScheduleStore()
  const [refreshLogs, setRefreshLogs] = useState([])

  useEffect(() => {
    if (!startDate || !poolType) return
    const weekKey = `${startDate}_${poolType}`
    get(ref(db, `sessions/${weekKey}/refreshLogs`)).then(snap => {
      if (!snap.exists()) return
      const logs = Object.values(snap.val())
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 20)
      setRefreshLogs(logs)
    }).catch(() => {})
  }, [startDate, poolType])

  const fmtTime = ts => {
    const d = new Date(ts)
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '20px 24px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>설명서</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 28 }}>편성 작업판 기능 안내</div>

        {/* ── 데이터 송수신 구조 ──────────────────────────── */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 12, paddingBottom: 6, borderBottom: '2px solid var(--border)' }}>
            데이터 송수신 구조
          </div>

          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 12 }}>데이터 흐름</div>
            <FlowDiagram />
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 10, lineHeight: 1.7 }}>
              모든 데이터는 <strong style={{ color: 'var(--text2)' }}>구글 스프레드시트</strong>가 원천입니다.
              Apps Script(GAS) 웹앱이 시트를 읽어 JSON으로 제공하면,
              앱이 이를 <strong style={{ color: 'var(--text2)' }}>Firebase</strong>에 캐싱합니다.
              이후 Firebase를 실시간 구독해 팀원 간 편성 상태를 동기화합니다.
            </div>
          </div>

          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 10 }}>갱신 메뉴별 처리 범위</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['메뉴', '갱신 대상', '비고'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '5px 8px', color: 'var(--text3)', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {REFRESH_TABLE.map(r => (
                  <tr key={r.action} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '7px 8px', color: r.action.includes('전체') ? 'var(--orange)' : 'var(--text)', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.action}</td>
                    <td style={{ padding: '7px 8px', color: 'var(--accent)', fontFamily: 'monospace', fontSize: 10 }}>{r.scope}</td>
                    <td style={{ padding: '7px 8px', color: 'var(--text2)', lineHeight: 1.5 }}>{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 10 }}>Firebase 데이터 경로 구조 <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400 }}>sessions/&#123;startDate&#125;_&#123;poolType&#125;/</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {DB_PATHS.map(p => (
                <div key={p.path} style={{ display: 'flex', gap: 10, fontSize: 10, alignItems: 'flex-start' }}>
                  <code style={{ background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4, color: 'var(--accent)', whiteSpace: 'nowrap', flexShrink: 0, minWidth: 200 }}>{p.path}</code>
                  <div>
                    <span style={{ fontWeight: 700, color: 'var(--text)' }}>{p.label}</span>
                    <span style={{ color: 'var(--text3)', marginLeft: 6 }}>{p.desc}</span>
                    <div style={{ color: 'var(--text3)', marginTop: 1 }}>갱신: <span style={{ color: 'var(--green)' }}>{p.refresh}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 갱신 이력 */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 10 }}>최근 재동기화 이력 (현재 세션)</div>
            {refreshLogs.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>기록 없음</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {refreshLogs.map((log, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, fontSize: 10, alignItems: 'flex-start', paddingBottom: 5, borderBottom: i < refreshLogs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ color: 'var(--text3)', whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtTime(log.timestamp)}</span>
                    <span style={{ color: 'var(--orange)', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>{log.action}</span>
                    <span style={{ color: 'var(--text2)' }}>{log.details}</span>
                    <span style={{ color: 'var(--text3)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>by {log.user}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── 기존 섹션들 ──────────────────────────────────── */}
        {SECTIONS.map(section => (
          <div key={section.title} style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 12, paddingBottom: 6, borderBottom: '2px solid var(--border)' }}>
              {section.title}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {section.items.map(item => (
                <div key={item.label} style={{ display: 'flex', gap: 12, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', minWidth: 120, flexShrink: 0 }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}