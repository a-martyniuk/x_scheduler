import type { Post } from './types';

const PRODUCTION_URL = 'https://xscheduler-production.up.railway.app';
const API_URL = `${PRODUCTION_URL}/api/posts`;

export const api = {
    getPosts: async (): Promise<Post[]> => {
        const res = await fetch(API_URL + '/');
        if (!res.ok) throw new Error('Failed to fetch posts');
        return res.json();
    },

    createPost: async (post: Post): Promise<Post> => {
        const res = await fetch(API_URL + '/', {
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
        const res = await fetch(`${API_URL}/${id}`, {
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
        const res = await fetch(`${API_URL}/${id}`, {
            method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete post');
    },

    uploadImage: async (file: File): Promise<{ filename: string; filepath: string; url: string }> => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${PRODUCTION_URL}/api/upload/`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error('Upload failed');
        }

        return response.json();
    },

    login: async (credentials: any): Promise<any> => {
        const res = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials),
        });
        if (!res.ok) throw new Error('Login request failed');
        return res.json();
    },

    getAuthStatus: async (): Promise<{ accounts: { username: string; connected: boolean; last_connected?: string; is_legacy?: boolean }[] }> => {
        const res = await fetch(`${PRODUCTION_URL}/api/auth/status`);
        if (!res.ok) return { accounts: [] };
        return res.json();
    }

};
