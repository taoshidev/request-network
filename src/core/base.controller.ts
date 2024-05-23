import { Request, Response, NextFunction } from "express";
import DatabaseWrapper from "./database.wrapper";
import { PgTableWithColumns } from "drizzle-orm/pg-core";
import { eq, exists } from "drizzle-orm";
import { DrizzleError } from "drizzle-orm";

interface RequestWithSchemaObject extends Request {
  [key: string]: any;
}

export default class BaseController extends DatabaseWrapper<any> {
  constructor(public schema: PgTableWithColumns<any>) {
    super(schema);
  }

  public findByIdInterceptor() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const data = await this.one(req.params.id);
      if (data) {
        (req as RequestWithSchemaObject)[this.tableName] = data;
      }
      next();
    };
  }

  public findOne() {
    return async (req: Request, res: Response, next: NextFunction) => {
      if ((req as RequestWithSchemaObject)[this.tableName] != null) {
        return res
          ?.status(200)
          .json((req as RequestWithSchemaObject)[this.tableName]);
      }
      return res?.status(404).json();
    };
  }

  public findAll() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const data = await this.all();
      if (data) {
        return res?.status(200).json(data);
      }
      return res?.status(404).json(data);
    };
  }

  public insert() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const data = await this.create(req?.body);
      if (data) {
        return res?.status(200).json(data);
      }
      return res?.status(404).json(data);
    };
  }

  public mutate() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const data = await this.update(req?.params?.id, req.body);
      if (data) {
        return res?.status(200).json(data);
      }
      return res?.status(404).json(data);
    };
  }

  public updateByKey() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const paramKeys = Object.keys(req.params);
      if (paramKeys.length === 0) {
        return res.status(400).json({ error: "No key found in the route." });
      }

      const key = paramKeys[0];
      const keyValue = req.params[key];
      const value = req.params[paramKeys[1]];

      if (!this.schema[keyValue]) {
        return res
          .status(400)
          .json({ error: `Invalid key '${key}' provided.` });
      }

      const record = this.db
        .select()
        .from(this.schema)
        .where(eq(this.schema[keyValue], value));

      if (!record) {
        return {
          data: null,
          error: { message: "No record found to update." } as DrizzleError,
        };
      }

      const data = await this.updateSet(
        req.body,
        (eq(this.schema[keyValue], value), exists(record))
      );

      if (data) {
        return res?.status(200).json(data);
      }
      return res?.status(404).json(data);
    };
  }

  public remove() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const data = await this.delete(req?.params?.id);
      if (data) {
        return res?.status(200).json(data);
      }
      return res?.status(404).json(data);
    };
  }

  public query() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const data = await this.dynamicQuery(req?.body);
      if (data) {
        return res?.status(200).json(data);
      }
      return res?.status(404).json(data);
    };
  }
}
