import { createContext as createReactContext, useContext as useReactContext } from "react";

export function createContext<T>(value: T, name: string) {
  const context = createReactContext<T>(value);
  context.displayName = name;

  const useContext = () => useReactContext(context);

  const useStrictContext = () => {
    const context = useContext();

    if (context == null) {
      throw new Error(`useContext(${name}) must be used within a Provider${name}`);
    }

    return context;
  };

  return [context, useStrictContext, useContext] as const;
}
