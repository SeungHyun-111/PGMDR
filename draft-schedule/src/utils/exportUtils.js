import * as XLSX from 'xlsx'

// 편성표 데이터 → 엑셀
export function exportToExcel(scheduleBlocks, pgmSlots, categoryMap) {
  const rows = Object.values(scheduleBlocks)
    .filter(b => b && !b.isDefault)
    .sort((a, b) => a.dateKey !== b.dateKey
      ? a.dateKey.localeCompare(b.dateKey)
      : (a.timeText || '').localeCompare(b.timeText || ''))
    .map(b => ({
      날짜:       b.dateKey,
      시간:       b.timeText,
      채널:       b.channel,
      조직:       b.orgName || '-',
      팀:         b.mdTeam || '-',
      카테고리:   categoryMap[b.pgmCodeName] || '미입력',
      편성코드명: b.pgmCodeName,
      가중분:     b.weightedMin || 0,
      거래형태:   b.dealType || '-',
      메모코드:   b.memoCode || '-',
      편성C:      b.scheduleComment || '-',
      상태:       b.isCompeting ? '경쟁' : b.isPreSchedule ? '선편성' : '편성',
      첨삭:       b.annotation || '',
    }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '편성표')

  // 열 너비 자동 조정
  const colWidths = Object.keys(rows[0] || {}).map(key => ({
    wch: Math.max(key.length, ...rows.map(r => String(r[key] || '').length)) + 2
  }))
  ws['!cols'] = colWidths

  XLSX.writeFile(wb, `편성표_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// 편성표 → Outlook용 HTML
export function exportToHTML(scheduleBlocks, pgmSlots, categoryMap, startDate, endDate) {
  const blocks = Object.values(scheduleBlocks)
    .filter(b => b && !b.isDefault)
    .sort((a, b) => a.dateKey !== b.dateKey
      ? a.dateKey.localeCompare(b.dateKey)
      : (a.timeText || '').localeCompare(b.timeText || ''))

  const rows = blocks.map(b => `
    <tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:6px 10px;white-space:nowrap;color:#6b7280;">${b.dateKey}</td>
      <td style="padding:6px 10px;font-weight:600;white-space:nowrap;">${b.timeText}</td>
      <td style="padding:6px 10px;">
        <span style="font-size:11px;padding:2px 6px;border-radius:4px;font-weight:700;
          background:${b.channel === 'CA' ? '#dbeafe' : b.channel === 'IP' ? '#ede9fe' : '#dcfce7'};
          color:${b.channel === 'CA' ? '#1d4ed8' : b.channel === 'IP' ? '#6d28d9' : '#15803d'};">
          ${b.channel}
        </span>
      </td>
      <td style="padding:6px 10px;color:#6b7280;">${b.mdTeam || '-'}</td>
      <td style="padding:6px 10px;color:#6b7280;">${categoryMap[b.pgmCodeName] || '미입력'}</td>
      <td style="padding:6px 10px;font-weight:500;">${b.pgmCodeName}</td>
      <td style="padding:6px 10px;text-align:right;font-weight:700;color:#4a6cf7;">${(b.weightedMin || 0).toLocaleString()}</td>
      <td style="padding:6px 10px;color:#6b7280;">${b.dealType || '-'}</td>
      <td style="padding:6px 10px;color:#6b7280;">${b.memoCode || '-'}</td>
      <td style="padding:6px 10px;color:#6b7280;">${b.scheduleComment || '-'}</td>
      <td style="padding:6px 10px;">
        <span style="font-size:10px;padding:2px 6px;border-radius:4px;font-weight:700;
          background:${b.isCompeting ? '#fef2f2' : b.isPreSchedule ? '#f3f4f6' : '#f0fdf4'};
          color:${b.isCompeting ? '#dc2626' : b.isPreSchedule ? '#6b7280' : '#16a34a'};">
          ${b.isCompeting ? '경쟁' : b.isPreSchedule ? '선편성' : '편성'}
        </span>
      </td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>편성표 ${startDate} ~ ${endDate}</title>
  <style>
    body { font-family: 'Malgun Gothic', Arial, sans-serif; font-size: 12px; color: #1a1d2e; margin: 20px; }
    h2 { font-size: 16px; color: #1a1d2e; margin-bottom: 4px; }
    .subtitle { font-size: 11px; color: #8b90ab; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; border: 1px solid #e2e4ef; }
    thead tr { background: #f0f1f7; }
    th { padding: 8px 10px; text-align: left; font-size: 11px; color: #4a4f6e; font-weight: 600; white-space: nowrap; border-bottom: 2px solid #e2e4ef; }
    tr:nth-child(even) { background: #f9fafb; }
  </style>
</head>
<body>
  <h2>📅 편성표</h2>
  <div class="subtitle">${startDate} ~ ${endDate} · 총 ${blocks.length}건</div>
  <table>
    <thead>
      <tr>
        <th>날짜</th><th>시간</th><th>채널</th><th>팀</th>
        <th>카테고리</th><th>편성코드명</th><th>가중분</th>
        <th>거래형태</th><th>메모코드</th><th>편성C</th><th>상태</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `편성표_${startDate}_${endDate}.html`
  a.click()
  URL.revokeObjectURL(url)
}

// 인쇄
export function printSchedule(scheduleBlocks, categoryMap, startDate, endDate) {
  const blocks = Object.values(scheduleBlocks)
    .filter(b => b && !b.isDefault)
    .sort((a, b) => a.dateKey !== b.dateKey
      ? a.dateKey.localeCompare(b.dateKey)
      : (a.timeText || '').localeCompare(b.timeText || ''))

  const rows = blocks.map(b => `
    <tr>
      <td>${b.dateKey}</td>
      <td>${b.timeText}</td>
      <td>${b.channel}</td>
      <td>${b.mdTeam || '-'}</td>
      <td>${categoryMap[b.pgmCodeName] || '미입력'}</td>
      <td>${b.pgmCodeName}</td>
      <td style="text-align:right">${(b.weightedMin || 0).toLocaleString()}</td>
      <td>${b.dealType || '-'}</td>
      <td>${b.memoCode || '-'}</td>
      <td>${b.isCompeting ? '경쟁' : b.isPreSchedule ? '선편성' : '편성'}</td>
    </tr>`).join('')

  const win = window.open('', '_blank')
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>편성표 ${startDate} ~ ${endDate}</title>
  <style>
    @media print { @page { margin: 15mm; } }
    body { font-family: 'Malgun Gothic', Arial, sans-serif; font-size: 10px; }
    h2 { font-size: 13px; margin-bottom: 2px; }
    .sub { font-size: 10px; color: #666; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ccc; padding: 4px 6px; white-space: nowrap; }
    th { background: #f0f0f0; font-weight: 600; }
    tr:nth-child(even) td { background: #f9f9f9; }
  </style>
</head>
<body>
  <h2>편성표</h2>
  <div class="sub">${startDate} ~ ${endDate} · 총 ${blocks.length}건</div>
  <table>
    <thead>
      <tr><th>날짜</th><th>시간</th><th>채널</th><th>팀</th><th>카테고리</th>
      <th>편성코드명</th><th>가중분</th><th>거래형태</th><th>메모코드</th><th>상태</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <script>window.onload=()=>{window.print();window.close()}<\/script>
</body>
</html>`)
  win.document.close()
}