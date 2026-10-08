import Image from 'next/image';
import { CLINIC_NAME, SITE_NAME, SITE_SHORT_NAME } from '@/lib/brand';
import { publicConfig } from '@/lib/public-config';

export default function BrandHeader({ onHome }: { onHome?: () => void }) {
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
      <a className="btn secondary sm navCta" href={publicConfig.bookingUrl} target="_blank" rel="noopener noreferrer">
        Book a consultation
      </a>
    </header>
  );
}
