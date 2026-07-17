/**
 * 入口：注册内容 → 标题界面（存档槽位）→ 进入游戏（含离线结算摘要）。
 */
import './data'; // 注册全部内容表
import type { GameState } from './core/types';
import { settleOffline, type OfflineSummary } from './core/offline';
import { itemDef } from './core/registry';
import { deleteSlot, loadFromSlot, newGameInSlot, slotInfos } from './save/save';
import { setLang, fmtDuration, t, tl } from './i18n';
import { h, clearChildren } from './ui/dom';
import { initToast } from './ui/toast';
import { initModal, confirmDialog, infoDialog, promptDialog } from './ui/modal';
import { initActionMenu } from './ui/actionMenu';
import { App } from './game/app';
import { sfx } from './audio/sound';

let currentApp: App | null = null;

function canvasEl(): HTMLCanvasElement {
  return document.getElementById('game-canvas') as HTMLCanvasElement;
}

function showOfflineSummary(state: GameState, summary: OfflineSummary): void {
  infoDialog(t('off.title', { name: state.player.name }), (body) => {
    const lines: string[] = [t('off.away', { t: fmtDuration(summary.awayMs) })];
    if (summary.cropsReady > 0) lines.push(`🌾 ${t('off.crops', { n: summary.cropsReady })}`);
    if (summary.animalsReady > 0) lines.push(`🥚 ${t('off.animals', { n: summary.animalsReady })}`);
    if (summary.beastsArrived > 0) lines.push(`⚔ ${t('off.beasts', { n: summary.beastsArrived })}`);
    if (summary.weedsGrown > 0) lines.push(`🌿 ${t('off.weeds', { n: summary.weedsGrown })}`);
    if (summary.cropsTrampled > 0) lines.push(`💥 ${t('off.trampled', { n: summary.cropsTrampled })}`);
    if (summary.energyRestored > 0) lines.push(`⚡ ${t('off.energy', { n: summary.energyRestored })}`);
    if (summary.petGift) {
      try {
        lines.push(`🎁 ${t('off.gift', { name: tl(itemDef(summary.petGift).name) })}`);
      } catch { /* ignore */ }
    }
    for (const line of lines) body.append(h('div', { class: 'off-line' }, line));
  });
}

function startGame(state: GameState, slot: number, offline: OfflineSummary | null): void {
  setLang(state.settings.lang);
  const title = document.getElementById('title-screen');
  title?.classList.add('hidden');
  canvasEl().classList.remove('hidden');
  currentApp?.destroy();
  currentApp = new App(canvasEl(), state, slot, () => showTitle());
  if (offline) showOfflineSummary(state, offline);
}

function showTitle(): void {
  currentApp?.destroy();
  currentApp = null;
  canvasEl().classList.add('hidden');
  const title = document.getElementById('title-screen')!;
  title.classList.remove('hidden');
  renderTitle(title);
}

function renderTitle(root: HTMLElement): void {
  clearChildren(root);
  const slots = slotInfos();
  const slotList = h('div', { class: 'slot-list' });

  slots.forEach((info, i) => {
    if (info) {
      const date = new Date(info.savedAt);
      const row = h('div', { class: 'slot-card' },
        h('div', { class: 'slot-main', onclick: () => {
          sfx('click');
          const now = Date.now();
          const state = loadFromSlot(i, now);
          if (!state) return;
          const offline = settleOffline(state, now);
          startGame(state, i, offline);
        } },
          h('div', { class: 'slot-name' }, `${info.name} · Lv.${info.level}`),
          h('div', { class: 'slot-sub' }, `💰${info.coins} · ${date.toLocaleString()}`),
        ),
        h('button', {
          class: 'btn btn-sm slot-del',
          onclick: () => {
            confirmDialog(t('start.deleteConfirm'), () => {
              deleteSlot(i);
              renderTitle(root);
            });
          },
        }, t('start.delete')),
      );
      slotList.append(row);
    } else {
      slotList.append(h('div', { class: 'slot-card empty' },
        h('div', { class: 'slot-main', onclick: () => {
          sfx('click');
          promptDialog(t('start.namePrompt'), t('start.defaultName'), (name) => {
            const state = newGameInSlot(name.trim() || t('start.defaultName'), i, Date.now());
            startGame(state, i, null);
          });
        } },
          h('div', { class: 'slot-name' }, `＋ ${t('start.newGame')}`),
          h('div', { class: 'slot-sub' }, t('start.slotEmpty')),
        ),
      ));
    }
  });

  root.append(
    h('div', { class: 'title-box' },
      h('h1', { class: 'title-logo' }, t('start.title')),
      h('div', { class: 'title-sub' }, t('start.subtitle')),
      h('div', { class: 'title-tagline' }, t('start.tagline')),
      slotList,
      h('div', { class: 'title-footer' },
        'An original open-source homage · ',
        h('a', { href: 'https://github.com/appleweiping/paradise-isle', target: '_blank', rel: 'noreferrer' }, 'GitHub'),
      ),
    ),
  );
}

function boot(): void {
  initToast();
  initModal();
  initActionMenu();
  // 语言初始化：跟随上次存档设置
  const active = slotInfos().find((s) => s !== null);
  if (active) {
    const state = loadFromSlot(active.slot, Date.now());
    if (state) setLang(state.settings.lang);
  }
  showTitle();
}

boot();
