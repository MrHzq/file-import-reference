#! /usr/bin/env node

// 上述为 Node.js 脚本文件的行首注释，告知使用 node 来解析和执行后续的脚本内容

// 引入 commander 模块，官方使用文档：https://github.com/tj/commander.js/blob/HEAD/Readme_zh-CN.md
const { program } = require("commander");

const version = require("../package.json").version;

// 定义命令与参数
program
  .version(version)
  .description("find file import reference")
  .action((a1, options) => {
    require("../lib/file-import-reference")(options);
  });

// 解析用户输入的命令和参数，第一个参数是要解析的字符串数组，第二个参数是解析选项
program.parse(process.argv); // 指明，按 node 约定
