import { tarotDeck, type TarotCard } from "./cards";

export type DrawnCard = {
  card: TarotCard;
  reversed: boolean;
};

const REVERSED_CARD_PROBABILITY = 0.5;

export function drawCards(count: number, allowReversed: boolean = true): DrawnCard[] {
  const shuffled = [...tarotDeck].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((card) => ({
    card,
    reversed: allowReversed && Math.random() < REVERSED_CARD_PROBABILITY,
  }));
}
