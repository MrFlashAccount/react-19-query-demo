# Implementation Summary

## Что было реализовано

### 1. Рефакторинг API

#### До:

```typescript
// addPromise
addPromise(key, promise);

// useQuery
useQuery(key, queryFn);
```

#### После:

```typescript
// addPromise - теперь принимает объект с опциями
addPromise({
  key: ["user", 1],
  promise: fetchUser(1),
  gcTime: 5000,
});

// useQuery - теперь принимает объект с опциями
useQuery({
  key: ["user", 1],
  queryFn: () => fetchUser(1),
  gcTime: 5000,
});
```

### 2. Поддержка gcTime (Garbage Collection Time)

Добавлена возможность указывать время, через которое кеш будет удален:

```typescript
useQuery({
  key: ["data"],
  queryFn: fetchData,
  gcTime: 10000, // Удалить через 10 секунд после того, как никто не использует
});
```

### 3. Умное управление GC на основе подписок

**Ключевая особенность**: GC таймер запускается ТОЛЬКО когда нет активных подписок.

#### Как это работает:

1. **Отслеживание подписок**

   - Каждая кеш-запись содержит счетчик `subscriptions`
   - При монтировании компонента: `subscriptions++`
   - При размонтировании компонента: `subscriptions--`

2. **Управление GC таймером**

   - Если `subscriptions > 0` → GC таймер НЕ запускается
   - Если `subscriptions === 0` → GC таймер запускается
   - При новой подписке → GC таймер отменяется

3. **Пример**

   ```typescript
   // Компонент A монтируется
   useQuery({ key: ['data'], ... }) // subscriptions = 1, GC НЕ запускается

   // Компонент B также использует тот же ключ
   useQuery({ key: ['data'], ... }) // subscriptions = 2, GC НЕ запускается

   // Компонент A размонтируется
   // subscriptions = 1, GC все еще НЕ запускается

   // Компонент B размонтируется
   // subscriptions = 0, GC ЗАПУСКАЕТСЯ

   // Через gcTime миллисекунд → кеш удаляется
   ```

### 4. Структура данных

```typescript
interface CacheEntry {
  promise: Promise<unknown>; // Сам промис
  timeoutId?: ReturnType<typeof setTimeout>; // ID таймера для GC
  subscriptions: number; // Счетчик активных подписок
  gcTime?: number; // Время до удаления (мс)
}
```

### 5. Новые методы в QueryProvider

```typescript
interface QueryContextValue {
  cache: Map<string, CacheEntry>;

  addPromise: (options: AddPromiseOptions) => Promise;
  getPromise: (key: Array<unknown>) => Promise | null;

  // Новые методы для управления подписками
  subscribe: (key: Array<unknown>) => void;
  unsubscribe: (key: Array<unknown>) => void;
}
```

### 6. Автоматическое управление подписками в useQuery

```typescript
function useQuery(options) {
  // ... получение промиса ...

  // Автоматическое управление подписками через useEffect
  useEffect(() => {
    queryProviderValue.subscribe(key);

    return () => {
      queryProviderValue.unsubscribe(key);
    };
  }, [JSON.stringify(key)]);

  return promise;
}
```

## Файловая структура

```
src/
├── QueryProvider.tsx      # Основная реализация (экспортируемая)
├── App.tsx                # Пример использования
├── App.test.tsx           # 20 тестов покрывающих все кейсы
└── test/
    └── setup.ts           # Настройка тестовой среды

vitest.config.ts           # Конфигурация Vitest
TEST_README.md             # Документация по тестам
USAGE.md                   # Подробное руководство пользователя
```

## Тестовое покрытие

### 20 тестов, покрывающих:

1. **Basic Caching (4 теста)**

   - Кеширование и повторное использование промисов
   - Разные промисы для разных ключей
   - Получение из кеша через getPromise
   - Возврат null для несуществующих записей

2. **Subscription Tracking (3 теста)**

   - Увеличение счетчика при подписке
   - Уменьшение счетчика при отписке
   - Защита от отрицательных значений

3. **GC Without Subscriptions (3 теста)**

   - Удаление после gcTime без подписок
   - Бесконечное кеширование без gcTime
   - Бесконечное кеширование с gcTime: Infinity

4. **GC With Active Subscriptions (3 теста)**

   - НЕ удалять при активных подписках
   - Запуск GC после удаления всех подписок
   - Отмена GC при новой подписке

5. **useQuery Integration (4 теста)**

   - Автоматическая подписка/отписка
   - Запуск GC после unmount
   - НЕ запускать GC пока компонент mounted
   - Расшаривание кеша между компонентами

6. **Edge Cases (3 теста)**
   - Сложные ключи с объектами
   - Множественные unsubscribe
   - Нулевой gcTime (немедленное удаление)

## Ключевые улучшения

### ✅ Более явный API

- Объектные параметры вместо позиционных
- Самодокументирующийся код
- Легче добавлять новые опции в будущем

### ✅ Умная сборка мусора

- Не удаляет данные, пока они используются
- Автоматическое управление через hooks
- Предсказуемое поведение

### ✅ Полная типизация

- TypeScript типы для всех API
- Документация в JSDoc
- Автокомплит в IDE

### ✅ Comprehensive тесты

- 20 тестов покрывают все сценарии
- Используют fake timers для детерминированности
- Проверяют как изоляцию, так и интеграцию

### ✅ Документация

- Подробное руководство пользователя (USAGE.md)
- Документация по тестам (TEST_README.md)
- Inline JSDoc комментарии в коде

## Использование

### Установка зависимостей

```bash
npm install
```

### Запуск в dev режиме

```bash
npm run dev
```

### Запуск тестов

```bash
npm run test
```

### Запуск тестов с UI

```bash
npm run test:ui
```

## Пример использования

```tsx
import { QueryProvider, useQuery } from "./QueryProvider";
import { use, Suspense } from "react";

function UserProfile({ userId }) {
  const promise = useQuery({
    key: ["user", userId],
    queryFn: () => fetch(`/api/users/${userId}`).then((r) => r.json()),
    gcTime: 5000, // Кеш удаляется через 5 сек после unmount
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

## Следующие шаги

Потенциальные улучшения:

- [ ] Добавить staleTime (время устаревания данных)
- [ ] Добавить refetch методы
- [ ] Добавить invalidation API
- [ ] Добавить мутации
- [ ] Добавить оптимистичные обновления
- [ ] Добавить devtools
