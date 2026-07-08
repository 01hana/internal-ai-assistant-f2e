import { shallowRef, type ShallowRef } from "vue";

type StateInstance<TState> = [
  ShallowRef<TState>,
  (nextState: TState) => void,
];

export function useAppState<TState>(
  initialState: TState,
): StateInstance<TState> {
  const state = shallowRef(initialState) as ShallowRef<TState>;

  function update(nextState: TState) {
    state.value = nextState;
  }

  return [state, update];
}
