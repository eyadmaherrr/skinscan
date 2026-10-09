import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import BrandHeader from '@/components/BrandHeader';
import { CLINIC_NAME, ENGINE_NAME, SITE_NAME, SITE_SHORT_NAME } from '@/lib/brand';
import { publicConfig } from '@/lib/public-config';

export const metadata: Metadata = {
  title: `Privacy Policy | ${SITE_NAME}`,
  description: `Privacy Policy for ${SITE_NAME} by ${CLINIC_NAME}. Zero-retention photo analysis, in-memory processing, and data protection compliance.`,
};

export default function PrivacyPage() {
  return (
    <>
      <BrandHeader />
      <main className="legalContainer">
        <div className="legalNavBack">
          <Link href="/" className="backLink">
            <ArrowLeft size={16} aria-hidden /> Return to {SITE_SHORT_NAME}
          </Link>
        </div>

        <article className="legalCard glass">
          <header className="legalHeader">
            <span className="eyebrow">{CLINIC_NAME}</span>
            <h1>Privacy Policy</h1>
            <p className="legalSubtitle">Effective Date: October 9, 2026 · Version 2.0</p>
          </header>

          <div className="legalAlert privacyHighlight">
            <ShieldCheck size={24} className="alertIcon" aria-hidden />
            <div>
              <strong>OUR CORE PRIVACY PROMISE:</strong>
              <p>
                Your facial photo is sensitive biometric data. {SITE_NAME} is engineered from the ground up with a <strong>zero-retention architecture</strong>. Your photo is analysed strictly in volatile memory (RAM) and is <strong>never stored</strong> on any hard disk, database, cloud bucket, or external server.
              </p>
            </div>
          </div>

          <section className="legalSection">
            <h2>1. Introduction</h2>
            <p>
              {CLINIC_NAME} (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;the Clinic&rdquo;) operates {SITE_NAME}, an artificial intelligence skin screening tool powered by {ENGINE_NAME}. This Privacy Policy explains our stringent practices regarding the processing of your facial photos, account information, and technical data in accordance with Egypt&apos;s Personal Data Protection Law (Law No. 151 of 2020) and international data protection standards.
            </p>
          </section>

          <section className="legalSection">
            <h2>2. What Happens to Your Photo (Zero-Retention Life Cycle)</h2>
            <div className="lifecycleSteps">
              <div className="lifecycleCard">
                <span className="stepNumber">1</span>
                <h3>On Your Device (Client-Side)</h3>
                <p>
                  Before any photo leaves your device, your browser draws it onto an internal HTML canvas, removes all EXIF metadata (GPS coordinates, camera serial numbers, and device details), and scales it down. The raw camera file never leaves your phone or computer.
                </p>
              </div>

              <div className="lifecycleCard">
                <span className="stepNumber">2</span>
                <h3>Secure Transit</h3>
                <p>
                  The prepared photo is transmitted over an encrypted HTTPS connection (TLS 1.3 with HSTS enabled) directly to our own server, on the same origin as the application.
                </p>
              </div>

              <div className="lifecycleCard">
                <span className="stepNumber">3</span>
                <h3>In-Memory Server Processing</h3>
                <p>
                  The image is decoded and analysed entirely in temporary RAM. Our local ONNX neural network models run within the server process itself. The image is <strong>never written to disk, database, or cache</strong>, and is never logged or forwarded to third-party APIs.
                </p>
              </div>

              <div className="lifecycleCard">
                <span className="stepNumber">4</span>
                <h3>Instant Memory Erasure</h3>
                <p>
                  As soon as numerical scores, region coordinates, and explanations are computed, the in-memory image buffer is immediately dereferenced and purged from memory. Responses are served with <code>Cache-Control: no-store</code> to prevent intermediate proxies from caching results.
                </p>
              </div>

              <div className="lifecycleCard">
                <span className="stepNumber">5</span>
                <h3>Local Browser Display</h3>
                <p>
                  Your browser renders your photo using a temporary local <code>blob:</code> URL held only in your browser tab&apos;s memory. When you navigate away or click &ldquo;Scan Again&rdquo;, that local memory handle is explicitly revoked. Nothing is persisted to your browser&apos;s permanent storage.
                </p>
              </div>
            </div>
          </section>

          <section className="legalSection">
            <h2>3. Patient Account Data</h2>
            <p>
              To ensure safety and prevent automated abuse, {SITE_NAME} requires sign-in with your official <strong>Dr. Maher Mahmoud Clinics Patient Account</strong>.
            </p>
            <ul>
              <li>
                <strong>Data We Retrieve:</strong> When you authenticate, we access your name, email address, phone verification status, and patient identifier from the clinic&apos;s central database.
              </li>
              <li>
                <strong>Purpose:</strong> To authenticate your authorized session and maintain fair usage limits across our patient community.
              </li>
              <li>
                <strong>Session Authentication Cookie:</strong> We issue an encrypted, <code>httpOnly</code> cookie named <code>patient_session</code> with a 7-day lifespan. This cookie is transmitted solely over HTTPS and is inaccessible to client-side scripts.
              </li>
            </ul>
          </section>

          <section className="legalSection">
            <h2>4. No Biometric Harvesting & No Commercial Sharing</h2>
            <ul>
              <li>We <strong>do not</strong> construct facial recognition profiles, identify individuals from photos, or store biometric templates.</li>
              <li>We <strong>never sell, lease, or monetize</strong> your personal or biometric data.</li>
              <li>We do not utilize third-party advertising trackers, session recording tools, or data brokerage networks.</li>
            </ul>
          </section>

          <section className="legalSection">
            <h2>5. Operational Logging & Security Measures</h2>
            <p>
              To monitor server availability and detect errors, our operational logs record only minimal, non-identifying telemetry per scan request:
            </p>
            <ul>
              <li>Execution duration in milliseconds, outcome status code (e.g., success or retake code), and overall confidence band.</li>
              <li>Logs <strong>never contain</strong> facial images, file names, IP addresses, or patient identities.</li>
              <li>Rate limiting is enforced via in-memory counters keyed on a one-way cryptographic SHA-256 hash of the client IP, expiring automatically every window.</li>
            </ul>
          </section>

          <section className="legalSection">
            <h2>6. Your Rights Under Egypt Law No. 151 of 2020</h2>
            <p>
              Under the Egyptian Personal Data Protection Law and international standards, patients possess full rights over their personal data:
            </p>
            <ul>
              <li><strong>Right to Access:</strong> View the patient profile details registered with {CLINIC_NAME}.</li>
              <li><strong>Right to Rectification:</strong> Request correction of inaccurate personal contact details.</li>
              <li><strong>Right to Erasure (&ldquo;Right to be Forgotten&rdquo;):</strong> Request the permanent deletion of your clinic patient account and associated profile records. (Note: Facial scan photos are already never stored, so there are no photos to delete).</li>
              <li><strong>Right to Withdraw Consent:</strong> You may sign out at any time or discontinue usage of the application.</li>
            </ul>
          </section>

          <section className="legalSection">
            <h2>7. Contact Our Data Protection Team</h2>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy or your data protection rights, please contact our administrative team:
            </p>
            <div className="contactCard">
              <strong>{CLINIC_NAME} — Data Protection Officer</strong>
              <p>Cairo, Egypt</p>
              <p>
                Email:{' '}
                <a href="mailto:clinic@drmahermahmoud.com">clinic@drmahermahmoud.com</a>
              </p>
              <p>
                Main Portal:{' '}
                <a href={publicConfig.clinicUrl} target="_blank" rel="noopener noreferrer">
                  {publicConfig.clinicUrl}
                </a>
              </p>
            </div>
          </section>
        </article>
      </main>

      <footer className="footer">
        <p>
          {SITE_NAME} ·{' '}
          <a href={publicConfig.clinicUrl} target="_blank" rel="noopener noreferrer">
            {CLINIC_NAME}
          </a>
          . Informational only — not a medical diagnosis.
        </p>
        <div className="footerLinks">
          <Link href="/terms">Terms of Use</Link>
          <span className="dot">·</span>
          <Link href="/privacy">Privacy Policy</Link>
        </div>
      </footer>
    </>
  );
}
