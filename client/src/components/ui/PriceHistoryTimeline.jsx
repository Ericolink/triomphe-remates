import { TrendingDown, TrendingUp, History } from 'lucide-react';
import { formatPrice, formatDate } from '../../utils/formatters';
import { STATUS_LABELS } from '../../utils/constants';

function describeEntry(entry) {
  if (entry.changeType === 'price') {
    const from = Number(entry.fromPrice);
    const to = Number(entry.toPrice);
    const down = to < from;
    return {
      icon: down ? (
        <TrendingDown size={16} className="text-green-600" />
      ) : (
        <TrendingUp size={16} className="text-red-500" />
      ),
      text: (
        <>
          Precio {down ? 'bajó' : 'subió'} de{' '}
          <span className="font-semibold">{formatPrice(from)}</span> a{' '}
          <span className="font-semibold">{formatPrice(to)}</span>
        </>
      ),
    };
  }

  if (!entry.fromStatus) {
    return {
      icon: <History size={16} className="text-primary-600" />,
      text: (
        <>
          Primer ingreso al catálogo como{' '}
          <span className="font-semibold">{STATUS_LABELS[entry.toStatus] || entry.toStatus}</span>
        </>
      ),
    };
  }

  return {
    icon: <History size={16} className="text-primary-600" />,
    text: (
      <>
        Estatus cambió de{' '}
        <span className="font-semibold">{STATUS_LABELS[entry.fromStatus] || entry.fromStatus}</span>{' '}
        a <span className="font-semibold">{STATUS_LABELS[entry.toStatus] || entry.toStatus}</span>
      </>
    ),
  };
}

export default function PriceHistoryTimeline({ history }) {
  if (!history || history.length < 2) return null;

  return (
    <div className="space-y-3">
      {history.map((entry) => {
        const { icon, text } = describeEntry(entry);
        return (
          <div key={entry.id} className="flex items-start gap-3">
            <div className="mt-1 flex-shrink-0">{icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 dark:text-gray-300">{text}</p>
              <p className="text-xs text-gray-400 mt-0.5">{formatDate(entry.createdAt)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
