// Shops, and the things in them: real items on the shelves (pick them up, pay at the till, or put them in your
// pocket and walk out: the clerk may notice), pickpocketing people in the street, and selling what you've got
// (stolen or not) at the Pawn Shop. Halyard Arms sells guns.
import * as THREE from 'three';
import { canvasTex } from './world.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
function inRing(x, z, ring) { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, zi] = ring[i], [xj, zj] = ring[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; }

// what's on the shelves, by shop: a shape, a size, colours, a price range
const GOODS = {
  food: [['Chips', 'bag', [0.16, 0.22, 0.07], [0xd8344a, 0xf2c23a, 0x2e8ad8, 0x3aa84a], [3, 5]], ['Cereal', 'box', [0.2, 0.28, 0.07], [0xf2c23a, 0xd85a2a, 0x8a3ac8], [5, 8]], ['Soda', 'can', [0.066, 0.12], [0xc8202a, 0x2a6ac8, 0x3aa84a, 0x1a1a1a], [2, 3]], ['Juice', 'bottle', [0.07, 0.24], [0xf29a2a, 0xe8d23a, 0xc83a5a], [4, 6]], ['Candy bar', 'box', [0.14, 0.03, 0.05], [0x5a3a22, 0xd8344a, 0x2a6ac8], [2, 3]]],
  games: [['A game', 'box', [0.14, 0.19, 0.02], [0x2a6ac8, 0xd8344a, 0x3aa84a, 0x1a1a1a], [40, 70]], ['A controller', 'box', [0.16, 0.06, 0.1], [0x1a1a1a, 0xeeeeee], [55, 70]]],
  tools: [['Paint', 'can', [0.17, 0.19], [0xd8344a, 0x2a6ac8, 0xeeeeee, 0x3aa84a], [18, 30]], ['A hammer', 'box', [0.06, 0.32, 0.04], [0xd87a1a], [15, 22]], ['Tape', 'box', [0.1, 0.05, 0.1], [0xc8c8c8, 0x2a2a2a], [6, 9]], ['Glue', 'bottle', [0.05, 0.16], [0xeeeeee, 0xf2c23a], [5, 8]]],
  cheap: [['A thing', 'box', [0.12, 0.12, 0.12], [0xd83aa8, 0x3ad8c8, 0xf2c23a], [2, 2]], ['A mug', 'can', [0.09, 0.1], [0xeeeeee, 0x2a6ac8], [2, 2]], ['A toy car', 'box', [0.14, 0.06, 0.07], [0xd8344a, 0x2a6ac8], [2, 2]]],
};
const POCKET = [['a wallet', 0], ['a watch', [60, 140]], ['a phone', [40, 110]], ['a necklace', [50, 200]], ['earbuds', [20, 60]], ['a lighter', [3, 10]]];

export class Shops {
  constructor(g) {
    this.g = g;
    this.loot = []; // (in your pockets: { name, value, paid, shop })
    this.stocked = new Set(); this.watch = [];
    this.wasIn = null;
  }
  get rooms() { return (this.g.rooms || []).filter(r => r.shelf?.length); }
  roomOf(p) { return this.rooms.find(r => inRing(p.x, p.z, r.ring) && p.y > r.y0 && p.y < r.y1); }
  clerk(name) { return this.g.citizens.list.find(n => n.home && n.shop === name && n.role === 'clerk' && n.state !== 'dead' && !n.human.ragdoll); }

  // ---- the shelves (filled the first time you come near the shop)
  stock(r) {
    this.stocked.add(r);
    const set = GOODS[r.set] || GOODS.food, slots = [...r.shelf].sort(() => Math.random() - 0.5).slice(0, 30);
    for (const s of slots) {
      const [name, shape, size, cols, [lo, hi]] = pick(set), col = pick(cols);
      const label = canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#' + new THREE.Color(col).getHexString(); c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(0, h * 0.38, w, h * 0.22); c.fillStyle = '#222'; c.fillRect(w * 0.15, h * 0.44, w * 0.7, h * 0.1); });
      const mat = new THREE.MeshStandardMaterial({ map: label, roughness: shape === 'can' ? 0.3 : 0.7, metalness: shape === 'can' ? 0.5 : 0 });
      const R = this.g.R; let mesh, desc;
      if (shape === 'can' || shape === 'bottle') { const [rad, ht] = size; mesh = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, ht, 12), mat); desc = R.ColliderDesc.cylinder(ht / 2, rad).setDensity(500); }
      else { const [w, h, d] = size; mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); desc = R.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setDensity(shape === 'bag' ? 60 : 300); }
      const ht = shape === 'can' || shape === 'bottle' ? size[1] : size[1];
      const p = this.g.props.add(mesh, desc, s.p.clone().add(V(0, ht / 2 + 0.01, 0)), name.toLowerCase().startsWith('a ') ? name : name, s.ry);
      p.shop = r.name; p.price = rint(lo, hi); p.paid = false;
    }
  }

  // ---- pay at the till for what you're holding (and what's in your pockets) from this shop
  unpaid(shop) {
    const held = this.g.props.held, out = [];
    if (held && held.shop === shop && !held.paid) out.push(held);
    for (const l of this.loot) if (l.shop === shop && !l.paid) out.push(l);
    return out;
  }
  pay(n) {
    const g = this.g, items = this.unpaid(n.shop), total = items.reduce((a, b) => a + b.price, 0);
    if (!items.length) return;
    if (g.money < total) { g.citizens.say(n, `That's $${total}. You're short.`, 2.6); return; }
    g.money -= total; for (const i of items) i.paid = true; g.sfx?.cash(g.citizens.pos(n));
    g.citizens.say(n, pick(['Thanks. Bag?', 'Have a good one.', 'Cash or… oh, cash. Good.']), 2.4);
    g.hud.toast(`Paid $${total}`, '#7be08a');
  }

  // ---- V: put what you're holding in your pocket (if it's small)
  pocket() {
    const g = this.g, P = g.props, p = P.held; if (!p) return false;
    if (Math.max(p.size.x, p.size.y, p.size.z) > 0.35) { g.hud.toast("That won't fit in your pocket."); return true; }
    P.drop(false); P.list.splice(P.list.indexOf(p), 1); P.byCollider.delete(p.col.handle); g.world.removeRigidBody(p.body); p.mesh.removeFromParent();
    const item = { name: p.name, value: p.price ?? rint(2, 15), paid: p.shop ? p.paid : true, shop: p.shop, price: p.price };
    this.loot.push(item);
    // pocketing something you haven't paid for, where the clerk can see
    if (p.shop && !p.paid) {
      const c = this.clerk(p.shop);
      if (c && this.sees(c, g.player.crouch ? 6 : 10)) { item.seen = true; g.citizens.say(c, pick(['Hey! I saw that!', 'Put that back!', "That's not free, mate!"]), 2.8); c.human.express('angry', 3); }
    }
    g.hud.toast(`Pocketed ${p.name}${item.paid ? '' : ' (not paid for)'}`, '#ffd23f');
    return true;
  }
  sees(n, R) {
    const g = this.g, q = g.citizens.pos(n), p = g.player.pos, d = q.distanceTo(p); if (d > R) return false;
    const f = V(Math.sin(n.yaw), 0, Math.cos(n.yaw)), dir = p.clone().sub(q).setY(0).normalize();
    return f.dot(dir) > -0.2 && g.police.los(q.clone().add(V(0, 1.6, 0)), p.clone().add(V(0, 1.1, 0)), R + 1);
  }

  // ---- the Pawn Shop: anything you've got, for a fraction of what it's worth
  saleValue(l) { return Math.max(1, Math.round((l.value ?? l.price ?? 5) * (l.paid && l.shop ? 0.3 : 0.5))); }
  sellLoot(n) {
    const g = this.g, items = this.loot.filter(l => l.name !== 'a wallet');
    if (!items.length) { g.citizens.say(n, "You've got nothing I want.", 2.4); return; }
    const total = items.reduce((a, l) => a + this.saleValue(l), 0);
    this.loot = this.loot.filter(l => !items.includes(l)); g.money += total; g.sfx?.cash(g.citizens.pos(n));
    g.citizens.say(n, pick(["Don't tell me where you got it.", 'I can shift this.', "I'll give you what it's worth. To me."]), 2.8);
    g.hud.toast(`Sold ${items.length} thing${items.length > 1 ? 's' : ''} for $${total}`, '#7be08a');
  }
  lootValue() { return this.loot.filter(l => l.name !== 'a wallet').reduce((a, l) => a + this.saleValue(l), 0); }

  // ---- pickpocketing: from behind (or crouched), quietly. Get it wrong and they notice.
  canPick(n) { return !n.home && !n.cop && !n.companion && !n.storyNpc && !n.tenant && !n.role && !n.picked && !['dead', 'seated', 'handsUp', 'flee'].includes(n.state); }
  pickpocket(n) {
    const g = this.g, C = g.citizens, pl = g.player, q = C.pos(n);
    const f = V(Math.sin(n.yaw), 0, Math.cos(n.yaw)), dir = pl.pos.clone().sub(q).setY(0).normalize(), behind = f.dot(dir) < -0.3;
    const chance = 0.35 + (pl.crouch ? 0.3 : 0) + (behind ? 0.25 : -0.15) - (n.state === 'talk' ? 0.2 : 0);
    n.picked = true;
    if (Math.random() < chance) {
      const cash = rint(8, 70); g.money += cash; const got = [`$${cash}`];
      if (Math.random() < 0.55) { const [name, v] = pick(POCKET.slice(1)); this.loot.push({ name, value: rint(v[0], v[1]), paid: false, stolen: true }); got.push(name); }
      g.hud.toast(`Lifted ${got.join(' and ')}`, '#ffd23f'); g.sfx?.cash(q);
      return;
    }
    n.mood -= 60; n.human.express('angry', 3); C.say(n, pick(['Hey! My wallet!', 'Get your hand OUT of my pocket!', 'Thief! THIEF!']), 2.8);
    if (n.brave > 0.6) { n.state = 'angry'; n.stateT = 8; } else { n.state = 'flee'; n.stateT = 8; }
    n.witness = { t: 2.5 + Math.random() * 2, level: 1, at: q.clone() }; // (they'll call it in)
    g.police?.crime('theft', q);
  }

  // ---- what the shopkeepers say on the wheel
  options(n) {
    const g = this.g, D = g.drugs;
    if (n.shop === 'Halyard Arms') return [
      { id: 'talk', label: 'Talk' }, { id: 'buy:pistol', label: 'Pistol $250' }, { id: 'buy:shotgun', label: 'Shotgun $600' },
      { id: 'buy:ammo', label: 'Ammo $40' }, { id: 'buy:hatchet', label: 'Hatchet $80' }, { id: 'insult', label: 'Insult' },
    ];
    if (n.shop === 'Pawn Shop') { const v = this.lootValue(); return [
      { id: 'sellloot', label: v ? `Sell your stuff ($${v})` : 'Sell your stuff' }, { id: 'buy:sack', label: 'Sack $5' }, { id: 'buy:salts', label: 'Blue Salts $45' },
      { id: 'sellall', label: D.count ? `Sell ${D.count} Physick` : 'Sell Physick' }, g.missions?.id === 'mask' ? { id: 'glassmask', label: 'The gold mask $250' } : g.never?.lou() ? { id: 'knockoff', label: 'A cheap gold mask, horns $40' } : { id: 'talk', label: 'Talk' }, { id: 'insult', label: 'Insult' },
    ]; }
    return null;
  }
  payOption(n) { const items = n.shop ? this.unpaid(n.shop) : []; return items.length ? { id: 'pay', label: `Pay $${items.reduce((a, b) => a + b.price, 0)}` } : null; }

  update(dt) {
    const g = this.g, pl = g.player, P = g.props;
    // stock the shelves of shops you come near
    for (const r of this.rooms) if (!this.stocked.has(r)) { const [x, z] = r.ring[0]; if (Math.hypot(x - pl.pos.x, z - pl.pos.z) < 40) this.stock(r); }
    // walking out with something you haven't paid for
    const here = this.roomOf(pl.pos.clone().add(V(0, 1, 0)));
    if (this.wasIn && here !== this.wasIn) {
      const items = this.unpaid(this.wasIn.name);
      if (items.length) {
        const c = this.clerk(this.wasIn.name), seen = items.some(i => i.seen);
        for (const i of items) { i.paid = true; i.stolen = true; i.shop = null; } // (it's yours now: stolen)
        if (c && (seen || Math.random() < (pl.crouch ? 0.35 : 0.65))) {
          g.citizens.say(c, pick(['Oi! You didn\'t pay for that!', "Hey! Get back here!", "I'm calling the police!"]), 3);
          g.police.crime('theft', g.citizens.pos(c), true);
        } else g.hud.toast('Nobody noticed.', '#ffd23f');
      }
    }
    this.wasIn = here;
  }
}
