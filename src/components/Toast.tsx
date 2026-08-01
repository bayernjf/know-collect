import type { ToastItem } from '../store';

export default function ToastContainer({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div id="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={'toast' + (t.isError ? ' error' : '')}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
