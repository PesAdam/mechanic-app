import { useNavigate } from 'react-router'

/** Zákazka (1a) ⇄ Denník (1b): two views of the same job. */
export default function JobViewSwitch({ id, view }: { id: number; view: 'detail' | 'diary' }) {
  const nav = useNavigate()
  return (
    <div className="seg" style={{ alignSelf: 'flex-start' }} role="tablist" aria-label="Zobrazenie zákazky">
      <label className="seg-opt">
        <input type="radio" name="job-view" checked={view === 'detail'} onChange={() => nav(`/m/zakazky/${id}`)} />Zákazka
      </label>
      <label className="seg-opt">
        <input type="radio" name="job-view" checked={view === 'diary'} onChange={() => nav(`/m/zakazky/${id}/dennik`)} />Denník
      </label>
    </div>
  )
}
