import express, { Express, Request, Response } from "express";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import cors from "cors";
import helmet from "helmet";
import * as dotenv from "dotenv";
import Auth from "./auth/auth.js";
import AuthRoutes from "./router/auth-routes.js";

dotenv.config({ path: ".env" });

export default class App {
  public express: Express;
  private supabase!: SupabaseClient;

  constructor() {
    this.express = express();
    this.initializeMiddlewares();
    this.initializeSupabase();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    this.express.use(cors());
    this.express.use(helmet());
    this.express.use(express.json());
    this.express.use(express.urlencoded({ extended: true }));
  }

  private initializeSupabase(): void {
    const supabaseUrl: string = process.env.SUPABASE_URL || "";
    const supabaseKey: string = process.env.SUPABASE_KEY || "";
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  private initializeRoutes(): void {
    this.express.get("/", (req: Request, res: Response) => {
      res.json({ message: "Validator online..." });
    });
    const auth = new Auth(this.supabase);
    const authRoutes = new AuthRoutes(auth);
    authRoutes.initializeRoutes();
  }

  private initializeErrorHandling(): void {
    this.express.use((req, res, next) => {
      res.status(404).send("The resource requested cannot be found!");
    });

    this.express.use(
      (err: any, req: Request, res: Response, next: Function) => {
        console.error(err.stack);
        const statusCode = err.statusCode || 500;
        const errorMessage = err.message || "Internal Server Error";
        res.status(statusCode).json({ error: errorMessage });
      }
    );
  }

  public listen(): void {
    const port: number | string = process.env.API_PORT || 3000;
    this.express.listen(port, () => {
      console.log(`Server running at ${process.env.API_HOST}:${process.env.API_PORT}`);
    });
  }

}
