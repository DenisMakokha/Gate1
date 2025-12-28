import React from 'react';
import type { ToastItem } from './ui';

type Props = {
  items: ToastItem[];
};

function cls(kind: ToastItem['kind']) {
  if (kind === 'success') return 'toast toastSuccess';
  if (kind === 'warning') return 'toast toastWarn';
  if (kind === 'error') return 'toast toastError';
  return 'toast';
}

export function Toasts(props: Props) {
  return (
    <div className="toasts">
      {props.items.map((t) => (
        <div className={cls(t.kind)} key={t.id}>
          <div className="toastTitle">{t.title}</div>
          {t.message ? <div className="toastMsg">{t.message}</div> : null}
        </div>
      ))}
    </div>
  );
}
