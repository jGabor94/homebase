
export function mapDalErrorToHttpStatus(type: string): number {
    switch (type) {
        case "unauthenticated": return 401;
        case "unauthorized": return 403;
        case "validation-error": return 400;
        case "zod-input-error": return 400;
        case "zod-output-error": return 400;
        case "drizzle-error": return 500;
        case "not-found": return 404
        default: return 500;
    }
}