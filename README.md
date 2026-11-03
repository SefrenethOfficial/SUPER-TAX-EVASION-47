# SUPER TAX EVASION 47

![SUPER TAX EVASION 47](assets/logo.png)

A three.js 3D platformer in the spirit of Super Mario 64. Right now it's a blank slate: a big grassy field and a small test yard to jump around in.

**Play:** open `index.html` through any static server (or GitHub Pages). No build step; three.js loads from a CDN.

## Controls

| Action | Keyboard / mouse | Gamepad |
| --- | --- | --- |
| A | Space | A |
| B | J, X, left click | X or B |
| Z | Shift, K, right click | Triggers or bumpers |
| Camera | Mouse (click to lock), Q/E rotate, R/F tilt, wheel zoom | Right stick |
| Controls list | H | |
| Debug readout | F3 or ` | |

Touch screens get an on-screen stick plus A / B / Z buttons.

## Test yard

Next to spawn: stairs, a couple of raised platforms, a tall two-wall chimney, floating stepping stones, a tower, and two raised runways with a gap between them. There are 44 coins scattered around it; the counter is in the top-right.

## Code layout

- `src/main.js`: renderer, Lakitu-style camera, game loop
- `src/player.js`: character rig setup and the movement state machine (collision, procedural animation)
- `src/world.js`: level geometry. The level is axis-aligned boxes that double as collision
- `src/input.js`: keyboard, mouse, gamepad and touch
- `src/fx.js`: dust, sparkles, impact shockwave, camera shake
- `src/coins.js`: collectible coins and the coin sound

The stickman's skeleton is posed in code every frame; there are no baked animations.

When you change any file, bump `VERSION` and the `?v=` numbers in `src/main.js` and `index.html` so players' browsers don't mix old and new files.

## Credits

Character model: "Stickman Low Poly" by [studentsimf](https://sketchfab.com/studentsimf) on [Sketchfab](https://sketchfab.com/3d-models/stickman-low-poly-12b31ea386ee4398a552d15c01615ae9), licensed [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).
