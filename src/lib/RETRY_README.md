# Query Retry Feature

The QueryClient library includes built-in retry functionality for handling failed queries. Retries are configured through the `retry` option in `useQuery`.

## Features

- **Configurable retry count**: Set number of retry attempts
- **Boolean mode**: Simple enable/disable with default 3 retries
- **Custom retry logic**: Use a function to determine retry behavior based on error and attempt count
- **Retry delays**: Configure delays between retry attempts
- **Exponential backoff**: Implement custom delay strategies

## Basic Usage

### Number of Retries

Specify the exact number of retry attempts:

```tsx
function UserProfile({ userId }) {
  const { promise } = useQuery({
    key: ["user", userId],
    queryFn: () => fetchUser(userId),
    retry: 5, // Retry up to 5 times
  });

  const user = use(promise());
  return <div>{user.name}</div>;
}
```

### Boolean Mode

Use `true` for default retries (3 attempts) or `false` to disable:

```tsx
// Enable with default 3 retries
const { promise } = useQuery({
  key: ["data"],
  queryFn: fetchData,
  retry: true, // Default behavior
});

// Disable retries
const { promise } = useQuery({
  key: ["data"],
  queryFn: fetchData,
  retry: false, // Fail immediately
});
```

### Custom Retry Logic

Use a function to implement custom retry logic based on error and attempt count:

```tsx
function Dashboard() {
  const { promise } = useQuery({
    key: ["dashboard"],
    queryFn: fetchDashboard,
    retry: (failureCount, error) => {
      // Only retry network errors
      if (error instanceof NetworkError) {
        return failureCount < 3;
      }

      // Don't retry 4xx errors
      if (error.status >= 400 && error.status < 500) {
        return false;
      }

      // Retry 5xx errors up to 5 times
      return failureCount < 5;
    },
  });

  const data = use(promise());
  return <div>{data.title}</div>;
}
```

## Retry Delays

### Fixed Delay

Add a fixed delay between retry attempts:

```tsx
const { promise } = useQuery({
  key: ["data"],
  queryFn: fetchData,
  retry: 3,
  retryDelay: 1000, // Wait 1 second between retries
});
```

### Exponential Backoff

Implement exponential backoff with a custom delay function:

```tsx
const { promise } = useQuery({
  key: ["data"],
  queryFn: fetchData,
  retry: 5,
  retryDelay: (failureCount) => {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    return Math.min(1000 * Math.pow(2, failureCount), 30000);
  },
});
```

### Error-Based Delay

Adjust delay based on the type of error:

```tsx
const { promise } = useQuery({
  key: ["data"],
  queryFn: fetchData,
  retry: 3,
  retryDelay: (failureCount, error) => {
    // Longer delay for rate limit errors
    if (error.status === 429) {
      return 5000;
    }

    // Shorter delay for network errors
    if (error instanceof NetworkError) {
      return 1000;
    }

    // Default exponential backoff
    return 1000 * Math.pow(2, failureCount);
  },
});
```

## Advanced Examples

### Retry with Custom Error Types

```tsx
class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

class ServerError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ServerError";
  }
}

function DataList() {
  const { promise } = useQuery({
    key: ["items"],
    queryFn: async () => {
      const response = await fetch("/api/items");

      if (!response.ok) {
        if (response.status >= 500) {
          throw new ServerError(response.status, "Server error");
        }
        throw new Error("Request failed");
      }

      return response.json();
    },
    retry: (failureCount, error) => {
      // Retry server errors up to 5 times
      if (error instanceof ServerError) {
        return failureCount < 5;
      }

      // Retry network errors up to 3 times
      if (error instanceof NetworkError) {
        return failureCount < 3;
      }

      // Don't retry other errors
      return false;
    },
    retryDelay: (failureCount, error) => {
      // Longer delay for server errors (they might be under load)
      if (error instanceof ServerError) {
        return 5000 * (failureCount + 1);
      }

      // Shorter delay for network errors
      return 1000 * (failureCount + 1);
    },
  });

  const items = use(promise());
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}
```

### Retry with Rate Limiting

```tsx
function RateLimitedQuery() {
  const { promise } = useQuery({
    key: ["rate-limited"],
    queryFn: async () => {
      const response = await fetch("/api/rate-limited");

      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
      }

      return response.json();
    },
    retry: (failureCount, error) => {
      // Always retry rate limit errors, up to 10 times
      if (error.message.includes("Rate limited")) {
        return failureCount < 10;
      }
      return failureCount < 3;
    },
    retryDelay: (failureCount, error) => {
      // Parse retry-after header from error message
      if (error.message.includes("Rate limited")) {
        const match = error.message.match(/Retry after (\d+) seconds/);
        if (match) {
          return parseInt(match[1]) * 1000;
        }
        return 60000; // Default to 1 minute
      }
      return 1000;
    },
  });

  const data = use(promise());
  return <div>{data.content}</div>;
}
```

### Progressive Retry Strategy

```tsx
function ProgressiveRetry() {
  const { promise } = useQuery({
    key: ["progressive"],
    queryFn: fetchData,
    retry: (failureCount, error) => {
      // Quick retries for the first 3 attempts
      if (failureCount < 3) {
        return true;
      }

      // Then only retry if it looks like a temporary issue
      if (failureCount < 10) {
        return error instanceof NetworkError || error.status >= 500;
      }

      return false;
    },
    retryDelay: (failureCount) => {
      // Quick retries (1s) for first 3 attempts
      if (failureCount < 3) {
        return 1000;
      }

      // Then exponential backoff
      return Math.min(1000 * Math.pow(2, failureCount - 3), 60000);
    },
  });

  const data = use(promise());
  return <div>{data.title}</div>;
}
```

## Best Practices

### 1. **Don't Retry Client Errors**

4xx errors indicate client-side issues that won't be resolved by retrying:

```tsx
retry: (failureCount, error) => {
  // Don't retry 4xx errors
  if (error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < 3;
};
```

### 2. **Use Exponential Backoff**

Exponential backoff helps prevent overwhelming a recovering server:

```tsx
retryDelay: (failureCount) => {
  return Math.min(1000 * Math.pow(2, failureCount), 30000);
};
```

### 3. **Set Maximum Delay**

Prevent extremely long waits with a maximum delay cap:

```tsx
retryDelay: (failureCount) => {
  const delay = 1000 * Math.pow(2, failureCount);
  return Math.min(delay, 30000); // Max 30 seconds
};
```

### 4. **Respect Rate Limits**

Parse and respect `Retry-After` headers:

```tsx
retry: (failureCount, error) => {
  if (error.status === 429) {
    return failureCount < 10; // Retry rate limits
  }
  return failureCount < 3;
},
retryDelay: (failureCount, error) => {
  if (error.status === 429 && error.retryAfter) {
    return error.retryAfter * 1000;
  }
  return 1000;
}
```

### 5. **Different Strategies for Different Errors**

Tailor retry behavior based on error type:

```tsx
retry: (failureCount, error) => {
  // Network errors: retry more aggressively
  if (error instanceof NetworkError) {
    return failureCount < 5;
  }

  // Server errors: retry less aggressively
  if (error.status >= 500) {
    return failureCount < 3;
  }

  // Other errors: don't retry
  return false;
};
```

## Default Behavior

If no `retry` option is specified, the default behavior is `retry: true`, which provides 3 retry attempts with no delay between retries.

```tsx
// These are equivalent:
useQuery({ key: ["data"], queryFn: fetchData });
useQuery({ key: ["data"], queryFn: fetchData, retry: true });
useQuery({ key: ["data"], queryFn: fetchData, retry: 3, retryDelay: 0 });
```

## API Reference

### `retry` Option

**Type:** `number | boolean | (failureCount: number, error: unknown) => boolean`

- `number`: Retry exactly N times
- `boolean`: `true` = retry 3 times, `false` = no retry
- `function`: Custom logic based on failure count and error

**Parameters:**

- `failureCount`: Number of failed attempts so far (0-indexed)
- `error`: The error that was thrown

**Returns:** `boolean` - Whether to retry

### `retryDelay` Option

**Type:** `number | (failureCount: number, error: unknown) => number`

- `number`: Fixed delay in milliseconds
- `function`: Custom delay logic based on failure count and error

**Parameters:**

- `failureCount`: Number of failed attempts so far (0-indexed)
- `error`: The error that was thrown

**Returns:** `number` - Delay in milliseconds before next retry

## See Also

- [QueryProvider Documentation](./README.md)
- [Error Handling Guide](../error-handling.md)
- [Retrier Class](./Retrier.ts)
