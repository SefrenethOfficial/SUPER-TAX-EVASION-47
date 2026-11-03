# SUPER TAX EVASION 47

A three.js 3D platformer in the spirit of Super Mario 64. Right now it's a blank slate: a big grassy field and a small test yard to try out the full moveset.

**Play:** open `index.html` through any static server (or GitHub Pages). No build step; three.js loads from a CDN.

## Moves

| Move | How |
| --- | --- |
| Run / walk | WASD or left stick (hold **C** to walk on keyboard) |
| Jump | **Space**. Hold for full height, tap for a short hop |
| Double / triple jump | Jump again right as you land. The triple needs running speed |
| Backflip | Crouch while standing still, then Jump |
| Long jump | While running: Crouch + Jump |
| Side somersault | Run, flip the stick backwards, Jump during the skid |
| Wall kick | Jump into a wall, press Jump the moment you touch it |
| Ground pound | Crouch in mid-air |
| Dive | Attack while running fast or in mid-air |
| Rollout | Jump or Attack during the belly slide after a dive |
| Punch, punch, kick | Attack three times |
| Jump kick | Attack in mid-air while slow |
| Slide kick | While running: Crouch + Attack |
| Ledge grab | Fall against an edge. Forward climbs, Jump quick-climbs, back/Crouch lets go |

## Controls

| Action | Keyboard / mouse | Gamepad |
| --- | --- | --- |
| Jump (A) | Space | A |
| Attack (B) | J, X, left click | X or B |
| Crouch (Z) | Shift, K, right click | Triggers or bumpers |
| Camera | Mouse (click to lock), Q/E rotate, R/F tilt, wheel zoom | Right stick |
| Moves list | H | |
| Debug readout | F3 or ` | |

Touch screens get an on-screen stick plus A / B / Z buttons.

## Test yard

Next to spawn: walkable stairs, a ledge-grab platform, a higher block for double/triple jumps and backflips, a wall-kick chimney with a platform at the top, floating stepping stones, a tower to ground-pound off, and two raised runways with a gap that only a long jump clears.

## Code layout

- `src/main.js`: renderer, Lakitu-style camera, game loop
- `src/player.js`: character model setup and the movement state machine (all the moves, collision, procedural animation)
- `src/world.js`: level geometry. The level is axis-aligned boxes that double as collision
- `src/input.js`: keyboard, mouse, gamepad and touch
- `src/fx.js`: dust, ground-pound shockwave, camera shake

The character model is cut into body, arms and legs when it loads so the limbs can swing; all animation is procedural.

## Credits

Character model: "Stock low-poly sombrero-wearing person" by [morejpeg](https://sketchfab.com/morejpeg) on [Sketchfab](https://sketchfab.com/3d-models/stock-low-poly-sombrero-wearing-person-d01ac810c2eb4c37b78c33328e38dfca), under the Sketchfab Standard license.
