import { defineStore } from 'pinia'
import { readonly, shallowRef } from 'vue'
import { dispatch as dispatchCommand, type Command } from '../sim/commands'
import { createState, type GameState } from '../sim/state'
import { pickSeed } from './seed'

let startWith: GameState | null = null

// main.ts sets the start state before the first useGameStore call. null gives a new world.
export function setStartState(state: GameState | null) {
  startWith = state
}

// The HUD reads the sim state here. It changes the state only through commands.
export const useGameStore = defineStore('game', () => {
  const snapshot = shallowRef(startWith ?? createState(pickSeed(location.search)))

  // Only the game loop calls this.
  function replace(next: GameState) {
    snapshot.value = next
  }

  function dispatch(command: Command) {
    snapshot.value = dispatchCommand(snapshot.value, command)
  }

  return { state: readonly(snapshot), replace, dispatch }
})
