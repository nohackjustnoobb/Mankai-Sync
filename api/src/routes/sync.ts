import HyperExpress from "hyper-express";
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

      // --- 1. Handle Records Mutation (Upsert) ---
      if (recordsToSync.length > 0) {
        const keys = recordsToSync.map((r: any) => ({
          mangaId: r.mangaId,
          pluginId: r.pluginId,
        }));

        const existingRecords = await prisma.record.findMany({
          where: {
            userId,
            OR: keys,
          },
        });

        const existingMap = new Map(
          existingRecords.map((r) => [`${r.mangaId}|${r.pluginId}`, r]),
        );

        const recordOps = [];
        for (const record of recordsToSync) {
          if (
            !record.mangaId ||
            !record.pluginId ||
            !record.datetime ||
            record.page === undefined
          )
            continue;

          const key = `${record.mangaId}|${record.pluginId}`;
          const stored = existingMap.get(key);
          const date = new Date(record.datetime);

          if (stored) {
            if (date.getTime() > stored.datetime.getTime()) {
              recordOps.push(
                prisma.record.update({
                  where: {
                    mangaId_pluginId_userId: {
                      userId,
                      mangaId: record.mangaId,
                      pluginId: record.pluginId,
                    },
                  },
                  data: {
                    datetime: date,
                    chapterId: record.chapterId,
                    chapterTitle: record.chapterTitle,
                    page: record.page,
                  },
                }),
              );
            }
          } else {
            recordOps.push(
              prisma.record.create({
                data: {
                  userId,
                  mangaId: record.mangaId,
                  pluginId: record.pluginId,
                  datetime: date,
                  chapterId: record.chapterId,
                  chapterTitle: record.chapterTitle,
                  page: record.page,
                },
              }),
            );
          }
        }

        if (recordOps.length > 0) {
          await prisma.$transaction(recordOps);
        }
      }

      // --- 2. Handle Saveds Mutation (Upsert) ---
      if (savedsToSync.length > 0) {
        const keys = savedsToSync.map((s: any) => ({
          mangaId: s.mangaId,
          pluginId: s.pluginId,
        }));

        const existingSaveds = await prisma.saved.findMany({
          where: {
            userId,
            OR: keys,
          },
        });

        const existingMap = new Map(
          existingSaveds.map((s) => [`${s.mangaId}|${s.pluginId}`, s]),
        );

        const savedOps = [];
        for (const item of savedsToSync) {
          if (
            !item.mangaId ||
            !item.pluginId ||
            !item.datetime ||
            item.updates === undefined ||
            item.latestChapter === undefined
          ) {
            continue;
          }

          const key = `${item.mangaId}|${item.pluginId}`;
          const existing = existingMap.get(key);
          const newDate = new Date(item.datetime);

          if (existing) {
            if (newDate > existing.datetime) {
              savedOps.push(
                prisma.saved.update({
                  where: {
                    mangaId_pluginId_userId: {
                      userId,
                      mangaId: item.mangaId,
                      pluginId: item.pluginId,
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
            savedOps.push(
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

        if (savedOps.length > 0) {
          await prisma.$transaction(savedOps);
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
