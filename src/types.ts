export type AnyObject = Record<string, unknown>

export type IfAny<T, Y, N> = 0 extends (1 & T) ? Y : N;

export type DeepExpand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;
export type Expand<T> = T

export type IsParameterProvided<T> = T extends undefined ? false : true;

export type Exact<T, Shape> = T extends Shape
    ? Exclude<keyof T, keyof Shape> extends never
    ? T
    : never
    : never;
