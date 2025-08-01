// 响应错误码常量
export const ResponseCode = {
  SUCCESS: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
  INSUFFICIENT_CREDITS: 4001, // 自定义错误码：积分不足
} as const;

// 积分不足错误类
export class InsufficientCreditsError extends Error {
  public readonly code: number;

  constructor(message: string = '您的 Credits 已耗尽，请前往 https://data.snappdown.com 充值后使用') {
    super(message);
    this.name = 'InsufficientCreditsError';
    this.code = ResponseCode.INSUFFICIENT_CREDITS;
  }
}

// 数据提取服务接口
export interface IDataExtractor {
  extract(url: string): Promise<ExtractResult>;
}

// 提取选项
export interface ExtractOptions {
  apiKey: string;
  range?: number | 'all';
  startDate?: string;
  [key: string]: any;
}

// 提取结果
export interface ExtractResult {
  success: boolean;
  data: any[];
  message?: string;
  totalCount?: number;
  platform?: string;
  extractType?: string;
}

// 支持的平台类型
export type Platform = 'xhs' | 'douyin' | 'kuaishou' | 'tiktok' | 'youtube';

// 平台检测器
export class PlatformDetector {
  static detectPlatform(url: string): Platform {
    const cleanUrl = url.toLowerCase().trim();

    // 小红书
    if (cleanUrl.includes('xiaohongshu.com') || cleanUrl.includes('xhslink.com')) {
      return 'xhs';
    }

    // 抖音
    if (cleanUrl.includes('douyin.com') || cleanUrl.includes('v.douyin.com') || cleanUrl.includes('iesdouyin.com')) {
      return 'douyin';
    }

    // 快手
    if (cleanUrl.includes('kuaishou.com') || cleanUrl.includes('kwai.com') || cleanUrl.includes('chenzhongtech.com')) {
      return 'kuaishou';
    }

    // TikTok
    if (cleanUrl.includes('tiktok.com') || cleanUrl.includes('vm.tiktok.com')) {
      return 'tiktok';
    }

    // YouTube
    if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) {
      return 'youtube';
    }

    // 默认返回抖音（最常用）
    return 'douyin';
  }

  static getPlatformName(platform: Platform): string {
    const names = {
      xhs: '小红书',
      douyin: '抖音',
      kuaishou: '快手',
      tiktok: 'TikTok',
      youtube: 'YouTube',
    };
    return names[platform];
  }
}



// 基础平台提取器
export abstract class BasePlatformExtractor implements IDataExtractor {
  protected baseUrl = '/api';
  protected abstract platform: Platform;
  protected abstract extractType: string;
  protected options: ExtractOptions;

  constructor(options: ExtractOptions) {
    this.options = options;
  }

  // 抽象方法，每个子类必须实现自己的提取逻辑
  abstract extract(url: string): Promise<ExtractResult>;

  protected abstract formatData(data: any[]): Promise<any[]>;
  protected abstract getApiEndpoint(): string;
  protected abstract getTypeDisplayName(data?: any[]): string;

  protected async makeRequest(endpoint: string, payload?: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.options.apiKey,
      },
      body: JSON.stringify(payload || {}),
    });

    const result = await response.json();

    // 检查是否是积分不足的情况 - 使用服务端定义的错误码
    if (result.code === 4001 || (result.code === 500 && result.message && result.message.includes('Credits 已耗尽'))) {
      throw new InsufficientCreditsError(result.message);
    }

    // 检查其他API错误
    if (!result.success) {
      throw new Error(`API request failed: ${result.message || 'Unknown error'}`);
    }

    return result;
  }

  // 处理积分不足的情况
  protected async handleInsufficientCredits(
    error: InsufficientCreditsError,
    allData: any[],
    currentPage: number,
    reportProgress?: (progress: number, message: string) => void
  ): Promise<ExtractResult> {
    console.log('积分不足，停止继续提取');

    if (allData.length > 0) {
      // 如果已经获取到部分数据，返回部分数据并提示用户
      if (reportProgress) {
        reportProgress(90, '正在格式化已获取的数据...');
      }

      const formattedData = await this.formatData(allData);
      const platformName = this.getPlatformDisplayName();

      return {
        success: true,
        data: formattedData,
        totalCount: allData.length,
        platform: platformName,
        extractType: this.extractType,
        message: `积分不足，已获取 ${allData.length} 条数据（${currentPage - 1} 页）。${error.message}`,
      };
    } else {
      // 没有获取到任何数据，直接返回错误
      return {
        success: false,
        data: [],
        message: error.message,
      };
    }
  }

  // 获取平台显示名称
  protected getPlatformDisplayName(): string {
    const platformNames: Record<Platform, string> = {
      'douyin': '抖音',
      'tiktok': 'TikTok',
      'xhs': '小红书',
      'kuaishou': '快手',
      'youtube': 'YouTube'
    };
    return platformNames[this.platform] || this.platform;
  }
}


