import { Request, Response } from "express";
import BaseController from "src/core/base.controller";
import { services } from "src/db/schema";
import Logger from "src/utils/logger";

export default class ServiceCtrl extends BaseController {
  constructor() {
    super(services);

  }

  updateService = async (req: Request, res: Response) => {
    try {
      const { body, params: { id } } = req;

      const updatedService = await this.update(id, body);
      return res
        .status(200)
        .json(updatedService);
    } catch (error) {
      Logger.error("Error updating service:" + JSON.stringify(error));
      return res
        .status(500)
        .json({ error: (error as Error)?.message || "Internal server error" });
    }
  }
}
