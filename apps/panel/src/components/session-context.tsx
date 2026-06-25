'use client';

import { createContext, useContext } from 'react';

export type Role = 'SUPERADMIN' | 'ADMIN' | 'MANAGER';

export interface Session {
  email: string;
  role: Role;
  /** SUPERADMIN / ADMIN — full access; MANAGER is scoped. */
  isFullAdmin: boolean;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ value, children }: { value: Session; children: React.ReactNode }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  // Default to least privilege so admin-only UI stays hidden if context is ever missing.
  return useContext(SessionContext) ?? { email: '', role: 'MANAGER', isFullAdmin: false };
}
