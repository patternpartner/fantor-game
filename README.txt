FANTOR - The Wanderer's Light (v8 "Living Bosses")
A punishing old-school platformer set in the world of "The Road to Fantor". Every backdrop and
character comes from Eh AyeC's "Fantor's Long War" collection: AI-generated images, created and
curated by the artist (see CHARACTERS.md). The code was written with an AI coding assistant.

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
  The pause menu has Music, Voice and Effects volume, and a Timer switch. Settings and best times
  are remembered in this browser (if the browser allows storage; if not, the game still runs).

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
  You go back to the start of the act you are in (or, once its boss is calmed, to the boss's arena /
  the woken stone). Every land is two acts. There are no checkpoints inside an act. Braziers keep the
  dark away, nothing more.

HOW TO PLAY
Gather motes. Each stone needs a lot of light to wake, and a boss guards each one. Bosses
turn your light aside: dodge, and shine while they rest. Shining costs 3 light, with a short
cooldown. Every hazard warns you before it hurts. Not every pool is what it seems.
The light you carry builds up as you gather it: you burn brighter, see further in the dark, and a
shine reaches further (it keeps growing up to 30 light). Spend it, and you dim again.

URL OPTIONS
  ?mute  no sound     ?lowres  never render above 854x480

THE LONG NIGHT
  Finish the journey carrying everything the sea forgot, and the title screen offers The Long Night
  (N, or tap the line on the title). It is the whole journey again, after dark, and the night has
  rebuilt part of every land around the stones' gifts. Some things only show at night.

TIMER
  Switch it on in the pause menu. It shows the run time (pauses do not count), a split as each land
  ends, and how it compares with your best run. Best times are kept in this browser, one for the
  journey and one for the Long Night.

v8 "Living Bosses":
  - The seven bosses move like living things. Each is still the same single AI-generated image, but the game
    now draws it as a puppet, cut into thin bands in code: it breathes, bends into its movement and sways
    after it, crouches and draws light in before it strikes, snaps through the attack, staggers back when
    your light hits it, shudders and flares through its change of form, rises out of the ground in dust,
    and comes apart into light when it is calmed. Their eyes burn brighter as they gather an attack.
    Hair, cloth, chains, wings and tendrils hang off them and trail behind their movement (drawn by the
    game in code, not new art). The straight cropped edges some cut-outs had are faded out.
  - Nothing about how they fight changed: same attacks, same timings, same hitboxes, same patterns.
  - On the shore (Land I) Act 2 now simply carries on: no dip to black and no Act 2 card (the shore's
    opening card no longer says "Act 1" either). Act 2 still works the same, including where you restart.

v7 "Long Night, Remade":
  - The Long Night's lands are remixed: in each land, one to three stretches are rebuilt at night
    around the moves (leaps that need the ebb-step, a lantern chain in the bent wood, guards in the
    golden city, a third catapult, a longer frost with a new eye, swinging and tolling bells).
  - The night hides three new places in the first three lands, for those who look. One try each.
  - Tide flats on the shore: the sea creeps up over them on a fixed beat (you hear it first).
  - Guards in the golden city: a Keepaway on watch whose lantern looks one way, then the other.
    It shifts before it turns. If its light finds you, it calls fire down where you stood.
  - Your light builds up: a bigger, brighter glow and a longer reach the more you carry, small lights
    circling you as it grows, and a ring by the light counter that fills toward your next life.
  - Better rendering: soft coloured light from lanterns, braziers, fire, vents and bells, a gentle
    bloom, contact shadows, a scarf of light on the wanderer, slow light shafts by day, low mist in
    the dark lands. The images themselves are the same AI-generated images as before.
  - Act 2 has its own mood: the music plays a touch higher and quicker, and the light closes in.
  - Three new narrator lines for the night's hidden places, their riddles, and the night's last word.
  - Lose a life in Act 2 and you still start Act 2 again (unchanged from v6).
  - How long is a run? Measured, not guessed: the autopilot, which never hesitates, takes about 12.7
    minutes of play for the journey. A second autopilot that stops to look for most of a second before
    every new gap, tide, hazard and creature takes about 12.5 minutes for the first six lands, so a
    flawless, careful journey is about 15 to 16 minutes. Real first journeys, with deaths and
    restarts, will be longer; nobody has timed one yet.

v6 "The Long Night":
  - Every land is now two acts. Act 2 is a level start: lose a life in it and you begin Act 2 again;
    lose them all and it is the shore. Act 1's shadows stay behind in Act 1.
  - Each land ends on a new stretch before its boss: a short, dense test of that land's own idea
    (the shore gets a whole new second act).
  - The Long Night: a second journey, earned. Night falls on all seven lands, every stone's gift is
    yours from the first step, shadows take one more shine, the hazards keep a quicker beat, every
    boss begins in its second form, the stones want more light, a new life takes 100 motes, and the
    hidden places sleep. Three lives, no continues. It has its own ending.
  - An optional run timer with land splits and best times.
  - Two new narrator lines.
  - A journey is now about 14 to 20 minutes for a good player (the autopilot, which never hesitates,
    takes about 11.5).

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
