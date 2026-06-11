import { useState, useRef, useCallback } from 'react';
import { ocrApi, type OcrResult } from '../api';

interface OcrPollingState {
  loading: boolean;
  result: OcrResult | null;
  error: string;
}

export function useOcrPolling() {
  const [state, setState] = useState<OcrPollingState>({ loading: false, result: null, error: '' });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const analyze = useCallback(async (file: File): Promise<OcrResult | null> => {
    setState({ loading: true, result: null, error: '' });
    stopPolling();

    try {
      const submitRes = await ocrApi.analyze(file);
      const { jobId } = submitRes.data;

      return await new Promise<OcrResult | null>((resolve) => {
        const timeout = setTimeout(() => {
          stopPolling();
          setState({ loading: false, result: null, error: 'Tiempo de espera agotado. Intenta de nuevo.' });
          resolve(null);
        }, 60_000);

        pollRef.current = setInterval(async () => {
          try {
            const job = await ocrApi.getJob(jobId);
            const { status, result, error } = job.data;

            if (status === 'completed' && result) {
              clearTimeout(timeout);
              stopPolling();
              setState({ loading: false, result, error: '' });
              resolve(result);
            } else if (status === 'failed') {
              clearTimeout(timeout);
              stopPolling();
              const msg = error ?? 'Error al procesar la imagen con IA.';
              setState({ loading: false, result: null, error: msg });
              resolve(null);
            }
          } catch {
            // transient network error — keep polling
          }
        }, 2_000);
      });
    } catch (err: any) {
      stopPolling();
      const msg = err?.response?.data?.message ?? 'Error al enviar la imagen.';
      setState({ loading: false, result: null, error: msg });
      return null;
    }
  }, [stopPolling]);

  const reset = useCallback(() => {
    stopPolling();
    setState({ loading: false, result: null, error: '' });
  }, [stopPolling]);

  return { ...state, analyze, reset };
}
