/** @file Catches errors in child components. */
import Offline from "@/assets/offline_filled.svg";
import * as React from "react";

import * as errorBoundary from "react-error-boundary";

import { Alert, Button, Separator, Text, type SvgUseIcon } from "@/components/AriaComponents";
import { useEvent } from "@/hooks/useEvent";
import * as errorUtils from "@/utilities/error";
import { OfflineError } from "@/utilities/HttpClient";
import type { FallbackProps } from "react-error-boundary";
import { Icon } from "./Icon";
import SvgMask from "./SvgMask";
import type { ResultProps } from "./Result";
import { Result } from "./Result";

/** Arguments for the {@link ErrorBoundaryProps.onBeforeFallbackShown} callback. */
export interface OnBeforeFallbackShownArgs {
  readonly error: unknown;
  readonly resetErrorBoundary: () => void;
}

/** Props for an {@link ErrorBoundary}. */
export interface ErrorBoundaryProps extends Readonly<React.PropsWithChildren> {
  /** Keys to reset the error boundary. Use it to declaratively reset the error boundary. */
  readonly resetKeys?: errorBoundary.ErrorBoundaryProps["resetKeys"] | undefined;
  /** Fallback component to show when there is an error. */
  // This is a Component, and supposed to be capitalized according to the react conventions.
  // eslint-disable-next-line @typescript-eslint/naming-convention
  readonly FallbackComponent?: React.ComponentType<FallbackProps> | undefined;
  /** Called when there is an error. */
  readonly onError?: errorBoundary.ErrorBoundaryProps["onError"] | undefined;
  /** Called when the error boundary is reset. */
  readonly onReset?: errorBoundary.ErrorBoundaryProps["onReset"] | undefined;
  /**
   * Called before the fallback is shown, can return a React node to render instead of the fallback.
   * Alternatively, you can use the error boundary api to reset the error boundary based on the error.
   */
  readonly onBeforeFallbackShown?:
    | ((args: OnBeforeFallbackShownArgs) => React.ReactNode | null | undefined)
    | undefined;
  /** Title to show when there is an error. */
  readonly title?: string | undefined;
  /** Subtitle to show when there is an error. */
  readonly subtitle?: string | undefined;
}

/**
 * Catches errors in child components
 * Shows a fallback UI when there is an error.
 * The error can also be logged to an error reporting service.
 */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  const {
    FallbackComponent = ErrorDisplay,
    onError = () => {},
    onReset = () => {},
    onBeforeFallbackShown = () => null,
    title,
    subtitle,
    resetKeys,
    ...rest
  } = props;

  return (
    <errorBoundary.ErrorBoundary
      {...(resetKeys != null ? { resetKeys } : {})}
      FallbackComponent={(fallbackProps) => {
        const displayMessage = errorUtils.extractDisplayMessage(fallbackProps.error);

        return (
          <FallbackComponent
            {...fallbackProps}
            onBeforeFallbackShown={onBeforeFallbackShown}
            title={title}
            subtitle={subtitle ?? displayMessage ?? null}
          />
        );
      }}
      onError={(error, info) => {
        onError(error, info);
      }}
      onReset={(details) => {
        onReset(details);
      }}
      {...rest}
    />
  );
}

/** Props for a {@link ErrorDisplay}. */
export interface ErrorDisplayProps extends errorBoundary.FallbackProps {
  readonly status?: ResultProps["status"];
  readonly onBeforeFallbackShown?: (args: OnBeforeFallbackShownArgs) => React.ReactNode | undefined;
  readonly title?: string | null | undefined;
  readonly subtitle?: string | null | undefined;
  readonly error: unknown;
}

/** Default fallback component to show when there is an error. */
export function ErrorDisplay(props: ErrorDisplayProps): React.JSX.Element {
  const {
    error,
    resetErrorBoundary,
    title,
    subtitle,
    status,
    onBeforeFallbackShown = () => null,
  } = props;

  const isOfflineError = error instanceof OfflineError;

  const message = errorUtils.getMessageOrToString(error);
  const stack = errorUtils.tryGetStack(error);

  const render = onBeforeFallbackShown({ error, resetErrorBoundary });

  const onReset = useEvent(() => {
    resetErrorBoundary();
  });

  const finalTitle = title ?? "Something went wrong";
  const finalSubtitle = subtitle ?? (isOfflineError ? "Offline error" : "Something went wrong");
  const finalStatus =
    status ?? (isOfflineError ? <SvgMask src={Offline} className="aspect-square w-6" /> : "error");

  const defaultRender = (
    <Result
      className="h-full"
      status={finalStatus}
      title={finalTitle}
      subtitle={finalSubtitle}
      testId="error-display"
    >
      <Button.Group align="center">
        <Button variant="submit" size="small" rounded="full" className="w-24" onPress={onReset}>
          Try again
        </Button>
      </Button.Group>

      {stack != null && (
        <div className="mt-6">
          <Separator className="my-2" />

          <Text color="primary" variant="h1" className="text-start">
            Developer info
          </Text>

          <Text color="danger" variant="body">
            Error:
            {message}
          </Text>

          <Alert
            className="mx-auto mt-2 max-h-[80vh] max-w-(--breakpoint-lg) overflow-auto"
            variant="neutral"
          >
            <Text
              elementType="pre"
              className="whitespace-pre-wrap text-left"
              color="primary"
              variant="body"
            >
              {stack}
            </Text>
          </Alert>
        </div>
      )}
    </Result>
  );

  return <>{render ?? defaultRender}</>;
}

/** Props for an {@link InlineErrorDisplay}. */
export interface InlineErrorDisplayProps extends Omit<ErrorDisplayProps, "status" | "subtitle"> {}

/** Displays an error inline. */
export function InlineErrorDisplay(props: InlineErrorDisplayProps) {
  const { error, resetErrorBoundary, onBeforeFallbackShown = () => null, title } = props;

  const render = onBeforeFallbackShown({ error, resetErrorBoundary });

  const onReset = useEvent(() => {
    resetErrorBoundary();
  });

  const finalTitle = title ?? "Something went wrong";
  const finalIcon: SvgUseIcon = "error";

  const defaultRender = (
    <div className="flex items-center gap-1">
      <Icon icon={finalIcon} />
      <Text>{finalTitle}</Text>
      <Button variant="outline" size="xsmall" onPress={onReset} className="ml-3">
        Try again
      </Button>
    </div>
  );

  return <>{render ?? defaultRender}</>;
}

// eslint-disable-next-line react-refresh/only-export-components
export { useErrorBoundary, withErrorBoundary } from "react-error-boundary";
