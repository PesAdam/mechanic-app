import { NavLink } from 'react-router'

/** Desktop-only bar: on a phone each screen is its own world. */
export default function TopBar() {
  return (
    <nav className="topbar no-print" aria-label="Sekcie">
      <NavLink to="/" end>Dielňa</NavLink>
      <NavLink to="/prehlad">Prehľad</NavLink>
    </nav>
  )
}
