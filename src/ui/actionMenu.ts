/**
 * 场景内上下文动作菜单：点击地块/动物/水边等弹出的小按钮组。
 */
import { h, clearChildren, spriteImg } from './dom';
import { focusFirst, restoreFocus } from './focus';

let root: HTMLElement | null = null;
let restoreTarget: HTMLElement | null = null;

export function initActionMenu(): void {
  root = h('div', { class: 'action-menu hidden', role: 'menu', 'aria-label': 'Context actions' });
  document.body.append(root);
}

export interface MenuAction {
  label: string;
  icon?: string;
  disabled?: boolean;
  onClick: () => void;
}

export function showActionMenu(sx: number, sy: number, title: string, actions: MenuAction[]): void {
  if (!root) return;
  restoreTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  clearChildren(root);
  root.append(h('div', { class: 'action-menu-title' }, title));
  for (const a of actions) {
    const btn = h('button', {
      class: `action-btn ${a.disabled ? 'disabled' : ''}`, role: 'menuitem', type: 'button',
      ...(a.disabled ? { disabled: 'true' } : {}),
      onclick: () => {
        if (a.disabled) return;
        hideActionMenu(false);
        a.onClick();
      },
    }, a.icon ? spriteImg(a.icon, 'icon-sm') : null, h('span', {}, a.label));
    root.append(btn);
  }
  root.classList.remove('hidden');
  // 位置：靠近点击处但不出屏
  const rect = root.getBoundingClientRect();
  const x = Math.min(window.innerWidth - rect.width - 8, Math.max(8, sx - rect.width / 2));
  const y = Math.min(window.innerHeight - rect.height - 8, Math.max(8, sy - rect.height - 16));
  root.style.left = `${x}px`;
  root.style.top = `${y}px`;
  focusFirst(root);
}

export function hideActionMenu(restore = true): void {
  root?.classList.add('hidden');
  if (restore) restoreFocus(restoreTarget);
  restoreTarget = null;
}

export function isActionMenuOpen(): boolean {
  return !!root && !root.classList.contains('hidden');
}
