// IRONHAVEN — boot. Wires the Game to the page and exposes window.IRONHAVEN.
import { Game } from './game.js';

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const seed = parseInt(params.get('seed') || '1', 10) || 1;

const canvas = document.getElementById('game-canvas');
const game = new Game(canvas, document, { shot, seed });

// window.IRONHAVEN API (used by the test harness and the screenshots):
// state/teleport/setWanted/aimAt/shoot/startMission/save,
// plus game { player, playerCar, parked, peds, wanted, missions }.
window.IRONHAVEN = {
  ready: true,
  state: () => game.apiState(),
  teleport: (x, z) => game.apiTeleport(x, z),
  setWanted: (n) => game.apiSetWanted(n),
  aimAt: (x, y, z) => game.apiAimAt(x, y, z),
  shoot: () => game.apiShoot(),
  startMission: (n) => game.apiStartMission(n),
  save: () => game.apiSave(),
  game: {
    get player() { return game.player; },
    get playerCar() { return game.playerCar; },
    get parked() { return game.parked; },
    get peds() { return game.peds; },
    get wanted() { return game.wanted; },
    get missions() { return game.missions; },
    get police() { return game.police; },
    get traffic() { return game.traffic; },
    get weapons() { return game.weapons; },
    get goldenCar() { return game.goldenCar; },
    get renderer() { return game.renderer; },
  },
};

game.start();
