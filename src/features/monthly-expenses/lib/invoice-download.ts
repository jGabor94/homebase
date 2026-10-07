import "server-only";
import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { DOWNLOAD_TIMEOUT_MS, MAX_DOWNLOAD_REDIRECTS, MAX_INVOICE_DOWNLOAD_BYTES } from "../config";
import { InvoiceProcessingError } from "./errors";

const blockedAddresses = new BlockList();
for (const [address, prefix, type] of [
  ["0.0.0.0", 8, "ipv4"], ["10.0.0.0", 8, "ipv4"], ["100.64.0.0", 10, "ipv4"],
  ["127.0.0.0", 8, "ipv4"], ["169.254.0.0", 16, "ipv4"], ["172.16.0.0", 12, "ipv4"],
  ["192.0.0.0", 24, "ipv4"], ["192.0.2.0", 24, "ipv4"], ["192.168.0.0", 16, "ipv4"],
  ["198.18.0.0", 15, "ipv4"], ["198.51.100.0", 24, "ipv4"], ["203.0.113.0", 24, "ipv4"],
  ["224.0.0.0", 4, "ipv4"], ["240.0.0.0", 4, "ipv4"],
  ["::", 128, "ipv6"], ["::1", 128, "ipv6"], ["::ffff:0:0", 96, "ipv6"],
  ["fc00::", 7, "ipv6"], ["fe80::", 10, "ipv6"], ["ff00::", 8, "ipv6"], ["2001:db8::", 32, "ipv6"],
] as const) {
  blockedAddresses.addSubnet(address, prefix, type);
}

const getAllowedHostnames = () => new Set((process.env.MONTHLY_EXPENSES_INVOICE_HOSTS ?? "")
  .split(",")
  .map((hostname) => hostname.trim().toLowerCase().replace(/\.$/u, ""))
  .filter((hostname) => /^[a-z0-9.-]+$/u.test(hostname) && !hostname.includes("..")));

const decodeUrlComponent = (value: string) => {
  let decoded = value;
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
    if (/%[0-9a-f]{2}/iu.test(decoded)) return null;
    return decoded;
  } catch { return null; }
};

const isPaymentOrAccountLink = (url: URL) => {
  const decodedPath = decodeUrlComponent(url.pathname);
  if (decodedPath === null) return true;
  const pathSegments = decodedPath.toLowerCase().split("/").filter(Boolean);
  const sensitiveSegments = new Set(["pay", "payment", "checkout", "payer", "subscribe", "cart", "order", "login", "logout", "account", "preferences", "settings", "profile"]);
  if (pathSegments.some((segment) => sensitiveSegments.has(segment))) return true;
  for (const key of url.searchParams.keys()) {
    if (["pay", "payment", "checkout", "cart", "order", "login", "logout", "account", "preferences"].includes(key.toLowerCase())) return true;
  }
  return false;
};

export const isConfiguredInvoiceDownloadUrl = (candidate: string) => {
  try {
    const url = new URL(candidate);
    return url.protocol === "https:"
      && url.username === ""
      && url.password === ""
      && (url.port === "" || url.port === "443")
      && getAllowedHostnames().has(url.hostname.toLowerCase().replace(/\.$/u, ""))
      && isIP(url.hostname) === 0
      && !isPaymentOrAccountLink(url);
  } catch {
    return false;
  }
};

const resolvePublicDns = async (hostname: string) => {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => {
    const type = isIP(address) === 6 ? "ipv6" : "ipv4";
    return blockedAddresses.check(address, type);
  })) {
    throw new InvoiceProcessingError("blocked-download-host", "A számlaletöltő cím nem biztonságos.");
  }
  return addresses[0].address;
};

type PinnedResponse = { status: number; contentType: string; location: string | null; bytes: Uint8Array };

const requestPinned = (url: URL, address: string): Promise<PinnedResponse> => new Promise((resolve, reject) => {
  let settled = false;
  const fail = (error: Error) => {
    if (settled) return;
    settled = true;
    reject(error);
  };
  const pinnedLookup = ((hostname: string, _options: unknown, callback: (error: NodeJS.ErrnoException | null, address: string, family: number) => void) => {
    if (hostname.toLowerCase() !== url.hostname.toLowerCase()) {
      callback(new Error("unexpected-host"), "", 0);
      return;
    }
    callback(null, address, isIP(address));
  }) as LookupFunction;

  const request = httpsRequest(url, {
    method: "GET",
    headers: { Accept: "application/pdf" },
    lookup: pinnedLookup,
    servername: url.hostname,
    family: isIP(address),
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    timeout: DOWNLOAD_TIMEOUT_MS,
    agent: false,
  }, (response) => {
    const status = response.statusCode ?? 0;
    const contentType = String(response.headers["content-type"] ?? "").toLowerCase();
    const location = typeof response.headers.location === "string" ? response.headers.location : null;
    if ([301, 302, 303, 307, 308].includes(status)) {
      settled = true;
      response.destroy();
      resolve({ status, contentType, location, bytes: new Uint8Array() });
      return;
    }

    const rawLength = response.headers["content-length"];
    const contentLength = typeof rawLength === "string" ? Number(rawLength) : NaN;
    if (Number.isFinite(contentLength) && contentLength > MAX_INVOICE_DOWNLOAD_BYTES) {
      response.destroy();
      fail(new InvoiceProcessingError("download-too-large", "A számla PDF nagyobb a 3 MiB-os korlátnál."));
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    response.on("data", (chunk: Buffer | string) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.byteLength;
      if (size > MAX_INVOICE_DOWNLOAD_BYTES) {
        response.destroy();
        fail(new InvoiceProcessingError("download-too-large", "A számla PDF nagyobb a 3 MiB-os korlátnál."));
        return;
      }
      chunks.push(bytes);
    });
    response.on("end", () => {
      if (settled) return;
      settled = true;
      resolve({ status, contentType, location, bytes: new Uint8Array(Buffer.concat(chunks, size)) });
    });
    response.on("aborted", () => fail(new InvoiceProcessingError("download-truncated", "A számlaletöltés idő előtt megszakadt.")));
    response.on("error", (error) => fail(error));
  });
  request.on("timeout", () => request.destroy(new InvoiceProcessingError("download-timeout", "A számlaletöltés túllépte az időkorlátot.")));
  request.on("error", (error) => fail(error));
  request.end();
});

export const extractAllowedInvoiceLinks = (htmlBodies: string[]) => {
  const links: string[] = [];
  const allowed = getAllowedHostnames();

  for (const html of htmlBodies) {
    const anchorExpression = /<a\b([^>]*?)href\s*=\s*(["'])(.*?)\2([^>]*)>([\s\S]*?)<\/a\s*>/giu;
    for (const match of html.matchAll(anchorExpression)) {
      const candidate = (match[3] ?? "")
        .replace(/&amp;/giu, "&")
        .replace(/&quot;/giu, '"')
        .replace(/&#39;|&apos;/giu, "'")
        .replace(/&lt;/giu, "<")
        .replace(/&gt;/giu, ">");
      if (!isConfiguredInvoiceDownloadUrl(candidate)) continue;
      const url = new URL(candidate);
      const hostname = url.hostname.toLowerCase().replace(/\.$/u, "");
      const rawLabel = `${match[1] ?? ""} ${match[4] ?? ""} ${(match[5] ?? "").replace(/<[^>]*>/gu, " ")}`;
      const label = rawLabel.replace(/&amp;/giu, "&").replace(/&quot;/giu, '"')
        .replace(/&#39;|&apos;/giu, "'").replace(/&lt;/giu, "<").replace(/&gt;/giu, ">")
        .normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
      const decodedPath = decodeUrlComponent(url.pathname);
      const decodedQuery = decodeUrlComponent(url.search);
      if (decodedPath === null || decodedQuery === null) continue;
      const urlText = `${decodedPath} ${decodedQuery}`.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
      if (!/(?:szamla|invoice|download|letoltes|\.pdf|dokumentum)/u.test(`${urlText} ${label}`)) continue;
      if (allowed.has(hostname) && !links.includes(candidate)) links.push(candidate);
      if (links.length >= 10) return links;
    }
  }

  return links;
};

export const downloadInvoicePdfFromAllowedUrl = async (initialUrl: string) => {
  if (!isConfiguredInvoiceDownloadUrl(initialUrl)) {
    throw new InvoiceProcessingError("unsupported-download-host", "A számlaletöltő oldal nincs engedélyezve. PDF-feltöltéssel folytathatod.");
  }

  let currentUrl = initialUrl;
  for (let redirects = 0; redirects <= MAX_DOWNLOAD_REDIRECTS; redirects += 1) {
    const url = new URL(currentUrl);
    let pinnedAddress: string;
    try {
      pinnedAddress = await resolvePublicDns(url.hostname);
    } catch (error) {
      if (error instanceof InvoiceProcessingError) throw error;
      throw new InvoiceProcessingError("download-dns-error", "A számlaletöltő cím nem érhető el biztonságosan.");
    }

    let response: PinnedResponse;
    try {
      response = await requestPinned(url, pinnedAddress);
    } catch (error) {
      if (error instanceof InvoiceProcessingError) throw error;
      throw new InvoiceProcessingError("download-timeout", "A számlaletöltés megszakadt vagy túllépte az időkorlátot.");
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirects === MAX_DOWNLOAD_REDIRECTS) {
        throw new InvoiceProcessingError("too-many-redirects", "A számlaletöltő túl sok átirányítást küldött.");
      }
      const location = response.location;
      if (!location) throw new InvoiceProcessingError("invalid-redirect", "A számlaletöltő átirányítása hibás.");
      const nextUrl = new URL(location, currentUrl).toString();
      if (!isConfiguredInvoiceDownloadUrl(nextUrl)) {
        throw new InvoiceProcessingError("blocked-redirect", "A számlaletöltő nem engedélyezett címre irányítana.");
      }
      currentUrl = nextUrl;
      continue;
    }

    if (response.status < 200 || response.status >= 300 || !response.contentType.includes("application/pdf")) {
      throw new InvoiceProcessingError("download-not-pdf", "A számlalink nem közvetlenül letölthető PDF-re mutat. Töltsd fel kézzel a számlát.");
    }
    const bytes = response.bytes;
    if (!/^%PDF-\d\.\d/u.test(new TextDecoder("ascii").decode(bytes.subarray(0, Math.min(bytes.length, 32)))) ) {
      throw new InvoiceProcessingError("download-not-pdf", "A számlalink nem PDF-fájlt adott. Töltsd fel kézzel a számlát.");
    }
    return bytes;
  }

  throw new InvoiceProcessingError("too-many-redirects", "A számlaletöltő túl sok átirányítást küldött.");
};
