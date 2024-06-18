import axios, { AxiosRequestConfig, AxiosError, Method } from "axios";
import { Request, Response } from "express";
import Logger from "../utils/logger";

export enum StatusCode {
  NotFound = 404,
  Success = 200,
  Accepted = 202,
  BadRequest = 400,
  InternalServerError = 500,
}

export enum Message {
  GenericApiError = "Sorry something went wrong!",
  NotFoundError = "Object not found!",
  RequestError = "Error fetching response!",
  BadRequestError = "Request not valid!",
  APIError = "Failed to access Api!",
  AuthError = "Not authorized to access Api!",
}

/**
 * Class for handling HTTP requests to external APIs with enhanced logging and error handling.
 */
export default class HTTPRequest {
  private static outputServerApiUri: string =
    process.env.VALIDATOR_OUTPUT_SERVER_API_URL || "";

  constructor(private headers?: { [key: string]: string }) {
    this.fetch = this.fetch.bind(this);
    this.filterHeaders = this.filterHeaders.bind(this);
  }

  public static parseQuery(query: any): {
    [key: string]: string;
  } {
    return Object.entries(query).reduce(
      (
        acc: {
          [key: string]: string;
        },
        [key, value]: any
      ) => {
        acc[key] = Array.isArray(value) ? value.join(",") : value;
        return acc;
      },
      {}
    );
  }

  /**
   * Fetches data from an external API using axios and handles all aspects of making the HTTP request.
   * @param req The Express Request object.
   * @param res The Express Response object.
   * @returns A Promise that resolves to void.
   */
  public async fetch(req: Request, res: Response): Promise<void> {
    try {
      const { method, path, body, headers } = req;
      const endpoint = `${HTTPRequest.outputServerApiUri}${path}`;
      const query = HTTPRequest.parseQuery(req.query);
      const options: AxiosRequestConfig = {
        method: method as Method,
        url: endpoint,
        // 200 MB
        maxContentLength: 200 * 1024 * 1024,
        maxBodyLength: 200 * 1024 * 1024,
        headers: {
          ...(this.headers && this.headers),
          ...this.filterHeaders(headers),
        },
        ...(Object.keys(query).length && { params: query }),
        ...(["GET", "POST", "PUT", "PATCH"].includes(method) && { data: body }),
      };
      const response = await axios.request(options);
      HTTPRequest.send(res, response.data);
    } catch (error: AxiosError | Error | unknown) {
      const msg = (error as AxiosError)?.message || Message.APIError;
      Logger.error(msg);
      HTTPRequest.send(res, null, msg, StatusCode.InternalServerError);
    }
  }

  private filterHeaders(headers: any): {
    [key: string]: string;
  } {
    const excludedHeaders = ["host", "content-length", "connection"];
    return Object.entries(headers).reduce(
      (acc: { [key: string]: string }, [key, value]: any) => {
        if (
          !excludedHeaders.includes(key.toLowerCase()) &&
          key.toLowerCase() !== "authorization"
        ) {
          acc[key] = Array.isArray(value) ? value.join(",") : value;
        }
        return acc;
      },
      {
        ...(headers.authorization
          ? { Authorization: headers.authorization }
          : {}),
      }
    );
  }

  private static send(
    res: Response,
    data: any = null,
    error: string = "",
    statusCode: StatusCode = StatusCode.Success
  ) {
    if (res.headersSent) return;
    if (data) return res.status(statusCode).json(data);
    return res.status(statusCode).json({ error });
  }
}
