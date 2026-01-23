import type { Post } from './types';

const getBaseUrl = () => {
    // 1. Prioridad: Variable de entorno definida en el build (Vercel/Local)
    let url = import.meta.env.VITE_API_URL;
    if (url) {
        url = url.replace(/\/$/, '');
        if (!url.startsWith('http')) {
            url = `https://${url}`;
        }
        return url;
    }

    // 2. Detección automática para local
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://127.0.0.1:8000';
    }

    // 3. Fallback inteligente (usar el mismo host si estamos en Railway o similar)
    return `https://${hostname}`.replace(/\/$/, '');
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
    const response = await fetch(url, { ...options, headers });

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
            throw new Error('Upload failed');
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

    getGrowthData: async (): Promise<any[]> => {
        const res = await fetchWithToken(`${BASE_URL}/api/analytics/growth`);
        if (!res.ok) throw new Error('Failed to fetch growth data');
        return res.json();
    },

    getBestTimes: async (): Promise<any> => {
        const res = await fetchWithToken(`${BASE_URL}/api/analytics/best-times`);
        if (!res.ok) throw new Error('Failed to fetch best times');
        return res.json();
    }

};
