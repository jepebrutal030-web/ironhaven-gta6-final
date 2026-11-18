// IRONHAVEN — config: city, districts, missions, cars, weapons, tuning.
export const CITY = {
  half: 196,            // city spans -196..196 in x and z (392 m)
  pitch: 56,            // road grid pitch
  roadHalf: 7,          // drivable road half-width
  roadAxes: [-168, -112, -56, 0, 56, 112, 168],
  block: 42,            // building block width between roads
};
export const SPAWN = { x: 0, z: -8, heading: Math.PI }; // on road x=0, facing north (-z)
export const PLACES = {
  hideout: { x: -56, z: -140, name: 'Hideout' },
  mara: { x: 112, z: 56, name: "Mara's Corner" },
  dropoff: { x: 56, z: -56, name: 'Drop-off' },
  stash: { x: -112, z: 112, name: 'Stash House' },
  shop: { x: 0, z: 112, name: "Vito's Shop" },
  harbor: { x: 172, z: 28, name: 'Harbor Docks' },
  warehouse: { x: 140, z: 28, name: 'Warehouse' },
  goldenCar: { x: 172, z: 28, name: 'Golden Manta' },
};
export const MISSIONS = [
  { id: 1, name: 'Homecoming', pay: 300, steps: [
    { kind: 'steal', text: 'Steal a car — any car. Walk up to one and press E.' },
    { kind: 'goto', at: 'hideout', text: 'Drive to the hideout.' },
  ]},
  { id: 2, name: 'Pickup', pay: 500, steps: [
    { kind: 'goto', at: 'mara', text: 'Drive to Mara and pick her up.' },
    { kind: 'pickup', at: 'mara', text: 'Mara is getting in. Wait for her.' },
    { kind: 'goto', at: 'dropoff', text: 'Drive Mara to the drop-off.' },
  ]},
  { id: 3, name: 'Getaway', pay: 700, timed: 100, steps: [
    { kind: 'goto', at: 'stash', text: 'Get to the stash house before the clock runs out. Cops are coming.' },
  ]},
  { id: 4, name: 'Shakedown', pay: 1000, steps: [
    { kind: 'goto', at: 'shop', text: "Drive to Vito's shop." },
    { kind: 'collect', at: 'shop', text: 'Hold E to collect the protection money.' },
    { kind: 'goto', at: 'hideout', text: 'Bring the money back to the hideout.' },
  ]},
  { id: 5, name: 'Harbor Job', pay: 1500, steps: [
    { kind: 'goto', at: 'harbor', text: 'Get to the harbor docks.' },
    { kind: 'steal', at: 'harbor', text: 'Steal the golden Manta. Press E near it.' },
    { kind: 'goto', at: 'hideout', text: 'Lose the heat and bring the Manta to the hideout.' },
  ]},
];
export const CARS = [
  { key: 'comet',   name: 'Comet',      type: 'sedan',  len: 4.4, wid: 1.9, h: 1.35, top: 0.55, color: 0x8a1f1f, accel: 11, max: 34, grip: 1.0 },
  { key: 'falcon',  name: 'Falcon',     type: 'coupe',  len: 4.2, wid: 1.85, h: 1.25, top: 0.5, color: 0x2b4a7a, accel: 12, max: 37, grip: 1.05 },
  { key: 'rhino',   name: 'Rhino',      type: 'suv',    len: 4.8, wid: 2.0, h: 1.8, top: 0.85, color: 0x3a3f45, accel: 9.5, max: 31, grip: 0.95 },
  { key: 'mule',    name: 'Mule',       type: 'pickup', len: 5.0, wid: 1.95, h: 1.6, top: 0.6, color: 0x5a4a2e, accel: 9, max: 30, grip: 0.95 },
  { key: 'hauler',  name: 'Hauler',     type: 'van',    len: 5.2, wid: 2.0, h: 2.1, top: 1.1, color: 0x6b7280, accel: 8, max: 28, grip: 0.9 },
  { key: 'vortex',  name: 'Vortex',     type: 'sport',  len: 4.0, wid: 1.9, h: 1.15, top: 0.45, color: 0xd4a017, accel: 14, max: 42, grip: 1.1 },
  { key: 'cab',     name: 'Cab',        type: 'taxi',   len: 4.4, wid: 1.9, h: 1.4, top: 0.55, color: 0xeab308, accel: 10, max: 32, grip: 1.0 },
  { key: 'cop',     name: 'Interceptor', type: 'police', len: 4.6, wid: 1.95, h: 1.4, top: 0.55, color: 0x111827, accel: 13, max: 40, grip: 1.1 },
];
export const WEAPONS = [
  { key: 'pistol', name: 'PISTOL', dmg: 25, rate: 4, mag: 12, reserve: 48, auto: false, spread: 0.012, pellets: 1 },
  { key: 'smg',    name: 'SMG',    dmg: 12, rate: 10, mag: 30, reserve: 120, auto: true, spread: 0.03, pellets: 1 },
  { key: 'shotgun',name: 'SHOTGUN',dmg: 9, rate: 1.2, mag: 6, reserve: 24, auto: false, spread: 0.07, pellets: 6 },
];
export const TUNE = {
  walkSpeed: 5.2, sprintSpeed: 8.5, jumpVel: 6.5, gravity: 18,
  playerRadius: 0.45, carEnterDist: 3.2, pedRadius: 0.45,
  wantedDecay: 0.05, // per second when no crime
  copCarSpeed: [0, 30, 34, 38, 42, 46], // by wanted level
  copSpawnDist: 60, maxCopCars: 5, maxFootCops: 4,
  trafficCount: 22, pedCount: 36, parkedCount: 14,
  doorCloseTime: 0.25, // seconds of game time before a car door closes
  saveKey: 'ironhaven-save-v1',
  musicBpm: 100,
};
