import { Request } from "express";
import { ConsumerDTO } from "./consumer.dto.js";

export interface CustomRequestDTO extends Request {
  consumer?: Partial<ConsumerDTO>;
}
