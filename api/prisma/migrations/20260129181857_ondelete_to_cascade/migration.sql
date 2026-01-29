-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Record" (
    "mangaId" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "datetime" DATETIME NOT NULL,
    "chapterId" TEXT,
    "chapterTitle" TEXT,
    "page" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("mangaId", "pluginId", "userId"),
    CONSTRAINT "Record_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Record" ("chapterId", "chapterTitle", "datetime", "mangaId", "page", "pluginId", "updatedAt", "userId") SELECT "chapterId", "chapterTitle", "datetime", "mangaId", "page", "pluginId", "updatedAt", "userId" FROM "Record";
DROP TABLE "Record";
ALTER TABLE "new_Record" RENAME TO "Record";
CREATE TABLE "new_Saved" (
    "mangaId" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "datetime" DATETIME NOT NULL,
    "updates" BOOLEAN NOT NULL,
    "latestChapter" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("mangaId", "pluginId", "userId"),
    CONSTRAINT "Saved_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Saved" ("datetime", "latestChapter", "mangaId", "pluginId", "updatedAt", "updates", "userId") SELECT "datetime", "latestChapter", "mangaId", "pluginId", "updatedAt", "updates", "userId" FROM "Saved";
DROP TABLE "Saved";
ALTER TABLE "new_Saved" RENAME TO "Saved";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
