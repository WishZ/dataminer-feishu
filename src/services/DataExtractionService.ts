import {
  ExtractOptions,
  ExtractResult,
  IDataExtractor,
  PlatformDetector
} from './DataExtractor';
import { DataExtractorFactory } from './DataExtractorFactory';
import {
  DataValidatorDecorator,
  CacheDecorator,
} from './DataDecorators';
import { FeishuTableService, TableUpdateOptions, TableUpdateResult } from './FeishuTableService';

export interface ExtractionRequest {
  apiKey: string;
  extractType: string;
  url: string;
  range?: number | 'all';
  range_type?: number | 'all' | 'custom';
  startDate?: string;
  includeReplies?: boolean; // 新增：是否包含回复
  tableOptions?: {
    tableId?: string;
    createNewTable?: boolean;
    tableName?: string;
  };
  // 支持其他额外字段
  [key: string]: any;
}

export interface ExtractionResponse {
  success: boolean;
  message: string;
  extractResult?: ExtractResult;
  tableResult?: TableUpdateResult;
  extractedCount?: number;
  tableRecordCount?: number;
}

export class DataExtractionService {
  private feishuService: FeishuTableService;
  private onProgress?: (progress: number, message: string) => void;
  private cacheDecorator?: CacheDecorator;

  constructor(onProgress?: (progress: number, message: string) => void) {
    this.feishuService = new FeishuTableService();
    this.onProgress = onProgress;
  }
  
  async initialize(): Promise<void> {
    try {
      await this.feishuService.initialize();
    } catch (error) {
      console.error('Failed to initialize data extraction service:', error);
      throw error;
    }
  }
  
  async extractAndUpdate(request: ExtractionRequest): Promise<ExtractionResponse> {
    try {
      console.info(11111111)
      this.reportProgress(0, '开始数据提取流程...');
      
      // 1. 检测平台和提取类型
      const platform = PlatformDetector.detectPlatform(request.url);
      const platformName = PlatformDetector.getPlatformName(platform);
      const extractType = request.extractType;

      this.reportProgress(5, `检测到${platformName}平台，开始提取${this.getTypeDisplayName(extractType)}数据`);
      
      // 2. 准备提取选项
      const options: ExtractOptions = {
        apiKey: request.apiKey,
        range: this.normalizeRange(request.range, request.range_type),
        startDate: request.startDate,
        extractType,
        includeReplies: request.includeReplies, // 传递 includeReplies 选项
        onProgress: (progress: number, message: string) => {
          // 将提取器的进度映射到10-60%的范围
          const mappedProgress = 10 + (progress * 0.5);
          this.reportProgress(mappedProgress, message);
        }
      };

      // 3. 创建提取器链
      const { decoratedExtractor, originalExtractor } = this.createExtractorChain(extractType, request.url, options);
      
      // 4. 执行数据提取
      this.reportProgress(10, '正在提取数据...');

      const extractResult = await decoratedExtractor.extract(request.url);

      if (!extractResult.success) {
        return {
          success: false,
          message: extractResult.message || '数据提取失败',
          extractResult,
        };
      }

      this.reportProgress(60, `数据提取完成，共获取 ${extractResult.data.length} 条数据`);
      
      // 5. 更新飞书表格
      this.reportProgress(70, '正在更新飞书表格...');
      const tableOptions: TableUpdateOptions = {
        tableId: request.tableOptions?.tableId,
        createNewTable: request.tableOptions?.createNewTable,
        tableName: request.tableOptions?.tableName,
        extractType,
      };

      // 为表格更新添加进度回调
      const tableOptionsWithProgress = {
        ...tableOptions,
        onProgress: (progress: number, message: string) => {
          // 将表格更新的进度映射到70-95%的范围
          const mappedProgress = 70 + (progress * 0.25);
          this.reportProgress(mappedProgress, message);
        }
      };

      const tableResult = await this.feishuService.updateTable(extractResult.data, tableOptionsWithProgress, originalExtractor);
      
      if (!tableResult.success) {
        return {
          success: false,
          message: `数据提取成功，但表格更新失败: ${tableResult.message}`,
          extractResult,
          tableResult,
          extractedCount: extractResult.data.length,
        };
      }
      
      this.reportProgress(100, '数据提取和表格更新完成！');
      
      return {
        success: true,
        message: `成功提取 ${extractResult.data.length} 条数据并更新到飞书表格`,
        extractResult,
        tableResult,
        extractedCount: extractResult.data.length,
        tableRecordCount: tableResult.recordCount,
      };
      
    } catch (error) {
      console.error('Data extraction service error:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      this.reportProgress(100, `提取失败: ${errorMessage}`);
      
      return {
        success: false,
        message: `数据提取失败: ${errorMessage}`,
      };
    }
  }
  

  
  private createExtractorChain(extractType: string, url: string, options: ExtractOptions): { decoratedExtractor: any, originalExtractor: any } {
    // 创建基础提取器
    const originalExtractor = DataExtractorFactory.create(extractType, url, options);

    // 应用装饰器
    let decoratedExtractor: IDataExtractor = new DataValidatorDecorator(originalExtractor);

    // 如果还没有缓存装饰器，或者需要重新创建（因为选项可能不同）
    if (!this.cacheDecorator) {
      this.cacheDecorator = new CacheDecorator(decoratedExtractor);
    } else {
      // 重新设置缓存装饰器的内部提取器
      (this.cacheDecorator as any).extractor = decoratedExtractor;
    }

    decoratedExtractor = this.cacheDecorator;

    return { decoratedExtractor, originalExtractor };
  }
  
  private normalizeRange(range?: number | 'all', rangeType?: number | 'all' | 'custom'): number | 'all' {
    // 如果有rangeType，优先使用rangeType的逻辑
    if (rangeType !== undefined) {
      if (rangeType === 'all') {
        return 'all';
      }
      if (rangeType === 'custom') {
        return typeof range === 'number' ? range : 1;
      }
      if (typeof rangeType === 'number') {
        return rangeType;
      }
    }
    
    // 回退到range参数
    return range || 1;
  }
  
  private getTypeDisplayName(type: string): string {
    const typeNames = {
      homepage: '主页数据',
      details: '详情数据',
      comments: '评论数据',
      unknown: '未知类型',
    };
    
    return typeNames[type as keyof typeof typeNames] || type;
  }
  
  private reportProgress(progress: number, message: string) {
    if (this.onProgress) {
      this.onProgress(progress, message);
    }
  }
  
  // 获取可用的表格列表
  async getAvailableTables() {
    return this.feishuService.getTableList();
  }
  
  // 获取当前选中的表格
  async getCurrentSelection() {
    return this.feishuService.getCurrentSelection();
  }
}
