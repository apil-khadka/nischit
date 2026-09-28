import { Module } from "@nestjs/common";
import { AppController } from "./app.controller.js";
import { EngineService } from "./engine.service.js";

@Module({ controllers: [AppController], providers: [EngineService] })
export class AppModule {}
