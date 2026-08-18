/**
 * Runtime configuration.
 *
 * Only genuinely public values live in VITE_* variables. The Supabase anon key
 * is safe to ship because every table is protected by Row Level Security; the
 * service-role key exists nowhere in this codebase.
 *
 * Cloudinary is deliberately absent: the browser receives a signed, short-lived
 * upload policy from the API per file, so no storage credential is bundled.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    // Failing loudly at boot beats a hundred confusing 401s later.
    throw new Error(
      `Missing ${name}. Copy .env.example to .env and fill it in before starting the app.`
    )
  }
  return value
}

export const config = {
  supabase: {
    url: required('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL),
    anonKey: required('VITE_SUPABASE_ANON_KEY', import.meta.env.VITE_SUPABASE_ANON_KEY),
  },
  api: {
    // Same-origin in production; Vite proxies this to the Worker in development.
    baseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
  },
  app: {
    name: 'Zefinoro',
    defaultCurrency: 'INR',
    storageKeys: {
      theme: 'zefinoro-theme',
      workspace: 'zefinoro-workspace-id',
    },
  },
} as const

export const CURRENCIES = [
  { code: 'INR', label: 'Indian Rupee', symbol: '₹' },
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
  { code: 'AED', label: 'UAE Dirham', symbol: 'AED' },
  { code: 'SGD', label: 'Singapore Dollar', symbol: 'S$' },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', label: 'Canadian Dollar', symbol: 'C$' },
  { code: 'JPY', label: 'Japanese Yen', symbol: '¥' },
] as const

export const PERIOD_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_year', label: 'This year' },
  { value: '12m', label: 'Last 12 months' },
  { value: 'custom', label: 'Custom range' },
] as const

export type PeriodValue = (typeof PERIOD_OPTIONS)[number]['value']
