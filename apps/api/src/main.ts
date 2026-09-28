import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module.js";

const evidenceBytes = Number(process.env.MAX_EVIDENCE_BYTES ?? 10_485_760);
if (!Number.isSafeInteger(evidenceBytes) || evidenceBytes < 1) throw new Error("MAX_EVIDENCE_BYTES must be a positive safe integer");
const defaultBodyLimit = Math.ceil(evidenceBytes * 4 / 3) + 65_536;
const bodyLimit = Number(process.env.API_BODY_LIMIT_BYTES ?? defaultBodyLimit);
if (!Number.isSafeInteger(bodyLimit) || bodyLimit < 1) throw new Error("API_BODY_LIMIT_BYTES must be a positive safe integer");

const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ bodyLimit }));
const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.enableCors({ origin: allowedOrigins });
app.setGlobalPrefix("api");
await app.listen(Number(process.env.PORT ?? 4000), "0.0.0.0");
