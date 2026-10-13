"use client";

import { createContext, useCallback, useContext, useEffect, useRef, type FC, type ReactNode } from "react";

interface GuardContext { registerGuard: (guard: () => boolean) => () => void; canLeave: () => boolean }
const NavigationGuardContext = createContext<GuardContext>({ registerGuard: () => () => {}, canLeave: () => true });
interface Props { children: ReactNode }
const NavigationGuardProvider: FC<Props> = ({ children }) => {
  const guards = useRef(new Set<() => boolean>());
  const registerGuard = useCallback((guard: () => boolean) => {
    guards.current.add(guard);
    return () => { guards.current.delete(guard); };
  }, []);
  const canLeave = useCallback(() => [...guards.current].every((guard) => guard()), []);
  useEffect(() => {
    const interceptNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element)?.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const target = new URL(link.href, window.location.href);
      if (target.href === window.location.href || (target.pathname === window.location.pathname && target.search === window.location.search && target.hash)) return;
      if (!canLeave()) { event.preventDefault(); event.stopPropagation(); }
    };
    document.addEventListener("click", interceptNavigation, true);
    return () => document.removeEventListener("click", interceptNavigation, true);
  }, [canLeave]);

  return <NavigationGuardContext.Provider value={{ registerGuard, canLeave }}>{children}</NavigationGuardContext.Provider>;
};
export const useNavigationGuard = () => useContext(NavigationGuardContext);
export default NavigationGuardProvider;
