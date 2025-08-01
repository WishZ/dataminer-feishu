import { IDataExtractor, Platform, PlatformDetector, ExtractOptions } from './DataExtractor';

// 主页提取器
import { XhsHomepageExtractor } from './extractors/homepage/XhsHomepageExtractor';
import { DouyinHomepageExtractor } from './extractors/homepage/DouyinHomepageExtractor';
import { TiktokHomepageExtractor } from './extractors/homepage/TiktokHomepageExtractor';
import { YoutubeHomepageExtractor } from './extractors/homepage/YoutubeHomepageExtractor';

// 详情提取器
import { DouyinDetailsExtractor } from './extractors/details/DouyinDetailsExtractor';
import { KuaishouDetailsExtractor } from './extractors/details/KuaishouDetailsExtractor';
import { TiktokDetailsExtractor } from './extractors/details/TiktokDetailsExtractor';
import { YoutubeDetailsExtractor } from './extractors/details/YoutubeDetailsExtractor';
import { XhsDetailsExtractor } from './extractors/details/XhsDetailsExtractor';

// 评论提取器
import { KuaishouCommentsExtractor } from './extractors/comments/KuaishouCommentsExtractor';
import { DouyinCommentsExtractor } from './extractors/comments/DouyinCommentsExtractor';

export class DataExtractorFactory {
  static create(extractType: string, url: string, options: ExtractOptions): IDataExtractor {
    const platform = PlatformDetector.detectPlatform(url);

    switch (extractType) {
      case 'homepage':
        return this.createHomepageExtractor(platform, options);
      case 'details':
        return this.createDetailsExtractor(platform, options);
      case 'comments':
        return this.createCommentsExtractor(platform, options);
      default:
        throw new Error(`Unsupported extract type: ${extractType}`);
    }
  }

  private static createHomepageExtractor(platform: Platform, options: ExtractOptions): IDataExtractor {
    switch (platform) {
      case 'xhs':
        return new XhsHomepageExtractor(options);
      case 'douyin':
        return new DouyinHomepageExtractor(options);
      case 'tiktok':
        return new TiktokHomepageExtractor(options);
      case 'youtube':
        return new YoutubeHomepageExtractor(options);
      default:
        throw new Error(`Unsupported platform for homepage: ${platform}`);
    }
  }
  
  private static createDetailsExtractor(platform: Platform, options: ExtractOptions): IDataExtractor {
    switch (platform) {
      case 'xhs':
        return new XhsDetailsExtractor(options);
      case 'douyin':
        return new DouyinDetailsExtractor(options);
      case 'kuaishou':
        return new KuaishouDetailsExtractor(options);
      case 'tiktok':
        return new TiktokDetailsExtractor(options);
      case 'youtube':
        return new YoutubeDetailsExtractor(options);
      default:
        throw new Error(`Unsupported platform for details: ${platform}`);
    }
  }

  private static createCommentsExtractor(platform: Platform, options: ExtractOptions): IDataExtractor {
    switch (platform) {
      case 'douyin':
        return new DouyinCommentsExtractor(options);
      case 'kuaishou':
        return new KuaishouCommentsExtractor(options);
      default:
        throw new Error(`Unsupported platform for comments: ${platform}`);
    }
  }
  
  // 获取支持的平台列表
  static getSupportedPlatforms(): Platform[] {
    return ['xhs', 'douyin', 'kuaishou', 'tiktok', 'youtube'];
  }
  
  // 检查平台是否支持指定的提取类型
  static isPlatformSupported(platform: Platform, extractType: string): boolean {
    const supportedPlatforms = this.getSupportedPlatforms();
    const supportedTypes = ['homepage', 'details', 'comments'];
    
    return supportedPlatforms.includes(platform) && supportedTypes.includes(extractType);
  }
}
