import HyperExpress from "hyper-express";
import { Prisma } from "@prisma/client";
import prisma from "../utils/prisma";

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
        const { mangaId, pluginId, datetime, chapterId, page } = record;
        if (
          mangaId === undefined ||
          pluginId === undefined ||
          datetime === undefined ||
          chapterId === undefined ||
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

      const now = new Date();
      // Handle Records Mutation (Upsert with Raw SQL)
      if (records.length > 0) {
        try {
          const valueTuples = records.map((record: any) => {
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

      response.status(200).json({
        message: "Record items processed successfully",
        records: records,
      });
    } catch (error) {
      console.error(error);
      response.status(400).json({ error: "Failed to record item" });
    }
  });
}

export { setupRecordsEndpoints };
