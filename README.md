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

A dirt path leads from spawn to a three-tier grassy hill. Stairs climb the first two tiers; the third takes a jump or the rock step on the west side. On top, an orange-rock spire has ledges spiralling up it to the star at the summit. Off to the side: a floating island reached by stepping stones, a two-wall chimney, trees and boulders. 67 coins are scattered around; the counters are top-right. Press **M** to mute the music.

## Code layout

- `src/main.js`: renderer, Lakitu-style camera, game loop
- `src/player.js`: character rig setup and the movement state machine (collision, procedural animation)
- `src/world.js`: sky, lighting and level-building helpers. Levels are axis-aligned boxes that double as collision
- `src/stages/sunny-spire-hill.js`: the stage layout, coins and star position
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
