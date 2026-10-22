FANTOR - The Wanderer's Light (v2)
A small browser game set in the world of "The Road to Fantor". The characters are cut from
Eh AyeC's own Fantor paintings on Fine Art America (see CHARACTERS.md).

PLAY ONLINE
https://patternpartner.github.io/fantor-game/

HOW TO RUN LOCALLY
Browsers block games opened straight from a file, so serve the folder:
  python3 -m http.server 8000     (in this folder)
then open http://localhost:8000/ . It also works from any static web host.

CONTROLS
  Keyboard: Left/Right or A/D to walk; Up, W, Space or Z to jump;
            X, E or Shift to shine or offer light; P or Esc to pause.
  Phone (landscape): the on-screen buttons. Left/right arrows walk,
            the jump button jumps, and the star shines.

LIVES (old school)
  You start with 3 lives (the suns, top right). Lose them all and it's GAME OVER:
  there are no continues, and the journey starts again from the Shore of Wakes.
  Every 50 motes you pick up from the world gives you an extra life (up to 9).

WHAT COSTS A LIFE
  - Falling into the river, the sea pools or a pit.
  - Getting hit while you carry no light. Light is your shield: enemy contact,
    thrown fire, spears, stingers, embers, fire or water vents and falling rocks
    all take light first (bosses take 3). Only a hit with 0 light costs a life.
  - Running dry in the dark (area VI): with 0 light and no lit brazier near you,
    the dark takes a life after about 5 seconds.
  When you lose a life you go back to the last checkpoint: the start of the area,
  a lit brazier, a calmed boss or a woken stone. You get back the light you had
  there, and the motes you collected since then reappear.

HOW TO PLAY
Gather motes of light. Each stone needs a lot of light to wake, and every
area has a boss guarding its stone. A boss turns your light aside, so dodge
its attacks and shine while it rests (a star appears over its head).
Shining costs 3 light and has a short cooldown. It calms enemies, destroys
anything thrown at you, and lights lanterns and braziers.
At the Heart of Fantor, the King of Bell stands before the throne.

TESTING HOOKS
  ?auto  autopilot    ?god  debug invincibility    ?area=N  start in area N (0-7)
  ?mute  no sound     ?debug  position readout
