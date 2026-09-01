import type { GameState } from '../../core/types';
import { farmGuideSteps, farmerKnowledgeSummary, nextFarmGuideStep } from '../../core/farmKnowledge';
import { farmOf, formatMoney, harvestWagonReadout, storageUsed } from '../../core/farmBusiness';
import { farmCropEconomics } from '../../core/farmCropEconomics';
import { farmCropDef } from '../../core/registry';
import { farmParcelSectionCount } from '../../core/farmParcels';
import { pickupCargoCapacity, pickupCargoUsed } from '../../core/farmPickup';
import { countyFreightBoardState } from '../../core/farmCountyFreight';
import { farmWeatherForecast } from '../../core/farmWeather';
import { roadsideStandView } from '../../core/farmRoadsideStand';
import { firstFarmMorningGuide } from '../../core/firstFarmMorning';
import { h } from '../dom';
import { openPanel } from '../modal';
import { formatFarmCapacity } from '../../core/farmCargoScale';
import { COUNTY_KITCHEN_GARDEN_TABLE_DELIVERY } from '../../data/townWorkOrders.data';
import { farmhousePresentationTier } from '../../render/farmLayout';

export interface FarmOfficeActions {
  onSave: () => void;
  onRecenter: () => void;
  onLand: () => void;
  onCargo: () => void;
  onTownRoad: () => void;
  onWorkforce: () => void;
  onRoadsideStand: () => void;
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
  const forecast = farmWeatherForecast(state, 3);
  const stand = roadsideStandView(state);
  const morning = firstFarmMorningGuide(state, Date.now());
  const selectedCrop = farmCropDef(farm.selectedCropId);
  const starterPlan = farmCropEconomics(selectedCrop, { sectionCount: farmParcelSectionCount('starter') });
  const northPlan = farmCropEconomics(selectedCrop, { sectionCount: farmParcelSectionCount('north') });
  const freightStatus = !freight.unlocked ? 'Prove the farm' : freight.active ? 'Active haul' : freight.offers.length > 0 ? `${freight.offers.length} routes posted` : 'Route complete today';
  const homeTier = farmhousePresentationTier(farm.parcels.northOwned, farm.farmstead.officeQuartersOwned);
  openPanel({ title: homeTier === 'crew-quarters' ? 'Farmstead Office & Crew Quarters' : homeTier === 'expanded' ? 'Expanded Farmhouse' : 'Farmhouse', className: 'panel-farm-office', body: (body) => body.append(
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
      h('div', { class: 'farmbook-section-title' }, h('strong', {}, 'County Forecast'), h('span', {}, '3 days')),
      h('div', { class: 'farmbook-weather-row', 'data-testid': 'farm-weather-forecast' }, ...forecast.map((weather, index) => h('div', { class: `farmbook-weather-card ${weather.kind}` },
        h('span', {}, index === 0 ? 'Today' : `Day ${weather.day}`),
        h('strong', {}, weather.shortForecast),
        h('small', {}, index === 0 ? weather.fieldNote : weather.kind === 'rain' ? 'Rain can establish new planting.' : 'Plan on manual establishment water.'),
      ))),
    ),
    h('section', { class: 'farmbook-section', 'data-testid': 'farmbook-rotation-note' },
      h('div', { class: 'farmbook-section-title' }, h('strong', {}, 'Crop Rotation & Field Notes'), h('span', {}, '10% timing boost')),
      h('div', { class: 'farmbook-next' }, h('strong', {}, 'Change crop families after harvest'), h('span', {}, 'Grain: corn/wheat · Legume: soy · Root: potato/carrot · Garden: tomato/cabbage/pumpkin. A different family after harvest grows 10% faster; first and same-family crops have no penalty. This is a game simplification of how rotations can spread nutrient demand and interrupt pest cycles. Rain establishes seedlings planted while rain is active; otherwise give one first watering.')),
    ),
    ...(!morning.complete ? [h('section', { class: 'farmbook-section' },
      h('div', { class: 'farmbook-section-title' }, h('strong', {}, 'Today’s delivery'), h('span', {}, `${morning.cornProgress.current}/${morning.cornProgress.required} corn`)),
      h('div', { class: 'farmbook-next' }, h('strong', {}, morning.title), h('span', {}, morning.detail)),
    )] : []),
    ...(farm.townContact.status === 'completed' && farm.countyKitchen.status !== 'completed' ? [h('div', { class: 'farmbook-next', 'data-testid': 'farmbook-kitchen-line' }, h('strong', {}, 'County Kitchen'), h('span', {}, `Rosa’s Garden Table needs 8 corn, 6 carrots, and 4 tomatoes in the pickup · ${formatMoney(COUNTY_KITCHEN_GARDEN_TABLE_DELIVERY.payoutCents)} once.`))] : []),
    h('section', { class: 'farmbook-section' },
      h('div', { class: 'farmbook-section-title' }, h('strong', {}, 'Later on'), h('span', {}, `${completed}/${guide.length}`)),
      next ? h('div', { class: 'farmbook-next' }, h('strong', {}, `Next · ${next.label}`), h('span', {}, next.hint)) : h('div', { class: 'farmbook-next complete' }, 'Core farm route complete.'),
      h('div', { class: 'farmbook-guide-list' }, ...guide.map((step) => h('div', { class: `farmbook-guide-step ${step.done ? 'done' : ''}` },
        h('span', { class: 'farmbook-check' }, step.done ? '✓' : '·'),
        h('span', {}, step.label),
      ))),
    ),
    h('section', { class: 'farmbook-section farmbook-capital-plan', 'data-testid': 'farmbook-capital-plan' },
      h('div', { class: 'farmbook-section-title' }, h('strong', {}, `Capital Plan · ${selectedCrop.name}`), h('span', {}, 'base market')),
      h('div', { class: 'farmbook-capital-rows' },
        h('div', {}, h('strong', {}, '36 starter'), h('span', {}, `Seed ${formatMoney(starterPlan.seedCostCents)} · Gross ${formatMoney(starterPlan.grossBaseValueCents)} · Net ${formatMoney(starterPlan.netBaseValueCents)} · ${starterPlan.totalStorageUnits} storage used`)),
        h('div', {}, h('strong', {}, '96 north'), h('span', {}, `Seed ${formatMoney(northPlan.seedCostCents)} · Gross ${formatMoney(northPlan.grossBaseValueCents)} · Net ${formatMoney(northPlan.netBaseValueCents)} · ${northPlan.totalStorageUnits} storage used`)),
      ),
      h('small', { 'data-testid': 'farmbook-wagon-guidance' }, farm.equipment.harvestWagon.owned
        ? 'Operated harvest loads the tractor wagon; drive it to the barn receiving bay for one whole-load unload. The County wagon expands cargo capacity after the required upgrades.'
        : 'Tractor restoration includes the basic harvest wagon. The County wagon later requires the Implement Set, neighboring acreage, completed freight, and $2,400.'),
    ),
    h('section', { class: 'farmbook-section' },
      h('div', { class: 'farmbook-section-title' }, h('strong', {}, 'Operation'), h('span', {}, `${ownedSections} sections`)),
      h('div', { class: 'farmbook-snapshot' },
        h('div', {}, h('span', {}, 'Cash'), h('strong', {}, formatMoney(farm.cashCents))),
        h('div', {}, h('span', {}, 'Storage'), h('strong', {}, formatFarmCapacity(storageUsed(state), farm.storageCapacity))),
        h('div', {}, h('span', {}, 'Silo'), h('strong', {}, farm.equipment.countyGrainSiloOwned ? 'County grain silo' : farm.equipment.barnLoftExpansionOwned ? 'Build unlocked' : 'Not built')),
        h('div', {}, h('span', {}, 'Pickup'), h('strong', {}, formatFarmCapacity(pickupCargoUsed(state), pickupCargoCapacity(state)))),
        h('div', {}, h('span', {}, 'Trailer'), h('strong', {}, farm.equipment.countyUtilityTrailerOwned ? 'County utility trailer' : 'Not owned')),
        h('div', {}, h('span', {}, 'Land'), h('strong', {}, farm.parcels.northOwned ? '2 acreages' : '1 acreage')),
        h('div', {}, h('span', {}, 'Tractor'), h('strong', {}, farm.equipment.tractor.status === 'operational' ? 'Operational' : 'Restoration needed')),
        h('div', {}, h('span', {}, 'Harvest wagon'), h('strong', {}, harvestWagonReadout(state))),
        h('div', {}, h('span', {}, 'Home'), h('strong', {}, homeTier === 'crew-quarters' ? 'Office & crew quarters' : farm.parcels.northOwned ? 'Expanded farmhouse' : 'Humble farmhouse')),
        h('div', {}, h('span', {}, 'Freight'), h('strong', {}, freightStatus)),
        h('div', {}, h('span', {}, 'Workforce'), h('strong', {}, farm.workforce.eliotHired ? 'Mara + Eliot · two-person crew' : farm.workforce.farmhandHired ? (farm.farmstead.officeQuartersOwned ? 'Mara · crew quarters ready' : 'Mara Bell · hired') : farm.parcels.northOwned && farm.townContact.status === 'completed' ? 'Hiring unlocked' : 'Not hired')),
        ...(farm.workforce.manager.hired ? [h('div', {}, h('span', {}, 'Manager'), h('strong', {}, farm.workforce.manager.enabled ? `Plan active · Day ${farm.workforce.manager.lastReviewedDay || 'not reviewed'}` : 'Plan paused'))] : []),
        h('div', {}, h('span', {}, 'Farm Stand'), h('strong', {}, stand.owned ? stand.completedToday ? 'Sold out today' : 'Local order posted' : stand.unlocked ? 'Permit unlocked' : 'Not built')),
      ),
    ),
    h('div', { class: 'farmbook-actions' },
      h('button', { class: 'btn btn-primary', onclick: actions.onCargo }, 'Barn & Cargo'),
      h('button', { class: 'btn', onclick: actions.onLand }, 'Land Records'),
      h('button', { class: 'btn', onclick: actions.onTownRoad }, 'County Road'),
      h('button', { class: 'btn', 'data-testid': 'farmbook-workforce', onclick: actions.onWorkforce }, 'Workforce'),
      h('button', { class: 'btn', 'data-testid': 'farmbook-roadside-stand', onclick: actions.onRoadsideStand }, 'Farm Stand'),
      h('button', { class: 'btn', onclick: actions.onSave }, 'Save Farm'),
      h('button', { class: 'btn', onclick: actions.onRecenter }, 'Recenter'),
    ),
  ) });
}
