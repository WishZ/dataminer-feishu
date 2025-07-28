import {
  bitable,
  ITableMeta,
  IFieldMeta,
  FieldType,
  DateFormatter,
} from "@lark-base-open/js-sdk";

export interface TableUpdateOptions {
  tableId?: string;
  createNewTable?: boolean;
  tableName?: string;
  extractType: string;
  onProgress?: (progress: number, message: string) => void;
}

export interface TableUpdateResult {
  success: boolean;
  message: string;
  recordCount?: number;
  tableId?: string;
  tableName?: string;
}

export class FeishuTableService {
  private tableMetaList: ITableMeta[] = [];

  async initialize(): Promise<void> {
    try {
      this.tableMetaList = await bitable.base.getTableMetaList();
    } catch (error) {
      console.error("Failed to initialize Feishu table service:", error);
      throw new Error("无法初始化飞书多维表格服务");
    }
  }

  async getTableList(): Promise<ITableMeta[]> {
    if (this.tableMetaList.length === 0) {
      await this.initialize();
    }
    return this.tableMetaList;
  }

  async getCurrentSelection(): Promise<{ tableId?: string }> {
    try {
      const selection = await bitable.base.getSelection();
      return { tableId: selection.tableId! };
    } catch (error) {
      console.error("Failed to get current selection:", error);
      return {};
    }
  }

  async updateTable(
    data: any[],
    options: TableUpdateOptions,
    extractor?: any
  ): Promise<TableUpdateResult> {
    try {
      console.log("开始更新表格，数据条数:", data.length);
      if (data.length > 0) {
        console.log("第一条数据的字段:", Object.keys(data[0]));
      }

      // 进度回调辅助函数
      const reportProgress = (progress: number, message: string) => {
        if (options.onProgress) {
          options.onProgress(progress, message);
        }
      };

      reportProgress(0, "开始表格更新...");

      let tableId = options.tableId;
      let tableName = options.tableName;

      // 如果需要创建新表格
      if (options.createNewTable || !tableId) {
        console.log("创建新表格...");
        reportProgress(10, "正在创建新表格...");
        const createResult = await this.createTable(options.extractType, data, extractor);
        tableId = createResult.tableId;
        tableName = createResult.tableName;
        console.log("新表格创建成功，ID:", tableId);
        reportProgress(30, "新表格创建完成");
      }

      if (!tableId) {
        throw new Error("无法确定目标表格");
      }

      // 获取表格实例
      console.log("获取表格实例，ID:", tableId);
      reportProgress(35, "正在获取表格实例...");
      const table = await bitable.base.getTableById(tableId);

      // 确保字段存在
      console.log("确保字段存在...");
      reportProgress(40, "正在检查和添加字段...");
      await this.ensureFields(table, data);

      // 再次检查表格字段
      console.log("检查表格字段...");
      const finalFields = await table.getFieldMetaList();
      const finalFieldNames = finalFields.map((f: any) => f.name);

      // 检查数据字段和表格字段的匹配情况
      const sampleDataFields = Object.keys(data[0]).map((field) =>
        this.sanitizeFieldName(field)
      );

      const missingInTable = sampleDataFields.filter(
        (field) => !finalFieldNames.includes(field)
      );
      const extraInTable = finalFieldNames.filter(
        (field) => !sampleDataFields.includes(field)
      );

      if (missingInTable.length > 0) {
        console.error("表格中缺失的字段:", missingInTable);
      }
      if (extraInTable.length > 0) {
        console.log("表格中多余的字段:", extraInTable);
      }

      // 获取最新的字段信息用于记录添加
      const tableFields = await table.getFieldMetaList();

      // 批量添加记录
      console.log("开始添加记录...");
      reportProgress(60, "正在添加记录到表格...");
      const recordCount = await this.addRecords(
        table,
        data,
        tableFields,
        (progress: number, message: string) => {
          // 将记录添加的进度映射到60-90%的范围
          const mappedProgress = 60 + progress * 0.3;
          reportProgress(mappedProgress, message);
        }
      );

      reportProgress(100, "表格更新完成！");

      return {
        success: true,
        message: `成功添加 ${recordCount} 条记录到表格`,
        recordCount,
        tableId,
        tableName,
      };
    } catch (error) {
      console.error("Failed to update table:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "更新表格失败",
      };
    }
  }

  private async createTable(
    extractType: string,
    sampleData: any[],
    extractor?: any
  ): Promise<{ tableId: string; tableName: string }> {
    const tableName = this.generateTableName(extractor, sampleData);

    try {
      const table = await bitable.base.addTable({
        name: tableName,
        fields: this.generateFieldsConfig(extractType, sampleData),
      });

      // 更新表格列表
      await this.initialize();

      return {
        tableId: table.tableId,
        tableName,
      };
    } catch (error) {
      console.error("Failed to create table:", error);
      throw new Error(
        `创建表格失败: ${error instanceof Error ? error.message : "未知错误"}`
      );
    }
  }

  private generateTableName(extractor: any, data?: any[]): string {
    // 从extractor的getTypeDisplayName方法获取类型显示名称
    let typeName = "数据提取"; // 默认名称

    try {
      if (extractor && typeof extractor.getTypeDisplayName === 'function') {
        typeName = extractor.getTypeDisplayName(data);
        console.log(`从extractor获取表格类型名称: ${typeName}`);
      } else {
        console.warn('extractor没有getTypeDisplayName方法，使用默认名称');
      }
    } catch (error) {
      console.error('获取extractor类型名称失败:', error);
    }

    const timestamp = new Date()
      .toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
      .replace(/[\/\s:]/g, "");

    return `${typeName}_${timestamp}`;
  }

  private generateFieldsConfig(extractType: string, sampleData: any[]): any[] {
    // 完全基于样本数据动态生成字段配置
    if (sampleData.length === 0) {
      // 如果没有样本数据，返回一个基础字段
      return [{ name: "提取时间", type: FieldType.DateTime }];
    }

    const sample = sampleData[0];
    const fields = Object.keys(sample).map((key) => {
      const fieldName = this.sanitizeFieldName(key);
      const fieldType = this.inferFieldType(sample[key], key); // 传递原始字段名

      const fieldConfig: any = {
        name: fieldName,
        type: fieldType,
      };

      // 如果是DateTime字段，添加格式配置
      if (fieldType === FieldType.DateTime) {
        fieldConfig.property = {
          dateFormat: DateFormatter.DATE_TIME, // "yyyy/MM/dd HH:mm"
          displayTimeZone: false,
          autoFill: false
        };
        // console.log(`🕒 表格创建时配置DateTime字段: ${fieldName}`);
      }

      // 如果是CreatedTime字段，添加格式配置
      if (fieldType === FieldType.CreatedTime) {
        fieldConfig.property = {
          dateFormat: DateFormatter.DATE_TIME, // "yyyy/MM/dd HH:mm"
          displayTimeZone: false
        };
        // console.log(`🕒 表格创建时配置CreatedTime字段: ${fieldName}`);
      }

      return fieldConfig;
    });

    // console.log(
    //   `动态生成字段配置 (${extractType}):`,
    //   fields.map((f) => `${f.name}: ${f.type}`)
    // );

    return fields;
  }

  private sanitizeFieldName(fieldName: string): string {
    // 清理字段名称，移除可能导致问题的特殊字符
    let sanitized = fieldName.trim();

    // 只保留中文、英文、数字和下划线
    sanitized = sanitized.replace(/[^\u4e00-\u9fa5a-zA-Z0-9_]/g, "");

    // 确保字段名不为空
    if (sanitized === "") {
      sanitized = "field";
    }

    // 确保字段名不以数字开头
    if (/^\d/.test(sanitized)) {
      sanitized = "field_" + sanitized;
    }

    // console.log(`字段名清理: "${fieldName}" -> "${sanitized}"`);

    return sanitized;
  }

  private inferFieldType(value: any, fieldName?: string): FieldType {
    // 特殊处理：如果字段名是"提取时间"，使用CreatedTime类型
    if (fieldName === '提取时间') {
      // console.log(`字段 "${fieldName}" 被识别为CreatedTime类型`);
      return FieldType.CreatedTime;
    }

    if (typeof value === "number") {
      return FieldType.Number;
    }

    if (typeof value === "boolean") {
      return FieldType.Checkbox;
    }

    if (typeof value === "string") {
      const trimmedValue = value.trim();

      // 检查是否是URL
      if (
        trimmedValue.startsWith("http://") ||
        trimmedValue.startsWith("https://")
      ) {
        return FieldType.Url;
      }

      // 检查是否是日期时间格式
      if (this.isDateTimeString(trimmedValue)) {
        console.log(`字段值 "${trimmedValue}" 被识别为DateTime类型`);
        return FieldType.DateTime;
      }

      // 检查是否是数字字符串
      if (this.isNumericString(trimmedValue)) {
        return FieldType.Number;
      }
    }

    return FieldType.Text;
  }

  private isDateTimeString(value: string): boolean {
    // 检查中文日期格式：2024年1月1日 12:00:00
    if (value.includes("年") && value.includes("月") && value.includes("日")) {
      return true;
    }

    // 检查标准日期格式：2024-01-01 12:00:00 或 2024/01/01 12:00:00
    const dateTimePattern =
      /^\d{4}[-/]\d{1,2}[-/]\d{1,2}(\s+\d{1,2}:\d{1,2}(:\d{1,2})?)?$/;
    if (dateTimePattern.test(value)) {
      return true;
    }

    // 检查中文本地化日期格式：2025/1/25 18:47:05 或 2025/1/25 下午6:47:05
    const chineseLocaleDatePattern = /^\d{4}\/\d{1,2}\/\d{1,2}\s+(上午|下午)?\d{1,2}:\d{1,2}(:\d{1,2})?$/;
    if (chineseLocaleDatePattern.test(value)) {
      return true;
    }

    // 检查时间格式：12:00:00 或 12:00
    const timePattern = /^\d{1,2}:\d{1,2}(:\d{1,2})?$/;
    if (timePattern.test(value)) {
      return false;
    }

    // 尝试用 Date 构造函数解析，如果能成功解析且不是 Invalid Date，则认为是日期
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        // 额外检查：确保不是纯数字字符串被误识别为日期
        if (!/^\d+$/.test(value)) {
          console.log(`通用Date解析识别时间格式: "${value}"`);
          return true;
        }
      }
    } catch (e) {
      // 解析失败，继续其他检查
    }

    return false;
  }

  private isNumericString(value: string): boolean {
    // 检查是否是纯数字字符串（可能包含小数点和负号）
    const numericPattern = /^-?\d+(\.\d+)?$/;
    return numericPattern.test(value) && !isNaN(Number(value));
  }

  private async ensureFields(table: any, data: any[]): Promise<void> {
    if (data.length === 0) return;

    try {
      const existingFields = await table.getFieldMetaList();
      const existingFieldNames = existingFields.map(
        (field: IFieldMeta) => field.name
      );

      const sampleRecord = data[0];
      const requiredFields = Object.keys(sampleRecord);

      // 创建字段映射：原始字段名 -> 清理后的字段名
      const fieldMapping = new Map<string, string>();
      requiredFields.forEach((field) => {
        fieldMapping.set(field, this.sanitizeFieldName(field));
      });

      // 检查缺失字段
      const sanitizedRequiredFields = Array.from(fieldMapping.values());
      const missingFields = sanitizedRequiredFields.filter(
        (field) => !existingFieldNames.includes(field)
      );


      if (missingFields.length > 0) {

        // 找到缺失字段对应的原始字段名
        for (const sanitizedFieldName of missingFields) {
          // 找到对应的原始字段名
          let originalFieldName = "";
          for (const [original, sanitized] of fieldMapping.entries()) {
            if (sanitized === sanitizedFieldName) {
              originalFieldName = original;
              break;
            }
          }

          if (!originalFieldName) {
            console.error(`无法找到字段 ${sanitizedFieldName} 的原始名称`);
            continue;
          }

          try {
            const sampleValue = sampleRecord[originalFieldName];
            const fieldType = this.inferFieldType(sampleValue, originalFieldName); // 传递原始字段名
            console.log(
              `准备添加字段: ${sanitizedFieldName} (原名: ${originalFieldName}, 样本值: "${sampleValue}", 推断类型: ${fieldType}, DateTime类型值: ${FieldType.DateTime}, CreatedTime类型值: ${FieldType.CreatedTime})`
            );

            const fieldConfig: any = {
              name: sanitizedFieldName,
              type: fieldType,
            };

            // 如果是DateTime字段，添加格式配置
            if (fieldType === FieldType.DateTime) {
                console.log(`🕒 检测到DateTime字段，开始配置: ${sanitizedFieldName}`);
                fieldConfig.property = {
                  dateFormat: DateFormatter.DATE_TIME, // "yyyy/MM/dd HH:mm"
                  displayTimeZone: false,
                  autoFill: false
                };
                console.log(`✅ DateTime字段 "${sanitizedFieldName}" 配置完成，使用格式: ${DateFormatter.DATE_TIME}`);
            } else if (fieldType === FieldType.CreatedTime) {
                console.log(`🕒 检测到CreatedTime字段，开始配置: ${sanitizedFieldName}`);
                fieldConfig.property = {
                  dateFormat: DateFormatter.DATE_TIME, // "yyyy/MM/dd HH:mm"
                  displayTimeZone: false
                };
                console.log(`✅ CreatedTime字段 "${sanitizedFieldName}" 配置完成，使用格式: ${DateFormatter.DATE_TIME}`);
            } else {
                console.log(`⚪ 字段 "${sanitizedFieldName}" 不是时间类型，类型为: ${fieldType}`);
            }

            console.log(`开始创建字段: ${sanitizedFieldName}，配置:`, fieldConfig);
            await table.addField(fieldConfig);

            console.log(`✅ 成功添加字段: ${sanitizedFieldName}`);
          } catch (fieldError) {
            console.error(`❌ 添加字段 ${sanitizedFieldName} 失败:`, fieldError);
            // 继续添加其他字段
          }
        }
      } else {
        console.log("所有字段都已存在");
      }
    } catch (error) {
      console.warn("Failed to ensure fields:", error);
      // 继续执行，不阻断流程
    }
  }

  private async addRecords(
    table: any,
    data: any[],
    tableFields: any[],
    onProgress?: (progress: number, message: string) => void
  ): Promise<number> {
    const batchSize = 100; // 批量处理大小
    let totalAdded = 0;

    const totalBatches = Math.ceil(data.length / batchSize);
    console.log(`开始添加 ${data.length} 条记录，分 ${totalBatches} 批处理`);

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      // 报告批次进度
      if (onProgress) {
        const batchProgress = ((batchNumber - 1) / totalBatches) * 100;
        onProgress(
          batchProgress,
          `正在处理第 ${batchNumber}/${totalBatches} 批记录...`
        );
      }

      try {
        console.log(`处理第 ${batchNumber} 批，包含 ${batch.length} 条记录`);

        const records = batch.map((item, index) => {
          try {
            const fields = this.convertToTableFields(item, tableFields);
            return { fields };
          } catch (convertError) {
            console.error(`转换记录 ${i + index + 1} 失败:`, convertError);
            throw convertError;
          }
        });

        await table.addRecords(records);
        totalAdded += records.length;
        console.log(
          `第 ${batchNumber} 批添加成功，共 ${records.length} 条记录`
        );

        // 报告批次完成进度
        if (onProgress) {
          const completedProgress = (batchNumber / totalBatches) * 100;
          onProgress(
            completedProgress,
            `第 ${batchNumber}/${totalBatches} 批记录添加完成`
          );
        }
      } catch (error) {
        console.error(`Failed to add batch ${batchNumber}:`, error);

        // 尝试逐条添加以找出问题记录
        console.log(`尝试逐条添加第 ${batchNumber} 批的记录...`);
        for (let j = 0; j < batch.length; j++) {
          try {
            const item = batch[j];
            const fields = this.convertToTableFields(item, tableFields);
            // 使用单条记录添加方法，参考demo.vue的实现
            await table.addRecord({ fields });
            totalAdded += 1;
            console.log(`单条记录 ${i + j + 1} 添加成功`);
          } catch (singleError) {
            console.error(`单条记录 ${i + j + 1} 添加失败:`, singleError);
            console.error("问题记录数据:", batch[j]);

            // 详细分析字段匹配问题
            const recordFields = this.convertToTableFields(
              batch[j],
              tableFields
            );
            const recordFieldNames = Object.keys(recordFields);
            console.error("记录字段名:", recordFieldNames);

            // 重新获取表格字段进行比较
            try {
              const currentTableFields = await table.getFieldMetaList();
              const currentTableFieldNames = currentTableFields.map(
                (f: any) => f.name
              );
              console.error("当前表格字段名:", currentTableFieldNames);

              const missingFields = recordFieldNames.filter(
                (field) => !currentTableFieldNames.includes(field)
              );
              if (missingFields.length > 0) {
                console.error("记录中存在但表格中缺失的字段:", missingFields);
              }
            } catch (fieldCheckError) {
              console.error("检查字段时出错:", fieldCheckError);
            }
          }
        }
      }
    }

    console.log(`记录添加完成，总共成功添加 ${totalAdded} 条记录`);
    return totalAdded;
  }

  private convertToTableFields(data: any, tableFields: any[]): any {
    const fields: any = {};

    // 创建字段名称到字段ID和类型的映射
    const fieldNameToIdMap = new Map<string, string>();
    const fieldIdToTypeMap = new Map<string, number>();
    tableFields.forEach((field) => {
      fieldNameToIdMap.set(field.name, field.id);
      fieldIdToTypeMap.set(field.id, field.type);
    });

    for (const [key, value] of Object.entries(data)) {
      // 跳过 null、undefined 和空字符串
      if (value === null || value === undefined || value === "") {
        continue;
      }

      // 清理字段名称
      const sanitizedKey = this.sanitizeFieldName(key);

      // 查找对应的字段ID和类型
      const fieldId = fieldNameToIdMap.get(sanitizedKey);
      if (!fieldId) {
        console.warn(`未找到字段 "${sanitizedKey}" 对应的字段ID，跳过该字段`);
        continue;
      }

      const fieldType = fieldIdToTypeMap.get(fieldId);

      // 处理不同类型的值
      let processedValue = value;

      try {
        // 特殊处理CreatedTime字段 - 跳过，让飞书自动处理
        if (fieldType === FieldType.CreatedTime) {
          continue;
        }

        // 特殊处理DateTime字段
        if (fieldType === FieldType.DateTime) {
          if (typeof value === "string") {
            const trimmedValue = value.trim();
            if (trimmedValue === "") {
              continue;
            }

            try {
              // 尝试解析日期字符串为时间戳（毫秒）
              const date = new Date(trimmedValue);
              if (!isNaN(date.getTime())) {
                processedValue = date.getTime();
              } else {
                console.warn(`无法解析DateTime字段 "${sanitizedKey}" 的值: "${trimmedValue}"`);
                continue;
              }
            } catch (dateError) {
              console.warn(`DateTime字段 "${sanitizedKey}" 解析失败:`, dateError);
              continue;
            }
          } else if (typeof value === "number") {
            // 如果已经是数字，检查是否是有效的时间戳
            if (value > 0 && isFinite(value)) {
              // 如果是秒级时间戳，转换为毫秒
              processedValue = value < 10000000000 ? value * 1000 : value;
            } else {
              continue;
            }
          } else {
            continue;
          }
        } else if (typeof value === "string") {
          // 清理字符串值
          processedValue = value.trim();

          // 如果清理后为空，跳过
          if (processedValue === "") {
            continue;
          }

          // 对于URL字段，确保格式正确
          if (
            sanitizedKey.includes("链接") ||
            sanitizedKey.includes("头像") ||
            sanitizedKey.includes("封面")
          ) {
            const urlValue = String(processedValue);
            if (
              !urlValue.startsWith("http://") &&
              !urlValue.startsWith("https://")
            ) {
              // 如果不是有效URL，保持原值
              processedValue = urlValue;
            }
          }
        } else if (typeof value === "number") {
          // 确保数字值有效
          if (isNaN(value) || !isFinite(value)) {
            continue;
          }
          // 对于过大的数字，转换为字符串
          if (value > Number.MAX_SAFE_INTEGER) {
            processedValue = String(value);
          }
        } else if (typeof value === "boolean") {
          // 布尔值直接使用
          processedValue = value;
        } else {
          // 其他类型转换为字符串
          processedValue = String(value);
        }

        // 使用字段ID作为键，而不是字段名称
        fields[fieldId] = processedValue;
      } catch (processError) {
        console.warn(`处理字段 ${key} 时出错:`, processError);
        // 出错时跳过该字段
        continue;
      }
    }

    return fields;
  }
}
