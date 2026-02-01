/**
 * @file
 *
 * A hook that returns a form instance.
 */
import * as React from "react";

import * as zodResolver from "@hookform/resolvers/zod";
import * as reactHookForm from "react-hook-form";
import invariant from "tiny-invariant";

import { useEvent } from "@/hooks/useEvent";
import { useOffline, useOfflineChange } from "@/hooks/offlineHooks";
import * as errorUtils from "@/utilities/error";
import * as schemaModule from "./schema";
import type * as types from "./types";
import { useUnmount } from "../../../../hooks/unmountHooks";

function getText(key: string, ...args: string[]) {
  switch (key) {
    case "arbitraryFieldRequired":
      return "Required.";
    case "arbitraryFieldTooSmall":
      return `Must be at least ${args[0] ?? "1"}.`;
    case "arbitraryFieldTooLarge":
      return `Must be at most ${args[0] ?? ""}.`;
    case "arbitraryFieldInvalid":
      return "Invalid value.";
    case "invalidEmailValidationError":
      return "Invalid email address.";
    case "arbitraryFormErrorMessage":
      return "Something went wrong.";
    case "unavailableOffline":
      return "Unavailable while offline.";
    default:
      return args.length > 0 ? `${key} ${args.join(" ")}` : key;
  }
}

/** Maps the value to the event object. */
function mapValueOnEvent(value: unknown) {
  if (typeof value === "object" && value != null && "target" in value && "type" in value) {
    return value;
  } else {
    return { target: { value } };
  }
}

/**
 * A hook that returns a form instance.
 * @param optionsOrFormInstance - Either form options or a form instance
 *
 * If form instance is passed, it will be returned as is.
 *
 * If form options are passed, a form instance will be created and returned.
 *
 * ***Note:*** This hook accepts either a form instance(If form is created outside)
 * or form options(and creates a form instance).
 * This is useful when you want to create a form instance outside the component
 * and pass it to the component.
 * But be careful, You should not switch between the two types of arguments.
 * Otherwise you'll be fired
 */
export function useForm<Schema extends types.TSchema, SubmitResult = void>(
  optionsOrFormInstance: types.UseFormOptions<Schema, SubmitResult> | types.UseFormReturn<Schema>,
): types.UseFormReturn<Schema> {
  "use no memo";
  const [initialTypePassed] = React.useState(() => getArgsType(optionsOrFormInstance));
  const closeRef = React.useRef(() => {});

  const argsType = getArgsType(optionsOrFormInstance);

  invariant(
    initialTypePassed === argsType,
    `
    Found a switch between form options and form instance. This is not allowed. Please use either form options or form instance and stick to it.\n\n
    Initially passed: ${initialTypePassed}, Currently passed: ${argsType}.
    `,
  );

  if ("formState" in optionsOrFormInstance) {
    return optionsOrFormInstance;
  } else {
    const {
      method,
      schema,
      onSubmit,
      onChange,
      canSubmitOffline = false,
      onSubmitFailed,
      onSubmitted,
      onSubmitSuccess,
      resetOnSubmit = true,
      ...options
    } = optionsOrFormInstance;

    const computedSchema = typeof schema === "function" ? schema(schemaModule.schema) : schema;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formInstance = reactHookForm.useForm<
      types.FieldValues<Schema>,
      unknown,
      types.TransformedValues<Schema>
    >({
      ...options,
      resolver: zodResolver.zodResolver(computedSchema),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const [isPending, startTransition] = React.useTransition();

    const register: types.UseFormRegister<Schema> = (name, opts) => {
      const registered = formInstance.register(name, opts);

      const onChange: types.UseFormRegisterReturn<Schema>["onChange"] = (value) => {
        return registered.onChange(mapValueOnEvent(value));
      };

      const onBlur: types.UseFormRegisterReturn<Schema>["onBlur"] = (value) => {
        return registered.onBlur(mapValueOnEvent(value));
      };

      const result: types.UseFormRegisterReturn<Schema, typeof name> = {
        ...registered,
        disabled: registered.disabled ?? false,
        isDisabled: registered.disabled ?? false,
        invalid: !!formInstance.formState.errors[name],
        isInvalid: !!formInstance.formState.errors[name],
        required: registered.required ?? false,
        isRequired: registered.required ?? false,
        onChange,
        onBlur,
      };

      return result;
    };

    // We need to disable the eslint rules here, because we call hooks conditionally
    // but it's safe to do so, because we don't switch between the two types of arguments
    // and if we do, we throw an error.
    /* eslint-disable react-compiler/react-compiler */
    /* eslint-disable react-hooks/rules-of-hooks */

    // useActionState hook for form submission state management
    const onSubmitHandler = useEvent(
      (fieldValues: types.TransformedValues<Schema>) =>
        new Promise((resolve, reject) => {
          startTransition(async () => {
            try {
              const result = (await onSubmit?.(fieldValues, form)) as SubmitResult;

              if (method === "dialog") {
                closeRef.current();
              }

              if (resetOnSubmit) {
                formInstance.reset();
              }

              // Call success callback
              await onSubmitSuccess?.(result, fieldValues, form);
              // Call settled callback
              await onSubmitted?.(result, undefined, fieldValues, form);

              resolve({ data: result });
            } catch (error) {
              const isJSError = errorUtils.isJSError(error);

              const message = isJSError
                ? getText("arbitraryFormErrorMessage")
                : errorUtils.tryGetMessage(error, getText("arbitraryFormErrorMessage"));

              setFormError(message);

              // Call error callback
              await onSubmitFailed?.(error, fieldValues, form);
              // Call settled callback
              await onSubmitted?.(undefined, error, fieldValues, form);

              reject(error);
            }
          });
        }),
    );

    const formOnSubmit = formInstance.handleSubmit(onSubmitHandler);

    const { isOffline } = useOffline();

    useOfflineChange(
      (offline: boolean) => {
        if (offline) {
          formInstance.setError("root.offline", { message: getText("unavailableOffline") });
        } else {
          formInstance.clearErrors("root.offline");
        }
      },
      { isDisabled: canSubmitOffline },
    );

    const submit = useEvent((event: React.FormEvent<HTMLFormElement> | null | undefined) => {
      event?.preventDefault();
      event?.stopPropagation();

      if (isOffline && !canSubmitOffline) {
        formInstance.setError("root.offline", { message: getText("unavailableOffline") });
        return Promise.resolve();
      }

      if (event) {
        return formOnSubmit(event);
      } else {
        return formOnSubmit();
      }
    });

    const setFormError = useEvent((error: string) => {
      formInstance.setError("root.submit", { message: error });
    });

    // Store the onChange callback in a ref to always have the latest version
    const onChangeEvent = useEvent(onChange);
    // Subscribe to form changes immediately (not in useEffect)
    // Use lazy initialization to only subscribe once
    const watchUnsubscribeRef = React.useRef<{ unsubscribe: () => void } | null>(null);
    if (!watchUnsubscribeRef.current && onChange) {
      const subscription = formInstance.watch((values) => {
        // Cast to TransformedValues since the schema transforms the values
        onChangeEvent(values as types.TransformedValues<Schema>);
      });
      watchUnsubscribeRef.current = subscription;
    }

    useUnmount(() => {
      watchUnsubscribeRef.current?.unsubscribe();
    });

    const form: types.UseFormReturn<Schema> = {
      ...formInstance,
      submit,
      isSubmitting: isPending,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      control: { ...formInstance.control, register: register as any },
      register,
      schema: computedSchema,
      setFormError,
      handleSubmit: formInstance.handleSubmit,
      closeRef,
      formProps: { onSubmit: submit, noValidate: true },
    };

    return form;
  }
  /* eslint-enable react-compiler/react-compiler */
  /* eslint-enable react-hooks/rules-of-hooks */
}

/** Get the type of arguments passed to the useForm hook */
function getArgsType<Schema extends types.TSchema, SubmitResult = void>(
  args: types.UseFormOptions<Schema, SubmitResult> | types.UseFormReturn<Schema>,
) {
  return "formState" in args ? ("formInstance" as const) : ("formOptions" as const);
}
