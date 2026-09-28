export function isBootstrapAdminEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() === process.env.BOOTSTRAP_ADMIN_EMAIL;
}
