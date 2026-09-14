export function parseTargetMetrics(raw) {
  if (!raw) return { teamMap: {}, companyTotal: null }
  if (raw.sales && raw.profit) {
    const salesList = Array.isArray(raw.sales) ? raw.sales : []
    const profitList = Array.isArray(raw.profit) ? raw.profit : []
    const salesMap = {}
    const profitMap = {}
    salesList.forEach(row => { salesMap[String(row.name || '').trim()] = row.value || 0 })
    profitList.forEach(row => { profitMap[String(row.name || '').trim()] = row.value || 0 })

    const totalSales = salesList.find(row => row.isCompanyTotal)
    const totalProfit = profitList.find(row => row.isCompanyTotal)
    const companyTotal = (totalSales || totalProfit) ? {
      salesPerMin: totalSales?.value || 0,
      profitPerMin: totalProfit?.value || 0,
    } : null

    const teamMap = {}
    const allNames = new Set([...Object.keys(salesMap), ...Object.keys(profitMap)])
    allNames.forEach(name => {
      if (!name) return
      const entry = { salesPerMin: salesMap[name] || 0, profitPerMin: profitMap[name] || 0 }
      teamMap[name] = entry
      teamMap[name.endsWith('팀') ? name.slice(0, -1) : `${name}팀`] = entry
    })
    return { teamMap, companyTotal }
  }
  return { teamMap: {}, companyTotal: null }
}
