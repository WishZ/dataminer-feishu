import { formatDuration, formatTimestamp } from '../../../lib/utils';
import { BasePlatformExtractor, Platform, ExtractOptions, ExtractResult, InsufficientCreditsError } from '../../DataExtractor';
import { ResolutionUtils } from '../../../lib/ResolutionUtils';
import { ProxyUtils } from '../../../lib/ProxyUtils';

export class TiktokDetailsExtractor extends BasePlatformExtractor {
  protected platform: Platform = 'tiktok';
  protected extractType = 'details';

  constructor(options: ExtractOptions) {
    super(options);
  }

  async extract(url: string): Promise<ExtractResult> {
    try {
      // 进度回调辅助函数
      const reportProgress = (progress: number, message: string) => {
        if (this.options.onProgress && typeof this.options.onProgress === 'function') {
          this.options.onProgress(progress, message);
        }
      };

      reportProgress(0, '开始提取视频详情...');

      // 构建请求负载
      const payload = {
        url: url.trim(),
      };

      const endpoint = this.getApiEndpoint();
      const result = await this.makeRequest(endpoint, payload);

      // 检查响应数据结构
      if (!result.data?.itemInfo?.itemStruct) {
        throw new Error('视频详情数据结构异常');
      }

      reportProgress(50, '正在格式化数据...');
      const formattedData = await this.formatData([result.data.itemInfo.itemStruct]);

      reportProgress(100, '视频详情提取完成');

      return {
        success: true,
        data: formattedData,
        totalCount: 1,
        platform: 'TikTok',
        extractType: this.extractType,
        message: 'TikTok视频详情提取成功',
      };
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        return {
          success: false,
          data: [],
          message: error.message,
        };
      }

      return {
        success: false,
        data: [],
        message: error instanceof Error ? error.message : 'TikTok视频详情提取失败',
      };
    }
  }

  protected getApiEndpoint(): string {
    return '/tiktok/video/detail';
  }

  protected getTypeDisplayName(): string {
    return 'TikTok详情';
  }

  protected async formatData(itemList: any[]): Promise<any[]> {
    const formattedItems = [];

    for (const item of itemList) {
      // 基础信息
      const baseData: any = {
        平台: 'TikTok',
        视频ID: item.id || '',
        标题: item.desc || '',
        发布时间: formatTimestamp(item.createTime),
        视频时长: formatDuration(item.video?.duration || 0),
        视频封面: item.video?.cover ? await ProxyUtils.smartProxyUrl(item.video.cover, 'tiktok') : '',

        // 作者信息
        作者ID: item.author?.id || '',
        作者昵称: item.author?.nickname || '',
        作者唯一ID: item.author?.uniqueId || '',
        作者头像: item.author?.avatarLarger ? await ProxyUtils.smartProxyUrl(item.author.avatarLarger, 'tiktok') : '',
        作者签名: item.author?.signature || '',
        作者粉丝数: item.authorStats?.followerCount.toLocaleString() || 0,
        作者关注数: item.authorStats?.followingCount.toLocaleString() || 0,
        作者获赞数: item.authorStats?.heartCount.toLocaleString() || 0,
        作者视频数: item.authorStats?.videoCount.toLocaleString() || 0,

        // 统计数据
        点赞数: item.stats?.diggCount.toLocaleString() || 0,
        评论数: item.stats?.commentCount.toLocaleString() || 0,
        分享数: item.stats?.shareCount.toLocaleString() || 0,
        收藏数: item.stats?.collectCount.toLocaleString() || 0,
        播放数: item.stats?.playCount.toLocaleString() || 0,

        // 音乐信息
        音乐ID: item.music?.id || '',
        音乐标题: item.music?.title || '',
        音乐作者: item.music?.authorName || '',
        音乐时长: formatDuration(item.music?.duration || 0),
        音乐链接: item.music?.playUrl ? await ProxyUtils.smartProxyUrl(item.music.playUrl, 'tiktok') : '',
        // 话题标签
        话题标签: this.extractChallenges(item.challenges),

        // 字幕信息
        字幕信息: await this.formatSubtitleInfo(item.id, item.video?.subtitleInfos),

        提取时间: Date.now(),
      };

      formattedItems.push(baseData);
    }

    return formattedItems;
  }

  // 提取话题标签
  private extractChallenges(challenges: any[]): string {
    if (!challenges || !Array.isArray(challenges) || challenges.length === 0) {
      return '';
    }

    return challenges.map(challenge => challenge.title || '').filter(title => title).join(', ');
  }

  // 格式化字幕信息
  private async formatSubtitleInfo(videoId: string, subtitleInfos: any[]): Promise<string> {
    if (!subtitleInfos || !Array.isArray(subtitleInfos) || subtitleInfos.length === 0) {
      return '';
    }

    const subtitleDetails = [];

    for (const subtitle of subtitleInfos) {
      const details: string[] = [];

      if (subtitle.LanguageCodeName) {
        details.push(`语言: ${subtitle.LanguageCodeName}`);
      }

      if (subtitle.Source) {
        details.push(`来源: ${subtitle.Source}`);
      }

      if (subtitle.Size) {
        details.push(`大小: ${subtitle.Size} bytes`);
      }

      if (subtitle.Url) {
        const proxyUrl = await ProxyUtils.buildDownloadProxyUrl(subtitle.Url, 60*60, 'tiktok', '', videoId + '_' + subtitle.LanguageCodeName + '.' + subtitle.Format);
        details.push(`链接: ${proxyUrl}`);
      }

      subtitleDetails.push(details.join(', '));
    }

    return subtitleDetails.join(' | ');
  }
}
