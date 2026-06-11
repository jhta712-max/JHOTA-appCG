import { useState, useRef, useCallback } from 'react';
import { ocrApi, type OcrResult, type OcrEnrichmentResult } from '../api';

interface OcrPollingState {
  loading:    boolean;
  result:     OcrResult | null;
  enrichment: OcrEnrichmentResult | null;
  error:      string;
}

export function useOcrPolling(projectId?: string | null) {
  const [state, setState] = useState<OcrPollingState>({
    loading: false, result: null, enrichment: null, error: '',
  });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const triggerEnrich = useCallback((result: OcrResult) => {
    ocrApi.enrich({
      supplierRnc:  result.supplierRnc,
      supplierName: result.supplierName,
      ncf:          result.ncf,
      amount:       result.amount,
      itbisAmount:  result.itbisAmount,
      projectId:    projectId ?? null,
    }).then(res => {
      setState(s => ({ ...s, enrichment: res.data.data }));
    }).catch(() => {});
  }, [projectId]);

  const analyze = useCallback(async (file: File): Promise<OcrResult | null> => {
    setState({ loading: true, result: null, enrichment: null, error: '' });
    stopPolling();

    try {
      const submitRes = await ocrApi.analyze(file);
      const responseData = submitRes.data as any;

      // El backend procesa sincrónicamente y devuelve el resultado en la respuesta POST.
      // Usar el resultado inline directamente, sin necesidad de hacer polling.
      if (responseData.status === 'completed' && responseData.result) {
        const result = responseData.result as OcrResult;
        setState(s => ({ ...s, loading: false, result, error: '' }));
        triggerEnrich(result);
        return result;
      }

      // Fallback: polling si el backend no retornó resultado inline (ej. modo async futuro)
      const { jobId } = responseData;
      if (!jobId) {
        setState(s => ({ ...s, loading: false, error: 'Respuesta inesperada del servidor.' }));
        return null;
      }

      return await new Promise<OcrResult | null>((resolve) => {
        const timeout = setTimeout(() => {
          stopPolling();
          setState(s => ({ ...s, loading: false, error: 'Tiempo de espera agotado. Intenta de nuevo.' }));
          resolve(null);
        }, 90_000);

        pollRef.current = setInterval(async () => {
          try {
            const job = await ocrApi.getJob(jobId);
            const { status, result, error } = job.data;

            if (status === 'completed' && result) {
              clearTimeout(timeout);
              stopPolling();
              setState(s => ({ ...s, loading: false, result, error: '' }));
              triggerEnrich(result);
              resolve(result);
            } else if (status === 'failed') {
              clearTimeout(timeout);
              stopPolling();
              const msg = error ?? 'Error al procesar la imagen con IA.';
              setState(s => ({ ...s, loading: false, error: msg }));
              resolve(null);
            }
          } catch (pollErr: any) {
            // 401 = token expirado mid-poll; detener para evitar forceLogout loop
            if (pollErr?.response?.status === 401) {
              clearTimeout(timeout);
              stopPolling();
              setState(s => ({ ...s, loading: false, error: 'Sesión expirada. Por favor recarga la página.' }));
            }
            // otros errores de red transitorios — continuar polling
          }
        }, 2_000);
      });
    } catch (err: any) {
      stopPolling();
      const msg = err?.response?.data?.message
               ?? err?.response?.data?.error
               ?? 'Error al enviar la imagen.';
      setState(s => ({ ...s, loading: false, error: msg }));
      return null;
    }
  }, [stopPolling, triggerEnrich]);

  const reset = useCallback(() => {
    stopPolling();
    setState({ loading: false, result: null, enrichment: null, error: '' });
  }, [stopPolling]);

  return { ...state, analyze, reset };
}
