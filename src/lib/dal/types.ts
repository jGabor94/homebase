import { DrizzleQueryError } from "drizzle-orm";
import z from "zod";




export type UnexpectedError = {
    readonly type: "unexpected-error",
    readonly error: unknown
}

export type DrizzleError = {
    readonly type: "drizzle-error",
    readonly error: DrizzleQueryError
}

export type ValidationError = {
    readonly type: "validation-error",
    readonly error: z.ZodError
}

export type ZodInputError = {
    readonly type: "zod-input-error",
    readonly error: z.ZodError
}

export type ZodOutputError = {
    readonly type: "zod-output-error",
    readonly error: z.ZodError
}

export type AuthenticationError = {
    readonly type: "unauthenticated"
}

export type AuthorizationError = {
    readonly type: "unauthorized"
}

export type ParamsType<T extends [z.ZodTypeAny, ...z.ZodTypeAny[]]> = z.ZodTuple<T, null>;

export type DalError = { type: string, error?: unknown }

export type DalErrorReturn<TError extends DalError = DalError> = {
    readonly success: false
    readonly error: TError
}

export type DalSuccessReturn<Tdata = unknown> = {
    success: true
    data: Tdata
}

export type DalReturn = DalErrorReturn | DalSuccessReturn | void

export type InitReturns = [DalErrorReturn<UnexpectedError>, DalErrorReturn<DrizzleError>]

export type DalSchema = {
    input?: z.ZodTuple,
    output?: z.ZodType
}


export function createSuccessReturn<const T = undefined>(data?: T): DalSuccessReturn<T> {
    return { success: true, data: data as T }
}


export function createErrorReturn<const E extends DalError>(error: E): DalErrorReturn<E> {
    return { success: false, error }
}

export type ExtractErrorType<T> = T extends { success: false; error: { type: infer R extends string } }
    ? R
    : never;

export type ExtractError<T> = T extends DalErrorReturn ? T : never





