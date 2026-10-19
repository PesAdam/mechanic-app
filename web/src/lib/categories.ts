/** Operation categories in the order the app lists them; keys match Operation::CATEGORIES on the API. */
export const OPERATION_CATEGORIES: [string, string][] = [
  ['servis', 'Servis'], ['diagnostika', 'Diagnostika'], ['pneu', 'Pneumatiky a kolesá'], ['brzdy', 'Brzdy'],
  ['podvozok', 'Podvozok'], ['riadenie', 'Riadenie'], ['motor', 'Motor'], ['chladenie', 'Chladenie'],
  ['palivo', 'Palivová sústava'], ['vyfuk', 'Výfuk a emisie'], ['prevodovka', 'Prevodovka a pohon'],
  ['elektro', 'Elektro'], ['osvetlenie', 'Osvetlenie'], ['klima', 'Klimatizácia'], ['karoseria', 'Karoséria a sklá'], ['ine', 'Iné'],
]

const LABEL: Record<string, string> = Object.fromEntries(OPERATION_CATEGORIES)
const ORDER: Record<string, number> = Object.fromEntries(OPERATION_CATEGORIES.map(([k], i) => [k, i]))

export const categoryLabel = (c: string): string => LABEL[c] ?? c
/** Sort key so lists follow the catalogue order instead of the alphabet. */
export const categoryOrder = (c: string): number => ORDER[c] ?? OPERATION_CATEGORIES.length
