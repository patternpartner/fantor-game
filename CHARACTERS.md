# Fantor: The Wanderer's Light — characters and where they came from

Every character in the game is cut out of one of Eh AyeC's own images on Fine Art America (AI-generated images,
created and curated by the artist)
(profile: https://fineartamerica.com/profiles/ehayec). All 23 come from the Fantor collection, which is
called **"Fantor's Long War"** on the site now (862 images; it was called "Battle for Fantor" in the older
catalogue, and that's the collection the film used). It's the only Fantor-named collection on the profile.

How they were made: I downloaded the public ~900px "mediumlarge" image and cut the figure out with
rembg (BiRefNet-general model). The faint haze was cleaned off, the image was cropped, and it was saved as a small WebP
(`assets/img/c_<key>.webp`). The five "apparition" portraits (Whiskers and the four Key Holders) are the
image itself inside a soft oval mask, because they're close-up faces. Nothing was drawn over or changed beyond that. All the
movement is done in code: bobbing, squash and stretch, tilting, glowing, a wind-up before a throw, a flash
when hit, and a golden fade when calmed.

Names are the artwork titles. The narrator lines are new and use the same voice as the film:
Piper VCTK p237 at length-scale 1.45, then pitch 0.93 with formant shift, EQ, compression and the hall IR.

## Bosses (one per area, each guards the stone or the throne)

| Area | Character in game | FAA ID | FAA title | Role |
|---|---|---|---|---|
| I The Shore of Wakes | The Smonster | 51138316 | Smonster | Rises from the shore. Lobs orbs and charges. 5 hits. |
| II The Forest of Bent Trees | Yogi Yogs | 57424150 | Yogi yogs | Hovers. Aimed volleys, falling orbs, summons wisps. 6 hits. |
| III The Silver River Road | The Battle Armour | 57416986 | Battle armour | Flies. Ring bursts, dive-charges, aimed shots. 6 hits. |
| IV The Golden Kingdom | The Doig | 61563124 | Doig | Golden idol that stays put. Rings, falling orbs, ground shockwaves, lobs. 7 hits. |
| V The Frygar Camp | Neco, Captain of the Frygars | 51526407 | Neco | Fast. Charges, lobs and shockwaves. 7 hits. |
| VI Where the Old Things Watch | Vere | 63694699 | Vere | Floating head in the dark. Aimed shots, summons, rings, falling orbs. 7 hits. |
| VII The Heart of Fantor | The King of Bell (final boss) | 58425236 | King of bell | Guards the throne. Shockwaves, lobs, charges, falling orbs. 9 hits. Kneels when calmed. |

## Enemies

| Character | FAA ID | FAA title | Type | Where |
|---|---|---|---|---|
| Gorit | 51077957 | Gorit | Patrols, then chases when it sees you | Shore, River |
| Goils | 58784983 | Goils | Patrols, then chases | Forest |
| Hey Honey | 57606384 | Hey honey | Flies overhead and drops stingers | Shore, Forest, River |
| Keepaway | 51100223 | Keep away | Kingdom guard: patrols, then chases | Kingdom |
| Illinor | 59280261 | Illinor | Thrower: lobs fire at you | Kingdom, Frygar Camp |
| Renoy | 57770958 | Renoy | The "old things": hooded stalker that hunts you in the dark | Dark |
| Harms | 63592946 | Harms | Floating head that spits aimed fire | Dark, Heart |
| Xon | 59004393 | Xon | Thrower in the dark | Dark |
| Chroner | 57652853 | Chroner | Patrols, then chases | Heart |
| Frygars | (drawn in code, as in v1) | from the film's "Frygars" | Patrol and chase, and now throw spears | Frygar Camp |
| Wisps | (drawn in code) | — | Chasers that fly | Everywhere |

## Folk who speak (narrated hint lines)

| Character | FAA ID | FAA title | Line | Area |
|---|---|---|---|---|
| Gruff | 51215848 | Gruff | n01: "Keep your light… Shine when you must, not when you can." | I |
| Whiskers | 51192255 | Whiskers | n02: "Them that fall start again." | II |
| Key Holder | 59239352 | Key holder 1 | n03: "Ride the logs. The river never waits." | III |
| Key Holder | 59239360 | Key holder 2 | n04: "The Doig is waking. Strike when it rests." | IV |
| Key Holder | 59239363 | Key holder 3 | n05: "Mind the fire vents. They breathe… and then they rest." | V |
| Key Holder | 59239365 | Key holder 4 | n06: "Stay near the braziers. Vere is waiting." | VI |
| The Grand Old Mother | 57652870 | Grand old mother | n07: "This one will have to fight for its throne." | VII |

## New narrator lines (assets/vo)
d01, d02 (after losing a life), x01 (extra life), go1 (game over), n01–n07 (folk), b01–b07 (boss intros),
bw1 (a boss is calmed), bw2 (the King of Bell kneels).

Some names were spelled by sound for the speech engine and are shown correctly in the subtitles. "Doig" was read as "Doyg" and "Vere" as "Veer".

## Backdrops for the hidden places (v3)

Four more images from *Fantor's Long War* that weren't used anywhere else in the game. Each one is a
full image (the public ~900px image, cropped to 16:9), not a cut-out.

| Used as | FAA ID | FAA title |
|---|---|---|
| Backdrop of hidden stage "Beneath the Pool" | 56560018 | Source error hire |
| Backdrop of hidden stage "Above the Bent Wood" | 51189575 | The swottys |
| Backdrop of hidden stage "What the River Remembers" | 57324815 | Not so important |
| Scene shown in the secret ending | 60367235 | Ghulirs |

New narrator lines in v3 (same p237 voice and processing): e1–e3, r1–r3, sx1.

## Backdrops for the hidden places (v5)

Four more full images from the same collection as the v3 backdrops, each cropped to 16:9. To keep them
hidden, the table doesn't say where they are.

| Used as | FAA ID | FAA title |
|---|---|---|
| Backdrop of a hidden place | 58384739 | Blackout |
| Backdrop of a hidden place | 61529149 | Gozzies |
| Backdrop of a hidden place | 57892881 | Reverse |
| Backdrop of a hidden place | 51192624 | Stationers |

New narrator lines in v5 (same p237 voice and processing): e4–e7, r4–r7, gv1. r3 and sx1 were re-recorded.
