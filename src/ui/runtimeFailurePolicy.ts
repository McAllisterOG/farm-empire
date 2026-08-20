export type RuntimeFailureKeyAction = 'return-to-title' | null;

/** Kept pure so Escape recovery behavior is covered without a DOM harness. */
export function runtimeFailureKeyAction(key: string): RuntimeFailureKeyAction {
  return key === 'Escape' ? 'return-to-title' : null;
}
