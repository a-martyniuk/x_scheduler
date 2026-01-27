
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../api';
import type { Account, Post } from '../types';

interface ImportTweetModalProps {
    isOpen: boolean;
    onClose: () => void;
    accounts: Account[];
    onImportSuccess: (post: Post) => void;
}

export const ImportTweetModal: React.FC<ImportTweetModalProps> = ({
    isOpen,
    onClose,
    accounts,
    onImportSuccess
}) => {
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleImport = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setIsLoading(true);

        try {
            if (!url.includes('x.com/') && !url.includes('twitter.com/')) {
                throw new Error('La URL debe ser de x.com o twitter.com');
            }
            if (!url.includes('/status/')) {
                throw new Error('La URL debe incluir un tweet ID (/status/123...)');
            }

            const activeAccount = accounts.find(a => a.is_active) || accounts[0];
            if (!activeAccount) {
                throw new Error('No hay una cuenta activa para realizar la importación.');
            }

            const post = await api.importTweet(url, activeAccount.username);

            setSuccess(`Tweet importado con éxito (ID: ${post.tweet_id})`);
            setUrl(''); // Clear input

            // Notify parent
            onImportSuccess(post);

            // Auto close after 2s
            setTimeout(() => {
                onClose();
                setSuccess(null);
            }, 2000);

        } catch (err: any) {
            setError(err.message || 'Error al importar el tweet.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-border/50 overflow-hidden"
                >
                    <div className="p-6 border-b border-border/50 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
                        <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                            <Search className="w-5 h-5 text-primary" />
                            Importar Tweet
                        </h2>
                        <button onClick={onClose} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-colors">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="p-6">
                        <p className="text-sm text-muted-foreground mb-6">
                            Pega la URL del tweet exacto que deseas importar. Esto recuperará el contenido, métricas y analíticas profundas directamente.
                        </p>

                        <form onSubmit={handleImport} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                                    URL del Tweet
                                </label>
                                <input
                                    type="text"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="https://x.com/usuario/status/123456..."
                                    className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-black/40 border border-transparent focus:border-primary focus:bg-white dark:focus:bg-black outline-none transition-all font-mono text-xs"
                                    disabled={isLoading}
                                />
                            </div>

                            {error && (
                                <div className="p-3 rounded-xl bg-red-500/10 text-red-500 text-xs font-medium flex items-center gap-2">
                                    <AlertCircle size={14} />
                                    {error}
                                </div>
                            )}

                            {success && (
                                <div className="p-3 rounded-xl bg-green-500/10 text-green-500 text-xs font-medium flex items-center gap-2">
                                    <CheckCircle size={14} />
                                    {success}
                                </div>
                            )}

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={isLoading || !url}
                                    className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            Importando...
                                        </>
                                    ) : (
                                        'Importar Ahora'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
