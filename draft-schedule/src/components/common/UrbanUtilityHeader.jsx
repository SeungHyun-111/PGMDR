import '../../pages/PerformanceForecastUrban.css'
import '../../pages/UtilityPagesUrban.css'

export default function UrbanUtilityHeader({ title, subtitle, urban, setUrban }) {
  return <header className="utility-page-header"><div>{urban && <span>PGMDR WORKSPACE</span>}<h1>{title}</h1><p>{subtitle}</p></div><div className="forecast-mode-switch" aria-label={`${title} 테마`}>{[true,false].map(value=><button key={String(value)} type="button" aria-pressed={urban===value} onClick={()=>setUrban(value)}>{value?'Urban':'기본'}</button>)}</div></header>
}
