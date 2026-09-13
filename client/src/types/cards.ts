export enum CardType {
  PROPERTY = "PROPERTY",
  MONEY = "MONEY",
  ACTION = "ACTION",
  PROPERTY_WILDCARD = "PROPERTY_WILDCARD"
}

export enum CardColor {
  PINK = "PINK",
  ORANGE = "ORANGE",
  BROWN = "BROWN",
  LIGHT_GREEN = "LIGHT_GREEN",
  PURPLE = "PURPLE",
  DARK_BLUE = "DARK_BLUE",
  LIGHT_BLUE = "LIGHT_BLUE",
  GREEN = "GREEN",
  RED = "RED",
  MAROON = "MAROON",
  DARK_GREEN = "DARK_GREEN",
  DARK_MAROON = "DARK_MAROON",
  ALL_COLOR = "ALL_COLOR"
}

export enum BuildingType {
  HOUSE = "HOUSE",
  HOTEL = "HOTEL"
}

export enum ActionCardType {
  PASS_GO = "PASS_GO",
  SLY_DEAL = "SLY_DEAL",
  FORCED_DEAL = "FORCED_DEAL",
  DEAL_BREAKER = "DEAL_BREAKER",
  JUST_SAY_NO = "JUST_SAY_NO",
  DEBT_COLLECTOR = "DEBT_COLLECTOR",
  BIRTHDAY = "BIRTHDAY",
  HOUSE = "HOUSE",
  HOTEL = "HOTEL",
  RENT = "RENT",
  DOUBLE_RENT = "DOUBLE_RENT"
}

export interface CardModel {
  id: string;
  type: CardType;
  value?: number;
  colors?: CardColor[];
  name: string;
  subname?: string;
  description?: string;
  actionType?: ActionCardType;
  isBuilding?: BuildingType;
  rentValues?: number[]; // rent progression e.g. [1, 2, 3, 4]
  fullSetSize?: number;
}
