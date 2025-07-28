import { IDataExtractor, ExtractOptions, ExtractResult, Platform, PlatformDetector } from './DataExtractor';

// 装饰器基类
export abstract class DataExtractorDecorator implements IDataExtractor {
  protected extractor: IDataExtractor;

  constructor(extractor: IDataExtractor) {
    this.extractor = extractor;
  }

  async extract(url: string): Promise<ExtractResult> {
    return this.extractor.extract(url);
  }
}

// 数据验证装饰器
export class DataValidatorDecorator extends DataExtractorDecorator {
  private options: ExtractOptions;

  constructor(extractor: IDataExtractor) {
    super(extractor);
    // 从装饰的提取器中获取选项
    this.options = (extractor as any).options || {};
  }

  async extract(url: string): Promise<ExtractResult> {
    // 提取前验证
    const validationError = this.validateInput(url);
    if (validationError) {
      return {
        success: false,
        data: [],
        message: validationError,
      };
    }

    const result = await super.extract(url);

    // 提取后验证
    if (result.success) {
      result.data = this.validateAndCleanData(result.data);
    }

    return result;
  }

  private validateInput(url: string): string | null {
    if (!url || !url.trim()) {
      return '请输入有效的URL';
    }

    if (!this.options.apiKey || !this.options.apiKey.trim()) {
      return '请输入有效的API Key';
    }

    // URL格式验证
    const urlPattern = /^https?:\/\/.+/;
    const urls = url.split('\n').filter(u => u.trim());

    for (const singleUrl of urls) {
      if (!urlPattern.test(singleUrl.trim())) {
        return `无效的URL格式: ${singleUrl}`;
      }
    }

    return null;
  }
  
  private validateAndCleanData(data: any[]): any[] {
    return data.filter(item => {
      // 过滤掉空数据或无效数据
      if (!item || typeof item !== 'object') {
        return false;
      }
      
      // 确保必要字段存在
      return true;
    }).map(item => {
      // 清理和标准化数据
      const cleaned: any = {};
      
      for (const [key, value] of Object.entries(item)) {
        if (value !== null && value !== undefined) {
          // 清理字符串
          if (typeof value === 'string') {
            cleaned[key] = value.trim();
          } else {
            cleaned[key] = value;
          }
        }
      }
      
      return cleaned;
    });
  }
}

// 进度跟踪装饰器
export class ProgressTrackerDecorator extends DataExtractorDecorator {
  private onProgress?: (progress: number, message: string) => void;

  constructor(extractor: IDataExtractor, onProgress?: (progress: number, message: string) => void) {
    super(extractor);
    this.onProgress = onProgress;
  }

  async extract(url: string): Promise<ExtractResult> {
    this.reportProgress(0, '开始数据提取...');

    try {
      this.reportProgress(25, '正在连接API...');

      const result = await super.extract(url);

      if (result.success) {
        this.reportProgress(75, '数据提取完成，正在处理...');
        this.reportProgress(100, `成功提取 ${result.data.length} 条数据`);
      } else {
        this.reportProgress(100, `提取失败: ${result.message}`);
      }

      return result;
    } catch (error) {
      this.reportProgress(100, `提取出错: ${error instanceof Error ? error.message : '未知错误'}`);
      throw error;
    }
  }
  
  private reportProgress(progress: number, message: string) {
    if (this.onProgress) {
      this.onProgress(progress, message);
    }
  }
}

// 缓存装饰器
export class CacheDecorator extends DataExtractorDecorator {
  private cache = new Map<string, { result: ExtractResult; timestamp: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5分钟缓存

  constructor(extractor: IDataExtractor) {
    super(extractor);
  }

  private getOptions(): ExtractOptions {
    // 从装饰的提取器中获取选项
    return (this.extractor as any).options || {};
  }

  async extract(url: string): Promise<ExtractResult> {
    const cacheKey = this.generateCacheKey(url);
    const cached = this.cache.get(cacheKey);

    console.log(`[CacheDecorator] 缓存键: ${cacheKey}`);
    console.log(`[CacheDecorator] 缓存大小: ${this.cache.size}`);

    // 检查缓存是否有效
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log(`[CacheDecorator] 缓存命中! 数据条数: ${cached.result.data.length}`);
      return {
        ...cached.result,
        message: `${cached.result.message} (来自缓存)`,
      };
    }

    console.log(`[CacheDecorator] 缓存未命中，执行实际提取`);

    // 执行提取
    const result = await super.extract(url);

    // 缓存成功的结果
    if (result.success) {
      console.log(`[CacheDecorator] 缓存提取结果，数据条数: ${result.data.length}`);
      this.cache.set(cacheKey, {
        result,
        timestamp: Date.now(),
      });
    }

    return result;
  }

  private generateCacheKey(url: string): string {
    const options = this.getOptions();
    return `${url}_${options.apiKey}_${JSON.stringify({
      range: options.range,
      startDate: options.startDate,
      extractType: options.extractType,
    })}`;
  }
}
