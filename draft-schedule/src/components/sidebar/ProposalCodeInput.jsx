import PromotionCodeInput from '../common/PromotionCodeInput'
import useCultureCodeMaster from '../../hooks/useCultureCodeMaster'
import { proposalCodePatch } from '../../utils/proposalDefaults'
import './ProposalCodeInput.css'

export default function ProposalCodeInput({ value, setForm, teamOptions, inputStyle }) {
  const { codes, loaded, error } = useCultureCodeMaster()
  return <>
    <PromotionCodeInput value={value} codes={codes} label="편성코드명" inputStyle={inputStyle}
      onChange={text => setForm(previous => ({ ...previous, ...proposalCodePatch(text, codes, teamOptions) }))}
      onSave={() => {}} />
    <small style={{ color: 'var(--text3)', fontSize: 10 }} role="status">
      {error ? `${error} 직접 입력은 가능합니다.` : !loaded ? '편성코드 목록을 불러오는 중입니다.' : '검색 후 선택 · ↑↓ 이동 · Enter/Tab 자동완성'}
    </small>
  </>
}
