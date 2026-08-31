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
let pendingTabFocusId: string | null = null;
let dialogSequence = 0;

function domId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

/** Returns the next roving-tab index for the supported tablist keys. */
export function rovingTabIndex(key: string, current: number, count: number): number | null {
  if (count === 0) return null;
  if (key === 'ArrowLeft') return (current - 1 + count) % count;
  if (key === 'ArrowRight') return (current + 1) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

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

  const tabs = spec.tabs ?? [];
  const activeTab = tabs.some((tab) => tab.id === spec.activeTab) ? spec.activeTab : tabs[0]?.id;
  if (tabs.length > 0) {
    const tabBar = h('div', { class: 'tab-bar', role: 'tablist', 'aria-label': `${spec.title} sections` });
    const activateTab = (id: string): void => {
      pendingTabFocusId = id;
      spec.onTab?.(id);
    };
    for (const [index, tab] of tabs.entries()) {
      const tabId = `farm-panel-tab-${domId(tab.id)}`;
      const panelId = `farm-panel-tabpanel-${domId(tab.id)}`;
      const btn = h('button', {
        class: `tab-btn ${tab.id === activeTab ? 'active' : ''}`,
        id: tabId,
        role: 'tab',
        type: 'button',
        'aria-selected': tab.id === activeTab ? 'true' : 'false',
        'aria-controls': panelId,
        tabindex: tab.id === activeTab ? '0' : '-1',
        onclick: () => activateTab(tab.id),
        onkeydown: (event) => {
          const next = rovingTabIndex((event as KeyboardEvent).key, index, tabs.length);
          if (next === null) return;
          event.preventDefault();
          activateTab(tabs[next].id);
        },
      }, tab.label);
      tabBar.append(btn);
    }
    panelBox.append(tabBar);
  }

  const panels = new Map<string, HTMLElement>();
  if (tabs.length > 0) {
    for (const tab of tabs) {
      const isActive = tab.id === activeTab;
      const panel = h('div', {
        class: 'panel-body',
        id: `farm-panel-tabpanel-${domId(tab.id)}`,
        role: 'tabpanel',
        'aria-labelledby': `farm-panel-tab-${domId(tab.id)}`,
        ...(isActive ? { tabindex: '0' } : { hidden: 'true' }),
      });
      panels.set(tab.id, panel);
      panelBox.append(panel);
    }
  } else {
    const panel = h('div', { class: 'panel-body' });
    panels.set('', panel);
    panelBox.append(panel);
  }
  spec.body(panels.get(activeTab ?? '')!);
  overlay.classList.remove('hidden');
  const focusTabId = pendingTabFocusId;
  pendingTabFocusId = null;
  queueMicrotask(() => {
    if (!panelBox) return;
    const target = focusTabId ? panelBox.querySelector<HTMLElement>(`#farm-panel-tab-${domId(focusTabId)}`) : null;
    if (target) target.focus(); else focusFirst(panelBox);
  });
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

function labelledDialog(title: string, description: HTMLElement): { box: HTMLElement; descriptionId: string } {
  const id = ++dialogSequence;
  const titleEl = h('div', { class: 'dialog-title', id: `farm-dialog-title-${id}` }, title);
  description.id = `farm-dialog-description-${id}`;
  return { descriptionId: description.id, box: h('div', {
    class: 'dialog-box',
    'aria-labelledby': titleEl.id,
    'aria-describedby': description.id,
  }, titleEl, description) };
}

export function confirmDialog(text: string, onYes: () => void): void {
  let close = (): void => {};
  const yes = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { close(); onYes(); } }, t('ui.confirm'));
  const cancel = h('button', { class: 'btn', type: 'button', onclick: () => close() }, t('ui.cancel'));
  const { box } = labelledDialog('Confirm action', h('div', { class: 'dialog-text' }, text));
  box.append(h('div', { class: 'dialog-btns' }, yes, cancel));
  openDialog(box, yes);
  close = () => (box.parentElement as HTMLElement & { closeDialog?: () => void } | null)?.closeDialog?.();
}

export function promptDialog(text: string, defaultValue: string, onSubmit: (v: string) => void): void {
  const input = h('input', { class: 'dialog-input', value: defaultValue }) as HTMLInputElement;
  input.value = defaultValue;
  let close = (): void => {};
  const submit = (): void => { const value = input.value; close(); onSubmit(value); };
  const { box, descriptionId } = labelledDialog('Enter value', h('div', { class: 'dialog-text' }, text));
  input.setAttribute('aria-labelledby', descriptionId);
  box.append(input, h('div', { class: 'dialog-btns' },
    h('button', { class: 'btn btn-primary', type: 'button', onclick: submit }, t('ui.confirm')),
    h('button', { class: 'btn', type: 'button', onclick: () => close() }, t('ui.cancel')),
  ));
  input.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    ev.stopPropagation();
    submit();
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
  const { box } = labelledDialog(title, body);
  box.append(h('div', { class: 'dialog-btns' }, confirm));
  openDialog(box, confirm, onClose);
  close = () => (box.parentElement as HTMLElement & { closeDialog?: () => void } | null)?.closeDialog?.();
}
