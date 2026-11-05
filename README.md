# SUPER TAX EVASION 47

![SUPER TAX EVASION 47](assets/logo.png)

A three.js 3D platformer in the spirit of Super Mario 64.

**Right now the game is being rebuilt:** it starts in a blank area (`src/stages/blank.js`) with just the character and its moves. The old hub and Sunny Spire Hill below are still in `src/stages/` but aren't loaded.

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

## Tax Haven (hub) (not in the game right now)

The game starts in the castle lobby. Jump into the painting on the far wall to enter Sunny Spire Hill. When you clear the course you come back out of the painting. Stars you collect are saved in your browser.

## Sunny Spire Hill (not in the game right now)

The course is a full level model in the style of Bob-omb Battlefield. You start at the north edge. A wooden plank bridge runs down into the lowland, where a stake stands in front of a gate. A ridge leads east to a round stone plaza, and a dirt path climbs a white stone slope to the mountain. A road winds round the mountain's terraces to the summit. Iron balls roll down the narrow road on the mountain's south-east side every few seconds; jump over them or get knocked flying. A wooden bridge spans the little valley by the small stone spire. A big stone spire stands in the north-west meadow, and an island floats above the field west of the mountain.

**Cannons:** each little grey hole in the ground has a cannon at the bottom. Drop in and you climb aboard; the cannon rises to the top of the hole and the view switches to looking out past the barrel. Aim with the stick, WASD or the mouse. Press **A** to fire yourself out, or **B** to hop back out. The holes are in the middle of the stone plaza, on top of the big boulder and on two of the mountain's terraces, and they all start aimed at the floating island. The island has a cannon too, aimed at the summit.

**Cherry Bombs** wait around the course. Get close and they roll after you; stay next to one too long and it explodes. Punch, kick or dive into one to send it flying, or stomp it flat.

**King Cherry Bomb** waits on the summit. He chases you and throws cherry bombs, and if you get in front of him he grabs you and hurls you. Stomping or punching him does nothing: get behind him, press **B** to grab him, then **B** again to throw him so he lands on the summit. Three throws beat him; throw him off the edge and he jumps back up unhurt. When he's beaten he explodes and drops the star. Grab the star to clear the course.

### The 7 stars

1. **King Cherry Bomb** on the summit drops one when beaten.
2. **100 coins**: collect 100 in one visit and a star appears (red coins count as 2).
3. **Red coins**: find all 8 and a star appears on top of the stone slope. They're on the small stone spire, above the plank bridge, under the valley bridge, on the stone bridge in the south-east, behind the stone plaza, in the far north-west and far south-east corners, and on a mountain terrace.
4. **The floating island**: fire yourself there from any cannon.
5. **Under the valley bridge**, down in the little valley.
6. **The stake** in the lowland: ground-pound it three times and a star appears at the gate.
7. **The big stone spire**: climb the steps up its south face.

Grabbing a star plays the course clear song while you celebrate; then the camera closes in and the screen irises out back to the hub. Stars you already have show see-through blue; the course card shows how many of the 7 you've got.

Your health is the meter at the top; coins refill it. Lose it all and the course restarts. 121 coins; counters are top-right. Press **M** to mute the music.

The look aims for the N64: smoothly filtered textures, blob shadows, rigid limbs posed at 30 fps, and trees as flat sprites that always face the camera. If the game runs slowly, add `?low` to the address. `?stage=sunny` jumps straight into the course.

## Code layout

- `src/main.js`: renderer, Lakitu-style camera, stage switching, game loop
- `src/player.js`: character rig setup and the movement state machine (collision, procedural animation)
- `src/world.js`: sky, lighting and level-building helpers; boxes double as collision
- `src/collider.js`: triangle collision for level models: floors, walls and ceilings, SM64-style
- `src/cannon.js`: the cannons (climb in, aim, fire)
- `src/ironball.js`: the iron balls that roll down the mountain road
- `src/terrain.js`: heightmap terrain (not used by the current stages)
- `src/stages/sunny-spire-hill.js`: the stage: loads the level model, adds the bridge, the spire's steps, cannons, coins, enemies and stars
- `src/stages/hub.js`: the hub (castle lobby and paintings)
- `src/enemies.js`: Cherry Bomb and King Cherry Bomb
- `src/star.js`, `src/audio.js`: the star; music, jingles and sound effects
- `src/input.js`: keyboard, mouse, gamepad and touch
- `src/fx.js`: dust, sparkles, impact shockwave, camera shake
- `src/coins.js`: collectible coins and the coin sound

The character's skeleton is posed in code every frame; there are no baked animations. Its head gets the wood texture, the eye decal and the cone hat at load time.

When you change any file, bump `VERSION` and the `?v=` numbers in `src/main.js` and `index.html` so players' browsers don't mix old and new files.

## Credits

Sunny Spire Hill sky: Super Mario 64 skyboxes ripped by Booscaster.

Sunny Spire Hill level model: "Super Mario 64 - Bob-omb Battlefield FULL LEVEL" by [Dynamic Light](https://sketchfab.com/DynamicL) on [Sketchfab](https://sketchfab.com/3d-models/super-mario-64-bob-omb-battlefield-full-level-99f4d6df290f478b9b2a87d71115e669), licensed [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).

Character model: "Fully Rigged Low Poly Character for blender" by [satyasrichaitanya360](https://sketchfab.com/satyasrichaitanya360) on [Sketchfab](https://sketchfab.com/3d-models/fully-rigged-low-poly-character-for-blender-dd918a1760be4849ac1026daa2c58b75), licensed [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).

Traffic cone hat: "Traffic Cone" by [hinndia](https://sketchfab.com/hinndia) on [Sketchfab](https://sketchfab.com/3d-models/traffic-cone-573feef839d7450cb3e12da9986e7a98), licensed [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).

Music and coin sound effect: supplied by the project owner; based on Nintendo's Super Mario 64.

Cherry Bomb: "Cherry Bomb" by [flogo](https://sketchfab.com/flogo) on [Sketchfab](https://sketchfab.com/3d-models/cherry-bomb-dbcfd63c7a5442b598f18edd3b38e3d7), licensed [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).

Star: "Super Mario 64 Star" by [tubers431](https://sketchfab.com/tubers431) on [Sketchfab](https://sketchfab.com/3d-models/super-mario-64-star-6ee9a66741a748a3b51e31840f5b1d14), licensed [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).

Course clear and boss music: supplied by the project owner; from Nintendo's Super Mario 64.
