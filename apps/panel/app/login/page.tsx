'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Lock, Mail, AlertCircle, Shield } from 'lucide-react';
import { apiFetch, ApiError } from '@/components/use-api';
import { Spinner } from '@/components/ui/spinner';
import { Logo } from '@/components/ui/logo';

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiFetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });
      window.location.assign('/dashboard');
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Network error. Please try again.';
      setError(message);
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">

      {/* ── Extra ambient glows for login page ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: [
            'radial-gradient(55% 40% at 20% 30%, hsl(192 100% 58% / 0.13) 0%, transparent 60%)',
            'radial-gradient(45% 45% at 80% 70%, hsl(265 80% 68% / 0.13) 0%, transparent 60%)',
            'radial-gradient(35% 35% at 60% 15%, hsl(240 80% 65% / 0.08) 0%, transparent 55%)',
          ].join(', '),
        }}
      />

      {/* ── Floating orbs ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/4 left-1/4 h-64 w-64 rounded-full opacity-[0.07] blur-3xl float"
        style={{ background: 'hsl(192 100% 58%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-1/4 right-1/4 h-48 w-48 rounded-full opacity-[0.07] blur-3xl float"
        style={{ background: 'hsl(265 80% 68%)', animationDelay: '2s' }}
      />

      {/* ── Login card ── */}
      <div
        className={[
          'relative z-10 w-full max-w-md animate-glass',
          // Glassmorphism card
          'rounded-2xl overflow-hidden',
          'bg-[hsl(225_28%_9%/0.65)]',
          'backdrop-blur-3xl saturate-150',
          'border border-white/[0.08]',
          'shadow-[inset_0_1px_0_hsl(210_40%_98%/0.05),_0_8px_60px_hsl(0_0%_0%/0.55),_0_0_0_1px_hsl(192_100%_58%/0.06)]',
        ].join(' ')}
      >
        {/* Top shine strip */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(192_100%_58%/0.35)] to-transparent"
        />

        {/* Gradient overlay — top-right corner glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full blur-3xl opacity-20"
          style={{ background: 'hsl(192 100% 58%)' }}
        />

        {/* ── Header ── */}
        <div className="relative px-8 pt-10 pb-6 text-center space-y-4">
          {/* Logo with glow halo */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-[hsl(192_100%_58%/0.20)] blur-2xl scale-150" />
              <Logo size={72} className="relative drop-shadow-[0_0_20px_hsl(192_100%_58%/0.60)]" />
            </div>
          </div>

          <div className="space-y-1.5">
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="gradient-text">OVPN</span>
              <span className="text-foreground"> Admin</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Secure access to your VPN control panel
            </p>
          </div>

          {/* Security badge */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/[0.08] border border-emerald-500/[0.18] text-emerald-400 text-xs font-medium">
              <Shield className="h-3 w-3" />
              End-to-end encrypted
            </div>
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="mx-8 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

        {/* ── Form ── */}
        <div className="px-8 py-8 space-y-6">
          {/* Error alert */}
          {error && (
            <div
              role="alert"
              className={[
                'flex items-center gap-3 p-4 rounded-xl text-sm',
                'bg-red-500/[0.08] border border-red-500/[0.20]',
                'text-red-400',
                'animate-fade',
              ].join(' ')}
            >
              <AlertCircle aria-hidden className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground/80">
                Email address
              </Label>
              <div className="relative group">
                <Mail
                  aria-hidden
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-[hsl(192_100%_58%)] transition-colors"
                />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10"
                  placeholder="admin@example.com"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground/80">
                Password
              </Label>
              <div className="relative group">
                <Lock
                  aria-hidden
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-[hsl(192_100%_58%)] transition-colors"
                />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 text-sm font-semibold mt-2"
              size="lg"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Spinner className="h-4 w-4" label="Signing in" />
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Sign in
                </span>
              )}
            </Button>
          </form>
        </div>

        {/* Bottom shine strip */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent"
        />
      </div>
    </main>
  );
}
