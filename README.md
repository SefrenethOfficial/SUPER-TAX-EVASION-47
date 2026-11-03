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

## Sunny Spire Hill

A long valley course in the style of Bob-omb Battlefield. From the spawn meadow a dirt path crosses a creek on a wooden bridge, climbs a ramp onto a raised plateau (a second slope drops east to a fenced pen with a stake), and reaches a big mountain. A road spirals 3.4 times round the mountain to the summit, where rock ledges wind up a spire to the star. Stepping stones lead off the mountain's west side to a floating island, and a pond sits in the back meadow. The cliffs between road levels can be shortcut with a triple jump and a ledge grab.

The ground is a heightmap: gentle slopes are walkable, steep ones and cliffs block you (and work for wall kicks and ledge grabs). There are about 110 coins; the counters are top-right. Press **M** to mute the music.

The look aims for the N64: smoothly filtered textures, blob shadows instead of real-time shadows, and trees as flat sprites that always face the camera. If the game runs slowly, add `?low` to the address (renders at 1x pixel density).

## Code layout

- `src/main.js`: renderer, Lakitu-style camera, game loop
- `src/player.js`: character rig setup and the movement state machine (collision, procedural animation)
- `src/world.js`: sky, lighting and level-building helpers; boxes double as collision
- `src/terrain.js`: heightmap terrain (mesh, collision, grass/cliff/path texture blending)
- `src/stages/sunny-spire-hill.js`: the stage: height function, paths, props, coins and star
- `src/star.js`, `src/audio.js`: the star goal; music and sound effects
- `src/input.js`: keyboard, mouse, gamepad and touch
- `src/fx.js`: dust, sparkles, impact shockwave, camera shake
- `src/coins.js`: collectible coins and the coin sound

The character's skeleton is posed in code every frame; there are no baked animations. Its head gets the wood texture, the eye decal and the cone hat at load time.

When you change any file, bump `VERSION` and the `?v=` numbers in `src/main.js` and `index.html` so players' browsers don't mix old and new files.

## Credits

Character model: "Fully Rigged Low Poly Character for blender" by [satyasrichaitanya360](https://sketchfab.com/satyasrichaitanya360) on [Sketchfab](https://sketchfab.com/3d-models/fully-rigged-low-poly-character-for-blender-dd918a1760be4849ac1026daa2c58b75), licensed [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).

Traffic cone hat: "Traffic Cone" by [hinndia](https://sketchfab.com/hinndia) on [Sketchfab](https://sketchfab.com/3d-models/traffic-cone-573feef839d7450cb3e12da9986e7a98), licensed [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).

Music and coin sound effect: supplied by the project owner; based on Nintendo's Super Mario 64.
