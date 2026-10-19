import { useMemo, useState } from 'react'
import { db, ref, push, set } from '../api/firebase'
import useCultureCodeMaster from '../hooks/useCultureCodeMaster'
import PromotionCodeInput from '../components/common/PromotionCodeInput'

export default function PromotionProductsTab({ promotions, loaded, loadError }) {
  const { codes, error: codeError, loaded: codesLoaded, refreshing, refresh, refreshError } = useCultureCodeMaster()
  const [refreshMessage, setRefreshMessage] = useState('')
  const refreshCodes = async () => {
    setRefreshMessage('')
    const count = await refresh()
    if (count !== null) setRefreshMessage(`편성코드 ${count.toLocaleString()}개 갱신 완료 · BO여부 반영`)
  }
  const boCodes = useMemo(() => new Set(codes.map(item => item.code.trim())), [codes])
  const [selectedId, setSelectedId] = useState('')
  const selectedIndex = promotions.findIndex(([id]) => id === selectedId)
  const selected = selectedIndex >= 0 ? promotions[selectedIndex] : null
  return (
    <div className="promotion-products">
      <div className="promotion-products-heading">
        <h2>프로모션 상품</h2>
        <button type="button" onClick={refreshCodes} disabled={refreshing}>{refreshing ? '원본 → DB 갱신 중…' : '편성코드 DB 업데이트'}</button>
      </div>
      {refreshMessage && <p className="promotion-code-refresh-message" role="status">{refreshMessage}</p>}
      {refreshError && <p className="promotion-products-error" role="alert">{refreshError}</p>}
      <p className="promotion-products-description">프로모션별 적용 상품의 편성코드명만 입력하세요. No는 자동으로 매겨지며 전체 세션에 공유됩니다.</p>
      <div className="promotion-product-selector">
        <label htmlFor="promotion-product-selection">프로모션명</label>
        <select id="promotion-product-selection" value={selected ? selectedId : ''} onChange={event => setSelectedId(event.target.value)} disabled={!loaded || !promotions.length}>
          <option value="">프로모션을 선택하세요</option>
          {promotions.map(([id, promotion], index) => <option key={id} value={id}>{promotion.name || `프로모션 ${index + 1} (이름 미입력)`}</option>)}
        </select>
      </div>
      {loadError && <p role="alert" className="promotion-products-error">{loadError}</p>}
      {codeError && <p role="alert" className="promotion-products-error">{codeError} 직접 입력은 가능합니다.</p>}
      {!promotions.length && <div className="promotion-products-empty">{!loaded ? '프로모션을 불러오는 중입니다.' : '프로모션 설정 탭에서 프로모션을 먼저 추가해주세요.'}</div>}
      {promotions.length > 0 && !selected && <div className="promotion-products-empty">위에서 프로모션을 선택하면 적용 상품을 입력할 수 있습니다.</div>}
      {selected && <PromotionProductGroup key={selected[0]} id={selected[0]} promotion={selected[1]} index={selectedIndex} loaded={loaded} codes={codes} boCodes={boCodes} codesLoaded={codesLoaded} codeError={codeError} />}
    </div>
  )
}

function PromotionProductGroup({ id, promotion, index, loaded, codes, boCodes, codesLoaded, codeError }) {
  const [adding, setAdding] = useState(false)
  const [boFilter, setBoFilter] = useState('')
  const [error, setError] = useState('')
  const path = `global/promotions/${id}/products`
  const products = Object.entries(promotion.products || {}).sort(([a], [b]) => a.localeCompare(b))
  const visibleProducts = products.map(([productId, product], index) => ({ productId, product, number: index + 1 }))
    .filter(({ product }) => !boFilter || (codesLoaded && !codeError && product.pgmCodeName?.trim() && (boCodes.has(product.pgmCodeName.trim()) ? 'Y' : 'N') === boFilter))
  const addProduct = async () => {
    setAdding(true)
    try {
      await set(push(ref(db, path)), { pgmCodeName: '', createdAt: Date.now() })
      setBoFilter('')
      setError('')
    } catch {
      setError('상품 행을 추가하지 못했습니다. 다시 시도해주세요.')
    } finally {
      setAdding(false)
    }
  }
  return (
    <article className="promotion-product-group">
      <header>
        <div>
          <h3>{promotion.name || `프로모션 ${index + 1} (이름 미입력)`} <span>{products.length}개</span></h3>
          <p>{promotion.startDate || '시작일 미설정'} ~ {promotion.endDate || '종료일 미설정'}</p>
        </div>
        <div className="promotion-product-actions">
          <label>BO여부
            <select aria-label="BO여부 필터" value={boFilter} onChange={event => setBoFilter(event.target.value)} disabled={!codesLoaded || !!codeError}>
              <option value="">전체</option>
              <option value="Y">Y</option>
              <option value="N">N</option>
            </select>
          </label>
          <span className="promotion-product-filter-count" role="status">{boFilter ? `BO ${boFilter} ${visibleProducts.length}개 / 전체 ${products.length}개` : `전체 ${products.length}개`}</span>
          <button type="button" onClick={addProduct} disabled={!loaded || adding}>{adding ? '추가 중…' : '+ 상품 추가'}</button>
        </div>
      </header>
      {error && <p role="alert" className="promotion-products-error">{error}</p>}
      <div className="promotion-products-table-wrap">
        <table className="promotion-table promotion-products-table">
          <colgroup><col style={{ width: 80 }} /><col /><col style={{ width: 110 }} /><col style={{ width: 90 }} /></colgroup>
          <thead><tr><th>No</th><th>편성코드명</th><th>BO여부</th><th>관리</th></tr></thead>
          <tbody>
            {visibleProducts.map(({ productId, product, number }) => <ProductRow key={productId} path={`${path}/${productId}`} product={product} number={number} codes={codes} boCodes={boCodes} codesLoaded={codesLoaded} codeError={codeError} />)}
            {!visibleProducts.length && <tr><td colSpan={4} className="promotion-products-empty">{products.length ? '선택한 BO여부에 해당하는 상품이 없습니다.' : '상품 추가 버튼을 눌러 편성코드명을 입력하세요.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </article>
  )
}

function ProductRow({ path, product, number, codes, boCodes, codesLoaded, codeError }) {
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const currentCode = (draft ?? product.pgmCodeName ?? '').trim()
  const boStatus = !currentCode ? '—' : codeError ? '확인 불가' : !codesLoaded ? '확인 중…' : boCodes.has(currentCode) ? 'Y' : 'N'
  const save = async text => {
    if (text === (product.pgmCodeName || '')) { setDraft(current => current === text ? null : current); return }
    try {
      await set(ref(db, `${path}/pgmCodeName`), text)
      setDraft(current => current === text ? null : current)
      setError('')
    } catch {
      setError('저장하지 못했습니다. 입력칸에서 이동하면 다시 저장합니다.')
    }
  }
  const remove = async () => {
    if (!window.confirm('이 적용 상품을 삭제할까요?')) return
    setDeleting(true)
    try {
      await set(ref(db, path), null)
    } catch {
      setError('삭제하지 못했습니다. 다시 시도해주세요.')
      setDeleting(false)
    }
  }
  return (
    <tr className={boStatus === 'N' ? 'promotion-product-no-bo' : undefined}>
      <td className="promotion-product-no">{number}</td>
      <td>
        <PromotionCodeInput label={`${number}번 편성코드명`} value={draft ?? product.pgmCodeName ?? ''} onChange={setDraft} onSave={save} codes={codes} />
        {error && <p role="alert" className="promotion-products-error">{error}</p>}
      </td>
      <td>{boStatus}</td>
      <td><button type="button" className="promotion-product-delete" onClick={remove} disabled={deleting}>{deleting ? '삭제 중' : '삭제'}</button></td>
    </tr>
  )
}
