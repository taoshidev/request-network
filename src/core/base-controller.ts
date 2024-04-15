import { Request, Response, NextFunction } from "express";
import DrizzleWrappter from "./drizzle-wrapper";
import { PgTableWithColumns } from "drizzle-orm/pg-core";

interface RequestWithSchemaObject extends Request {
  [key: string]: any;
}

export class BaseController extends DrizzleWrappter<any> {
  constructor(public schema: PgTableWithColumns<any>) {
    super(schema);
  }

  generateHash() {
    const segments = Array.from({ length: 8 }, () => this.randomSegment());
    return `${segments[0]}-${segments[1]}-${segments[2]}-${segments[3]}-${segments[4]}${segments[5]}${segments[6]}${segments[7]}`.slice(
      0,
      32
    );
  }

  randomSegment() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(18)
      .substring(1);
  }

  getToken(req: any) {
    if (
      req.headers.authorization &&
      req.headers.authorization.split(" ")[0] === "Bearer"
    ) {
      return req.headers.authorization.split(" ")[1];
    } else if (req.query && req.query.token) {
      return req.query.token;
    }
    return null;
  }

  requestInterceptor = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    // TODO: Lock down so only the request network api can access these endpoint
    next();
  };

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
