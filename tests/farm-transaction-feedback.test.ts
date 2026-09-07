import { describe, expect, it, vi } from 'vitest';
import '../src/data';
import { createFarmGame } from '../src/core/state';
import { farmOf } from '../src/core/farmBusiness';
import { loadBarnCropToPickup, sellPickupCrop, sellPickupCropBatch } from '../src/core/farmPickup';
import { showFarmSaleFeedback } from '../src/ui/farmTransactionFeedback';
import { toast } from '../src/ui/toast';
import { deserialize, serialize } from '../src/save/save';
vi.mock('../src/ui/toast',()=>({toast:vi.fn()}));

describe('farm sale UI feedback',()=>{
  it('presents a real mixed batch sale without looking up batch as a crop or changing the transaction',()=>{
    const state=createFarmGame('Sale QA',5,1000),farm=farmOf(state);
    farm.townContact.status='active';
    for(const [id,count] of Object.entries({crop_corn:15,crop_wheat:4,crop_potato:2})) {
      farm.storage[id]=count; expect(loadBarnCropToPickup(state,id,count).ok).toBe(true);
    }
    farm.pickup.cargo.seeds.crop_wheat=2;
    const before=farm.cashCents, expected=3*farm.market.quotes.crop_corn.currentCents+4*farm.market.quotes.crop_wheat.currentCents;
    const result=sellPickupCropBatch(state,{crop_corn:3,crop_wheat:4},true);
    expect(result.ok).toBe(true);
    const after=serialize(state,1000);
    for(const event of result.events ?? []) if(event.type==='sell') showFarmSaleFeedback(event);
    expect(toast).toHaveBeenLastCalledWith(`Sold 7 produce items for $${(expected/100).toFixed(2)}.`,'good');
    expect(serialize(state,1000)).toBe(after);
    expect(farm.cashCents).toBe(before+expected);
    expect(farm.pickup.cargo.crops).toMatchObject({crop_corn:12,crop_potato:2});
    const restored=deserialize(after,1000);
    expect(restored.farm?.cashCents).toBe(before+expected);
    expect(restored.farm?.pickup.cargo.seeds).toEqual({crop_wheat:2});
    const single=sellPickupCrop(restored,'crop_potato',1,true);
    expect(single.ok).toBe(true);
    for(const event of single.events ?? []) if(event.type==='sell') showFarmSaleFeedback(event);
    expect(toast).toHaveBeenLastCalledWith(expect.stringContaining('Sold 1 Potatoes for $'),'good');
  });
});
