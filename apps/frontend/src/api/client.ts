import axios from 'axios';

const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;

  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;

    // En Render: servingmi-appCG.onrender.com → servingmi-backend.onrender.com
    if (hostname.includes('onrender.com')) {
      const backendUrl = `${protocol}//${hostname.replace('appCG', 'backend')}/api/v1`;
      console.log('[API] Render backend URL:', backendUrl);
      return backendUrl;
    }

    // Localhost: usa proxy
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return '/api/v1';
    }
  }

  return '/api/v1';
};

export const api = axios.create({
  baseURL: getApiUrl(),
  headers: { 'Content-Type': 'application/json' },
});

// Adjuntar token automáticamente en cada request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Refresh automático de token ───────────────────────────────
let isRefreshing = false;
let pendingQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

function processPending(error: unknown, token: string | null = null) {
  pendingQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  pendingQueue = [];
}

function forceLogout() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // Si no es 401, o ya reintentamos, o es la propia llamada al refresh → logout
    if (
      error.response?.status !== 401 ||
      original._retry ||
      original.url?.includes('/auth/refresh')
    ) {
      if (error.response?.status === 401) forceLogout();
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) { forceLogout(); return Promise.reject(error); }

    // Si ya hay un refresh en curso, encolar esta petición
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then((newToken) => {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      });
    }

    original._retry = true;
    isRefreshing    = true;

    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL ?? '/api/v1'}/auth/refresh`,
        { refreshToken },
      );
      const { accessToken, refreshToken: newRefresh } = data.data ?? data;

      localStorage.setItem('accessToken', accessToken);
      if (newRefresh) localStorage.setItem('refreshToken', newRefresh);
      api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;

      processPending(null, accessToken);
      original.headers.Authorization = `Bearer ${accessToken}`;
      return api(original);
    } catch (refreshErr) {
      processPending(refreshErr);
      forceLogout();
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
