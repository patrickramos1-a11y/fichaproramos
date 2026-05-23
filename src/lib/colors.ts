/**
 * Paleta determinística por id, em OKLCH. Usada como fallback de cor
 * para tipos / módulos / subgrupos / campos quando o usuário não definiu
 * cor manualmente.
 */

const PALETTE = [
  "oklch(0.72 0.15 30)",   // coral
  "oklch(0.72 0.14 60)",   // amber
  "oklch(0.74 0.14 110)",  // lime
  "oklch(0.70 0.14 150)",  // green
  "oklch(0.70 0.13 195)",  // teal
  "oklch(0.66 0.14 235)",  // sky
  "oklch(0.62 0.16 270)",  // indigo
  "oklch(0.66 0.18 305)",  // violet
  "oklch(0.70 0.17 340)",  // pink
  "oklch(0.66 0.10 20)",   // brown
];

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Cor determinística baseada em uma chave string (ex.: id de módulo). */
export function autoColor(key: string): string {
  return PALETTE[hash(key) % PALETTE.length];
}

/** Resolve cor: usa override do usuário se existir, senão autoColor. */
export function resolveColor(key: string, overrides?: Record<string, string>): string {
  return overrides?.[key] ?? autoColor(key);
}

/** Estilo inline pronto para um chip/borda colorido. */
export function colorStyle(key: string, overrides?: Record<string, string>) {
  const c = resolveColor(key, overrides);
  return { backgroundColor: c, color: "white" } as const;
}

/** Estilo de borda colorida (faixa lateral). */
export function borderStyle(key: string, overrides?: Record<string, string>) {
  return { borderLeft: `4px solid ${resolveColor(key, overrides)}` } as const;
}

export const PALETTE_PRESETS = PALETTE;