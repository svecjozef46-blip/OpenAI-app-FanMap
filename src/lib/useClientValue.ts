"use client";

import { useSyncExternalStore } from "react";

// For a value that only exists/differs in the browser (window, navigator,
// ...) and must therefore start out as `serverValue` during SSR and the
// client's first paint, then switch to the real value right after. This is
// the pattern React's own docs recommend for exactly this case — see
// https://react.dev/reference/react/useSyncExternalStore — used here for
// values that don't change again after mount, so `subscribe` is a no-op.
//
// Using this instead of `useState` + `useEffect(() => setX(...), [])`
// matters beyond style: the eslint-plugin-react-hooks `set-state-in-effect`
// rule (correctly) flags the useState version as a cascading-render smell,
// because in the general case it usually is one. useSyncExternalStore is
// the version of this pattern that rule doesn't flag, because it's built
// for exactly this.
export function useClientValue<T>(getClientValue: () => T, serverValue: T): T {
  return useSyncExternalStore(
    () => () => {},
    getClientValue,
    () => serverValue
  );
}
