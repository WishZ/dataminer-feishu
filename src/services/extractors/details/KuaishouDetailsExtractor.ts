import { formatDuration, formatTimestamp } from '../../../lib/utils';
import { BasePlatformExtractor, Platform, ExtractOptions, ExtractResult, InsufficientCreditsError } from '../../DataExtractor';
import { ResolutionUtils } from '../../../lib/ResolutionUtils';
import { ProxyUtils } from '../../../lib/ProxyUtils';

export class KuaishouDetailsExtractor extends BasePlatformExtractor {
  protected platform: Platform = 'kuaishou';
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
      if (!result.data?.photo) {
        throw new Error('视频详情数据结构异常');
      }

      reportProgress(50, '正在格式化数据...');
      const formattedData = await this.formatData([result.data]);

      reportProgress(100, '视频详情提取完成');

      return {
        success: true,
        data: formattedData,
        totalCount: 1,
        platform: '快手',
        extractType: this.extractType,
        message: '快手视频详情提取成功',
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
        message: error instanceof Error ? error.message : '快手视频详情提取失败',
      };
    }
  }

  protected getApiEndpoint(): string {
    return '/kuaishou/video/detail';
  }

  protected getTypeDisplayName(): string {
    return '快手详情';
  }

  protected async formatData(dataList: any[]): Promise<any[]> {
    const formattedItems = [];

    for (const data of dataList) {
      const photo = data.photo;

      // 基础信息
      const baseData: any = {
        平台: '快手',
        视频ID: photo.photoId || '',
        标题: photo.caption || '',
        发布时间: formatTimestamp(photo.timestamp / 1000), // 快手时间戳是毫秒
        视频时长: formatDuration(Math.floor(photo.duration / 1000)), // 快手时长是毫秒
        视频封面: await this.getFirstUrl(photo.coverUrls),

        // 作者信息
        作者ID: photo.userId || '',
        作者昵称: photo.userName || '',
        作者头像: await this.getFirstUrl(photo.headUrls),
        作者性别: photo.userSex || '',
        作者认证: photo.verified || false,

        // 统计数据
        点赞数: photo.likeCount.toLocaleString() || 0,
        评论数: photo.commentCount.toLocaleString() || 0,
        分享数: photo.shareCount.toLocaleString() || 0,
        观看数: photo.viewCount.toLocaleString() || 0,
        转发数: photo.forwardCount.toLocaleString() || 0,
        // 音乐信息
        音乐名称: photo.soundTrack?.name || '',
        音乐作者: photo.soundTrack?.artist || '',
        音乐ID: photo.soundTrack?.id || '',
        音乐链接: await this.getFirstUrl(photo.soundTrack?.audioUrls),
        音乐封面: await this.getFirstUrl(photo.soundTrack?.imageUrls),

        提取时间: Date.now(),
      };

      // 初始化所有支持的分辨率列为空字符串
      ResolutionUtils.supportedResolutions.forEach(resolution => {
        baseData[`视频分辨率_${resolution}`] = '';
      });

      // 处理视频流信息，提取不同分辨率的视频链接
      if (photo.manifest?.adaptationSet && Array.isArray(photo.manifest.adaptationSet)) {
        for (const adaptationSet of photo.manifest.adaptationSet) {
          if (adaptationSet.representation && Array.isArray(adaptationSet.representation)) {
            for (const representation of adaptationSet.representation) {
              if (representation.url && representation.width && representation.height) {
                // 使用ResolutionUtils标准化分辨率
                const rawResolution = `${representation.width}x${representation.height}`;
                const standardResolution = ResolutionUtils.normalizeResolution(rawResolution);

                if (standardResolution) {
                  const columnName = `视频分辨率_${standardResolution}`;

                  // 只有在还没有设置该分辨率时才设置，优先使用更好的质量
                  if (!baseData[columnName]) {
                    const proxyUrl = await ProxyUtils.smartProxyUrl(representation.url, 'kuaishou');
                    baseData[columnName] = proxyUrl;
                  }
                }
              }
            }
          }
        }
      }

      formattedItems.push(baseData);
    }

    return formattedItems;
  }

  // 获取URL数组中的第一个URL并应用代理
  private async getFirstUrl(urlArray: any[]): Promise<string> {
    if (!urlArray || !Array.isArray(urlArray) || urlArray.length === 0) {
      return '';
    }

    const firstItem = urlArray[0];
    if (firstItem && firstItem.url) {
      return await ProxyUtils.smartProxyUrl(firstItem.url, 'kuaishou');
    }

    return '';
  }
}
