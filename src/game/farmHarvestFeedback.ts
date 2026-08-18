/** Runtime-only feedback belongs exclusively to a successful player basket harvest. */
export function shouldTriggerFarmHarvestFeedback(resultOk: boolean, harvestToBasket: boolean, cropId: string | undefined): boolean {
  return resultOk && harvestToBasket && typeof cropId === 'string' && cropId.length > 0;
}
