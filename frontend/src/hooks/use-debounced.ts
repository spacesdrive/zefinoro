import { useEffect, useState } from 'react'

/**
 * Debounce a rapidly-changing value.
 *
 * Used for search inputs so a query is not issued on every keystroke.
 */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
