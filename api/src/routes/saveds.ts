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
      if (ts !== null) whereClause.updatedAt = { gte: new Date(ts) };

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
          latestChapter: true,
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

      const updatePromises: Promise<Saved | null>[] = saveds.map(
        async (saved) => {
          const { mangaId, pluginId, datetime, updates, latestChapter } = saved;
          if (
            mangaId === undefined ||
            pluginId === undefined ||
            datetime === undefined ||
            updates === undefined ||
            latestChapter === undefined
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
            // Ignore items that don't exist in the database
            return null;
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
                latestChapter,
              },
            });
          } else {
            return storedSaved;
          }
        }
      );

      const results = await Promise.all(updatePromises);
      const updatedSaveds = results.filter((saved) => saved !== null);

      response.status(200).json({
        message: "Saved items processed successfully",
        saveds: updatedSaveds,
      });
    } catch (error) {
      response.status(400).json({ error: "Failed to save item" });
    }
  });

  server.put("/api/saveds", async (request, response) => {
    try {
      const userId = request.payload?.userId;
      if (!userId) {
        return response.status(401).json({ error: "Unauthorized" });
      }

      const saveds = await request.json();
      if (!saveds || !Array.isArray(saveds)) {
        return response.status(400).json({ error: "Invalid saved items" });
      }

      // Validate all items first
      for (const saved of saveds) {
        const { mangaId, pluginId, datetime, updates, latestChapter } = saved;
        if (
          mangaId === undefined ||
          pluginId === undefined ||
          datetime === undefined ||
          updates === undefined ||
          latestChapter === undefined
        ) {
          return response
            .status(400)
            .json({ error: "Missing required fields" });
        }

        const date = new Date(datetime);
        if (isNaN(date.getTime())) {
          return response
            .status(400)
            .json({ error: "Invalid datetime format" });
        }
      }

      // Delete all existing saved items for this user
      await prisma.saved.deleteMany({
        where: { userId },
      });

      // Create all new saved items
      const createPromises = saveds.map((saved) => {
        const { mangaId, pluginId, datetime, updates, latestChapter } = saved;
        return prisma.saved.create({
          data: {
            userId,
            mangaId,
            pluginId,
            datetime: new Date(datetime),
            updates,
            latestChapter,
          },
        });
      });

      const results = await Promise.all(createPromises);

      response.status(200).json({
        message: "Saved items replaced successfully",
        saveds: results,
      });
    } catch (error) {
      response.status(400).json({ error: "Failed to save item" });
    }
  });

  server.get("/api/saveds/hash", async (request, response) => {
    try {
      const userId = request.payload?.userId;
      if (!userId) {
        return response.status(401).json({ error: "Unauthorized" });
      }

      // Fetch all saved items for the user, sorted by primary key
      const saveds = await prisma.saved.findMany({
        where: { userId },
        orderBy: [{ mangaId: "asc" }, { pluginId: "asc" }],
        select: {
          mangaId: true,
          pluginId: true,
          datetime: true,
          updates: true,
          latestChapter: true,
        },
      });

      // Concatenate primary keys
      const keyString = saveds
        .map((saved) => `${saved.mangaId}|${saved.pluginId}`)
        .join("");

      // Generate hash using Node's crypto module
      const crypto = require("crypto");
      const hash = crypto.createHash("sha256").update(keyString).digest("hex");

      response.status(200).json({ hash });
    } catch (error) {
      response.status(400).json({ error: "Failed to generate hash" });
    }
  });
}

export { setupSavedsEndpoints };
