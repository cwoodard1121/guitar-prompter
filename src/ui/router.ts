import { useSyncExternalStore } from 'react';

/**
 * Hash routes, so a static site survives refreshes and deep links with no server:
 *   #/            library            #/sets        setlists
 *   #/song/:id    editor             #/play/:id    teleprompter (?set=:setId to play through a setlist)
 *   #/set/:id     one setlist        #/s/:token    a song someone shared
 */
export type Route =
  | { name: 'library'; tab: 'songs' | 'sets' }
  | { name: 'song'; id: string }
  | { name: 'play'; id: string; set?: string }
  | { name: 'set'; id: string }
  | { name: 'share'; token: string };

const HOME: Route = { name: 'library', tab: 'songs' };

export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#/, '');
  const [path, query = ''] = raw.split('?');
  const seg = path.split('/').filter(Boolean).map(decodeURIComponent);
  const q = new URLSearchParams(query);
  switch (seg[0]) {
    case 'sets':
      return { name: 'library', tab: 'sets' };
    case 'song':
      return seg[1] ? { name: 'song', id: seg[1] } : HOME;
    case 'play':
      return seg[1] ? { name: 'play', id: seg[1], ...(q.get('set') ? { set: q.get('set')! } : {}) } : HOME;
    case 'set':
      return seg[1] ? { name: 'set', id: seg[1] } : HOME;
    case 's':
      return seg[1] ? { name: 'share', token: seg[1] } : HOME;
    default:
      return HOME; // also covers auth leftovers like #error=…
  }
}

export function routeHref(r: Route): string {
  const e = encodeURIComponent;
  switch (r.name) {
    case 'library':
      return r.tab === 'sets' ? '#/sets' : '#/';
    case 'song':
      return `#/song/${e(r.id)}`;
    case 'play':
      return `#/play/${e(r.id)}${r.set ? `?set=${e(r.set)}` : ''}`;
    case 'set':
      return `#/set/${e(r.id)}`;
    case 'share':
      return `#/s/${e(r.token)}`;
  }
}

export function navigate(r: Route, replace = false) {
  const href = routeHref(r);
  if (location.hash === href) return;
  if (replace) {
    history.replaceState(history.state, '', href);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else location.hash = href;
}

let current = parseRoute(typeof location === 'undefined' ? '' : location.hash);
const subscribe = (cb: () => void) => {
  const h = () => {
    current = parseRoute(location.hash);
    cb();
  };
  window.addEventListener('hashchange', h);
  return () => window.removeEventListener('hashchange', h);
};

export const useRoute = (): Route => useSyncExternalStore(subscribe, () => current);
