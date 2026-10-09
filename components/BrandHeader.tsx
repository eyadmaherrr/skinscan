'use client';

import Image from 'next/image';
import { LogIn, LogOut, User } from 'lucide-react';
import { CLINIC_NAME, SITE_NAME, SITE_SHORT_NAME } from '@/lib/brand';
import { publicConfig } from '@/lib/public-config';
import { useAuth } from '@/lib/client/use-auth';

interface BrandHeaderProps {
  onHome?: () => void;
  onOpenAuth?: () => void;
}

export default function BrandHeader({ onHome, onOpenAuth }: BrandHeaderProps) {
  const { patient, authenticated, logout } = useAuth();

  return (
    <header className="nav">
      <button type="button" className="brand" onClick={onHome} aria-label={`${SITE_SHORT_NAME} home`}>
        <span className="brandLogo">
          <Image src="/brand/logo.webp" alt="" width={44} height={44} priority />
        </span>
        <span className="brandText">
          <strong>{SITE_NAME}</strong>
          <small>{CLINIC_NAME}</small>
        </span>
      </button>

      <div className="navActions">
        {authenticated && patient ? (
          <div className="userNavBadge">
            <span className="userName" title={patient.email}>
              <User size={15} aria-hidden /> {patient.name.split(' ')[0]}
            </span>
            <button
              type="button"
              className="btn ghost sm iconOnlyBtn"
              onClick={() => logout()}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={16} aria-hidden />
            </button>
          </div>
        ) : (
          <button type="button" className="btn secondary sm navAuthBtn" onClick={onOpenAuth}>
            <LogIn size={15} aria-hidden /> Sign In
          </button>
        )}

        <a className="btn secondary sm navCta" href={publicConfig.bookingUrl} target="_blank" rel="noopener noreferrer">
          Book a consultation
        </a>
      </div>
    </header>
  );
}

