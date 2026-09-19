import { CardType, CardColor, BuildingType, ActionCardType, type CardModel } from '../types/cards';
import type { TablePropertySet, PropertyTarget, BestRentChoice } from '../types/table';

export const computeValidPropertyTargets = (
  card: CardModel,
  propertySets: TablePropertySet[]
): PropertyTarget[] => {
  const isHouse = card.isBuilding === BuildingType.HOUSE || card.actionType === ActionCardType.HOUSE || card.id.includes('house');
  const isHotel = card.isBuilding === BuildingType.HOTEL || card.actionType === ActionCardType.HOTEL || card.id.includes('hotel');

  if (isHouse) {
    const targets: PropertyTarget[] = [];
    propertySets.forEach((set, idx) => {
      if (set.isComplete && !set.hasHouse) {
        targets.push({ type: 'existing', setIndex: idx, color: set.color });
      }
    });
    return targets;
  }

  if (isHotel) {
    const targets: PropertyTarget[] = [];
    propertySets.forEach((set, idx) => {
      if (set.isComplete && set.hasHouse && !set.hasHotel) {
        targets.push({ type: 'existing', setIndex: idx, color: set.color });
      }
    });
    return targets;
  }

  if (card.type !== CardType.PROPERTY && card.type !== CardType.PROPERTY_WILDCARD) {
    return [];
  }

  const colors = card.colors || [];
  const targets: PropertyTarget[] = [];

  // Case 3: Universal All-Color Wildcard (e.g. wild_all or CardColor.ALL_COLOR)
  if (colors.includes(CardColor.ALL_COLOR) || colors.length === 0) {
    propertySets.forEach((set, idx) => {
      if (!set.isComplete) {
        targets.push({ type: 'existing', setIndex: idx, color: set.color });
      }
    });
    if (targets.length === 0) {
      const allColors: CardColor[] = [
        CardColor.PINK,
        CardColor.ORANGE,
        CardColor.BROWN,
        CardColor.LIGHT_GREEN,
        CardColor.PURPLE,
        CardColor.DARK_BLUE,
        CardColor.LIGHT_BLUE,
        CardColor.GREEN,
        CardColor.RED,
        CardColor.MAROON,
        CardColor.DARK_GREEN,
        CardColor.DARK_MAROON,
      ];
      allColors.forEach((color) => {
        targets.push({ type: 'new_set', color });
      });
    }
    return targets;
  }

  // Case 1: Single Color Property Card (colors.length === 1)
  if (colors.length === 1) {
    const targetColor = colors[0];
    const incompleteSetIndex = propertySets.findIndex(
      (s) => s.color === targetColor && !s.isComplete
    );

    if (incompleteSetIndex !== -1) {
      targets.push({ type: 'existing', setIndex: incompleteSetIndex, color: targetColor });
    } else {
      targets.push({ type: 'new_set', color: targetColor });
    }
    return targets;
  }

  // Case 2: Dual-Color Property Wildcard (colors.length === 2)
  if (colors.length === 2) {
    const [colorA, colorB] = colors;
    const incompleteAIndex = propertySets.findIndex(
      (s) => s.color === colorA && !s.isComplete
    );
    const incompleteBIndex = propertySets.findIndex(
      (s) => s.color === colorB && !s.isComplete
    );

    const hasIncompleteA = incompleteAIndex !== -1;
    const hasIncompleteB = incompleteBIndex !== -1;

    if (hasIncompleteA && hasIncompleteB) {
      targets.push({ type: 'existing', setIndex: incompleteAIndex, color: colorA });
      targets.push({ type: 'existing', setIndex: incompleteBIndex, color: colorB });
      return targets;
    }

    if (hasIncompleteA && !hasIncompleteB) {
      targets.push({ type: 'existing', setIndex: incompleteAIndex, color: colorA });
      targets.push({ type: 'new_set', color: colorB });
      return targets;
    }

    if (!hasIncompleteA && hasIncompleteB) {
      targets.push({ type: 'existing', setIndex: incompleteBIndex, color: colorB });
      targets.push({ type: 'new_set', color: colorA });
      return targets;
    }

    if (!hasIncompleteA && !hasIncompleteB) {
      targets.push({ type: 'new_set', color: colorA });
      targets.push({ type: 'new_set', color: colorB });
      return targets;
    }
  }

  return targets;
};

export const computeFlipTargetForTableCard = (
  sourceSetIndex: number,
  card: CardModel,
  propertySets: TablePropertySet[]
): { targetColor: CardColor; target: PropertyTarget } | null => {
  if (card.type !== CardType.PROPERTY_WILDCARD || !card.colors) {
    return null;
  }
  const sourceSet = propertySets[sourceSetIndex];
  if (!sourceSet || sourceSet.isComplete) {
    return null; // Color lock in complete monopoly
  }

  // All-Color wildcard: move to any other incomplete set on table
  if (card.colors.includes(CardColor.ALL_COLOR)) {
    const otherIncompleteIndex = propertySets.findIndex(
      (s, idx) => idx !== sourceSetIndex && !s.isComplete
    );
    if (otherIncompleteIndex !== -1) {
      const targetSet = propertySets[otherIncompleteIndex];
      return {
        targetColor: targetSet.color,
        target: { type: 'existing', setIndex: otherIncompleteIndex, color: targetSet.color },
      };
    }
    return null;
  }

  const currentColor = sourceSet.color;
  const targetColor = card.colors.find((c) => c !== currentColor);
  if (!targetColor) return null;

  const incompleteTargetIndex = propertySets.findIndex(
    (s, idx) => idx !== sourceSetIndex && s.color === targetColor && !s.isComplete
  );

  let target: PropertyTarget;
  if (incompleteTargetIndex !== -1) {
    target = { type: 'existing', setIndex: incompleteTargetIndex, color: targetColor };
  } else {
    target = { type: 'new_set', color: targetColor };
  }

  return { targetColor, target };
};

export const computeRentForColor = (
  color: CardColor,
  propertySets: TablePropertySet[]
): number => {
  const setsOfColor = propertySets.filter((s) => s.color === color);
  if (setsOfColor.length === 0) return 0;

  let maxRent = 0;
  setsOfColor.forEach((set) => {
    let rent = set.cards.filter((c) => c.type === CardType.PROPERTY || c.type === CardType.PROPERTY_WILDCARD).length;
    if (set.hasHouse) rent += 3;
    if (set.hasHotel) rent += 4;
    if (rent > maxRent) {
      maxRent = rent;
    }
  });
  return maxRent;
};

export const computeBestRentForCard = (
  card: CardModel,
  propertySets: TablePropertySet[]
): BestRentChoice | null => {
  if (card.actionType !== ActionCardType.RENT) return null;

  const colors = card.colors || [];

  // Wild Rent (ALL_COLOR) -> evaluate all colors the player currently owns
  if (colors.includes(CardColor.ALL_COLOR)) {
    let best: BestRentChoice | null = null;
    propertySets.forEach((set) => {
      const rent = computeRentForColor(set.color, propertySets);
      if (!best || rent > best.amount) {
        best = { color: set.color, amount: rent };
      }
    });
    return best;
  }

  // Dual-color Rent -> evaluate both colors and pick the highest rent
  let best: BestRentChoice | null = null;
  colors.forEach((color) => {
    const rent = computeRentForColor(color, propertySets);
    if (!best || rent > best.amount) {
      best = { color, amount: rent };
    }
  });

  return best;
};
