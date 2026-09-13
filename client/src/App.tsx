import { useState } from 'react';
import { Card } from './components/Card/Card';
import { ALL_CARDS } from './data/allCards';
import { type CardModel, CardType, ActionCardType } from './types/cards';

export function App() {
  const [activeTab, setActiveTab] = useState<'ALL' | 'MONEY' | 'PROPERTY' | 'WILDCARD' | 'ACTION' | 'RENT'>('ALL');
  const [selectedCard, setSelectedCard] = useState<CardModel | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCards = ALL_CARDS.filter((card) => {
    // Tab filter
    if (activeTab === 'MONEY' && card.type !== CardType.MONEY) return false;
    if (activeTab === 'PROPERTY' && card.type !== CardType.PROPERTY) return false;
    if (activeTab === 'WILDCARD' && card.type !== CardType.PROPERTY_WILDCARD) return false;
    if (activeTab === 'ACTION' && (card.type !== CardType.ACTION || card.actionType === ActionCardType.RENT || card.actionType === ActionCardType.DOUBLE_RENT)) return false;
    if (activeTab === 'RENT' && (card.actionType !== ActionCardType.RENT && card.actionType !== ActionCardType.DOUBLE_RENT)) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = card.name.toLowerCase().includes(q);
      const matchId = card.id.toLowerCase().includes(q);
      const matchType = card.type.toLowerCase().includes(q);
      const matchColors = card.colors?.some(c => c.toLowerCase().includes(q));
      return matchName || matchId || matchType || matchColors;
    }

    return true;
  });

  const counts = {
    ALL: ALL_CARDS.length,
    MONEY: ALL_CARDS.filter(c => c.type === CardType.MONEY).length,
    PROPERTY: ALL_CARDS.filter(c => c.type === CardType.PROPERTY).length,
    WILDCARD: ALL_CARDS.filter(c => c.type === CardType.PROPERTY_WILDCARD).length,
    ACTION: ALL_CARDS.filter(c => c.type === CardType.ACTION && c.actionType !== ActionCardType.RENT && c.actionType !== ActionCardType.DOUBLE_RENT).length,
    RENT: ALL_CARDS.filter(c => c.actionType === ActionCardType.RENT || c.actionType === ActionCardType.DOUBLE_RENT).length,
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at 50% 20%, #170724 0%, #08020d 100%)',
      color: 'var(--color-text-main)',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto'
    }}>
      {/* Top Header */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: 'rgba(10, 4, 16, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(212, 175, 55, 0.3)',
        padding: '16px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', letterSpacing: '1px' }}>Monopoly Deal — Повна колода ({ALL_CARDS.length} карт)</h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
              Клікніть на будь-яку картку для детального огляду. Усі 107 карт згідно з бекендом та правилами.
            </p>
          </div>

          <input
            type="text"
            placeholder="Пошук карти (наприклад: Хрещатик, rent, 5, wild)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--color-gold)',
              borderRadius: '8px',
              padding: '8px 16px',
              color: '#fff',
              fontSize: '0.9rem',
              outline: 'none',
              minWidth: '280px'
            }}
          />
        </div>

        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(['ALL', 'MONEY', 'PROPERTY', 'WILDCARD', 'ACTION', 'RENT'] as const).map((tab) => {
            const labels = {
              ALL: `Всі карти (${counts.ALL})`,
              MONEY: `Гроші (${counts.MONEY})`,
              PROPERTY: `Нерухомість (${counts.PROPERTY})`,
              WILDCARD: `Універсальні (${counts.WILDCARD})`,
              ACTION: `Дії (${counts.ACTION})`,
              RENT: `Рента (${counts.RENT})`
            };

            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: isActive ? 'var(--color-gold)' : 'rgba(212, 175, 55, 0.1)',
                  color: isActive ? '#120520' : 'var(--color-gold-light)',
                  border: '1px solid var(--color-gold)',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  cursor: 'pointer',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.8rem',
                  transition: 'all 150ms ease'
                }}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Grid of Cards */}
      <main style={{
        padding: '24px 28px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        justifyContent: 'flex-start',
        alignItems: 'flex-start'
      }}>
        {filteredCards.map((card) => (
          <div key={card.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <Card
              card={card}
              onClick={() => setSelectedCard(card)}
              isHighlighted={selectedCard?.id === card.id}
            />
            <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
              {card.id}
            </span>
          </div>
        ))}

        {filteredCards.length === 0 && (
          <div style={{ padding: '40px', color: 'var(--color-text-muted)', textAlign: 'center', width: '100%' }}>
            Карток за вашим запитом не знайдено
          </div>
        )}
      </main>

      {/* Card Detail Modal */}
      {selectedCard && (
        <div
          onClick={() => setSelectedCard(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#150824',
              border: '2px solid var(--color-gold)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.4rem' }}>{selectedCard.name}</h2>
              <button
                onClick={() => setSelectedCard(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-gold)',
                  fontSize: '1.5rem',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <div style={{ transform: 'scale(1.15)', transformOrigin: 'top left', margin: '8px 20px 24px 8px' }}>
                <Card card={selectedCard} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                <div><strong>ID:</strong> <code style={{ color: 'var(--color-gold-light)' }}>{selectedCard.id}</code></div>
                <div><strong>Тип:</strong> {selectedCard.type}</div>
                {selectedCard.value !== undefined && (
                  <div><strong>Вартість:</strong> ${selectedCard.value}</div>
                )}
                {selectedCard.colors && (
                  <div><strong>Кольори:</strong> {selectedCard.colors.join(', ')}</div>
                )}
                {selectedCard.fullSetSize && (
                  <div><strong>Розмір комплекту:</strong> {selectedCard.fullSetSize} шт.</div>
                )}
                {selectedCard.rentValues && (
                  <div><strong>Рента:</strong> {selectedCard.rentValues.map((r, i) => `${i + 1}🏠: $${r}`).join(' | ')}</div>
                )}
                {selectedCard.description && (
                  <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', color: '#ddd' }}>
                    {selectedCard.description}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                onClick={() => setSelectedCard(null)}
                style={{
                  background: 'var(--color-gold)',
                  color: '#0a0410',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 18px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
