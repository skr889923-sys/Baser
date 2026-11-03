'use client';
import { createContext, useContext } from 'react';
import type { UserRole } from '@baser/types';
export const AdminRoleContext = createContext<{ role: UserRole | null; userId?: string }>({ role: null });
export const useAdminRole = () => useContext(AdminRoleContext);
