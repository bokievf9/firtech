// Who may see the estimate sheet at /builder/estimate?b=... (audit 2026-11-22). The PDF flow already
// asks for an account (the PDF request is a lead), so the sheet cannot be reached around it by
// typing the address: signed out gives the sign-in step, which returns to the very same link.
// `off` = the cabinet is not configured on this server: nothing to sign in to, the sheet opens.
export type EstimateAccess = 'wait' | 'gate' | 'open'

export function estimateAccess(status: 'loading' | 'out' | 'in' | 'off'): EstimateAccess {
  if (status === 'loading') return 'wait'
  return status === 'out' ? 'gate' : 'open'
}

// Where sign-in comes back to: the same address, share state (`?b=`) and hash kept.
export const estimateReturnPath = (pathname: string, search: string, hash = '') => `${pathname}${search}${hash}`
