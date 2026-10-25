FANTOR - The Wanderer's Light (v5 "New light")
A punishing old-school platformer set in the world of "The Road to Fantor". Every character
is cut from Eh AyeC's own paintings in the "Fantor's Long War" collection (see CHARACTERS.md).

PLAY ONLINE
https://patternpartner.github.io/fantor-game/

HOW TO RUN LOCALLY
Browsers block games opened straight from a file, so serve the folder:
  python3 -m http.server 8000     (in this folder)
then open http://localhost:8000/ . It also works from any static web host or itch.io.

CONTROLS
  Keyboard: Left/Right or A/D walk; Up, W, Space or Z jump; X, E, K or Shift shine
            (and offer light at a stone); Esc or P opens the pause menu; F fullscreen.
            C or L: light moves, once a stone has given them. Down or S: fire, star-fall, kneel.

  What each stone gives back (the control shows once when you get it, and again as the next land begins):
    Shore stone    ebb-step       C on the ground: a quick dash (1 light). Jump during it for a long leap.
    Forest stone   light-dash     C in the air: one dash per jump, any of 8 ways you hold (2 light).
    River stone    lantern-pull   C under a lit hanging lantern: it pulls you up to it (1 light).
    Kingdom stone  turnlight      shine just as a thrown thing reaches you: it flies back where it came from.
    Frygar stone   ember-carry    Down at a lit brazier: carry its fire (slower, lower jumps, no light moves).
                                  Down at a cold brazier lights it. Down anywhere else puts the fire out.
    Dark stone     star-fall      Down in the air: drop like a star and bounce off a bell, a shadow or a shot (1 light).
  Phone: the » button is C and the ▼ button is Down. They appear once you have the move.
  Mouse:    click the game first so it gets the keyboard (in an embed).
            The two small buttons at the top are Menu and Fullscreen.
  Phone (landscape): the on-screen buttons.
  The pause menu has Music, Voice and Effects volume. Settings are remembered in
  this browser (if the browser allows storage; if not, the game still runs).

LIVES (old school, no mercy)
  3 lives. Lose them all and it's GAME OVER: no continues, and the journey starts again
  from the Shore of Wakes. Every 50 motes found in the world gives an extra life (max 9).

WHAT COSTS A LIFE
  - Falling into the river, the sea pools or a pit.
  - Getting hit while you carry no light. Light is your shield: enemy contact, thrown fire,
    spears, stingers, embers, vents and falling rocks take light first (bosses take 3).
  - Running dry in the dark: 0 light and no lit brazier near you for about 5 seconds.
  - The cold (Land VI): frost drinks light fast. At 0 light, it takes you in about a second and a half,
    unless you carry fire.
  You go back to the start of the land (or, once its boss is calmed, to the boss's arena / the woken stone).
  There are no checkpoints in the middle of a land. Braziers keep the dark away, nothing more.

HOW TO PLAY
Gather motes. Each stone needs a lot of light to wake, and a boss guards each one. Bosses
turn your light aside: dodge, and shine while they rest. Shining costs 3 light, with a short
cooldown. Every hazard warns you before it hurts. Not every pool is what it seems.

URL OPTIONS
  ?mute  no sound     ?lowres  never render above 854x480

v5 "New light":
  - Every stone now gives back a move, and the next land is built to teach it: a safe place to try it,
    a real test, then a twist. Six new moves (see CONTROLS).
  - New hazards that need them: fleeting lights, thorn whips and rotten branches (II); walled banks and
    sinking stones (III); dark lantern chains and lanterns the wind blows out (IV); catapults (V);
    the cold and the old things' eyes (VI); bells to cross, bells that swing and a bell that tolls (VII).
  - Four new hidden places, in Lands IV to VII. Find them yourself.
  - Every boss form and every v4 fix is kept. Still 3 lives, no continues, no checkpoints in the middle of a land.
  - Returning from a hidden place no longer counts as a checkpoint.
  - A journey is now about 12 to 18 minutes for a good player.

v4 "Learn it, beat it":
  - Every boss now has a second form (the King of Bell has a third). Each new form adds one attack
    and gives you less time to strike.
  - No more dice: boss and enemy attacks follow fixed patterns you can learn.
  - Back on your feet in about a second after losing a life.
  - The game-over screen shows where each light went out, and how close you came to the boss.
  - Screen shake, hit-stop, new sounds for spears, stingers, rocks and vents, a death for each cause.
  - The Land VI braziers no longer act as checkpoints, and the strategy pop-up tips are gone
    (control prompts and the folk's words stay).
v3.1: debug/testing hooks removed from the public build; clearer sign in the first hidden place.
