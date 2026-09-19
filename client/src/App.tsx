import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LobbyPage } from './pages/LobbyPage/LobbyPage';
import { OnlineGamePage } from './pages/OnlineGamePage/OnlineGamePage';
// Test route for visually inspecting all 107 cards
import { DeckPreviewPage } from './pages/DeckPreviewPage/DeckPreviewPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Main entry: Multiplayer Lobby (Create/Join/Waiting Room) */}
        <Route path="/" element={<LobbyPage />} />
        <Route path="/room/:roomId" element={<LobbyPage />} />
        <Route path="/game/:gameId" element={<OnlineGamePage />} />

        {/* Inspection route for all 107 cards */}
        <Route path="/cards" element={<DeckPreviewPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
