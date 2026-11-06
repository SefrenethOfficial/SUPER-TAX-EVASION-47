# SUPER TAX EVASION 47

![SUPER TAX EVASION 47](assets/logo.png)

An open-world Metroidvania Soulslike in three.js, with Super Mario 64-style movement.

## Washed-Up Beach

The first area. You wake up face down on the sand in thick sea fog under a heavy grey sky, next to the wreck of the ship you came in on: a broken hull on its side, the snapped mast, crates, barrels and planks along the tideline. Press anything to get up. The sea is to the south (you can wade in up to your waist); the beach rises through dunes to grassland and dark pines in the north, between two rocky headlands.

## Obsidian Fieldlands

Past the grassland north of the beach, a dirt path runs down a long slope to a wide basin way below. From above it's lost in the fog; step down into it and the fog lifts, the sky turns blue and the fieldlands' music starts (and the fog comes back if you climb up to the beach again).

It's styled after the Obsidian Fieldlands of *Pokémon Legends: Arceus*: rolling, sunlit green plains with big patches of tall grass swaying in the wind and wildflowers everywhere, a little **camp** of tents where the path comes down, a **river** winding through the plains (with a wooden bridge where the path crosses), fed by a **waterfall** pouring over dark obsidian cliffs at the far end, a **lake** ringed by cliffs of layered rock, a raised **plateau** in the middle with woods on top and a path up its south side, a deep **forest** in the east around one enormous tree, a **flower meadow**, rock stacks, boulders and scattered trees, and a great snow-capped mountain on the hazy horizon.

**Enemies** roam the fields, and they're tough: **Shardlings** (little hopping shards of obsidian; 16 Health, fast, hit for 2 and often lunge twice in a row) and **Thornbacks** (mossy grazers with obsidian spines; 34 Health, hit for 3 with a long charge, and hardly flinch). They wander, and when you come close they chase you and fight in real time: each one flashes red and crouches just before it lunges, then needs a moment to recover (your opening). Hitting one mid wind-up won't stop it. If you fall you come round where you last rested, and the enemies are back. When nothing's after you, your Health slowly comes back.

## Lantern Hollow

Through a pass in the east wall of the fieldlands (follow the path east), a green valley with the **Sunken Lantern** tavern, lit by a fire and lanterns along the road. Inside:

- **Hesta**, the barkeep. **Rest by the fire** to get your Health and Stamina back, and from then on you come round here when you fall (souls-style). She'll also spare you some supplies once (Herbs, a Hearth Salve, an Ember Flask), and tell you about the place.
- **Marrow**, a sellsword with a lantern: **recruitable**. He walks behind you, and when something comes after you he rushes in and clouts it with his lantern (3 damage every few seconds). Ask him to wait and he stays where you leave him.
- **Old Bruno**, a retired guardsman: a **move teacher**. Teaches **Guard** (crouch to guard: blows do half damage and barely move you) and **Heavy Swing** (the kick that ends your punch combo does +4 damage; he wants you to have a weapon first).

A **Hermit** on top of the **plateau** in the middle of the fieldlands teaches **Skybreaker** (your ground pound shakes the earth: it hits everything around you, for +4 damage) to anyone who makes the climb.

## The Hollow Throne

Up a pass in the west wall of the fieldlands (follow the path west), a dark, smoky plateau with a ruined ring of pillars around a throne. Step through the wall of fog at the entrance, the fog seals behind you, and the **Hollow Warden** pushes himself up off his throne on his greatsword: a hard, real-time soulslike boss fight with his own music and a Health bar along the bottom of the screen. There's no leaving the arena and no talking to your party until it's over, and your Health doesn't come back on its own. He's a fully animated armoured knight (walk cycle, wind-ups, swings, leaps, a roar, falling to his knees) with 160 Health, and every attack marks the ground red where it will land: a **three-swing combo** (two sweeps, then an overhead slam), a **slam** that sends eruptions racing across the floor, a full **spin** (jump it), a **leap** that homes in and comes down on you, and a lunging **thrust** across the arena. After each string of attacks he stops to catch his breath: that's your opening. At half Health he roars, his armour splits, fire pours out and everything gets faster and hits harder: he spins and leaps twice, and adds **rings of fire** that roll out across the arena (jump them) and a **rain of embers** (keep moving). Beat him (**WARDEN FELLED**) and the fog clears and his **Ashen Blade** is yours; fall (**YOU FELL**) and you come round where you last rested.

## Items, weapons and moves

Press **I** (or **Tab**) to open your **bag**: equip a weapon, use Herbs and the like on yourself, and see your moves and party. On PC the mouse is freed while it's open: click **Equip** / **Use**, or move with W / S or the arrow keys and press Space, Enter or E; I, Tab or Esc closes it. Out in the world the **number keys** use items straight away: **1** Herb, **2** Hearth Salve, **3** Tonic, **4** throws an Ember Flask at the nearest enemy.

- **Weapons** add damage to every blow you land, and you hold the one you've equipped: **Driftwood Club** (+1, washed up by the wreck), **Obsidian Dagger** (+2, among the black rocks under the waterfall), **Ashen Blade** (+4, from the Warden).
- **Items**: **Herb** (+4 Health), **Hearth Salve** (+8 Health), **Tonic** (+5 Stamina), **Ember Flask** (thrown at the nearest enemy: 7 damage to everything where it bursts). Look for the glints: around the beach and fields, on the plateau, by the great tree, and from Hesta.
- **Moves**: Punch, Kick, Flurry and Catch Breath to start, plus whatever the teachers show you.

Everything (items, weapons, moves, recruits, the Warden) is saved in the browser.

### The shy ghost

When you get up, a dark figure is floating up ahead. Walk towards it and it backs away, always facing you, as fast as you can run. Chase it until it's pinned against the edge of the beach, and the darkness fades: it's Vivian, a shy ghost, who apologises for running and offers to teach you the basics (moving, jumping, the camera, and how fighting works). Afterwards, walk up to her and press **E** to talk: she'll go over the basics again, have a practice fight with you (she circles you and darts in, flashing red first; knock her Health to nothing to win, and she stops if she's hurt you too much or you walk away), or **join your party**. In your party she floats along behind you everywhere and throws bolts of shadow at anything that comes after you (2 damage every few seconds). Ask her to wait and she'll stay where you left her. Meeting and the lesson are remembered between visits (clear the site's storage to meet again). The ghost's name is `GHOST` at the top of `src/stages/beach.js`.

### Fighting

Fighting is real time, and your moves are your attacks: press **B** for a punch, punch, kick combo; punch while running to **dive**; **slide kick** and **jump kick** hit too; and the **ground pound** (Z in the air) slams down on whatever's under you. Everything in front of you when a blow lands takes damage (your weapon adds to every hit), and a number pops up over it; enemies show a small Health bar once they're in a fight.

Every attack costs **Stamina** (the yellow bar under your Health, bottom left). It comes back quickly when you stop swinging; with none left your blows do nothing, so pick your moments. Enemies flash red before they strike: jump or get out of the way, then hit back while they recover. Your **party fights on its own**: Vivian and Marrow attack whatever's after you (they can't be hurt; bosses shrug off half of what they do). The enemy song plays while monsters are after you.

`src/stages/blank.js` is an empty test area (`?stage=blank`).

**Play:** open `index.html` through any static server (or GitHub Pages). No build step; three.js loads from a CDN.

## Controls

| Action | Keyboard / mouse | Gamepad |
| --- | --- | --- |
| A | Space | A |
| B | J, X, left click | X or B |
| Z | Shift, K, right click | Triggers or bumpers |
| Talk / pick up | E | Y |
| Camera | Mouse (click to lock), Q/G rotate, R/F tilt, wheel zoom | Right stick |
| Controls list | H | |
| Mute music | M | |
| Debug readout | F3 or ` | |

Touch screens get an on-screen stick plus A / B / Z buttons and an E button for talking.

## Code layout

- `src/main.js`: renderer, Lakitu-style camera, stage switching, game loop
- `src/player.js`: character rig setup and the movement state machine (collision, procedural animation)
- `src/world.js`: sky, lighting and level-building helpers; boxes double as collision
- `src/collider.js`: triangle collision for level models: floors, walls and ceilings
- `src/terrain.js`: heightmap terrain (sand, grass, rock and path blending, colour grading)
- `src/textures.js`: procedural textures (sand, grass, rock, dirt, planks, water) painted at load time
- `src/audio.js`: music and voice lines
- `src/stages/obsidian-fieldlands.js`: the basin below the beach (shares the beach's ground): plains, river, falls, lake, plateau, forest, camp, tall grass, flowers, enemies, the weather
- `src/fieldenemy.js`: enemies out in the world (Shardling, Thornback): wander, chase, wind up, lunge, recover, stagger
- `src/combat.js`: real-time fighting: your attacks by move, Stamina, party members' attacks, thrown flasks, quick items, damage numbers, enemy and boss Health bars, red ground telegraphs
- `src/stages/lantern-hollow.js`: the valley and tavern east of the fieldlands, with Hesta, Marrow and Old Bruno
- `src/stages/hollow-throne.js`: the boss arena west of the fieldlands, the fog gate and the Hollow Warden
- `src/npc.js`: people built from simple shapes, who look at you when you come near
- `src/items.js`, `src/save.js`, `src/inventory.js`, `src/pickup.js`: items, weapons and learnable moves; the save; the bag screen; things to pick up
- `src/ghost.js`: the shy ghost (backs away until cornered, darkness fading off)
- `src/dialogue.js`: dialogue box with typed-out text and choices
- `src/stages/beach.js`: the washed-up beach (terrain, sea, wreck, palms, overcast sky)
- `src/input.js`: keyboard, mouse, gamepad and touch
- `src/fx.js`: dust, sparkles, impact shockwave, camera shake

The character's skeleton is posed in code every frame; there are no baked animations. Its head gets the wood texture, the eye decal and the cone hat at load time.

When you change any file, bump `VERSION` and the `?v=` numbers in `src/main.js` and `index.html` so players' browsers don't mix old and new files.

## Credits

Character model: "Fully Rigged Low Poly Character for blender" by [satyasrichaitanya360](https://sketchfab.com/satyasrichaitanya360) on [Sketchfab](https://sketchfab.com/3d-models/fully-rigged-low-poly-character-for-blender-dd918a1760be4849ac1026daa2c58b75), licensed [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).

Traffic cone hat: "Traffic Cone" by [hinndia](https://sketchfab.com/hinndia) on [Sketchfab](https://sketchfab.com/3d-models/traffic-cone-573feef839d7450cb3e12da9986e7a98), licensed [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).

Ghost model: "Vivian" by [Peardian](https://sketchfab.com/Peardian) on [Sketchfab](https://sketchfab.com/3d-models/vivian-8a2afe0fea6f4e558c24289bf40d5ad4), licensed [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).

Battle music ("Enemy"), the Hollow Warden's music ("Return To Slime" ft. SixteenInMono) and Obsidian Fieldlands music ("Steam Gardens", from Nintendo's Super Mario Odyssey): supplied by the project owner.

Voice lines: supplied by the project owner; from Nintendo's Super Mario 64.
