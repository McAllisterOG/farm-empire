/** Small, shared focus primitives for overlays. Kept independent of game state. */
const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusableChildren(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(focusableSelector)]
    .filter((element) => !element.hasAttribute('hidden') && element.getClientRects().length > 0);
}

export function focusFirst(container: HTMLElement): void {
  focusableChildren(container)[0]?.focus();
}

/** Returns the wrapped focus index, or null when native Tab behavior should continue. */
export function focusTrapTargetIndex(key: string, shiftKey: boolean, activeIndex: number, itemCount: number): number | null {
  if (key !== 'Tab') return null;
  if (itemCount === 0) return -1;
  if (shiftKey && activeIndex <= 0) return itemCount - 1;
  if (!shiftKey && (activeIndex < 0 || activeIndex === itemCount - 1)) return 0;
  return null;
}

export function trapFocus(event: KeyboardEvent, container: HTMLElement): void {
  if (event.key !== 'Tab') return;
  const items = focusableChildren(container);
  const index = items.indexOf(document.activeElement as HTMLElement);
  const targetIndex = focusTrapTargetIndex(event.key, event.shiftKey, index, items.length);
  if (targetIndex === null) return;
  event.preventDefault();
  if (targetIndex < 0) container.focus();
  else items[targetIndex]?.focus();
}

export function restoreFocus(target: HTMLElement | null): void {
  if (target?.isConnected && target.getClientRects().length > 0) target.focus();
}
