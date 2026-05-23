import { useMemo, useState } from 'react'

const CH_ORDER = ['CA', 'IP', 'ALL']
const CH_BG    = { CA: 'var(--ca)', IP: 'var(--ip)', ALL: 'var(--all)' }
const CH_TEXT  = { CA: 'var(--ca-t)', IP: 'var(--ip-t)', ALL: 'var(--all-t)' }
const DT_ORDER = ['[위]', '[직]', '[혼]', '[모]', '[액]', '[률]']
const VS_ORDER = ['기존', '재녹화', '재편집', '신상품']

const ROW_OPTS = [
  { key: 'team',     label: '팀별' },
  { key: 'category', label: '카테고리별' },
]

function getRowKey(b, rowType) {
  return rowType === 'category'
    ? (b.mdCategory || '미분류')
    : (b.mdTeam || b.orgName || '미지정')
}

function getExpected(b, perfMap, manualInputs) {
  const key = b.perfKey
  if (!key) return { sp: 0, pp: 0, hasPerf: false }
  const m  = manualInputs?.[key] || {}
  const p  = perfMap?.[key]      || {}
  const sp = Number(m.expectedSalesPerWeightedMin  ?? p.salesPerWeightedMin  ?? 0)
  const pp = Number(m.expectedProfitPerWeightedMin ?? p.profitPerWeightedMin ?? 0)
  return { sp, pp, hasPerf: sp > 0 || pp > 0 }
}

// 셀 — 항상 동일 2줄, 중앙 정렬
function Cell({ count, wm, avgSp, avgPp, perfCount, showPerf }) {
  const empty = count === 0
  return (
    <div style={{ textAlign: 'center', lineHeight: 1.6 }}>
      <div style={{ fontWeight: 700, fontSize: 12, color: empty ? 'var(--border2)' : 'var(--text)' }}>
        {empty ? '-' : `${count}건`}
      </div>
      <div style={{ fontSize: 9, color: 'var(--text3)' }}>
        {empty ? ' ' : `${wm.toLocaleString()}분`}
      </div>
      {showPerf && (
        <div style={{ fontSize: 9, color: avgSp > 0 || avgPp > 0 ? 'var(--green)' : 'var(--border2)', fontWeight: avgSp > 0 ? 600 : 400 }}>
          {empty
            ? ' '
            : avgSp > 0 || avgPp > 0
              ? `${avgSp.toLocaleString()} / ${avgPp.toLocaleString()}`
              : '-'
          }
        </div>
      )}
    </div>
  )
}

function PgmCard({ title, colLabel, colKeyFn, colRenderer, blocks, rowType, perfMap, manualInputs }) {
  const { pivot, rowOrder, allCols, colTotals, grand, showPerf } = useMemo(() => {
    const piv = {}

    blocks.forEach(b => {
      const rk = getRowKey(b, rowType)
      const ck = colKeyFn(b)
      if (!piv[rk])     piv[rk]     = {}
      if (!piv[rk][ck]) piv[rk][ck] = { count: 0, wm: 0, perfWm: 0, sales: 0, profit: 0, perfCount: 0 }
      const { sp, pp, hasPerf } = getExpected(b, perfMap, manualInputs)
      const wm = b.weightedMin || 0
      piv[rk][ck].count  += 1
      piv[rk][ck].wm     += wm
      if (hasPerf) {
        piv[rk][ck].perfWm    += wm
        piv[rk][ck].sales     += wm * sp
        piv[rk][ck].profit    += wm * pp
        piv[rk][ck].perfCount += 1
      }
    })

    const present = new Set(Object.values(piv).flatMap(r => Object.keys(r)))
    const extra   = [...present].filter(k => !colLabel.includes(k))
    const allCols = [...colLabel.filter(c => present.has(c)), ...extra]

    const rowOrder = Object.keys(piv).sort((a, b) =>
      Object.values(piv[b]).reduce((s, v) => s + v.count, 0) -
      Object.values(piv[a]).reduce((s, v) => s + v.count, 0)
    )

    const sum = (col, key) => rowOrder.reduce((s, r) => s + (piv[r]?.[col]?.[key] || 0), 0)
    const colTotals = allCols.map(c => {
      const count = sum(c, 'count'), wm = sum(c, 'wm'), perfWm = sum(c, 'perfWm')
      const sales = sum(c, 'sales'), profit = sum(c, 'profit'), perfCount = sum(c, 'perfCount')
      return { count, wm, perfWm, sales, profit, perfCount,
        avgSp: perfWm > 0 ? Math.round(sales  / perfWm) : 0,
        avgPp: perfWm > 0 ? Math.round(profit / perfWm) : 0,
      }
    })

    const grandCount = colTotals.reduce((s, t) => s + t.count, 0)
    const grandWm    = colTotals.reduce((s, t) => s + t.wm, 0)
    const grandPerfWm    = colTotals.reduce((s, t) => s + t.perfWm, 0)
    const grandSales     = colTotals.reduce((s, t) => s + t.sales, 0)
    const grandProfit    = colTotals.reduce((s, t) => s + t.profit, 0)
    const grandPerfCount = colTotals.reduce((s, t) => s + t.perfCount, 0)
    const grand = {
      count: grandCount, wm: grandWm, perfCount: grandPerfCount,
      avgSp: grandPerfWm > 0 ? Math.round(grandSales  / grandPerfWm) : 0,
      avgPp: grandPerfWm > 0 ? Math.round(grandProfit / grandPerfWm) : 0,
    }

    const showPerf = grandSales > 0 || grandProfit > 0

    return { pivot: piv, rowOrder, allCols, colTotals, grand, showPerf }
  }, [blocks, rowType, perfMap, manualInputs, colLabel, colKeyFn])

  // 행별 합산
  function rowSum(row) {
    const count = allCols.reduce((s, c) => s + (pivot[row]?.[c]?.count     || 0), 0)
    const wm    = allCols.reduce((s, c) => s + (pivot[row]?.[c]?.wm        || 0), 0)
    const perfWm  = allCols.reduce((s, c) => s + (pivot[row]?.[c]?.perfWm   || 0), 0)
    const sales   = allCols.reduce((s, c) => s + (pivot[row]?.[c]?.sales    || 0), 0)
    const profit  = allCols.reduce((s, c) => s + (pivot[row]?.[c]?.profit   || 0), 0)
    const perfCount = allCols.reduce((s, c) => s + (pivot[row]?.[c]?.perfCount || 0), 0)
    return { count, wm, perfCount, avgSp: perfWm > 0 ? Math.round(sales / perfWm) : 0, avgPp: perfWm > 0 ? Math.round(profit / perfWm) : 0 }
  }

  const th = {
    padding: '8px 12px',
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text)',
    textAlign: 'center',
    background: 'var(--bg4)',
    borderBottom: '2px solid var(--accent)',
    borderRight: '1px solid var(--border)',
    whiteSpace: 'nowrap',
    letterSpacing: '0.02em',
  }

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      {/* 카드 헤더 */}
      <div style={{ padding: '12px 16px', background: 'var(--bg3)', borderBottom: '2px solid var(--accent)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: showPerf ? 5 : 0 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>{title}</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>{grand.count}</span>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>건</span>
        </div>
        {showPerf && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700 }}>
              취급/분 {grand.avgSp.toLocaleString()} · 이익/분 {grand.avgPp.toLocaleString()}
            </span>
            <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>
              실적 입력 {grand.perfCount}건 기준
            </span>
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>
              / 미입력 {grand.count - grand.perfCount}건
            </span>
          </div>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left', paddingLeft: 16, minWidth: 80 }}>
                {rowType === 'team' ? '팀' : '카테고리'}
              </th>
              {allCols.map(c => (
                <th key={c} style={{ ...th, minWidth: 90 }}>
                  {colRenderer ? colRenderer(c) : c}
                </th>
              ))}
              <th style={{ ...th, background: 'rgba(74,108,247,.18)', color: 'var(--accent)', borderRight: 'none' }}>합계</th>
            </tr>
          </thead>
          <tbody>
            {rowOrder.map((row, i) => {
              const rs     = rowSum(row)
              const stripe = i % 2 === 1 ? 'var(--bg3)' : 'transparent'
              const cell   = col => {
                const d = pivot[row]?.[col]
                if (!d) return { count: 0, wm: 0, perfCount: 0, avgSp: 0, avgPp: 0 }
                const avgSp = d.perfWm > 0 ? Math.round(d.sales  / d.perfWm) : 0
                const avgPp = d.perfWm > 0 ? Math.round(d.profit / d.perfWm) : 0
                return { count: d.count, wm: d.wm, perfCount: d.perfCount, avgSp, avgPp }
              }
              return (
                <tr key={row} style={{ borderBottom: '1px solid var(--border)', background: stripe }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(74,108,247,.07)'}
                  onMouseLeave={e => e.currentTarget.style.background = stripe}>
                  <td style={{ padding: '6px 16px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', verticalAlign: 'middle', borderRight: '2px solid var(--border)' }}>
                    {row}
                  </td>
                  {allCols.map(c => (
                    <td key={c} style={{ padding: '4px 8px', verticalAlign: 'middle', borderRight: '1px solid var(--border)' }}>
                      <Cell {...cell(c)} showPerf={showPerf} />
                    </td>
                  ))}
                  <td style={{ padding: '4px 8px', verticalAlign: 'middle', background: 'rgba(74,108,247,.06)' }}>
                    <Cell count={rs.count} wm={rs.wm} perfCount={rs.perfCount} avgSp={rs.avgSp} avgPp={rs.avgPp} showPerf={showPerf} />
                  </td>
                </tr>
              )
            })}

            {/* 합계 */}
            <tr style={{ borderTop: '2px solid var(--accent)', background: 'var(--bg4)' }}>
              <td style={{ padding: '6px 16px', fontWeight: 800, fontSize: 11, color: 'var(--text)', borderRight: '2px solid var(--border)' }}>합 계</td>
              {colTotals.map((t, i) => (
                <td key={i} style={{ padding: '4px 8px', verticalAlign: 'middle', borderRight: '1px solid var(--border)' }}>
                  <Cell count={t.count} wm={t.wm} perfCount={t.perfCount} avgSp={t.avgSp} avgPp={t.avgPp} showPerf={showPerf} />
                </td>
              ))}
              <td style={{ padding: '4px 8px', verticalAlign: 'middle', background: 'rgba(74,108,247,.08)' }}>
                <Cell count={grand.count} wm={grand.wm} perfCount={grand.perfCount} avgSp={grand.avgSp} avgPp={grand.avgPp} showPerf={showPerf} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function RatioPgmCount({ enrichedBlocks, perfMap, manualInputs }) {
  const [open,    setOpen]    = useState(true)
  const [rowType, setRowType] = useState('team')

  const blocks = useMemo(
    () => Object.values(enrichedBlocks).filter(b => b && !b.isDefault),
    [enrichedBlocks]
  )

  const btn = active => ({
    padding: '4px 12px', borderRadius: 5, fontSize: 11, cursor: 'pointer',
    border: '1px solid var(--border)',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--text3)',
    fontWeight: active ? 700 : 400,
  })

  return (
    <div style={{ marginTop: 20, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{ padding: '9px 16px', background: 'var(--bg2)', borderBottom: open ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontSize: 11, fontWeight: 700 }}>PGM 건수 현황</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)' }}>{blocks.length}</span>
        <span style={{ fontSize: 10, color: 'var(--text3)' }}>건</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ padding: '12px 16px', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--text3)', marginRight: 2 }}>행</span>
            {ROW_OPTS.map(o => (
              <button key={o.key} onClick={() => setRowType(o.key)} style={btn(rowType === o.key)}>{o.label}</button>
            ))}
          </div>

          <PgmCard title="채널별"    colLabel={CH_ORDER}  colKeyFn={b => CH_ORDER.includes(b.channel) ? b.channel : 'ALL'}
            colRenderer={c => <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 3, fontWeight: 700, background: CH_BG[c] || 'var(--bg4)', color: CH_TEXT[c] || 'var(--text)' }}>{c}</span>}
            blocks={blocks} rowType={rowType} perfMap={perfMap} manualInputs={manualInputs} />

          <PgmCard title="거래형태별" colLabel={DT_ORDER}  colKeyFn={b => b.dealTypeConverted || b.dealType || '미지정'}
            colRenderer={null} blocks={blocks} rowType={rowType} perfMap={perfMap} manualInputs={manualInputs} />

          <PgmCard title="영상구분별" colLabel={VS_ORDER}  colKeyFn={b => b.newProductType || '기존'}
            colRenderer={null} blocks={blocks} rowType={rowType} perfMap={perfMap} manualInputs={manualInputs} />
        </div>
      )}
    </div>
  )
}
