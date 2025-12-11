/**
 * Shared constants for devtools styling.
 * Colors use both Chrome DevTools performance panel semantic names
 * and hex values for console styling.
 */

// ============================================
// COLOR DEFINITIONS
// ============================================

export interface ColorDefinition {
  /** Chrome DevTools performance panel color name */
  devtools: string;
  /** Hex color for console styling */
  hex: `#${string}`;
}

/**
 * Category colors - used for different operation types
 */
export const CategoryColors = {
  query: {
    devtools: "primary-dark",
    hex: "#3b82f6", // blue
  },
  mutation: {
    devtools: "secondary-dark",
    hex: "#8b5cf6", // purple
  },
  client: {
    devtools: "tertiary-dark",
    hex: "#06b6d4", // cyan
  },
  default: {
    devtools: "tertiary",
    hex: "#6b7280", // gray
  },
} as const satisfies Record<string, ColorDefinition>;

/**
 * Status colors - used for operation outcomes
 */
export const StatusColors = {
  success: {
    devtools: "primary-dark",
    hex: "#10b981", // green
  },
  error: {
    devtools: "error",
    hex: "#ef4444", // red
  },
  pending: {
    devtools: "primary-light",
    hex: "#f59e0b", // amber
  },
  stale: {
    devtools: "tertiary",
    hex: "#f59e0b", // amber
  },
  fetching: {
    devtools: "primary",
    hex: "#3b82f6", // blue
  },
} as const satisfies Record<string, ColorDefinition>;

/**
 * UI colors - used for secondary UI elements
 */
export const UIColors = {
  timestamp: "#9ca3af", // gray-400
  separator: "#6b7280", // gray-500
  muted: "#9ca3af", // gray-400
} as const;

// ============================================
// ICON DEFINITIONS
// ============================================

/**
 * Icons for different operation categories
 */
export const CategoryIcons = {
  query: "🔍",
  mutation: "⚛️",
  client: "🗄️",
  default: "🐐",
} as const;

/**
 * Icons for operation statuses
 */
export const StatusIcons = {
  start: "🚀",
  success: "✅",
  error: "❌",
  pending: "⏳",
  fetching: "🔄",
  stale: "🕛",
  event: "📌",
  total: "🔍",
  fulfilled: "✅",
  rejected: "❌",
} as const;

/**
 * Special operation icons
 */
export const OperationIcons = {
  garbageCollect: "🗑️",
  invalidation: "🔄",
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get category color by category name
 */
export function getCategoryColor(category: string): ColorDefinition {
  if (category in CategoryColors) {
    return CategoryColors[category as keyof typeof CategoryColors];
  }
  return CategoryColors.default;
}

/**
 * Get status color by status name
 */
export function getStatusColor(status: string): ColorDefinition {
  if (status in StatusColors) {
    return StatusColors[status as keyof typeof StatusColors];
  }
  return CategoryColors.default;
}

/**
 * Get category icon by category name
 */
export function getCategoryIcon(category: string): string {
  if (category in CategoryIcons) {
    return CategoryIcons[category as keyof typeof CategoryIcons];
  }
  return CategoryIcons.default;
}

/**
 * Get status icon by status name
 */
export function getStatusIcon(status: string): string {
  if (status in StatusIcons) {
    return StatusIcons[status as keyof typeof StatusIcons];
  }
  return StatusIcons.event;
}

/**
 * Get devtools color based on status and category
 */
export function getDevtoolsColor(
  status: "success" | "error",
  category: string
): string {
  if (status === "error") {
    return StatusColors.error.devtools;
  }
  return getCategoryColor(category).devtools;
}
