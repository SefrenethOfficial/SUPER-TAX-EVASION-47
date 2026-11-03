# SUPER TAX EVASION 47

![SUPER TAX EVASION 47](assets/logo.png)

A three.js 3D platformer in the spirit of Super Mario 64. The first stage is **Sunny Spire Hill**.

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

## Tax Haven (hub)

The game starts on the castle grounds. Jump into the painting on the castle's front wall to enter Sunny Spire Hill. When you clear the course you come back out of the painting. Stars you collect are saved in your browser.

## Sunny Spire Hill

A long valley course in the style of Bob-omb Battlefield. From the spawn meadow a dirt path crosses a ravine on a wooden bridge (fall in and you can walk out at its shallow east end), climbs a ramp onto a raised plateau (a second slope drops east to a fenced pen with a stake), and reaches a big red-rock mountain. A road spirals 3.4 times round the mountain to the summit. Stepping stones lead off the mountain's west side to a floating island, and a pond sits in the back meadow. The cliffs between road levels can be shortcut with a triple jump and a ledge grab.

**Cherry Bombs** wait around the course. Get close and they roll after you; stay next to one too long and it explodes. Punch, kick or dive into one to send it flying, or stomp it flat.

**King Cherry Bomb** waits on the summit. He chases you and throws cherry bombs, and if you get in front of him he grabs you and hurls you. Stomping or punching him does nothing: get behind him, press **B** to grab him, then **B** again to throw him so he lands on the summit. Three throws beat him; throw him off the edge and he jumps back up unhurt. When he's beaten he explodes and drops the star. Grab the star to clear the course.

### The 7 stars

1. **King Cherry Bomb** on the summit drops one when beaten.
2. **100 coins**: collect 100 in one visit and a star appears (red coins count as 2).
3. **Red coins**: find all 8 and a star appears on the plateau. They're on the bridge rail, along the ravine, over the pond, on a pen fence post, above a stepping stone, halfway up the spire, on the north-east hill and high on the mountain road.
4. **The floating island** off the mountain's west side.
5. **Down in the ravine**, at its deep west end.
6. **The stake** in the fenced pen: ground-pound it three times.
7. **The spire** in the back meadow: climb the spiral of rock ledges.

Each star ends the course and returns you to the hub. Stars you already have show see-through blue; the course card shows how many of the 7 you've got.

Your health is the meter at the top; coins refill it. Lose it all and the course restarts. About 110 coins; counters are top-right. Press **M** to mute the music.

The look aims for the N64: smoothly filtered textures, blob shadows, rigid limbs posed at 30 fps, and trees as flat sprites that always face the camera. If the game runs slowly, add `?low` to the address. `?stage=sunny` jumps straight into the course.

## Code layout

- `src/main.js`: renderer, Lakitu-style camera, game loop
- `src/player.js`: character rig setup and the movement state machine (collision, procedural animation)
- `src/world.js`: sky, lighting and level-building helpers; boxes double as collision
- `src/terrain.js`: heightmap terrain (mesh, collision, grass/cliff/path texture blending)
- `src/stages/sunny-spire-hill.js`: the stage: height function, paths, props, coins and star
- `src/stages/hub.js`: the hub (castle grounds and paintings)
- `src/enemies.js`: Cherry Bomb and King Cherry Bomb
- `src/star.js`, `src/audio.js`: the star; music, jingles and sound effects
- `src/input.js`: keyboard, mouse, gamepad and touch
- `src/fx.js`: dust, sparkles, impact shockwave, camera shake
- `src/coins.js`: collectible coins and the coin sound

The character's skeleton is posed in code every frame; there are no baked animations. Its head gets the wood texture, the eye decal and the cone hat at load time.

When you change any file, bump `VERSION` and the `?v=` numbers in `src/main.js` and `index.html` so players' browsers don't mix old and new files.

## Credits

Character model: "Fully Rigged Low Poly Character for blender" by [satyasrichaitanya360](https://sketchfab.com/satyasrichaitanya360) on [Sketchfab](https://sketchfab.com/3d-models/fully-rigged-low-poly-character-for-blender-dd918a1760be4849ac1026daa2c58b75), licensed [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).

Traffic cone hat: "Traffic Cone" by [hinndia](https://sketchfab.com/hinndia) on [Sketchfab](https://sketchfab.com/3d-models/traffic-cone-573feef839d7450cb3e12da9986e7a98), licensed [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).

Music and coin sound effect: supplied by the project owner; based on Nintendo's Super Mario 64.

Cherry Bomb: "Cherry Bomb" by [flogo](https://sketchfab.com/flogo) on [Sketchfab](https://sketchfab.com/3d-models/cherry-bomb-dbcfd63c7a5442b598f18edd3b38e3d7), licensed [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).

Star: "Super Mario 64 Star" by [tubers431](https://sketchfab.com/tubers431) on [Sketchfab](https://sketchfab.com/3d-models/super-mario-64-star-6ee9a66741a748a3b51e31840f5b1d14), licensed [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).

Course clear and boss music: supplied by the project owner; from Nintendo's Super Mario 64.
