/**
 * CSV the way Slovak Excel opens it with a double-click: `;` between fields, decimal comma,
 * and a BOM so the diacritics survive.
 */
export type Cell = string | number | null

const field = (v: Cell): string => {
  if (v === null) return ''
  const s = typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ',')) : v
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const toCsv = (rows: Cell[][]): string => '﻿' + rows.map(r => r.map(field).join(';')).join('\r\n') + '\r\n'

export function downloadCsv(name: string, rows: Cell[][]): void {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
