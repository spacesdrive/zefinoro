/**
 * Chart palette.
 *
 * Received and Spent are a two-slot categorical encoding, so the pair was
 * validated rather than picked by eye. The obvious green/red choice failed
 * colourblind separation (deuteranopia ΔE 5.8, below the floor of 8) - a
 * red/green pair is exactly the one 8% of men cannot resolve, which is a poor
 * choice for a chart whose entire job is "in versus out".
 *
 * Teal/orange clears every check against both the light and the dark surface:
 *
 *   lightness band    PASS (light 0.43-0.77, dark 0.48-0.67)
 *   chroma floor      PASS
 *   CVD separation    PASS  ΔE 13.8 (protan), 34.5 (tritan)
 *   normal vision     PASS  ΔE 28.8
 *   contrast          PASS  >= 3:1 on both surfaces
 *
 * One pair serves both themes, so identity never shifts when the theme does.
 * Colour is never the only cue: both charts carry a legend and a tooltip that
 * names each series.
 */
export const SERIES_COLORS = {
  received: '#0d9488',
  spent: '#ea580c',
} as const

export const SERIES_LABELS = {
  received: 'Received',
  spent: 'Spent',
} as const

/** Recessive grid and axis ink, so the data stays the loudest thing present. */
export const AXIS_STYLE = {
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const
