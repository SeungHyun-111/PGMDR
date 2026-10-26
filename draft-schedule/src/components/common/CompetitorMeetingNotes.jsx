import { useEffect, useMemo, useRef, useState } from 'react'
import dayjs from 'dayjs'
import { organizationKey, saveCompetitorMeeting, subscribeCompetitorMeetings } from '../../api/competitorMeetings'
import { fetchMeetingShares, getWeeklyOrganizationShare } from '../../api/competitorMeetingShares'
import { cachedMeetingOrganizations, meetingDraftKey, readMeetingDraft } from '../../utils/competitorMeetingDraft'
import useLocalStorageState from '../../hooks/useLocalStorageState'

function OrganizationEditor({ week, organization, company, note, userName, draftMode, onSaved }) {
  const draftKey = meetingDraftKey(userName, week, organization, company)
  const [draft, setDraft] = useState(() => draftMode ? readMeetingDraft(draftKey) : null)
  const [status, setStatus] = useState('')
  const pending = useRef(null)
  const timer = useRef(null)
  const mounted = useRef(true)
  const sequence = useRef(0)
  const flush = (commit = false) => {
    if (draftMode && !commit) return
    clearTimeout(timer.current)
    const edit = pending.current
    if (!edit) return
    pending.current = null
    if (mounted.current) setStatus('저장 중…')
    saveCompetitorMeeting(week, organization, company, edit.content, edit.userName).then(() => {
      if (!mounted.current || sequence.current !== edit.sequence) return
      if (draftMode) {
        try { localStorage.removeItem(draftKey) } catch { /* Keep the saved text available if storage is unavailable. */ }
      }
      setDraft(null)
      setStatus('저장됨')
      if (draftMode) onSaved?.()
    }).catch(error => {
      if (mounted.current && sequence.current === edit.sequence) setStatus(`저장 실패 · ${error.message}`)
    })
  }
  const flushRef = useRef(flush)
  useEffect(() => { flushRef.current = flush })
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; flushRef.current() }
  }, [])
  return <section className="competitor-organization-note competitor-meeting-cell-editor">
    <textarea aria-label={`${organization} ${company} 회의자료`} placeholder={`${organization} · ${company} 회의자료를 작성해주세요.`} value={draft ?? note?.content ?? ''}
      onChange={event => {
        const content = event.target.value
        setDraft(content)
        pending.current = { content, userName, sequence: ++sequence.current }
        clearTimeout(timer.current)
        if (draftMode) {
          try { localStorage.setItem(draftKey, JSON.stringify(content)); setStatus('브라우저 임시 저장됨') }
          catch { setStatus('임시 저장 실패 · 브라우저 저장 공간을 확인해주세요.') }
        } else {
          setStatus('저장 대기…')
          timer.current = setTimeout(() => flushRef.current(), 600)
        }
      }} onBlur={() => { if (!draftMode) flush() }} />
    <button className="competitor-meeting-save" type="button" aria-label={`${organization} ${company} 저장`} title={status.includes('저장 실패') ? status : note?.updatedBy ? `마지막 작성: ${note.updatedBy}` : '저장'} disabled={status === '저장 중…'} onClick={() => {
      pending.current = { content: draft ?? note?.content ?? '', userName, sequence: ++sequence.current }
      flush(true)
    }}>저장</button>
    {status.includes('저장 실패') && <span className="competitor-meeting-save-error" role="alert">{status}</span>}
  </section>
}

function CompanyShare({ company, organization, summary }) {
  if (!summary) return <>{company}<small>비중 조회 중…</small></>
  if (summary.error) return <>{company}<small title={summary.error}>비중 조회 실패</small></>
  const share = getWeeklyOrganizationShare(summary, organization)
  const ratio = share.current === null ? '데이터 없음' : `${share.current.toFixed(1)}%`
  const difference = share.difference === null ? '비교 불가' : `${share.difference > 0 ? '+' : ''}${share.difference.toFixed(1)}%p`
  const changeClass = share.difference > 0 ? 'meeting-change-positive' : share.difference < 0 ? 'meeting-change-negative' : ''
  return <span className="meeting-company-summary" title="금주 조직 가중분 ÷ 해당 경쟁사 전체 가중분 × 100 · 직전 주 대비 편성비중 차이">{company}({ratio} <span className={changeClass}>{difference}</span>)</span>
}

export default function CompetitorMeetingNotes({ week, organizations, userName, revision = 0, draftMode = false, onSaved, currentCompany, currentRows, currentRowsReady = true }) {
  const [notes, setNotes] = useState(null)
  const [error, setError] = useState('')
  const [shareResult, setShareResult] = useState(null)
  const [storedOrganization, setSelectedOrganization] = useLocalStorageState(`pgmdr:competitor-meeting-organization:v1:${encodeURIComponent(userName || '')}`, '')
  const selectedOrganization = typeof storedOrganization === 'string' ? storedOrganization : ''
  const [cachedOrganizations] = useState(() => draftMode ? cachedMeetingOrganizations(userName, week) : [])
  const shareKey = `${week}-${revision}-${currentCompany || ''}`
  const summaries = shareResult?.key === shareKey ? shareResult.summaries : null
  useEffect(() => {
    if (!week || !currentRowsReady) return
    const controller = new AbortController()
    Promise.all(['SSG', 'K'].map(async company => {
      try { return [company, await fetchMeetingShares(company, week, controller.signal, { company: currentCompany, rows: currentRows })] }
      catch (error) { return [company, { error: error.message }] }
    })).then(entries => {
      if (!controller.signal.aborted) setShareResult({ key: shareKey, summaries: Object.fromEntries(entries) })
    })
    return () => controller.abort()
  }, [week, shareKey, currentCompany, currentRows, currentRowsReady])
  useEffect(() => {
    if (!week) return
    return subscribeCompetitorMeetings(week, setNotes, error => setError(`회의자료를 불러오지 못했습니다. ${error.message}`))
  }, [week])
  const names = useMemo(() => [...new Set([...organizations, ...cachedOrganizations, ...(draftMode && selectedOrganization ? [selectedOrganization] : []), ...Object.values(notes || {}).map(note => note.organization).filter(Boolean), ...Object.values(summaries || {}).flatMap(summary => [...Object.keys(summary.current?.organizations || {}), ...Object.keys(summary.previous?.organizations || {})])])].sort((a, b) => a.localeCompare(b, 'ko')), [organizations, cachedOrganizations, draftMode, selectedOrganization, notes, summaries])
  const selected = names.includes(selectedOrganization) ? selectedOrganization : names[0] || ''
  const visibleNames = draftMode ? names.filter(name => name === selected) : names
  return <section className="competitor-meeting-panel" aria-label="조직별 회의자료 작성">
    <div className="competitor-meeting-heading"><h3>{draftMode ? '회의자료 입력' : '조직별 회의자료'}</h3>
      {draftMode && <label className="competitor-meeting-org-picker">조직명 <select aria-label="회의자료 입력 조직명" value={selected} onChange={event => setSelectedOrganization(event.target.value)}>{names.map(name => <option key={name} value={name}>{name}</option>)}</select></label>}
      <span>{week ? `${dayjs(week).format('YYYY년 M월 D일')} 주차` : '주차 선택'}</span><span>{draftMode ? '브라우저 임시 저장 · 저장 시 회의자료에 반영' : '입력 후 자동 저장'}</span>
    </div>
    {error && <p role="alert">{error}</p>}
    {!notes && !error && <p role="status">회의자료를 불러오는 중…</p>}
    {notes && !error && <div className="competitor-meeting-table-scroll"><table className="competitor-meeting-table">
      <colgroup><col className="meeting-org-column" /><col className="meeting-company-column" /><col /></colgroup>
      <thead><tr><th scope="col">조직명</th><th scope="col">경쟁사</th><th scope="col">내용</th></tr></thead>
      {visibleNames.map(organization => {
      const record = notes[organizationKey(organization)]
      return <tbody key={organization} aria-label={`${organization} 회의자료`}>{['SSG', 'K'].map((company, index) => <tr key={company}>
        {index === 0 && <th scope="rowgroup" rowSpan={2}>{organization}{record?.content && <details className="competitor-meeting-legacy"><summary>기존 공통 작성 내용</summary><p>{record.content}</p></details>}</th>}
        <th scope="row"><CompanyShare company={company} organization={organization} summary={summaries?.[company]} /></th>
        <td><OrganizationEditor key={`${userName}-${draftMode}`} week={week} organization={organization} company={company} note={record?.channels?.[company]} userName={userName} draftMode={draftMode} onSaved={onSaved} /></td>
      </tr>)}</tbody>
    })}</table></div>}
    {notes && !names.length && <p>현재 주차에 조직 정보가 없습니다. 편성표 데이터를 불러온 후 확인해주세요.</p>}
  </section>
}
