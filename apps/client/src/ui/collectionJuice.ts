import { useEffect, useRef, useState } from 'react';

/**
 * How long a registering slot stays "popped" before completion UI lands. Keeps
 * the entry visible and the slam/flash readable even when the last item finishes
 * the set (see CollectionBookModal + bindHud completion deferral).
 */
export const REGISTER_SLOT_POP_MS = 960;

let registerBurstSeq = 0;

/** Drives slot slam + flash when a requirement's registered count increases. */
export function useRegisterSlotBurst(reg: number): number | null {
  const [burst, setBurst] = useState<number | null>(null);
  const prevReg = useRef(reg);
  useEffect(() => {
    if (reg > prevReg.current) {
      const id = (registerBurstSeq += 1);
      setBurst(id);
      const t = window.setTimeout(
        () => setBurst((cur) => (cur === id ? null : cur)),
        REGISTER_SLOT_POP_MS,
      );
      prevReg.current = reg;
      return () => window.clearTimeout(t);
    }
    prevReg.current = reg;
  }, [reg]);
  return burst;
}
