import Database from "../db/database";
import { PgTableWithColumns, SelectedFields } from "drizzle-orm/pg-core";
import { eq, getTableName, SQL } from "drizzle-orm";
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

export default abstract class DatabaseWrapper<T> {
  public tableName: string;
  protected db: PostgresJsDatabase<any>;

  constructor(protected schema: PgTableWithColumns<any>) {
    this.tableName = getTableName(schema);
    this.db = Database.db;
  }

  async find(
    where: SQL,
    filters?: SelectedFields,
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
      const res = await this.db
        .update(this.schema)
        .set(record)
        .returning();
      return { data: res as T, error: null };
    } catch (error) {
      console.error(error);
      return { data: null, error: error as DrizzleError };
    }
  }

  async updateSet(record: Partial<T>, where: SQL): Promise<DrizzleResult<T | T[]>> {
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
}
