import HyperExpress from "hyper-express";
import prisma from "../utils/prisma";
import { Saved } from "@prisma/client";

function setupSavedsEndpoints(server: HyperExpress.Server) {
  server.get("/api/saveds", async (request, response) => {
    try {
      const userId = request.payload?.userId;
      if (!userId) {
        return response.status(401).json({ error: "Unauthorized" });
      }

      const tsParam = request.query?.ts;
      let ts: number | null = null;
      if (tsParam) {
        const parsed = Number(tsParam);
        if (!isNaN(parsed)) ts = parsed;
      }

      const offsetParam = request.query?.os;
      const limitParam = request.query?.lm;
      let offset: number | undefined = undefined;
      let limit: number = 50;

      if (offsetParam) {
        const parsed = Number(offsetParam);
        if (!isNaN(parsed) && parsed >= 0) offset = parsed;
      }

      if (limitParam) {
        const parsed = Number(limitParam);
        if (!isNaN(parsed) && parsed > 0) limit = parsed;
      }

      const whereClause: any = { userId };
      if (ts !== null) whereClause.datetime = { gte: new Date(ts) };

      const saveds = await prisma.saved.findMany({
        where: whereClause,
        orderBy: { datetime: "desc" },
        skip: offset,
        take: Math.min(limit, 50),
        select: {
          mangaId: true,
          pluginId: true,
          datetime: true,
          updates: true,
        },
      });

      response.status(200).json(saveds);
    } catch (error) {
      response.status(400).json({ error: "Failed to retrieve saved items" });
    }
  });

  server.post("/api/saveds", async (request, response) => {
    try {
      const userId = request.payload?.userId;
      if (!userId) {
        return response.status(401).json({ error: "Unauthorized" });
      }

      const saveds = await request.json();
      if (!saveds || !Array.isArray(saveds)) {
        return response.status(400).json({ error: "Invalid saved items" });
      }

      const upsertPromises: Promise<Saved>[] = saveds.map(async (saved) => {
        const { mangaId, pluginId, datetime, updates } = saved;
        if (
          mangaId === undefined ||
          pluginId === undefined ||
          datetime === undefined ||
          updates === undefined
        ) {
          return Promise.reject(new Error("Missing required fields"));
        }

        const date = new Date(datetime);
        if (isNaN(date.getTime())) {
          return Promise.reject(new Error("Invalid datetime format"));
        }

        const storedSaved = await prisma.saved.findUnique({
          where: {
            mangaId_pluginId_userId: {
              userId,
              mangaId,
              pluginId,
            },
          },
        });

        if (!storedSaved) {
          return prisma.saved.create({
            data: {
              userId,
              mangaId,
              pluginId,
              datetime: date,
              updates,
            },
          });
        }

        if (date.getTime() > storedSaved.datetime.getTime()) {
          return prisma.saved.update({
            where: {
              mangaId_pluginId_userId: {
                userId,
                mangaId,
                pluginId,
              },
            },
            data: {
              datetime: date,
              updates,
            },
          });
        } else {
          return storedSaved;
        }
      });

      const results = await Promise.all(upsertPromises);

      response.status(200).json({
        message: "Saved items processed successfully",
        saveds: results,
      });
    } catch (error) {
      response.status(400).json({ error: "Failed to save item" });
    }
  });
}

export { setupSavedsEndpoints };
