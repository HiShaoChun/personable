# bookmark-import

## Purpose

在浏览器端接收并解析 Netscape Bookmark File Format 的书签 HTML 导出文件
（兼容所有支持该格式导出的主流浏览器，如 Chrome / Firefox / Edge / Safari /
Brave / Arc / Opera / Vivaldi 等），得到经校验、去重的结构化条目；强制体积/
格式上限；原始文件绝不持久化。

## Requirements

### Requirement: 客户端书签文件解析
系统 SHALL 完全在浏览器内解析 Netscape Bookmark File Format 格式的书签
HTML 导出文件（Chrome / Firefox / Edge / Safari / Brave / Arc / Opera /
Vivaldi 等主流浏览器导出的 HTML 书签均使用此格式），且 SHALL NOT 传输或
持久化原始文件。

#### Scenario: 上传有效的 Netscape 格式书签文件
- **WHEN** 用户把任意主流浏览器导出的 Netscape 格式书签 HTML 文件拖入上传区
- **THEN** 系统在浏览器内解析为结构化条目，每条含标题、URL、域名、文件夹路径、添加时间
- **AND** 原始文件内容绝不发往服务端、绝不写入存储
- **AND** 不因导出该文件的浏览器品牌而拒绝合法的 Netscape 格式文件

#### Scenario: 非书签或损坏文件
- **WHEN** 用户上传的文件不是可识别的 Netscape 格式书签 HTML 导出
- **THEN** 系统以清晰提示拒绝，指明期望的格式（"Netscape 格式的书签 HTML"）
  并给出"在浏览器中执行『导出书签 → HTML』"这一通用动作指引
- **AND** 拒绝消息 SHALL NOT 点名某个特定浏览器作为唯一受支持来源
- **AND** 不发起任何网络请求

### Requirement: 条目归一化与去重
系统 SHALL 在进入后续处理前对解析出的条目做归一化并去除重复。

#### Scenario: 跨文件夹的重复 URL
- **WHEN** 同一 URL 出现在多个文件夹
- **THEN** 系统只保留一条归一化条目，并记录它出现过的所有文件夹路径

#### Scenario: 字段缺失或损坏
- **WHEN** 某条目无添加时间或 URL 无法解析
- **THEN** 系统要么修复为归一化形态、要么剔除，绝不向下游输出损坏条目

### Requirement: 输入数量上限
系统 SHALL 限制送去处理的条目数，超限时 SHALL 做有代表性的下采样。

#### Scenario: 书签库超过上限
- **WHEN** 解析出的书签库超过配置的条目上限（约 800）
- **THEN** 系统做确定性下采样，同时保持文件夹、域名、时间三个维度的分布
- **AND** UI 说明使用了代表性样本
