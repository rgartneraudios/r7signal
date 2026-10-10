import { useCallback, useEffect, useState } from 'react'
import { routeForKey } from '../lib/webRoutes'

export function useWebRoute() {
  const [route, setRoute] = useState(() => routeForKey(window.location.pathname))

  useEffect(() => {
    const onPop = () => setRoute(routeForKey(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((path) => {
    const target = routeForKey(path)
    if (target === route) return
    window.history.pushState({}, '', target)
    setRoute(target)
    window.scrollTo(0, 0)
  }, [route])

  return [route, navigate]
}
