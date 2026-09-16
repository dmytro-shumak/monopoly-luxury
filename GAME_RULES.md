# RFC: Custom Card Game Logic (Monopoly Deal)

**Stack:** Node.js (TypeScript) + React + WebSockets.
**Architecture:** The server acts as the Single Source of Truth (SSOT). The client strictly renders the server state and dispatches intents (events).

## 1. Turn Cycle and Basic Rules
*   **Game Start:** Each player is dealt 5 cards.
*   **Turn Start:** A player automatically draws 2 cards from the deck (even if their hand is empty). If the main draw pile is empty, the discard pile is reshuffled to form a new draw pile.
*   **Actions:** A player can play 0 to 3 actions per turn. Discarding a card from the hand directly to the discard pile cannot be done as an action.
*   **Turn End:** If a player has more than 7 cards in their hand at the end of their turn, they must discard the excess cards into the discard pile (this does not consume actions).
*   **Win Condition:** A player wins instantly if they assemble 3 complete monopolies of different colors on their table.

## 2. Finances and Debts
*   **Personal Bank:** Only money cards can be placed in the personal bank on the table. Property cards cannot be used as banked money.
*   **No Change:** No change is given. If a player owes $1 but pays with a $3 card, the overpayment is lost.
*   **Strict Payment Hierarchy:** Debts must be paid in the following strict order until fully settled:
    1. Money from the bank.
    2. Free properties on the table (transferred at their printed face value).
    3. Breaking own complete monopolies (only if options 1 and 2 are exhausted).
*   **Building Destruction:** If a player is forced to break a monopoly to pay a debt, any House or Hotel on it must be discarded to the discard pile. The underlying property cards are then used to pay the debt.
*   **Debt Forgiveness:** If a player's table is completely empty (no money, no properties), any remaining debt is forgiven. The player is not eliminated from the game.
*   **Asset Transfer:** Properties transferred to settle a debt go immediately into the active property zone on the receiver's table.

## 3. Properties and Monopolies
*   **Grouping:** Players can freely move wildcard properties between incomplete sets on their table (does consume an action), provided the color of the wildcard is not changed.
*   **Two-Color Wildcards:** Changing the active color of a two-color wildcard lying on the table **costs 1 action**.
*   **Color Lock:** Once a set becomes a complete monopoly, the colors of all wildcards within it are locked and cannot be changed. If the monopoly is broken (e.g., due to debt), the cards are unlocked.
*   **All-Color Wildcard (10-Color Property):** Once played on the table, its color cannot be changed. Exception: if transferred to settle a debt, the new owner assigns its color upon receipt. A monopoly cannot be formed exclusively from these cards (must contain at least one standard or two-color property).
*   **Rent Calculation:** The rent amount for a color is strictly equal to the number of property cards of that color currently on the player's table (e.g., 3 Pink cards = $3 rent).
*   **Buildings:** A House can be placed on a complete monopoly (adds $3 to the rent). A Hotel can be placed on a House (adds another $4 to the rent). Maximum 1 House and 1 Hotel per monopoly.

## 4. Action Cards (Discarded After Use)
*   **Pass Go:** Draw 2 cards from the deck (costs 1 action).
*   **Just Say No (Cancel):** Cancels any action directed against the player. Played out of turn, does not consume an action. Chains are prohibited (a "Just Say No" cannot be canceled). Protects only the initiator (e.g., against a Birthday card, other players still pay).
*   **Sly Deal:** Steal 1 free (non-monopoly) property card from an opponent.
*   **Forced Deal:** Swap 1 of your free property cards for 1 of an opponent's free property cards. Voluntary trades are prohibited. If canceled by the opponent, the initiator loses their action and the action card, but their proposed property remains on their table.
*   **Deal Breaker:** Steal a completely assembled monopoly from an opponent, including buildings if present.
*   **Birthday (Gift):** All other players pay $2 to the initiator.
*   **Debt Collector:** One targeted player pays $5 to the initiator.
*   **Color Rent:** One targeted player pays rent for the specified color (the initiator must own at least 1 property of that color).
*   **Wild Rent:** One targeted player pays rent for any one color owned by the initiator.
*   **Double Rent:** Doubles the final rent amount. Must be played alongside any Rent card. This combination costs 2 actions. Blocked if the player has only 1 action left.

## 5. Monopoly Configurations (Set Sizes)
Number of cards required to complete a monopoly:
*   **Pink:** 4 cards
*   **Orange, Brown, Light Green, Purple, Dark Blue, Light Blue:** 3 cards each
*   **Green, Red, Maroon, Dark Green, Dark Maroon:** 2 cards each
*(Note: Dark Green and Dark Maroon have no standard cards. A set is assembled using the specific two-color wildcard + an All-Color Wildcard).*

## 6. Deck Composition (JSON/Init Data)
Total Cards: 107 (based on the custom configuration provided).

**Money (22 cards):**
*   $1: 7
*   $2: 5
*   $3: 4
*   $4: 3
*   $5: 2
*   $10: 1

**Standard Properties (28 cards):**
*   Pink: 4
*   Orange: 3 | Brown: 3 | Light Green: 3 | Purple: 3 | Dark Blue: 3 | Light Blue: 3
*   Green: 2 | Red: 2 | Maroon: 2

**Wildcard Properties (11 cards):**
*   Dark Blue / Brown: 2
*   Purple / Light Blue: 2
*   Light Green / Dark Maroon: 1
*   Orange / Dark Green: 1
*   Pink / Orange: 1
*   Green / Pink: 1
*   Red / Pink: 1
*   All-Color Property: 2

**Action Cards (46 cards):**
*   Pass Go (Draw 2): 9
*   Sly Deal: 4
*   Green/Light Blue Rent: 4
*   Birthday (Gift): 3
*   Debt Collector: 3
*   Forced Deal: 3
*   Just Say No (Cancel): 3
*   Wild Rent: 3
*   House: 2
*   Hotel: 2
*   Deal Breaker: 2
*   Double Rent: 2
*   Red/Pink Rent: 2
*   Orange/Green Rent: 2
*   Dark Blue/Purple Rent: 1
*   Light Green/Maroon Rent: 1