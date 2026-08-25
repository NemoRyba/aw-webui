export interface IColumnField {
  key: string;
  label?: string;
  sortable?: boolean;
  [key: string]: any;
}

export function orderFields<T extends IColumnField>(fields: T[], order?: string[]): T[] {
  if (!order || order.length === 0) {
    return fields;
  }

  const fieldsByKey = new Map(fields.map(field => [field.key, field]));
  const ordered = order
    .map(key => fieldsByKey.get(key))
    .filter((field): field is T => Boolean(field));
  const seen = new Set(ordered.map(field => field.key));
  const remainder = fields.filter(field => !seen.has(field.key));
  return [...ordered, ...remainder];
}

export function visibleFields<T extends IColumnField>(fields: T[], hidden?: string[]): T[] {
  if (!hidden || hidden.length === 0) {
    return fields;
  }

  const hiddenKeys = new Set(hidden);
  return fields.filter(field => field.hideable === false || !hiddenKeys.has(field.key));
}

export interface IColumnSettingsLike {
  columnOrdersData?: Record<string, string[]>;
  columnVisibilityData?: Record<string, string[]>;
}

export function applyColumnPreferences<T extends IColumnField>(
  fields: T[],
  settings: IColumnSettingsLike,
  tableKey: string,
  defaultHidden: string[] = []
): T[] {
  const ordered = orderFields(fields, settings?.columnOrdersData?.[tableKey]);
  const visibility = settings?.columnVisibilityData || {};
  const hidden = Object.prototype.hasOwnProperty.call(visibility, tableKey)
    ? visibility[tableKey]
    : defaultHidden;
  return visibleFields(ordered, hidden);
}
