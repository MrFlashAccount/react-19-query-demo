# Изменения в Query Provider

## Обзор

Реализована система кеширования промисов с умной сборкой мусора (garbage collection), которая учитывает активные подписки компонентов.

## Основные изменения

### 1. Рефакторинг API на объектные параметры

**`addPromise`** теперь принимает объект:

```typescript
// Было
addPromise(key, promise);

// Стало
addPromise({
  key: ["user", 1],
  promise: fetchUser(1),
  gcTime: 5000, // опционально
});
```

**`useQuery`** теперь принимает объект:

```typescript
// Было
useQuery(key, queryFn);

// Стало
useQuery({
  key: ["user", 1],
  queryFn: () => fetchUser(1),
  gcTime: 5000, // опционально
});
```

### 2. Добавлена опция `gcTime`

Позволяет указать время (в миллисекундах), после которого кеш будет удален:

```typescript
useQuery({
  key: ["data"],
  queryFn: fetchData,
  gcTime: 10000, // Удалить через 10 секунд
});
```

Особые значения:

- `undefined` или не указано → кеш никогда не удаляется
- `Infinity` → кеш никогда не удаляется
- `0` → кеш удаляется немедленно (после unmount)
- `> 0` → кеш удаляется через указанное время

### 3. Умная GC на основе подписок

**Ключевая особенность**: GC таймер запускается ТОЛЬКО когда нет активных подписок.

#### Как это работает:

1. **Отслеживание подписок**

   ```typescript
   interface CacheEntry {
     promise: Promise<unknown>;
     timeoutId?: ReturnType<typeof setTimeout>;
     subscriptions: number; // ← Счетчик подписок
     gcTime?: number;
   }
   ```

2. **Автоматическое управление**

   - `useQuery` автоматически подписывается при mount
   - `useQuery` автоматически отписывается при unmount
   - GC запускается только при `subscriptions === 0`

3. **Жизненный цикл**
   ```
   Component Mount
   ↓
   Subscribe (subscriptions++)
   ↓
   GC Timer CANCELLED
   ↓
   Component Unmount
   ↓
   Unsubscribe (subscriptions--)
   ↓
   subscriptions === 0?
   ├─ Yes → START GC Timer
   └─ No  → Continue
   ↓
   After gcTime
   ↓
   subscriptions still === 0?
   ├─ Yes → DELETE Cache Entry
   └─ No  → Keep Cache Entry
   ```

### 4. Новые методы в QueryProvider

```typescript
interface QueryContextValue {
  cache: Map<string, CacheEntry>;
  addPromise: (options) => Promise;
  getPromise: (key) => Promise | null;

  // Новые методы
  subscribe: (key) => void; // Увеличить счетчик подписок
  unsubscribe: (key) => void; // Уменьшить счетчик подписок
}
```

## Файлы

### Основные файлы

- **`src/QueryProvider.tsx`** - Экспортируемая реализация
- **`src/App.tsx`** - Пример использования
- **`src/App.test.tsx`** - 20 тестов

### Конфигурация

- **`vitest.config.ts`** - Настройка Vitest
- **`src/test/setup.ts`** - Setup для тестов
- **`package.json`** - Обновлены зависимости и скрипты

### Документация

- **`USAGE.md`** - Подробное руководство пользователя
- **`TEST_README.md`** - Описание тестов
- **`IMPLEMENTATION_SUMMARY.md`** - Технический обзор реализации
- **`CHANGES.md`** (этот файл) - Список изменений

## Тесты

### Добавлено 20 тестов, покрывающих:

1. ✅ **Базовое кеширование** (4 теста)
2. ✅ **Отслеживание подписок** (3 теста)
3. ✅ **GC без подписок** (3 теста)
4. ✅ **GC с активными подписками** (3 теста)
5. ✅ **Интеграция useQuery** (4 теста)
6. ✅ **Граничные случаи** (3 теста)

Запуск тестов:

```bash
npm run test
npm run test:ui
```

## Установка новых зависимостей

```bash
npm install
```

Были добавлены:

- `vitest` - Тестовый фреймворк
- `@testing-library/react` - React Testing Library
- `@testing-library/jest-dom` - Дополнительные матчеры
- `@testing-library/user-event` - Симуляция пользовательских событий
- `happy-dom` - DOM окружение для тестов

## Примеры использования

### Базовый пример

```tsx
import { QueryProvider, useQuery } from "./QueryProvider";
import { use, Suspense } from "react";

function UserProfile({ userId }) {
  const promise = useQuery({
    key: ["user", userId],
    queryFn: () => fetchUser(userId),
    gcTime: 5000,
  });

  const user = use(promise);
  return <div>{user.name}</div>;
}

function App() {
  return (
    <QueryProvider>
      <Suspense fallback="Loading...">
        <UserProfile userId="123" />
      </Suspense>
    </QueryProvider>
  );
}
```

### Расшаривание кеша

```tsx
// Оба компонента используют один кеш
function Avatar({ userId }) {
  const promise = useQuery({
    key: ["user", userId], // Одинаковый ключ
    queryFn: () => fetchUser(userId),
    gcTime: 5000,
  });
  const user = use(promise);
  return <img src={user.avatar} />;
}

function Name({ userId }) {
  const promise = useQuery({
    key: ["user", userId], // Одинаковый ключ
    queryFn: () => fetchUser(userId),
    gcTime: 5000,
  });
  const user = use(promise);
  return <span>{user.name}</span>;
}

// fetchUser вызовется только один раз!
function UserCard({ userId }) {
  return (
    <div>
      <Avatar userId={userId} />
      <Name userId={userId} />
    </div>
  );
}
```

### Разные стратегии кеширования

```tsx
// Кратковременный кеш (часто меняющиеся данные)
const liveData = useQuery({
  key: ["live"],
  queryFn: fetchLiveData,
  gcTime: 1000, // 1 секунда
});

// Средний кеш
const userData = useQuery({
  key: ["user", id],
  queryFn: () => fetchUser(id),
  gcTime: 30000, // 30 секунд
});

// Бесконечный кеш (статические данные)
const config = useQuery({
  key: ["config"],
  queryFn: fetchConfig,
  // gcTime не указан = бесконечный кеш
});

// Немедленное удаление (чувствительные данные)
const sensitive = useQuery({
  key: ["sensitive"],
  queryFn: fetchSensitive,
  gcTime: 0, // Удалить сразу после unmount
});
```

## Миграция со старого API

### Обновление addPromise

```typescript
// До
context.addPromise(["user", 1], fetchUser(1));

// После
context.addPromise({
  key: ["user", 1],
  promise: fetchUser(1),
  gcTime: 5000, // опционально
});
```

### Обновление useQuery

```typescript
// До
const promise = useQuery(["user", userId], () => fetchUser(userId));

// После
const promise = useQuery({
  key: ["user", userId],
  queryFn: () => fetchUser(userId),
  gcTime: 5000, // опционально
});
```

## Обратная совместимость

⚠️ **Breaking Changes**: API полностью изменен на объектные параметры.

Миграция требует обновления всех вызовов `addPromise` и `useQuery`.

## Производительность

- ✅ Нет избыточных вызовов функций
- ✅ Нет утечек памяти (GC удаляет неиспользуемые кеши)
- ✅ Минимальное количество ре-рендеров
- ✅ Оптимизированное использование таймеров

## Следующие шаги

Потенциальные улучшения:

- [ ] `staleTime` - время устаревания данных
- [ ] `refetch` методы
- [ ] `invalidate` API для инвалидации кеша
- [ ] Мутации
- [ ] Оптимистичные обновления
- [ ] DevTools
- [ ] Персистентность кеша (localStorage)

## Вопросы?

См. полную документацию в `USAGE.md`
