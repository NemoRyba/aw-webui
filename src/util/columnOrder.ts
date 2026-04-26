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
