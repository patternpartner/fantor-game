FANTOR - The Wanderer's Light (v4 "Learn it, beat it")
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
  You go back to the start of the land (or, once its boss is calmed, to the boss's arena / the woken stone).
  There are no checkpoints in the middle of a land. Braziers keep the dark away, nothing more.

HOW TO PLAY
Gather motes. Each stone needs a lot of light to wake, and a boss guards each one. Bosses
turn your light aside: dodge, and shine while they rest. Shining costs 3 light, with a short
cooldown. Every hazard warns you before it hurts. Not every pool is what it seems.

URL OPTIONS
  ?mute  no sound     ?lowres  never render above 854x480

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
