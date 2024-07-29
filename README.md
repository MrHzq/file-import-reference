# 说明

本工具是用于查找某个文件在哪些地方被引用的

## 全局安装

```ts
npm i -g file-import-reference
```

## 使用

进入某个项目根目录

输入命令:

```ts
fir utils.js
```

1、查找范围：`项目目录/src/**/*` 内的所有文件
2、查找内容：关键词`utils.js`
3、返回内容：所以引入了`utils.js`的文件
4、返回格式：

```ts
搜索内容：Button，文件范围：./src
✔ 查找成功：1 个文件 - 1 个结果

src/xxx/bootstrap.ts#2
 2:     import { Toast, NavBar, Lazyload, ActionSheet, Field, Button, Icon, CountDown } from "vant"
```

## 完整命令

```ts
fir text dir
// text：查找内容，必传
// dir：查找的文件范围，可传，不传为 ./src
```

## 其他

查找时的忽略文件：默认为：[".git", "dist"]
但还会获取当前项目的 .gitignore 文件，读取其中的内容，补充为到忽略文件列表中
