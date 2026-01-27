/**
 * @file
 * Hook for merging props with context values
 */
import { mergeRefs } from "@/utilities/mergeRefs";
import { useContext, type Context, type ForwardedRef, type Ref } from "react";
import { mergeProps } from "../aria";

/**
 * Merges props with context values
 */
export function useContextProps<
  T extends object,
  E extends Element,
  C extends (Partial<T> & { ref?: Ref<E | null> }) | null,
>(
  props: T,
  ref: ForwardedRef<E> | Ref<E> | null,
  context: Context<C>,
): [props: T, ref: Ref<E | null>] {
  const contextValue = useContext(context);
  let localRef = ref ?? (("ref" in props ? props.ref : null) as Ref<E | null> | null);

  if (contextValue == null) {
    return [props, localRef];
  }

  // This is safe, as `props` is an intersection of `T` and another type.
  // eslint-disable-next-line no-restricted-syntax
  return [mergeProps<object>()(props, contextValue) as T, mergeRefs(localRef, contextValue.ref)];
}
