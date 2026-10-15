import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import deviationReducer, {
  initialState,
  type DeviationState,
} from '../features/deviation/deviationSlice';

export function makeStore(preloaded?: Partial<DeviationState>) {
  return configureStore({
    reducer: { deviation: deviationReducer },
    preloadedState: { deviation: { ...initialState, ...preloaded } },
  });
}

export type TestStore = ReturnType<typeof makeStore>;

export function renderWithProviders(
  ui: ReactElement,
  options: { store?: TestStore; route?: string } = {},
) {
  const store = options.store ?? makeStore();
  return {
    store,
    ...render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[options.route ?? '/']}>{ui}</MemoryRouter>
      </Provider>,
    ),
  };
}
