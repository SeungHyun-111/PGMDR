export const REVIEW_REQUEST_SUBJECT = '신상품/재녹화 리뷰 요청'

export const REVIEW_TEAM_RECIPIENTS = {
  가전팀: '가전팀(2039)/SKSTOA',
  리빙팀: '리빙팀(2040)/SKSTOA',
  뷰티팀: '뷰티팀(2176)/SKSTOA',
  헬스푸드팀: '헬스푸드팀(2406)/SKSTOA',
  식품팀: '식품팀(2041)/SKSTOA',
  패션트렌드팀: '패션트렌드팀(1800)/SKSTOA',
  문화서비스팀: '문화서비스팀(1798)/SKSTOA',
}

export function getReviewRecipients(rows) {
  const teams = [...new Set(rows.map(row => String(row.teamName || row.mdTeam || '').trim()))]
  const unknown = teams.filter(team => !Object.hasOwn(REVIEW_TEAM_RECIPIENTS, team))
  if (unknown.length) throw new Error(`수신자가 등록되지 않은 조직입니다: ${unknown.map(team => team || '미지정').join(', ')}`)
  return teams.map(team => REVIEW_TEAM_RECIPIENTS[team])
}

export function buildReviewRequestMailto(rows) {
  const recipients = getReviewRecipients(rows).map(name => encodeURIComponent(name)).join(';')
  return `mailto:${recipients}?subject=${encodeURIComponent(REVIEW_REQUEST_SUBJECT)}`
}

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const number = value => value == null || value === '' || !Number.isFinite(Number(value)) ? '-' : Math.round(Number(value)).toLocaleString('ko-KR')

function dateLabel(value) {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : `${date.getMonth() + 1}월 ${date.getDate()}일 ${['일', '월', '화', '수', '목', '금', '토'][date.getDay()]}`
}

export function buildReviewRequestBody(rows) {
  const headers = ['구분', '편성코드', '팀명', '날짜', '시간', '다원', '분취', '분한익', '리뷰']
  // Reserve the freed space for writing reviews; repeat widths on cells for Outlook.
  const widths = ['4%', '17.5%', '7.7%', '7.7%', '4.9%', '4.9%', '6.4%', '6.4%', '40.5%']
  const values = rows.map(row => [
    row.newProductType === '신상품' ? '신' : '재',
    row.pgmCodeName || '-', row.teamName || row.mdTeam || '-',
    dateLabel(row.broadcastDate), row.broadcastTime || '-', row.multiChannel || '-',
    number(row.salesPerWeightedMin), number(row.profitPerWeightedMin), '',
  ])
  const cell = 'border:1px solid #dce0f0;padding:10px 5px;font-size:12px;word-wrap:break-word;'
  const html = `<html><head><meta charset="utf-8"></head><body style="font-family:Malgun Gothic,Arial,sans-serif;font-size:14px;color:#171b2f;">
<p>안녕하세요. 편성팀입니다.</p>
<p style="margin:28px 0;">아래 신상품/재녹화 PGM 리뷰 요청드립니다.</p>
<table width="100%" cellpadding="0" cellspacing="3" style="border-collapse:separate;width:100%;table-layout:fixed;">
<thead><tr>${headers.map((header, index) => `<th width="${widths[index]}" style="${cell}width:${widths[index]};border-top:2px solid #202337;text-align:${index === 6 || index === 7 ? 'right' : index === 0 || index === 4 || index === 5 ? 'center' : 'left'};">${escapeHtml(header)}</th>`).join('')}</tr></thead>
<tbody>${values.map(cells => `<tr>${cells.map((value, index) => `<td width="${widths[index]}" style="${cell}width:${widths[index]};${index === 6 || index === 7 ? 'text-align:right;' : index === 0 || index === 4 || index === 5 ? 'text-align:center;' : ''}${index === 0 ? `font-weight:bold;color:${value === '신' ? '#4266ff' : '#464a6b'};` : ''}">${escapeHtml(value)}</td>`).join('')}</tr>`).join('')}</tbody>
</table><p style="margin-top:28px;">감사합니다.</p></body></html>`
  const text = ['안녕하세요. 편성팀입니다.', '', '아래 신상품/재녹화 PGM 리뷰 요청드립니다.', '', headers.join('\t'), ...values.map(cells => cells.join('\t')), '', '감사합니다.'].join('\r\n')
  return { html, text }
}
