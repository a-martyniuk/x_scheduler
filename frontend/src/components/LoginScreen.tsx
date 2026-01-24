import React, { useState } from 'react';
import { Shield, Lock, ArrowRight, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api';

interface LoginScreenProps {
    onLogin: (token: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
    const [token, setToken] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        if (token.trim()) {
            try {
                // Verify with backend first
                await api.verifyAdminToken(token.trim());
                onLogin(token.trim());
            } catch (err: any) {
                setErrorMsg(err.message || 'Token inválido');
            }
        } else {
            setErrorMsg('Ingresa un token');
        }
    };

    return (
        <div className="fixed inset-0 bg-[#020617] flex items-center justify-center p-6 overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-rose-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md relative"
            >
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20 backdrop-blur-xl shadow-2xl">
                    <Shield className="text-primary animate-pulse" size={40} />
                </div>

                <div className="bg-white/5 dark:bg-white/[0.03] border border-white/10 backdrop-blur-3xl p-10 rounded-[3rem] shadow-2xl text-center">
                    <div className="mb-8">
                        <h1 className="text-4xl font-black tracking-tighter mb-2 bg-gradient-to-br from-white to-white/40 bg-clip-text text-transparent">
                            X COMMAND
                        </h1>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
                            Acceso Restringido
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                                <Lock size={18} />
                            </div>
                            <input
                                type="password"
                                value={token}
                                onChange={(e) => {
                                    setToken(e.target.value);
                                    setErrorMsg('');
                                }}
                                placeholder="Ingresa tu Admin Token"
                                className={`w-full bg-white/5 border ${errorMsg ? 'border-rose-500' : 'border-white/10'} rounded-2xl py-5 pl-16 pr-6 outline-none focus:border-primary/50 focus:bg-white/[0.08] transition-all text-sm font-bold tracking-widest placeholder:text-muted-foreground/30`}
                            />
                        </div>

                        {errorMsg && (
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-[10px] text-rose-500 font-black uppercase tracking-widest break-all"
                            >
                                {errorMsg}
                            </motion.p>
                        )}

                        <button
                            type="submit"
                            className="w-full bg-primary hover:bg-primary/90 text-white font-black py-5 rounded-2xl transition-all shadow-xl hover:shadow-primary/20 flex items-center justify-center gap-3 group overflow-hidden relative"
                        >
                            <span className="relative z-10 uppercase tracking-widest text-xs">Entrar al Centro de Mando</span>
                            <ArrowRight size={18} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                        </button>
                    </form>

                    <div className="mt-10 p-5 rounded-2xl bg-white/5 border border-white/5 text-left flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                            <Zap className="text-amber-500" size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">
                                Seguridad Activa
                            </p>
                            <p className="text-[9px] text-muted-foreground leading-relaxed font-bold">
                                Esta instancia está protegida. Si has olvidado tu token, verificalo en las variables de entorno de Railway.
                            </p>
                        </div>
                    </div>
                </div>

                <p className="mt-8 text-center text-muted-foreground/30 text-[9px] font-black uppercase tracking-[0.2em]">
                    Powered by Antigravity Core v2.0
                </p>
            </motion.div>
        </div>
    );
};
