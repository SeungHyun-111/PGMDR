export function fitCalendarTooltip(element, anchor, boundary) {
  const margin = 8
  const bounds = boundary?.getBoundingClientRect() || { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight, width: window.innerWidth, height: window.innerHeight }
  element.style.maxWidth = `${Math.max(0, bounds.width - margin * 2)}px`
  element.style.maxHeight = `${Math.max(0, bounds.height - margin * 2)}px`
  const { width, height } = element.getBoundingClientRect()
  const left = anchor.right + width + margin * 2 <= bounds.right ? anchor.right + margin : anchor.left - width - margin
  element.style.left = `${Math.max(bounds.left + margin, Math.min(left, bounds.right - width - margin))}px`
  element.style.top = `${Math.max(bounds.top + margin, Math.min(anchor.top, bounds.bottom - height - margin))}px`
}
