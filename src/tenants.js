// Your neighbours at Fairview Heights. Each lives in their own flat off the first-floor corridor, and each
// can become a friend: talk, hang out, bring them something. Get close enough and they'll do you a favour.
// Friendship is their mood towards you (−100 … 100): Stranger, Neighbour (20), Friend (50), Close friend (80).
import { randomLook } from './character.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export const TENANTS = {
  okafor: {
    name: 'Mrs. Okafor', room: '1A', look: { female: true, hairStyle: 'bun', height: 1.62, skin: 0x5a3a28, hair: 0xb8b8b8, shirt: 0x6a3a7a, pants: 0x2a2a34 },
    lines: ['I taught at the primary school for thirty-one years. Now I teach the pigeons.', 'Have you eaten? You look thin.', 'The young man in 1B plays his guitar at two in the morning. I have started to like it.', "Marco fixed my kettle. He wouldn't take a cent."],
    friendLines: ['You are a good one. I can always tell.', 'Come by for dinner any time. I mean it.', "My grandson is your age. He doesn't call."],
    hang: ['You sit with Mrs. Okafor and she corrects your grammar for an hour. You learn a lot.', 'She makes tea and tells you about her students. Some of them are judges now. One is in prison.', 'You help her with the crossword. She finishes it before you find a pen.'],
    favour: 'Dinner', favourCool: 180,
  },
  dez: {
    name: 'Dez', room: '1B', look: { female: false, hairStyle: 'curly', height: 1.8, longSleeves: true, skin: 0xc89a78, hair: 0x1a1210, shirt: 0x2a2a3a, pants: 0x3a4a6a },
    lines: ["I've got a gig at the nightclub Friday. Well. An open mic.", 'Sorry about the noise. Inspiration keeps weird hours.', "June knows everything about everyone. Don't tell her anything.", 'I write songs about this island. Nobody wants songs about this island.'],
    friendLines: ["You're my number one fan. Also my only fan.", 'I wrote a song about you. It\'s mostly about the beanie.', 'Want to hear the new one? Too bad, you\'re hearing it.'],
    hang: ['Dez plays you his new song. It is long. Some of it is good.', 'You and Dez argue about the best album ever made. Nobody wins.', 'Dez teaches you three chords. You forget two of them.'],
    favour: 'Borrow $150', favourCool: 300,
  },
  marco: {
    name: 'Marco', room: '1C', look: { female: false, hairStyle: 'buzz', height: 1.78, build: 1.12, skin: 0xd8a878, hair: 0x2a1a10, shirt: 0x3a5a7a, pants: 0x2a2a2a },
    lines: ["Your car making a noise? Every car's making a noise.", 'I work at the garage by the construction site. Cash only. No questions.', "The cops came round last week. I didn't see nothing. I never see nothing.", 'Dez owes me forty bucks.'],
    friendLines: ['You need somewhere to sit tight, my door is open.', "You're alright. For someone who doesn't know what a carburettor is.", 'Anyone gives you trouble in this building, you come to me.'],
    hang: ['You watch the game with Marco. Halyard lose. He takes it personally.', 'Marco shows you how to change a tyre. Then he does it himself because you were too slow.', 'You and Marco eat cold pizza and say nothing for an hour. It is great.'],
    favour: 'Lie low', favourCool: 240,
  },
  june: {
    name: 'June', room: '1D', look: { female: true, hairStyle: 'bob', height: 1.58, longSleeves: true, skin: 0xf0c8a8, hair: 0xd8d0c0, shirt: 0x9ab8d8, pants: 0x5a5a6a },
    lines: ["The cat's called Biscuit. Don't touch him, he bites. He likes you though.", 'Mrs. Okafor thinks I gossip. I just notice things.', "That buyer at the skatepark? Too clean shoes. I'm just saying.", 'Marco had a visitor at three in the morning. Not that I was looking.'],
    friendLines: ["You're the only one in this building who listens.", 'I hear things. I could tell you things. For a friend.', "Biscuit's taken a shine to you. He doesn't do that."],
    hang: ['June tells you everything about everyone in the building. You now know far too much about Dez.', 'You help June wind her wool. Biscuit attacks it.', "June shows you her photo albums. There's one of the island before the high rises."],
    favour: 'Gossip', favourCool: 180,
  },
};

export function friendLevel(m) { return m >= 80 ? 'Close friend' : m >= 50 ? 'Friend' : m >= 20 ? 'Neighbour' : m <= -30 ? 'Enemy' : 'Stranger'; }

export class Tenants {
  constructor(g, spots) {
    this.g = g; this.list = [];
    const C = g.citizens;
    for (const s of spots) {
      const t = TENANTS[s.id]; if (!t) continue;
      const n = C.addWorker({ pos: s.pos, yaw: s.yaw, lines: t.lines, role: 'tenant', name: t.name, look: { ...randomLook(), ...t.look } });
      n.tenant = { id: s.id, ...t, hangT: 0, favourT: 0, greetT: 0 }; n.mood = 5;
      this.list.push(n);
    }
  }
  update(dt) {
    const g = this.g, C = g.citizens, pp = g.player.pos;
    for (const n of this.list) {
      const T = n.tenant; T.hangT -= dt; T.favourT -= dt; T.greetT -= dt; T.giftT = (T.giftT || 0) - dt; T.compT = (T.compT || 0) - dt;
      if (n.state === 'dead' || g.player.car) continue;
      // friends say hello when you pass
      if (T.greetT <= 0 && n.mood >= 20 && C.pos(n).distanceTo(pp) < 3.6) {
        T.greetT = 45 + Math.random() * 30;
        C.say(n, n.mood >= 50 ? pick(['Hey you!', 'There they are!', `Hi, neighbour!`, 'Good to see you.']) : pick(['Hi.', 'Evening.', 'Oh, hello.']), 2.2); n.waveT = 0.8;
      }
    }
  }
  options(n) {
    const T = n.tenant, friends = n.mood >= 50;
    return [
      { id: 'talk', label: 'Talk' },
      { id: 'hang', label: 'Hang out' },
      { id: 'money', label: 'Give $20' },
      { id: 'favour', label: friends ? T.favour : `${T.favour} (friends only)` },
      { id: 'compliment', label: 'Compliment' },
      { id: 'insult', label: 'Insult' },
    ];
  }
  // their own actions (talk, hang out, favour); the rest (gifts, compliments, insults) are anyone's
  act(n, id) {
    const g = this.g, C = g.citizens, T = n.tenant, m = n.mem;
    if (id === 'talk') {
      if (n.mood <= -30) C.say(n, pick(["Don't you knock on my door.", 'We have nothing to talk about.']), 3);
      else C.say(n, (!m.met ? `I'm ${T.name}, ${T.room}. ` : '') + pick(n.mood >= 50 ? T.friendLines.concat(T.lines) : T.lines));
      m.met = true; m.talks++; n.mood += n.mood <= -30 ? 0 : 3; n.state = 'talk'; n.stateT = 5;
      return true;
    }
    if (id === 'hang') {
      if (n.mood <= -30) { C.say(n, 'Not a chance.', 2.5); return true; }
      if (T.hangT > 0) { C.say(n, pick(["I'm in the middle of something. Later?", 'Give me a bit, yeah?', 'Not right now, love.']), 2.6); return true; }
      T.hangT = 60; m.met = true;
      const before = n.mood;
      g.hud.blackout(true);
      setTimeout(() => { g.hud.blackout(false); g.hud.toast(pick(T.hang), '#ffd7a8'); n.mood = Math.min(100, n.mood + (n.mood < 50 ? 14 : 8)); this.levelCheck(n, before); n.human.express('happy', 3); }, 700);
      return true;
    }
    // (friendship takes a while: one gift, one compliment, one hang-out at a time)
    if (id === 'money') {
      if (g.money < 20) { g.hud.toast("You don't have $20"); return true; }
      if (T.giftT > 0) { C.say(n, pick(['You already gave me something. Keep your money.', "I can't take any more, really."]), 2.6); return true; }
      g.money -= 20; m.gifts++; T.giftT = 120; n.mood += 12; n.human.express('happy', 3); C.say(n, pick(['Oh, you shouldn\'t have!', 'For me? Thank you.', "That's sweet of you."]), 2.6); n.state = 'talk'; n.stateT = 5;
      return true;
    }
    if (id === 'compliment') {
      if (T.compT > 0) { C.say(n, pick(['You said that already.', 'Ha. Okay, okay.']), 2.2); return true; }
      T.compT = 60; m.compliments++; n.mood += n.mood < 0 ? 4 : 8; n.human.express('happy', 3); C.say(n, pick(['Aw, thank you.', 'Well, aren\'t you nice.', 'You made my day.']), 2.4);
      return true;
    }
    if (id === 'favour') {
      if (n.mood < 50) { C.say(n, pick(["I don't know you well enough for that.", "Let's get to know each other first.", 'Ha. Maybe one day.']), 3); return true; }
      if (T.favourT > 0) { C.say(n, pick(['I already helped you out. Give it a while.', 'Again? Come back later.']), 2.8); return true; }
      this.favour(n);
      return true;
    }
    return false;
  }
  favour(n) {
    const g = this.g, C = g.citizens, T = n.tenant, pl = g.player, P = g.police;
    const done = (line, toast, col = '#7be08a') => { T.favourT = T.favourCool; C.say(n, line, 3.5); if (toast) g.hud.toast(toast, col); n.human.express('happy', 3); };
    switch (T.id) {
      case 'okafor':
        if (pl.hp >= 100) { C.say(n, "You look well fed already. Come back when you're hungry.", 3); return; }
        pl.hp = 100; done('Sit. Eat. All of it.', "Mrs. Okafor feeds you jollof rice until you can't move. Fully healed.");
        return;
      case 'dez':
        g.money += 150; g.sfx?.cash(pl.pos); done('Pay me back whenever. Or don\'t. Just don\'t tell Marco.', 'Dez lends you $150');
        return;
      case 'marco':
        if (P.stars >= 4) { C.say(n, "With half the force outside? No way. Not in my place.", 3); return; }
        if (!P.stars && !P.suspect) { C.say(n, "You're not in any trouble. Are you?", 3); return; }
        P.clear(); done("In. Sit. If anyone knocks, you were watching the game with me all night.", 'Marco covers for you. The police lose interest.');
        return;
      case 'june': {
        const cops = g.citizens.list.filter(b => b.role === 'buyer' && b.undercover && b.state !== 'dead');
        if (!cops.length) { done("Nobody suspicious out there today. Not even the ones with nice shoes.", null); return; }
        for (const b of cops) b.outed = true;
        const where = [...new Set(cops.map(b => ({ skatepark: 'the skatepark', bushes: 'the park', washrooms: 'the beach washrooms', nightclub: 'outside the nightclub' })[b.spot] || 'round town'))];
        done(`The one at ${where[0]}? Police. Trust me.`, `June says the buyer${cops.length > 1 ? 's' : ''} at ${where.join(' and ')} ${cops.length > 1 ? 'are' : 'is'} undercover`, '#ffb04a');
        return;
      }
    }
  }
  levelCheck(n, before) {
    const a = friendLevel(before), b = friendLevel(n.mood);
    if (a !== b) this.g.hud.toast(`${n.tenant.name}: ${b}${n.mood >= 50 && before < 50 ? ` · they'll do you a favour now (${n.tenant.favour})` : ''}`, n.mood > before ? '#7be08a' : '#ff5a5a');
  }
}
