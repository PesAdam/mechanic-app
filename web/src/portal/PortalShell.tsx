import { useEffect } from 'react'
import { Outlet } from 'react-router'

const PORTAL = { manifest: '/portal.webmanifest', title: 'Požiadavky do dielne', appTitle: 'Požiadavky' }

/**
 * The portal pages as their own app: "Pridať na plochu" / install takes the start page from the manifest, and the
 * shop's manifest starts at /m (the workshop). Swapped here in the page rather than on the server, because after
 * the first visit the service worker serves the cached index.html with the shop's manifest in it.
 */
export default function PortalShell() {
  useEffect(() => {
    const head = document.head
    let link = head.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    const added = !link
    if (!link) {
      link = document.createElement('link')
      link.rel = 'manifest'
      head.appendChild(link)
    }
    const appTitle = head.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]')
    const before = { manifest: link.getAttribute('href'), title: document.title, appTitle: appTitle?.content }

    link.setAttribute('href', PORTAL.manifest)
    document.title = PORTAL.title
    if (appTitle) appTitle.content = PORTAL.appTitle

    return () => {
      if (added) link.remove()
      else if (before.manifest) link.setAttribute('href', before.manifest)
      document.title = before.title
      if (appTitle && before.appTitle !== undefined) appTitle.content = before.appTitle
    }
  }, [])

  return <Outlet />
}
