import type { Dict } from '@/content'
import type { PaymentStage } from '@/lib/payment-stages'
import { formatUsd } from '@/lib/pricing'

// The payment stages as a table (`Этап / Что входит / Доля / Сумма`, the same columns as the builder
// summary): shares and amounts come from the live pricing through payment-stages.ts, never from copy.
export function StageTable({
  stages,
  dict,
  locale,
  title,
  note,
}: {
  stages: PaymentStage[]
  dict: Dict
  locale: 'ru' | 'en'
  title: string
  note: string
}) {
  const cols = dict.builder.stageCols
  return (
    <div className="overflow-x-auto">
      <p className="mb-3 text-sm font-medium">{title}</p>
      <table className="w-full min-w-[28rem] border-collapse text-left text-sm" data-stage-table>
        <thead>
          <tr className="border-b border-line text-xs text-faint">
            <th scope="col" className="py-2 pr-4 font-normal">{cols.stage}</th>
            <th scope="col" className="py-2 pr-4 font-normal">{cols.what}</th>
            <th scope="col" className="py-2 pr-4 text-right font-normal">{cols.share}</th>
            <th scope="col" className="py-2 text-right font-normal">{cols.amount}</th>
          </tr>
        </thead>
        <tbody>
          {stages.map((stage, i) => (
            <tr key={stage.id} className="border-b border-line last:border-0">
              <td className="py-3 pr-4 whitespace-nowrap text-muted">
                {dict.builder.stageWord} {i + 1}
              </td>
              <td className="py-3 pr-4">{stage.title[locale]}</td>
              <td className="py-3 pr-4 text-right font-mono">{stage.share}%</td>
              <td className="py-3 text-right font-mono text-accent-text">{formatUsd(stage.amountUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-[13px] leading-relaxed text-faint">{note}</p>
    </div>
  )
}
