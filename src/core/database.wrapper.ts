import Database from "../db/database";
import { PgTableWithColumns, SelectedFields } from "drizzle-orm/pg-core";
import {
  and,
  eq,
  getTableName,
  gt,
  gte,
  inArray,
  lt,
  lte,
  sql,
  SQL,
} from "drizzle-orm";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema";

export interface DrizzleError {
  severity_local: string;
  severity: string;
  code: string;
  message: string;
  file: string;
  line: string;
  routine: string;
}

export interface DrizzleResult<T> {
  data: T | null;
  error: DrizzleError | null;
}

type Schema = typeof schema;
type SchemaTableNames = keyof Schema;

export default abstract class DatabaseWrapper<T> {
  public tableName: string;
  protected db: PostgresJsDatabase<any>;

  constructor(protected schema: PgTableWithColumns<any>) {
    this.tableName = getTableName(schema);
    this.db = Database.db;
  }

  async find(
    where: SQL,
    filters?: SelectedFields
  ): Promise<DrizzleResult<T[]>> {
    try {
      const res = await this.db
        .select((filters && filters) as SelectedFields)
        .from(this.schema)
        .where(where);
      return { data: res as T[], error: null };
    } catch (error) {
      console.error(error);
      return { data: null, error: error as DrizzleError };
    }
  }

  async all(): Promise<DrizzleResult<T[]>> {
    try {
      const res = await this.db.select().from(this.schema);
      return { data: res as T[], error: null };
    } catch (error) {
      console.error(error);
      return { data: null, error: error as DrizzleError };
    }
  }

  async one(id: string): Promise<DrizzleResult<T>> {
    try {
      const res = await this.db
        .select()
        .from(this.schema)
        .where(eq(this.schema.id, id));
      return { data: res?.[0] as T, error: null };
    } catch (error) {
      console.error(error);
      return { data: null, error: error as DrizzleError };
    }
  }

  async create(record: Partial<T>): Promise<DrizzleResult<T | T[]>> {
    try {
      const res = await this.db.insert(this.schema).values(record).returning();
      return { data: res as T, error: null };
    } catch (error) {
      console.error(error);
      return { data: null, error: error as DrizzleError };
    }
  }

  async update(id: string, record: Partial<T>): Promise<DrizzleResult<T>> {
    try {
      const res = await this.db
        .update(this.schema)
        .set(record)
        .where(eq(this.schema.id, id))
        .returning();

      return { data: res as T, error: null };
    } catch (error) {
      console.error(error);
      return { data: null, error: error as DrizzleError };
    }
  }

  async updateMany(record: Partial<T>): Promise<DrizzleResult<T | T[]>> {
    try {
      const res = await this.db.update(this.schema).set(record).returning();
      return { data: res as T, error: null };
    } catch (error) {
      console.error(error);
      return { data: null, error: error as DrizzleError };
    }
  }

  async updateSet(
    record: Partial<T>,
    where: SQL
  ): Promise<DrizzleResult<T | T[]>> {
    try {
      const res = await this.db
        .update(this.schema)
        .set(record)
        .where(where)
        .returning();

      return { data: res as T, error: null };
    } catch (error) {
      console.error(error);
      return { data: null, error: error as DrizzleError };
    }
  }

  async delete(id: string): Promise<DrizzleResult<T>> {
    try {
      const res = await this.db
        .delete(this.schema)
        .where(eq(this.schema.id, id))
        .returning({ deletedId: this.schema.id });
      return { data: res as T, error: null };
    } catch (error) {
      console.error(error);
      return { data: null, error: error as DrizzleError };
    }
  }

  public async dynamicQuery(query: any): Promise<DrizzleResult<any[]>> {
    try {
      const { where, with: withRelations } = query;

      const tableQuery = (this.db.query as { [key: string]: any })[
        this.tableName as SchemaTableNames
      ];

      let whereClause = undefined;
      if (where) {
        whereClause = and(
          ...where.map((condition: any) => {
            switch (condition.type) {
              case "eq":
                return eq(this.schema[condition.column], condition.value);
              case "in":
                return inArray(this.schema[condition.column], condition.value);
              case "lt":
                return lt(this.schema[condition.column], condition.value);
              case "gt":
                return gt(this.schema[condition.column], condition.value);
              case "lte":
                return lte(this.schema[condition.column], condition.value);
              case "gte":
                return gte(this.schema[condition.column], condition.value);
              default:
                throw new Error(
                  `Unsupported condition type: ${condition.type}`
                );
            }
          })
        );
      }

      const dbQuery = tableQuery.findMany({
        where: whereClause,
        with: withRelations,
      });

      const results = await dbQuery;
      return { data: results, error: null };
    } catch (error) {
      console.error(error);
      return { data: null, error: error as DrizzleError };
    }
  }
}
