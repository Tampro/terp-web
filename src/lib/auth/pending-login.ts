/**
 * Credentials of a login that answered AUTH_004 (temporary password), kept in memory only — never in storage —
 * so /initial-password can call POST /auth/initial-password without asking for the temporary password again.
 * A page reload loses them and the user is sent back to /login.
 */
type Pending = { username: string; password: string; remember: boolean }

let pending: Pending | null = null

export const pendingLogin = {
  set: (p: Pending) => {
    pending = p
  },
  get: () => pending,
  clear: () => {
    pending = null
  },
}

/** Only same-app paths are accepted as ?redirect= (no open redirect to another site). */
export function safeRedirect(path: string | null | undefined) {
  return path && path.startsWith("/") && !path.startsWith("//") ? path : "/"
}
