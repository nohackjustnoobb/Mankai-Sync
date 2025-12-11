-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "Record" (
    "mangaId" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "datetime" DATETIME NOT NULL,
    "chapterId" TEXT,
    "chapterTitle" TEXT,
    "page" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("mangaId", "pluginId", "userId"),
    CONSTRAINT "Record_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Saved" (
    "mangaId" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "datetime" DATETIME NOT NULL,
    "updates" BOOLEAN NOT NULL,
    "latestChapter" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("mangaId", "pluginId", "userId"),
    CONSTRAINT "Saved_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
