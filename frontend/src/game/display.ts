/** Device-level display preferences. They apply with or without an account. */

export type FontChoice = 'system' | 'rounded' | 'serif' | 'mono'
export type TapSplit = 'vertical' | 'horizontal'

export interface DisplaySettings {
  font: FontChoice
  /** Multiplier applied to the life total and other seat text. */
  fontScale: number
  /** Which way a seat is cut into minus/plus halves. */
  tapSplit: TapSplit
}

export const DEFAULT_DISPLAY: DisplaySettings = {
  font: 'system',
  fontScale: 1,
  tapSplit: 'vertical',
}

export const FONT_CHOICES: { value: FontChoice; label: string; stack: string; numerals: string }[] = [
  {
    value: 'system',
    label: 'System',
    stack: `ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif`,
    numerals: `ui-rounded, 'SF Pro Rounded', ui-sans-serif, system-ui, sans-serif`,
  },
  {
    value: 'rounded',
    label: 'Rounded',
    stack: `ui-rounded, 'SF Pro Rounded', 'Nunito', 'Segoe UI', system-ui, sans-serif`,
    numerals: `ui-rounded, 'SF Pro Rounded', 'Nunito', system-ui, sans-serif`,
  },
  {
    value: 'serif',
    label: 'Serif',
    stack: `ui-serif, Georgia, 'Times New Roman', serif`,
    numerals: `ui-serif, Georgia, 'Times New Roman', serif`,
  },
  {
    value: 'mono',
    label: 'Mono',
    stack: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`,
    numerals: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`,
  },
]

export const FONT_SCALES: { value: number; label: string }[] = [
  { value: 0.85, label: 'S' },
  { value: 1, label: 'M' },
  { value: 1.15, label: 'L' },
  { value: 1.3, label: 'XL' },
]

export function fontStacks(font: FontChoice) {
  return FONT_CHOICES.find((f) => f.value === font) ?? FONT_CHOICES[0]
}

/** Unknown values can arrive from an older persisted state; fall back cleanly. */
export function normalizeDisplay(input: Partial<DisplaySettings> | undefined): DisplaySettings {
  const font = FONT_CHOICES.some((f) => f.value === input?.font)
    ? (input!.font as FontChoice)
    : DEFAULT_DISPLAY.font
  const fontScale = FONT_SCALES.some((s) => s.value === input?.fontScale)
    ? (input!.fontScale as number)
    : DEFAULT_DISPLAY.fontScale
  const tapSplit: TapSplit = input?.tapSplit === 'horizontal' ? 'horizontal' : DEFAULT_DISPLAY.tapSplit
  return { font, fontScale, tapSplit }
}
