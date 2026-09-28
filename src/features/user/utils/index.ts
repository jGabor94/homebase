import { Email } from "@/features/authentication/types";

/*
    Felhasználónév kivontolás az email címből.
*/
export const extractUsername = (email: Email): string => email.split('@')[0]