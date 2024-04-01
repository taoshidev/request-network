import { Request, Response, NextFunction } from "express";

/**
 * Interceptor for handling consumer request authentication.
 * Ensures that incoming requests have a valid token for authentication.
 */
export default class ConsumerRequestInterceptor {
  /**
   * Main interceptor function to check for the presence and validity of a consumer token.
   * @param {Request} req - The incoming request object from Express.
   * @param {Response} res - The outgoing response object for Express.
   * @param {NextFunction} next - Callback to pass control to the next middleware.
   * @returns {Promise<void>} - A promise that resolves when the authentication check is complete.
   * If authentication fails, it responds with an appropriate HTTP status code and error message.
   */
  requestInterceptor = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const token = this.getToken(req);
    if (!token) {
      return res.status(401).json({ error: "No consumer token provided" });
    }
    // Call Unkey or custom authentication service to verify the token
    const isAuthenticated = await this.verifyTokenWithUnkey(token);

    if (!isAuthenticated) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    next();
  };

  /**
   * Retrieves a token from the request headers, custom header, or query parameters.
   * @param {Request} req - The incoming request object.
   * @returns {string | null} - The extracted token, if found, otherwise null.
   */
  private getToken(req: Request): string | null {
    if (
      req.headers.authorization &&
      req.headers.authorization.split(" ")[0] === "Bearer"
    ) {
      return req.headers.authorization.split(" ")[1];
    } else if (req.headers["x-taoshi-consumer-request-key"]) {
      // Check for token in the custom x-taoshi-consumer-request-key header
      return req.headers["x-taoshi-consumer-request-key"] as string;
    } else if (req.query && req.query.token) {
      // Check for token in the query parameters
      return req.query.token as string;
    }

    return null;
  }

  /**
   * Verifies the provided token with Unkey or a custom authentication service.
   * @param {string} token - The token to verify.
   * @returns {Promise<boolean>} - A promise that resolves to true if the token is verified, otherwise false.
   */
  private verifyTokenWithUnkey(token: string) {
    // TODO: Verify token with Unkey
    return true;
  }
}
