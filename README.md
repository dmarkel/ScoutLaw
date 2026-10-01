# Scout Law Feud — Pack 149

A game-show style board for teaching the 12 points of the Scout Law to Cub Scouts.

**Play it:** https://dmarkel.github.io/ScoutLaw/

## Running the show

1. Open the link on the computer connected to the projector and click **Start the show**. It goes full screen with sound, so turn the speakers up.
2. The opening plays, then the Cubmaster walks over to the board. Click anywhere or press **Space** to skip ahead.
3. Ask a Scout to name a point of the Scout Law. Click that slot (or press its number key). The slot flips, the crowd cheers, and a big card explains the law.
4. Click or press **Space** to close the card and go back to the board.
5. Guessed something that isn't in the Scout Law? Press **X** for the buzzer.
6. When all 12 are found, the whole Scout Law lights up with confetti.

## Slot numbers (Scout Law order)

| Slot | Law | Key | | Slot | Law | Key |
|---|---|---|---|---|---|---|
| 1 | Trustworthy | `1` | | 7 | Obedient | `7` |
| 2 | Loyal | `2` | | 8 | Cheerful | `8` |
| 3 | Helpful | `3` | | 9 | Thrifty | `9` |
| 4 | Friendly | `4` | | 10 | Brave | `0` |
| 5 | Courteous | `5` | | 11 | Clean | `-` |
| 6 | Kind | `6` | | 12 | Reverent | `=` |

## Keyboard controls

| Key | Does |
|---|---|
| `1`–`9`, `0`, `-`, `=` | Reveal slot 1–12 |
| `X` | Wrong answer buzzer |
| `Space` / `Esc` | Close the card |
| `A` / `O` | Applause / crowd "ooooh" (the host claps / gasps) |
| `S` | Host gives the Scout sign to quiet the room (press again to put it down) |
| `E` | Host cups his ear: "I can't hear you!" |
| `P` / `T` | Host points at the room / thinks (press `T` again to stop) |
| `M` | Background music on/off |
| `F` | Full screen |
| `I` | Replay the opening |
| `Shift` + `R` | Reset the board |
| `?` | Show these controls on screen |

## Notes

- On a phone, it only plays sideways. Held upright, it asks you to turn the phone (and on Android offers to turn it for you).
- All music and sound effects are made live in the browser. There are no audio files, and the theme is an original tune.
- It needs internet only to load the page and fonts. Open it once before the meeting and it will be cached.
- To change the wording on a card, edit [`js/laws.js`](js/laws.js).
- The host poses are in [`img/host/`](img/host), and each law's pose is in [`img/laws/`](img/laws) (web-ready WebP). The original transparent PNGs are in [`images/`](images). To replace a pose, keep the same file name and the same framing so he doesn't jump between poses.
