type SparseISO8601DTstring = `${number}-${number}-${number} ${number}:${number}:${number}${
  | "+"
  | "-"}${number}:${number}`;

const toSparseISO8601 = (date = new Date()) =>
  Utilities.formatDate(
    date,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd hh:mm:ssXXX"
  ) as SparseISO8601DTstring;

const offsetDays = (date: Date, days = 0) => {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
};
