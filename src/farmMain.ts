import './data';
import type { GameState } from './core/types';
import { FarmEmpireApp } from './game/farmEmpireApp';
import { deleteSlot, loadFromSlot, newGameInSlot, slotInfos } from './save/save';
import { setLang } from './i18n';
import { h, clearChildren } from './ui/dom';
import { initToast, toast } from './ui/toast';
import { closePanel, confirmDialog, initModal, promptDialog } from './ui/modal';
import { hideActionMenu, initActionMenu } from './ui/actionMenu';

let currentApp: FarmEmpireApp | null = null;

function canvasEl(): HTMLCanvasElement {
  return document.getElementById('game-canvas') as HTMLCanvasElement;
}

function startGame(state: GameState, slot: number): void {
  if (!state.farm) {
    toast('This save is not a Farm Empire save. Your legacy Paradise Isle data was left untouched.', 'bad');
    return;
  }
  document.getElementById('title-screen')?.classList.add('hidden');
  canvasEl().classList.remove('hidden');
  currentApp?.destroy();
  currentApp = new FarmEmpireApp(canvasEl(), state, slot, showTitle);
}

function showTitle(): void {
  currentApp?.destroy();
  currentApp = null;
  hideActionMenu();
  closePanel();
  canvasEl().classList.add('hidden');
  const title = document.getElementById('title-screen')!;
  title.classList.remove('hidden');
  renderTitle(title);
}

function renderTitle(root: HTMLElement): void {
  clearChildren(root);
  const list = h('div', { class: 'slot-list' });
  slotInfos().forEach((info, slot) => {
    if (info) {
      const saved = new Date(info.savedAt);
      list.append(h('div', { class: 'slot-card' },
        h('div', {
          class: 'slot-main', 'data-testid': `load-slot-${slot}`,
          onclick: () => {
            const state = loadFromSlot(slot, Date.now());
            if (state) startGame(state, slot);
          },
        },
        h('div', { class: 'slot-name' }, info.name),
        h('div', { class: 'slot-sub' }, `$${info.coins.toLocaleString()} cash · saved ${saved.toLocaleString()}`),
        ),
        h('button', {
          class: 'btn btn-sm', 'data-testid': `delete-slot-${slot}`,
          onclick: () => confirmDialog('Delete this Farm Empire save?', () => {
            deleteSlot(slot);
            renderTitle(root);
          }),
        }, 'Delete'),
      ));
    } else {
      list.append(h('div', { class: 'slot-card empty' },
        h('div', {
          class: 'slot-main', 'data-testid': `new-game-slot-${slot}`,
          onclick: () => promptDialog('Name your farming business', 'McAllister Farm', (name) => {
            const state = newGameInSlot(name.trim() || 'McAllister Farm', slot, Date.now());
            startGame(state, slot);
          }),
        },
        h('div', { class: 'slot-name' }, '+ Start a New Farm'),
        h('div', { class: 'slot-sub' }, 'Fresh $5,000 business · one acreage · barn · inherited tractor project'),
        ),
      ));
    }
  });

  root.append(h('div', { class: 'title-box farm-title-box' },
    h('div', { class: 'farm-title-eyebrow' }, 'ISOMETRIC FARMING BUSINESS SIMULATION'),
    h('h1', { class: 'title-logo farm-title-logo' }, 'FARM EMPIRE'),
    h('div', { class: 'title-sub' }, 'Build a farm. Read the market. Own the land.'),
    h('div', { class: 'title-tagline' }, 'BUY SEEDS → GROW CROPS → STORE → SELL → EXPAND'),
    list,
    h('div', { class: 'title-footer' },
      'Original Farm Empire systems built on the MIT-licensed Paradise Isle engine · ',
      h('a', { href: 'https://github.com/McAllisterOG/farm-empire', target: '_blank', rel: 'noreferrer' }, 'GitHub'),
    ),
  ));
}

function boot(): void {
  setLang('en');
  initToast();
  initModal();
  initActionMenu();
  showTitle();
}

boot();
