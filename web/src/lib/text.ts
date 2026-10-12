/** Slovak plural: 1 auto, 2–4 autá, 0/5+ áut. */
export const plural = (n: number, one: string, few: string, many: string) =>
  n === 1 ? one : n >= 2 && n <= 4 ? few : many

export const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s)
