# PHY2ICK

The in-between chapter of [Physick](https://github.com/SefrenethOfficial/Physick): after the lockdown, before whatever comes next. Less story-driven than Physick, but the city's on edge, and people talk.

Play it at **https://sefrenethofficial.github.io/PHY2ICK/**

## Right now: the test area

Before the real map, everything new gets tried out in one small test area: a block of road around a park (a fountain, trees, benches, Café Noir), streets of buildings, and a test track to the east with a slalom, two jump ramps and a long straight.

### Home: No. 14
You start in your apartment, a loft on the first floor of No. 14, the brick building on the north side of the park. Real windows look out over the street. There's a living room (sofa, TV showing Channel 6, a rug, a lamp), a kitchen with a dining table, a bed, moving boxes still stacked by the stair, and a stair down to the lobby and out the front door.

- **Pick things up.** Mugs, a bottle, books, cans, apples, a cereal box, a pan, cushions, chairs, the moving boxes, a basketball, and a traffic cone (don't ask). `Click` to pick something up and carry it, `Click` again to put it down, `Right-click` to throw it.
- **The weapon rack** ("FOR EMERGENCIES") by the top of the stair: a **Hatchet**, a **Butter Knife** and a **Plastic Kiddie Knife**. Press `E` at the rack to take one (or put it back), `Click` to swing, `X` to put it away. The hatchet drops people; the butter knife makes them bleed and run; the plastic knife bends, and people laugh at you.

### Ragdolls and blood
- When someone's hit by a car, or by a hatchet, they go **limp**: a real ragdoll (eleven physics bodies jointed at the skeleton; knees and elbows only bend the right way) that tumbles, rolls and lands however it lands. Cars shove bodies around. If they're only hurt, they get back up where they ended up, and then come after you or run.
- **Blood**: droplets that fly and fall and splat where they land, a spray on every hit, and a pool that spreads under a body. Bodies stay for a minute and a half; then someone new turns up in the park.
- People who see violence **panic** and run.
- You can be knocked flat too (by a car, or a shove). Lose all your health and you **black out**, then wake up at home, $100 poorer for the ambulance.

### The look
- **A physical sky**, and the same sky lights the whole scene (reflections and ambient light), with a warm sun and sharp, long-range shadows.
- **Ambient occlusion**: soft contact shadows in corners, under cars, round furniture and where walls meet the ground. (`P` switches it off on slower computers; or add `?lowgfx` to the address.)
- **Textures**: asphalt with aggregate, repairs, cracks, oil stains and worn paint; concrete pavement slabs with joints and stains; grass with patches of colour across the park; brick, stucco and concrete walls with relief.
- Indoors, the sky's light is mostly kept out, so rooms are lit by their own lamps.

### Buildings
Four styles of building: **brick** (framed windows with mullions, stone sills and lintels, floor bands), **stucco** (balconies with railings), **concrete** (wide window bands) and **glass towers**. All have cornices and parapets, roofs with air-con units, water tanks and stair housings; most have **shopfronts** at street level: big shop windows, a door, a striped awning and a sign (Corner Deli, Noodle Bar, Pawn & Gold, Laundromat…). Some windows are lit.

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
| Hold `E` | talk to someone (the interaction wheel); at the rack: take / put back a weapon |
| `Click` | pick up / drop; with a weapon: swing |
| `Right-click` | throw what you're carrying |
| `X` | put the weapon away (or drop what you're carrying) |
| `F` | get in / out of a car |
| `C` | inside view / chase camera |
| `R` | flip the car back over |
| `H` | hide the controls |
| `P` | graphics: high (ambient occlusion) / fast |
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
  main.js       setup, input, the main loop, post-processing, getting in and out of cars, cars hitting people
  world.js      the test area: sky and sun, roads, sidewalks, the park, the test track; places the buildings
  buildings.js  building facades: windows, shopfronts, awnings, signs, balconies, cornices, rooftops
  apartment.js  No. 14: the lobby, the stair, your apartment, its furniture and loose things
  props.js      loose things: picking up, carrying, dropping, throwing
  weapons.js    the hatchet, the butter knife, the plastic kiddie knife, the rack, swinging
  ragdoll.js    ragdolls: physics bodies and joints that pose the skeleton
  blood.js      droplets, splats and pools
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
