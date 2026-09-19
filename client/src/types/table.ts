import type { CardModel, CardColor } from './cards';

export interface TablePropertySet {
  color: CardColor;
  cards: CardModel[];
  isComplete: boolean;
  hasHouse?: boolean;
  hasHotel?: boolean;
}

export interface TablePlayer {
  id: string;
  name: string;
  avatar: string;
  isCurrentPlayer?: boolean;
  handCount: number;
  bankCards: CardModel[];
  propertySets: TablePropertySet[];
  actionsRemaining?: number;
}

export type PropertyTarget =
  | { type: 'existing'; setIndex: number; color: CardColor }
  | { type: 'new_set'; color: CardColor };

export interface TableMovingCard {
  sourceSetIndex: number;
  cardId: string;
  targetColor: CardColor;
  target: PropertyTarget;
}

export interface IncomingAction {
  type: 'sly_deal' | 'forced_deal' | 'deal_breaker';
  attackerId: string;
  attackerName: string;
  actionCard: CardModel;
  stolenCard?: CardModel;
  stolenCardSetIndex?: number;
  theirCard?: CardModel;
  myTargetCard?: CardModel;
  myTargetCardSetIndex?: number;
  stolenSetIndex?: number;
  stolenSet?: TablePropertySet;
}

export interface IncomingDebt {
  attackerId: string;
  attackerName: string;
  actionCard: CardModel;
  amount: number;
  reason: string;
}

export interface BestRentChoice {
  color: CardColor;
  amount: number;
}
