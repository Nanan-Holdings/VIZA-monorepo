import type { ReactNode } from "react";

type Props = {
  title: string;
  lede?: ReactNode;
  /** Small facts under the title, for example "Last updated" and its date. */
  meta?: Array<{ label: string; value: string }>;
};

/** Index and legal opening from the Framer blog and legal pages: a very large plain title, the lede beside it. */
export default function PageHead({ title, lede, meta }: Props) {
  return (
    <section className="ds-pagehead">
      <div className="ds-container">
        <div className="ds-pagehead-grid">
          <h1 className="ds-pagehead-title" data-reveal="hero">
            {title}
          </h1>
          {lede ? <p className="ds-body ds-pagehead-lede" data-reveal="hero">{lede}</p> : null}
        </div>
        {meta && meta.length > 0 ? (
          <ul className="ds-pagehead-meta">
            {meta.map((m) => (
              <li key={m.label}>
                {m.label}
                <b>{m.value}</b>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
