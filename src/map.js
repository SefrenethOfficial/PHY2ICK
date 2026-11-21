// The island, as drawn in PHY2ICK_Map.svg (plus a street grid over the empty north). Everything here is in the drawing's own pixels
// (960 × 720); city.js turns pixels into metres: X = (px − 430) × S, Z = (py − 440) × S.
export const S = 1.0; // (tight: a dense city, not an open one)
export const toX = (px) => (px - 430) * S;
export const toZ = (py) => (py - 440) * S;

// land: the polygons the drawing is made of (they overlap; they get merged)
export const LAND = [
  [[148.7, 606.8], [323.3, 152.9], [823.0, 152.9], [648.3, 606.8]],
  [[50.6, 360.9], [268.4, 155.4], [486.2, 155.4], [50.6, 566.3]],
  [[473.8, 156.7], [473.8, 18.0], [823.0, 156.7]],
  [[517.3, 239.5], [735.1, 34.0], [952.9, 34.0], [517.3, 444.9]],
];
export const LAND_BULGE = { cx: 398.4, cy: 605.1, rx: 249.7, ry: 23.1 }; // the land's curved south edge
export const SAND = { cx: 398.4, cy: 618.9, rx: 249.7, ry: 27.8 };      // Palm Tree Beach
export const PIER = [[650.7, 606.8], [687.6, 606.8], [824.8, 152.9], [787.8, 152.9]];

// roads: centre lines (all 36, as drawn)
export const ROADS = [
  [[56.7, 396.3], [698.7, 396.3]],   // the north avenue, coast to coast
  [[560.3, 281.9], [560.3, 618.0]],  // the main north–south road
  [[485.8, 396.3], [485.8, 536.0]],
  [[484.0, 468.0], [587.5, 468.0]],
  [[376.5, 537.6], [664.5, 537.6]],  // the south avenue
  [[378.9, 539.0], [379.7, 618.5]],
  [[198.5, 478.0], [486.0, 478.0]],
  [[587.5, 396.3], [587.5, 412.8]],  // the stub into the Diner's lot
  [[405.5, 536.4], [406.6, 476.8]],
  [[168.3, 446.6], [199.7, 478.0]],  // the bend round the inlet
  [[168.3, 447.7], [169.7, 395.5]],
  [[342.4, 396.3], [342.4, 549.3]],
  [[288.0, 574.8], [378.7, 574.8]],
  [[198.5, 549.8], [377.0, 549.8]],
  [[199.3, 508.4], [289.5, 508.4]],  // the drive-thru loop
  [[199.8, 506.7], [199.8, 551.7]],
  [[329.2, 617.0], [560.3, 617.0]],  // the beach road
  [[664.5, 396.2], [664.5, 538.5]],
  [[559.7, 341.3], [637.4, 341.3]],  // the loop round the Police Station
  [[637.4, 339.1], [637.4, 396.3]],
  [[55.7, 394.5], [55.7, 553.2]],    // the west block
  [[54.9, 554.4], [171.0, 446.5]],
  [[104.3, 395.5], [104.3, 508.3]],
  [[144.8, 396.3], [144.8, 470.8]],
  [[54.9, 433.1], [167.1, 433.1]],
  [[56.8, 478.0], [136.6, 478.0]],
  [[55.0, 506.6], [107.1, 506.6]],
];

// the north was empty on the map: a grid of streets goes over it (clipped to the land)
export const NORTH_X = [130, 210, 290, 370, 450, 560.3, 640, 720, 800, 880];
export const NORTH_Y = [280, 215, 150, 85, 30];
export const NORTH_LINKS = [[130, 280, 396.3], [720, 280, 396.3]]; // (down to the north avenue)

// buildings and places: [label, kind, x0, y0, x1, y1, extra]
export const PLACES = [
  // the west block
  ['Game Shop', 'shop', 59.7, 401.1, 100.3, 428.3, { floors: 2, style: 'stucco' }],
  ['Home Improvements', 'shop', 109.3, 400.5, 139.8, 429.0, { floors: 2, style: 'concrete' }],
  ['Cheap House', 'shop', 148.7, 400.5, 167.1, 429.0, { floors: 2, style: 'brick' }],
  ["Putin's Ritz", 'ritz', 59.7, 437.9, 100.3, 472.1, {}],
  ['Home Improvements', 'shop', 108.3, 438.5, 138.8, 469.9, { floors: 1, style: 'concrete' }],
  ['The Plot', 'plot', 147.3, 437.2, 165.8, 450.6, {}],
  ['City Wok', 'shop', 59.7, 483.7, 99.2, 500.1, { floors: 2, style: 'stucco' }],
  ['Shitty Wok', 'triangle', 0, 0, 0, 0, { pts: [[107.4, 480.7], [127.9, 480.7], [107.4, 500.1]], floors: 2 }],
  ['Triangle and Co.', 'triangle', 0, 0, 0, 0, { pts: [[59.4, 510.3], [97.2, 510.3], [59.4, 546.1]], floors: 3 }],
  // north of the north avenue
  ['Hospital', 'hospital', 163.5, 352.9, 228.1, 393.4, {}],
  ['Skatepark', 'skatepark', 233.6, 307.0, 341.4, 359.2, {}],
  ['the park', 'park', 233.6, 362.1, 341.4, 393.5, {}],
  ['Playground', 'playground', 284.1, 366.9, 334.9, 388.7, {}],
  ['the fountain', 'fountain', 362.2, 366.5, 378.0, 385.3, {}],
  ['Nightclub', 'nightclub', 343.2, 321.2, 433.2, 355.4, {}],
  ["Paul Badfella, Law Firm", 'lawfirm', 435.1, 319.9, 501.7, 354.1, {}],
  ['Bourke Office High Rise', 'tower', 503.6, 290.7, 537.8, 357.3, { floors: 18 }],
  ['Coffee Store', 'coffee', 392.8, 356.4, 459.4, 390.6, {}],
  ['Graces Flowers', 'flowers', 468.0, 357.3, 534.6, 391.5, {}],
  ['the little park', 'park', 539.5, 367.8, 555.4, 389.6, {}],
  ['Police Station', 'police', 565.2, 347.3, 629.8, 387.8, {}],
  // downtown
  ['A Rival Mini Mart', 'shop', 228.2, 407.4, 268.9, 441.6, { floors: 1, style: 'concrete', sign: 'RIVAL MINI MART' }],
  ['Indoor Pool', 'pool', 297.9, 407.4, 338.5, 441.6, {}],
  ['Random Storefronts', 'storefronts', 216.5, 446.2, 338.5, 473.4, {}],
  ['Mini Mart', 'shop', 345.3, 407.4, 386.0, 441.6, { floors: 1, style: 'stucco', sign: 'MINI MART' }],
  ['Halyard Arms', 'shop', 345.3, 446.2, 386.0, 473.4, { floors: 1, style: 'concrete', sign: 'HALYARD ARMS · GUNS · AMMO' }],
  ['Town Square', 'square', 388.3, 409.1, 473.8, 470.1, {}],
  ['Pawn Shop', 'shop', 497.0, 404.8, 533.4, 460.4, { floors: 2, style: 'brick', sign: 'PAWN SHOP' }],
  ['Grocery', 'shop', 538.9, 407.2, 554.8, 462.8, { floors: 1, style: 'stucco', sign: 'GROCERY' }],
  ['Parking Lot', 'lot', 571.7, 411.9, 612.3, 532.4, {}],
  ['the Diner', 'diner', 612.3, 404.8, 648.7, 534.9, {}],
  ["Rusty's Parking", 'lot', 673.5, 381.3, 709.8, 415.5, {}],
  // south of the middle road
  ['Spa', 'shop', 344.5, 487.6, 403.5, 528.1, { floors: 2, style: 'stucco', sign: 'SPA', wall: 4 }],
  ['Fairview Heights', 'home', 413.4, 482.6, 480.0, 533.1, {}],
  ['Convenience Store', 'shop', 496.2, 473.7, 549.9, 524.2, { floors: 1, style: 'concrete', sign: 'CONVENIENCE STORE' }],
  ['the construction site', 'construction', 389.4, 542.5, 547.9, 610.0, {}],
  ['the abandoned car park', 'abandoned', 568.2, 546.6, 621.9, 597.1, {}],
  ['Albuquerque Boiled Turkey', 'turkey', 209.6, 513.4, 276.2, 544.8, {}],
  ['ABT Parking Lot', 'lot', 290.1, 506.9, 330.8, 553.2, {}],
  ['the bushes', 'hedge', 266.0, 555.1, 366.3, 571.1, {}],
  ['Washrooms', 'beachblock', 200.3, 578.0, 281.8, 616.0, { sign: 'WASHROOMS · SHOWERS · CHANGE ROOMS' }],
  ['Parking Lot', 'lot', 288.0, 574.8, 328.6, 621.0, {}],
  ['Reception', 'beachblock', 331.2, 578.9, 376.3, 607.4, { sign: 'BEACH RECEPTION' }],
  ['the Sewer entrance', 'sewer', 188, 424, 202, 436, {}],
];
