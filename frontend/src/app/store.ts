import { configureStore } from '@reduxjs/toolkit';
import deviationReducer from '../features/deviation/deviationSlice';

export const store = configureStore({
  reducer: {
    deviation: deviationReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // File objects live only in component state, not in the store.
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
