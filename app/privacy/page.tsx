import type { Metadata } from 'next';
import Link from 'next/link';
import BrandHeader from '@/components/BrandHeader';
import CookieSettingsButton from '@/components/CookieSettingsButton';
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

      <main className="privacy-page">
        <div className="privacy-container">
          {/* ==================================================
              HEADER (Matching Dr. Maher Clinics Main Site)
              ================================================== */}
          <div className="privacy-header">
            <span className="privacy-badge">PRIVACY POLICY</span>
            <h1>Privacy &amp; Data Protection</h1>
            <p className="privacy-subtitle">
              How {CLINIC_NAME} safeguards your sensitive facial photos and personal information
              with strict in-memory zero-retention processing.
            </p>
            <span className="updated">Last updated: October 2026 · Version 2.0</span>
          </div>

          {/* ==================================================
              CORE PRIVACY GUARANTEE
              ================================================== */}
          <section className="privacy-section">
            <h2>Our Core Zero-Retention Promise</h2>
            <p>
              Your facial photograph is sensitive biometric data. {SITE_NAME} is architected
              from the ground up with a <strong>zero-retention guarantee</strong>:
            </p>
            <ul>
              <li>
                <strong>No Disk Storage:</strong> Your photo is never written to disk, database, cloud
                bucket (S3/GCS), or cache.
              </li>
              <li>
                <strong>In-Memory Processing:</strong> Analysis runs purely in volatile server RAM and is
                immediately purged the instant results are computed.
              </li>
              <li>
                <strong>No Third-Party AI APIs:</strong> We do not send your images to OpenAI, Google
                Cloud Vision, or any external third-party model APIs. All neural networks run within our
                own isolated server processes.
              </li>
              <li>
                <strong>Zero Photo Archival:</strong> Neither our staff, doctors, nor developers have access
                to stored scans. Once your session finishes, your photo is gone forever.
              </li>
            </ul>
          </section>

          {/* ==================================================
              1. INTRODUCTION & SCOPE
              ================================================== */}
          <section className="privacy-section">
            <h2>1. Introduction &amp; Regulatory Compliance</h2>
            <p>
              {CLINIC_NAME} (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;the Clinic&rdquo;) operates{' '}
              {SITE_NAME}, an artificial intelligence skin screening assessment tool powered by{' '}
              {ENGINE_NAME}.
            </p>
            <p>
              This Privacy Policy details our technical data protections and privacy rights under
              Egypt&apos;s Personal Data Protection Law (Law No. 151 of 2020) and internationally recognized
              health privacy principles.
            </p>
          </section>

          {/* ==================================================
              2. ZERO-RETENTION LIFECYCLE
              ================================================== */}
          <section className="privacy-section">
            <h2>2. Photo Processing Lifecycle</h2>
            <p>
              From the moment you capture or upload a selfie, your photo moves through a strictly ephemeral
              pipeline:
            </p>
            <ul>
              <li>
                <strong>Client-Side Sanitization:</strong> Before transmission, your browser strips all EXIF
                metadata (including GPS coordinates and device identifiers) on an isolated HTML canvas.
              </li>
              <li>
                <strong>Encrypted Transit:</strong> Your image travels exclusively over TLS 1.3 encrypted HTTPS
                directly to our own domain.
              </li>
              <li>
                <strong>RAM-Only Computation:</strong> The image buffer is evaluated by lightweight ONNX
                computer vision models and facial landmark algorithms inside active server memory.
              </li>
              <li>
                <strong>Immediate Memory Dereference:</strong> As soon as the analysis JSON payload is
                generated, the memory buffer is wiped and garbage-collected.
              </li>
              <li>
                <strong>Local Browser Display:</strong> The photo displayed on your results screen is rendered
                via a temporary browser <code>blob:</code> URL. Closing or navigating away releases the handle
                instantly.
              </li>
            </ul>
          </section>

          {/* ==================================================
              3. PATIENT ACCOUNTS & AUTHENTICATION
              ================================================== */}
          <section className="privacy-section">
            <h2>3. Patient Account Data</h2>
            <p>
              To protect the platform against automated bots and ensure clinical continuity, {SITE_NAME}{' '}
              uses your verified <strong>Patient Account</strong>.
            </p>
            <ul>
              <li>
                <strong>Information Accessed:</strong> Name, verified email address, phone verification
                status, and unique patient ID.
              </li>
              <li>
                <strong>Authentication Tokens:</strong> Secure httpOnly session cookies or bearer headers
                are validated against the main clinic authentication service.
              </li>
              <li>
                <strong>No Password Exposure:</strong> Your credentials are never stored or handled by
                the scanning engine.
              </li>
            </ul>
          </section>

          {/* ==================================================
              4. COOKIES & LOCAL STORAGE
              ================================================== */}
          <section className="privacy-section">
            <h2>4. Cookies &amp; Storage</h2>
            <p>
              We prioritize minimalist data storage:
            </p>
            <ul>
              <li>
                <strong>Essential Authentication Cookie:</strong> The <code>patient_session</code> cookie
                maintains your secure sign-in status across requests.
              </li>
              <li>
                <strong>No Tracking Cookies:</strong> We do not place advertising tracking pixels or
                cross-site behavioural cookies.
              </li>
              <li>
                <strong>No Permanent Photo Storage:</strong> Your browser local storage is never used to
                store scanned images.
              </li>
            </ul>

            <CookieSettingsButton />
          </section>

          {/* ==================================================
              5. YOUR RIGHTS & DATA REQUESTS
              ================================================== */}
          <section className="privacy-section">
            <h2>5. Your Privacy Rights</h2>
            <p>
              In accordance with Egyptian data protection laws and international best practices, you hold full
              rights to:
            </p>
            <ul>
              <li>Request a copy of your patient account records held at the Clinic.</li>
              <li>Rectify or update any contact information associated with your profile.</li>
              <li>Request erasure of your central clinic account and clinical booking history.</li>
              <li>Revoke consent for communication at any time.</li>
            </ul>
            <p>
              Because facial photos from scans are deleted immediately upon processing, there is no photo
              archive to delete—they are already erased.
            </p>
          </section>

          {/* ==================================================
              6. CONTACT & DATA PROTECTION OFFICER
              ================================================== */}
          <section className="privacy-section">
            <h2>6. Contact Our Clinical Privacy Team</h2>
            <p>
              For any questions regarding this Privacy Policy or your data, please contact our administrative
              team:
            </p>
            <ul>
              <li>
                <strong>Clinic:</strong> {CLINIC_NAME}
              </li>
              <li>
                <strong>Website:</strong>{' '}
                <a
                  href={publicConfig.clinicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inlineLink"
                >
                  {publicConfig.clinicUrl.replace(/^https?:\/\//, '')}
                </a>
              </li>
              <li>
                <strong>Branches:</strong> Mohandessin, Heliopolis, Zayed, Maadi, Mansoura, Alexandria
              </li>
            </ul>
          </section>

          {/* ==================================================
              PAGE ACTIONS
              ================================================== */}
          <div className="privacy-actions">
            <Link href="/" className="privacy-action">
              ← Return to {SITE_SHORT_NAME}
            </Link>
            <Link href="/terms" className="privacy-action">
              View Terms of Use
            </Link>
            <a
              href={publicConfig.clinicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="privacy-action"
            >
              Visit Clinic Website
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
