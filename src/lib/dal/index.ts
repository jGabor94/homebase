"server only"

import { auth } from "@/features/authentication/lib/auth";
import { Permissions } from "@/features/authorization/types";
import { hasPermission } from "@/features/authorization/utils";
import { AnyObject, DeepExpand } from "@/types";
import { DrizzleQueryError } from "drizzle-orm";
import { Session } from "next-auth";
import { cache } from "react";
import z from "zod";
import { AuthenticationError, AuthorizationError, createErrorReturn, createSuccessReturn, DalErrorReturn, DalSuccessReturn, InitReturns, ZodInputError, ZodOutputError } from "./types";


/**
 * Builder state after `Dal.create()`.
 * Available methods: `schema`, `$Input`, `authenticate`, `operation`.
 *
 * @template Returns - Accumulated possible return types.
 * @template Ctx - Context object passed to `operation`.
 * @template I - Tuple of input argument types.
 * @template O - Optional Zod output schema.
 */
interface CreateReturn<
    Returns extends unknown[] = InitReturns,
    Ctx extends AnyObject = AnyObject,
    I extends unknown[] = [],
    O extends z.ZodType | undefined = undefined
> {
    operation<const T extends DalErrorReturn | (O extends undefined ? DalSuccessReturn : DalSuccessReturn<z.output<O>>) | void>(fn: (ctx: Ctx) => Promise<T>): (...args: I extends undefined ? [] : I) => Promise<Returns[number] | T>
    authenticate(): AuthenticateReturn<[...Returns, DalErrorReturn<AuthenticationError>], DeepExpand<Ctx & { user: Session["user"] }>, I, O>,
    schema<TInput extends z.ZodTuple<{ [K in keyof I]: z.ZodType<I[K]> }, z.ZodTypeAny | null> | undefined = undefined, TOutput extends z.ZodType | undefined = undefined>(schema?: {
        input?: TInput,
        output?: TOutput
    }): SchemaReturn<[...Returns, TInput extends z.ZodTuple ? DalErrorReturn<ZodInputError> : never, TOutput extends z.ZodType ? DalErrorReturn<ZodOutputError> : never], Ctx, I, TOutput>
    $Input<TInput extends unknown[] = []>(): $InputReturn<Returns, DeepExpand<Ctx & { input: TInput }>, TInput, O>
}

/**
 * Builder state after `$Input<TInput>()`.
 * Adds `input: TInput` to `Ctx`. Available methods: `schema`, `authenticate`, `operation`.
 *
 * @template Returns - Accumulated possible return types.
 * @template Ctx - Context object extended with `{ input: TInput }`.
 * @template I - Tuple of input argument types.
 * @template O - Optional Zod output schema.
 */
interface $InputReturn<
    Returns extends unknown[] = InitReturns,
    Ctx extends AnyObject = AnyObject,
    I extends unknown[] = [],
    O extends z.ZodType | undefined = undefined
> {
    operation<const T extends DalErrorReturn | (O extends undefined ? DalSuccessReturn : DalSuccessReturn<z.output<O>>) | void>(fn: (ctx: Ctx) => Promise<T>): (...args: I extends undefined ? [] : I) => Promise<Returns[number] | T>
    authenticate(): AuthenticateReturn<[...Returns, DalErrorReturn<AuthenticationError>], DeepExpand<Ctx & { user: Session["user"] }>, I, O>,
    schema<TInput extends z.ZodTuple<{ [K in keyof I]: z.ZodType<I[K]> }, z.ZodTypeAny | null> | undefined = undefined, TOutput extends z.ZodType | undefined = undefined>(schema?: {
        input?: TInput,
        output?: TOutput
    }): SchemaReturn<[...Returns, TInput extends z.ZodTuple ? DalErrorReturn<ZodInputError> : never, TOutput extends z.ZodType ? DalErrorReturn<ZodOutputError> : never], Ctx, I, TOutput>
}


/**
 * Builder state after `schema()`.
 * Adds `ZodInputError` / `ZodOutputError` to `Returns`. Available methods: `authenticate`, `operation`.
 *
 * @template Returns - Accumulated possible return types, extended with Zod error variants.
 * @template Ctx - Context object passed to `operation`.
 * @template I - Tuple of input argument types.
 * @template O - Optional Zod output schema.
 */
interface SchemaReturn<
    Returns extends unknown[] = InitReturns,
    Ctx extends AnyObject = AnyObject,
    I extends unknown[] = [],
    O extends z.ZodType | undefined = undefined
> {
    operation<const T extends DalErrorReturn | (O extends undefined ? DalSuccessReturn : DalSuccessReturn<z.output<O>>) | void>(fn: (ctx: Ctx) => Promise<T>): (...args: I extends undefined ? [] : I) => Promise<Returns[number] | T>
    authenticate(): AuthenticateReturn<[...Returns, DalErrorReturn<AuthenticationError>], DeepExpand<Ctx & { user: Session["user"] }>, I, O>,
}


/**
 * Builder state after `authenticate()`.
 * Adds `AuthenticationError` to `Returns` and `{ user }` to `Ctx`. Available methods: `authorize`, `operation`.
 *
 * @template Returns - Accumulated possible return types, extended with `AuthenticationError`.
 * @template Ctx - Context object extended with `{ user: Session["user"] }`.
 * @template I - Tuple of input argument types.
 * @template O - Optional Zod output schema.
 */
interface AuthenticateReturn<
    Returns extends unknown[] = InitReturns,
    Ctx extends AnyObject = AnyObject,
    I extends unknown[] = [],
    O extends z.ZodType | undefined = undefined
> {
    operation<const T extends DalErrorReturn | (O extends undefined ? DalSuccessReturn : DalSuccessReturn<z.output<O>>) | void>(fn: (ctx: Ctx) => Promise<T>): (...args: I extends undefined ? [] : I) => Promise<Returns[number] | T>
    authorize<Resource extends keyof Permissions>(cfg: {
        resource: Resource,
        action: Permissions[Resource]["action"],
        data?: Permissions[Resource]["dataType"] | ((...args: I) => Promise<Permissions[Resource]["dataType"] | undefined>),
    }): AuthorizeReturn<[...Returns, DalErrorReturn<AuthorizationError>], Ctx, I, O>
}


/**
 * Builder state after `authorize()`.
 * Adds `AuthorizationError` to `Returns`. Only `operation` is available.
 *
 * @template Returns - Accumulated possible return types, extended with `AuthorizationError`.
 * @template Ctx - Context object passed to `operation`.
 * @template I - Tuple of input argument types.
 * @template O - Optional Zod output schema.
 */
interface AuthorizeReturn<
    Returns extends unknown[] = InitReturns,
    Ctx extends AnyObject = AnyObject,
    I extends unknown[] = [],
    O extends z.ZodType | undefined = undefined
> {
    operation<const T extends DalErrorReturn | (O extends undefined ? DalSuccessReturn : DalSuccessReturn<z.output<O>>) | void>(fn: (ctx: Ctx) => Promise<T>): (...args: I extends undefined ? [] : I) => Promise<Returns[number] | T>
}



/**
 * Fluent builder for type-safe server-side DAL operations.
 *
 * Chain order: `schema` → `$Input` → `authenticate` → `authorize` → `operation`.
 * Each step narrows the return union and extends the context (`Ctx`) accordingly.
 *
 * @template Returns - Union of all possible return types accumulated by the chain.
 * @template Ctx - Context object available inside `operation`.
 * @template I - Tuple of input argument types.
 * @template O - Optional Zod output schema; constrains the success return type.
 *
 * @example
 * const getUser = Dal.create()
 *   .authenticate()
 *   .authorize({ resource: "user", action: "read" })
 *   .operation(async ({ user }) => {
 *     const data = await db.query.users.findFirst(...)
 *     return createSuccessReturn(data)
 *   })
 */
export class Dal<
    Returns extends unknown[] = InitReturns,
    Ctx extends AnyObject = AnyObject,
    I extends unknown[] = [],
    O extends z.ZodType | undefined = undefined
> {

    private authentication = false
    private authorization: {
        resource: keyof Permissions;
        action: Permissions[keyof Permissions]["action"];
        data?: unknown | ((...args: never[]) => Promise<unknown>);
    } | false = false

    private cfg: { cache?: boolean } | undefined = undefined
    private inputSchema: z.ZodTuple | undefined = undefined
    private outputSchema: z.ZodType | undefined = undefined

    private constructor(cfg?: { cache?: boolean }) {
        this.cfg = cfg
    }

    /**
   * Creates a new `Dal` builder instance.
   *
   * @param cfg.cache - Wrap the final operation with React `cache()`. Defaults to `true`.
   */
    static create(cfg: { cache?: boolean } = { cache: true }): CreateReturn {
        return new Dal(cfg)
    }

    /**
   * Registers Zod schemas for input validation and/or output validation.
   * - Input errors add `ZodInputError` to the return union.
   * - Output errors add `ZodOutputError` to the return union.
   *
   * @param schema.input - Zod tuple matching the operation's argument list.
   * @param schema.output - Zod type that the success data must satisfy.
   */
    schema<TInput extends z.ZodTuple<{ [K in keyof I]: z.ZodType<I[K]> }, z.ZodTypeAny | null> | undefined = undefined, TOutput extends z.ZodType | undefined = undefined>(schema?: {
        input?: TInput,
        output?: TOutput
    }) {

        this.inputSchema = schema?.input
        this.outputSchema = schema?.output

        return this as SchemaReturn<
            [...Returns, TInput extends z.ZodTuple ? DalErrorReturn<ZodInputError> : never, TOutput extends z.ZodType ? DalErrorReturn<ZodOutputError> : never],
            Ctx,
            I,
            TOutput>
    }

    /**
 * Declares the input tuple type `TInput` without a Zod schema.
 * Adds `{ input: TInput }` to `Ctx` so the operation receives typed arguments.
 * Use when runtime validation is not needed but type safety is still desired.
 */
    $Input<TInput extends unknown[] = []>() {
        return this as unknown as $InputReturn<
            Returns,
            DeepExpand<Ctx & { input: TInput }>,
            TInput,
            O
        >
    }

    /**
 * Enables session authentication via NextAuth.
 * Adds `{ user: Session["user"] }` to `Ctx`.
 * Returns `AuthenticationError` if no valid session exists.
 */
    authenticate() {
        this.authentication = true
        return this as unknown as AuthenticateReturn<[...Returns, DalErrorReturn<AuthenticationError>], DeepExpand<Ctx & { user: Session["user"] }>, I, O>
    }

    /**
 * Enables RBAC authorization check after authentication.
 * Returns `AuthorizationError` if the user lacks the required permission.
 *
 * @param cfg.resource - The resource key from `Permissions`.
 * @param cfg.action - The action to check on the resource.
 * @param cfg.data - Static permission data or an async resolver receiving the operation args.
 *                   If the resolver returns `undefined`, access is denied immediately.
 */
    authorize<Resource extends keyof Permissions>(cfg: {
        resource: Resource,
        action: Permissions[Resource]["action"],
        data?: Permissions[Resource]["dataType"] | ((...args: I extends z.ZodTuple ? z.input<I> : never) => Promise<Permissions[Resource]["dataType"] | undefined>),
    }) {
        this.authorization = cfg
        return this as AuthorizeReturn<[...Returns, DalErrorReturn<AuthorizationError>], Ctx, I, O>
    }

    /**
 * Finalizes the builder and returns the callable server action.
 *
 * Execution order:
 * 1. Input Zod validation (if `schema` was called).
 * 2. Authentication check (if `authenticate` was called).
 * 3. Authorization check (if `authorize` was called).
 * 4. `fn(ctx)` — the actual business logic.
 * 5. Output Zod validation (if output schema was provided).
 *
 * Errors are caught globally:
 * - `NEXT_REDIRECT` — rethrown as-is (required for Next.js `redirect()`).
 * - `DrizzleQueryError` — returns `drizzle-error`.
 * - `ZodError` — returns `validation-error`.
 * - Anything else — returns `unexpected-error`.
 *
 * @param fn - Async function receiving the fully typed `Ctx` and returning a `DalReturn`.
 * @returns The operation wrapped in React `cache()` if `cfg.cache` is `true`.
 */
    operation<const T extends DalErrorReturn | (O extends undefined ? DalSuccessReturn : DalSuccessReturn<z.output<O>>) | void>(
        fn: (ctx: Ctx) => Promise<T>
    ) {


        const final = async (...args: I extends undefined ? [] : I): Promise<Returns[number] | T> => {
            try {
                if (this.inputSchema) {
                    try {
                        this.inputSchema.parse(args)
                    }
                    catch (error) {
                        if (error instanceof z.ZodError) {
                            return createErrorReturn({ type: "zod-input-error", error })
                        }
                    }
                }

                let session

                if (this.authentication) {
                    session = await auth()
                    if (!session) return createErrorReturn({ type: "unauthenticated" })

                    if (this.authorization) {
                        let dataResult
                        if (typeof this.authorization.data === "function") {
                            const res = await (this.authorization?.data)(...args)
                            if (!res) return createErrorReturn({ type: "unauthorized" })
                            dataResult = res
                        } else {
                            dataResult = this.authorization.data
                        }
                        if (!hasPermission(session.user, this.authorization.resource, this.authorization.action, dataResult)) {
                            return createErrorReturn({ type: "unauthorized" })
                        }
                    }
                }

                const res = await fn({
                    ...(session ? { user: session.user } : {}),
                    input: args
                } as unknown as Ctx)

                if (res) {
                    if (!res.success) return res

                    if (this.outputSchema) {
                        try {
                            this.outputSchema.parse(res.data)
                        } catch (error) {
                            if (error instanceof z.ZodError) {
                                return createErrorReturn({ type: "zod-output-error", error })
                            }
                        }
                    }

                    return createSuccessReturn(res.data)
                }



            } catch (error) {
                if (error && typeof error === "object" && "message" in error && error.message === "NEXT_REDIRECT") throw error;
                if (error instanceof DrizzleQueryError) {
                    console.error("Drizzle Query Error:", error)
                    return createErrorReturn({ type: "drizzle-error", error: error })
                }
                if (error instanceof z.ZodError) {
                    console.error("Zod error:", error)
                    return createErrorReturn({ type: "validation-error", error: error })
                }
                console.error("Unknown error:", error)
                return createErrorReturn({ type: "unexpected-error", error: error })
            }


        }

        return this.cfg?.cache ? cache(final) : final

    }
}







