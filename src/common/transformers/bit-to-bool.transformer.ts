// src/common/transformers/bit-to-bool.transformer.ts
export const bitToBoolTransformer = {
  to: (value?: boolean | null) => (value == null ? value : (value ? 1 : 0)),
  from: (value: any) => {
    if (value == null) return value;
    // mysql2 suele devolver Buffer para BIT
    if (Buffer.isBuffer(value)) return value[0] === 1;
    if (typeof value === 'number') return value === 1;
    return Boolean(value);
  },
};
