export const isTimestamp = (value: any) => {
  return typeof value === "number" && value > 0 && Number.isInteger(value);
};

export const convertToDate = (value: any) => {
  if (isTimestamp(value)) {
    return new Date(value);
  } else {
    throw new Error("Value is not a valid timestamp");
  }
};
