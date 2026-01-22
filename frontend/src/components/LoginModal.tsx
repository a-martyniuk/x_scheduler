import { useState } from 'react';
import { api } from '../api';
import { X, Loader2 } from 'lucide-react';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    if (!isOpen) return null;

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setStatus('processing');
        setMessage('Starting secure login process... The browser will open shortly on the server.');

        try {
            const resp = await api.login({ username, password });
            if (resp.status === 'processing') {
                setMessage('Login process started! It runs in the background. Please wait ~30s then check the sidebar for your account name.');
            }
            setStatus('success');
            setTimeout(() => {
                onClose();
                // Reset after closing
                setTimeout(() => {
                    setStatus('idle');
                    setUsername('');
                    setPassword('');
                }, 500);
            }, 5000);
        } catch (err: any) {
            setStatus('error');
            setMessage('Failed to start login process. Ensure backend is running.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-white/10 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                    <X size={20} />
                </button>

                <div className="p-8">
                    <h2 className="text-2xl font-bold mb-2 text-foreground">Connect X Account</h2>
                    <p className="text-muted-foreground text-sm mb-6">
                        Enter your credentials to automate the "cookies.json" generation.
                        This runs a secure browser on your local machine.
                    </p>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">Username / Email</label>
                            <input
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className="w-full bg-muted/50 border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                                placeholder="@username"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-muted/50 border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        {status !== 'idle' && (
                            <div className={`text-sm p-3 rounded-lg border ${status === 'success' ? 'bg-green-500/10 text-green-600 border-green-500/20' :
                                status === 'error' ? 'bg-red-500/10 text-red-600 border-red-500/20' :
                                    'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                }`}>
                                {message}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || status === 'success'}
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 rounded-xl shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Login & Save Cookies'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
