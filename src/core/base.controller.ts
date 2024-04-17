import { Request, Response, NextFunction } from "express";
import DatabaseWrapper from "./database.wrapper";
import { PgTableWithColumns } from "drizzle-orm/pg-core";

interface RequestWithSchemaObject extends Request {
  [key: string]: any;
}

export class BaseController extends DatabaseWrapper<any> {
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

  public remove() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const data = await this.delete(req?.params?.id);
      if (data) {
        return res?.status(200).json(data);
      }
      return res?.status(404).json(data);
    };
  }
}
