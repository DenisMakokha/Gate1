import React from 'react';
import type { BannerItem } from './ui';

type Props = {
  items: BannerItem[];
  onDismiss: (id: string) => void;
};

function cls(kind: BannerItem['kind']) {
  if (kind === 'warning') return 'banner bannerWarn';
  if (kind === 'error') return 'banner bannerError';
  return 'banner';
}

export function Banners(props: Props) {
  if (!props.items.length) return null;
  return (
    <div className="banners">
      {props.items.map((b) => (
        <div className={cls(b.kind)} key={b.id}>
          <div className="bannerMain">
            <div className="bannerTitle">{b.title}</div>
            {b.message ? <div className="bannerMsg">{b.message}</div> : null}
          </div>
          <div className="bannerActions">
            <button className="btn" onClick={() => props.onDismiss(b.id)}>
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
