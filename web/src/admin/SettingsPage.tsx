import { useState, type FormEvent } from 'react'
import { useSettings, useSettingsActions } from '../data/queries'
import { ApiError } from '../lib/api'
import type { Business, LaborBilling, ReportLabor } from '../lib/types'
import Blueprint, { Corners } from '../components/Blueprint'

const EMPTY: Business = { name: '', owner: '', street: '', city: '', phone: '', email: '', iban: '', ico: '', vat_payer: false }

export default function SettingsPage() {
  const settings = useSettings()
  // The form remounts with every saved change (it is keyed by the settings), so the "saved" note lives up here.
  const [saved, setSaved] = useState(false)
  const flashSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2500) }
  if (!settings.data) return <Blueprint style={{ padding: 16 }}><div className="muted" style={{ fontSize: 13 }}>{settings.isPending ? 'Načítavam nastavenia…' : 'Nastavenia sa nepodarilo načítať.'}</div></Blueprint>
  return <SettingsForm key={JSON.stringify(settings.data)} initial={settings.data.business} initialRate={settings.data.hourly_rate} initialBilling={settings.data.labor_billing} initialReportLabor={settings.data.report_labor ?? 'price'} saved={saved} onSaved={flashSaved} />
}

function SettingsForm({ initial, initialRate, initialBilling, initialReportLabor, saved, onSaved }: { initial: Business; initialRate: number; initialBilling: LaborBilling; initialReportLabor: ReportLabor; saved: boolean; onSaved: () => void }) {
  const { updateSettings } = useSettingsActions()
  const [b, setB] = useState<Business>({ ...EMPTY, ...initial })
  const [rate, setRate] = useState(String(initialRate))
  const [billing, setBilling] = useState<LaborBilling>(initialBilling)
  const [reportLabor, setReportLabor] = useState<ReportLabor>(initialReportLabor)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof Business) => (e: { target: { value: string } }) => setB(prev => ({ ...prev, [k]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const r = Number(rate.replace(',', '.'))
    if (!Number.isFinite(r) || r < 1 || r > 500) { setError('Sadzba musí byť medzi 1 a 500 €/h.'); return }
    setBusy(true)
    setError(null)
    try {
      await updateSettings({ hourly_rate: r, labor_billing: billing, report_labor: reportLabor, business: { ...b, name: b.name.trim() || 'NÁZOV' } })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nepodarilo sa uložiť.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-head"><div><div className="kicker">Firma a cenník</div><h1>Nastavenia</h1></div></div>
      <form onSubmit={submit} className="admin-page" style={{ gap: 18 }}>
        <Blueprint className="card" style={{ padding: '16px 18px', gap: 12, maxWidth: 800 }}>
          <span className="card-title">Údaje na doklade a reporte</span>
          <div className="settings-form">
            <div className="field wide"><label htmlFor="s-name">Názov dielne</label><input id="s-name" className="input" value={b.name} onChange={set('name')} placeholder="NÁZOV" /></div>
            <div className="field"><label htmlFor="s-owner">Meno (prevádzkovateľ)</label><input id="s-owner" className="input" value={b.owner} onChange={set('owner')} /></div>
            <div className="field"><label htmlFor="s-ico">IČO</label><input id="s-ico" className="input" value={b.ico} onChange={set('ico')} /></div>
            <div className="field"><label htmlFor="s-street">Ulica a číslo</label><input id="s-street" className="input" value={b.street} onChange={set('street')} /></div>
            <div className="field"><label htmlFor="s-city">PSČ a mesto</label><input id="s-city" className="input" value={b.city} onChange={set('city')} /></div>
            <div className="field"><label htmlFor="s-phone">Telefón</label><input id="s-phone" className="input" value={b.phone} onChange={set('phone')} /></div>
            <div className="field"><label htmlFor="s-email">E-mail</label><input id="s-email" className="input" type="email" value={b.email} onChange={set('email')} /></div>
            <div className="field wide"><label htmlFor="s-iban">IBAN (pre platbu na doklade)</label><input id="s-iban" className="input" value={b.iban} onChange={set('iban')} placeholder="SK.." /></div>
            <label className="radio wide" style={{ gap: 10 }}>
              <input type="checkbox" checked={b.vat_payer} onChange={e => setB(prev => ({ ...prev, vat_payer: e.target.checked }))} style={{ position: 'static', opacity: 1, width: 16, height: 16, pointerEvents: 'auto' }} />
              Som platiteľom DPH
            </label>
          </div>
        </Blueprint>

        <Blueprint className="card" style={{ padding: '16px 18px', gap: 12, maxWidth: 800 }}>
          <span className="card-title">Cenník</span>
          <div className="field" style={{ maxWidth: 220 }}><label htmlFor="s-rate">Hodinová sadzba práce (€/h)</label><input id="s-rate" className="input" inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} /></div>
          <div className="muted" style={{ fontSize: 12 }}>Sadzba sa použije pri výpočte práce na všetkých zákazkách vrátane už uzavretých.</div>
          <div className="field"><label>Účtovanie práce zákazníkovi</label>
            <div className="seg">
              <label className="seg-opt"><input type="radio" name="billing" checked={billing === 'actual'} onChange={() => setBilling('actual')} />Skutočný čas</label>
              <label className="seg-opt"><input type="radio" name="billing" checked={billing === 'norm'} onChange={() => setBilling('norm')} />Normohodiny</label>
            </div>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>Pri normohodinách sa práca účtuje ako súčet noriem úkonov na zákazke × sadzba; zákazka bez úkonov sa účtuje podľa skutočného času. Stopky vždy porovnávajú skutočný čas s normou.</div>
          <div className="field"><label>Práca na reporte pre zákazníka</label>
            <div className="seg">
              <label className="seg-opt"><input type="radio" name="report-labor" checked={reportLabor === 'price'} onChange={() => setReportLabor('price')} />Ceny úkonov</label>
              <label className="seg-opt"><input type="radio" name="report-labor" checked={reportLabor === 'time'} onChange={() => setReportLabor('time')} />Čas × sadzba</label>
              <label className="seg-opt"><input type="radio" name="report-labor" checked={reportLabor === 'total'} onChange={() => setReportLabor('total')} />Len spolu</label>
            </div>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            <b>Ceny úkonov</b> (odporúčané): každý úkon má na reporte svoju cenu, bez minút a bez sadzby – ako na faktúre zo servisu. <b>Čas × sadzba</b>: časy úkonov a „× {rate || '…'} €/h“. <b>Len spolu</b>: zoznam úkonov a jedna suma za prácu. Hodinová sadzba sa zákazníkovi posiela iba pri voľbe Čas × sadzba; v sadzbe sú aj náklady na priestory, náradie a materiál, čo laik na prvý pohľad nevidí.
          </div>
        </Blueprint>

        <div className="admin-actions">
          <button type="submit" className="btn btn-primary blueprint" style={{ minHeight: 40 }} disabled={busy}><Corners />{busy ? 'Ukladám…' : 'Uložiť nastavenia'}</button>
          {saved && <span className="ok-note">Uložené ✓</span>}
          {error && <span className="form-error">{error}</span>}
        </div>
      </form>
    </div>
  )
}
