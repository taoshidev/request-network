import { and, eq, gt, gte, inArray, lt, lte } from "drizzle-orm";
import { isTimestamp, convertToDate } from "../utils/datetime";

type ConditionType = "eq" | "in" | "lt" | "gt" | "lte" | "gte";

export interface Condition {
  type: ConditionType;
  column: string;
  value: any;
}

export const convertCondition = (condition: Condition, column: any) => {
  let value = condition.value;

  if (isTimestamp(value)) {
    value = convertToDate(value);
  }

  switch (condition.type) {
    case "eq":
      return eq(column, value);
    case "in":
      return inArray(column, value);
    case "lt":
      return lt(column, value);
    case "gt":
      return gt(column, value);
    case "lte":
      return lte(column, value);
    case "gte":
      return gte(column, value);
    default:
      throw new Error(`Unsupported condition type: ${condition.type}`);
  }
};

export const createWhereClause = (conditions: Condition[], schema: any) => {
  return and(
    ...conditions.map((condition: Condition) => {
      const column = schema[condition.column];
      return convertCondition(condition, column);
    })
  );
};
