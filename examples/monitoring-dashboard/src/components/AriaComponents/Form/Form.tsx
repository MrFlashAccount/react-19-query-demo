/** @file Form component. */
import * as React from "react";

import * as aria from "@/components/aria";

import { useEvent } from "@/hooks/useEvent";
import type { RefProp } from "@/components/AriaComponents/types";
import * as dialog from "../Dialog";
import * as components from "./components";
import * as styles from "./styles";
import type * as types from "./types";

/**
 * Form component. It wraps a `form` and provides form context.
 * It also handles form submission.
 * Provides better error handling and form state management and better UX out of the box.
 */
export function Form<Schema extends components.TSchema, SubmitResult = void>(
  props: types.FormProps<Schema, SubmitResult> & RefProp<HTMLFormElement>,
): React.JSX.Element {
  /** Input values for this form. */
  type FieldValues = components.FieldValues<Schema>;
  const formId = React.useId();

  const {
    children,
    formRef,
    form,
    formOptions,
    className,
    style,
    onSubmitted = () => {},
    onSubmitSuccess = () => {},
    onSubmitFailed = () => {},
    id = formId,
    schema,
    defaultValues,
    gap,
    method,
    canSubmitOffline = false,
    testId,
    ref: forwardedRef,
    ...formProps
  } = props;

  const dialogContext = dialog.useDialogContext();

  const onSubmit = useEvent(
    async (
      fieldValues: types.TransformedValues<Schema>,
      formInstance: types.UseFormReturn<Schema>,
    ) => {
      const result = (await props.onSubmit?.(fieldValues, formInstance)) as SubmitResult;

      if (method === "dialog") {
        dialogContext?.close();
      }

      return result;
    },
  );

  const innerForm = components.useForm<Schema, SubmitResult>(
    form ?? {
      ...formOptions,
      ...(defaultValues ? { defaultValues } : {}),
      schema,
      canSubmitOffline,
      onSubmit,
      onSubmitFailed,
      onSubmitSuccess,
      onSubmitted,
      shouldFocusError: true,
      debugName: `Form ${testId} id: ${id}`,
    },
  );

  React.useImperativeHandle(formRef, () => innerForm, [innerForm]);
  React.useImperativeHandle(form?.closeRef, () => dialogContext?.close ?? (() => {}), [
    dialogContext?.close,
  ]);

  const base = styles.FORM_STYLES({
    className: typeof className === "function" ? className(innerForm) : className,
    gap,
  });

  const { formState } = innerForm;

  // eslint-disable-next-line no-restricted-syntax
  const errors = Object.fromEntries(
    Object.entries(formState.errors).map(([key, error]) => {
      const message = error?.message ?? "Something went wrong.";
      return [key, message];
    }),
  ) as Record<keyof FieldValues, string>;

  return (
    <form
      {...formProps}
      id={id}
      ref={forwardedRef}
      className={base}
      style={typeof style === "function" ? style(innerForm) : style}
      noValidate
      data-testid={testId}
      onSubmit={innerForm.submit}
    >
      <aria.FormValidationContext.Provider value={errors}>
        <components.FormProvider form={innerForm}>
          {typeof children === "function" ? children({ ...innerForm, form: innerForm }) : children}
        </components.FormProvider>
      </aria.FormValidationContext.Provider>
    </form>
  );
}

Form.schema = components.schema;
Form.useForm = components.useForm;
Form.useField = components.useField;
Form.makeUseField = components.makeUseField;
Form.useFormSchema = components.useFormSchema;
Form.Submit = components.Submit;
Form.Reset = components.Reset;
Form.FormError = components.FormError;
Form.FieldValue = components.FieldValue;
Form.FieldError = components.FieldError;
Form.useFormContext = components.useFormContext;
Form.useOptionalFormContext = components.useOptionalFormContext;
Form.Field = components.Field;
Form.Controller = components.Controller;
Form.Provider = components.FormProvider;
Form.useWatch = components.useWatch;
Form.useFieldRegister = components.useFieldRegister;
Form.useFieldState = components.useFieldState;
Form.useFormError = components.useFormError;

Form.FIELD_STYLES = components.FIELD_STYLES;
