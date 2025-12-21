import HyperExpress from "hyper-express";
import prisma from "../utils/prisma";
import { Record } from "@prisma/client";

function setupRecordsEndpoints(server: HyperExpress.Server) {
  server.get("/api/records", async (request, response) => {
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

      const records = await prisma.record.findMany({
        where: whereClause,
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

      response.status(200).json(records);
    } catch (error) {
      console.error(error);
      response.status(400).json({ error: "Failed to retrieve record items" });
    }
  });

  server.post("/api/records", async (request, response) => {
    try {
      const userId = request.payload?.userId;
      if (!userId) {
        return response.status(401).json({ error: "Unauthorized" });
      }

      const records = await request.json();
      if (!records || !Array.isArray(records)) {
        return response.status(400).json({ error: "Invalid record items" });
      }

      // Validate all items first
      for (const record of records) {
        const { mangaId, pluginId, datetime, page } = record;
        if (
          mangaId === undefined ||
          pluginId === undefined ||
          datetime === undefined ||
          page === undefined
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

      // Fetch all relevant records in a single query
      const keys = records.map((r) => ({
        mangaId: r.mangaId,
        pluginId: r.pluginId,
      }));

      const storedRecords = await prisma.record.findMany({
        where: {
          userId,
          OR: keys,
        },
      });

      // Create a map for quick lookup
      const storedMap = new Map(
        storedRecords.map((r) => [`${r.mangaId}|${r.pluginId}`, r])
      );

      // Determine which items need to be created vs updated
      const toCreate = [];
      const toUpdate = [];

      for (const record of records) {
        const key = `${record.mangaId}|${record.pluginId}`;
        const stored = storedMap.get(key);
        const date = new Date(record.datetime);

        if (!stored) {
          toCreate.push({
            userId,
            mangaId: record.mangaId,
            pluginId: record.pluginId,
            datetime: date,
            chapterId: record.chapterId,
            chapterTitle: record.chapterTitle,
            page: record.page,
          });
        } else if (date.getTime() > stored.datetime.getTime()) {
          toUpdate.push({
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
          });
        }
      }

      // Batch create and update in a transaction
      const operations = [
        ...toCreate.map((data) => prisma.record.create({ data })),
        ...toUpdate.map((update) => prisma.record.update(update)),
      ];

      const results =
        operations.length > 0 ? await prisma.$transaction(operations) : [];

      // Build final result set
      const resultMap = new Map(
        results.map((r) => [`${r.mangaId}|${r.pluginId}`, r])
      );

      const allResults = records.map((r) => {
        const key = `${r.mangaId}|${r.pluginId}`;
        return resultMap.get(key) || storedMap.get(key);
      });

      response.status(200).json({
        message: "Record items processed successfully",
        records: allResults,
      });
    } catch (error) {
      console.error(error);
      response.status(400).json({ error: "Failed to record item" });
    }
  });
}

export { setupRecordsEndpoints };
