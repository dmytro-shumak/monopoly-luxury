import { FULL_DECK_IDS } from "./cards.js";

export class DeckManager {
  private drawPile: string[] = [];
  private discardPile: string[] = [];

  constructor() {
    this.initDeck();
  }

  // Initialize and shuffle the deck
  public initDeck(): void {
    this.drawPile = [...FULL_DECK_IDS];
    this.discardPile = [];
    this.shuffle(this.drawPile);
  }

  // Draw N cards from the deck
  public drawCards(count: number): string[] {
    const drawn: string[] = [];
    for (let i = 0; i < count; i++) {
      if (this.drawPile.length === 0) {
        if (this.discardPile.length === 0) {
          // No more cards at all
          break;
        }
        // Reshuffle discard pile into draw pile
        this.drawPile = [...this.discardPile];
        this.discardPile = [];
        this.shuffle(this.drawPile);
      }
      const card = this.drawPile.pop();
      if (card) drawn.push(card);
    }
    return drawn;
  }

  // Add cards to the discard pile
  public discard(cards: string[]): void {
    this.discardPile.push(...cards);
  }

  // Peek the top card of the discard pile
  public getTopDiscard(): string | null {
    if (this.discardPile.length === 0) return null;
    return this.discardPile[this.discardPile.length - 1] ?? null;
  }

  public getDrawPileCount(): number {
    return this.drawPile.length;
  }

  public getDiscardPile(): string[] {
    return [...this.discardPile];
  }

  // Fisher-Yates Shuffle
  private shuffle(array: string[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j]!, array[i]!];
    }
  }
}
