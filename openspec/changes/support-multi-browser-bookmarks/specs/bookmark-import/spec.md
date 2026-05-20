## MODIFIED Requirements

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
