import { formatDuration, formatTimestamp } from '../../../lib/utils';
import { BasePlatformExtractor, Platform, ExtractOptions, ExtractResult, InsufficientCreditsError } from '../../DataExtractor';
import { ResolutionUtils } from '../../../lib/ResolutionUtils';
import { ProxyUtils } from '../../../lib/ProxyUtils';

export class DouyinDetailsExtractor extends BasePlatformExtractor {
  protected platform: Platform = 'douyin';
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
      if (!result.data?.aweme_detail) {
        throw new Error('视频详情数据结构异常');
      }

      reportProgress(50, '正在格式化数据...');
      const formattedData = await this.formatData([result.data.aweme_detail]);

      reportProgress(100, '视频详情提取完成');

      return {
        success: true,
        data: formattedData,
        totalCount: 1,
        platform: '抖音',
        extractType: this.extractType,
        message: '抖音视频详情提取成功',
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
        message: error instanceof Error ? error.message : '抖音视频详情提取失败',
      };
    }
  }

  protected getApiEndpoint(): string {
    return '/dy/video/info';
  }

  protected getTypeDisplayName(): string {
    return '抖音详情';
  }

  protected async formatData(awemeList: any[]): Promise<any[]> {
    const formattedItems = [];

    for (const aweme of awemeList) {
      // 基础信息
      const baseData: any = {
        平台: '抖音',
        视频ID: aweme.aweme_id || '',
        标题: aweme.desc || '',
        发布时间: formatTimestamp(aweme.create_time),
        视频时长: formatDuration(Math.floor(aweme.duration / 1000)),
        视频封面: aweme.video?.origin_cover?.url_list?.[0] ? await ProxyUtils.smartProxyUrl(aweme.video.origin_cover.url_list[0], 'douyin') : '',

        // 作者信息
        作者ID: aweme.author?.uid || '',
        作者昵称: aweme.author?.nickname || '',
        作者头像: aweme.author?.avatar_thumb?.url_list?.[0] ? await ProxyUtils.smartProxyUrl(aweme.author.avatar_thumb.url_list[0], 'douyin') : '',
        作者签名: aweme.author?.signature || '',
        作者粉丝数: aweme.author?.follower_count.toLocaleString() || 0,
        作者关注数: aweme.author?.following_count.toLocaleString() || 0,
        作者获赞数: aweme.author?.total_favorited.toLocaleString() || 0,
        // 统计数据
        点赞数: aweme.statistics?.digg_count.toLocaleString() || 0,
        评论数: aweme.statistics?.comment_count.toLocaleString() || 0,
        分享数: aweme.statistics?.share_count.toLocaleString() || 0,
        收藏数: aweme.statistics?.collect_count.toLocaleString() || 0,
        // 播放数: aweme.statistics?.play_count.toLocaleString() || 0,

        // 音乐信息
        音乐标题: aweme.music?.title || '',
        音乐作者: aweme.music?.author || '',
        音乐ID: aweme.music?.id_str || '',
        音乐时长: formatDuration(aweme.music?.duration || 0),
        音乐链接: aweme.music?.play_url?.url_list?.[0] ? await ProxyUtils.smartProxyUrl(aweme.music.play_url.url_list[0], 'douyin') : '',
        提取时间: Date.now(),
      };

      // 初始化所有支持的分辨率列为空字符串
      ResolutionUtils.supportedResolutions.forEach(resolution => {
        baseData[`视频分辨率_${resolution}`] = '';
      });

      // 处理视频流信息，提取不同分辨率的视频链接
      if (aweme.video?.bit_rate && Array.isArray(aweme.video.bit_rate)) {
        for (const bitRate of aweme.video.bit_rate) {
          if (bitRate.play_addr?.url_list && bitRate.play_addr.url_list.length > 0) {
            // 使用ResolutionUtils标准化分辨率
            const rawResolution = `${bitRate.play_addr.width}x${bitRate.play_addr.height}`;
            const standardResolution = ResolutionUtils.normalizeResolution(rawResolution);

            if (standardResolution) {
              const columnName = `视频分辨率_${standardResolution}`;

              // 只有在还没有设置该分辨率时才设置，优先使用更好的质量
              if (!baseData[columnName]) {
                const proxyUrl = await ProxyUtils.smartProxyUrl(bitRate.play_addr.url_list[0], 'douyin');
                baseData[columnName] = proxyUrl;
              }
            }
          }
        }
      }

      formattedItems.push(baseData);
    }

    return formattedItems;
  }
}
