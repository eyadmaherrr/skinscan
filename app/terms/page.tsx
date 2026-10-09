import type { Metadata } from 'next';
import Link from 'next/link';
import BrandHeader from '@/components/BrandHeader';
import { CLINIC_NAME, ENGINE_NAME, SITE_NAME, SITE_SHORT_NAME } from '@/lib/brand';
import { publicConfig } from '@/lib/public-config';

export const metadata: Metadata = {
  title: `Terms of Use | ${SITE_NAME}`,
  description: `Terms of Use for ${SITE_NAME} by ${CLINIC_NAME}. Informational skin scan terms, medical disclaimers, and user agreements.`,
};

export default function TermsPage() {
  return (
    <>
      <BrandHeader />

      <main className="privacy-page">
        <div className="privacy-container">
          {/* ==================================================
              HEADER (Matching Dr. Maher Clinics Main Site)
              ================================================== */}
          <div className="privacy-header">
            <span className="privacy-badge">TERMS OF USE</span>
            <h1>Terms of Service</h1>
            <p className="privacy-subtitle">
              Rules and important clinical guidance governing your use of {SITE_NAME} by {CLINIC_NAME}.
            </p>
            <span className="updated">Last updated: October 2026 · Version 2.0</span>
          </div>

          {/* ==================================================
              MEDICAL DISCLAIMER NOTICE
              ================================================== */}
          <section className="privacy-section">
            <h2>Important Medical Notice &amp; Scope</h2>
            <p>
              {SITE_NAME} is an informational artificial intelligence screening tool powered by{' '}
              {ENGINE_NAME}. It is <strong>not a medical diagnosis</strong>, diagnostic test, or clinical
              treatment plan.
            </p>
            <ul>
              <li>
                <strong>No Doctor-Patient Relationship:</strong> Running an online skin scan does not
                establish a doctor-patient relationship with Dr. Maher Mahmoud or any dermatologist at{' '}
                {CLINIC_NAME}.
              </li>
              <li>
                <strong>Clinical Evaluation Required:</strong> Visual analysis scores reflect observable
                patterns in your photo and cannot replace an in-person dermatological examination,
                dermoscopy, or biopsy.
              </li>
              <li>
                <strong>Emergency Notice:</strong> If you notice rapid lesion growth, irregular dark borders,
                spontaneous bleeding, or severe pain, please consult a medical physician or visit our clinic
                immediately.
              </li>
            </ul>
          </section>

          {/* ==================================================
              1. AGREEMENT TO TERMS
              ================================================== */}
          <section className="privacy-section">
            <h2>1. Agreement to Terms</h2>
            <p>
              By accessing or using {SITE_NAME}, you agree to comply with and be bound by these Terms of Use
              and our{' '}
              <Link href="/privacy" className="inlineLink">
                Privacy Policy
              </Link>
              . If you do not accept these terms in full, you may not access or use this application.
            </p>
          </section>

          {/* ==================================================
              2. ELIGIBILITY & CLINIC ACCOUNT
              ================================================== */}
          <section className="privacy-section">
            <h2>2. Eligibility &amp; Patient Authentication</h2>
            <p>
              To ensure safety, prevent unauthorized automated scanning, and maintain clinical integrity,
              scans require an active <strong>Patient Account</strong>.
            </p>
            <ul>
              <li>You must be at least 18 years of age or possess parental or legal guardian consent.</li>
              <li>You agree to provide accurate, truthful credentials during sign-in.</li>
              <li>
                You are responsible for keeping your login credentials confidential and for all actions
                taken under your session.
              </li>
            </ul>
          </section>

          {/* ==================================================
              3. ACCEPTABLE USE & PHOTO SUBMISSION
              ================================================== */}
          <section className="privacy-section">
            <h2>3. Acceptable Use &amp; Photographic Integrity</h2>
            <p>When submitting a photo for analysis, you agree to:</p>
            <ul>
              <li>
                Submit only authentic photographs of your own face, taken in clear, neutral lighting
                without deceptive beauty filters, heavy makeup, or digital manipulation.
              </li>
              <li>
                Never upload photos of any third party without their explicit, informed consent.
              </li>
              <li>
                Never attempt to exploit, scrape, reverse-engineer, or tamper with the underlying neural
                network model runtimes, landmark detectors, or API endpoints.
              </li>
            </ul>
          </section>

          {/* ==================================================
              4. INTELLECTUAL PROPERTY
              ================================================== */}
          <section className="privacy-section">
            <h2>4. Intellectual Property Rights</h2>
            <p>
              All proprietary algorithms, user interface designs, visual layouts, methodology formulations (
              {ENGINE_NAME}), model architectures, trademarks, and brand assets are the exclusive property
              of {CLINIC_NAME} and are protected under Egyptian copyright and intellectual property laws.
            </p>
          </section>

          {/* ==================================================
              5. LIMITATION OF LIABILITY
              ================================================== */}
          <section className="privacy-section">
            <h2>5. Limitation of Liability</h2>
            <p>
              {CLINIC_NAME} provides {SITE_NAME} on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo;
              basis for informational purposes. To the maximum extent permitted under Egyptian law, the Clinic
              disclaims all warranties regarding the completeness or clinical accuracy of automated visual
              scans.
            </p>
            <p>
              Under no circumstances shall the Clinic or its medical staff be liable for decisions made or
              actions taken in reliance on automated scan outputs.
            </p>
          </section>

          {/* ==================================================
              6. CLINICAL IN-PERSON CONSULTATIONS
              ================================================== */}
          <section className="privacy-section">
            <h2>6. Booking Clinical Consultations</h2>
            <p>
              For formal medical diagnosis, specialized dermatological assessments, and personalized
              treatment regimens, please book an in-person or video consultation with our specialized medical
              team:
            </p>
            <ul>
              <li>
                <strong>Online Booking:</strong>{' '}
                <a
                  href={`${publicConfig.clinicUrl}/book`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inlineLink"
                >
                  {publicConfig.clinicUrl.replace(/^https?:\/\//, '')}/book
                </a>
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
            <Link href="/privacy" className="privacy-action">
              View Privacy Policy
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
