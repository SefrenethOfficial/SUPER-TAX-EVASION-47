# SUPER TAX EVASION 47

![SUPER TAX EVASION 47](assets/logo.png)

An open-world Metroidvania Soulslike in three.js, with Super Mario 64-style movement.

## Washed-Up Beach

The first area. You wake up face down on the sand in thick sea fog under a heavy grey sky, next to the wreck of the ship you came in on: a broken hull on its side, the snapped mast, crates, barrels and planks along the tideline. Press anything to get up. The sea is to the south (you can wade in up to your waist); the beach rises through dunes to grassland and dark pines in the north, between two rocky headlands.

### The shy ghost

When you get up, a dark figure is floating up ahead. Walk towards it and it backs away, always facing you, as fast as you can run. Chase it until it's pinned against the edge of the beach, and the darkness fades: it's Vivian, a shy ghost, who apologises for running and offers to teach you the basics (moving, jumping, the camera, and how battles work). Afterwards, walk up to her and press **B** to talk: she'll go over the basics again, or have a practice fight with you. Meeting and the lesson are remembered between visits (clear the site's storage to meet again). The ghost's name is `GHOST` at the top of `src/stages/beach.js`.

### Battles (work in progress)

Battles are turn-based. For now the only one is a practice fight with Vivian (talk to her and pick **Let's fight**). She has 12 Health and goes easy on you, hitting back for 1. The enemy song plays during battles. Each side gets a battle slot (a checkered panel showing Health and Stamina) with a picture of the fighter above it. The commands are **Fight**, **Item** (no items yet) and **Run** (ends the battle).

**Fight** opens your moves, each with a Stamina (SP) cost: **Punch** (2 SP, 2–3 damage), **Kick** (4 SP, 4–5), **Flurry** (6 SP, jab, jab, kick for three hits of 2–3) and **Catch Breath** (skip your attack, +3 SP). Moves you can't afford are greyed out, and the message box describes the move you're on. You run up, strike and run back; then the enemy takes its turn. You get 1 SP back each round. Beat the enemy and it keels over; your Stamina refills after the battle. Getting knocked out just ends the battle for now.

`src/stages/blank.js` is an empty test area (`?stage=blank`).

**Play:** open `index.html` through any static server (or GitHub Pages). No build step; three.js loads from a CDN.

## Controls

| Action | Keyboard / mouse | Gamepad |
| --- | --- | --- |
| A | Space | A |
| B | J, X, left click | X or B |
| Z | Shift, K, right click | Triggers or bumpers |
| Camera | Mouse (click to lock), Q/E rotate, R/F tilt, wheel zoom | Right stick |
| Controls list | H | |
| Mute music | M | |
| Debug readout | F3 or ` | |

Touch screens get an on-screen stick plus A / B / Z buttons.

## Code layout

- `src/main.js`: renderer, Lakitu-style camera, stage switching, game loop
- `src/player.js`: character rig setup and the movement state machine (collision, procedural animation)
- `src/world.js`: sky, lighting and level-building helpers; boxes double as collision
- `src/collider.js`: triangle collision for level models: floors, walls and ceilings
- `src/terrain.js`: heightmap terrain (sand, grass, rock and path blending, colour grading)
- `src/textures.js`: procedural textures (sand, grass, rock, dirt, planks, water) painted at load time
- `src/audio.js`: music and voice lines
- `src/ghost.js`: the shy ghost (backs away until cornered, darkness fading off)
- `src/dialogue.js`: dialogue box with typed-out text and choices
- `src/battle.js`: turn-based battles: battle slots, fighter pictures, the Fight / Item / Run menu, battle camera
- `src/stages/beach.js`: the washed-up beach (terrain, sea, wreck, palms, overcast sky)
- `src/input.js`: keyboard, mouse, gamepad and touch
- `src/fx.js`: dust, sparkles, impact shockwave, camera shake

The character's skeleton is posed in code every frame; there are no baked animations. Its head gets the wood texture, the eye decal and the cone hat at load time.

When you change any file, bump `VERSION` and the `?v=` numbers in `src/main.js` and `index.html` so players' browsers don't mix old and new files.

## Credits

Character model: "Fully Rigged Low Poly Character for blender" by [satyasrichaitanya360](https://sketchfab.com/satyasrichaitanya360) on [Sketchfab](https://sketchfab.com/3d-models/fully-rigged-low-poly-character-for-blender-dd918a1760be4849ac1026daa2c58b75), licensed [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).

Traffic cone hat: "Traffic Cone" by [hinndia](https://sketchfab.com/hinndia) on [Sketchfab](https://sketchfab.com/3d-models/traffic-cone-573feef839d7450cb3e12da9986e7a98), licensed [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).

Ghost model: "Vivian" by [Peardian](https://sketchfab.com/Peardian) on [Sketchfab](https://sketchfab.com/3d-models/vivian-8a2afe0fea6f4e558c24289bf40d5ad4), licensed [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).

Battle music ("Enemy"): supplied by the project owner.

Voice lines: supplied by the project owner; from Nintendo's Super Mario 64.
