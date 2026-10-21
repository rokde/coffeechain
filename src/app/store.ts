import { defineStore } from 'pinia'
import { readonly, shallowRef } from 'vue'
import { dispatch as dispatchCommand, type Command } from '../sim/commands'
import { createState, type GameState } from '../sim/state'
import { reasons, useBookingsStore } from './bookings'
import { pickSeed } from './seed'

let startWith: GameState | null = null

// main.ts sets the start state before the first useGameStore call. null gives a new world.
export function setStartState(state: GameState | null) {
  startWith = state
}

// The HUD reads the sim state here. It changes the state only through commands.
export const useGameStore = defineStore('game', () => {
  const snapshot = shallowRef(startWith ?? createState(pickSeed(location.search)))
  const bookings = useBookingsStore()

  // Only the game loop calls this.
  function replace(next: GameState) {
    // The daily storage cost is the only money change in a tick.
    const delta = next.money - snapshot.value.money
    snapshot.value = next
    if (delta) bookings.book('tick', delta)
  }

  function dispatch(command: Command) {
    const before = snapshot.value.money
    snapshot.value = dispatchCommand(snapshot.value, command)
    const delta = snapshot.value.money - before
    const reason = reasons[command.type]
    if (delta && reason) bookings.book(reason, delta)
  }

  return { state: readonly(snapshot), replace, dispatch }
})
