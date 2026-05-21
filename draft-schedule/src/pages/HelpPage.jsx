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

export default function HelpPage() {
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '20px 24px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>설명서</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 28 }}>편성 작업판 기능 안내</div>

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