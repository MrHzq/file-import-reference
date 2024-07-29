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

// 全字匹配
const matchReg = (content, target) => {
  const regex = new RegExp(`\\b${target}\\b`); // 创建正则表达式对象，^表示匹配字符串的开头，$表示匹配字符串的结尾，从而实现完全匹配
  return regex.test(content); // 使用 test 方法进行正则匹配
};

let matchResultCount = 0; // 匹配到的结果数量
const forEachFiles = []; // 遍历过的文件

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
      const filePath = path.join(dir, file);
      forEachFiles.push(filePath);
      const fileExt = path.extname(file); //.js|.ts

      const fileStats = fs.statSync(filePath);

      const isIgnore = ignoreDirectories.includes(file);

      if (fileStats.isDirectory() && !isIgnore) {
        traverseDirectory(filePath);
      } else if (
        fileStats.isFile() &&
        (matchExtList.length === 0 || matchExtList.includes(fileExt))
      ) {
        const content = fs.readFileSync(filePath, "utf-8");
        if (matchReg(content, targetName)) {
          const lines = content.split("\n");
          lines.forEach((lineContent, index) => {
            if (
              matchReg(lineContent, targetName) &&
              (matchReg(lineContent, "import") ||
                matchReg(lineContent, "require"))
            ) {
              ++matchResultCount;

              const lineNumber = index + 1;
              const codePath = filePath + "#" + lineNumber;
              const matchContent = lineContent.trim();

              const currResult = {
                lineNumber,
                codePath,
                matchContent,
                targetName,
              };

              const findValue = referencedFiles.find(
                (item) => item.filePath === filePath
              );

              if (findValue) {
                findValue.match.push(currResult);
              } else {
                referencedFiles.push({
                  filePath,
                  match: [currResult],
                });
              }
            }
          });
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
      console.log(".gitignore 文件不存在");
    } else {
      console.error("读取.gitignore 文件时出错:", err);
    }
    return [];
  }
}

const baseSpace = 2; // 默认 2 个空格

// 生成空格字符串
const createSpace = (num = baseSpace) => new Array(num).join(" ");

module.exports = async function (options) {
  const { args } = options;

  const [fileName, searchDirectory = "./src"] = args;

  const fullPath = path.join(process.cwd(), searchDirectory);

  const isExits = await checkFileExist(fullPath);

  if (!isExits) return log.error(`${searchDirectory} 文件不存在`);

  split();

  log.info(`搜索内容：${chalk.blue(fileName)}，文件范围：${searchDirectory}`);

  split();

  spinner.start("查找中");

  const maxLineLen = 4; // 行数的长度最多为 4 个

  try {
    const result = findFilesReferencing(fileName, searchDirectory);

    spinner.succeed(
      `查找成功：${result.length} 个文件 - ${matchResultCount} 个结果`
    );

    result.forEach((item) => {
      const matchLen = item.match.length; // 单个文件匹配到的结果数量

      if (matchLen > 1) {
        // 单个文件内匹配到多个了
        split();
        log.info(chalk.yellow.underline(item.filePath + ":"));
      }

      item.match.forEach((m) => {
        if (matchLen === 1) {
          split();
          log.info(chalk.yellow.underline(item.filePath + "#" + m.lineNumber)); // 加 #num 的作用是支持直接跳转到对应文件的行数
        }

        log.info(
          `${chalk.blue.bold(createSpace() + `${m.lineNumber}:`)}`,
          `${createSpace(
            baseSpace + (maxLineLen - String(m.lineNumber).length)
          )}${m.matchContent.replaceAll(
            m.targetName,
            chalk.blue(m.targetName)
          )}`
        );
      });
    });
    split();
  } catch (error) {
    spinner.fail(`查找失败: ` + error.message);
  }
};
