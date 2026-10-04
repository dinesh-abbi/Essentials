import type { IconName } from '@/components/ui/chunky';
import type { MealType } from '@/utils/FuelStorage';

/** The picture for each meal slot — used on Home, Fuel and the restock sheet. */
export const MEAL_ICONS: Record<MealType, IconName> = {
  breakfast: 'egg-fried',
  lunch: 'rice',
  snack: 'food-apple',
  dinner: 'bowl-mix',
};
