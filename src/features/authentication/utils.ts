export function isBootstrapAdminEmail(email: string | null | undefined) {
  const configuredEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(configuredEmail && email?.trim().toLowerCase() === configuredEmail);
}
