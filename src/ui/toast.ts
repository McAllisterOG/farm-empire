/**
 * 飘字提示：右上角 toast 队列 + 场景内浮动文字（+经验/+金币）。
 */
import { h } from './dom';

let toastRoot: HTMLElement | null = null;
let toastAnnouncement: HTMLElement | null = null;
let floatRoot: HTMLElement | null = null;

export function initToast(): void {
  toastRoot = h('div', { class: 'toast-root' });
  toastAnnouncement = h('div', { class: 'toast-announcement', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  floatRoot = h('div', { class: 'float-root' });
  document.body.append(toastRoot, toastAnnouncement, floatRoot);
}

function announceToast(text: string): void {
  if (!toastAnnouncement) return;
  // Clear first so repeated text is a new, single announcement rather than a replay of the visual queue.
  toastAnnouncement.textContent = '';
  queueMicrotask(() => { if (toastAnnouncement) toastAnnouncement.textContent = text; });
}

export function toast(text: string, kind: 'info' | 'good' | 'bad' = 'info'): void {
  if (!toastRoot) return;
  const el = h('div', { class: `toast toast-${kind}` }, text);
  toastRoot.append(el);
  announceToast(text);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
  }, 2600);
  // 最多同时 4 条
  while (toastRoot.children.length > 4) toastRoot.firstElementChild?.remove();
}

/** 屏幕坐标处冒出漂浮文字 */
export function floatText(sx: number, sy: number, text: string, cls = ''): void {
  if (!floatRoot) return;
  const el = h('div', { class: `float-text ${cls}` }, text);
  el.style.left = `${sx}px`;
  el.style.top = `${sy}px`;
  floatRoot.append(el);
  requestAnimationFrame(() => el.classList.add('rise'));
  setTimeout(() => el.remove(), 1500);
}
