# PRD CLI Man Pages

Unix/Linux标准格式的命令行手册页面

---

## prd(1) - PRD Draft Documentation System CLI

### NAME
prd - PRD Draft Documentation System command-line interface

### SYNOPSIS
**prd** [*GLOBAL_OPTIONS*] *COMMAND* [*COMMAND_OPTIONS*] [*ARGUMENTS*]

### DESCRIPTION
**prd** 是一个用于管理产品需求文档(PRD)草稿的命令行工具。它提供了创建、编辑、审查、版本控制和导出PRD文档的完整功能。

该工具支持多种文档格式、模板系统、协作审查流程和版本管理功能。

### GLOBAL OPTIONS
**-c**, **--config** *FILE*
    指定配置文件路径。默认: ~/.codex-father/config.yaml

**--json**
    以JSON格式输出结果

**-v**, **--verbose**
    启用详细日志输出

**-h**, **--help**
    显示帮助信息并退出

### COMMANDS

#### DRAFT MANAGEMENT

**create** [*OPTIONS*]
    创建新的PRD草稿

**list** [*OPTIONS*]
    列出PRD草稿，支持筛选和排序

**show** *DRAFT_ID* [*OPTIONS*]
    显示PRD草稿详细信息

**edit** *DRAFT_ID* [*OPTIONS*]
    编辑PRD草稿内容

**delete** *DRAFT_ID* [*OPTIONS*]
    删除或归档PRD草稿

#### REVIEW MANAGEMENT

**review submit** *DRAFT_ID* [*OPTIONS*]
    提交草稿进行审查

**review status** *DRAFT_ID*
    检查草稿审查状态

**review respond** *DRAFT_ID* [*OPTIONS*]
    回应审查请求

#### VERSION CONTROL

**version list** *DRAFT_ID*
    列出草稿的所有版本

**version show** *DRAFT_ID* *VERSION*
    显示特定版本的内容

**version restore** *DRAFT_ID* *VERSION* [*OPTIONS*]
    恢复到指定版本

**version diff** *DRAFT_ID* [*OPTIONS*]
    比较不同版本间的差异

#### TEMPLATE MANAGEMENT

**template list**
    列出所有可用模板

**template show** *TEMPLATE_ID*
    显示模板详细信息

**template create** [*OPTIONS*]
    创建新的文档模板

**template validate** *TEMPLATE_FILE*
    验证模板结构

#### CONFIGURATION

**config show** [*OPTIONS*]
    显示当前配置

**config set** *KEY* *VALUE*
    设置配置值

**config init** [*OPTIONS*]
    初始化配置文件

#### IMPORT/EXPORT

**export** *DRAFT_ID* [*OPTIONS*]
    导出PRD草稿为各种格式

**import** *FILE* [*OPTIONS*]
    从文件导入PRD草稿

**search** *QUERY* [*OPTIONS*]
    在PRD草稿中搜索内容

### EXIT STATUS
**0**    成功
**1**    通用错误
**2**    参数无效
**3**    文件未找到
**4**    权限拒绝
**5**    网络错误
**6**    认证失败
**7**    验证错误
**8**    冲突错误
**9**    资源未找到
**10**   配置错误

### FILES
**~/.codex-father/prd-config.yaml**
    用户配置文件

**~/.codex-father/templates/**
    用户自定义模板目录

### ENVIRONMENT
**PRD_CONFIG**
    配置文件路径，覆盖默认位置

**EDITOR**
    默认编辑器命令（可通过配置覆盖）

### EXAMPLES
创建新PRD草稿:
    **prd create --title "用户认证系统" --template technical**

列出所有草稿状态的文档:
    **prd list --status draft**

提交审查:
    **prd review submit doc-001 --reviewers "john,jane" --due-date "2025-10-01"**

导出为PDF:
    **prd export doc-001 --format pdf --output requirements.pdf**

### SEE ALSO
**prd-create**(1), **prd-list**(1), **prd-review**(1), **prd-config**(1)

项目文档: https://github.com/codex-father/prd-cli

---

## prd-create(1) - 创建PRD草稿

### NAME
prd-create - 创建新的PRD草稿

### SYNOPSIS
**prd create** [*OPTIONS*]

### DESCRIPTION
创建新的产品需求文档草稿。支持使用预定义模板和交互式创建模式。

### OPTIONS
**-t**, **--title** *TITLE*
    草稿标题 (必需，1-200字符)

**--template** *TEMPLATE_ID*
    使用的模板ID (默认: default)

**-d**, **--description** *DESCRIPTION*
    简要描述 (最大500字符)

**-o**, **--output** *FILE*
    输出文件路径

**-i**, **--interactive**
    启用交互式创建模式

### EXAMPLES
基本创建:
    **prd create --title "用户认证系统" --template technical**

交互式创建:
    **prd create --title "移动应用" --interactive**

指定输出文件:
    **prd create --title "API文档" --output ./api-spec.md**

### EXIT STATUS
继承自 **prd**(1)

### SEE ALSO
**prd**(1), **prd-template**(1)

---

## prd-list(1) - 列出PRD草稿

### NAME
prd-list - 列出PRD草稿，支持筛选和排序

### SYNOPSIS
**prd list** [*OPTIONS*]

### DESCRIPTION
显示PRD草稿列表，支持按状态、作者、模板筛选，以及多种排序选项。

### OPTIONS
**-s**, **--status** *STATUS*
    按状态筛选。可选值: draft, in_review, changes_requested, approved, rejected, confirmed

**-a**, **--author** *AUTHOR*
    按作者筛选

**--template** *TEMPLATE*
    按模板筛选

**--search** *QUERY*
    在标题和内容中搜索

**-l**, **--limit** *NUMBER*
    限制结果数量 (1-100，默认: 20)

**--sort** *FIELD*
    排序字段。可选值: created, updated, title, status (默认: updated)

**-r**, **--reverse**
    反向排序

### EXAMPLES
列出草稿状态的文档:
    **prd list --status draft**

按创建时间排序:
    **prd list --sort created --reverse**

搜索特定内容:
    **prd list --search "认证" --limit 10**

### OUTPUT FORMAT
```
📋 PRD草稿 (15 total)

ID           Title                       Status        Author      Updated
------------ --------------------------- ------------- ----------- ----------
prd-auth-001 用户认证系统                draft         john        2025-09-28
```

### EXIT STATUS
继承自 **prd**(1)

### SEE ALSO
**prd**(1), **prd-show**(1), **prd-search**(1)

---

## prd-show(1) - 显示PRD详情

### NAME
prd-show - 显示PRD草稿详细信息

### SYNOPSIS
**prd show** *DRAFT_ID* [*OPTIONS*]

### DESCRIPTION
显示指定PRD草稿的详细信息和内容。支持多种输出格式和版本选择。

### ARGUMENTS
*DRAFT_ID*
    草稿ID或标题

### OPTIONS
**-v**, **--version** *NUMBER*
    显示特定版本

**-c**, **--content**
    包含完整内容 (默认: true)

**-f**, **--format** *FORMAT*
    输出格式。可选值: markdown, html, text (默认: markdown)

**--sections** *SECTIONS*
    显示指定章节，逗号分隔

**--no-metadata**
    隐藏元数据

### EXAMPLES
显示草稿详情:
    **prd show prd-auth-001**

显示特定版本:
    **prd show prd-auth-001 --version 2**

显示特定章节:
    **prd show prd-auth-001 --sections "overview,requirements"**

HTML格式输出:
    **prd show prd-auth-001 --format html**

### EXIT STATUS
继承自 **prd**(1)

### SEE ALSO
**prd**(1), **prd-list**(1), **prd-version**(1)

---

## prd-edit(1) - 编辑PRD草稿

### NAME
prd-edit - 编辑PRD草稿内容

### SYNOPSIS
**prd edit** *DRAFT_ID* [*OPTIONS*]

### DESCRIPTION
打开编辑器修改PRD草稿内容。支持章节级别编辑和自动版本控制。

### ARGUMENTS
*DRAFT_ID*
    草稿ID或标题

### OPTIONS
**-e**, **--editor** *COMMAND*
    编辑器命令 (默认: $EDITOR)

**-s**, **--section** *SECTION*
    编辑特定章节

**-m**, **--message** *MESSAGE*
    提交信息

**--no-commit**
    不自动提交更改

**--backup**
    编辑前创建备份 (默认: true)

### EXAMPLES
基本编辑:
    **prd edit prd-auth-001**

编辑特定章节:
    **prd edit prd-auth-001 --section overview**

使用特定编辑器:
    **prd edit prd-auth-001 --editor "code"**

带提交信息:
    **prd edit prd-auth-001 --message "更新需求描述"**

### EXIT STATUS
继承自 **prd**(1)

### SEE ALSO
**prd**(1), **prd-show**(1), **prd-version**(1)

---

## prd-review(1) - 审查管理

### NAME
prd-review - 管理PRD草稿的审查流程

### SYNOPSIS
**prd review** *SUBCOMMAND* [*OPTIONS*]

### DESCRIPTION
管理PRD草稿的审查流程，包括提交审查、检查状态和回应审查请求。

### SUBCOMMANDS

#### submit
提交草稿进行审查

**prd review submit** *DRAFT_ID* [*OPTIONS*]

**OPTIONS:**
**-r**, **--reviewers** *REVIEWERS*
    审查者用户名，逗号分隔 (必需)

**-d**, **--due-date** *DATE*
    审查截止日期 (ISO 8601格式)

**-p**, **--priority** *PRIORITY*
    审查优先级: low, medium, high (默认: medium)

**-m**, **--message** *MESSAGE*
    审查请求消息

#### status
检查审查状态

**prd review status** *DRAFT_ID*

#### respond
回应审查请求

**prd review respond** *DRAFT_ID* [*OPTIONS*]

**OPTIONS:**
**--decision** *DECISION*
    审查决定: approved, rejected, changes_requested (必需)

**-c**, **--comments** *FILE*
    审查意见文件路径

**--inline** *TEXT*
    内联评论文本

### EXAMPLES
提交审查:
    **prd review submit prd-auth-001 --reviewers "john,jane" --due-date "2025-10-01"**

检查状态:
    **prd review status prd-auth-001**

回应审查:
    **prd review respond prd-auth-001 --decision approved**

请求修改:
    **prd review respond prd-auth-001 --decision changes_requested --inline "需要增加安全性考虑"**

### EXIT STATUS
继承自 **prd**(1)

### SEE ALSO
**prd**(1), **prd-edit**(1)

---

## prd-version(1) - 版本控制

### NAME
prd-version - 管理PRD草稿的版本历史

### SYNOPSIS
**prd version** *SUBCOMMAND* [*OPTIONS*]

### DESCRIPTION
提供PRD草稿的版本控制功能，包括查看历史、比较差异和版本恢复。

### SUBCOMMANDS

#### list
列出所有版本

**prd version list** *DRAFT_ID*

#### show
显示特定版本

**prd version show** *DRAFT_ID* *VERSION*

#### restore
恢复到指定版本

**prd version restore** *DRAFT_ID* *VERSION* [*OPTIONS*]

**OPTIONS:**
**-m**, **--message** *MESSAGE*
    恢复原因 (必需)

#### diff
比较版本差异

**prd version diff** *DRAFT_ID* [*OPTIONS*]

**OPTIONS:**
**--from** *VERSION*
    起始版本 (默认: 当前-1)

**--to** *VERSION*
    目标版本 (默认: 当前)

**--format** *FORMAT*
    差异格式: unified, side-by-side, json (默认: unified)

### EXAMPLES
查看版本历史:
    **prd version list prd-auth-001**

比较版本:
    **prd version diff prd-auth-001 --from 1 --to 3**

恢复版本:
    **prd version restore prd-auth-001 2 --message "回退到稳定版本"**

### EXIT STATUS
继承自 **prd**(1)

### SEE ALSO
**prd**(1), **prd-edit**(1)

---

## prd-template(1) - 模板管理

### NAME
prd-template - 管理PRD文档模板

### SYNOPSIS
**prd template** *SUBCOMMAND* [*OPTIONS*]

### DESCRIPTION
管理PRD文档模板，包括查看、创建和验证模板。

### SUBCOMMANDS

#### list
列出所有可用模板

**prd template list**

#### show
显示模板详情

**prd template show** *TEMPLATE_ID*

#### create
创建新模板

**prd template create** [*OPTIONS*]

**OPTIONS:**
**-n**, **--name** *NAME*
    模板名称 (必需)

**-d**, **--description** *DESCRIPTION*
    模板描述 (必需)

**--from** *TEMPLATE_ID*
    基础模板ID

**-f**, **--file** *FILE*
    模板定义文件

#### validate
验证模板结构

**prd template validate** *TEMPLATE_FILE*

### EXAMPLES
列出模板:
    **prd template list**

创建模板:
    **prd template create --name "移动应用模板" --description "移动应用产品需求模板"**

验证模板:
    **prd template validate ./my-template.yaml**

### EXIT STATUS
继承自 **prd**(1)

### SEE ALSO
**prd**(1), **prd-create**(1)

---

## prd-config(1) - 配置管理

### NAME
prd-config - 管理CLI工具配置

### SYNOPSIS
**prd config** *SUBCOMMAND* [*OPTIONS*]

### DESCRIPTION
管理PRD CLI工具的配置选项，包括API设置、认证信息和行为配置。

### SUBCOMMANDS

#### show
显示当前配置

**prd config show** [*OPTIONS*]

**OPTIONS:**
**-k**, **--key** *KEY*
    显示特定配置项

#### set
设置配置值

**prd config set** *KEY* *VALUE*

#### init
初始化配置文件

**prd config init** [*OPTIONS*]

**OPTIONS:**
**-f**, **--force**
    覆盖现有配置

### CONFIGURATION KEYS
**api.base_url**
    API基础URL

**api.timeout**
    请求超时时间（秒）

**auth.token**
    认证令牌

**editor.command**
    默认编辑器命令

**output.format**
    默认输出格式

**behavior.auto_save**
    自动保存开关

### EXAMPLES
显示所有配置:
    **prd config show**

设置API地址:
    **prd config set api.base_url "https://api.example.com"**

初始化配置:
    **prd config init --force**

### EXIT STATUS
继承自 **prd**(1)

### SEE ALSO
**prd**(1)

---

## prd-export(1) - 导出PRD

### NAME
prd-export - 导出PRD草稿为各种格式

### SYNOPSIS
**prd export** *DRAFT_ID* [*OPTIONS*]

### DESCRIPTION
将PRD草稿导出为PDF、HTML、Word等多种格式，支持自定义模板和元数据控制。

### ARGUMENTS
*DRAFT_ID*
    草稿ID或标题

### OPTIONS
**-f**, **--format** *FORMAT*
    导出格式: markdown, html, pdf, docx (必需)

**-o**, **--output** *FILE*
    输出文件路径

**--template** *TEMPLATE*
    导出模板

**--include-metadata**
    包含元数据 (默认: true)

**--include-history**
    包含版本历史 (默认: false)

### EXAMPLES
导出为PDF:
    **prd export prd-auth-001 --format pdf --output requirements.pdf**

导出HTML含历史:
    **prd export prd-auth-001 --format html --include-history**

### EXIT STATUS
继承自 **prd**(1)

### SEE ALSO
**prd**(1), **prd-import**(1)

---

## prd-import(1) - 导入PRD

### NAME
prd-import - 从文件导入PRD草稿

### SYNOPSIS
**prd import** *FILE* [*OPTIONS*]

### DESCRIPTION
从Markdown、HTML、Word等格式的文件导入PRD草稿。

### ARGUMENTS
*FILE*
    源文件路径

### OPTIONS
**-f**, **--format** *FORMAT*
    源格式: markdown, html, docx, auto (默认: auto)

**-t**, **--template** *TEMPLATE*
    目标模板ID

**--title** *TITLE*
    覆盖文档标题

**--dry-run**
    预览导入不创建

### EXAMPLES
自动导入:
    **prd import ./requirements.md**

指定模板:
    **prd import ./spec.docx --template technical**

预览导入:
    **prd import ./requirements.md --dry-run**

### EXIT STATUS
继承自 **prd**(1)

### SEE ALSO
**prd**(1), **prd-export**(1)

---

## prd-search(1) - 搜索PRD

### NAME
prd-search - 在PRD草稿中搜索内容

### SYNOPSIS
**prd search** *QUERY* [*OPTIONS*]

### DESCRIPTION
在PRD草稿的标题和内容中搜索指定内容，支持多种筛选条件。

### ARGUMENTS
*QUERY*
    搜索查询

### OPTIONS
**--in** *SCOPE*
    搜索范围: title, content, all (默认: all)

**--status** *STATUS*
    按状态筛选

**--author** *AUTHOR*
    按作者筛选

**-l**, **--limit** *NUMBER*
    结果限制 (默认: 10)

### EXAMPLES
全文搜索:
    **prd search "用户认证"**

标题搜索:
    **prd search "API" --in title**

限制结果:
    **prd search "支付" --author john --limit 5**

### EXIT STATUS
继承自 **prd**(1)

### SEE ALSO
**prd**(1), **prd-list**(1)

---

## AUTHOR
Codex Father Development Team

## COPYRIGHT
Copyright © 2025 Codex Father Project. Licensed under MIT License.

## BUGS
Report bugs to: https://github.com/codex-father/prd-cli/issues

Documentation bugs to: https://github.com/codex-father/prd-cli/issues

## VERSION
This manual page documents version 1.0.0 of the PRD CLI tool.