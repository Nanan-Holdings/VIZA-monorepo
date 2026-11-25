import { Check } from "../ui/Icons";

export type CompareRow = { label: string; values: string[] };

type Props = {
  caption: string;
  criteriaLabel: string;
  columns: string[];
  rows: CompareRow[];
};

/**
 * Framer "choose your plan" table: a narrow criteria card beside a wider card of plan columns, each value
 * with a green tick. Built as one real table (a spacer column draws the gap between the two cards).
 */
export default function CompareTable({ caption, criteriaLabel, columns, rows }: Props) {
  return (
    <div className="ds-compare" data-reveal="">
      <table>
        <caption className="ds-sr">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="ds-compare-crit">
              {criteriaLabel}
            </th>
            <td className="ds-compare-gap" aria-hidden="true" />
            {columns.map((c) => (
              <th scope="col" key={c} className="ds-compare-col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row" className="ds-compare-crit">
                {row.label}
              </th>
              <td className="ds-compare-gap" aria-hidden="true" />
              {row.values.map((v, i) => (
                <td key={`${row.label}-${i}`} className="ds-compare-val">
                  <span className="ds-compare-cell">
                    <span className="ds-compare-tick" aria-hidden="true">
                      <Check size={10} />
                    </span>
                    <span>{v}</span>
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
