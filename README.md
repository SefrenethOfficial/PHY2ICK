# PHY2ICK

The in-between chapter of [Physick](https://github.com/SefrenethOfficial/Physick): after the lockdown, before whatever comes next. Less story-driven than Physick, but the city's on edge, and people talk.

Play it at **https://sefrenethofficial.github.io/PHY2ICK/**

## Right now: the test area

Before the real map, everything new gets tried out in one small test area: a block of road around a park (a fountain, trees, benches, Café Noir), a row of buildings, and a test track to the east with a slalom, two jump ramps and a long straight.

### People
- **Believable, not photoreal.** Each body is one smooth, skinned mesh (torso, arms and legs in one piece, with clothes coloured on: collars, sleeves, a belt line), so elbows, knees, hips and shoulders bend like skin instead of showing seams. Hands with a thumb, shoes on soles, and a face with eyes, brows and a mouth: no noses, no ears. Different skin tones, hairstyles (short, swept, buzz, bald, bob, long, bun), clothes, heights and builds.
- **Animated from a skeleton.** Every person has a joint rig (hips, spine, chest, neck, head, shoulders, elbows, wrists, hips, knees, ankles) and a gait driven by speed: a walk blends into a run, arms swing against the legs, the body bobs and leans, knees bend on the swing. They breathe when standing, gesture when they talk, turn their heads to look at you, sit on benches, point when giving directions, and sit properly in cars with their hands on the wheel. 
- **Citizens** wander the park, stop, sit on benches, step round each other, and jump out of the way of cars coming at them. Each has a name, a **mood** and a **memory** of you: how often you've talked, given them money, complimented or insulted them, or run them over.

### The interaction wheel
Walk up to someone and **hold `E`**. Time slows down and a wheel opens with their name (once you've met) and how they feel about you:

- **Talk:** they introduce themselves, then gossip (the Hollows bombing, the army at the naval base, a ship with no flag, Pratt out on bail…), or small talk. They remember you ("You again!", "It's the twenty-dollar guy!").
- **Follow me / Stop following:** if they like you enough, they come along. Get in a car and they'll get in the passenger seat; get out and they get out too.
- **Give $20:** makes their day.
- **Directions:** they point the way and set a waypoint (a beam of light and a marker on screen) to somewhere in the test area.
- **Compliment** and **Insult:** insult someone enough and they'll either run off or come over and shove you.

Move the mouse toward an option and let go of `E`, or click, or press `1`–`6`. `Q` cancels.

### Cars
- **Real vehicle physics** (Rapier's raycast vehicle): each wheel has its own spring and damper, so the car squats when you accelerate, dives when you brake and leans in corners. The tyres grip and then slide; the handbrake (`Space`) locks the rear wheels for handbrake turns. Rear-wheel drive, power fades toward top speed, steering lock eases off at speed, and the brakes are front-biased so it stops straight.
- **A real cabin.** Press `C` for the inside view: the dashboard with working speedometer and rev counter (and a gear indicator), a radio screen, a steering wheel that turns with the front wheels, seats, door cards, and a **working rear-view mirror**. Your character's hands are on the wheel and follow it round. Mouse to look around inside.
- Doors, handles, side mirrors, headlights, tail lights that brighten when you brake, reversing lights, number plates.
- Cars hit people: they get knocked down, then (depending on how brave they are) come after you or run. Drive at you and you'll be knocked flat too.
- `R` puts a flipped car back on its wheels.

## Controls

| | |
|---|---|
| `WASD` | move (in a car: drive, brake/reverse, steer) |
| `Shift` | run |
| `Space` | jump (in a car: handbrake) |
| Hold `E` | talk to someone (the interaction wheel) |
| `F` | get in / out of a car |
| `C` | inside view / chase camera |
| `R` | flip the car back over |
| `H` | hide the controls |
| Mouse | look |

## Running it

```
npm install
npm run dev     # http://localhost:5173
npm run build   # the built game goes in dist/
```

Pushing to `main` builds and deploys to GitHub Pages (`.github/workflows`).

## Files

```
src/
  main.js       setup, input, the main loop, getting in and out of cars, cars hitting people
  world.js      the test area: roads, sidewalks, the park, buildings, the test track, sky and sun
  character.js  people: the skeleton, the skinned body, the looks (no noses, no ears), the procedural animation
  player.js     you: Rapier's character controller (steps, slopes), walking, running, jumping
  camera.js     over-the-shoulder camera, chase camera, the inside view
  car.js        the car: raycast-vehicle physics, the body and cabin, gauges, the mirror
  citizens.js   people in the park: wandering, benches, moods, memory, what they say
  wheel.js      the interaction wheel
  hud.js        money, health, prompts, messages, speech bubbles, the waypoint, the speedo
  style.css     the HUD and the title screen
```

Built with [three.js](https://threejs.org) and [Rapier](https://rapier.rs).
