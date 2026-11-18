// Screenshot staging: place the player / cars / police for each ?shot= kind.
// Rules baked in from two verified builds:
//  - stageShot moves the staged car onto the road under the player before entering it.
//  - the police roadblock goes AHEAD (+Z, direction of travel) with hold=true.
//  - the drive shot faces north along road x=56 (not east into a block).
//  - the mission shot is taken from (164, 22) facing the golden car at (172, 28)
//    so the camera clears the (140, 28) warehouse.
//  - staged cars are painted bright red / gold via paintMat.
import { CARS } from './config.js';

export function stageShot(game, kind) {
  const w = game.world;
  const setCar = (car, x, z, heading, paint) => {
    car.x = x; car.z = z; car.heading = heading;
    car.speed = 0;
    car.mesh.position.set(x, 0, z);
    car.mesh.rotation.y = heading;
    if (paint !== undefined) car.setPaint(paint);
  };
  const putPlayerIn = (car) => {
    game.enterCar(car, true);
    game.player.yaw = car.heading;
  };
  if (kind === 'start') {
    // start screen: keep the player on foot at spawn, camera high over the city
    game.state = 'menu';
    game.camMode = 'aerial';
    return;
  }
  game.state = 'playing';
  game.camMode = 'chase';
  if (kind === 'foot') {
    game.exitCar(true);
    game.player.x = 0; game.player.z = 20;
    game.player.heading = Math.PI;
    game.player.yaw = Math.PI;
    game.player.mesh.position.set(0, 0, 20);
    game.player.mesh.rotation.y = Math.PI;
    game.missions.idx = 0; game.missions.step = 0;
    game.wanted.clear();
    return;
  }
  if (kind === 'drive') {
    // face north along road x=56
    const car = game.parked[0] || game.traffic.cars[0];
    setCar(car, 56, 40, Math.PI, 0xd4a017); // gold, heading north (-z)
    putPlayerIn(car);
    car.speed = 16;
    game.missions.idx = 0; game.missions.step = 1; // "Drive to the hideout"
    game.wanted.clear();
    return;
  }
  if (kind === 'chase') {
    // player driving north on x=56, police roadblock AHEAD (+Z is behind when
    // facing north, so the roadblock goes ahead in the direction of travel:
    // ahead = -z here, i.e. further along -z from the player)
    const car = game.parked[1] || game.parked[0];
    setCar(car, 56, 60, Math.PI, 0x8a1f1f); // bright red
    putPlayerIn(car);
    car.speed = 18;
    game.missions.idx = 0; game.missions.step = 1;
    game.wanted.set(3);
    // roadblock ahead of the player (further north, -z), cars facing the player
    game.police.stageRoadblock(56, 60 - 26, Math.PI, 3);
    return;
  }
  if (kind === 'mission') {
    // golden car at the harbor; camera from (164,22) facing it at (172,28)
    const gold = game.goldenCar;
    setCar(gold, 172, 28, Math.PI * 0.75, 0xd4a017);
    game.exitCar(true);
    game.player.x = 164; game.player.z = 22;
    game.player.heading = Math.atan2(172 - 164, 28 - 22);
    game.player.yaw = game.player.heading;
    game.player.mesh.position.set(164, 0, 22);
    game.player.mesh.rotation.y = game.player.heading;
    game.missions.idx = 4; game.missions.step = 1; // "Steal the golden Manta"
    game.missions._setMarker();
    // No police in this shot: a pursuit car would drive up to the player and
    // block the golden car. The mission title + objective carry the context.
    game.wanted.set(0);
    game.police.clearAll();
    game.camMode = 'mission';
    return;
  }
  if (kind === 'play') {
    game.exitCar(true);
    game.player.x = 0; game.player.z = 20;
    game.player.heading = Math.PI; game.player.yaw = Math.PI;
    game.missions.idx = 0; game.missions.step = 0;
    game.wanted.clear();
    return;
  }
  if (kind === 'end') {
    game.state = 'ended';
    game.money = 4700;
    return;
  }
  // default: on foot at spawn
  game.exitCar(true);
  game.missions.idx = 0; game.missions.step = 0;
}
