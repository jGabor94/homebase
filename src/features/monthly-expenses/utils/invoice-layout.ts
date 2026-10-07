export const readStackedPaymentFields = (text: string) => {
  // Some utility PDFs serialize a two-column header as labels followed by their values.
  const match = /^[\t ]*Fizetendő[\t ]+(?:bruttó[\t ]+)?összeg:[\t ]*\r?\n[\t ]*(?:Fizetési|Befizetési)[\t ]+határidő:[\t ]*\r?\n[\t ]*([+−-]?\s*\d[\d\t .,]*(?:Ft\.?|HUF|forint))[\t ]*\r?\n[\t ]*(\d{4}[./-]\s*\d{1,2}[./-]\s*\d{1,2}\.?)[\t ]*$/imu.exec(text);
  if (!match) return null;
  const quote = match[0].trim();
  const index = match.index;
  return {
    amount: { value: match[1].trim(), quote, index },
    dueDate: { value: match[2].trim(), quote, index },
  };
};

export const readStackedIssuer = (text: string) => {
  const match = /^[\t ]*Szolgáltató[\t ]+neve:[\t ]*\r?\n[\t ]*Címe:[\t ]*\r?\n[\t ]*Adószáma:[\t ]*\r?\n[\t ]*Bankszámlaszáma:[\t ]*\r?\n[\t ]*((?:ALFÖLDVÍZ|ALFOLDVIZ|MVM(?:[\t ]+Next)?|MOHU)[^\r\n]*)/imu.exec(text);
  return match ? { value: match[1].trim(), quote: match[0].trim(), index: match.index } : null;
};

export const readStackedIssueDate = (text: string) => {
  // The issue date is the second value, after the performance date, in this column layout.
  const match = /^[\t ]*Teljesítés[\t ]+időpontja:[\t ]*\r?\n[\t ]*Számla[\t ]+kelte:[\t ]*\r?\n[\t ]*A[\t ]+szolgáltatás[\t ]+megnevezése:[\t ]*\r?\n[\t ]*\d{4}[./-]\s*\d{1,2}[./-]\s*\d{1,2}\.?[\t ]*\r?\n[\t ]*(\d{4}[./-]\s*\d{1,2}[./-]\s*\d{1,2}\.?)[\t ]*$/imu.exec(text);
  return match ? { value: match[1].trim(), quote: match[0].trim(), index: match.index } : null;
};
