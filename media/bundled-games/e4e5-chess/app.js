import {html, render, useState} from './htm.js';
import Chess from './chess.js';

// Register service worker for PWA
// navigator.serviceWorker.register('sw.js');

let level = 8;
let side = 'w';
let showHints = true;

class ChessEngine {
  constructor() {
    this.chess = new Chess();
    if (localStorage.getItem('pgn')) {
      this.chess.load_pgn(localStorage.getItem('pgn'));
    }
    const wasm =
      typeof WebAssembly === 'object' &&
      WebAssembly.validate(
        Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00),
      );
    this.stockfish = new Worker(wasm ? 'stockfish.wasm.js' : 'stockfish.js');
    this.stockfish.addEventListener('message', e => {
      if (!e || !e.data) {
        return;
      }
      let best = e.data.match(/^bestmove ([a-h][1-8])([a-h][1-8])([qrbk])?/);
      if (best) {
        let from = best[1];
        let to = best[2];
        const cb = this.cb;
        if (!cb) {
          return;
        }
        this.cb = undefined;
        cb(
          chess
            .moves({verbose: true})
            .find(m => m.from === from && m.to === to),
        );
      }
    });
  }
  move(move, options) {
    console.log('move', move, this.fen());
    this.chess.move(move, options);
    console.log('move2', move, this.fen());
    this.save();
  }
  reset() {
    this.chess.reset();
    this.save();
  }
  game_over() {
    return this.chess.game_over();
  }
  get(sq) {
    return this.chess.get(sq);
  }
  fen() {
    return this.chess.fen();
  }
  undo() {
    this.cancel();
    this.chess.undo();
  }
  moves(options) {
    return this.chess.moves(options);
  }
  save() {
    localStorage.setItem('pgn', this.chess.pgn());
  }
  analyze(level, cb) {
    const skill = Math.max(0, Math.min(level, 20));
    const errorProbability = Math.round(skill * 6.35 + 1);
    const maxError = Math.round(skill * -0.5 + 10);
    this.cb = cb;
    this.stockfish.postMessage(`position fen ${this.fen()}`);
    this.stockfish.postMessage(`setoption name Skill Level value ${skill}`);
    this.stockfish.postMessage(
      `setoption name Skill Level Maximum Error value ${maxError}`,
    );
    this.stockfish.postMessage(
      `setoption name Skill Level Probability value ${errorProbability}`,
    );
    this.stockfish.postMessage('go movetime 1500');
  }
  cancel() {
    this.cb = undefined;
    this.stockfish.postMessage('stop');
  }
}

const chess = new ChessEngine();

const defaultTheme =
  window.matchMedia &&
  window.matchMedia('(prefers-color-scheme: dark)').matches
  ? 'dark'
  : 'light';
const currentTheme = localStorage.getItem('ui-theme') || defaultTheme;
document.documentElement.setAttribute('data-theme', currentTheme);

const App = () => {
  const [open, setOpen] = useState(false);
  const [theme, setThemeInternal] = useState(currentTheme);
  const setTheme = t => {
    localStorage.setItem('ui-theme', t);
    document.documentElement.setAttribute('data-theme', t);
    setThemeInternal(t);
  };
  const [piece, setPiece] = useState('');
  const [opponentMove, setOpponentMove] = useState({});
  const [hint, setHint] = useState({});
  const [thinking, setThinking] = useState(false);
  const moves = chess.moves({square: piece, verbose: true}).map(m => m.to);
  const doComputerMove = () => {
    setThinking(true);
    chess.analyze(level, m => {
      chess.move(m);
      setOpponentMove(m);
      setThinking(false);
      if (showHints) {
        chess.analyze(20, m => {
          setHint(m);
        });
      }
    });
  };
  const doMove = m => {
    if (m === undefined) {
      undo();
      return;
    }
    chess.move(m);
    doComputerMove();
    setPiece('');
  };
  const undo = () => {
    chess.undo();
    chess.undo();
    setPiece('');
    setHint({});
    setOpponentMove({});
    setOpen(false);
  };
  const newGame = () => {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
      for (let registration of registrations) {
        console.log('update registration');
        registration.update();
      }
    });
    chess.reset();
    setPiece('');
    setHint({});
    setOpponentMove({});
    setOpen(false);
  };
  const swap = () => {
    side = side === 'w' ? 'b' : 'w';
    setPiece('');
    setHint({});
    setOpponentMove({});
    doComputerMove();
    setOpen(false);
  };
  const setLevel = l => {
    level = l;
    setOpen(false);
  };
  const toggleHints = () => {
    showHints = !showHints;
    if (!showHints) {
      setHint({});
    } else {
      chess.analyze(20, m => setHint(m));
    }
    setOpen(false);
  };

  return html`
    <div class="container">
      <${Board}
        theme=${theme}
        flipped=${side === 'b'}
        fen=${chess.fen()}
        piece=${piece}
        setPiece=${p => {
          chess.cancel();
          setPiece(p);
          setHint({});
          setOpponentMove({});
        }}
        moves=${moves}
        hint=${hint}
        opponentMove=${opponentMove}
        doMove=${doMove}
        thinking=${thinking}
      />
      <${Menu}
        class=${open ? '' : 'hidden'}
        newGame=${newGame}
        undo=${undo}
        swap=${swap}
        level=${level}
        theme=${theme}
        setLevel=${setLevel}
        toggleHints=${toggleHints}
        setTheme=${setTheme}
      />
      <${MenuButton}
        class=${open ? 'open' : ''}
        onClick=${() => setOpen(!open)}
      />
      <${BuyMeACoffee} />
      <${Dialog} class=${chess.game_over() ? '' : 'hidden'}>
        <div class="dialog-content">
          <h1>${
            chess.chess.in_draw()
              ? "Umm… It's a draw"
              : chess.chess.turn() === 'b'
              ? 'Well, you won!'
              : 'Sorry, you lost.'
          }</h1>
          <a onClick=${() => ({})}><h1>Huh?!</h1></a>
          <a onClick=${newGame}><h1>Ok.</h1></a>
        </div>
      </${Dialog}>
    </div>
  `;
};

const MenuButton = props => {
  return html`
    <div ...${props} class="hamburger ${props.class}">
      <div class="line-1"></div>
      <div class="line-2"></div>
    </div>
  `;
};

const BuyMeACoffee = () => {
  return html`
    <div />
  `;
};

const SYMBOLS = {
  P: 'wp.svg',
  N: 'wn.svg',
  B: 'wb.svg',
  R: 'wr.svg',
  Q: 'wq.svg',
  K: 'wk.svg',
  p: 'bp.svg',
  n: 'bn.svg',
  b: 'bb.svg',
  r: 'br.svg',
  q: 'bq.svg',
  k: 'bk.svg',
  '.': '',
};

const SQUARE = (row, col) => 'abcdefgh'[col] + (8 - row);

const Board = ({
  flipped,
  theme,
  fen,
  piece,
  setPiece,
  moves,
  opponentMove,
  hint,
  doMove,
  thinking,
}) => {
  const rows = fen
    .split(' ')[0]
    .split('/')
    .slice(0, 8)
    .map(r => r.replace(/\d/g, n => '.'.repeat(n)));

  const onClick = (row, col) => {
    if (thinking) {
      return;
    }
    const sq = SQUARE(row, col);
    if (!piece) {
      if (sq === opponentMove.to) {
        doMove();
        return;
      }
      const moves = chess.moves({square: sq, verbose: true});
      if (moves.length > 0) {
        setPiece(sq);
      }
    } else if (sq === piece) {
      setPiece('');
    } else if (
      chess.get(sq) &&
      chess.get(sq).color === chess.get(piece).color
    ) {
      const moves = chess.moves({square: sq, verbose: true});
      if (moves.length > 0) {
        setPiece(sq);
      }
    } else {
      const move = chess
        .moves({square: piece, verbose: true})
        .filter(m => m.from === piece && m.to === sq);
      if (move.length > 0) {
        doMove(move[0]);
      }
    }
  };

  const pieceURL = sym =>
    SYMBOLS[sym] ? `pieces/${theme}/${SYMBOLS[sym]}` : '';

  return html`
    <div class="board-container">
      <div class="board ${flipped ? 'flipped' : ''}">
        ${Array(8)
          .fill()
          .map(
            (_, i) => html`
              ${Array(8)
                .fill()
                .map(
                  (_, j) => html`
                    <div
                      class="square ${(i + j) % 2 ? 'black' : ''}"
                      onClick=${() => onClick(i, j)}
                    >
                      ${SQUARE(i, j) === opponentMove.to
                        ? html`
                            <div class="highlight color-opponent" />
                          `
                        : ''}
                      ${!piece && SQUARE(i, j) === hint.from
                        ? html`
                            <div class="highlight color-hint" />
                          `
                        : ''}
                      ${SQUARE(i, j) === piece
                        ? html`
                            <div class="highlight color-selected" />
                          `
                        : ''}
                      <img src=${pieceURL(rows[i][j])} />
                      ${SQUARE(i, j) === opponentMove.from
                        ? html`
                            <div class="dot color-opponent" />
                          `
                        : ''}
                      ${moves.indexOf(SQUARE(i, j)) > -1
                        ? html`
                            <div class="dot color-selected" />
                          `
                        : ''}
                      ${!piece && SQUARE(i, j) === hint.to
                        ? html`
                            <div class="dot color-hint" />
                          `
                        : ''}
                    </div>
                  `,
                )}
            `,
          )}
      </div>
    </div>
  `;
};

const Menu = props => {
  const {undo, newGame, swap, toggleHints, setLevel, theme, setTheme} = props;
  return html`
    <div class="menu ${props.class}">
      <div class="dark-mode-switch ${theme}">
        <div
          class="switch"
          onClick=${() => setTheme(theme === 'light' ? 'dark' : 'light')}
        >
          <div class="mode"></div>
        </div>
      </div>
      <h1>
        <a onClick=${newGame}>New game</a>
      </h1>
      <h1>
        <a onClick=${swap}>Play ${side === 'w' ? 'black' : 'white'}</a>
      </h1>
      <h1>
        <a onClick=${toggleHints}>${showHints ? 'Hide' : 'Show'} hints</a>
      </h1>
      <h1>
        <a onClick=${undo}>Undo</a>
      </h1>
      <br />
      <h1>Difficulty:</h1>
      <h1>
        ${[['p', 4], ['n', 8], ['b', 12], ['r', 16], ['q', 20]].map(
          ([icon, l]) => html`
            <a onClick=${() => setLevel(l)}
              ><img
                src="pieces/${theme}/${(theme === 'light' ? 'b' : 'w') +
                  icon}.svg"
                class="${level === l ? 'color-menu' : ''}"
            /></a>
          `,
        )}
      </h1>
      <h1>
        <a target="_blank" href="https://www.buymeacoffee.com/zserge"
          ><small>Buy me a coffee</small></a
        >
      </h1>
    </div>
  `;
};

const Dialog = props => {
  return html`
    <div class="dialog ${props.class}">
      ${props.children}
    </div>
  `;
};

render(
  html`
    <${App} />
  `,
  document.body,
);
