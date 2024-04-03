import { Response, NextFunction } from "express";
import Auth from "./auth.js";
import Logger from "../utils/logger.js";
import { CustomRequestDTO } from "../db/dto/custom-request-dto.js";

export default class RnUiRequestInterceptor {
 static requestInterceptor = async (
    req: CustomRequestDTO,
    res: Response,
    next: NextFunction
  ) => {
    const token = await Auth.extractToken(req, "x-taoshi-request-key");
    // TODO: JWT verify the token
    if (!token) {
      Logger.error("Unauthorized");
      return res.status(403).json({ error: "Unauthorized" });
    }

    next();
  };
}
