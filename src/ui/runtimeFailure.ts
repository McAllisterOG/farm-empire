import { h } from './dom';
import { focusFirst, restoreFocus, trapFocus } from './focus';
import { runtimeFailureKeyAction } from './runtimeFailurePolicy';

let failureRoot: HTMLElement | null = null;
let returnToTitleHandler: (() => void) | null = null;

export function setRuntimeReturnToTitle(handler: (() => void) | null): void {
  returnToTitleHandler = handler;
}

/** One renderer-owned recovery surface for uncaught runtime failures. */
export function showRuntimeFailure(message = 'Farm Empire ran into a problem. Your last saved farm is safe.'): void {
  if (failureRoot) return;
  console.error('[Farm Empire] renderer recovery surface shown');
  const priorFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  let root: HTMLElement | null = null;
  const dismiss = (returnToTitle: boolean): void => {
    if (!root) return;
    root.removeEventListener('keydown', onKeyDown);
    root.remove();
    root = null;
    failureRoot = null;
    if (returnToTitle && returnToTitleHandler) returnToTitleHandler();
    else if (returnToTitle) window.location.reload();
    restoreFocus(priorFocus);
  };
  const returnToTitle = (): void => {
    dismiss(true);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (runtimeFailureKeyAction(event.key) === 'return-to-title') { event.preventDefault(); dismiss(true); return; }
    if (root) trapFocus(event, root);
  };
  root = h('div', { class: 'runtime-failure', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'runtime-failure-title' },
    h('div', { class: 'runtime-failure-box' },
      h('h1', { id: 'runtime-failure-title' }, 'Farm Empire needs to recover'),
      h('p', {}, message),
      h('div', { class: 'dialog-btns' },
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => window.location.reload() }, 'Reload'),
        h('button', { class: 'btn', type: 'button', onclick: returnToTitle }, 'Return to Title'),
      ),
    ),
  );
  failureRoot = root;
  root.addEventListener('keydown', onKeyDown);
  document.body.append(root);
  queueMicrotask(() => root && focusFirst(root));
}

export function installRuntimeFailureCapture(): void {
  window.addEventListener('error', (event) => {
    console.error('[Farm Empire] uncaught renderer error', event.error ?? event.message);
    showRuntimeFailure();
  });
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Farm Empire] unhandled renderer rejection', event.reason);
    showRuntimeFailure();
  });
}
