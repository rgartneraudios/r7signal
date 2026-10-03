export function notifyTurnActive(active) {
  const hot = import.meta.hot
  if (hot && typeof hot.send === 'function') hot.send('cochi:turn', { active: !!active })
}

export function onHmrPending(handler) {
  const hot = import.meta.hot
  if (!hot || typeof hot.on !== 'function') return () => {}
  const listener = (data) => handler(data)
  hot.on('cochi:hmr-pending', listener)
  return () => { if (typeof hot.off === 'function') hot.off('cochi:hmr-pending', listener) }
}