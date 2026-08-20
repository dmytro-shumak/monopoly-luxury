import { CardColor, CardType, BuildingType } from "../models/types.js";
import type { CardDefinition } from "../models/types.js";

type ConfigItem = { baseId: string; template: Omit<CardDefinition, 'id' | 'value'>; values?: number[]; count?: number };

// --- Factory Helpers ---
const createMoney = (val: number, count: number): ConfigItem => ({
  baseId: `money_${val}`,
  values: Array(count).fill(val),
  template: { type: CardType.MONEY }
});

const createProp = (color: CardColor, values: number[]): ConfigItem => ({
  baseId: `prop_${color.toLowerCase()}`,
  values,
  template: { type: CardType.PROPERTY, colors: [color] }
});

const createWild = (baseId: string, colors: CardColor[], values: number[]): ConfigItem => ({
  baseId,
  values,
  template: { type: CardType.PROPERTY_WILDCARD, colors }
});

const createAction = (baseId: string, count: number, extra?: Partial<CardDefinition>): ConfigItem => ({
  baseId,
  count,
  template: { type: CardType.ACTION, ...extra }
});

// --- Configuration ---
const cardsConfig: ConfigItem[] = [
  // Money
  createMoney(1, 7),
  createMoney(2, 5),
  createMoney(3, 4),
  createMoney(4, 3),
  createMoney(5, 2),
  createMoney(10, 1),

  // Properties (Standard)
  createProp(CardColor.PINK, [1, 2, 3, 4]),
  createProp(CardColor.ORANGE, [1, 2, 3]),
  createProp(CardColor.BROWN, [1, 2, 3]),
  createProp(CardColor.LIGHT_GREEN, [1, 2, 3]),
  createProp(CardColor.PURPLE, [2, 3, 4]),
  createProp(CardColor.DARK_BLUE, [3, 4, 5]),
  createProp(CardColor.LIGHT_BLUE, [1, 2, 3]),
  createProp(CardColor.GREEN, [3, 4]),
  createProp(CardColor.RED, [2, 3]),
  createProp(CardColor.MAROON, [2, 3]),

  // Property Wildcards
  createWild('wild_darkblue_brown', [CardColor.DARK_BLUE, CardColor.BROWN], [1, 2]),
  createWild('wild_purple_lightblue', [CardColor.PURPLE, CardColor.LIGHT_BLUE], [2, 3]),
  createWild('wild_lightgreen_darkmaroon', [CardColor.LIGHT_GREEN, CardColor.DARK_MAROON], [2]),
  createWild('wild_orange_darkgreen', [CardColor.ORANGE, CardColor.DARK_GREEN], [2]),
  createWild('wild_pink_orange', [CardColor.PINK, CardColor.ORANGE], [2]),
  createWild('wild_green_pink', [CardColor.GREEN, CardColor.PINK], [3]),
  createWild('wild_red_pink', [CardColor.RED, CardColor.PINK], [2]),
  createWild('wild_all', [CardColor.ALL_COLOR], [0, 0]),

  // Actions
  createAction('action_pass_go', 9),
  createAction('action_sly_deal', 4),
  createAction('action_forced_deal', 3),
  createAction('action_deal_breaker', 2),
  createAction('action_just_say_no', 3),
  createAction('action_debt_collector', 3),
  createAction('action_birthday', 3),
  createAction('action_house', 2, { isBuilding: BuildingType.HOUSE }),
  createAction('action_hotel', 2, { isBuilding: BuildingType.HOTEL }),

  // Rent Actions
  createAction('rent_green_lightblue', 4, { colors: [CardColor.GREEN, CardColor.LIGHT_BLUE] }),
  createAction('rent_red_pink', 2, { colors: [CardColor.RED, CardColor.PINK] }),
  createAction('rent_orange_green', 2, { colors: [CardColor.ORANGE, CardColor.GREEN] }),
  createAction('rent_darkblue_purple', 1, { colors: [CardColor.DARK_BLUE, CardColor.PURPLE] }),
  createAction('rent_lightgreen_maroon', 1, { colors: [CardColor.LIGHT_GREEN, CardColor.MAROON] }),
  createAction('rent_wild', 3, { colors: [CardColor.ALL_COLOR] }),
  createAction('rent_double', 2)
];

// --- Generation ---
export const CARDS_DICTIONARY: Record<string, CardDefinition> = {};

cardsConfig.forEach(({ baseId, template, values, count }) => {
  const total = values ? values.length : count!;
  for (let i = 0; i < total; i++) {
    const id = `${baseId}_${i + 1}`;
    const value = values ? values[i] : undefined;
    CARDS_DICTIONARY[id] = { ...template, id, ...(value !== undefined && { value }) } as CardDefinition;
  }
});

export const FULL_DECK_IDS = Object.keys(CARDS_DICTIONARY);
