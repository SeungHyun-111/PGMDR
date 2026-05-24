import { useState, useEffect } from 'react'
import useScheduleStore from '../store/useScheduleStore'
import { db, ref, get } from '../api/firebase'

// ── GAS 컬럼 사전 ──────────────────────────────────────────────────────────
const PROPOSAL_COLS = [
  { index: 0,  key: 'mdTeam',                name: 'MD팀',          usedIn: '사이드바 팀 표시, 편성비중 팀별 집계, 검색 필터' },
  { index: 1,  key: 'mdCategory',            name: 'MD분류',         usedIn: '사이드바 카테고리 필터, 미편성 테이블 카테고리 컬럼' },
  { index: 2,  key: 'mdName',                name: 'MD명',           usedIn: '미사용 (저장만)' },
  { index: 3,  key: 'pgmCode',               name: '편성코드',        usedIn: 'itemId 해시 생성 재료' },
  { index: 4,  key: 'pgmCodeName',           name: '편성코드명',      usedIn: '편성표 블록 표시명, perfKey 구성, 검색 키워드' },
  { index: 5,  key: 'videoCode',             name: '영상코드',        usedIn: 'itemId 해시 생성 재료' },
  { index: 6,  key: 'videoName',             name: '영상명',          usedIn: '미사용 (저장만)' },
  { index: 7,  key: 'programCode',           name: '프로그램코드',    usedIn: 'itemId 해시 생성 재료' },
  { index: 8,  key: 'programName',           name: '프로그램명',      usedIn: '미사용 (저장만)' },
  { index: 9,  key: 'newProductType',        name: '신상품구분',      usedIn: '편성표 카드 뱃지(신)/(재), 편성비중 재녹화 집계, 시뮬레이션 신상품 필터' },
  { index: 10, key: 'mainPrice',             name: '메인상품가격',    usedIn: '미사용 (저장만)' },
  { index: 11, key: 'dealType',              name: '거래형태',        usedIn: 'normalizeDealType 후 dealTypeConverted 생성 재료' },
  { index: 12, key: 'fixedFee',              name: '정액비',          usedIn: '미사용 (저장만)' },
  { index: 13, key: 'makerSize',             name: '제조사규모',      usedIn: '미사용 (저장만)' },
  { index: 14, key: 'daysAfterFirstAir',     name: '최초송출경과일',  usedIn: '미사용 (저장만)' },
  { index: 15, key: 'preferredTime',         name: '희망시간대',      usedIn: '미사용 (저장만)' },
  { index: 16, key: 'requestNote',           name: '기타요청사항',    usedIn: '미사용 (저장만)' },
  { index: 17, key: 'videoStatus',           name: '방송영상상태',    usedIn: '미사용 (제작중/제작완료 – UI의 신상품구분과 별개)' },
  { index: 18, key: 'targetQty1',            name: '목표수량',        usedIn: '미사용 (저장만)' },
  { index: 19, key: 'partner1',              name: '협력사',          usedIn: '미사용 (저장만)' },
  { index: 20, key: 'availableWeightedMin1', name: '가용가중분',      usedIn: '미편성 테이블 가용가중분 컬럼' },
  { index: 21, key: 'operationStartDate1',   name: '운영시작일',      usedIn: '미사용 (저장만)' },
  { index: 22, key: 'targetQty2',            name: '목표수량',        usedIn: '미사용 (저장만)' },
  { index: 23, key: 'partner2',              name: '협력사',          usedIn: '미사용 (저장만)' },
  { index: 24, key: 'availableWeightedMin2', name: '가용가중분',      usedIn: '미사용 (저장만)' },
  { index: 25, key: 'operationStartDate2',   name: '운영시작일',      usedIn: '미사용 (저장만)' },
  { index: 26, key: 'dealTypeConverted',     name: '거래형태[변환]',  usedIn: 'perfKey 앞부분, 편성표 카드 거래형태 표시, 검색 필터' },
  { index: 27, key: 'remainingSchedule',     name: '잔여편성',        usedIn: '미편성 테이블 잔여편성 컬럼' },
]

const PGM_SLOT_COLS = [
  { index: 0, key: 'weekLabel',   name: '주차',   usedIn: 'slotId 해시 생성 재료' },
  { index: 1, key: 'dateText',    name: 'DATE',   usedIn: 'parsePgmDate 후 dateKey(YYYY-MM-DD) 변환, 편성표 날짜 축' },
  { index: 2, key: 'timeText',    name: 'TIME',   usedIn: '편성표 시간 축, 슬롯 배치 기준, splitWeightedMin 입력' },
  { index: 3, key: 'durationMin', name: '단순분', usedIn: '편성표 슬롯 높이, 가중률(가중분÷단순분) 계산, 시간분할 기준' },
  { index: 4, key: 'weightedMin', name: '가중분', usedIn: '편성비중 핵심 지표, CA/IP 분리 시 splitWeightedMin으로 분배' },
]

const PERF_COLS = [
  { index: 0, key: 'perfKey',              name: 'Key',              usedIn: 'perfMap 조회 키. 형식: dealTypeConverted + pgmCodeName. Firebase 저장 시 [→__LB__, ]→__RB__ 인코딩' },
  { index: 1, key: 'broadcastDate',        name: '방송일자',          usedIn: 'perfMap 중복 시 최신 날짜 데이터 선택 기준' },
  { index: 2, key: 'broadcastTime',        name: '방송시간',          usedIn: '실적 식별 참고용 (저장만)' },
  { index: 3, key: 'pgmCodeName',          name: '편성코드명',        usedIn: '저장만 (perfKey로 조회하므로 직접 사용 안 함)' },
  { index: 4, key: 'salesPerWeightedMin',  name: '(전체)가중분당취급액',  usedIn: '실적예상값·검색 취급/이익 표시, getEffectiveProfit에서 manualInputs 없을 때 폴백' },
  { index: 5, key: 'profitPerWeightedMin', name: '(전체)가중분당한계이익', usedIn: 'getGrade 등급 판정(S/A/B/C/D), getEffectiveProfit 기본값' },
]

const PRE_SCHEDULE_COLS = [
  { index: 0, key: 'pgmCodeName',       name: '편성코드명', usedIn: '슬롯 매핑, 선편성 블록 생성' },
  { index: 1, key: 'displayValue',      name: '노출값',     usedIn: 'dealTypeChar 파싱 (HH:MM뒤 1글자)' },
  { index: 2, key: 'broadcastDateTime', name: '방송일시',   usedIn: 'preScheduleId 해시 재료' },
  { index: 3, key: 'dateText',          name: '날짜',       usedIn: '슬롯 날짜 매핑' },
  { index: 4, key: 'orgName',           name: '조직명',     usedIn: '선편성 블록 팀명 표시' },
  { index: 5, key: 'applyStatus',       name: '반영여부',   usedIn: '"반영"인 행만 로드 (필터 조건)' },
]

// ── 데이터 경로 ───────────────────────────────────────────────────────────
// 루트 경로 (sessions/ 외부)
const ROOT_PATHS = [
  { path: 'activeSessions/{weekKey}', sync: false, label: '활성 세션 레지스트리', desc: '루트 경로. 세션 생성(새 편성 시작) 시 weekKey·생성자·생성일시 등록. 삭제 시 제거. SessionPickerScreen·SessionSwitcher에서 조회해 세션 목록 표시.' },
]

// sessions/{weekKey}/ 하위 경로
const DB_PATHS = [
  { path: 'gasData/meta',            sync: false, label: '초기화 메타',       desc: 'GAS buildInitJson 결과 요약 (건수, 생성일시 등). 세션 최초 로드 여부 판단에 사용. lastWeekKey 유효성 검증 시 이 경로 존재 여부 확인.' },
  { path: 'gasData/pgmSlots',        sync: false, label: 'PGM 슬롯',         desc: '편성표 행(날짜·시간·단순분·가중분). GAS 전체 재동기화 시 덮어씀.' },
  { path: 'gasData/proposalItems',   sync: false, label: '제안상품',          desc: '사이드바 상품 목록. 제안상품 갱신 또는 전체 재동기화로 갱신.' },
  { path: 'gasData/perfMap',         sync: false, label: '실적 DB',          desc: '거래형태+편성코드명 키 → 가중분당취급/한계이익. [→__LB__ 인코딩. 실적DB 갱신으로 갱신.' },
  { path: 'gasData/preScheduleRows', sync: false, label: '선편성 정보',      desc: '반영여부="반영" 행만. 선편성정보 갱신으로 갱신.' },
  { path: 'scheduleBlocks',          sync: true,  label: '편성 블록',         desc: '드래그·수정·삭제 즉시 저장. onValue 실시간 구독 → 팀 전체 즉시 반영.' },
  { path: 'splitSlots',              sync: true,  label: 'CA/IP 분리 상태',  desc: '슬롯별 분리 여부. 시간축 우클릭 저장. 실시간 구독.' },
  { path: 'customSlots',             sync: true,  label: '커스텀 슬롯',      desc: '시간 분할로 생성된 사용자 정의 슬롯. durationMin·weightedMin 오버라이드. 실시간 구독.' },
  { path: 'starred',                 sync: true,  label: '별표',             desc: '상품별 별표 여부 {itemId: true}. 실시간 구독.' },
  { path: 'scheduledItemIds',        sync: true,  label: '편성완료 상품ID',  desc: '사이드바 제거 대상 ID 세트. 실시간 구독.' },
  { path: 'manualInputs',            sync: true,  label: '수동 실적 입력',   desc: 'perfKey 기준 수동 입력값(취급/분·한익/분). 등급 계산 우선 적용. 실시간 구독.' },
  { path: 'logs',                    sync: false, label: '편성 작업 로그',   desc: '편성·수정·삭제·채널변경 이력. _writeLog 자동 기록. 편성현황 변경이력 탭에서 조회.' },
  { path: 'refreshLogs',             sync: false, label: '갱신 이력',        desc: '갱신 메뉴 실행 시 자동 기록 (수정자·일시·결과건수). 설명서 페이지에서 조회.' },
  { path: 'presence/{uid}',          sync: true,  label: 'Presence',         desc: '접속 중인 팀원 목록. 마운트/언마운트 시 write/delete. 실시간 구독.' },
  { path: 'chat',                    sync: true,  label: '채팅',             desc: 'Firebase 기반 팀 채팅. 실시간 구독.' },
]

// ── 협업 동기화 범위 ───────────────────────────────────────────────────────
const COLLAB_ROWS = [
  { item: '편성 블록 드래그/이동/삭제',       scope: 'Firebase 즉시',  note: '모든 팀원에게 실시간 반영' },
  { item: '블록 수정 (채널·메모코드·편성C 등)', scope: 'Firebase 즉시', note: '수정 저장 버튼 클릭 시' },
  { item: 'CA/IP 채널 분리·해제',            scope: 'Firebase 즉시',  note: 'splitSlots + 관련 블록 동시 갱신' },
  { item: '시간 분할/삭제',                  scope: 'Firebase 즉시',  note: 'customSlots 경로. 분할 슬롯의 durationMin·weightedMin 오버라이드 저장' },
  { item: '별표 토글',                       scope: 'Firebase 즉시',  note: '편성현황·실적예상값 필터 공유' },
  { item: '수동 실적 입력',                  scope: 'Firebase 즉시',  note: 'manualInputs 경로. 등급 계산에 즉시 반영' },
  { item: '첨삭(Annotation) 추가',           scope: 'Firebase 즉시',  note: '블록 필드로 저장' },
  { item: 'GAS 데이터 갱신',                 scope: 'Firebase 즉시',  note: 'gasData 경로 덮어씀 → 팀 전체 갱신 트리거' },
  { item: '새 편성 시작 (세션 생성)',         scope: 'Firebase 즉시',  note: 'activeSessions/{weekKey} 등록. 팀 전체 SessionSwitcher 목록 갱신.' },
  { item: '세션 삭제',                       scope: 'Firebase 즉시',  note: 'sessions/ + activeSessions/ 동시 삭제. 팀 전체 목록에서 제거.' },
  { item: '세션 선택/전환 (SessionSwitcher)', scope: '로컬(localStorage)', note: 'lastWeekKey 업데이트 후 해당 세션 로드. 자신만 전환됨. 다른 팀원 화면은 영향 없음.' },
  { item: '테마(라이트/다크) 설정',           scope: '로컬(localStorage)', note: '개인 브라우저 단위. 팀원과 공유 안 됨' },
  { item: '사용자 이름',                     scope: '로컬(localStorage)', note: '로그·채팅·Presence에 표시되는 이름' },
  { item: '마지막 세션 기억',                scope: '로컬(localStorage)', note: 'lastWeekKey. 앱 재방문 시 Firebase gasData/meta 존재 여부 확인 후 복귀. 삭제된 세션은 자동 정리.' },
]

// ── 계산 로직 ─────────────────────────────────────────────────────────────
const CALC_ROWS = [
  { name: 'perfKey',          formula: 'dealTypeConverted + pgmCodeName', note: '실적 조회 키. GAS에서 생성, React에서도 동일 로직으로 구성.' },
  { name: 'getEffectiveProfit', formula: 'manualInputs[perfKey].expectedProfitPerWeightedMin\n  ?? perfMap[perfKey].profitPerWeightedMin', note: '수동 입력이 있으면 우선 적용. 없으면 실적DB 값 사용.' },
  { name: '등급(Grade)',       formula: '≥50만: S  ≥45만: A  ≥40만: B  ≥35만: C  미만: D', note: 'getGrade(getEffectiveProfit(...)). 실적 미입력 시 항상 D.' },
  { name: '가중률',            formula: 'weightedMin ÷ durationMin × 100 (%)',              note: '단순분(방송시간) 대비 가중분 비율. 시간대·채널 프리미엄 반영.' },
  { name: 'CA/IP 가중분 분배', formula: 'caWeighted = round(weightedMin × caRatio/100)\nipWeighted = weightedMin - caWeighted', note: 'splitWeightedMin(). 시간대별 CA:IP 비율 테이블로 분배.' },
  { name: 'Firebase 키 인코딩', formula: 'perfKey의 [ → __LB__  ] → __RB__',                note: 'Firebase는 키에 [] 금지. encodePerfMap/decodePerfMap 사용.' },
  { name: 'itemId / slotId / preScheduleId', formula: 'MD5(parts.join("|")).slice(0,12) 앞에 타입 접두어', note: 'makeHashId_(). 동일 조건이면 항상 같은 ID → 중복 방지.' },
  { name: 'editedBlocks 판정', formula: 'scheduleBlocks에서 !isDefault && !isCompeting', note: '사용자가 직접 편성한 블록만 필터. 갱신 시 보호 대상.' },
]

// ── 갱신 메뉴 ─────────────────────────────────────────────────────────────
const REFRESH_TABLE = [
  { action: 'GAS 전체 재동기화', scope: 'pgmSlots · proposalItems · perfMap · preScheduleRows · targetMetrics · weightedMinTargets', note: '사용자 편성 블록 보호. 선편성·디폴트 블록만 최신 데이터로 덮어씀.' },
  { action: '선편성정보 갱신',   scope: 'preScheduleRows',    note: '사용자 편성 블록 보호. 기존 선편성·디폴트 블록만 덮어씀.' },
  { action: '제안상품 갱신',     scope: 'proposalItems',      note: '이미 편성된 상품은 사이드바에서 제외 유지.' },
  { action: '실적DB 갱신',       scope: 'perfMap',            note: '갱신 후 Firebase perfMap에 __LB__/__RB__ 인코딩으로 저장.' },
]

// ── 편성표 사용법 ─────────────────────────────────────────────────────────
const USAGE_SECTIONS = [
  {
    title: '편성표 기본 조작',
    items: [
      { label: '블록 편성',   desc: '사이드바 카드를 슬롯으로 드래그. 편성 즉시 Firebase 저장 → 팀원 실시간 반영.' },
      { label: '블록 이동',   desc: '편성된 블록을 다른 슬롯으로 드래그.' },
      { label: '블록 삭제',   desc: '우클릭 → 삭제. 디폴트([편성팀]) 블록으로 복원.' },
      { label: '블록 수정',   desc: '더블클릭 또는 우클릭 → 수정. 채널·메모코드·편성C·신상품구분·수동실적 편집 가능.' },
      { label: '사이드바 복귀', desc: '우클릭 → 사이드바로 복귀. 사이드바에서 블록 재사용 가능.' },
    ]
  },
  {
    title: 'CA/IP 채널 분리',
    items: [
      { label: '분리',        desc: '편성표 좌측 시간축 우클릭 → CA/IP 분리. 기존 블록이 있으면 어느 채널에 남길지 선택.' },
      { label: '분리 해제',   desc: '분리된 시간축 우클릭 → 일원(전채널) 복원.' },
      { label: '전체 해제',   desc: '툴바 "분리 전체 해제" 버튼으로 모든 분리 일괄 해제.' },
      { label: '가중분 분배', desc: 'splitWeightedMin()이 시간대별 CA:IP 비율로 자동 계산 분배.' },
    ]
  },
  {
    title: '경쟁 편성',
    items: [
      { label: '생성', desc: '이미 편성된 슬롯에 다른 상품 드래그 시 경쟁 블록 생성.' },
      { label: '표시', desc: '빨간 배경 + ⚔ 아이콘. isCompeting 플래그로 등급·비중 집계에서 제외.' },
      { label: '해제', desc: '경쟁 블록 우클릭 → 경쟁 해제.' },
    ]
  },
  {
    title: '첨삭 / 편성C / 별표',
    items: [
      { label: '첨삭',   desc: '우클릭 → 첨삭 추가. 블록 우상단 노란 삼각형 표시. 마우스 오버 시 툴팁에서 확인.' },
      { label: '편성C',  desc: '블록 수정의 편성C 필드. # 포함 시 블록 우하단에 초록 # 마크.' },
      { label: '별표',   desc: '사이드바 카드 ☆ 클릭. Firebase starred 경로에 저장 → 팀 전체 공유.' },
    ]
  },
  {
    title: '내보내기',
    items: [
      { label: '인쇄',            desc: '초안 편성표 그리드를 그대로 A4 가로 한 장으로 인쇄. 슬롯 수·날짜 수에 따라 행 높이와 zoom을 자동 계산해 한 페이지에 꽉 채움.' },
      { label: 'Excel',           desc: '편성표 전체를 .xlsx로 내보내기.' },
      { label: 'HTML (Outlook)',  desc: '이메일 첨부 적합한 HTML 내보내기. 편성표·시뮬레이션·편성비중·편성현황 섹션 선택 가능.' },
    ]
  },
  {
    title: '세션 관리',
    items: [
      { label: '세션 선택',    desc: '앱 최초 진입 시 Firebase activeSessions에서 활성 세션 목록 조회. 세션 선택 후 접속하면 lastWeekKey 저장.' },
      { label: '세션 전환',    desc: '우상단 SessionSwitcher(주차 키 표시 드롭다운)에서 다른 세션으로 전환. 자신만 전환됨, 팀원 화면 영향 없음.' },
      { label: '새 편성 시작', desc: '메뉴 → 새 편성 시작. Firebase 기존 세션 데이터 삭제 후 GAS 재호출. activeSessions에 새 키 등록.' },
      { label: '세션 삭제',    desc: 'SessionSwitcher ✕ → 확인 문구(플레이스홀더) 입력 후 영구 삭제. sessions/ + activeSessions/ 동시 삭제.' },
      { label: '자동 복귀',    desc: '재방문 시 lastWeekKey로 직전 세션 자동 접속. 단, Firebase gasData/meta 존재 여부를 먼저 확인 — 삭제된 세션이면 자동 정리 후 목록 화면 표시.' },
    ]
  },
]

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent)', marginBottom: 14, paddingBottom: 7, borderBottom: '2px solid var(--border)', letterSpacing: '-.01em' }}>
      {children}
    </div>
  )
}

function Card({ children, style }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px', ...style }}>
      {children}
    </div>
  )
}

function SubTitle({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>{children}</div>
}

function FlowDiagram() {
  const box = (label, sub, color) => (
    <div style={{ border: `2px solid ${color}`, borderRadius: 8, padding: '8px 14px', textAlign: 'center', background: 'var(--bg)', minWidth: 110 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color }}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 3, lineHeight: 1.4 }}>{sub}</div>}
    </div>
  )
  const arrow = (label) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 2px', flexShrink: 0 }}>
      <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 1, textAlign: 'center', whiteSpace: 'pre-line' }}>{label}</div>
      <div style={{ fontSize: 16, color: 'var(--border2)' }}>→</div>
    </div>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto', paddingBottom: 4 }}>
      {box('Google Sheets', '원천 데이터', 'var(--green)')}
      {arrow('GAS 웹앱\n(doGet)')}
      {box('Firebase RTDB', 'sessions/{weekKey}/', '#f5a623')}
      {arrow('onValue\n실시간구독')}
      {box('Zustand Store', 'useScheduleStore', 'var(--accent)')}
      {arrow('렌더링')}
      {box('편성 작업판', 'React UI', 'var(--ip-t)')}
    </div>
  )
}

const thS = { padding: '7px 10px', fontSize: 10, fontWeight: 700, color: 'var(--text3)', background: 'var(--bg3)', textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const tdS = { padding: '7px 10px', fontSize: 10, borderBottom: '1px solid var(--border)', verticalAlign: 'top', lineHeight: 1.5 }

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
              실시간 구독(onValue) 경로 6개: <span style={{ color: 'var(--text2)' }}>scheduleBlocks · splitSlots · customSlots · starred · scheduledItemIds · manualInputs</span>
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
