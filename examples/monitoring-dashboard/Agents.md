# Agent Guidelines for This Project

## Form Component Patterns

### Correct: Use `<Input />` with `name` and `form` props

```typescript
import { Form, Input } from "@/components/AriaComponents";
import { z } from "zod";

const schema = z.object({
  search: z.string(),
  service: z.string(),
});

function MyComponent() {
  const form = Form.useForm({
    schema,
    defaultValues: { search: "", service: "" },
  });

  return (
    <Form form={form}>
      <Input form={form} name="search" placeholder="Search..." rounded="large" />
    </Form>
  );
}
```

### For Select/Dropdown: Use `Form.Field` with render function

```typescript
<Form.Field name="service" label="">
  {(fieldProps) => (
    <select {...fieldProps} className="...">
      <option value="">All Services</option>
      {services.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  )}
</Form.Field>
```

### DON'T: Use `BasicInput` + `Form.Field`

```typescript
// WRONG - Don't do this
<Form.Field name="search" label="">
  {(fieldProps) => (
    <BasicInput {...fieldProps} placeholder="Search..." />
  )}
</Form.Field>
```

## Form Usage

### Create form with schema and default values

```typescript
const form = Form.useForm({
  schema: mySchema,
  defaultValues: { field1: "", field2: "" },
  onSubmit: async (values) => {
    // handle submit
  },
});
```

### Watch field values

```typescript
const value = form.watch("fieldName"); // returns string | undefined
const searchQuery = form.watch("search") ?? "";
```

### Form.Submit and FormError

Always include `<Form.FormError />` below `<Form.Submit />` to display form errors:

```typescript
<div className="flex gap-2 justify-end">
  <Button variant="ghost" onPress={onClose}>Cancel</Button>
  <Form.Submit variant="primary">Submit</Form.Submit>
</div>
<Form.FormError />
```

### Using Form with children as render function

When you need access to the form instance (e.g., to pass to Input components), use children as a render function:

```typescript
<Form schema={schema} defaultValues={defaultValues} onSubmit={handleSubmit}>
  {(form) => (
    <>
      <Form.Field name="name" label="Name">
        {(fieldProps) => (
          <Input form={form} name="name" placeholder="Name" rounded="medium" {...fieldProps} />
        )}
      </Form.Field>
    </>
  )}
</Form>
```

### Form.Provider vs Form

- Use `<Form form={form}>` as the wrapper for form fields (preferred)
- Use `<Form.Provider form={form}>` only when you need to pass form context without the `<form>` element
- Use `form.formProps` on native `<form>` element if rendering a native form

## Data Fetching

### Wrap data fetching in useTransition()

Changes that involve data fetching must be wrapped into `useTransition()` to keep the UI responsive:

```typescript
const [isPending, startTransition] = useTransition();

const handleTimeRangeChange = (newStartTime: number, newEndTime: number) => {
  startTransition(() => {
    setStartTime(newStartTime);
    setEndTime(newEndTime);
  });
};
```

### Await async functions

Always await async functions:

```typescript
const handleSave = async () => {
  await updateServer.mutate({ id: server.id, name: editingName.trim() });
  onEditSave();
};
```

## Goat-Query Mutations

### Use `.mutate()` not `.mutateAsync()`

```typescript
const createServer = useMutation({ mutation: createServerMutation });
createServer.mutate({
  /* data */
}); // NOT .mutateAsync()
```

## Styling

### Use `tv()` for reusable UI-kit components

Use `tv()` function from `@/utilities/tailwindVariants` for reusable components in `src/components/` (UI-kit components):

```typescript
import { tv } from "@/utilities/tailwindVariants";

const BUTTON_STYLES = tv({
  base: "flex items-center justify-center gap-2 transition-colors",
  variants: {
    variant: {
      primary: "bg-primary text-white hover:bg-primary/90",
      secondary: "bg-secondary text-white hover:bg-secondary/90",
    },
    size: {
      small: "px-3 py-1.5 text-sm",
      medium: "px-4 py-2",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "medium",
  },
});
```

### Use plain Tailwind classes for route-specific components

For non-reusable components (route-specific components in `src/routes/`), use plain Tailwind classes directly:

```typescript
// src/routes/Server/components/LogsTable.tsx
return (
  <div className="flex flex-col gap-4 p-4">
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">Filter:</span>
    </div>
  </div>
);
```

## Imports

```typescript
import { Form, Input, Button, Text, Dialog, etc } from "@/components/AriaComponents";
import { useMutation } from "@lib/goat-query/react";
import { tv } from "@/utilities/tailwindVariants";
import { z } from "zod";
```

## File Structure

- Components: `src/components/`
- Routes: `src/routes/`
- Queries: `src/queries/index.ts`
- Database schema: `src/db/schema.ts`

## Adding New Routes

### Create route file with TanStack Router

```typescript
// src/routes/MyFeature.tsx
import { createRoute } from "@tanstack/react-router";
import Root from "./__root";
import { Button, Text } from "@/components/AriaComponents";

function MyFeaturePage() {
  return (
    <div className="p-6">
      <Text variant="h1">My Feature</Text>
    </div>
  );
}

export default createRoute({
  getParentRoute: () => Root,
  path: "/my-feature",
  component: MyFeaturePage,
});
```

### Register route in router.ts

```typescript
// src/router.ts
import { createRouter } from "@tanstack/react-router";
import rootRoute from "./routes/__root";
import serverRoute from "./routes/Server";
import myFeatureRoute from "./routes/MyFeature";

const routeTree = rootRoute.addChildren([serverRoute, myFeatureRoute]);

export const router = createRouter({
  routeTree,
  context: { hello: "world" },
});
```

### Add navigation link in sidebar (if needed)

Update `NAV_ITEMS` in `src/routes/__root.tsx`:

```typescript
const NAV_ITEMS = [
  { to: "/" as const, label: "Servers", icon: ComputerIcon },
  { to: "/my-feature" as const, label: "My Feature", icon: SomeIcon },
];
```
