import { create } from 'zustand';

interface ToastAction {
  label: string;
  run: () => void;
}
interface Toast {
  id: number;
  msg: string;
  action?: ToastAction;
  tone?: 'error';
}

const useToasts = create<{ list: Toast[] }>(() => ({ list: [] }));
let next = 1;

/** Shows a short message at the bottom of the screen. With an action (e.g. Undo) it stays a little longer. */
export function toast(msg: string, opts: { action?: ToastAction; tone?: 'error'; ms?: number } = {}) {
  const id = next++;
  useToasts.setState((s) => ({ list: [...s.list.slice(-2), { id, msg, action: opts.action, tone: opts.tone }] }));
  setTimeout(() => dismiss(id), opts.ms ?? (opts.action ? 7000 : opts.tone === 'error' ? 5000 : 2600));
}

const dismiss = (id: number) => useToasts.setState((s) => ({ list: s.list.filter((t) => t.id !== id) }));

export function Toaster() {
  const list = useToasts((s) => s.list);
  if (!list.length) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={'toast' + (t.tone === 'error' ? ' toast-error' : '')}>
          <span>{t.msg}</span>
          {t.action && (
            <button
              className="toast-action"
              onClick={() => {
                t.action!.run();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
