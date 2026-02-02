import HyperExpress from "hyper-express";
import prisma from "../utils/prisma";

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

      const whereClause: any = { userId, isDeleted: false };
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
      console.error(error);
      response.status(400).json({ error: "Failed to retrieve saved items" });
    }
  });

  server.get("/api/saveds/deleted", async (request, response) => {
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

      const whereClause: any = { userId, isDeleted: true };
      if (ts !== null) whereClause.updatedAt = { gte: new Date(ts) };

      const saveds = await prisma.saved.findMany({
        where: whereClause,
        orderBy: { updatedAt: "desc" },
        skip: offset,
        take: Math.min(limit, 50),
        select: {
          mangaId: true,
          pluginId: true,
          datetime: true,
        },
      });

      response.status(200).json(saveds);
    } catch (error) {
      console.error(error);
      response.status(400).json({ error: "Failed to retrieve deleted items" });
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

      // Fetch all relevant saved items in a single query
      const keys = saveds.map((s) => ({
        mangaId: s.mangaId,
        pluginId: s.pluginId,
      }));

      const storedSaveds = await prisma.saved.findMany({
        where: {
          userId,
          OR: keys,
        },
      });

      // Create a map for quick lookup
      const storedMap = new Map(
        storedSaveds.map((s) => [`${s.mangaId}|${s.pluginId}`, s]),
      );

      // Determine which items need to be updated
      const toUpdate = [];
      for (const saved of saveds) {
        const key = `${saved.mangaId}|${saved.pluginId}`;
        const stored = storedMap.get(key);

        if (!stored) {
          // Ignore items that don't exist in the database
          continue;
        }

        const date = new Date(saved.datetime);
        if (date.getTime() > stored.datetime.getTime()) {
          toUpdate.push({
            where: {
              mangaId_pluginId_userId: {
                userId,
                mangaId: saved.mangaId,
                pluginId: saved.pluginId,
              },
            },
            data: {
              datetime: date,
              updates: saved.updates,
              latestChapter: saved.latestChapter,
              isDeleted: false,
            },
          });
        }
      }

      // Batch update all items in a transaction
      const results =
        toUpdate.length > 0
          ? await prisma.$transaction(
              toUpdate.map((update) => prisma.saved.update(update)),
            )
          : [];

      // Combine updated and unchanged items
      const allResults = saveds
        .map((s) => {
          const key = `${s.mangaId}|${s.pluginId}`;
          const stored = storedMap.get(key);
          if (!stored) return null;

          const updated = results.find(
            (r) => r.mangaId === s.mangaId && r.pluginId === s.pluginId,
          );
          return updated || stored;
        })
        .filter((s) => s !== null);

      response.status(200).json({
        message: "Saved items processed successfully",
        saveds: allResults,
      });
    } catch (error) {
      console.error(error);
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
        where: { userId, isDeleted: false },
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
      console.error(error);
      response.status(400).json({ error: "Failed to generate hash" });
    }
  });

  server.post("/api/saveds/add", async (request, response) => {
    try {
      const userId = request.payload?.userId;
      if (!userId) {
        return response.status(401).json({ error: "Unauthorized" });
      }

      const items = await request.json();
      if (!Array.isArray(items)) {
        return response.status(400).json({ error: "Expected array of items" });
      }

      if (items.length === 0) {
        return response.status(200).json({ message: "No items to add" });
      }

      const operations = [];
      const keys = items.map((i) => ({
        mangaId: i.mangaId,
        pluginId: i.pluginId,
      }));

      // optimize by fetching existing ones first
      const existingRecords = await prisma.saved.findMany({
        where: {
          userId,
          OR: keys,
        },
      });

      const existingMap = new Map(
        existingRecords.map((r) => [`${r.mangaId}|${r.pluginId}`, r]),
      );

      for (const item of items) {
        if (
          !item.mangaId ||
          !item.pluginId ||
          !item.datetime ||
          item.updates === undefined ||
          item.latestChapter === undefined
        ) {
          continue; // Skip invalid items or return error? Skipping is safer for batch.
        }

        const key = `${item.mangaId}|${item.pluginId}`;
        const existing = existingMap.get(key);
        const newDate = new Date(item.datetime);

        if (existing) {
          if (newDate > existing.datetime) {
            operations.push(
              prisma.saved.update({
                where: {
                  mangaId_pluginId_userId: {
                    mangaId: item.mangaId,
                    pluginId: item.pluginId,
                    userId,
                  },
                },
                data: {
                  datetime: newDate,
                  updates: item.updates,
                  latestChapter: item.latestChapter,
                  isDeleted: false,
                },
              }),
            );
          }
        } else {
          operations.push(
            prisma.saved.create({
              data: {
                mangaId: item.mangaId,
                pluginId: item.pluginId,
                userId,
                datetime: newDate,
                updates: item.updates,
                latestChapter: item.latestChapter,
                isDeleted: false,
              },
            }),
          );
        }
      }

      if (operations.length > 0) {
        await prisma.$transaction(operations);
      }

      response.status(200).json({ message: "Items processed successfully" });
    } catch (error) {
      console.error(error);
      response.status(500).json({ error: "Failed to add items" });
    }
  });

  server.post("/api/saveds/remove", async (request, response) => {
    try {
      const userId = request.payload?.userId;
      if (!userId) {
        return response.status(401).json({ error: "Unauthorized" });
      }

      const items = await request.json();
      if (!Array.isArray(items)) {
        return response.status(400).json({ error: "Expected array of items" });
      }

      const keys = items.map((i) => ({
        mangaId: i.mangaId,
        pluginId: i.pluginId,
      }));

      if (keys.length > 0) {
        await prisma.saved.updateMany({
          where: {
            userId,
            OR: keys,
          },
          data: {
            datetime: new Date(),
            isDeleted: true,
          },
        });
      }

      response.status(200).json({ message: "Items removed successfully" });
    } catch (error) {
      console.error(error);
      response.status(500).json({ error: "Failed to remove items" });
    }
  });
}

export { setupSavedsEndpoints };
