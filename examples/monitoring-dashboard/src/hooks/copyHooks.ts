/**
 * @file
 *
 * A hook for copying text to the clipboard.
 */

import * as React from "react";

import { useEvent } from "./useEvent";

/** Props for the useCopy hook. */
export interface UseCopyProps {
  readonly onCopy?: (() => void) | undefined;
  readonly successToastMessage?: boolean | string;
}

const DEFAULT_TIMEOUT = 2000;

/** A hook for copying text to the clipboard. */
export function useCopy(props: UseCopyProps = {}) {
  const { onCopy } = props;

  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isError, setIsError] = React.useState(false);
  const [isCopying, startCopy] = React.useTransition();

  const copy = useEvent((text: string) => {
    startCopy(() =>
      navigator.clipboard
        .writeText(text)
        .then(async () => {
          onCopy?.();
          setIsSuccess(true);
          await new Promise((resolve) => setTimeout(resolve, DEFAULT_TIMEOUT));
          setIsSuccess(false);
        })
        .catch(async (error) => {
          // TODO: Handle error
          setIsError(true);
          await new Promise((resolve) => setTimeout(resolve, DEFAULT_TIMEOUT));
          setIsError(false);
        }),
    );
  });

  return { isSuccess, isError, isCopying, copy };
}
