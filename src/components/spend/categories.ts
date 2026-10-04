import type { IconName } from '@/components/ui/chunky';

/**
 * Spend categories — each with a picture and a colour so a list of expenses
 * reads at a glance. Colours cycle through vivid tones that sit well on the
 * dark base; they are data colours (chart slices), not area hues.
 */
export const CATEGORY_META: Record<string, { icon: IconName; color: string }> = {
  Groceries: { icon: 'cart', color: '#A6E840' },
  Dairy: { icon: 'cow', color: '#F5F0E1' },
  Veggies: { icon: 'carrot', color: '#FF9F43' },
  Snacks: { icon: 'cookie', color: '#FFC233' },
  Transport: { icon: 'bus', color: '#38D3FF' },
  Bills: { icon: 'receipt', color: '#FF6B4A' },
  Health: { icon: 'medical-bag', color: '#FF5FA2' },
  Food: { icon: 'silverware-fork-knife', color: '#FFB86B' },
  Shopping: { icon: 'shopping', color: '#A98BFF' },
  Misc: { icon: 'dots-horizontal-circle', color: '#A6A6B3' },
  Rent: { icon: 'home-city', color: '#6E9BFF' },
  Entertainment: { icon: 'movie-open', color: '#E879F9' },
  Education: { icon: 'school', color: '#5EEAD4' },
  Subscriptions: { icon: 'autorenew', color: '#F472B6' },
  Travel: { icon: 'airplane', color: '#60A5FA' },
  Clothing: { icon: 'tshirt-crew', color: '#C084FC' },
  Gadgets: { icon: 'cellphone', color: '#94A3B8' },
  Investments: { icon: 'chart-line', color: '#4ADE80' },
  Insurance: { icon: 'shield-check', color: '#7DD3FC' },
  Income: { icon: 'cash-plus', color: '#86EFAC' },
};

export const CATEGORIES = Object.keys(CATEGORY_META);

export const categoryMeta = (name: string) => CATEGORY_META[name] ?? { icon: 'tag' as IconName, color: '#A6A6B3' };
