import HyperExpress from "hyper-express";
import { Prisma } from "@prisma/client";
import prisma from "../utils/prisma";

async function fetchSyncData(
  userId: number,
  ts: number | null,
  offset: number | undefined,
  limit: number,
) {
  // --- 3. Fetch Data (Records) ---
  const whereRecords: any = { userId };
  if (ts !== null) whereRecords.updatedAt = { gte: new Date(ts) };

  const records = await prisma.record.findMany({
    where: whereRecords,
    orderBy: { datetime: "desc" },
    skip: offset,
    take: Math.min(limit, 50),
    select: {
      mangaId: true,
      pluginId: true,
      datetime: true,
      chapterId: true,
      chapterTitle: true,
      page: true,
    },
  });

  // --- 4. Fetch Data (Saveds - Active) ---
  const whereSaveds: any = { userId, isDeleted: false };
  if (ts !== null) whereSaveds.updatedAt = { gte: new Date(ts) };

  const saveds = await prisma.saved.findMany({
    where: whereSaveds,
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

  // --- 5. Fetch Data (Saveds - Deleted) ---
  const whereDeletedSaveds: any = { userId, isDeleted: true };
  if (ts !== null) whereDeletedSaveds.updatedAt = { gte: new Date(ts) };

  const deleted = await prisma.saved.findMany({
    where: whereDeletedSaveds,
    orderBy: { datetime: "desc" },
    skip: offset,
    take: Math.min(limit, 50),
    select: {
      mangaId: true,
      pluginId: true,
      datetime: true,
    },
  });

  return {
    records,
    saveds,
    deleted,
  };
}

function setupSyncEndpoints(server: HyperExpress.Server) {
  server.get("/api/sync", async (request, response) => {
    try {
      const userId = request.payload?.userId;
      if (!userId) {
        return response.status(401).json({ error: "Unauthorized" });
      }

      // --- Query Parameters for Fetching ---
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

      const data = await fetchSyncData(userId, ts, offset, limit);
      response.status(200).json(data);
    } catch (error) {
      console.error(error);
      response.status(400).json({ error: "Failed to fetch sync data" });
    }
  });

  server.post("/api/sync", async (request, response) => {
    try {
      const userId = request.payload?.userId;
      if (!userId) {
        return response.status(401).json({ error: "Unauthorized" });
      }

      // --- Query Parameters for Fetching ---
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

      // --- Body for Mutations ---
      const body = await request.json();
      const recordsToSync = Array.isArray(body.records) ? body.records : [];
      const savedsToSync = Array.isArray(body.saveds) ? body.saveds : [];

      const now = new Date();
      // --- 1. Handle Records Mutation (Upsert with Raw SQL) ---
      if (recordsToSync.length > 0) {
        const validRecords = recordsToSync.filter(
          (record: any) =>
            record.mangaId &&
            record.pluginId &&
            record.datetime &&
            record.chapterId &&
            record.page !== undefined,
        );

        if (validRecords.length > 0) {
          try {
            const valueTuples = validRecords.map((record: any) => {
              const date = new Date(record.datetime);
              return Prisma.sql`(${record.mangaId}, ${record.pluginId}, ${userId}, ${date}, ${record.chapterId}, ${record.chapterTitle ?? null}, ${record.page}, ${now})`;
            });

            const query = Prisma.sql`
              INSERT INTO "Record" ("mangaId", "pluginId", "userId", "datetime", "chapterId", "chapterTitle", "page", "updatedAt")
              VALUES ${Prisma.join(valueTuples)}
              ON CONFLICT ("mangaId", "pluginId", "userId")
              DO UPDATE SET
                "datetime" = excluded."datetime",
                "chapterId" = excluded."chapterId",
                "chapterTitle" = excluded."chapterTitle",
                "page" = excluded."page",
                "updatedAt" = excluded."updatedAt"
              WHERE excluded."datetime" > "Record"."datetime"
            `;

            await prisma.$executeRaw(query);
          } catch (e) {
            console.error("Error upserting records:", e);
          }
        }
      }

      // --- 2. Handle Saveds Mutation (Upsert with Raw SQL) ---
      if (savedsToSync.length > 0) {
        const validSaveds = savedsToSync.filter(
          (item: any) =>
            item.mangaId &&
            item.pluginId &&
            item.datetime &&
            item.updates !== undefined &&
            item.latestChapter !== undefined,
        );

        if (validSaveds.length > 0) {
          try {
            const valueTuples = validSaveds.map((item: any) => {
              const newDate = new Date(item.datetime);
              return Prisma.sql`(${item.mangaId}, ${item.pluginId}, ${userId}, ${newDate}, ${item.updates}, ${item.latestChapter}, false, ${now})`;
            });

            const query = Prisma.sql`
              INSERT INTO "Saved" ("mangaId", "pluginId", "userId", "datetime", "updates", "latestChapter", "isDeleted", "updatedAt")
              VALUES ${Prisma.join(valueTuples)}
              ON CONFLICT ("mangaId", "pluginId", "userId")
              DO UPDATE SET
                "datetime" = excluded."datetime",
                "updates" = excluded."updates",
                "latestChapter" = excluded."latestChapter",
                "isDeleted" = excluded."isDeleted",
                "updatedAt" = excluded."updatedAt"
              WHERE excluded."datetime" > "Saved"."datetime"
            `;

            await prisma.$executeRaw(query);
          } catch (e) {
            console.error("Error upserting saved:", e);
          }
        }
      }

      const data = await fetchSyncData(userId, ts, offset, limit);
      response.status(200).json(data);
    } catch (error) {
      console.error(error);
      response.status(400).json({ error: "Failed to sync" });
    }
  });
}

export { setupSyncEndpoints };
