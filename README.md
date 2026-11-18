# Gilded Coast: After Hours

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Pasya1/gilded-coast-after-hours/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Pasya1/gilded-coast-after-hours/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original 3D open-world crime story in a sunset coastal city. Play as a courier helping Mara Vale and mechanic Ivo Serrano expose the syndicate buying their waterfront. Walk the promenade, borrow a Sunbird, recover a harbor ledger, fight surveillance lookouts, and broadcast the evidence over After Hours Radio.

The city, people, vehicles, signs, architecture and sounds are original procedural work. Three.js 0.187.0 is vendored locally with its MIT license. The game makes no network requests and needs no build, package install, account or external assets.

## Run it

Use Node.js 22.18 or later:

```sh
node serve.mjs
```

Open **http://127.0.0.1:4176** in a desktop browser with WebGL2. Any static HTTP server serving `game/` works. The included server binds only to the local machine. Set `PORT` to choose another local port.

Choose **Play the story**, **Free roam**, or **Hot pursuit**. Story jobs are linked in order; the radio menu shows the next available job and lets you replay completed ones. Hot pursuit starts inside a fast car with three wanted stars: survive 90 seconds and lose every star to win. Progress is real in every mode.

## Controls

| Action | Control |
| --- | --- |
| Walk / drive | WASD or arrow keys |
| Sprint on foot | Shift |
| Aim / fire on foot | Mouse / left mouse button |
| Reload | R |
| Talk, take an objective, restock, enter or exit a car | F |
| Handbrake while driving | Space |
| Story radio / choose a job | Tab |
| City map | M |
| Camera distance | Mouse wheel or C |
| Save progress | K or Pause → Save |
| Mute synthesized sound | N |
| Pause / close menu | Escape |
| Controls | H |

Gold rings and the minimap guide you to objectives. Car controls are relative to the vehicle; braking also engages reverse once the vehicle slows. Blue supply markers restore health and ammunition. Buildings block movement and gunfire. Police navigate around blocks, deploy officers, search your last known position, and cool down when you leave their sight. Repair a damaged car for $150 at Ivo’s garage: stop inside its objective ring and press F. Ditch a damaged car before its engine fails. Retry checkpoint restores a playable state after defeat. The final chapter gives you three minutes to collect its three dead drops before the signal is cut.

Save stores the current mode, position, vehicle condition and ownership, story stage, money, health, ammunition and pursuit state in this browser's localStorage. Jobs also save automatically on completion. Continue loads that night. Saves stay local to the browser and the server address; clearing site storage removes them. Checkpoint retry remains available during a session even when storage is unavailable.

## Validation and packaging

```sh
node --test tests/*.test.mjs
```

The tests cover vehicle acceleration/braking, collision tunneling, physical objective access through the generated city, patrol navigation, all linked story transitions, and corrupt-save handling. Browser playtesting checks the rendered world and actual controls.

`main.ts` packages the static game and three or four real browser screenshots, then writes the official deterministic dossier with the unchanged kit library:

```sh
# PowerShell
$env:MAKEFUN_OUTPUT_DIR = 'out'
node main.ts
```

The default output is `/output` in the competition runner. The packager uses only Node's standard library, rejects symbolic links, and applies the published game, screenshot and dossier caps. Screenshots are original, unedited renders of normal gameplay.

The game's modules separate city geometry, vehicles and people, police navigation, mission progression, audio, persistence and HUD from the gameplay controller. No commercial-game names, maps, assets or music are used. This is a compact desktop game; it uses an elevated camera and arcade vehicle handling.

MIT © 2026 Pasya1. Entered in [make.fun's Make GTA 6 bounty](https://make.fun/bounty/gta6-01).
