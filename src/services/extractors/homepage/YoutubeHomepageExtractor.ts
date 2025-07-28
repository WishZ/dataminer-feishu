import { BasePlatformExtractor, Platform, ExtractOptions, ExtractResult, PlatformDetector } from '../../DataExtractor';

export class YoutubeHomepageExtractor extends BasePlatformExtractor {
  protected platform: Platform = 'youtube';
  protected extractType = 'homepage';

  async extract(url: string): Promise<ExtractResult> {
    try {
      const payload = "";
      const endpoint = this.getApiEndpoint();
      const result = await this.makeRequest(endpoint, payload);

      const formattedData = await this.formatData(result.data || []);

      return {
        success: true,
        data: formattedData,
        totalCount: result.totalCount,
        platform: PlatformDetector.getPlatformName(this.platform),
        message: `${PlatformDetector.getPlatformName(this.platform)}${this.getTypeDisplayName()}数据提取成功`,
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        message: error instanceof Error ? error.message : `${this.getTypeDisplayName()}数据提取失败`,
      };
    }
  }

  protected buildPayload(url: string, options: ExtractOptions): any {
    return {
      url,
      range: options.range,
      startDate: options.startDate,
    };
  }

  protected getApiEndpoint(): string {
    return '/homepage/youtube/extract';
  }

  protected getTypeDisplayName(data?: any[]): string {
    // 如果有数据，尝试获取作者名称
    if (data && data.length > 0) {
      const firstItem = data[0];
      const authorName = firstItem.作者 || firstItem.author?.nickname || '';
      if (authorName) {
        return `YouTube主页_${authorName}`;
      }
    }
    return 'YouTube主页';
  }

  protected async formatData(data: any[]): Promise<any[]> {
    return data.map(item => ({
      平台: 'YouTube',
      标题: item.title || '',
      描述: item.description || item.content || '',
      链接: item.url || '',
      发布时间: item.publishTime ? new Date(item.publishTime).toLocaleString('zh-CN') : '',
      点赞数: item.likeCount || 0,
      评论数: item.commentCount || 0,
      分享数: item.shareCount || 0,
      观看数: item.viewCount || 0,
      作者: item.author || item.channelName || '',
      作者头像: item.authorAvatar || item.channelAvatar || '',
      频道名: item.channelName || '',
      频道ID: item.channelId || '',
      视频时长: item.duration || '',
      视频质量: item.quality || '',
      分类: item.category || '',
      标签: Array.isArray(item.tags) ? item.tags.join(', ') : '',
      字幕语言: Array.isArray(item.subtitles) ? item.subtitles.join(', ') : '',
      是否会员专享: item.isMembersOnly || false,
      是否年龄限制: item.isAgeRestricted || false,
      订阅数: item.subscriberCount || 0,
      总观看数: item.totalViews || 0,
      视频总数: item.videoCount || 0,
      提取时间: new Date().toLocaleString('zh-CN'),
    }));
  }
}
