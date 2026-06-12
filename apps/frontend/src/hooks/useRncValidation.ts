import { useState, useEffect, useRef } from 'react';
import { suppliersApi } from '../api';

export type RncValidationState =
  | { status: 'idle' }
  | { status: 'validating' }
  | { status: 'valid';       name: string; dgiiStatus: string; category: string | null }
  | { status: 'not_found' }
  | { status: 'unreachable' }
  | { status: 'invalid_format' };

const RNC_REGEX = /^\d{9}(\d{2})?$/;
const DEBOUNCE_MS = 800;

export function useRncValidation(rnc: string): RncValidationState {
  const [state, setState] = useState<RncValidationState>({ status: 'idle' });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRnc = useRef('');

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);

    const trimmed = rnc.replace(/\D/g, '');

    if (!trimmed) {
      setState({ status: 'idle' });
      return;
    }

    if (!RNC_REGEX.test(trimmed)) {
      setState({ status: 'invalid_format' });
      return;
    }

    if (trimmed === lastRnc.current) return;

    setState({ status: 'validating' });
    timer.current = setTimeout(async () => {
      try {
        const res = await suppliersApi.validateRNC(trimmed);
        lastRnc.current = trimmed;
        const d = res.data.data;
        if (d.unreachable) {
          setState({ status: 'unreachable' });
        } else if (d.found) {
          setState({ status: 'valid', name: d.name!, dgiiStatus: d.status!, category: d.category ?? null });
        } else {
          setState({ status: 'not_found' });
        }
      } catch {
        setState({ status: 'unreachable' });
      }
    }, DEBOUNCE_MS);

    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [rnc]);

  return state;
}
