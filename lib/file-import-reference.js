#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

const { log, split, spinner } = require("./log");

const matchExtMap = {
  // ts: [".js", ".ts", ".vue"],
};

function checkFileExist(path) {
  return fs.existsSync(path);
}

// 全字匹配正则
const fullWordMatchRegex = (word, flags = "") =>
  new RegExp(`\\.?${word}(?!\\w)`, flags);

// 全字匹配：boolean
const matchReg = (c, word) => fullWordMatchRegex(word).test(c);

let matchResultCount = 0; // 匹配到的结果数量
const forEachFiles = []; // 遍历过的文件

// 是否有引用关系：boolean
const hasReference = (c, word) => {
  const noCommentAndHasWord = !c.startsWith("//") && matchReg(c, `/${word}`);

  const isReference = [
    matchReg(c, "import"),
    matchReg(c, "from"),
    matchReg(c, "require"),
    c.includes("./"),
    c.includes("../"),
  ].some(Boolean);

  return noCommentAndHasWord && isReference;
};

// 获取引用的变量名
const extractImportedName = (str) => {
  const regex = /import\s+(?:(\{[\w,\s]+\})|([\w]+))\s+from/;
  const match = str.match(regex);
  if (match) {
    if (match[1]) {
      return match[1].replace(/\{|\}/g, "").trim().split(",")[0];
    } else if (match[2]) {
      return match[2];
    }
  }
  return null;
};

function findFilesReferencing(targetFile, searchDirectory) {
  const referencedFiles = [];

  const [targetName, targetExt] = targetFile.split(".");

  const matchExtList = matchExtMap[targetExt] || [];

  // 要排除的目录列表（根据实际需求修改）
  const ignoreDirectories = [".git", "dist"].concat(getGitIgnoreList());

  // 遍历目录及其子目录
  const traverseDirectory = (dir) => {
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
      const isIgnore =
        ignoreDirectories.includes(file) ||
        ignoreDirectories.some((ig) => file.includes(ig) || ig.includes(file));

      if (!isIgnore) {
        const filePath = path.join(dir, file);
        const fileExt = path.extname(file); //.js|.ts

        const fileStats = fs.statSync(filePath);

        if (fileStats.isDirectory()) traverseDirectory(filePath);
        else if (
          fileStats.isFile() &&
          (matchExtList.length === 0 || matchExtList.includes(fileExt))
        ) {
          forEachFiles.push(filePath);
          const content = fs.readFileSync(filePath, "utf-8");

          if (matchReg(content, `/${targetName}`)) {
            const lines = content.split("\n");
            const referencedFileItem = {
              filePath,
              match: [],
            };

            lines.forEach((lineContent, index) => {
              if (hasReference(lineContent, targetName)) {
                ++matchResultCount;

                const lineNumber = index + 1;
                const codePath = filePath + "#" + lineNumber;
                const matchContent = lineContent.trim();
                const importedName = extractImportedName(matchContent);
                const importedNameNum =
                  lineContent.match(fullWordMatchRegex(importedName, "g"))
                    ?.length || 0;

                const contentImportedNameNum =
                  content.match(fullWordMatchRegex(importedName, "g"))
                    ?.length || 0;

                const isUse =
                  contentImportedNameNum === 0 ||
                  contentImportedNameNum > importedNameNum;

                const styleContent =
                  matchContent
                    .replace(
                      `/${targetName}`,
                      chalk.green.bold(`/${targetName}`)
                    )
                    .replace(importedName, chalk.blue.bold(importedName)) +
                  (isUse ? "" : chalk.red.bold(" // 引用后从未使用"));

                const currResult = {
                  lineNumber,
                  codePath,
                  matchContent,
                  styleContent,
                  targetName,
                  importedName,
                  importedNameNum,
                };

                referencedFileItem.match.push(currResult);
              }
            });

            if (referencedFileItem.match.length) {
              referencedFiles.push(referencedFileItem);
            }
          }
        }
      }
    });
  };

  traverseDirectory(searchDirectory);
  return referencedFiles;
}

/**
 * 通过 .gitignore 生成 ignoreList
 * @returns string[]
 */
function getGitIgnoreList() {
  const gitIgnorePath = path.join(process.cwd(), ".gitignore");
  try {
    const content = fs.readFileSync(gitIgnorePath, "utf-8");
    const ignoreList = content
      .split("\n")
      .filter((line) => line.trim() !== "" && !line.includes("#"));
    return ignoreList;
  } catch (err) {
    if (err.code === "ENOENT") {
      log.info(".gitignore 文件不存在");
    } else {
      log.error("读取.gitignore 文件时出错:", err);
    }
    return [];
  }
}

const baseSpace = 2; // 默认 2 个空格

// 生成空格字符串
const createSpace = (num = baseSpace) => new Array(num).join(" ");

const sleep = (t = 1000) => new Promise((resolve) => setTimeout(resolve, t));

module.exports = async function (options) {
  console.time("查找耗时");

  const { args } = options;

  const [findKey, searchDirectory = "./src"] = args;

  if (!findKey) return log.error(`查找内容不能为空!!`);

  const fullPath = path.join(process.cwd(), searchDirectory);

  const isExits = await checkFileExist(fullPath);

  if (!isExits) return log.error(`${searchDirectory} 文件不存在`);

  split();

  log.info(`搜索内容：${chalk.blue(findKey)}，文件范围：${searchDirectory}`);

  split();

  spinner.start("查找中");

  const maxLineLen = 4; // 行数的长度最多为 4 个

  try {
    const result = findFilesReferencing(findKey, searchDirectory);

    spinner.succeed(
      `查找成功：${result.length} 个文件 - ${matchResultCount} 个结果`
    );

    result.forEach((item) => {
      split();
      log.info(chalk.yellow.underline(item.match[0].codePath)); // 加 #num 的作用是支持直接跳转到对应文件的行数

      item.match.forEach((m) => {
        log.info(
          `${chalk.blue.bold(createSpace() + `${m.lineNumber}:`)}`,
          `${createSpace(
            baseSpace + (maxLineLen - String(m.lineNumber).length)
          )}${m.styleContent}`
        );
      });
    });

    split();
    log.info(`共遍历了 ${forEachFiles.length} 个文件`);
    split();

    console.timeEnd("查找耗时");
  } catch (error) {
    spinner.fail(`查找失败: ` + error.message);
  }
};
