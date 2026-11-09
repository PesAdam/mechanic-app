import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import PortalShell from './PortalShell'

const manifest = () => document.head.querySelector('link[rel="manifest"]')?.getAttribute('href')

describe('PortalShell', () => {
  afterEach(() => { document.head.innerHTML = '' })

  it('makes "add to home screen" start at /portal and gives the shop its manifest back on leaving', () => {
    document.head.innerHTML = '<link rel="manifest" href="/manifest.webmanifest"><meta name="apple-mobile-web-app-title" content="Dielňa">'
    document.title = 'Dielňa · správa autoopráv'

    const { unmount } = render(<MemoryRouter initialEntries={['/portal']}><Routes><Route element={<PortalShell />}><Route path="/portal" element={<p>portál</p>} /></Route></Routes></MemoryRouter>)

    expect(manifest()).toBe('/portal.webmanifest')
    expect(document.title).toBe('Požiadavky do dielne')
    expect(document.head.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]')?.content).toBe('Požiadavky')

    unmount()
    expect(manifest()).toBe('/manifest.webmanifest')
    expect(document.title).toBe('Dielňa · správa autoopráv')
  })
})
