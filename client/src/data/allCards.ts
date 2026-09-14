import type { CardModel } from "../types/cards";
import { CardColor, CardType, ActionCardType, BuildingType } from "../types/cards";

const PROPERTY_CONFIG: Record<CardColor, { names: string[]; values: number[]; setSize: number }> = {
  [CardColor.PINK]: {
    names: ["вул. Басейна", "вул. Шовковична", "вул. Лютеранська", "вул. Шота Руставелі"],
    values: [1, 2, 3, 4],
    setSize: 4
  },
  [CardColor.ORANGE]: {
    names: ["вул. Саксаганського", "вул. Жилянська", "пр-т Перемоги"],
    values: [1, 2, 3],
    setSize: 3
  },
  [CardColor.BROWN]: {
    names: ["вул. Ярославів Вал", "вул. Рейтарська", "вул. Стрілецька"],
    values: [1, 2, 3],
    setSize: 3
  },
  [CardColor.LIGHT_GREEN]: {
    names: ["вул. Прорізна", "вул. Пушкінська", "вул. Б. Хмельницького"],
    values: [1, 2, 3],
    setSize: 3
  },
  [CardColor.PURPLE]: {
    names: ["вул. Лаврська", "вул. Січневого Повстання", "вул. Грушевського"],
    values: [2, 3, 4],
    setSize: 3
  },
  [CardColor.DARK_BLUE]: {
    names: ["вул. Хрещатик", "вул. Володимирська", "Майдан Незалежності"],
    values: [3, 4, 5],
    setSize: 3
  },
  [CardColor.LIGHT_BLUE]: {
    names: ["Оболонська набережна", "Подільська площа", "вул. Сагайдачного"],
    values: [1, 2, 3],
    setSize: 3
  },
  [CardColor.GREEN]: {
    names: ["вул. Інститутська", "вул. Банкова"],
    values: [3, 4],
    setSize: 2
  },
  [CardColor.RED]: {
    names: ["вул. Велика Васильківська", "вул. Антоновича"],
    values: [2, 3],
    setSize: 2
  },
  [CardColor.MAROON]: {
    names: ["вул. Терещенківська", "Андріївський узвіз"],
    values: [2, 3],
    setSize: 2
  },
  [CardColor.DARK_GREEN]: {
    names: ["вул. Паркова", "Набережне шосе"],
    values: [2, 3],
    setSize: 2
  },
  [CardColor.DARK_MAROON]: {
    names: ["вул. Липська", "вул. Городецького"],
    values: [2, 3],
    setSize: 2
  },
  [CardColor.ALL_COLOR]: {
    names: ["Універсальна карта"],
    values: [3],
    setSize: 0
  }
};

export const generateFullDeck = (): CardModel[] => {
  const deck: CardModel[] = [];

  // 1. MONEY (22 cards)
  const moneyDist = [
    { val: 1, count: 7 },
    { val: 2, count: 5 },
    { val: 3, count: 4 },
    { val: 4, count: 3 },
    { val: 5, count: 2 },
    { val: 10, count: 1 }
  ];

  moneyDist.forEach(({ val, count }) => {
    for (let i = 1; i <= count; i++) {
      deck.push({
        id: `money_${val}_${i}`,
        type: CardType.MONEY,
        value: val,
        name: `$${val}`,
        subname: "Грошова купюра",
        description: "Використовується для оплати ренти та боргів у особистому банку"
      });
    }
  });

  // 2. PROPERTIES (28 cards)
  const propColors = [
    CardColor.PINK,
    CardColor.ORANGE,
    CardColor.BROWN,
    CardColor.LIGHT_GREEN,
    CardColor.PURPLE,
    CardColor.DARK_BLUE,
    CardColor.LIGHT_BLUE,
    CardColor.GREEN,
    CardColor.RED,
    CardColor.MAROON
  ];

  propColors.forEach((color) => {
    const cfg = PROPERTY_CONFIG[color];
    cfg.values.forEach((val, index) => {
      const streetName = cfg.names[index] || `Нерухомість ${color}`;
      deck.push({
        id: `prop_${color.toLowerCase()}_${index + 1}`,
        type: CardType.PROPERTY,
        value: val,
        colors: [color],
        name: streetName,
        subname: color,
        rentValues: Array.from({ length: cfg.setSize }, (_, k) => k + 1),
        fullSetSize: cfg.setSize,
        description: `Комплект складається з ${cfg.setSize} карт. Рента = кількості карт.`
      });
    });
  });

  // 3. PROPERTY WILDCARDS (11 cards)
  const wildcards = [
    { baseId: 'wild_darkblue_brown', colors: [CardColor.DARK_BLUE, CardColor.BROWN], values: [1, 2], name: "Темно-синя / Коричнева" },
    { baseId: 'wild_purple_lightblue', colors: [CardColor.PURPLE, CardColor.LIGHT_BLUE], values: [2, 3], name: "Фіолетова / Блакитна" },
    { baseId: 'wild_lightgreen_darkmaroon', colors: [CardColor.LIGHT_GREEN, CardColor.DARK_MAROON], values: [2], name: "Салатова / Темно-бордова" },
    { baseId: 'wild_orange_darkgreen', colors: [CardColor.ORANGE, CardColor.DARK_GREEN], values: [2], name: "Помаранчева / Темно-зелена" },
    { baseId: 'wild_pink_orange', colors: [CardColor.PINK, CardColor.ORANGE], values: [2], name: "Рожева / Помаранчева" },
    { baseId: 'wild_green_pink', colors: [CardColor.GREEN, CardColor.PINK], values: [3], name: "Зелена / Рожева" },
    { baseId: 'wild_red_pink', colors: [CardColor.RED, CardColor.PINK], values: [2], name: "Червона / Рожева" },
    { baseId: 'wild_all', colors: [CardColor.ALL_COLOR], values: [3, 3], name: "Універсальна карта" }
  ];

  wildcards.forEach(({ baseId, colors, values, name }) => {
    values.forEach((val, i) => {
      deck.push({
        id: `${baseId}_${i + 1}`,
        type: CardType.PROPERTY_WILDCARD,
        value: val,
        colors,
        name,
        subname: "Універсальна карта",
        description: colors[0] === CardColor.ALL_COLOR
          ? "Може використовуватись як будь-який колір. Колір обирається при викладанні."
          : "Можна змінювати активний колір (коштує 1 дію)."
      });
    });
  });

  // 4. ACTIONS (31 cards)
  const actionConfigs: Array<{
    baseId: string;
    count: number;
    actionType: ActionCardType;
    name: string;
    description: string;
    isBuilding?: BuildingType;
  }> = [
    {
      baseId: 'action_pass_go',
      count: 9,
      actionType: ActionCardType.PASS_GO,
      name: "Вперед!",
      description: "Візьміть 2 карти з колоди. Витрачає 1 дію."
    },
    {
      baseId: 'action_sly_deal',
      count: 4,
      actionType: ActionCardType.SLY_DEAL,
      name: "Спритна угода",
      description: "Вкрадіть 1 вільну нерухомість у будь-якого суперника (крім повного комплекту)."
    },
    {
      baseId: 'action_forced_deal',
      count: 3,
      actionType: ActionCardType.FORCED_DEAL,
      name: "Примусова угода",
      description: "Обміняйте 1 свою нерухомість на 1 нерухомість суперника (крім повних комплектів)."
    },
    {
      baseId: 'action_deal_breaker',
      count: 2,
      actionType: ActionCardType.DEAL_BREAKER,
      name: "Зривник угод",
      description: "Вкрадіть цілий зібраний комплект нерухомості разом із будинками та готелем!"
    },
    {
      baseId: 'action_just_say_no',
      count: 3,
      actionType: ActionCardType.JUST_SAY_NO,
      name: "Ні!",
      description: "Скасовує будь-яку дію суперника проти вас. Грається позачергово."
    },
    {
      baseId: 'action_debt_collector',
      count: 3,
      actionType: ActionCardType.DEBT_COLLECTOR,
      name: "Збирач боргів",
      description: "Один обраний гравець повинен заплатити вам $5."
    },
    {
      baseId: 'action_birthday',
      count: 3,
      actionType: ActionCardType.BIRTHDAY,
      name: "День народження",
      description: "Усі гравці повинні подарувати вам по $2."
    },
    {
      baseId: 'action_house',
      count: 2,
      actionType: ActionCardType.HOUSE,
      name: "Будинок",
      isBuilding: BuildingType.HOUSE,
      description: "Додає +$3 до ренти повного комплекту. Максимум 1 на монополію."
    },
    {
      baseId: 'action_hotel',
      count: 2,
      actionType: ActionCardType.HOTEL,
      name: "Готель",
      isBuilding: BuildingType.HOTEL,
      description: "Додає +$4 до ренти комплекту з будинком. Максимум 1 на монополію."
    }
  ];

  actionConfigs.forEach((cfg) => {
    for (let i = 1; i <= cfg.count; i++) {
      deck.push({
        id: `${cfg.baseId}_${i}`,
        type: CardType.ACTION,
        actionType: cfg.actionType,
        isBuilding: cfg.isBuilding,
        name: cfg.name,
        subname: "Карта дії",
        description: cfg.description
      });
    }
  });

  // 5. RENT ACTIONS (15 cards)
  const rentConfigs = [
    { baseId: 'rent_green_lightblue', count: 4, colors: [CardColor.GREEN, CardColor.LIGHT_BLUE], name: "Рента: Зелений / Блакитний" },
    { baseId: 'rent_red_pink', count: 2, colors: [CardColor.RED, CardColor.PINK], name: "Рента: Червоний / Рожевий" },
    { baseId: 'rent_orange_green', count: 2, colors: [CardColor.ORANGE, CardColor.GREEN], name: "Рента: Помаранчевий / Зелений" },
    { baseId: 'rent_darkblue_purple', count: 1, colors: [CardColor.DARK_BLUE, CardColor.PURPLE], name: "Рента: Темно-синій / Фіолетовий" },
    { baseId: 'rent_lightgreen_maroon', count: 1, colors: [CardColor.LIGHT_GREEN, CardColor.MAROON], name: "Рента: Салатовий / Бордовий" },
    { baseId: 'rent_wild', count: 3, colors: [CardColor.ALL_COLOR], name: "Універсальна рента" },
    { baseId: 'rent_double', count: 2, actionType: ActionCardType.DOUBLE_RENT, name: "Подвійна рента" }
  ];

  rentConfigs.forEach((cfg) => {
    for (let i = 1; i <= cfg.count; i++) {
      if (cfg.actionType === ActionCardType.DOUBLE_RENT) {
        deck.push({
          id: `${cfg.baseId}_${i}`,
          type: CardType.ACTION,
          actionType: ActionCardType.DOUBLE_RENT,
          name: cfg.name,
          subname: "Множник ренти x2",
          description: "Грається разом із картою ренти. Коштує 2 дії разом."
        });
      } else {
        deck.push({
          id: `${cfg.baseId}_${i}`,
          type: CardType.ACTION,
          actionType: ActionCardType.RENT,
          colors: cfg.colors,
          name: cfg.name,
          subname: "Збір ренти",
          description: cfg.colors?.[0] === CardColor.ALL_COLOR
            ? "Один гравець платить ренту за будь-який один обраний колір вашої нерухомості."
            : "Усі гравці платять ренту за вказаний колір."
        });
      }
    }
  });

  return deck;
};

export const ALL_CARDS = generateFullDeck();
