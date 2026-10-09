'use client';

import { Lock, Mail, ShieldCheck, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { publicConfig } from '@/lib/public-config';
import { useAuth } from '@/lib/client/use-auth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  message?: string;
}

export default function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  title = 'Sign In Required',
  message = 'Please sign in to your Dr. Maher account to run a skin scan.',
}: AuthModalProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen && !isPending) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPending, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('Please enter both your email and password.');
      return;
    }

    startTransition(async () => {
      const res = await login(email, password);
      if (res.success) {
        onClose();
        onSuccess?.();
      } else {
        setError(res.error || 'Unable to sign in. Please check your credentials.');
      }
    });
  };

  return (
    <div className="authModalBackdrop" onClick={onClose} role="presentation">
      <div
        className="authModalCard glass"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="authModalClose"
          onClick={onClose}
          aria-label="Close dialog"
          disabled={isPending}
        >
          <X size={20} aria-hidden />
        </button>

        <div className="authModalHeader">
          <div className="authModalIcon">
            <ShieldCheck size={28} aria-hidden />
          </div>
          <span className="eyebrow">Dr. Maher Mahmoud Clinics</span>
          <h2 id="auth-modal-title">{title}</h2>
          <p className="muted">{message}</p>
        </div>

        <form onSubmit={handleSubmit} className="authModalForm">
          {error ? (
            <div className="inlineError" role="alert">
              {error}
            </div>
          ) : null}

          <div className="formField">
            <label htmlFor="auth-email">Email Address</label>
            <div className="inputWithIcon">
              <Mail size={18} className="fieldIcon" aria-hidden />
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="formField">
            <div className="fieldLabelRow">
              <label htmlFor="auth-password">Password</label>
              <a
                href={`${publicConfig.clinicUrl}/forgot-password`}
                target="_blank"
                rel="noopener noreferrer"
                className="forgotLink"
              >
                Forgot?
              </a>
            </div>
            <div className="inputWithIcon">
              <Lock size={18} className="fieldIcon" aria-hidden />
              <input
                id="auth-password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          <button type="submit" className="btn primary lg authSubmitBtn" disabled={isPending}>
            {isPending ? 'Signing in...' : 'Sign In to Continue'}
          </button>
        </form>

        <div className="authModalFooter">
          <p className="registerPrompt">
            Don&apos;t have an account?{' '}
            <a
              href={`${publicConfig.clinicUrl}/register`}
              target="_blank"
              rel="noopener noreferrer"
              className="registerLink"
            >
              Create an account
            </a>
          </p>
          <p className="authLegal">
            By signing in, you agree to our{' '}
            <Link href="/terms" target="_blank" className="legalLink">
              Terms of Use
            </Link>{' '}
            and{' '}
            <Link href="/privacy" target="_blank" className="legalLink">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
