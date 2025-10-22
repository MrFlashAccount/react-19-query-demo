# Почему тесты импортируют код вместо дублирования

## ✅ Правильный подход (текущий)

```typescript
// App.test.tsx
import { QueryProvider, useQuery, QueryContext } from "./QueryProvider";

describe("QueryProvider", () => {
  // Тесты используют настоящую реализацию
});
```

## ❌ Неправильный подход (было раньше)

```typescript
// App.test.tsx
// ... 200 строк копии кода из QueryProvider.tsx ...

describe("QueryProvider", () => {
  // Тесты используют копию реализации
});
```

## Почему импорт лучше?

### 1. **Single Source of Truth**

- ✅ Одна реализация
- ✅ Изменения автоматически отражаются в тестах
- ✅ Нет риска расхождения между кодом и тестами

### 2. **Меньше кода для поддержки**

- ✅ Было: 895 строк в тестовом файле
- ✅ Стало: 698 строк (на ~200 строк меньше)
- ✅ Реализация в одном месте: 247 строк

### 3. **Реальное тестирование**

Тесты проверяют **настоящий код**, который будет использоваться в production:

```typescript
// ✅ Тестируем то, что на самом деле используется
import { QueryProvider } from "./QueryProvider";

// ❌ Тестируем копию, которая может отличаться
function QueryProvider() {
  // ... копия кода ...
}
```

### 4. **Легче поддерживать**

При изменении реализации:

**С импортом:**

1. Меняем код в `QueryProvider.tsx`
2. Тесты автоматически используют новую версию
3. Готово! ✅

**С дублированием:**

1. Меняем код в `QueryProvider.tsx`
2. Меняем копию в `App.test.tsx`
3. Убеждаемся, что они идентичны
4. Рискуем забыть синхронизировать ❌

### 5. **Правильная изоляция**

Изоляция тестов достигается через:

- ✅ `beforeEach` / `afterEach` hooks
- ✅ Fake timers (`vi.useFakeTimers()`)
- ✅ Чистка после каждого теста
- ✅ Отдельные инстансы компонентов

**НЕ через:**

- ❌ Копирование кода

## Как мы обеспечиваем изоляцию?

```typescript
describe("QueryProvider", () => {
  beforeEach(() => {
    // Fake timers для контроля времени
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Восстановление моков
    vi.restoreAllMocks();
    // Восстановление реального времени
    vi.useRealTimers();
  });

  it("test case", () => {
    // Каждый тест создает новый инстанс QueryProvider
    render(
      <QueryProvider>
        <TestComponent />
      </QueryProvider>
    );
    // Это обеспечивает изоляцию между тестами
  });
});
```

## Что экспортируем для тестов?

```typescript
// QueryProvider.tsx
export const QueryContext = createContext<QueryContextValue>({
  // ... с комментарием что это для тестов
});

export function QueryProvider({ children }) {
  // ...
}

export function useQuery(options) {
  // ...
}

export type QueryContextValue = {
  // ... для типизации в тестах
};
```

## Пример использования в тестах

```typescript
import { QueryProvider, QueryContext, useQuery } from "./QueryProvider";
import { use } from "react";

// Helper для доступа к контексту в тестах
function useQueryContext() {
  return use(QueryContext);
}

it("should track subscriptions", () => {
  let contextValue: QueryContextValue | null = null;

  function TestComponent() {
    contextValue = useQueryContext();
    return <div>Test</div>;
  }

  render(
    <QueryProvider>
      <TestComponent />
    </QueryProvider>
  );

  // Можем проверить внутреннее состояние
  const entry = contextValue!.cache.get(JSON.stringify(["test"]));
  expect(entry!.subscriptions).toBe(0);
});
```

## Итог

✅ **Импортируйте** реализацию из основного файла
❌ **Не дублируйте** код в тестах

Это:

- Проще поддерживать
- Надежнее (тестируем реальный код)
- Меньше кода
- Меньше багов
- Лучшая практика в индустрии

---

**Исправлено в коммите**: Удалено ~200 строк дублированного кода из `App.test.tsx`
