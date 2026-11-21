// Runs once when the Node server starts: retries the leads HQ has not confirmed yet (P-01).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { startForwardRetry } = await import('./lib/lead-retry')
  startForwardRetry()
}
