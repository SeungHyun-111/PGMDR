export default function PromotionChangeValue({ children }) {
  const value = Number.parseFloat(String(children).replaceAll(',', ''))
  const tone = value > 0 ? 'is-positive' : value < 0 ? 'is-negative' : ''
  return <span className={`promotion-change-value ${tone}`}>{children}</span>
}
