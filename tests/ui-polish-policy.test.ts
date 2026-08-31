import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { focusTrapTargetIndex } from '../src/ui/focus';
import { actionMenuPlacement } from '../src/ui/actionMenu';
import { rovingTabIndex } from '../src/ui/modal';
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

  it('gives panels and dialogs keyboard focus discipline with semantic roving tabs', () => {
    expect(modal).toContain("panelBox.setAttribute('role', 'dialog')");
    expect(modal).toContain("panelBox.setAttribute('aria-modal', 'true')");
    expect(modal).toContain('trapFocus(event, panelBox)');
    expect(modal).toContain('restoreFocus(restoreTarget)');
    expect(modal).toContain("role: 'tablist'");
    expect(modal).toContain("role: 'tab'");
    expect(modal).toContain("role: 'tabpanel'");
    expect(modal).toContain("'aria-selected'");
    expect(modal).toContain("'aria-controls'");
    expect(modal).toContain('const panels = new Map<string, HTMLElement>();');
    expect(modal).toContain("hidden: 'true'");
    expect(modal).toContain("'aria-labelledby'");
    expect(modal).toContain("'aria-describedby'");
    expect(rovingTabIndex('ArrowRight', 0, 3)).toBe(1);
    expect(rovingTabIndex('ArrowLeft', 0, 3)).toBe(2);
    expect(rovingTabIndex('Home', 2, 3)).toBe(0);
    expect(rovingTabIndex('End', 0, 3)).toBe(2);
    expect(rovingTabIndex('Enter', 0, 3)).toBeNull();
    expect(menu).toContain("role: 'group'");
    expect(menu).not.toContain("role: 'menuitem'");
    expect(menu).toContain('focusFirst(root)');
    expect(modal).toContain("input.setAttribute('aria-labelledby', descriptionId)");
  });

  it('keeps contextual action buttons inside the visual viewport margin', () => {
    expect(actionMenuPlacement(-20, -20, 120, 90, { left: 0, top: 0, width: 390, height: 240 })).toEqual({ x: 8, y: 8 });
    expect(actionMenuPlacement(500, 300, 120, 90, { left: 0, top: 0, width: 390, height: 240 })).toEqual({ x: 262, y: 142 });
    expect(actionMenuPlacement(195, 120, 374, 224, { left: 0, top: 0, width: 390, height: 240 })).toEqual({ x: 8, y: 8 });
    expect(menu).toContain('root.style.maxHeight');
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

  it('provides a short-landscape HUD, a touch Fit control, and settled iOS viewport handling', () => {
    expect(styles).toContain('@media (max-height: 500px) and (orientation: landscape)');
    expect(styles).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(styles).toContain('.farm-fit-button { display: block;');
    expect(app).toContain("window.visualViewport?.addEventListener('resize', this.onResize)");
    expect(app).toContain("window.addEventListener('orientationchange', this.onResize)");
    expect(title).toContain('title.scrollTop = 0');
  });

  it('keeps the short-landscape first-morning overlay separate and phone controls touch-readable', () => {
    expect(styles).toContain('.farm-hud-root.first-morning-active .first-delivery-chip { display: none; }');
    expect(styles).toContain('.farm-crop-button { min-width: 44px; min-height: 44px; font-size: 12px; }');
    expect(styles).toContain('.btn-close { width: 44px; height: 44px; font-size: 17px; }');
    expect(styles).toContain('.farm-actions .btn { min-height: 44px; padding: 5px 8px; font-size: 11px; white-space: nowrap; }');
    expect(styles).toContain('.farm-hud-root button { min-width: 44px; min-height: 44px; }');
    expect(styles).toContain('#title-screen button { min-width: 44px; min-height: 44px; }');
    expect(styles).toContain('height: 100dvh');
    expect(styles).toContain('max-height: calc(100dvh - 16px - var(--safe-top) - var(--safe-bottom)); overflow: auto;');
    expect(styles).toContain('@media (pointer: coarse)');
    expect(styles).toContain('.tab-btn, .action-btn { min-width: 44px; min-height: 44px; }');
    expect(readFileSync(resolve('src/ui/toast.ts'), 'utf8')).toContain("class: 'toast-announcement', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true'");
    expect(readFileSync(resolve('src/ui/toast.ts'), 'utf8')).toContain("toastAnnouncement.textContent = ''");
  });
});
