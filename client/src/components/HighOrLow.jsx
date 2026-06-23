import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

const RED_SUITS = ['♥', '♦'];
const GAME_DURATION = 10;

function CardFace({ card, revealed = true, flipping = false }) {
  const isRed = RED_SUITS.includes(card?.suit);
  return (
    <div className={`hol-card ${isRed ? 'red' : 'black'} ${flipping ? 'flip' : ''} ${!revealed ? 'face-down' : ''}`}>
      {revealed && card ? (
        <>
          <span className="hol-card-corner top-left">
            <span className="hol-card-val">{card.value}</span>
            <span className="hol-card-suit">{card.suit}</span>
          </span>
          <span className="hol-card-center">{card.suit}</span>
          <span className="hol-card-corner bottom-right">
            <span className="hol-card-val">{card.value}</span>
            <span className="hol-card-suit">{card.suit}</span>
          </span>
        </>
      ) : (
        <div className="hol-card-back">🂠</div>
      )}
    </div>
  );
}

function Countdown({ timeLeft, total }) {
  const pct = timeLeft / total;
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const color = timeLeft <= 3 ? '#ef4444' : timeLeft <= 6 ? '#f59e0b' : '#00a884';
  return (
    <div className="hol-countdown">
      <svg width="60" height="60" viewBox="0 0 60 60">
        <circle cx="30" cy="30" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
        <circle
          cx="30" cy="30" r={r} fill="none"
          stroke={color} strokeWidth="4"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 30 30)"
          style={{ transition: 'stroke-dasharray 0.9s linear, stroke 0.3s' }}
        />
        <text x="30" y="35" textAnchor="middle" fill={color} fontSize="16" fontWeight="700" fontFamily="inherit">
          {timeLeft}
        </text>
      </svg>
    </div>
  );
}

export default function HighOrLow({ socket, currentRoom }) {
  const [phase, setPhase] = useState('idle'); // idle | voting | result
  const [gameState, setGameState] = useState(null);
  const [myVote, setMyVote] = useState(null);
  const [votes, setVotes] = useState({ higherCount: 0, lowerCount: 0 });
  const [result, setResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [flipping, setFlipping] = useState(false);
  const timerRef = useRef(null);

  // Reset when room changes
  useEffect(() => {
    setPhase('idle');
    setGameState(null);
    setMyVote(null);
    setVotes({ higherCount: 0, lowerCount: 0 });
    setResult(null);
  }, [currentRoom?.id]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const onGameState = (data) => {
      setGameState(data);
      setMyVote(null);
      setVotes({ higherCount: 0, lowerCount: 0 });
      setResult(null);
      setFlipping(false);
      const elapsed = Math.floor((Date.now() - data.startedAt) / 1000);
      const remaining = Math.max(0, data.duration - elapsed);
      setTimeLeft(remaining);
      setPhase('voting');
    };

    const onVotesUpdate = (data) => setVotes(data);

    const onGameResult = (data) => {
      clearInterval(timerRef.current);
      setFlipping(true);
      setResult(data);
      setTimeout(() => { setFlipping(false); setPhase('result'); }, 700);
      setTimeout(() => {
        setPhase('idle');
        setGameState(null);
        setResult(null);
        setMyVote(null);
      }, 7000);
    };

    socket.on('game_state', onGameState);
    socket.on('game_votes_update', onVotesUpdate);
    socket.on('game_result', onGameResult);

    return () => {
      socket.off('game_state', onGameState);
      socket.off('game_votes_update', onVotesUpdate);
      socket.off('game_result', onGameResult);
    };
  }, [socket]);

  // Countdown ticker
  useEffect(() => {
    if (phase !== 'voting') { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const handleStart = useCallback(() => {
    if (!socket || !currentRoom) return;
    socket.emit('game_start', currentRoom.id, (ack) => {
      if (ack?.error) alert(ack.error);
    });
  }, [socket, currentRoom]);

  const handleVote = useCallback((vote) => {
    if (!socket || !currentRoom || myVote) return;
    socket.emit('game_vote', { roomId: currentRoom.id, vote }, (ack) => {
      if (ack?.error) alert(ack.error);
      else setMyVote(vote);
    });
  }, [socket, currentRoom, myVote]);

  // The trigger button always lives in the input bar (rendered via portal into #hol-btn-slot)
  const triggerBtn = (
    <button
      id="start-game-btn"
      className={`hol-start-btn ${phase !== 'idle' ? 'hol-start-btn--active' : ''}`}
      onClick={phase === 'idle' ? handleStart : undefined}
      title="High or Low — Juego grupal de cartas"
      disabled={!currentRoom}
    >
      🎴
    </button>
  );

  // Modal overlay (voting + result) rendered via portal to avoid stacking issues
  const votingModal = phase === 'voting' && (
    <div className="hol-overlay">
      <div className="hol-modal" onClick={e => e.stopPropagation()}>
        <div className="hol-modal-header">
          <span className="hol-title">🎰 High or Low</span>
          <span className="hol-starter">por {gameState?.startedBy}</span>
        </div>

        <p className="hol-question">¿La siguiente carta será más alta o más baja?</p>

        <div className="hol-cards-row">
          <CardFace card={gameState?.currentCard} revealed />
          <div className="hol-arrow">→</div>
          <CardFace card={null} revealed={false} />
        </div>

        <Countdown timeLeft={timeLeft} total={GAME_DURATION} />

        <div className="hol-vote-btns">
          <button
            id="vote-higher-btn"
            className={`hol-vote-btn higher ${myVote === 'higher' ? 'active' : ''}`}
            onClick={() => handleVote('higher')}
            disabled={!!myVote}
          >
            ⬆️ HIGHER
          </button>
          <button
            id="vote-lower-btn"
            className={`hol-vote-btn lower ${myVote === 'lower' ? 'active' : ''}`}
            onClick={() => handleVote('lower')}
            disabled={!!myVote}
          >
            ⬇️ LOWER
          </button>
        </div>

        {myVote && (
          <p className="hol-voted-msg">
            ✅ Votaste <strong>{myVote === 'higher' ? 'HIGHER ⬆️' : 'LOWER ⬇️'}</strong> — ¡espera el resultado!
          </p>
        )}

        {(votes.higherCount + votes.lowerCount) > 0 && (
          <div className="hol-vote-counts">
            <span className="hol-vc-chip higher">⬆️ {votes.higherCount}</span>
            <span className="hol-vote-sep">vs</span>
            <span className="hol-vc-chip lower">⬇️ {votes.lowerCount}</span>
          </div>
        )}
      </div>
    </div>
  );

  const resultModal = phase === 'result' && result && (() => {
    const won = myVote && myVote === result.result;
    const lost = myVote && myVote !== result.result && result.result !== 'tie';
    const tie = result.result === 'tie';
    return (
      <div className="hol-overlay">
        <div className={`hol-modal result ${won ? 'win' : lost ? 'lose' : 'tie'}`}>
          <div className="hol-result-emoji">
            {tie ? '🤝' : won ? '🏆' : myVote ? '💀' : '🎴'}
          </div>
          <h2 className="hol-result-title">
            {tie ? '¡Empate!' : won ? '¡Ganaste!' : myVote ? '¡Perdiste!' : 'Resultado'}
          </h2>

          <div className="hol-cards-row revealed">
            <CardFace card={result.currentCard} revealed />
            <div className={`hol-result-arrow ${result.result}`}>
              {result.result === 'higher' ? '⬆️' : result.result === 'lower' ? '⬇️' : '⚖️'}
            </div>
            <CardFace card={result.nextCard} revealed flipping={flipping} />
          </div>

          {result.winners?.length > 0 && (
            <p className="hol-result-line winners">🏆 {result.winners.join(', ')}</p>
          )}
          {result.losers?.length > 0 && (
            <p className="hol-result-line losers">💀 {result.losers.join(', ')}</p>
          )}
          {!myVote && (
            <p className="hol-result-line muted">No votaste en esta ronda</p>
          )}
          <p className="hol-result-closing">Nueva ronda en unos segundos...</p>
        </div>
      </div>
    );
  })();

  // Render trigger button into the designated slot in the input bar
  const btnSlot = document.getElementById('hol-btn-slot');

  return (
    <>
      {/* Button injected into input bar slot */}
      {btnSlot ? createPortal(triggerBtn, btnSlot) : triggerBtn}
      {/* Modals rendered at chat-area level */}
      {votingModal}
      {resultModal}
    </>
  );
}
