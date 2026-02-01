/**
 * @file
 *
 * Submit button for forms.
 * Manages the form state and displays a loading spinner when the form is submitting.
 */
import type { JSX } from "react";

import { Button, type ButtonProps } from "@/components/AriaComponents";
import { useFormContext } from "./FormProvider";
import type { AnyFormInstance } from "./types";

/** Additional props for the Submit component. */
interface SubmitButtonBaseProps<IconType extends string> {
  readonly variant?: ButtonProps<IconType>["variant"];
  /**
   * Connects the submit button to a form.
   * If not provided, the button will use the nearest form context.
   *
   * This field is helpful when you need to use the submit button outside of the form.
   */
  readonly form?: AnyFormInstance;
  readonly cancel?: boolean;
}

/** Props for the Submit component. */
export type SubmitProps<IconType extends string> = Omit<
  ButtonProps<IconType>,
  "formnovalidate" | "href" | "variant" | "children"
> &
  SubmitButtonBaseProps<IconType> & {
    children?: React.ReactNode | ((props: { isSubmitting: boolean }) => React.ReactNode);
  };

/**
 * Submit button for forms.
 *
 * Manages the form state and displays a loading spinner when the form is submitting.
 */
export function Submit<IconType extends string>(props: SubmitProps<IconType>): JSX.Element {
  const {
    size = "medium",
    isLoading = false,
    children = "Submit",
    variant = "submit",
    testId = "form-submit-button",
    ...buttonProps
  } = props;

  const form = useFormContext(props.form);
  const { formState } = form;

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      isLoading={isLoading || formState.isSubmitting}
      testId={testId}
      {...(buttonProps as any)}
    >
      {typeof children === "function"
        ? children({ isSubmitting: formState.isSubmitting })
        : children}
    </Button>
  );
}
