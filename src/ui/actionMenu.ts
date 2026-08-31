/**
 * 场景内上下文动作菜单：点击地块/动物/水边等弹出的小按钮组。
 */
import { h, clearChildren, spriteImg } from './dom';
import { focusFirst, restoreFocus } from './focus';

let root: HTMLElement | null = null;
let restoreTarget: HTMLElement | null = null;

export function initActionMenu(): void {
  root = h('div', { class: 'action-menu hidden', role: 'group', 'aria-label': 'Context actions' });
  document.body.append(root);
}

export interface MenuAction {
  label: string;
  icon?: string;
  disabled?: boolean;
  onClick: () => void;
}

export interface ActionMenuViewport {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function actionMenuPlacement(sx: number, sy: number, width: number, height: number, viewport: ActionMenuViewport, margin = 8): { x: number; y: number } {
  const minX = viewport.left + margin;
  const maxX = Math.max(minX, viewport.left + viewport.width - width - margin);
  const minY = viewport.top + margin;
  const maxY = Math.max(minY, viewport.top + viewport.height - height - margin);
  return { x: Math.min(maxX, Math.max(minX, sx - width / 2)), y: Math.min(maxY, Math.max(minY, sy - height - 16)) };
}

function safeInset(name: string): number {
  return Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
}

export function showActionMenu(sx: number, sy: number, title: string, actions: MenuAction[]): void {
  if (!root) return;
  restoreTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  clearChildren(root);
  root.append(h('div', { class: 'action-menu-title' }, title));
  for (const a of actions) {
    const btn = h('button', {
      class: `action-btn ${a.disabled ? 'disabled' : ''}`, type: 'button',
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
  const visual = window.visualViewport;
  const viewportLeft = visual?.offsetLeft ?? 0;
  const viewportTop = visual?.offsetTop ?? 0;
  const viewport = {
    left: viewportLeft + safeInset('--safe-left'),
    top: viewportTop + safeInset('--safe-top'),
    width: (visual?.width ?? window.innerWidth) - safeInset('--safe-left') - safeInset('--safe-right'),
    height: (visual?.height ?? window.innerHeight) - safeInset('--safe-top') - safeInset('--safe-bottom'),
  };
  root.style.maxWidth = `${Math.max(0, viewport.width - 16)}px`;
  root.style.maxHeight = `${Math.max(0, viewport.height - 16)}px`;
  // Position after constraining the menu so oversized action groups are measured at their scrollable size.
  const rect = root.getBoundingClientRect();
  const { x, y } = actionMenuPlacement(sx, sy, rect.width, rect.height, viewport);
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
