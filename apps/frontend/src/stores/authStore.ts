import { create } from 'zustand';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user:            JSON.parse(localStorage.getItem('user') || 'null'),
  accessToken:     localStorage.getItem('accessToken'),
  refreshToken:    localStorage.getItem('refreshToken'),
  isAuthenticated: !!localStorage.getItem('accessToken'),

  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem('user',         JSON.stringify(user));
    localStorage.setItem('accessToken',  accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    set({ user, accessToken, refreshToken, isAuthenticated: true });
  },

  clearAuth: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },
}));
