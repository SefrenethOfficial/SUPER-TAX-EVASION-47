# SUPER TAX EVASION 47

![SUPER TAX EVASION 47](assets/logo.png)

An open-world Metroidvania Soulslike in three.js, with Super Mario 64-style movement.

## Washed-Up Beach

The first area. You wake up face down on the sand in thick sea fog under a heavy grey sky, next to the wreck of the ship you came in on: a broken hull on its side, the snapped mast, crates, barrels and planks along the tideline. Press anything to get up. The sea is to the south (you can wade in up to your waist); the beach rises through dunes to grassland and dark pines in the north, between two rocky headlands.

## Obsidian Fieldlands

Past the grassland north of the beach, a dirt path runs down a long slope to a wide basin way below. From above it's lost in the fog; step down into it and the fog lifts, the sky turns blue and the fieldlands' music starts (and the fog comes back if you climb up to the beach again). It's a patchwork of grass fields with patches of tall grass swaying in the wind, broken up by **obsidian flats** (patches of black glass ground bristling with forests of glass spires and shards) and **mountains**: the tall West Peak, the East Range, the North Ridge and **Obsidian Peak**, a mountain of black glass crowned with great spires. Jagged peaks rise behind the obsidian cliffs all round.

**Enemies** roam the fields: **Shardlings** (little hopping shards of obsidian; 8 Health, hit for 2) and **Thornbacks** (mossy grazers with obsidian spines; 15 Health, hit for 3). They wander, chase you when you get close, and touching one starts a battle. Beaten enemies are gone; run away and they leave you alone for a few seconds. If your party is knocked out you come round on the beach again, and the enemies are back. Out of battle your Health slowly comes back.

## Lantern Hollow

Through a pass in the east wall of the fieldlands (follow the path east), a green valley with the **Sunken Lantern** tavern, lit by a fire and lanterns along the road. Inside:

- **Hesta**, the barkeep. **Rest by the fire** to heal your whole party, and from then on you come round here when you're knocked out (souls-style). She'll also spare you some supplies once (Herbs, a Hearth Salve, an Ember Flask), and tell you about the place.
- **Marrow**, a sellsword with a lantern: **recruitable**. He walks behind you and fights in your party (14 Health; Lantern Bash, Cleave, Guard, Catch Breath). Ask him to wait and he stays where you leave him.
- **Old Bruno**, a retired guardsman: a **move teacher**. Teaches **Guard** (1 SP, half damage until your next turn) and **Heavy Swing** (5 SP, 6–8 damage; he wants you to have a weapon first).

A **Hermit** at the top of the **West Peak** teaches **Skybreaker** (7 SP, a two-hit leap and crash, 9–11) to anyone who makes the climb.

## The Hollow Throne

Up a pass in the west wall of the fieldlands (follow the path west), a dark, smoky plateau with a ruined ring of pillars around a throne. Step through the wall of fog at the entrance and the **Hollow Warden** rises: a soulslike boss fight with his own music. He has 60 Health and two phases. He brings his greatsword down on one of you, sweeps across the whole party, and every third turn winds up a huge blow a turn ahead (a good time to Guard). At half Health his armour splits and he fights with fire. Beat him (**WARDEN FELLED**) and his **Ashen Blade** is yours; fall (**YOU FELL**) and you come round where you last rested.

## Items, weapons and moves

Press **I** (or **Tab**) to open your **bag**: equip a weapon, use Herbs and the like on yourself, and see your moves and party. On PC the mouse is freed while it's open: click **Equip** / **Use**, or move with W / S or the arrow keys and press Space, Enter or E; I, Tab or Esc closes it. Items can also be used in battle with **Item**.

- **Weapons** add damage to every blow you land, and you hold the one you've equipped: **Driftwood Club** (+1, washed up by the wreck), **Obsidian Dagger** (+2, on top of Obsidian Peak), **Ashen Blade** (+4, from the Warden).
- **Items**: **Herb** (+4 Health), **Hearth Salve** (+8 Health), **Tonic** (+5 Stamina), **Ember Flask** (thrown in battle for 7 damage). Look for the glints: around the beach and fields, up the West Peak and the East Range, and from Hesta.
- **Moves**: Punch, Kick, Flurry and Catch Breath to start, plus whatever the teachers show you.

Your party's Health carries over between fights until you rest. Everything (items, weapons, moves, recruits, the Warden) is saved in the browser.

### The shy ghost

When you get up, a dark figure is floating up ahead. Walk towards it and it backs away, always facing you, as fast as you can run. Chase it until it's pinned against the edge of the beach, and the darkness fades: it's Vivian, a shy ghost, who apologises for running and offers to teach you the basics (moving, jumping, the camera, and how battles work). Afterwards, walk up to her and press **B** to talk: she'll go over the basics again, have a practice fight with you, or **join your party**. In your party she floats along behind you everywhere and fights at your side (10 Health; Shadow Fist 2 SP for 2–3, Dark Flame 5 SP for 4–6, Catch Breath). Ask her to wait and she'll stay where you left her. Meeting and the lesson are remembered between visits (clear the site's storage to meet again). The ghost's name is `GHOST` at the top of `src/stages/beach.js`.

### Battles (work in progress)

Battles are turn-based: against the fieldlands' enemies, or a practice fight with Vivian (talk to her and pick **Let's spar**; she goes easy on you). Everyone in your party takes a turn in order, then the enemy attacks one of you; a fighter at 0 Health is down, and you lose if the whole party is. The enemy song plays during battles. Each side gets a battle slot (a checkered panel showing Health and Stamina) with a picture of the fighter above it. The commands are **Fight**, **Item** (no items yet) and **Run** (ends the battle).

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
- `src/stages/obsidian-fieldlands.js`: the basin below the beach (shares the beach's ground): slope, fields, obsidian, tall grass, enemies, the fog lifting
- `src/fieldenemy.js`: enemies out in the world (Shardling, Thornback): wander, chase, start a battle on touch
- `src/stages/lantern-hollow.js`: the valley and tavern east of the fieldlands, with Hesta, Marrow and Old Bruno
- `src/stages/hollow-throne.js`: the boss arena west of the fieldlands, the fog gate and the Hollow Warden
- `src/npc.js`: people built from simple shapes, who look at you when you come near
- `src/items.js`, `src/save.js`, `src/inventory.js`, `src/pickup.js`: items, weapons and learnable moves; the save; the bag screen; things to pick up
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

Battle music ("Enemy"), the Hollow Warden's music ("The Filthy Mind" ft. SixteenMono) and Obsidian Fieldlands music ("Steam Gardens", from Nintendo's Super Mario Odyssey): supplied by the project owner.

Voice lines: supplied by the project owner; from Nintendo's Super Mario 64.
