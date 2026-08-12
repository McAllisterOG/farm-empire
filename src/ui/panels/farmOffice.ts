import type { GameState } from '../../core/types';
import { farmGuideSteps, farmerKnowledgeSummary, nextFarmGuideStep } from '../../core/farmKnowledge';
import { farmOf, formatMoney, storageUsed } from '../../core/farmBusiness';
import { pickupCargoCapacity, pickupCargoUsed } from '../../core/farmPickup';
import { countyFreightBoardState } from '../../core/farmCountyFreight';
import { h } from '../dom';
import { openPanel } from '../modal';

export interface FarmOfficeActions {
  onSave: () => void;
  onRecenter: () => void;
  onLand: () => void;
  onCargo: () => void;
  onTownRoad: () => void;
  onWorkforce: () => void;
}

export function openFarmOffice(state: GameState, actions: FarmOfficeActions): void {
  const farm = farmOf(state);
  const guide = farmGuideSteps(state);
  const completed = guide.filter((step) => step.done).length;
  const next = nextFarmGuideStep(state);
  const knowledge = farmerKnowledgeSummary(state);
  const progressPercent = knowledge.nextLevel
    ? Math.round(knowledge.pointsIntoLevel / knowledge.pointsForLevel * 100)
    : 100;
  const ownedSections = state.plots.length;
  const freight = countyFreightBoardState(state);
  const freightStatus = !freight.unlocked ? 'Prove the farm' : freight.active ? 'Active haul' : freight.offer ? 'Offer posted' : 'Route complete today';
  openPanel({ title: farm.parcels.northOwned ? 'Expanded Farmhouse Office' : 'Farmhouse Office', className: 'panel-farm-office', body: (body) => body.append(
    h('section', { class: 'farmbook-hero' },
      h('div', { class: 'farmbook-level-mark' }, String(knowledge.level.level)),
      h('div', { class: 'farmbook-level-copy' },
        h('span', {}, 'Farmer Knowledge'),
        h('strong', {}, knowledge.level.name),
        h('div', { class: 'farmbook-progress', 'aria-label': `${knowledge.points} knowledge points` },
          h('span', { style: `width:${progressPercent}%` }),
        ),
        h('small', {}, knowledge.nextLevel ? `${knowledge.points} pts · ${knowledge.nextLevel.minPoints} for ${knowledge.nextLevel.name}` : `${knowledge.points} pts · highest current rank`),
      ),
    ),
    h('div', { class: 'farmbook-field-note' },
      h('strong', {}, 'FIELD NOTE'),
      h('span', {}, knowledge.level.fieldNote),
      h('small', {}, knowledge.level.sourceLabel),
    ),
    h('section', { class: 'farmbook-section' },
      h('div', { class: 'farmbook-section-title' }, h('strong', {}, 'Farm Guide'), h('span', {}, `${completed}/${guide.length}`)),
      next ? h('div', { class: 'farmbook-next' }, h('strong', {}, `Next · ${next.label}`), h('span', {}, next.hint)) : h('div', { class: 'farmbook-next complete' }, 'Core farm route complete.'),
      h('div', { class: 'farmbook-guide-list' }, ...guide.map((step) => h('div', { class: `farmbook-guide-step ${step.done ? 'done' : ''}` },
        h('span', { class: 'farmbook-check' }, step.done ? '✓' : '·'),
        h('span', {}, step.label),
      ))),
    ),
    h('section', { class: 'farmbook-section' },
      h('div', { class: 'farmbook-section-title' }, h('strong', {}, 'Operation'), h('span', {}, `${ownedSections} sections`)),
      h('div', { class: 'farmbook-snapshot' },
        h('div', {}, h('span', {}, 'Cash'), h('strong', {}, formatMoney(farm.cashCents))),
        h('div', {}, h('span', {}, 'Barn'), h('strong', {}, `${storageUsed(state)} / ${farm.storageCapacity}`)),
        h('div', {}, h('span', {}, 'Pickup'), h('strong', {}, `${pickupCargoUsed(state)} / ${pickupCargoCapacity(state)}`)),
        h('div', {}, h('span', {}, 'Trailer'), h('strong', {}, farm.equipment.countyUtilityTrailerOwned ? 'County utility trailer' : 'Not owned')),
        h('div', {}, h('span', {}, 'Land'), h('strong', {}, farm.parcels.northOwned ? '2 acreages' : '1 acreage')),
        h('div', {}, h('span', {}, 'Tractor'), h('strong', {}, farm.equipment.tractor.status === 'operational' ? 'Operational' : 'Restoration needed')),
        h('div', {}, h('span', {}, 'Home'), h('strong', {}, farm.parcels.northOwned ? 'Expanded farmhouse' : 'Humble farmhouse')),
        h('div', {}, h('span', {}, 'Freight'), h('strong', {}, freightStatus)),
        h('div', {}, h('span', {}, 'Workforce'), h('strong', {}, farm.workforce.farmhandHired ? 'Mara Bell · hired' : farm.parcels.northOwned && farm.townContact.status === 'completed' ? 'Hiring unlocked' : 'Not hired')),
      ),
    ),
    h('div', { class: 'farmbook-actions' },
      h('button', { class: 'btn btn-primary', onclick: actions.onCargo }, 'Barn & Cargo'),
      h('button', { class: 'btn', onclick: actions.onLand }, 'Land Records'),
      h('button', { class: 'btn', onclick: actions.onTownRoad }, 'County Road'),
      h('button', { class: 'btn', 'data-testid': 'farmbook-workforce', onclick: actions.onWorkforce }, 'Workforce'),
      h('button', { class: 'btn', onclick: actions.onSave }, 'Save Farm'),
      h('button', { class: 'btn', onclick: actions.onRecenter }, 'Recenter'),
    ),
  ) });
}
