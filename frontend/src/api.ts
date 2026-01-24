import type { Post, GrowthData, BestTimesData, PerformanceData } from './types';

const getBaseUrl = () => {
    // 0. Si estamos en Vercel, usamos rutas relativas para aprovechar el Proxy (Bypass de CORS)
    if (window.location.hostname.includes('vercel.app')) {
        return '';
    }

    // 1. Prioridad: Variable de entorno variable definida en el build (Local con Railway)
    let url = import.meta.env.VITE_API_URL;
    if (url) {
        url = url.replace(/\/$/, '');
        if (!url.startsWith('http')) {
            url = `https://${url}`;
        }
        return url;
    }

    // 2. Detección automática para local e IPs de red local (Mobile Testing)
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;

    // Si estamos en localhost o una IP de red privada (192.168.x.x, 10.x.x.x, 172.x.x.x)
    const isLocalIP = hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);

    if (isLocalIP) {
        // En local, forzamos http y puerto 8000 (puerto por defecto del backend)
        return `http://${hostname}:8000`;
    }

    // 3. Fallback inteligente (usar el mismo host y protocolo)
    return `${protocol}//${hostname}`.replace(/\/$/, '');
};

const BASE_URL = getBaseUrl();
const API_URL = `${BASE_URL}/api/posts`;
export { BASE_URL };

const fetchWithToken = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('admin_token');
    const headers = {
        ...options.headers,
        ...(token ? { 'X-Admin-Token': token } : {})
    };
    const response = await fetch(url, {
        ...options,
        headers,
        mode: 'cors',
        credentials: 'omit'
    });

    // Si el servidor responde 401, el token es inválido o expiró
    if (response.status === 401) {
        const hadToken = !!localStorage.getItem('admin_token');
        localStorage.removeItem('admin_token');

        // Solo recargar si realmente teniamos una sesión activa que expiró
        // Y no estamos en una ruta de login (aunque este app es SPA)
        if (hadToken && window.location.pathname !== '/login') {
            window.location.reload();
        }
    }

    return response;
};

export const api = {
    getPosts: async (): Promise<Post[]> => {
        const res = await fetchWithToken(API_URL + '/');
        if (!res.ok) throw new Error('Failed to fetch posts');
        return res.json();
    },

    getLatestPost: async (): Promise<Post> => {
        const res = await fetchWithToken(API_URL + '/latest');
        if (!res.ok) throw new Error('Failed to fetch latest post');
        return res.json();
    },

    createPost: async (post: Post): Promise<Post> => {
        const res = await fetchWithToken(API_URL + '/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(post),
        });
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Failed to create post: ${errorText}`);
        }
        return res.json();
    },

    updatePost: async (id: number, post: Partial<Post>): Promise<Post> => {
        const res = await fetchWithToken(`${API_URL}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(post),
        });
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Failed to update post: ${errorText}`);
        }
        return res.json();
    },

    deletePost: async (id: number): Promise<void> => {
        const res = await fetchWithToken(`${API_URL}/${id}`, {
            method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete post');
    },

    uploadImage: async (file: File): Promise<{ filename: string; filepath: string; url: string }> => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetchWithToken(`${BASE_URL}/api/upload/`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'No JSON detail' }));
            throw new Error(`[${response.status}] ${errorData.detail || 'Upload failed'}`);
        }

        return response.json();
    },

    login: async (credentials: any): Promise<any> => {
        const res = await fetchWithToken(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials),
        });
        if (!res.ok) throw new Error('Login request failed');
        return res.json();
    },

    verifyAdminToken: async (token: string): Promise<boolean> => {
        const res = await fetch(`${BASE_URL}/api/auth/verify-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Token': token
            },
            mode: 'cors',
            credentials: 'omit'
        });
        if (!res.ok) {
            let errorMessage = 'Invalid token';
            try {
                const errorData = await res.json();
                if (errorData.detail) errorMessage = errorData.detail;
            } catch (e) {
                // If JSON parse fails, maybe it's text
                const text = await res.text();
                if (text) errorMessage = text;
            }
            throw new Error(errorMessage);
        }
        return true;
    },

    getAuthStatus: async (): Promise<{ accounts: { username: string; connected: boolean; last_connected?: string; is_legacy?: boolean }[] }> => {
        const res = await fetchWithToken(`${BASE_URL}/api/auth/status`);
        if (!res.ok) return { accounts: [] };
        return res.json();
    },

    getGlobalStats: async (): Promise<{ sent: number; failed: number; scheduled: number; drafts: number; views: number; likes: number; reposts: number }> => {
        const res = await fetchWithToken(`${API_URL}/stats`);
        if (!res.ok) throw new Error('Failed to fetch global stats');
        return res.json();
    },

    getGrowthData: async (): Promise<GrowthData[]> => {
        const res = await fetchWithToken(`${BASE_URL}/api/analytics/growth`);
        if (!res.ok) throw new Error('Failed to fetch growth data');
        return res.json();
    },

    getPerformanceData: async (): Promise<PerformanceData> => {
        const res = await fetchWithToken(`${BASE_URL}/api/analytics/performance`);
        if (!res.ok) throw new Error('Failed to fetch performance data');
        return res.json();
    },

    getBestTimes: async (): Promise<BestTimesData> => {
        const res = await fetchWithToken(`${BASE_URL}/api/analytics/best-times`);
        if (!res.ok) throw new Error('Failed to fetch best times');
        return res.json();
    },

    syncHistory: async (username: string): Promise<{ imported: number; log: string }> => {
        const res = await fetchWithToken(`${BASE_URL}/api/auth/sync/${encodeURIComponent(username)}`, {
            method: 'POST'
        });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ detail: 'Sync failed' }));
            throw new Error(errorData.detail || 'Sync failed');
        }
        return res.json();
    }

};
