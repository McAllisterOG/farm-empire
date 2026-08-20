import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { focusTrapTargetIndex } from '../src/ui/focus';
import { runtimeFailureKeyAction } from '../src/ui/runtimeFailurePolicy';

const title = readFileSync(resolve('src/farmMain.ts'), 'utf8');
const modal = readFileSync(resolve('src/ui/modal.ts'), 'utf8');
const menu = readFileSync(resolve('src/ui/actionMenu.ts'), 'utf8');
const app = readFileSync(resolve('src/game/farmEmpireApp.ts'), 'utf8');
const styles = readFileSync(resolve('src/styles.css'), 'utf8');

describe('Demo polish interaction contracts', () => {
  it('uses native, separately-addressable title slot controls', () => {
    expect(title).toContain("h('button', {");
    expect(title).toContain("type: 'button', 'data-testid': `load-slot-${slot}`");
    expect(title).toContain("type: 'button', 'data-testid': `new-game-slot-${slot}`");
    expect(title).toContain("type: 'button', 'data-testid': `delete-slot-${slot}`");
    expect(title).toContain('aria-label');
  });

  it('gives panels, dialogs, and action menus keyboard focus discipline', () => {
    expect(modal).toContain("panelBox.setAttribute('role', 'dialog')");
    expect(modal).toContain("panelBox.setAttribute('aria-modal', 'true')");
    expect(modal).toContain('trapFocus(event, panelBox)');
    expect(modal).toContain('restoreFocus(restoreTarget)');
    expect(menu).toContain("role: 'menu'");
    expect(menu).toContain("role: 'menuitem'");
    expect(menu).toContain('focusFirst(root)');
  });

  it('clears stale overlays and interaction hints on scene transitions', () => {
    expect(app).toContain('hideActionMenu(); if (isPanelOpen()) closePanel();');
    expect(app).toContain('this.hover = null; this.townHover = null; this.fieldDragSelection = [];');
  });

  it('wraps overlay focus and maps Escape to the non-destructive title recovery action', () => {
    expect(focusTrapTargetIndex('Tab', false, 1, 2)).toBe(0);
    expect(focusTrapTargetIndex('Tab', true, 0, 2)).toBe(1);
    expect(focusTrapTargetIndex('Tab', false, -1, 2)).toBe(0);
    expect(focusTrapTargetIndex('Tab', false, 0, 2)).toBeNull();
    expect(focusTrapTargetIndex('Tab', false, -1, 0)).toBe(-1);
    expect(runtimeFailureKeyAction('Escape')).toBe('return-to-title');
    expect(runtimeFailureKeyAction('Enter')).toBeNull();
  });

  it('uses one renderer recovery surface and keeps the compact title within the viewport', () => {
    expect(styles).toContain('@media (max-width: 560px)');
    expect(styles).toContain('.farm-title-logo { font-size: clamp(');
  });
});
