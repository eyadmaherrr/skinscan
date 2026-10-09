'use client';

import { Activity, CheckCircle2, ChevronRight, Info, Sliders, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useI18n } from './LocaleProvider';
import {
  getMetricExplanation,
  type ExplainingMetricKey,
} from '@/lib/metric-explanations';

interface Props {
  metricKey: ExplainingMetricKey | null;
  currentScore?: number | null;
  currentBand?: string | null;
  onClose: () => void;
}

export function ScoreInfoButton({
  onClick,
  title,
  label,
}: {
  onClick: () => void;
  title?: string;
  label?: string;
}) {
  const { locale } = useI18n();
  const defaultTitle = locale === 'ar' ? 'كيف يتم حساب هذه النتيجة؟' : 'How this score is calculated';
  const defaultLabel = locale === 'ar' ? 'معلومات النتيجة وطريقة الحساب' : 'Score explanation and calculation';

  return (
    <button
      type="button"
      className="scoreInfoBtn"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title ?? defaultTitle}
      aria-label={label ?? defaultLabel}
    >
      <Info size={13} aria-hidden="true" />
    </button>
  );
}

export default function MetricInfoModal({
  metricKey,
  currentScore,
  currentBand,
  onClose,
}: Props) {
  const { locale } = useI18n();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!metricKey) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [metricKey, onClose]);

  if (!metricKey) return null;

  const info = getMetricExplanation(metricKey, locale);
  const isAr = locale === 'ar';

  return (
    <div className="authModalBackdrop" onClick={onClose} role="presentation">
      <div
        className="metricInfoCard glass"
        role="dialog"
        aria-modal="true"
        aria-labelledby="metric-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          className="authModalClose"
          onClick={onClose}
          aria-label={isAr ? 'إغلاق' : 'Close'}
        >
          <X size={20} aria-hidden="true" />
        </button>

        <div className="metricModalHeader">
          <div className="metricModalTitleGroup">
            <span className="tag experimental" style={{ marginBottom: '8px' }}>
              <Activity size={12} aria-hidden="true" /> {info.tag}
            </span>
            <h2 id="metric-modal-title" className="metricModalTitle">
              {info.title}
            </h2>
          </div>

          {currentScore !== undefined && currentScore !== null ? (
            <div className="metricScoreBadge">
              <span className="metricScoreBadgeValue">
                {currentScore}
                <small>/100</small>
              </span>
              {currentBand ? (
                <span className="tag band-moderate">{currentBand}</span>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Section 1: What it measures */}
        <div className="metricInfoSection" style={{ borderTop: 'none', paddingTop: 0, marginTop: '14px' }}>
          <h4>
            <Info size={16} aria-hidden="true" style={{ color: 'var(--blue)' }} />
            {isAr ? 'ماذا يقيس هذا المؤشر؟' : 'What does this score measure?'}
          </h4>
          <p className="extText" style={{ marginTop: '4px' }}>
            {info.whatItMeasures}
          </p>
        </div>

        {/* Section 2: How it is calculated */}
        <div className="metricInfoSection">
          <h4>
            <Sliders size={16} aria-hidden="true" style={{ color: 'var(--blue)' }} />
            {isAr ? 'طريقة الحساب والخوارزميات' : 'How is it calculated?'}
          </h4>
          <p className="extText" style={{ marginTop: '4px' }}>
            {info.howItIsCalculated}
          </p>
          <ol className="metricInfoSteps">
            {info.calculationSteps.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ol>
        </div>

        {/* Section 3: Score Scale */}
        <div className="metricInfoSection">
          <h4>
            <CheckCircle2 size={16} aria-hidden="true" style={{ color: 'var(--blue)' }} />
            {info.scaleMeaning.title}
          </h4>
          <p className="extText small muted" style={{ margin: '4px 0 8px' }}>
            {info.scaleMeaning.description}
          </p>
          <div className="metricScaleGrid">
            <div className="metricScaleItem">
              <strong>{isAr ? 'أدنى حد' : 'Minimal'}</strong>
              <p className="muted small" style={{ margin: '2px 0 0' }}>
                {info.scaleMeaning.minimal}
              </p>
            </div>
            <div className="metricScaleItem">
              <strong>{isAr ? 'خفيف' : 'Mild'}</strong>
              <p className="muted small" style={{ margin: '2px 0 0' }}>
                {info.scaleMeaning.mild}
              </p>
            </div>
            <div className="metricScaleItem">
              <strong>{isAr ? 'متوسط' : 'Moderate'}</strong>
              <p className="muted small" style={{ margin: '2px 0 0' }}>
                {info.scaleMeaning.moderate}
              </p>
            </div>
            <div className="metricScaleItem">
              <strong>{isAr ? 'واضح ومكثف' : 'Pronounced'}</strong>
              <p className="muted small" style={{ margin: '2px 0 0' }}>
                {info.scaleMeaning.pronounced}
              </p>
            </div>
          </div>
        </div>

        {/* Section 4: Technical Specifications */}
        <div className="metricInfoSection">
          <h4>{isAr ? 'المواصفات التقنية والتشريحية' : 'Technical Specifications'}</h4>
          <ul className="regionChips" style={{ marginTop: '8px' }}>
            <li>
              {isAr ? 'المناطق المحللة:' : 'Regions:'} <b>{info.technicalSpecs.regions}</b>
            </li>
            <li>
              {isAr ? 'الخوارزمية:' : 'Algorithm:'} <b>{info.technicalSpecs.algorithm}</b>
            </li>
            <li>
              {isAr ? 'المعايرة:' : 'Normalization:'} <b>{info.technicalSpecs.normalization}</b>
            </li>
          </ul>
        </div>

        {/* Section 5: Clinical Notice */}
        <div className="metricInfoSection" style={{ paddingBottom: 0 }}>
          <p className="notice" style={{ margin: 0 }}>
            <Info size={14} aria-hidden="true" />
            {info.clinicalNote}
          </p>
        </div>

        <div className="metricModalFooter">
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ minWidth: '110px' }}>
            {isAr ? 'إغلاق' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
}
