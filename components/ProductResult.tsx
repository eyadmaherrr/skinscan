'use client';

import Image from 'next/image';
import { CalendarDays, Info, ScanBarcode } from 'lucide-react';
import { fill, useI18n } from './LocaleProvider';
import { bookingLink } from '@/lib/public-config';
import { format } from '@/lib/messages';
import { benefitSummary, type Source } from '@/lib/products/ingredients';
import type { ProductInfo, ProductSource } from '@/lib/products/types';

const ODBL_URL = 'https://opendatacommons.org/licenses/odbl/1-0/';

interface Props {
  product: ProductInfo;
  source: ProductSource;
  onAnother: () => void;
}

/**
 * A looked-up product: what its well-established ingredients are commonly
 * used for (answer first), then those ingredients, then the full list,
 * sources and attribution. Book a consultation is the one primary action
 * (docs/UX_RULES.md G1).
 */
export default function ProductResult({ product, source, onAnother }: Props) {
  const { t: messages, locale } = useI18n();
  const t = messages.product;
  const r = t.result;
  const join = (items: string[]) => items.join(locale === 'ar' ? '، ' : ', ');
  const summary = benefitSummary(product.matches);
  const sources = [...new Map(product.matches.flatMap((m) => m.sources).map((s: Source) => [s.url, s])).values()];
  const name = product.name ?? r.unnamed;
  const meta = [product.brand, product.quantity].filter(Boolean).join(' · ');

  return (
    <article className="productResult" aria-labelledby="product-title">
      <section className="glass productCard">
        <header className="productHead">
          {product.image ? (
            <span className="productImage">
              <Image src={product.image} alt={r.imageAlt} width={96} height={96} unoptimized />
            </span>
          ) : (
            <span className="productImage productImageEmpty" aria-hidden>
              <ScanBarcode size={30} />
            </span>
          )}
          <div className="productTitle">
            <span className="eyebrow">{r.found}</span>
            <h1 id="product-title" tabIndex={-1}>
              {name}
            </h1>
            {meta ? <p className="productMeta">{meta}</p> : null}
            <p className="productMeta">
              {fill(r.barcode, { code: <span dir="ltr">{product.code}</span> })}
            </p>
          </div>
        </header>

        <p className="productNotAdvice">
          <Info size={16} aria-hidden /> {r.notAdvice}
        </p>

        {product.ingredientCount === 0 ? (
          <div className="productEmpty" role="status">
            <h2>{r.noIngredientsTitle}</h2>
            <p>{r.noIngredients}</p>
          </div>
        ) : product.matches.length === 0 ? (
          <div className="productEmpty" role="status">
            <h2>{r.noneDescribedTitle}</h2>
            <p>{format(r.noneDescribed, { count: product.ingredientCount })}</p>
          </div>
        ) : (
          <>
            <h2 className="productSection">{r.helpsTitle}</h2>
            <ul className="benefitList">
              {summary.map(({ benefit, from }) => (
                <li key={benefit}>
                  <b>{t.benefits[benefit]}</b>
                  <span>{join(from.map((key) => t.ingredients[key]))}</span>
                </li>
              ))}
            </ul>

            <h2 className="productSection">{r.ingredientsTitle}</h2>
            <ul className="ingredientList">
              {product.matches.map((match) => (
                <li key={match.key}>
                  <b>{t.ingredients[match.key]}</b>
                  <span className="ingredientListed">
                    {fill(r.listedAs, { name: <span dir="ltr">{match.asListed}</span> })}
                  </span>
                  <span>{format(r.usedFor, { benefits: join(match.benefits.map((b) => t.benefits[b])) })}</span>
                </li>
              ))}
            </ul>
            <p className="muted small">{r.amountNote}</p>
          </>
        )}

        {product.ingredientsText ? (
          <details className="productDetails">
            <summary>{r.fullList}</summary>
            <p dir="ltr" lang="en">
              {product.ingredientsText}
            </p>
          </details>
        ) : null}

        {sources.length ? (
          <details className="productDetails">
            <summary>{r.sources}</summary>
            <ol dir="ltr" lang="en">
              {sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="inlineLink">
                    {s.label}
                  </a>
                </li>
              ))}
            </ol>
          </details>
        ) : null}

        <p className="fine productAttribution">
          {fill(r.attribution, {
            source: (
              <a href={source.url} target="_blank" rel="noopener noreferrer" className="inlineLink">
                {source.name}
              </a>
            ),
            licence: (
              <a href={ODBL_URL} target="_blank" rel="noopener noreferrer" className="inlineLink">
                {r.licence}
              </a>
            ),
          })}
          {source.imageLicence ? ` ${r.imageCredit}` : null}
        </p>
      </section>

      <div className="actions productActions">
        <a className="btn btn-primary" href={bookingLink(locale)}>
          <CalendarDays size={18} aria-hidden /> {r.book}
        </a>
        <button type="button" className="btn btn-ghost" onClick={onAnother}>
          <ScanBarcode size={18} aria-hidden /> {r.another}
        </button>
      </div>
    </article>
  );
}
