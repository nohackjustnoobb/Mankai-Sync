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

      const upsertPromises: Promise<Record>[] = records.map(async (record) => {
        const { mangaId, pluginId, datetime, chapterId, chapterTitle, page } =
          record;
        if (
          mangaId === undefined ||
          pluginId === undefined ||
          datetime === undefined ||
          page === undefined
        ) {
          return Promise.reject(new Error("Missing required fields"));
        }

        const date = new Date(datetime);
        if (isNaN(date.getTime())) {
          return Promise.reject(new Error("Invalid datetime format"));
        }

        const storedRecord = await prisma.record.findUnique({
          where: {
            mangaId_pluginId_userId: {
              userId,
              mangaId,
              pluginId,
            },
          },
        });

        if (!storedRecord) {
          return prisma.record.create({
            data: {
              userId,
              mangaId,
              pluginId,
              datetime: date,
              chapterId,
              chapterTitle,
              page,
            },
          });
        }

        if (date.getTime() > storedRecord.datetime.getTime()) {
          return prisma.record.update({
            where: {
              mangaId_pluginId_userId: {
                userId,
                mangaId,
                pluginId,
              },
            },
            data: {
              datetime: date,
              chapterId,
              chapterTitle,
              page,
            },
          });
        } else {
          return storedRecord;
        }
      });

      const results = await Promise.all(upsertPromises);

      response.status(200).json({
        message: "Record items processed successfully",
        records: results,
      });
    } catch (error) {
      response.status(400).json({ error: "Failed to record item" });
    }
  });
}

export { setupRecordsEndpoints };
