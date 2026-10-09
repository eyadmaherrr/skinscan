import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
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
      <main className="legalContainer">
        <div className="legalNavBack">
          <Link href="/" className="backLink">
            <ArrowLeft size={16} aria-hidden /> Return to {SITE_SHORT_NAME}
          </Link>
        </div>

        <article className="legalCard glass">
          <header className="legalHeader">
            <span className="eyebrow">{CLINIC_NAME}</span>
            <h1>Terms of Use</h1>
            <p className="legalSubtitle">Effective Date: October 9, 2026 · Version 2.0</p>
          </header>

          <div className="legalAlert">
            <ShieldAlert size={20} className="alertIcon" aria-hidden />
            <div>
              <strong>IMPORTANT MEDICAL NOTICE:</strong>
              <p>
                {SITE_NAME} is an informational artificial intelligence screening tool powered by {ENGINE_NAME}. It is
                <strong> not a medical diagnosis</strong>, diagnostic test, or clinical treatment recommendation. It does not replace an in-person clinical examination by Dr. Maher Mahmoud or a certified dermatologist. If you are experiencing pain, bleeding, rapid skin changes, or suspect melanoma, seek immediate professional medical attention.
              </p>
            </div>
          </div>

          <section className="legalSection">
            <h2>1. Agreement to Terms</h2>
            <p>
              By accessing or using {SITE_NAME} (accessible via this application and related services of {CLINIC_NAME}), you agree to be bound by these Terms of Use and our <Link href="/privacy" className="inlineLink">Privacy Policy</Link>. If you do not agree with any part of these terms, you must not access or use the application.
            </p>
          </section>

          <section className="legalSection">
            <h2>2. Nature of the Service & Medical Disclaimer</h2>
            <p>
              {SITE_NAME} uses advanced computer-vision algorithms to assess observable visual skin characteristics (such as surface pigmentation patterns, redness metrics, texture variations, visible spot candidates, and oiliness/shine) from consumer facial photographs.
            </p>
            <ul>
              <li>
                <strong>No Doctor-Patient Relationship:</strong> Using {SITE_NAME} does not establish a doctor-patient relationship with Dr. Maher Mahmoud or any physician at {CLINIC_NAME}.
              </li>
              <li>
                <strong>Informational Guidance Only:</strong> Scores, visual maps, candidate counts, and observations are provided solely for personal skin awareness and educational guidance.
              </li>
              <li>
                <strong>Not for Clinical Decisions:</strong> Results must never be used to self-medicate, alter prescription regimens, or delay seeking formal dermatological evaluation.
              </li>
            </ul>
          </section>

          <section className="legalSection">
            <h2>3. Account Requirement & Eligibility</h2>
            <p>
              To access and run a scan on {SITE_NAME}, you must sign in with a verified <strong>Dr. Maher Mahmoud Clinics Patient Account</strong>.
            </p>
            <ul>
              <li>You must be at least 18 years old, or possess verified parental or legal guardian consent.</li>
              <li>You agree to provide accurate credentials and maintain the security and confidentiality of your account login.</li>
              <li>You are responsible for all activities that occur under your authenticated session.</li>
            </ul>
          </section>

          <section className="legalSection">
            <h2>4. User Responsibilities & Acceptable Use</h2>
            <p>When using {SITE_NAME}, you agree to:</p>
            <ul>
              <li>Upload only clear, authentic photographs of your own face, taken in neutral lighting without deceptive digital alterations or filters.</li>
              <li>Not upload photographs of any other individual without their prior, express, and informed consent.</li>
              <li>Not attempt to reverse engineer, decompile, extract, or tamper with the underlying neural network models, ONNX runtimes, or client-side algorithms.</li>
              <li>Not use the service for automated scraping, denial of service, commercial exploitation, or unauthorized benchmarking.</li>
            </ul>
          </section>

          <section className="legalSection">
            <h2>5. Intellectual Property</h2>
            <p>
              All proprietary algorithms, user interfaces, branding, visual designs, methodology formulations ({ENGINE_NAME}), model architectures, and documentation are the exclusive intellectual property of {CLINIC_NAME} and its licensors, protected by Egyptian and international copyright, trademark, and intellectual property laws.
            </p>
          </section>

          <section className="legalSection">
            <h2>6. Privacy & Photo Handling</h2>
            <p>
              We prioritize your privacy. Photographs submitted for analysis are processed ephemerally in memory on our servers. As detailed in our <Link href="/privacy" className="inlineLink">Privacy Policy</Link>, facial images are never stored on disk, never saved to databases, never transferred to advertising brokers, and are permanently released immediately upon completion of the analysis.
            </p>
          </section>

          <section className="legalSection">
            <h2>7. Disclaimer of Warranties & Limitation of Liability</h2>
            <p>
              {SITE_NAME} is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis without warranties of any kind, whether express or implied. Computer-vision algorithms may be influenced by camera resolution, exposure, ambient lighting, skin tones, or facial hair.
            </p>
            <p>
              To the fullest extent permitted by applicable law, {CLINIC_NAME}, Dr. Maher Mahmoud, and their staff shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of, or inability to use, this application or reliance on any visual score.
            </p>
          </section>

          <section className="legalSection">
            <h2>8. Governing Law & Jurisdiction</h2>
            <p>
              These Terms of Use and any disputes arising out of or related to them shall be governed by and construed in accordance with the laws of the Arab Republic of Egypt. Any legal action or proceeding shall be brought exclusively in the competent courts of Cairo, Egypt.
            </p>
          </section>

          <section className="legalSection">
            <h2>9. Contact Us</h2>
            <p>
              For questions regarding these Terms of Use, clinical inquiries, or to book an in-person dermatological appointment with Dr. Maher Mahmoud, please contact us:
            </p>
            <div className="contactCard">
              <strong>{CLINIC_NAME}</strong>
              <p>Cairo, Egypt</p>
              <p>
                Website:{' '}
                <a href={publicConfig.clinicUrl} target="_blank" rel="noopener noreferrer">
                  {publicConfig.clinicUrl}
                </a>
              </p>
              <p>
                Appointments:{' '}
                <a href={publicConfig.bookingUrl} target="_blank" rel="noopener noreferrer">
                  Book Consultation Online
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
