import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type RefreshContextValue = {
  /** Increments every time incoming notifications signal that data changed. */
  refreshTick: number;
  triggerRefresh: () => void;
};

const RefreshContext = createContext<RefreshContextValue>({ refreshTick: 0, triggerRefresh: () => {} });

export function RefreshProvider({ children }: { children: ReactNode }) {
  const [refreshTick, setRefreshTick] = useState(0);
  // Deduplicate rapid back-to-back triggers within the same 500 ms window
  const scheduled = useRef(false);

  const triggerRefresh = useCallback(() => {
    if (scheduled.current) return;
    scheduled.current = true;
    window.setTimeout(() => {
      setRefreshTick((t) => t + 1);
      scheduled.current = false;
    }, 500);
  }, []);

  const value = useMemo(() => ({ refreshTick, triggerRefresh }), [refreshTick, triggerRefresh]);

  return <RefreshContext.Provider value={value}>{children}</RefreshContext.Provider>;
}

export function useRefresh() {
  return useContext(RefreshContext);
}
