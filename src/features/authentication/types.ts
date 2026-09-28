import { CredentialsSignin } from "next-auth"

export type Credentials = {
    email: string,
    password: string
}

export type Email = `${string}@${string}`

export class EmailVerifiedError extends CredentialsSignin {
    code = "email-verified-error"
}