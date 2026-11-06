import { load, save } from '../lib/storage';

// The rooms this player has joined, and the one they are playing for now, kept in this browser.
// The server keeps the membership itself (supabase/migrations/…_rooms.sql).

export interface RoomRef { code: string; name: string; level: number }

export const myRooms = () => load<RoomRef[]>('rooms', []);
export const activeRoom = () => load<RoomRef | null>('room', null);
const changed = () => window.dispatchEvent(new Event('ftd-room'));

export function rememberRoom(r: RoomRef, active = true) {
  save('rooms', [r, ...myRooms().filter((x) => x.code !== r.code)].slice(0, 20));
  if (active) save('room', r);
  changed();
}
export function forgetRoom(code: string) {
  save('rooms', myRooms().filter((x) => x.code !== code));
  if (activeRoom()?.code === code) save('room', null);
  changed();
}
export function setActiveRoom(r: RoomRef | null) { save('room', r); changed(); }
