import { useState, useEffect } from 'react'
import useScheduleStore from '../store/useScheduleStore'
import { db, ref, get } from '../api/firebase'

import { CALC_ROWS, COLLAB_ROWS, DB_PATHS, PERF_COLS, PGM_SLOT_COLS, PRE_SCHEDULE_COLS, PROPOSAL_COLS, REFRESH_TABLE, ROOT_PATHS, USAGE_SECTIONS } from '../data/helpContent.jsx'

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
        .slice(0, 30)
      setRefreshLogs(logs)
    }).catch(() => {})
  }, [startDate, poolType])

  const fmtTime = ts => {
    const d = new Date(ts)
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '20px 28px', background: 'var(--bg)' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>설명서</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 28 }}>편성 작업판 기능 안내 · 시스템 구조 · GAS 컬럼 사전</div>

      {/* ── 1. 데이터 송수신 구조 ──────────────────────────────────────── */}
      <Card style={{ marginBottom: 28 }}>
        <SubTitle>실적/가중분 계산 기준 요약</SubTitle>
        <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 10 }}>
          편성된 블록의 최종 실적값은 실제실적 → 수기실적 → 직전실적 → 0 순서로 결정됩니다.
          아래 표는 각 화면에서 노출되는 가중분과 평균 분모로 쓰는 가중분이 같은지, 그리고 0 가중분을 1로 보정하는지 정리한 것입니다.
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 1180, borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr>
                <th style={thS}>화면/테이블</th>
                <th style={thS}>노출되는 가중분</th>
                <th style={thS}>분모 가중분</th>
                <th style={thS}>0 가중분 1 보정</th>
                <th style={thS}>로직</th>
              </tr>
            </thead>
            <tbody>
              {PERF_WEIGHT_ROWS.map(row => (
                <tr key={row.table}>
                  <td style={{ ...tdS, fontWeight: 700, color: 'var(--text)', minWidth: 180 }}>{row.table}</td>
                  <td style={{ ...tdS, color: 'var(--accent)', minWidth: 220 }}>{emphasizeNoPerfIncluded(row.shown)}</td>
                  <td style={{ ...tdS, color: 'var(--green)', minWidth: 240 }}>{emphasizeNoPerfIncluded(row.denominator)}</td>
                  <td style={{ ...tdS, color: row.correction.startsWith('적용') ? 'var(--orange)' : 'var(--text2)', minWidth: 180, fontWeight: 700 }}>{row.correction}</td>
                  <td style={{ ...tdS, color: 'var(--text2)', minWidth: 340 }}>{emphasizeNoPerfIncluded(row.logic)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div style={{ marginBottom: 36 }}>
        <SectionTitle>1. 데이터 송수신 구조</SectionTitle>

        <Card style={{ marginBottom: 14 }}>
          <SubTitle>데이터 흐름 (일렬)</SubTitle>
          <FlowDiagram />
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 10, lineHeight: 1.7 }}>
            모든 데이터의 원천은 <strong style={{ color: 'var(--text2)' }}>구글 스프레드시트</strong>입니다.
            Apps Script(GAS) 웹앱이 시트를 읽어 JSON으로 반환하면, 앱이 Firebase에 캐싱합니다.
            이후 Firebase <code style={{ fontSize: 10 }}>onValue</code>로 실시간 구독하여 팀원 간 편성 상태를 동기화합니다.
            세션 키(<code style={{ fontSize: 10 }}>{'{startDate}_{poolType}'}</code>)를 기준으로 데이터 격리.
          </div>
        </Card>

        {/* 갱신 메뉴별 처리 범위 */}
        <Card style={{ marginBottom: 14 }}>
          <SubTitle>갱신 메뉴별 처리 범위</SubTitle>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                <th style={thS}>메뉴</th>
                <th style={thS}>갱신 대상 Firebase 경로</th>
                <th style={thS}>비고</th>
              </tr>
            </thead>
            <tbody>
              {REFRESH_TABLE.map(r => (
                <tr key={r.action}>
                  <td style={{ ...tdS, fontWeight: 700, color: r.action.includes('전체') ? 'var(--orange)' : 'var(--text)', whiteSpace: 'nowrap' }}>{r.action}</td>
                  <td style={{ ...tdS, color: 'var(--accent)', fontFamily: 'monospace', fontSize: 10 }}>{r.scope}</td>
                  <td style={{ ...tdS, color: 'var(--text2)' }}>{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* 갱신 이력 */}
        <Card>
          <SubTitle>최근 갱신 이력 (현재 세션)</SubTitle>
          {refreshLogs.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>기록 없음</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr>
                  <th style={{ ...thS, width: 80 }}>일시</th>
                  <th style={thS}>작업</th>
                  <th style={thS}>결과</th>
                  <th style={{ ...thS, textAlign: 'right' }}>수정자</th>
                </tr>
              </thead>
              <tbody>
                {refreshLogs.map((log, i) => (
                  <tr key={i}>
                    <td style={{ ...tdS, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{fmtTime(log.timestamp)}</td>
                    <td style={{ ...tdS, color: 'var(--orange)', fontWeight: 700 }}>{log.action}</td>
                    <td style={{ ...tdS, color: 'var(--text2)' }}>{log.details}</td>
                    <td style={{ ...tdS, color: 'var(--text3)', textAlign: 'right' }}>{log.user}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* ── 2. 로컬 vs Firebase ───────────────────────────────────────── */}
      <div style={{ marginBottom: 36 }}>
        <SectionTitle>2. 로컬 캐시 vs Firebase — 무엇이 어디에 저장되나</SectionTitle>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(217,119,6,.15)', color: '#d97706', padding: '2px 8px', borderRadius: 4 }}>localStorage</span>
              <span style={{ fontSize: 9, color: 'var(--text3)' }}>개인 브라우저 · 팀 미공유</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {[
                { k: 'lastWeekKey', d: '마지막으로 열었던 세션 키. 앱 재방문 시 자동 복귀.' },
                { k: 'theme',       d: '라이트/다크 테마 선택.' },
                { k: 'userName',    d: '접속자 이름. 로그·채팅·Presence에 표시.' },
              ].map(r => (
                <div key={r.k} style={{ display: 'flex', gap: 8, fontSize: 10 }}>
                  <code style={{ background: 'var(--bg3)', padding: '1px 6px', borderRadius: 3, color: '#d97706', whiteSpace: 'nowrap', flexShrink: 0 }}>{r.k}</code>
                  <span style={{ color: 'var(--text2)' }}>{r.d}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(99,102,241,.15)', color: 'var(--accent)', padding: '2px 8px', borderRadius: 4 }}>Firebase RTDB</span>
              <span style={{ fontSize: 9, color: 'var(--text3)' }}>팀 전체 실시간 공유</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.6 }}>
              루트: <code style={{ fontSize: 10, color: '#f5a623' }}>activeSessions/{'{weekKey}'}</code> — 세션 목록 공유.<br/>
              세션 데이터: <code style={{ fontSize: 10, color: 'var(--accent)' }}>sessions/{'{weekKey}'}/</code> 경로 아래.<br/>
              수정 즉시 팀 전체에 반영됩니다.<br/>
              실시간 구독(onValue) 경로 7개: <span style={{ color: 'var(--text2)' }}>scheduleBlocks · entityProps · splitSlots · customSlots · starred · scheduledItemIds · manualInputs</span>
            </div>
          </Card>
        </div>

        {/* 협업 동기화 범위 */}
        <Card style={{ marginBottom: 14 }}>
          <SubTitle>협업 시 무엇이 실시간으로 공유되나</SubTitle>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr>
                <th style={thS}>작업</th>
                <th style={thS}>저장 위치</th>
                <th style={thS}>동기화 범위</th>
              </tr>
            </thead>
            <tbody>
              {COLLAB_ROWS.map(r => (
                <tr key={r.item}>
                  <td style={{ ...tdS, fontWeight: 600, color: 'var(--text)' }}>{r.item}</td>
                  <td style={{ ...tdS, color: r.scope.startsWith('로컬') ? '#d97706' : 'var(--green)', fontWeight: 700 }}>{r.scope}</td>
                  <td style={{ ...tdS, color: 'var(--text2)' }}>{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Firebase 경로 구조 */}
        <Card>
          <SubTitle>Firebase 데이터 경로 구조</SubTitle>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8 }}>
            ▸ <span style={{ color: '#f5a623', fontWeight: 700 }}>루트 경로</span> — 세션과 무관하게 앱 전체 공유
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, marginBottom: 16 }}>
            <thead>
              <tr>
                <th style={thS}>경로 (루트 기준)</th>
                <th style={{ ...thS, width: 60, textAlign: 'center' }}>실시간 구독</th>
                <th style={thS}>내용</th>
              </tr>
            </thead>
            <tbody>
              {ROOT_PATHS.map(p => (
                <tr key={p.path}>
                  <td style={{ ...tdS, fontFamily: 'monospace', color: '#f5a623', whiteSpace: 'nowrap' }}>{p.path}</td>
                  <td style={{ ...tdS, textAlign: 'center', color: 'var(--border2)', fontWeight: 700 }}>-</td>
                  <td style={{ ...tdS, color: 'var(--text2)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text)' }}>{p.label}</span>
                    <span style={{ color: 'var(--text3)', marginLeft: 6 }}>{p.desc}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8 }}>
            ▸ <span style={{ color: 'var(--accent)', fontWeight: 700 }}>세션 경로</span> — <code style={{ fontSize: 10 }}>sessions/{'{startDate}_{poolType}/'}</code> 하위
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr>
                <th style={thS}>경로 (sessions/{'{weekKey}'} 기준)</th>
                <th style={{ ...thS, width: 60, textAlign: 'center' }}>실시간 구독</th>
                <th style={thS}>내용</th>
              </tr>
            </thead>
            <tbody>
              {DB_PATHS.map(p => (
                <tr key={p.path}>
                  <td style={{ ...tdS, fontFamily: 'monospace', color: 'var(--accent)', whiteSpace: 'nowrap' }}>{p.path}</td>
                  <td style={{ ...tdS, textAlign: 'center', color: p.sync ? 'var(--green)' : 'var(--border2)', fontWeight: 700 }}>{p.sync ? '✓' : '-'}</td>
                  <td style={{ ...tdS, color: 'var(--text2)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text)' }}>{p.label}</span>
                    <span style={{ color: 'var(--text3)', marginLeft: 6 }}>{p.desc}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* ── 3. 계산 로직 ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 36 }}>
        <SectionTitle>3. 핵심 계산 로직</SectionTitle>
        <Card>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr>
                <th style={{ ...thS, width: 160 }}>항목</th>
                <th style={thS}>공식 / 로직</th>
                <th style={thS}>비고</th>
              </tr>
            </thead>
            <tbody>
              {CALC_ROWS.map(r => (
                <tr key={r.name}>
                  <td style={{ ...tdS, fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap' }}>{r.name}</td>
                  <td style={{ ...tdS, fontFamily: 'monospace', color: 'var(--text)', whiteSpace: 'pre-line' }}>{r.formula}</td>
                  <td style={{ ...tdS, color: 'var(--text2)' }}>{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* ── 4. 편성표 사용법 ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 36 }}>
        <SectionTitle>4. 편성표 사용법</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
          {USAGE_SECTIONS.map(section => (
            <Card key={section.title}>
              <SubTitle>{section.title}</SubTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {section.items.map(item => (
                  <div key={item.label} style={{ display: 'flex', gap: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', minWidth: 80, flexShrink: 0 }}>{item.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text2)', lineHeight: 1.6 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* ── 5. GAS 컬럼 사전 ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 36 }}>
        <SectionTitle>5. GAS 컬럼 사전</SectionTitle>

        <Card style={{ marginBottom: 14 }}>
          <SubTitle>제안상품 (PROPOSAL_COLUMNS) — A_Pool / B_Pool 시트, 2행~, B열부터 28컬럼</SubTitle>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr>
                <th style={{ ...thS, width: 40 }}>Index</th>
                <th style={thS}>key</th>
                <th style={thS}>GAS 컬럼명</th>
                <th style={thS}>사용 위치 / 코드</th>
              </tr>
            </thead>
            <tbody>
              {PROPOSAL_COLS.map(c => (
                <tr key={c.key}>
                  <td style={{ ...tdS, textAlign: 'center', color: 'var(--text3)' }}>{c.index}</td>
                  <td style={{ ...tdS, fontFamily: 'monospace', color: 'var(--accent)', whiteSpace: 'nowrap' }}>{c.key}</td>
                  <td style={{ ...tdS, color: 'var(--text)', whiteSpace: 'nowrap' }}>{c.name}</td>
                  <td style={{ ...tdS, color: c.usedIn.startsWith('미사용') ? 'var(--text3)' : 'var(--text2)' }}>{c.usedIn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card style={{ marginBottom: 14 }}>
          <SubTitle>PGM 슬롯 (PGM_SLOT_COLUMNS) — PGM 시트, 5행~, D열부터 5컬럼</SubTitle>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr>
                <th style={{ ...thS, width: 40 }}>Index</th>
                <th style={thS}>key</th>
                <th style={thS}>GAS 컬럼명</th>
                <th style={thS}>사용 위치 / 코드</th>
              </tr>
            </thead>
            <tbody>
              {PGM_SLOT_COLS.map(c => (
                <tr key={c.key}>
                  <td style={{ ...tdS, textAlign: 'center', color: 'var(--text3)' }}>{c.index}</td>
                  <td style={{ ...tdS, fontFamily: 'monospace', color: 'var(--accent)', whiteSpace: 'nowrap' }}>{c.key}</td>
                  <td style={{ ...tdS, color: 'var(--text)', whiteSpace: 'nowrap' }}>{c.name}</td>
                  <td style={{ ...tdS, color: 'var(--text2)' }}>{c.usedIn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card style={{ marginBottom: 14 }}>
          <SubTitle>실적 DB (PERFORMANCE_COLUMNS) — 실적DB 시트, 2행~, 6컬럼</SubTitle>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr>
                <th style={{ ...thS, width: 40 }}>Index</th>
                <th style={thS}>key</th>
                <th style={thS}>GAS 컬럼명</th>
                <th style={thS}>사용 위치 / 코드</th>
              </tr>
            </thead>
            <tbody>
              {PERF_COLS.map(c => (
                <tr key={c.key}>
                  <td style={{ ...tdS, textAlign: 'center', color: 'var(--text3)' }}>{c.index}</td>
                  <td style={{ ...tdS, fontFamily: 'monospace', color: 'var(--accent)', whiteSpace: 'nowrap' }}>{c.key}</td>
                  <td style={{ ...tdS, color: 'var(--text)', whiteSpace: 'nowrap' }}>{c.name}</td>
                  <td style={{ ...tdS, color: 'var(--text2)' }}>{c.usedIn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card style={{ marginBottom: 14 }}>
          <SubTitle>선편성 정보 (PRE_SCHEDULE_COLUMNS) — 종합 시트, 4행~, H열부터 6컬럼, 반영여부="반영"만 로드</SubTitle>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr>
                <th style={{ ...thS, width: 40 }}>Index</th>
                <th style={thS}>key</th>
                <th style={thS}>GAS 컬럼명</th>
                <th style={thS}>사용 위치 / 코드</th>
              </tr>
            </thead>
            <tbody>
              {PRE_SCHEDULE_COLS.map(c => (
                <tr key={c.key}>
                  <td style={{ ...tdS, textAlign: 'center', color: 'var(--text3)' }}>{c.index}</td>
                  <td style={{ ...tdS, fontFamily: 'monospace', color: 'var(--accent)', whiteSpace: 'nowrap' }}>{c.key}</td>
                  <td style={{ ...tdS, color: 'var(--text)', whiteSpace: 'nowrap' }}>{c.name}</td>
                  <td style={{ ...tdS, color: 'var(--text2)' }}>{c.usedIn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <SubTitle>GAS 주요 함수 목록</SubTitle>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr>
                <th style={thS}>함수명</th>
                <th style={thS}>역할</th>
              </tr>
            </thead>
            <tbody>
              {[
                { fn: 'doGet(e)',                         desc: 'GAS 웹앱 진입점. action 파라미터로 init / refreshPerformance / refreshProposals / refreshPreSchedule 분기.' },
                { fn: 'buildInitJson_(startDate, poolType)', desc: '전체 초기 데이터(슬롯·제안상품·실적·선편성·목표) 통합 JSON 생성.' },
                { fn: 'loadProposalItemsAsJson_(sheetName, perfMap)', desc: '제안상품 시트 파싱. PROPOSAL_COLUMNS 기준. itemId = makeHashId_() 생성.' },
                { fn: 'loadPgmSlotsAsJson_(startDateText)', desc: 'PGM 시트 파싱. 주어진 월요일 기준 7일 슬롯만 필터. slotId = makeHashId_() 생성.' },
                { fn: 'buildPerfMap_()',                   desc: '실적DB 시트 파싱. 동일 perfKey 중복 시 최신 날짜 선택. getValues()로 Date 객체 직접 처리.' },
                { fn: 'loadPreScheduleRowsAsJson_(perfMap)', desc: '선편성 시트 파싱. 반영여부="반영"만. dealTypeChar → dealType 변환.' },
                { fn: 'loadTargetMetricsAsJson_(targetMonth)', desc: '분당취급고/분당한계이익 목표 시트 파싱.' },
                { fn: 'loadWeightedMinTargetAsJson_(startDateText)', desc: '팀별 주간 가중분 목표 파싱. 헤더 행에서 날짜 객체로 열 위치 탐색.' },
                { fn: 'normalizeDealType_(value)',          desc: '거래형태 문자열 정규화 → [위]/[모]/[직]/[혼]/[액]/[률]. React의 동일 함수와 로직 동일.' },
                { fn: 'normalizeValue_(value, key)',        desc: '숫자 필드는 toNumber_() 변환. 나머지는 문자열 trim.' },
                { fn: 'toNumber_(value)',                   desc: '콤마·% 제거 후 Number 변환. 변환 불가 시 0 반환.' },
                { fn: 'parseDateOnly_(value)',               desc: 'YYYY-MM-DD 문자열 → Date 객체.' },
                { fn: 'parsePgmDate_(dateText, baseMonday)', desc: 'PGM 시트의 MM/DD 형식 날짜 → Date 객체. 연말/연초 처리 포함.' },
                { fn: 'addDays_(date, days)',               desc: '날짜 + N일 계산.' },
                { fn: 'formatDateOnly_(date)',               desc: 'Date → yyyy-MM-dd 문자열 (서울 시간대).' },
                { fn: 'toComparableDateStr_(dateStr)',       desc: '날짜 문자열 → YYYYMMDD 숫자 문자열 (비교용).' },
                { fn: 'makeHashId_(parts)',                  desc: 'parts 배열 MD5 해싱 → {type}_{12자리 hex}. 동일 조건 → 항상 같은 ID.' },
                { fn: 'jsonOk_(data)',                       desc: 'JSON 응답 래퍼 { success: true, data }.' },
                { fn: 'jsonError_(message)',                 desc: 'JSON 오류 응답 래퍼 { success: false, error }.' },
                { fn: 'showDraftSchedulePopup()',            desc: '구글 시트 메뉴에서 초안편성 설정 팝업 표시 (HtmlService).' },
                { fn: 'runDraftScheduleBuilder(options)',    desc: '팝업에서 실행 버튼 클릭 시 buildInitJson_ 실행 → 결과 요약 반환.' },
                { fn: 'debugDraftScheduleData()',            desc: 'GAS 에디터 직접 실행용 디버그 함수. Logger로 샘플 출력.' },
                { fn: 'debugWeightedTarget()',               desc: '가중분 목표 시트 헤더 날짜 컬럼 디버그.' },
              ].map(r => (
                <tr key={r.fn}>
                  <td style={{ ...tdS, fontFamily: 'monospace', color: 'var(--accent)', whiteSpace: 'nowrap' }}>{r.fn}</td>
                  <td style={{ ...tdS, color: 'var(--text2)' }}>{r.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}

