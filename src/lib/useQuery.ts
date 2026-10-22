import { useCallback, useEffect, useState } from 'react'

type Result = PromiseLike<{ data: unknown; error: { message: string } | null }>

export function useQuery<T>(fn: () => Result, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps)
  const reload = useCallback(async () => {
    const { data, error } = await run()
    if (error) setError(error.message); else { setError(null); setData(data as T | null) }
    setLoading(false)
  }, [run])
  useEffect(() => { setLoading(true); void reload() }, [reload])
  return { data, loading, error, reload }
}
