/**
 * ==============================================================================================
 * TODO: [CLEANUP WHEN GAME IS READY]
 * Once the main game is finished:
 * 1. Remove route <Route path="/cards" element={<DeckPreviewPage />} />
 * 2. Remove DeckPreviewPage import
 * 3. Delete file client/src/pages/DeckPreviewPage/DeckPreviewPage.tsx
 * 
 * NOTE: Card rendering components (Card.tsx, Card.module.css) and dataset (allCards.ts)
 * MUST NOT BE DELETED — they are core gameplay components!
 * ==============================================================================================
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LobbyPage } from './pages/LobbyPage/LobbyPage';
import { GameBoardPage } from './pages/GameBoardPage/GameBoardPage';
// TODO: Remove DeckPreviewPage import once the game is ready
import { DeckPreviewPage } from './pages/DeckPreviewPage/DeckPreviewPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Main entry: Multiplayer Lobby (Create/Join/Waiting Room) */}
        <Route path="/" element={<LobbyPage />} />
        <Route path="/room/:roomId" element={<LobbyPage />} />

        {/* Practice / Offline Table (with mock controls and tests) */}
        <Route path="/practice" element={<GameBoardPage />} />

        {/* 
          TODO: Test route for visually inspecting all 107 cards.
          Remove before release!
        */}
        <Route path="/cards" element={<DeckPreviewPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
