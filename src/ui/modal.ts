/**
 * 模态面板框架：同一时间只开一个主面板；支持标题、标签页、关闭按钮。
 * 另提供轻量 confirm / prompt 对话框（替代原生阻塞式弹窗）。
 */
import { h, clearChildren } from './dom';
import { t } from '../i18n';
import { sfx } from '../audio/sound';
import { focusFirst, restoreFocus, trapFocus } from './focus';

let overlay: HTMLElement | null = null;
let panelBox: HTMLElement | null = null;
let onCloseCb: (() => void) | null = null;
let restoreTarget: HTMLElement | null = null;

export function initModal(): void {
  overlay = h('div', { class: 'modal-overlay hidden' });
  overlay.addEventListener('pointerdown', (ev) => {
    if (ev.target === overlay) closePanel();
  });
  panelBox = h('div', { class: 'modal-panel' });
  overlay.append(panelBox);
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); closePanel(); return; }
    if (panelBox) trapFocus(event, panelBox);
  });
  document.body.append(overlay);
}

export function isPanelOpen(): boolean {
  return !!overlay && !overlay.classList.contains('hidden');
}

export interface PanelSpec {
  title: string;
  className?: string;
  tabs?: { id: string; label: string }[];
  activeTab?: string;
  onTab?: (id: string) => void;
  onClose?: () => void;
  body: (container: HTMLElement) => void;
}

export function openPanel(spec: PanelSpec): void {
  if (!overlay || !panelBox) return;
  if (!isPanelOpen()) restoreTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  sfx('click');
  onCloseCb = spec.onClose ?? null;
  clearChildren(panelBox);
  panelBox.className = `modal-panel ${spec.className ?? ''}`;

  const titleId = 'farm-panel-title';
  panelBox.setAttribute('role', 'dialog');
  panelBox.setAttribute('aria-modal', 'true');
  panelBox.setAttribute('aria-labelledby', titleId);
  panelBox.tabIndex = -1;
  const header = h('div', { class: 'panel-header' },
    h('span', { class: 'panel-title', id: titleId }, spec.title),
    h('button', { class: 'btn-close', type: 'button', 'aria-label': 'Close panel', onclick: () => closePanel() }, '✕'),
  );
  panelBox.append(header);

  if (spec.tabs && spec.tabs.length > 0) {
    const tabBar = h('div', { class: 'tab-bar' });
    for (const tab of spec.tabs) {
      const btn = h('button', {
        class: `tab-btn ${tab.id === spec.activeTab ? 'active' : ''}`,
        onclick: () => spec.onTab?.(tab.id),
      }, tab.label);
      tabBar.append(btn);
    }
    panelBox.append(tabBar);
  }

  const body = h('div', { class: 'panel-body' });
  panelBox.append(body);
  spec.body(body);
  overlay.classList.remove('hidden');
  queueMicrotask(() => panelBox && focusFirst(panelBox));
}

export function closePanel(): void {
  if (!overlay) return;
  overlay.classList.add('hidden');
  const cb = onCloseCb;
  onCloseCb = null;
  cb?.();
  restoreFocus(restoreTarget);
  restoreTarget = null;
}

/** 重绘当前面板主体（数据变化后刷新） */
export function refreshPanel(spec: PanelSpec): void {
  if (isPanelOpen()) openPanel(spec);
}

// ---------------------------------------------------------------- 轻量对话框

function openDialog(box: HTMLElement, initialFocus: HTMLElement | null, onClose?: () => void): void {
  const prior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const root = h('div', { class: 'dialog-overlay', role: 'presentation' }, box);
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.tabIndex = -1;
  const close = (): void => { root.remove(); onClose?.(); restoreFocus(prior); };
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    trapFocus(event, box);
  });
  document.body.append(root);
  queueMicrotask(() => (initialFocus ?? box).focus());
  (root as HTMLElement & { closeDialog?: () => void }).closeDialog = close;
}

export function confirmDialog(text: string, onYes: () => void): void {
  let close = (): void => {};
  const yes = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { close(); onYes(); } }, t('ui.confirm'));
  const cancel = h('button', { class: 'btn', type: 'button', onclick: () => close() }, t('ui.cancel'));
  const box = h('div', { class: 'dialog-box' },
    h('div', { class: 'dialog-text' }, text),
    h('div', { class: 'dialog-btns' }, yes, cancel),
  );
  openDialog(box, yes);
  close = () => (box.parentElement as HTMLElement & { closeDialog?: () => void } | null)?.closeDialog?.();
}

export function promptDialog(text: string, defaultValue: string, onSubmit: (v: string) => void): void {
  const input = h('input', { class: 'dialog-input', value: defaultValue }) as HTMLInputElement;
  input.value = defaultValue;
  let close = (): void => {};
  const submit = (): void => { const value = input.value; close(); onSubmit(value); };
  const box = h('div', { class: 'dialog-box' },
    h('div', { class: 'dialog-text' }, text),
    input,
    h('div', { class: 'dialog-btns' },
      h('button', { class: 'btn btn-primary', type: 'button', onclick: submit }, t('ui.confirm')),
      h('button', { class: 'btn', type: 'button', onclick: () => close() }, t('ui.cancel')),
    ),
  );
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') submit();
  });
  openDialog(box, input);
  close = () => (box.parentElement as HTMLElement & { closeDialog?: () => void } | null)?.closeDialog?.();
}

/** 信息展示框（离线摘要、捕鱼结果等），内容自组装 */
export function infoDialog(title: string, build: (body: HTMLElement) => void, onClose?: () => void): void {
  const body = h('div', { class: 'dialog-body' });
  build(body);
  let close = (): void => {};
  const confirm = h('button', {
    class: 'btn btn-primary', type: 'button', onclick: () => close(),
  }, t('ui.confirm'));
  const box = h('div', { class: 'dialog-box', 'aria-label': title },
    h('div', { class: 'dialog-title' }, title),
    body,
    h('div', { class: 'dialog-btns' },
      confirm,
    ),
  );
  openDialog(box, confirm, onClose);
  close = () => (box.parentElement as HTMLElement & { closeDialog?: () => void } | null)?.closeDialog?.();
}
