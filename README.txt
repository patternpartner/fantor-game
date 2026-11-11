FANTOR - The Wanderer's Light (v11.4)
A punishing old-school platformer set in the world of "The Road to Fantor". Every backdrop and
character comes from Eh AyeC's "Fantor's Long War" collection: AI-generated images, created and
curated by the artist (see CHARACTERS.md). The code was written with an AI coding assistant.

PLAY ONLINE
https://patternpartner.github.io/fantor-game/

HOW TO RUN LOCALLY
Browsers block games opened straight from a file, so serve the folder:
  python3 -m http.server 8000     (in this folder)
then open http://localhost:8000/ . It also works from any static web host or itch.io.

The file the page loads is game.js (minified, no debug hooks). The source it is built from
is src/game.js, still one file, plain canvas and WebAudio. To rebuild after editing the source:
  npm install
  npm run build          (node tools/build.js)
  npm test               (needs Chrome; checks the labels, the death marks, the shore painting,
                          the card tap, and that lives, knockback and saved records are unchanged)

CONTROLS
  Keyboard: Left/Right or A/D walk; Up, W, Space or Z jump; X, E, K or Shift shine
            (and offer light at a stone); Esc or P opens the pause menu; F fullscreen.
            C or L: light moves, once a stone has given them.
            Down or S: crouch. Also fire, star-fall and kneel, once a stone has given them.

  What each stone gives back (the control shows once when you get it, and again as the next land begins):
    Shore stone    ebb-step       C on the ground: a quick dash (1 light). Jump during it for a long leap.
    Forest stone   light-dash     C in the air: one dash per jump, any of 8 ways you hold (2 light).
    River stone    lantern-pull   C under a lit hanging lantern: it pulls you up to it (1 light).
    Kingdom stone  turnlight      shine just as a thrown thing reaches you: it flies back where it came from.
    Frygar stone   ember-carry    Down at a lit brazier: carry its fire (slower, lower jumps, no light moves).
                                  Down at a cold brazier lights it. Down anywhere else puts the fire out.
    Dark stone     star-fall      Down in the air: drop like a star and bounce off a bell, a shadow or a shot (1 light).
  Phone: the » button is C and the ▼ button is Down. They appear once you have the move.
            The ⌄ button is crouch (Down). It sits above the walk buttons, and it is not drawn on the end card.
  Mouse:    click the game first so it gets the keyboard (in an embed).
            The two small buttons at the top are Menu and Fullscreen.
  Phone (landscape): the on-screen buttons.
  The pause menu has Music, Voice and Effects volume, a Timer switch, and Graphics (Auto, Full, or Light for slow machines). Settings and best times
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
The number by the sun is that light, your shield. The stars under it are shines it will buy
(one for every 3), and the three seeds are the light toward the next star. At 0 the sun and the
number go red and pulse: the next hit takes a life. At 1 or 2 they burn amber, short of a shine.
Motes refill this same light, up to 40.

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

THE EMBER RUN
  Reach the journey's end once (or open the Long Night), and the title offers the Ember Run (R, or tap the
  line on the title). It is the same journey with one light: one life, and motes never give another.
  It keeps its own record of runs begun and the furthest it has gone. The journey and the Long Night are unchanged.

WHERE THE LIGHT HAS GONE OUT
  Press M on the title (or tap the line at the top right) to see, for each land, how many times the light has
  gone out there across every journey kept in this browser, by day and by night. The line under the title is
  how many journeys were kept. Each land's number is a time the light went out, not a journey. The game-over
  strip shows the same counts above each land, labeled "lights out". "Journeys begun" below is how many times
  this kind of journey was started. It is a record, not advice.
  Marks for this run sit where the light went out. Several in the same place are one mark with a count.

KEEP THIS CARD
  On the game-over and end screens, press G (or tap the line at the bottom right) to save a PNG card of the run:
  journeys, furthest, where the light has gone out, and a small honest credit. On a phone the line says to tap it.
  The walking buttons step aside on those screens so the tap can land. If your browser or the embed does not
  allow the download, press G (or tap) again within a few seconds and it opens in a new tab instead.

v11.4:
  - A second ending in the same sitting no longer freezes at the throne or the bench. The story and
    ending lines play again, and a heard line that is skipped still runs the action tied to it.
  - A subtitle lifts only for a gap or a hazard just ahead, and only once per line. Lifted, it sits
    in a band under the hint line, and drops a little while the legend is up.
  - Itch's fullscreen control still pauses, but the menu closes and a "click to continue" veil stays
    until the frame is clicked, focused, or keyed. Leaving the tab still opens the menu.
  - A folk line waits for a free queue and for you to still be near. A place-tied line expires if you
    are more than 600px past where it was triggered. The legend waits out a hint and a nearby gap.
    A boss's introduction plays once a sitting; the banner and the roar still happen every wake.
  - On a phone, holding jump no longer aims a light-dash upward. A second press of jump, held, does.
  - The land card fades in on a short retry, and "retry" is per land. The Ember Run's lives hint says
    one light. Two control hints can wait, and a situation hint does not erase them. A bump leans
    away from the rock, including a slow one, once per contact.
  - Lives, restart points, coyote time and motes on a death are unchanged. No new art or audio.

v11.3:
  - Subtitles lift above the ledge whenever a pit or a hazard is in that band, in every land, so the box
    does not cover the water or the edge.
  - Gruff speaks when you reach him. The lives hint is allowed to finish; the jump hint waits for it.
  - Walking into a rock or a block plays a small bump and a brief push.
  - Narration already heard this sitting is not played again. The game-over screen accepts a key after
    1 second, and the land title card is shorter on a retry. Lives, restart points and motes on a death
    are unchanged.
  - The first time your light changes, a short legend names the stars (a shine left) and the seeds
    (light toward the next). The stone shows "stone  3 / 16  light": the light you are carrying, and
    the light it wants.
  - Clicking itch.io's own fullscreen control no longer leaves the pause menu open. Leaving the tab still pauses.

v11.2:
  - Crouch: hold Down or S (⌄ on a phone, above the walk buttons). Behind a tall rock it catches
    shots that would cross the stone, including the stone in the King of Bell's arena. That stone
    takes five such blows and then no longer shelters you. A charge, rain, and the pillars are not
    stopped by it, and crouching in the open is not safety. Kneel, fire and star-fall are unchanged.
  - Stomp: land on a small walker (a Gorit, a Goil, a Chroner, a Keepaway on the path) and it is
    calmed, and you hop. It does not cost light. A side hit still hurts, and still knocks you back.
    Wisps, flyers, spitters, throwers, Frygars, stalkers and bosses are not stepped on.
  - The light a mote gives is the light a shine spends. The counter shows how many shines that is,
    large enough to read on a bright painting: the number, a star per shine, three seeds toward the
    next. At 0 the sun and the number go red. Forty remains the most you can carry.
  - Three lives, no continues, the same knockback, the same hidden places. No new narration, no new images.

v11.1 (readability on Ember, nothing else):
  - The number above a land is how many times the light has gone out there. It is labeled "lights out".
    "Journeys begun" remains the number of times a journey was started. The map says the same, in two lines.
  - The list on the game-over card says "was struck" when a blow took the light.
  - Several losses in one place are one mark with a count, still on that place.
  - The painting behind the shore's first pool stays put until you have landed, so the bank can be read.
  - While a hit flashes the body, a faint outline of the wanderer stays, so a large figure cannot hide them.
  - The phone prompt to keep the card was already there. The play buttons no longer cover it.
  - No new narration, no new images, and nothing about the difficulty changed: three lives, no continues,
    no checkpoints inside an act, the same knockback, pits included. The Ember Run is still one life, opt-in,
    after the journey's end. Records kept in this browser are read as before.

v11 "Ember":
  - Where the light has gone out: a lifetime count of deaths in each of the seven lands (and Dusk), by day and by
    night, kept in this browser. M on the title opens it; the game-over strip shows the counts above each land.
  - The narrator notices returning wanderers: eight new short lines (same synthetic Piper p237 narrator voice and
    the same processing as the rest of the narration), on the 5th, 10th, 25th and 50th journey begun, on the 3rd,
    10th and 25th time the light goes out in the same land, and on the first Ember Run. They acknowledge; they never advise.
  - The Ember Run: after the journey's end has been reached once, an opt-in run with one life and no extra lives
    from motes, with its own record line on the title. Its times do not replace the journey's best time.
  - Keep this card: a PNG of the run's stats card from the game-over and end screens, with the credit
    "AI-generated art, created and curated by Eh AyeC" and the game's itch.io address.
  - Nothing about the difficulty changed: three lives, no continues, no checkpoints inside an act, the same
    knockback, pits included. No new images were generated for v11.

v10 "Keepsakes":
  - A quiet record, kept in this browser: the title screen shows how many journeys you have begun and the
    furthest your light has gone (and the same for the Long Night, once you have one). It is a record, not a hint.
  - The game-over screen marks where your light had got to before this run, on the strip of the seven lands,
    says so when a run goes further than ever before, and counts the journeys begun.
  - The paintings are not quite still: they breathe very slowly, once in each act the layers of the painting
    drift apart and back, and the painting opens up when a stone wakes or an old power is calmed. Only the
    backdrop moves; nothing over the play changes.
  - When a hit takes light, the light it takes breaks off you in shards (more shards for a bigger hit).
  - The ending now rolls honest credits over the last painting: the art is AI-generated images from Eh AyeC's
    "Fantor's Long War" collection, created and curated by the artist; the voice is a synthetic narrator;
    the music is AI-assisted; the code was written with an AI coding assistant. Then the run's card returns.
  - Nothing about the difficulty changed: three lives, no continues, no checkpoints inside an act, the same
    knockback, pits included. The art is the same AI-generated collection: nothing new was generated for v10.

v9 "Second Look":
  - The shore (Land I) teaches one thing at a time: a rock, a pit, then a lone wisp (the shine hint now shows
    just before it), then a Gorit on open ground, then the tide, then Hey Honey, then the log. Act 2 puts them
    together. The log now carries you a little nearer the far bank.
  - The Long Night rebuilds new stretches in Lands III to VII (I and II were rebuilt in v7): a wide sinking
    crossing you light-dash over, a lantern chasm behind a watchman, a vent corridor that rolls like a wave
    under a catapult, a cold walk between two watching eyes, and a chasm of swinging and tolling bells.
  - Two spots where nearly every test death fell just short were eased a little: the shore's log carries
    you nearer the far bank, and the windblown lantern chasm in the golden city has its far bank 15 px nearer,
    with three motes before its gate, so a restart at Act 2 is never left without the light it needs.
    Still three lives, no continues, no checkpoints inside an act, the same knockback.
  - Faster drawing: the glow and bloom are worked out at half size, and motes use one baked glow. Pause menu:
    Graphics Auto / Full / Light. Light drops the bloom, the drifting motes in the air and the bosses' glow
    for slow machines. Auto switches to Light by itself if the game is running slowly.
  - The Smonster is a deeper tone with a dark edge, so it no longer melts into the bright shore sky.
    The wanderer leans a touch into a run.
  - Sound: Act 1 music is warm and a little veiled, Act 2 opens up, with a slow heartbeat under it (not in
    boss fights). The music ducks under a hit and a stone waking. Footsteps are a little quieter.
  - The art is the same AI-generated collection as before: nothing new was generated for v9.

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
